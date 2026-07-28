import { HTMLElementBase } from '../anta_helpers'
import './a-input-time.css'

/**
 * `<a-input-time>` — a segmented wall-clock time field. One visual box (matching
 * `<a-input>`'s chrome) holding separate **hour** / **minute** / (12-hour only)
 * **AM-PM** sections that behave as one control. Each editable section is a
 * focusable `role="spinbutton"` node in the element's shadow DOM; the `:` (or the
 * locale's separator) between them is inert text.
 *
 * This follows the cross-system model (React Aria, MUI X, native `<input type=time>`):
 * per-segment spinbuttons, not a text `<input>` and not N inputs. The element owns
 * focus, increment/wrap, and digit auto-advance — coordination that needs a live
 * element, so it lives here (the wrapper holds no DOM ref) and only ever mutates
 * its OWN shadow nodes, never the host or light DOM (worker-safe, per AGENTS.md).
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
 * The host is never mutated from JS. Per-segment `aria-value*` / `role` and the
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
// A 12-hour display hour (1–12) + meridiem → the canonical 0–23 hour.
const to24 = (h12: number, period: 'am' | 'pm') =>
  period === 'pm' ? (h12 % 12) + 12 : h12 % 12

type SegKind = 'hour' | 'minute' | 'period'

interface Seg {
  kind: SegKind
  el: HTMLSpanElement
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
    :host(:not(:disabled)) .field:hover { --_bc: var(--input-time-border-hover); }
  }
  .field:has(.seg:focus) {
    --_bc: var(--input-time-border-hover);
    outline: 1px solid var(--focus-ring);
    outline-offset: 1px;
  }

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
  .field.has-leading .segments { padding-inline-start: 5px; }
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
    display: inline-block;
    box-sizing: border-box;
    padding-inline: 1px;
    border-radius: 2px;
    text-align: center;
    white-space: nowrap;
    outline: none;
    cursor: default;
    font-variant-numeric: tabular-nums;
    caret-color: transparent;
  }
  .seg[inputmode="numeric"] {
    /* Fixed to two tabular digits so the box never reflows: neither the narrower
       placeholder dashes nor a mid-entry single digit changes the field width. */
    width: calc(2ch + 4px);
  }
  .seg:focus {
    background: var(--input-time-seg-focus-bg);
    color: var(--input-time-seg-focus-text);
  }
  .seg[data-placeholder] { color: var(--input-time-placeholder); }
  .lit { white-space: pre; color: var(--input-time-text); }

  /* No text-selection highlight inside the field: the segments are spinbuttons,
     and a selection painted over the focused segment's tint compounds into an
     unreadable block. The focus tint alone marks the active segment. Scoped to
     the shadow, so page selection is unaffected. */
  ::selection { background: transparent; }

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
  // In-progress typed digits for the focused numeric segment (reset on blur /
  // segment change / commit), so `1` then `2` builds `12`.
  #buf = ''

  constructor() {
    super()
    try {
      this.#internals = this.attachInternals?.()
    } catch (err) {
      console.warn('a-input-time: ElementInternals unavailable — form association disabled.', err)
    }
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true })

    const style = document.createElement('style')
    style.textContent = SHADOW_STYLE

    this.#labelBox = document.createElement('div')
    this.#labelBox.className = 'label'
    this.#labelBox.setAttribute('part', 'label')
    this.#labelSlot = document.createElement('slot')
    this.#labelSlot.name = 'label'
    this.#labelBox.append(this.#labelSlot)
    this.#labelSlot.addEventListener('click', () => this.#segs[0]?.el.focus())
    this.#labelSlot.addEventListener('slotchange', this.#onLabelSlotChange)

    this.#field = document.createElement('div')
    this.#field.className = 'field'
    this.#field.setAttribute('part', 'field')

    this.#segRow = document.createElement('div')
    this.#segRow.className = 'segments'
    this.#segRow.setAttribute('part', 'segments')
    this.#segRow.setAttribute('role', 'group')
    // Clicking the padding (not a segment) lands focus on the first segment.
    this.#field.addEventListener('mousedown', (e) => {
      if (e.target === this.#field || e.target === this.#segRow) {
        e.preventDefault()
        this.#segs[0]?.el.focus()
      }
    })

    this.#leadingSlot = document.createElement('slot')
    this.#leadingSlot.name = 'leading'
    this.#leadingSlot.setAttribute('part', 'leading')
    this.#leadingSlot.addEventListener('slotchange', () =>
      this.#field.classList.toggle('has-leading', this.#leadingSlot.assignedNodes().length > 0))

    const clearSlot = document.createElement('slot')
    clearSlot.name = 'clear'
    clearSlot.setAttribute('part', 'clear')
    this.#trailingSlot = document.createElement('slot')
    this.#trailingSlot.name = 'trailing'
    this.#trailingSlot.setAttribute('part', 'trailing')
    this.#trailingSlot.addEventListener('slotchange', () =>
      this.#field.classList.toggle('has-trailing', this.#trailingSlot.assignedNodes().length > 0))

    this.#field.append(this.#leadingSlot, this.#segRow, clearSlot, this.#trailingSlot)

    this.addEventListener(CLEAR_TRIGGER, () => this.clear())

    this.#hintBox = document.createElement('div')
    this.#hintBox.className = 'hint'
    this.#hintBox.setAttribute('part', 'hint')
    this.#hintSlot = document.createElement('slot')
    this.#hintSlot.name = 'hint'
    this.#hintSlot.addEventListener('slotchange', this.#onHintSlotChange)
    this.#hintBox.append(this.#hintSlot)

    const extrasSlot = document.createElement('slot')
    shadow.append(style, this.#labelBox, this.#field, extrasSlot, this.#hintBox)
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

    this.#segRow.replaceChildren()
    this.#segs = []
    for (const part of parts) {
      if (part.type === 'hour' || part.type === 'minute' || part.type === 'dayPeriod') {
        const el = document.createElement('span')
        el.className = 'seg'
        el.tabIndex = 0
        el.setAttribute('role', 'spinbutton')
        // contentEditable so a touch device summons a soft keyboard (a focusable
        // non-editable span never does) — numeric for hour/minute, text for AM/PM.
        // We own the text: `beforeinput` preventDefaults every mutation and routes
        // it, and the caret is hidden (caret-color: transparent) so it reads as a
        // spinner, not a text box.
        el.contentEditable = 'true'
        el.spellcheck = false
        el.setAttribute('autocorrect', 'off')
        el.setAttribute('autocapitalize', 'off')
        const kind: SegKind = part.type === 'dayPeriod' ? 'period' : part.type
        el.setAttribute('aria-label', kind === 'hour' ? 'Hour' : kind === 'minute' ? 'Minute' : 'AM/PM')
        el.setAttribute('inputmode', kind === 'period' ? 'text' : 'numeric')
        const seg: Seg =
          kind === 'hour'
            ? { kind, el, min: hour12 ? 1 : 0, max: hour12 ? 12 : 23 }
            : kind === 'minute'
              ? { kind, el, min: 0, max: 59 }
              : { kind, el, min: 0, max: 1 }
        el.addEventListener('keydown', (e) => this.#onSegKeyDown(e, seg))
        el.addEventListener('beforeinput', (e) => this.#onSegBeforeInput(e as InputEvent, seg))
        el.addEventListener('focus', () => { this.#buf = '' })
        el.addEventListener('blur', () => this.#onSegBlur())
        this.#segRow.append(el)
        this.#segs.push(seg)
      } else {
        const lit = document.createElement('span')
        lit.className = 'lit'
        lit.setAttribute('aria-hidden', 'true')
        lit.textContent = part.value
        this.#segRow.append(lit)
      }
    }
    // Stash the resolved AM/PM strings for display + typing.
    this.#amText = amText
    this.#pmText = pmText
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

  // --- Keyboard ---

  // Navigation + stepping only. Character entry and deletion go through
  // `#onSegBeforeInput` (so mobile virtual keyboards, which don't fire keydown
  // reliably, work) — these keys don't produce `beforeinput`, so there's no
  // double handling.
  #onSegKeyDown(e: KeyboardEvent, seg: Seg) {
    if (this.hasAttribute('disabled') || this.#formDisabled) return
    const k = e.key
    if (k === 'ArrowUp' || k === 'ArrowDown') {
      e.preventDefault()
      this.#step(seg, k === 'ArrowUp' ? 1 : -1)
    } else if (k === 'PageUp' || k === 'PageDown') {
      e.preventDefault()
      this.#step(seg, (k === 'PageUp' ? 1 : -1) * (seg.kind === 'minute' ? 5 : 1))
    } else if (k === 'Home') {
      e.preventDefault(); this.#set(seg, seg.min)
    } else if (k === 'End') {
      e.preventDefault(); this.#set(seg, seg.max)
    } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault()
      this.#moveFocus(seg, k === 'ArrowRight' ? 1 : -1)
    }
  }

  // Character entry (digits, a/p) and deletion, from a physical or virtual
  // keyboard. We never let the contentEditable mutate — preventDefault every
  // `beforeinput` and route it, keeping the segment text under our control.
  #onSegBeforeInput(e: InputEvent, seg: Seg) {
    e.preventDefault()
    if (this.hasAttribute('disabled') || this.#formDisabled) return
    const type = e.inputType
    if (type === 'deleteContentBackward' || type === 'deleteContentForward') {
      this.#buf = ''
      this.#clearSeg(seg)
      if (type === 'deleteContentBackward') this.#moveFocus(seg, -1)
      return
    }
    if (type === 'insertFromPaste') {
      // Paste (text lives in dataTransfer, not e.data): try to read a whole time
      // and fill every segment; fall back to feeding the characters into the
      // focused segment.
      const text = e.dataTransfer?.getData('text/plain') || e.data || ''
      const parsed = this.#parsePaste(text)
      if (parsed) {
        this.#buf = ''
        this.#applyValue(`${pad2(parsed.h)}:${pad2(parsed.min)}`)
        this.#clampIfComplete()
        this.#commitEdit()
        this.#dispatch('change')
      } else {
        for (const ch of text) this.#typeChar(seg, ch)
      }
      return
    }
    if (type.startsWith('insert')) {
      for (const ch of e.data ?? '') this.#typeChar(seg, ch)
    }
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

  #typeChar(seg: Seg, ch: string) {
    if (seg.kind === 'period') {
      const c = ch.toLowerCase()
      if (c === 'a' || c === 'p') {
        this.#period = c === 'p' ? 'pm' : 'am'
        this.#commitEdit()
        this.#moveFocus(seg, 1)
      }
      return
    }
    if (/[0-9]/.test(ch)) this.#typeDigit(seg, ch)
  }

  /** Arrow / page / home / end increment: wraps within a segment's [min, max];
   *  from empty, ↑ lands on min and ↓ on max. Clamps the resulting complete value
   *  into the field's `min`/`max` range (so ↑ can't step past `max`). */
  #step(seg: Seg, delta: number) {
    this.#buf = ''
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

  #set(seg: Seg, val: number) {
    this.#assign(seg, val)
    this.#commitEdit()
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

  #clearSeg(seg: Seg) {
    if (seg.kind === 'hour') this.#hour = null
    else if (seg.kind === 'minute') this.#minute = null
    else this.#period = null
    this.#commitEdit()
  }

  /** Type a digit into a numeric segment, accumulating and auto-advancing once the
   *  segment can't take another digit (the `Number(v + '0') > max` heuristic). */
  #typeDigit(seg: Seg, d: string) {
    // A 12-hour hour accepts a 24-hour entry while typing (up to 23) and converts
    // it — `18` → `6 PM`, `0` → `12 AM` — so pasting/typing a 24-hour time just
    // works. Arrows still wrap the display range (1–12); only typing converts.
    const hour12Hour = seg.kind === 'hour' && this.#hour12
    const typeMax = hour12Hour ? 23 : seg.max
    const candidate = Number(this.#buf + d)
    let raw: number
    let advance = false
    if (candidate > typeMax) {
      // The running value can't hold this digit — start fresh from it.
      raw = Number(d)
      this.#buf = d
    } else {
      raw = candidate
      this.#buf += d
    }
    // Advance when a further digit is impossible or the segment is 2 digits wide.
    if (Number(`${raw}0`) > typeMax || this.#buf.length >= String(typeMax).length) {
      advance = true
      this.#buf = ''
    }
    if (hour12Hour) {
      // A lone 0/1/2 may still take a second digit (0x / 1x / 2x), so hold `0` as a
      // partial until it commits (1 and 2 are valid 12-hour hours on their own).
      if (raw === 0 && !advance) {
        // Held partial: a dimmed "0" (uncommitted), not a solid "00" that reads as
        // entered — a second digit (0x) resolves it; blur drops it.
        seg.el.textContent = '0'
        seg.el.setAttribute('data-placeholder', '')
        seg.el.removeAttribute('aria-valuenow')
        seg.el.removeAttribute('aria-valuetext')
        return
      }
      if (raw === 0) { this.#hour = 12; this.#period = 'am' }
      else if (raw > 12) { this.#hour = raw - 12; this.#period = 'pm' }
      else { this.#hour = raw; if (this.#period == null) this.#period = 'am' }
      this.#commitEdit()
      if (advance) this.#moveFocus(seg, 1)
      return
    }
    this.#assign(seg, Math.max(seg.min, raw))
    this.#commitEdit()
    if (advance) this.#moveFocus(seg, 1)
  }

  #moveFocus(from: Seg, dir: 1 | -1) {
    const i = this.#segs.indexOf(from)
    const next = this.#segs[i + dir]
    if (next) next.el.focus()
  }

  /** On losing a segment, reset the digit buffer; when focus has left the whole
   *  group (not just hopped to a sibling segment), clamp into `min`/`max` and
   *  fire `change`. `shadowRoot.activeElement` reliably reports the focused
   *  segment even across the shadow boundary (blur `relatedTarget` is retargeted
   *  to null), so defer one microtask to read where focus landed. */
  #onSegBlur() {
    this.#buf = ''
    queueMicrotask(() => {
      const active = this.shadowRoot?.activeElement
      if (this.#segs.some((s) => s.el === active)) return
      if (this.#clampIfComplete()) this.#commitEdit()
      this.#dispatch('change')
    })
  }

  // --- Value + rendering ---

  /** Canonical 0–23 hour from the display state, or null when incomplete. */
  get #h24(): number | null {
    if (this.#hour == null) return null
    if (!this.#hour12) return this.#hour
    if (this.#period == null) return null
    return to24(this.#hour, this.#period)
  }

  #commitEdit() {
    this.#render()
    this.#iso = this.value
    this.#internals?.setFormValue(this.value)
    this.#updateFilled()
    this.#updateValidity()
    this.#dispatch('input')
  }

  #render() {
    for (const seg of this.#segs) {
      if (seg.kind === 'period') this.#renderSeg(seg, null)
      else this.#renderSeg(seg, seg.kind === 'hour' ? this.#hour : this.#minute)
    }
  }

  /** Paint one segment: its value (or placeholder) as text, plus the spinbutton
   *  ARIA values. `override` lets `#typeDigit` show a partial value mid-entry. */
  #renderSeg(seg: Seg, override: number | null) {
    const el = seg.el
    if (seg.kind === 'period') {
      const set = this.#period != null
      el.textContent = set ? (this.#period === 'pm' ? this.#pmText : this.#amText) : this.#amText
      el.toggleAttribute('data-placeholder', !set)
      el.setAttribute('aria-valuemin', '0')
      el.setAttribute('aria-valuemax', '1')
      if (set) {
        el.setAttribute('aria-valuenow', this.#period === 'pm' ? '1' : '0')
        el.setAttribute('aria-valuetext', this.#period === 'pm' ? this.#pmText : this.#amText)
      } else {
        el.removeAttribute('aria-valuenow')
        el.removeAttribute('aria-valuetext')
      }
      return
    }
    const val = override
    const set = val != null
    el.textContent = set ? pad2(val) : '––'
    el.toggleAttribute('data-placeholder', !set)
    el.setAttribute('aria-valuemin', String(seg.min))
    el.setAttribute('aria-valuemax', String(seg.max))
    if (set) {
      el.setAttribute('aria-valuenow', String(val))
      el.setAttribute('aria-valuetext', pad2(val))
    } else {
      el.removeAttribute('aria-valuenow')
      el.removeAttribute('aria-valuetext')
    }
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
    for (const seg of this.#segs) {
      if (off) seg.el.setAttribute('aria-disabled', 'true')
      else seg.el.removeAttribute('aria-disabled')
      seg.el.tabIndex = off ? -1 : 0
      seg.el.contentEditable = off ? 'false' : 'true'
    }
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
