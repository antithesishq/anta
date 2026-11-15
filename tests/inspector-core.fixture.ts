// Hegel generators for inspector-core tests.
//
// Hegel draws a plain-data recipe, and build() turns it into a fresh live
// value. Failing cases then print and shrink as readable data, build() can
// create values Hegel can't generate directly (cycles, proxies, functions,
// symbols), and building one recipe twice gives equal but distinct values.
//
// The file imports only packages, so tests load it through Node's type
// stripping without a bundler.
import * as gs from '@hegeldev/hegel/generators'

export type Recipe =
  | { t: 'num'; v: number }
  | { t: 'big'; v: bigint }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'null' }
  | { t: 'undef' }
  // Symbols and functions come from small pools, so the same one can repeat.
  | { t: 'sym'; id: number }
  | { t: 'fn'; id: number; toRepr: boolean }
  | { t: 'err'; msg: string }
  // The nearest enclosing container, which makes a real cycle.
  | { t: 'cycle' }
  | { t: 'hostile'; k: 'getter' | 'proxyGet' | 'proxyHas' | 'proxyOwnKeys' }
  // `null` in `items` is a hole.
  | { t: 'arr'; items: (Recipe | null)[]; named?: Recipe }
  | { t: 'obj'; entries: [string, Recipe][] }
  | { t: 'map'; entries: [string, Recipe][] }
  | { t: 'set'; items: Recipe[] }

export type LeafOptions = { hostile?: boolean; cycles?: boolean }

const shortText = gs.text({ maxSize: 4 })

export function leaves({ hostile = false, cycles = true }: LeafOptions = {}) {
  const parts = [
    gs.floats({ allowNan: true, allowInfinity: true }).map(v => ({ t: 'num', v }) as Recipe),
    gs.bigIntegers({ minValue: -(2n ** 70n), maxValue: 2n ** 70n }).map(v => ({ t: 'big', v }) as Recipe),
    gs.text({ maxSize: 8 }).map(v => ({ t: 'str', v }) as Recipe),
    gs.booleans().map(v => ({ t: 'bool', v }) as Recipe),
    gs.just({ t: 'null' } as Recipe),
    gs.just({ t: 'undef' } as Recipe),
    gs.integers({ minValue: 0, maxValue: 2 }).map(id => ({ t: 'sym', id }) as Recipe),
    gs.tuples(gs.integers({ minValue: 0, maxValue: 2 }), gs.booleans())
      .map(([id, toRepr]) => ({ t: 'fn', id, toRepr }) as Recipe),
    gs.text({ maxSize: 5 }).map(msg => ({ t: 'err', msg }) as Recipe),
  ]
  if (cycles) parts.push(gs.just({ t: 'cycle' } as Recipe))
  if (hostile) parts.push(
    gs.sampledFrom(['getter', 'proxyGet', 'proxyHas', 'proxyOwnKeys'] as const)
      .map(k => ({ t: 'hostile', k }) as Recipe),
  )
  return gs.oneOf(...parts)
}

export function recipes(options: LeafOptions = {}) {
  return gs.recursive(
    leaves(options),
    children => gs.oneOf(
      gs.arrays(gs.optional(children), { maxSize: 5 }).map(items => ({ t: 'arr', items }) as Recipe),
      gs.tuples(gs.arrays(gs.optional(children), { maxSize: 5 }), children)
        .map(([items, named]) => ({ t: 'arr', items, named }) as Recipe),
      gs.arrays(gs.tuples(shortText, children), { maxSize: 4 }).map(entries => ({ t: 'obj', entries }) as Recipe),
      gs.arrays(gs.tuples(shortText, children), { maxSize: 4 }).map(entries => ({ t: 'map', entries }) as Recipe),
      gs.arrays(children, { maxSize: 4 }).map(items => ({ t: 'set', items }) as Recipe),
    ),
    { maxDepth: 4, maxLeaves: 30 },
  )
}

export const primitives = gs.oneOf<unknown>(
  gs.floats({ allowNan: true, allowInfinity: true }),
  gs.bigIntegers({ minValue: -(2n ** 70n), maxValue: 2n ** 70n }),
  gs.text({ maxSize: 6 }),
  gs.booleans(),
  gs.none(),
  gs.just(undefined),
)

export type ReprOptions = {
  char_limit?: number
  deduplicate_references?: boolean
  numeric_base?: 'binary' | 'octal' | 'decimal' | 'hex'
  unquoted_strings?: boolean
}

/** Any combination of repr options, each possibly left unset. */
export const reprOptions = gs.record({
  char_limit: gs.optional(gs.integers({ minValue: 3, maxValue: 200 })),
  deduplicate_references: gs.optional(gs.booleans()),
  numeric_base: gs.optional(gs.sampledFrom(['binary', 'octal', 'decimal', 'hex'] as const)),
  unquoted_strings: gs.optional(gs.booleans()),
}).map(o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null)) as ReprOptions)

export type Built = { value: unknown; realCycles: number }

/** Builds a fresh value from a recipe. `toRepr` is the symbol the core under test recognizes. */
export function build(recipe: Recipe, { toRepr }: { toRepr: symbol }): Built {
  const symbols = new Map<number, symbol>()
  const functions = new Map<string, Function>()
  const stack: object[] = []
  let realCycles = 0

  const make = (r: Recipe): unknown => {
    switch (r.t) {
      case 'num': case 'big': case 'str': case 'bool': return r.v
      case 'null': return null
      case 'undef': return undefined
      case 'sym': {
        if (!symbols.has(r.id)) symbols.set(r.id, Symbol(`s${r.id}`))
        return symbols.get(r.id)
      }
      case 'fn': {
        const key = `${r.id}:${r.toRepr}`
        if (!functions.has(key)) {
          const f = function named() {}
          if (r.toRepr) Object.assign(f, { [toRepr](v: { span(text: string, type: string): void }) { v.span(`F${r.id}`, 'function_name') } })
          functions.set(key, f)
        }
        return functions.get(key)
      }
      case 'err': return new Error(r.msg)
      case 'cycle': {
        const parent = stack.at(-1)
        if (parent) realCycles++
        return parent
      }
      case 'hostile': {
        const boom = () => { throw new Error(`hostile ${r.k}`) }
        if (r.k === 'getter') return Object.defineProperty({}, 'boom', { get: boom, enumerable: true })
        if (r.k === 'proxyGet') return new Proxy({ a: 1 }, { get: boom })
        if (r.k === 'proxyHas') return new Proxy({}, { has: boom })
        return new Proxy({}, { ownKeys: boom })
      }
      case 'arr': {
        const a: unknown[] & { x?: unknown } = []
        stack.push(a)
        a.length = r.items.length
        r.items.forEach((item, i) => { if (item !== null) a[i] = make(item) })
        if (r.named) a.x = make(r.named)
        stack.pop()
        return a
      }
      case 'obj': {
        const o: Record<string, unknown> = {}
        stack.push(o)
        for (const [k, v] of r.entries) o[k] = make(v)
        stack.pop()
        return o
      }
      case 'map': {
        const m = new Map<string, unknown>()
        stack.push(m)
        for (const [k, v] of r.entries) m.set(k, make(v))
        stack.pop()
        return m
      }
      case 'set': {
        const s = new Set<unknown>()
        stack.push(s)
        for (const v of r.items) s.add(make(v))
        stack.pop()
        return s
      }
    }
  }

  return { value: make(recipe), realCycles }
}
