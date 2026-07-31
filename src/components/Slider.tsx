import type { BaseProps, DOMEventHandlers } from '../general_types'

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
  /** Helper text shown below markers. */
  hint?: React.ReactNode
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
  /** Where the live value appears. `end` puts it at the right edge of the label
   * row. `inline` renders `Label: value`. `thumb` keeps it above the thumb.
   * @defaultValue 'end' */
  valueDisplay?: 'end' | 'inline' | 'thumb' | 'none'
  /** Text inserted before the live numeric value, such as `$`. */
  valuePrefix?: string
  /** Text inserted after the live numeric value, such as `%` or `°C`. */
  valueSuffix?: string
  /** Text labels positioned below the rail, before `hint`. */
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
  hint,
  value,
  defaultValue,
  min: minProp,
  max: maxProp,
  step: stepProp,
  name,
  disabled,
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
  const { min, max } = bounds(minProp, maxProp)
  const step = number(stepProp, 1) > 0 ? number(stepProp, 1) : 1
  const explicitAriaLabel = rest['aria-label']
  const ariaLabel =
    (typeof explicitAriaLabel === 'string' ? explicitAriaLabel : undefined) ??
    (typeof label === 'string' || typeof label === 'number' ? String(label) : undefined)
  const resolvedValueDisplay = valueDisplay === 'inline' && label == null ? 'end' : valueDisplay
  const markerPosition = (marker: SliderMarker) => `${max === min ? 0 : ((Math.min(max, Math.max(min, marker.value)) - min) / (max - min)) * 100}%`
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
      style={style}
      {...rest}
    >
      {label != null && (
        <span slot="label">
          {label}
        </span>
      )}
      {markers?.length ? (
        <span slot="markers">
          {markers.map((marker, index) => (
            <span key={`${marker.value}-${index}`} style={markerStyle(marker)}>
              {marker.label}
            </span>
          ))}
        </span>
      ) : undefined}
      {children}
      {hint != null && <span slot="hint">{hint}</span>}
    </a-slider>
  )
}
