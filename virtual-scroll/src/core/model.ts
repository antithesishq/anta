/**
 * Anchor-model virtual scrolling, as pure functions.
 *
 * The scroll position is not a pixel offset into the whole list. It is an anchor:
 * `anchorIndex` names a row and `deltaPixels` is the distance from the top of the
 * viewport to the top of that row (positive when the row sits below the top edge).
 * Rows are only ever measured near the anchor, so the list length is unbounded,
 * rows above the anchor can be measured late without moving what is on screen,
 * and the scrollbar maps to row indices rather than to estimated pixels.
 *
 * Everything here is DOM-free so it can be tested in Node. `a-virtual-scroll`
 * owns the DOM: it feeds measurements in and applies the results.
 */

/** Row heights recorded so far, keyed by row index. */
export type Heights = ReadonlyMap<number, number>

export interface VirtualScrollConfig {
  /** Number of rows. */
  count: number
  /** Minimum row height; also the estimate for rows not measured yet. */
  itemMinHeight: number
  /** Up to this many rows, every row stays mounted and the scrollbar is exact. */
  maxNonVirtualItems: number
  /** Height available to the list, including the horizontal scrollbar when shown. */
  heightPx: number
  /** Width of the area the rows are clipped to. */
  rowsWidth: number
  /** Width of the widest row, or the width a consumer declared for every row. */
  contentWidth: number
  /** Vertical scrollbar width; also the horizontal scrollbar thickness. */
  scrollbarWidth: number
  /** Keep following the last row while the list grows. */
  follow: boolean
  /** Every row is exactly `itemMinHeight` tall, so nothing is measured. Pair with `fixedHeights`. */
  itemHeightFixed?: boolean
}

export interface VirtualScrollState {
  anchorIndex: number
  deltaPixels: number
  /** Horizontal scroll offset, from 0 to `maxScrollX`. */
  scrollX: number
  /** Following the end; turned off by scrolling up, back on by reaching the end with `follow`. */
  stickToBottom: boolean
  /** The last page is in view, so scrolling down does nothing. */
  atEnd: boolean
  /** All rows fit, so there is no vertical scrolling and the list may size to its rows. */
  small: boolean
}

export const DEFAULT_ITEM_MIN_HEIGHT = 22
export const DEFAULT_MAX_NON_VIRTUAL_ITEMS = 500
export const DEFAULT_SCROLLBAR_WIDTH = 16
export const DEFAULT_HEIGHT = 500

/** A state with nothing scrolled, anchored to the end when following. */
export function initialState(config: Pick<VirtualScrollConfig, 'count' | 'follow'>): VirtualScrollState {
  return {
    anchorIndex: config.follow && config.count ? config.count - 1 : 0,
    deltaPixels: 0,
    scrollX: 0,
    stickToBottom: config.follow,
    atEnd: false,
    small: true,
  }
}

/**
 * Rows mounted on each side of the anchor. Twice a page is the minimum window, not
 * slack: the anchor is only re-seated once `deltaPixels` drifts past a full
 * viewport, so the visible rows can sit a whole viewport away from the anchor.
 */
export function itemsPerPage(config: Pick<VirtualScrollConfig, 'heightPx' | 'itemMinHeight'>): number {
  return 2 * Math.ceil(config.heightPx / config.itemMinHeight)
}

/** The configured non-virtual threshold, ignored when it is smaller than a page window. */
export function maxNonVirtual(config: VirtualScrollConfig): number {
  return config.maxNonVirtualItems > itemsPerPage(config) ? config.maxNonVirtualItems : DEFAULT_MAX_NON_VIRTUAL_ITEMS
}

// Content less than a pixel wider than the rows is rounding, not overflow. Treating it as
// overflow flickers the horizontal scrollbar in and out while a viewport is dragged wider.
const MIN_OVERHANG = 1

export function maxScrollX(config: VirtualScrollConfig): number {
  const overhang = config.contentWidth - config.rowsWidth
  return overhang < MIN_OVERHANG ? 0 : overhang
}

/**
 * Heights for a list whose rows are all `height` tall, without storing one per row.
 * Use with `itemHeightFixed`, which keeps the whole-list sums from iterating it.
 */
export function fixedHeights(count: number, height: number): Heights {
  const has = (index: number) => Number.isInteger(index) && index >= 0 && index < count
  function* entries(): MapIterator<[number, number]> {
    for (let index = 0; index < count; index++) yield [index, height]
  }
  function* keys(): MapIterator<number> {
    for (let index = 0; index < count; index++) yield index
  }
  function* values(): MapIterator<number> {
    for (let index = 0; index < count; index++) yield height
  }
  return {
    size: count,
    get: index => has(index) ? height : undefined,
    has,
    entries,
    keys,
    values,
    forEach(callback) {
      for (let index = 0; index < count; index++) callback(height, index, this)
    },
    [Symbol.iterator]: entries,
  }
}

export function showHorizontalScrollbar(config: VirtualScrollConfig): boolean {
  return maxScrollX(config) > 0
}

/** The height rows can scroll within: the list height minus the horizontal scrollbar. */
export function scrollableHeight(config: VirtualScrollConfig): number {
  return config.heightPx - (showHorizontalScrollbar(config) ? config.scrollbarWidth : 0)
}

function heightOf(heights: Heights, index: number, config: VirtualScrollConfig): number {
  return heights.get(index) || config.itemMinHeight
}

function atLeastMin(heights: Heights, index: number, config: VirtualScrollConfig): number {
  return Math.max(heights.get(index) || 0, config.itemMinHeight)
}

/** Window bounds around the anchor: `[start, end)`. */
export function windowBounds(state: VirtualScrollState, config: VirtualScrollConfig): { start: number, end: number } {
  const perPage = itemsPerPage(config)
  return {
    start: Math.max(state.anchorIndex - perPage, 0),
    end: Math.min(state.anchorIndex + 1 + perPage, config.count),
  }
}

/** Rows the consumer should mount: the anchor window, or every row below the non-virtual threshold. */
export function renderRange(state: VirtualScrollState, config: VirtualScrollConfig): { start: number, end: number } {
  if (config.count <= 0) return { start: 0, end: 0 }
  if (config.count <= maxNonVirtual(config)) return { start: 0, end: config.count }
  return windowBounds(state, config)
}

/** True once the anchor and both edges of its window have recorded heights. */
export function isMeasured(state: VirtualScrollState, config: VirtualScrollConfig, heights: Heights): boolean {
  const { start, end } = windowBounds(state, config)
  return !!heights.get(state.anchorIndex)
    && !!heights.get(start)
    && (end > 0 || !!heights.get(end - 1))
}

/** Fractional row indices at the top and bottom edges of the viewport. */
export function visibleIndices(state: VirtualScrollState, config: VirtualScrollConfig, heights: Heights): [number, number] {
  const perPage = itemsPerPage(config)
  const viewport = scrollableHeight(config)
  const { count } = config
  let start = 0, end = 0

  const endIndex = (from: number, initial: number) => {
    let j, total = initial
    for (j = from; j < from + perPage && j < count; j++) {
      if (total - initial >= viewport) {
        j = j + (1 - (total - initial - viewport) / Math.max(heights.get(j) || 0, config.itemMinHeight))
        break
      }
      total += atLeastMin(heights, j + 1, config)
    }
    return j
  }

  if (state.deltaPixels === 0 || (state.deltaPixels >= 0 && state.anchorIndex === 0)) {
    start = state.anchorIndex
    end = endIndex(start, atLeastMin(heights, start, config))
  } else if (state.deltaPixels < 0) {
    let remaining = state.deltaPixels
    for (start = state.anchorIndex; start < state.anchorIndex + perPage; start++) {
      const h = heightOf(heights, start, config)
      if (h > Math.abs(remaining)) {
        start += Math.abs(remaining) / h
        end = endIndex(Math.floor(start), (1 - (start % 1)) * h)
        break
      }
      remaining += h
    }
  } else {
    let remaining = state.deltaPixels
    for (start = state.anchorIndex - 1; start >= state.anchorIndex - perPage; start--) {
      const h = heightOf(heights, start, config)
      if (h > remaining) {
        start += 1 - remaining / h
        end = endIndex(Math.floor(start), (1 - (start % 1)) * h)
        break
      }
      remaining -= h
    }
  }
  return [start, end]
}

/** Moves the anchor to `index` without moving content on screen. */
export function reanchor(state: VirtualScrollState, config: VirtualScrollConfig, heights: Heights, index: number): VirtualScrollState {
  index = Math.max(0, Math.min(index, config.count - 1))
  if (index === state.anchorIndex) return state
  let between = 0
  if (index < state.anchorIndex) {
    for (let i = index; i < state.anchorIndex; i++) between += heightOf(heights, i, config)
    return { ...state, anchorIndex: index, deltaPixels: (state.deltaPixels - between) || 0 }
  }
  for (let i = state.anchorIndex; i < index; i++) between += heightOf(heights, i, config)
  return { ...state, anchorIndex: index, deltaPixels: (state.deltaPixels + between) || 0 }
}

function toEdge(state: VirtualScrollState, config: VirtualScrollConfig, top: boolean, delta = 0): VirtualScrollState {
  return sameOr(state, { ...state, anchorIndex: top ? 0 : Math.max(config.count - 1, 0), deltaPixels: delta || 0 })
}

/**
 * One pass of the corrections: clamp the anchor, re-seat it once it drifts a
 * viewport away, stop overscroll at either edge, and keep following the end.
 * Returns the same object when nothing changed.
 */
export function correctOnce(state: VirtualScrollState, config: VirtualScrollConfig, heights: Heights): VirtualScrollState {
  const { count } = config
  const viewport = scrollableHeight(config)
  const perPage = itemsPerPage(config)
  let next = state

  if (count > 0 && next.anchorIndex > count - 1) next = { ...next, anchorIndex: count - 1, deltaPixels: 0 }
  if (count > 0 && next.anchorIndex < 0) next = { ...next, anchorIndex: 0, deltaPixels: 0 }

  const measured = isMeasured(next, config, heights)
  const anchorHeight = heights.get(next.anchorIndex)

  if (count === 0) {
    if (!next.small) next = { ...next, small: true }
    if (next.deltaPixels !== 0 || next.anchorIndex !== 0) next = toEdge(next, config, true)
    return next
  }

  const drifted = measured
    ? next.deltaPixels > 0
      ? next.deltaPixels > viewport
      : Math.abs(next.deltaPixels) > Math.max(viewport, anchorHeight || 0)
    : Math.abs(next.deltaPixels) > viewport

  if (drifted) {
    if (next.anchorIndex === count - 1 && next.deltaPixels < 0) {
      // Scrolled past the last row: settle it at the bottom.
      if (config.follow) next = { ...next, stickToBottom: true, atEnd: true }
      return toEdge(next, config, false, viewport - Math.abs(anchorHeight || config.itemMinHeight))
    }
    if (Math.abs(anchorHeight || config.itemMinHeight) <= viewport) {
      // Walk about a viewport towards the content on screen. Stop at the first row
      // with no recorded height: re-seating then sums only real heights, so a wrong
      // estimate cannot make the content jump.
      let travelled = 0
      let index = next.anchorIndex
      while (travelled < viewport) {
        index += next.deltaPixels < 0 ? 1 : -1
        const h = heights.get(index)
        if (h === undefined) break
        travelled += Math.max(h, config.itemMinHeight)
      }
      index = Math.max(0, Math.min(index, count - 1))
      if (next.anchorIndex === 0 && next.deltaPixels > 0) return toEdge(next, config, true)
      return reanchor(next, config, heights, index)
    }
    // The anchor row is taller than the viewport: step one row at a time once the next row shows.
    if (next.deltaPixels < 0 && (anchorHeight || config.itemMinHeight) + next.deltaPixels < viewport) {
      return reanchor(next, config, heights, next.anchorIndex + 1)
    }
    if (next.deltaPixels > 0) return reanchor(next, config, heights, next.anchorIndex - 1)
    return next
  }

  if (measured) {
    const { start, end } = windowBounds(next, config)
    let above = 0
    let below = anchorHeight || config.itemMinHeight
    for (let i = start; i < next.anchorIndex; i++) above += heightOf(heights, i, config)
    for (let i = next.anchorIndex + 1; i < end; i++) below += heightOf(heights, i, config)
    const visibleBelow = viewport - next.deltaPixels
    const contentHeight = above + below

    const small = count <= perPage && contentHeight <= config.heightPx && config.contentWidth <= config.rowsWidth
    if (small !== next.small) next = { ...next, small }

    if (contentHeight <= config.heightPx) {
      if (next.atEnd) next = { ...next, atEnd: false }
      return toEdge(next, config, true, 0)
    }
    if (next.anchorIndex <= perPage && next.deltaPixels > above && !next.stickToBottom) {
      if (next.atEnd) next = { ...next, atEnd: false }
      return toEdge(next, config, true, 0)
    }
    if (next.anchorIndex + perPage >= count && visibleBelow > below && !next.stickToBottom) {
      const lastHeight = heightOf(heights, count - 1, config)
      return sameOr(next, {
        ...next,
        atEnd: true,
        stickToBottom: config.follow ? true : next.stickToBottom,
        anchorIndex: count - 1,
        deltaPixels: viewport - lastHeight,
      })
    }
    if (next.stickToBottom) {
      return sameOr(next, {
        ...next,
        atEnd: true,
        anchorIndex: count - 1,
        deltaPixels: viewport - heightOf(heights, count - 1, config),
      })
    }
    return next
  }

  // Not measured yet: only corrections that do not need heights.
  if (next.small && count >= perPage / 2) {
    next = { ...next, small: false, atEnd: next.stickToBottom ? true : next.atEnd }
  }
  if (next.anchorIndex === count - 1) {
    if (anchorHeight !== undefined && next.deltaPixels + anchorHeight <= viewport && !next.atEnd) {
      next = { ...next, atEnd: true }
    }
  } else if (next.deltaPixels < -viewport) {
    next = toEdge({ ...next, atEnd: true }, config, false, viewport - Math.max(heights.get(count - 1) || 0, config.itemMinHeight))
  }
  if (config.follow && next.atEnd) {
    next = sameOr(next, {
      ...next,
      stickToBottom: true,
      anchorIndex: count - 1,
      deltaPixels: viewport - heightOf(heights, count - 1, config),
    })
  }
  return next
}

function sameOr(prev: VirtualScrollState, next: VirtualScrollState): VirtualScrollState {
  for (const key of Object.keys(next) as (keyof VirtualScrollState)[]) {
    if (prev[key] !== next[key]) return next
  }
  return prev
}

/** Runs the corrections to a fixed point. A handful of passes always suffices; the cap guards loops. */
export function correct(state: VirtualScrollState, config: VirtualScrollConfig, heights: Heights): VirtualScrollState {
  let next = clampX(state, config)
  for (let i = 0; i < 8; i++) {
    const corrected = correctOnce(next, config, heights)
    if (corrected === next) return next
    next = corrected
  }
  return next
}

function clampX(state: VirtualScrollState, config: VirtualScrollConfig): VirtualScrollState {
  const x = Math.max(0, Math.min(state.scrollX, maxScrollX(config)))
  return x === state.scrollX ? state : { ...state, scrollX: x }
}

export function isAtStart(state: VirtualScrollState): boolean {
  return state.anchorIndex === 0 && state.deltaPixels === 0
}

/** Scrolls by pixels; positive scrolls down. Scrolling up stops following the end. */
export function scrollByPixels(state: VirtualScrollState, delta: number): VirtualScrollState {
  if ((isAtStart(state) && delta < 0) || (state.atEnd && delta > 0) || !delta) return state
  const next = { ...state, deltaPixels: (state.deltaPixels - delta) || 0 }
  if (delta < 0) {
    next.stickToBottom = false
    next.atEnd = false
  }
  return next
}

/** Scrolls by whole rows from the row at the top edge of the viewport. */
export function scrollByItem(state: VirtualScrollState, config: VirtualScrollConfig, heights: Heights, delta: 1 | -1): VirtualScrollState {
  if (isAtStart(state) && delta < 0) return state
  if (state.anchorIndex === config.count - 1 && delta > 0) return state
  const top = Math.round(visibleIndices(state, config, heights)[0])
  const index = Math.max(0, Math.min(top + delta, config.count - 1))
  return {
    ...state,
    anchorIndex: index,
    deltaPixels: 0,
    stickToBottom: false,
    atEnd: index === config.count - 1 ? state.atEnd : false,
  }
}

/** 90% of the scrollable height per page, so one row of context carries over. */
export function scrollByPage(state: VirtualScrollState, config: VirtualScrollConfig, delta: 1 | -1): VirtualScrollState {
  return scrollByPixels(state, delta * scrollableHeight(config) * 0.9)
}

export function scrollToStart(state: VirtualScrollState): VirtualScrollState {
  return { ...state, anchorIndex: 0, deltaPixels: 0, stickToBottom: false, atEnd: false }
}

/** Shows the end of the last row, which is its top unless it is taller than the viewport. */
export function scrollToEnd(state: VirtualScrollState, config: VirtualScrollConfig, heights: Heights): VirtualScrollState {
  const last = Math.max(config.count - 1, 0)
  return {
    ...state,
    anchorIndex: last,
    deltaPixels: Math.min(0, scrollableHeight(config) - heightOf(heights, last, config)),
    atEnd: true,
    stickToBottom: config.follow ? true : state.stickToBottom,
  }
}

export function scrollXBy(state: VirtualScrollState, config: VirtualScrollConfig, delta: number): VirtualScrollState {
  return clampX({ ...state, scrollX: state.scrollX + delta }, config)
}

export function scrollXTo(state: VirtualScrollState, config: VirtualScrollConfig, x: number): VirtualScrollState {
  return clampX({ ...state, scrollX: x }, config)
}

/** Sum of every row, measured or at least the minimum. Only meaningful below the non-virtual threshold. */
export function totalHeight(config: VirtualScrollConfig, heights: Heights): number {
  let total = 0
  for (let i = 0; i < config.count; i++) total += atLeastMin(heights, i, config)
  return total
}

/** Sum of the recorded heights, and whether every row has one. */
export function knownContentHeight(config: VirtualScrollConfig, heights: Heights): { height: number, recorded: number, complete: boolean } {
  if (config.itemHeightFixed) return { height: config.count * config.itemMinHeight, recorded: config.count, complete: true }
  let height = 0
  let recorded = 0
  for (const [index, h] of heights) {
    if (index < config.count) {
      height += h
      recorded++
    }
  }
  return { height, recorded, complete: recorded === config.count }
}

/**
 * True while the rows are taller than the viewport. Rows without a height count
 * at the minimum, so clearing heights never drops the scrollbar while they re-report.
 */
export function showVerticalScrollbar(state: VirtualScrollState, config: VirtualScrollConfig, heights: Heights): boolean {
  if (state.small) return false
  const known = knownContentHeight(config, heights)
  return known.height + (config.count - known.recorded) * config.itemMinHeight > config.heightPx
}

/** Maps a fractional row index to the scrollbar track, leaving half a thumb at either end. */
function indexToTrack(config: VirtualScrollConfig, index: number, track: number): number {
  const { count, scrollbarWidth } = config
  const half = scrollbarWidth / 2
  const t = count > 0 ? Math.max(0, Math.min(index / count, 1)) : 0
  return half + t * (track - scrollbarWidth)
}

function trackToIndex(config: VirtualScrollConfig, y: number, track: number): number {
  const { count, scrollbarWidth } = config
  const half = scrollbarWidth / 2
  const span = track - scrollbarWidth
  const t = span > 0 ? Math.max(0, Math.min((y - half) / span, 1)) : 0
  return t * count
}

export interface VerticalThumb {
  /** Center of the thumb when it is the index "ball"; the drag origin. */
  center: number
  top: number
  height: number
}

/**
 * Vertical thumb geometry. Long lists get an index-mapped ball whose position
 * never wobbles as heights are measured; lists below the non-virtual threshold
 * get an exact pixel thumb once measured.
 */
export function verticalThumb(state: VirtualScrollState, config: VirtualScrollConfig, heights: Heights, track = config.heightPx): VerticalThumb {
  const { heightPx, scrollbarWidth, count, itemMinHeight } = config
  const half = scrollbarWidth / 2
  const viewport = scrollableHeight(config)
  const visible = visibleIndices(state, config, heights)
  const center = indexToTrack(config, visible[0], track)
  let top = center - half
  let height = Math.max(
    scrollbarWidth,
    count > 0 ? (track * viewport) / (itemMinHeight * count) : 0,
    state.atEnd ? track - center + half : 0,
  )

  if (count <= maxNonVirtual(config) && isMeasured(state, config, heights)) {
    const vi = visible[0]
    const whole = Math.floor(vi)
    let above = 0
    for (let i = 0; i < whole; i++) above += atLeastMin(heights, i, config)
    above += (vi - whole) * atLeastMin(heights, whole, config)
    const total = totalHeight(config, heights) + (showHorizontalScrollbar(config) ? scrollbarWidth : 0)
    const scale = (v: number) => total > 0 ? Math.max(0, Math.min(v / total, 1)) * track : 0
    top = scale(above)
    // The thumb covers the viewport's share of the content.
    height = scale(heightPx)
    if (height < half) height = half
    if (top > track - scrollbarWidth) top = track - scrollbarWidth
  }

  // The thumb never reaches past the end of its track.
  height = Math.max(Math.min(height, track - top), scrollbarWidth)
  top = Math.min(top, Math.max(0, track - height))
  return { center, top, height }
}

export interface HorizontalThumb {
  center: number
  left: number
  width: number
}

/** Horizontal thumb geometry over a track of `rowsWidth`. */
export function horizontalThumb(state: VirtualScrollState, config: VirtualScrollConfig, track = config.rowsWidth): HorizontalThumb {
  const { contentWidth, rowsWidth, scrollbarWidth } = config
  const half = scrollbarWidth / 2
  // The thumb covers the visible share of the content.
  const width = Math.min(Math.max(scrollbarWidth, contentWidth > 0 ? (track * rowsWidth) / contentWidth : track), track)
  let left = contentWidth > 0 ? (state.scrollX / contentWidth) * track : 0
  left = Math.max(0, Math.min(left, track - width))
  return { center: left + half, left, width }
}

/**
 * Where a press on the vertical track jumps to. Near either end goes to that edge;
 * short lists map through real heights; long lists map the track to row indices.
 */
export function trackPressTarget(config: VirtualScrollConfig, heights: Heights, y: number, track = config.heightPx): { edge: 'start' | 'end' } | { index: number } {
  const { scrollbarWidth, count } = config
  if (y < scrollbarWidth) return { edge: 'start' }
  if (y > track - scrollbarWidth) return { edge: 'end' }
  if (count <= maxNonVirtual(config)) {
    const target = totalHeight(config, heights) * y / track
    let sum = 0
    let index = 0
    for (let i = 0; i < count; i++) {
      index = i
      sum += atLeastMin(heights, i, config)
      if (sum >= target) break
    }
    return { index }
  }
  return { index: Math.max(0, Math.min(Math.floor(trackToIndex(config, y, track)), count - 1)) }
}

/** Jumps to a row index from the track, adjusting the follow flags. */
export function jumpToIndex(state: VirtualScrollState, config: VirtualScrollConfig, index: number): VirtualScrollState {
  const notEnd = index !== config.count - 1
  return {
    ...state,
    anchorIndex: index,
    deltaPixels: 0,
    stickToBottom: notEnd ? false : state.stickToBottom,
    atEnd: notEnd ? false : state.atEnd,
  }
}

/**
 * Row index for a thumb dragged so its center is at `center` on the track. Short,
 * measured lists map through pixels so the thumb tracks the pointer; long lists
 * map to indices.
 */
export function thumbDragTarget(config: VirtualScrollConfig, heights: Heights, center: number, track = config.heightPx): { index: number, deltaPixels: number } {
  const { heightPx, scrollbarWidth, count } = config
  const half = scrollbarWidth / 2
  if (center <= half) return { index: 0, deltaPixels: 0 }
  if (center >= track - half) return { index: count - 1, deltaPixels: 0 }
  if (count <= maxNonVirtual(config)) {
    const thumbHeight = Math.max(half, track * heightPx / Math.max(totalHeight(config, heights), 1))
    const top = Math.max(0, center - thumbHeight / 2)
    const target = top / track * totalHeight(config, heights)
    let sum = 0
    for (let i = 0; i < count; i++) {
      const h = atLeastMin(heights, i, config)
      if (sum + h > target) return { index: i, deltaPixels: -(target - sum) }
      sum += h
    }
    return { index: count - 1, deltaPixels: 0 }
  }
  // The inverse of the ball's placement, keeping the fraction so grabbing the thumb does not jump.
  const index = trackToIndex(config, center, track)
  const whole = Math.max(0, Math.min(Math.floor(index), count - 1))
  return { index: whole, deltaPixels: -(index - whole) * heightOf(heights, whole, config) || 0 }
}

/** Horizontal track press: either end snaps to that edge, elsewhere maps the press to content. */
export function horizontalTrackPressTarget(config: VirtualScrollConfig, x: number, track = config.rowsWidth): number {
  const { scrollbarWidth, contentWidth } = config
  if (x < scrollbarWidth) return 0
  if (x > track - scrollbarWidth) return maxScrollX(config)
  return Math.max(0, Math.min(contentWidth * x / Math.max(track, 1), maxScrollX(config)))
}

/** Horizontal scroll offset for the thumb dragged so its center is at `center`. */
export function horizontalThumbDragTarget(config: VirtualScrollConfig, center: number, track = config.rowsWidth): number {
  const { scrollbarWidth, contentWidth } = config
  const half = scrollbarWidth / 2
  if (center <= half) return 0
  if (center >= track - half) return maxScrollX(config)
  return Math.max(0, Math.min(track > 0 ? center / track * contentWidth : 0, maxScrollX(config)))
}

const MIN_MARK_HEIGHT = 2

/**
 * Track positions for search marks, as `[top, height]` pairs. Marks that touch
 * merge, so a dense search draws at most about one mark per pixel of track.
 */
export function markPositions(config: VirtualScrollConfig, state: VirtualScrollState, heights: Heights, indices: readonly number[], track = config.heightPx): [number, number][] {
  const { count } = config
  if (!indices.length || !count) return []
  const marks: [number, number][] = []
  if (count <= maxNonVirtual(config) && isMeasured(state, config, heights)) {
    const total = totalHeight(config, heights)
    const wanted = new Set(indices)
    let above = 0
    for (let i = 0; i < count; i++) {
      const h = heightOf(heights, i, config)
      if (wanted.has(i)) marks.push([track * above / total, track * h / total])
      above += h
    }
  } else {
    for (const index of indices) marks.push([track * index / count, track / count - 1])
  }
  marks.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const [top, height] of marks) {
    const last = merged[merged.length - 1]
    const bottom = top + Math.max(height, MIN_MARK_HEIGHT)
    if (last && top <= last[0] + last[1] + 0.5) last[1] = Math.max(last[1], bottom - last[0])
    else merged.push([top, Math.max(height, MIN_MARK_HEIGHT)])
  }
  return merged
}

/**
 * Translation of the mounted rows so the anchor row lands at `deltaPixels`.
 * `renderedStart` is the index of the first mounted row; heights between it and
 * the anchor come from measurements, or the estimate when a row is not measured.
 */
export function rowsOffset(state: VirtualScrollState, config: VirtualScrollConfig, heights: Heights, renderedStart: number): number {
  let between = 0
  if (renderedStart <= state.anchorIndex) {
    for (let i = renderedStart; i < state.anchorIndex; i++) between += heightOf(heights, i, config)
  } else {
    for (let i = state.anchorIndex; i < renderedStart; i++) between -= heightOf(heights, i, config)
  }
  return state.deltaPixels - between
}

/** Bottom-aligns the mounted rows while following the end, so late rows never leave a gap below. */
export function isBottomAligned(state: VirtualScrollState): boolean {
  return state.stickToBottom && state.atEnd
}

/** Drops heights for rows outside the window once virtual, or beyond the end. */
export function pruneHeights(heights: Map<number, number>, config: VirtualScrollConfig, keep: { start: number, end: number }, all = false) {
  for (const index of [...heights.keys()]) {
    if (index >= config.count) heights.delete(index)
    else if (all && config.count > maxNonVirtual(config) && (index < keep.start || index >= keep.end)) heights.delete(index)
  }
}

export interface RevealRequest {
  index: number
  /** Top of the target within its row, once measured; centers the target instead of the row. */
  targetTop?: number
}

/**
 * State that shows `request.index` near the middle of the viewport. Rows close to
 * either end are pinned so the reveal does not overscroll and bounce back.
 */
export function revealState(state: VirtualScrollState, config: VirtualScrollConfig, heights: Heights, request: RevealRequest): VirtualScrollState {
  const { count, itemMinHeight } = config
  const viewport = scrollableHeight(config)
  const perPage = itemsPerPage(config)
  const index = Math.max(0, Math.min(request.index, count - 1))
  let delta = -(request.targetTop ?? 0) + (viewport - itemMinHeight) / 2

  if (index <= perPage / 4 && index <= count / 2) {
    let above = 0
    for (let i = 0; i < index; i++) above += heightOf(heights, i, config)
    if (delta > above) delta = above
  } else if (index >= count - perPage / 4) {
    let below = 0
    for (let i = index + 1; i < count; i++) below += heightOf(heights, i, config)
    const own = heights.get(index)
    if (own && own + below < viewport) delta = viewport - own - below
  }
  return { ...state, anchorIndex: index, deltaPixels: delta, stickToBottom: false, atEnd: false }
}

export interface HorizontalRevealRequest {
  /** Left edge of the target in content coordinates. */
  left: number
  width: number
  /** Width covered at the start by pinned content, such as frozen columns. */
  insetStart?: number
  insetEnd?: number
}

/** Smallest horizontal scroll that brings the target between the insets; aligns its start when it does not fit. */
export function revealX(state: VirtualScrollState, config: VirtualScrollConfig, request: HorizontalRevealRequest): VirtualScrollState {
  const regionLeft = request.insetStart ?? 0
  const regionRight = config.rowsWidth - (request.insetEnd ?? 0)
  if (regionRight <= regionLeft) return state
  const screenLeft = request.left - state.scrollX
  const screenRight = request.left + request.width - state.scrollX
  let x = state.scrollX
  if (request.width > regionRight - regionLeft || screenLeft < regionLeft) x = request.left - regionLeft
  else if (screenRight > regionRight) x = request.left + request.width - regionRight
  return scrollXTo(state, config, x)
}
