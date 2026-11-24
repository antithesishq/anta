import type { TableSource } from './table-types'

/** Reads rows `start` to `end - 1`, clamped to the source, as one range. */
export function readTableRange<T>(source: TableSource<T>, start: number, end: number): readonly T[] {
  const from = Math.max(0, Math.min(start, source.length))
  const to = Math.max(from, Math.min(end, source.length))
  if (isArray(source)) return source.slice(from, to)
  return source.slice(from, to).toArray()
}

/** Every row of the source, read once. */
export function readTableRows<T>(source: TableSource<T>): readonly T[] {
  return isArray(source) ? source : source.slice(0, source.length).toArray()
}

/** One row, or `undefined` past the end. */
export function readTableRow<T>(source: TableSource<T>, index: number): T | undefined {
  if (index < 0 || index >= source.length) return undefined
  return isArray(source) ? source[index] : source.slice(index, index + 1).toArray()[0]
}

// `Array.isArray` does not narrow a readonly array out of a union.
function isArray<T>(source: TableSource<T>): source is readonly T[] {
  return Array.isArray(source)
}

export type TableRecord = Record<string, unknown>

export function isTableRecord(value: unknown): value is TableRecord {
  return typeof value === 'object' && value !== null
}

/** A cell's value: the row's own property `key`, or `undefined`. */
export function cellValue(row: unknown, key: string): unknown {
  return isTableRecord(row) && Object.hasOwn(row, key) ? row[key] : undefined
}

/** Text for a primitive or nested value, as search, the text filter, and downloads see it. */
export function cellText(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}
