import { useEffect, useMemo, useState } from 'preact/hooks'
import { Button, Tag } from '@antadesign/anta'
import { Table, type TableColumn, type TableFilterValue } from '@antadesign/table'
import { VirtualScroll } from '@antadesign/virtual-scroll'
import styles from './TableDemo.module.css'

export type TableExampleName = 'basic' | 'virtual' | 'wide' | 'columns' | 'filtering' | 'search' | 'selection' | 'sizes' | 'growing' | 'downloads'

/** Registers the table and the virtual scroll elements from their packages, after the island mounts. */
function useTableElements() {
  useEffect(() => {
    import('@antadesign/table/elements/a-table')
    import('@antadesign/virtual-scroll/elements/a-virtual-scroll')
  }, [])
}

type Run = {
  id: string
  suite: string
  status: 'passed' | 'failed' | 'running'
  duration: number
  findings: number
  flaky: boolean
  owner: string
  summary: string
}

const SUITES = ['checkout', 'ledger', 'search', 'replication', 'auth', 'billing']
const OWNERS = ['ana', 'kofi', 'mei', 'ravi', 'sasha', 'tomas']
const STATUSES: Run['status'][] = ['passed', 'passed', 'passed', 'failed', 'running']
const SUMMARIES = [
  'Clean run.',
  'Replica lag exceeded the threshold twice during a partition.',
  'A retried write was applied twice after the leader restarted, so one account was debited twice.',
  'Timed out waiting for the cluster to become healthy.',
]

/** Deterministic rows, so a row always has the same values. */
function makeRuns(count: number, offset = 0): Run[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + offset
    const s = (n * 2654435761) % 2 ** 32
    const status = STATUSES[s % STATUSES.length]
    return {
      id: `run-${String(n).padStart(5, '0')}`,
      suite: SUITES[n % SUITES.length],
      status,
      duration: 30 + (s % 3570),
      findings: status === 'failed' ? 1 + (s % 4) : 0,
      flaky: s % 11 === 0,
      owner: OWNERS[Math.floor(s / 8) % OWNERS.length],
      summary: SUMMARIES[status === 'failed' ? 1 + (s % 3) : 0],
    }
  })
}

const minutes = (seconds: number) => `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`

function StatusTag({ status }: { status: Run['status'] }) {
  const tone = status === 'passed' ? 'success' : status === 'failed' ? 'critical' : 'info'
  return <Tag size="small" tone={tone} label={status} />
}

const RUNS_40 = makeRuns(40)
const RUNS_10K = makeRuns(10_000)

/** 1. Zero configuration: columns, types, widths, filters, and sorting all come from the rows. */
function BasicExample() {
  useTableElements()
  return <Table className={styles.table} data={RUNS_40} />
}

/** 2. The virtualizer plugged in: 10,000 rows, pinned columns, custom cells, and selection. */
function VirtualExample() {
  useTableElements()
  const [selected, setSelected] = useState<number[]>([])
  const columns: Record<string, TableColumn<Run>> = {
    id: { pin: 'left', width: 120 },
    status: { width: 110, renderCell: ({ row }) => <StatusTag status={row.status} />, searchText: ({ row }) => row.status },
    suite: { width: 130 },
    duration: { width: 120, header: { title: 'Duration', tooltip: 'Wall-clock time of the run' }, renderCell: ({ row }) => minutes(row.duration) },
    summary: { minWidth: 420 },
    owner: { width: 110 },
    findings: { pin: 'right', width: 110 },
  }
  return (
    <div className={styles.demo}>
      <Table className={styles.table} data={RUNS_10K} virtualizer={VirtualScroll} columns={columns} height={420}
        selected={selected} onRowSelect={setSelected} />
      <div className={styles.readout}>
        <Tag size="small" label="Selected" value={selected.length ? selected.slice(0, 5).join(', ') + (selected.length > 5 ? ', …' : '') : 'none'} />
      </div>
    </div>
  )
}

type HostLatency = { host: string } & Record<string, string | number>

const HOURS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`)

/** p99 latency in milliseconds per host and hour, deterministic. */
const HOST_LATENCY: HostLatency[] = Array.from({ length: 5_000 }, (_, i) => {
  const row: HostLatency = { host: `node-${String(i).padStart(4, '0')}.us-east` }
  HOURS.forEach((hour, h) => { row[hour] = 20 + ((i * 7919 + h * 104729) % 480) })
  return row
})

const WIDE_COLUMNS: Record<string, TableColumn<HostLatency>> = {
  host: { pin: 'left', width: 170 },
  ...Object.fromEntries(HOURS.map(hour => [hour, { width: 92 }])),
}

/** 3. A virtualized table wider than its frame, with a pinned column. */
function WideExample() {
  useTableElements()
  return <Table className={styles.table} data={HOST_LATENCY} virtualizer={VirtualScroll} columns={WIDE_COLUMNS} height={400} />
}

/** 4. Column widths, headers, and pinning. */
function ColumnsExample() {
  useTableElements()
  return (
    <Table
      className={styles.table}
      data={RUNS_40}
      height={300}
      columns={{
        id: { pin: 'left', width: 110, header: 'Run' },
        status: { width: 100, header: null },
        suite: { minWidth: 120, maxWidth: 160 },
        summary: { minWidth: 520, header: { title: 'Summary', tooltip: 'The first finding, or Clean run.' } },
        duration: { width: 110, sorting: false },
        flaky: { pin: 'right', width: 80 },
      }}
    />
  )
}

/** 5. A controlled filter with a custom facet and a custom filter function. */
function FilteringExample() {
  useTableElements()
  const [filter, setFilter] = useState<TableFilterValue>({ text: '', facets: { status: ['failed'] } })
  return (
    <div className={styles.demo}>
      <Table
        className={styles.table}
        data={RUNS_40}
        height={300}
        filterValue={filter}
        onFilterChange={setFilter}
        textFilterFields={['id', 'summary']}
        textFilterPlaceholder="Filter run or summary"
        filterOptions={[
          { key: 'status', label: 'Status', options: ['passed', 'failed', 'running'] },
          { key: 'suite', label: 'Suite', options: SUITES },
        ]}
      />
      <div className={styles.readout}>
        <Tag size="small" label="Filter" value={JSON.stringify(filter)} />
        <Button size="small" priority="secondary" label="Show failed checkout runs"
          onClick={() => setFilter({ text: '', facets: { status: ['failed'], suite: ['checkout'] } })} />
      </div>
    </div>
  )
}

/** 6. Search with a column that marks its own matches. */
function SearchExample() {
  useTableElements()
  return (
    <Table
      className={styles.table}
      data={RUNS_40}
      height={300}
      defaultSearch="twice"
      columns={{
        id: { width: 110 },
        status: {
          width: 110,
          renderCell: ({ row }) => <StatusTag status={row.status} />,
          renderSearchedCell: ({ row, search }) => <Tag size="small" label={search.mark(row.status)} />,
          searchText: ({ row }) => row.status,
        },
        summary: { minWidth: 360 },
        duration: { width: 110, renderCell: ({ row }) => minutes(row.duration), searchText: ({ row }) => minutes(row.duration) },
      }}
    />
  )
}

/** 7. Controlled selection. */
function SelectionExample() {
  useTableElements()
  const [selected, setSelected] = useState<number[]>([2, 3])
  return (
    <div className={styles.demo}>
      <Table className={styles.table} data={RUNS_40} height={260} selected={selected} onRowSelect={setSelected}
        columns={{ id: { width: 120 }, suite: {}, status: {}, owner: {} }} />
      <div className={styles.readout}>
        <Tag size="small" label="Selected rows" value={selected.length ? [...selected].sort((a, b) => a - b).join(', ') : 'none'} />
      </div>
    </div>
  )
}

/** 8. Sizing: a fixed height without a virtualizer, every row at `auto`, and a table that fills its container. */
function SizesExample() {
  useTableElements()
  const columns = { id: { width: 120 }, suite: {}, status: {}, duration: {} }
  const few = RUNS_40.slice(0, 6)
  return (
    <div className={styles.columns}>
      <div>
        <p className={styles.caption}>height=240, every row mounted</p>
        <Table data={RUNS_40} columns={columns} height={240} searching={false} filtering={false} />
      </div>
      <div>
        <p className={styles.caption}>height="auto"</p>
        <Table data={few} columns={columns} height="auto" searching={false} filtering={false} />
      </div>
      <div className={styles.fill}>
        <p className={styles.caption}>Fills a 320px flex container</p>
        <Table data={RUNS_40} columns={columns} searching={false} filtering={false} />
      </div>
    </div>
  )
}

/** 9. A table that grows, following its newest row. */
function GrowingExample() {
  useTableElements()
  const [count, setCount] = useState(30)
  const [running, setRunning] = useState(true)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setCount(n => n + 1), 400)
    return () => clearInterval(id)
  }, [running])
  const rows = useMemo(() => makeRuns(count), [count])
  return (
    <div className={styles.demo}>
      <div className={styles.toolbar}>
        <Button size="small" priority="secondary" label={running ? 'Pause' : 'Resume'} onClick={() => setRunning(r => !r)} />
      </div>
      <Table className={styles.table} data={rows} virtualizer={VirtualScroll} height={260} follow
        columns={{ id: { width: 120 }, suite: {}, status: { renderCell: ({ row }) => <StatusTag status={row.status} /> }, duration: {} }} />
    </div>
  )
}

/** 10. Downloads: a row serializer and a custom file. */
function DownloadsExample() {
  useTableElements()
  return (
    <div className={styles.columns}>
      <Table
        data={RUNS_40}
        height={220}
        columns={{ id: {}, suite: {}, status: {} }}
        download={{
          fileName: 'runs',
          serializeRow: (run, index) => ({ rank: index + 1, run: run.id, status: run.status.toUpperCase(), minutes: Math.round(run.duration / 60) }),
        }}
      />
      <Table
        data={RUNS_40}
        height={220}
        columns={{ id: {}, suite: {}, findings: {} }}
        download={{
          custom: ({ rows, rowCount }) => [{
            label: `Download ${rowCount} run IDs`,
            fileName: 'run-ids.txt',
            content: () => rows().map(({ row }) => row.id).join('\n'),
          }],
        }}
      />
    </div>
  )
}

const EXAMPLES: Record<TableExampleName, () => preact.JSX.Element> = {
  basic: BasicExample,
  virtual: VirtualExample,
  wide: WideExample,
  columns: ColumnsExample,
  filtering: FilteringExample,
  search: SearchExample,
  selection: SelectionExample,
  sizes: SizesExample,
  growing: GrowingExample,
  downloads: DownloadsExample,
}

export function TableExample({ example }: { example: TableExampleName }) {
  const Example = EXAMPLES[example]
  return <Example />
}
