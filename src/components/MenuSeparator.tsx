import type { BaseProps } from '../general_types'

export interface MenuSeparatorProps extends BaseProps {
  /** Optional caption. With content, the separator renders as a small muted text
   *  row — a group / subsection name, or a utility message like `Loading…` — instead
   *  of a line, and the wrapper flips it to an `aria-live="polite"` status region
   *  (`role="status"`) so a changing message is announced. Empty, it's a plain divider. */
  children?: React.ReactNode
}

/**
 * MenuSeparator — a divider between groups of `MenuItem`s, or a small caption row.
 *
 * Empty, it's a thin line. Given text, it becomes a muted caption (a group name or
 * a status message) and turns into an `aria-live="polite"` region — this is what
 * `Select`'s `renderEmpty` uses for its "no results" / "loading" messages.
 *
 * @example
 * ```tsx
 * <MenuItem label="Edit" />
 * <MenuSeparator />
 * <MenuItem tone="critical" label="Delete" />
 *
 * <MenuSeparator>No results</MenuSeparator>
 * ```
 */
export const MenuSeparator = ({ className, children, ...rest }: MenuSeparatorProps) => {
  const hasContent = children != null && children !== false && children !== ''
  return (
    <a-menu-separator
      role={hasContent ? 'status' : 'separator'}
      aria-live={hasContent ? 'polite' : undefined}
      class={className}
      {...rest}
    >
      {children}
    </a-menu-separator>
  )
}
