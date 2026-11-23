import assert from 'node:assert/strict'
import { test } from 'node:test'
import { queryHits, treeSearch } from '../src/tree-search.ts'

const files = [
  { id: 'src', label: 'src', children: [
    { id: 'src/index.ts', label: 'index.ts' },
    { id: 'src/ledger', label: 'ledger', children: [
      { id: 'src/ledger/transfer.ts', label: 'transfer.ts' },
      { id: 'src/ledger/Transfer.test.ts', label: 'Transfer.test.ts' },
    ] },
    // Not loaded yet: its children arrive when it opens.
    { id: 'src/fixtures', label: 'fixtures', children: [] },
  ] },
  { id: 'README.md', label: 'README.md' },
]
const ids = matches => matches.map(match => match.id)

test('matches come in the order the open tree shows them, depth first', () => {
  assert.deepEqual(ids(treeSearch(files, 's')), ['src', 'src/index.ts', 'src/ledger/transfer.ts', 'src/ledger/Transfer.test.ts', 'src/fixtures'])
})

test('a string matches literally, ignoring case; an empty query or null matches nothing', () => {
  assert.deepEqual(ids(treeSearch(files, 'TRANSFER')), ['src/ledger/transfer.ts', 'src/ledger/Transfer.test.ts'])
  assert.deepEqual(ids(treeSearch(files, '.test.')), ['src/ledger/Transfer.test.ts'], 'dots are literal')
  assert.deepEqual(treeSearch(files, ''), [])
  assert.deepEqual(treeSearch(files, '   '), [])
  assert.deepEqual(treeSearch(files, null), [])
})

test('a RegExp or a function matches as given', () => {
  assert.deepEqual(ids(treeSearch(files, /^[a-z]+\.ts$/)), ['src/index.ts', 'src/ledger/transfer.ts'])
  // A global RegExp gives the same answer for every item.
  assert.deepEqual(ids(treeSearch(files, /\.ts$/g)), ['src/index.ts', 'src/ledger/transfer.ts', 'src/ledger/Transfer.test.ts'])
  assert.deepEqual(ids(treeSearch(files, text => text.endsWith('.md'))), ['README.md'])
})

test('an invalid pattern from user input matches nothing, through null', () => {
  // The caller turns input into a RegExp, and passes null when it isn't one.
  const toQuery = input => { try { return new RegExp(input, 'i') } catch { return null } }
  assert.deepEqual(treeSearch(files, toQuery('(unclosed')), [])
  assert.deepEqual(ids(treeSearch(files, toQuery('read'))), ['README.md'])
})

test('getText supplies the text for items whose label is not a string', () => {
  const items = [{ id: 'a', label: { type: 'span' }, name: 'alpha' }, { id: 'b', label: 'beta' }]
  assert.deepEqual(ids(treeSearch(items, 'al')), [], 'a JSX label has no text by default')
  assert.deepEqual(ids(treeSearch(items, 'al', { getText: item => item.name ?? item.label })), ['a'])
})

test('each match lists the ids above it, outermost first', () => {
  const [match] = treeSearch(files, 'transfer.ts')
  assert.deepEqual(match, { id: 'src/ledger/transfer.ts', ancestors: ['src', 'src/ledger'] })
  assert.deepEqual(treeSearch(files, 'README')[0].ancestors, [])
})

test('children that have not loaded are not searched, and nothing loads them', () => {
  let reads = 0
  // A getter on `children` stands in for a loader: reading it would load.
  const lazy = { id: 'later', label: 'later', get children() { reads++; return [] } }
  assert.deepEqual(ids(treeSearch([lazy], 'x')), [])
  assert.equal(reads, 1, 'searching read the children array once, which was empty')
  assert.deepEqual(ids(treeSearch(files, 'fixtures')), ['src/fixtures'], 'an unloaded folder matches on its own label only')
})

test('hits for highlighting: every hit of a string or RegExp, the whole text for a function', () => {
  assert.deepEqual(queryHits('transfer.test.ts', 't'), [[0, 1], [9, 10], [12, 13], [14, 15]])
  assert.deepEqual(queryHits('Transfer', 'trans'), [[0, 5]])
  assert.deepEqual(queryHits('a.ts', text => text.endsWith('.ts')), [[0, 4]])
  assert.deepEqual(queryHits('a.md', text => text.endsWith('.ts')), [])
  assert.deepEqual(queryHits('abc', null), [])
})
