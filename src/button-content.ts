import { Fragment } from './jsx-runtime'
import { isEmptyLabelValue } from './anta_helpers'
import { Tooltip } from './components/Tooltip'

/** @internal Inspect known JSX content without evaluating child components. */
export function hasButtonContent(children: React.ReactNode): boolean {
  if (isEmptyLabelValue(children)) return false
  if (Array.isArray(children)) return children.some(hasButtonContent)
  if (typeof children === 'object' && children != null && 'type' in children) {
    if (children.type === Tooltip || children.type === 'a-tooltip' || children.type === 'a-copy') return false
    if (children.type === Fragment) {
      return hasButtonContent((children.props as { children?: React.ReactNode }).children)
    }
  }
  return true
}
