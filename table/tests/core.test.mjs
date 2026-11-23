// Runs against the built renderer-free entry: `pnpm run build` first.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  filterRows, findMatches, inferColumns, layoutColumns, locateMatch, scanSearch, serializeCsv, serializeTxt, sortIndices,
  stepSearch, tableHeight, toggleSort, defaultCompare, TABLE_SEARCH_MAX_ROWS,
} from '../dist/core.js'

const rules = { matchCase: false, matchRegex: false, negate: false }

test('inferColumns types columns, sizes them to values and titles, and collects primitive options', () => {
  const columns = inferColumns([{ id: 'a', n: 1, ok: true, meta: { x: 1 } }, { id: 'bbbb', n: 22, ok: false, meta: null }], key => key)
  assert.equal(columns.id.dataType, 'string')
  assert.equal(columns.n.dataType, 'number')
  assert.equal(columns.ok.dataType, 'boolean')
  assert.equal(columns.meta.dataType, 'other')
  assert.deepEqual(columns.id.options, ['a', 'bbbb'])
  assert.equal(columns.meta.options, undefined)
  assert.equal(columns.meta.textFilter, false)
  assert.ok(columns.id.width > 0)
})

test('inferColumns gives no options to a column with more distinct values than the cap', () => {
  const rows = Array.from({ length: 150 }, (_, i) => ({ n: i, group: i % 3 }))
  assert.equal(inferColumns(rows, key => key).n.options, undefined, '150 distinct values exceed the default 100')
  assert.deepEqual(inferColumns(rows, key => key).group.options, [0, 1, 2])
  assert.equal(inferColumns(rows, key => key, undefined, 200).n.options.length, 150, 'a higher cap keeps them')
})

test('layoutColumns keeps fixed and pinned widths and lets the rest share the free width', () => {
  const layout = layoutColumns({
    keys: ['a', 'b', 'c', 'p'],
    specs: { a: { width: 100 }, b: { minWidth: 80, maxWidth: 150 }, c: { minWidth: 60 }, p: { pin: 'right', minWidth: 70 } },
    inferred: {},
  })
  assert.equal(layout.template, '100px minmax(80px, 150px) minmax(60px, 1fr) 70px')
  assert.deepEqual(layout.widths, { a: 100, b: 80, c: 60, p: 70 })
  assert.equal(layout.contentWidth, 310)
})

test('layoutColumns stretches the last unpinned column when no column is unbounded', () => {
  const layout = layoutColumns({ keys: ['a', 'b'], specs: { a: { width: 100 }, b: { width: 120, maxWidth: 200 } }, inferred: {} })
  assert.equal(layout.template, '100px minmax(120px, 1fr)')
})

test('layoutColumns orders pinned columns to the edges with sticky offsets', () => {
  const layout = layoutColumns({
    keys: ['a', 'l1', 'r1', 'l2', 'r2'],
    specs: { l1: { pin: 'left', width: 50 }, l2: { pin: 'left', width: 60 }, r1: { pin: 'right', width: 70 }, r2: { pin: 'right', width: 80 } },
    inferred: {},
  })
  assert.deepEqual(layout.order, ['l1', 'l2', 'a', 'r1', 'r2'])
  assert.deepEqual([layout.pinOffsets.l1, layout.pinOffsets.l2], [0, 50])
  assert.deepEqual([layout.pinOffsets.r1, layout.pinOffsets.r2], [80, 0])
  assert.equal(layout.leftEdge, 'l2')
  assert.equal(layout.rightEdge, 'r1')
})

test('toggleSort cycles ascending, descending, unsorted, and adds columns with multi', () => {
  let sorting = toggleSort([], 'a', false)
  assert.deepEqual(sorting, [{ id: 'a', desc: false }])
  sorting = toggleSort(sorting, 'a', false)
  assert.deepEqual(sorting, [{ id: 'a', desc: true }])
  assert.deepEqual(toggleSort(sorting, 'a', false), [])
  assert.deepEqual(toggleSort(sorting, 'b', false), [{ id: 'b', desc: false }])
  assert.deepEqual(toggleSort(sorting, 'b', true), [{ id: 'a', desc: true }, { id: 'b', desc: false }])
})

test('sortIndices is stable, sorts missing values last ascending, and breaks ties with later sorts', () => {
  const rows = [{ g: 'b', n: 2 }, { g: 'a' }, { g: 'b', n: 1 }, { g: 'a', n: 3 }]
  const compare = key => defaultCompare(key === 'n' ? 'number' : 'string')
  assert.deepEqual(sortIndices([0, 1, 2, 3], rows, [{ id: 'n', desc: false }], compare), [2, 0, 3, 1])
  assert.deepEqual(sortIndices([0, 1, 2, 3], rows, [{ id: 'g', desc: false }, { id: 'n', desc: true }], compare), [1, 3, 0, 2])
})

test('filterRows matches text on any text column, honors negate, and ANDs facets', () => {
  const rows = [{ id: 'alpha', g: 'x' }, { id: 'beta', g: 'y' }, { id: 'alphabet', g: 'y' }]
  const base = { rows, rules, textKeys: ['id'], facetKeys: new Set(['g']) }
  assert.equal(filterRows({ ...base, value: { text: '', facets: {} } }), undefined)
  assert.deepEqual(filterRows({ ...base, value: { text: 'alph', facets: {} } }), [0, 2])
  assert.deepEqual(filterRows({ ...base, value: { text: 'alph', facets: {} }, rules: { ...rules, negate: true } }), [1])
  assert.deepEqual(filterRows({ ...base, value: { text: 'alph', facets: { g: ['y'] } } }), [2])
  assert.deepEqual(filterRows({ ...base, value: { text: '^a.*t$', facets: {} }, rules: { ...rules, matchRegex: true } }), [2])
})

test('findMatches handles case, regular expressions, and invalid patterns', () => {
  assert.deepEqual(findMatches('Abc abc', { query: 'abc', matchCase: false, matchRegex: false }), [{ start: 0, end: 3 }, { start: 4, end: 7 }])
  assert.deepEqual(findMatches('Abc abc', { query: 'abc', matchCase: true, matchRegex: false }), [{ start: 4, end: 7 }])
  assert.deepEqual(findMatches('a.c abc', { query: 'a.c', matchCase: false, matchRegex: false }), [{ start: 0, end: 3 }])
  assert.deepEqual(findMatches('a1 b22', { query: '\\d+', matchCase: false, matchRegex: true }), [{ start: 1, end: 2 }, { start: 4, end: 6 }])
  assert.deepEqual(findMatches('abc', { query: '(', matchCase: false, matchRegex: true }), [])
})

test('scanSearch counts matches per row and stepSearch wraps around the table', () => {
  const rows = ['x', 'a a', 'x', 'a']
  const scan = { request: { query: 'a', matchCase: false, matchRegex: false }, length: rows.length, cellsAt: i => [{ key: 'c', text: rows[i] }] }
  const result = scanSearch(scan)
  assert.deepEqual(result.rows, [{ index: 1, matches: 2 }, { index: 3, matches: 1 }])
  assert.equal(result.total, 3)
  assert.deepEqual(result.active, { rowIndex: 1, matchInRow: 0, matchIndex: 0 })
  const last = stepSearch(scan, result, -1)
  assert.deepEqual(last.active, { rowIndex: 3, matchInRow: 0, matchIndex: 2 })
  const second = stepSearch(scan, result, 1)
  assert.deepEqual(second.active, { rowIndex: 1, matchInRow: 1, matchIndex: 1 })
  assert.deepEqual(scanSearch(scan, { keep: { rowIndex: 3, matchInRow: 0 } }).active, { rowIndex: 3, matchInRow: 0, matchIndex: 2 })
})

test('scanSearch stops after the maximum number of matching rows and stepping pages on', () => {
  const length = TABLE_SEARCH_MAX_ROWS + 5
  const scan = { request: { query: 'a', matchCase: false, matchRegex: false }, length, cellsAt: () => [{ key: 'c', text: 'a' }] }
  const first = scanSearch(scan)
  assert.equal(first.capped, true)
  let result = first
  for (let i = 0; i < TABLE_SEARCH_MAX_ROWS; i++) result = stepSearch(scan, result, 1)
  assert.equal(result.active.rowIndex, TABLE_SEARCH_MAX_ROWS)
})

test('locateMatch finds the cell of a row match', () => {
  const cells = [{ key: 'a', text: 'xx' }, { key: 'b', text: 'x' }]
  assert.deepEqual(locateMatch(cells, { query: 'x', matchCase: false, matchRegex: false }, 2), { key: 'b', matchInCell: 0 })
})

test('tableHeight asks for the minimum rows and leaves the rest to CSS', () => {
  const base = { count: 1000, rowMinHeight: 27, headerHeight: 34, virtual: false }
  assert.deepEqual(tableHeight(base), { space: 306, min: 63, max: undefined })
  assert.deepEqual(tableHeight({ ...base, maxHeight: 200 }), { space: 200, min: 63, max: 200 })
  assert.deepEqual(tableHeight({ ...base, minHeight: 500 }), { space: 500, min: 500, max: undefined })
  assert.deepEqual(tableHeight({ ...base, height: 400 }), { frame: 400, min: 400 })
  // Few rows fit their rows: CSS reads them without a virtualizer, the measurement does with one.
  assert.deepEqual(tableHeight({ ...base, count: 3 }), { space: undefined, min: 63, max: undefined })
  assert.deepEqual(tableHeight({ ...base, count: 3, virtual: true, contentHeight: 140 }), { space: 176, min: 63, max: 176 })
  assert.deepEqual(tableHeight({ ...base, virtual: true, contentHeight: 27000 }), { space: 306, min: 63, max: 27036 })
  assert.equal(tableHeight({ ...base, virtual: true, height: 'auto', contentHeight: 27000 }).frame, 27036)
  assert.equal(tableHeight({ ...base, height: 'auto' }).frame, undefined)
})

test('serializeCsv quotes fields and serializeTxt flattens whitespace', () => {
  const records = [{ a: 'x,y', b: 'say "hi"' }, { a: 'line\nbreak', c: 1 }]
  assert.equal(serializeCsv(records), 'a,b,c\n"x,y","say ""hi""",\n"line\nbreak",,1')
  assert.equal(serializeTxt(records), 'a\tb\tc\nx,y\tsay "hi"\t\nline break\t\t1')
})
