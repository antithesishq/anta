import { finiteNumber, HTMLElementBase, isModifiedNavigationKey } from '../anta_helpers'
import './a-slider.css'

const precisionOf = (value: number) => {
  const exponent = value.toString().match(/(?:\.(\d+))?(?:e([+-]?\d+))?$/i)
  return Math.max(0, (exponent?.[1]?.length ?? 0) - Number(exponent?.[2] ?? 0))
}

type SliderValue = number | [number, number]

const parseSliderValue = (source: string | null, fallback: number): SliderValue => {
  if (source === null || !source.trim()) return fallback
  const parts = source.trim().split(/\s+/)
  if (parts.length !== 1 && parts.length !== 2) return fallback
  const numbers = parts.map(Number)
  if (!numbers.every(Number.isFinite)) return fallback
  return numbers.length === 2 ? [numbers[0], numbers[1]] : numbers[0]
}

const serializeSliderValue = (value: SliderValue) => Array.isArray(value) ? value.join(' ') : String(value)

const sameSliderValue = (left: SliderValue, right: SliderValue) =>
  Array.isArray(left) && Array.isArray(right)
    ? left[0] === right[0] && left[1] === right[1]
    : !Array.isArray(left) && !Array.isArray(right) && left === right

/**
 * `<a-slider>` is a form-associated single-value or range slider. Its rail uses relative
 * dragging by default: pressing any point captures the pointer, while only the
 * subsequent horizontal movement changes the value. Set `track-click="jump"`
 * for the conventional position-based track click.
 */
export class ASliderElement extends HTMLElementBase {
  static formAssociated = true
  static observedAttributes = [
    'value', 'defaultvalue', 'min', 'max', 'step', 'disabled', 'track-click',
    'value-display', 'value-prefix', 'value-suffix', 'inverted', 'name', 'aria-label', 'aria-labelledby',
  ]

  private internals?: ElementInternals
  #control: HTMLDivElement
  #railArea: HTMLDivElement
  #fill: HTMLDivElement
  #fillEnd: HTMLDivElement
  #thumb: HTMLDivElement
  #thumbEnd: HTMLDivElement
  #header: HTMLDivElement
  #label: HTMLSlotElement
  #inlineValue: HTMLSpanElement
  #inlineValuePrefix: HTMLSpanElement
  #inlineValueSuffix: HTMLSpanElement
  #endValue: HTMLSpanElement
  #endValuePrefix: HTMLSpanElement
  #endValueSuffix: HTMLSpanElement
  #thumbValue: HTMLSpanElement
  #thumbValueEnd: HTMLSpanElement
  #thumbValuePrefix: HTMLSpanElement
  #thumbValueSuffix: HTMLSpanElement
  #thumbValueEndPrefix: HTMLSpanElement
  #thumbValueEndSuffix: HTMLSpanElement
  #markers: HTMLSlotElement
  #extras: HTMLSlotElement
  #value: SliderValue = 0
  #physicalValues: [number, number] = [0, 0]
  #orderReversed = false
  #lastActiveThumb = 0
  #seeded = false
  #dirty = false
  #drag?: { pointerId: number; startX: number; startValue: number; startPublicValue: SliderValue; thumb: number }

  get value(): SliderValue {
    return Array.isArray(this.#value) ? [...this.#value] as [number, number] : this.#value
  }

  set value(value: SliderValue | string) {
    this.setAttribute('value', Array.isArray(value) ? value.join(' ') : String(value))
  }

  get defaultValue(): SliderValue {
    return parseSliderValue(this.getAttribute('defaultvalue'), this.#min)
  }

  set defaultValue(value: SliderValue | string) {
    this.setAttribute('defaultvalue', Array.isArray(value) ? value.join(' ') : String(value))
  }

  constructor() {
    super()
    this.internals = this.attachInternals?.()

    const shadow = this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = `
      :host {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 1px;
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
        block-size: var(--anta-slider-control-size);
        border-radius: 4px;
        cursor: grab;
        touch-action: none;
        user-select: none;
      }
      :host([track-click="jump"]) .control { cursor: pointer; }
      .control[data-dragging] { cursor: grabbing; }
      .control[data-dragging] .thumb[data-active] { background: var(--slider-thumb-active); }
      :host(:focus-visible) .control:not([data-pointer-focus]) {
        outline: 1px solid var(--focus-ring);
        outline-offset: 0;
      }
      .rail-area {
        position: absolute;
        inset-block-start: 50%;
        inset-inline: calc(var(--anta-slider-thumb-size) / 2);
        block-size: var(--anta-slider-track-size);
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
        inset-inline: calc(var(--slider-track-inset) - var(--anta-slider-thumb-size) / 2);
        background: var(--slider-track);
      }
      .fill {
        inset-inline-start: calc(var(--_fill-start, 0%) + var(--_fill-start-edge, 0px));
        inset-inline-end: auto;
        inline-size: calc(var(--_fill-end, 0%) - var(--_fill-start, 0%) + var(--_fill-end-edge, 0px) - var(--_fill-start-edge, 0px));
        background: var(--slider-fill);
      }
      .thumb {
        position: absolute;
        inset-block-start: 50%;
        inset-inline-start: var(--_percent, 0%);
        box-sizing: border-box;
        inline-size: var(--anta-slider-thumb-size);
        block-size: var(--anta-slider-thumb-size);
        border: var(--anta-slider-thumb-border-width) solid var(--slider-thumb-border);
        border-radius: var(--slider-thumb-radius);
        background: var(--slider-thumb);
        transition: background-color 75ms ease-out, border-color 75ms ease-out;
        transform: translate(-50%, -50%);
      }
      .thumb[data-last-active] { z-index: 1; }
      .thumb:focus-visible {
        outline: 1px solid var(--focus-ring);
        outline-offset: 2px;
        z-index: 2;
      }
      .thumb-value {
        display: none;
        position: absolute;
        inset-inline-start: var(--_percent, 0%);
        inset-block-start: 50%;
        min-inline-size: max-content;
        color: var(--slider-value);
        font-family: var(--sans-serif);
        font-size: var(--slider-value-size);
        font-variant-numeric: tabular-nums;
        line-height: var(--slider-value-line-height);
        padding-inline: 6px;
        background: var(--bg-2);
        border: 1px solid var(--border-3);
        border-radius: 4px;
        text-align: center;
        transform: translate(-50%, calc(
          -50% - var(--anta-slider-control-size) / 2 - 1px - var(--slider-value-line-height) / 2
        ));
      }
      :host([value-display="thumb"]) .thumb-value { display: block; }
      :host([value-display="thumb"]) .thumb-value[hidden] { display: none !important; }
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
        .thumb:focus-visible { outline: 2px solid Highlight; }
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
    this.#fillEnd = document.createElement('div')
    this.#fillEnd.className = 'fill'
    this.#fillEnd.part.add('fill', 'fill-end')
    this.#thumb = document.createElement('div')
    this.#thumb.className = 'thumb'
    this.#thumb.part.add('thumb', 'thumb-1')
    this.#thumbEnd = document.createElement('div')
    this.#thumbEnd.className = 'thumb'
    this.#thumbEnd.part.add('thumb', 'thumb-2')
    this.#thumbValue = document.createElement('span')
    this.#thumbValue.className = 'thumb-value'
    this.#thumbValue.part.add('thumb-value')
    this.#thumbValuePrefix = document.createElement('span')
    this.#thumbValuePrefix.className = 'value-affix'
    this.#thumbValueSuffix = document.createElement('span')
    this.#thumbValueSuffix.className = 'value-affix'
    this.#thumbValue.append(this.#thumbValuePrefix, this.#thumbValueSuffix)
    this.#thumbValueEnd = document.createElement('span')
    this.#thumbValueEnd.className = 'thumb-value'
    this.#thumbValueEnd.part.add('thumb-value', 'thumb-value-2')
    this.#thumbValueEndPrefix = document.createElement('span')
    this.#thumbValueEndPrefix.className = 'value-affix'
    this.#thumbValueEndSuffix = document.createElement('span')
    this.#thumbValueEndSuffix.className = 'value-affix'
    this.#thumbValueEnd.append(this.#thumbValueEndPrefix, this.#thumbValueEndSuffix)
    this.#railArea.append(rail, this.#fill, this.#fillEnd, this.#thumb, this.#thumbEnd, this.#thumbValue, this.#thumbValueEnd)
    this.#control.append(this.#railArea)

    this.#markers = document.createElement('slot')
    this.#markers.name = 'markers'
    this.#markers.part.add('markers')
    this.#extras = document.createElement('slot')
    this.#extras.part.add('extras')

    for (const slot of [this.#label, this.#markers, this.#extras]) {
      slot.addEventListener('slotchange', () => {
        this.#syncSlotVisibility()
        if (slot === this.#label) this.#paintAccessibility()
      })
    }
    for (const [index, thumb] of [this.#thumb, this.#thumbEnd].entries()) {
      thumb.addEventListener('focus', () => {
        if (!Array.isArray(this.#value)) return
        this.#lastActiveThumb = index
        this.#paint()
      })
    }
    this.#control.addEventListener('pointerdown', (event) => this.#beginDrag(event))
    this.#control.addEventListener('pointermove', (event) => this.#moveDrag(event))
    this.#control.addEventListener('pointerup', (event) => this.#finishDrag(event))
    this.#control.addEventListener('pointercancel', (event) => this.#finishDrag(event))
    this.#control.addEventListener('lostpointercapture', (event) => this.#finishDrag(event))
    this.addEventListener('keydown', (event) => this.#handleKeydown(event))
    this.addEventListener('blur', () => delete this.#control.dataset.pointerFocus)

    shadow.append(style, this.#header, this.#control, this.#markers, this.#extras)
  }

  connectedCallback() {
    if (!this.#seeded) {
      this.#applyValue(this.#initialValue())
      this.#seeded = true
    }
    this.#paint()
    this.#syncSlotVisibility()
  }

  attributeChangedCallback(name: string) {
    if (!this.#seeded) return

    if (name === 'value') {
      if (this.hasAttribute('value')) {
        this.#applyValue(parseSliderValue(this.getAttribute('value'), this.#min))
        this.#dirty = false
      } else if (!this.#dirty) {
        this.#applyValue(this.#initialValue())
      }
    } else if (name === 'defaultvalue' && !this.hasAttribute('value') && !this.#dirty) {
      this.#applyValue(this.#initialValue())
    } else if (name === 'min' || name === 'max' || name === 'step') {
      this.#applyValue(this.#value)
    }

    this.#paint()
    if (name === 'value-display') this.#syncSlotVisibility()
  }

  formResetCallback() {
    const previous = this.#value
    this.#applyValue(parseSliderValue(this.getAttribute('defaultvalue'), this.#min))
    this.#dirty = false
    this.#paint()
    if (!sameSliderValue(this.#value, previous)) this.#emitInputAndChange()
  }

  formStateRestoreCallback(state: string | File | FormData | null) {
    if (typeof state !== 'string') return
    this.#applyValue(parseSliderValue(state, this.#min))
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
    return parseSliderValue(source, this.#min)
  }

  #normalize(value: number) {
    const min = this.#min
    const max = this.#max
    const step = this.#step
    const stepped = min + Math.round((Math.min(max, Math.max(min, value)) - min) / step) * step
    const precision = Math.min(12, Math.max(precisionOf(min), precisionOf(max), precisionOf(step)))
    return Number(Math.min(max, Math.max(min, stepped)).toFixed(precision))
  }

  #normalizeValue(value: SliderValue): SliderValue {
    if (!Array.isArray(value)) return this.#normalize(value)
    const low = this.#normalize(value[0])
    const high = this.#normalize(value[1])
    return low <= high ? [low, high] : [high, low]
  }

  #applyValue(value: SliderValue) {
    const next = this.#normalizeValue(value)
    const wasRange = Array.isArray(this.#value)
    this.#value = next
    if (Array.isArray(next)) {
      if (!wasRange) this.#orderReversed = false
      this.#physicalValues = this.#orderReversed ? [next[1], next[0]] : [next[0], next[1]]
    } else {
      this.#physicalValues = [next, next]
      this.#orderReversed = false
    }
  }

  #percent(value: number) {
    const range = this.#max - this.#min
    return range > 0 ? ((value - this.#min) / range) * 100 : 0
  }

  #paint() {
    const currentValue = this.#value
    const range = Array.isArray(currentValue)
    const low = range ? currentValue[0] : this.#min
    const high = range ? currentValue[1] : currentValue as number
    const lowPercent = `${this.#percent(low)}%`
    const highPercent = `${this.#percent(high)}%`
    const [first, second]: [number, number] = range ? this.#physicalValues : [high, high]
    this.#thumb.style.setProperty('--_percent', `${this.#percent(first)}%`)
    this.#thumbEnd.style.setProperty('--_percent', `${this.#percent(second)}%`)
    this.#thumb.toggleAttribute('data-last-active', this.#lastActiveThumb === 0)
    this.#thumbEnd.toggleAttribute('data-last-active', this.#lastActiveThumb === 1)
    this.#thumbValue.style.setProperty('--_percent', `${this.#percent(first)}%`)
    this.#thumbValueEnd.style.setProperty('--_percent', `${this.#percent(second)}%`)
    this.#thumbEnd.hidden = !range
    const coincident = range && first === second
    this.#thumbValue.hidden = coincident && this.#lastActiveThumb !== 0
    this.#thumbValueEnd.hidden = !range || coincident && this.#lastActiveThumb !== 1

    const edgeStart = 'calc(var(--slider-track-inset) - var(--anta-slider-thumb-size) / 2)'
    const edgeEnd = 'calc(var(--anta-slider-thumb-size) / 2 - var(--slider-track-inset))'
    const setFill = (fill: HTMLDivElement, start: string, end: string, startEdge = '0px', endEdge = '0px') => {
      fill.style.setProperty('--_fill-start', start)
      fill.style.setProperty('--_fill-end', end)
      fill.style.setProperty('--_fill-start-edge', startEdge)
      fill.style.setProperty('--_fill-end-edge', endEdge)
    }
    if (this.hasAttribute('inverted')) {
      this.#fill.hidden = range ? low === this.#min : high === this.#max
      setFill(this.#fill, range ? '0%' : highPercent, range ? lowPercent : '100%', range ? edgeStart : high === this.#min ? edgeStart : '0px', range ? '0px' : edgeEnd)
      this.#fillEnd.hidden = !range || high === this.#max
      if (range) setFill(this.#fillEnd, highPercent, '100%', '0px', edgeEnd)
    } else {
      this.#fill.hidden = range ? low === high : high === this.#min
      setFill(this.#fill, range ? lowPercent : '0%', highPercent, range && low !== this.#min ? '0px' : edgeStart, range && high === this.#max ? edgeEnd : '0px')
      this.#fillEnd.hidden = true
    }

    this.#renderValue(this.#inlineValue, this.#inlineValuePrefix, this.#inlineValueSuffix, range ? low : high, range ? high : undefined)
    this.#renderValue(this.#endValue, this.#endValuePrefix, this.#endValueSuffix, range ? low : high, range ? high : undefined)
    this.#renderValue(this.#thumbValue, this.#thumbValuePrefix, this.#thumbValueSuffix, first)
    if (range) this.#renderValue(this.#thumbValueEnd, this.#thumbValueEndPrefix, this.#thumbValueEndSuffix, second)
    this.#paintAccessibility()
    this.#paintFormValue()
  }

  #renderValue(element: HTMLElement, prefixElement: HTMLElement, suffixElement: HTMLElement, first: number, second?: number) {
    const prefix = this.getAttribute('value-prefix') ?? ''
    const suffix = this.getAttribute('value-suffix') ?? ''
    element.textContent = String(first)
    prefixElement.textContent = prefix
    suffixElement.textContent = suffix
    element.prepend(prefixElement)
    element.append(suffixElement)
    if (second === undefined) return
    const secondPrefix = prefixElement.cloneNode(true)
    const secondSuffix = suffixElement.cloneNode(true)
    element.append('–', secondPrefix, String(second), secondSuffix)
  }

  #formatValue(value: number) {
    const prefix = this.getAttribute('value-prefix') ?? ''
    const suffix = this.getAttribute('value-suffix') ?? ''
    return `${prefix}${value}${suffix}`
  }

  #paintAccessibility() {
    const range = Array.isArray(this.#value)
    const slottedLabel = this.#label.assignedNodes({ flatten: true }).map((node) => node.textContent ?? '').join('').trim()
    const root = this.getRootNode() as Document | ShadowRoot
    const referencedLabel = (this.getAttribute('aria-labelledby') ?? '').split(/\s+/)
      .map((id) => root.getElementById(id)?.textContent?.trim() ?? '').filter(Boolean).join(' ')
    const base = (this.getAttribute('aria-label') ?? referencedLabel ?? slottedLabel).trim() || slottedLabel
    const internals = this.internals
    if (internals) {
      internals.role = range ? 'group' : 'slider'
      internals.ariaLabel = !this.hasAttribute('aria-label') && !this.hasAttribute('aria-labelledby') ? slottedLabel || null : null
      internals.ariaValueMin = range ? null : String(this.#min)
      internals.ariaValueMax = range ? null : String(this.#max)
      internals.ariaValueNow = range ? null : String(this.#value)
      internals.ariaValueText = range ? null : this.#formatValue(this.#value as number)
    }

    for (const [index, thumb] of [this.#thumb, this.#thumbEnd].entries()) {
      if (!range) {
        thumb.removeAttribute('role')
        thumb.tabIndex = -1
        thumb.removeAttribute('aria-label')
        thumb.removeAttribute('aria-valuemin')
        thumb.removeAttribute('aria-valuemax')
        thumb.removeAttribute('aria-valuenow')
        thumb.removeAttribute('aria-valuetext')
        thumb.removeAttribute('aria-disabled')
        continue
      }
      const endpoint = (index === 0) !== this.#orderReversed ? 'minimum' : 'maximum'
      const value = this.#physicalValues[index]
      thumb.role = 'slider'
      thumb.tabIndex = this.#isDisabled ? -1 : 0
      thumb.ariaLabel = base ? `${base} ${endpoint}` : `${endpoint[0].toUpperCase()}${endpoint.slice(1)} value`
      thumb.ariaValueMin = String(this.#min)
      thumb.ariaValueMax = String(this.#max)
      thumb.ariaValueNow = String(value)
      thumb.ariaValueText = this.#formatValue(value)
      thumb.ariaDisabled = this.#isDisabled ? 'true' : null
    }
  }

  #paintFormValue() {
    const internals = this.internals
    if (!internals) return
    const state = serializeSliderValue(this.#value)
    if (this.#isDisabled) {
      internals.setFormValue(null, state)
    } else if (Array.isArray(this.#value)) {
      const formValue = new FormData()
      const name = this.getAttribute('name')
      if (name) {
        formValue.append(name, String(this.#value[0]))
        formValue.append(name, String(this.#value[1]))
      }
      internals.setFormValue(formValue, state)
    } else {
      internals.setFormValue(state, state)
    }
  }

  #syncSlotVisibility() {
    const assigned = (slot: HTMLSlotElement) => slot.assignedNodes({ flatten: true }).length > 0
    this.#header.hidden = !assigned(this.#label) && this.getAttribute('value-display') === 'none'
    this.#markers.hidden = !assigned(this.#markers)
    this.#extras.hidden = !assigned(this.#extras)
  }

  #setValue(value: number, thumb = 0) {
    const next = this.#normalize(value)
    if (Array.isArray(this.#value)) {
      const previous = this.#value
      this.#physicalValues[thumb] = next
      if (this.#physicalValues[0] !== this.#physicalValues[1]) {
        this.#orderReversed = this.#physicalValues[0] > this.#physicalValues[1]
      }
      this.#value = this.#orderReversed
        ? [this.#physicalValues[1], this.#physicalValues[0]]
        : [this.#physicalValues[0], this.#physicalValues[1]]
      this.#lastActiveThumb = thumb
      this.#paint()
      if (sameSliderValue(previous, this.#value)) return false
    } else {
      if (next === this.#value) return false
      this.#value = next
      this.#physicalValues = [next, next]
      this.#paint()
    }
    this.#dirty = true
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    return true
  }

  #emitInputAndChange() {
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
  }

  #valueAt(clientX: number) {
    const rect = this.#railArea.getBoundingClientRect()
    if (rect.width <= 0) return Array.isArray(this.#value) ? this.#physicalValues[this.#lastActiveThumb] : this.#value
    return this.#min + ((clientX - rect.left) / rect.width) * (this.#max - this.#min)
  }

  #thumbAt(clientX: number) {
    if (!Array.isArray(this.#value)) return 0
    const candidate = this.#valueAt(clientX)
    const firstDistance = Math.abs(candidate - this.#physicalValues[0])
    const secondDistance = Math.abs(candidate - this.#physicalValues[1])
    return firstDistance === secondDistance ? this.#lastActiveThumb : firstDistance < secondDistance ? 0 : 1
  }

  #beginDrag(event: PointerEvent) {
    if (this.#isDisabled || event.button !== 0) return
    const rect = this.#railArea.getBoundingClientRect()
    if (rect.width <= 0) return

    const thumb = event.composedPath()[0] === this.#thumb ? 0
      : event.composedPath()[0] === this.#thumbEnd ? 1
      : this.#thumbAt(event.clientX)
    const startValue = Array.isArray(this.#value) ? this.#physicalValues[thumb] : this.#value
    this.#drag = { pointerId: event.pointerId, startX: event.clientX, startValue, startPublicValue: this.value, thumb }
    this.#control.setPointerCapture(event.pointerId)
    this.#control.dataset.dragging = ''
    this.#control.dataset.pointerFocus = ''
    this.#lastActiveThumb = thumb
    this.#thumb.toggleAttribute('data-last-active', thumb === 0)
    this.#thumbEnd.toggleAttribute('data-last-active', thumb === 1)
    const focusTarget = Array.isArray(this.#value) ? [this.#thumb, this.#thumbEnd][thumb] : this
    focusTarget.focus({ preventScroll: true })
    ;[this.#thumb, this.#thumbEnd][thumb].dataset.active = ''

    if (this.getAttribute('track-click') === 'jump') this.#setValue(this.#valueAt(event.clientX), thumb)
    event.preventDefault()
  }

  #moveDrag(event: PointerEvent) {
    const drag = this.#drag
    if (!drag || drag.pointerId !== event.pointerId) return
    // A release outside the window may arrive only as a button-free move.
    if (!(event.buttons & 1)) {
      this.#finishDrag(event)
      return
    }

    const next = this.getAttribute('track-click') === 'jump'
      ? this.#valueAt(event.clientX)
      : drag.startValue + ((event.clientX - drag.startX) / this.#railArea.getBoundingClientRect().width) * (this.#max - this.#min)
    this.#setValue(next, drag.thumb)
    event.preventDefault()
  }

  #finishDrag(event: PointerEvent) {
    const drag = this.#drag
    if (!drag || drag.pointerId !== event.pointerId) return
    this.#drag = undefined
    delete this.#control.dataset.dragging
    delete [this.#thumb, this.#thumbEnd][drag.thumb].dataset.active
    if (this.#control.hasPointerCapture(event.pointerId)) this.#control.releasePointerCapture(event.pointerId)
    if (!sameSliderValue(this.#value, drag.startPublicValue)) this.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
  }

  #handleKeydown(event: KeyboardEvent) {
    const source = event.composedPath()[0]
    const range = Array.isArray(this.#value)
    const thumb = source === this.#thumb ? 0 : source === this.#thumbEnd ? 1 : undefined
    if ((range ? thumb === undefined : source !== this) || this.#isDisabled || isModifiedNavigationKey(event)) return
    delete this.#control.dataset.pointerFocus

    const page = Math.max(this.#step, (this.#max - this.#min) / 10)
    const current = range ? this.#physicalValues[thumb ?? 0] : this.#value as number
    let next: number | undefined
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp': next = current + this.#step; break
      case 'ArrowLeft':
      case 'ArrowDown': next = current - this.#step; break
      case 'PageUp': next = current + page; break
      case 'PageDown': next = current - page; break
      case 'Home': next = this.#min; break
      case 'End': next = this.#max; break
      default: return
    }

    event.preventDefault()
    if (this.#setValue(next, range ? thumb ?? 0 : 0)) this.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
  }
}

export function register_a_slider() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-slider')) customElements.define('a-slider', ASliderElement)
}

register_a_slider()
