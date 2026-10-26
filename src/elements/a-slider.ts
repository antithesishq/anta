import { finiteNumber, HTMLElementBase, isModifiedNavigationKey } from '../anta_helpers'
import './a-slider.css'
import type { SliderChangeAttrs } from '../components/Slider'
import { referencedElements } from './shadow-aria'
import { upgradeValueProperties } from './value-input'

const precisionOf = (value: number) => {
  const exponent = value.toString().match(/(?:\.(\d+))?(?:e([+-]?\d+))?$/i)
  return Math.max(0, (exponent?.[1]?.length ?? 0) - Number(exponent?.[2] ?? 0))
}

type SliderValue = number | [number, number]

const parseSliderValue = (source: string | null, fallback: SliderValue): SliderValue => {
  if (source === null || !source.trim()) return fallback
  const parts = source.trim().split(/\s+/)
  if (parts.length !== 1 && parts.length !== 2) return fallback
  const numbers = parts.map(Number)
  if (!numbers.every(Number.isFinite)) return fallback
  return numbers.length === 2 ? [numbers[0], numbers[1]] : numbers[0]
}

const serializeSliderValue = (value: SliderValue | string) => Array.isArray(value) ? value.join(' ') : String(value)

const sameSliderValue = (left: SliderValue, right: SliderValue) =>
  Array.isArray(left) && Array.isArray(right)
    ? left[0] === right[0] && left[1] === right[1]
    : !Array.isArray(left) && !Array.isArray(right) && left === right

/**
 * `<a-slider>` is a form-associated single-value or range slider. Its rail uses relative
 * dragging by default: pressing any point captures the pointer, while only the
 * subsequent horizontal movement changes the value. Set `track-click="jump"`
 * for the conventional position-based track click.
 *
 * The `value` attribute is the controlled input; `default-value` seeds uncontrolled
 * state. Consumer property assignments reflect these inputs; interaction never
 * rewrites them. Reading the `value` property returns the applied result.
 * Input/change event details contain numeric request snapshots, including rejected controlled requests. Defaults require external
 * Slider CSS in the same document or consumer shadow root as the host.
 */
export class ASliderElement extends HTMLElementBase {
  static formAssociated = true
  static observedAttributes = [
    'value', 'default-value', 'min', 'max', 'step', 'disabled', 'track-click',
    'value-display', 'value-prefix', 'value-suffix', 'inverted', 'name', 'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-description',
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
  // Match an accepted range request to the physical thumb that produced it.
  #pendingRequest?: { value: SliderValue; reversed: boolean }
  #endpointLabels: HTMLSpanElement[] = []
  #accessibilityDirty = true
  #accessibilityState?: { range: boolean; reversed: boolean; disabled: boolean }
  #accessibilityReferences: { id: string; element: Element }[] = []
  #accessibilityUnresolved = false
  #drag?: { pointerId: number; startX: number; clientX: number; startValue: number; startPublicValue: SliderValue; thumb: number; requested?: SliderValue; lastInput?: SliderValue }

  #onPointerDown = (event: PointerEvent) => {
    if (event.composedPath().includes(this.#control)) this.#beginDrag(event)
  }
  #onPointerMove = (event: PointerEvent) => this.#moveDrag(event)
  #onPointerEnd = (event: PointerEvent) => this.#finishDrag(event)
  #onKeyDown = (event: KeyboardEvent) => this.#handleKeydown(event)
  // Run the default action after consumer listeners on this host, including
  // listeners added after connection. Ancestors may stop propagation.
  #orderDefaultAction = (event: Event) => {
    const handler = event.type === 'keydown' ? this.#onKeyDown : event.type === 'pointerdown' ? this.#onPointerDown : this.#onPointerMove
    this.removeEventListener(event.type, handler as EventListener)
    this.addEventListener(event.type, handler as EventListener)
  }

  get value(): SliderValue {
    return Array.isArray(this.#value) ? [...this.#value] as [number, number] : this.#value
  }

  set value(value: SliderValue | string | null | undefined) {
    // Preact clears a removed property with an empty string.
    const next = value == null || value === '' ? null : serializeSliderValue(value)
    if (this.getAttribute('value') === next) return
    if (next === null) this.removeAttribute('value')
    else this.setAttribute('value', next)
  }

  get defaultValue(): SliderValue {
    return parseSliderValue(this.getAttribute('default-value'), this.#fallbackValue())
  }

  set defaultValue(value: SliderValue | string | null | undefined) {
    if (value == null) this.removeAttribute('default-value')
    else this.setAttribute('default-value', serializeSliderValue(value))
  }

  constructor() {
    super()
    this.internals = this.attachInternals?.()

    const shadow = this.attachShadow({ mode: 'open' })
    this.#header = document.createElement('div')
    this.#header.className = 'header'
    this.#header.part.add('header')

    this.#label = document.createElement('slot')
    this.#label.name = 'label'
    this.#label.part.add('label')
    const separator = document.createElement('span')
    separator.className = 'inline-separator'
    separator.part.add('value-separator')
    separator.textContent = ':'
    this.#inlineValue = document.createElement('span')
    this.#inlineValue.className = 'inline-value'
    this.#inlineValue.part.add('value', 'inline-value')
    this.#inlineValuePrefix = document.createElement('span')
    this.#inlineValuePrefix.className = 'value-affix'
    this.#inlineValuePrefix.part.add('value-affix')
    this.#inlineValueSuffix = document.createElement('span')
    this.#inlineValueSuffix.className = 'value-affix'
    this.#inlineValueSuffix.part.add('value-affix')
    this.#inlineValue.append(this.#inlineValuePrefix, this.#inlineValueSuffix)
    this.#endValue = document.createElement('span')
    this.#endValue.className = 'end-value'
    this.#endValue.part.add('value', 'end-value')
    this.#endValuePrefix = document.createElement('span')
    this.#endValuePrefix.className = 'value-affix'
    this.#endValuePrefix.part.add('value-affix')
    this.#endValueSuffix = document.createElement('span')
    this.#endValueSuffix.className = 'value-affix'
    this.#endValueSuffix.part.add('value-affix')
    this.#endValue.append(this.#endValuePrefix, this.#endValueSuffix)
    this.#header.append(this.#label, separator, this.#inlineValue, this.#endValue)

    this.#control = document.createElement('div')
    this.#control.className = 'control'
    this.#control.part.add('control')
    this.#railArea = document.createElement('div')
    this.#railArea.className = 'rail-area'
    this.#railArea.part.add('rail-area')
    const rail = document.createElement('div')
    rail.className = 'rail'
    rail.part.add('track')
    this.#fill = document.createElement('div')
    this.#fill.className = 'fill'
    this.#fill.part.add('fill', 'fill-start')
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
    this.#thumbValue.part.add('thumb-value', 'thumb-value-1')
    this.#thumbValuePrefix = document.createElement('span')
    this.#thumbValuePrefix.className = 'value-affix'
    this.#thumbValuePrefix.part.add('value-affix')
    this.#thumbValueSuffix = document.createElement('span')
    this.#thumbValueSuffix.className = 'value-affix'
    this.#thumbValueSuffix.part.add('value-affix')
    this.#thumbValue.append(this.#thumbValuePrefix, this.#thumbValueSuffix)
    this.#thumbValueEnd = document.createElement('span')
    this.#thumbValueEnd.className = 'thumb-value'
    this.#thumbValueEnd.part.add('thumb-value', 'thumb-value-2')
    this.#thumbValueEndPrefix = document.createElement('span')
    this.#thumbValueEndPrefix.className = 'value-affix'
    this.#thumbValueEndPrefix.part.add('value-affix')
    this.#thumbValueEndSuffix = document.createElement('span')
    this.#thumbValueEndSuffix.className = 'value-affix'
    this.#thumbValueEndSuffix.part.add('value-affix')
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
        if (slot === this.#label) {
          this.#accessibilityDirty = true
          this.#paintAccessibility()
        }
      })
    }
    for (const [index, thumb] of [this.#thumb, this.#thumbEnd].entries()) {
      thumb.addEventListener('focus', () => {
        if (!Array.isArray(this.#value)) return
        this.#lastActiveThumb = index
        this.#paint()
      })
    }
    this.#control.addEventListener('pointerup', this.#onPointerEnd)
    this.#control.addEventListener('pointercancel', this.#onPointerEnd)
    this.#control.addEventListener('lostpointercapture', this.#onPointerEnd)
    this.addEventListener('blur', () => { delete this.#control.dataset.pointerFocus; this.#paintStates() })

    for (const thumb of [this.#thumb, this.#thumbEnd]) {
      const endpoint = document.createElement('span')
      endpoint.hidden = true
      thumb.append(endpoint)
      this.#endpointLabels.push(endpoint)
    }
    shadow.append(this.#header, this.#control, this.#markers, this.#extras)
    upgradeValueProperties(this)
  }

  connectedCallback() {
    this.#accessibilityDirty = true
    for (const type of ['pointerdown', 'keydown', 'pointermove']) this.addEventListener(type, this.#orderDefaultAction, true)
    if (!this.#seeded) {
      this.#applyValue(this.#initialValue())
      this.#seeded = true
    }
    this.#paint()
    this.#syncSlotVisibility()
  }

  disconnectedCallback() {
    this.#endDrag(false)
    for (const type of ['pointerdown', 'keydown', 'pointermove']) this.removeEventListener(type, this.#orderDefaultAction, true)
    this.removeEventListener('pointerdown', this.#onPointerDown as EventListener)
    this.removeEventListener('keydown', this.#onKeyDown as EventListener)
    this.removeEventListener('pointermove', this.#onPointerMove as EventListener)
    this.#pendingRequest = undefined
    delete this.#control.dataset.pointerFocus
    this.#paintStates()
  }

  adoptedCallback() {
    this.disconnectedCallback()
  }

  attributeChangedCallback(name: string, previous: string | null, next: string | null) {
    if (!this.#seeded) return
    // Repeated controlled inputs must not rebase an active rejected drag.
    if (name === 'value' && previous === next) return
    if (name.startsWith('aria-')) this.#accessibilityDirty = true
    if (name === 'value') {
      if (next === null && previous !== null) {
        this.#dirty = true
        this.#pendingRequest = undefined
        this.#rebaseDrag()
      } else this.#syncInput()
    } else if (name === 'default-value') {
      if (!this.#controlled && !this.#dirty) this.#syncInput()
    } else if (name === 'min' || name === 'max' || name === 'step') {
      if (this.#controlled) this.#syncInput()
      else {
        this.#applyValue(this.#value)
        this.#rebaseDrag()
      }
    }
    if (this.#isDisabled) this.#endDrag(true)
    this.#paint()
    if (name === 'value-display') this.#syncSlotVisibility()
  }

  #syncInput() {
    const next = this.#normalizeValue(this.#initialValue())
    const pending = this.#pendingRequest
    if (pending && sameSliderValue(pending.value, next)) this.#orderReversed = pending.reversed
    else this.#rebaseDrag(next)
    this.#pendingRequest = undefined
    this.#applyValue(next)
    this.#paint()
  }

  formResetCallback() {
    this.#endDrag(false)
    this.#pendingRequest = undefined
    if (this.#controlled) return
    const previous = this.#value
    this.#applyValue(this.defaultValue)
    this.#dirty = false
    this.#paint()
    if (!sameSliderValue(this.#value, previous)) this.#emitInputAndChange()
  }

  formStateRestoreCallback(state: string | File | FormData | null) {
    if (typeof state !== 'string') return
    if (this.#controlled) return
    this.#endDrag(false)
    this.#pendingRequest = undefined
    this.#applyValue(parseSliderValue(state, this.#fallbackValue()))
    this.#dirty = true
    this.#paint()
  }

  formDisabledCallback() {
    if (this.#isDisabled) this.#endDrag(true)
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

  get #controlled() {
    return this.hasAttribute('value')
  }

  #fallbackValue(): SliderValue {
    const range = Array.isArray(this.#value) ||
      Array.isArray(parseSliderValue(this.getAttribute('value'), this.#min))
    return range ? [this.#min, this.#max] : this.#min
  }

  #initialValue() {
    if (this.#controlled) return parseSliderValue(this.getAttribute('value'), this.#fallbackValue())
    return this.defaultValue
  }

  #normalize(value: number) {
    const min = this.#min
    const max = this.#max
    const step = this.#step
    const stepped = min + Math.round((Math.min(max, Math.max(min, value)) - min) / step) * step
    const precision = Math.max(precisionOf(min), precisionOf(max), precisionOf(step))
    const rounded = precision <= 100 ? Number(stepped.toFixed(precision)) : Number(stepped.toPrecision(15))
    return Math.min(max, Math.max(min, rounded))
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
    this.#paintStates()
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

  #paintStates() {
    const states = this.internals?.states
    if (!states) return
    const set = (name: string, enabled: boolean) => enabled ? states.add(name) : states.delete(name)
    set('dragging', !!this.#drag)
    set('pointer-focus', this.#control.hasAttribute('data-pointer-focus'))
    set('thumb-1-active', this.#lastActiveThumb === 0)
    set('thumb-2-active', this.#lastActiveThumb === 1)
    for (const [name, element] of [
      ['has-header', this.#header], ['has-markers', this.#markers], ['has-extras', this.#extras],
      ['has-fill', this.#fill], ['has-fill-end', this.#fillEnd],
      ['has-thumb-value', this.#thumbValue], ['has-thumb-value-end', this.#thumbValueEnd],
    ] as const) set(name, !element.hidden)
    set('range', Array.isArray(this.#value))
  }

  #paintAccessibility() {
    const range = Array.isArray(this.#value)
    const disabled = this.#isDisabled
    const previous = this.#accessibilityState
    // Replaced or renamed ID targets must refresh on the next paint, as before.
    const root = this.getRootNode()
    const referencesChanged = this.#accessibilityReferences.some(({ id, element }) => element.id !== id || element.getRootNode() !== root)
    if (this.#accessibilityDirty || this.#accessibilityUnresolved || referencesChanged || !previous || previous.range !== range || previous.disabled !== disabled || (range && previous.reversed !== this.#orderReversed)) {
      this.#syncAccessibility(range, disabled)
      this.#accessibilityDirty = false
      this.#accessibilityState = { range, reversed: this.#orderReversed, disabled }
    }
    const internals = this.internals
    if (internals) {
      internals.ariaValueMin = range ? null : String(this.#min)
      internals.ariaValueMax = range ? null : String(this.#max)
      internals.ariaValueNow = range ? null : String(this.#value)
      internals.ariaValueText = range ? null : this.#formatValue(this.#value as number)
    }
    if (!range) return
    for (const [index, thumb] of [this.#thumb, this.#thumbEnd].entries()) {
      thumb.ariaValueMin = String(this.#min)
      thumb.ariaValueMax = String(this.#max)
      thumb.ariaValueNow = String(this.#physicalValues[index])
      thumb.ariaValueText = this.#formatValue(this.#physicalValues[index])
    }
  }

  #syncAccessibility(range: boolean, disabled: boolean) {
    // Reflected element references follow label text edits without rebinding on value changes.
    const referenced = referencedElements(this, this.getAttribute('aria-labelledby') ?? '')
    const labels = referenced.length ? referenced : this.#label.assignedElements({ flatten: true })
    const explicit = referenced.length ? null : this.getAttribute('aria-label')
    const descriptions = range ? referencedElements(this, this.getAttribute('aria-describedby') ?? '') : []
    this.#accessibilityReferences = [...referenced, ...descriptions].map(element => ({ id: element.id, element }))
    const ids = [this.getAttribute('aria-labelledby'), range ? this.getAttribute('aria-describedby') : null].flatMap(value => value?.match(/\S+/g) ?? [])
    this.#accessibilityUnresolved = ids.length !== this.#accessibilityReferences.length
    const internals = this.internals
    if (internals) {
      internals.role = range ? 'group' : 'slider'
      internals.ariaLabelledByElements = explicit == null && !this.hasAttribute('aria-labelledby') ? labels : []
      internals.ariaDisabled = disabled ? 'true' : null
    }

    for (const [index, thumb] of [this.#thumb, this.#thumbEnd].entries()) {
      if (!range) {
        for (const name of ['role', 'aria-label', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'aria-disabled', 'aria-description']) thumb.removeAttribute(name)
        thumb.ariaLabelledByElements = []
        thumb.ariaDescribedByElements = []
        thumb.tabIndex = -1
        continue
      }
      const endpoint = (index === 0) !== this.#orderReversed ? 'minimum' : 'maximum'
      const endpointLabel = this.#endpointLabels[index]
      endpointLabel.textContent = explicit != null ? `${explicit} ${endpoint}` : labels.length ? endpoint : `${endpoint[0].toUpperCase()}${endpoint.slice(1)} value`
      thumb.role = 'slider'
      thumb.tabIndex = disabled ? -1 : 0
      thumb.ariaLabelledByElements = explicit != null ? [endpointLabel] : [...labels, endpointLabel]
      thumb.ariaDescribedByElements = descriptions
      thumb.ariaDescription = this.getAttribute('aria-description')
      thumb.ariaDisabled = disabled ? 'true' : null
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
    this.#paintStates()
  }

  #snapshot(value: SliderValue): SliderChangeAttrs<SliderValue> {
    return { value: Array.isArray(value) ? [...value] : value, min: this.#min, max: this.#max, step: this.#step, name: this.getAttribute('name') ?? undefined }
  }

  #notify(type: 'input' | 'change', value = this.#value) {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail: this.#snapshot(value) }))
  }

  #setValue(value: number, thumb = 0) {
    const next = this.#normalize(value)
    const physical: [number, number] = [...this.#physicalValues]
    physical[thumb] = next
    const reversed = physical[0] === physical[1] ? this.#orderReversed : physical[0] > physical[1]
    const requested: SliderValue = Array.isArray(this.#value)
      ? reversed ? [physical[1], physical[0]] : physical
      : next
    if (sameSliderValue(this.#drag?.lastInput ?? this.#value, requested)) return false
    if (this.#drag) this.#drag.requested = this.#drag.lastInput = requested
    this.#pendingRequest = this.#controlled ? { value: requested, reversed } : undefined
    if (!this.#controlled) {
      this.#orderReversed = reversed
      this.#applyValue(requested)
      this.#dirty = true
      this.#paint()
    }
    this.#notify('input', requested)
    return requested
  }

  #emitInputAndChange() {
    this.#notify('input')
    this.#notify('change')
  }

  #rebaseDrag(value = this.#value) {
    const drag = this.#drag
    if (!drag) return
    drag.startX = drag.clientX
    drag.startValue = Array.isArray(value) ? value[this.#orderReversed ? 1 - drag.thumb : drag.thumb] : value
    drag.lastInput = undefined
  }

  #valueAt(clientX: number) {
    const rect = this.#railArea.getBoundingClientRect()
    if (rect.width <= 0) return Array.isArray(this.#value) ? this.#physicalValues[this.#lastActiveThumb] : this.#value
    const ratio = this.#rtl() ? (rect.right - clientX) / rect.width : (clientX - rect.left) / rect.width
    return this.#min + ratio * (this.#max - this.#min)
  }

  #thumbAt(clientX: number) {
    if (!Array.isArray(this.#value)) return 0
    const candidate = this.#valueAt(clientX)
    const firstDistance = Math.abs(candidate - this.#physicalValues[0])
    const secondDistance = Math.abs(candidate - this.#physicalValues[1])
    return firstDistance === secondDistance ? this.#lastActiveThumb : firstDistance < secondDistance ? 0 : 1
  }

  #rtl() {
    return this.ownerDocument.defaultView?.getComputedStyle(this).direction === 'rtl'
  }

  #beginDrag(event: PointerEvent) {
    if (event.defaultPrevented || this.#drag || this.#isDisabled || event.button !== 0) return
    const rect = this.#railArea.getBoundingClientRect()
    if (rect.width <= 0) return

    const thumb = event.composedPath()[0] === this.#thumb ? 0
      : event.composedPath()[0] === this.#thumbEnd ? 1
      : this.#thumbAt(event.clientX)
    const startValue = Array.isArray(this.#value) ? this.#physicalValues[thumb] : this.#value
    this.#drag = { pointerId: event.pointerId, startX: event.clientX, clientX: event.clientX, startValue, startPublicValue: this.value, thumb }
    try { this.#control.setPointerCapture(event.pointerId) } catch { this.#drag = undefined; return }
    this.#control.dataset.dragging = ''
    this.#control.dataset.pointerFocus = ''
    this.#lastActiveThumb = thumb
    this.#thumb.toggleAttribute('data-last-active', thumb === 0)
    this.#thumbEnd.toggleAttribute('data-last-active', thumb === 1)
    const focusTarget = Array.isArray(this.#value) ? [this.#thumb, this.#thumbEnd][thumb] : this
    focusTarget.focus({ preventScroll: true })
    ;[this.#thumb, this.#thumbEnd][thumb].dataset.active = ''

    if (this.getAttribute('track-click') === 'jump') this.#setValue(this.#valueAt(event.clientX), thumb)
    this.#paintStates()
    event.preventDefault()
  }

  #moveDrag(event: PointerEvent) {
    const drag = this.#drag
    if (!drag || drag.pointerId !== event.pointerId) return
    if (this.#isDisabled) { this.#endDrag(true); return }
    if (event.defaultPrevented) return
    drag.clientX = event.clientX
    const width = this.#railArea.getBoundingClientRect().width
    if (width <= 0) return
    // A release outside the window may arrive only as a button-free move.
    if (!(event.buttons & 1)) {
      this.#finishDrag(event)
      return
    }

    const next = this.getAttribute('track-click') === 'jump'
      ? this.#valueAt(event.clientX)
      : drag.startValue + ((event.clientX - drag.startX) * (this.#rtl() ? -1 : 1) / width) * (this.#max - this.#min)
    this.#setValue(next, drag.thumb)
    event.preventDefault()
  }

  #finishDrag(event: PointerEvent) {
    if (this.#drag?.pointerId === event.pointerId) this.#endDrag(true)
  }

  #endDrag(commit: boolean) {
    const drag = this.#drag
    if (!drag) return
    this.#drag = undefined
    delete this.#control.dataset.dragging
    delete [this.#thumb, this.#thumbEnd][drag.thumb].dataset.active
    if (this.#control.hasPointerCapture(drag.pointerId)) this.#control.releasePointerCapture(drag.pointerId)
    this.#paintStates()
    const value = drag.requested
    if (commit && value !== undefined && !sameSliderValue(value, drag.startPublicValue)) this.#notify('change', value)
  }

  #handleKeydown(event: KeyboardEvent) {
    const source = event.composedPath()[0]
    const range = Array.isArray(this.#value)
    const thumb = source === this.#thumb ? 0 : source === this.#thumbEnd ? 1 : undefined
    if (event.defaultPrevented || !event.composedPath().includes(this) || (range ? thumb === undefined : source !== this) || this.#isDisabled || isModifiedNavigationKey(event)) return
    delete this.#control.dataset.pointerFocus
    this.#paintStates()

    const page = Math.max(this.#step, (this.#max - this.#min) / 10)
    const current = range ? this.#physicalValues[thumb ?? 0] : this.#value as number
    let next: number | undefined
    switch (event.key) {
      case 'ArrowRight': next = current + (this.#rtl() ? -this.#step : this.#step); break
      case 'ArrowUp': next = current + this.#step; break
      case 'ArrowLeft': next = current + (this.#rtl() ? this.#step : -this.#step); break
      case 'ArrowDown': next = current - this.#step; break
      case 'PageUp': next = current + page; break
      case 'PageDown': next = current - page; break
      case 'Home': next = this.#min; break
      case 'End': next = this.#max; break
      default: return
    }

    event.preventDefault()
    const requested = this.#setValue(next, range ? thumb ?? 0 : 0)
    if (requested !== false) this.#notify('change', requested)
  }
}

export function register_a_slider() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-slider')) customElements.define('a-slider', ASliderElement)
}

register_a_slider()
