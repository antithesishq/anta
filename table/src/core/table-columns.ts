import { isTableRecord, readTableRange } from './table-source'
import type { TableDataType, TableSource } from './table-types'

/** Rows read to infer column types, widths, and filter options. */
export const TABLE_INFER_ROWS = 500
/**
 * The default for `maxFilterOptions`: a column with more distinct values than this in the inferred rows gets no
 * filter options. A facet with hundreds of options is hard to use, and its menu keeps every option in the DOM.
 */
export const TABLE_MAX_FILTER_OPTIONS = 100
export const TABLE_CELL_PADDING_X = 16
export const TABLE_DEFAULT_COLUMN_WIDTH = 100
const MIN_COLUMN_WIDTH = TABLE_CELL_PADDING_X + 4
// Room for the sort button around a header title.
const SORT_AFFORDANCE_WIDTH = 50
// Pixels per character by type, tapering for long values: a rough measure that needs no layout.
const CHARACTER_WIDTH: Record<'string' | 'boolean' | 'number', number> = { string: 8, boolean: 9, number: 10 }

function primitiveKind(value: unknown): 'string' | 'number' | 'boolean' | undefined {
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return undefined
}

/** What the first rows say about one column. */
export interface InferredColumn {
  dataType: TableDataType
  /** Width that fits the widest inferred value and the header title. */
  width: number
  /** Every inferred value is a primitive, so the column takes part in the text filter. */
  textFilter: boolean
  /** Distinct primitive values, for a facet. Absent when the column holds non-primitives or too many values. */
  options?: (string | number | boolean)[]
}

function textWidth(length: number, kind: keyof typeof CHARACTER_WIDTH): number {
  if (length === 0) return 0
  return (CHARACTER_WIDTH[kind] - Math.log10(length) + 1) * length
}

/**
 * Reads the first `TABLE_INFER_ROWS` rows for each column's type, a width that
 * fits its values and title, and its distinct values. With `keys`, only those
 * columns get filter options, and only while they have at most `maxOptions`
 * distinct values.
 */
export function inferColumns(
  source: TableSource<unknown>,
  titles: (key: string) => string,
  keys?: readonly string[],
  maxOptions = TABLE_MAX_FILTER_OPTIONS,
): Record<string, InferredColumn> {
  const rows = readTableRange(source, 0, TABLE_INFER_ROWS)
  const columns: Record<string, InferredColumn> = {}
  const options = new Map<string, Set<string | number | boolean> | null>()
  for (const row of rows) {
    if (!isTableRecord(row)) continue
    for (const key of Object.keys(row)) {
      const column = columns[key] ??= { dataType: 'other', width: 0, textFilter: false }
      if (!options.has(key)) options.set(key, keys === undefined || keys.includes(key) ? new Set() : null)
      const value = row[key]
      const kind = primitiveKind(value)
      if (kind !== undefined) {
        column.width = Math.max(column.width, textWidth(String(value).length, kind) + TABLE_CELL_PADDING_X * 2)
        column.dataType = kind
        column.textFilter = true
        const seen = options.get(key)
        if (seen && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
          seen.add(value)
          if (seen.size > maxOptions) options.set(key, null)
        }
      } else {
        options.set(key, null)
      }
    }
  }
  for (const [key, column] of Object.entries(columns)) {
    const title = titles(key)
    column.width = Math.max(column.width, textWidth(title.length, 'string') + TABLE_CELL_PADDING_X + SORT_AFFORDANCE_WIDTH)
    const seen = options.get(key)
    if (seen) column.options = [...seen]
  }
  return columns
}

/** The width settings of one column, as passed in `columns`. */
export interface ColumnWidthSpec {
  width?: number
  minWidth?: number
  maxWidth?: number
  pin?: 'left' | 'right'
}

export interface ColumnLayoutOptions {
  /** Visible column keys in their declared order. */
  keys: readonly string[]
  specs: Record<string, ColumnWidthSpec | undefined>
  inferred: Record<string, InferredColumn | undefined>
}

export interface ColumnLayout {
  /** Keys in render order: left-pinned, unpinned, right-pinned. */
  order: string[]
  /** `grid-template-columns` for the header and every row. */
  template: string
  /** Each column's narrowest width. While the rows scroll sideways, every column is at it. */
  widths: Record<string, number>
  /** Sticky offset of each pinned column from its edge: the widths of the pinned columns before it. */
  pinOffsets: Record<string, number>
  /** The last left-pinned and the first right-pinned column, which draw the pinned edge. */
  leftEdge?: string
  rightEdge?: string
  /** Sum of `widths`. The rows scroll sideways when they are narrower. */
  contentWidth: number
}

const clamp = (n: number, low = 0, high = Number.MAX_SAFE_INTEGER) => Math.min(high, Math.max(low, n))

/**
 * Turns column settings into grid tracks; CSS shares the free width. A column
 * with `width`, or a pinned one, keeps its width. The others start at their
 * `minWidth` (default: the inferred width) and grow: up to `maxWidth`, then
 * evenly with the unbounded columns. When no column is unbounded, the last
 * unpinned one is, so the rows always fill the frame.
 */
export function layoutColumns({ keys, specs, inferred }: ColumnLayoutOptions): ColumnLayout {
  const left = keys.filter(key => specs[key]?.pin === 'left')
  const right = keys.filter(key => specs[key]?.pin === 'right')
  const middle = keys.filter(key => specs[key]?.pin === undefined)
  const order = [...left, ...middle, ...right]
  const widths: Record<string, number> = {}
  const tracks: Record<string, string> = {}
  for (const key of order) {
    const spec = specs[key] ?? {}
    const width = spec.width !== undefined
      ? clamp(spec.width, spec.minWidth, spec.maxWidth)
      : clamp(spec.minWidth ?? inferred[key]?.width ?? MIN_COLUMN_WIDTH, 0, spec.maxWidth)
    widths[key] = width
    if (spec.width !== undefined || spec.pin !== undefined) tracks[key] = `${width}px`
    else tracks[key] = `minmax(${width}px, ${spec.maxWidth === undefined ? '1fr' : `${spec.maxWidth}px`})`
  }
  const stretch = middle.at(-1)
  if (stretch !== undefined && !middle.some(key => tracks[key].endsWith('1fr)'))) tracks[stretch] = `minmax(${widths[stretch]}px, 1fr)`

  const pinOffsets: Record<string, number> = {}
  let offset = 0
  for (const key of left) {
    pinOffsets[key] = offset
    offset += widths[key]
  }
  offset = 0
  for (const key of [...right].reverse()) {
    pinOffsets[key] = offset
    offset += widths[key]
  }
  return {
    order,
    template: order.map(key => tracks[key]).join(' '),
    widths,
    pinOffsets,
    leftEdge: left.at(-1),
    rightEdge: right[0],
    contentWidth: order.reduce((sum, key) => sum + widths[key], 0),
  }
}
