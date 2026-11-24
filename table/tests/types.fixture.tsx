import { VirtualScroll } from '@antadesign/virtual-scroll'
import { Table, type TableColumn, type TableVirtualizer } from '../src/entries/index'
import type { TableItem, TableRangeSource, TableSource } from '../src/entries/core'

type Run = { id: string, passed: boolean, duration: number }

declare const runs: Run[]
declare const lazyRuns: TableRangeSource<Run>

// Arrays and range sources are both sources, and the row type comes through.
const fromArray: TableSource<Run> = runs
const fromRange: TableSource<Run> = lazyRuns
const sameItem: Run = null as unknown as TableItem<TableRangeSource<Run>>

// `VirtualScroll` plugs in as the virtualizer, with no adapter.
const virtualizer: TableVirtualizer = VirtualScroll
const virtual = <Table data={runs} virtualizer={VirtualScroll} />
const plain = <Table data={lazyRuns} height={300} />
const auto = <Table data={runs} height="auto" />

// Column renderers receive typed rows.
const typedColumns = (
  <Table
    data={runs}
    columns={{
      id: { pin: 'left', renderCell: ({ row }) => row.id.toUpperCase() },
      duration: { sorting: (a, b) => Number(a) - Number(b), searchText: ({ row }) => row.duration.toFixed(1) },
      passed: { renderSearchedCell: ({ row, search }) => search.mark(row.passed ? 'passed' : 'failed') },
    }}
    rowClassName={row => row.passed ? undefined : 'failed'}
    onRowClick={(_event, row, index) => `${index}: ${row.id}`}
    download={{ serializeRow: row => ({ id: row.id }) }}
  />
)

// @ts-expect-error Run has no `name`.
const missingField = <Table data={runs} columns={{ id: { renderCell: ({ row }) => row.name } }} />

// @ts-expect-error `height` takes a number or `auto`.
const badHeight = <Table data={runs} height="fill" />

const column: TableColumn<Run> = { width: 120, header: { title: 'Run', tooltip: 'The run ID' } }

export { auto, badHeight, column, fromArray, fromRange, missingField, plain, sameItem, typedColumns, virtual, virtualizer }
