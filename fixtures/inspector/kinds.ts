// Example values for each kind of value the Inspector shows, shared by the
// docs walkthrough (site/src/components/InspectorDemos.tsx), the unit tests
// (tests/inspector-core.test.mjs), the CSP suite (tests/inspector-csp.mjs),
// and the Bombadil fixture (./Inspector.tsx).
//
// Every value is built fresh by its function, so a test or demo can't change
// another's copy. Errors get fixed stacks, so output doesn't name the file
// that built them. Plain fields only: Node runs this file with type stripping,
// which can't run TypeScript parameter properties.

// Replaces an error's real stack, which names the line that made it.
function pinStack<E extends Error>(error: E, stack: string): E {
  return Object.defineProperty(error, 'stack', { value: stack, writable: true, configurable: true })
}

/** A class with static members. */
export class Account {
  static count = 2
  static currency = 'USD'
  id = 'acct_2'
  balance = 12.5
  frozen = false
}

/** A class with no static members, and instances with no fields. */
export class Marker {}

const traceSymbol = Symbol('trace')
const tagSymbol = Symbol('tag')

/** One entry per walkthrough section: its title and the values it shows. */
export type InspectorKind = { title: string; values: () => Record<string, unknown> }

export const inspectorKinds = {
  primitives: {
    title: 'Primitives and long strings',
    values: () => ({
      count: 42,
      ratio: -0.5,
      big: 12345678901234567890n,
      ok: true,
      missing: null,
      unset: undefined,
      name: 'ledger-api',
      log: 'transfer started\ntransfer failed: total mismatch\nretrying in 2s',
      long: 'x'.repeat(40) + ' a long string ends in an ellipsis on a closed row, and opens to show all of its text ' + 'y'.repeat(40),
    }),
  },
  nested: {
    title: 'Arrays and nested objects',
    values: () => ({
      results: [
        { test: 'transfer', ok: true, retries: 0 },
        { test: 'withdraw', ok: false, retries: 2, error: { code: 'E_BALANCE', account: 'acct_2' } },
      ],
      sparse: [1, , 3],
      empty: { list: [], object: {} },
    }),
  },
  collections: {
    title: 'Map and Set',
    values: () => ({
      roles: new Map<unknown, unknown>([
        ['api-1', 'leader'],
        ['api-2', 'follower'],
        [{ host: 'db', port: 5432 }, 'primary'],
        [7, ['term', 7]],
      ]),
      tags: new Set(['flaky', 'slow', { owner: 'ledger' }]),
      none: new Map(),
    }),
  },
  symbols: {
    title: 'Symbols',
    values: () => ({
      asValues: [traceSymbol, Symbol.iterator, Symbol.for('app.key')],
      asKeys: { plain: 1, [traceSymbol]: 2, [tagSymbol]: 3, [Symbol.for('app.key')]: 4 },
    }),
  },
  builtins: {
    title: 'RegExp, Error, and Date',
    values: () => ({
      pattern: /^acct_\d+$/gi,
      failure: pinStack(
        new Error('commit failed', { cause: pinStack(new RangeError('index 9 out of range'), 'RangeError: index 9 out of range\n    at Log.entry (src/raft/log.ts:40:9)') }),
        'Error: commit failed\n    at Ledger.commit (src/ledger/commit.ts:88:11)',
      ),
      started: new Date(Date.UTC(2026, 10, 21, 9, 30)),
      invalid: new Date('not a date'),
    }),
  },
  classes: {
    title: 'Classes and instances',
    values: () => ({
      Account,
      account: new Account(),
      Marker,
      marker: new Marker(),
    }),
  },
  functions: {
    title: 'Functions',
    values: () => ({
      named: function transfer(amount: number) { return amount },
      arrow: (amount: number) => amount * 2,
      method: { retry() { return true } }.retry,
      async: async function load() { return 1 },
      generator: function* steps() { yield 1 },
      anonymous: [function () { return 1 }][0],
    }),
  },
  iterators: {
    title: 'Generators and iterators',
    values: () => ({
      generator: (function* steps() { yield 'start'; yield 'finish' })(),
      asyncGenerator: (async function* poll() { yield 1 })(),
      arrayIterator: ['a', 'b'][Symbol.iterator](),
      mapEntries: new Map([['api-1', 'leader']]).entries(),
      setValues: new Set(['flaky']).values(),
      stringIterator: 'ok'[Symbol.iterator](),
    }),
  },
  circular: {
    title: 'Circular references',
    values: () => {
      const node: Record<string, unknown> = { id: 'api-1', peers: [] as unknown[] }
      const peer = { id: 'api-2', leader: node }
      ;(node.peers as unknown[]).push(peer)
      node.self = node
      // A cycle back to the whole value reads Circular Ref(root object).
      const value: Record<string, unknown> = { node }
      value.whole = value
      return value
    },
  },
  ranges: {
    title: 'Large lists and ranges',
    values: () => ({ samples: Array.from({ length: 1500 }, (_, i) => Math.round(Math.sin(i / 40) * 1000) / 10) }),
  },
} satisfies Record<string, InspectorKind>

export type InspectorKindName = keyof typeof inspectorKinds

/** Primitives at the root: each is a whole value, not a property. */
export const rootPrimitives = (): { label: string; value: unknown }[] => [
  { label: 'number', value: 42 },
  { label: 'string', value: 'ledger-api' },
  { label: 'null', value: null },
  { label: 'undefined', value: undefined },
  { label: 'bigint', value: 12345678901234567890n },
  { label: 'symbol', value: traceSymbol },
]
