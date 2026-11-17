export default `import { Inspector } from '@antadesign/anta'

function Demo() {
  const config = { retries: 3, timeout_ms: 2500, endpoint: 'http://api-1:8080' }
  const failure = new Error('Ledger total is not conserved', {
    cause: new RangeError('index 9 out of range'),
  })
  const run = {
    id: 'run_4f2a9c1e',
    started: new Date('2026-11-14T03:12:44.120Z'),
    summary: { total: 25, passing: 21, failing: 4 },
    properties: [
      { name: 'Ledger total is conserved', type: 'always', status: 'failing', hits: 40211, error: failure },
      { name: 'No account goes negative', type: 'always', status: 'passing', hits: 118342 },
      { name: 'Leader is elected after a partition heals', type: 'sometimes', status: 'passing', hits: 88 },
    ],
    logs: new Map([
      ['api-1', ['leader elected term=7', 'ECONNRESET from db-primary']],
      ['workload', [
        'transfer tx_9f31 ok',
        'Traceback (most recent call last):\\n  File "driver.py", line 42, in main\\n    client.transfer(src, dst, amount)\\nTransferError: connection reset by peer',
      ]],
    ]),
    coverage: Array.from({ length: 250 }, (_, i) => Math.round((1 - Math.exp(-i / 60)) * 1000) / 1000),
    config,
    retryConfig: config,
    self: null as unknown,
  }
  run.self = run
  return <Inspector value={run} aria-label="Test run" />
}
`
