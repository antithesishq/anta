# Inspector

Inspector shows any JavaScript value as a tree you can open one level at a
time, such as test results, errors, and logs. Select a row to open or close it.
Long arrays and strings open a page at a time.

## Example

```tsx
import { Inspector, Text } from '@antadesign/anta'

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
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Text>
        Assertion failed with{' '}
        <Inspector layout="inline" value={{ expected: 1000000, observed: 999987.5, account: 'acct_9f31' }} aria-label="Assertion details" />{' '}
        after 3 retries.
      </Text>
      <Inspector value={run} aria-label="Test run" />
    </div>
  )
}
```
