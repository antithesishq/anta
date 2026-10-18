import { useNativeEventProps } from '../native-event-props'
import type { BaseProps, DOMEventHandlers } from '../general_types'
import { valueAttributes, unwrapNativeEvent, neutralToneAttr, toneStyle, roundStyle, roundAttr, lengthStyle, cssLength } from '../anta_helpers'

/** A text marker displayed below the slider rail. Markers are labels only; they
 * do not add dots or ticks to the rail. */
export interface SliderMarker {
  value: number
  label: React.ReactNode
}

/** Two endpoints of a range slider. */
export type SliderRangeValue = [number, number]
export type SliderValue = number | SliderRangeValue

/** Snapshot passed to `onValueChange` and `onValueCommit`. */
export interface SliderChangeAttrs<T extends SliderValue = number> {
  value: T
  min: number
  max: number
  step: number
  name?: string
}

export interface SliderProps extends BaseProps, DOMEventHandlers {
  /** Visible field label, shown above the rail. A string supplies the slider's
   * accessible name; give a rich label an explicit `aria-label`. */
  label?: React.ReactNode
  /** Controlled numeric value. A pair selects a range, ordered low to high.
   * Omit or pass `undefined` for uncontrolled use; `0` stays controlled.
   * Takes precedence over `defaultValue`, including on form reset. Values are
   * clamped to the bounds and rounded to a step measured from `min`.
   * Releasing control retains the last applied value. There is no empty numeric state. */
  value?: number | SliderRangeValue
  /** Initial uncontrolled value and form-reset baseline. Changes while pristine
   * update the value; after interaction they affect the next reset. Without a
   * default, scalar reset uses `min` and range reset uses `[min, max]`.
   * @defaultValue min */
  defaultValue?: number | SliderRangeValue
  /** Lowest permitted value and step origin. Nonfinite values use 0.
   * @defaultValue 0 */
  min?: number
  /** Highest permitted value. A lower bound than `min` collapses the range to
   * `min`. Nonfinite values use 100.
   * @defaultValue 100 */
  max?: number
  /** Smallest keyboard and drag increment. Nonpositive and nonfinite values
   * use 1. Page keys move by at least one step, or one tenth of the range.
   * @defaultValue 1 */
  step?: number
  /** Form field name. A range submits two values under this name. */
  name?: string
  /** Disables pointer and keyboard interaction. */
  disabled?: boolean
  /** Color of the filled rail. Pass a named tone or a literal CSS color for a
   * one-off custom tone. The unfilled rail stays neutral.
   * @defaultValue 'neutral' */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Color of the thumb stroke. Pass a named tone or a literal CSS color for a
   * one-off custom tone. An explicit `neutral` keeps the thumb neutral in every theme.
   * @defaultValue 'neutral' (the Antithesis theme follows `tone`) */
  thumbTone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Size variant. small=24px, medium=28px, large=32px tall.
   * @defaultValue 'medium' */
  size?: 'small' | 'medium' | 'large'
  /** Thickness of both rail segments. Numbers use pixels; strings are CSS
   * lengths. Keep it no larger than the thumb diameter.
   * @defaultValue 2 */
  trackSize?: number | string
  /** Diameter of the thumb. Numbers use pixels; strings are CSS lengths. Keep
   * it at least as large as `trackSize`.
   * @defaultValue 16 */
  thumbSize?: number | string
  /** Fill the thumb with its resolved border color. This follows `thumbTone`
   * and interactive states.
   * @defaultValue false */
  thumbFill?: boolean
  /** Fully round the rail and thumb. Pass a number (px) or CSS length string
   * for a shared custom radius. */
  round?: boolean | number | string
  /** Where the live value appears. `end` puts it at the right edge of the label
   * row. `inline` renders `Label: value`. `thumb` keeps it above the thumb.
   * @defaultValue 'end' */
  valueDisplay?: 'end' | 'inline' | 'thumb' | 'none'
  /** Text inserted before the live numeric value, such as `$`. */
  valuePrefix?: string
  /** Text inserted after the live numeric value, such as `%` or `°C`. */
  valueSuffix?: string
  /** Compact text labels positioned below the rail. They do not add dots or
   * ticks to the rail. */
  markers?: SliderMarker[]
  /** Controls what happens when the rail is pressed. `drag-only` starts dragging
   * from the current value. `jump` first moves to the pressed position.
   * @defaultValue 'drag-only' */
  trackClick?: 'drag-only' | 'jump'
  /** Fill the rail outside the selected value or range. */
  inverted?: boolean
  /** Reports each distinct requested value during a drag and each keyboard step.
   * `onInput` runs first. The snapshot contains the requested value and effective
   * constraints; the element's `value` remains the applied value. Controlled
   * sliders accept by updating `value` and reject by leaving it unchanged.
   * Events are notifications; `preventDefault()` does not veto a value request. */
  onValueChange?: (event: any, attrs: SliderChangeAttrs<SliderValue>) => void
  /** Reports the final requested value after a drag, cancellation, or capture loss,
   * and after each keyboard step. `onChange` runs first. A drag ending at its
   * starting value is silent. Controlled requests can commit without being accepted.
   * Uncontrolled form reset emits both callbacks when it changes the value;
   * state restoration and application updates are silent. */
  onValueCommit?: (event: any, attrs: SliderChangeAttrs<SliderValue>) => void
}

type TypedSliderProps<T extends SliderValue> = Omit<
  SliderProps,
  'value' | 'defaultValue' | 'onValueChange' | 'onValueCommit'
> & {
  value?: T
  defaultValue?: T
  onValueChange?: (event: any, attrs: SliderChangeAttrs<T>) => void
  onValueCommit?: (event: any, attrs: SliderChangeAttrs<T>) => void
}

const number = (value: number | undefined, fallback: number) => Number.isFinite(value) ? value! : fallback

const bounds = (min: number | undefined, max: number | undefined) => {
  const low = number(min, 0)
  return { min: low, max: Math.max(low, number(max, 100)) }
}

const attrsOf = <T extends SliderValue>(event: any): SliderChangeAttrs<T> | undefined => {
  const native = unwrapNativeEvent<CustomEvent<SliderChangeAttrs<T>>>(event)
  if (native.target && native.currentTarget && native.target !== native.currentTarget) return
  const attrs = native.detail
  if (!attrs || typeof attrs.min !== 'number' || typeof attrs.max !== 'number' || typeof attrs.step !== 'number') return
  return { ...attrs, value: Array.isArray(attrs.value) ? [...attrs.value] as T : attrs.value }
}

/**
 * Slider selects one numeric value or a pair of range endpoints. Pressing anywhere on its rail
 * starts a relative drag by default, so the thumb never jumps to the press point.
 * Requires `@antadesign/anta/elements` on the client.
 */
export const Slider = <T extends SliderValue = number>({
  label,
  value,
  defaultValue,
  min: minProp,
  max: maxProp,
  step: stepProp,
  name,
  disabled,
  tone,
  thumbTone,
  size,
  trackSize,
  thumbSize,
  thumbFill,
  round,
  valueDisplay = 'end',
  valuePrefix,
  valueSuffix,
  markers,
  trackClick = 'drag-only',
  inverted,
  onInput,
  onChange,
  onValueChange,
  onValueCommit,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  className,
  style,
  children,
  tabIndex,
  ...rest
}: TypedSliderProps<T>) => {
  const trackSizeValue = cssLength(trackSize)
  const thumbSizeValue = cssLength(thumbSize)
  const computedStyle = lengthStyle(
    thumbSize,
    '--anta-slider-thumb-size',
    lengthStyle(
      trackSize,
      '--anta-slider-track-size',
      roundStyle(
        round,
        '--slider-round',
        toneStyle(thumbTone, '--slider-thumb-tone-source', toneStyle(tone, '--slider-tone-source', style)),
      ),
    ),
  )
  const { min, max } = bounds(minProp, maxProp)
  const step = number(stepProp, 1) > 0 ? number(stepProp, 1) : 1
  const explicitAriaLabel = rest['aria-label']
  const ariaLabel =
    (typeof explicitAriaLabel === 'string' ? explicitAriaLabel : undefined) ??
    (typeof label === 'string' || typeof label === 'number' ? String(label) : undefined)
  const controlled = value !== undefined
  const range = Array.isArray(controlled ? value : defaultValue)
  const serializeValue = (input: T | undefined): string | undefined =>
    Array.isArray(input) ? `${input[0]} ${input[1]}` : typeof input === 'number' ? String(input) : undefined
  const resolvedValueDisplay = valueDisplay === 'inline' && label == null ? 'end' : valueDisplay
  const markerPosition = (marker: SliderMarker) => {
    if (marker.value <= min) return '0%'
    if (marker.value >= max) return '100%'
    const ratio = (marker.value - min) / (max - min)
    return `calc((100% - var(--anta-slider-thumb-size)) * ${ratio} + var(--anta-slider-thumb-size) / 2)`
  }
  const markerAlignment = (marker: SliderMarker) =>
    marker.value <= min ? 'start' : marker.value >= max ? 'end' : undefined
  const markerStyle = (marker: SliderMarker) => {
    const markerStyle: React.CSSProperties = {}
    Object.assign(markerStyle, { '--slider-marker-position': markerPosition(marker) })
    return markerStyle
  }

  const handleInput = onInput || onValueChange
    ? (event: any) => {
        const attrs = attrsOf<T>(event)
        onInput?.(event)
        if (attrs) onValueChange?.(event, attrs)
      }
    : undefined
  const handleChange = onChange || onValueCommit
    ? (event: any) => {
        const attrs = attrsOf<T>(event)
        onChange?.(event)
        if (attrs) onValueCommit?.(event, attrs)
      }
    : undefined

  const events = useNativeEventProps({ oninput: handleInput, onchange: handleChange, onkeydown: onKeyDown, onpointerdown: onPointerDown, onpointermove: onPointerMove })

  return (
    <a-slider
      {...valueAttributes(serializeValue(value), serializeValue(defaultValue))}
      min={min}
      max={max}
      step={step}
      name={name}
      disabled={disabled ? '' : undefined}
      tone={neutralToneAttr(tone)}
      thumb-tone={thumbTone || undefined}
      size={size && size !== 'medium' ? size : undefined}
      track-size={trackSizeValue}
      thumb-size={thumbSizeValue}
      thumb-fill={thumbFill ? '' : undefined}
      round={roundAttr(round)}
      track-click={trackClick === 'jump' ? 'jump' : undefined}
      inverted={inverted ? '' : undefined}
      value-display={resolvedValueDisplay === 'end' ? undefined : resolvedValueDisplay}
      value-prefix={valuePrefix}
      value-suffix={valueSuffix}
      role={range ? 'group' : 'slider'}
      aria-label={ariaLabel}
      tabIndex={disabled || range ? -1 : (tabIndex ?? 0)}
      {...events}
      class={className}
      style={computedStyle}
      {...rest}
    >
      {label != null && <span slot="label">{label}</span>}
      {markers?.map((marker, index) => {
        const alignment = markerAlignment(marker)
        return (
          <span
            key={`${marker.value}-${index}`}
            slot="markers"
            style={markerStyle(marker)}
            data-slider-marker-start={alignment === 'start' ? '' : undefined}
            data-slider-marker-end={alignment === 'end' ? '' : undefined}
          >
            {marker.label}
          </span>
        )
      })}
      {children}
    </a-slider>
  )
}
