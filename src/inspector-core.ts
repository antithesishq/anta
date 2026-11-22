/**
 * Value representation core for the Inspector. `describe()` turns any
 * JavaScript value into a lazy tree of nodes made of typed tokens and groups of
 * children; `serialize()` renders a node as tokens within a character budget,
 * and `repr()` joins them into a string. `visibleRows()` lists the lines the
 * Inspector shows for a display state. No DOM or framework imports, so all of it
 * can run next to the value, including in a worker.
 *
 * Derived from the Antithesis notebook's `repr()`, whose string output it
 * reproduces. It never throws: a read that fails, such as a hostile Proxy trap,
 * prints `<inaccessible>`.
 *
 * Internal to Anta, except `to_repr`, `CustomRepresentationVisitor`, and
 * `SpanType`, which the package entry re-exports as `inspectorRepr`,
 * `InspectorReprVisitor`, and `InspectorTokenType` for custom types.
 * @module
 */

import type { TreeSearchQuery } from './tree-search'

export type Options = {
  char_limit?: number
  /** Print `ref[...]` with the path to the first appearance for repeated references. Defaults to true. */
  deduplicate_references?: boolean
  /** Base to render numbers. Defaults to decimal. */
  numeric_base?: 'binary' | 'octal' | 'decimal' | 'hex'
  /** If true, string values are not quoted. */
  unquoted_strings?: boolean
  /** Include an error's `stack`. Defaults to true; `summary()` always leaves it out. */
  error_stacks?: boolean
  /** List own enumerable symbol-keyed data properties after the string-keyed ones. The Inspector sets it; `repr()`
   *  leaves it off, keeping the notebook's output. */
  symbol_keys?: boolean
  /** Label generators, async generators, and the built-in Array, Map, Set, and String iterators by type, such as
   *  `Generator{}`, without iterating them. The Inspector sets it; `repr()` leaves it off and writes `{}`, as the
   *  notebook does. */
  iterator_labels?: boolean
  /** Show a Map as DevTools does: `Map(2){2024 => 4744353, …}`, with each entry a child that opens to its `key` and
   *  `value`. The Inspector sets it; `repr()` leaves it off and writes `Map{2024:4744353}`, as the notebook does. */
  map_entry_rows?: boolean
  /** Show a function as DevTools does: `ƒ greet()`, `async ƒ load()`, `ƒ* steps()`, or `class Account`, read from the
   *  engine's own source text, so no user code runs. The Inspector sets it; `repr()` leaves it off and writes
   *  `<function greet>`, as the notebook does. */
  function_labels?: boolean
  /** Label a cycle `Circular Ref(node)`, with its target's path. The Inspector sets it; `repr()` leaves it off and
   *  writes `circular_ref[node]`, as the notebook does. */
  cycle_labels?: boolean
}

type ReferenceInfo = {
  circular: boolean // still inside the definition of this reference
  path: string[]
}

/**
 * The kind of a piece of text, which sets its color in the Inspector. A custom
 * type passes one to `span()`; for example, `'number'` or `'class_name'`.
 */
export type SpanType = 'field_name' | 'field_colon' | 'open_bracket' | 'close_bracket' | 'comma' |
  'string' | 'number' | 'boolean' | 'symbol' | 'bigint' | 'undefined' | 'null' |
  'error_class_name' | 'class_name' | 'error_message' | 'reference' | 'reference_path' |
  'function' | 'function_name' | 'open_slash' | 'close_slash' | 'regexp' | 'regexp_flags' | 'legacy_repr' |
  'empty_slot' | 'open_quote' | 'close_quote' | 'inaccessible' | 'ellipsis' | 'map_arrow'

const numeric_bases = {
  binary: { prefix: '0b', number: 0b10 },
  octal: { prefix: '0o', number: 0o10 },
  decimal: { prefix: '', number: 10 },
  hex: { prefix: '0x', number: 0x10 },
}

// The standard does not expose %TypedArray%.
const TypedArray = Object.getPrototypeOf(Int8Array)

/**
 * The method key a class implements to control how the Inspector shows it. The
 * method receives an `InspectorReprVisitor` and describes the value by calling
 * its methods, in place of listing the value's own properties.
 *
 * The key is `Symbol.for('anta.to-repr')`, so separately loaded copies of Anta
 * recognize the same method.
 *
 * @example
 * ```ts
 * class Moment {
 *   constructor(public vtime: number) {}
 *   [inspectorRepr](v: InspectorReprVisitor) { v.constructor_call('Moment', this.vtime) }
 * }
 * // Shows as Moment(12.5); its argument opens like any other value.
 * ```
 */
export const to_repr = Symbol.for('anta.to-repr')

/** Stands in for a value or entry whose read threw. */
const INACCESSIBLE: unique symbol = Symbol('inaccessible')
type Inaccessible = typeof INACCESSIBLE
const INACCESSIBLE_TEXT = '<inaccessible>'

/** Converts a path segment to a string, even when its conversion throws. @internal */
export function safe_string(value: unknown): string {
  try {
    return String(value)
  } catch {
    try {
      return Object.prototype.toString.call(value)
    } catch {
      return '<unprintable>'
    }
  }
}

/** Returns at most `length` UTF-16 code units of `text` without splitting a surrogate pair. @internal */
export function safe_truncate(text: string, length: number): string {
  if (length <= 0) return ''
  if (length >= text.length) return text
  const last = text.charCodeAt(length - 1)
  return text.slice(0, last >= 0xd800 && last <= 0xdbff ? length - 1 : length)
}

/**
 * Splits text into display lines at `\r\n` and `\n`. Other control characters
 * except tab become escapes, so ANSI codes stay visible and can't garble the
 * display. @internal
 */
export function text_lines(text: string): string[] {
  return text.split(/\r?\n/).map(line => line.replace(
    /[\u0000-\u0008\u000b-\u001f\u007f]/g,
    c => c === '\r' ? '\\r' : `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  ))
}

// Built-ins captured at load, so a page that replaces them can't change what
// they report or run its own code through them.
const function_to_string = Function.prototype.toString

// A cycle's label: the notebook's `circular_ref[path]`, or the Inspector's `Circular Ref(path)`.
function cycle_tokens(path: string, readable: boolean): Token[] {
  return readable
    ? [{ text: 'Circular Ref', type: 'reference' }, { text: '(', type: 'open_bracket' }, { text: path, type: 'reference_path' }, { text: ')', type: 'close_bracket' }]
    : [{ text: 'circular_ref', type: 'reference' }, { text: '[', type: 'open_bracket' }, { text: path, type: 'reference_path' }, { text: ']', type: 'close_bracket' }]
}
const date_get_time = Date.prototype.getTime
const date_to_iso_string = Date.prototype.toISOString

// The engine's own `stack` accessors: V8 puts one on each error, Firefox on
// Error.prototype. Only these run; a user-defined `stack` getter never does.
const engine_stack_getters: ReadonlySet<unknown> = new Set(
  [new Error(), Error.prototype]
    .map(holder => Object.getOwnPropertyDescriptor(holder, 'stack')?.get)
    .filter(get => get !== undefined),
)

/** Well-known symbols, such as `Symbol.iterator`, mapped to their property names. @internal */
export const well_known_symbols: Map<symbol, string> = new Map(
  Object.getOwnPropertyNames(Symbol)
    .filter(name => typeof (Symbol as unknown as Record<string, unknown>)[name] === 'symbol')
    .map(name => [(Symbol as unknown as Record<string, symbol>)[name], name]),
)

/** Runs `read`, returning `INACCESSIBLE` if it throws. */
function guard<T>(read: () => T): T | Inaccessible {
  try {
    return read()
  } catch {
    return INACCESSIBLE
  }
}

/** Iterates `iterable`, yielding `INACCESSIBLE` once and stopping if iteration throws. */
function* guarded<T>(iterable: Iterable<T>): Generator<T | Inaccessible> {
  let iterator: Iterator<T>
  try {
    iterator = iterable[Symbol.iterator]()
  } catch {
    yield INACCESSIBLE
    return
  }
  while (true) {
    let result: IteratorResult<T>
    try {
      result = iterator.next()
    } catch {
      yield INACCESSIBLE
      return
    }
    if (result.done) return
    yield result.value
  }
}

function* keys_in(it: object): Generator<string> {
  for (const key in it) yield key
}

// Enumerable string-keyed data properties, including inherited ones, read
// lazily (for...in) so truncation can stop early. Accessors are skipped, so no
// user code runs. A failed read yields INACCESSIBLE and ends the iteration.
function* data_entries(it: object): Generator<[string, unknown] | Inaccessible> {
  for (const prop of guarded(keys_in(it))) {
    if (prop === INACCESSIBLE) { yield INACCESSIBLE; return }
    const desc = guard(() => find_descriptor(it, prop))
    if (desc === INACCESSIBLE) { yield INACCESSIBLE; return }
    if (desc && 'value' in desc) yield [prop, desc.value]
  }
}

function format_key_name(key: string) {
  if (/^[A-Za-z0-9_]+$/.test(key)) return key
  return `"${key}"`
}

// Finds a property descriptor up the prototype chain without running getters.
// Proxy traps it reaches may throw; callers guard.
function find_descriptor(it: object | null, prop: PropertyKey): PropertyDescriptor | undefined {
  while (it) {
    const desc = Object.getOwnPropertyDescriptor(it, prop)
    if (desc) return desc
    it = Object.getPrototypeOf(it)
  }
  return undefined
}

// A brand check through the captured built-in: a Proxy around a Date fails it,
// and a Date from another frame passes.
function is_date(it: object): boolean {
  try {
    date_get_time.call(it)
    return true
  } catch {
    return false
  }
}

// An error's own `cause` or `errors`, or its `stack` through the engine's own
// accessor. Proxy traps it reaches may throw; callers guard.
function error_detail(error: object, name: 'cause' | 'errors' | 'stack'): { value: unknown } | undefined {
  if (name !== 'stack') {
    const desc = Object.getOwnPropertyDescriptor(error, name)
    return desc && 'value' in desc ? { value: desc.value } : undefined
  }
  const desc = find_descriptor(error, 'stack')
  const stack = !desc ? undefined
    : 'value' in desc ? desc.value
    : engine_stack_getters.has(desc.get) ? desc.get!.call(error)
    : undefined
  return typeof stack === 'string' ? { value: stack } : undefined
}

function data_property(it: object, prop: PropertyKey): unknown {
  const desc = find_descriptor(it, prop)
  return desc && 'value' in desc ? desc.value : undefined
}

// Read through descriptors, so a `constructor` getter or a Proxy `get` trap
// never runs.
function constructor_name(obj: object): string | undefined {
  const ctor = data_property(obj, 'constructor')
  if (typeof ctor !== 'function') return undefined
  const name = data_property(ctor, 'name')
  return typeof name === 'string' ? name : undefined
}
function constructor_name_if_any(obj: object) {
  const name = constructor_name(obj)
  return name === 'Object' ? '' : name ?? ''
}
function is_pojo(obj: object) {
  return constructor_name(obj) === 'Object'
}

// The built-in prototypes of generators and iterators, with the type name each shows.
const iterator_prototypes: ReadonlyMap<object, string> = new Map<object, string>([
  [Object.getPrototypeOf(function* () {}).prototype, 'Generator'],
  [Object.getPrototypeOf(async function* () {}).prototype, 'AsyncGenerator'],
  [Object.getPrototypeOf([][Symbol.iterator]()), 'Array Iterator'],
  [Object.getPrototypeOf(new Map()[Symbol.iterator]()), 'Map Iterator'],
  [Object.getPrototypeOf(new Set()[Symbol.iterator]()), 'Set Iterator'],
  [Object.getPrototypeOf(''[Symbol.iterator]()), 'String Iterator'],
])

// The type of a generator or built-in iterator, from its prototype chain. It
// reads no properties, so no getter runs, and it never calls next(). A
// generator's own prototype is its function's `prototype`, so the walk goes
// up a few links.
function iterator_label(it: object): string | undefined {
  let proto = Object.getPrototypeOf(it)
  for (let depth = 0; proto !== null && depth < 8; depth++) {
    const label = iterator_prototypes.get(proto)
    if (label) return label
    proto = Object.getPrototypeOf(proto)
  }
  return undefined
}

/**
 * What an `inspectorRepr` method receives. Call its methods in display order;
 * each call adds text, a value, or a group of children that opens in the
 * Inspector. A method that throws shows `<inaccessible>`.
 */
export interface CustomRepresentationVisitor {
  /** Adds one piece of text in the color for `type`, such as `span('1m 32s', 'number')`. */
  span(text: string, type: SpanType): void
  /** Adds a value, shown and opened like any other. */
  visit(it: unknown): void
  /** Shows the value as a constructor call, `name(a, b)`; each parameter opens as a child. */
  constructor_call(name: string, ...params: unknown[]): void
  /** Shows the value as a named object with the given members as its properties, `name{a:1}`. */
  class_object_like(class_name: string, members: object): void
  /** Shows the value as a named list of the given items, `name[a, b]`. */
  iterable_like(class_name: string, iter: Iterable<unknown>): void
  /** Always false: the Inspector reads a value's parts only as far as they're shown. */
  get stopped(): boolean
}

type ObjectKind = 'custom' | 'array' | 'typed_array' | 'set' | 'map' | 'date' | 'error' | 'regexp' | 'blob' | 'object'

type ToRepr = { [to_repr](visitor: CustomRepresentationVisitor): void }

// ---------------------------------------------------------------------------
// Node model: a lazy tree of a value, for interactive display and for the
// string output. Nothing below a node is read until its groups are pulled.

export type Token = { text: string; type: SpanType }

export type NodeKind =
  | 'string' | 'number' | 'bigint' | 'boolean' | 'null' | 'undefined' | 'symbol'
  | 'array' | 'typed-array' | 'set' | 'map' | 'object' | 'date' | 'error' | 'regexp' | 'function' | 'blob'
  | 'custom' | 'circular' | 'empty-slots' | 'inaccessible' | 'map-entry'

/**
 * One entry in a group. `key` is tokens for a property or string key, or a node for a non-string Map key.
 * `stack` marks an error's stack, which the string output leaves out when `error_stacks` is false.
 */
export type InspectChild = {
  key?: Token[] | InspectNode
  /** The text search reads for the key, when it isn't the key's tokens without brackets: a symbol key searches as `Symbol(trace)`. */
  keyText?: string
  value: InspectNode
  stack?: true
}

/**
 * One step from a node to a child, in data terms. Display-only rows, such as
 * chunks of a long list, never appear in a path.
 */
export type InspectorPathSegment =
  /** An array, typed array, or list element, by index. */
  | { type: 'index'; index: number }
  /** An own data property. `occurrence` tells apart symbols that share a description: 0 for the first. */
  | { type: 'property'; key: string | symbol; occurrence?: number }
  /** A Map entry, by position, with its key, which may be an object. */
  | { type: 'entry'; index: number; key: unknown }
  /** A Set item, by position. */
  | { type: 'item'; index: number }
  /** An error's `cause`, `errors`, or `stack` that isn't an enumerable property. */
  | { type: 'detail'; name: 'cause' | 'errors' | 'stack' }
  /** A child in a custom type's `inspectorRepr` output: `part` counts the parts it described, `index` the child. */
  | { type: 'part'; part: number; index: number }
  /** A Map entry's key or value, when entries open to them (the Inspector). */
  | { type: 'map-key' }
  | { type: 'map-value' }

/** Path from the root value to a node. The root's path is empty. */
export type InspectorPath = readonly InspectorPathSegment[]

// Escapes the characters a path key uses as separators.
const escape_key = (text: string) => text.replace(/[%/~]/g, c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)

function symbol_name(symbol: symbol): string {
  const known = well_known_symbols.get(symbol)
  if (known) return `Symbol.${known}`
  const registered = Symbol.keyFor(symbol)
  return registered !== undefined ? `Symbol.for(${registered})` : `Symbol(${symbol.description ?? ''})`
}

/**
 * A symbol as tokens, as a value and as a key show it: `Symbol.iterator` for a
 * well-known symbol, `Symbol.for("key")` for a registered one, and
 * `Symbol("description")` otherwise. The description is quoted unless
 * `unquoted` is set, like a string.
 */
function symbol_tokens(value: symbol, unquoted?: boolean): Token[] {
  const known = well_known_symbols.get(value)
  if (known) return [{ text: 'Symbol', type: 'class_name' }, { text: '.', type: 'class_name' }, { text: known, type: 'field_name' }]
  const text = JSON.stringify(String(value).slice(7, -1)).slice(1, -1) // drop `Symbol(` and `)`
  return [
    { text: Symbol.keyFor(value) !== undefined ? 'Symbol.for' : 'Symbol', type: 'class_name' },
    { text: '(', type: 'open_bracket' },
    ...(unquoted ? [{ text, type: 'string' as const }] : [
      { text: '"', type: 'open_quote' as const }, { text, type: 'string' as const }, { text: '"', type: 'close_quote' as const },
    ]),
    { text: ')', type: 'close_bracket' },
  ]
}

/** One segment of a path key. @internal */
export function segmentKey(segment: InspectorPathSegment): string {
  switch (segment.type) {
    case 'index': return `/${segment.index}`
    case 'item': return `/*${segment.index}`
    case 'detail': return `/!${segment.name}`
    case 'part': return `/(${segment.part}.${segment.index})`
    case 'map-key': return '/:key'
    case 'map-value': return '/:value'
    case 'property': return typeof segment.key === 'symbol'
      ? `/@${escape_key(symbol_name(segment.key))}#${segment.occurrence ?? 0}`
      : `/.${escape_key(segment.key)}`
    case 'entry': {
      const key = segment.key
      switch (typeof key) {
        case 'string': return `/=s:${escape_key(key)}`
        case 'number': return `/=n:${Object.is(key, -0) ? '-0' : String(key)}`
        case 'bigint': return `/=b:${key}`
        case 'boolean': case 'undefined': return `/=${String(key)}`
        case 'symbol': return `/=#${segment.index}`
        default: return key === null ? '/=null' : `/=#${segment.index}`
      }
    }
  }
}

/**
 * A path as a string, for use in sets, maps, and as a Tree item id. Strings
 * and numbers are written as themselves, a symbol property by its description
 * and occurrence, a Map entry with a primitive key by that key, and one with an
 * object key by position, since an object's identity doesn't survive replacing
 * the value. The root's key is `r`.
 */
export function inspectorPathKey(path: InspectorPath): string {
  let key = 'r'
  for (const segment of path) key += segmentKey(segment)
  return key
}

/** A node's content in display order. Custom types can interleave tokens, inline values, and groups. */
export type InspectPart =
  | { type: 'tokens'; tokens: Token[] }
  | { type: 'group'; group: InspectGroup }
  | { type: 'value'; node: InspectNode }

/** A node in the lazy value tree. Reading `kind`, `parts`, `header`, `groups` or `size` resolves the node. */
export interface InspectNode {
  /** Path from the root. Segments are property names, indices, or raw Map keys. */
  readonly path: readonly unknown[]
  /** Path from the root in typed segments, for `inspectorPathKey`. */
  readonly segments: InspectorPath
  /** The object, function, or symbol this node shows, for detecting repeated references. */
  readonly identity: object | symbol | undefined
  readonly kind: NodeKind
  /** The raw text of a string node, unescaped. */
  readonly text: string | undefined
  readonly parts: readonly InspectPart[]
  /** Tokens before the first group or inline value. */
  readonly header: readonly Token[]
  readonly groups: readonly InspectGroup[]
  /** Element count of an array, typed array, Set, or Map. */
  readonly size: number | undefined
  /** For a circular node, the path of the ancestor it refers to. */
  readonly target: readonly unknown[] | undefined
  /**
   * One-line text of this node within `budget` characters, as tokens. With
   * `display`, the budget counts the space the Inspector draws after commas and
   * colons, and a cut text ends in `…`.
   */
  summary(budget: number, display?: boolean): Token[]
}

type Ancestor = { identity: object; path: readonly unknown[]; parent: Ancestor | undefined }
type Context = { options: Options; ancestors: Ancestor | undefined }
type Resolved = { kind: NodeKind; parts: InspectPart[]; size?: number; target?: readonly unknown[] }

/** A bracketed list of children, pulled lazily and cached so paging re-reads nothing. */
export class InspectGroup {
  readonly open: string
  readonly close: string
  /** Omit the brackets when there are no children, as for extra properties on an array. */
  readonly hideWhenEmpty: boolean
  #source: () => Iterator<InspectChild>
  #iterator: Iterator<InspectChild> | undefined
  #cache: InspectChild[] = []
  #done = false

  constructor(open: string, close: string, hideWhenEmpty: boolean, source: () => Iterator<InspectChild>) {
    this.open = open
    this.close = close
    this.hideWhenEmpty = hideWhenEmpty
    this.#source = source
  }

  /** The child at `index`, reading only as far as needed. */
  childAt(index: number): InspectChild | undefined {
    while (this.#cache.length <= index && !this.#done) {
      try {
        this.#iterator ??= this.#source()
        const result = this.#iterator.next()
        if (result.done) this.#done = true
        else this.#cache.push(result.value)
      } catch {
        this.#done = true
      }
    }
    return this.#cache[index]
  }

  /** How many children the group has. Reads them all, once; they're cached. */
  count(): number {
    let n = this.#cache.length
    while (this.childAt(n) !== undefined) n++
    return this.#cache.length
  }

  /** Up to `limit` children from `offset`, and whether more follow. */
  children(offset: number, limit: number): { items: InspectChild[]; more: boolean } {
    const items: InspectChild[] = []
    while (items.length < limit) {
      const child = this.childAt(offset + items.length)
      if (!child) break
      items.push(child)
    }
    return { items, more: this.childAt(offset + items.length) !== undefined }
  }
}

const empty_slots_text = (count: number) => `<${count} empty slot${count === 1 ? '' : 's'}>`

class Node implements InspectNode {
  readonly path: readonly unknown[]
  readonly segments: InspectorPath
  readonly identity: object | symbol | undefined
  #value: unknown
  #context: Context
  #resolved: Resolved | undefined

  constructor(value: unknown, path: readonly unknown[], segments: InspectorPath, context: Context, resolved?: Resolved) {
    this.#value = value
    this.path = path
    this.segments = segments
    this.#context = context
    this.#resolved = resolved
    this.identity = (typeof value === 'object' && value !== null) || typeof value === 'function' || typeof value === 'symbol'
      ? value as object | symbol
      : undefined
  }

  /** The raw value of a primitive node, for `jsonText`. @internal */
  static primitive(node: InspectNode): unknown {
    return node instanceof Node ? node.#value : undefined
  }

  get kind() { return this.#resolve().kind }
  get text() { return typeof this.#value === 'string' ? this.#value : undefined }
  get parts() { return this.#resolve().parts }
  get size() { return this.#resolve().size }
  get target() { return this.#resolve().target }
  get header() {
    const tokens: Token[] = []
    for (const part of this.parts) {
      if (part.type !== 'tokens') break
      tokens.push(...part.tokens)
    }
    return tokens
  }
  get groups() {
    return this.parts.flatMap(part => part.type === 'group' ? [part.group] : [])
  }

  // A one-line preview names an error without its stack, as DevTools does.
  summary(budget: number, display = false): Token[] {
    return serialize(this, { ...this.#context.options, char_limit: budget, error_stacks: false }, display)
  }

  // Context for this node's children: this node joins the ancestor chain.
  #inner(): Context {
    const identity = this.identity
    if (typeof identity !== 'object' && typeof identity !== 'function') return this.#context
    return { options: this.#context.options, ancestors: { identity, path: this.path, parent: this.#context.ancestors } }
  }

  #child(value: unknown, path: readonly unknown[], segment: InspectorPathSegment): InspectNode {
    return this.#descendant(value, path, [...this.segments, segment])
  }

  // A node below this one with the given segments, as a Map entry's key and value.
  #descendant(value: unknown, path: readonly unknown[], segments: InspectorPath): InspectNode {
    const context = this.#inner()
    if ((typeof value === 'object' && value !== null) || typeof value === 'function') {
      for (let a = context.ancestors; a; a = a.parent) {
        if (a.identity === value) {
          return new Node(value, path, segments, context, {
            kind: 'circular',
            target: a.path,
            parts: [{ type: 'tokens', tokens: cycle_tokens(a.path.map(p => format_key_name(safe_string(p))).join('.'), !!context.options.cycle_labels) }],
          })
        }
      }
    }
    return new Node(value, path, segments, context)
  }

  #leaf(kind: NodeKind, path: readonly unknown[], segment: InspectorPathSegment, tokens: Token[]): InspectNode {
    return new Node(undefined, path, [...this.segments, segment], this.#context, { kind, parts: [{ type: 'tokens', tokens }] })
  }
  #inaccessible(path: readonly unknown[], segment: InspectorPathSegment) {
    return this.#leaf('inaccessible', path, segment, [{ text: INACCESSIBLE_TEXT, type: 'inaccessible' }])
  }

  // Children with only values, from any iterable (Set, typed array, to_repr lists).
  // `segment` names the child at a position: an index, a Set item, or a custom part.
  *#elements(iterable: Iterable<unknown>, segment: (i: number) => InspectorPathSegment = index => ({ type: 'index', index })): Generator<InspectChild> {
    let i = 0
    for (const element of guarded(iterable)) {
      if (element === INACCESSIBLE) { yield { value: this.#inaccessible([...this.path, i], segment(i)) }; return }
      yield { value: this.#child(element, [...this.path, i], segment(i)) }
      i++
    }
  }

  *#array_elements(arr: unknown[]): Generator<InspectChild> {
    let last = -1
    for (const key of guarded(keys_in(arr))) {
      if (key === INACCESSIBLE) { yield { value: this.#inaccessible([...this.path, last + 1], { type: 'index', index: last + 1 }) }; return }
      if (!/^\d+$/.test(key)) break // numeric array keys come before other keys
      const index = +key
      const skipped = index - last - 1
      if (skipped > 0) yield { value: this.#leaf('empty-slots', [...this.path, last + 1], { type: 'index', index: last + 1 }, [{ text: empty_slots_text(skipped), type: 'empty_slot' }]) }
      const element = guard(() => arr[index])
      yield { value: element === INACCESSIBLE ? this.#inaccessible([...this.path, index], { type: 'index', index }) : this.#child(element, [...this.path, index], { type: 'index', index }) }
      last = index
    }
    const length = guard(() => arr.length)
    if (length === INACCESSIBLE || last === length - 1) return
    yield { value: this.#leaf('empty-slots', [...this.path, last + 1], { type: 'index', index: last + 1 }, [{ text: empty_slots_text(length - 1 - last), type: 'empty_slot' }]) }
  }

  // Properties as keyed children. `skip_indices` leaves out an array's elements.
  // `listed` collects the names yielded.
  // `segment` overrides the property segment, as for a custom type's members.
  *#properties(it: object, format_keys: boolean, skip_indices = false, listed?: Set<string>,
    segment?: (i: number) => InspectorPathSegment): Generator<InspectChild> {
    let i = 0
    for (const entry of data_entries(it)) {
      if (entry === INACCESSIBLE) { yield { value: this.#inaccessible(this.path, segment?.(i) ?? { type: 'index', index: i }) }; return }
      const [name, value] = entry
      if (skip_indices && /^\d+$/.test(name)) continue
      listed?.add(name)
      yield {
        key: [{ text: format_keys ? format_key_name(name) : name, type: 'field_name' }],
        value: this.#child(value, [...this.path, name], segment?.(i) ?? { type: 'property', key: name }),
      }
      i++
    }
    if (!this.#context.options.symbol_keys) return
    // Own enumerable symbol-keyed data properties. Accessors are skipped, so no user code runs.
    const symbols = guard(() => Object.getOwnPropertySymbols(it))
    if (symbols === INACCESSIBLE) return
    const seen = new Map<string, number>()
    for (const key of symbols) {
      const desc = guard(() => Object.getOwnPropertyDescriptor(it, key))
      if (desc === INACCESSIBLE) { yield { value: this.#inaccessible(this.path, segment?.(i) ?? { type: 'index', index: i }) }; return }
      if (!desc?.enumerable || !('value' in desc)) continue
      const name = symbol_name(key)
      const occurrence = seen.get(name) ?? 0
      seen.set(name, occurrence + 1)
      // The key reads as the symbol value does, in brackets: [Symbol("trace")].
      // Search keeps reading it as before, `Symbol(trace)`.
      yield {
        key: [{ text: '[', type: 'open_bracket' }, ...symbol_tokens(key, this.#context.options.unquoted_strings), { text: ']', type: 'close_bracket' }],
        keyText: name,
        value: this.#child(desc.value, [...this.path, key], segment?.(i) ?? { type: 'property', key, occurrence }),
      }
      i++
    }
  }

  // An error's enumerable properties, then the own ones for...in skips.
  *#error_properties(error: Error): Generator<InspectChild> {
    const listed = new Set<string>()
    yield* this.#properties(error, true, false, listed)
    for (const name of ['cause', 'errors', 'stack'] as const) {
      if (listed.has(name)) continue
      const key: Token[] = [{ text: name, type: 'field_name' }]
      const detail = guard(() => error_detail(error, name))
      if (detail === INACCESSIBLE) { yield { key, value: this.#inaccessible([...this.path, name], { type: 'detail', name }) }; return }
      if (detail) {
        const child: InspectChild = { key, value: this.#child(detail.value, [...this.path, name], { type: 'detail', name }) }
        if (name === 'stack') child.stack = true
        yield child
      }
    }
  }

  *#map_entries(map: Map<unknown, unknown>): Generator<InspectChild> {
    let index = 0
    for (const entry of guarded(map)) {
      if (entry === INACCESSIBLE) { yield { value: this.#inaccessible(this.path, { type: 'entry', index, key: undefined }) }; return }
      const [key, value] = entry
      const path = [...this.path, key]
      const segment: InspectorPathSegment = { type: 'entry', index, key }
      yield {
        key: typeof key === 'string'
          ? [{ text: '"', type: 'open_bracket' }, { text: key, type: 'field_name' }, { text: '"', type: 'close_bracket' }]
          : this.#child(key, path, segment),
        value: this.#child(value, path, segment),
      }
      index++
    }
  }

  // Map entries as nodes that open to their key and value, as DevTools shows them.
  *#map_entry_nodes(map: Map<unknown, unknown>): Generator<InspectChild> {
    let index = 0
    for (const entry of guarded(map)) {
      if (entry === INACCESSIBLE) { yield { value: this.#inaccessible(this.path, { type: 'entry', index, key: undefined }) }; return }
      const [key, value] = entry
      const path = [...this.path, key]
      const segments: InspectorPath = [...this.segments, { type: 'entry', index, key }]
      const key_node = this.#descendant(key, path, [...segments, { type: 'map-key' }])
      const value_node = this.#descendant(value, path, [...segments, { type: 'map-value' }])
      yield {
        value: new Node(undefined, path, segments, this.#inner(), {
          kind: 'map-entry',
          parts: [
            { type: 'value', node: key_node },
            { type: 'tokens', tokens: [{ text: '=>', type: 'map_arrow' }] },
            { type: 'value', node: value_node },
          ],
        }),
      }
      index++
    }
  }

  #group(open: string, close: string, source: () => Iterator<InspectChild>, hide_when_empty = false): InspectPart {
    return { type: 'group', group: new InspectGroup(open, close, hide_when_empty, source) }
  }
  #keyable(it: object, skip_indices = false): InspectPart {
    return this.#group('{', '}', () => this.#properties(it, true, skip_indices), true)
  }

  #resolve(): Resolved {
    if (!this.#resolved) {
      try {
        this.#resolved = this.#classify()
      } catch {
        this.#resolved = { kind: 'inaccessible', parts: [{ type: 'tokens', tokens: [{ text: INACCESSIBLE_TEXT, type: 'inaccessible' }] }] }
      }
    }
    return this.#resolved
  }

  #classify(): Resolved {
    const value = this.#value
    const options = this.#context.options
    const tokens: Token[] = []
    const t = (text: string, type: SpanType) => { tokens.push({ text, type }) }
    const parts: InspectPart[] = [{ type: 'tokens', tokens }]
    const inaccessible = () => t(INACCESSIBLE_TEXT, 'inaccessible')

    switch (typeof value) {
      case 'string': {
        const text = JSON.stringify(value).slice(1, -1)
        if (options.unquoted_strings) t(text, 'string')
        else { t('"', 'open_quote'); t(text, 'string'); t('"', 'close_quote') }
        return { kind: 'string', parts }
      }
      case 'number': {
        const base = numeric_bases[options.numeric_base ?? 'decimal']
        if (Number.isNaN(value)) t('NaN', 'number')
        else if (value === Infinity) t('Infinity', 'number')
        else if (value === -Infinity) t('-Infinity', 'number')
        else {
          let str = Object.is(value, -0) ? '-0' : value.toString(base.number)
          let sign = ''
          if (str[0] === '-') { str = str.slice(1); sign = '-' }
          t(sign + base.prefix + str.toUpperCase(), 'number')
        }
        return { kind: 'number', parts }
      }
      case 'bigint': {
        const name = options.numeric_base
        if (!name || name === 'decimal') t(`${value}n`, 'bigint')
        else t(numeric_bases[name].prefix + value.toString(numeric_bases[name].number) + 'n', 'bigint')
        return { kind: 'bigint', parts }
      }
      case 'boolean': t(String(value), 'boolean'); return { kind: 'boolean', parts }
      case 'undefined': t('undefined', 'undefined'); return { kind: 'undefined', parts }
      case 'symbol': {
        tokens.push(...symbol_tokens(value, options.unquoted_strings))
        return { kind: 'symbol', parts }
      }
      case 'function': {
        const custom = guard(() => to_repr in value && typeof (value as unknown as Record<symbol, unknown>)[to_repr] === 'function')
        if (custom === INACCESSIBLE) { inaccessible(); return { kind: 'inaccessible', parts } }
        if (custom) return this.#custom(value as unknown as ToRepr)
        if (options.function_labels) {
          // The kind comes from the engine's own source text: Function.prototype.toString
          // is native, so a function's own `toString` never runs.
          const source = guard(() => function_to_string.call(value))
          const name = guard(() => value.name)
          const text = typeof name === 'string' ? name : ''
          const kind = typeof source !== 'string' ? 'function'
            : /^class\b/.test(source) ? 'class'
            : /^async\s*function\s*\*/.test(source) ? 'async generator'
            : /^async\b/.test(source) ? 'async'
            : /^function\s*\*/.test(source) ? 'generator'
            : 'function'
          if (kind === 'class') { t('class ', 'function'); if (text) t(text, 'function_name') }
          else {
            t(kind === 'async' ? 'async ƒ ' : kind === 'async generator' ? 'async ƒ* ' : kind === 'generator' ? 'ƒ* ' : 'ƒ ', 'function')
            if (text) t(text, 'function_name')
            t('()', 'function')
          }
          parts.push(this.#keyable(value))
          return { kind: 'function', parts }
        }
        t('<', 'open_bracket')
        const name = guard(() => ({ name: value.name, display: 'display_name' in value ? (value as { display_name?: unknown }).display_name : undefined }))
        if (name === INACCESSIBLE) inaccessible()
        else if (name.name) { t('function ', 'function'); t(typeof name.display === 'string' ? name.display : name.name, 'function_name') }
        else t('anonymous function', 'function')
        t('>', 'close_bracket')
        parts.push(this.#keyable(value))
        return { kind: 'function', parts }
      }
      case 'object': {
        if (value === null) { t('null', 'null'); return { kind: 'null', parts } }
        const kind = classify_object(value)
        if (kind === INACCESSIBLE) { inaccessible(); return { kind: 'inaccessible', parts } }
        switch (kind) {
          case 'custom': return this.#custom(value as ToRepr)
          case 'array': {
            const arr = value as unknown[]
            parts.push(this.#group('[', ']', () => this.#array_elements(arr)), this.#keyable(arr, true))
            const size = guard(() => arr.length)
            return { kind: 'array', parts, size: size === INACCESSIBLE ? undefined : size }
          }
          case 'typed_array': {
            const arr = value as ArrayLike<unknown> & Iterable<unknown>
            const name = guard(() => constructor_name(arr))
            if (name === INACCESSIBLE) inaccessible()
            else if (name) t(name, 'class_name')
            parts.push(this.#group('[', ']', () => this.#elements(arr)), this.#keyable(arr, true))
            const size = guard(() => arr.length)
            return { kind: 'typed-array', parts, size: size === INACCESSIBLE ? undefined : size }
          }
          case 'set': {
            const set = value as Set<unknown>
            t('Set', 'class_name')
            parts.push(this.#group('{', '}', () => this.#elements(set, index => ({ type: 'item', index }))), this.#keyable(set))
            const size = guard(() => set.size)
            return { kind: 'set', parts, size: size === INACCESSIBLE ? undefined : size }
          }
          case 'map': {
            const map = value as Map<unknown, unknown>
            const size = guard(() => map.size)
            t('Map', 'class_name')
            if (options.map_entry_rows) {
              // DevTools' form: the size, then `key => value` entries that open.
              if (size !== INACCESSIBLE) { t('(', 'open_bracket'); t(String(size), 'number'); t(')', 'close_bracket') }
              parts.push(this.#group('{', '}', () => this.#map_entry_nodes(map)), this.#keyable(map))
            } else {
              parts.push(this.#group('{', '}', () => this.#map_entries(map)), this.#keyable(map))
            }
            return { kind: 'map', parts, size: size === INACCESSIBLE ? undefined : size }
          }
          case 'error': {
            const error = value as Error
            const name = guard(() => constructor_name(error))
            if (name === INACCESSIBLE) inaccessible()
            else if (name) t(name, 'error_class_name')
            t('(', 'open_bracket')
            const message = guard(() => JSON.stringify(error.message))
            if (message === INACCESSIBLE) inaccessible()
            else if (message !== undefined) t(message, 'error_message')
            t(')', 'close_bracket')
            parts.push(this.#group('{', '}', () => this.#error_properties(error), true))
            return { kind: 'error', parts }
          }
          case 'date': {
            const time = date_get_time.call(value)
            const text = Number.isNaN(time) ? 'Invalid Date' : date_to_iso_string.call(value)
            t('Date', 'class_name')
            t('(', 'open_bracket')
            if (options.unquoted_strings) t(text, 'string')
            else { t('"', 'open_quote'); t(text, 'string'); t('"', 'close_quote') }
            t(')', 'close_bracket')
            parts.push(this.#keyable(value))
            return { kind: 'date', parts }
          }
          case 'regexp': {
            const re = value as RegExp
            const source = guard(() => ({ source: re.source, flags: re.flags }))
            if (source === INACCESSIBLE) inaccessible()
            else { t('/', 'open_slash'); t(source.source, 'regexp'); t('/', 'close_slash'); t(source.flags, 'regexp_flags') }
            parts.push(this.#keyable(re))
            return { kind: 'regexp', parts }
          }
          case 'blob': {
            const blob = guard(() => ({ size: (value as Blob).size, type: (value as Blob).type }))
            if (blob === INACCESSIBLE) { inaccessible(); return { kind: 'inaccessible', parts } }
            t('Blob', 'class_name')
            parts.push(this.#group('{', '}', () => this.#properties(blob, false)))
            return { kind: 'blob', parts }
          }
          default: {
            // A generator or iterator shows its type and stays closed: listing
            // its items would mean iterating it.
            const iterator = options.iterator_labels ? guard(() => iterator_label(value)) : undefined
            if (typeof iterator === 'string') {
              t(iterator, 'class_name')
              parts.push(this.#group('{', '}', () => [][Symbol.iterator]()))
              return { kind: 'object', parts }
            }
            const name = guard(() => constructor_name_if_any(value))
            if (name !== INACCESSIBLE && name) t(name, 'class_name')
            const pojo = guard(() => is_pojo(value)) === true
            parts.push(this.#group('{', '}', () => this.#properties(value, pojo)))
            return { kind: 'object', parts }
          }
        }
      }
    }
    throw Error('Unknown type in describe: ' + typeof value)
  }

  // Runs to_repr against a recorder, so custom types keep the visitor protocol.
  #custom(value: ToRepr): Resolved {
    const parts: InspectPart[] = []
    const tokens = () => {
      const last = parts.at(-1)
      if (last?.type === 'tokens') return last.tokens
      const fresh: Token[] = []
      parts.push({ type: 'tokens', tokens: fresh })
      return fresh
    }
    const node = this
    const recorder: CustomRepresentationVisitor = {
      span(text, type) { tokens().push({ text, type }) },
      // Each child is named by the part it's in and its place there.
      visit(it) { const part = parts.length; parts.push({ type: 'value', node: node.#child(it, node.path, { type: 'part', part, index: 0 }) }) },
      constructor_call(name, ...params) {
        tokens().push({ text: name, type: 'class_name' })
        const part = parts.length
        parts.push(node.#group('(', ')', () => node.#elements(params, index => ({ type: 'part', part, index }))))
      },
      class_object_like(name, members) {
        tokens().push({ text: name, type: 'class_name' })
        const part = parts.length
        parts.push(node.#group('{', '}', () => node.#properties(members, false, false, undefined, index => ({ type: 'part', part, index }))))
      },
      iterable_like(name, iter) {
        tokens().push({ text: name, type: 'class_name' })
        const part = parts.length
        parts.push(node.#group('[', ']', () => node.#elements(iter, index => ({ type: 'part', part, index }))))
      },
      get stopped() { return false },
    }
    try {
      value[to_repr](recorder)
    } catch {
      tokens().push({ text: INACCESSIBLE_TEXT, type: 'inaccessible' })
    }
    return { kind: 'custom', parts }
  }
}

function classify_object(it: object): ObjectKind | Inaccessible {
  try {
    // Read through the Proxy on purpose, so a Proxy can supply to_repr.
    if (to_repr in it && typeof (it as Record<symbol, unknown>)[to_repr] === 'function') return 'custom'
    if (Array.isArray(it)) return 'array'
    if (it instanceof TypedArray) return 'typed_array'
    if (it instanceof Set) return 'set'
    if (it instanceof Map) return 'map'
    if (is_date(it)) return 'date'
    if (it instanceof Error) return 'error'
    if (it instanceof RegExp) return 'regexp'
    if (constructor_name(it) === 'Blob' && 'size' in it && 'type' in it) return 'blob' // Node has no Blob before 18
    return 'object'
  } catch {
    return INACCESSIBLE
  }
}

/** Describes `value` as a lazy node tree. Nothing is read until the root resolves. */
export function describe(value: unknown, options: Options = {}): InspectNode {
  return new Node(value, [], [], { options, ancestors: undefined })
}

/**
 * Renders a node as tokens within `options.char_limit` characters. Repeated
 * objects and symbols print as `ref[path]` and ancestors as `circular_ref[path]`,
 * labelled by first appearance in walk order. Children are pulled one at a time
 * and the walk stops at the limit, so nothing past the limit is read.
 */
export function serialize(root: InspectNode, options: Options = {}, display = false): Token[] {
  const out: Token[] = []
  let remaining = options.char_limit ?? Infinity
  let stop = false
  // `display` counts the Inspector's spacing after separators and ends a cut in
  // one `…`. A cut never leaves a separator or an emptied token, whose spacing
  // would show before the `…`.
  const mark = display ? '…' : '...'
  const refs = new WeakMap<object, ReferenceInfo>()
  const symbol_refs = new Map<symbol, ReferenceInfo>()
  const deduplicate = options.deduplicate_references !== false

  const emit = (text: string, type: SpanType) => {
    if (!text || stop) return
    const separator = type === 'comma' || type === 'field_colon' || type === 'map_arrow'
    const width = text.length + (display && separator ? (type === 'map_arrow' ? 2 : 1) : 0)
    remaining -= width
    if (remaining < mark.length) {
      const kept = safe_truncate(text, remaining + width - mark.length)
      if (!display) out.push({ text: kept, type })
      else if (kept && !separator) out.push({ text: kept, type })
      else while (out.at(-1)?.type === 'comma' || out.at(-1)?.type === 'field_colon' || out.at(-1)?.type === 'map_arrow') out.pop()
      out.push({ text: mark, type: 'ellipsis' })
      stop = true
    } else {
      out.push({ text, type })
    }
  }

  const visit = (node: InspectNode) => {
    if (stop) return
    const identity = node.identity
    let ref: ReferenceInfo | undefined
    if (identity !== undefined) {
      const seen = typeof identity === 'symbol' ? symbol_refs.get(identity) : refs.get(identity)
      if (seen && (seen.circular || deduplicate)) {
        const path = seen.path.map(format_key_name).join('.')
        const tokens = seen.circular ? cycle_tokens(path, !!options.cycle_labels) : [
          { text: 'ref', type: 'reference' as const }, { text: '[', type: 'open_bracket' as const },
          { text: path, type: 'reference_path' as const }, { text: ']', type: 'close_bracket' as const },
        ]
        for (const token of tokens) emit(token.text, token.type)
        return
      }
      ref = { circular: typeof identity !== 'symbol', path: node.path.map(p => safe_string(p)) }
      if (typeof identity === 'symbol') symbol_refs.set(identity, ref)
      else refs.set(identity, ref)
    }
    for (const part of node.parts) {
      if (stop) return
      if (part.type === 'tokens') for (const token of part.tokens) emit(token.text, token.type)
      else if (part.type === 'value') visit(part.node)
      else visit_group(part.group)
    }
    if (ref) ref.circular = false
  }

  // The index of the first child at or after `i` that the output includes.
  const next_shown = (group: InspectGroup, i: number) => {
    if (options.error_stacks !== false) return i
    while (group.childAt(i)?.stack) i++
    return i
  }

  const visit_group = (group: InspectGroup) => {
    let i = next_shown(group, 0)
    if (group.hideWhenEmpty && !group.childAt(i)) return
    emit(group.open, 'open_bracket')
    for (let first = true; !stop; i = next_shown(group, i + 1), first = false) {
      const child = group.childAt(i)
      if (!child) break
      if (!first) emit(',', 'comma')
      if (child.key) {
        if (Array.isArray(child.key)) for (const token of child.key) emit(token.text, token.type)
        else visit(child.key as InspectNode)
        emit(':', 'field_colon')
      }
      visit(child.value)
    }
    emit(group.close, 'close_bracket')
  }

  visit(root)
  return out
}

// ---------------------------------------------------------------------------
// Rows: the visible lines of a node tree, for the Inspector to render. A pure
// function of the tree and the display state, so it runs wherever the value
// lives, including a worker.

/**
 * One visible line of the tree. A node row's id is its path key
 * (`inspectorPathKey`), so an ancestor's id is a prefix of its descendants'
 * ids (`r`, `r/.results`, `r/.results/0`), and ids can travel in serializable
 * events. Other rows add a `~` suffix to their node's id.
 *
 * - `node`: a value, open or closed. A closed node shows its summary; an open
 *   node shows its header and the opening bracket of its first group.
 * - `close`: closing brackets of an open node, and any tokens between its groups.
 * - `text`: one line of an open string, unescaped apart from control characters.
 * - `chunk`: a range of a long group's children, which opens to show them or smaller ranges.
 * - `more`: the end of a string with more text than is shown.
 */
export type InspectRow =
  | {
    type: 'node'
    id: string
    depth: number
    /** Key and colon, empty for array elements and the root. */
    key: Token[]
    tokens: Token[]
    kind: NodeKind
    path: readonly unknown[]
    /** The node's path in typed segments; `id` is its key. */
    segments: InspectorPath
    /** Element count of an array, typed array, Set, or Map. */
    size: number | undefined
    expandable: boolean
    open: boolean
    /** For a circular node, the id of the ancestor row it refers to. */
    target?: string
    /**
     * A JavaScript accessor for this value from the root, such as
     * `results[3].details.error`; `''` for the root. Undefined where no
     * expression reaches it, as for Set items and object Map keys.
     */
    pathText?: string
  }
  | { type: 'close'; id: string; depth: number; tokens: Token[] }
  | { type: 'text'; id: string; depth: number; tokens: Token[] }
  | {
    /** A range of a long group's children, such as `[0…99]`. Display only:
     *  its id is `<group>~<start>-<end>`, and it never appears in a path. */
    type: 'chunk'
    id: string
    depth: number
    /** Positions of the first and last child in the range. */
    start: number
    end: number
    open: boolean
  }
  | {
    type: 'more'
    id: string
    depth: number
    /** The group or string to page further, as a key of `RowState.pages`. */
    group: string
    /** Children, or characters of a string, shown so far. */
    shown: number
    unit: 'children' | 'characters'
  }

/** Display state for `visibleRows`. Every field is serializable. */
export type RowState = {
  /** Without `open`, nodes shallower than this depth are open; strings and ranges stay closed. Defaults to 0. */
  expandDepth?: number
  /**
   * Ids of the open nodes and ranges. When set, it decides alone, and
   * `expandDepth` doesn't apply. Ids that name no row, as after the value
   * changes, are ignored.
   */
  open?: ReadonlySet<string>
  /** Pages shown per open string, keyed by its `more` row's `group`. Each defaults to one page. */
  pages?: ReadonlyMap<string, number>
  /**
   * A group with more children than this shows them in ranges of `chunkSize`.
   * Ranges nest by tens until a level has at most 10: 100,000 children show as
   * ranges of 10,000, then 1,000, then 100. Defaults to 100.
   */
  chunkSize?: number
  /** Characters per page of an open string. Defaults to 5,000. */
  textPageSize?: number
  /**
   * Characters in a closed node's summary, counting the space drawn after
   * commas and colons. Strings longer than this can open. Defaults to 80.
   */
  previewBudget?: number
  /**
   * Characters rendered in a closed node's summary when the Inspector's CSS
   * cuts the row at its edge instead, as in block layout. It only bounds the
   * work, so it's a wide row's worth. Defaults to `previewBudget`.
   */
  summaryLimit?: number
  /**
   * `repr` rows read like `repr()` output, with brackets, commas, and `close`
   * rows. `tree` rows read like an object in browser DevTools: an open node's
   * row names its type and size, every child is `key: value`, and there are no
   * `close` rows or commas. Defaults to `repr`.
   */
  style?: 'repr' | 'tree'
}

const LEAF_KINDS: ReadonlySet<NodeKind> = new Set([
  'string', 'number', 'bigint', 'boolean', 'null', 'undefined', 'symbol', 'circular', 'empty-slots', 'inaccessible',
])

// A string opens when it has more than one line or doesn't fit its summary.
function is_expandable(node: InspectNode, budget: number): boolean {
  if (node.kind === 'string') return node.text!.includes('\n') || node.text!.length > budget
  if (LEAF_KINDS.has(node.kind)) return false
  return node.parts.some(part => part.type === 'value' || (part.type === 'group' && part.group.childAt(0) !== undefined))
}

// A property step of an accessor: `.name` for identifiers, `["key"]` otherwise.
// No expression reaches an own `__proto__` property, since both forms read the prototype.
function property_path(base: string, key: string): string | undefined {
  if (key === '__proto__') return undefined
  if (/^[A-Za-z_$][\w$]*$/.test(key)) return base === '' ? key : `${base}.${key}`
  return `${base}[${JSON.stringify(key)}]`
}

// A child's accessor, from its parent's accessor and kind.
function child_path_text(parent: InspectNode, base: string | undefined, child: InspectChild): string | undefined {
  if (base === undefined || child.value.kind === 'empty-slots') return undefined
  const segment = child.value.path.at(-1)
  switch (parent.kind) {
    case 'set': case 'custom': return undefined
    case 'map': {
      if (typeof segment === 'string') return `${base}.get(${JSON.stringify(segment)})`
      if (typeof segment === 'number') return `${base}.get(${Object.is(segment, -0) ? '-0' : String(segment)})`
      if (typeof segment === 'bigint') return `${base}.get(${segment}n)`
      if (typeof segment === 'boolean' || segment === null || segment === undefined) return `${base}.get(${String(segment)})`
      return undefined
    }
    default:
      if (typeof segment === 'number') return `${base}[${segment}]`
      if (typeof segment === 'symbol') {
        // Only well-known and registered symbols can be written again.
        const known = well_known_symbols.get(segment)
        if (known) return `${base}[Symbol.${known}]`
        const registered = Symbol.keyFor(segment)
        return registered === undefined ? undefined : `${base}[Symbol.for(${JSON.stringify(registered)})]`
      }
      return typeof segment === 'string' ? property_path(base, segment) : undefined
  }
}

// An open node's row in the `tree` style: its type, with a size where it has one.
/** @internal */
export function label(node: InspectNode): Token[] {
  const count = (size: number): Token[] => [
    { text: '(', type: 'open_bracket' }, { text: String(size), type: 'number' }, { text: ')', type: 'close_bracket' },
  ]
  switch (node.kind) {
    case 'string': return [{ text: 'String', type: 'class_name' }, ...count(node.text!.length)]
    case 'array': return [{ text: 'Array', type: 'class_name' }, ...(node.size === undefined ? [] : count(node.size))]
    case 'map': if (node.header.some(token => token.type === 'open_bracket')) return [...node.header]
    // falls through
    case 'typed-array': case 'set': return [...node.header, ...(node.size === undefined ? [] : count(node.size))]
    case 'map-entry': return []
    case 'object': return [
      ...node.header, { text: '{', type: 'open_bracket' }, { text: '…', type: 'ellipsis' }, { text: '}', type: 'close_bracket' },
    ]
    default: return node.header.length ? [...node.header] : [{ text: '…', type: 'ellipsis' }]
  }
}

/**
 * The range sizes a group of `length` children shows, largest first: none when
 * it fits in one range, else ranges of `chunkSize` times a power of ten, the
 * smallest that leaves at most 10 ranges, nesting down to `chunkSize`.
 */
export function chunkLevels(length: number, chunkSize = 100): number[] {
  const base = Math.max(1, Math.floor(chunkSize))
  if (length <= base) return []
  let size = base
  while (Math.ceil(length / size) > 10) size *= 10
  const levels: number[] = []
  for (; size >= base; size /= 10) levels.push(size)
  return levels
}

/**
 * The ranges, largest first, that hold the child at `position` in a group of
 * `length` children, as `[start, end]` pairs. A chunk's key is its group's id
 * plus `~start-end`, so it follows from the position alone.
 */
export function chunkPath(length: number, position: number, chunkSize = 100): [number, number][] {
  return chunkLevels(length, chunkSize).map(size => {
    const start = Math.floor(position / size) * size
    return [start, Math.min(length, start + size) - 1]
  })
}

/**
 * Lists the visible rows of `root` for the given display state. A closed node
 * is read only as far as its summary needs, so opening a node is what reads its
 * children. Repeated references expand in place; only cycles become `circular`
 * rows, whose `target` names an open ancestor. Strings open only when `open` holds them,
 * into `text` rows. With every other node open, the rows' text joined in order
 * is the `repr()` text without deduplication.
 */
export function visibleRows(root: InspectNode, state: RowState = {}): InspectRow[] {
  const expand_depth = state.expandDepth ?? 0
  const pages = state.pages ?? new Map<string, number>()
  const chunk_size = state.chunkSize ?? 100
  const text_page_size = state.textPageSize ?? 5000
  const budget = state.previewBudget ?? 80
  const summary_limit = state.summaryLimit ?? budget
  const tree = state.style === 'tree'
  const rows: InspectRow[] = []
  type Open = { identity: object | symbol | undefined; id: string }
  const colon: Token = { text: ':', type: 'field_colon' }

  // A child's key and colon. In the tree style, children without a key, such
  // as array elements, show their index.
  const key_of = (child: InspectChild): Token[] => {
    if (child.key !== undefined) return [...(Array.isArray(child.key) ? child.key : (child.key as InspectNode).summary(budget, true)), colon]
    if (!tree || child.value.kind === 'empty-slots') return []
    if (child.value.kind === 'map-entry') {
      const segment = child.value.segments[child.value.segments.length - 1]
      return [{ text: segment.type === 'entry' ? String(segment.index) : '', type: 'field_name' }, colon]
    }
    return [{ text: safe_string(child.value.path.at(-1)), type: 'field_name' }, colon]
  }

  const visit = (node: InspectNode, id: string, depth: number, key: Token[], ancestors: Open[], path_text: string | undefined) => {
    const expandable = is_expandable(node, budget)
    const starts_open = depth < expand_depth && node.kind !== 'string'
    const open = expandable && (state.open ? state.open.has(id) : starts_open)
    const row: InspectRow = {
      type: 'node', id, depth, key, tokens: [], kind: node.kind, path: node.path, segments: node.segments,
      size: node.size, expandable, open,
    }
    if (path_text !== undefined) row.pathText = path_text
    if (node.kind === 'circular') {
      for (let a = ancestors.length - 1; a >= 0; a--) {
        if (ancestors[a].identity === node.identity) { row.target = ancestors[a].id; break }
      }
    }
    rows.push(row)
    if (!open) {
      row.tokens = node.summary(summary_limit, true)
      return
    }

    if (node.kind === 'string') {
      // Quotes stay on the node and close rows; the text between them is paged by characters.
      row.tokens = tree ? label(node) : node.header.filter(token => token.type === 'open_quote')
      const text = node.text!
      const text_id = `${id}~line`
      const shown = safe_truncate(text, Math.max(1, pages.get(text_id) ?? 1) * text_page_size)
      text_lines(shown).forEach((line, n) => {
        rows.push({ type: 'text', id: `${text_id}:${n}`, depth: depth + 1, tokens: [{ text: line, type: 'string' }] })
      })
      if (shown.length < text.length) {
        rows.push({ type: 'more', id: `${text_id}+`, depth: depth + 1, group: text_id, shown: shown.length, unit: 'characters' })
      }
      if (!tree) rows.push({ type: 'close', id: `${id}~close:0`, depth, tokens: node.header.filter(token => token.type === 'close_quote') })
      return
    }

    // `line` collects tokens for the current line: the node row, then a close
    // row created when the first token after a group or inline value arrives.
    // The tree style shows a label instead and has no close rows.
    if (tree) row.tokens = node.kind === 'map-entry' || (node.kind === 'map' && label(node).length === node.header.length)
      ? node.summary(summary_limit, true)
      : label(node)
    let line: Token[] | undefined = row.tokens
    let closes = 0
    const append = (...tokens: Token[]) => {
      if (tree) return
      if (!line) {
        const close: InspectRow = { type: 'close', id: `${id}~close:${closes++}`, depth, tokens: [] }
        rows.push(close)
        line = close.tokens
      }
      line.push(...tokens)
    }
    const inner = [...ancestors, { identity: node.identity, id }]

    node.parts.forEach((part, p) => {
      if (part.type === 'tokens') {
        append(...part.tokens)
      } else if (part.type === 'value') {
        const last = part.node.segments[part.node.segments.length - 1]
        const entry_key: Token[] = node.kind === 'map-entry' && tree && (last.type === 'map-key' || last.type === 'map-value')
          ? [{ text: last.type === 'map-key' ? 'key' : 'value', type: 'field_name' }, colon]
          : []
        visit(part.node, id + segmentKey(last), depth + 1, entry_key, inner,
          node.kind === 'map-entry' && last.type === 'map-value' ? path_text : undefined)
        line = undefined
      } else {
        const group = part.group
        const open_token: Token = { text: group.open, type: 'open_bracket' }
        const close_token: Token = { text: group.close, type: 'close_bracket' }
        if (group.childAt(0) === undefined) {
          if (!group.hideWhenEmpty) append(open_token, close_token)
          return
        }
        append(open_token)
        line = undefined
        const group_id = `${id}~g${p}`
        const length = group.count()
        const levels = chunkLevels(length, chunk_size)
        // Children `start`..`end` at `level`: the children themselves, or
        // ranges of the next size, which read their children only when open.
        const show = (start: number, end: number, level: number, at: number) => {
          if (level === levels.length) {
            for (let i = start; i <= end; i++) {
              const child = group.childAt(i)!
              const segments = child.value.segments
              visit(child.value, id + segmentKey(segments[segments.length - 1]), at, key_of(child), inner, child_path_text(node, path_text, child))
              if (!tree && i < length - 1) {
                const last = rows.at(-1)!
                if (last.type !== 'more' && last.type !== 'chunk') last.tokens.push({ text: ',', type: 'comma' })
              }
            }
            return
          }
          const size = levels[level]
          for (let first = start; first <= end; first += size) {
            const last = Math.min(end, first + size - 1)
            const chunk_id = `${group_id}~${first}-${last}`
            const open = state.open?.has(chunk_id) ?? false
            rows.push({ type: 'chunk', id: chunk_id, depth: at, start: first, end: last, open })
            if (open) show(first, last, level + 1, at + 1)
          }
        }
        show(0, length - 1, 0, depth + 1)
        append(close_token)
      }
    })
  }

  visit(root, 'r', 0, [], [], '')
  return rows
}

/**
 * A visible row with its own visible rows nested under it, for a renderer whose
 * DOM nests, such as `Tree`. A node that can open has `children`, empty while
 * it's closed; other rows have none. An open node's final `close` row becomes
 * its `after`, a line below its children; a `close` row between two groups
 * stays among the children. The `tree` style has no `close` rows.
 */
export type InspectTreeRow = InspectRow & {
  children?: InspectTreeRow[]
  /** Tokens of the line below an open node's children, such as `]`. */
  after?: Token[]
}

/**
 * The rows of `visibleRows`, nested: each row is listed under the open node it
 * belongs to. Flattening the result in order, with each `after` as a `close`
 * row after its node's children, gives `visibleRows` again.
 */
export function visibleTree(root: InspectNode, state: RowState = {}): InspectTreeRow[] {
  const top: InspectTreeRow[] = []
  // The open nodes the walk is inside, outermost first.
  const stack: InspectTreeRow[] = []
  for (const flat of visibleRows(root, state)) {
    const row: InspectTreeRow = { ...flat }
    if ((row.type === 'node' && row.expandable) || row.type === 'chunk') row.children = []
    // A row belongs to the nearest open node above its depth. A `close` row
    // shares its node's depth, so it belongs to that node.
    while (stack.length) {
      const last = stack[stack.length - 1]
      if (last.depth < row.depth || (row.type === 'close' && last.depth === row.depth)) break
      stack.pop()
    }
    const parent = stack[stack.length - 1]
    ;(parent ? parent.children! : top).push(row)
    if ((row.type === 'node' || row.type === 'chunk') && row.open) stack.push(row)
  }
  const settle = (rows: InspectTreeRow[]) => {
    for (const row of rows) {
      if (!row.children) continue
      settle(row.children)
      const last = row.children[row.children.length - 1]
      if (last?.type === 'close') {
        row.children.pop()
        row.after = last.tokens
      }
    }
  }
  settle(top)
  return top
}

/** Ids of the open nodes and ranges `visibleRows` shows for this state, in order. */
export function openIds(root: InspectNode, state: RowState = {}): string[] {
  return visibleRows(root, state).filter(row => (row.type === 'node' || row.type === 'chunk') && row.open).map(row => row.id)
}

// A closed row that a deep open opens next: a node that can open, other than
// a string or a cycle, or a range.
type Openable = Extract<InspectRow, { type: 'node' | 'chunk' }>
const opens_deep = (row: InspectRow): row is Openable => (row.type === 'chunk' && !row.open)
  || (row.type === 'node' && !row.open && row.expandable && row.kind !== 'string' && row.kind !== 'circular')

// Whether `id` names a row inside the node `ancestor` names.
const inside = (id: string, ancestor: string) => id.startsWith(`${ancestor}/`) || id.startsWith(`${ancestor}~`)

// The children of a node: inline values and every group's children, in order.
function* child_nodes(node: InspectNode): Generator<InspectNode> {
  for (const part of node.parts) {
    if (part.type === 'value') yield part.node
    else if (part.type === 'group') {
      for (let i = 0; ; i++) {
        const child = part.group.childAt(i)
        if (!child) break
        yield child.value
      }
    }
  }
}

/**
 * The node a path key names, or `undefined` when no node has that key, as
 * after the value changes. Reads only the nodes along the way.
 */
export function nodeAt(root: InspectNode, key: string): InspectNode | undefined {
  let node = root
  let at = 'r'
  while (at !== key) {
    if (!key.startsWith(`${at}/`)) return undefined
    let next: InspectNode | undefined
    for (const child of child_nodes(node)) {
      const child_key = at + segmentKey(child.segments[child.segments.length - 1])
      if (key === child_key || key.startsWith(`${child_key}/`)) { next = child; at = child_key; break }
    }
    if (!next) return undefined
    node = next
  }
  return node
}

/**
 * Opens or closes a row and everything below it in an open set
 * (`RowState.open`), returning the new set. Opening works breadth-first, one
 * node at a time, and stops once the subtree shows `limit` rows, so one action
 * reads only what it shows; strings and cycles stay closed. Closing also closes
 * every open descendant, so reopening the row shows its children closed.
 */
export function deepOpen(root: InspectNode, state: RowState, id: string, open: boolean, limit = 500): Set<string> {
  const result = new Set([...(state.open ?? [])].filter(other => other !== id && !inside(other, id)))
  const node = nodeAt(root, id)
  if (!open || !node) return result
  result.add(id)
  if (node.kind === 'string') return result
  for (;;) {
    const rows = visibleRows(root, { ...state, open: result }).filter(row => inside(row.id, id))
    if (rows.length >= limit) break
    let next: Openable | undefined
    for (const row of rows) if (opens_deep(row) && (!next || row.depth < next.depth)) next = row
    if (!next) break
    result.add(next.id)
  }
  return result
}

/** Options for `inspectorExpandToPath`, matching the Inspector it's for. */
export type ExpandToPathOptions = {
  /** The Inspector's `chunkSize`. Defaults to 100. */
  chunkSize?: number
  /** List symbol-keyed properties, as the Inspector does. Defaults to true. */
  symbolKeys?: boolean
}

/**
 * `open` plus the key of every ancestor of `path`, including the ranges above
 * each child in a long group, so the row `path` names is shown. The row itself
 * keeps its own state. Keys are added, never removed. It reads only the nodes
 * along the path, and each group along it is counted, not rendered: revealing
 * child 50,000 opens no range above any other child.
 */
export function inspectorExpandToPath(value: unknown, open: readonly string[], path: InspectorPath,
  options: ExpandToPathOptions = {}): string[] {
  return expandToPath(describe(value, { symbol_keys: options.symbolKeys ?? true, map_entry_rows: true }), open, path, options.chunkSize)
}

/** `inspectorExpandToPath` on a described value, so the Inspector reuses the children it has read. @internal */
export function expandToPath(root: InspectNode, open: readonly string[], path: InspectorPath, chunkSize?: number): string[] {
  const result = [...open]
  const have = new Set(open)
  const add = (key: string) => { if (!have.has(key)) { result.push(key); have.add(key) } }
  let node: InspectNode | undefined = root
  let key = 'r'
  for (const segment of path) {
    add(key)
    const step = segmentKey(segment)
    let next: InspectNode | undefined
    node?.parts.forEach((part, p) => {
      if (next) return
      if (part.type === 'value') {
        if (segmentKey(part.node.segments[part.node.segments.length - 1]) === step) next = part.node
        return
      }
      if (part.type !== 'group') return
      for (let position = 0; ; position++) {
        const child = part.group.childAt(position)
        if (!child) return
        if (segmentKey(child.value.segments[child.value.segments.length - 1]) !== step) continue
        next = child.value
        for (const [start, end] of chunkPath(part.group.count(), position, chunkSize)) add(`${key}~g${p}~${start}-${end}`)
        return
      }
    })
    node = next
    key += step
  }
  return result
}

/** A text test for `inspectorSearch`: a regular expression, or a function. */
export type InspectorMatcher = Exclude<TreeSearchQuery, string | null>

/** One row `inspectorSearch` found, and the field that matched. */
export type InspectorMatch = {
  path: InspectorPath
  /** `key` when the row's key matched, which wins when both do; else `value`. */
  field: 'key' | 'value'
}

/** Options for `inspectorSearch`, matching the Inspector it's for. */
export type SearchOptions = {
  /** The Inspector's `numericBase`, which changes a number's text. */
  numericBase?: Options['numeric_base']
  /** List symbol-keyed properties, as the Inspector does. Defaults to true. */
  symbolKeys?: boolean
}

/** A matcher as a test. A RegExp's `g` and `y` flags are dropped, so repeated tests don't depend on `lastIndex`. @internal */
export function matcherTest(matcher: InspectorMatcher): (text: string) => boolean {
  if (typeof matcher === 'function') return matcher
  const regex = new RegExp(matcher.source, matcher.flags.replace(/[gy]/g, ''))
  return text => regex.test(text)
}

const tokens_text = (tokens: readonly Token[]) => tokens.map(token => token.text).join('')

/**
 * The text search reads for a row's key: the key without its colon and
 * brackets. A key that is itself a container, as an object Map key, shows a
 * preview, so it has none. Array indices aren't keys. @internal
 */
export function keyText(child: InspectChild): string | undefined {
  if (child.keyText !== undefined) return child.keyText
  if (child.key === undefined) return undefined
  if (Array.isArray(child.key)) {
    return tokens_text(child.key.filter(token => token.type !== 'open_bracket' && token.type !== 'close_bracket'))
  }
  const key = child.key as InspectNode
  if (!LEAF_KINDS.has(key.kind)) return undefined
  return key.kind === 'string' ? key.text : tokens_text(key.summary(80))
}

/**
 * The text search reads for a row's own value: a string's raw text, a
 * primitive's text, or a container's type, as its open row shows it, such as
 * `Array(3)`. Never a container's preview of its children. @internal
 */
export function valueText(node: InspectNode): string | undefined {
  if (node.kind === 'empty-slots' || node.kind === 'map-entry') return undefined
  if (node.kind === 'string') return node.text
  return tokens_text(LEAF_KINDS.has(node.kind) ? node.summary(80) : label(node))
}

/**
 * Searches a described value from `root`, as `inspectorSearch` does. Children
 * are cached in their groups, so the Inspector shares them with its rows. @internal
 */
export function searchNodes(root: InspectNode, matcher: InspectorMatcher): InspectorMatch[] {
  const test = matcherTest(matcher)
  const matches: InspectorMatch[] = []
  // A cycle comes back as a `circular` node, which has no children, so the
  // walk ends there; a repeated reference is searched where each copy
  // appears, as the rows show it.
  const visit = (node: InspectNode, key: string | undefined) => {
    if (key !== undefined && test(key)) matches.push({ path: node.segments, field: 'key' })
    else {
      const text = valueText(node)
      if (text !== undefined && test(text)) matches.push({ path: node.segments, field: 'value' })
    }
    if (LEAF_KINDS.has(node.kind)) return
    for (const part of node.parts) {
      if (part.type === 'value') visit(part.node, undefined)
      else if (part.type === 'group') {
        for (let i = 0; ; i++) {
          const child = part.group.childAt(i)
          if (!child) break
          visit(child.value, keyText(child))
        }
      }
    }
  }
  visit(root, undefined)
  return matches
}

/**
 * Finds the rows of `value` whose key or own value matches, in the order the
 * Inspector shows them fully open. A row matches once: on its key when the key
 * matches, else on its value. A key is a property name, a Map key, or a
 * symbol; array indices aren't keys. A value is a primitive's text, a string's
 * raw text, or a container's type, such as `Array(3)` or `Map(2)`, never its
 * preview of its children, so each match is the row it names. A cycle ends the
 * search down its branch, and a repeated reference is searched where each copy
 * appears. Getters are never called. Open a match's ancestors with
 * `inspectorExpandToPath`.
 */
export function inspectorSearch(value: unknown, matcher: InspectorMatcher, options: SearchOptions = {}): InspectorMatch[] {
  return searchNodes(describe(value, { numeric_base: options.numericBase, symbol_keys: options.symbolKeys ?? true, iterator_labels: true, map_entry_rows: true, function_labels: true, cycle_labels: true }), matcher)
}

/**
 * The text to copy for a node: a string's raw text, or the full `repr()` text
 * of anything else. Undefined for nodes with no value of their own: cycles,
 * empty slots, and reads that failed.
 */
export function copyText(node: InspectNode, options: Options = {}): string | undefined {
  if (node.kind === 'circular' || node.kind === 'empty-slots' || node.kind === 'inaccessible') return undefined
  if (node.kind === 'string') return node.text
  // A function copies its source, from the engine's native toString, so its own toString never runs.
  if (node.kind === 'function') {
    const source = guard(() => function_to_string.call(Node.primitive(node)))
    return typeof source === 'string' ? source : undefined
  }
  return serialize(node, { ...options, char_limit: Infinity }).map(token => token.text).join('')
}

/**
 * A node as compact JSON, or the reason it can't be: the first part that isn't
 * plain data, and its path from the node. Reads only through the node, so
 * getters and Proxy traps stay contained as they do in the Inspector.
 */
export function jsonText(node: InspectNode): { text: string } | { reason: string } {
  let reason: string | undefined
  const fail = (what: string, path: string) => {
    reason = path ? `Not JSON: contains ${what} at ${path}` : `Not JSON: ${what}`
    return undefined
  }
  const key_path = (base: string, key: string) =>
    /^[A-Za-z_$][\w$]*$/.test(key) ? `${base}.${key}` : `${base}[${JSON.stringify(key)}]`
  const each = (group: InspectGroup, visit: (child: InspectChild, i: number) => boolean) => {
    for (let i = 0, child = group.childAt(0); child; child = group.childAt(++i)) if (!visit(child, i)) return false
    return true
  }

  const write = (node: InspectNode, path: string): string | undefined => {
    switch (node.kind) {
      case 'string': return JSON.stringify(node.text)
      case 'boolean': case 'null': return JSON.stringify(Node.primitive(node))
      case 'number': {
        const value = Node.primitive(node) as number
        return Number.isFinite(value) ? JSON.stringify(value) : fail(String(value), path)
      }
      case 'array': {
        const [elements, extra] = node.groups
        if (extra?.childAt(0)) return fail('named properties on an array', path)
        const out: string[] = []
        const ok = each(elements, (child, i) => {
          const text = write(child.value, `${path}[${i}]`)
          if (text !== undefined) out.push(text)
          return text !== undefined
        })
        return ok ? `[${out.join(',')}]` : undefined
      }
      case 'object': {
        if (node.header.length) return fail(`a ${node.header.map(token => token.text).join('')} instance`, path)
        const out: string[] = []
        const ok = each(node.groups[0], child => {
          // A failed read of the object's own keys has no key of its own.
          const key = child.value.path.at(-1)
          if (child.key === undefined || typeof key !== 'string') return fail(KIND_NAMES.inaccessible, path) !== undefined
          const text = write(child.value, key_path(path, key))
          if (text !== undefined) out.push(`${JSON.stringify(key)}:${text}`)
          return text !== undefined
        })
        return ok ? `{${out.join(',')}}` : undefined
      }
      default: return fail(KIND_NAMES[node.kind], path)
    }
  }

  const text = write(node, '')
  return text === undefined ? { reason: reason! } : { text }
}

const KIND_NAMES: Record<NodeKind, string> = {
  'string': 'a string', 'number': 'a number', 'bigint': 'a bigint', 'boolean': 'a boolean', 'null': 'null',
  'undefined': 'undefined', 'symbol': 'a symbol', 'array': 'an array', 'typed-array': 'a typed array', 'set': 'a Set',
  'map': 'a Map', 'map-entry': 'a Map entry', 'object': 'an object', 'date': 'a Date', 'error': 'an error', 'regexp': 'a RegExp',
  'function': 'a function', 'blob': 'a Blob', 'custom': 'a custom type', 'circular': 'a circular reference',
  'empty-slots': 'an empty slot', 'inaccessible': 'an unreadable value',
}

export const DEFAULT_REPR_CHAR_LIMIT = 50000

/** Returns a string representation of any JavaScript value, within `options.char_limit` characters. */
export function repr(value: unknown, options: Options = {}): string {
  const limited = { ...options, char_limit: options.char_limit ?? DEFAULT_REPR_CHAR_LIMIT }
  return serialize(describe(value, limited), limited).map(token => token.text).join('')
}
