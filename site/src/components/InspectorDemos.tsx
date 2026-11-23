import { Fragment } from 'preact'
import { useState } from 'preact/hooks'
import {
  Box, Button, Checkbox, Inspector, Slider, Text, inspectorExpandToPath, inspectorRepr, inspectorSearch,
  type InspectorPath, type InspectorReprVisitor,
} from '@antadesign/anta'
import { inspectorKinds, rootPrimitives, type InspectorKindName } from '../../../fixtures/inspector/kinds'

// Demo islands for the Inspector page. The Inspector keeps its open rows in the
// JSX wrapper, so a demo must be hydrated for its rows to open.

function stackTrace(message: string) {
  return [
    `TransferError: ${message}`,
    '    at Ledger.transfer (src/ledger/transfer.ts:88:11)',
    '    at Driver.step (workload/driver.ts:42:5)',
    '    at async run (workload/main.ts:17:3)',
  ].join('\n')
}

/** A test result with a long array and a multiline string. */
export function LevelsDemo() {
  const result = {
    property: 'Ledger total is conserved',
    status: 'failing',
    failures: 3,
    balances: Array.from({ length: 250 }, (_, i) => Math.round(1000 + Math.sin(i / 7) * 400) / 100),
    stack: stackTrace('total mismatch'),
  }
  return <Inspector value={result} aria-label="Test result" />
}

/** A 1,500-item list with the default ranges, and 100,000 items with chunkSize 50. */
export function LongListDemo() {
  const [values] = useState(() => ({
    samples: Array.from({ length: 1500 }, (_, i) => Math.round(Math.sin(i / 40) * 1000) / 10),
    events: Array.from({ length: 100000 }, (_, i) => ({ seq: i, kind: i % 7 === 0 ? 'retry' : 'ok' })),
  }))
  return (
    <Box display="grid" gap={16} style={{ width: '100%' }}>
      <Inspector value={{ samples: values.samples }} expandDepth={2} aria-label="1,500 samples" />
      <Inspector value={{ events: values.events }} expandDepth={2} chunkSize={50} aria-label="100,000 events" />
    </Box>
  )
}

/** A value to try each copy item on: a string, a nested path, a Map entry, and a Set item. */
export function CopyDemo() {
  const [value] = useState(() => ({
    log: 'transfer started\ntransfer failed: total mismatch',
    results: [{ test: 'withdraw', details: { error: { code: 'E_BALANCE', account: 'acct_2' } } }],
    byKey: new Map([['api-1', { role: 'leader' }]]),
    tags: new Set(['flaky']),
    options: { retries: 2, timeout_ms: 2500 },
  }))
  return <Inspector value={value} expandDepth={3} aria-label="Run" />
}

/** Open rows held by the page, with buttons that reveal a row, open everything, and close everything. */
export function ControlledDemo() {
  const run = {
    id: 'run_4f2a',
    results: [
      { test: 'transfer', ok: true },
      { test: 'withdraw', ok: false, error: { code: 'E_BALANCE', account: 'acct_2', balance: -12.5 } },
    ],
  }
  const errorPath: InspectorPath = [
    { type: 'property', key: 'results' }, { type: 'index', index: 1 }, { type: 'property', key: 'error' },
  ]
  const [open, setOpen] = useState<string[]>(['r'])
  const [current, setCurrent] = useState<InspectorPath>()
  // Every row's ancestors, from a search that matches everything.
  const all = () => inspectorSearch(run, () => true).reduce((keys, match) => inspectorExpandToPath(run, keys, match.path), ['r'])
  return (
    <Box display="grid" gap={12} style={{ width: '100%' }}>
      <Box display="flex" gap={8} style={{ flexWrap: 'wrap' }}>
        <Button size="small" priority="secondary" label="Expand to results[1].error"
          onClick={() => { setOpen(keys => inspectorExpandToPath(run, keys, errorPath)); setCurrent(errorPath) }} />
        <Button size="small" priority="secondary" label="Expand all" onClick={() => setOpen(all())} />
        <Button size="small" priority="secondary" label="Collapse all" onClick={() => { setOpen([]); setCurrent(undefined) }} />
      </Box>
      <Inspector value={run} open={open} onStateChange={(_event, { next }) => setOpen(next)} current={current} aria-label="Run" />
    </Box>
  )
}

/** Two runs of one test: rows open in one stay open in the other where their paths exist. */
export function ReplaceDemo() {
  const runs = [
    { seed: 42, status: 'failing', nodes: { 'api-1': { role: 'leader', term: 7 }, 'api-2': { role: 'follower', term: 7 } } },
    { seed: 43, status: 'passing', nodes: { 'api-2': { role: 'leader', term: 8 }, 'api-3': { role: 'follower', term: 8 } } },
  ]
  const [index, setIndex] = useState(0)
  return (
    <Box display="grid" gap={12} style={{ width: '100%' }}>
      <Box>
        <Button size="small" priority="secondary" label={`Show seed ${runs[1 - index].seed}`} onClick={() => setIndex(1 - index)} />
      </Box>
      <Inspector value={runs[index]} defaultOpen={['r', 'r/.nodes', 'r/.nodes/.api-2']} aria-label="Run" />
    </Box>
  )
}

/** A searchable value with the same key at several depths. */
export function SearchDemo() {
  const report = {
    region: 'emea',
    countries: ['France', 'Kenya', 'Norway'],
    sites: [
      { name: 'paris-1', countries: ['France'] },
      { name: 'nairobi-1', countries: ['Kenya'], fallback: { countries: ['France', 'Norway'] } },
    ],
    notes: 'countries are ISO 3166 names',
  }
  return <Inspector value={report} searchable aria-label="Region report" />
}

/** A search that reads the query as a regular expression. An invalid pattern matches nothing. */
export function RegexSearchDemo() {
  const [hosts] = useState(() => ({
    cluster: 'ledger-prod',
    nodes: [
      { host: 'api-1', role: 'leader', zone: 'eu-west-1a' },
      { host: 'api-2', role: 'follower', zone: 'eu-west-1b' },
      { host: 'db-1', role: 'primary', zone: 'eu-west-1a' },
      { host: 'db-2', role: 'replica', zone: 'eu-west-1c' },
      { host: 'cache-1', role: 'standby', zone: 'eu-west-1b' },
    ],
  }))
  return (
    <Inspector
      value={hosts}
      expandDepth={3}
      searchable
      searchMatcher={query => {
        try { return new RegExp(query, 'i') } catch { return () => false }
      }}
      aria-label="Cluster nodes"
    />
  )
}

/** A search with a function matcher: the query is a number, and values above it match. */
export function ThresholdSearchDemo() {
  const [latency] = useState(() => ({
    window: '5m',
    routes: [
      { route: '/transfer', p50: 41, p99: 380 },
      { route: '/balance', p50: 12, p99: 95 },
      { route: '/withdraw', p50: 55, p99: 1210 },
      { route: '/health', p50: 2, p99: 9 },
    ],
  }))
  return (
    <Inspector
      value={latency}
      expandDepth={3}
      searchable
      searchMatcher={query => {
        const limit = Number(query)
        return text => Number.isFinite(limit) && text.trim() !== '' && Number(text) > limit
      }}
      aria-label="Route latency in milliseconds"
    />
  )
}

/** A search over 100,000 items, with matches at 900 and 50,000. */
export function LargeSearchDemo() {
  const [samples] = useState(() => Array.from({ length: 100000 }, (_, i) =>
    i === 900 || i === 50000 ? 'timeout' : Math.round(Math.sin(i / 50) * 1000) / 10))
  return <Inspector className="inspector-scroll" value={{ samples }} searchable aria-label="Latency samples" />
}

// How many levels each walkthrough kind opens, so its interesting rows show.
const KIND_DEPTH: Partial<Record<InspectorKindName, number>> = { nested: 3, collections: 2, symbols: 2, builtins: 2, classes: 2, circular: 3 }

/** One kind of value from the walkthrough fixtures (fixtures/inspector/kinds.ts). */
export function KindDemo({ kind }: { kind: InspectorKindName }) {
  const [value] = useState(() => inspectorKinds[kind].values())
  return <Inspector value={value} expandDepth={KIND_DEPTH[kind] ?? 1} aria-label={inspectorKinds[kind].title} />
}

/** A primitive as the whole value: one row that can't open. */
export function RootPrimitivesDemo() {
  return (
    <Box display="grid" gap={8} style={{ width: '100%', gridTemplateColumns: 'max-content minmax(0, 1fr)', alignItems: 'baseline' }}>
      {rootPrimitives().map(({ label, value }) => (
        <Fragment key={label}>
          <Text size="small">{label}</Text>
          <Inspector value={value} aria-label={`Root value: ${label}`} />
        </Fragment>
      ))}
    </Box>
  )
}

/** A one-line value in a sentence and in a table cell. */
export function InlineDemo() {
  const details = { expected: 1000000, observed: 999987.5, account: 'acct_9f31' }
  return (
    <Box display="grid" gap={16} style={{ width: '100%' }}>
      <Text>
        The assertion failed with <Inspector layout="inline" value={details} aria-label="Assertion details" /> after
        three retries.
      </Text>
      <table>
        <thead><tr><th>Property</th><th>Last value</th></tr></thead>
        <tbody>
          <tr><td>No account goes negative</td><td><Inspector layout="inline" value={{ account: 'acct_2', balance: 12.5 }} aria-label="Last value for No account goes negative" /></td></tr>
          <tr><td>Leader elected after a partition</td><td><Inspector layout="inline" value={{ term: 7, leader: 'api-1' }} aria-label="Last value for Leader elected after a partition" /></td></tr>
        </tbody>
      </table>
    </Box>
  )
}

/** A Slider sets `previewBudget` on a block and an inline Inspector of the same value. */
export function CharacterLimitDemo() {
  const [value] = useState(() => ({
    run: 'run_4f2a', seed: 42, failing: ['transfer', 'withdraw'], took: '92.5s', retries: 3,
    worker: { host: 'api-2', zone: 'eu-west-1b' },
  }))
  const [budget, setBudget] = useState(40)
  const [unlimited, setUnlimited] = useState(false)
  const previewBudget = unlimited ? Infinity : budget
  return (
    <Box display="grid" gap={12} style={{ width: '100%' }}>
      <Box display="flex" gap={16} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Box style={{ flex: '1 1 240px' }}>
          <Slider label="previewBudget" min={10} max={160} step={1} value={budget} disabled={unlimited}
            onValueChange={(_event, { value: next }) => setBudget(next)} />
        </Box>
        <Checkbox label="No limit (Infinity)" checked={unlimited} onStateChange={(_event, { next }) => setUnlimited(next === true)} />
      </Box>
      <Inspector value={{ run: value }} previewBudget={previewBudget} aria-label="Run, block layout" />
      <Text>
        Inline: <Inspector layout="inline" value={value} previewBudget={previewBudget} aria-label="Run, inline layout" />
      </Text>
    </Box>
  )
}

/** A deeply nested value in a narrow box, whose width a Slider sets. */
export function NarrowDemo() {
  const [value] = useState(() => {
    let node: Record<string, unknown> = { error: 'balance below zero after transfer tx_9f31', code: 'E_BALANCE' }
    for (const key of ['account', 'ledger', 'shard', 'replica', 'region', 'cluster', 'run']) node = { [key]: node }
    return node
  })
  const [width, setWidth] = useState(240)
  return (
    <Box display="grid" gap={12} style={{ width: '100%' }}>
      <Slider label="Container width" min={160} max={640} step={10} value={width} valueSuffix="px"
        onValueChange={(_event, { value: next }) => setWidth(next)} />
      <Box style={{ width: `${width}px`, maxWidth: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: 4 }}>
        <Inspector value={value} expandDepth={10} aria-label="Nested failure" />
      </Box>
    </Box>
  )
}

/** Log lines that each print a value inline. */
export function LogDemo() {
  const error = new Error('transfer tx_9f31 failed', { cause: new RangeError('index 9 out of range') })
  error.stack = stackTrace('transfer tx_9f31 failed')
  const entries = [
    { time: '12:04:01', message: 'transfer failed', value: error },
    { time: '12:04:01', message: 'ledger state', value: { accounts: 8, total: 999987.5, frozen: [] } },
    { time: '12:04:02', message: 'peers', value: new Map([['api-1', 'leader'], ['api-2', 'follower'], ['db', 'primary']]) },
    { time: '12:04:03', message: 'retries left', value: 2 },
  ]
  return (
    <Box display="grid" gap={4} style={{ width: '100%' }}>
      {entries.map(entry => (
        <Text key={`${entry.time}-${entry.message}`}>
          <span style={{ color: 'var(--text-3)' }}>{entry.time}</span> {entry.message}{' '}
          <Inspector layout="inline" value={entry.value} aria-label={entry.message} />
        </Text>
      ))}
    </Box>
  )
}

/** An error with a cause, and an object that contains itself. */
export function ErrorsDemo() {
  const cause = new RangeError('index 9 out of range')
  cause.stack = 'RangeError: index 9 out of range\n    at Log.entry (src/raft/log.ts:40:9)'
  const failure = new Error('commit failed', { cause })
  failure.stack = stackTrace('commit failed')
  const node: Record<string, unknown> = { id: 'api-1', role: 'leader', failure }
  node.self = node
  return <Inspector value={node} expandDepth={2} aria-label="Cluster node" />
}

class Moment {
  constructor(public vtime: number, public inputHash: bigint) {}
  [inspectorRepr](v: InspectorReprVisitor) { v.constructor_call('Moment', this.vtime, this.inputHash) }
}

class Duration {
  constructor(public ms: number) {}
  [inspectorRepr](v: InspectorReprVisitor) {
    const s = this.ms / 1000
    v.span(s >= 60 ? `${Math.floor(s / 60)}m ${(s % 60).toFixed(1)}s` : `${s.toFixed(3)}s`, 'number')
  }
}

class Container {
  socket = { fd: 7, buffered: new Uint8Array(64) }
  constructor(public name: string, public image: string, public pid: number) {}
  [inspectorRepr](v: InspectorReprVisitor) {
    v.class_object_like('Container', { name: this.name, image: this.image, pid: this.pid })
  }
}

/** Classes that choose how they appear. */
export function CustomTypesDemo() {
  const event = {
    at: new Moment(4021.88, -8812736451927364n),
    took: new Duration(92500),
    container: new Container('api-1', 'demo/api:1.4.2', 311),
  }
  return <Inspector value={event} expandDepth={2} aria-label="Event" />
}

/** A value for the styling recipes. */
export function StylingDemo({ className }: { className?: string }) {
  return <Inspector className={className} value={{ run: 'run_4f2a', results: [{ id: 't1', ok: true }] }} expandDepth={2} aria-label="Run" />
}
