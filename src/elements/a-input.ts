import { HTMLElementBase, SYNC_POPUP_ARIA, type PopupAriaRelations } from '../anta_helpers'
import {
  applyShadowAria,
  ariaAttributeProperty,
  SHADOW_ARIA_ATTRIBUTES,
  SHADOW_ARIA_ATTRIBUTE_SET,
  type ShadowAriaAttribute,
} from './shadow-aria'
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
 *   <slot class="label" part="label" name="label">         ← display:none until a label is slotted
 *   <div class="field" part="field">                        ← the bordered box; :focus-within ring
 *     <slot name="leading" part="leading">
 *     <input|textarea|button part="input">                  ← created in JS per field mode
 *     <slot name="trailing" part="trailing">
 *   <slot class="hint" part="hint" name="hint">           ← message; the JSX wrapper may slot a status <Icon> here too when [status]
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
 * ## Declarative DOM and ARIA delegation
 *
 * Standard `role` / `aria-*` values are consumed from the host and moved to the
 * native shadow control so assistive technology sees one focused field. The
 * element intercepts attribute and ARIAMixin property removal, keeping reactive
 * updates in sync after the visible host attribute has been consumed. Other
 * host state remains declarative. Filled / invalid (status="critical") use
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

// --- Keyboard-vs-pointer focus tracking (a hand-rolled `:focus-visible` for the
// read-only field) ---
// Chromium reports `:focus-visible` as true for a focused <input> even on a mouse
// click, so CSS alone can't tell a read-only trigger's keyboard focus from a
// pointer one. We track the last interaction ourselves — the same heuristic the
// platform uses natively for buttons — and expose it via the off-DOM
// `:state(kb-focus)` custom state, which the read-only focus-ring rule keys on.
// Read-only iff `readonly` is present; editable fields ignore the state and ring
// on plain `:focus` (you clicked in to type). One passive listener pair per
// document (WeakSet-guarded), read-only — no DOM mutation.
let focusFromKeyboard = false
const modalityDocs = new WeakSet<Document>()
function trackFocusModality(doc: Document) {
  if (modalityDocs.has(doc)) return
  modalityDocs.add(doc)
  doc.addEventListener('keydown', () => { focusFromKeyboard = true }, true)
  doc.addEventListener('pointerdown', () => { focusFromKeyboard = false }, true)
}

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
// "no comments inside shadow-<style> strings" rule in AGENTS.md).
//
// Styling notes (what the rules below do, by region):
//  • :host — a grid of the three ::part regions (label / field / hint) in one
//    column with a 4px row rhythm; consumers can re-place/resize them (label on
//    the left, a shared label column via subgrid, …). An empty label/hint is
//    display:none, so it contributes no track or gap. The host's own focus
//    outline is suppressed (delegatesFocus can ring it) — the field ring is the
//    single indicator. --_fs/--_lh are the size-driven type scale (small 13/16 ·
//    medium 15/20 · large 17/22); label, control, and hint all read them.
//  • .field — min-height (24/28/32) matches the same-size Button. The border is a
//    box-shadow (inset), not a real border, so the rest→status width bump
//    (0.5px→1px, thickened for emphasis; color from a-input.css per-status
//    tokens) never reflows. Forced-colors supplies a real system border because
//    it suppresses shadows. The focus ring shows only when the *control* is
//    focused (:has), not when a slotted button holds focus.
//  • input / textarea — only the control carries the horizontal text inset; edge
//    slots + clear sit flush. appearance:none and the ::-webkit/::-ms resets strip
//    browser-injected affordances (search clear/spinners/Edge reveal) — Anta owns
//    every in-field control. --_pad-block (on .field, shared with the multiline
//    adornment boxes below) is the single source for the textarea's vertical
//    padding; the autogrow cap (:host([maxrows]:not([rows]))) is computed from
//    --_lh + that padding so it tracks size, with JS injecting only the --_maxrows
//    integer. A fixed `rows` turns autogrow off, so the cap doesn't apply.
//    A readonly single-line input shows an ellipsis for an overflowing value
//    (text-overflow: ellipsis), so the Select trigger reads a long value as `name …`
//    instead of a hard clip. Editable inputs keep the default clip (caret needs the
//    scrolled end); textarea wraps, so neither applies there. Font stretch and style
//    are normalized with standard properties because the UA form-control `font`
//    shorthand can otherwise give the control different metrics from its label,
//    hint, and pre-upgrade skeleton. Variation settings explicitly inherit the
//    active theme's axis pin because Safari does not reliably carry it into form
//    controls on its own.
//  • slots — leading/trailing are display:none until they hold content. A slotted
//    clear button reserves its space even while invisible, so showing the button
//    does not add width. The host stylesheet derives
//    named-slot presence with `:has(> [slot])` and styles the matching part.
//    Adornments are muted (--input-adornment) and inherit currentColor; a slotted
//    <a-button> keeps its own color. Slotted TEXT gets the field's type scale
//    (--_fs/--_lh) plus a condensed wdth 88, so a key prefix lines up with the value
//    and reads as a compact label; icons carry their own explicit size + width.
//    `dim-actions` rests them at 0.6 and brightens
//    to full on field hover/focus — but never while disabled. The clear slot shows
//    only when filled + editable (hidden when disabled/readonly). A leading item is
//    inset to line up with the text's left rhythm. Single-line, adornments center
//    in the one-line field; multiline, they top-anchor in a one-line-tall box
//    (--_lh + 2·--_pad-block) so they stay centered on the first text line — same
//    vertical position as single-line, no jump when `multiline` toggles.
//  • .hint — reads quieter (1px smaller, tighter line, --input-hint), 1px off the
//    left edge; a status recolors the whole row (message + glyph) via the
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

  .field {
    --_bc: var(--input-border);
    --_bw: 0.5px;
    --_pad-block: 4px;

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
  :host([status]:not([status="neutral"])) .field { --_bw: 1px; }
  :host([size="small"]) { --_fs: 13px; --_lh: 16px; }
  :host([size="large"]) { --_fs: 17px; --_lh: 22px; }
  :host([size="small"]) .field { min-height: 24px; }
  :host([size="large"]) .field { min-height: 32px; }
  :host([round]) .field { border-radius: var(--input-round, 999px); }

  @media (hover: hover) and (pointer: fine) {
    :host(:not(:disabled)) .field:hover { --_bw: 1px; }
  }
  :host(:not([readonly])) .field:has(input:focus, textarea:focus, button:focus-visible),
  :host([readonly]:state(kb-focus)) .field {
    --_bw: 1px;
    outline: 1px solid var(--focus-ring);
    outline-offset: 1px;
  }
  @media (forced-colors: active) { .field { border: 1px solid ButtonBorder; } }

  input, textarea, button {
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
    font-stretch: normal;
    font-style: normal;
    font-variation-settings: inherit;
    font-size: var(--_fs);
    line-height: var(--_lh);
    font-weight: 400;
    -webkit-appearance: none;
            appearance: none;
  }
  textarea {
    resize: none;
    padding-block: var(--_pad-block);
    overflow-y: auto;
  }
  button { text-align: start; white-space: nowrap; overflow: hidden; cursor: pointer; }
  button.placeholder { color: var(--input-placeholder); }
  :host([maxrows]:not([rows])) textarea {
    max-height: calc(var(--_lh) * var(--_maxrows) + var(--_pad-block) * 2);
  }
  input::placeholder, textarea::placeholder { color: var(--input-placeholder); opacity: 1; }
  input:disabled, textarea:disabled, button:disabled { cursor: not-allowed; }
  :host([readonly]:not([disabled])) .field,
  :host([readonly]:not([disabled])) input,
  :host([readonly]:not([disabled])) textarea { cursor: pointer; }
  :host([readonly]:not([disabled])) input { text-overflow: ellipsis; }
  input::-webkit-search-cancel-button,
  input::-webkit-search-decoration,
  input::-webkit-search-results-button,
  input::-webkit-search-results-decoration,
  input::-webkit-inner-spin-button,
  input::-webkit-outer-spin-button { -webkit-appearance: none; appearance: none; display: none; }
  input::-ms-clear, input::-ms-reveal { display: none; }

  slot[name="leading"], slot[name="trailing"] {
    display: none;
    color: var(--input-adornment);
    font-size: var(--_fs);
    line-height: var(--_lh);
    font-stretch: var(--_input-adornment-font-stretch, normal);
  }
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

  slot[name="clear"] {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    visibility: hidden;
  }
  :host(:state(filled):not(:disabled):not([readonly])) slot[name="clear"] { visibility: visible; }

  :host([multiline]:state(filled)) slot[name="clear"] {
    align-self: flex-start;
    height: calc(var(--_lh) + var(--_pad-block) * 2);
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
`

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
const READ_DELEGATED_ARIA = Symbol('readDelegatedAria')
const WRITE_DELEGATED_ARIA = Symbol('writeDelegatedAria')

export class AInputElement extends HTMLElementBase {
  static formAssociated = true
  static observedAttributes = [
    ...FORWARDED, ...SHADOW_ARIA_ATTRIBUTES,
    'value', 'defaultvalue', 'multiline', 'button', 'rows', 'maxrows', 'status', 'disabled',
  ]

  private internals?: ElementInternals
  private field: HTMLDivElement
  private labelSlot: HTMLSlotElement
  private hintSlot: HTMLSlotElement
  private leadingSlot: HTMLSlotElement
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
  // Standard role/aria attributes are consumed from the neutral host and
  // applied to the native shadow control. The values live off-DOM so the host
  // does not become a second control in the accessibility tree.
  private delegatedAria = new Map<ShadowAriaAttribute, string>()
  private consumingAria = new Set<string>()
  private ariaApplyQueued = false
  // Direct element relationships supplied by an adjacent a-menu. These avoid
  // renderer-local IDs and apply only when the consumer has not authored the
  // corresponding ARIA relationship explicitly.
  private popupAriaSource?: Element
  private popupControls: Element | null = null
  private popupActiveDescendant: Element | null = null

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

    this.labelSlot = document.createElement('slot')
    this.labelSlot.className = 'label'
    this.labelSlot.setAttribute('part', 'label')
    this.labelSlot.name = 'label'
    // Clicking the (light-DOM) label focuses the (shadow) control — the native
    // <label for> association can't cross the boundary, so we wire it here.
    this.labelSlot.addEventListener('click', () => this.control?.focus())
    // Mirror the label's text into the control's aria-label unless an explicit
    // delegated name already exists.
    this.labelSlot.addEventListener('slotchange', this.onLabelSlotChange)

    this.field = document.createElement('div')
    this.field.className = 'field'
    this.field.setAttribute('part', 'field')
    this.leadingSlot = document.createElement('slot')
    this.leadingSlot.name = 'leading'
    this.leadingSlot.setAttribute('part', 'leading')
    const trailingSlot = document.createElement('slot')
    trailingSlot.name = 'trailing'
    trailingSlot.setAttribute('part', 'trailing')
    // The clear button is projected here (rightmost). The element gates its
    // visibility via shadow CSS off the filled state — see updateFilled.
    const clearSlot = document.createElement('slot')
    clearSlot.name = 'clear'
    clearSlot.setAttribute('part', 'clear')

    // Leading, then (control inserted after leading on build), then clear, then
    // trailing — so the clear button sits to the LEFT of any trailing actions.
    this.field.append(this.leadingSlot, clearSlot, trailingSlot)

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

    this.hintSlot = document.createElement('slot')
    this.hintSlot.className = 'hint'
    this.hintSlot.setAttribute('part', 'hint')
    this.hintSlot.name = 'hint'
    // Mirror the hint/error text into the control's aria-description (unless the
    // host already carries one) — IDREFs can't cross the shadow boundary, so the
    // string-valued aria-description is how the message reaches the focused
    // control. Same approach as the label → aria-label mirror above.
    this.hintSlot.addEventListener('slotchange', this.onHintSlotChange)
    // Default (unnamed) slot for projecting extra children. It sits *between*
    // the field and the hint, so a plain child renders directly under the field
    // and pushes the hint/error message down. A no-box child like an Anta
    // <a-tooltip> (display:contents, positioned popover) takes no vertical space
    // and just anchors to this host — mirroring how a shadow-less <a-button>
    // already accepts a tooltip child; the slot is what lets a shadow-DOM
    // element do the same.
    const extrasSlot = document.createElement('slot')

    shadow.append(style, this.labelSlot, this.field, extrasSlot, this.hintSlot)
  }

  /** Floating-element anchor protocol (see `anchorRect` in anta_helpers): point
   *  a menu / tooltip anchored to this input at the `.field` box, not the host —
   *  the host's box also spans the label and hint, which would push a dropdown
   *  below the hint or misalign a tooltip. */
  getAnchorRect(): DOMRect {
    return this.field.getBoundingClientRect()
  }

  connectedCallback() {
    trackFocusModality(this.doc)
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

  [SYNC_POPUP_ARIA](relations: PopupAriaRelations) {
    if (relations.clear) {
      if (this.popupAriaSource !== relations.source) return
      this.popupAriaSource = undefined
      this.popupControls = null
      this.popupActiveDescendant = null
    } else {
      this.popupAriaSource = relations.source
      if ('controls' in relations) this.popupControls = relations.controls ?? null
      if ('activeDescendant' in relations)
        this.popupActiveDescendant = relations.activeDescendant ?? null
    }
    this.applyPopupAria()
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null) {
    if (SHADOW_ARIA_ATTRIBUTE_SET.has(name)) {
      if (this.consumingAria.has(name)) return
      this.consumeAria(name as ShadowAriaAttribute, value)
      return
    }
    if (!this.ready && name !== 'value' && name !== 'defaultvalue') return
    if (name === 'multiline' || name === 'button' || name === 'rows' || name === 'maxrows') {
      if (!this.control) return
      const needTextarea = this.hasAttribute('multiline') || this.hasAttribute('rows')
      const isTextarea = this.control instanceof HTMLTextAreaElement
      const needButton = !needTextarea && this.hasAttribute('button')
      const isButton = this.control instanceof HTMLButtonElement
      // Only a real input<->textarea flip needs a rebuild; a rows/maxrows tweak
      // reconfigures the existing textarea in place so focus + caret survive.
      if (needTextarea !== isTextarea || needButton !== isButton) this.buildControl(this.value)
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
    if (this.control) {
      this.forward(name, value)
      this.syncButtonPresentation()
      this.updateValidity()
    }
  }

  /** Standard ARIA is the raw custom-element API, but its semantic target is the
   * native shadow field. Consume it synchronously so the host never remains a
   * duplicate control after upgrade. */
  private consumeAria(name: ShadowAriaAttribute, value: string | null) {
    if (value == null) this.delegatedAria.delete(name)
    else this.delegatedAria.set(name, value)
    if (this.hasAttribute(name)) {
      this.consumingAria.add(name)
      super.removeAttribute(name)
      this.consumingAria.delete(name)
    }
    this.applyDelegatedAria(name)
    this.queueDelegatedAria()
  }

  /** React/Preact may remove a prop after Anta has already consumed its host
   * attribute. Catch that no-op DOM removal so the shadow control still updates. */
  override removeAttribute(name: string) {
    if (SHADOW_ARIA_ATTRIBUTE_SET.has(name) && !this.consumingAria.has(name) && !this.hasAttribute(name)) {
      const ariaName = name as ShadowAriaAttribute
      if (this.delegatedAria.delete(ariaName)) {
        this.applyDelegatedAria(ariaName)
        this.queueDelegatedAria()
      }
      return
    }
    super.removeAttribute(name)
  }

  override toggleAttribute(name: string, force?: boolean): boolean {
    if (SHADOW_ARIA_ATTRIBUTE_SET.has(name)) {
      const ariaName = name as ShadowAriaAttribute
      const next = force ?? !this.delegatedAria.has(ariaName)
      this.consumeAria(ariaName, next ? '' : null)
      return next
    }
    return super.toggleAttribute(name, force)
  }

  [READ_DELEGATED_ARIA](name: ShadowAriaAttribute): string | null {
    return this.delegatedAria.get(name) ?? null
  }

  [WRITE_DELEGATED_ARIA](name: ShadowAriaAttribute, value: unknown) {
    this.consumeAria(name, value == null ? null : String(value))
  }

  private applyDelegatedAria(name: ShadowAriaAttribute) {
    const control = this.control
    if (!control) return
    applyShadowAria(this, control, name, this.delegatedAria.get(name) ?? null)
    if (name === 'aria-label' || name === 'aria-labelledby') this.applyLabelAria()
    if (name === 'aria-description' || name === 'aria-describedby') this.applyDescriptionAria()
    if (name === 'aria-invalid' && !this.delegatedAria.has(name)) this.syncStatus()
    if (name === 'aria-controls' || name === 'aria-activedescendant') this.applyPopupAria()
  }

  private queueDelegatedAria() {
    if (this.ariaApplyQueued) return
    this.ariaApplyQueued = true
    queueMicrotask(() => {
      this.ariaApplyQueued = false
      const control = this.control
      if (!control) return
      for (const [name, value] of this.delegatedAria) applyShadowAria(this, control, name, value)
    })
  }

  /** (Re)build the shadow control from the current attributes. */
  private buildControl(initial?: string) {
    // Preserve focus + caret across an input<->textarea rebuild (e.g. toggling
    // `multiline` mid-edit) so the user isn't kicked out of the field.
    const prev = this.control
    const refocus = prev != null && this.shadowRoot?.activeElement === prev
    let selStart: number | null = null
    let selEnd: number | null = null
    if (prev instanceof HTMLInputElement || prev instanceof HTMLTextAreaElement) {
      try { selStart = prev.selectionStart; selEnd = prev.selectionEnd } catch { /* number/email expose no selection */ }
    }

    const multiline = this.hasAttribute('multiline') || this.hasAttribute('rows')
    const button = !multiline && this.hasAttribute('button')
    const next = document.createElement(button ? 'button' : multiline ? 'textarea' : 'input') as Control
    if (next instanceof HTMLButtonElement) next.type = 'button'
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
    for (const [name, value] of this.delegatedAria) applyShadowAria(this, next, name, value)
    this.queueDelegatedAria()
    this.applyLabelAria()
    this.applyDescriptionAria()
    this.applyPopupAria()
    if (multiline) this.configureTextarea(next as HTMLTextAreaElement)

    const value = initial ?? this.pendingValue ?? this.getAttribute('value') ?? this.getAttribute('defaultvalue') ?? ''
    next.value = value
    this.syncButtonPresentation()

    next.addEventListener('input', this.onInput)
    next.addEventListener('change', this.onChange)
    next.addEventListener('focus', this.onFocus)
    next.addEventListener('blur', this.onBlur)

    if (refocus) {
      next.focus()
      if (selStart != null && (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement)) {
        try { next.setSelectionRange(selStart, selEnd ?? selStart) } catch { /* unsupported type */ }
      }
    }

    this.syncFormValue(value)
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
    if (c instanceof HTMLButtonElement) return
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

  private syncButtonPresentation() {
    const button = this.control
    if (!(button instanceof HTMLButtonElement)) return
    const value = button.value
    button.textContent = value || this.getAttribute('placeholder') || ''
    button.classList.toggle('placeholder', !value)
  }

  private syncFormValue(value: string) {
    // Button-backed Inputs are triggers rather than form fields. The native
    // button is type="button"; keep the form-associated host equally inert.
    this.internals?.setFormValue(this.control instanceof HTMLButtonElement ? null : value)
  }

  /** Reflect `status` into the control's `aria-invalid` and the `:state(invalid)`
   *  custom state. Called on `status` change AND from buildControl — so a field
   *  that mounts already `status="critical"` gets `:state(invalid)` on the FIRST
   *  paint (the status attributeChangedCallback fires before connect, while
   *  `ready` is false and the early-return skips it). */
  private syncStatus() {
    const critical = this.getAttribute('status') === 'critical'
    const explicit = this.delegatedAria.get('aria-invalid')
    this.control?.setAttribute('aria-invalid', explicit ?? (critical ? 'true' : 'false'))
    try { critical ? this.internals?.states?.add('invalid') : this.internals?.states?.delete('invalid') } catch {}
  }

  private onInput = (event: Event) => {
    const v = this.control?.value ?? ''
    this.syncFormValue(v)
    this.updateValidity()
    this.updateFilled()
    this.syncAutoHeight()
    // Most browsers compose native input events out of a shadow tree. Re-emit in
    // the ones that do not, so the host always exposes the native input contract.
    if (!event.composed) this.dispatchEvent(new Event('input', { bubbles: true }))
  }

  // `change` is not composed; re-emit one on the host so it escapes the shadow.
  private onChange = () => { this.dispatchEvent(new Event('change', { bubbles: true })) }

  // Stamp the off-DOM `:state(kb-focus)` when this focus arrived via the keyboard
  // (see `trackFocusModality`), so the read-only field's ring can draw for keyboard
  // focus but not a mouse click — the one distinction Chromium's `:focus-visible`
  // won't make for an <input>. Editable fields ignore the state (ring on `:focus`).
  private onFocus = () => {
    try {
      if (focusFromKeyboard) this.internals?.states?.add('kb-focus')
      else this.internals?.states?.delete('kb-focus')
    } catch { /* CustomStateSet unsupported */ }
  }
  private onBlur = () => {
    try { this.internals?.states?.delete('kb-focus') } catch { /* CustomStateSet unsupported */ }
  }

  private onLabelSlotChange = () => {
    this.applyLabelAria()
  }

  private applyLabelAria() {
    const c = this.control
    if (!c) return
    if (this.delegatedAria.has('aria-label') || this.delegatedAria.has('aria-labelledby')) return
    const text = this.labelSlot.assignedNodes().map((n) => n.textContent ?? '').join(' ').trim()
    if (text) c.setAttribute('aria-label', text)
    else c.removeAttribute('aria-label')
  }

  private onHintSlotChange = () => {
    this.applyDescriptionAria()
  }

  private applyDescriptionAria() {
    const c = this.control
    if (!c) return
    if (this.delegatedAria.has('aria-description') || this.delegatedAria.has('aria-describedby')) return
    const text = this.hintSlot.assignedNodes().map((n) => n.textContent ?? '').join(' ').trim()
    if (text) c.setAttribute('aria-description', text)
    else c.removeAttribute('aria-description')
  }

  private applyPopupAria() {
    const control = this.control
    if (!control) return
    try {
      if (!this.delegatedAria.has('aria-controls') && 'ariaControlsElements' in control)
        control.ariaControlsElements = this.popupControls ? [this.popupControls] : null
      if (!this.delegatedAria.has('aria-activedescendant') && 'ariaActiveDescendantElement' in control)
        control.ariaActiveDescendantElement = this.popupActiveDescendant
    } catch {
      // Direct ARIA element reflection is unavailable in older engines.
    }
  }

  private updateFilled() {
    if (this.value) this.internals?.states?.add('filled')
    else this.internals?.states?.delete('filled')
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
    this.syncButtonPresentation()
    this.syncFormValue(v)
    this.updateValidity()
    this.updateFilled()
    this.syncAutoHeight()
  }

  /** Focus the shadow control. `delegatesFocus` handles this in supporting
   * browsers; the explicit target keeps programmatic dialog autofocus reliable
   * everywhere. */
  focus(options?: FocusOptions) {
    this.control?.focus(options)
  }

  /** Clear the field and refocus it — fired by the wrapper's clear button.
   *  Dispatches `input` + `change` on the host so controlled consumers update. */
  clear() {
    if (!this.control) return
    this.control.value = ''
    this.syncButtonPresentation()
    this.syncFormValue('')
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
  set name(v: string) { this.setAttribute('name', v) }

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

// React 19 assigns properties that already exist on a custom element. Shadow
// the inherited ARIAMixin accessors so property writes use the same consumed,
// off-host channel as setAttribute/removeAttribute.
for (const name of SHADOW_ARIA_ATTRIBUTES) {
  Object.defineProperty(AInputElement.prototype, ariaAttributeProperty(name), {
    configurable: true,
    enumerable: true,
    get(this: AInputElement) { return this[READ_DELEGATED_ARIA](name) },
    set(this: AInputElement, value: unknown) { this[WRITE_DELEGATED_ARIA](name, value) },
  })
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
