import { cellText, isTableRecord } from './table-source'
import type { TableDownload } from './table-types'

export const TABLE_DEFAULT_FILE_NAME = 'table-rows'

/** One displayed row, with its index in the source. */
export interface TableDownloadRow<T> {
  row: T
  index: number
}

/** What a custom download sees: the displayed rows, filtered and in sort order. */
export interface TableDownloadContext<T> {
  /** Reads the displayed rows. Call it inside `content`, after the reader picks a file. */
  rows: () => TableDownloadRow<T>[]
  rowCount: number
}

export interface TableDownloadOptions<T> {
  /** Base name for the built-in files; each format replaces the extension.
   * @defaultValue table-rows */
  fileName?: string
  /** Turns one row into the record that is written. Its keys become the TXT and CSV header and the JSON fields. */
  serializeRow?: (row: T, index: number) => Record<string, unknown>
  /** Replaces the built-in TXT, CSV, and JSON files. */
  custom?: (context: TableDownloadContext<T>) => TableDownload[]
  /**
   * Saves a file. Without it, the table saves through a temporary link, which
   * needs `document`; pass `save` when the table renders where there is none,
   * such as a worker.
   */
  save?: (file: { fileName: string, content: Blob | string, type?: string }) => void
}

const TXT_SEPARATOR = '\t'

// TXT is one tab-separated line per row, so a value's own tabs and line breaks would break the columns.
const flattenWhitespace = (s: string) => s.replace(/[\t\r\n]+/g, ' ')

function withExtension(fileName: string | undefined, extension: string): string {
  return (fileName ?? TABLE_DEFAULT_FILE_NAME).replace(/\.[^/.]+$/, '') + extension
}

// The rows' own keys, in first-seen order. Rows decide what the file holds, not the visible columns.
function recordHeaders(records: readonly unknown[]): string[] {
  const headers = new Set<string>()
  for (const record of records) {
    if (isTableRecord(record)) for (const key of Object.keys(record)) headers.add(key)
  }
  return [...headers]
}

const fieldText = (record: unknown, header: string) => cellText(isTableRecord(record) ? record[header] : undefined)

export function serializeTxt(records: readonly unknown[]): string {
  const headers = recordHeaders(records)
  if (headers.length === 0) return records.map(record => flattenWhitespace(cellText(record))).join('\n')
  return [headers, ...records.map(record => headers.map(header => fieldText(record, header)))]
    .map(line => line.map(flattenWhitespace).join(TXT_SEPARATOR))
    .join('\n')
}

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function serializeCsv(records: readonly unknown[]): string {
  const headers = recordHeaders(records)
  const lines = headers.length === 0
    ? records.map(record => [cellText(record)])
    : [headers, ...records.map(record => headers.map(header => fieldText(record, header)))]
  return lines.map(line => line.map(csvField).join(',')).join('\n')
}

export function serializeJson(records: readonly unknown[]): string {
  return JSON.stringify(records, null, 2)
}

/** The built-in downloads: every displayed row, whole, as TXT, CSV, and JSON. Column visibility does not apply. */
export function builtInDownloads<T>(context: TableDownloadContext<T>, options: TableDownloadOptions<T>): TableDownload[] {
  const records = () => context.rows().map(({ row, index }) => options.serializeRow ? options.serializeRow(row, index) : row)
  return [
    { label: 'Download TXT', fileName: withExtension(options.fileName, '.txt'), type: 'text/plain', content: () => serializeTxt(records()) },
    { label: 'Download CSV', fileName: withExtension(options.fileName, '.csv'), type: 'text/csv;charset=utf-8', content: () => serializeCsv(records()) },
    { label: 'Download JSON', fileName: withExtension(options.fileName, '.json'), type: 'application/json', content: () => serializeJson(records()) },
  ]
}
