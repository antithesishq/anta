import { nativeStateChange, toneStyle, roundStyle } from "../anta_helpers";
import type { BaseProps } from "../general_types";

/** Public props for the `<Expander>` disclosure. `title` is the always-
 *  visible summary; `children` is the collapsible body. */
export interface ExpanderProps extends Omit<BaseProps, "title"> {
  /** Summary (header) content. A string is rendered with the `level`
   *  type scale; pass a node (e.g. a `<Title>`) for full control or real
   *  heading semantics in the document outline. */
  title: React.ReactNode;
  /** Heading type scale applied to a string `title` (mirrors `<Title>`'s
   *  levels). Visual only — for outline semantics, pass a `<Title>` as
   *  the title.
   *  @defaultValue 5 */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Semantic tone, or any literal CSS color (`'#ff1493'`, `'rebeccapurple'`)
   *  for a one-off custom tone. Named tones re-point the text and (on filled
   *  priorities) the surface to the matching palette; a custom color keeps
   *  its hue while lightness/chroma are pinned. `'neutral'` (the default) is
   *  the same as omitting it.
   *  @defaultValue 'neutral' */
  tone?:
    | "neutral"
    | "brand"
    | "info"
    | "success"
    | "warning"
    | "critical"
    | (string & {});
  /** Surface emphasis. `secondary` (the default) is a subtle fill;
   *  `primary` is a more pronounced card; `tertiary` is transparent (the
   *  bare disclosure).
   *  @defaultValue 'secondary' */
  priority?: "primary" | "secondary" | "tertiary";
  /** Outdent the chevron into the left gutter so the title and body sit
   *  flush with surrounding content (the docs-header layout). Only takes
   *  effect with `priority="tertiary"` — on the filled priorities the
   *  container edge has to bound the chevron, so it's a no-op there. */
  outdent?: boolean;
  /** Header actions (e.g. buttons, tags) rendered at the end of the
   *  header row, OUTSIDE the toggle trigger — clicking them never
   *  toggles, they're separately focusable, and screen readers see them
   *  as separate controls. */
  actions?: React.ReactNode;
  /** Disables the header: not clickable or focusable, hover affordance
   *  off, text dimmed. The open state freezes as-is — disabling an open
   *  expander keeps it open. `actions` stay live; disable them
   *  separately if needed. */
  disabled?: boolean;
  /** Round corners sized to half the folded (header) height: a pill when folded,
   *  and — when expanded — the same corner radius rather than a bigger stadium.
   *  The element measures the header, so it tracks custom header content. Pass a
   *  `number` (px) or CSS length string for a *fixed* radius that overrides the
   *  measurement (and skips it) in both states. */
  round?: boolean | number | string;
  /** Controlled open state. When provided, the consumer owns open/close:
   *  the expander only follows this prop, and clicking the summary just
   *  requests a change via `onStateChange` (so a toggle can be rejected by
   *  not updating). Leave undefined for uncontrolled. */
  open?: boolean;
  /** Initial open state for the uncontrolled case. */
  defaultOpen?: boolean;
  /** Fired before the open state changes. `event` is the cancelable
   *  `statechange` — call `event.preventDefault()` to veto an *uncontrolled*
   *  toggle (e.g. confirm before closing). `detail.next` is the requested
   *  open state, `detail.prev` the current one (booleans). In controlled
   *  mode, apply `detail.next` to `open` to accept, or do nothing to reject. */
  onStateChange?: (
    event: CustomEvent,
    detail: { next: boolean; prev: boolean },
  ) => void;
}

/** The element's `statechange` payload, in the `'open'|'closed'` vocabulary. */
type StateChangeDetail = { next: "open" | "closed"; prev: "open" | "closed" };
type StateChangeEvent =
  | CustomEvent<StateChangeDetail>
  | { nativeEvent: CustomEvent<StateChangeDetail> };


/**
 * `<Expander>` — a collapsible disclosure section.
 *
 * A pure, stateless pass-through to `<a-expander>`: the element owns all
 * interaction (toggle, keyboard, ARIA, animation), so the wrapper holds
 * no state and grabs no ref — it only maps props to attributes (safe
 * wherever the host DOM is reconciled, incl. off the UI thread).
 *
 * Uncontrolled (`defaultOpen`): the element owns its open state. The wrapper
 * emits `default-state="open"` — never `state` — so the DOM carries no stale
 * controlled attribute. Controlled (`open` + `onStateChange`): the wrapper
 * emits `state="open" | "closed"`; the element treats the attribute as the
 * source of truth and clicks only dispatch the cancelable `statechange` event,
 * giving real controlled semantics (a consumer can reject a toggle). See
 * STATEFUL-COMPONENTS.md.
 */
export const Expander = ({
  title,
  level,
  tone,
  priority,
  outdent,
  actions,
  disabled,
  round,
  open,
  defaultOpen,
  onStateChange,
  className,
  style,
  children,
  ...rest
}: ExpanderProps) => {
  const controlled = open !== undefined;

  // A non-named tone is a literal CSS color: feed it to the element's
  // oklch derivation via an inline custom property (the CSS attr() form
  // is only a fallback for raw-HTML authors). Shared helper — see anta_helpers.
  const computedStyle = roundStyle(round, "--expander-round", toneStyle(tone, "--expander-tone-source", style));

  // A string (or number) title is rendered as our <a-expander-summary>,
  // which carries the hover affordance. A node title is the consumer's
  // own markup: slot it through a layout-neutral display:contents span —
  // the shadow hover hook targets ::slotted(a-expander-summary), so a
  // custom title opts out of the summary styling automatically. (No
  // cloneElement/isValidElement — those are React-only APIs that break
  // the configure() portability story, and a wrapper span also handles
  // fragments and arrays.)
  const titleNode =
    typeof title === "object" && title !== null ? (
      <span slot="title" style={{ display: "contents" }}>
        {title}
      </span>
    ) : (
      <a-expander-summary slot="title">{title}</a-expander-summary>
    );

  return (
    <a-expander
      state={controlled ? (open ? "open" : "closed") : undefined}
      default-state={!controlled && defaultOpen ? "open" : undefined}
      level={level != null ? (String(level) as `${typeof level}`) : undefined}
      tone={tone && tone !== "neutral" ? tone : undefined}
      priority={priority && priority !== "secondary" ? priority : undefined}
      outdent={outdent ? "" : undefined}
      round={round ? "" : undefined}
      disabled={disabled ? "" : undefined}
      // All-lowercase `onstatechange` is the one event-prop spelling both
      // renderers bind to our `statechange` event: React 19 keeps the case of
      // whatever follows `on` (so `onStateChange` would listen for "StateChange"),
      // Preact lowercases. Verified against real React 19 + Preact.
      onstatechange={
        onStateChange
          ? (e: StateChangeEvent) => {
              const { event, detail } = nativeStateChange<StateChangeDetail>(e);
              if (detail)
                onStateChange(event, {
                  next: detail.next === "open",
                  prev: detail.prev === "open",
                });
            }
          : undefined
      }
      class={className}
      style={computedStyle}
      {...rest}
    >
      {titleNode}
      {actions != null && (
        <span slot="actions" style={{ display: "contents" }}>
          {actions}
        </span>
      )}
      <a-expander-details>{children}</a-expander-details>
    </a-expander>
  );
};
