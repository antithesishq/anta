import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  correct, fixedHeights, initialState, isMeasured, knownContentHeight, markPositions, maxScrollX, showVerticalScrollbar, isBottomAligned, itemsPerPage, reanchor, renderRange, revealState, revealX,
  rowsOffset, scrollByItem, scrollByPixels, scrollToEnd, scrollToStart, scrollXBy, thumbDragTarget,
  trackPressTarget, verticalThumb, visibleIndices,
} from '../src/core/model.ts'

function config(overrides = {}) {
  return {
    count: 10_000, itemMinHeight: 20, maxNonVirtualItems: 500, heightPx: 400,
    rowsWidth: 600, contentWidth: 600, scrollbarWidth: 16, follow: false, ...overrides,
  }
}

// Deterministic pseudo-random row heights between the minimum and five times it.
function heightsFor(count, seed = 1, min = 20) {
  let s = seed
  const heights = new Map()
  for (let i = 0; i < count; i++) {
    s = (s * 1103515245 + 12345) % 2 ** 31
    heights.set(i, min + (s % (min * 4)))
  }
  return heights
}

function prefix(heights, index) {
  let sum = 0
  for (let i = 0; i < index; i++) sum += heights.get(i)
  return sum
}

// Distance from the top of the content to the top of the viewport.
function offsetOf(state, heights) {
  return prefix(heights, state.anchorIndex) - state.deltaPixels
}

function settled(cfg, heights, state = initialState(cfg)) {
  return correct({ ...state, small: false }, cfg, heights)
}

test('a following list starts anchored to its last row', () => {
  const cfg = config({ follow: true })
  const state = initialState(cfg)
  assert.equal(state.anchorIndex, cfg.count - 1)
  assert.equal(state.stickToBottom, true)
})

test('short lists mount every row; long lists mount a window around the anchor', () => {
  assert.deepEqual(renderRange(initialState({ count: 300, follow: false }), config({ count: 300 })), { start: 0, end: 300 })
  const cfg = config()
  const perPage = itemsPerPage(cfg)
  const range = renderRange({ ...initialState(cfg), anchorIndex: 5000 }, cfg)
  assert.deepEqual(range, { start: 5000 - perPage, end: 5001 + perPage })
})

test('re-anchoring never moves content on screen', () => {
  const cfg = config()
  const heights = heightsFor(cfg.count)
  const state = { ...initialState(cfg), anchorIndex: 4000, deltaPixels: -137 }
  for (const index of [3900, 3999, 4001, 4100]) {
    assert.equal(offsetOf(reanchor(state, cfg, heights, index), heights), offsetOf(state, heights))
  }
})

test('pixel scrolling with measured rows moves the content by exactly the delta, clamped at both ends', () => {
  const cfg = config({ count: 2000 })
  const heights = heightsFor(cfg.count, 7)
  const total = prefix(heights, cfg.count)
  const maxOffset = total - cfg.heightPx
  let state = settled(cfg, heights)
  let expected = 0
  let s = 3
  for (let step = 0; step < 3000; step++) {
    s = (s * 1103515245 + 12345) % 2 ** 31
    // Mostly downwards so the walk reaches the end, with large flings both ways.
    const delta = (s % 900) - 300
    state = correct(scrollByPixels(state, delta), cfg, heights)
    expected = Math.max(0, Math.min(expected + delta, maxOffset))
    assert.ok(Math.abs(offsetOf(state, heights) - expected) < 1e-6, `step ${step}: ${offsetOf(state, heights)} vs ${expected}`)
  }
})

test('reaching the end with follow turns following back on, and scrolling up turns it off', () => {
  const cfg = config({ count: 1000, follow: true })
  const heights = heightsFor(cfg.count)
  let state = settled(cfg, heights)
  assert.equal(isBottomAligned(state), true)
  assert.equal(offsetOf(state, heights), prefix(heights, cfg.count) - cfg.heightPx)

  state = correct(scrollByPixels(state, -50), cfg, heights)
  assert.equal(state.stickToBottom, false)
  assert.equal(isBottomAligned(state), false)

  state = correct(scrollByPixels(state, 200), cfg, heights)
  assert.equal(state.stickToBottom, true)
  assert.equal(state.atEnd, true)
})

test('a following list stays on its last row while it grows', () => {
  let cfg = config({ count: 1000, follow: true })
  const heights = heightsFor(5000)
  let state = settled(cfg, heights)
  for (const count of [1001, 1010, 1500, 5000]) {
    cfg = { ...cfg, count }
    state = correct(state, cfg, heights)
    assert.equal(state.anchorIndex, count - 1)
    assert.equal(state.deltaPixels, cfg.heightPx - heights.get(count - 1))
  }
})

test('scrolling down at the end and up at the start does nothing', () => {
  const cfg = config({ count: 1000 })
  const heights = heightsFor(cfg.count)
  const start = settled(cfg, heights)
  assert.equal(scrollByPixels(start, -10), start)
  const end = correct(scrollToEnd(start, cfg, heights), cfg, heights)
  assert.equal(end.atEnd, true)
  assert.equal(scrollByPixels(end, 10), end)
  assert.equal(offsetOf(end, heights), prefix(heights, cfg.count) - cfg.heightPx)
})

test('the end of a last row taller than the viewport is reachable', () => {
  const cfg = config({ count: 50 })
  const heights = heightsFor(cfg.count)
  heights.set(49, 1000)
  const state = scrollToEnd(settled(cfg, heights), cfg, heights)
  assert.equal(state.anchorIndex, 49)
  assert.equal(state.deltaPixels, cfg.heightPx - 1000)
})

test('scrolling by item steps from the row at the top edge', () => {
  const cfg = config()
  const heights = heightsFor(cfg.count)
  const state = { ...settled(cfg, heights), anchorIndex: 100, deltaPixels: -5 }
  assert.equal(scrollByItem(state, cfg, heights, 1).anchorIndex, 101)
  assert.equal(scrollByItem(state, cfg, heights, -1).anchorIndex, 99)
  assert.equal(scrollToStart(state).anchorIndex, 0)
})

test('the visible top index is fractional', () => {
  const cfg = config()
  const heights = new Map(Array.from({ length: cfg.count }, (_, i) => [i, 20]))
  assert.equal(visibleIndices({ ...initialState(cfg), anchorIndex: 100, deltaPixels: -10 }, cfg, heights)[0], 100.5)
  assert.equal(visibleIndices({ ...initialState(cfg), anchorIndex: 100, deltaPixels: 30 }, cfg, heights)[0], 98.5)
})

test('the track maps presses near either end to that edge and elsewhere to indices', () => {
  const cfg = config()
  const heights = new Map()
  assert.deepEqual(trackPressTarget(cfg, heights, 4), { edge: 'start' })
  assert.deepEqual(trackPressTarget(cfg, heights, cfg.heightPx - 4), { edge: 'end' })
  assert.deepEqual(trackPressTarget(cfg, heights, cfg.heightPx / 2), { index: cfg.count / 2 })
})

test('a dragged thumb on a short measured list tracks pixels', () => {
  const cfg = config({ count: 100 })
  const heights = new Map(Array.from({ length: 100 }, (_, i) => [i, 40]))
  // 4000px of rows in a 400px viewport: the thumb is 40px, so a center at 220 puts its top at 200, half way.
  assert.deepEqual(thumbDragTarget(cfg, heights, 220), { index: 50, deltaPixels: -0 })
})

test('the ball thumb of a long list stays inside its track', () => {
  const cfg = config()
  const heights = heightsFor(cfg.count)
  for (const anchorIndex of [0, 10, 5000, cfg.count - 1]) {
    const thumb = verticalThumb({ ...settled(cfg, heights), anchorIndex }, cfg, heights)
    assert.ok(thumb.top >= 0 && thumb.top + thumb.height <= cfg.heightPx + 1e-9, JSON.stringify(thumb))
    assert.ok(thumb.height >= cfg.scrollbarWidth)
  }
})

test('mounted rows are offset so the anchor row lands at deltaPixels', () => {
  const cfg = config()
  const heights = heightsFor(cfg.count)
  const state = { ...initialState(cfg), anchorIndex: 500, deltaPixels: 30 }
  assert.equal(rowsOffset(state, cfg, heights, 480), 30 - (prefix(heights, 500) - prefix(heights, 480)))
  // Rows that arrive late, beyond the anchor, sit below it.
  assert.equal(rowsOffset(state, cfg, heights, 510), 30 + (prefix(heights, 510) - prefix(heights, 500)))
})

test('revealing a row centers it, and pins rows near the start instead of overscrolling', () => {
  const cfg = config()
  const heights = new Map(Array.from({ length: cfg.count }, (_, i) => [i, 20]))
  assert.equal(revealState(initialState(cfg), cfg, heights, { index: 5000 }).deltaPixels, (cfg.heightPx - 20) / 2)
  assert.equal(revealState(initialState(cfg), cfg, heights, { index: 2 }).deltaPixels, 40)
  assert.equal(revealState(initialState(cfg), cfg, heights, { index: 5000, targetTop: 100 }).deltaPixels, (cfg.heightPx - 20) / 2 - 100)
})

test('horizontal reveal keeps the target clear of pinned insets', () => {
  const cfg = config({ contentWidth: 2000 })
  const state = initialState(cfg)
  assert.equal(revealX(state, cfg, { left: 900, width: 100, insetStart: 150 }).scrollX, 400)
  const scrolled = scrollXBy(state, cfg, 800)
  assert.equal(revealX(scrolled, cfg, { left: 850, width: 100, insetStart: 150 }).scrollX, 700)
  assert.equal(scrollXBy(state, cfg, 99_999).scrollX, 1400)
})

test('a long list shows its scrollbar before any row is measured', () => {
  const cfg = config()
  const state = correct(initialState(cfg), cfg, new Map())
  assert.equal(showVerticalScrollbar(state, cfg, new Map()), true)
})

test('dense marks merge into runs, sparse marks stay separate', () => {
  const cfg = config({ count: 100_000 })
  const state = initialState(cfg)
  const dense = Array.from({ length: 2700 }, (_, i) => 5 + i * 37)
  const merged = markPositions(cfg, state, new Map(), dense)
  assert.ok(merged.length < 10, `${merged.length} marks`)
  assert.deepEqual(markPositions(cfg, state, new Map(), [0, 50_000]).map(([top]) => top), [0, 200])
})

test('content less than a pixel wider than the rows does not scroll sideways', () => {
  assert.equal(maxScrollX(config({ rowsWidth: 600, contentWidth: 600.6 })), 0)
  assert.equal(maxScrollX(config({ rowsWidth: 600, contentWidth: 601 })), 1)
  assert.equal(maxScrollX(config({ rowsWidth: 600, contentWidth: 640 })), 40)
})

test('fixed-height rows are measured from the start and scroll exactly', () => {
  const cfg = config({ count: 1_000_000, itemHeightFixed: true })
  const heights = fixedHeights(cfg.count, cfg.itemMinHeight)
  assert.equal(heights.get(999_999), 20)
  assert.equal(heights.get(1_000_000), undefined)
  assert.deepEqual(knownContentHeight(cfg, heights), { height: 20_000_000, recorded: 1_000_000, complete: true })
  let state = correct({ ...initialState(cfg), small: false }, cfg, heights)
  assert.equal(isMeasured({ ...state, anchorIndex: 500_000 }, cfg, heights), true)
  for (let i = 0; i < 200; i++) state = correct(scrollByPixels(state, 997), cfg, heights)
  assert.equal(state.anchorIndex * 20 - state.deltaPixels, 200 * 997)
})

test('rows without a height count at the minimum, so a partly measured list keeps its scrollbar', () => {
  const cfg = config({ count: 10 })
  const heights = new Map([[0, 100], [1, 100], [2, 100]])
  // 300px measured plus 7 rows at 20px is 440px, taller than the 400px list.
  assert.equal(showVerticalScrollbar({ ...initialState(cfg), small: false }, cfg, heights), true)
  assert.equal(showVerticalScrollbar({ ...initialState(cfg), small: false }, cfg, new Map([[0, 100]])), false)
})
