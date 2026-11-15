import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build as esbuild } from 'esbuild'
import * as hegel from '@hegeldev/hegel'
import * as gs from '@hegeldev/hegel/generators'
import { build, leaves, primitives, recipes } from './inspector-core.fixture.ts'

let core
let directory

// The bundle is written to a file, not imported from a data: URL, so stack
// traces show a short path instead of the whole encoded module.
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'anta-inspector-core-'))
  const outfile = join(directory, 'inspector-core.mjs')
  await esbuild({
    entryPoints: ['src/inspector-core.ts'],
    bundle: true,
    outfile,
    platform: 'node',
    format: 'esm',
    target: 'es2022',
  })
  core = await import(pathToFileURL(outfile).href)
})

after(() => rm(directory, { recursive: true, force: true }))

const repr = (value, options) => core.repr(value, options)
const make = recipe => build(recipe, { toRepr: core.to_repr })

// The ci profile derives each run's seed from the test, so CI results repeat.
const settings = process.env.CI ? { profile: 'ci' } : {}
// Properties that fail until phase 2 fixes the bug they expose. Their failure
// message names the shrunk case, so Hegel's own report would only add noise.
const todoSettings = { ...settings, verbosity: hegel.Verbosity.Quiet, printBlob: false }
const phase2 = 'fixed in phase 2 of the Inspector work'

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
  assert.equal(repr(new Error('boom')), 'Error("boom")')
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

// Each of these exposes a known legacy bug that phase 2 fixes. The examples pin
// each bug down; the properties look for variations of it.

test('example: a Proxy whose get trap throws', { todo: phase2 }, () => {
  assert.doesNotThrow(() => repr(new Proxy({}, { get() { throw new Error('trap') } })))
})

test('example: a repeated function with to_repr is not circular', { todo: phase2 }, () => {
  const f = Object.assign(function named() {}, { [core.to_repr](v) { v.span('F', 'function_name') } })
  assert.equal(repr([f, f]), '[F,ref[0]]')
})

test('example: trailing empty slots next to a named property', { todo: phase2 }, () => {
  assert.equal(repr(Object.assign(new Array(2), { x: 1 })), '[<2 empty slots>]{x:1}')
})

test('example: a repeated symbol', { todo: phase2 }, () => {
  const s = Symbol('s')
  assert.equal(repr([s, s]), '[Symbol("s"),ref[0]]')
})

test('never throws, even on hostile values', { todo: phase2 }, () =>
  hegel.test(tc => {
    const { value } = make(tc.draw(recipes({ hostile: true }), 'recipe'))
    try { repr(value) } catch (e) { throw new Error(`repr threw: ${e.message}`) }
  }, todoSettings))

test('circular_ref only appears when the value has a cycle', { todo: phase2 }, () =>
  hegel.test(tc => {
    const { value, realCycles } = make(tc.draw(recipes(), 'recipe'))
    const out = repr(value)
    if (out.includes('circular_ref')) assert.ok(realCycles > 0, `no cycle, but got: ${out}`)
  }, { ...todoSettings, testCases: 500 }))

test('every empty slot is reported', { todo: phase2 }, () =>
  hegel.test(tc => {
    const leaf = leaves({ cycles: false })
    const items = tc.draw(gs.arrays(gs.optional(leaf), { maxSize: 6 }), 'items')
    const named = tc.draw(gs.optional(leaf), 'named')
    const out = repr(make({ t: 'arr', items, ...(named ? { named } : {}) }).value)
    const reported = [...out.matchAll(/<(\d+) empty slots?>/g)].reduce((sum, m) => sum + Number(m[1]), 0)
    assert.equal(reported, items.filter(item => item === null).length, `got: ${out}`)
  }, todoSettings))

test('a repeated symbol prints as ref[...]', { todo: phase2 }, () =>
  hegel.test(tc => {
    const ids = tc.draw(gs.arrays(gs.integers({ minValue: 0, maxValue: 2 }), { minSize: 1, maxSize: 6 }), 'ids')
    const out = repr(make({ t: 'arr', items: ids.map(id => ({ t: 'sym', id })) }).value)
    const refs = (out.match(/\bref\[/g) ?? []).length
    assert.equal(refs, ids.length - new Set(ids).size, `got: ${out}`)
  }, todoSettings))
