import { Box, Button, Icon, Panel, Tooltip, type BoxMeasurementChange, type SelectFacet, type SelectFacetMultiple } from '@antadesign/anta'
import { useMemo, useRef, useState } from '@antadesign/anta/jsx-runtime'
import type { BaseProps } from '@antadesign/anta/general_types'
import { inferColumns, layoutColumns, type ColumnLayout } from '../core/table-columns'
import { builtInDownloads, type TableDownloadContext, type TableDownloadOptions } from '../core/table-download'
import { filterRows, isEmptyFilter } from '../core/table-filtering'
import { findMatches, locateMatch, scanSearch, searchRequestError, stepSearch, type SearchCell, type SearchScan } from '../core/table-search'
import { TABLE_FRAME_BORDER, TABLE_HEADER_HEIGHT, TABLE_ROW_MIN_HEIGHT, tableHeight } from '../core/table-sizing'
import { defaultCompare, sortIndices, toggleSort, type TableCompare } from '../core/table-sorting'
import { cellText, cellValue, readTableRange, readTableRow, readTableRows } from '../core/table-source'
import type {
  TableDataType, TableDownload, TableFilterFn, TableFilterValue, TableMatchRules, TableRangeSource, TableSearchRequest,
  TableSearchResult, TableSorting, TableSource,
} from '../core/table-types'
import { cellSearch, highlightMatches, type TableCellSearch } from './table-highlight'
import { TableToolbar, type TableToolbarProps } from './TableToolbar'

// Re-exporting the attribute types also registers the `<a-table-*>` tags with Anta's JSX types.
export type { ATableAttributes, ATableCellAttributes, ATableRowAttributes } from '../elements/table-attributes'

// Below these surface widths the facet chips hide, then the text filter folds into the Filter menu, then the search
// field folds into the actions menu.
const HIDE_CHIPS_BELOW = 900
const FOLD_TEXT_FILTER_BELOW = 840
const FOLD_SEARCH_BELOW = 560
const SEARCH_INPUT = '[data-table-search]'
const SEARCH_ACTIVE = '[data-search-active]'

/** A cell as a column's renderers see it. */
export interface TableCellContext<T> {
  /** `row[key]`. */
  value: unknown
  row: T
  key: string
  /** The row's index in `data`. */
  index: number
}

/** A column header with a tooltip. `title: null` leaves the header blank. */
export interface TableColumnHeader {
  title: string | null
  tooltip?: React.ReactNode
}

/** Settings for one column. Every field is optional. */
export interface TableColumn<T> {
  /** Fixed width in pixels, clamped to `minWidth` and `maxWidth`. */
  width?: number
  /** Minimum width for a column that shares the free width. Defaults to the width inferred from the first rows. */
  minWidth?: number
  maxWidth?: number
  /** Header text, `null` for a blank header, or a title with a tooltip. Defaults to the key. */
  header?: string | null | TableColumnHeader
  /** Renders the cell. Defaults to the value's text, aligned by type. */
  renderCell?: (cell: TableCellContext<T>) => React.ReactNode
  /** Renders the cell while a search runs, so the column can mark its own matches with `search.mark`. */
  renderSearchedCell?: (cell: TableCellContext<T> & { search: TableCellSearch }) => React.ReactNode
  /** Whether search scans this column.
   * @defaultValue true */
  searchable?: boolean
  /** The text this column contributes to search. Return the text the cell renders, in order. Defaults to the value's text. */
  searchText?: (cell: TableCellContext<T>) => string
  /** Class on every cell of the column. */
  cellClassName?: string
  /** `false` turns sorting off, a function replaces the comparison. Primitive columns sort by default. */
  sorting?: boolean | TableCompare
  pin?: 'left' | 'right'
}

/** A facet built from a column's values: one checkbox per option. */
export interface TableFilterOption {
  /** The column key; also the facet's key in `TableFilterValue.facets`. */
  key: string
  /** Facet label. Defaults to the key. */
  label?: string
  icon?: SelectFacetMultiple['icon']
  options: SelectFacetMultiple['options']
  renderOption?: SelectFacetMultiple['renderOption']
}

/** A horizontal span to bring into view, in content pixels, clear of pinned columns on either side. */
export interface TableRevealX {
  left: number
  width: number
  insetStart?: number
  insetEnd?: number
}

/** Props a virtualizer receives. `VirtualScroll` from `@antadesign/virtual-scroll` accepts them. */
export interface TableVirtualizerProps<R> extends BaseProps {
  items: TableRangeSource<R>
  renderItem: (item: R, index: number) => React.ReactNode
  header?: React.ReactNode
  empty?: React.ReactNode
  height?: number
  itemMinHeight?: number
  itemHeightFixed?: boolean
  contentWidth?: number
  contentKey?: string
  follow?: boolean
  marks?: Iterable<number>
  reveal?: { index: number, key?: string, target?: string, x?: TableRevealX }
  interceptKeys?: string
  onContentSizeChange?: (event: CustomEvent<{ height: number | null, width: number }>, detail: { height: number | null, width: number }) => void
}

/** A component that renders rows on demand, such as `VirtualScroll`. */
export type TableVirtualizer = <R>(props: TableVirtualizerProps<R>) => React.ReactNode

/** Options passed through to the virtualizer, such as `wheelActivation` or `initialPosition` for `VirtualScroll`. */
export type TableVirtualizerOptions = Record<string, unknown>

export interface TableProps<T> extends BaseProps {
  /** The rows: an array, or a range source that builds rows on demand. Rows are objects; each key is a column. */
  data: TableSource<T>
  /** Column settings by key. When set, these are the columns, in this order; otherwise the keys of the first rows. */
  columns?: Record<string, TableColumn<T>>
  /**
   * Renders the rows. Pass `VirtualScroll` from `@antadesign/virtual-scroll`
   * to mount only the rows near the viewport. Without it, every row is
   * mounted in a native scroll container.
   */
  virtualizer?: TableVirtualizer
  virtualizerProps?: TableVirtualizerOptions

  /**
   * Frame height in pixels, or `auto` to fit every row. The frame is the bordered header and rows; the toolbar and
   * row count are outside it. Fewer rows than fill `height` shrink the frame to them, so it never leaves a gap.
   */
  height?: number | 'auto'
  minHeight?: number
  maxHeight?: number
  /** Rows the frame fits before its container asks for more.
   * @defaultValue 10 */
  minRowsToDisplay?: number
  /** Frame width in pixels. Defaults to the width of the container. */
  width?: number
  maxWidth?: number
  /** @defaultValue 34 */
  headerHeight?: number
  hideHeader?: boolean
  hideRowCount?: boolean
  /** Minimum row height, without its border.
   * @defaultValue 26 */
  rowMinHeight?: number
  /** Rows taller than this are clipped. */
  rowMaxHeight?: number
  /** Every row is `rowMinHeight` tall; cell text does not wrap. */
  rowHeightFixed?: boolean
  rowClassName?: (row: T, index: number) => string | undefined
  /** Row and column borders.
   * @defaultValue { row: true, column: true } */
  borders?: { row?: boolean, column?: boolean }

  onRowClick?: (event: MouseEvent, row: T, index: number) => void
  /** Selected rows, by index in `data`. Pair with `onRowSelect`. */
  selected?: readonly number[]
  /**
   * Turns on selection. Receives the whole new selection on every row click,
   * and `[]` with a `null` index on Escape. Click selects one row; Ctrl or
   * Cmd + click toggles a row; Shift + click selects a range; Ctrl or Cmd +
   * Shift + click adds a range.
   */
  onRowSelect?: (selected: number[], event: MouseEvent | KeyboardEvent, index: number | null) => void

  /** `false` removes the text filter and the facets. A function replaces the built-in filter. */
  filtering?: false | TableFilterFn<T>
  /** Facets for the Filter menu. Defaults to one per column whose values are primitives. */
  filterOptions?: TableFilterOption[]
  /**
   * Inferred facets skip columns with more distinct values than this in their first 500 rows. Defaults to 100.
   * Does not limit `filterOptions`.
   */
  maxFilterOptions?: number
  /** More facets, such as `custom` ones. Only a `filtering` function sees their values. */
  filterFacets?: SelectFacet[]
  /** Controlled filter state. */
  filterValue?: TableFilterValue
  defaultFilterValue?: TableFilterValue
  onFilterChange?: (value: TableFilterValue) => void
  /** Columns the text filter searches. Defaults to every column with primitive values. */
  textFilterFields?: string[]
  /** @defaultValue Filter by text */
  textFilterPlaceholder?: string

  /** The search field, which marks matches in cells and steps through them.
   * @defaultValue true */
  searching?: boolean
  defaultSearch?: string

  /** Controlled sort order. */
  sorting?: TableSorting
  defaultSorting?: TableSorting
  onSortingChange?: (sorting: TableSorting) => void

  /** The Columns menu, which hides and shows columns.
   * @defaultValue true */
  columnHiding?: boolean
  /** Columns hidden on mount, by key. */
  defaultHiddenColumns?: string[]
  /** The Expand action, which fills the viewport with the table.
   * @defaultValue true */
  expand?: boolean
  /** The Download menu, or its options.
   * @defaultValue true */
  download?: boolean | TableDownloadOptions<T>

  /** The rows are placeholders for data still arriving: controls that act on rows are disabled. */
  dataLoading?: boolean
  /** Start at the last row and keep it in view as rows are appended. */
  follow?: boolean
  /** Fires with the size of the space the table occupies when it is measured or resized. */
  onContainerResize?: (size: { width: number, height: number }) => void
  /** Shown when there are no rows. */
  empty?: React.ReactNode
}

const DEFAULT_RULES: TableMatchRules = { matchCase: false, matchRegex: false, negate: false }
const NO_RESULT: TableSearchResult = { rows: [], total: 0, capped: false }

function headerTitle(key: string, header: TableColumn<unknown>['header']): string {
  if (typeof header === 'string') return header
  return header?.title ?? key
}

/**
 * A data table: inferred columns, pinning, sorting, a text filter and facets,
 * search, column hiding, downloads, selection, and sizing to its container.
 * Rows render in a native scroll container, or through a `virtualizer`.
 *
 * Renders `<a-table>`; its styling hooks are listed on `ATableElement`.
 *
 * @example
 * ```tsx
 * <Table data={runs} virtualizer={VirtualScroll} columns={{ id: { pin: 'left' } }} />
 * ```
 */
export function Table<T>(props: TableProps<T>): React.ReactNode {
  const {
    data, columns, virtualizer: Virtualizer, virtualizerProps, rowClassName, onRowClick, selected, onRowSelect,
    filtering, filterOptions, filterFacets, onFilterChange, onSortingChange, download = true, dataLoading, follow,
    searching = true, columnHiding = true, expand = true, borders, className, style, id, title,
  } = props
  const rowMinHeight = props.rowMinHeight ?? TABLE_ROW_MIN_HEIGHT
  // The row's bottom border is part of its height.
  const itemMinHeight = rowMinHeight + (borders?.row === false ? 0 : 1)
  const virtual = Virtualizer !== undefined

  // Only the toolbar reads the width; CSS lays out the columns.
  const [surfaceWidth, setSurfaceWidth] = useState(0)
  // The virtualizer's last complete measurement of every row, kept while the rows re-measure for the same count.
  const [virtualContent, setVirtualContent] = useState<{ count: number, height: number } | undefined>(undefined)
  const [maximized, setMaximized] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [ownSorting, setOwnSorting] = useState<TableSorting>(() => props.defaultSorting ?? [])
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set(props.defaultHiddenColumns))
  const [ownFilter, setOwnFilter] = useState<TableFilterValue>(() => props.defaultFilterValue ?? { text: '', facets: {} })
  const [filterRules, setFilterRules] = useState<TableMatchRules>(DEFAULT_RULES)
  const [query, setQuery] = useState(props.defaultSearch ?? '')
  const [searchRules, setSearchRules] = useState<TableMatchRules>(DEFAULT_RULES)
  const [focusCount, setFocusCount] = useState(0)
  const lastSelected = useRef<number | null>(null)

  const sorting = props.sorting ?? ownSorting
  const filter = props.filterValue ?? ownFilter
  const setSorting = (next: TableSorting) => {
    if (props.sorting === undefined) setOwnSorting(next)
    onSortingChange?.(next)
  }
  const setFilter = (next: TableFilterValue) => {
    if (props.filterValue === undefined) setOwnFilter(next)
    onFilterChange?.(next)
  }

  // Columns: declared, or inferred from the first rows.
  const titleOf = (key: string) => headerTitle(key, columns?.[key]?.header)
  const declaredKeys = columns ? Object.keys(columns) : undefined
  // Keyed by what inference reads, so a `columns` object recreated each render does not re-read the rows.
  const titlesKey = JSON.stringify(declaredKeys?.map(key => [key, titleOf(key)]) ?? null)
  const inferred = useMemo(
    () => inferColumns(data, titleOf, filterOptions ? [] : declaredKeys, props.maxFilterOptions),
    [data, titlesKey, !!filterOptions, props.maxFilterOptions],
  )
  const allKeys = declaredKeys ?? Object.keys(inferred)
  const visibleKeys = allKeys.filter(key => !hidden.has(key))
  const dataTypeOf = (key: string): TableDataType => inferred[key]?.dataType ?? 'other'

  // Filtering, then sorting, give the display order: display index to index in `data`.
  const filterEnabled = filtering !== false
  const textKeys = props.textFilterFields ?? allKeys.filter(key => inferred[key]?.textFilter)
  const filterSections: TableFilterOption[] = filterOptions ?? allKeys.flatMap(key => {
    const options = inferred[key]?.options
    return options ? [{ key, label: titleOf(key), options: options.map(value => ({ label: String(value), value })) }] : []
  })
  const columnFacets: SelectFacetMultiple[] = filterEnabled ? filterSections.map(option => ({
    key: option.key,
    label: option.label ?? option.key,
    icon: option.icon,
    kind: 'multiple',
    filter: true,
    selectAll: true,
    options: option.options,
    renderOption: option.renderOption,
  })) : []
  const facets: SelectFacet[] = [...columnFacets, ...(filterEnabled ? filterFacets ?? [] : [])]
  const filterKey = JSON.stringify([filter, filterRules, textKeys])
  const sortKey = JSON.stringify(sorting)
  const needsAllRows = (filterEnabled && !isEmptyFilter(filter)) || sorting.length > 0
  const rows = useMemo(() => needsAllRows ? readTableRows(data) : undefined, [data, needsAllRows])
  const order = useMemo(() => {
    if (!rows) return undefined
    const filtered = filterEnabled ? filterRows({
      rows,
      value: filter,
      rules: filterRules,
      textKeys,
      facetKeys: new Set(columnFacets.map(facet => facet.key)),
      filtering: typeof filtering === 'function' ? filtering : undefined,
    }) : undefined
    if (sorting.length === 0) return filtered
    const compare = (key: string): TableCompare | undefined => {
      const setting = columns?.[key]?.sorting
      if (setting === false) return undefined
      if (typeof setting === 'function') return setting
      // A column sorted on request with no primitive type compares as text.
      return defaultCompare(dataTypeOf(key)) ?? (setting === true ? defaultCompare('string') : undefined)
    }
    return sortIndices(filtered ?? rows.map((_, index) => index), rows, sorting, compare)
  }, [rows, filterKey, sortKey, inferred, filterEnabled, typeof filtering === 'function' ? filtering : undefined])
  const count = order ? order.length : data.length
  const sourceIndex = (displayIndex: number) => order ? order[displayIndex] : displayIndex
  const rowAt = (displayIndex: number): T | undefined => {
    if (displayIndex < 0 || displayIndex >= count) return undefined
    return rows ? rows[sourceIndex(displayIndex)] : readTableRow(data, displayIndex)
  }

  const layout: ColumnLayout = layoutColumns({ keys: visibleKeys, specs: columns ?? {}, inferred })

  // Height.
  const downloads = downloadEntries()
  const showFilter = filterEnabled && (textKeys.length > 0 || facets.length > 0)
  const showActions = columnHiding || expand || downloads !== undefined
  const showToolbar = showFilter || searching || showActions
  const searchFolded = searching && surfaceWidth > 0 && surfaceWidth < FOLD_SEARCH_BELOW
  const headerHeight = props.hideHeader ? 0 : Math.max(props.headerHeight ?? 0, TABLE_HEADER_HEIGHT)
  const sizes = tableHeight({
    count,
    rowMinHeight: itemMinHeight,
    headerHeight,
    contentHeight: props.rowHeightFixed ? count * itemMinHeight : virtualContent?.count === count ? virtualContent.height : undefined,
    virtual,
    height: props.height,
    minHeight: props.minHeight,
    maxHeight: props.maxHeight,
    minRows: props.minRowsToDisplay,
  })

  // Search over the visible, searchable columns, in render order.
  const searchKeys = layout.order.filter(key => columns?.[key]?.searchable !== false)
  const request: TableSearchRequest = { query, matchCase: searchRules.matchCase, matchRegex: searchRules.matchRegex }
  const searchError = searchRequestError(request)
  const searchActive = searching && query !== '' && !searchError
  const cellContext = (key: string, row: T, index: number) => ({ value: cellValue(row, key), row, key, index })
  const searchTextOf = (key: string, row: T, index: number) => {
    const own = columns?.[key]?.searchText
    return own ? own(cellContext(key, row, index)) : cellText(cellValue(row, key))
  }
  const cellsAt = (displayIndex: number): SearchCell[] => {
    const row = rowAt(displayIndex)
    if (row === undefined) return []
    return searchKeys.map(key => ({ key, text: searchTextOf(key, row, sourceIndex(displayIndex)) }))
  }
  const scan: SearchScan = { request, length: count, cellsAt }
  // The active match, by index in `data`, so a rescan keeps it when the rows move.
  const activeMatch = useRef<{ index: number, matchInRow: number } | undefined>(undefined)
  const baseResult = useMemo(() => {
    if (!searchActive) return NO_RESULT
    const keep = activeMatch.current
    const keepIndex = keep === undefined ? -1 : order ? order.indexOf(keep.index) : keep.index
    return scanSearch(scan, { keep: keepIndex >= 0 && keep ? { rowIndex: keepIndex, matchInRow: keep.matchInRow } : undefined })
  }, [searchActive, query, searchRules.matchCase, searchRules.matchRegex, data, order, searchKeys.join('\n')])
  const [stepped, setStepped] = useState<{ base: TableSearchResult, result: TableSearchResult } | undefined>(undefined)
  const searchResult = stepped?.base === baseResult ? stepped.result : baseResult
  const active = searchResult.active
  activeMatch.current = active ? { index: sourceIndex(active.rowIndex), matchInRow: active.matchInRow } : undefined
  const activeCell = active ? locateMatch(cellsAt(active.rowIndex), request, active.matchInRow) : undefined
  const stepMatch = (delta: 1 | -1) => setStepped({ base: baseResult, result: stepSearch(scan, searchResult, delta) })

  // Selection, by index in `data`.
  const selectedSet = useMemo(() => new Set(selected ?? []), [JSON.stringify(selected ?? [])])
  const onRowActivate = (event: MouseEvent, displayIndex: number) => {
    const index = sourceIndex(displayIndex)
    const row = rowAt(displayIndex)
    if (row === undefined) return
    onRowClick?.(event, row, index)
    if (!onRowSelect) return
    const toggle = event.ctrlKey || event.metaKey
    let next: Set<number>
    if (event.shiftKey) {
      const from = lastSelected.current ?? displayIndex
      const span: number[] = []
      for (let i = Math.min(from, displayIndex); i <= Math.max(from, displayIndex); i++) span.push(sourceIndex(i))
      next = toggle ? new Set([...selectedSet, ...span]) : new Set(span)
    } else if (toggle) {
      next = new Set(selectedSet)
      if (!next.delete(index)) next.add(index)
    } else {
      next = selectedSet.size === 1 && selectedSet.has(index) ? new Set() : new Set([index])
    }
    lastSelected.current = displayIndex
    onRowSelect([...next], event, index)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && onRowSelect && selectedSet.size > 0) {
      lastSelected.current = null
      onRowSelect([], event, null)
    } else if (virtual && searching && event.key.toLowerCase() === 'f' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
      if (searchFolded) setActionsOpen(true)
      setFocusCount(n => n + 1)
    }
  }

  // Cells.
  const renderCell = (key: string, row: T, index: number, displayIndex: number) => {
    const column = columns?.[key]
    const value = cellValue(row, key)
    const dataType = dataTypeOf(key)
    const context = cellContext(key, row, index)
    const plain = () => column?.renderCell ? column.renderCell(context) : defaultCell(value, dataType)
    let content: React.ReactNode
    let wholeCell: 'match' | 'active' | undefined
    const activeInCell = active?.rowIndex === displayIndex && activeCell?.key === key ? activeCell.matchInCell : -1
    if (searchActive && searchKeys.includes(key)) {
      if (column?.renderSearchedCell) {
        content = column.renderSearchedCell({ ...context, search: cellSearch(request, () => searchTextOf(key, row, index), activeInCell) })
      } else if (!column?.renderCell && !column?.searchText && isPrimitive(dataType)) {
        const text = cellText(value)
        const ranges = findMatches(text, request)
        content = ranges.length > 0 ? <span>{highlightMatches(text, ranges, activeInCell)}</span> : plain()
      } else {
        content = plain()
        if (findMatches(searchTextOf(key, row, index), request).length > 0) wholeCell = activeInCell >= 0 ? 'active' : 'match'
      }
    } else {
      content = plain()
    }
    return (
      <a-table-cell
        key={key}
        role="cell"
        column={key}
        type={column?.renderCell ? undefined : dataType}
        className={column?.cellClassName}
        search={wholeCell}
        data-search-active={wholeCell === 'active' ? '' : undefined}
        {...pinAttributes(key, layout, columns?.[key]?.pin)}
      >
        {content}
      </a-table-cell>
    )
  }

  const renderRow = (row: T, displayIndex: number, key?: number) => {
    const index = sourceIndex(displayIndex)
    return (
      <a-table-row
        key={key}
        role="row"
        aria-rowindex={displayIndex + 2}
        selected={selectedSet.has(index) ? '' : undefined}
        last={displayIndex === count - 1 ? '' : undefined}
        className={rowClassName?.(row, index)}
        onClick={onRowClick || onRowSelect ? (event: MouseEvent) => onRowActivate(event, displayIndex) : undefined}
      >
        {layout.order.map(key => renderCell(key, row, index, displayIndex))}
      </a-table-row>
    )
  }

  const head = props.hideHeader ? null : (
    <a-table-head role="row" aria-rowindex={1}>
      {layout.order.map(key => {
        const column = columns?.[key]
        const header = column?.header
        const titleText = header === null || (typeof header === 'object' && header?.title === null) ? null : titleOf(key)
        const tooltip = typeof header === 'object' && header !== null ? header.tooltip : undefined
        const sortable = column?.sorting === undefined ? isPrimitive(dataTypeOf(key)) : column.sorting !== false
        const sortIndex = sorting.findIndex(sort => sort.id === key)
        const sort = sortIndex >= 0 ? sorting[sortIndex] : undefined
        const label = (
          <>
            {tooltip !== undefined && tooltip !== '' && <Tooltip follow>{tooltip}</Tooltip>}
            {titleText !== null && <span>{titleText}</span>}
          </>
        )
        return (
          <a-table-header-cell
            key={key}
            role="columnheader"
            aria-label={headerTitle(key, header)}
            aria-sort={sortable ? sort ? sort.desc ? 'descending' : 'ascending' : 'none' : undefined}
            column={key}
            type={column?.renderCell ? undefined : dataTypeOf(key)}
            {...pinAttributes(key, layout, columns?.[key]?.pin)}
          >
            {sortable
              ? <Button priority="quaternary" onClick={(event: MouseEvent) => setSorting(toggleSort(sorting, key, event.shiftKey))}>
                  {label}
                  <Icon shape={sort ? sort.desc ? 'arrow-narrow-down' : 'arrow-narrow-up' : 'arrow-narrow-up-down'} data-sorted={sort ? '' : undefined} />
                  {sorting.length > 1 && sort && <sup>{sortIndex + 1}</sup>}
                  <Tooltip follow delay={1000}>
                    {titleText !== null && <><strong>{titleText}</strong><br /></>}
                    Click to sort by this column<br />
                    <kbd>Shift</kbd> + click to add it to the sort
                  </Tooltip>
                </Button>
              : label}
          </a-table-header-cell>
        )
      })}
    </a-table-head>
  )

  // Reveal the active match: the virtualizer scrolls to it, or the <a-table> element does without one.
  const revealKey = active ? `search:${sourceIndex(active.rowIndex)}:${active.matchInRow}` : undefined
  let revealX: TableRevealX | undefined
  if (activeCell && columns?.[activeCell.key]?.pin === undefined && layout.widths[activeCell.key] !== undefined) {
    let left = 0
    let insetStart = 0
    let insetEnd = 0
    let reached = false
    for (const key of layout.order) {
      const width = layout.widths[key]
      const pin = columns?.[key]?.pin
      if (pin === 'left') insetStart += width
      else if (pin === 'right') insetEnd += width
      if (key === activeCell.key) reached = true
      else if (!reached) left += width
    }
    revealX = { left, width: layout.widths[activeCell.key], insetStart, insetEnd }
  }

  // The virtualizer re-measures rows when they change width; this covers the changes it cannot see.
  const contentKey = `${filterKey}|${sortKey}|${layout.template}|${itemMinHeight}|${props.rowMaxHeight ?? ''}`
  const emptyContent = props.empty ?? 'No rows'
  let body: React.ReactNode
  if (layout.order.length === 0) {
    body = (
      <a-table-placeholder>
        No columns visible. Show columns from the actions menu <Icon shape="columns-3-cog" />.
      </a-table-placeholder>
    )
  } else if (Virtualizer) {
    const items: TableRangeSource<T> = {
      length: count,
      slice: (start, end) => ({
        toArray: () => rows && order
          ? order.slice(start, end).map(index => rows[index])
          : [...readTableRange(data, start, end)],
      }),
    }
    body = (
      <Virtualizer
        items={items}
        renderItem={(row, displayIndex) => renderRow(row, displayIndex)}
        header={head}
        empty={emptyContent}
        height={(sizes.frame ?? sizes.space ?? sizes.min) - TABLE_FRAME_BORDER}
        itemMinHeight={itemMinHeight}
        itemHeightFixed={props.rowHeightFixed}
        contentWidth={layout.contentWidth}
        contentKey={contentKey}
        follow={follow}
        marks={searchResult.rows.map(row => row.index)}
        reveal={active && revealKey ? { index: active.rowIndex, key: revealKey, target: SEARCH_ACTIVE, x: revealX } : undefined}
        interceptKeys={searching ? 'Mod+f' : undefined}
        onContentSizeChange={(_event, { height }) => {
          if (height !== null) setVirtualContent(previous => previous?.count === count && previous.height === height ? previous : { count, height })
        }}
        {...virtualizerProps}
      />
    )
  } else {
    const all = rows && order ? order.map(index => rows[index]) : readTableRange(data, 0, count)
    body = (
      // Observing edges sets the states that show the pinned-edge shadows.
      <Box observe="edges">
        <a-table-content>
          {head}
          {count === 0
            ? <a-table-placeholder style={{ height: itemMinHeight }}>{emptyContent}</a-table-placeholder>
            : all.map((row, displayIndex) => renderRow(row, displayIndex, sourceIndex(displayIndex)))}
        </a-table-content>
      </Box>
    )
  }

  const px = (value: number | undefined) => value === undefined ? undefined : `${value}px`
  const tableStyle = cssVariables({
    '--table-columns': layout.template,
    '--table-content-width': px(layout.contentWidth),
    '--table-header-height': px(headerHeight),
    '--table-row-min-height': px(itemMinHeight),
    '--table-row-max-height': props.rowMaxHeight === undefined ? 'none' : px(Math.max(itemMinHeight, props.rowMaxHeight)),
    '--table-space-height': px(sizes.space),
    '--table-frame-height': px(sizes.frame),
    '--table-frame-min-height': px(sizes.min),
    '--table-frame-max-height': px(sizes.max),
    '--table-frame-width': px(props.width),
    '--table-frame-max-width': px(props.maxWidth),
  })

  return (
    <a-table
      id={id}
      title={title}
      className={className}
      style={{ ...style, ...tableStyle }}
      virtual={virtual ? '' : undefined}
      data-row-height-fixed={props.rowHeightFixed ? '' : undefined}
      data-rows-bounded={props.rowMaxHeight !== undefined ? '' : undefined}
      data-borders-row={borders?.row === false ? 'none' : undefined}
      data-borders-column={borders?.column === false ? 'none' : undefined}
      data-follow={follow ? '' : undefined}
      data-height={props.height === 'auto' ? 'auto' : props.height !== undefined ? 'fixed' : undefined}
      // Set once rows render, so the element finds its target without waiting.
      reveal-key={!virtual && searchActive ? revealKey : undefined}
      reveal-target={!virtual ? SEARCH_ACTIVE : undefined}
      focus-key={focusCount > 0 ? String(focusCount) : undefined}
      focus-target={SEARCH_INPUT}
      onKeyDown={onKeyDown}
    >
      <Panel maximized={maximized} onStateChange={(_event, { next }) => setMaximized(next)}>
        <a-table-surface>
          {showToolbar && <TableToolbar {...toolbarProps()} />}
          <a-table-space>
            {/* Measures the room for the frame inside the panel: maximized, it moves to the top layer and reports the room it got. */}
            <Box observe="size" onMeasureChange={(_event: CustomEvent<BoxMeasurementChange>, { current }: BoxMeasurementChange) => {
              setSurfaceWidth(current.width)
              props.onContainerResize?.({ width: current.width, height: current.height })
            }} />
            <a-table-frame role="table" aria-rowcount={count + 1}>{body}</a-table-frame>
          </a-table-space>
          {!props.hideRowCount && (
            <a-table-footer>{count.toLocaleString()} {count === 1 ? 'row' : 'rows'}</a-table-footer>
          )}
        </a-table-surface>
      </Panel>
    </a-table>
  )

  function toolbarProps(): TableToolbarProps {
    const toggle = (set: (update: (previous: TableMatchRules) => TableMatchRules) => void) =>
      (key: keyof TableMatchRules) => set(previous => ({ ...previous, [key]: !previous[key] }))
    return {
      disabled: dataLoading,
      textFilter: showFilter && textKeys.length > 0 ? {
        value: filter.text,
        placeholder: props.textFilterPlaceholder ?? 'Filter by text',
        rules: filterRules,
        onChange: text => setFilter({ ...filter, text }),
        onToggleRule: toggle(setFilterRules),
        folded: surfaceWidth > 0 && surfaceWidth < FOLD_TEXT_FILTER_BELOW,
      } : undefined,
      facets: showFilter ? {
        facets,
        value: filter.facets,
        onChange: value => setFilter({ ...filter, facets: value }),
        hideChips: surfaceWidth > 0 && surfaceWidth < HIDE_CHIPS_BELOW,
      } : undefined,
      search: searching ? {
        value: query,
        error: searchError,
        rules: searchRules,
        result: searchResult,
        onChange: setQuery,
        onToggleRule: toggle(setSearchRules),
        onStep: stepMatch,
        folded: searchFolded,
      } : undefined,
      menu: { open: actionsOpen, onOpenChange: setActionsOpen },
      actions: showActions ? {
        maximized,
        onExpand: expand ? () => setMaximized(!maximized) : undefined,
        columns: columnHiding ? {
          options: allKeys.map(key => ({ key, label: titleOf(key) })),
          hidden,
          onChange: setHidden,
        } : undefined,
        downloads,
        onDownload: saveDownload,
      } : undefined,
    }
  }

  function downloadEntries(): TableDownload[] | undefined {
    if (download === false) return undefined
    const options: TableDownloadOptions<T> = download === true ? {} : download
    const context: TableDownloadContext<T> = {
      rows: () => {
        const all = rows ?? readTableRows(data)
        return Array.from({ length: count }, (_, displayIndex) => ({ row: all[sourceIndex(displayIndex)], index: sourceIndex(displayIndex) }))
      },
      rowCount: count,
    }
    return count === 0 ? [] : options.custom ? options.custom(context) : builtInDownloads(context, options)
  }

  function saveDownload(entry: TableDownload) {
    const content = entry.content()
    const options = typeof download === 'object' ? download : {}
    if (options.save) {
      options.save({ fileName: entry.fileName, content, type: entry.type })
      return
    }
    saveWithLink(entry.fileName, typeof content === 'string' ? new Blob([content], { type: entry.type ?? 'text/plain' }) : content)
  }
}

function isPrimitive(dataType: TableDataType): boolean {
  return dataType === 'string' || dataType === 'number' || dataType === 'boolean'
}

function defaultCell(value: unknown, dataType: TableDataType): React.ReactNode {
  if (value === undefined || value === null) return null
  if (typeof value === 'boolean') return <span data-value={String(value)}>{String(value)}</span>
  if (isPrimitive(dataType) || typeof value !== 'object') return <span>{cellText(value)}</span>
  return <code>{cellText(value)}</code>
}

function pinAttributes(key: string, layout: ColumnLayout, pin: 'left' | 'right' | undefined) {
  if (!pin) return {}
  return {
    pin,
    'pin-edge': key === layout.leftEdge ? 'left' as const : key === layout.rightEdge ? 'right' as const : undefined,
    style: cssVariables({ '--table-pin-offset': `${layout.pinOffsets[key] ?? 0}px` }),
  }
}

// Custom properties are not in React's CSSProperties; assigning them keeps the type without a cast.
function cssVariables(variables: Record<`--${string}`, string | undefined>): React.CSSProperties {
  const style: React.CSSProperties = {}
  Object.assign(style, variables)
  return style
}

function saveWithLink(fileName: string, blob: Blob) {
  if (typeof document === 'undefined') {
    throw new Error('Table: downloading needs `document`. Pass `download.save` when the table renders without one.')
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
