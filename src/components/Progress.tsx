import type { BaseProps } from "../general_types"
import { hasChildren, toneStyle, roundStyle, roundAttr } from "../anta_helpers"

export interface ProgressProps extends BaseProps {
  /** Current progress value. Omit this prop, or pass `false`, to show
   * indeterminate progress. Negative values are clamped to 0. */
  value?: number | false
  /** Upper bound of the range.
   *  @defaultValue 100 */
  max?: number
  /** Color variant, or any literal CSS color for a one-off custom tone (the
   *  surface / indicator / text are derived from it in oklch). Named tones track
   *  light/dark automatically.
   *  @defaultValue 'neutral' */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Size variant. Scales the track and the default label row together.
   *  @defaultValue medium */
  size?: 'small' | 'medium' | 'large'
  /** Fully-round track (`border-radius: 999px`); the fill is clipped to it. Pass a
   *  `number` (px) or a CSS length string for a custom radius. */
  round?: boolean | number | string
  /** Text label displayed after the percentage, or on its own for
   *  indeterminate progress. When you provide custom `children` (which replace
   *  the default label row), `label` is no longer rendered — but it still
   *  supplies the progressbar's accessible name. */
  label?: string
  /** Right-aligned hint text (e.g. "3 of 7"). Like `label`, it's not rendered
   *  when custom `children` are provided but still feeds the accessible name. */
  hint?: string
}

/**
 * Progress indicator for task completion and indeterminate work.
 *
 * Renders an `<a-progress>` web component with an optional label area
 * showing percentage, text label, and hint.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only)
 * to register the underlying custom element.
 *
 * @example Basic usage
 * ```tsx
 * import { Progress } from '@antadesign/anta'
 * import '@antadesign/anta/elements'
 *
 * <Progress value={60} />
 * ```
 *
 * @example With label and hint
 * ```tsx
 * <Progress value={42} label="Uploading files..." hint="3 of 7" />
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
  const numericValue = typeof value === 'number' ? value : 0
  const percent = max > 0 ? Math.round(Math.min(100, Math.max(0, (numericValue / max) * 100))) : 0
  // Clamp the announced value to [0, max] so screen readers never report an
  // out-of-range progress (e.g. "150 of 100") that contradicts the visually
  // clamped bar and the percentage shown in the label.
  const clampedValue = max > 0 ? Math.min(max, Math.max(0, numericValue)) : 0
  // ARIA wiring is added here in the wrapper, not in the web component
  // (see AGENTS.md "ARIA goes in JSX wrappers"). The aria-label echoes
  // every visible piece — label text, percentage, and hint — so screen
  // readers announce what sighted users see, in one phrase. Indeterminate
  // progress omits the ARIA value attributes, matching native `<progress>`.
  const ariaLabel = [label, !indeterminate && `${percent}%`, hint].filter(Boolean).join(" · ")
    || (indeterminate ? "Loading" : undefined)
  return (
    <a-progress
      value={indeterminate ? false : numericValue}
      max={max}
      tone={tone && tone !== 'neutral' ? tone : undefined}
      size={size && size !== 'medium' ? size : undefined}
      round={roundAttr(round)}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : clampedValue}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : max}
      aria-label={ariaLabel}
      class={className}
      style={roundStyle(round, '--progress-round', toneStyle(tone, '--progress-tone-source', style))}
      {...rest}
    >
      {hasChildren(children) ? children : (
        <a-progress-label>
          {!indeterminate && <a-progress-number>{percent}%</a-progress-number>}
          {label != null && <a-progress-text>{label}</a-progress-text>}
          {hint != null && <a-progress-hint>{hint}</a-progress-hint>}
        </a-progress-label>
      )}
    </a-progress>
  )
}
