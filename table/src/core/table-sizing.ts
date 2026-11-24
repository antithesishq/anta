/** Rows the table shows before its container or `minHeight` asks for more. */
export const TABLE_MIN_ROWS = 10
/** Smallest row height, also the estimate for rows not measured yet: 22px of text and 2px padding above and below. */
export const TABLE_ROW_MIN_HEIGHT = 26
export const TABLE_HEADER_HEIGHT = 34
/** The frame's top and bottom border. */
export const TABLE_FRAME_BORDER = 2

export interface TableHeightOptions {
  /** Displayed rows. */
  count: number
  /** Minimum row height, with its border. */
  rowMinHeight: number
  /** Header height; `0` when hidden. */
  headerHeight: number
  /** Measured height of every row, when the virtualizer reports it. */
  contentHeight?: number
  /** The rows are mounted by a virtualizer, which does not size the frame to them. */
  virtual: boolean
  height?: number | 'auto'
  minHeight?: number
  maxHeight?: number
  minRows?: number
}

/** Frame heights for the stylesheet. CSS sizes the frame within them; `undefined` leaves it to the rows. */
export interface TableHeight {
  /** A fixed frame height. */
  frame?: number
  /** The room the frame asks for when its container does not size the table. */
  space?: number
  min: number
  max?: number
}

/**
 * Sizes the frame. `height`, `minHeight`, and `maxHeight` are frame heights.
 * The frame is never taller than its rows: a fixed `height` is the most it
 * takes.
 *
 * Without `height`, the frame fits its rows within its room, never below one
 * row or `minHeight`. A container that sizes the table from its content gives
 * it room for `minRows` rows, or every row when there are fewer.
 *
 * Without a virtualizer, CSS reads the rows' height from the rows. A
 * virtualizer fills whatever room it gets, so it needs the rows' measured
 * height as its limit.
 */
export function tableHeight(options: TableHeightOptions): TableHeight {
  const { count, rowMinHeight, headerHeight, virtual } = options
  const frameExtra = headerHeight + TABLE_FRAME_BORDER
  const fit = options.contentHeight === undefined ? undefined : options.contentHeight + frameExtra
  const estimate = Math.max(count, 1) * rowMinHeight + frameExtra
  if (options.height === 'auto') {
    const frame = virtual ? fit ?? estimate : undefined
    return { frame, min: 0, max: frame }
  }
  if (options.height !== undefined) {
    // Without a virtualizer, CSS fits the frame to its rows up to `height`. A virtualizer fills the height it is
    // given, so it gets the rows' measured height when that is less.
    if (!virtual) return { min: Math.min(options.height, rowMinHeight + frameExtra), max: options.height }
    const frame = Math.min(options.height, fit ?? estimate)
    return { frame, min: frame, max: frame }
  }

  const min = options.minHeight ?? rowMinHeight + frameExtra
  const max = virtual && fit !== undefined ? Math.min(fit, options.maxHeight ?? fit) : options.maxHeight
  const minRows = options.minRows ?? TABLE_MIN_ROWS
  const preferred = count > minRows ? minRows * rowMinHeight + frameExtra : virtual ? fit ?? estimate : undefined
  return {
    space: preferred === undefined ? undefined : Math.max(min, Math.min(preferred, options.maxHeight ?? preferred)),
    min,
    max,
  }
}
