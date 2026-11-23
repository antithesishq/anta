import { cellValue } from './table-source'
import type { TableDataType, TableSorting } from './table-types'

/** Compares two cell values: negative when `a` sorts first. */
export type TableCompare = (a: unknown, b: unknown) => number

/**
 * The next sorting after a click on a column's sort button. A column cycles
 * through ascending, descending, and unsorted. Without `multi`, the column
 * replaces any other sort; with it (Shift + click), the column is added or
 * cycled in place and the others keep their order.
 */
export function toggleSort(sorting: TableSorting, id: string, multi: boolean): TableSorting {
  const current = sorting.find(sort => sort.id === id)
  const next = current === undefined ? { id, desc: false } : current.desc ? undefined : { id, desc: true }
  if (!multi) return next ? [next] : []
  if (current === undefined) return next ? [...sorting, next] : sorting
  return next ? sorting.map(sort => sort.id === id ? next : sort) : sorting.filter(sort => sort.id !== id)
}

/** The default comparison for a column's inferred type. */
export function defaultCompare(dataType: TableDataType): TableCompare | undefined {
  switch (dataType) {
    case 'number': return (a, b) => Number(a) - Number(b)
    // `true` sorts first.
    case 'boolean': return (a, b) => Number(b === true) - Number(a === true)
    case 'string': return (a, b) => String(a).localeCompare(String(b))
    default: return undefined
  }
}

/**
 * Sorts display indices by `sorting`. Rows missing the key sort as the largest
 * value. The sort is stable, so equal rows keep their source order.
 */
export function sortIndices(
  indices: readonly number[],
  rows: readonly unknown[],
  sorting: TableSorting,
  compare: (id: string) => TableCompare | undefined,
): number[] {
  const keys = sorting.flatMap(sort => {
    const fn = compare(sort.id)
    return fn ? [{ id: sort.id, sign: sort.desc ? -1 : 1, fn }] : []
  })
  if (keys.length === 0) return [...indices]
  return [...indices].sort((a, b) => {
    for (const { id, sign, fn } of keys) {
      const left = cellValue(rows[a], id)
      const right = cellValue(rows[b], id)
      const result = left === undefined || right === undefined
        ? Number(left === undefined) - Number(right === undefined)
        : fn(left, right)
      if (result !== 0 && !Number.isNaN(result)) return result * sign
    }
    return a - b
  })
}
