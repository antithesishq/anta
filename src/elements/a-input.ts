import { HTMLElementBase } from '../anta_helpers'
import './a-input.css'

/**
 * `<a-input>` — a self-contained text field. The real `<input>` / `<textarea>`
 * lives in this element's **shadow DOM** (the element creates it), so consumers
 * never hand one in. This is Anta's first *stateful, form-associated* element:
 * it participates in native forms via `ElementInternals` and owns its value.
 *
 * Light-DOM composition (what the `<Input>` wrapper emits, or a vanilla author
 * writes by hand) is slot-based, like `<a-expander>`:
 *
 *   <a-input clearable>
 *     <span slot="label">Email</span>
 *     <a-icon slot="leading" shape="mail" />
 *     <a-button slot="trailing" …>     ← e.g. the clear button (wrapper-owned)
 *     <span slot="hint">We never share it.</span>
 *   </a-input>
 *
 * Shadow structure — every node carries a `part` so consumers can reach it
 * without piercing the boundary blindly:
 *
 *   <div class="label" part="label"><slot name="label">    ← display:none until filled
 *   <div class="field" part="field">                        ← the bordered box; :focus-within ring
 *     <slot name="leading" part="leading">
 *     <input|textarea part="input">                         ← created in JS per multiline/rows
 *     <slot name="trailing" part="trailing">
 *   <div class="hint" part="hint"><slot name="hint">       ← message; wrapper slots a status <Icon> here too when [status]
 *
 * ## Value — controlled vs uncontrolled (mirrors a native input)
 *
 * - **Uncontrolled**: omit `value`; pass `defaultvalue` for the initial text.
 *   The element owns the value; typing updates it and the form.
 * - **Controlled**: set the `value` attribute and keep it in sync. The element
 *   reflects it to the shadow control *only when it differs* from what's there,
 *   so the caret never jumps mid-edit.
 *
 * ## Events
 *
 * `input` is `composed` so it escapes the shadow on its own — consumers bind it
 * on the host and read `host.value`. `change` is NOT composed, so the element
 * catches the control's `change` and re-dispatches one on the host.
 *
 * ## Declarative-DOM safety
 *
 * Nothing on the *host* is ever mutated from JS (the host may be reconciled off
 * the UI thread). Filled / invalid (status="critical") are surfaced via
 * `ElementInternals` custom states (`:state(filled)`, `:state(invalid)`) —
 * element-internal, not host attributes — purely as styling hooks (the clear
 * button shows on
 * `:state(filled)`). All other writes target the shadow control the element
 * created, which is its own sanctioned territory.
 */

// Attributes copied straight through to the shadow control.
const FORWARDED = [
  'placeholder', 'type', 'name', 'autocomplete', 'inputmode',
  'maxlength', 'minlength', 'pattern', 'spellcheck', 'readonly', 'required',
  'min', 'max', 'step',
] as const
// Presence-based among the forwarded set (toggled, not value-copied).
const BOOL_FORWARDED = new Set(['readonly', 'required'])

// Internal trigger the clear button dispatches (via a-button's
// `data-custom-event`) when activated by click/Enter/Space — fired with no
// framework hydration needed. The element converts it into the public clear
// lifecycle (see the constructor listener): a cancelable `clearclick`, then —
// if not prevented — `clear()`, which empties the field and fires `clearinput`.
//
// CONTRACT: this string MUST stay in sync with the `data-custom-event` value
// the `<Input>` wrapper sets on its clear `<Button>` (src/components/Input.tsx).
// It's duplicated rather than shared because the wrapper can't import from this
// module without pulling in element registration (the tiers are decoupled, and
// importing here self-registers `a-input` + its CSS). Rename in both places.
const CLEAR_TRIGGER = 'clearrequest'

// Public clear events. Both bubble and are all-lowercase so they bind portably
// as `onclearclick` / `onclearinput` in React *and* Preact (React keeps the
// case after `on`; Preact lowercases) — same rule as `oninput`/`onchange`.
// `clearclick` fires first and is cancelable (preventDefault keeps the value);
// `clearinput` fires after the value has actually been cleared.
const CLEAR_CLICK_EVENT = 'clearclick'
const CLEAR_INPUT_EVENT = 'clearinput'

// `field-sizing: content` drives textarea autogrow declaratively where it's
// supported (Chrome/Edge, Safari ≥ 26.2). Detected once at module load. Where
// it's absent (Firefox, older Safari) the element falls back to a JS autogrow on
// every value change (see `syncAutoHeight`), so a multiline field still grows
// from one line instead of staying a single row. The CSS `max-height` cap
// applies in both paths, so `maxrows` is honored regardless.
const SUPPORTS_FIELD_SIZING =
  typeof CSS !== 'undefined' && !!CSS.supports?.('field-sizing', 'content')

// Shadow styles, injected verbatim into every <a-input> shadow root, so this
// string is kept COMMENT-FREE (it ships + re-injects per instance — see the
// "no comments inside shadow-<style> strings" rule in CLAUDE.md).
//
// Styling notes (what the rules below do, by region):
//  • :host — a grid of the three ::part regions (label / field / hint) in one
//    column with a 4px row rhythm; consumers can re-place/resize them (label on
//    the left, a shared label column via subgrid, …). An empty label/hint is
//    display:none, so it contributes no track or gap. The host's own focus
//    outline is suppressed (delegatesFocus can ring it) — the field ring is the
//    single indicator. --_fs/--_lh are the size-driven type scale (small 13/16 ·
//    medium 15/20 · large 17/24); label, control, and hint all read them.
//  • .field — min-height (24/28/32) matches the same-size Button. The border is a
//    box-shadow (inset), not a real border, so the rest→status width bump
//    (0.5px→1px, thickened for emphasis; colour from a-input.css per-status
//    tokens) never reflows. The focus ring shows only when the *control* is
//    focused (:has), not when a slotted button holds focus.
//  • input / textarea — only the control carries the horizontal text inset; edge
//    slots + clear sit flush. appearance:none and the ::-webkit/::-ms resets strip
//    browser-injected affordances (search clear/spinners/Edge reveal) — Anta owns
//    every in-field control. textarea's --_pad-block is the single source for its
//    vertical padding; the autogrow cap (:host([maxrows]:not([rows]))) is computed
//    from --_lh + that padding so it tracks size, with JS injecting only the
//    --_maxrows integer. A fixed `rows` turns autogrow off, so the cap doesn't apply.
//  • slots — leading/trailing/clear are display:none until they hold content
//    (toggled via slotchange), so an empty slot reserves no box or phantom gap.
//    Adornments are muted (--input-adornment) and inherit currentColor; a slotted
//    <a-button> keeps its own colour. `dim-actions` rests them at 0.6 and brightens
//    to full on field hover/focus — but never while disabled. The clear slot shows
//    only when filled + editable (hidden when disabled/readonly). A leading item is
//    inset to line up with the text's left rhythm.
//  • .hint — reads quieter (1px smaller, tighter line, --input-hint), 1px off the
//    left edge; a status recolours the whole row (message + glyph) via the
//    per-status --input-hint override in a-input.css.
const SHADOW_STYLE = `
  :host {
    --_fs: 15px;
    --_lh: 20px;

    display: grid;
    grid-template-columns: minmax(0, 1fr);
    row-gap: 4px;
    outline: none;
  }

  .label {
    display: none;
    color: var(--input-label);
    font-family: var(--sans-serif);
    font-size: var(--_fs);
    line-height: var(--_lh);
    font-weight: 500;
  }
  .label.has-label { display: block; }

  .field {
    --_bc: var(--input-border);
    --_bw: 0.5px;

    display: flex;
    align-items: center;
    box-sizing: border-box;
    min-height: 28px;
    background: var(--input-bg);
    border-radius: 4px;
    box-shadow: inset 0 0 0 var(--_bw) var(--_bc);
    transition: box-shadow 120ms ease;
  }
  :host([multiline]) .field { align-items: stretch; }
  :host([status]) .field { --_bw: 1px; }
  :host([size="small"]) { --_fs: 13px; --_lh: 16px; }
  :host([size="large"]) { --_fs: 17px; --_lh: 24px; }
  :host([size="small"]) .field { min-height: 24px; }
  :host([size="large"]) .field { min-height: 32px; }
  :host([round]) .field { border-radius: var(--input-round, 999px); }

  @media (hover: hover) and (pointer: fine) {
    :host(:not(:disabled)) .field:hover { --_bc: var(--input-border-hover); }
  }
  .field:has(input:focus, textarea:focus) {
    --_bc: var(--input-border-hover);
    outline: 1px solid var(--focus-ring);
    outline-offset: 1px;
  }
  /* A read-only field (e.g. the Select trigger) isn't typed into, so a mouse
     click shouldn't ring it — only keyboard focus (:focus-visible) does.
     Editable fields keep the ring on any focus. */
  :host([readonly]) .field:has(input:focus:not(:focus-visible), textarea:focus:not(:focus-visible)) {
    outline: none;
  }

  input, textarea {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    border: 0;
    margin: 0;
    padding-block: 0;
    padding-inline: 7px;
    background: transparent;
    outline: none;
    color: var(--input-text);
    font-family: var(--sans-serif);
    font-feature-settings: 'ss02', 'ss05', 'tnum';
    font-size: var(--_fs);
    line-height: var(--_lh);
    font-weight: 400;
    -webkit-appearance: none;
            appearance: none;
  }
  textarea {
    --_pad-block: 4px;

    resize: none;
    padding-block: var(--_pad-block);
    overflow-y: auto;
  }
  :host([maxrows]:not([rows])) textarea {
    max-height: calc(var(--_lh) * var(--_maxrows) + var(--_pad-block) * 2);
  }
  input::placeholder, textarea::placeholder { color: var(--input-placeholder); opacity: 1; }
  input:disabled, textarea:disabled { cursor: not-allowed; }
  :host([readonly]:not([disabled])) .field,
  :host([readonly]:not([disabled])) input,
  :host([readonly]:not([disabled])) textarea { cursor: pointer; }
  input::-webkit-search-cancel-button,
  input::-webkit-search-decoration,
  input::-webkit-search-results-button,
  input::-webkit-search-results-decoration,
  input::-webkit-inner-spin-button,
  input::-webkit-outer-spin-button { -webkit-appearance: none; appearance: none; display: none; }
  input::-ms-clear, input::-ms-reveal { display: none; }

  slot[name="leading"], slot[name="trailing"] { display: none; color: var(--input-adornment); }
  .field.has-leading slot[name="leading"],
  .field.has-trailing slot[name="trailing"] {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .field.has-trailing slot[name="trailing"] { gap: 2px; }

  :host([dim-actions]) slot[name="leading"],
  :host([dim-actions]) slot[name="trailing"],
  :host([dim-actions]) slot[name="clear"] {
    opacity: 0.6;
    transition: opacity 120ms ease;
  }
  :host([dim-actions]:not(:disabled)) .field:hover slot[name="leading"],
  :host([dim-actions]:not(:disabled)) .field:hover slot[name="trailing"],
  :host([dim-actions]:not(:disabled)) .field:hover slot[name="clear"],
  :host([dim-actions]:not(:disabled)) .field:focus-within slot[name="leading"],
  :host([dim-actions]:not(:disabled)) .field:focus-within slot[name="trailing"],
  :host([dim-actions]:not(:disabled)) .field:focus-within slot[name="clear"] {
    opacity: 1;
  }

  :host(:disabled) slot[name="leading"],
  :host(:disabled) slot[name="trailing"] { opacity: 0.5; pointer-events: none; }

  slot[name="clear"] { display: none; flex-shrink: 0; }
  .field.is-filled slot[name="clear"] { display: flex; align-items: center; }
  :host(:disabled) slot[name="clear"],
  :host([readonly]) slot[name="clear"] { display: none; }
  :host([multiline]) slot[name="clear"] { align-self: flex-start; }

  .field.has-leading slot[name="leading"] { margin-inline-start: 7px; }
  .field.has-leading input,
  .field.has-leading textarea { padding-inline-start: 5px; }
  :host([multiline]) .field.has-leading slot[name="leading"],
  :host([multiline]) .field.has-trailing slot[name="trailing"] {
    align-items: flex-start;
    padding-top: 2px;
  }

  .hint {
    display: none;
    gap: 4px;
    align-items: flex-start;
    padding-inline-start: 1px;
    color: var(--input-hint);
    font-family: var(--sans-serif);
    font-size: calc(var(--_fs) - 1px);
    line-height: calc(var(--_lh) - 2px);
  }
  .hint.has-hint { display: flex; }
`

type Control = HTMLInputElement | HTMLTextAreaElement

export class AInputElement extends HTMLElementBase {
  static formAssociated = true
  static observedAttributes = [
    ...FORWARDED, 'value', 'defaultvalue', 'multiline', 'rows', 'maxrows', 'status', 'disabled',
  ]

  private internals?: ElementInternals
  private field: HTMLDivElement
  private labelBox: HTMLDivElement
  private hintBox: HTMLDivElement
  private labelSlot: HTMLSlotElement
  private hintSlot: HTMLSlotElement
  private leadingSlot: HTMLSlotElement
  private trailingSlot: HTMLSlotElement
  private control?: Control
  // The intended value, captured even before the control exists (a framework
  // may set the `value` property before the element connects), so the initial
  // value isn't lost when the control is built.
  private pendingValue?: string
  // True between connect and the first control build, so attribute changes for
  // forwarded props don't try to touch a control that doesn't exist yet.
  private ready = false
  // Set by formDisabledCallback when an ancestor <fieldset disabled> / disabled
  // form turns the field off (the host can't carry a [disabled] attribute itself).
  private formDisabled = false

  constructor() {
    super()
    // Form association via ElementInternals. Guarded because the element may be
    // constructed in a non-standard runtime (a worker-rendered DOM, a partial
    // polyfill, or a custom runtime wired via `configure()`) where
    // `attachInternals` is missing, not callable, or throws. Degrade to no
    // form-association rather than break construction. Unlikely — this runs on
    // the web-component side — but cheap insurance; the rest of the element
    // already treats `internals` as optional.
    try {
      this.internals = this.attachInternals?.()
    } catch (err) {
      console.warn('a-input: ElementInternals unavailable — form association disabled.', err)
    }
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true })

    const style = document.createElement('style')
    style.textContent = SHADOW_STYLE

    this.labelBox = document.createElement('div')
    this.labelBox.className = 'label'
    this.labelBox.setAttribute('part', 'label')
    this.labelSlot = document.createElement('slot')
    this.labelSlot.name = 'label'
    this.labelBox.append(this.labelSlot)
    // Clicking the (light-DOM) label focuses the (shadow) control — the native
    // <label for> association can't cross the boundary, so we wire it here.
    this.labelSlot.addEventListener('click', () => this.control?.focus())
    // Mirror the label's text into the control's aria-label (unless the host
    // already carries one) so the shadow control has an accessible name.
    this.labelSlot.addEventListener('slotchange', this.onLabelSlotChange)

    this.field = document.createElement('div')
    this.field.className = 'field'
    this.field.setAttribute('part', 'field')
    this.leadingSlot = document.createElement('slot')
    this.leadingSlot.name = 'leading'
    this.leadingSlot.setAttribute('part', 'leading')
    this.trailingSlot = document.createElement('slot')
    this.trailingSlot.name = 'trailing'
    this.trailingSlot.setAttribute('part', 'trailing')
    // CSS can't express "slot has assigned nodes", so toggle a class per edge
    // slot — an empty slot then reserves no box and no phantom flex gap.
    this.leadingSlot.addEventListener('slotchange', () =>
      this.field.classList.toggle('has-leading', this.leadingSlot.assignedNodes().length > 0))
    this.trailingSlot.addEventListener('slotchange', () =>
      this.field.classList.toggle('has-trailing', this.trailingSlot.assignedNodes().length > 0))
    // The clear button is projected here (rightmost). The element gates its
    // visibility via shadow CSS off the filled state — see updateFilled.
    const clearSlot = document.createElement('slot')
    clearSlot.name = 'clear'
    clearSlot.setAttribute('part', 'clear')

    // Leading, then (control inserted after leading on build), then clear, then
    // trailing — so the clear button sits to the LEFT of any trailing actions.
    this.field.append(this.leadingSlot, clearSlot, this.trailingSlot)

    // The clear button (an <a-button data-custom-event="clearrequest"> in the
    // `clear` slot) fires CLEAR_TRIGGER on click/Enter/Space — without needing
    // the framework to hydrate. We turn that into the public lifecycle: a
    // cancelable `clearclick` first (a consumer's onClearClick may
    // preventDefault to keep the value), then clear() unless it was prevented.
    // clear() empties the field and dispatches input+change (+ clearinput) —
    // what a controlled consumer reacts to; an uncontrolled field is just
    // emptied. One path serves both.
    this.addEventListener(CLEAR_TRIGGER, () => {
      const proceed = this.dispatchEvent(
        new CustomEvent(CLEAR_CLICK_EVENT, { bubbles: true, cancelable: true }),
      )
      if (proceed) this.clear()
    })

    this.hintBox = document.createElement('div')
    this.hintBox.className = 'hint'
    this.hintBox.setAttribute('part', 'hint')
    this.hintSlot = document.createElement('slot')
    this.hintSlot.name = 'hint'
    // Mirror the hint/error text into the control's aria-description (unless the
    // host already carries one) — IDREFs can't cross the shadow boundary, so the
    // string-valued aria-description is how the message reaches the focused
    // control. Same approach as the label → aria-label mirror above.
    this.hintSlot.addEventListener('slotchange', this.onHintSlotChange)
    this.hintBox.append(this.hintSlot)

    // Default (unnamed) slot for projecting extra children. It sits *between*
    // the field and the hint, so a plain child renders directly under the field
    // and pushes the hint/error message down. A no-box child like an Anta
    // <a-tooltip> (display:contents, positioned popover) takes no vertical space
    // and just anchors to this host — mirroring how a shadow-less <a-button>
    // already accepts a tooltip child; the slot is what lets a shadow-DOM
    // element do the same.
    const extrasSlot = document.createElement('slot')

    shadow.append(style, this.labelBox, this.field, extrasSlot, this.hintBox)
  }

  /** Floating-element anchor protocol (see `anchorRect` in anta_helpers): point
   *  a menu / tooltip anchored to this input at the `.field` box, not the host —
   *  the host's box also spans the label and hint, which would push a dropdown
   *  below the hint or misalign a tooltip. */
  getAnchorRect(): DOMRect {
    return this.field.getBoundingClientRect()
  }

  connectedCallback() {
    // A `value` set as a property before the element upgraded shadows the
    // accessor as an own data property — re-apply it through the setter so the
    // initial controlled value isn't lost when the control is built.
    if (Object.prototype.hasOwnProperty.call(this, 'value')) {
      const v = (this as unknown as { value: string }).value
      delete (this as unknown as { value?: string }).value
      this.value = v
    }
    if (!this.control) this.buildControl()
    this.ready = true
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null) {
    if (!this.ready && name !== 'value' && name !== 'defaultvalue') return
    if (name === 'multiline' || name === 'rows' || name === 'maxrows') {
      if (!this.control) return
      const needTextarea = this.hasAttribute('multiline') || this.hasAttribute('rows')
      const isTextarea = this.control instanceof HTMLTextAreaElement
      // Only a real input<->textarea flip needs a rebuild; a rows/maxrows tweak
      // reconfigures the existing textarea in place so focus + caret survive.
      if (needTextarea !== isTextarea) this.buildControl(this.value)
      else if (this.control instanceof HTMLTextAreaElement) this.configureTextarea(this.control)
      return
    }
    if (name === 'status') { this.syncStatus(); this.updateValidity(); return }
    if (name === 'disabled') { this.syncDisabled(); return }
    // Controlled value: apply only when the attribute is PRESENT. Removing it
    // (controlled → uncontrolled) keeps the current text, like a native input —
    // the old `value ?? ''` wiped the field to empty on attribute removal.
    if (name === 'value') { if (value !== null) this.value = value; return }
    if (name === 'defaultvalue') return
    // Forwarded attribute changed — also re-run validity, since a constraint
    // (required / pattern / min / max / step / minlength / maxlength / type) can
    // flip the inner control's validity. Symmetric with the `status` branch.
    if (this.control) { this.forward(name, value); this.updateValidity() }
  }

  /** (Re)build the shadow control from the current attributes. */
  private buildControl(initial?: string) {
    // Preserve focus + caret across an input<->textarea rebuild (e.g. toggling
    // `multiline` mid-edit) so the user isn't kicked out of the field.
    const prev = this.control
    const refocus = prev != null && this.shadowRoot?.activeElement === prev
    let selStart: number | null = null
    let selEnd: number | null = null
    if (prev) try { selStart = prev.selectionStart; selEnd = prev.selectionEnd } catch { /* number/email expose no selection */ }

    const multiline = this.hasAttribute('multiline') || this.hasAttribute('rows')
    const next = document.createElement(multiline ? 'textarea' : 'input') as Control
    next.setAttribute('part', 'input')
    if (this.control) this.control.replaceWith(next)
    else this.leadingSlot.after(next)
    this.control = next

    for (const attr of FORWARDED) {
      if (next instanceof HTMLTextAreaElement && attr === 'type') continue
      this.forward(attr, this.getAttribute(attr))
    }
    this.syncDisabled()
    this.syncStatus()
    this.applyLabelAria()
    this.applyDescriptionAria()
    if (multiline) this.configureTextarea(next as HTMLTextAreaElement)

    const value = initial ?? this.pendingValue ?? this.getAttribute('value') ?? this.getAttribute('defaultvalue') ?? ''
    next.value = value

    next.addEventListener('input', this.onInput)
    next.addEventListener('change', this.onChange)

    if (refocus) {
      next.focus()
      if (selStart != null) try { next.setSelectionRange(selStart, selEnd ?? selStart) } catch { /* unsupported type */ }
    }

    this.internals?.setFormValue(value)
    this.updateValidity()
    this.updateFilled()
    this.syncAutoHeight() // size to the initial value (JS-fallback browsers)
  }

  /** Autogrow (no `rows`) via `field-sizing: content` — or the JS fallback where
   *  that's unsupported — capped by `maxrows`; a fixed `rows` count switches it
   *  off for a constant-height box. */
  private configureTextarea(ta: HTMLTextAreaElement) {
    const rows = this.getAttribute('rows')
    const maxrows = this.getAttribute('maxrows')
    if (rows != null) {
      ta.rows = Math.max(1, parseInt(rows, 10) || 1)
      ta.style.setProperty('field-sizing', 'fixed')
      ta.style.removeProperty('--_maxrows')
      ta.style.removeProperty('height') // drop any height the JS fallback set
    } else {
      ta.rows = 1
      // Native autogrow where supported; the JS fallback (syncAutoHeight) grows
      // it on every value change everywhere else. The cap lives in CSS
      // (max-height off --_lh + --_pad-block) and applies in both paths; JS only
      // feeds it the row count, which CSS can't read from the attribute.
      if (SUPPORTS_FIELD_SIZING) ta.style.setProperty('field-sizing', 'content')
      else ta.style.removeProperty('field-sizing')
      if (maxrows != null) ta.style.setProperty('--_maxrows', String(parseInt(maxrows, 10) || 1))
      else ta.style.removeProperty('--_maxrows')
      this.syncAutoHeight()
    }
  }

  /** Autogrow fallback for browsers without `field-sizing: content` (Firefox,
   *  Safari < 26.2). Grows the shadow textarea to fit its content; the CSS
   *  `max-height` cap (when `maxrows` is set) still clamps it and scrolls past.
   *  A no-op where `field-sizing` is supported, or when the field isn't
   *  autogrowing (fixed `rows`, or not a textarea) — those size via CSS. */
  private syncAutoHeight = () => {
    if (SUPPORTS_FIELD_SIZING) return
    const ta = this.control
    if (!(ta instanceof HTMLTextAreaElement) || this.getAttribute('rows') != null) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }

  private forward(name: string, value: string | null) {
    const c = this.control
    if (!c) return
    if (c instanceof HTMLTextAreaElement && name === 'type') return
    if (BOOL_FORWARDED.has(name)) c.toggleAttribute(name, value != null)
    else if (value == null) c.removeAttribute(name)
    else c.setAttribute(name, value)
  }

  private syncDisabled() {
    // Effective disabled = own `disabled` attribute OR an ancestor
    // `<fieldset disabled>` / disabled form (via formDisabledCallback). Using the
    // union means re-enabling the fieldset doesn't enable a field that's also
    // disabled by its own attribute.
    if (this.control) this.control.disabled = this.hasAttribute('disabled') || this.formDisabled
  }

  /** Reflect `status` into the control's `aria-invalid` and the `:state(invalid)`
   *  custom state. Called on `status` change AND from buildControl — so a field
   *  that mounts already `status="critical"` gets `:state(invalid)` on the FIRST
   *  paint (the status attributeChangedCallback fires before connect, while
   *  `ready` is false and the early-return skips it). */
  private syncStatus() {
    const critical = this.getAttribute('status') === 'critical'
    this.control?.setAttribute('aria-invalid', critical ? 'true' : 'false')
    try { critical ? this.internals?.states.add('invalid') : this.internals?.states.delete('invalid') } catch {}
  }

  private onInput = () => {
    const v = this.control?.value ?? ''
    this.internals?.setFormValue(v)
    this.updateValidity()
    this.updateFilled()
    this.syncAutoHeight()
    // `input` is composed — it reaches the host (and consumers) on its own.
  }

  // `change` is not composed; re-emit one on the host so it escapes the shadow.
  private onChange = () => { this.dispatchEvent(new Event('change', { bubbles: true })) }

  private onLabelSlotChange = () => {
    this.labelBox.classList.toggle('has-label', this.labelSlot.assignedNodes().length > 0)
    this.applyLabelAria()
  }

  private applyLabelAria() {
    const c = this.control
    if (!c) return
    if (this.hasAttribute('aria-label') || this.hasAttribute('aria-labelledby')) return
    const text = this.labelSlot.assignedNodes().map((n) => n.textContent ?? '').join(' ').trim()
    if (text) c.setAttribute('aria-label', text)
    else c.removeAttribute('aria-label')
  }

  private onHintSlotChange = () => {
    this.hintBox.classList.toggle('has-hint', this.hintSlot.assignedNodes().length > 0)
    this.applyDescriptionAria()
  }

  private applyDescriptionAria() {
    const c = this.control
    if (!c) return
    if (this.hasAttribute('aria-description') || this.hasAttribute('aria-describedby')) return
    const text = this.hintSlot.assignedNodes().map((n) => n.textContent ?? '').join(' ').trim()
    if (text) c.setAttribute('aria-description', text)
    else c.removeAttribute('aria-description')
  }

  private updateFilled() {
    const filled = !!this.value
    // Shadow-internal class gates the clear slot's visibility; the custom state
    // is the public CSS hook (`:state(filled)`).
    this.field.classList.toggle('is-filled', filled)
    try {
      if (filled) this.internals?.states.add('filled')
      else this.internals?.states.delete('filled')
    } catch {}
  }

  private updateValidity() {
    const c = this.control
    if (!this.internals || !c) return
    // Reflect the inner control's native constraints — valueMissing (from
    // `required`), typeMismatch (e.g. `type="email"`), patternMismatch,
    // tooShort/tooLong, … — onto the host so the surrounding <form> sees them.
    // An explicit `status="critical"` layers a customError on top when the
    // control is otherwise valid (so an app-level error still blocks submission).
    if (this.getAttribute('status') === 'critical' && c.validity.valid) {
      this.internals.setValidity({ customError: true }, 'Invalid value.', c)
    } else {
      this.internals.setValidity(c.validity, c.validationMessage, c)
    }
  }

  /** The current text value. Reading prefers the live control; before it's
   *  built, the pending/attribute value. */
  get value(): string {
    if (this.control) return this.control.value
    return this.pendingValue ?? this.getAttribute('value') ?? this.getAttribute('defaultvalue') ?? ''
  }
  set value(v: string) {
    this.pendingValue = v
    if (this.control && this.control.value !== v) this.control.value = v
    this.internals?.setFormValue(v)
    this.updateValidity()
    this.updateFilled()
    this.syncAutoHeight()
  }

  /** Clear the field and refocus it — fired by the wrapper's clear button.
   *  Dispatches `input` + `change` on the host so controlled consumers update. */
  clear() {
    if (!this.control) return
    this.control.value = ''
    this.internals?.setFormValue('')
    this.updateValidity()
    this.updateFilled()
    this.syncAutoHeight()
    this.dispatchEvent(new Event('input', { bubbles: true }))
    this.dispatchEvent(new Event('change', { bubbles: true }))
    this.dispatchEvent(new CustomEvent(CLEAR_INPUT_EVENT, { bubbles: true }))
    this.control.focus()
  }

  // --- Constraint-validation API, proxied from ElementInternals so the host
  //     behaves like a native form control (`el.checkValidity()`, `el.validity`). ---
  get validity(): ValidityState | undefined { return this.internals?.validity }
  get validationMessage(): string { return this.internals?.validationMessage ?? '' }
  get willValidate(): boolean { return this.internals?.willValidate ?? false }
  checkValidity(): boolean { return this.internals?.checkValidity() ?? true }
  reportValidity(): boolean { return this.internals?.reportValidity() ?? true }

  /** Form field name — mirrors the `name` attribute, like native `<input>.name`,
   *  so `el.name` works (e.g. keying validation messages by field in a form loop). */
  get name(): string { return this.getAttribute('name') ?? '' }

  // --- Form-associated callbacks ---
  formResetCallback() {
    this.value = this.getAttribute('defaultvalue') ?? ''
    // The setter updates form value / validity / filled but fires no events, so a
    // controlled consumer would never learn the field reset and would re-render
    // the stale value back. Emit input + change (matching clear()) so it re-syncs.
    this.dispatchEvent(new Event('input', { bubbles: true }))
    this.dispatchEvent(new Event('change', { bubbles: true }))
  }
  formDisabledCallback(disabled: boolean) { this.formDisabled = disabled; this.syncDisabled() }
  formStateRestoreCallback(state: string) { this.value = state ?? '' }
}

export function register_a_input() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-input')) {
    customElements.define('a-input', AInputElement)
  }
}

// Importing this module registers the element (granular entry point). The
// barrel re-exports it, so importing the barrel registers it too. Idempotent.
register_a_input()
