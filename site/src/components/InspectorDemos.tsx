import { Box, Inspector, Text, inspectorRepr, type InspectorReprVisitor } from '@antadesign/anta'

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
  return <Inspector value={result} pageSize={50} aria-label="Test result" />
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
