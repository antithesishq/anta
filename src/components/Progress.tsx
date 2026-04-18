import cn from "classnames"
import css from "./Progress.module.css"
import type { BaseProps } from "../general_types"
import { hasChildren } from "../anta_helpers"

interface ProgressProps extends BaseProps {
  value: number
  max?: number
  tone?: 'info'
  label?: string
  hint?: string
}

export const Progress = ({ value, max = 100, tone, label, hint, className, children, ...rest }: ProgressProps) => {
  const percent = max > 0 ? Math.round(Math.min(100, (value / max) * 100)) : 0
  return (
    <a-progress
      value={value}
      max={max}
      tone={tone}
      class={cn(css.container, className)}
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
