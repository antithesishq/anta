import { HTMLElementBase } from '../anta_helpers'
import './a-expander.css'

/**
 * `<a-expander>` — a collapsible disclosure, built from our own shadow
 * DOM (no native `<details>`/`<summary>`).
 *
 * Light-DOM composition (what the wrapper emits / a vanilla consumer
 * authors) uses two styled sub-elements:
 *
 *   <a-expander>
 *     <a-expander-summary slot="title">Title</a-expander-summary>
 *     <a-expander-details>…body…</a-expander-details>
 *   </a-expander>
 *
 * Shadow structure — every node carries a stable label (a part name or
 * a class, both shadow-scoped: invisible to consumer selectors, pure
 * documentation + styling hooks):
 *
 *   <div class="header">       flex row: the trigger + header actions
 *     <button part="summary">  the summary; chevron is its ::before; the
 *       <slot name="title">    title is projected here
 *     <slot name="actions">    header actions — SIBLINGS of the button,
 *                              never inside it: clicks on them don't
 *                              toggle (no propagation path through the
 *                              button) and AT sees separate controls.
 *                              A flex row that never shrinks or wraps —
 *                              under width pressure the title ellipsizes
 *                              first, actions keep their intrinsic size.
 *                              display:none while empty (toggled by a
 *                              slotchange listener — CSS can't express
 *                              "slot has assigned nodes"), so an
 *                              actionless header reserves no space.
 *                              Visible in both folded and open states —
 *                              the header represents the section either
 *                              way (the MUI / GitHub convention).
 *   <div class="region">       the grid that animates height
 *     <slot part="content">    the body — this slot IS the grid item the
 *                              fr-track sizes (styled display:block) and
 *                              clips while animating; it projects the body
 *                              directly, no wrapper div
 *
 * ## Open state — the `state` contract (see STATEFUL-COMPONENTS.md)
 *
 * - **Uncontrolled** (no `state` attribute): the element owns its state.
 *   Clicking the summary toggles it; `default-state="open"` seeds the
 *   initial state (read once at connect). This is the hand-authored mode.
 * - **Controlled** (`state="open"`/`"closed"` present): the attribute is the
 *   single source of truth. Clicks do NOT self-toggle; they only dispatch the
 *   cancelable `statechange` event and the consumer answers by updating
 *   `state`. A consumer can reject by simply not updating. If you set `state`,
 *   you own it; absence keeps meaning "uncontrolled".
 *
 * Either way the element fires **`statechange`** — `cancelable`, *before* it
 * applies anything — with `detail: { next, prev }` in the `'open'|'closed'`
 * vocabulary. Uncontrolled, a handler can veto the transition synchronously
 * with `preventDefault()` (the element gates its own apply on the dispatch
 * result); controlled, `preventDefault()` is moot (the element never
 * self-applies) and not-updating-`state` is the reject.
 *
 * The internal open state lives in the shadow: `aria-expanded` on the
 * button (BOTH the a11y signal and the CSS state hook — no extra class)
 * plus `inert` on the collapsed region so hidden content leaves the tab
 * order and the a11y tree. Nothing on the host is ever mutated from JS
 * (declarative-DOM rule: the host may be reconciled off the UI thread).
 * `aria-controls` is intentionally omitted: optional in the WAI-ARIA
 * disclosure pattern, poorly supported, and would force a generated id.
 *
 * The open state is also mirrored to a custom state via `ElementInternals`
 * (`:state(open)`) purely as a *styling hook* for consumers — e.g. rotating a
 * chevron placed in `actions`, or matching an open header to a design. This is
 * declarative-DOM-safe: a custom state is element-internal, not a host
 * attribute, so it never mutates the host DOM. Guarded for engines without
 * `attachInternals` (it just doesn't expose the hook there).
 *
 * ## Shadow style notes (the sheet itself ships comment-free)
 *
 * - **Summary**: a real `<button>` (free focus + Enter/Space), reset to
 *   inherit the host's box/text so it reads as a plain header row. Its
 *   typography (default + per-`[level]` rules) is generated from
 *   `SUMMARY_TYPE_SCALE` below — the one place to keep in sync with the
 *   `a-title.css` type scale (`a-title` is CSS-only, so there is no
 *   shared constant to import). Deliberately NOT exposed as
 *   `--expander-summary-*` tokens: `level` covers the supported
 *   variation, the weight never varies, and `::part(summary)` is the
 *   escape hatch for bespoke restyling — component tokens are reserved
 *   for values external CSS must re-point (tone, surface, dark mode).
 * - **Chevron**: the button's `::before` — a mask painting with
 *   `currentColor` (the inherited, possibly toned `--expander-text`); dimmed at
 *   rest, full on hover/open, rotated 90° when open (the rotate composes with
 *   the vertical-centering `translateY(-50%)`). It's positioned ABSOLUTELY
 *   inside the gutter (`left: var(--expander-gutter) - 16px - 2px`, so its right
 *   edge sits 2px before the gutter — a 2px gap before the title), out of flow,
 *   so it never pushes the title — the title's inset is purely `--expander-gutter`
 *   (the same var the body uses). With `outdent` the gutter is 0, so the
 *   chevron auto-hangs at -18px in the negative gutter and the title sits flush
 *   with the surrounding content. (The 1px transparent border stays — it keeps
 *   tertiary content aligned with the filled priorities — so a -1px correction
 *   on the header + region cancels its content-box inset; see the SHADOW_STYLE
 *   outdent rule.)
 *   The chevron can't be hidden via an attribute (a foldable region needs a
 *   visible affordance) — restyle or remove it through ::part(summary)::before.
 * - **Hover/press affordance**: the button's `:hover`/`:active` set its
 *   own `color` (to `--expander-text-hover` / `--expander-text`); the
 *   slotted title and the `currentColor` chevron both follow by plain
 *   property inheritance across the slot boundary. Deliberately NOT
 *   `button:hover ::slotted(…)`: Chromium fails to invalidate slotted
 *   styles when an ancestor's hover state changes across a gradual pointer
 *   exit, leaving the hover look stuck (reproduced in Chrome 149;
 *   single-jump exits invalidate fine). Property inheritance propagates
 *   reliably where selector invalidation doesn't. Driving `color` (rather
 *   than a private var the title reads) is also what lets a consumer's
 *   `::part(summary):hover { color }` reach the title — the outer `::part`
 *   rule overrides this inner one and inheritance carries it through. The
 *   tradeoff: a custom title node with no explicit `color` now inherits the
 *   hover recolour too (set `color` on it to opt out). The tertiary surface
 *   adds the docs-header dotted underline via `--_summary-underline`, the
 *   one bit still scoped to `a-expander-summary` (text-decoration doesn't
 *   inherit usefully here). Press eases title + (closed) chevron back to the
 *   at-rest look as soft feedback; the underline intentionally stays (no
 *   flicker). The `:active` rule mirrors its `:hover` counterpart's
 *   specificity and follows it in source order, so it wins while pressed.
 * - **Collapse animation**: grid `0fr ↔ 1fr` on `.region` (`ANIM_MS`),
 *   keyed off the button's `aria-expanded`; the `[part="content"]` grid
 *   item clips (`overflow: clip`) while animating. The grid item is the
 *   `<slot>` itself, promoted to `display: block` so it generates a box and
 *   acts as the fr-sized grid track — a `display: contents` slot (the UA
 *   default) has no box and wouldn't size the track, which is why the slot
 *   carries `display: block` rather than projecting through a wrapper. Once open and
 *   idle the clip is dropped (delayed by `ANIM_MS` via a discrete
 *   `overflow` transition) so focus rings / nested popovers aren't cut
 *   off. Known degradation: without `transition-behavior:
 *   allow-discrete` (Firefox < 129, Safari < 18) the un-clip applies
 *   instantly on open, so expanding content paints outside the still-
 *   animating region for `ANIM_MS` — accepted, it's a one-frame-class
 *   cosmetic on a progressive-enhancement property.
 *
 * - **Disabled** (`disabled`, presence-based): the shadow button gets the
 *   native `disabled` — unfocusable, unclickable, no hover affordance
 *   (the hover/press rules are gated on `:enabled`). The open state
 *   freezes as-is (matching Radix / native form controls — disabling
 *   doesn't force-close). Host CSS dims the text; header actions stay
 *   live (they're outside the button) unless the consumer disables them.
 * - **Outdent**: `outdent` (tertiary only) hangs the chevron in the left
 *   gutter and drops the body's chevron-alignment indent (see
 *   a-expander.css) so the title + content line up flush with the
 *   surrounding column, like the docs section headers.
 * - **Open-state selectors** cross from the button to `.region` via
 *   `.header:has(button[aria-expanded="true"]) + .region` — the button
 *   sits inside the header flex row, so plain sibling combinators can't
 *   reach the region anymore.
 *
 * ## Host CSS notes (`a-expander.css` — also ships comment-free)
 *
 * - The external file styles the HOST box and declares the theme tokens
 *   that cascade — via `color` + custom properties — into the shadow
 *   tree. Named tones use Anta's theme-aware semantic tokens, so no
 *   `.dark` rules are needed (same as `<a-tag>`).
 * - The host carries no padding — the header `<button>` (full width + height)
 *   owns the content inset via `--expander-gutter`, the single value the title
 *   inset, the body inset, AND the chevron position all derive from (24px
 *   default; the chevron sits absolutely in it). So the title's left rhythm is
 *   constant for every `level`, the body always lines up under it, and the hit
 *   area is the whole header. The border is present on every priority
 *   (transparent on tertiary) so switching priority never shifts layout.
 *   `secondary` is the default surface; `primary` re-points to the stronger
 *   card pair; `tertiary` goes transparent. `outdent` (tertiary only) sets
 *   `--expander-gutter: 0` so title + body go flush with surrounding content
 *   and the chevron auto-hangs in the negative gutter; the transparent border
 *   stays (a -1px shadow correction cancels its 1px content-box inset).
 * - `<a-expander-summary>` / `<a-expander-details>` are CSS-only styled
 *   light-DOM tags (like `<a-tag-label>`). The summary inherits the
 *   shadow button's typography and only lays out + ellipsizes; the
 *   details own only layout (the indent) — no typography, so content
 *   keeps its own.
 * - Custom (non-named) `tone` keeps the source hue and pins lightness/
 *   chroma per token via `oklch(from …)`, re-tuned for dark mode — the
 *   `<a-tag>` / `<a-button>` mechanism. The JSX wrapper feeds the color
 *   in via inline `--expander-tone-source`; the typed
 *   `attr(tone type(<color>))` fallback covers raw-HTML authors on
 *   engines that support it.
 */

const ANIM_MS = 200

// Mirrors the h1–h6 scale in a-title.css (font-size / line-height, px).
// Level 5 is the default summary typography; the weight matches <Title>.
const SUMMARY_TYPE_SCALE: Record<string, [number, number]> = {
  '1': [28, 32],
  '2': [24, 28],
  '3': [20, 24],
  '4': [17, 20],
  '5': [15, 20],
  '6': [13, 16],
}
const SUMMARY_FONT_WEIGHT = 584.62

const SUMMARY_LEVEL_RULES = Object.entries(SUMMARY_TYPE_SCALE)
  .map(
    ([level, [size, line]]) =>
      `:host([level="${level}"]) button { font-size: ${size}px; line-height: ${line}px; }`,
  )
  .join('\n  ')

const SHADOW_STYLE = `
  :host { display: block; }

  .header {
    display: flex;
    /* Stretch so the trigger button (and the actions row) fill the full host
       height — the title's hit area is the whole header, not just the text. */
    align-items: stretch;
  }

  slot[name="actions"] { display: none; }
  .header.has-actions slot[name="actions"] {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    margin-inline-start: 8px;
    /* Inset from the right edge (the host has no padding of its own). */
    margin-inline-end: 4px;
  }

  button {
    appearance: none;
    -webkit-appearance: none;
    background: none;
    border: none;
    margin: 0;
    /* The button is the full-bleed header: it spans the host's width (flex: 1)
       and height (.header stretch). The title is inset by --expander-gutter
       (the chevron lives absolutely inside that gutter, below — it never pushes
       the title), so the title + the body share one inset value; 6px block
       gives the header a touch more height. Restyle it edge-to-edge via
       ::part(summary). */
    position: relative;
    padding: 6px 4px 6px var(--expander-gutter);
    flex: 1;
    min-width: 0;
    font: inherit;
    color: inherit;
    text-align: left;

    display: flex;
    align-items: center;
    gap: 0;
    cursor: pointer;
    user-select: none;
    border-radius: 2px;
    outline: none;
    font-size: ${SUMMARY_TYPE_SCALE['5'][0]}px;
    line-height: ${SUMMARY_TYPE_SCALE['5'][1]}px;
    font-weight: ${SUMMARY_FONT_WEIGHT};
    letter-spacing: 0;
  }

  button:focus-visible {
    outline: 1px solid var(--focus-ring);
    outline-offset: 0px;
  }

  ${SUMMARY_LEVEL_RULES}

  /* The chevron sits absolutely INSIDE the gutter — out of flow, so it never
     pushes the title. Its right edge lands 2px before the gutter (left = gutter
     - 16px - 2px), leaving a 2px gap before the title; at the default 24px
     gutter the chevron box is [6px, 22px], and on outdent (gutter 0) it
     auto-hangs at -18px in the negative gutter. One var drives the title inset,
     the body inset, and the chevron position. */
  button::before {
    content: '';
    position: absolute;
    left: calc(var(--expander-gutter) - 16px - 2px);
    top: 50%;
    width: 16px;
    height: 16px;
    background-color: currentColor;
    -webkit-mask-image: var(--_expander-chevron);
            mask-image: var(--_expander-chevron);
    -webkit-mask-size: contain;
            mask-size: contain;
    -webkit-mask-repeat: no-repeat;
            mask-repeat: no-repeat;
    -webkit-mask-position: center;
            mask-position: center;
    opacity: 0.6;
    /* translateY centers it; the open state adds rotate (same transform so the
       transition animates only the rotation). */
    transform: translateY(-50%);
    transition: transform 150ms ease, opacity 150ms ease, background-color 150ms ease;
  }
  button:enabled:hover::before { opacity: 1; }
  button[aria-expanded="true"]::before { transform: translateY(-50%) rotate(90deg); opacity: 1; }

  button:enabled:hover { color: var(--expander-text-hover); }
  :host([priority="tertiary"]) button:enabled:hover { --_summary-underline: underline; }
  button:enabled:active { color: var(--expander-text); }
  button:disabled { cursor: default; }
  button:enabled:not([aria-expanded="true"]):active::before {
    opacity: 0.6;
  }

  .region {
    display: grid;
    grid-template-rows: 0fr;
  }
  .header:has(button[aria-expanded="true"]) + .region { grid-template-rows: 1fr; }

  /* Outdent flush correction: the host keeps its 1px (transparent) border for
     cross-priority box stability, which insets the content-box by 1px. Pull the
     header + region back by that 1px so the title and body land exactly on the
     surrounding content (the chevron, absolutely positioned inside the header,
     rides along). Logical start so it follows RTL. */
  :host([priority="tertiary"][outdent]) .header,
  :host([priority="tertiary"][outdent]) .region {
    margin-inline-start: -1px;
  }
  @media (prefers-reduced-motion: no-preference) {
    .region { transition: grid-template-rows ${ANIM_MS}ms ease; }
  }

  [part="content"] { display: block; min-height: 0; overflow: clip; }
  .header:has(button[aria-expanded="true"]) + .region [part="content"] {
    overflow: visible;
    transition: overflow 0s ${ANIM_MS}ms;
    transition-behavior: allow-discrete;
  }
`

type ExpanderState = 'open' | 'closed'
const parseState = (v: string | null): ExpanderState => (v === 'open' ? 'open' : 'closed')

export class AExpanderElement extends HTMLElementBase {
  static observedAttributes = ['state', 'disabled', 'round']

  private summary: HTMLButtonElement
  private region: HTMLDivElement
  private header: HTMLDivElement
  // A dedicated shadow <style> the element rewrites to publish the measured
  // `round` radius as a `:host` custom property (see `measureRoundRadius`). Kept
  // separate from the static SHADOW_STYLE so updating it is a cheap textContent
  // swap on one small sheet, and it's shadow-internal (no host mutation).
  private roundStyle: HTMLStyleElement
  // Observes the header (folded) box so the `round` radius tracks its height —
  // including custom header content. Guarded for engines without ResizeObserver.
  private roundObserver?: ResizeObserver
  // ElementInternals exposes the open/closed state as a custom state
  // (`:state(open)`) for consumer styling — e.g. rotating a chevron that lives
  // in `actions`, or matching an open header to a design. It's NOT a host
  // attribute (declarative-DOM safe: no host mutation, no reconciliation
  // churn), just element-internal state the browser exposes for CSS matching.
  // Guarded for engines without attachInternals / CustomStateSet (no-op there).
  private internals?: ElementInternals

  constructor() {
    super()
    this.internals = typeof this.attachInternals === 'function' ? this.attachInternals() : undefined
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = SHADOW_STYLE

    this.summary = document.createElement('button')
    this.summary.type = 'button'
    this.summary.setAttribute('aria-expanded', 'false')
    // Expose the header button as a shadow part so consumers can style it —
    // including states CSS variables can't reach (e.g. ::part(summary):hover,
    // :focus-visible, ::part(summary)::before for the chevron).
    this.summary.setAttribute('part', 'summary')
    const titleSlot = document.createElement('slot')
    titleSlot.name = 'title'
    this.summary.append(titleSlot)
    this.summary.addEventListener('click', this.onSummaryClick)

    const header = document.createElement('div')
    header.className = 'header'
    this.header = header
    const actionsSlot = document.createElement('slot')
    actionsSlot.name = 'actions'
    // The actions row, exposed as a part for the same reason.
    actionsSlot.setAttribute('part', 'actions')
    // CSS can't express "slot has assigned nodes", so an empty actions
    // slot is display:none'd via this shadow-internal class — otherwise
    // its box would reserve a phantom margin next to the title.
    actionsSlot.addEventListener('slotchange', () => {
      header.classList.toggle('has-actions', actionsSlot.assignedElements().length > 0)
    })
    header.append(this.summary, actionsSlot)

    this.region = document.createElement('div')
    this.region.className = 'region'
    // The collapsible body IS the `<slot>` (styled `display:block` in the
    // sheet), so it's both the grid item the fr-track sizes AND the content
    // projection — one element, not a div-wrapping-a-slot. Exposed as a part
    // for the same reason (`::part` matches slots too).
    const content = document.createElement('slot')
    content.setAttribute('part', 'content')
    this.region.append(content)

    // Shadow-internal sheet for the measured `round` radius (empty until `round`
    // is set and the header is measured). Placed after the main style so it wins
    // on equal specificity if that ever matters.
    this.roundStyle = document.createElement('style')

    // ResizeObserver on the header (not the host): the header height is stable
    // across open/close, so the radius is a single value that makes the folded
    // box a pill AND keeps the same corners when expanded — no open-state
    // branching, and correct even for an expander that starts open.
    if (typeof ResizeObserver !== 'undefined') {
      this.roundObserver = new ResizeObserver(() => this.measureRoundRadius())
    }

    shadow.append(style, this.roundStyle, header, this.region)
  }

  /** Publish HALF the folded (header + host borders) height as
   *  `--_expander-round-radius` on `:host`, for `a-expander[round]` to consume.
   *  Reads layout only; writes only the shadow sheet — no host mutation. */
  /** A `round` attribute carrying a length (`round="12px"`) is a fixed radius —
   *  the CSS uses it directly and the measured pill is unused, so skip measuring.
   *  (The wrapper's `round={12}` path sets an inline var + a bare `round=""`, so
   *  it isn't caught here; the measurement runs but its var is simply overridden.) */
  private hasFixedRound(): boolean {
    const v = this.getAttribute('round')
    return v != null && v.trim() !== ''
  }

  private measureRoundRadius() {
    if (!this.hasAttribute('round') || this.hasFixedRound()) return
    const h = this.header.getBoundingClientRect().height
    if (h <= 0) return
    const cs = getComputedStyle(this)
    const borders =
      (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0)
    const radius = (h + borders) / 2
    this.roundStyle.textContent = `:host{--_expander-round-radius:${radius}px}`
  }

  private startRoundObserver() {
    if (!this.roundObserver || this.hasFixedRound()) return
    this.roundObserver.observe(this.header)
    this.measureRoundRadius()
  }

  private stopRoundObserver() {
    this.roundObserver?.disconnect()
    this.roundStyle.textContent = ''
  }

  /** Controlled mode: the `state` attribute is present and owns the state. */
  private get controlled(): boolean {
    return this.hasAttribute('state')
  }

  /** The currently *applied* state (read from the shadow, the source of truth
   *  for what's painted). */
  private get current(): ExpanderState {
    return this.summary.getAttribute('aria-expanded') === 'true' ? 'open' : 'closed'
  }

  connectedCallback() {
    this.syncDisabled()
    // Controlled → reflect `state`; uncontrolled → seed once from `default-state`.
    this.applyState(parseState(this.getAttribute(this.controlled ? 'state' : 'default-state')))
    if (this.hasAttribute('round')) this.startRoundObserver()
  }

  disconnectedCallback() {
    this.roundObserver?.disconnect()
  }

  attributeChangedCallback(name: string) {
    if (name === 'disabled') this.syncDisabled()
    // `state` is the controlled lever — reflect changes. When it's *removed*
    // (controlled → uncontrolled hand-off) `controlled` is false, so we skip and
    // the current applied state is kept, not reset.
    else if (name === 'state' && this.controlled) this.applyState(parseState(this.getAttribute('state')))
    // `round` toggled → start/stop measuring + publishing the radius var.
    else if (name === 'round') {
      if (this.hasAttribute('round')) this.startRoundObserver()
      else this.stopRoundObserver()
    }
  }

  private syncDisabled() {
    this.summary.disabled = this.hasAttribute('disabled')
  }

  /** Apply state to the shadow internals (idempotent; reads the host, writes
   *  only the shadow). `aria-expanded` is both the a11y signal and the CSS
   *  state hook; `inert` keeps collapsed content out of the tab order and the
   *  accessibility tree. */
  private applyState(state: ExpanderState) {
    const open = state === 'open'
    this.summary.setAttribute('aria-expanded', open ? 'true' : 'false')
    this.region.inert = !open
    // Mirror to the `:state(open)` custom state for external CSS hooks.
    try {
      if (open) this.internals?.states.add('open')
      else this.internals?.states.delete('open')
    } catch {}
  }

  /** Compute the requested next state, announce it (cancelable, *before*
   *  applying), then — uncontrolled only, and only if not vetoed — apply it.
   *  Controlled: never self-apply; the consumer answers via the `state`
   *  attribute. See STATEFUL-COMPONENTS.md. */
  private onSummaryClick = () => {
    const prev = this.current
    const next: ExpanderState = prev === 'open' ? 'closed' : 'open'
    const ok = this.dispatchEvent(
      new CustomEvent('statechange', { cancelable: true, detail: { next, prev } }),
    )
    if (this.controlled) return
    if (ok) this.applyState(next)
  }
}

export function register_a_expander() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-expander')) {
    customElements.define('a-expander', AExpanderElement)
  }
}

// Importing this module registers the element (granular entry point). The
// barrel re-exports it, so importing the barrel registers it too. Idempotent.
register_a_expander()
