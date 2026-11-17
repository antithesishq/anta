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
 * @internal Not public API until it is deliberately exported.
 * @module
 */

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
}

type ReferenceInfo = {
  circular: boolean // still inside the definition of this reference
  path: string[]
}

export type SpanType = 'field_name' | 'field_colon' | 'open_bracket' | 'close_bracket' | 'comma' |
  'string' | 'number' | 'boolean' | 'symbol' | 'bigint' | 'undefined' | 'null' |
  'error_class_name' | 'class_name' | 'error_message' | 'reference' | 'reference_path' |
  'function' | 'function_name' | 'open_slash' | 'close_slash' | 'regexp' | 'regexp_flags' | 'legacy_repr' |
  'empty_slot' | 'open_quote' | 'close_quote' | 'inaccessible' | 'ellipsis'

const numeric_bases = {
  binary: { prefix: '0b', number: 0b10 },
  octal: { prefix: '0o', number: 0o10 },
  decimal: { prefix: '', number: 10 },
  hex: { prefix: '0x', number: 0x10 },
}

// The standard does not expose %TypedArray%.
const TypedArray = Object.getPrototypeOf(Int8Array)

/**
 * Method key a value implements to describe itself, receiving a
 * `CustomRepresentationVisitor`. Registered with `Symbol.for`, so copies of the
 * library loaded separately agree on it.
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

/** What an implementation of `[to_repr]` receives. */
export interface CustomRepresentationVisitor {
  span(text: string, type: SpanType): void
  visit(it: unknown): void
  constructor_call(name: string, ...params: unknown[]): void
  class_object_like(class_name: string, members: object): void
  iterable_like(class_name: string, iter: Iterable<unknown>): void
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
  | 'custom' | 'circular' | 'empty-slots' | 'inaccessible'

/**
 * One entry in a group. `key` is tokens for a property or string key, or a node for a non-string Map key.
 * `stack` marks an error's stack, which the string output leaves out when `error_stacks` is false.
 */
export type InspectChild = { key?: Token[] | InspectNode; value: InspectNode; stack?: true }

/** A node's content in display order. Custom types can interleave tokens, inline values, and groups. */
export type InspectPart =
  | { type: 'tokens'; tokens: Token[] }
  | { type: 'group'; group: InspectGroup }
  | { type: 'value'; node: InspectNode }

/** A node in the lazy value tree. Reading `kind`, `parts`, `header`, `groups` or `size` resolves the node. */
export interface InspectNode {
  /** Path from the root. Segments are property names, indices, or raw Map keys. */
  readonly path: readonly unknown[]
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
  /** One-line text of this node within `budget` characters, as tokens. */
  summary(budget: number): Token[]
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
  readonly identity: object | symbol | undefined
  #value: unknown
  #context: Context
  #resolved: Resolved | undefined

  constructor(value: unknown, path: readonly unknown[], context: Context, resolved?: Resolved) {
    this.#value = value
    this.path = path
    this.#context = context
    this.#resolved = resolved
    this.identity = (typeof value === 'object' && value !== null) || typeof value === 'function' || typeof value === 'symbol'
      ? value as object | symbol
      : undefined
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
  summary(budget: number): Token[] {
    return serialize(this, { ...this.#context.options, char_limit: budget, error_stacks: false })
  }

  // Context for this node's children: this node joins the ancestor chain.
  #inner(): Context {
    const identity = this.identity
    if (typeof identity !== 'object' && typeof identity !== 'function') return this.#context
    return { options: this.#context.options, ancestors: { identity, path: this.path, parent: this.#context.ancestors } }
  }

  #child(value: unknown, path: readonly unknown[]): InspectNode {
    const context = this.#inner()
    if ((typeof value === 'object' && value !== null) || typeof value === 'function') {
      for (let a = context.ancestors; a; a = a.parent) {
        if (a.identity === value) {
          return new Node(value, path, context, {
            kind: 'circular',
            target: a.path,
            parts: [{ type: 'tokens', tokens: [
              { text: 'circular_ref', type: 'reference' },
              { text: '[', type: 'open_bracket' },
              { text: a.path.map(p => format_key_name(safe_string(p))).join('.'), type: 'reference_path' },
              { text: ']', type: 'close_bracket' },
            ] }],
          })
        }
      }
    }
    return new Node(value, path, context)
  }

  #leaf(kind: NodeKind, path: readonly unknown[], tokens: Token[]): InspectNode {
    return new Node(undefined, path, this.#context, { kind, parts: [{ type: 'tokens', tokens }] })
  }
  #inaccessible(path: readonly unknown[]) {
    return this.#leaf('inaccessible', path, [{ text: INACCESSIBLE_TEXT, type: 'inaccessible' }])
  }

  // Children with only values, from any iterable (Set, typed array, to_repr lists).
  *#elements(iterable: Iterable<unknown>): Generator<InspectChild> {
    let i = 0
    for (const element of guarded(iterable)) {
      if (element === INACCESSIBLE) { yield { value: this.#inaccessible([...this.path, i]) }; return }
      yield { value: this.#child(element, [...this.path, i]) }
      i++
    }
  }

  *#array_elements(arr: unknown[]): Generator<InspectChild> {
    let last = -1
    for (const key of guarded(keys_in(arr))) {
      if (key === INACCESSIBLE) { yield { value: this.#inaccessible([...this.path, last + 1]) }; return }
      if (!/^\d+$/.test(key)) break // numeric array keys come before other keys
      const index = +key
      const skipped = index - last - 1
      if (skipped > 0) yield { value: this.#leaf('empty-slots', [...this.path, last + 1], [{ text: empty_slots_text(skipped), type: 'empty_slot' }]) }
      const element = guard(() => arr[index])
      yield { value: element === INACCESSIBLE ? this.#inaccessible([...this.path, index]) : this.#child(element, [...this.path, index]) }
      last = index
    }
    const length = guard(() => arr.length)
    if (length === INACCESSIBLE || last === length - 1) return
    yield { value: this.#leaf('empty-slots', [...this.path, last + 1], [{ text: empty_slots_text(length - 1 - last), type: 'empty_slot' }]) }
  }

  // Properties as keyed children. `skip_indices` leaves out an array's elements.
  // `listed` collects the names yielded.
  *#properties(it: object, format_keys: boolean, skip_indices = false, listed?: Set<string>): Generator<InspectChild> {
    for (const entry of data_entries(it)) {
      if (entry === INACCESSIBLE) { yield { value: this.#inaccessible(this.path) }; return }
      const [name, value] = entry
      if (skip_indices && /^\d+$/.test(name)) continue
      listed?.add(name)
      yield {
        key: [{ text: format_keys ? format_key_name(name) : name, type: 'field_name' }],
        value: this.#child(value, [...this.path, name]),
      }
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
      if (detail === INACCESSIBLE) { yield { key, value: this.#inaccessible([...this.path, name]) }; return }
      if (detail) {
        const child: InspectChild = { key, value: this.#child(detail.value, [...this.path, name]) }
        if (name === 'stack') child.stack = true
        yield child
      }
    }
  }

  *#map_entries(map: Map<unknown, unknown>): Generator<InspectChild> {
    for (const entry of guarded(map)) {
      if (entry === INACCESSIBLE) { yield { value: this.#inaccessible(this.path) }; return }
      const [key, value] = entry
      const path = [...this.path, key]
      yield {
        key: typeof key === 'string'
          ? [{ text: '"', type: 'open_bracket' }, { text: key, type: 'field_name' }, { text: '"', type: 'close_bracket' }]
          : this.#child(key, path),
        value: this.#child(value, path),
      }
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
        const known = well_known_symbols.get(value)
        if (known) {
          t('Symbol', 'class_name'); t('.', 'class_name'); t(known, 'field_name')
        } else {
          t(Symbol.keyFor(value) !== undefined ? 'Symbol.for' : 'Symbol', 'class_name')
          t('(', 'open_bracket')
          const text = JSON.stringify(String(value).slice(7, -1)).slice(1, -1) // drop `Symbol(` and `)`
          if (options.unquoted_strings) t(text, 'string')
          else { t('"', 'open_quote'); t(text, 'string'); t('"', 'close_quote') }
          t(')', 'close_bracket')
        }
        return { kind: 'symbol', parts }
      }
      case 'function': {
        const custom = guard(() => to_repr in value && typeof (value as unknown as Record<symbol, unknown>)[to_repr] === 'function')
        if (custom === INACCESSIBLE) { inaccessible(); return { kind: 'inaccessible', parts } }
        if (custom) return this.#custom(value as unknown as ToRepr)
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
            parts.push(this.#group('{', '}', () => this.#elements(set)), this.#keyable(set))
            const size = guard(() => set.size)
            return { kind: 'set', parts, size: size === INACCESSIBLE ? undefined : size }
          }
          case 'map': {
            const map = value as Map<unknown, unknown>
            t('Map', 'class_name')
            parts.push(this.#group('{', '}', () => this.#map_entries(map)), this.#keyable(map))
            const size = guard(() => map.size)
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
      visit(it) { parts.push({ type: 'value', node: node.#child(it, node.path) }) },
      constructor_call(name, ...params) {
        tokens().push({ text: name, type: 'class_name' })
        parts.push(node.#group('(', ')', () => node.#elements(params)))
      },
      class_object_like(name, members) {
        tokens().push({ text: name, type: 'class_name' })
        parts.push(node.#group('{', '}', () => node.#properties(members, false)))
      },
      iterable_like(name, iter) {
        tokens().push({ text: name, type: 'class_name' })
        parts.push(node.#group('[', ']', () => node.#elements(iter)))
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
  return new Node(value, [], { options, ancestors: undefined })
}

/**
 * Renders a node as tokens within `options.char_limit` characters. Repeated
 * objects and symbols print as `ref[path]` and ancestors as `circular_ref[path]`,
 * labelled by first appearance in walk order. Children are pulled one at a time
 * and the walk stops at the limit, so nothing past the limit is read.
 */
export function serialize(root: InspectNode, options: Options = {}): Token[] {
  const out: Token[] = []
  let remaining = options.char_limit ?? Infinity
  let stop = false
  const refs = new WeakMap<object, ReferenceInfo>()
  const symbol_refs = new Map<symbol, ReferenceInfo>()
  const deduplicate = options.deduplicate_references !== false

  const emit = (text: string, type: SpanType) => {
    if (!text || stop) return
    remaining -= text.length
    if (remaining < 3) {
      out.push({ text: safe_truncate(text, remaining + text.length - 3), type })
      out.push({ text: '...', type: 'ellipsis' })
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
        emit(seen.circular ? 'circular_ref' : 'ref', 'reference')
        emit('[', 'open_bracket')
        emit(seen.path.map(format_key_name).join('.'), 'reference_path')
        emit(']', 'close_bracket')
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
 * One visible line of the tree. Row ids are strings that follow the tree's
 * structure, so an ancestor's id is a prefix of its descendants' ids
 * (`r`, `r:1.0`, `r:1.0:1.2`), and they can travel in serializable events.
 *
 * - `node`: a value, open or closed. A closed node shows its summary; an open
 *   node shows its header and the opening bracket of its first group.
 * - `close`: closing brackets of an open node, and any tokens between its groups.
 * - `text`: one line of an open string, unescaped apart from control characters.
 * - `more`: the end of a group with more children, or a string with more text, than is shown.
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
    /** Element count of an array, typed array, Set, or Map. */
    size: number | undefined
    expandable: boolean
    open: boolean
    /** For a circular node, the id of the ancestor row it refers to. */
    target?: string
  }
  | { type: 'close'; id: string; depth: number; tokens: Token[] }
  | { type: 'text'; id: string; depth: number; tokens: Token[] }
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
  /** Nodes shallower than this depth start open. Defaults to 0. */
  expandDepth?: number
  /** Ids of nodes whose open state is the opposite of their default. Strings start closed at any depth. */
  toggled?: ReadonlySet<string>
  /** Pages shown per group or string, keyed by a `more` row's `group`. Each defaults to one page. */
  pages?: ReadonlyMap<string, number>
  /** Children per page. Defaults to 100. */
  pageSize?: number
  /** Characters per page of an open string. Defaults to 5,000. */
  textPageSize?: number
  /** Characters in a closed node's summary. Defaults to 80. */
  previewBudget?: number
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

// An open node's row in the `tree` style: its type, with a size where it has one.
function label(node: InspectNode): Token[] {
  const count = (size: number): Token[] => [
    { text: '(', type: 'open_bracket' }, { text: String(size), type: 'number' }, { text: ')', type: 'close_bracket' },
  ]
  switch (node.kind) {
    case 'string': return [{ text: 'String', type: 'class_name' }, ...count(node.text!.length)]
    case 'array': return [{ text: 'Array', type: 'class_name' }, ...(node.size === undefined ? [] : count(node.size))]
    case 'typed-array': case 'set': case 'map': return [...node.header, ...(node.size === undefined ? [] : count(node.size))]
    case 'object': return [
      ...node.header, { text: '{', type: 'open_bracket' }, { text: '…', type: 'ellipsis' }, { text: '}', type: 'close_bracket' },
    ]
    default: return node.header.length ? [...node.header] : [{ text: '…', type: 'ellipsis' }]
  }
}

/**
 * Lists the visible rows of `root` for the given display state. A closed node
 * is read only as far as its summary needs, so opening a node is what reads its
 * children. Repeated references expand in place; only cycles become `circular`
 * rows, whose `target` names an open ancestor. Strings open only when toggled,
 * into `text` rows. With every other node open, the rows' text joined in order
 * is the `repr()` text without deduplication.
 */
export function visibleRows(root: InspectNode, state: RowState = {}): InspectRow[] {
  const expand_depth = state.expandDepth ?? 0
  const toggled = state.toggled ?? new Set<string>()
  const pages = state.pages ?? new Map<string, number>()
  const page_size = state.pageSize ?? 100
  const text_page_size = state.textPageSize ?? 5000
  const budget = state.previewBudget ?? 80
  const tree = state.style === 'tree'
  const rows: InspectRow[] = []
  type Open = { identity: object | symbol | undefined; id: string }
  const colon: Token = { text: ':', type: 'field_colon' }

  // A child's key and colon. In the tree style, children without a key, such
  // as array elements, show their index.
  const key_of = (child: InspectChild): Token[] => {
    if (child.key !== undefined) return [...(Array.isArray(child.key) ? child.key : (child.key as InspectNode).summary(budget)), colon]
    if (!tree || child.value.kind === 'empty-slots') return []
    return [{ text: safe_string(child.value.path.at(-1)), type: 'field_name' }, colon]
  }

  const visit = (node: InspectNode, id: string, depth: number, key: Token[], ancestors: Open[]) => {
    const expandable = is_expandable(node, budget)
    const starts_open = depth < expand_depth && node.kind !== 'string'
    const open = expandable && (starts_open !== toggled.has(id))
    const row: InspectRow = {
      type: 'node', id, depth, key, tokens: [], kind: node.kind, path: node.path, size: node.size, expandable, open,
    }
    if (node.kind === 'circular') {
      for (let a = ancestors.length - 1; a >= 0; a--) {
        if (ancestors[a].identity === node.identity) { row.target = ancestors[a].id; break }
      }
    }
    rows.push(row)
    if (!open) {
      row.tokens = node.summary(budget)
      return
    }

    if (node.kind === 'string') {
      // Quotes stay on the node and close rows; the text between them is paged by characters.
      row.tokens = tree ? label(node) : node.header.filter(token => token.type === 'open_quote')
      const text = node.text!
      const text_id = `${id}:t`
      const shown = safe_truncate(text, Math.max(1, pages.get(text_id) ?? 1) * text_page_size)
      text_lines(shown).forEach((line, n) => {
        rows.push({ type: 'text', id: `${text_id}.${n}`, depth: depth + 1, tokens: [{ text: line, type: 'string' }] })
      })
      if (shown.length < text.length) {
        rows.push({ type: 'more', id: `${text_id}+`, depth: depth + 1, group: text_id, shown: shown.length, unit: 'characters' })
      }
      if (!tree) rows.push({ type: 'close', id: `${id}>0`, depth, tokens: node.header.filter(token => token.type === 'close_quote') })
      return
    }

    // `line` collects tokens for the current line: the node row, then a close
    // row created when the first token after a group or inline value arrives.
    // The tree style shows a label instead and has no close rows.
    if (tree) row.tokens = label(node)
    let line: Token[] | undefined = row.tokens
    let closes = 0
    const append = (...tokens: Token[]) => {
      if (tree) return
      if (!line) {
        const close: InspectRow = { type: 'close', id: `${id}>${closes++}`, depth, tokens: [] }
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
        visit(part.node, `${id}:${p}`, depth + 1, [], inner)
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
        const group_id = `${id}:${p}`
        const shown = Math.max(1, pages.get(group_id) ?? 1) * page_size
        const { items, more } = group.children(0, shown)
        items.forEach((child, i) => {
          visit(child.value, `${group_id}.${i}`, depth + 1, key_of(child), inner)
          if (!tree && (i < items.length - 1 || more)) {
            const last = rows.at(-1)!
            if (last.type !== 'more') last.tokens.push({ text: ',', type: 'comma' })
          }
        })
        if (more) rows.push({ type: 'more', id: `${group_id}+`, depth: depth + 1, group: group_id, shown: items.length, unit: 'children' })
        append(close_token)
      }
    })
  }

  visit(root, 'r', 0, [], [])
  return rows
}

export const DEFAULT_REPR_CHAR_LIMIT = 50000

/** Returns a string representation of any JavaScript value, within `options.char_limit` characters. */
export function repr(value: unknown, options: Options = {}): string {
  const limited = { ...options, char_limit: options.char_limit ?? DEFAULT_REPR_CHAR_LIMIT }
  return serialize(describe(value, limited), limited).map(token => token.text).join('')
}
