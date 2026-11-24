/**
 * Shared types for `@antadesign/table`. They import no renderer and touch no
 * DOM, so worker-side code can use them directly.
 */

/**
 * A data source that hands over a contiguous range of rows, for rows built or
 * fetched on demand. It has the same shape as `VirtualScrollRangeSource`, so one
 * source feeds both packages.
 */
export interface TableRangeSource<T> {
  readonly length: number
  slice(start: number, end: number): { toArray(): T[] }
}

/** Rows a table can read: an array, or a range source. */
export type TableSource<T> = readonly T[] | TableRangeSource<T>

/** The row type of a source: `TableItem<TableRangeSource<Run>>` is `Run`. */
export type TableItem<S> = S extends readonly (infer T)[]
  ? T
  : S extends TableRangeSource<infer T> ? T : never

/** The value type a column infers from its first rows. `other` columns do not sort, filter, or ellipsize. */
export type TableDataType = 'number' | 'boolean' | 'string' | 'other'

/** One sorted column. The first entry sorts first; later entries break ties. */
export interface TableSort {
  id: string
  desc: boolean
}

export type TableSorting = TableSort[]

/** How the text filter and search compare text. */
export interface TableMatchRules {
  matchCase: boolean
  matchRegex: boolean
  /** Text filter only: keep the rows that match none of the filtered columns. */
  negate: boolean
}

/** One active filter: the text filter on a column, or a facet's selection. */
export interface TableColumnFilter {
  id: string
  value: unknown
}

/**
 * The filter state: the text filter and the facet selections, keyed by facet
 * key. Use `''` and `{}` for an empty filter.
 */
export interface TableFilterValue {
  text: string
  facets: Record<string, unknown>
}

/**
 * A custom row filter. It replaces the built-in text and facet filters and
 * receives both, already split into per-column filters, with the text
 * filter's match rules. It runs only while a filter is set.
 */
export type TableFilterFn<T> = (
  row: T,
  textFilters: TableColumnFilter[],
  facetFilters: TableColumnFilter[],
  rules: TableMatchRules,
) => boolean

/** A table search query with its match rules. */
export interface TableSearchRequest {
  query: string
  matchCase: boolean
  matchRegex: boolean
}

/** A match inside one string, from `start` up to but not including `end`. */
export interface TableMatchRange {
  start: number
  end: number
}

/** The active search match: its row, which match within the row, and its position among all matches found. */
export interface TableSearchPointer {
  /** Display index of the row. */
  rowIndex: number
  /** Index of the match within its row, counting cells in column order. */
  matchInRow: number
  /** Index of the match among `total`, across the scanned rows. */
  matchIndex: number
}

/**
 * Search results for the rows scanned so far. A scan stops after
 * `TABLE_SEARCH_MAX_ROWS` matching rows; `capped` is then true and moving past
 * the last match scans the next rows.
 */
export interface TableSearchResult {
  /** Matching rows in ascending display order, with their match counts. */
  rows: { index: number, matches: number }[]
  total: number
  capped: boolean
  active?: TableSearchPointer
}

/** One file a table can download. */
export interface TableDownload {
  /** Menu label. */
  label: string
  fileName: string
  /** Builds the file when the reader picks it, never while the menu renders. */
  content: () => Blob | string
  /** MIME type for string content. */
  type?: string
}
