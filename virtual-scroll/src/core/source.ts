/**
 * Typed helpers for rendering `<a-virtual-scroll>` rows. They import no
 * renderer and touch no DOM, so a worker-side renderer can use them directly.
 */
import {
  DEFAULT_HEIGHT, DEFAULT_ITEM_MIN_HEIGHT, DEFAULT_MAX_NON_VIRTUAL_ITEMS, DEFAULT_SCROLLBAR_WIDTH,
  initialState, renderRange,
} from './model'
import type {
  VirtualScrollPositionAttribute, VirtualScrollRange, VirtualScrollRestorePosition, VirtualScrollRevealX,
  VirtualScrollRevealXAttribute, VirtualScrollSource,
} from './types'

/** Reads rows `start` to `end - 1`, clamped to the source, as one range. */
export function readVirtualScrollRange<T>(source: VirtualScrollSource<T>, start: number, end: number): readonly T[] {
  const from = Math.max(0, Math.min(start, source.length))
  const to = Math.max(from, Math.min(end, source.length))
  if (isArray(source)) return source.slice(from, to)
  return source.slice(from, to).toArray()
}

/** Renders the rows in `range` with their items and indices. */
export function mapVirtualScrollRange<T, R>(
  source: VirtualScrollSource<T>,
  range: VirtualScrollRange,
  render: (item: T, index: number) => R,
): R[] {
  const start = Math.max(0, range.start)
  return readVirtualScrollRange(source, start, range.end).map((item, offset) => render(item, start + offset))
}

// `Array.isArray` does not narrow a readonly array out of a union.
function isArray<T>(source: VirtualScrollSource<T>): source is readonly T[] {
  return Array.isArray(source)
}

export interface InitialRangeOptions {
  count: number
  follow?: boolean
  height?: number
  maxHeight?: number
  itemMinHeight?: number
  maxNonVirtualItems?: number
  initialPosition?: Pick<VirtualScrollRestorePosition, 'anchorIndex'>
}

/**
 * The rows to mount before the element reports its first range. It matches the
 * element's own first window, so the first `rangechange` usually asks for what
 * is already mounted.
 */
export function initialVirtualScrollRange(options: InitialRangeOptions): VirtualScrollRange {
  const follow = !!options.follow
  const state = initialState({ count: options.count, follow })
  if (options.initialPosition) state.anchorIndex = Math.max(0, Math.min(options.initialPosition.anchorIndex, options.count - 1))
  return renderRange(state, {
    count: options.count,
    itemMinHeight: options.itemMinHeight ?? DEFAULT_ITEM_MIN_HEIGHT,
    maxNonVirtualItems: options.maxNonVirtualItems ?? DEFAULT_MAX_NON_VIRTUAL_ITEMS,
    heightPx: options.height ?? options.maxHeight ?? DEFAULT_HEIGHT,
    rowsWidth: 0,
    contentWidth: 0,
    scrollbarWidth: DEFAULT_SCROLLBAR_WIDTH,
    follow,
  })
}

/** Formats a position for `initial-position`. */
export function virtualScrollPositionAttribute(position: VirtualScrollRestorePosition): VirtualScrollPositionAttribute {
  return `${position.anchorIndex} ${position.deltaPixels} ${position.scrollX} ${position.stickToBottom ? 1 : 0}`
}

/** Formats a horizontal reveal target for `reveal-x`. */
export function virtualScrollRevealXAttribute(target: VirtualScrollRevealX): VirtualScrollRevealXAttribute {
  return `${target.left} ${target.width} ${target.insetStart ?? 0} ${target.insetEnd ?? 0}`
}

/** Formats row indices for `marks`; `undefined` when there are none, so the attribute is removed. */
export function virtualScrollMarksAttribute(indices: Iterable<number>): string | undefined {
  return Array.from(indices).join(' ') || undefined
}
