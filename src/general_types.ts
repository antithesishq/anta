import type { IconShape } from './elements/a-icon.shapes'

/** Common props for JSX component wrappers. */
export interface BaseProps {
  /** CSS class on the component's root element (merged with the component's own
   *  classes). Use it directly for layout and positioning — grid/flex placement,
   *  margins, alignment — rather than wrapping the component in a `<div>`/`<span>`. */
  className?: string
  /** Inline styles on the component's root element. Set layout/positioning here
   *  (or via `className`) directly on the component instead of adding a wrapper. */
  style?: React.CSSProperties
  /** Child elements. When provided, replaces the component's default label/content. */
  children?: React.ReactNode
  /** HTML `id` attribute. */
  id?: string
  /** HTML `title` attribute — native browser tooltip on hover. */
  title?: string
  /** Assigns the element to a named `<slot>` of a parent web component (e.g.
   *  `slot="header"` inside a `<Card>`, `slot="footer"` inside a `<Dialog>`). */
  slot?: string
  /** Tab order. Set to `-1` to skip the element when tabbing. */
  tabIndex?: number
  /** React/Preact reconciliation key when rendered inside a list. Consumed by the
   *  JSX runtime (not forwarded as a DOM attribute). */
  key?: string | number | null
  /** Any `data-*` attribute is forwarded to the rendered element. */
  [key: `data-${string}`]: unknown
  /** Any `aria-*` attribute is forwarded to the rendered element. */
  [key: `aria-${string}`]: unknown
}

/** Safe presentation attributes for a data-rendered option. They land on the
 * option's rendered row, rather than on the enclosing control. Menu-based
 * components reserve `data-menu-*` for their own selection and focus behavior. */
export interface OptionPresentationProps {
  /** CSS class on the option's rendered row. */
  className?: string
  /** Inline styles on the option's rendered row. */
  style?: React.CSSProperties
  /** Additional data attributes on the option's rendered row. */
  [key: `data-${string}`]: unknown
}

/**
 * Standard DOM event handlers Anta forwards to the rendered element. These are
 * **enumerated on purpose** — rather than an open `on${string}` index signature
 * — so a typo like `onClik` is a type error instead of silently accepted. They
 * stay `(e: any) => void` to remain React/Preact-agnostic (we don't commit to
 * either framework's event types). Standard events bubble/compose, so a handler
 * on an `<a-*>` host fires for interactions inside its shadow DOM. Component-
 * specific events (e.g. `oninput`/`onclearclick` on `<a-input>`) are declared on
 * that element's own attributes. This enumerates the full standard (bubble-phase)
 * DOM event set; add a `…Capture` variant here if one is ever needed.
 */
export interface DOMEventHandlers {
  // Mouse / pointer
  onClick?: (e: any) => void
  onDoubleClick?: (e: any) => void
  onAuxClick?: (e: any) => void
  onContextMenu?: (e: any) => void
  onMouseDown?: (e: any) => void
  onMouseUp?: (e: any) => void
  onMouseEnter?: (e: any) => void
  onMouseLeave?: (e: any) => void
  onMouseMove?: (e: any) => void
  onMouseOver?: (e: any) => void
  onMouseOut?: (e: any) => void
  onPointerDown?: (e: any) => void
  onPointerUp?: (e: any) => void
  onPointerMove?: (e: any) => void
  onPointerEnter?: (e: any) => void
  onPointerLeave?: (e: any) => void
  onPointerOver?: (e: any) => void
  onPointerOut?: (e: any) => void
  onPointerCancel?: (e: any) => void
  onGotPointerCapture?: (e: any) => void
  onLostPointerCapture?: (e: any) => void
  // Touch
  onTouchStart?: (e: any) => void
  onTouchEnd?: (e: any) => void
  onTouchMove?: (e: any) => void
  onTouchCancel?: (e: any) => void
  // Keyboard
  onKeyDown?: (e: any) => void
  onKeyUp?: (e: any) => void
  // Focus
  onFocus?: (e: any) => void
  onBlur?: (e: any) => void
  // Form
  onChange?: (e: any) => void
  onInput?: (e: any) => void
  onBeforeInput?: (e: any) => void
  onInvalid?: (e: any) => void
  onReset?: (e: any) => void
  onSubmit?: (e: any) => void
  onSelect?: (e: any) => void
  // Clipboard
  onCopy?: (e: any) => void
  onCut?: (e: any) => void
  onPaste?: (e: any) => void
  // Composition (IME)
  onCompositionStart?: (e: any) => void
  onCompositionUpdate?: (e: any) => void
  onCompositionEnd?: (e: any) => void
  // Drag & drop
  onDrag?: (e: any) => void
  onDragStart?: (e: any) => void
  onDragEnd?: (e: any) => void
  onDragEnter?: (e: any) => void
  onDragLeave?: (e: any) => void
  onDragOver?: (e: any) => void
  onDrop?: (e: any) => void
  // Scroll / wheel
  onScroll?: (e: any) => void
  onWheel?: (e: any) => void
  // Animation / transition
  onAnimationStart?: (e: any) => void
  onAnimationEnd?: (e: any) => void
  onAnimationIteration?: (e: any) => void
  onTransitionEnd?: (e: any) => void
  // Resource / state
  onLoad?: (e: any) => void
  onError?: (e: any) => void
  onAbort?: (e: any) => void
  onToggle?: (e: any) => void
  onBeforeToggle?: (e: any) => void
  // Media
  onCanPlay?: (e: any) => void
  onCanPlayThrough?: (e: any) => void
  onDurationChange?: (e: any) => void
  onEmptied?: (e: any) => void
  onEnded?: (e: any) => void
  onLoadedData?: (e: any) => void
  onLoadedMetadata?: (e: any) => void
  onLoadStart?: (e: any) => void
  onPause?: (e: any) => void
  onPlay?: (e: any) => void
  onPlaying?: (e: any) => void
  onProgress?: (e: any) => void
  onRateChange?: (e: any) => void
  onSeeked?: (e: any) => void
  onSeeking?: (e: any) => void
  onStalled?: (e: any) => void
  onSuspend?: (e: any) => void
  onTimeUpdate?: (e: any) => void
  onVolumeChange?: (e: any) => void
  onWaiting?: (e: any) => void
}

/** Attributes for intrinsic custom elements (`<a-*>` tags) in JSX. */
export interface BaseAttributes extends DOMEventHandlers {
  /** React/Preact reconciliation key when rendered inside a list. */
  key?: string | number | null
  /** HTML `id` attribute. */
  id?: string
  /** HTML `class` attribute (standard DOM). */
  class?: string
  /** React/Preact-style class name. Alias for `class`. */
  className?: string
  /** Inline styles applied to the element. */
  style?: React.CSSProperties
  children?: React.ReactNode
  /** Assigns the element to a named `<slot>` (e.g. `slot="title"`). */
  slot?: string
  /** Tab order. Set to `0` to make the element keyboard-focusable. */
  tabIndex?: number
  /** ARIA role override. */
  role?: string
}

/**
 * Attributes for the `<a-progress>` custom element.
 *
 * These are the low-level web component attributes. For the JSX wrapper with
 * typed props and computed labels, use `Progress` from `@antadesign/anta`.
 */
export interface AProgressAttributes extends BaseAttributes {
  /** Current progress value. Omit this attribute for indeterminate progress. */
  value?: number | string | false
  /** Maximum value. Defaults to 100. */
  max?: number | string
  /** Color variant, or any literal CSS color for a custom tone (derived in
   *  oklch). Named tones track light/dark automatically. */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Size variant. `medium` is the default. */
  size?: 'small' | 'medium' | 'large'
  /** Fully-round track (`border-radius: 999px`), or a custom radius via a length
   *  value (`round="6px"`). Presence-based for the boolean form. */
  round?: boolean | number | string
  /** ARIA role — the JSX wrapper sets this to `'progressbar'`. */
  role?: string
  /** ARIA value-now (current). */
  'aria-valuenow'?: number | string
  /** ARIA value-max. */
  'aria-valuemax'?: number | string
  /** ARIA value-min (defaults to 0). */
  'aria-valuemin'?: number | string
  /** ARIA accessible name. */
  'aria-label'?: string
}

/**
 * Attributes for the `<a-avatar>` custom element.
 *
 * These are the low-level web component attributes. For the typed JSX wrapper,
 * use `Avatar` from `@antadesign/anta`.
 */
export interface AAvatarAttributes extends BaseAttributes {
  /** Alphanumeric seed driving the generated userpic. Falls back to `name`. */
  seed?: string
  /** Name — supplies the initials fallback and accessible name, and seeds
   *  generation when `seed` is absent. */
  name?: string
  /** Image URL. Shown instead of a generated userpic when present. */
  src?: string
  /** Size of the square container. `medium` is the default; set a pixel size via
   *  the `--avatar-size` custom property. */
  size?: 'small' | 'medium' | 'large'
  /** Corner badge, colored by tone — a named tone or any literal CSS color
   *  (derived in oklch). Omit for no badge. */
  badge?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Fully-round (circular) frame, or a custom radius via a length value
   *  (`round="12px"`). Presence-based for the boolean form. */
  round?: boolean | number | string
  /** Brand generation constraints as a JSON string (an `AvatarGenConfig`). With
   *  the `Avatar` wrapper, pass the object as `generator` and it is serialized. */
  config?: string
  /** ARIA role — the JSX wrapper sets this to `'img'`. */
  role?: string
  /** ARIA accessible name. */
  'aria-label'?: string
}

/**
 * Attributes for the `<a-loader>` custom element. For the JSX wrapper with
 * cross-browser sizing and accessible progress semantics, use `Loader` from
 * `@antadesign/anta`.
 */
export interface ALoaderAttributes extends BaseAttributes {
  /** Color tone for the loader. */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical'
  /** Presence selects the static, determinate gradient. Set `--loader-value`
   * in `style` to its percentage. Omit this attribute for the rotating
   * indeterminate gradient. */
  value?: number | string | false
  /** ARIA accessible name. */
  'aria-label'?: string
  /** Hides a decorative loader from screen readers. */
  'aria-hidden'?: 'true' | 'false' | boolean
  /** ARIA value-now for determinate progress. */
  'aria-valuenow'?: number | string
  /** ARIA value-min. */
  'aria-valuemin'?: number | string
  /** ARIA value-max. */
  'aria-valuemax'?: number | string
}

/**
 * Attributes for the `<a-text>` custom element.
 *
 * Low-level web component attributes; for the JSX wrapper use `Text`
 * from `@antadesign/anta`.
 */
export interface ATextAttributes extends BaseAttributes {
  /** Visual priority. Maps to text-1..text-4. */
  priority?: 'primary' | 'secondary' | 'tertiary' | 'quaternary'
  /** Color tint. `neutral` (default) is the untinted `--text-{N}` scale; a named
   *  tone applies the matching `--text-{N}-{tone}` palette; any literal CSS color
   *  is a custom tone (hue kept, lightness/chroma pinned per priority in oklch). */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Type scale. `small` = 13/16, `medium` (default) = 15/20, `large` = 17/24. */
  size?: 'small' | 'medium' | 'large'
  /** Render as inline-block instead of the default block. */
  inline?: boolean | ''
  /** Truncate to N lines with a trailing ellipsis. The attribute value
   *  carries the line count (e.g. `"1"`, `"3"`); the count is also
   *  available via the `--line-clamp` CSS custom property set inline. */
  truncate?: boolean | string | number
  /** Marks the host as expandable when paired with `truncate`. Adds
   *  the fade-out mask and the expand/collapse chevron button; the element
   *  owns the click/keyboard expansion logic. Without `collapsible`,
   *  expanding is one-way (the control is removed once expanded). */
  expandable?: boolean | ''
  /** Paired with `expandable`: the chevron becomes a two-way "Show more" /
   *  "Show less" toggle that stays visible while expanded. Omit for one-way. */
  collapsible?: boolean | ''
  /** ARIA disclosure state, mirrors the JSX wrapper's `expanded` flag. */
  'aria-expanded'?: boolean | 'true' | 'false'
}

/**
 * Attributes for the `<a-title>` styled tag.
 *
 * `<a-title>` has no JS — it's a CSS-only styled element. Low-level
 * attributes; for the JSX wrapper with typed `level` numbers and ARIA
 * use `Title` from `@antadesign/anta`.
 */
export interface ATitleAttributes extends BaseAttributes {
  /** Heading level as a string attribute, '1'-'6'. */
  level?: string
  /** Visual priority. Maps to text-1..text-4. */
  priority?: 'primary' | 'secondary' | 'tertiary' | 'quaternary'
  /** Color tint. `neutral` (default) is the untinted `--text-{N}` scale; a named
   *  tone applies the matching `--text-{N}-{tone}` palette; any literal CSS color
   *  is a custom tone (hue kept, lightness/chroma pinned per priority in oklch). */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** ARIA role — the JSX wrapper sets this to `'heading'`. */
  role?: string
  /** ARIA heading level — the JSX wrapper sets this to match `level`. */
  'aria-level'?: number | string
}

/**
 * Attributes for the `<a-tag>` styled tag.
 *
 * `<a-tag>` has no JS — it's a CSS-only styled element. Low-level
 * attributes; for the JSX wrapper use `Tag` from `@antadesign/anta`.
 */
export interface ATagAttributes extends BaseAttributes {
  /** Semantic tone, or any literal CSS color for a one-off custom tone.
   *  Tones tint a per-tone hue; a custom color keeps its hue with
   *  lightness/chroma pinned. `'neutral'` is the default gray (same as
   *  omitting it). */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Emphasis level. `secondary` (default) is the subtle alpha-tint fill;
   *  `primary` is a solid fill with white text; `tertiary` is a transparent
   *  outline. */
  priority?: 'primary' | 'secondary' | 'tertiary'
  /** Size variant. `small` = 16px tall, `medium` (default) = 20px,
   *  `large` = 24px. */
  size?: 'small' | 'medium' | 'large'
  /** Render in all-caps instead of the default normal (mixed) case.
   *  Presence-based (`''` on, omit off). */
  allcaps?: boolean | ''
}

/**
 * Attributes for the `<a-expander>` collapsible disclosure.
 *
 * The element builds its own shadow DOM (no native `<details>`): a
 * `<button>` summary carrying `aria-expanded` plus an animated content
 * region. The title is projected via `slot="title"`; header actions
 * (rendered next to the trigger, outside it) via `slot="actions"`; the
 * body is the default slot. Low-level attributes; for the JSX wrapper
 * use `Expander` from `@antadesign/anta`.
 */
export interface AExpanderAttributes extends BaseAttributes {
  /** Controlled open state (`'open'` / `'closed'`). Present → controlled: the
   *  attribute is the source of truth, clicks only dispatch the cancelable
   *  `statechange` event, and the consumer answers by updating it. Absent →
   *  uncontrolled (use `default-state`). See STATEFUL-COMPONENTS.md. */
  state?: 'open' | 'closed'
  /** Initial open state for the uncontrolled mode (`'open'` / `'closed'`);
   *  read once when the element connects. */
  'default-state'?: 'open' | 'closed'
  /** Surface emphasis. `secondary` (default) is a subtle fill; `primary`
   *  is a stronger raised fill; `tertiary` is transparent. */
  priority?: 'primary' | 'secondary' | 'tertiary'
  /** Outdent the chevron into the left gutter so the title + body sit
   *  flush with surrounding content (the docs-header layout). Tertiary
   *  only — a no-op on the filled priorities, where the container edge
   *  has to bound the chevron. Presence-based. */
  outdent?: boolean | ''
  /** Disables the header: not clickable or focusable, hover affordance
   *  off, text dimmed. The open state freezes as-is. Presence-based. */
  disabled?: boolean | ''
  /** Round corners sized to half the folded (header) height — a pill when folded,
   *  the same radius when expanded (the element measures the header and publishes
   *  `--_expander-round-radius`). A length value (`round="12px"`) is a fixed radius
   *  that overrides the measurement. Presence-based for the boolean form. */
  round?: boolean | number | string
  /** Semantic tone, or any literal CSS color for a one-off custom tone.
   *  Named tones re-point the text + filled surface palette; a custom
   *  color keeps its hue with lightness/chroma pinned. `'neutral'` is the
   *  default (same as omitting it). */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Heading type scale for the summary, `'1'`–`'6'` (mirrors `<a-title>`
   *  levels). Default (omitted) ≈ level 5. */
  level?: '1' | '2' | '3' | '4' | '5' | '6'
  /** Fires before the open state changes — the element dispatches a
   *  `cancelable` `statechange` `CustomEvent` whose `detail` is
   *  `{ next, prev }` in the `'open'|'closed'` vocabulary. Uncontrolled,
   *  `preventDefault()` vetoes the transition. The all-lowercase spelling is
   *  deliberate — it's the one form both renderers bind to the `statechange`
   *  event (React 19 keeps the case after `on`, so `onStateChange` would
   *  listen for "StateChange"; Preact lowercases). */
  onstatechange?: (
    e: CustomEvent<{ next: 'open' | 'closed'; prev: 'open' | 'closed' }>,
  ) => void
}

/**
 * Attributes for the `<a-dialog>` custom element — a modal dialog / edge drawer
 * built on a native `<dialog>` in shadow DOM (top layer, focus trap, backdrop,
 * Esc from the platform). Slots (light-DOM children): `header`, `footer`,
 * `close` (the close button), and the default slot for the body. The element
 * exposes `::part(dialog | header | body | footer | close)`. Low-level
 * attributes; for the typed JSX wrapper use `Dialog` from `@antadesign/anta`.
 */
export interface ADialogAttributes extends BaseAttributes {
  /** Controlled open state (`'open'` / `'closed'`). Present → controlled: the
   *  attribute is the source of truth, user dismiss only dispatches the
   *  cancelable `statechange` event, and the consumer answers by updating it.
   *  Absent → uncontrolled (use `default-state`). See STATEFUL-COMPONENTS.md. */
  state?: 'open' | 'closed'
  /** Initial open state for the uncontrolled mode (`'open'` / `'closed'`); read
   *  once when the element connects. */
  'default-state'?: 'open' | 'closed'
  /** Placement. `center` (default, omit) is a centered modal; `left` / `right` /
   *  `top` / `bottom` turn it into an edge drawer; `fullscreen` fills the whole
   *  viewport (no edge gap, no radius). */
  position?: 'center' | 'left' | 'right' | 'top' | 'bottom' | 'fullscreen'
  /** Corner radius. A side keyword (`top` / `right` / `bottom` / `left`) rounds
   *  only that edge's two corners at `--dialog-radius`; a length (`round="20px"`)
   *  or full `border-radius` shorthand rounds all corners at that value; bare
   *  `round` rounds all corners at `--dialog-radius`. Omit for the position
   *  default (center rounded, drawers / fullscreen square). */
  round?: boolean | number | 'top' | 'right' | 'bottom' | 'left' | (string & {})
  /** Disable light dismiss — Esc + backdrop click no longer close the dialog (it
   *  closes only via the close button or programmatically). For alert / confirm
   *  dialogs. Presence-based (`''` on, omit off). */
  persistent?: boolean | ''
  /** Uncontrolled trigger name. Any element with `data-dialog-open="{name}"`
   *  opens this dialog and `data-dialog-close="{name}"` closes it, via a document
   *  click listener. Ignored in controlled mode. */
  name?: string
  /** Fires before the open state changes — the element dispatches a `cancelable`
   *  `statechange` `CustomEvent` whose `detail` is `{ next, prev }` in the
   *  `'open'|'closed'` vocabulary. Uncontrolled, `preventDefault()` vetoes the
   *  transition. All-lowercase so both renderers bind it (React 19 keeps the case
   *  after `on`; Preact lowercases). */
  onstatechange?: (
    e: CustomEvent<{ next: 'open' | 'closed'; prev: 'open' | 'closed' }>,
  ) => void
}

/**
 * Attributes for the `<a-icon>` custom element. `shape` is typed as
 * `IconShape` (`keyof IconShapes`); the `IconShapes` interface is
 * module-augmentable, so consumers who generate their own shape sets
 * via `declare module '@antadesign/anta' { interface IconShapes { … } }`
 * get those keys accepted automatically.
 */
export interface AIconAttributes extends BaseAttributes {
  /** Which icon to render. */
  shape?: IconShape
  /** Width and height in pixels. Mapped to the `--icon-size` custom
   *  property via the CSS Values 5 typed `attr()` function — Chrome
   *  133+ and Safari 18.2+ only. Firefox hasn't shipped typed
   *  `attr()` yet, so on raw `<a-icon size="N">` the attribute is
   *  silently ignored there and the icon stays at the default 16 ×
   *  16. For cross-browser sizing in pure-HTML usage, set the
   *  variable inline: `<a-icon style="--icon-size: 24px">`. The JSX
   *  `<Icon size={N}>` wrapper already does that under the hood and
   *  is the recommended path. */
  size?: number | string
  /** ARIA role — the JSX wrapper sets `'img'` when a label is provided. */
  role?: string
  /** ARIA accessible name when the icon carries meaning. */
  'aria-label'?: string
  /** Hides decorative icons from screen readers. */
  'aria-hidden'?: 'true' | 'false' | boolean
}

/**
 * Attributes for the `<a-tooltip>` custom element. Placed as a child of the
 * element it annotates (content as children). For the typed JSX wrapper use
 * `Tooltip` from `@antadesign/anta`.
 */
export interface ATooltipAttributes extends BaseAttributes {
  /** Show delay in milliseconds. Never use `0` — use ~`50`. Defaults to 300. */
  delay?: number | string
  /** Preferred side; auto-flips when there's no room. Defaults to `'bottom'`. */
  placement?: 'top' | 'bottom'
  /** Follow the cursor instead of pinning under the anchor (pinned is the
   *  default). Presence-based (`''` on, omit off). */
  follow?: boolean | ''
  /** Make the bubble hoverable/clickable (pointer events on, stays open while
   *  hovered). Always pinned. Presence-based (`''` on, omit off). */
  interactive?: boolean | ''
  /** Only show when the measured target is actually truncated/clipped (its text
   *  overflows). UI-thread layout read, re-measured per show. Defaults to the
   *  nearest Anta ellipsizing label part (`a-tab-label` / `a-button-label`) in the
   *  anchor, then the anchor itself. Presence-based (`''` on, omit off). */
  'truncated-only'?: boolean | ''
  /** Round the bubble (20px radius), or a custom radius via a length value
   *  (`round="12px"`). Presence-based for the boolean form. */
  round?: boolean | number | string
  /** CSS selector (resolved within the anchor) for the element whose overflow a
   *  `truncated-only` tooltip measures. */
  'truncated-selector'?: string
  /** HTML `id`. */
  id?: string
}

/**
 * Attributes for the `<a-checkbox>` custom element. `<a-checkbox>` is a light-DOM
 * interactive element: its visual state lives on `ElementInternals` (styled via
 * the `:state(checked)` / `:state(indeterminate)` pseudo-class, not host
 * attributes), driven by the `state` attribute (controlled) or `default-state`
 * (uncontrolled seed). It sets no ARIA itself — `role` / `aria-*` are the
 * consumer's job (the wrapper supplies them). The label is its children.
 * Low-level attributes — for the typed JSX wrapper use `Checkbox` from
 * `@antadesign/anta`.
 */
export interface ACheckboxAttributes extends BaseAttributes {
  /** Mark color in every state — checked fill *and* unselected box border — or any
   *  literal CSS color for a one-off custom tone. Named tones track light/dark mode
   *  automatically. `'neutral'` is the default (same as omitting it). The label + hint
   *  stay neutral — recolor them in plain CSS via the `--text-N-{tone}` tokens. */
  tone?: 'brand' | 'neutral' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Like `tone`, but colored onto the checked mark only — the empty box stays
   *  neutral grey. Same value set as `tone`; if both are set, `tone` governs the
   *  off-state border and `tone-selected` the checked fill. */
  'tone-selected'?: 'brand' | 'neutral' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Size variant. `small` = 14px, `medium` (default) = 16px, `large` = 18px box. */
  size?: 'small' | 'medium' | 'large'
  /** Controlled state — the element reflects changes to this attribute. Use this
   *  (driven from your store) for a controlled checkbox; use `default-state` for
   *  an uncontrolled one. */
  state?: 'checked' | 'unchecked' | 'indeterminate'
  /** Uncontrolled initial state — read once at connect / form-reset, then the
   *  element self-manages. */
  'default-state'?: 'checked' | 'unchecked' | 'indeterminate'
  /** Disabled state. Presence-based (`''` on, omit off). */
  disabled?: boolean | ''
  /** Round the mark to a circle (`::before` `border-radius: 999px`), or a rounded
   *  square via a length value (`round="5px"`). Presence-based for the boolean form. */
  round?: boolean | number | string
  /** Form field name — the key this checkbox submits under inside a `<form>`. */
  name?: string
  /** Value submitted when checked. Defaults to `"on"`. */
  value?: string
  /** Fires before the element applies any change. The element dispatches a
   *  cancelable `statechange` `CustomEvent` whose `detail` carries
   *  `{ next, prev }` (the same string enum as `state`); a synchronous
   *  `preventDefault()` vetoes the transition. The all-lowercase spelling is
   *  deliberate — it's the one form both renderers bind to a custom event
   *  (React 19 keeps the case of whatever follows `on`; Preact lowercases). */
  onstatechange?: (
    e: CustomEvent<{ next: 'checked' | 'unchecked' | 'indeterminate'; prev: 'checked' | 'unchecked' | 'indeterminate' }>,
  ) => void
  /** Native `change`, fired *after* a toggle applies (post-apply counterpart to
   *  `onstatechange`). Lowercase so both renderers bind the native event. */
  onchange?: (e: Event) => void
  /** ARIA — set by the consumer / the `Checkbox` wrapper (the element never
   *  touches these itself). */
  'aria-checked'?: 'true' | 'false' | 'mixed'
  'aria-disabled'?: 'true' | 'false'
  'aria-label'?: string
}

/**
 * Attributes for the `<a-switch>` custom element. It is a binary,
 * form-associated immediate-setting control. Its visual checked state is stored
 * in ElementInternals and styled through `:state(checked)`. `role="switch"`
 * and the accessible name remain the consumer's responsibility; the `Switch`
 * wrapper supplies both.
 */
export interface ASwitchAttributes extends BaseAttributes {
  /** Track and thumb color. A tinted tone also colors the unchecked chrome. */
  tone?: 'brand' | 'neutral' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Checked-track-only color. The unchecked track and thumb stay neutral. */
  'tone-selected'?: 'brand' | 'neutral' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Size variant. `small` = 26×16px, `medium` (default) = 30×18px, `large` = 34×20px. */
  size?: 'small' | 'medium' | 'large'
  /** Fully round the thumb and track, or pass a custom track radius via a length
   * value (`round="6px"`). The thumb radius is 3px smaller. Presence-based for the
   * boolean form. */
  round?: boolean | number | string
  /** Visual placement of the label. The source / accessibility order stays stable. */
  'label-position'?: 'start' | 'end'
  /** Controlled checked state. Use `default-state` for an uncontrolled switch. */
  state?: 'checked' | 'unchecked'
  /** Uncontrolled initial checked state, read once at connect / form reset. */
  'default-state'?: 'checked' | 'unchecked'
  /** Disables interaction. Presence-based (`''` on, omit off). */
  disabled?: boolean | ''
  /** Form field name. */
  name?: string
  /** Value submitted when the switch is checked. Defaults to `"on"`. */
  value?: string
  /** Cancelable pre-change request. `detail` contains `{ next, prev }`. */
  onstatechange?: (
    e: CustomEvent<{ next: 'checked' | 'unchecked'; prev: 'checked' | 'unchecked' }>,
  ) => void
  /** Native post-change event. */
  onchange?: (e: Event) => void
  'aria-checked'?: 'true' | 'false'
  'aria-disabled'?: 'true' | 'false'
  'aria-label'?: string
}

/**
 * Attributes for the `<a-input>` custom element — a form-associated text
 * field whose real `<input>` / `<textarea>` lives in shadow DOM. For the
 * typed JSX wrapper use `Input` from `@antadesign/anta`.
 *
 * Slots (light-DOM children): `label`, `leading`, `trailing`, `hint`.
 * The element exposes `::part(field | input | label | leading | trailing | hint)`
 * for styling, and `:state(filled)` / `:state(invalid)` as CSS hooks.
 */
export interface AInputAttributes extends BaseAttributes {
  /** Controlled value (string). Reflected to the shadow control only when it
   *  differs, so the caret survives re-renders. */
  value?: string
  /** Initial value for the uncontrolled case; read once on connect. */
  defaultvalue?: string
  /** Render a `<textarea>` rather than `<input>`. Presence-based. */
  multiline?: boolean | ''
  /** Fixed visible row count for a `<textarea>` (implies multiline). */
  rows?: number | string
  /** Cap autogrow height (rows) for a multiline field with no `rows`. */
  maxrows?: number | string
  /** Validation/feedback tone — colors the border + message and (via the
   *  wrapper) the glyph. Only `critical` carries validity weight (`aria-invalid`
   *  + `:state(invalid)`); the others are advisory. Omit for the neutral field. */
  status?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical'
  /** Custom accent color (any literal CSS color) — tints the resting + hover
   *  border via an oklch derivation. `status` overrides it for validation. */
  tone?: string
  /** Disabled state. Presence-based. */
  disabled?: boolean | ''
  /** Read-only state. Presence-based. */
  readonly?: boolean | ''
  /** Required — drives native validity. Presence-based. */
  required?: boolean | ''
  /** Dim the leading/trailing adornments at rest (0.6); they brighten to full
   *  when the field is hovered or focused. Presence-based. */
  'dim-actions'?: boolean | ''
  /** Fully-round field (`border-radius: 999px`), or a custom radius via a length
   *  value (`round="10px"`). Presence-based for the boolean form. */
  round?: boolean | number | string
  /** Size variant. small=24px, medium (default)=28px, large=32px. */
  size?: 'small' | 'medium' | 'large'
  /** Single-line input type (ignored when multiline). `search` is intentionally
   *  unavailable — it triggers browser-injected clear/search affordances. */
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number'
  /** Form field name — submitted via ElementInternals. */
  name?: string
  /** Placeholder shown when empty. */
  placeholder?: string
  /** Focus this field when its containing `a-dialog` opens. Presence-based. */
  autofocus?: boolean | ''
  /** Ellipsize an overflowing single-line value. Presence-based. */
  truncate?: boolean | ''
  autocomplete?: string
  inputmode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
  maxlength?: number | string
  minlength?: number | string
  pattern?: string
  min?: number | string
  max?: number | string
  step?: number | string
  spellcheck?: 'true' | 'false' | boolean
  /** Fires on every keystroke (`input` is composed — it reaches the host). */
  oninput?: (e: any) => void
  /** Fires on commit; the element re-dispatches the control's `change` on the
   *  host (native `change` isn't composed). */
  onchange?: (e: any) => void
  /** Fires when the built-in clear button is clicked, before clearing
   *  (cancelable, bubbling `clearclick` event — preventDefault keeps the
   *  value). All-lowercase so it binds in React *and* Preact. */
  onclearclick?: (e: any) => void
  /** Fires after the field has been cleared (bubbling `clearinput` event).
   *  All-lowercase so it binds in React *and* Preact. */
  onclearinput?: (e: any) => void
  'aria-invalid'?: 'true' | 'false' | boolean
  'aria-label'?: string
}

/** Attributes for the `<a-slider>` custom element. For the typed JSX wrapper,
 * display formatting, and marker layout use `Slider` from `@antadesign/anta`. */
export interface ASliderAttributes extends BaseAttributes {
  /** Controlled numeric value. */
  value?: number | string
  /** Initial uncontrolled value and form-reset baseline. */
  defaultvalue?: number | string
  /** Lowest permitted value. Defaults to 0. */
  min?: number | string
  /** Highest permitted value. Defaults to 100. */
  max?: number | string
  /** Smallest permitted increment. Defaults to 1. */
  step?: number | string
  /** Form field name — submitted through ElementInternals. */
  name?: string
  /** Disables pointer and keyboard interaction. Presence-based. */
  disabled?: boolean | ''
  /** Color of the filled rail. Named tones or a literal CSS color. */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Color of the thumb stroke. Named tones or a literal CSS color. */
  'thumb-tone'?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Size variant. small=24px, medium=28px, large=32px tall. */
  size?: 'small' | 'medium' | 'large'
  /** Thickness of both rail segments as a CSS length, such as `'4px'`. */
  'track-size'?: string
  /** Diameter of the thumb as a CSS length, such as `'20px'`. */
  'thumb-size'?: string
  /** Fill the thumb with its resolved border color. Presence-based. */
  'thumb-fill'?: boolean | ''
  /** Fully round the rail and thumb, or set both to a custom radius. */
  round?: boolean | number | string
  /** `jump` moves to a pressed rail position. Omit for relative dragging. */
  'track-click'?: 'jump'
  /** `inline`, `thumb`, or `none`; omit for a value at the label row's end. */
  'value-display'?: 'inline' | 'thumb' | 'none'
  /** Text inserted before the live numeric value. */
  'value-prefix'?: string
  /** Text inserted after the live numeric value. */
  'value-suffix'?: string
  /** Fires on each value change. */
  oninput?: (e: any) => void
  /** Fires when a drag ends or a keyboard value change completes. */
  onchange?: (e: any) => void
  role?: string
  'aria-label'?: string
  'aria-valuenow'?: number | string
  'aria-valuemin'?: number | string
  'aria-valuemax'?: number | string
  'aria-valuetext'?: string
}

/** Attributes for the `<a-input-time>` custom element — a segmented wall-clock
 *  time field (hour / minute / AM-PM native text-input sections in one box). */
export interface AInputTimeAttributes extends BaseAttributes {
  /** Controlled value — 24-hour `"HH:mm"`, `''` when incomplete. */
  value?: string
  /** Focus this field when its containing `a-dialog` opens. Presence-based. */
  autofocus?: boolean | ''
  /** Initial value for the uncontrolled case (24-hour `"HH:mm"`). */
  defaultvalue?: string
  /** BCP-47 locale driving the clock (12h vs 24h), segment order, separator, and
   *  the AM/PM text. Defaults to `navigator.language`. */
  locale?: string
  /** Force the clock — `'true'` = 12-hour (AM/PM), `'false'` = 24-hour. Omit to
   *  follow the locale. Value-based (tri-state), not a presence boolean. */
  hour12?: 'true' | 'false'
  /** Earliest allowed time, 24-hour `"HH:mm"` — complete values below it clamp up
   *  and flag `rangeUnderflow`. */
  min?: string
  /** Latest allowed time, 24-hour `"HH:mm"` — complete values above it clamp down
   *  and flag `rangeOverflow`. */
  max?: string
  /** Validation/feedback tone. Only `critical` carries validity weight. */
  status?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical'
  /** Custom accent color (any literal CSS color) — tints the resting + hover
   *  border via an oklch derivation; `status` overrides for validation. */
  tone?: string
  /** Disabled state. Presence-based. */
  disabled?: boolean | ''
  /** Required — drives native validity. Presence-based. */
  required?: boolean | ''
  /** Dim the trailing adornments at rest (0.6); brighten on hover / focus. */
  'dim-actions'?: boolean | ''
  /** Fully-round field, or a custom radius via a length value. Presence-based
   *  for the boolean form. */
  round?: boolean | number | string
  /** Size variant. small=24px, medium (default)=28px, large=32px. */
  size?: 'small' | 'medium' | 'large'
  /** Form field name — the 24-hour value submits via ElementInternals. */
  name?: string
  /** Fires on every segment edit (`input` is composed — it reaches the host). */
  oninput?: (e: any) => void
  /** Fires on commit (blur). */
  onchange?: (e: any) => void
  /** Fires after the built-in clear button empties the field (`clearinput`). */
  onclearinput?: (e: any) => void
  'aria-invalid'?: 'true' | 'false' | boolean
  'aria-label'?: string
}

/**
 * Attributes for the `<a-calendar>` custom element — a **light-DOM,
 * form-associated** month grid, and the **interaction authority** for it. The
 * element is the grid (a flat 7-column CSS grid whose children are the weekday
 * headers + day cells), owns the submitted form value, and **dispatches the
 * selection (`statechange` / `change`) and navigation (`navigate`) events** plus
 * manages keyboard focus — so it works for a vanilla consumer, not only via the
 * wrapper. It does **not** build or mutate its own contents: whoever renders into
 * it (the `Calendar` JSX wrapper, or a vanilla consumer using the exported
 * `buildMonth` engine) fills it with day cells and *re-renders on its events* —
 * the `<a-radio-group>` model. Controlled by the presence of `value` (a pick only
 * *requests* a change); uncontrolled with `defaultvalue` (a pick self-applies).
 * For the typed, batteries-included wrapper use `Calendar` from `@antadesign/anta`.
 *
 * `:state(filled)` is the styling hook for "has a selection".
 */
export interface ACalendarAttributes extends BaseAttributes {
  /** Controlled selected date — ISO `YYYY-MM-DD`. Present → controlled (a pick
   *  only requests a change). Mirrored to the owning form via `ElementInternals`. */
  value?: string
  /** Uncontrolled initial date / reset baseline — ISO `YYYY-MM-DD`. */
  defaultvalue?: string
  /** Form field name — the selected ISO date submits under this key. */
  name?: string
  /** Disable the whole calendar. Presence-based (`''` on, omit off). */
  disabled?: boolean | ''
  /** Focus signal — `"<iso>#<nonce>"`. When it changes, the element focuses the
   *  day cell whose `data-date` matches `<iso>` (set by the renderer after a
   *  month-changing keyboard move). */
  'data-focus'?: string
  /** Cancelable, bubbling `statechange` fired BEFORE a pick applies. `detail` is
   *  `{ next, prev, reason }` — ISO strings (or `null`); `reason` ∈
   *  `'user' | 'reset' | 'restore'`. `preventDefault()` vetoes a `'user'` pick in
   *  uncontrolled mode. */
  onstatechange?: (
    e: CustomEvent<{ next: string | null; prev: string | null; reason: 'user' | 'reset' | 'restore' }>,
  ) => void
  /** Native `change`, fired AFTER a selection applies (uncontrolled) and on
   *  reset/restore. */
  onchange?: (e: Event) => void
  /** Keyboard navigation request — the element handles arrow / Home / End /
   *  PageUp / PageDown, focuses the target cell when it's rendered, and emits this
   *  bubbling `navigate` `CustomEvent` (`detail: { date }`, ISO) so the renderer can
   *  move the roving tab stop and flip the displayed month when needed. */
  onnavigate?: (e: CustomEvent<{ date: string }>) => void
  /** ARIA — `role="group"` and the accessible name are set by the renderer (the
   *  `Calendar` wrapper wires `aria-labelledby` to the month heading). */
  'aria-label'?: string
  'aria-labelledby'?: string
}

/**
 * Attributes for the `<a-menu>` custom element. Placed immediately after the
 * trigger it anchors to (root menu), or nested inside an `<a-menu-item>`
 * (submenu). For the typed JSX wrapper use `Menu` from `@antadesign/anta`.
 */
export interface AMenuAttributes extends BaseAttributes {
  /** Preferred placement relative to the trigger; auto-flips / clamps.
   *  Defaults to `'bottom-start'`. `right` / `left` place the menu beside the trigger. */
  placement?:
    | 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'bottom' | 'top'
    | 'right-start' | 'right-end' | 'left-start' | 'left-end' | 'right' | 'left'
  /** Open on right-click of the trigger region, positioned at the pointer.
   *  Presence-based (`''` on, omit off). */
  context?: boolean | ''
  /** Open at the pointer coordinates instead of aligned to the trigger box.
   *  Presence-based (`''` on, omit off). */
  coord?: boolean | ''
  /** Submenus only (an `<a-menu>` nested inside an `<a-menu-item>` — detected
   *  from that structure; ignored on a root menu). Submenus open on hover by
   *  default; this opts out, making the submenu click-only. Presence-based
   *  (`''` on, omit off). */
  nohover?: boolean | ''
  /** Round: container softens to a 20px radius and its items go fully round. A
   *  length value (`round="12px"`) tunes the container radius only (items stay
   *  pills). Presence-based for the boolean form. */
  round?: boolean | number | string
  /** Gap in pixels between the trigger and the menu. Defaults to 4. */
  offset?: number | string
  /** Size the menu to its content instead of flooring its width to the trigger.
   *  By default a root menu is never narrower than its trigger; `autowidth` drops
   *  that floor (min-width falls back to `--menu-min-width`) for a content menu
   *  under a wide trigger, e.g. InputDate's calendar below a full-width field.
   *  Presence-based (`''` on, omit off). */
  autowidth?: boolean | ''
  /** Controlled open state (`'open'` / `'closed'`). Omit for uncontrolled;
   *  present → visibility follows this value, and the element never writes it
   *  (the consumer owns it). Listen to `statechange` to keep it in sync. See
   *  STATEFUL-COMPONENTS.md. */
  state?: 'open' | 'closed'
  /** State-change event — `cancelable`, fired before applying, with
   *  `detail: { next, prev }` in the `'open'|'closed'` vocabulary (plus optional
   *  `coord` / `originEvent`). All-lowercase so React/Preact bind it to the
   *  element's `statechange` CustomEvent. The `Menu` wrapper exposes this as the
   *  `onStateChange` prop. */
  onstatechange?: (
    e: CustomEvent<{ next: 'open' | 'closed'; prev: 'open' | 'closed' }>,
  ) => void
  /** Combobox-mode cursor report — fired when the active option changes (arrow
   *  keys, or the list re-filtering), with `detail.id` the active option's `id`
   *  (`null` when none). The element owns the keyboard cursor but must NOT write
   *  `aria-activedescendant` on the (light-DOM) filter field itself; the reactive
   *  layer that owns the field (e.g. `Select`) listens here and reflects it.
   *  All-lowercase so React/Preact bind it to the CustomEvent. */
  onactivedescendant?: (e: CustomEvent<{ id: string | null }>) => void
  /** Contain events so they don't bubble out of the menu surface to ancestor /
   *  document handlers. Space- or comma-separated event names
   *  (`stop-propagation="click pointerdown"`); a bare / empty attribute defaults to
   *  `click`. Menu-item / `data-menu-close` selections are always contained; this
   *  extends containment to whole event types. */
  'stop-propagation'?: string
  /** ARIA role — the JSX wrapper sets this to `'menu'`. */
  role?: string
  'aria-orientation'?: 'vertical' | 'horizontal'
}

/**
 * Attributes for the `<a-menu-item>` custom element. For the typed JSX
 * wrapper use `MenuItem` from `@antadesign/anta`.
 */
export interface AMenuItemAttributes extends BaseAttributes {
  /** Disabled state. Presence-based (`''` on, omit off). */
  disabled?: boolean | ''
  /** Marks the item as selected — a persistent background tint (the same
   *  resting look a pressed row shows), for building single- / multi-select
   *  menus. Presence-based (`''` on, omit off). */
  selected?: boolean | ''
  /** Semantic tone. Colors the label, icon, and hover/selected tint. A named tone,
   *  or any literal CSS color for a one-off custom tone (resolved through
   *  `--menu-item-tone-source`, hue/chroma kept, lightness pinned to the brand
   *  text). `'neutral'` (the default) is the same as omitting it. */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Keep the menu open after this item is chosen (toggles / multi-select),
   *  instead of the default close-on-select. Presence-based (`''` on, omit
   *  off). The universal form is `data-menu-open` (works on any element). */
  'data-menu-open'?: boolean | ''
  /** Marks this item as a submenu parent (renders a chevron, opens a nested
   *  `<a-menu>`). Presence-based (`''` on, omit off). */
  submenu?: boolean | ''
  /** ARIA role — `'menuitem'`. */
  role?: string
  'aria-haspopup'?: 'menu' | 'true' | 'false' | boolean
  /** Available for hand-authored markup, but the `MenuItem` wrapper does NOT set
   *  it: keeping it in sync would need a light-DOM mutation (desyncs the
   *  worker-thread reactive model) or reactive state for one attribute, and a
   *  static value would lie once the submenu opens. `aria-haspopup` announces the
   *  submenu; the open branch's visual rides the nested `<a-menu>`'s `:state(open)`. */
  'aria-expanded'?: 'true' | 'false' | boolean
  'aria-disabled'?: 'true' | 'false' | boolean
  /** Fired when this row is genuinely activated (click / Enter / Space). The
   *  parent `<a-menu>` owns click delegation and dispatches this — already
   *  filtered so it never fires on a submenu parent or from a bubbled child
   *  click — so the `MenuItem` wrapper's `onSelect` needs no DOM traversal. It's
   *  a `MouseEvent`, carrying the modifier keys (e.g. `altKey`). All-lowercase so
   *  React/Preact bind it to the CustomEvent. */
  onmenuselect?: (e: MouseEvent) => void
}

/**
 * Attributes for the `<a-menu-group>` styled element. For the typed JSX
 * wrapper use `MenuGroup` from `@antadesign/anta`.
 */
export interface AMenuGroupAttributes extends BaseAttributes {
  /** Keep the menu open after any item in this group is chosen. Presence-based
   *  (`''` on, omit off). The universal form is `data-menu-open`. */
  'data-menu-open'?: boolean | ''
  role?: string
  'aria-label'?: string
}

/**
 * Attributes for the `<a-button>` custom element. For the typed JSX
 * wrapper use `Button` from `@antadesign/anta`.
 */
export interface AButtonAttributes extends BaseAttributes {
  /** Visual emphasis. */
  priority?: 'primary' | 'secondary' | 'tertiary' | 'quaternary'
  /** Semantic tone, or any literal CSS color for a one-off custom tone. */
  tone?:
    | 'neutral'
    | 'brand'
    | 'info'
    | 'success'
    | 'warning'
    | 'critical'
    | (string & {})
  /** Underline style. Only renders on `priority="tertiary" | "quaternary"`. */
  underline?: 'solid' | 'dashed' | 'dotted'
  /** Show the underline only on hover. Requires `underline`. Presence-based (`''` on, omit off). */
  'underline-on-hover'?: boolean | ''
  /** Size variant. small=22px, medium=26px, large=30px. */
  size?: 'small' | 'medium' | 'large'
  /** Drop outer padding to zero. Only takes effect on `priority="quaternary"`.
   *  Presence-based: `''` (or any value) turns it on; omit to turn off. */
  paddingless?: boolean | ''
  /** Loading state. Presence-based (`''` on, omit off). */
  loading?: boolean | ''
  /** Disabled state. Presence-based (`''` on, omit off). */
  disabled?: boolean | ''
  /** Toggled-on / pressed state. Presence-based (`''` on, omit off). */
  selected?: boolean | ''
  /** Fully-round (pill / circle) — `border-radius: 999px` — or a custom radius via
   *  a length value (`round="20px"`). Presence-based for the boolean form. */
  round?: boolean | number | string
  /** Submit/reset semantics. */
  type?: 'button' | 'submit' | 'reset'
  /** Associate with a form by id when not nested inside it. */
  form?: string
  /** Custom event name dispatched (bubbling) on click. */
  'data-custom-event'?: string
  'aria-disabled'?: 'true' | 'false' | boolean
  'aria-busy'?: 'true' | 'false' | boolean
}

/** `<a-copy>` — the copy-to-clipboard behavior, slotted inside an activatable
 *  control (`<a-button>`, `<a-menu-item>`, native `button`/`[role]`). It owns
 *  the whole feature; the base controls carry no copy knowledge. `ButtonCopy` /
 *  `MenuItemCopy` are the presets that drop it in. */
export interface ACopyAttributes extends BaseAttributes {
  /** Text copied to the clipboard when the host control is activated. */
  copy?: string
  /** Copy a DOM node instead of a string (rich `text/html` + plain text). Bare
   *  `copy-node` copies the nearest ancestor marked `[data-copy-source]`; a value
   *  is a CSS selector resolved with `closest()` (an ancestor region). The copy
   *  control is stripped from the serialized output. Presence-based for the
   *  boolean form. */
  'copy-node'?: boolean | string
  /** Copy the current page URL (`location.href`) instead of a `copy` string; no
   *  `copy` needed. Presence-based. */
  'copy-url'?: boolean | ''
  /** Prefix the copied `copy` string with `// URL: <href>`. Presence-based. */
  'copy-with-url'?: boolean | ''
  /** Show a short confirmation label after a successful copy. It renders in the
   *  top layer so the host's overflow cannot clip it. Presence-based. `ButtonCopy`
   *  sets it when `iconPlacement="none"`. */
  toast?: boolean | ''
  /** Text in the success confirmation shown by `toast`.
   *  @defaultValue Copied */
  'copied-label'?: string
  /** Fired after a copy attempt (`copydone`, `detail: { ok }`, non-bubbling so a
   *  nested copy control can't flip an ancestor's feedback). All-lowercase so it
   *  binds in React *and* Preact. */
  oncopydone?: (e: CustomEvent<{ ok: boolean }>) => void
  /** Fired on **pointerdown** / keydown for a string-copy control (`copyrequest`,
   *  non-bubbling). Answer by setting the `copy` attribute to the freshly-computed
   *  value; the activation then copies it. The gap lets an off-UI-thread handler
   *  set `copy` in time. All-lowercase. */
  oncopyrequest?: (e: CustomEvent) => void
}

/**
 * Attributes for the `<a-radio>` custom element — one option in a radio set.
 * Presentational: the parent `<a-radio-group>` owns selection, keyboard, and form
 * value. The selected look comes from the element's `:state(selected)` (set by the
 * group via the `selected` property), not a host attribute. There is no `Radio`
 * JSX wrapper — `RadioGroup` renders these from its `options`, and hand-authors
 * write `<a-radio>` directly inside an `<a-radio-group>`.
 */
export interface ARadioAttributes extends BaseAttributes {
  /** This option's identity / submitted value. */
  value?: string
  /** Mark color in every state — selected ring fill + dot *and* unselected ring
   *  border — or any literal CSS color for a one-off custom tone. Named tones track
   *  light/dark mode. `'neutral'` is the default. The label + hint stay neutral —
   *  recolor them in plain CSS via the `--text-N-{tone}` tokens. */
  tone?: 'brand' | 'neutral' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Like `tone`, but colored onto the selected mark only — an unselected ring stays
   *  neutral grey. Same value set as `tone`; if both are set, `tone` governs the
   *  off-state border and `tone-selected` the selected fill. */
  'tone-selected'?: 'brand' | 'neutral' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Size variant. small=14px, medium=16px, large=18px control. */
  size?: 'small' | 'medium' | 'large'
  /** Disabled state. Presence-based (`''` on, omit off). */
  disabled?: boolean | ''
  /** Selected state — connect-time seed for the standalone render path (no
   *  group). In a group, the group drives `:state(selected)` directly and this
   *  attribute is ignored. Presence-based. */
  selected?: boolean | ''
  /** ARIA — `role="radio"` is set by the consumer (`RadioGroup` on each option,
   *  or a hand-author). `aria-checked` is published by the element through
   *  `ElementInternals` (off the DOM), driven by the `selected` property the group
   *  sets — not a DOM attribute. Roving `tabindex` (inherited from `BaseAttributes`)
   *  is likewise set by `RadioGroup`, not the element. */
  role?: 'radio'
  'aria-disabled'?: 'true' | 'false'
}

/**
 * Attributes for the `<a-radio-group>` custom element — the single-select
 * coordinator. It is the form-associated element (submits one `name=value`).
 * No shadow DOM: an optional group header (`<a-radio-group-label>` + an optional
 * `<a-radio-group-hint>` description) sits above an `<a-radio-list>` wrapping the
 * `<a-radio>` options — each option wraps its text in `<a-radio-label>` and an
 * optional `<a-radio-hint>`. All plain light-DOM children, laid out by
 * `a-radio-group.css`, so the arrangement is restylable with ordinary CSS
 * (`a-radio-group a-radio-list { … }`). The group
 * coordinates **off-DOM only** — it never writes the DOM: selection via each
 * radio's `selected` property, focus via `internals.ariaActiveDescendantElement`,
 * the form value via `setFormValue`. Roving `tabindex` (the JSX path) is rendered
 * by the `RadioGroup` wrapper, not the element. The `RadioGroup` wrapper composes
 * the label/list/hint from `label` / `hint`; hand-authors write them directly.
 * For the typed JSX wrapper use `RadioGroup` from `@antadesign/anta`.
 */
export interface ARadioGroupAttributes extends BaseAttributes {
  /** Controlled selected value (the chosen radio's `value`). Present → controlled:
   *  the element reflects changes to this attribute and a pick only dispatches
   *  `statechange`. Absent → uncontrolled (seed with `default-state`). */
  state?: string
  /** Uncontrolled initial selected value — read once on connect / form-reset. */
  'default-state'?: string
  /** Form field name — the group submits `name=value`. */
  name?: string
  /** Mark tone cascaded to children that don't set their own, or any literal CSS
   *  color for a one-off custom tone. Colors every child's ring fill + dot *and*
   *  unselected border. The option text stays neutral — recolor it in plain CSS via
   *  the `--text-N-{tone}` tokens. */
  tone?: 'brand' | 'neutral' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Like `tone`, but colored onto the selected option only — every unselected ring
   *  stays neutral grey. Cascaded to children that don't set their own. */
  'tone-selected'?: 'brand' | 'neutral' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Size cascaded to children that don't set their own. */
  size?: 'small' | 'medium' | 'large'
  /** Validation/feedback tone for the group hint — same set as `<a-input>`'s
   *  `status`. Recolors `<a-radio-group-hint>`; omit for the neutral default. */
  status?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical'
  /** Disable the whole group. Presence-based. */
  disabled?: boolean | ''
  /** Layout + arrow-key axis. `'vertical'` is the default. */
  orientation?: 'vertical' | 'horizontal'
  /** Fires whenever the selection changes. `detail` carries `{ next, prev, reason }`:
   *  `next`/`prev` are the selected values (`null` = nothing selected), and `reason`
   *  is `'user'` (a pick — the event is **cancelable**; a synchronous
   *  `preventDefault()` vetoes it in uncontrolled mode), `'reset'` (a `<form>` reset),
   *  or `'restore'` (bfcache / autofill restore) — the latter two are not cancelable.
   *  All-lowercase to bind across both renderers (like `<a-checkbox>`). */
  onstatechange?: (
    e: CustomEvent<{
      next: string | null
      prev: string | null
      reason: 'user' | 'reset' | 'restore'
    }>,
  ) => void
  /** Native `change`, fired *after* a selection applies (post-apply counterpart to
   *  `onstatechange`). Lowercase so both renderers bind the native event. */
  onchange?: (e: Event) => void
  /** Group focus enter / leave — wired from the bubbling `focusin` / `focusout`
   *  (focus lands on an option, not the group). The `RadioGroup` wrapper maps its
   *  `onFocus` / `onBlur` props here. */
  onfocusin?: (e: FocusEvent) => void
  onfocusout?: (e: FocusEvent) => void
  /** ARIA — set by the `RadioGroup` wrapper (the element never touches these). */
  role?: 'radiogroup'
  'aria-disabled'?: 'true' | 'false'
  'aria-label'?: string
  'aria-labelledby'?: string
}

/**
 * Attributes for the `<a-tab>` custom element — one tab in a tablist. Presentational,
 * the sibling of `<a-radio>`: the parent `<a-tabs>` owns selection, keyboard, and
 * scrolling. The selected look comes from the element's `:state(selected)` (set by the
 * tablist via the `selected` property), not a host attribute. There is no `Tab` web
 * component to render directly — `Tabs` renders these from its `<Tab>` children, and
 * hand-authors write `<a-tab>` directly inside an `<a-tabs>`. Wrap the visible label in
 * `<a-tab-label>` (as `Tabs` does) so it carries the optical baseline nudge, truncates
 * with an ellipsis when constrained, and keeps a sibling `<a-icon>` centered — exactly
 * like `<a-button-label>`.
 */
export interface ATabAttributes extends BaseAttributes {
  /** This tab's identity / the value reported when it's selected. */
  value?: string
  /** Per-tab tone override (same vocabulary as `<a-tabs tone>`): colors this tab's
   *  label + icons and, when selected, its indicator. Named tones tone the sliding
   *  indicator too; a custom literal color tones the indicator only in `noslide`.
   *  Custom tones also set `--tabs-tone-source` on the tab (via the wrapper's style). */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Selected state — connect-time seed for the standalone render path (no tablist).
   *  In an `<a-tabs>`, the tablist drives `:state(selected)` directly and this
   *  attribute is ignored. Presence-based (`''` on, omit off). */
  selected?: boolean | ''
  /** Disabled state. Presence-based (`''` on, omit off). */
  disabled?: boolean | ''
  /** Fully-round this tab's box (`--tab-radius: 999px`). `<a-tabs round>` sets it
   *  strip-wide instead. Presence-based (`''` on, omit off) — no custom value. */
  round?: boolean | ''
  /** ARIA — `role="tab"` is set by the consumer (`Tabs` on each tab, or a hand-author),
   *  and `aria-controls` points at the paired panel. `aria-selected` is published by
   *  the element through `ElementInternals` (off the DOM), driven by the `selected`
   *  property the tablist sets — not a DOM attribute. `tabindex` (inherited from
   *  `BaseAttributes`) is set by `Tabs` — every enabled tab is its own tab stop
   *  (`tabindex="0"`) — not by the element. */
  role?: 'tab'
  'aria-controls'?: string
  'aria-disabled'?: 'true' | 'false'
}

/**
 * Attributes for the `<a-tabs>` custom element — the tablist + single-select
 * coordinator. No shadow DOM: `<a-tab>` children are plain light-DOM, laid out by
 * `a-tabs.css`, so the strip is restylable with ordinary CSS and usable hand-assembled.
 * Unlike `<a-radio-group>` it is NOT form-associated (a tablist submits nothing), and
 * the panels live outside it (siblings the `Tabs` wrapper shows/hides). The element
 * coordinates **off-DOM only** — selection via each tab's `selected` property, focus via
 * `internals.ariaActiveDescendantElement`, scroll via `scrollIntoView`. Roving
 * `tabindex` (the JSX path) is rendered by the `Tabs` wrapper, not the element. For the
 * typed JSX wrapper use `Tabs` from `@antadesign/anta`.
 */
export interface ATabsAttributes extends BaseAttributes {
  /** Controlled selected value (the active tab's `value`). Present → controlled: the
   *  element reflects changes to this attribute and a pick only dispatches
   *  `statechange`. Absent → uncontrolled (seed with `default-state`). */
  state?: string
  /** Uncontrolled initial selected value — read once on connect. */
  'default-state'?: string
  /** Visual priority. `primary` (default) is the raised pill on a recessed track; `secondary`
   *  keeps that sizing but drops the track (selected = subtle active background fill, no
   *  border); `tertiary` is a bottom-underline under the selected tab only (no track, no rest
   *  line). `tone` tints secondary + tertiary; primary stays neutral. */
  priority?: 'primary' | 'secondary' | 'tertiary'
  /** Tone applied to the selected indicator/label, or any literal CSS color for a
   *  one-off custom tone (derived in oklch). `'neutral'` is the default. */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Size variant. small=24px, medium (default)=28px, large=32px tall — matching Button's
   *  scale (the label leading runs a touch tighter, offset by 1px more block padding per side). */
  size?: 'small' | 'medium' | 'large'
  /** Layout + arrow-key axis. `'horizontal'` (default) ellipsizes labels when tabs
   *  overflow (scrolling is opt-in via CSS); `'vertical'` stacks them. */
  orientation?: 'horizontal' | 'vertical'
  /** Make horizontal tabs share the available inline space equally. Presence-based
   *  (`''` on, omit off). */
  fill?: boolean | ''
  /** Disable the sliding indicator. By default the selected-tab indicator is a single
   *  rectangle that animates between tabs via CSS anchor positioning; with `noslide` the
   *  highlight is painted on each tab and snaps with no movement (also the automatic
   *  fallback where anchor positioning isn't supported). Presence-based (`''` on, omit off). */
  noslide?: boolean | ''
  /** Disable the whole strip. Presence-based (`''` on, omit off). */
  disabled?: boolean | ''
  /** Fully-round tabs + sliding indicator (via `--tab-radius: 999px`) and the primary
   *  track well. A length value (`round="10px"`) applies to the top-level track well
   *  only (pills + indicator stay full). Presence-based for the boolean form. */
  round?: boolean | number | string
  /** Fires whenever the active tab changes. `detail` carries `{ next, prev }` (values;
   *  `null` = none). Cancelable: a synchronous `preventDefault()` vetoes the pick in
   *  uncontrolled mode. All-lowercase to bind across both renderers (like
   *  `<a-radio-group>`). */
  onstatechange?: (
    e: CustomEvent<{ next: string | null; prev: string | null }>,
  ) => void
  /** Native `change`, fired *after* a selection applies (post-apply counterpart to
   *  `onstatechange`). Lowercase so both renderers bind the native event. */
  onchange?: (e: Event) => void
  /** Strip focus enter / leave — wired from the bubbling `focusin` / `focusout` (focus
   *  lands on a tab, not the tablist). The `Tabs` wrapper maps its `onFocus`/`onBlur`. */
  onfocusin?: (e: FocusEvent) => void
  onfocusout?: (e: FocusEvent) => void
  /** ARIA — set by the `Tabs` wrapper (the element never touches these). */
  role?: 'tablist'
  'aria-orientation'?: 'horizontal' | 'vertical'
  'aria-disabled'?: 'true' | 'false'
  'aria-label'?: string
}

/**
 * Attributes for the `<a-tabpanel>` styled tag.
 *
 * `<a-tabpanel>` has no JS — it's a CSS-only styled element. The `Tabs` wrapper renders
 * it, pairs it to its tab via id, and toggles visibility declaratively: `hidden`
 * (display:none) or `data-hide="visibility"` (keeps the layout box), plus `inert` while
 * hidden. Low-level attributes; for the typed JSX wrapper use `TabPanel` (inside `Tabs`)
 * from `@antadesign/anta`.
 */
export interface ATabpanelAttributes extends BaseAttributes {
  /** Pairs the panel with the tab of the same value. The element reads its
   *  `<a-tabs>` and shows itself when this is the active value. */
  value?: string
  /** How the panel hides while inactive: omit for `display:none` (removed from
   *  layout + the a11y tree), or `'visibility'` to keep its layout box. The
   *  element toggles its own `:state(active)`; this only picks the hide style. */
  'hide-mode'?: 'display' | 'visibility'
  /** ARIA — set statically by the `TabPanel` wrapper. `aria-labelledby` is NOT an
   *  attribute here: the element points at its tab off-DOM via
   *  `internals.ariaLabelledByElements`. */
  role?: 'tabpanel'
}

/**
 * Attributes for the `<a-card>` custom element — a surface container that lays out
 * an optional `media` region plus a `header` / body / `footer` stack, and becomes a
 * link when given `href`. Slots (light-DOM children): `media`, `icon`, `header`,
 * `footer`, and the default slot for the body. The element exposes
 * `::part(container | media | content | icon | header | body | footer)`. In link
 * mode it names the shadow anchor from `aria-label` → header text → body text →
 * `href`. Low-level attributes; for the typed JSX wrapper use `Card` from
 * `@antadesign/anta`.
 */
export interface ACardAttributes extends BaseAttributes {
  /** Semantic tone, or any literal CSS color for a one-off custom tone. Named tones
   *  re-point the surface + text; a custom color keeps its hue with lightness/chroma
   *  pinned. `'neutral'` is the default (same as omitting it). */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Surface emphasis. `primary` (default) is a clean sheet; `secondary` a subtle
   *  fill; `tertiary` a frosted, semi-transparent panel with a backdrop blur. */
  priority?: 'primary' | 'secondary' | 'tertiary'
  /** Size variant — scales the padding. `medium` is the default. */
  size?: 'small' | 'medium' | 'large'
  /** Which edge the full-bleed `media` slot sits on. `top` is the default. */
  'media-position'?: 'top' | 'bottom' | 'left' | 'right'
  /** Selected / chosen state — an inset ring in the tone color. Presence-based
   *  (`''` on, omit off). */
  selected?: boolean | ''
  /** Loading state — skeleton pulse, `aria-busy`, and (in link mode) navigation is
   *  blocked (the anchor drops its `href`). Presence-based (`''` on, omit off). */
  loading?: boolean | ''
  /** Fully-round corners (`border-radius: 999px`), or a custom radius via a length
   *  value (`round="16px"`). Presence-based for the boolean form. */
  round?: boolean | number | string
  /** Turn the whole card into a link — the shadow container becomes a focusable
   *  anchor with this URL. */
  href?: string
  /** Anchor target (only with `href`). */
  target?: string
  /** Anchor rel (only with `href`). */
  rel?: string
  /** Space-separated URLs pinged on navigation (only with `href`). */
  ping?: string
  /** Explicit accessible name for the link — overrides the header → body → href
   *  chain the element derives in link mode. */
  'aria-label'?: string
}

/**
 * Attributes for the `<a-banner>` custom element — a full-width, dismissible
 * message strip (borderless by default; opt into a rule via `border-bottom-width` /
 * `border-width`, the Progress pattern). Slots (light-DOM children): `message`
 * (leading), the default slot (middle content), `actions` (trailing), and `close`
 * (the ✕ button). The element exposes `::part(message | content | actions | close)`,
 * and `:state(open)` / `:state(closed)` as visibility hooks (the external
 * sheet collapses the host on `:state(closed)`). Low-level attributes; for the
 * typed JSX wrapper use `Banner` from `@antadesign/anta`.
 */
export interface ABannerAttributes extends BaseAttributes {
  /** Controlled visibility (`'open'` / `'closed'`). Present → controlled: the
   *  attribute is the source of truth, the ✕ dismiss only dispatches the cancelable
   *  `statechange` event, and the consumer answers by updating it. Absent →
   *  uncontrolled (use `default-state`). The `<Banner>` wrapper presents this as
   *  `dismissed` (closed = dismissed). See STATEFUL-COMPONENTS.md. */
  state?: 'open' | 'closed'
  /** Initial visibility for the uncontrolled mode (`'open'` / `'closed'`), read
   *  once at connect. A banner is shown by default, so omit / `'open'` shows it;
   *  `'closed'` starts it dismissed. */
  'default-state'?: 'open' | 'closed'
  /** Semantic tone, or any literal CSS color for a one-off custom tone. Named tones
   *  re-point the surface + text + border color (used if you opt into a border); a
   *  custom color keeps its hue with lightness/chroma pinned. `'neutral'` is the
   *  default (same as omitting it). */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Where the content row sits along the bar. `'start'` (the default, same as
   *  omitting it) runs it from the inline edge with the ✕'s zone kept clear;
   *  `'center'` centers it on the whole bar. The message text follows. */
  align?: 'start' | 'center'
  /** Rounded corners for a standalone banner — `border-radius: 999px` (clamps to a
   *  stadium), or a custom radius via a length value (`round="12px"`). Borderless
   *  like the default. Presence-based for the boolean form. */
  round?: boolean | number | string
  /** Fires before visibility changes — the element dispatches a `cancelable`
   *  `statechange` `CustomEvent` whose `detail` is `{ next, prev }` in the
   *  `'open'|'closed'` vocabulary (a dismiss is always `next: 'closed'`).
   *  Uncontrolled, `preventDefault()` vetoes the transition. All-lowercase so both
   *  renderers bind it (React 19 keeps the case after `on`; Preact lowercases). */
  onstatechange?: (
    e: CustomEvent<{ next: 'open' | 'closed'; prev: 'open' | 'closed' }>,
  ) => void
}

/**
 * Attributes for the `<a-toaster>` custom element — a viewport-anchored
 * notification region. One instance hosts all six placement zones; each
 * `<a-toast>` routes to a corner/edge by its `slot` attribute. Keep one mounted
 * (the `<Toaster>` wrapper, or by hand). Exposes `::part(region)`. Low-level
 * attributes; for the typed JSX wrapper use `Toaster` from `@antadesign/anta`.
 */
export interface AToasterAttributes extends BaseAttributes {
  /** Accessible name for the region landmark. */
  'aria-label'?: string
}

/**
 * Attributes for the `<a-toast>` custom element — one item inside an
 * `<a-toaster>`. A style-neutral container around slotted content: it owns the
 * enter/exit animation and the auto-dismiss timer (paused on hover / focus), with
 * no chrome of its own (no ✕, no surface — the content brings its own look and its
 * own dismiss affordance). Route it to a placement zone with `slot`
 * (`slot="bottom-right"`, …). It never removes itself — on dismiss it animates out
 * then emits a bubbling `dismiss`, and the owner removes the node. For an
 * announcement, give it `role="status"` (polite) or `role="alert"` (assertive).
 */
export interface AToastAttributes extends BaseAttributes {
  /** Auto-dismiss delay in ms (default 5000). Empty / non-positive uses the
   *  default; `Infinity` keeps it until dismissed (sticky). */
  duration?: number | string
  /** Set by the wrapper to request dismissal (a programmatic `dismiss`): the
   *  element plays its exit and emits `dismiss`. Presence-based (`''` on, omit off). */
  leaving?: boolean | ''
  /** Bumped on an in-place update so the element restarts its auto-dismiss timer. */
  rev?: number | string
  /** A live DOM node to show as the content (the wrapper's DOM-node branch);
   *  set as a property, not a string attribute. String / JSX content is slotted
   *  as children instead. */
  content?: Node
  /** Fires after the exit animation, when the toast has dismissed — a bubbling
   *  `CustomEvent`. The owner removes the node in response. All-lowercase so both
   *  renderers bind it (React 19 keeps the case after `on`; Preact lowercases). */
  ondismiss?: (e: CustomEvent) => void
}
