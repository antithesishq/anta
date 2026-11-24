import type { BaseAttributes } from '@antadesign/anta/general_types'

/** Attributes of `<a-table>`, the root a `Table` renders. */
export interface ATableAttributes extends BaseAttributes {
  title?: string
  /** Present when rows render through a virtualizer, which changes how pinned columns stay in place. */
  virtual?: boolean | ''
  /** Change to scroll the descendant matching `reveal-target` into view. Ignored by virtualized tables. */
  'reveal-key'?: string
  'reveal-target'?: string
  /** Change to focus the descendant matching `focus-target`. */
  'focus-key'?: string
  'focus-target'?: string
}

/** A header or body cell. */
export interface ATableCellAttributes extends BaseAttributes {
  /** The column's key. */
  column?: string
  pin?: 'left' | 'right'
  /** The last left-pinned or the first right-pinned cell, which draws the pinned edge. */
  'pin-edge'?: 'left' | 'right'
  /** The column's inferred type, which aligns default cells. */
  type?: 'number' | 'boolean' | 'string' | 'other'
  /** A search match the table can only mark as a whole cell. */
  search?: 'match' | 'active'
  'data-search-active'?: boolean | ''
  'aria-sort'?: 'ascending' | 'descending' | 'none'
}

/** A body row. */
export interface ATableRowAttributes extends BaseAttributes {
  selected?: boolean | ''
  /** The last displayed row, which drops its bottom border. */
  last?: boolean | ''
  'aria-rowindex'?: number
}

declare module '@antadesign/anta/jsx-runtime' {
  interface AntaIntrinsicElements {
    'a-table': ATableAttributes
    'a-table-toolbar': BaseAttributes
    'a-table-toolbar-end': BaseAttributes
    'a-table-search': BaseAttributes
    'a-table-surface': BaseAttributes
    'a-table-space': BaseAttributes
    'a-table-frame': BaseAttributes
    'a-table-content': BaseAttributes
    'a-table-head': BaseAttributes
    'a-table-header-cell': ATableCellAttributes
    'a-table-row': ATableRowAttributes
    'a-table-cell': ATableCellAttributes
    'a-table-placeholder': BaseAttributes
    'a-table-footer': BaseAttributes
  }
}
