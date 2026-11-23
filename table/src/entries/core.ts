// Renderer-free: no JSX runtime and no DOM, so worker-side code and servers can import it.
export { TABLE_DEFAULT_COLUMN_WIDTH, TABLE_INFER_ROWS, TABLE_MAX_FILTER_OPTIONS, inferColumns, layoutColumns } from '../core/table-columns'
export type { ColumnLayout, ColumnLayoutOptions, ColumnWidthSpec, InferredColumn } from '../core/table-columns'
export { TABLE_DEFAULT_FILE_NAME, builtInDownloads, serializeCsv, serializeJson, serializeTxt } from '../core/table-download'
export type { TableDownloadContext, TableDownloadOptions, TableDownloadRow } from '../core/table-download'
export { columnFilters, filterRows, isEmptyFilter, tokenizedMatch } from '../core/table-filtering'
export type { FilterRowsOptions } from '../core/table-filtering'
export { TABLE_SEARCH_MAX_ROWS, findMatches, locateMatch, scanSearch, searchRequestError, stepSearch } from '../core/table-search'
export type { SearchCell, SearchScan } from '../core/table-search'
export { TABLE_HEADER_HEIGHT, TABLE_MIN_ROWS, TABLE_ROW_MIN_HEIGHT, tableHeight } from '../core/table-sizing'
export type { TableHeight, TableHeightOptions } from '../core/table-sizing'
export { defaultCompare, sortIndices, toggleSort } from '../core/table-sorting'
export type { TableCompare } from '../core/table-sorting'
export { cellText, cellValue, readTableRange, readTableRow, readTableRows } from '../core/table-source'
export type {
  TableColumnFilter, TableDataType, TableDownload, TableFilterFn, TableFilterValue, TableItem, TableMatchRange,
  TableMatchRules, TableRangeSource, TableSearchPointer, TableSearchRequest, TableSearchResult, TableSort, TableSorting,
  TableSource,
} from '../core/table-types'
