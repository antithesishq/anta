import type { BaseProps } from "../general_types"
import { hasChildren } from "../anta_helpers"

interface ProgressProps extends BaseProps {
  /** Current progress. Negative values are clamped to 0. */
  value: number
  /** Upper bound of the range. Defaults to 100. Negative values are clamped to 0. */
  max?: number
  tone?: 'neutral' | 'info'
  label?: string
  hint?: string
}

export const Progress = ({ value, max = 100, tone, label, hint, className, children, ...rest }: ProgressProps) => {
  const percent = max > 0 ? Math.round(Math.min(100, Math.max(0, (value / max) * 100))) : 0
  return (
    <a-progress
      value={value}
      max={max}
      tone={tone}
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
