import { HTMLElementBase } from '../anta_helpers'
import './a-input-time.css'

/**
 * `<a-input-time>` — a segmented wall-clock time field. One visual box (matching
 * `<a-input>`'s chrome) holding separate **hour** / **minute** / (12-hour only)
 * **AM-PM** sections that behave as one control. Each editable section is an
 * ordinary native text input in the element's shadow DOM; the `:` (or the
 * locale's separator) between them is inert text.
 *
 * This follows the cross-system segmented-field model while letting native inputs
 * own caret, selection, paste, and mobile keyboard behavior. The element owns
 * cross-segment focus, increment/wrap, and digit auto-advance — coordination that
 * needs a live element, so it lives here (the wrapper holds no DOM ref) and only
 * ever mutates its OWN shadow nodes, never the host or light DOM (worker-safe,
 * per AGENTS.md).
 *
 * Localization is derived from `Intl`: the clock (12h vs 24h) from the resolved
 * `hourCycle`, the segment ORDER + separator + whether an AM/PM segment exists at
 * all from `formatToParts` (Japanese puts the period first, Finnish separates with
 * a dot, 24-hour locales omit AM/PM). `hour12` overrides the locale default.
 *
 * ## Value
 * A 24-hour `"HH:mm"` string (form-submitted via `ElementInternals`), `''` when
 * incomplete. Controlled via the `value` attribute, uncontrolled via `defaultvalue`.
 *
 * ## Declarative-DOM safety
 * The host is never mutated from JS. Per-segment input state and the
 * `:state(filled)` / `:state(invalid)` hooks are set shadow-internal (the element's
 * own territory) or off-DOM via `ElementInternals` — never on the host or light DOM.
 */

// Slots forwarded straight through (same set a-input accepts, minus the ones
// that only make sense for a free-text control).
const FORWARDED = ['name', 'aria-label', 'required'] as const

// Kept in sync with the `data-custom-event` the `<InputTime>` wrapper sets on its
// clear <Button> (mirrors a-input's CLEAR_TRIGGER; duplicated, not shared, because
// the wrapper can't import this module without self-registering the element).
const CLEAR_TRIGGER = 'clearrequest'
const CLEAR_INPUT_EVENT = 'clearinput'

const pad2 = (n: number) => String(n).padStart(2, '0')
// Native input `size` counts Latin-character columns. East Asian wide glyphs
// occupy two columns, so account for them when sizing locale day-period inputs.
const inputColumns = (value: string) => Array.from(value).reduce((columns, char) =>
  columns + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︐-﹯！-｠￠-￦]/u.test(char) ? 2 : 1), 0)
// A 12-hour display hour (1–12) + meridiem → the canonical 0–23 hour.
const to24 = (h12: number, period: 'am' | 'pm') =>
  period === 'pm' ? (h12 % 12) + 12 : h12 % 12

type SegKind = 'hour' | 'minute' | 'period'

interface Seg {
  kind: SegKind
  el: HTMLInputElement
  min: number
  max: number
}

// Shadow styles — injected verbatim per instance, so KEPT COMMENT-FREE (the
// rationale lives here in TS). Mirrors a-input's label / field / hint chrome so
// the box reads as one of the other inputs; the segment row replaces the control.
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
    color: var(--input-time-label);
    font-family: var(--sans-serif);
    font-size: var(--_fs);
    line-height: var(--_lh);
    font-weight: 500;
  }
  .label.has-label { display: block; }

  .field {
    --_bc: var(--input-time-border);
    --_bw: 0.5px;

    display: flex;
    align-items: center;
    box-sizing: border-box;
    min-height: 28px;
    background: var(--input-time-bg);
    border-radius: 4px;
    box-shadow: inset 0 0 0 var(--_bw) var(--_bc);
    transition: box-shadow 120ms ease;
  }
  :host([status]) .field { --_bw: 1px; }
  :host([size="small"]) { --_fs: 13px; --_lh: 16px; }
  :host([size="large"]) { --_fs: 17px; --_lh: 22px; }
  :host([size="small"]) .field { min-height: 24px; }
  :host([size="large"]) .field { min-height: 32px; }
  :host([round]) .field { border-radius: var(--input-time-round, 999px); }

  @media (hover: hover) and (pointer: fine) {
    :host(:not(:disabled)) .field:hover {
      --_bc: var(--input-time-border-hover);
      --_bw: 1px;
    }
  }
  .field:focus-within {
    --_bc: var(--input-time-border-hover);
    --_bw: 1px;
    outline: 1px solid var(--focus-ring);
    outline-offset: 1px;
  }
  @media (forced-colors: active) { .field { border: 1px solid ButtonBorder; } }

  slot[name="leading"] {
    display: none;
    color: var(--input-time-adornment);
    font-size: var(--_fs);
    line-height: var(--_lh);
  }
  .field.has-leading slot[name="leading"] {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-inline-start: 7px;
  }
  .field.has-leading .segments { padding-inline-start: 4px; }
  :host([dim-actions]) slot[name="leading"] { opacity: 0.6; transition: opacity 120ms ease; }
  :host([dim-actions]:not(:disabled)) .field:hover slot[name="leading"],
  :host([dim-actions]:not(:disabled)) .field:focus-within slot[name="leading"] { opacity: 1; }
  :host(:disabled) slot[name="leading"] { opacity: 0.5; pointer-events: none; }

  .segments {
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
    padding-inline: 7px;
    color: var(--input-time-text);
    font-family: var(--sans-serif);
    font-feature-settings: 'ss02', 'ss05', 'tnum';
    font-variation-settings: 'wdth' 100, 'slnt' 0, 'ital' 0;
    font-size: var(--_fs);
    line-height: var(--_lh);
    font-weight: 400;
  }

  .seg {
    appearance: none;
    display: inline-block;
    box-sizing: border-box;
    min-width: 0;
    padding-inline: 1px;
    border: 0;
    border-radius: 2px;
    background: transparent;
    color: inherit;
    font: inherit;
    line-height: inherit;
    text-align: center;
    white-space: nowrap;
    outline: none;
    cursor: text;
    font-variant-numeric: tabular-nums;
  }
  .seg--period {
    /* Native inputs otherwise size from their size attribute, whose character
       columns can't account for locale glyph widths. Content sizing keeps the
       segment flush with its displayed AM/PM text. */
    field-sizing: content;
    width: auto;
    color: var(--text-3);
  }
  .seg::placeholder {
    color: var(--input-time-placeholder);
    opacity: 1;
  }
  .lit {
    margin-inline: -1px;
    white-space: pre;
    color: var(--input-time-text);
  }

  :host(:disabled) .segments { cursor: not-allowed; }
  :host(:disabled) .seg { cursor: not-allowed; }

  slot[name="trailing"] { display: none; }
  .field.has-trailing slot[name="trailing"] {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    color: var(--input-time-adornment);
    font-size: var(--_fs);
  }
  :host([dim-actions]) slot[name="trailing"],
  :host([dim-actions]) slot[name="clear"] { opacity: 0.6; transition: opacity 120ms ease; }
  :host([dim-actions]:not(:disabled)) .field:hover slot[name="trailing"],
  :host([dim-actions]:not(:disabled)) .field:hover slot[name="clear"],
  :host([dim-actions]:not(:disabled)) .field:focus-within slot[name="trailing"],
  :host([dim-actions]:not(:disabled)) .field:focus-within slot[name="clear"] { opacity: 1; }

  slot[name="clear"] {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    visibility: hidden;
  }
  .field.is-filled slot[name="clear"] { visibility: visible; }
  :host(:disabled) slot[name="clear"] { display: none; }

  .hint {
    display: none;
    gap: 4px;
    align-items: flex-start;
    padding-inline-start: 1px;
    color: var(--input-time-hint);
    font-family: var(--sans-serif);
    font-size: calc(var(--_fs) - 1px);
    line-height: calc(var(--_lh) - 2px);
  }
  .hint.has-hint { display: flex; }
`

// The shell never changes. Keeping it in one declarative template makes the
// slots, parts, and field composition visible together; locale-dependent
// segments are the only dynamic children, rendered into `.segments` below.
const INPUT_TIME_TEMPLATE = typeof document === 'undefined' ? undefined : (() => {
  const template = document.createElement('template')
  template.innerHTML = `
    <style>${SHADOW_STYLE}</style>
    <div class="label" part="label"><slot name="label"></slot></div>
    <div class="field" part="field">
      <slot name="leading" part="leading"></slot>
      <div class="segments" part="segments" role="group"></div>
      <slot name="clear" part="clear"></slot>
      <slot name="trailing" part="trailing"></slot>
    </div>
    <slot></slot>
    <div class="hint" part="hint"><slot name="hint"></slot></div>
  `
  return template
})()

export class AInputTimeElement extends HTMLElementBase {
  static formAssociated = true
  static observedAttributes = [
    ...FORWARDED, 'value', 'defaultvalue', 'locale', 'hour12', 'status', 'disabled', 'size', 'min', 'max',
  ]

  #internals?: ElementInternals
  #field: HTMLDivElement
  #labelBox: HTMLDivElement
  #labelSlot: HTMLSlotElement
  #hintBox: HTMLDivElement
  #hintSlot: HTMLSlotElement
  #leadingSlot: HTMLSlotElement
  #trailingSlot: HTMLSlotElement
  #segRow: HTMLDivElement
  #ready = false
  #formDisabled = false
  // True once a value arrived via the `value` property setter — so connect
  // doesn't re-seed from the (possibly empty) attribute and wipe it.
  #seeded = false
  // The canonical 24-hour "HH:mm" (or ''), kept in step with the segment state.
  // Mode-independent, so a locale / hour12 switch re-derives display from it
  // rather than from the now-stale display digits.
  #iso = ''

  // Segment state — display units: hour is 0–23 (24h) or 1–12 (12h); period is
  // independent so it can be set/shown before the hour is. Minute is 0–59.
  #hour: number | null = null
  #minute: number | null = null
  #period: 'am' | 'pm' | null = null
  #segs: Seg[] = []
  #literals: string[] = []
  // Pointer-focused inputs keep the browser's caret placement. Keyboard focus
  // selects the segment so a new value can be typed immediately.
  #pointerSegment?: HTMLInputElement

  constructor() {
    super()
    try {
      this.#internals = this.attachInternals?.()
    } catch (err) {
      console.warn('a-input-time: ElementInternals unavailable — form association disabled.', err)
    }
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true })
    // `document` is available whenever a custom element can be constructed. The
    // guard only keeps importing this module harmless in non-DOM environments.
    if (!INPUT_TIME_TEMPLATE) throw new Error('a-input-time requires a DOM document')
    shadow.append(INPUT_TIME_TEMPLATE.content.cloneNode(true))

    this.#labelBox = shadow.querySelector<HTMLDivElement>('.label')!
    this.#labelSlot = shadow.querySelector<HTMLSlotElement>('slot[name="label"]')!
    this.#labelSlot.addEventListener('click', () => this.#segs[0]?.el.focus())
    this.#labelSlot.addEventListener('slotchange', this.#onLabelSlotChange)

    this.#field = shadow.querySelector<HTMLDivElement>('.field')!
    this.#segRow = shadow.querySelector<HTMLDivElement>('.segments')!
    this.#field.addEventListener('mousedown', this.#onFieldMouseDown)
    this.#segRow.addEventListener('input', this.#onInput)
    this.#segRow.addEventListener('keydown', this.#onKeyDown)
    this.#segRow.addEventListener('focusin', this.#onFocusIn)
    this.#segRow.addEventListener('focusout', this.#onFocusOut)
    this.#segRow.addEventListener('paste', this.#onPaste)

    this.#leadingSlot = shadow.querySelector<HTMLSlotElement>('slot[name="leading"]')!
    this.#leadingSlot.addEventListener('slotchange', () =>
      this.#field.classList.toggle('has-leading', this.#leadingSlot.assignedNodes().length > 0))

    this.#trailingSlot = shadow.querySelector<HTMLSlotElement>('slot[name="trailing"]')!
    this.#trailingSlot.addEventListener('slotchange', () =>
      this.#field.classList.toggle('has-trailing', this.#trailingSlot.assignedNodes().length > 0))

    this.addEventListener(CLEAR_TRIGGER, () => this.clear())

    this.#hintBox = shadow.querySelector<HTMLDivElement>('.hint')!
    this.#hintSlot = shadow.querySelector<HTMLSlotElement>('slot[name="hint"]')!
    this.#hintSlot.addEventListener('slotchange', this.#onHintSlotChange)
  }

  getAnchorRect(): DOMRect {
    return this.#field.getBoundingClientRect()
  }

  connectedCallback() {
    if (Object.prototype.hasOwnProperty.call(this, 'value')) {
      // A `value` set as a property before upgrade shadows the accessor as an own
      // data property — re-apply it through the setter so it isn't lost.
      const v = (this as unknown as { value: string }).value
      delete (this as unknown as { value?: string }).value
      this.#seed(v)
    } else if (!this.#seeded) {
      // No value came in via the property setter (which sets `#seeded`), so take
      // the controlled `value` or the uncontrolled `defaultvalue` attribute.
      // Guarded so a property-set value isn't clobbered by an empty attribute.
      this.#seed(this.getAttribute('value') ?? this.getAttribute('defaultvalue') ?? '')
    }
    this.#buildSegments()
    this.#ready = true
  }

  /** Seed the value state + canonical cache before the segments exist. */
  #seed(v: string) {
    this.#applyValue(v)
    this.#iso = this.value
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null) {
    if (!this.#ready) return
    // Route through the setter so form value / filled / validity stay in sync
    // (the setter touches only shadow + ElementInternals, never the host).
    if (name === 'value') { if (value !== null) this.value = value; return }
    if (name === 'defaultvalue') return
    if (name === 'locale' || name === 'hour12') { this.#buildSegments(); return }
    if (name === 'status') { this.#syncStatus(); return }
    if (name === 'disabled') { this.#syncDisabled(); return }
    if (name === 'size') return
    if (name === 'min' || name === 'max') {
      // A tighter bound can put the current value out of range — re-clamp it and
      // refresh form value / validity WITHOUT dispatching a user `input` (this is
      // a programmatic attribute change; firing `input` here would re-enter the
      // consumer's handler synchronously during a React commit).
      this.#clampIfComplete()
      this.#iso = this.value
      this.#render()
      this.#internals?.setFormValue(this.value)
      this.#updateFilled()
      this.#updateValidity()
      return
    }
    // Forwarded (name / aria-label / required) → the group container for a11y.
    if (name === 'aria-label') { this.#applyGroupLabel(); return }
    if (name === 'required') { this.#updateValidity(); return }
  }

  // --- Locale-driven segment construction ---

  get #locale(): string {
    return this.getAttribute('locale') || (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
  }
  get #hour12(): boolean {
    const attr = this.getAttribute('hour12')
    if (attr === 'true') return true
    if (attr === 'false') return false
    try {
      const hc = new Intl.DateTimeFormat(this.#locale, { hour: 'numeric' }).resolvedOptions().hourCycle
      return hc === 'h11' || hc === 'h12'
    } catch {
      return false
    }
  }

  /** Rebuild the segment row from the locale: order, separators, and whether an
   *  AM/PM segment exists all come from `Intl.formatToParts`. Preserves the
   *  current value across a rebuild (e.g. locale/hour12 change). */
  #buildSegments() {
    const hour12 = this.#hour12
    const locale = this.#locale
    // Preserve the value across a rebuild (locale / hour12 change): re-derive the
    // display units in the new mode from the mode-independent canonical cache —
    // NOT from `this.value`, which would read the stale display digits through
    // the new mode and corrupt the time.
    const keep = this.#iso
    // Reference times: 1:05 for the AM marker, 13:05 for PM, so formatToParts
    // yields the day-period part + the locale's ordering and separators.
    let parts: Intl.DateTimeFormatPart[] = []
    let amText = 'AM'
    let pmText = 'PM'
    try {
      const fmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: 'numeric', hour12 })
      parts = fmt.formatToParts(new Date(2000, 0, 1, 13, 5))
      const am = fmt.formatToParts(new Date(2000, 0, 1, 1, 5)).find((p) => p.type === 'dayPeriod')
      const pm = parts.find((p) => p.type === 'dayPeriod')
      if (am?.value) amText = am.value
      if (pm?.value) pmText = pm.value
    } catch {
      parts = [
        { type: 'hour', value: '13' }, { type: 'literal', value: ':' }, { type: 'minute', value: '05' },
      ]
    }

    // Stash the resolved day-period strings before creating their input so its
    // maxlength and placeholder follow the active locale.
    this.#amText = amText
    this.#pmText = pmText
    this.#segRow.replaceChildren()
    this.#segs = []
    this.#literals = []
    for (const part of parts) {
      if (part.type === 'hour' || part.type === 'minute' || part.type === 'dayPeriod') {
        const el = document.createElement('input')
        const kind: SegKind = part.type === 'dayPeriod' ? 'period' : part.type
        el.className = `seg seg--${kind}`
        el.type = 'text'
        el.spellcheck = false
        el.setAttribute('part', 'segment')
        el.autocomplete = 'off'
        el.autocorrect = false
        el.autocapitalize = 'off'
        el.setAttribute('aria-label', kind === 'hour' ? 'Hour' : kind === 'minute' ? 'Minute' : 'AM/PM')
        el.inputMode = kind === 'period' ? 'text' : 'numeric'
        if (kind === 'period') {
          const length = Math.max(2, inputColumns(this.#amText), inputColumns(this.#pmText))
          el.maxLength = length
          el.size = length
        } else {
          el.maxLength = 2
          el.size = 2
        }
        const seg: Seg =
          kind === 'hour'
            ? { kind, el, min: hour12 ? 1 : 0, max: hour12 ? 12 : 23 }
            : kind === 'minute'
              ? { kind, el, min: 0, max: 59 }
              : { kind, el, min: 0, max: 1 }
        this.#segRow.append(el)
        this.#segs.push(seg)
      } else {
        // Numeric inputs include their own inline padding, so a whitespace-only
        // locale literal adds no useful separation and can make the row too wide.
        if (!part.value.trim()) continue
        const lit = document.createElement('span')
        lit.className = 'lit'
        lit.setAttribute('aria-hidden', 'true')
        lit.textContent = part.value
        this.#segRow.append(lit)
        this.#literals.push(part.value)
      }
    }
    this.#applyValue(keep)
    this.#applyGroupLabel()
    this.#syncStatus()
    this.#syncDisabled()
    this.#render()
    // Sync the initial filled state (gates the clear button), form value, and
    // validity — a field mounted with a `defaultValue` is filled on the first
    // paint, not only after an edit.
    this.#internals?.setFormValue(this.value)
    this.#updateFilled()
    this.#updateValidity()
  }

  #amText = 'AM'
  #pmText = 'PM'

  // --- Native segment editing + navigation ---

  #segFromTarget(target: EventTarget | null): Seg | undefined {
    if (!(target instanceof HTMLInputElement)) return undefined
    return this.#segs.find((seg) => seg.el === target)
  }

  // Clicking the field's padding (rather than a native input) moves focus into
  // the editor. A real pointer interaction leaves caret placement to the browser.
  #onFieldMouseDown = (e: MouseEvent) => {
    const seg = this.#segFromTarget(e.target)
    if (seg) {
      this.#pointerSegment = seg.el
      return
    }
    if (e.target === this.#field || e.target === this.#segRow) {
      e.preventDefault()
      this.#focusSegment(this.#segs[0])
    }
  }

  #onFocusIn = (e: FocusEvent) => {
    const seg = this.#segFromTarget(e.target)
    if (!seg) return
    const pointerFocused = this.#pointerSegment === seg.el
    this.#pointerSegment = undefined
    if (!pointerFocused) {
      queueMicrotask(() => {
        if (this.shadowRoot?.activeElement === seg.el) seg.el.select()
      })
    }
  }

  #onFocusOut = (_e: FocusEvent) => {
    // `focusout` fires for hops within the row too. Defer until focus settles,
    // then commit the group only when it has genuinely lost focus.
    queueMicrotask(() => {
      const active = this.shadowRoot?.activeElement
      if (this.#segs.some((seg) => seg.el === active)) return
      if (this.#clampIfComplete()) this.#commitEdit()
      this.#dispatch('change')
    })
  }

  #onKeyDown = (e: KeyboardEvent) => {
    if (this.hasAttribute('disabled') || this.#formDisabled) return
    const seg = this.#segFromTarget(e.target)
    if (!seg) return
    const { el } = seg
    const key = e.key
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      e.preventDefault()
      this.#step(seg, key === 'ArrowUp' ? 1 : -1)
      return
    }
    if (key === 'PageUp' || key === 'PageDown') {
      e.preventDefault()
      this.#step(seg, (key === 'PageUp' ? 1 : -1) * (seg.kind === 'minute' ? 5 : 1))
      return
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const start = el.selectionStart ?? 0
      const end = el.selectionEnd ?? start
      const boundary = key === 'ArrowLeft'
        ? start === 0 && end === 0
        : start === el.value.length && end === el.value.length
      if (boundary) {
        e.preventDefault()
        this.#render()
        this.#moveFocus(seg, key === 'ArrowRight' ? 1 : -1)
      }
      return
    }
    if (key === 'Backspace' && el.value === '') {
      e.preventDefault()
      this.#moveFocus(seg, -1)
      return
    }
    if (seg.kind !== 'period' && this.#literals.some((literal) => literal.includes(key))) {
      e.preventDefault()
      this.#render()
      this.#moveFocus(seg, 1, { numeric: true })
    }
  }

  #onPaste = (e: ClipboardEvent) => {
    if (this.hasAttribute('disabled') || this.#formDisabled) return
    const parsed = this.#parsePaste(e.clipboardData?.getData('text/plain') ?? '')
    // Let ordinary segment text paste naturally. A complete pasted time is a
    // field-level operation, so retain the established fill-all-segments behavior.
    if (!parsed) return
    e.preventDefault()
    this.#applyValue(`${pad2(parsed.h)}:${pad2(parsed.min)}`)
    this.#clampIfComplete()
    this.#commitEdit()
    this.#dispatch('change')
  }

  #onInput = (e: Event) => {
    if (this.hasAttribute('disabled') || this.#formDisabled) return
    const seg = this.#segFromTarget(e.target)
    if (!seg || (e as InputEvent).isComposing) return
    if (seg.kind === 'period') this.#onPeriodInput(e, seg)
    else this.#onNumericInput(seg)
  }

  #onNumericInput(seg: Seg) {
    const { el } = seg
    const typed = el.value.replace(/\D/g, '')
    if (typed !== el.value) el.value = typed
    const hour12Hour = seg.kind === 'hour' && this.#hour12
    const typeMax = hour12Hour ? 23 : seg.max
    if (typed === '') {
      if (seg.kind === 'hour') this.#hour = null
      else this.#minute = null
      this.#commitEdit({ dispatch: false, preserve: el })
      return
    }

    let raw = typed.slice(0, 2)
    let value = Number(raw)
    let normalized = false
    if (value > typeMax) {
      raw = raw.at(-1)!
      value = Number(raw)
      normalized = true
    }
    const advance = raw.length === 2 || Number(`${value}0`) > typeMax

    if (hour12Hour) {
      // A first `0` is a real in-progress text value, not `12 AM`; wait for its
      // second digit before converting the 24-hour entry into display units.
      if (value === 0 && raw.length === 1) this.#hour = null
      else if (value === 0) { this.#hour = 12; this.#period = 'am' }
      else if (value > 12) { this.#hour = value - 12; this.#period = 'pm' }
      else { this.#hour = value; if (this.#period == null) this.#period = 'am' }
    } else {
      this.#assign(seg, Math.max(seg.min, value))
    }

    if (this.#clampIfComplete()) normalized = true
    // Native input already owns the in-progress text and selection. Repaint only
    // when normalization / conversion changes the active value, or before focus
    // moves away and the committed two-digit form should be shown.
    this.#commitEdit({ dispatch: false, preserve: normalized || advance ? undefined : el })
    if (advance) this.#moveFocus(seg, 1)
  }

  #onPeriodInput(e: Event, seg: Seg) {
    const { el } = seg
    const raw = el.value.trim()
    if (!raw) {
      this.#period = null
      this.#commitEdit({ dispatch: false, preserve: el })
      return
    }
    const lower = raw.toLowerCase()
    const am = this.#amText.toLowerCase()
    const pm = this.#pmText.toLowerCase()
    const period = lower === 'a' || lower === 'am' || lower === am
      ? 'am'
      : lower === 'p' || lower === 'pm' || lower === pm
        ? 'pm'
        : null
    if (period) {
      this.#period = period
      this.#commitEdit({ dispatch: false })
      this.#moveFocus(seg, 1)
      return
    }
    // Keep an unambiguous localized prefix editable; reject unrelated text while
    // allowing IME composition to finish before this method runs.
    if (am.startsWith(lower) || pm.startsWith(lower)) {
      this.#period = null
      this.#commitEdit({ dispatch: false, preserve: el })
      return
    }
    e.stopPropagation()
    el.value = this.#period === 'pm' ? this.#pmText : this.#period === 'am' ? this.#amText : ''
  }

  /** Parse a pasted time to 24-hour `{ h, min }`, or null. Accepts `14:30`,
   *  `9:5`, `2:30 pm`, `12am`, and run-together `230` / `1430` — mirrors
   *  `calendar-core`'s `parseTimeInput` but Temporal-free, so the element's
   *  granular import stays lean. */
  #parsePaste(text: string): { h: number; min: number } | null {
    let s = (text ?? '').trim().toLowerCase()
    if (!s) return null
    let mer: 'am' | 'pm' | null = null
    const m = s.match(/([ap])\.?m?\.?$/)
    if (m) { mer = m[1] === 'p' ? 'pm' : 'am'; s = s.slice(0, m.index).trim() }
    let h: number
    let min: number
    if (/[:.]/.test(s)) {
      const [hp, mp] = s.split(/[:.]/)
      h = Number(hp); min = Number(mp ?? '0')
    } else {
      const d = s.replace(/\D/g, '')
      if (!d) return null
      if (d.length <= 2) { h = Number(d); min = 0 }
      else { const cut = d.length - 2; h = Number(d.slice(0, cut)); min = Number(d.slice(cut)) }
    }
    if (!Number.isInteger(h) || !Number.isInteger(min)) return null
    if (mer === 'pm' && h < 12) h += 12
    if (mer === 'am' && h === 12) h = 0
    if (h < 0 || h > 23 || min < 0 || min > 59) return null
    return { h, min }
  }

  /** Arrow / page increments wrap within a segment's [min, max];
   *  from empty, ↑ lands on min and ↓ on max. Clamps the resulting complete value
   *  into the field's `min`/`max` range (so ↑ can't step past `max`). */
  #step(seg: Seg, delta: number) {
    if (seg.kind === 'period') {
      // From empty, land on AM; otherwise toggle.
      this.#period = this.#period == null ? 'am' : this.#period === 'am' ? 'pm' : 'am'
      this.#clampIfComplete()
      this.#commitEdit()
      return
    }
    const cur = seg.kind === 'hour' ? this.#hour : this.#minute
    const span = seg.max - seg.min + 1
    let next: number
    if (cur == null) next = delta > 0 ? seg.min : seg.max
    else next = ((cur - seg.min + delta) % span + span) % span + seg.min
    this.#assign(seg, next)
    this.#clampIfComplete()
    this.#commitEdit()
  }

  /** Mutate a segment's state without committing (so callers can clamp first). */
  #assign(seg: Seg, val: number) {
    if (seg.kind === 'period') return
    if (seg.kind === 'hour') this.#hour = val
    else this.#minute = val
    // Setting the hour with no meridiem yet defaults it to AM so a 12-hour value
    // can complete without touching the AM/PM segment.
    if (seg.kind === 'hour' && this.#hour12 && this.#period == null) this.#period = 'am'
  }

  // --- min / max range (total minutes since 00:00, or null when unbounded) ---
  #parseTotal(v: string | null): number | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec((v ?? '').trim())
    if (!m) return null
    return Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2]))
  }
  get #minTotal(): number | null { return this.#parseTotal(this.getAttribute('min')) }
  get #maxTotal(): number | null { return this.#parseTotal(this.getAttribute('max')) }
  #currentTotal(): number | null {
    const h = this.#h24
    if (h == null || this.#minute == null) return null
    return h * 60 + this.#minute
  }

  /** If the value is complete and outside `min`/`max`, snap it to the nearest
   *  bound and re-derive the segments. Returns whether it changed. */
  #clampIfComplete(): boolean {
    const total = this.#currentTotal()
    if (total == null) return false
    const lo = this.#minTotal
    const hi = this.#maxTotal
    let clamped = total
    if (lo != null && clamped < lo) clamped = lo
    if (hi != null && clamped > hi) clamped = hi
    if (clamped === total) return false
    this.#applyValue(`${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`)
    return true
  }

  #focusSegment(seg: Seg | undefined) {
    if (!seg) return
    seg.el.focus()
    seg.el.select()
  }

  #moveFocus(from: Seg, dir: 1 | -1, options: { numeric?: boolean } = {}) {
    const index = this.#segs.indexOf(from)
    for (let i = index + dir; i >= 0 && i < this.#segs.length; i += dir) {
      const next = this.#segs[i]
      if (!options.numeric || next.kind !== 'period') {
        this.#focusSegment(next)
        return
      }
    }
  }

  // --- Value + rendering ---

  /** Canonical 0–23 hour from the display state, or null when incomplete. */
  get #h24(): number | null {
    if (this.#hour == null) return null
    if (!this.#hour12) return this.#hour
    if (this.#period == null) return null
    return to24(this.#hour, this.#period)
  }

  #commitEdit({ dispatch = true, preserve }: { dispatch?: boolean; preserve?: HTMLInputElement } = {}) {
    this.#render(preserve)
    this.#iso = this.value
    this.#internals?.setFormValue(this.value)
    this.#updateFilled()
    this.#updateValidity()
    if (dispatch) this.#dispatch('input')
  }

  #render(preserve?: HTMLInputElement) {
    for (const seg of this.#segs) {
      this.#renderSeg(seg, preserve === seg.el)
    }
  }

  /** Paint a segment's committed value without disturbing a focused native input
   *  that already owns valid in-progress text and selection. */
  #renderSeg(seg: Seg, preserve: boolean) {
    const el = seg.el
    if (seg.kind === 'period') {
      const value = this.#period === 'pm' ? this.#pmText : this.#period === 'am' ? this.#amText : ''
      if (!preserve) el.value = value
      el.placeholder = this.#amText
      return
    }
    const value = seg.kind === 'hour' ? this.#hour : this.#minute
    if (!preserve) el.value = value == null ? '' : pad2(value)
    el.placeholder = '––'
  }

  /** Parse a `"HH:mm"` value into the display segments (24h → display units). */
  #applyValue(v: string) {
    const m = /^(\d{1,2}):(\d{2})$/.exec((v ?? '').trim())
    if (!m) { this.#hour = null; this.#minute = null; this.#period = null; return }
    const h = Math.min(23, Number(m[1]))
    const min = Math.min(59, Number(m[2]))
    this.#minute = min
    if (this.#hour12) {
      this.#hour = ((h + 11) % 12) + 1
      this.#period = h < 12 ? 'am' : 'pm'
    } else {
      this.#hour = h
      this.#period = null
    }
  }

  #dispatch(type: 'input' | 'change') {
    this.dispatchEvent(new Event(type, { bubbles: true, composed: type === 'input' }))
  }

  #applyGroupLabel() {
    const label = this.getAttribute('aria-label')
      || this.#labelSlot.assignedNodes().map((n) => n.textContent ?? '').join(' ').trim()
    if (label) this.#segRow.setAttribute('aria-label', label)
    else this.#segRow.removeAttribute('aria-label')
  }

  #onLabelSlotChange = () => {
    this.#labelBox.classList.toggle('has-label', this.#labelSlot.assignedNodes().length > 0)
    this.#applyGroupLabel()
  }
  #onHintSlotChange = () => {
    this.#hintBox.classList.toggle('has-hint', this.#hintSlot.assignedNodes().length > 0)
  }

  #syncDisabled() {
    const off = this.hasAttribute('disabled') || this.#formDisabled
    for (const seg of this.#segs) seg.el.disabled = off
  }

  #syncStatus() {
    const critical = this.getAttribute('status') === 'critical'
    for (const seg of this.#segs) seg.el.setAttribute('aria-invalid', critical ? 'true' : 'false')
    try { critical ? this.#internals?.states.add('invalid') : this.#internals?.states.delete('invalid') } catch {}
  }

  #updateFilled() {
    const filled = !!this.value
    this.#field.classList.toggle('is-filled', filled)
    try {
      if (filled) this.#internals?.states.add('filled')
      else this.#internals?.states.delete('filled')
    } catch {}
  }

  #updateValidity() {
    if (!this.#internals) return
    const anchor = this.#segs[0]?.el ?? this
    const required = this.hasAttribute('required')
    const total = this.#currentTotal()
    const lo = this.#minTotal
    const hi = this.#maxTotal
    if (required && !this.value) {
      this.#internals.setValidity({ valueMissing: true }, 'Please enter a time.', anchor as HTMLElement)
    } else if (total != null && lo != null && total < lo) {
      this.#internals.setValidity({ rangeUnderflow: true }, `Time must be ${this.getAttribute('min')} or later.`, anchor as HTMLElement)
    } else if (total != null && hi != null && total > hi) {
      this.#internals.setValidity({ rangeOverflow: true }, `Time must be ${this.getAttribute('max')} or earlier.`, anchor as HTMLElement)
    } else if (this.getAttribute('status') === 'critical') {
      this.#internals.setValidity({ customError: true }, 'Invalid value.', anchor as HTMLElement)
    } else {
      this.#internals.setValidity({})
    }
  }

  // --- Public value API (paired getter/setter, mirrors a-input) ---

  /** The current time as 24-hour `"HH:mm"`, or `''` when incomplete. */
  get value(): string {
    const h = this.#h24
    if (h == null || this.#minute == null) return ''
    return `${pad2(h)}:${pad2(this.#minute)}`
  }
  set value(v: string) {
    this.#seeded = true
    const next = v ?? ''
    // Reconcile only when the incoming value differs from what the field already
    // represents (mirrors a-input). A controlled consumer echoing `onValueChange`
    // re-passes the same value on every edit — and while a segment is mid-entry
    // the canonical value is '' (incomplete); without this guard, re-applying that
    // '' would wipe the other segments the user already filled.
    if (next === this.value) return
    this.#applyValue(next)
    this.#iso = this.value
    if (this.#ready) {
      this.#render()
      this.#internals?.setFormValue(this.value)
      this.#updateFilled()
      this.#updateValidity()
    }
  }

  /** Empty the field, refocus the first segment, and fire input + change. */
  clear() {
    this.#hour = null
    this.#minute = null
    this.#period = null
    this.#iso = ''
    this.#render()
    this.#internals?.setFormValue('')
    this.#updateFilled()
    this.#updateValidity()
    this.#dispatch('input')
    this.#dispatch('change')
    this.dispatchEvent(new CustomEvent(CLEAR_INPUT_EVENT, { bubbles: true }))
    this.#segs[0]?.el.focus()
  }

  get name(): string { return this.getAttribute('name') ?? '' }
  set name(v: string) { this.setAttribute('name', v) }

  // Constraint-validation API, proxied from ElementInternals (mirrors a-input) so
  // the host behaves like a native control and the `InputTime` wrapper can read
  // validity for its onValueChange snapshot. Read-only mirrors — allowlisted in
  // scripts/lint-getters.mjs (no wrapper passes them as props).
  get validity(): ValidityState | undefined { return this.#internals?.validity }
  get validationMessage(): string { return this.#internals?.validationMessage ?? '' }
  get willValidate(): boolean { return this.#internals?.willValidate ?? false }
  checkValidity(): boolean { return this.#internals?.checkValidity() ?? true }
  reportValidity(): boolean { return this.#internals?.reportValidity() ?? true }

  formResetCallback() {
    this.#applyValue(this.getAttribute('defaultvalue') ?? '')
    this.#iso = this.value
    this.#render()
    this.#internals?.setFormValue(this.value)
    this.#updateFilled()
    this.#updateValidity()
    this.#dispatch('input')
    this.#dispatch('change')
  }
  formDisabledCallback(disabled: boolean) { this.#formDisabled = disabled; this.#syncDisabled() }
  formStateRestoreCallback(state: string) { this.value = state ?? '' }
}

export function register_a_input_time() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-input-time')) {
    customElements.define('a-input-time', AInputTimeElement)
  }
}

register_a_input_time()
