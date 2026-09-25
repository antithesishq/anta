import { HTMLElementBase, parseOpenState } from '../anta_helpers'
import './a-expander.css'

/**
 * `<a-expander>` is a disclosure with one shadow `<button>` summary and an
 * animated content region. The title slot and decorative indicator live inside
 * the button. The actions slot is its sibling, so actions have their own focus
 * stops and do not toggle the region.
 *
 * With `indicator-placement="end"`, the button uses the header's subgrid:
 * title, actions, and indicator occupy separate tracks. The actions slot paints
 * over the button in its track and receives pointer input there. The indicator
 * remains inside the button and is inert, so its track still activates the
 * summary. At the default start placement, the original 24px gutter, title
 * inset, and body alignment are preserved.
 *
 * A single custom indicator node rotates with state. Two assigned nodes marked
 * `data-when="closed"` and `data-when="open"` switch visibility instead. The
 * indicator subtree is inert and hidden from assistive technology; only the
 * summary button carries `aria-expanded`. The open state also appears as
 * `:state(open)` for consumer CSS.
 *
 * Uncontrolled mode reads `default-state` once and updates its own state.
 * Controlled mode reads `state` and only dispatches a cancelable `statechange`
 * request. The element changes shadow internals, never host attributes.
 */

const ANIM_MS = 200

// Controls a header click must NOT toggle on. A click inside the projected
// `title` bubbles to the summary <button> (the title slot lives inside it), so
// an interactive control sitting in the title would otherwise toggle the section
// on every activation. We refuse to toggle when the click originated on an Anta
// control — `a-button`/`a-checkbox`/`a-radio`/`a-radio-group`/`a-input`/
// `a-input-time`/`a-calendar`/`a-menu-item`/`a-tab`, which transitively covers
// Select / InputDate / InputAutocomplete (compose `a-input`), Menu (`a-menu-item`)
// and Tabs (`a-tab`) — on a wrapped anchor-button (`[data-anta][role="button"]`),
// on a native control, or on an explicit `[data-expander-ignore]` node. The
// decision is read synchronously by walking the composed path in the element
// itself, so it holds even when a consumer's own handlers run off the UI thread
// (the notebook renders this tree in a worker; a light-DOM `stopPropagation()`
// round-trips too late to beat the synchronous toggle). Same design as a-menu's
// dismiss contract. Actions never reach here — they're siblings of the button,
// so their clicks don't fire its click handler at all.
const INTERACTIVE_SELECTOR =
  'a-button,a-checkbox,a-radio,a-radio-group,a-input,a-input-time,a-calendar,a-menu-item,a-tab,[data-anta][role="button"],button,a[href],input,select,textarea,label,[contenteditable=""],[contenteditable="true"]'

// A disabled control is inert, so it shouldn't swallow the toggle — clicking a
// disabled control in the title toggles the section like the title text does.
// The three forms cover every control above: `:disabled` for native form
// controls AND form-associated custom elements (a-input/a-checkbox/a-calendar/
// a-input-time/a-radio-group, including an ancestor `<fieldset disabled>`);
// `[disabled]` for attribute-based custom controls (a-button/a-tab/a-menu-item/
// a-radio); `[aria-disabled="true"]` — the uniform signal every Anta wrapper
// sets when disabled (and what a loading button sets on its own).
const DISABLED_SELECTOR = ':disabled,[disabled],[aria-disabled="true"]'

/** True when this element should suppress the toggle for a click that hit it —
 *  an *enabled* interactive control, or an explicit opt-out marker. A disabled
 *  control is inert and does NOT suppress (its click toggles like the title
 *  text); the `[data-expander-ignore]` hatch always suppresses. */
function ignoresToggle(el: Element): boolean {
  if (el.matches('[data-expander-ignore]')) return true
  return el.matches(INTERACTIVE_SELECTOR) && !el.matches(DISABLED_SELECTOR)
}

const SHADOW_STYLE = `
  :host { display: block; }

  .header {
    display: flex;
    /* Stretch so the trigger button (and the actions row) fill the full host
       height — the title's hit area is the whole header, not just the text. */
    align-items: stretch;
  }

  :host([indicator-placement="end"]) .header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto var(--_expander-indicator-track);
  }

  slot[name="actions"] { display: none; }
  .header.has-actions slot[name="actions"] {
    display: flex;
    align-items: center;
    gap: var(--_expander-actions-gap);
    flex-shrink: 0;
    margin-inline-start: var(--_expander-actions-start);
    /* Inset from the right edge (the host has no padding of its own). */
    margin-inline-end: var(--_expander-actions-end);
  }
  :host([indicator-placement="end"]) .header.has-actions slot[name="actions"] {
    grid-column: 2;
    grid-row: 1;
    z-index: 1;
  }

  button {
    appearance: none;
    -webkit-appearance: none;
    background: none;
    border: none;
    margin: 0;
    /* The default button fills the header beside its actions. The title and
       body share --expander-gutter, and the indicator hangs inside that gutter.
       End placement switches to the header's subgrid. */
    position: relative;
    padding: var(--_expander-header-padding-block) var(--_expander-header-padding-end) var(--_expander-header-padding-block) var(--expander-gutter);
    flex: 1;
    min-width: 0;
    font: inherit;
    font-variation-settings: inherit;
    color: inherit;
    text-align: left;

    display: flex;
    align-items: center;
    gap: 0;
    cursor: pointer;
    user-select: text;
    border-radius: 2px;
    outline: none;
  }

  :host([indicator-placement="end"]) button {
    grid-column: 1 / -1;
    grid-row: 1;
    display: grid;
    grid-template-columns: subgrid;
    padding: var(--_expander-header-padding-block) 0;
  }
  :host([indicator-placement="end"]) slot[name="title"] {
    grid-column: 1;
    display: block;
    min-width: 0;
    margin-inline-start: var(--expander-gutter);
  }

  button:focus-visible {
    outline: 1px solid var(--focus-ring);
    outline-offset: 0px;
  }

  .indicator {
    position: absolute;
    inset-inline-start: var(--_expander-indicator-start);
    top: 50%;
    width: var(--_expander-indicator-size);
    height: var(--_expander-indicator-size);
    pointer-events: none;
    opacity: 0.6;
    transform: translateY(-50%);
    transition: transform 150ms ease, opacity 150ms ease;
  }
  .indicator slot { display: grid; place-items: center; width: 100%; height: 100%; }
  .indicator slot::slotted(*) { pointer-events: none; }
  .indicator .glyph {
    display: block;
    width: var(--_expander-indicator-size);
    height: var(--_expander-indicator-size);
    background-color: currentColor;
    -webkit-mask-image: var(--_expander-indicator-mask);
            mask-image: var(--_expander-indicator-mask);
    -webkit-mask-size: contain;
            mask-size: contain;
    -webkit-mask-repeat: no-repeat;
            mask-repeat: no-repeat;
    -webkit-mask-position: center;
            mask-position: center;
  }
  :host([indicator="plus"]) .indicator .glyph { position: relative; background: none; mask: none; -webkit-mask: none; }
  :host([indicator="plus"]) .indicator .glyph::before,
  :host([indicator="plus"]) .indicator .glyph::after {
    content: '';
    position: absolute;
    background: currentColor;
    border-radius: calc(var(--_expander-indicator-stroke) / 2);
  }
  :host([indicator="plus"]) .indicator .glyph::before {
    width: calc(var(--_expander-indicator-size) - 2 * var(--_expander-indicator-stroke));
    height: var(--_expander-indicator-stroke);
    left: var(--_expander-indicator-stroke);
    top: calc((var(--_expander-indicator-size) - var(--_expander-indicator-stroke)) / 2);
  }
  :host([indicator="plus"]) .indicator .glyph::after {
    width: var(--_expander-indicator-stroke);
    height: calc(var(--_expander-indicator-size) - 2 * var(--_expander-indicator-stroke));
    left: calc((var(--_expander-indicator-size) - var(--_expander-indicator-stroke)) / 2);
    top: var(--_expander-indicator-stroke);
    transition: transform 150ms ease;
  }
  button:enabled:hover .indicator { opacity: 1; }
  button[aria-expanded="true"] .indicator { transform: translateY(-50%) rotate(90deg); opacity: 1; }
  :host([indicator="plus"]) button[aria-expanded="true"] .indicator,
  button[aria-expanded="true"] .indicator.has-pair { transform: translateY(-50%); }
  :host([indicator="plus"]) button[aria-expanded="true"] .glyph::after { transform: scaleY(0); }
  button[aria-expanded="false"] slot[name="indicator"]::slotted([data-when="open"]),
  button[aria-expanded="true"] slot[name="indicator"]::slotted([data-when="closed"]) { display: none; }

  :host([indicator-placement="end"]) .indicator {
    position: static;
    grid-column: 3;
    grid-row: 1;
    justify-self: end;
    align-self: center;
    margin-inline-end: var(--_expander-indicator-edge);
    transform: rotate(90deg);
  }
  :host([indicator-placement="end"]) button[aria-expanded="true"] .indicator { transform: rotate(270deg); }
  :host([indicator-placement="end"]) .indicator.has-custom,
  :host([indicator-placement="end"]) .indicator.has-pair { transform: none; }
  :host([indicator-placement="end"][indicator="plus"]) .indicator { transform: none; }
  :host([indicator-placement="end"]) button[aria-expanded="true"] .indicator.has-custom { transform: rotate(180deg); }
  :host([indicator-placement="end"]) button[aria-expanded="true"] .indicator.has-pair,
  :host([indicator-placement="end"][indicator="plus"]) button[aria-expanded="true"] .indicator { transform: none; }

  button:enabled:hover { color: var(--expander-text-hover); }
  :host([priority="tertiary"]) button:enabled:hover { --_summary-underline: underline; }
  button:enabled:active { color: var(--expander-text); }
  button:disabled { cursor: default; }
  button:enabled:not([aria-expanded="true"]):active .indicator {
    opacity: 0.6;
  }
  @media (prefers-reduced-motion: reduce) {
    .indicator, :host([indicator="plus"]) .indicator .glyph::after { transition: none; }
  }

  .region {
    display: grid;
    grid-template-rows: 0fr;
    grid-template-columns: minmax(0, 1fr);
  }
  .header:has(button[aria-expanded="true"]) + .region { grid-template-rows: 1fr; }

  /* The transparent tertiary border still insets the content by 1px. Pull the
     header and region back so outdent lands flush with surrounding content. */
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
// Shared open-state parser (also used by a-dialog) — one definition of how the
// `open`/`closed` token is read, so the two contracts can't drift.
const parseState = parseOpenState

export class AExpanderElement extends HTMLElementBase {
  static observedAttributes = ['state', 'disabled', 'round']

  private summary: HTMLButtonElement
  private titleSlot: HTMLSlotElement
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
  // (`:state(open)`) for consumer styling, including the indicator. It's NOT a host
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
    // The summary and indicator have separate parts for consumer styling.
    this.summary.setAttribute('part', 'summary')
    const titleSlot = document.createElement('slot')
    titleSlot.name = 'title'
    this.titleSlot = titleSlot
    const indicator = document.createElement('span')
    indicator.className = 'indicator'
    indicator.setAttribute('part', 'indicator')
    indicator.setAttribute('aria-hidden', 'true')
    indicator.inert = true
    const indicatorSlot = document.createElement('slot')
    indicatorSlot.name = 'indicator'
    const glyph = document.createElement('span')
    glyph.className = 'glyph'
    indicatorSlot.append(glyph)
    indicatorSlot.addEventListener('slotchange', () => {
      const assigned = indicatorSlot.assignedElements()
      const hasPair = assigned.some(el => el.hasAttribute('data-when'))
      indicator.classList.toggle('has-custom', assigned.length > 0 && !hasPair)
      indicator.classList.toggle('has-pair', hasPair)
    })
    indicator.append(indicatorSlot)
    this.summary.append(titleSlot, indicator)
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
  get #controlled(): boolean {
    return this.hasAttribute('state')
  }

  /** The currently *applied* state (read from the shadow, the source of truth
   *  for what's painted). */
  get #current(): ExpanderState {
    return this.summary.getAttribute('aria-expanded') === 'true' ? 'open' : 'closed'
  }

  connectedCallback() {
    this.syncDisabled()
    // Controlled → reflect `state`; uncontrolled → seed once from `default-state`.
    this.applyState(parseState(this.getAttribute(this.#controlled ? 'state' : 'default-state')))
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
    else if (name === 'state' && this.#controlled) this.applyState(parseState(this.getAttribute('state')))
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
      if (open) this.internals?.states?.add('open')
      else this.internals?.states?.delete('open')
    } catch {}
  }

  /** Refuse to toggle when the click landed on a control inside the projected
   *  title — walk the composed path up to (not including) the summary button and
   *  test each element with `ignoresToggle` (enabled interactive control or the
   *  opt-out marker). Synchronous and read here in the element, so it stands in
   *  off-UI-thread runtimes. Suppressing before the dispatch also keeps a
   *  *controlled* consumer from toggling (no `statechange` fires). */
  #clickIgnoresToggle(e: Event): boolean {
    const path = e.composedPath()
    const end = path.indexOf(this.summary)
    const scope = end === -1 ? path : path.slice(0, end)
    return scope.some((n) => n instanceof Element && ignoresToggle(n))
  }

  /** A selection that reaches projected title content came from a drag. Keep it
   *  selected instead of treating its release as an activation. */
  #titleHasSelection(): boolean {
    const selection = this.ownerDocument.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false
    const range = selection.getRangeAt(0)
    return this.titleSlot.assignedNodes().some((node) => range.intersectsNode(node))
  }

  /** Compute the requested next state, announce it (cancelable, *before*
   *  applying), then — uncontrolled only, and only if not vetoed — apply it.
   *  Controlled: never self-apply; the consumer answers via the `state`
   *  attribute. See STATEFUL-COMPONENTS.md. */
  private onSummaryClick = (e: MouseEvent) => {
    // A keyboard-initiated click has detail 0 and should always retain normal
    // button activation, even if text happens to be selected.
    if (this.#clickIgnoresToggle(e) || (e.detail !== 0 && this.#titleHasSelection())) return
    const prev = this.#current
    const next: ExpanderState = prev === 'open' ? 'closed' : 'open'
    const ok = this.dispatchEvent(
      new CustomEvent('statechange', { cancelable: true, detail: { next, prev } }),
    )
    if (this.#controlled) return
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
