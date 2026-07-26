import { nativeStateChange, toneStyle, roundStyle, roundAttr } from "../anta_helpers"
import type { BaseProps } from "../general_types"
import { Button } from "./Button"

/** Public props for the `<Banner>` message strip. `message` is the leading
 *  content, `children` sit between it and `actions`, all centered in one row. */
export interface BannerProps extends BaseProps {
  /** Leading message — a string (rendered at the banner type scale) or any node.
   *  Centered in the bar, followed by `children` and then `actions`. */
  message?: React.ReactNode
  /** Trailing controls (buttons, links) rendered as a compact row after the
   *  message and `children`. */
  actions?: React.ReactNode
  /** Free content placed BETWEEN the message and the actions. */
  children?: React.ReactNode
  /** Semantic tone, or any literal CSS color (`'#ff1493'`, `'rebeccapurple'`) for
   *  a one-off custom tone. Named tones re-point the surface, text, and border
   *  colour (used if you opt into a border); a custom color keeps its hue while
   *  lightness/chroma are pinned. `'neutral'` (the default) is the same as omitting it.
   *  @defaultValue 'neutral' */
  tone?:
    | "neutral"
    | "brand"
    | "info"
    | "success"
    | "warning"
    | "critical"
    | (string & {})
  /** Rounded corners for a standalone, floating banner (`border-radius: 999px`,
   *  which clamps to a stadium) instead of the edge-to-edge strip. Still borderless
   *  by default. Pass a `number` (px) or a CSS length string for a custom radius. */
  round?: boolean | number | string
  /** Whether the trailing ✕ dismiss button is present. `false` removes it — drive
   *  dismissal yourself (a controlled `dismissed`, or your own control) instead.
   *  It doesn't make the banner un-dismissible, it just drops the built-in ✕.
   *  @defaultValue true */
  closable?: boolean
  /** Controlled dismissed state. When provided, the consumer owns visibility: the
   *  banner only follows this prop, and clicking ✕ *requests* dismissal via
   *  `onDismiss` (reject by not updating). Leave undefined for uncontrolled. */
  dismissed?: boolean
  /** Initial dismissed state for the uncontrolled case (read once on mount).
   *  @defaultValue false */
  defaultDismissed?: boolean
  /** Fired when the user dismisses the banner (clicks ✕). Uncontrolled, the banner
   *  hides itself and this just notifies; controlled, set `dismissed` to `true` to
   *  apply, or ignore it to reject. */
  onDismiss?: () => void
}

/** The element's `statechange` payload, in the `'open'|'closed'` vocabulary. */
type StateChangeDetail = { next: "open" | "closed"; prev: "open" | "closed" }
type StateChangeEvent =
  | CustomEvent<StateChangeDetail>
  | { nativeEvent: CustomEvent<StateChangeDetail> }

/**
 * `<Banner>` — a full-width, dismissible message strip with a bottom border.
 *
 * A close cousin of `<Card>` with a small, centered horizontal payload:
 * `message` leads, `children` sit in the middle, `actions` trail, and (when
 * `closable`) a 40px-wide, full-height ✕ fills the right edge without shifting the centered group.
 *
 * A pure, stateless pass-through to `<a-banner>`: the element owns dismissal and
 * visibility, so the wrapper holds no state and grabs no ref — it maps props to
 * attributes (safe wherever the host DOM is reconciled, incl. off the UI thread).
 *
 * Uncontrolled (`defaultDismissed`): the element owns visibility and the ✕
 * self-dismisses. Controlled (`dismissed` + `onDismiss`): the wrapper emits
 * `state="open"|"closed"`; the element treats the attribute as the source of
 * truth and the ✕ only *requests* dismissal. The element uses Anta's shared
 * open/closed state contract under the hood — the wrapper presents it as the
 * banner-natural `dismissed` (closed = dismissed). See STATEFUL-COMPONENTS.md.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only) to
 * register the underlying custom element.
 *
 * @example Basic usage
 * ```tsx
 * <Banner tone="info" message="A new release is available." actions={<Button size="small" label="Update" />} />
 * ```
 *
 * @example Controlled
 * ```tsx
 * const [hidden, setHidden] = useState(false)
 * <Banner message="Saved." dismissed={hidden} onDismiss={() => setHidden(true)} />
 * ```
 */
export const Banner = ({
  message,
  actions,
  tone,
  round,
  closable,
  dismissed,
  defaultDismissed,
  onDismiss,
  className,
  style,
  children,
  ...rest
}: BannerProps) => {
  const controlled = dismissed !== undefined

  // A non-named tone is a literal CSS color: feed it to the element's oklch
  // derivation via an inline custom property; a valued `round` likewise feeds
  // --banner-round. Shared helpers — see anta_helpers.
  const computedStyle = roundStyle(
    round,
    "--banner-round",
    toneStyle(tone, "--banner-tone-source", style),
  )

  // A string / number message becomes a styled <a-banner-message>; a node is the
  // consumer's own markup, slotted through a layout-neutral display:contents span
  // (no cloneElement — that's React-only and breaks the configure() portability).
  const messageNode =
    message == null ? null : typeof message === "string" || typeof message === "number" ? (
      <a-banner-message slot="message">{message}</a-banner-message>
    ) : (
      <span slot="message" style={{ display: "contents" }}>
        {message}
      </span>
    )

  return (
    <a-banner
      // The element speaks open/closed; the wrapper's `dismissed` is the inverse.
      state={controlled ? (dismissed ? "closed" : "open") : undefined}
      // A banner is shown by default, so uncontrolled always emits an explicit
      // default-state (absent reads `closed` → hidden).
      default-state={!controlled ? (defaultDismissed ? "closed" : "open") : undefined}
      tone={tone && tone !== "neutral" ? tone : undefined}
      round={roundAttr(round)}
      // All-lowercase `onstatechange` is the one spelling both renderers bind to
      // the element's `statechange` event (React 19 keeps the case after `on`, so
      // `onStateChange` would listen for "StateChange"; Preact lowercases).
      onstatechange={
        onDismiss
          ? (e: StateChangeEvent) => {
              const { detail, isOwn } = nativeStateChange<StateChangeDetail>(e)
              // Only the banner's own dismiss counts (a foreign bubbling
              // `statechange` speaks a different vocabulary). next is always
              // 'closed' for a dismiss request. See nativeStateChange.
              if (isOwn && detail?.next === "closed") onDismiss()
            }
          : undefined
      }
      class={className}
      style={computedStyle}
      {...rest}
    >
      {messageNode}
      {children}
      {actions != null && (
        <span slot="actions" style={{ display: "contents" }}>
          {actions}
        </span>
      )}
      {closable !== false && (
        // A real <a-button> (light DOM → fully styled, keyboard-focusable) in the
        // element's `close` slot. It fires the bubbling `dismissrequest` event via
        // a-button's global listener, so dismissing works even without framework
        // hydration; the element turns that into a dismiss request.
        // CONTRACT: `data-custom-event` below MUST match `DISMISS_TRIGGER` in the
        // element (src/elements/a-banner.ts). Duplicated, not shared — importing
        // the element module here would self-register it and break the
        // wrapper/element decoupling. Rename in both places.
        <span slot="close" style={{ display: "contents" }}>
          <Button
            priority="quaternary"
            icon="x"
            // The ✕ adopts the banner's tone (named or a custom CSS color), so it
            // reads as part of the strip rather than a neutral control on top of it.
            tone={tone}
            aria-label="Dismiss"
            data-custom-event="dismissrequest"
          />
        </span>
      )}
    </a-banner>
  )
}
