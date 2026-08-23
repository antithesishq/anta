import type { BaseProps } from '../general_types'

/** Named Anta color tone for a loader. */
export type LoaderTone =
  | 'neutral'
  | 'brand'
  | 'info'
  | 'success'
  | 'warning'
  | 'critical'

export interface LoaderProps extends BaseProps {
  /** Color tone for the loader. Omit it to use the standard text-3 color. */
  tone?: LoaderTone
  /** Current progress value. Omit this prop, or pass `false`, for an
   * indeterminate rotating gradient. */
  value?: number | false
  /** Upper bound of the range.
   * @defaultValue 100 */
  max?: number
  /** Width and height in pixels.
   * @defaultValue 16 */
  size?: number
  /** Seconds per rotation. Pass a positive number.
   * @defaultValue 0.75 */
  speed?: number
  /** Accessible name for a standalone loader. Without a label, the loader is
   * decorative so nearby status text remains the single announcement. */
  label?: string
}

/**
 * Animated, icon-sized feedback for loading work.
 *
 * Omit `value` for the rotating gradient. Pass `value` to fill a static circle
 * to the current proportion. `shape="loader"` provides the indeterminate
 * visual for string-only icon props such as `Button`'s `icon`.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only) to
 * register the underlying custom element.
 *
 * @example Indeterminate
 * ```tsx
 * <Loader label="Loading results" />
 * ```
 *
 * @example Determinate
 * ```tsx
 * <Loader value={42} label="Uploading files" />
 * ```
 */
export const Loader = ({ tone, value, max = 100, size, speed, label, className, style, ...rest }: LoaderProps) => {
  const determinate = typeof value === 'number' && Number.isFinite(value)
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100
  const clampedValue = determinate ? Math.min(safeMax, Math.max(0, value)) : undefined
  const percentage = clampedValue != null ? (clampedValue / safeMax) * 100 : undefined
  const computedStyle = {
    ...style,
    ...(size != null ? { ['--loader-size' as string]: `${size}px` } : {}),
    ...(!determinate && speed != null && Number.isFinite(speed) && speed > 0
      ? { ['--loader-speed' as string]: `${speed}s` }
      : {}),
    ...(percentage != null ? { ['--loader-value' as string]: `${percentage}%` } : {}),
  } as React.CSSProperties
  const a11y = label != null
    ? {
        role: 'progressbar',
        'aria-label': label,
        'aria-valuenow': determinate ? clampedValue : undefined,
        'aria-valuemin': determinate ? 0 : undefined,
        'aria-valuemax': determinate ? safeMax : undefined,
      }
    : { 'aria-hidden': 'true' as const }

  return (
    <a-loader
      tone={tone}
      {...(determinate ? { value: clampedValue } : {})}
      class={className}
      style={computedStyle}
      {...a11y}
      {...rest}
    />
  )
}
