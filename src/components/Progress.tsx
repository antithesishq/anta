import type { BaseProps } from "../general_types"
import { hasChildren, neutralToneAttr, toneStyle, roundStyle, roundAttr } from "../anta_helpers"

export interface ProgressProps extends BaseProps {
  /** Completed amount relative to `max`. Omit this prop or pass `false` to show
   *  a loading animation without a percentage. Values are clamped to the range;
   *  non-finite values show zero completion. */
  value?: number | false
  /** Total amount to complete. Use a positive number to show a count, such as
   *  3 of 7 files. When `value` is supplied, a non-positive or non-finite total
   *  shows an empty fill.
   *  @defaultValue 100 */
  max?: number
  /** Color for the track, fill, and label row. Pass a named tone or a CSS color.
   *  Named tones follow the current theme.
   *  @defaultValue 'neutral' */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Size variant. Scales the track and the default label row together.
   *  @defaultValue medium */
  size?: 'small' | 'medium' | 'large'
  /** Pill-shaped track. Pass a number in pixels or a CSS length for a custom
   *  corner radius. */
  round?: boolean | number | string
  /** Task name shown after the percentage, or on its own during loading.
   *  Custom `children` replace the label row; this prop still supplies the
   *  progressbar's accessible name. */
  label?: string
  /** Details shown at the end of the row, such as "3 of 7" or a time estimate.
   *  Included in the accessible name even when custom `children` replace the row. */
  hint?: string
}

/**
 * Shows task completion with a percentage, label, and optional hint.
 *
 * Use `value` and `max` when the total is known. Omit `value` for a loading
 * animation. Custom children replace the default label row while `label` and
 * `hint` retain an accessible description of the task.
 *
 * @example Basic usage
 * ```tsx
 * import { Progress } from '@antadesign/anta/bundle'
 *
 * <Progress value={60} />
 * ```
 *
 * @example With label and hint
 * ```tsx
 * <Progress value={3} max={7} label="Uploading files..." hint="3 of 7" />
 * ```
 *
 * @example Indeterminate
 * ```tsx
 * <Progress label="Preparing upload..." />
 * ```
 *
 * @example Info tone
 * ```tsx
 * <Progress value={75} tone="info" label="Processing" />
 * ```
 */
export const Progress = ({ value, max = 100, tone, size, round, label, hint, className, style, children, ...rest }: ProgressProps) => {
  const indeterminate = value == null || value === false
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : 0
  const validMax = Number.isFinite(max) && max > 0
  const fillPercent = validMax ? Math.min(100, Math.max(0, (numericValue / max) * 100)) : 0
  const percent = Math.round(fillPercent)
  // Keep the announced value within the same range as the fill.
  const clampedValue = validMax ? Math.min(max, Math.max(0, numericValue)) : 0
  // Retain the task description when custom children replace the label row.
  const ariaLabel = [label, !indeterminate && `${percent}%`, hint].filter(Boolean).join(" · ")
    || (indeterminate ? "Loading" : undefined)
  const progressStyle = indeterminate ? style : {
    '--progress-value': numericValue,
    '--progress-max': validMax ? max : 0,
    ...style,
  }
  return (
    <a-progress
      value={indeterminate ? false : numericValue}
      max={max}
      tone={neutralToneAttr(tone)}
      size={size && size !== 'medium' ? size : undefined}
      round={roundAttr(round)}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : clampedValue}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : validMax ? max : 100}
      aria-label={ariaLabel}
      class={className}
      style={roundStyle(round, '--progress-round', toneStyle(tone, '--progress-tone-source', progressStyle))}
      {...rest}
    >
      {hasChildren(children) ? children : (
        <a-progress-label>
          {!indeterminate && <a-progress-number>{`${percent}%`}</a-progress-number>}
          {label != null && <a-progress-text>{label}</a-progress-text>}
          {hint != null && <a-progress-hint>{hint}</a-progress-hint>}
        </a-progress-label>
      )}
    </a-progress>
  )
}
