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

test('the node API never throws, even on hostile values', () =>
  hegel.test(tc => {
    const recipe = tc.draw(recipes({ hostile: true }), 'recipe')
    for (const { node } of walk(core.describe(make(recipe).value))) {
      node.summary(40)
      void node.header, node.size, node.target
    }
  }, settings))

// Rows: visibleRows() lists the lines the Inspector renders for a display state.

const line = row => row.type === 'more' ? '' : text([...(row.key ?? []), ...row.tokens])
const lines = rows => rows.map(row => ({ id: row.id, line: line(row) }))
const inSubtree = (row, id) => row.id === id || row.id.startsWith(`${id}:`) || row.id.startsWith(`${id}>`)

// The node a node row's id names: `:p.i` is child i of the group in part p,
// and a bare `:p` is the inline value in part p.
function nodeAt(root, id) {
  let node = root
  for (const [, part, index] of id.slice(1).matchAll(/:(\d+)(?:\.(\d+))?/g)) {
    const found = node.parts[Number(part)]
    node = index === undefined ? found.node : found.group.childAt(Number(index)).value
  }
  return node
}

// Opens a few closed rows chosen by Hegel, one at a time, as a reader would.
function openSome(tc, root, state = {}, skip = () => false) {
  const toggled = new Set(state.toggled ?? [])
  const steps = tc.draw(gs.integers({ minValue: 0, maxValue: 6 }), 'opens')
  for (let step = 0; step < steps; step++) {
    const closed = core.visibleRows(root, { ...state, toggled })
      .filter(row => row.type === 'node' && row.expandable && !row.open && !skip(row))
    if (!closed.length) break
    const { id } = closed[tc.draw(gs.integers({ minValue: 0, maxValue: closed.length - 1 }), 'open')]
    if (toggled.has(id)) toggled.delete(id)
    else toggled.add(id)
  }
  return toggled
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
  assert.deepEqual(rows[1], { ...rows[1], id: 'r:1.0', expandable: true, open: true, size: 2 })
})

test('closed nodes show their summary, and toggling flips the default', () => {
  const root = core.describe({ tags: ['a', 'b'] })
  const closed = core.visibleRows(root)
  assert.deepEqual(closed.map(line), ['{tags:["a","b"]}'])
  assert.equal(closed[0].open, false)
  const opened = core.visibleRows(root, { toggled: new Set(['r']) })
  assert.deepEqual(opened.map(line), ['{', 'tags:["a","b"]', '}'])
})

test('wide groups end in a more row until every page is shown', () => {
  const root = core.describe(Array.from({ length: 5 }, (_, i) => i))
  const first = core.visibleRows(root, { expandDepth: 1, pageSize: 2 })
  assert.deepEqual(first.map(line), ['[', '0,', '1,', '', ']'])
  assert.deepEqual(first[3], { type: 'more', id: 'r:1+', depth: 1, group: 'r:1', shown: 2, unit: 'children' })
  const all = core.visibleRows(root, { expandDepth: 1, pageSize: 2, pages: new Map([['r:1', 3]]) })
  assert.deepEqual(all.map(line), ['[', '0,', '1,', '2,', '3,', '4', ']'])
})

test('cycles link to their open ancestor and repeats expand in place', () => {
  const shared = { x: 1 }
  const value = { a: shared, b: shared }
  value.self = value
  const rows = core.visibleRows(core.describe(value), { expandDepth: 2 })
  assert.deepEqual(rows.map(line), ['{', 'a:{', 'x:1', '},', 'b:{', 'x:1', '},', 'self:circular_ref[]', '}'])
  assert.equal(rows.at(-2).target, 'r')
})

test('with every node open, the rows spell out repr without deduplication', () =>
  hegel.test(tc => {
    const recipe = tc.draw(recipes({ hostile: true }), 'recipe')
    // Open rows always list an error's stack, so compare with the stack included.
    const { char_limit: _limit, deduplicate_references: _dedupe, error_stacks: _stacks, ...options } = tc.draw(reprOptions, 'options')
    const { value } = make(recipe)
    const rows = core.visibleRows(core.describe(value, options), { expandDepth: Infinity, pageSize: Infinity, previewBudget: Infinity })
    assert.equal(rows.map(line).join(''), repr(value, { ...options, deduplicate_references: false, char_limit: Infinity }))
  }, settings))

test('closing a node hides only its descendants', () =>
  hegel.test(tc => {
    const root = core.describe(make(tc.draw(recipes(), 'recipe')).value)
    const toggled = openSome(tc, root, { expandDepth: 1 })
    const open = core.visibleRows(root, { expandDepth: 1, toggled }).filter(row => row.type === 'node' && row.open)
    tc.assume(open.length > 0)
    const { id } = open[tc.draw(gs.integers({ minValue: 0, maxValue: open.length - 1 }), 'close')]
    const flipped = new Set(toggled)
    if (flipped.has(id)) flipped.delete(id)
    else flipped.add(id)
    const before = core.visibleRows(root, { expandDepth: 1, toggled })
    const after = core.visibleRows(root, { expandDepth: 1, toggled: flipped })
    assert.deepEqual(lines(after.filter(row => !inSubtree(row, id))), lines(before.filter(row => !inSubtree(row, id))))
    assert.deepEqual(after.filter(row => inSubtree(row, id)).map(row => row.id), [id])
  }, settings))

test('showing every page gives the same rows as one unbounded page', () =>
  hegel.test(tc => {
    const recipe = tc.draw(recipes({ hostile: true }), 'recipe')
    const pageSize = tc.draw(gs.integers({ minValue: 1, maxValue: 3 }), 'pageSize')
    const root = core.describe(make(recipe).value)
    const pages = new Map()
    let rows
    for (let round = 0; round < 100; round++) {
      rows = core.visibleRows(root, { expandDepth: Infinity, pageSize, pages })
      const more = rows.filter(row => row.type === 'more')
      for (const row of more) assert.equal(row.shown, (pages.get(row.group) ?? 1) * pageSize, 'a page showed the wrong number of children')
      if (!more.length) break
      for (const row of more) pages.set(row.group, (pages.get(row.group) ?? 1) + 1)
    }
    const whole = core.visibleRows(core.describe(make(recipe).value), { expandDepth: Infinity, pageSize: Infinity })
    assert.deepEqual(lines(rows), lines(whole))
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
    const toggled = openSome(tc, root, display, isHolder)
    const rows = core.visibleRows(root, { ...display, toggled })
    assert.equal(state.touched, false, 'a closed node was read')
    core.visibleRows(root, { ...display, toggled: new Set([...toggled, rows.find(isHolder).id]) })
    assert.equal(state.touched, true, 'opening a node did not read its children')
  }, settings))

test('circular rows link to an open ancestor', () =>
  hegel.test(tc => {
    const root = core.describe(make(tc.draw(recipes(), 'recipe')).value)
    const expandDepth = tc.draw(gs.integers({ minValue: 0, maxValue: 6 }), 'expandDepth')
    const toggled = openSome(tc, root, { expandDepth })
    const rows = core.visibleRows(root, { expandDepth, toggled })
    rows.forEach((row, index) => {
      if (row.type !== 'node' || row.kind !== 'circular') return
      assert.ok(row.target !== undefined, `circular row ${row.id} has no target`)
      const target = rows.findIndex(other => other.id === row.target)
      assert.ok(target >= 0 && target < index, `target ${row.target} is not an earlier row`)
      assert.equal(rows[target].open, true)
      assert.ok(row.id.startsWith(`${row.target}:`), `${row.target} is not an ancestor of ${row.id}`)
      assert.deepEqual(rows[target].path, nodeAt(root, row.id).target, `${row.target} is not the ancestor ${row.id} refers to`)
    })
  }, settings))

test('rows never throw and keep ids unique, even on hostile values', () =>
  hegel.test(tc => {
    const root = core.describe(make(tc.draw(recipes({ hostile: true }), 'recipe')).value)
    const display = {
      expandDepth: tc.draw(gs.integers({ minValue: 0, maxValue: 6 }), 'expandDepth'),
      pageSize: tc.draw(gs.integers({ minValue: 1, maxValue: 4 }), 'pageSize'),
      previewBudget: tc.draw(gs.integers({ minValue: 3, maxValue: 80 }), 'previewBudget'),
    }
    const rows = core.visibleRows(root, { ...display, toggled: openSome(tc, root, display) })
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
  const opened = core.visibleRows(root, { expandDepth: 1, toggled: new Set([closed[1].id]) })
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
  const rows = core.visibleRows(core.describe('\u001b[31mred\u001b[0m\ta\rb\nnext'), { toggled: new Set(['r']) })
  assert.deepEqual(textRows(rows), ['\\u001b[31mred\\u001b[0m\ta\\rb', 'next'])
  const unquoted = core.visibleRows(core.describe('a\nb', { unquoted_strings: true }), { toggled: new Set(['r']) })
  assert.deepEqual(unquoted.map(line), ['', 'a', 'b', ''])
})

test('long strings page by characters, never splitting a surrogate pair', () => {
  const root = core.describe('x'.repeat(12))
  const display = { toggled: new Set(['r']), previewBudget: 5, textPageSize: 5 }
  const first = core.visibleRows(root, display)
  assert.deepEqual(first.map(line), ['"', 'xxxxx', '', '"'])
  assert.deepEqual(first[2], { type: 'more', id: 'r:t+', depth: 1, group: 'r:t', shown: 5, unit: 'characters' })
  assert.deepEqual(core.visibleRows(root, { ...display, pages: new Map([['r:t', 3]]) }).map(line), ['"', 'x'.repeat(12), '"'])
  const emoji = core.visibleRows(core.describe('😀😀😀'), { toggled: new Set(['r']), previewBudget: 1, textPageSize: 3 })
  assert.deepEqual(textRows(emoji), ['😀'])
})

test('strings open only when toggled, and only when they need to', () => {
  const root = core.describe(['short', 'two\nlines', 'y'.repeat(81)])
  const rows = core.visibleRows(root, { expandDepth: Infinity })
  const strings = rows.filter(row => row.type === 'node' && row.depth === 1)
  assert.deepEqual(strings.map(row => [row.expandable, row.open]), [[false, false], [true, false], [true, false]])
  const toggled = core.visibleRows(root, { expandDepth: Infinity, toggled: new Set([strings[0].id]) })
  assert.deepEqual(toggled.map(line), rows.map(line))
})

test('open strings spell out their text', () =>
  hegel.test(tc => {
    const parts = tc.draw(gs.arrays(gs.text({ maxSize: 30, excludeCategories: ['Cc'] }), { minSize: 1, maxSize: 6 }), 'lines')
    const separator = tc.draw(gs.sampledFrom(['\n', '\r\n']), 'separator')
    const value = parts.join(separator)
    tc.assume(value !== '')
    const rows = core.visibleRows(core.describe(value), { toggled: new Set(['r']), previewBudget: 0, textPageSize: Infinity })
    assert.equal(textRows(rows).join('\n'), parts.join('\n'))
  }, settings))

test('string pages join into the whole text', () =>
  hegel.test(tc => {
    const value = tc.draw(gs.oneOf(multilineText, longText, gs.text({ minSize: 1, maxSize: 40 })), 'value')
    const textPageSize = tc.draw(gs.integers({ minValue: 1, maxValue: 20 }), 'textPageSize')
    tc.assume(value.length > 0)
    const root = core.describe(value)
    const display = { toggled: new Set(['r']), previewBudget: 0, textPageSize }
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
