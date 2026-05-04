import type { BaseProps } from "../general_types"
import { hasChildren } from "../anta_helpers"

export interface ProgressProps extends BaseProps {
  /** Current progress value. Negative values are clamped to 0. */
  value: number
  /** Upper bound of the range. Defaults to 100. */
  max?: number
  /** Color variant. `'info'` applies a blue tint. */
  tone?: 'neutral' | 'info'
  /** Text label displayed after the percentage. */
  label?: string
  /** Right-aligned hint text (e.g. "3 of 7"). */
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
export const Progress = ({ value, max = 100, tone, label, hint, className, children, ...rest }: ProgressProps) => {
  const percent = max > 0 ? Math.round(Math.min(100, Math.max(0, (value / max) * 100))) : 0
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
      tone={tone}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
      aria-label={ariaLabel}
      class={className}
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
