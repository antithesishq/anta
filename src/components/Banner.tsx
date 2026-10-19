import { nativeStateChange, neutralToneAttr, toneStyle, roundStyle, roundAttr, type StateChangeEvent, hasChildren } from "../anta_helpers"
import type { BaseProps } from "../general_types"
import { Button } from "./Button"
import { useNativeEventProps } from "../native-event-props"

/** Props for the `<Banner>` message strip. `message` leads, `children` precede
 *  `actions`, and `align` places the row. */
export interface BannerProps extends BaseProps {
  /** Leading message: a string at the banner type scale or any node. */
  message?: React.ReactNode
  /** Trailing controls (buttons, links) rendered as a compact row after the
   *  message and `children`. */
  actions?: React.ReactNode
  /** Supporting content between the message and actions. */
  children?: React.ReactNode
  /** Semantic tone or a CSS color. Colors the surface, text, border, and dismiss
   * control. Custom colors use an inline CSS variable; under a CSP that blocks
   * style attributes, provide that variable through external CSS instead.
   * @defaultValue 'neutral' */
  tone?:
    | "neutral"
    | "brand"
    | "info"
    | "success"
    | "warning"
    | "critical"
    | (string & {})
  /** Positions the content row. `'start'` aligns it to the inline edge; `'center'`
   *  centers it. Wrapped message text follows the selected alignment.
   *  @defaultValue 'start' */
  align?: "start" | "center"
  /** Rounded corners for a standalone, floating banner (`border-radius: 999px`,
   *  which clamps to a stadium) instead of the edge-to-edge strip. Still borderless
   *  by default. Pass a `number` (px) or a CSS length string for a custom radius. */
  round?: boolean | number | string
  /** Show the built-in Dismiss control. Set false when the notice is permanent
   * or another action requests dismissal through `data-banner-dismiss`.
   * @defaultValue true */
  closable?: boolean
  /** Host role. Use 'status' for polite announcements or 'alert' for urgent ones.
   * @defaultValue 'status' */
  role?: string
  /** Controlled visibility. Set true in `onDismiss` to accept a request, or keep
   * false to reject it. Set false to show the notice again. Dismissal hides the
   * host and retains its children; it does not unmount them. */
  dismissed?: boolean
  /** Initial dismissed state for the uncontrolled case (read once on mount). */
  defaultDismissed?: boolean
  /** Dismissal request from the close control or a `data-banner-dismiss` action.
   * Controlled Banner stays visible until `dismissed` changes. Uncontrolled
   * Banner applies an uncanceled request itself. */
  onDismiss?: () => void
}

/** The element's `statechange` payload, in the `'open'|'closed'` vocabulary. */
type StateChangeDetail = { next: "open" | "closed"; prev: "open" | "closed" }

/**
 * Full-width notice with a message, supporting content, actions, and dismissal.
 * JSX owns the light-DOM regions and ARIA. External CSS renders the layout before
 * registration; the browser element owns visibility through ElementInternals.
 *
 * `dismissed` controls visibility. `onDismiss` requests dismissal without applying
 * it in controlled mode. `defaultDismissed` seeds uncontrolled visibility once.
 * Granular dismissal also requires `@antadesign/anta/elements/a-button` and the
 * close icon requires `@antadesign/anta/elements/a-icon`.
 *
 * @example Basic usage
 * ```tsx
 * <Banner tone="info" message="A new release is available." actions={<Button size="small" label="Update" />} />
 * ```
 *
 * @example Controlled
 * ```tsx
 * const [dismissed, setDismissed] = useState(false)
 * <Banner message="Saved." dismissed={dismissed} onDismiss={() => setDismissed(true)} />
 * ```
 */
export const Banner = ({
  message,
  actions,
  tone,
  align,
  round,
  closable,
  role = "status",
  dismissed,
  defaultDismissed,
  onDismiss,
  className,
  style,
  children,
  ...rest
}: BannerProps) => {
  const controlled = dismissed != null
  const eventProps = useNativeEventProps({
    onstatechange: onDismiss
      ? (e: StateChangeEvent<StateChangeDetail>) => {
          const { detail, isOwn } = nativeStateChange<StateChangeDetail>(e)
          if (isOwn && detail?.next === "closed") onDismiss()
        }
      : undefined,
  })

  const computedStyle = roundStyle(
    round,
    "--banner-round",
    toneStyle(tone, "--banner-tone-source", style),
  )

  const hasMessage = hasChildren(message) && typeof message !== "boolean" &&
    (typeof message !== "string" || Boolean(message.trim()))
  const hasActions = hasChildren(actions) && typeof actions !== "boolean" &&
    (typeof actions !== "string" || Boolean(actions.trim()))
  const messageNode = !hasMessage ? null :
    typeof message === "string" || typeof message === "number" ? (
      <a-banner-message>{message}</a-banner-message>
    ) : (
      <a-banner-content>{message}</a-banner-content>
    )

  return (
    <a-banner
      state={controlled ? (dismissed ? "closed" : "open") : undefined}
      default-state={!controlled ? (defaultDismissed ? "closed" : "open") : undefined}
      tone={neutralToneAttr(tone)}
      align={align === "center" ? "center" : undefined}
      round={roundAttr(round)}
      role={role}
      {...eventProps}
      class={className}
      style={computedStyle}
      {...rest}
    >
      {messageNode}
      {hasChildren(children) && typeof children !== "boolean" && <a-banner-content>{children}</a-banner-content>}
      {hasActions && (
        <a-banner-actions>
          {actions}
        </a-banner-actions>
      )}
      {closable !== false && (
        <a-banner-close>
          <Button
            priority="quaternary"
            icon="x"
            round={round}
            tone={tone}
            aria-label="Dismiss"
            data-custom-event="dismissrequest"
          />
        </a-banner-close>
      )}
    </a-banner>
  )
}
