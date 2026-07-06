import type { BaseProps } from "../general_types"
import { hasChildren, toneStyle, roundStyle } from "../anta_helpers"

export interface ProgressProps extends BaseProps {
  /** Current progress value. Negative values are clamped to 0. */
  value: number
  /** Upper bound of the range.
   *  @defaultValue 100 */
  max?: number
  /** Colour variant, or any literal CSS colour for a one-off custom tone (the
   *  surface / indicator / text are derived from it in oklch). Named tones track
   *  light/dark automatically.
   *  @defaultValue 'neutral' */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Fully-round track (`border-radius: 999px`); the fill is clipped to it. Pass a
   *  `number` (px) or a CSS length string for a custom radius. */
  round?: boolean | number | string
  /** Text label displayed after the percentage. When you provide custom
   *  `children` (which replace the default label row), `label` is no longer
   *  rendered — but it still supplies the progressbar's accessible name, so
   *  pass it for screen readers to announce more than the bare percentage. */
  label?: string
  /** Right-aligned hint text (e.g. "3 of 7"). Like `label`, it's not rendered
   *  when custom `children` are provided but still feeds the accessible name. */
  hint?: string
}

/**
 * Progress indicator for displaying task completion.
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
 * @example Info tone
 * ```tsx
 * <Progress value={75} tone="info" label="Processing" />
 * ```
 */
export const Progress = ({ value, max = 100, tone, round, label, hint, className, style, children, ...rest }: ProgressProps) => {
  const percent = max > 0 ? Math.round(Math.min(100, Math.max(0, (value / max) * 100))) : 0
  // Clamp the announced value to [0, max] so screen readers never report an
  // out-of-range progress (e.g. "150 of 100") that contradicts the visually
  // clamped bar and the percentage shown in the label.
  const clampedValue = max > 0 ? Math.min(max, Math.max(0, value)) : 0
  // ARIA wiring is added here in the wrapper, not in the web component
  // (see CLAUDE.md "ARIA goes in JSX wrappers"). The aria-label echoes
  // every visible piece — label text, percentage, and hint — so screen
  // readers announce what sighted users see, in one phrase. The role
  // and aria-value* attributes are still set independently for tooling
  // that prefers them.
  const ariaLabel = [label, `${percent}%`, hint].filter(Boolean).join(' · ') || undefined
  return (
    <a-progress
      value={value}
      max={max}
      tone={tone && tone !== 'neutral' ? tone : undefined}
      round={round ? '' : undefined}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={ariaLabel}
      class={className}
      style={roundStyle(round, '--progress-round', toneStyle(tone, '--progress-tone-source', style))}
      {...rest}
    >
      {hasChildren(children) ? children : (
        <a-progress-label>
          <a-progress-number>{percent}%</a-progress-number>
          {label != null && <a-progress-text>{label}</a-progress-text>}
          {hint != null && <a-progress-hint>{hint}</a-progress-hint>}
        </a-progress-label>
      )}
    </a-progress>
  )
}
