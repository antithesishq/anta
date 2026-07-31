import { HTMLElementBase } from '../anta_helpers'
import './a-slider.css'

const finiteNumber = (value: string | number | null, fallback: number) => {
  if (value == null || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const precisionOf = (value: number) => {
  const exponent = value.toString().match(/(?:\.(\d+))?(?:e([+-]?\d+))?$/i)
  return Math.max(0, (exponent?.[1]?.length ?? 0) - Number(exponent?.[2] ?? 0))
}

/**
 * `<a-slider>` is a form-associated single-value slider. Its rail uses relative
 * dragging by default: pressing any point captures the pointer, while only the
 * subsequent horizontal movement changes the value. Set `track-click="jump"`
 * for the conventional position-based track click.
 */
export class ASliderElement extends HTMLElementBase {
  static formAssociated = true
  static observedAttributes = [
    'value', 'defaultvalue', 'min', 'max', 'step', 'disabled', 'track-click',
    'value-display', 'value-prefix', 'value-suffix',
  ]

  #internals?: ElementInternals
  #control: HTMLDivElement
  #railArea: HTMLDivElement
  #fill: HTMLDivElement
  #thumb: HTMLDivElement
  #header: HTMLDivElement
  #label: HTMLSlotElement
  #inlineValue: HTMLSpanElement
  #inlineValuePrefix: HTMLSpanElement
  #inlineValueSuffix: HTMLSpanElement
  #endValue: HTMLSpanElement
  #endValuePrefix: HTMLSpanElement
  #endValueSuffix: HTMLSpanElement
  #thumbValue: HTMLSpanElement
  #thumbValuePrefix: HTMLSpanElement
  #thumbValueSuffix: HTMLSpanElement
  #markers: HTMLSlotElement
  #extras: HTMLSlotElement
  #value = 0
  #seeded = false
  #dirty = false
  #drag?: { pointerId: number; startX: number; startValue: number }

  get value(): number {
    return this.#value
  }

  set value(value: number | string) {
    this.setAttribute('value', String(value))
  }

  get defaultValue(): number {
    return finiteNumber(this.getAttribute('defaultvalue'), this.#min)
  }

  set defaultValue(value: number | string) {
    this.setAttribute('defaultvalue', String(value))
  }

  constructor() {
    super()
    this.#internals = this.attachInternals?.()

    const shadow = this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = `
      :host {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: var(--slider-gap);
        outline: none;
      }
      [hidden] { display: none !important; }
      .header {
        display: flex;
        align-items: baseline;
        gap: 1px;
        min-width: 0;
      }
      slot[name="label"] {
        display: block;
        min-width: 0;
        color: var(--slider-label);
        font-family: var(--sans-serif);
        font-size: var(--slider-label-size);
        font-weight: 500;
        line-height: var(--slider-label-line-height);
      }
      .inline-value,
      .end-value {
        color: var(--slider-value);
        font-family: var(--sans-serif);
        font-feature-settings: 'ss02', 'ss05', 'tnum';
        font-size: var(--slider-value-size);
        font-variant-numeric: tabular-nums;
        line-height: var(--slider-value-line-height);
      }
      .value-affix { color: var(--slider-value-affix); }
      .inline-separator,
      .inline-value { display: none; }
      .inline-value { margin-inline-start: 0.5ch; }
      .end-value {
        display: block;
        flex: 0 0 auto;
        margin-inline-start: auto;
        padding-inline-start: 1ch;
      }
      :host([value-display="inline"]) .inline-separator,
      :host([value-display="inline"]) .inline-value { display: block; }
      :host([value-display="inline"]) .end-value,
      :host([value-display="thumb"]) .end-value,
      :host([value-display="none"]) .end-value { display: none; }
      .control {
        position: relative;
        block-size: var(--slider-control-size);
        border-radius: var(--slider-control-radius);
        cursor: grab;
        touch-action: none;
        user-select: none;
      }
      :host([track-click="jump"]) .control { cursor: pointer; }
      .control[data-dragging] { cursor: grabbing; }
      .control[data-dragging] .thumb { background: var(--slider-thumb-active); }
      :host(:focus-visible) .control:not([data-pointer-focus]) {
        outline: var(--slider-focus-width) solid var(--slider-focus);
        outline-offset: 0;
      }
      .rail-area {
        position: absolute;
        inset-block-start: 50%;
        inset-inline: calc(var(--slider-thumb-size) / 2);
        block-size: var(--slider-track-size);
        transform: translateY(-50%);
      }
      .rail,
      .fill {
        position: absolute;
        inset: 0;
        border-radius: var(--slider-track-radius);
        transition: background-color 75ms ease-out;
      }
      .rail {
        inset-inline: calc(var(--slider-track-inset) - var(--slider-thumb-size) / 2);
        background: var(--slider-track);
      }
      .fill {
        inset-inline-start: calc(var(--slider-track-inset) - var(--slider-thumb-size) / 2);
        inset-inline-end: auto;
        inline-size: calc(var(--_percent, 0%) + var(--slider-thumb-size) / 2 - var(--slider-track-inset));
        background: var(--slider-fill);
      }
      .thumb {
        position: absolute;
        inset-block-start: 50%;
        inset-inline-start: var(--_percent, 0%);
        box-sizing: border-box;
        inline-size: var(--slider-thumb-size);
        block-size: var(--slider-thumb-size);
        border: var(--slider-thumb-border-width) solid var(--slider-thumb-border);
        border-radius: var(--slider-thumb-radius);
        background: var(--slider-thumb);
        transition: background-color 75ms ease-out, border-color 75ms ease-out;
        transform: translate(-50%, -50%);
      }
      .thumb-value {
        display: none;
        position: absolute;
        inset-inline-start: var(--_percent, 0%);
        inset-block-start: 50%;
        min-inline-size: max-content;
        color: var(--slider-thumb-value);
        font-family: var(--sans-serif);
        font-feature-settings: 'ss02', 'ss05', 'tnum';
        font-size: var(--slider-thumb-value-size);
        font-variant-numeric: tabular-nums;
        line-height: var(--slider-thumb-value-line-height);
        padding-inline: 6px;
        background: var(--bg-2);
        border: 1px solid var(--border-3);
        border-radius: 4px;
        text-align: center;
        transform: translate(-50%, calc(
          -50% - var(--slider-control-size) / 2 - var(--slider-gap) - var(--slider-value-line-height) / 2
        ));
      }
      :host([value-display="thumb"]) .thumb-value { display: block; }
      slot[name="markers"] {
        display: block;
        position: relative;
        min-block-size: var(--slider-marker-line-height);
      }
      slot[name="markers"]::slotted(*) {
        position: absolute;
        inset-inline-start: var(--slider-marker-position);
        max-inline-size: min(12rem, 50vw);
        color: var(--slider-marker);
        font-family: var(--sans-serif);
        font-feature-settings: 'ss02', 'ss05', 'tnum';
        font-size: var(--slider-marker-size);
        font-variant-numeric: tabular-nums;
        line-height: var(--slider-marker-line-height);
        text-align: center;
        transform: translateX(-50%);
        white-space: nowrap;
      }
      slot[name="markers"]::slotted([data-slider-marker-start]) { text-align: start; transform: translateX(0); }
      slot[name="markers"]::slotted([data-slider-marker-end]) { text-align: end; transform: translateX(-100%); }
      slot:not([name]) { display: block; }
      :host([disabled]) .control,
      :host(:disabled) .control { cursor: not-allowed; }
      @media (forced-colors: active) {
        .rail { background: Canvas; border: 1px solid CanvasText; }
        .fill { background: Highlight; }
        .thumb { background: Canvas; border-color: CanvasText; }
        :host(:focus-visible) .control { outline: 2px solid Highlight; }
      }
      @media (prefers-reduced-motion: reduce) {
        .rail,
        .fill,
        .thumb { transition: none; }
      }
    `

    this.#header = document.createElement('div')
    this.#header.className = 'header'
    this.#header.part.add('header')

    this.#label = document.createElement('slot')
    this.#label.name = 'label'
    this.#label.part.add('label')
    const separator = document.createElement('span')
    separator.className = 'inline-separator'
    separator.textContent = ':'
    this.#inlineValue = document.createElement('span')
    this.#inlineValue.className = 'inline-value'
    this.#inlineValue.part.add('value')
    this.#inlineValuePrefix = document.createElement('span')
    this.#inlineValuePrefix.className = 'value-affix'
    this.#inlineValueSuffix = document.createElement('span')
    this.#inlineValueSuffix.className = 'value-affix'
    this.#inlineValue.append(this.#inlineValuePrefix, this.#inlineValueSuffix)
    this.#endValue = document.createElement('span')
    this.#endValue.className = 'end-value'
    this.#endValue.part.add('value')
    this.#endValuePrefix = document.createElement('span')
    this.#endValuePrefix.className = 'value-affix'
    this.#endValueSuffix = document.createElement('span')
    this.#endValueSuffix.className = 'value-affix'
    this.#endValue.append(this.#endValuePrefix, this.#endValueSuffix)
    this.#header.append(this.#label, separator, this.#inlineValue, this.#endValue)

    this.#control = document.createElement('div')
    this.#control.className = 'control'
    this.#control.part.add('control')
    this.#railArea = document.createElement('div')
    this.#railArea.className = 'rail-area'
    const rail = document.createElement('div')
    rail.className = 'rail'
    rail.part.add('track')
    this.#fill = document.createElement('div')
    this.#fill.className = 'fill'
    this.#fill.part.add('fill')
    this.#thumb = document.createElement('div')
    this.#thumb.className = 'thumb'
    this.#thumb.part.add('thumb')
    this.#thumbValue = document.createElement('span')
    this.#thumbValue.className = 'thumb-value'
    this.#thumbValue.part.add('thumb-value')
    this.#thumbValuePrefix = document.createElement('span')
    this.#thumbValuePrefix.className = 'value-affix'
    this.#thumbValueSuffix = document.createElement('span')
    this.#thumbValueSuffix.className = 'value-affix'
    this.#thumbValue.append(this.#thumbValuePrefix, this.#thumbValueSuffix)
    this.#railArea.append(rail, this.#fill, this.#thumb, this.#thumbValue)
    this.#control.append(this.#railArea)

    this.#markers = document.createElement('slot')
    this.#markers.name = 'markers'
    this.#markers.part.add('markers')
    this.#extras = document.createElement('slot')
    this.#extras.part.add('extras')

    for (const slot of [this.#label, this.#markers, this.#extras]) {
      slot.addEventListener('slotchange', () => this.#syncSlotVisibility())
    }
    this.#control.addEventListener('pointerdown', (event) => this.#beginDrag(event))
    this.#control.addEventListener('pointermove', (event) => this.#moveDrag(event))
    this.#control.addEventListener('pointerup', (event) => this.#finishDrag(event))
    this.#control.addEventListener('pointercancel', (event) => this.#finishDrag(event))
    this.addEventListener('keydown', (event) => this.#handleKeydown(event))
    this.addEventListener('blur', () => delete this.#control.dataset.pointerFocus)

    shadow.append(style, this.#header, this.#control, this.#markers, this.#extras)
  }

  connectedCallback() {
    if (!this.#seeded) {
      this.#value = this.#initialValue()
      this.#seeded = true
    }
    this.#paint()
    this.#syncSlotVisibility()
  }

  attributeChangedCallback(name: string) {
    if (!this.#seeded) return

    if (name === 'value') {
      if (this.hasAttribute('value')) {
        this.#value = this.#normalize(finiteNumber(this.getAttribute('value'), this.#min))
        this.#dirty = false
      } else if (!this.#dirty) {
        this.#value = this.#initialValue()
      }
    } else if (name === 'defaultvalue' && !this.hasAttribute('value') && !this.#dirty) {
      this.#value = this.#initialValue()
    } else if (name === 'min' || name === 'max' || name === 'step') {
      this.#value = this.#normalize(this.#value)
    }

    this.#paint()
    if (name === 'value-display') this.#syncSlotVisibility()
  }

  formResetCallback() {
    const previous = this.#value
    this.#value = this.#normalize(finiteNumber(this.getAttribute('defaultvalue'), this.#min))
    this.#dirty = false
    this.#paint()
    if (this.#value !== previous) this.#emitInputAndChange()
  }

  formStateRestoreCallback(state: string | File | FormData | null) {
    if (typeof state !== 'string') return
    this.#value = this.#normalize(finiteNumber(state, this.#min))
    this.#dirty = true
    this.#paint()
  }

  formDisabledCallback() {
    this.#paint()
  }

  get #min() {
    return finiteNumber(this.getAttribute('min'), 0)
  }

  get #max() {
    return Math.max(this.#min, finiteNumber(this.getAttribute('max'), 100))
  }

  get #step() {
    const step = finiteNumber(this.getAttribute('step'), 1)
    return step > 0 ? step : 1
  }

  get #isDisabled() {
    return this.hasAttribute('disabled') || this.matches(':disabled')
  }

  #initialValue() {
    const source = this.getAttribute('value') ?? this.getAttribute('defaultvalue')
    return this.#normalize(finiteNumber(source, this.#min))
  }

  #normalize(value: number) {
    const min = this.#min
    const max = this.#max
    const step = this.#step
    const stepped = min + Math.round((Math.min(max, Math.max(min, value)) - min) / step) * step
    const precision = Math.min(12, Math.max(precisionOf(min), precisionOf(max), precisionOf(step)))
    return Number(Math.min(max, Math.max(min, stepped)).toFixed(precision))
  }

  #percent(value = this.#value) {
    const range = this.#max - this.#min
    return range > 0 ? ((value - this.#min) / range) * 100 : 0
  }

  #paint() {
    const percent = `${this.#percent()}%`
    this.#railArea.style.setProperty('--_percent', percent)
    const value = this.#displayValue()
    const displayedValue = String(this.#value)
    const prefix = this.getAttribute('value-prefix') ?? ''
    const suffix = this.getAttribute('value-suffix') ?? ''
    for (const [element, prefixElement, suffixElement] of [
      [this.#inlineValue, this.#inlineValuePrefix, this.#inlineValueSuffix],
      [this.#endValue, this.#endValuePrefix, this.#endValueSuffix],
      [this.#thumbValue, this.#thumbValuePrefix, this.#thumbValueSuffix],
    ]) {
      element.textContent = displayedValue
      prefixElement.textContent = prefix
      suffixElement.textContent = suffix
      element.prepend(prefixElement)
      element.append(suffixElement)
    }

    const internals = this.#internals
    if (!internals) return
    internals.ariaValueMin = String(this.#min)
    internals.ariaValueMax = String(this.#max)
    internals.ariaValueNow = String(this.#value)
    internals.ariaValueText = value
    internals.setFormValue(this.#isDisabled ? null : String(this.#value), String(this.#value))
  }

  #displayValue() {
    return `${this.getAttribute('value-prefix') ?? ''}${this.#value}${this.getAttribute('value-suffix') ?? ''}`
  }

  #syncSlotVisibility() {
    const assigned = (slot: HTMLSlotElement) => slot.assignedNodes({ flatten: true }).length > 0
    this.#header.hidden = !assigned(this.#label) && this.getAttribute('value-display') === 'none'
    this.#markers.hidden = !assigned(this.#markers)
    this.#extras.hidden = !assigned(this.#extras)
  }

  #setValue(value: number) {
    const next = this.#normalize(value)
    if (next === this.#value) return false
    this.#value = next
    this.#dirty = true
    this.#paint()
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    return true
  }

  #emitInputAndChange() {
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
  }

  #valueAt(clientX: number) {
    const rect = this.#railArea.getBoundingClientRect()
    if (rect.width <= 0) return this.#value
    return this.#min + ((clientX - rect.left) / rect.width) * (this.#max - this.#min)
  }

  #beginDrag(event: PointerEvent) {
    if (this.#isDisabled || event.button !== 0) return
    const rect = this.#railArea.getBoundingClientRect()
    if (rect.width <= 0) return

    this.#drag = { pointerId: event.pointerId, startX: event.clientX, startValue: this.#value }
    this.#control.setPointerCapture(event.pointerId)
    this.#control.dataset.dragging = ''
    this.#control.dataset.pointerFocus = ''
    this.focus({ preventScroll: true })

    if (this.getAttribute('track-click') === 'jump') this.#setValue(this.#valueAt(event.clientX))
    event.preventDefault()
  }

  #moveDrag(event: PointerEvent) {
    const drag = this.#drag
    if (!drag || drag.pointerId !== event.pointerId) return

    const next = this.getAttribute('track-click') === 'jump'
      ? this.#valueAt(event.clientX)
      : drag.startValue + ((event.clientX - drag.startX) / this.#railArea.getBoundingClientRect().width) * (this.#max - this.#min)
    this.#setValue(next)
    event.preventDefault()
  }

  #finishDrag(event: PointerEvent) {
    const drag = this.#drag
    if (!drag || drag.pointerId !== event.pointerId) return
    this.#drag = undefined
    delete this.#control.dataset.dragging
    if (this.#control.hasPointerCapture(event.pointerId)) this.#control.releasePointerCapture(event.pointerId)
    if (this.#value !== drag.startValue) this.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
  }

  #handleKeydown(event: KeyboardEvent) {
    if (event.target !== this || this.#isDisabled) return
    delete this.#control.dataset.pointerFocus

    const page = Math.max(this.#step, (this.#max - this.#min) / 10)
    let next: number | undefined
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp': next = this.#value + this.#step; break
      case 'ArrowLeft':
      case 'ArrowDown': next = this.#value - this.#step; break
      case 'PageUp': next = this.#value + page; break
      case 'PageDown': next = this.#value - page; break
      case 'Home': next = this.#min; break
      case 'End': next = this.#max; break
      default: return
    }

    event.preventDefault()
    if (this.#setValue(next)) this.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
  }
}

export function register_a_slider() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-slider')) customElements.define('a-slider', ASliderElement)
}

register_a_slider()
