import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as hegel from '@hegeldev/hegel'
import * as gs from '@hegeldev/hegel/generators'
import * as core from '../src/inspector-core.ts'
import { build, leaves, longText, multilineText, primitives, recipes, reprOptions } from './inspector-core.fixture.ts'

const repr = (value, options) => core.repr(value, options)
const make = recipe => build(recipe, { toRepr: core.to_repr })
// Replaces an error's real stack, which names the line that made it, with fixed text.
const pin = (error, stack = `${error.name}: ${error.message}`) =>
  Object.defineProperty(error, 'stack', { value: stack, writable: true, configurable: true })

// Derandomized runs derive each run's seed from the test, so CI results repeat.
const settings = process.env.CI ? { derandomize: true } : {}

test('formats primitives', () => {
  assert.equal(repr(1), '1')
  assert.equal(repr(-0), '-0')
  assert.equal(repr(NaN), 'NaN')
  assert.equal(repr(-Infinity), '-Infinity')
  assert.equal(repr(12n), '12n')
  assert.equal(repr(true), 'true')
  assert.equal(repr(null), 'null')
  assert.equal(repr(undefined), 'undefined')
})

test('escapes strings, quoted or not', () => {
  assert.equal(repr('a"b\n'), '"a\\"b\\n"')
  assert.equal(repr('a"b', { unquoted_strings: true }), 'a\\"b')
})

test('formats numbers in other bases', () => {
  assert.equal(repr(255, { numeric_base: 'hex' }), '0xFF')
  assert.equal(repr(-10, { numeric_base: 'binary' }), '-0b1010')
  assert.equal(repr(8, { numeric_base: 'octal' }), '0o10')
  assert.equal(repr(255n, { numeric_base: 'hex' }), '0xffn')
})

test('formats arrays, including empty slots', () => {
  assert.equal(repr([1, 'a']), '[1,"a"]')
  assert.equal(repr([1, , 3]), '[1,<1 empty slot>,3]')
  assert.equal(repr(new Array(2)), '[<2 empty slots>]')
})

test('formats objects, class instances, and inherited properties', () => {
  assert.equal(repr({ a: 1, 'b c': 2 }), '{a:1,"b c":2}')
  class Point { constructor() { this.x = 1 } }
  assert.equal(repr(new Point()), 'Point{x:1}')
  assert.equal(repr(Object.create({ inherited: 1 })), '{inherited:1}')
})

test('never calls getters', () => {
  assert.equal(repr({ get boom() { throw new Error('getter ran') } }), '{}')
})

test('formats Map, Set, Error, RegExp, and typed arrays', () => {
  assert.equal(repr(new Map([['k', 1], [2, 'v']])), 'Map{"k":1,2:"v"}')
  assert.equal(repr(new Set([1, 'a'])), 'Set{1,"a"}')
  assert.equal(repr(pin(new Error('boom'))), 'Error("boom"){stack:"Error: boom"}')
  assert.equal(repr(/ab+/gi), '/ab+/gi')
  assert.equal(repr(new Uint8Array([1, 2])), 'Uint8Array[1,2]')
})

test('formats functions and symbols', () => {
  assert.equal(repr(function foo() {}), '<function foo>')
  assert.equal(repr(() => {}), '<anonymous function>')
  assert.equal(repr(Symbol('x')), 'Symbol("x")')
  assert.equal(repr(Symbol.for('k')), 'Symbol.for("k")')
  assert.equal(repr(Symbol.iterator), 'Symbol.iterator')
})

test('labels circular and repeated references', () => {
  const o = { child: {} }
  o.child.parent = o
  assert.equal(repr(o), '{child:{parent:circular_ref[]}}')
  const shared = {}
  assert.equal(repr([shared, shared]), '[{},ref[0]]')
  assert.equal(repr([shared, shared], { deduplicate_references: false }), '[{},{}]')
})

test('lets custom types describe themselves with to_repr', () => {
  const point = { [core.to_repr](v) { v.constructor_call('Point', 1, 2) } }
  assert.equal(repr(point), 'Point(1,2)')
})

test('truncates at char_limit without splitting surrogate pairs', () => {
  assert.equal(repr('abcdefghij', { char_limit: 8 }), '"abcd...')
  assert.equal(repr('😀😀', { char_limit: 5 }), '"...')
})

// Ported from the legacy property-based tests.

test('output respects char_limit', () =>
  hegel.test(tc => {
    const { value } = make(tc.draw(recipes(), 'recipe'))
    const charLimit = tc.draw(gs.integers({ minValue: 3, maxValue: 33 }), 'charLimit')
    const out = repr(value, { char_limit: charLimit })
    assert.ok(out.length <= charLimit, `length ${out.length} > ${charLimit}: ${out}`)
  }, settings))

test('equal values give equal output', () =>
  hegel.test(tc => {
    const recipe = tc.draw(recipes(), 'recipe')
    assert.equal(repr(make(recipe).value), repr(make(recipe).value))
  }, settings))

test('equal sub-objects give equal output', () =>
  hegel.test(tc => {
    const recipe = tc.draw(recipes(), 'recipe')
    const r1 = repr({ foo1: make(recipe).value }).replace(/foo2/g, 'foo1')
    const r2 = repr({ foo2: make(recipe).value }).replace(/foo2/g, 'foo1')
    assert.equal(r1, r2)
  }, settings))

test('stops early once the limit is reached', () =>
  hegel.test(tc => {
    const { value } = make(tc.draw(recipes(), 'recipe'))
    const map = new Map([['value', value]])
    const fullLength = repr(map).length
    tc.assume(fullLength > 3)
    map.set('last', new Proxy({}, { get: () => { throw new Error('touched after the limit') } }))
    repr(map, { char_limit: fullLength - 3 })
  }, settings))

test('primitives print the same exactly when Object.is', () =>
  hegel.test(tc => {
    const a = tc.draw(primitives, 'a')
    const b = tc.draw(primitives, 'b')
    const ra = repr(a, { char_limit: 1000 })
    const rb = repr(b, { char_limit: 1000 })
    if (Object.is(a, b)) assert.equal(ra, rb)
    else assert.notEqual(ra, rb)
  }, settings))

// Regressions for bugs in the legacy notebook repr(). The examples pin each bug
// down; the properties look for variations of it.

test('reads through a Proxy whose get trap throws', () => {
  assert.equal(repr(new Proxy({ a: 1 }, { get() { throw new Error('trap') } })), '{a:1}')
})

test('a repeated function with to_repr is not circular', () => {
  const f = Object.assign(function named() {}, { [core.to_repr](v) { v.span('F', 'function_name') } })
  assert.equal(repr([f, f]), '[F,ref[0]]')
})

test('reports trailing empty slots next to a named property', () => {
  assert.equal(repr(Object.assign(new Array(2), { x: 1 })), '[<2 empty slots>]{x:1}')
})

test('a repeated symbol prints as ref[...]', () => {
  const s = Symbol('s')
  assert.equal(repr([s, s]), '[Symbol("s"),ref[0]]')
})

test('prints <inaccessible> for reads that throw', () => {
  const boom = () => { throw new Error('boom') }
  const revocable = Proxy.revocable({}, {})
  revocable.revoke()
  assert.equal(repr(new Proxy({}, { has: boom })), '<inaccessible>')
  assert.equal(repr(new Proxy({ a: 1 }, { ownKeys: boom })), '{<inaccessible>}')
  assert.equal(repr(new Proxy({}, { getPrototypeOf: boom })), '<inaccessible>')
  assert.equal(repr(new Proxy({ a: 1 }, { getOwnPropertyDescriptor: boom })), '<inaccessible>')
  assert.equal(repr(revocable.proxy), '<inaccessible>')
  assert.equal(repr({ [core.to_repr](v) { v.span('X', 'class_name'); boom() } }), 'X<inaccessible>')
  assert.equal(repr(Object.defineProperty(pin(new Error('m')), 'message', { get: boom })), 'Error(<inaccessible>){stack:"Error: m"}')
  assert.equal(repr(Object.defineProperty([1, 2], 1, { get: boom })), '[1,<inaccessible>]')
  assert.equal(repr({ ok: 1, bad: new Proxy({}, { has: boom }), after: 2 }), '{ok:1,bad:<inaccessible>,after:2}')
})

test('never throws, even on hostile values', () =>
  hegel.test(tc => {
    const { value } = make(tc.draw(recipes({ hostile: true }), 'recipe'))
    try { repr(value) } catch (e) { throw new Error(`repr threw: ${e.message}`) }
  }, settings))

test('circular_ref only appears when the value has a cycle', () =>
  hegel.test(tc => {
    const { value, realCycles } = make(tc.draw(recipes(), 'recipe'))
    const out = repr(value)
    if (out.includes('circular_ref')) assert.ok(realCycles > 0, `no cycle, but got: ${out}`)
  }, { ...settings, testCases: 500 }))

test('every empty slot is reported', () =>
  hegel.test(tc => {
    const leaf = leaves({ cycles: false })
    const items = tc.draw(gs.arrays(gs.optional(leaf), { maxSize: 6 }), 'items')
    const named = tc.draw(gs.optional(leaf), 'named')
    const out = repr(make({ t: 'arr', items, ...(named ? { named } : {}) }).value)
    const reported = [...out.matchAll(/<(\d+) empty slots?>/g)].reduce((sum, m) => sum + Number(m[1]), 0)
    assert.equal(reported, items.filter(item => item === null).length, `got: ${out}`)
  }, settings))

test('every repeated symbol prints as ref[...]', () =>
  hegel.test(tc => {
    const ids = tc.draw(gs.arrays(gs.integers({ minValue: 0, maxValue: 2 }), { minSize: 1, maxSize: 6 }), 'ids')
    const out = repr(make({ t: 'arr', items: ids.map(id => ({ t: 'sym', id })) }).value)
    const refs = (out.match(/\bref\[/g) ?? []).length
    assert.equal(refs, ids.length - new Set(ids).size, `got: ${out}`)
  }, settings))

// Errors and Dates show what the notebook's repr() left out.

test('errors show their cause, inner errors, and stack', () => {
  const outer = pin(new Error('transfer failed', { cause: pin(new RangeError('index 9')) }))
  assert.equal(repr(outer), 'Error("transfer failed"){cause:RangeError("index 9"){stack:"RangeError: index 9"},stack:"Error: transfer failed"}')
  const all = pin(new AggregateError([pin(new Error('a')), 1], 'all failed'))
  assert.equal(repr(all), 'AggregateError("all failed"){errors:[Error("a"){stack:"Error: a"},1],stack:"AggregateError: all failed"}')
  const looped = pin(new Error('loop'))
  looped.cause = looped
  assert.equal(repr(looped), 'Error("loop"){cause:circular_ref[],stack:"Error: loop"}')
})

test('reads a real stack through the engine, never through a user getter', () => {
  assert.match(repr(new Error('boom')), /^Error\("boom"\)\{stack:"Error: boom\\n {4}at /)
  let ran = false
  const spy = () => { ran = true; return 'fake' }
  assert.equal(repr(Object.defineProperty(new Error('m'), 'stack', { get: spy })), 'Error("m")')
  assert.equal(repr(Object.defineProperty(pin(new Error('m')), 'cause', { get: spy })), 'Error("m"){stack:"Error: m"}')
  assert.equal(ran, false)
})

test('an enumerable cause is listed once, with the other properties', () => {
  const error = pin(new Error('m'))
  error.cause = 1
  error.code = 'E1'
  assert.equal(repr(error), 'Error("m"){cause:1,code:"E1",stack:"Error: m"}')
})

test('formats Dates as their ISO time', () => {
  assert.equal(repr(new Date(Date.UTC(2026, 10, 14, 3, 12, 44, 120))), 'Date("2026-11-14T03:12:44.120Z")')
  assert.equal(repr(new Date(NaN)), 'Date("Invalid Date")')
  assert.equal(repr(new Date(0), { unquoted_strings: true }), 'Date(1970-01-01T00:00:00.000Z)')
  assert.equal(repr(Object.assign(new Date(0), { label: 'epoch' })), 'Date("1970-01-01T00:00:00.000Z"){label:"epoch"}')
  // A Proxy fails the brand check, so it shows as an object instead of reaching Date methods.
  assert.equal(repr(new Proxy(new Date(0), {})), 'Date{}')
})

// Node model: describe() builds a lazy tree for the Inspector.

const text = tokens => tokens.map(token => token.text).join('')

// A Proxy that records any access and refuses it.
function tripwire() {
  const state = { touched: false }
  const refuse = () => { state.touched = true; throw new Error('tripwire touched') }
  const traps = ['get', 'has', 'ownKeys', 'getPrototypeOf', 'getOwnPropertyDescriptor', 'set', 'defineProperty', 'deleteProperty', 'apply', 'construct']
  return { state, proxy: new Proxy({}, Object.fromEntries(traps.map(trap => [trap, refuse]))) }
}

// Every node reachable from `node`, with its ancestors, to a bounded depth and width.
function* walk(node, ancestors = [], depth = 0) {
  yield { node, ancestors }
  if (depth >= 5 || node.kind === 'circular') return
  const next = [...ancestors, node]
  for (const part of node.parts) {
    if (part.type === 'value') yield* walk(part.node, next, depth + 1)
    if (part.type !== 'group') continue
    for (const child of part.group.children(0, 20).items) {
      if (child.key && !Array.isArray(child.key)) yield* walk(child.key, next, depth + 1)
      yield* walk(child.value, next, depth + 1)
    }
  }
}

test('describes values as nodes with groups of children', () => {
  const node = core.describe([1, [2]])
  assert.equal(node.kind, 'array')
  assert.equal(node.size, 2)
  assert.deepEqual(node.header, [])
  const [elements, extra] = node.groups
  assert.equal(elements.open, '[')
  assert.equal(extra.hideWhenEmpty, true)
  const { items, more } = elements.children(0, 10)
  assert.equal(more, false)
  assert.deepEqual(items.map(child => child.value.kind), ['number', 'array'])
  assert.deepEqual(items[1].value.path, [1])
})

test('keeps keys apart from values, including non-string Map keys', () => {
  const object = core.describe({ a: 1 }).groups[0].childAt(0)
  assert.deepEqual(object.key, [{ text: 'a', type: 'field_name' }])
  assert.equal(object.value.kind, 'number')
  const entry = core.describe(new Map([[{ id: 1 }, 'v']])).groups[0].childAt(0)
  assert.equal(entry.key.kind, 'object')
  assert.equal(text(core.serialize(entry.key)), '{id:1}')
})

test('marks cycles with the path of the ancestor they refer to', () => {
  const o = { child: {} }
  o.child.parent = o
  const parent = core.describe(o).groups[0].childAt(0).value.groups[0].childAt(0).value
  assert.equal(parent.kind, 'circular')
  assert.deepEqual(parent.target, [])
  assert.equal(text(parent.header), 'circular_ref[]')
})

test('pages through wide groups', () => {
  const elements = core.describe(Array.from({ length: 250 }, (_, i) => i)).groups[0]
  const first = elements.children(0, 100)
  assert.equal(first.items.length, 100)
  assert.equal(first.more, true)
  const last = elements.children(200, 100)
  assert.equal(last.items.length, 50)
  assert.equal(last.more, false)
  assert.equal(text(last.items[0].value.header), '200')
})

test('custom types become groups through to_repr', () => {
  const point = { [core.to_repr](v) { v.constructor_call('Point', 1, { z: 2 }) } }
  const node = core.describe(point)
  assert.equal(node.kind, 'custom')
  assert.equal(text(node.header), 'Point')
  assert.deepEqual(node.groups[0].children(0, 5).items.map(child => child.value.kind), ['number', 'object'])
  assert.equal(core.to_repr, Symbol.for('anta.to-repr'))
})

test('summaries are short previews of a node', () => {
  const node = core.describe({ message: 'a long message that will not fit', count: 3 })
  assert.equal(text(node.summary(20)), '{message:"a long ...')
  assert.equal(node.summary(20).at(-1).type, 'ellipsis')
})

test('describe reads nothing until a node resolves', () => {
  const { state, proxy } = tripwire()
  const node = core.describe(proxy)
  assert.equal(state.touched, false)
  assert.equal(node.kind, 'inaccessible')
  assert.equal(state.touched, true)
})

test('pulling a group never resolves its children', () =>
  hegel.test(tc => {
    const recipe = tc.draw(recipes(), 'recipe')
    const position = tc.draw(gs.integers({ minValue: 0, maxValue: 3 }), 'position')
    const { state, proxy } = tripwire()
    const siblings = [make(recipe).value, make(recipe).value, make(recipe).value]
    siblings.splice(position, 0, { wire: proxy })
    const root = core.describe(siblings)
    for (const child of root.groups[0].children(0, 10).items) {
      // Resolving a sibling and pulling its groups reads one level down only.
      for (const group of child.value.groups) group.children(0, 10)
    }
    assert.equal(state.touched, false, 'a child node was resolved without being asked')
  }, settings))

test('pages concatenate to one full read', () =>
  hegel.test(tc => {
    const recipe = tc.draw(recipes({ hostile: true }), 'recipe')
    const limit = tc.draw(gs.integers({ minValue: 1, maxValue: 4 }), 'limit')
    const paged = core.describe(make(recipe).value)
    const whole = core.describe(make(recipe).value)
    paged.groups.forEach((group, g) => {
      const seen = []
      for (let offset = 0; ; offset += limit) {
        const { items, more } = group.children(offset, limit)
        assert.ok(items.length <= limit)
        seen.push(...items)
        if (!more) break
        assert.equal(items.length, limit, 'a short page reported more')
      }
      const all = whole.groups[g].children(0, Infinity).items
      assert.deepEqual(seen.map(child => text(core.serialize(child.value))), all.map(child => text(core.serialize(child.value))))
    })
  }, settings))

test('circular targets are real ancestors', () =>
  hegel.test(tc => {
    const recipe = tc.draw(recipes(), 'recipe')
    for (const { node, ancestors } of walk(core.describe(make(recipe).value))) {
      if (node.kind !== 'circular') continue
      const ancestor = ancestors.find(a => a.identity === node.identity)
      assert.ok(ancestor, 'a circular node has no matching ancestor')
      assert.deepEqual(node.target, ancestor.path)
    }
  }, settings))

test('a root summary equals repr within the same budget', () =>
  hegel.test(tc => {
    const recipe = tc.draw(recipes({ hostile: true }), 'recipe')
    const options = tc.draw(reprOptions, 'options')
    const budget = tc.draw(gs.integers({ minValue: 3, maxValue: 80 }), 'budget')
    const summary = text(core.describe(make(recipe).value, options).summary(budget))
    assert.ok(summary.length <= budget, `length ${summary.length} > ${budget}`)
    assert.equal(summary, repr(make(recipe).value, { ...options, char_limit: budget, error_stacks: false }))
  }, settings))

// What a row draws: the text, plus the 1ch the stylesheet adds after each comma and colon.
const drawnWidth = tokens => tokens.reduce((width, token) =>
  width + token.text.length + (token.type === 'comma' || token.type === 'field_colon' ? 1 : 0), 0)

test('display summaries fit their budget as drawn and end in one …', () =>
  hegel.test(tc => {
    const recipe = tc.draw(recipes({ hostile: true }), 'recipe')
    const options = tc.draw(reprOptions, 'options')
    const budget = tc.draw(gs.integers({ minValue: 1, maxValue: 80 }), 'budget')
    const tokens = core.describe(make(recipe).value, options).summary(budget, true)
    assert.ok(drawnWidth(tokens) <= budget, `drawn width ${drawnWidth(tokens)} > ${budget}`)
    const cut = tokens.at(-1)?.type === 'ellipsis'
    if (cut) {
      assert.equal(tokens.at(-1).text, '…')
      assert.ok(!['comma', 'field_colon'].includes(tokens.at(-2)?.type), 'a cut ends on a separator')
      assert.ok(tokens.slice(0, -1).every(token => token.text !== ''), 'a cut left an empty token')
    }
    assert.equal(tokens.filter(token => token.type === 'ellipsis' && token.text === '...').length, 0)
  }, settings))

test('display summaries cut where the row draws, not at a comma', () => {
  const tokens = core.describe(Array.from({ length: 100 }, (_, i) => i)).summary(30, true)
  assert.equal(text(tokens), '[0,1,2,3,4,5,6,7,8,9…')
  assert.equal(drawnWidth(tokens), 30)
  assert.equal(text(core.describe([1, 22, 333]).summary(9, true)), '[1,22…')
})

test('jsonText writes plain data as compact JSON', () => {
  const shared = { s: 1 }
  const value = { a: 1, b: [1, 'x', null, true], 'api-1': { c: -0 }, d: shared, e: shared, n: Object.create(null) }
  const json = core.jsonText(core.describe(value, { numeric_base: 'hex' }))
  assert.deepEqual(json, { text: '{"a":1,"b":[1,"x",null,true],"api-1":{"c":0},"d":{"s":1},"e":{"s":1},"n":{}}' })
  assert.deepEqual(core.jsonText(core.describe('hi')), { text: '"hi"' })
})

test('jsonText names the first value JSON cannot hold, and where it is', () => {
  const reason = value => core.jsonText(core.describe(value)).reason
  const cycle = { list: [] }
  cycle.list.push(cycle)
  class Point { x = 1 }
  assert.equal(reason({ containers: new Map() }), 'Not JSON: contains a Map at .containers')
  assert.equal(reason({ 'api-1': [new Set()] }), 'Not JSON: contains a Set at ["api-1"][0]')
  assert.equal(reason([1, , 3]), 'Not JSON: contains an empty slot at [1]')
  assert.equal(reason({ x: [{ y: NaN }] }), 'Not JSON: contains NaN at .x[0].y')
  assert.equal(reason(cycle), 'Not JSON: contains a circular reference at .list[0]')
  assert.equal(reason({ p: new Point() }), 'Not JSON: contains a Point instance at .p')
  assert.equal(reason(Object.assign([1], { extra: 2 })), 'Not JSON: named properties on an array')
  assert.equal(reason(10n), 'Not JSON: a bigint')
  assert.equal(reason(new Date(0)), 'Not JSON: a Date')
  assert.equal(reason(undefined), 'Not JSON: undefined')
})

test('jsonText output parses, and never throws on hostile values', () =>
  hegel.test(tc => {
    const recipe = tc.draw(recipes({ hostile: true }), 'recipe')
    const json = core.jsonText(core.describe(make(recipe).value))
    if ('text' in json) JSON.parse(json.text)
    else assert.match(json.reason, /^Not JSON: /)
  }, settings))

test('the node API never throws, even on hostile values', () =>
  hegel.test(tc => {
    const recipe = tc.draw(recipes({ hostile: true }), 'recipe')
    for (const { node } of walk(core.describe(make(recipe).value))) {
      node.summary(40)
      void node.header, node.size, node.target
    }
  }, settings))

// Rows: visibleRows() lists the lines the Inspector renders for a display state.

const line = row => row.type === 'more' ? '' : row.type === 'chunk' ? `[${row.start}…${row.end}]` : text([...(row.key ?? []), ...row.tokens])
const styles = gs.sampledFrom(['repr', 'tree'])
const lines = rows => rows.map(row => ({ id: row.id, line: line(row) }))
const inSubtree = (row, id) => row.id === id || row.id.startsWith(`${id}/`) || row.id.startsWith(`${id}~`)

// The node at a path of typed segments, found by comparing each child's own
// last segment, independently of path keys.
const sameSegment = (a, b) => a.type === b.type && Object.keys({ ...a, ...b }).every(k => Object.is(a[k], b[k]))
function nodeBySegments(root, segments) {
  let node = root
  for (const segment of segments) {
    let found
    for (const part of node.parts) {
      const children = part.type === 'value' ? [part.node]
        : part.type === 'group' ? Array.from({ length: 1e6 }).map((_, i) => part.group.childAt(i)?.value).filter(Boolean) : []
      found = children.find(child => sameSegment(child.segments.at(-1), segment))
      if (found) break
    }
    node = found
  }
  return node
}

// The open set `expandDepth` gives on a first render, as the Inspector starts.
const openAt = (root, state = {}) => new Set(core.openIds(root, state))

// An open set: the rows `state` opens, then a few closed rows chosen by Hegel,
// opened one at a time, as a reader would.
function openSome(tc, root, state = {}, skip = () => false) {
  const open = new Set(state.open ?? core.openIds(root, state))
  const steps = tc.draw(gs.integers({ minValue: 0, maxValue: 6 }), 'opens')
  for (let step = 0; step < steps; step++) {
    const closed = core.visibleRows(root, { ...state, open })
      .filter(row => row.type === 'node' && row.expandable && !row.open && !skip(row))
    if (!closed.length) break
    open.add(closed[tc.draw(gs.integers({ minValue: 0, maxValue: closed.length - 1 }), 'open')].id)
  }
  return open
}

test('lists open nodes as header, children, and closing rows', () => {
  const value = { tags: ['a', 'b'], n: 1 }
  const rows = core.visibleRows(core.describe(value), { expandDepth: 2 })
  assert.deepEqual(rows.map(row => [row.type, row.depth, line(row)]), [
    ['node', 0, '{'],
    ['node', 1, 'tags:['],
    ['node', 2, '"a",'],
    ['node', 2, '"b"'],
    ['close', 1, '],'],
    ['node', 1, 'n:1'],
    ['close', 0, '}'],
  ])
  assert.deepEqual(rows[1], { ...rows[1], id: 'r/.tags', expandable: true, open: true, size: 2 })
})

test('closed nodes show their summary, and an open set opens them', () => {
  const root = core.describe({ tags: ['a', 'b'] })
  const closed = core.visibleRows(root)
  assert.deepEqual(closed.map(line), ['{tags:["a","b"]}'])
  assert.equal(closed[0].open, false)
  const opened = core.visibleRows(root, { open: new Set(['r']) })
  assert.deepEqual(opened.map(line), ['{', 'tags:["a","b"]', '}'])
})

test('a long group shows ranges, which open to show their children', () => {
  const root = core.describe(Array.from({ length: 5 }, (_, i) => i))
  const closed = core.visibleRows(root, { expandDepth: 1, chunkSize: 2 })
  assert.deepEqual(closed.map(line), ['[', '[0…1]', '[2…3]', '[4…4]', ']'])
  assert.deepEqual(closed[2], { type: 'chunk', id: 'r~g1~2-3', depth: 1, start: 2, end: 3, open: false })
  // A range's children keep their data keys; the range is never in a path.
  const opened = core.visibleRows(root, { chunkSize: 2, open: new Set(['r', 'r~g1~2-3', 'r~g1~4-4']) })
  assert.deepEqual(opened.map(line), ['[', '[0…1]', '[2…3]', '2,', '3,', '[4…4]', '4', ']'])
  assert.deepEqual(opened.filter(row => row.type === 'node' && row.depth === 2).map(row => row.id), ['r/2', 'r/3', 'r/4'])
})

test('cycles link to their open ancestor and repeats expand in place', () => {
  const shared = { x: 1 }
  const value = { a: shared, b: shared }
  value.self = value
  const rows = core.visibleRows(core.describe(value), { expandDepth: 2 })
  assert.deepEqual(rows.map(line), ['{', 'a:{', 'x:1', '},', 'b:{', 'x:1', '},', 'self:circular_ref[]', '}'])
  assert.equal(rows.at(-2).target, 'r')
})

test('with every node open and no ranges, the rows spell out repr without deduplication', () => {
  // `chunkSize: Infinity` turns ranges off. These groups have well over 100
  // children, the default chunkSize, so a range row would break the text.
  const big = { list: Array.from({ length: 250 }, (_, i) => i), byKey: new Map(Array.from({ length: 150 }, (_, i) => [`k${i}`, { i }])) }
  const bigRows = core.visibleRows(core.describe(big), { expandDepth: Infinity, chunkSize: Infinity, previewBudget: Infinity })
  assert.ok(!bigRows.some(row => row.type === 'chunk'), 'a range showed with chunkSize: Infinity')
  assert.equal(bigRows.map(line).join(''), repr(big, { deduplicate_references: false, char_limit: Infinity }))
  return hegel.test(tc => {
    const recipe = tc.draw(recipes({ hostile: true }), 'recipe')
    // Open rows always list an error's stack, so compare with the stack included.
    const { char_limit: _limit, deduplicate_references: _dedupe, error_stacks: _stacks, ...options } = tc.draw(reprOptions, 'options')
    const { value } = make(recipe)
    const rows = core.visibleRows(core.describe(value, options), { expandDepth: Infinity, chunkSize: Infinity, previewBudget: Infinity })
    assert.equal(rows.map(line).join(''), repr(value, { ...options, deduplicate_references: false, char_limit: Infinity }))
  }, settings)
})

test('closing a node hides only its descendants', () =>
  hegel.test(tc => {
    const root = core.describe(make(tc.draw(recipes(), 'recipe')).value)
    const style = tc.draw(styles, 'style')
    const open = openSome(tc, root, { expandDepth: 1, style })
    const shown = core.visibleRows(root, { style, open }).filter(row => row.type === 'node' && row.open)
    tc.assume(shown.length > 0)
    const { id } = shown[tc.draw(gs.integers({ minValue: 0, maxValue: shown.length - 1 }), 'close')]
    const closed = new Set(open)
    closed.delete(id)
    const before = core.visibleRows(root, { style, open })
    const after = core.visibleRows(root, { style, open: closed })
    assert.deepEqual(lines(after.filter(row => !inSubtree(row, id))), lines(before.filter(row => !inSubtree(row, id))))
    assert.deepEqual(after.filter(row => inSubtree(row, id)).map(row => row.id), [id])
  }, settings))

test('opening every range gives the same rows as no ranges', () =>
  hegel.test(tc => {
    const recipe = tc.draw(recipes({ hostile: true }), 'recipe')
    const chunkSize = tc.draw(gs.integers({ minValue: 1, maxValue: 3 }), 'chunkSize')
    const style = tc.draw(styles, 'style')
    const root = core.describe(make(recipe).value)
    // Open every range and every node expandDepth: Infinity would open, a level at a time.
    const open = new Set()
    let rows
    for (let round = 0; round < 1000; round++) {
      rows = core.visibleRows(root, { chunkSize, style, open })
      const closed = rows.filter(row => !row.open && (row.type === 'chunk' || (row.type === 'node' && row.expandable && row.kind !== 'string')))
      for (const row of rows) {
        if (row.type === 'chunk') assert.ok(row.start <= row.end, `range ${row.id} is empty`)
      }
      if (!closed.length) break
      for (const row of closed) open.add(row.id)
    }
    // Ranges only add rows: without them, the rows are the unranged ones, in order.
    const whole = core.visibleRows(core.describe(make(recipe).value), { expandDepth: Infinity, chunkSize: Infinity, style })
    assert.deepEqual(lines(rows.filter(row => row.type !== 'chunk')), lines(whole))
  }, settings))

test('closed nodes are not read past their summary', () =>
  hegel.test(tc => {
    const recipe = tc.draw(recipes(), 'recipe')
    const position = tc.draw(gs.integers({ minValue: 0, maxValue: 3 }), 'position')
    const { state, proxy } = tripwire()
    const siblings = [make(recipe).value, make(recipe).value, make(recipe).value]
    siblings.splice(position, 0, { wire: proxy })
    const root = core.describe(siblings)
    // A 3-character summary prints only the first token of a closed node.
    const display = { expandDepth: 1, previewBudget: 3 }
    const isHolder = row => row.type === 'node' && row.depth === 1 && row.path.length === 1 && row.path[0] === position
    const open = openSome(tc, root, display, isHolder)
    const rows = core.visibleRows(root, { ...display, open })
    assert.equal(state.touched, false, 'a closed node was read')
    core.visibleRows(root, { ...display, open: new Set([...open, rows.find(isHolder).id]) })
    assert.equal(state.touched, true, 'opening a node did not read its children')
  }, settings))

test('circular rows link to an open ancestor', () =>
  hegel.test(tc => {
    const root = core.describe(make(tc.draw(recipes(), 'recipe')).value)
    const expandDepth = tc.draw(gs.integers({ minValue: 0, maxValue: 6 }), 'expandDepth')
    const rows = core.visibleRows(root, { open: openSome(tc, root, { expandDepth }) })
    rows.forEach((row, index) => {
      if (row.type !== 'node' || row.kind !== 'circular') return
      assert.ok(row.target !== undefined, `circular row ${row.id} has no target`)
      const target = rows.findIndex(other => other.id === row.target)
      assert.ok(target >= 0 && target < index, `target ${row.target} is not an earlier row`)
      assert.equal(rows[target].open, true)
      assert.ok(row.id.startsWith(`${row.target}/`), `${row.target} is not an ancestor of ${row.id}`)
      assert.deepEqual(rows[target].path, nodeBySegments(root, row.segments).target, `${row.target} is not the ancestor ${row.id} refers to`)
    })
  }, settings))

test('rows never throw and keep ids unique, even on hostile values', () =>
  hegel.test(tc => {
    const root = core.describe(make(tc.draw(recipes({ hostile: true }), 'recipe')).value)
    const display = {
      expandDepth: tc.draw(gs.integers({ minValue: 0, maxValue: 6 }), 'expandDepth'),
      chunkSize: tc.draw(gs.integers({ minValue: 1, maxValue: 4 }), 'chunkSize'),
      previewBudget: tc.draw(gs.integers({ minValue: 3, maxValue: 80 }), 'previewBudget'),
      style: tc.draw(styles, 'style'),
    }
    const rows = core.visibleRows(root, { ...display, open: openSome(tc, root, display) })
    assert.equal(new Set(rows.map(row => row.id)).size, rows.length, 'duplicate row id')
    rows.forEach((row, index) => {
      if (index) assert.ok(row.depth <= rows[index - 1].depth + 1, `row ${row.id} skips a depth`)
    })
  }, settings))

// Strings open into lines of raw text, paged by characters.

const textRows = rows => rows.filter(row => row.type === 'text').map(line)

test('a multiline string opens into text rows', () => {
  const root = core.describe({ log: 'first\r\nsecond\n\tthird' })
  const closed = core.visibleRows(root, { expandDepth: 1 })
  assert.deepEqual(closed.map(line), ['{', 'log:"first\\r\\nsecond\\n\\tthird"', '}'])
  assert.deepEqual([closed[1].expandable, closed[1].open], [true, false])
  const opened = core.visibleRows(root, { open: new Set(['r', closed[1].id]) })
  assert.deepEqual(opened.map(row => [row.type, row.depth, line(row)]), [
    ['node', 0, '{'],
    ['node', 1, 'log:"'],
    ['text', 2, 'first'],
    ['text', 2, 'second'],
    ['text', 2, '\tthird'],
    ['close', 1, '"'],
    ['close', 0, '}'],
  ])
})

test('open strings escape control characters but keep tabs', () => {
  const rows = core.visibleRows(core.describe('\u001b[31mred\u001b[0m\ta\rb\nnext'), { open: new Set(['r']) })
  assert.deepEqual(textRows(rows), ['\\u001b[31mred\\u001b[0m\ta\\rb', 'next'])
  const unquoted = core.visibleRows(core.describe('a\nb', { unquoted_strings: true }), { open: new Set(['r']) })
  assert.deepEqual(unquoted.map(line), ['', 'a', 'b', ''])
})

test('long strings page by characters, never splitting a surrogate pair', () => {
  const root = core.describe('x'.repeat(12))
  const display = { open: new Set(['r']), previewBudget: 5, textPageSize: 5 }
  const first = core.visibleRows(root, display)
  assert.deepEqual(first.map(line), ['"', 'xxxxx', '', '"'])
  assert.deepEqual(first[2], { type: 'more', id: 'r~line+', depth: 1, group: 'r~line', shown: 5, unit: 'characters' })
  assert.deepEqual(core.visibleRows(root, { ...display, pages: new Map([['r~line', 3]]) }).map(line), ['"', 'x'.repeat(12), '"'])
  const emoji = core.visibleRows(core.describe('😀😀😀'), { open: new Set(['r']), previewBudget: 1, textPageSize: 3 })
  assert.deepEqual(textRows(emoji), ['😀'])
})

test('strings open only when opened, and only when they need to', () => {
  const root = core.describe(['short', 'two\nlines', 'y'.repeat(81)])
  const rows = core.visibleRows(root, { expandDepth: Infinity })
  const strings = rows.filter(row => row.type === 'node' && row.depth === 1)
  assert.deepEqual(strings.map(row => [row.expandable, row.open]), [[false, false], [true, false], [true, false]])
  // A short string can't open, so naming it in the open set changes nothing.
  const opened = core.visibleRows(root, { open: new Set([...openAt(root, { expandDepth: Infinity }), strings[0].id]) })
  assert.deepEqual(opened.map(line), rows.map(line))
})

test('open strings spell out their text', () =>
  hegel.test(tc => {
    const parts = tc.draw(gs.arrays(gs.text({ maxSize: 30, excludeCategories: ['Cc'] }), { minSize: 1, maxSize: 6 }), 'lines')
    const separator = tc.draw(gs.sampledFrom(['\n', '\r\n']), 'separator')
    const value = parts.join(separator)
    tc.assume(value !== '')
    const rows = core.visibleRows(core.describe(value), { open: new Set(['r']), previewBudget: 0, textPageSize: Infinity })
    assert.equal(textRows(rows).join('\n'), parts.join('\n'))
  }, settings))

test('string pages join into the whole text', () =>
  hegel.test(tc => {
    const value = tc.draw(gs.oneOf(multilineText, longText, gs.text({ minSize: 1, maxSize: 40 })), 'value')
    const textPageSize = tc.draw(gs.integers({ minValue: 1, maxValue: 20 }), 'textPageSize')
    tc.assume(value.length > 0)
    const root = core.describe(value)
    const display = { open: new Set(['r']), previewBudget: 0, textPageSize }
    const pages = new Map()
    let rows
    for (let round = 0; round < 1000; round++) {
      rows = core.visibleRows(root, { ...display, pages })
      const more = rows.find(row => row.type === 'more')
      if (!more) break
      const limit = (pages.get(more.group) ?? 1) * textPageSize
      assert.equal(more.unit, 'characters')
      assert.ok(more.shown === limit || more.shown === limit - 1, `showed ${more.shown} of a ${limit}-character page`)
      const lastUnit = value.charCodeAt(more.shown - 1)
      assert.ok(!(lastUnit >= 0xd800 && lastUnit <= 0xdbff), 'a page ended inside a surrogate pair')
      pages.set(more.group, (pages.get(more.group) ?? 1) + 1)
    }
    assert.ok(!rows.some(row => row.type === 'more'), 'paging never finished')
    assert.deepEqual(lines(rows), lines(core.visibleRows(root, { ...display, textPageSize: Infinity })))
  }, settings))

// Errors: closed rows and summaries name an error without its stack.

test('summaries and closed rows name an error without its stack', () => {
  const outer = pin(new Error('transfer failed', { cause: pin(new RangeError('index 9')) }))
  assert.equal(repr(outer, { error_stacks: false }), 'Error("transfer failed"){cause:RangeError("index 9")}')
  assert.equal(text(core.describe(pin(new Error('boom'))).summary(80)), 'Error("boom")')
  const closed = core.visibleRows(core.describe({ failure: outer }), { expandDepth: 1 })
  assert.deepEqual(closed.map(line), ['{', 'failure:Error("transfer failed"){cause:RangeError("index 9")}', '}'])
  const opened = core.visibleRows(core.describe(outer), { expandDepth: 1 })
  assert.deepEqual(opened.map(line), ['Error("transfer failed"){', 'cause:RangeError("index 9"),', 'stack:"Error: transfer failed"', '}'])
})

// The tree style: rows read like an object in browser DevTools.

const tree = (value, state = {}) => core.visibleRows(core.describe(value), { style: 'tree', ...state })

test('tree rows show keys and values, with no brackets or commas', () => {
  const failure = pin(new Error('transfer failed', { cause: pin(new RangeError('index 9')) }))
  const rows = tree({ failure, results: [{ id: 't1' }, 'plain'] }, { expandDepth: 2 })
  assert.deepEqual(rows.map(row => [row.type, row.depth, line(row)]), [
    ['node', 0, '{…}'],
    ['node', 1, 'failure:Error("transfer failed")'],
    ['node', 2, 'cause:RangeError("index 9")'],
    ['node', 2, 'stack:"Error: transfer failed"'],
    ['node', 1, 'results:Array(2)'],
    ['node', 2, '0:{id:"t1"}'],
    ['node', 2, '1:"plain"'],
  ])
})

test('open tree rows name their type and size', () => {
  class Point { constructor() { this.x = 1 } }
  const value = [new Map([['a', 1]]), new Set([1]), new Uint8Array(2), new Point(), [1, , 3], 'a\nb', () => 1]
  const rows = tree(value, { open: new Set([...openAt(core.describe(value), { expandDepth: 2 }), 'r/5']) })
  assert.deepEqual(rows.filter(row => row.type === 'node' && row.depth === 1).map(line), [
    '0:Map(1)', '1:Set(1)', '2:Uint8Array(2)', '3:Point{…}', '4:Array(3)', '5:String(3)', '6:<anonymous function>',
  ])
  assert.deepEqual(textRows(rows), ['a', 'b'])
  assert.ok(rows.some(row => line(row) === '<1 empty slot>'), 'an empty-slots row has a key')
})

test('tree groups show ranges past chunkSize, and not up to it', () => {
  assert.deepEqual(tree(Array.from({ length: 3 }, (_, i) => i), { expandDepth: 1, chunkSize: 3 }).map(line), ['Array(3)', '0:0', '1:1', '2:2'])
  assert.deepEqual(tree(Array.from({ length: 4 }, (_, i) => i), { expandDepth: 1, chunkSize: 3 }).map(line), ['Array(4)', '[0…2]', '[3…3]'])
})

test('tree rows are the repr rows without brackets or commas', () =>
  hegel.test(tc => {
    const root = core.describe(make(tc.draw(recipes({ hostile: true }), 'recipe')).value)
    const display = {
      expandDepth: tc.draw(gs.integers({ minValue: 0, maxValue: 6 }), 'expandDepth'),
      chunkSize: tc.draw(gs.integers({ minValue: 1, maxValue: 4 }), 'chunkSize'),
    }
    const open = openSome(tc, root, display)
    const shape = row => [row.type, row.id, row.depth, row.open ?? null]
    const repr_rows = core.visibleRows(root, { ...display, open })
    const tree_rows = core.visibleRows(root, { ...display, open, style: 'tree' })
    assert.deepEqual(tree_rows.map(shape), repr_rows.filter(row => row.type !== 'close').map(shape))
    for (const row of tree_rows) {
      assert.notEqual(row.type, 'close')
      // Ranges and Show more rows have no tokens of their own.
      if (row.type !== 'more' && row.type !== 'chunk') assert.notEqual(row.tokens.at(-1)?.type, 'comma', `row ${row.id} ends in a comma`)
    }
  }, settings))

// Copy path: each row's accessor from the root.

const paths = (value, state = {}) => Object.fromEntries(
  tree(value, { expandDepth: Infinity, ...state }).filter(row => row.type === 'node').map(row => [line(row), row.pathText]),
)

test('rows carry a JavaScript path from the root', () => {
  const error = pin(new Error('m', { cause: 1 }))
  const value = { results: [{ 'a b': 1, ok: true }], byKey: new Map([['k', 1], [2, 'two'], [{ o: 1 }, 3]]), tags: new Set(['x']), error }
  const found = paths(value)
  assert.equal(found['{…}'], '')
  assert.equal(found['results:Array(1)'], 'results')
  assert.equal(found['0:{…}'], 'results[0]')
  assert.equal(found['"a b":1'], 'results[0]["a b"]')
  assert.equal(found['ok:true'], 'results[0].ok')
  assert.equal(found['"k":1'], 'byKey.get("k")')
  assert.equal(found['2:"two"'], 'byKey.get(2)')
  assert.equal(found['{o:1}:3'], undefined)
  assert.equal(found['0:"x"'], undefined)
  assert.equal(found['cause:1'], 'error.cause')
  assert.equal(paths([[1]])['0:1'], '[0][0]')
  assert.equal(paths(Object.defineProperty({}, '__proto__', { value: 1, enumerable: true }))['__proto__:1'], undefined)
})

test('copied paths evaluate back to the row\'s value', () =>
  hegel.test(tc => {
    const { value } = make(tc.draw(recipes(), 'recipe'))
    const root = core.describe(value)
    for (const row of core.visibleRows(root, { style: 'tree', expandDepth: Infinity, chunkSize: Infinity })) {
      if (row.type !== 'node' || row.pathText === undefined || row.kind === 'circular') continue
      const text = row.pathText
      const read = new Function('v', `return v${text === '' || /^[[.]/.test(text) ? '' : '.'}${text}`)
      const found = read(value)
      const node = nodeBySegments(root, row.segments)
      if (node.identity !== undefined && typeof node.identity === 'object') assert.equal(found, node.identity, `${text} reached another object`)
      else assert.deepEqual(core.describe(found).summary(200), node.summary(200), `${text} reached another value`)
    }
  }, settings))

// Copy value: the node behind a row, and the text that copies it.

test('copy text is a string\'s raw text, or the whole repr of anything else', () => {
  const value = { log: 'a\n"b"', n: 42, list: [1, { x: 2 }], error: pin(new Error('m')), empty: [, 1] }
  value.self = value
  const root = core.describe(value)
  const rows = tree(value, { expandDepth: 2 })
  const copy = label => core.copyText(core.nodeAt(root, rows.find(row => line(row).startsWith(label)).id))
  assert.equal(copy('log:'), 'a\n"b"')
  assert.equal(copy('n:'), '42')
  assert.equal(copy('list:'), '[1,{x:2}]')
  assert.equal(copy('error:'), 'Error("m"){stack:"Error: m"}')
  assert.equal(copy('self:'), undefined)
  assert.equal(copy('<1 empty slot>'), undefined)
  assert.equal(core.copyText(core.describe('x'.repeat(60000))).length, 60000)
  assert.equal(core.nodeAt(root, 'r/.log~line:0'), undefined)
  assert.equal(core.nodeAt(root, 'nope'), undefined)
  // A to_repr that calls visit() makes an inline value, which the generators never produce.
  const wrapped = core.describe({ [core.to_repr](v) { v.span('W(', 'class_name'); v.visit({ a: 1 }); v.span(')', 'class_name') } })
  const inline = core.visibleRows(wrapped, { style: 'tree', expandDepth: 1 }).find(row => row.depth === 1)
  assert.equal(inline.id, 'r/(1.0)')
  assert.equal(core.copyText(core.nodeAt(wrapped, inline.id)), '{a:1}')
})

test('nodeAt finds the node every row shows, by its key', () =>
  hegel.test(tc => {
    const root = core.describe(make(tc.draw(recipes({ hostile: true }), 'recipe')).value)
    const display = { expandDepth: tc.draw(gs.integers({ minValue: 0, maxValue: 6 }), 'expandDepth'), style: tc.draw(styles, 'style') }
    const open = openSome(tc, root, display)
    for (const row of core.visibleRows(root, { ...display, open })) {
      if (row.type === 'node') assert.equal(core.nodeAt(root, row.id), nodeBySegments(root, row.segments), `row ${row.id}`)
      else assert.equal(core.nodeAt(root, row.id), undefined, `row ${row.id} is not a node row`)
    }
  }, settings))

// Opening or closing a whole subtree.

test('deepOpen opens and closes a whole subtree, within a cap', () => {
  const value = { a: { b: { c: [1, { d: 2 }] }, s: 'x\ny' }, loop: null }
  value.loop = value
  const root = core.describe(value)
  const state = { style: 'tree', open: openAt(root, { expandDepth: 1 }) }
  // Strings and cycles stay closed; everything else below opens.
  const opened = core.deepOpen(root, state, 'r/.a', true)
  const rows = tree(value, { open: opened })
  assert.deepEqual(rows.filter(row => row.type === 'node' && row.expandable && !row.open).map(line), ['s:"x\\ny"'])
  assert.ok(rows.some(row => line(row) === 'd:2'))
  // Closing collapses descendants too: reopening the row shows them closed.
  const closed = core.deepOpen(root, { ...state, open: opened }, 'r/.a', false)
  assert.deepEqual([...closed], ['r'])
  const reopened = tree(value, { open: new Set([...closed, 'r/.a']) }).filter(row => row.id.startsWith('r/.a/'))
  assert.ok(reopened.length > 0 && reopened.every(row => row.type !== 'node' || !row.open))
  // The cap stops opening once the subtree shows that many rows. Opening the
  // row itself already shows 20, so nothing below it opens.
  const wide = core.describe(Array.from({ length: 20 }, (_, i) => ({ i, more: { j: i } })))
  const capped = core.deepOpen(wide, { style: 'tree' }, 'r', true, 10)
  const shown = core.visibleRows(wide, { style: 'tree', open: capped }).filter(row => row.id.startsWith('r/'))
  assert.equal(shown.length, 20)
  assert.ok(shown.every(row => !row.open))
  const roomy = core.visibleRows(wide, { style: 'tree', open: core.deepOpen(wide, { style: 'tree' }, 'r', true, 30) })
  assert.equal(roomy.filter(row => row.open && row.depth === 1).length, 5, 'opened rows until 30 showed')
})

test('a deep open leaves nothing closed below it, within the cap', () =>
  hegel.test(tc => {
    const root = core.describe(make(tc.draw(recipes({ hostile: true }), 'recipe')).value)
    const display = { expandDepth: tc.draw(gs.integers({ minValue: 0, maxValue: 3 }), 'expandDepth'), chunkSize: 3, style: 'tree' }
    const open = openSome(tc, root, display)
    const before = core.visibleRows(root, { ...display, open })
    const candidates = before.filter(row => row.type === 'node' && row.expandable && row.kind !== 'string')
    tc.assume(candidates.length > 0)
    const { id } = candidates[tc.draw(gs.integers({ minValue: 0, maxValue: candidates.length - 1 }), 'row')]
    const limit = tc.draw(gs.integers({ minValue: 1, maxValue: 30 }), 'limit')
    const after = core.visibleRows(root, { ...display, open: core.deepOpen(root, { ...display, open }, id, true, limit) })
    // Rows below the node, including its own Show more rows (`<id>~…`).
    const below = after.filter(row => row.id !== id && inSubtree(row, id))
    assert.equal(after.find(row => row.id === id).open, true)
    // Anything left closed means the cap was reached.
    const closed = below.filter(row => row.type === 'node' && row.expandable && !row.open && row.kind !== 'string')
    if (closed.length) assert.ok(below.length >= limit, `${closed.map(row => row.id)} stayed closed with ${below.length} of ${limit} rows`)
    const outside = rows => lines(rows.filter(row => !inSubtree(row, id)))
    assert.deepEqual(outside(after), outside(before), 'a row outside the subtree changed')
  }, settings))

test('a deep close leaves nothing open below it, even after reopening', () =>
  hegel.test(tc => {
    const root = core.describe(make(tc.draw(recipes({ hostile: true }), 'recipe')).value)
    const display = { expandDepth: tc.draw(gs.integers({ minValue: 0, maxValue: 4 }), 'expandDepth'), style: 'tree' }
    const open = openSome(tc, root, display)
    const shown = core.visibleRows(root, { ...display, open }).filter(row => row.type === 'node' && row.open)
    tc.assume(shown.length > 0)
    const { id } = shown[tc.draw(gs.integers({ minValue: 0, maxValue: shown.length - 1 }), 'row')]
    const closed = core.deepOpen(root, { ...display, open }, id, false)
    const rows = core.visibleRows(root, { ...display, open: closed })
    assert.equal(rows.find(row => row.id === id).open, false)
    assert.deepEqual(rows.filter(row => row.id.startsWith(`${id}/`)).map(row => row.id), [])
    const reopened = new Set([...closed, id])
    const below = core.visibleRows(root, { ...display, open: reopened }).filter(row => row.id.startsWith(`${id}/`))
    assert.deepEqual(below.filter(row => row.type === 'node' && row.open).map(row => row.id), [], 'a row below reopened')
  }, settings))

// Nested rows: visibleTree() nests visibleRows() for a renderer whose DOM nests.

// Back to the flat list: each row, its children, then its after line as a close row.
function flatten(rows) {
  return rows.flatMap(({ children, after, ...row }) => {
    const out = [row, ...(children ? flatten(children) : [])]
    if (after) out.push({ type: 'close', tokens: after })
    return out
  })
}
const shape = rows => rows.map(row => row.type === 'close' ? { type: 'close', line: line(row) } : { id: row.id, type: row.type, line: line(row) })

test('nests rows under the open node they belong to', () => {
  const value = { tags: ['a', 'b'], deep: { x: 1 }, n: 1 }
  const tree = core.visibleTree(core.describe(value), { expandDepth: 2 })
  assert.equal(tree.length, 1)
  const [root] = tree
  assert.deepEqual(root.children.map(row => row.id), ['r/.tags', 'r/.deep', 'r/.n'])
  const [tags, deep, n] = root.children
  assert.deepEqual(tags.children.map(row => line(row)), ['"a",', '"b"'])
  assert.deepEqual(tags.after.map(token => token.text).join(''), '],')
  assert.equal(root.after.map(token => token.text).join(''), '}')
  // A node that can open has children even while closed; a leaf has none.
  assert.ok(deep.children.length > 0)
  assert.equal(n.children, undefined)
  const closed = core.visibleTree(core.describe(value), { expandDepth: 1 })
  assert.deepEqual(closed[0].children[1].children, [])
})

test('the tree style has no after lines, and a range nests its children', () => {
  const root = core.describe({ list: [1, 2, 3, 4, 5] })
  const [top] = core.visibleTree(root, { style: 'tree', chunkSize: 2, open: new Set(['r', 'r/.list', 'r/.list~g1~2-3']) })
  const list = top.children[0]
  assert.equal(top.after, undefined)
  assert.deepEqual(list.children.map(row => row.id), ['r/.list~g1~0-1', 'r/.list~g1~2-3', 'r/.list~g1~4-4'])
  assert.deepEqual(list.children[1].children.map(row => row.id), ['r/.list/2', 'r/.list/3'])
  assert.deepEqual(list.children[0].children, [], 'a closed range has no children yet')
})

test('an open string nests its lines', () => {
  const [top] = core.visibleTree(core.describe('one\ntwo'), { style: 'tree', open: new Set(['r']) })
  assert.deepEqual(top.children.map(row => [row.type, line(row)]), [['text', 'one'], ['text', 'two']])
})

test('flattening visibleTree gives visibleRows, and openIds lists its open nodes', () =>
  hegel.test(tc => {
    const root = core.describe(make(tc.draw(recipes(), 'recipe')).value)
    const display = {
      expandDepth: tc.draw(gs.integers({ minValue: 0, maxValue: 4 }), 'expandDepth'),
      chunkSize: tc.draw(gs.integers({ minValue: 1, maxValue: 4 }), 'chunkSize'),
      style: tc.draw(styles, 'style'),
    }
    const state = { ...display, open: openSome(tc, root, display) }
    const rows = core.visibleRows(root, state)
    assert.deepEqual(shape(flatten(core.visibleTree(root, state))), shape(rows))
    assert.deepEqual(core.openIds(root, state), rows.filter(row => row.type === 'node' && row.open).map(row => row.id))
  }, settings))

// Paths: every node has a typed path, and its key is the row's id.

const keysOf = (value, state = { style: 'tree', expandDepth: Infinity }) =>
  core.visibleRows(core.describe(value, { symbol_keys: true }), state).filter(row => row.type === 'node').map(row => row.id)

test('path keys name children in data terms: properties, indices, Map entries, Set items, error details, custom parts', () => {
  const objectKey = { id: 1 }
  const error = pin(new Error('boom', { cause: 'disk' }))
  class Moment { [core.to_repr](v) { v.constructor_call('Moment', 4021, 'x') } }
  const value = {
    'a/b~c': 1,
    list: [10, 20],
    byKey: new Map([['api-1', 1], [2, 2], [objectKey, 3]]),
    tags: new Set(['x', 'y']),
    error,
    moment: new Moment(),
  }
  const keys = keysOf(value)
  assert.ok(keys.includes('r/.a%2fb%7ec'), 'separators in a property name are escaped')
  assert.ok(keys.includes('r/.list/1'))
  assert.ok(keys.includes('r/.byKey/=s:api-1') && keys.includes('r/.byKey/=n:2') && keys.includes('r/.byKey/=#2'))
  assert.ok(keys.includes('r/.tags/*1'))
  assert.ok(keys.includes('r/.error/!cause') && keys.includes('r/.error/!stack'))
  assert.ok(keys.includes('r/.moment/(1.0)') && keys.includes('r/.moment/(1.1)'))
  assert.equal(new Set(keys).size, keys.length, 'keys are unique')
  // A row's key is inspectorPathKey of its typed path.
  for (const row of core.visibleRows(core.describe(value, { symbol_keys: true }), { style: 'tree', expandDepth: Infinity })) {
    if (row.type === 'node') assert.equal(core.inspectorPathKey(row.segments), row.id)
  }
})

test('symbol-keyed properties show only with symbol_keys, told apart by occurrence, and repr() is unchanged', () => {
  const a = Symbol('id')
  const b = Symbol('id')
  const value = { name: 'run', [a]: 1, [b]: 2, [Symbol.for('tag')]: 'x', [Symbol.iterator]: 3 }
  Object.defineProperty(value, Symbol('getter'), { get() { throw new Error('called') }, enumerable: true })
  assert.deepEqual(keysOf(value).slice(1), [
    'r/.name', 'r/@Symbol(id)#0', 'r/@Symbol(id)#1', 'r/@Symbol.for(tag)#0', 'r/@Symbol.iterator#0',
  ])
  const rows = core.visibleRows(core.describe(value, { symbol_keys: true }), { style: 'tree', expandDepth: 1 })
  // A key reads as the same symbol does as a value, in brackets.
  assert.deepEqual(rows.slice(1).map(row => line(row)), ['name:"run"', '[Symbol("id")]:1', '[Symbol("id")]:2', '[Symbol.for("tag")]:"x"', '[Symbol.iterator]:3'])
  const valueTokens = core.visibleRows(core.describe([a, Symbol.for('tag'), Symbol.iterator]), { style: 'tree', expandDepth: 1 }).slice(1).map(row => row.tokens)
  // Each key is `[`, the value's tokens, `]`, then the colon.
  assert.deepEqual([rows[2], rows[4], rows[5]].map(row => row.key.slice(1, -2)), valueTokens, 'a symbol key has the same tokens as the symbol value')
  // Path keys, search and copy path don't read the displayed key.
  assert.deepEqual(core.inspectorSearch(value, /^Symbol\(id\)$/).map(m => core.inspectorPathKey(m.path)), ['r/@Symbol(id)#0', 'r/@Symbol(id)#1'])
  // Only well-known and registered symbols have a path to copy.
  assert.deepEqual(rows.slice(1).map(row => row.pathText), ['name', undefined, undefined, '[Symbol.for("tag")]', '[Symbol.iterator]'])
  assert.deepEqual(keysOf(value, { style: 'tree', expandDepth: 1 }).length, 6)
  assert.equal(repr(value), '{name:"run"}')
  assert.deepEqual(core.visibleRows(core.describe(value), { style: 'tree', expandDepth: 1 }).length, 2, 'without the option, symbol keys stay hidden')
})

test('inspectorExpandToPath adds every ancestor of a path and keeps what was open', () => {
  const value = { results: [{ id: 't1' }, { error: { message: 'x' } }] }
  const path = [{ type: 'property', key: 'results' }, { type: 'index', index: 1 }, { type: 'property', key: 'error' }]
  const open = core.inspectorExpandToPath(value, ['r/.other'], path)
  assert.deepEqual(open, ['r/.other', 'r', 'r/.results', 'r/.results/1'])
  assert.deepEqual(core.inspectorExpandToPath(value, open, path), open, 'repeating it changes nothing')
  const rows = core.visibleRows(core.describe(value), { style: 'tree', open: new Set(open) })
  assert.ok(rows.some(row => row.id === 'r/.results/1/.error'), 'the row is shown')
})

test('an open set decides alone, and keys that name no row are ignored, as after replacing the value', () => {
  const before = { a: { x: 1 }, b: { y: 2 }, c: [1] }
  const open = new Set(['r', 'r/.b', 'r/.c'])
  const shown = value => core.visibleRows(core.describe(value), { style: 'tree', expandDepth: 5, open })
    .filter(row => row.type === 'node' && row.open).map(row => row.id)
  assert.deepEqual(shown(before), ['r', 'r/.b', 'r/.c'])
  // Reordered keys and a missing `c`: `b` stays open by its key, `c` is ignored.
  assert.deepEqual(shown({ b: { y: 3 }, a: { x: 1 } }), ['r', 'r/.b'])
})

test('deepOpen opens a subtree in an open set, and closing removes everything below', () => {
  const value = { a: { b: { c: [1, { d: 2 }] }, s: 'x\ny' }, loop: null }
  value.loop = value
  const root = core.describe(value)
  const opened = core.deepOpen(root, { style: 'tree', open: new Set(['r']) }, 'r/.a', true)
  assert.deepEqual([...opened].sort(), ['r', 'r/.a', 'r/.a/.b', 'r/.a/.b/.c', 'r/.a/.b/.c/1'])
  const closed = core.deepOpen(root, { style: 'tree', open: opened }, 'r/.a', false)
  assert.deepEqual([...closed], ['r'])
})

// Chunks: long groups show nested ranges, keyed by position, never in a path.

test('chunk levels nest by tens until a level has at most 10 ranges', () => {
  assert.deepEqual(core.chunkLevels(100), [])
  assert.deepEqual(core.chunkLevels(101), [100])
  assert.deepEqual(core.chunkLevels(1000), [100])
  assert.deepEqual(core.chunkLevels(1001), [1000, 100])
  assert.deepEqual(core.chunkLevels(100000), [10000, 1000, 100])
  assert.deepEqual(core.chunkLevels(150, 50), [50])
})

test('chunk keys follow from the position and the length alone', () => {
  assert.deepEqual(core.chunkPath(100000, 50000), [[50000, 59999], [50000, 50999], [50000, 50099]])
  assert.deepEqual(core.chunkPath(150, 120), [[100, 149]])
  assert.deepEqual(core.chunkPath(99, 50), [])
  assert.deepEqual(core.chunkPath(100000, 99999), [[90000, 99999], [99000, 99999], [99900, 99999]])
})

test('revealing index 50,000 of 100,000 opens only the ranges above it', () => {
  const value = { big: Array.from({ length: 100000 }, (_, i) => i) }
  const path = [{ type: 'property', key: 'big' }, { type: 'index', index: 50000 }]
  const open = core.inspectorExpandToPath(value, [], path)
  assert.deepEqual(open, ['r', 'r/.big', 'r/.big~g1~50000-59999', 'r/.big~g1~50000-50999', 'r/.big~g1~50000-50099'])
  const rows = core.visibleRows(core.describe(value), { style: 'tree', open: new Set(open) })
  assert.ok(rows.some(row => row.id === 'r/.big/50000'), 'the row is shown')
  const items = rows.filter(row => row.type === 'node' && row.depth === 5)
  assert.equal(items.length, 100, 'only the innermost range of 100 is rendered')
  assert.ok(items.every(row => Number(row.id.split('/').at(-1)) >= 50000), 'nothing before index 50,000 is rendered')
  assert.ok(rows.length < 150, `${rows.length} rows`)
})

test('a deep open opens ranges too', () => {
  const root = core.describe({ list: Array.from({ length: 5 }, (_, i) => ({ i })) })
  const open = core.deepOpen(root, { style: 'tree', chunkSize: 2, open: new Set(['r']) }, 'r/.list', true)
  assert.ok(open.has('r/.list~g1~0-1') && open.has('r/.list~g1~4-4'))
  assert.ok(open.has('r/.list/4'))
})

// Search: a row matches once, on its key or its own value, in the fully open
// tree's row order.

const searchKeys = (value, matcher) => core.inspectorSearch(value, matcher).map(m => `${core.inspectorPathKey(m.path)} ${m.field}`)

test('search visits every row of the fully open tree, in its order', () =>
  hegel.test(tc => {
    const { value } = make(tc.draw(recipes(), 'recipe'))
    const rows = core.visibleRows(core.describe(value, { symbol_keys: true }), { style: 'tree', expandDepth: Infinity, chunkSize: Infinity })
      .filter(row => row.type === 'node' && row.kind !== 'empty-slots')
    const matches = core.inspectorSearch(value, () => true)
    assert.deepEqual(matches.map(m => core.inspectorPathKey(m.path)), rows.map(row => row.id))
  }, settings))

test('a row matches once, and its key wins over its value', () => {
  assert.deepEqual(searchKeys({ x: 'x', y: 'x' }, /x/), ['r/.x key', 'r/.y value'])
})

test('a closed preview never matches, so each match is the row it names', () => {
  const value = { a: { countries: ['Peru'] }, b: [{ countries: 1 }] }
  assert.deepEqual(searchKeys(value, /countries/), ['r/.a/.countries key', 'r/.b/0/.countries key'])
  // A container matches on its type, as its open row shows it.
  assert.deepEqual(searchKeys(value, /^Array\(1\)$/), ['r/.a/.countries value', 'r/.b value'])
})

test('array indices never match; Map keys do, unless the key is an object', () => {
  assert.deepEqual(searchKeys([10, 20], /^1$/), [])
  const map = new Map([['k1', 0], [1, 'v'], [{ k1: 0 }, 0]])
  assert.deepEqual(searchKeys(map, /1/), ['r/=s:k1 key', 'r/=n:1 key'])
})

test('search is cycle-safe and searches each repeated reference where it appears', () => {
  const shared = { name: 'shared' }
  const value = { a: shared, b: shared }
  value.self = value
  assert.deepEqual(searchKeys(value, /^shared$/), ['r/.a/.name value', 'r/.b/.name value'])
  assert.deepEqual(searchKeys(value, /self/), ['r/.self key'])
})

test('search calls no getters, and a throwing proxy is inaccessible', () => {
  let reads = 0
  const value = { get secret() { reads++; return 'found' }, plain: 'found' }
  const trap = () => { throw new Error('trap') }
  const proxy = new Proxy({}, { ownKeys: trap, get: trap, getOwnPropertyDescriptor: trap, getPrototypeOf: trap })
  assert.deepEqual(searchKeys({ value, proxy }, /found/), ['r/.value/.plain value'])
  assert.equal(reads, 0)
  assert.deepEqual(searchKeys({ proxy }, /inaccessible/), ['r/.proxy value'])
})

test('a global RegExp gives the same matches on every row', () => {
  assert.deepEqual(searchKeys(['a', 'a', 'a'], /^a$/g), ['r/0 value', 'r/1 value', 'r/2 value'])
})

test('a match deep in a long list reveals with the ranges above it', () => {
  const value = Array.from({ length: 100000 }, (_, i) => (i === 900 || i === 50000 ? 'needle' : i))
  const matches = core.inspectorSearch(value, /needle/)
  assert.deepEqual(matches.map(m => core.inspectorPathKey(m.path)), ['r/900', 'r/50000'])
  const open = core.inspectorExpandToPath(value, [], matches[1].path)
  assert.deepEqual(open, ['r', 'r~g1~50000-59999', 'r~g1~50000-50999', 'r~g1~50000-50099'])
})

// The docs walkthrough's values: every kind the Inspector shows.

test('every walkthrough value: a row that can open has children, and the rows spell out repr', async () => {
  const { inspectorKinds, rootPrimitives } = await import('../fixtures/inspector/kinds.ts')
  const values = [
    ...Object.entries(inspectorKinds).map(([name, kind]) => [name, kind.values()]),
    ...rootPrimitives().map(({ label, value }) => [`root ${label}`, value]),
  ]
  for (const [name, value] of values) {
    // Open everything, strings included, the way a reader would one row at a time.
    const root = core.describe(value, { symbol_keys: true })
    const open = new Set()
    let rows
    for (let round = 0; round < 50; round++) {
      rows = core.visibleRows(root, { style: 'tree', chunkSize: Infinity, open })
      const closed = rows.filter(row => row.type === 'node' && row.expandable && !row.open)
      if (!closed.length) break
      for (const row of closed) open.add(row.id)
    }
    for (const row of rows) {
      if (row.type !== 'node' || !row.expandable) continue
      assert.ok(rows.some(other => other.depth === row.depth + 1 && inSubtree(other, row.id) && other.id !== row.id), `${name}: ${row.id} can open but shows nothing`)
    }
    // A row that can't open never shows an arrow: it's not expandable.
    assert.ok(rows.filter(row => row.type === 'node' && !row.expandable).every(row => !row.open), `${name}: a leaf is open`)
    // Without symbol keys, which repr() leaves out, the rows spell out repr.
    const reprRows = core.visibleRows(core.describe(value), { expandDepth: Infinity, chunkSize: Infinity, previewBudget: Infinity })
    assert.equal(reprRows.map(line).join(''), repr(value, { deduplicate_references: false, char_limit: Infinity }), `${name}: rows differ from repr`)
  }
})

test('an empty class and an instance with no fields show no arrow', async () => {
  const { Marker } = await import('../fixtures/inspector/kinds.ts')
  for (const value of [Marker, new Marker(), {}, [], new Map(), new Set()]) {
    const [row] = core.visibleRows(core.describe(value), { style: 'tree', expandDepth: 1 })
    assert.equal(row.expandable, false, `${line(row)} can open`)
  }
})

test('previewBudget caps a closed summary: 80 by default, a smaller value, or no limit', () => {
  const value = { results: Array.from({ length: 40 }, (_, i) => ({ test: `t${i}`, ok: i % 3 !== 0 })) }
  const summary = state => core.visibleRows(core.describe(value), state)[0]
  // The budget counts the space the Inspector draws after each comma and colon.
  const drawn = row => text(row.tokens).length + row.tokens.filter(token => token.type === 'comma' || token.type === 'field_colon').reduce((n, token) => n + token.text.length, 0)
  const byDefault = summary({})
  assert.ok(drawn(byDefault) <= 80 && drawn(byDefault) > 70, `default drew ${drawn(byDefault)}`)
  assert.equal(byDefault.tokens.at(-1).text, '…')
  const small = summary({ previewBudget: 20 })
  assert.ok(drawn(small) <= 20, `20 drew ${drawn(small)}`)
  assert.equal(small.tokens.at(-1).text, '…')
  // No limit: the whole value, as repr() writes it.
  const whole = summary({ previewBudget: Infinity })
  assert.equal(text(whole.tokens), repr(value))
  assert.ok(!whole.tokens.some(token => token.type === 'ellipsis'))
})

test('generators and built-in iterators show their type, stay closed, and are never advanced', () => {
  function* steps() { yield 'start'; yield 'finish' }
  async function* poll() { yield 1 }
  const values = {
    generator: steps(),
    asyncGenerator: poll(),
    arrayIterator: ['a', 'b'][Symbol.iterator](),
    typedArrayIterator: new Uint8Array([7]).values(),
    mapIterator: new Map([['k', 1]]).entries(),
    setIterator: new Set([1]).values(),
    stringIterator: 'ok'[Symbol.iterator](),
  }
  const root = core.describe(values, { symbol_keys: true, iterator_labels: true })
  const rows = core.visibleRows(root, { style: 'tree', expandDepth: Infinity }).slice(1)
  assert.deepEqual(rows.map(line), [
    'generator:Generator{}', 'asyncGenerator:AsyncGenerator{}', 'arrayIterator:Array Iterator{}', 'typedArrayIterator:Array Iterator{}',
    'mapIterator:Map Iterator{}', 'setIterator:Set Iterator{}', 'stringIterator:String Iterator{}',
  ])
  assert.ok(rows.every(row => !row.expandable && !row.open), 'an iterator can open')
  // Search reads their type too; neither reading them nor searching advanced them.
  assert.equal(core.inspectorSearch(values, /Generator/).length, 2)
  assert.deepEqual(values.generator.next(), { value: 'start', done: false })
  assert.deepEqual(values.arrayIterator.next(), { value: 'a', done: false })
  assert.deepEqual(values.mapIterator.next(), { value: ['k', 1], done: false })
  assert.deepEqual(values.stringIterator.next(), { value: 'o', done: false })
  // repr() keeps writing `{}`, as the notebook did.
  assert.equal(repr(steps()), '{}')
  assert.equal(repr(['a'][Symbol.iterator]()), '{}')
})

test('an object that only claims to be a generator is a plain object, and its toStringTag getter never runs', () => {
  let reads = 0
  const claims = { [Symbol.toStringTag]: 'Generator' }
  const getter = { get [Symbol.toStringTag]() { reads++; return 'Generator' } }
  for (const value of [claims, getter]) {
    const [row] = core.visibleRows(core.describe(value, { iterator_labels: true }), { style: 'tree' })
    assert.ok(!line(row).startsWith('Generator'), `${line(row)} was labeled a generator`)
  }
  assert.equal(reads, 0)
})
