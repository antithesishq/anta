import { cellText, cellValue } from './table-source'
import type { TableColumnFilter, TableFilterFn, TableFilterValue, TableMatchRules } from './table-types'

/**
 * Whether `haystack` matches the text filter `query`. Plain queries match
 * when every whitespace-separated word appears, in any order. With
 * `matchRegex`, the query is one regular expression, and an invalid one
 * matches nothing. `negate` is applied by the caller, per row.
 */
export function tokenizedMatch(query: string, haystack: string, rules?: Partial<TableMatchRules>): boolean {
  if (query.length === 0) return true
  if (rules?.matchRegex) {
    try {
      return new RegExp(query, rules.matchCase ? '' : 'i').test(haystack)
    } catch {
      return false
    }
  }
  const normalize = (s: string) => rules?.matchCase ? s : s.toLowerCase()
  const tokens = normalize(query).split(/\s+/).filter(token => token.length > 0)
  const text = normalize(haystack)
  return tokens.every(token => text.includes(token))
}

/** Splits a filter value into per-column filters: the text on each text-filter column, and each facet selection. */
export function columnFilters(value: TableFilterValue, textKeys: readonly string[]): {
  text: TableColumnFilter[]
  facets: TableColumnFilter[]
} {
  return {
    text: value.text === '' ? [] : textKeys.map(id => ({ id, value: value.text })),
    facets: Object.entries(value.facets).map(([id, selected]) => ({ id, value: selected })),
  }
}

export interface FilterRowsOptions<T> {
  rows: readonly T[]
  value: TableFilterValue
  rules: TableMatchRules
  /** Columns the text filter searches. */
  textKeys: readonly string[]
  /** Facet keys the built-in filter applies; other facets reach only a custom `filtering`. */
  facetKeys: ReadonlySet<string>
  filtering?: TableFilterFn<T>
}

/**
 * Source indices of the rows that pass the filter, or `undefined` when no
 * filter is set. A row passes the text filter when any text-filter column
 * matches (none, with `negate`), and passes each facet whose selection
 * includes its value.
 */
export function filterRows<T>(options: FilterRowsOptions<T>): number[] | undefined {
  const { rows, value, rules, textKeys, facetKeys, filtering } = options
  const filters = columnFilters(value, textKeys)
  if (filters.text.length === 0 && filters.facets.length === 0) return undefined
  let keep: (row: T) => boolean
  if (filtering) {
    keep = row => filtering(row, filters.text, filters.facets, rules)
  } else {
    const facets = filters.facets.flatMap(({ id, value: selected }) =>
      facetKeys.has(id) && Array.isArray(selected) ? [{ id, selected: new Set<unknown>(selected) }] : [])
    keep = row => {
      if (filters.text.length > 0) {
        const matched = filters.text.some(filter => tokenizedMatch(value.text, cellText(cellValue(row, filter.id)), rules))
        if (matched === rules.negate) return false
      }
      return facets.every(({ id, selected }) => selected.has(cellValue(row, id)))
    }
  }
  const indices: number[] = []
  rows.forEach((row, index) => {
    if (keep(row)) indices.push(index)
  })
  return indices
}

export function isEmptyFilter(value: TableFilterValue): boolean {
  return value.text === '' && Object.keys(value.facets).length === 0
}
