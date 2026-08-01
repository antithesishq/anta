import type { BaseProps, DOMEventHandlers } from '../general_types'
import { toneStyle, roundStyle, roundAttr, lengthStyle, cssLength } from '../anta_helpers'

/** A text marker displayed below the slider rail. Markers are labels only; they
 * do not add dots or ticks to the rail. */
export interface SliderMarker {
  value: number
  label: React.ReactNode
}

/** Snapshot passed to `onValueChange` and `onValueCommit`. */
export interface SliderChangeAttrs {
  value: number
  min: number
  max: number
  step: number
  name?: string
}

export interface SliderProps extends BaseProps, DOMEventHandlers {
  /** Visible field label, shown above the rail. A string supplies the slider's
   * accessible name; give a rich label an explicit `aria-label`. */
  label?: React.ReactNode
  /** Controlled value. Update it from `onValueChange`. */
  value?: number
  /** Initial uncontrolled value.
   * @defaultValue 0 */
  defaultValue?: number
  /** Lowest permitted value.
   * @defaultValue 0 */
  min?: number
  /** Highest permitted value.
   * @defaultValue 100 */
  max?: number
  /** Smallest keyboard and drag increment.
   * @defaultValue 1 */
  step?: number
  /** Form field name. The current numeric value submits under this name. */
  name?: string
  /** Disables pointer and keyboard interaction. */
  disabled?: boolean
  /** Colour of the filled rail. Pass a named tone or a literal CSS colour for a
   * one-off custom tone. The unfilled rail stays neutral.
   * @defaultValue 'neutral' */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Colour of the thumb stroke. Pass a named tone or a literal CSS colour for a
   * one-off custom tone. Omit it to keep the thumb neutral.
   * @defaultValue 'neutral' */
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
   * @defaultValue 18 */
  thumbSize?: number | string
  /** Fill the thumb with its resolved border colour. This follows `thumbTone`
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
  /** Track press behaviour. `drag-only` starts a relative grab from the current
   * value; `jump` first moves to the press position.
   * @defaultValue 'drag-only' */
  trackClick?: 'drag-only' | 'jump'
  /** Fires on every keyboard or pointer value change. */
  onValueChange?: (event: any, attrs: SliderChangeAttrs) => void
  /** Fires after a drag ends and after each keyboard value change. */
  onValueCommit?: (event: any, attrs: SliderChangeAttrs) => void
}

const number = (value: number | undefined, fallback: number) => Number.isFinite(value) ? value! : fallback
const isStringish = (node: React.ReactNode) => typeof node === 'string' || typeof node === 'number'

const bounds = (min: number | undefined, max: number | undefined) => {
  const low = number(min, 0)
  return { min: low, max: Math.max(low, number(max, 100)) }
}

const attrsOf = (event: any): SliderChangeAttrs => {
  const element = event?.target ?? {}
  return {
    value: Number(element.value ?? 0),
    min: Number(element.getAttribute?.('min') ?? 0),
    max: Number(element.getAttribute?.('max') ?? 100),
    step: Number(element.getAttribute?.('step') ?? 1),
    name: element.getAttribute?.('name') ?? undefined,
  }
}

/**
 * Slider selects one numeric value from a range. Pressing anywhere on its rail
 * starts a relative drag by default, so the thumb never jumps to the press point.
 * Requires `@antadesign/anta/elements` on the client.
 */
export const Slider = ({
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
  onInput,
  onChange,
  onValueChange,
  onValueCommit,
  className,
  style,
  children,
  tabIndex,
  ...rest
}: SliderProps) => {
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
        const attrs = attrsOf(event)
        onInput?.(event)
        onValueChange?.(event, attrs)
      }
    : undefined
  const handleChange = onChange || onValueCommit
    ? (event: any) => {
        const attrs = attrsOf(event)
        onChange?.(event)
        onValueCommit?.(event, attrs)
      }
    : undefined

  return (
    <a-slider
      value={value}
      defaultvalue={defaultValue}
      min={min}
      max={max}
      step={step}
      name={name}
      disabled={disabled ? '' : undefined}
      tone={tone && tone !== 'neutral' ? tone : undefined}
      thumb-tone={thumbTone && thumbTone !== 'neutral' ? thumbTone : undefined}
      size={size && size !== 'medium' ? size : undefined}
      track-size={trackSizeValue}
      thumb-size={thumbSizeValue}
      thumb-fill={thumbFill ? '' : undefined}
      round={roundAttr(round)}
      track-click={trackClick === 'jump' ? 'jump' : undefined}
      value-display={resolvedValueDisplay === 'end' ? undefined : resolvedValueDisplay}
      value-prefix={valuePrefix}
      value-suffix={valueSuffix}
      role="slider"
      aria-label={ariaLabel}
      tabIndex={disabled ? -1 : (tabIndex ?? 0)}
      oninput={handleInput}
      onchange={handleChange}
      class={className}
      style={computedStyle}
      {...rest}
    >
      {label != null &&
        (isStringish(label) ? (
          <span slot="label">{label}</span>
        ) : (
          <span slot="label" style={{ display: 'contents' }}>{label}</span>
        ))}
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
