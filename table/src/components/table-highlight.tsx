import { findMatches } from '../core/table-search'
import type { TableMatchRange, TableSearchRequest } from '../core/table-types'

/**
 * `text` with each match wrapped in `<mark data-table-match>`. The match at
 * `activeIndex` also gets `data-active` and `data-search-active`, which the
 * table reveals.
 */
export function highlightMatches(text: string, ranges: readonly TableMatchRange[], activeIndex = -1): React.ReactNode {
  if (ranges.length === 0) return text
  const parts: React.ReactNode[] = []
  let at = 0
  ranges.forEach((range, index) => {
    if (range.start > at) parts.push(text.slice(at, range.start))
    const active = index === activeIndex
    parts.push(
      <mark key={index} data-table-match="" data-active={active ? '' : undefined} data-search-active={active ? '' : undefined}>
        {text.slice(range.start, range.end)}
      </mark>,
    )
    at = range.end
  })
  if (at < text.length) parts.push(text.slice(at))
  return parts
}

/** What a column's `renderSearchedCell` receives to mark its own matches. Everything is computed on read. */
export interface TableCellSearch {
  request: TableSearchRequest
  /** Index of the table's active match within this cell, or `-1` when it is in another cell. */
  activeIndex: number
  isActive: boolean
  /** The text this cell contributes to search. */
  readonly text: string
  /** Match ranges over `text`. */
  readonly ranges: TableMatchRange[]
  readonly matchCount: number
  /**
   * Marks every match in `piece`. Call it for each piece of text the cell
   * renders, in the order of `text`, so the active match lands on the right
   * piece.
   */
  mark: (piece: string) => React.ReactNode
}

export function cellSearch(request: TableSearchRequest, getText: () => string, activeIndex: number): TableCellSearch {
  let text: string | undefined
  let ranges: TableMatchRange[] | undefined
  const cellText = () => text ??= getText()
  const cellRanges = () => ranges ??= findMatches(cellText(), request)
  // Matches marked by earlier calls, so consecutive pieces keep counting toward activeIndex.
  let marked = 0
  return {
    request,
    activeIndex,
    isActive: activeIndex >= 0,
    get text() { return cellText() },
    get ranges() { return cellRanges() },
    get matchCount() { return cellRanges().length },
    mark: piece => {
      const pieceRanges = findMatches(piece, request)
      const node = highlightMatches(piece, pieceRanges, activeIndex - marked)
      marked += pieceRanges.length
      return node
    },
  }
}
