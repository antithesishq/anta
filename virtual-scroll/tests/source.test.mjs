import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { fileURLToPath } from 'node:url'

let source

before(async () => {
  // ESBUILD_PATH lets the test run outside a pnpm install.
  const { build } = await import(process.env.ESBUILD_PATH ?? 'esbuild')
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/core/source.ts', import.meta.url))], bundle: true, write: false,
    format: 'esm', platform: 'neutral', target: 'es2022',
  })
  source = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
})

// A lazy sequence that records how it is read. Reading one index at a time is
// what the source helpers must never do.
class RecordingSequence {
  constructor(items, log = []) {
    this.items = items
    this.log = log
  }
  get length() { return this.items.length }
  at(index) {
    this.log.push(`at ${index}`)
    return this.items[index]
  }
  slice(start = 0, end = this.items.length) {
    this.log.push(`slice ${start} ${end}`)
    return new RecordingSequence(this.items.slice(start, end), this.log)
  }
  toArray() { return [...this.items] }
}

test('a range is read from an array or a sequence in one slice, clamped to the source', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ id: i }))
  assert.deepEqual(source.readVirtualScrollRange(items, 3, 6), items.slice(3, 6))
  const sequence = new RecordingSequence(items)
  assert.deepEqual(source.readVirtualScrollRange(sequence, 8, 50), items.slice(8, 10))
  assert.deepEqual(source.readVirtualScrollRange(sequence, -5, 2), items.slice(0, 2))
  assert.deepEqual(source.readVirtualScrollRange(sequence, 12, 20), [])
  assert.deepEqual(sequence.log, ['slice 8 10', 'slice 0 2', 'slice 10 10'])
})

test('mapped rows carry their item and absolute index', () => {
  const sequence = new RecordingSequence(['a', 'b', 'c', 'd', 'e'])
  assert.deepEqual(source.mapVirtualScrollRange(sequence, { start: 2, end: 4 }, (item, index) => `${index}:${item}`), ['2:c', '3:d'])
  assert.equal(sequence.log.some(entry => entry.startsWith('at')), false)
})

test('attribute formatters produce what the element parses', () => {
  assert.equal(source.virtualScrollPositionAttribute({ anchorIndex: 12, deltaPixels: -3.5, scrollX: 40, stickToBottom: true }), '12 -3.5 40 1')
  assert.equal(source.virtualScrollRevealXAttribute({ left: 100, width: 220 }), '100 220 0 0')
  assert.equal(source.virtualScrollMarksAttribute(new Set([4, 9])), '4 9')
  assert.equal(source.virtualScrollMarksAttribute([]), undefined)
})

test('the first range matches the element: the start, or the end when following', () => {
  assert.deepEqual(source.initialVirtualScrollRange({ count: 100 }), { start: 0, end: 100 })
  const following = source.initialVirtualScrollRange({ count: 100_000, follow: true, height: 220, itemMinHeight: 22 })
  assert.deepEqual(following, { start: 100_000 - 1 - 20, end: 100_000 })
})
