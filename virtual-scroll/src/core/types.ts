/** `rangechange` detail: the rows to mount, from `start` up to but not including `end`. */
export interface VirtualScrollRange {
  start: number
  end: number
}

/** `positionchange` detail, sent once scrolling settles. Feed it back through `initial-position` to restore. */
export interface VirtualScrollPosition {
  /** Row the position is anchored to. */
  anchorIndex: number
  /** Pixels from the top edge to the top of the anchor row; negative once the row's top has scrolled past. */
  deltaPixels: number
  scrollX: number
  maxScrollX: number
  stickToBottom: boolean
  atEnd: boolean
  /** Fractional index of the row at the top edge. */
  firstVisibleIndex: number
}

/** The part of a position `initial-position` restores. */
export type VirtualScrollRestorePosition = Pick<VirtualScrollPosition, 'anchorIndex' | 'deltaPixels' | 'scrollX' | 'stickToBottom'>

/** `contentsizechange` detail. `height` is null until every row has been measured. */
export interface VirtualScrollContentSize {
  height: number | null
  width: number
}

/** A horizontal span to bring into view, in content pixels, clear of insets such as pinned columns. */
export interface VirtualScrollRevealX {
  left: number
  width: number
  insetStart?: number
  insetEnd?: number
}

export type VirtualScrollWheelActivation = 'hover' | 'settled' | 'focus' | 'settled-or-focus'

/**
 * A data source that hands over a contiguous range of rows, for rows built or
 * fetched on demand. Rows are read as one range, never one index at a time.
 */
export interface VirtualScrollRangeSource<T> {
  readonly length: number
  slice(start: number, end: number): { toArray(): T[] }
}

/** Rows a virtual scroll can read: an array, or a range source. */
export type VirtualScrollSource<T> = readonly T[] | VirtualScrollRangeSource<T>

/** The row type of a source: `VirtualScrollItem<VirtualScrollRangeSource<Event>>` is `Event`. */
export type VirtualScrollItem<S> = S extends readonly (infer T)[]
  ? T
  : S extends VirtualScrollRangeSource<infer T> ? T : never

/** `initial-position`: anchor row, pixels from the top edge, horizontal offset, and `1` to keep following. */
export type VirtualScrollPositionAttribute = `${number} ${number} ${number} ${0 | 1}`

/** `reveal-x`: left, width, start inset, and end inset, in content pixels. */
export type VirtualScrollRevealXAttribute = `${number} ${number} ${number} ${number}`
