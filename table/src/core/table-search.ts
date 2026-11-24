import type { TableMatchRange, TableSearchPointer, TableSearchRequest, TableSearchResult } from './table-types'

/** A scan stops after this many matching rows. */
export const TABLE_SEARCH_MAX_ROWS = 99

/** An error message for a query that cannot run, such as an invalid regular expression. */
export function searchRequestError(request: TableSearchRequest): string | undefined {
  if (!request.matchRegex || !request.query) return undefined
  try {
    new RegExp(request.query)
    return undefined
  } catch {
    return 'Invalid regular expression'
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Every match of the query in `text`, in order. The query is one phrase, or one
 * regular expression with `matchRegex`. Empty matches are skipped, and an
 * invalid expression matches nothing.
 */
export function findMatches(text: string, request: TableSearchRequest): TableMatchRange[] {
  if (!request.query || searchRequestError(request)) return []
  const pattern = new RegExp(request.matchRegex ? request.query : escapeRegExp(request.query), request.matchCase ? 'g' : 'gi')
  const ranges: TableMatchRange[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const end = pattern.lastIndex
    if (end > match.index) ranges.push({ start: match.index, end })
    else pattern.lastIndex++
  }
  return ranges
}

/** One cell's searchable text, keyed by its column. */
export interface SearchCell {
  key: string
  text: string
}

export interface SearchScan {
  request: TableSearchRequest
  /** Number of displayed rows. */
  length: number
  /** The searchable cells of a displayed row, in column order. */
  cellsAt: (rowIndex: number) => SearchCell[]
}

function rowMatchCount(cells: SearchCell[], request: TableSearchRequest): number {
  return cells.reduce((sum, cell) => sum + findMatches(cell.text, request).length, 0)
}

function pointerAt(rows: TableSearchResult['rows'], matchIndex: number): TableSearchPointer | undefined {
  let before = 0
  for (const row of rows) {
    if (matchIndex < before + row.matches) return { rowIndex: row.index, matchInRow: matchIndex - before, matchIndex }
    before += row.matches
  }
  return undefined
}

/**
 * Scans displayed rows from `start` toward the end, or toward the start with
 * `backward`, without wrapping, until `TABLE_SEARCH_MAX_ROWS` rows match. The
 * active match is `keep` when it is still in the results, otherwise the first
 * match in scan order.
 */
export function scanSearch(
  scan: SearchScan,
  options: { start?: number, backward?: boolean, keep?: { rowIndex: number, matchInRow: number } } = {},
): TableSearchResult {
  const { request, length, cellsAt } = scan
  const { start = 0, backward = false, keep } = options
  const rows: TableSearchResult['rows'] = []
  if (request.query && !searchRequestError(request)) {
    const step = backward ? -1 : 1
    for (let i = start; i >= 0 && i < length && rows.length < TABLE_SEARCH_MAX_ROWS; i += step) {
      const matches = rowMatchCount(cellsAt(i), request)
      if (matches > 0) rows.push({ index: i, matches })
    }
    rows.sort((a, b) => a.index - b.index)
  }
  const total = rows.reduce((sum, row) => sum + row.matches, 0)
  let active: TableSearchPointer | undefined
  if (keep) {
    let before = 0
    for (const row of rows) {
      if (row.index === keep.rowIndex) {
        const matchInRow = Math.min(keep.matchInRow, row.matches - 1)
        active = { rowIndex: row.index, matchInRow, matchIndex: before + matchInRow }
        break
      }
      before += row.matches
    }
  }
  active ??= pointerAt(rows, backward ? total - 1 : 0)
  return { rows, total, capped: rows.length === TABLE_SEARCH_MAX_ROWS, active }
}

/**
 * Moves the active match by one. Within the scanned rows it moves the pointer;
 * past either end it scans the rows beyond, and wraps around the table once
 * there are no more.
 */
export function stepSearch(scan: SearchScan, result: TableSearchResult, delta: 1 | -1): TableSearchResult {
  const { active } = result
  if (!active || scan.length === 0 || result.total === 0) return result
  const next = active.matchIndex + delta
  if (next >= 0 && next < result.total) {
    const pointer = pointerAt(result.rows, next)
    return pointer ? { ...result, active: pointer } : result
  }
  const backward = next < 0
  const wrapStart = backward ? scan.length - 1 : 0
  const adjacent = (active.rowIndex + delta + scan.length) % scan.length
  const beyond = scanSearch(scan, { start: adjacent, backward })
  if (beyond.total > 0 || adjacent === wrapStart) return beyond
  return scanSearch(scan, { start: wrapStart, backward })
}

/** The cell holding a row's `matchInRow`th match, and the match's index inside that cell. */
export function locateMatch(
  cells: SearchCell[],
  request: TableSearchRequest,
  matchInRow: number,
): { key: string, matchInCell: number } | undefined {
  let before = 0
  for (const cell of cells) {
    const count = findMatches(cell.text, request).length
    if (matchInRow < before + count) return { key: cell.key, matchInCell: matchInRow - before }
    before += count
  }
  return undefined
}
