/**
 * Value representation core for the Inspector: walks any JavaScript value and
 * emits a flat stream of typed tokens through `span(text, type)`. Subclasses
 * decide what tokens become; `StringRepresentationVisitor` joins them into a
 * string within a character budget. No DOM or framework imports.
 *
 * This is a mechanical port of the Antithesis notebook's `repr()` core. Its
 * behavior, including known bugs, is kept on purpose so the port can be
 * checked against the original before the core is refactored.
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
}

type ReferenceInfo = {
  circular: boolean // still inside the definition of this reference
  path: string[]
}

export type SpanType = 'field_name' | 'field_colon' | 'open_bracket' | 'close_bracket' | 'comma' |
  'string' | 'number' | 'boolean' | 'symbol' | 'bigint' | 'undefined' | 'null' |
  'error_class_name' | 'class_name' | 'error_message' | 'reference' | 'reference_path' |
  'function' | 'function_name' | 'open_slash' | 'close_slash' | 'regexp' | 'regexp_flags' | 'legacy_repr' |
  'empty_slot' | 'open_quote' | 'close_quote'

const numeric_bases = {
  binary: { prefix: '0b', number: 0b10 },
  octal: { prefix: '0o', number: 0o10 },
  decimal: { prefix: '', number: 10 },
  hex: { prefix: '0x', number: 0x10 },
}

// The standard does not expose %TypedArray%.
const TypedArray = Object.getPrototypeOf(Int8Array)

export const to_repr = Symbol('to_repr')

type RepresentationVisitorState = {
  char_limit: number
  stop: boolean
  refs: WeakMap<object, ReferenceInfo>
  symbol_refs: Map<symbol, ReferenceInfo>
  repeated_reference_count: number
  path: unknown[]
  options: Options
}

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

/** Well-known symbols, such as `Symbol.iterator`, mapped to their property names. @internal */
export const well_known_symbols: Map<symbol, string> = new Map(
  Object.getOwnPropertyNames(Symbol)
    .filter(name => typeof (Symbol as unknown as Record<string, unknown>)[name] === 'symbol')
    .map(name => [(Symbol as unknown as Record<string, symbol>)[name], name]),
)

function constructor_name_if_any(obj: object) {
  if (!obj.constructor || obj.constructor.name === 'Object') return ''
  return obj.constructor.name
}
function is_pojo(obj: object) {
  if (!obj.constructor) return false
  return obj.constructor.name === 'Object'
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

export abstract class RepresentationVisitor implements CustomRepresentationVisitor {
  state: RepresentationVisitorState
  constructor(parent: RepresentationVisitor | undefined, options: Options) {
    if (parent)
      this.state = parent.state
    else
      this.state = {
        char_limit: options.char_limit === undefined ? Infinity : options.char_limit,
        stop: false,
        refs: new WeakMap<object, ReferenceInfo>(),
        symbol_refs: new Map<symbol, ReferenceInfo>(),
        repeated_reference_count: 0,
        path: [],
        options,
      }
  }

  /** Adds `text` to the end of the representation. */
  abstract span(text: string, type: SpanType): void

  constructor_call(name: string, ...params: unknown[]): void {
    this.set_like(params, name, '(', ')')
  }
  class_object_like(class_name: string, members: object): void {
    this.object_like(this.#iter(members), class_name, '{', '}')
  }
  iterable_like(class_name: string, iter: Iterable<unknown>) {
    this.set_like(iter, class_name, '[', ']')
  }

  set_like(value: Iterable<unknown>, class_name: string, open: string, close: string) {
    this.span(class_name, 'class_name')
    this.span(open, 'open_bracket')
    this.visit_set_like(value)
    this.span(close, 'close_bracket')
  }
  // Array-like or set-like; sparseness is handled by the caller.
  array_like_child(index: number): RepresentationVisitor {
    if (index)
      this.span(',', 'comma')
    return this // a string needs no nested visitors
  }

  object_like(value: Iterable<[unknown, unknown]>, class_name: string, open: string, close: string, is_pojo = false) {
    this.span(class_name, 'class_name')
    this.span(open, 'open_bracket')
    this.visit_object_like(value, is_pojo)
    this.span(close, 'close_bracket')
  }
  object_like_child(index: number, field: unknown, open_bracket: string, close_bracket: string, str_open_bracket: string | undefined, str_close_bracket: string | undefined, is_pojo = false): RepresentationVisitor {
    const ch = this.array_like_child(index)
    if (typeof field === 'string') { // #iter ignores symbol keys
      if (str_open_bracket) ch.span(str_open_bracket, 'open_bracket')
      ch.span(is_pojo ? this.format_key_name(field) : field, 'field_name')
      if (str_close_bracket) ch.span(str_close_bracket, 'close_bracket')
    } else {
      if (open_bracket) ch.span(open_bracket, 'open_bracket')
      ch.visit(field)
      if (close_bracket) ch.span(close_bracket, 'close_bracket')
    }
    ch.span(':', 'field_colon')
    return ch
  }

  string(str: string) {
    if (this.state.options.unquoted_strings) {
      this.span(JSON.stringify(str).slice(0, -1).substring(1), 'string')
    } else {
      this.span('"', 'open_quote')
      this.span(JSON.stringify(str).slice(0, -1).substring(1), 'string')
      this.span('"', 'close_quote')
    }
  }
  number(num: number) {
    if (Number.isNaN(num)) { this.span('NaN', 'number'); return }
    if (num === Infinity) { this.span('Infinity', 'number'); return }
    if (num === -Infinity) { this.span('-Infinity', 'number'); return }

    let str = Object.is(num, -0) ? '-0' : num.toString(numeric_bases[this.state.options.numeric_base ?? 'decimal'].number)
    let sign = ''

    if (str[0] === '-') {
      str = str.slice(1)
      sign = '-'
    }

    this.span(sign + numeric_bases[this.state.options.numeric_base ?? 'decimal'].prefix + str.toUpperCase(), 'number')
  }
  boolean(bool: boolean) { this.span(String(bool), 'boolean') }
  symbol(sym: symbol) {
    if (well_known_symbols.has(sym)) {
      this.span('Symbol', 'class_name')
      this.span('.', 'class_name')
      this.span(well_known_symbols.get(sym)!, 'field_name')
      return
    }
    this.constructor_call(Symbol.keyFor(sym) !== undefined ? 'Symbol.for' : 'Symbol', String(sym).slice(7, -1)) // drop `Symbol(` and `)`
  }
  bigint(num: bigint) {
    if (!this.state.options.numeric_base || this.state.options.numeric_base === 'decimal') return this.span(`${num}n`, 'bigint')

    this.span(numeric_bases[this.state.options.numeric_base].prefix + num.toString(numeric_bases[this.state.options.numeric_base].number) + 'n', 'bigint')
  }
  undefined() { this.span('undefined', 'undefined') }
  null() { this.span('null', 'null') }

  error(error: Error) {
    this.span(error.constructor.name, 'error_class_name')
    this.span('(', 'open_bracket')
    this.span(JSON.stringify(error.message), 'error_message')
    this.span(')', 'close_bracket')
    this.keyable(error)
  }

  /** A value seen before: "circular" when it is an ancestor of the current node, otherwise "repeated". */
  reference(_ref: object | symbol, is_circular: boolean, path: string[]) {
    if (is_circular)
      this.span('circular_ref', 'reference')
    else
      this.span('ref', 'reference')
    this.span('[', 'open_bracket')
    this.span(path.map(this.format_key_name).join('.'), 'reference_path')
    this.span(']', 'close_bracket')
  }
  format_key_name(key: string) {
    if (/^[A-Za-z0-9_]+$/.test(key)) return key
    return `"${key}"`
  }

  function(func: Function) {
    this.span('<', 'open_bracket')
    if (func.name) {
      this.span('function ', 'function')
      this.span('display_name' in func && typeof func.display_name === 'string' ? func.display_name : func.name, 'function_name')
    } else {
      this.span('anonymous function', 'function')
    }
    this.span('>', 'close_bracket')
    this.keyable(func)
  }

  array(arr: unknown[]) {
    this.span('[', 'open_bracket')
    this.visit_array(arr)
    this.span(']', 'close_bracket')
    this.keyable(arr, true)
  }
  typed_array(arr: ArrayLike<unknown> & Iterable<unknown>) {
    this.set_like(arr, arr.constructor.name, '[', ']')
    this.keyable(arr, true)
  }
  set(set: Set<unknown>) {
    this.set_like(set, 'Set', '{', '}')
    this.keyable(set)
  }
  map(map: Map<unknown, unknown>) {
    this.object_like(map, 'Map', '{', '}')
    this.keyable(map)
  }
  regexp(re: RegExp) {
    this.span('/', 'open_slash')
    this.span(re.source, 'regexp')
    this.span('/', 'close_slash')
    this.span(re.flags, 'regexp_flags')
    this.keyable(re)
  }

  // Like object_like, for values that don't usually have user-defined keys (arrays, sets, functions).
  keyable(it: object, array_like = false) {
    let visited_any = false
    let i = 0
    for (const [name, value] of this.#iter(it)) {
      if (array_like && /^\d+$/.test(name)) continue

      if (!visited_any) {
        visited_any = true
        this.span('{', 'open_bracket')
      }

      this.state.path.push(name)
      this.object_like_child(i++, name, '[', ']', '', '', true).visit(value)
      if (this.state.stop) return
      this.state.path.pop()
    }
    if (visited_any) this.span('}', 'close_bracket')
  }

  /** `is_pojo` marks a plain object. */
  object(object: object, iter: Iterable<[string, unknown]>, is_pojo = false) {
    return this.object_like(iter, constructor_name_if_any(object), '{', '}', is_pojo)
  }

  #iter(it: object): Iterable<[string, unknown]> {
    // Lazy (for...in) so truncation stops the walk early. Yields only data
    // properties so no user code runs, skips symbol keys, and includes
    // enumerable properties up the prototype chain.
    return {
      *[Symbol.iterator]() {
        for (const prop in it) {
          const desc = getPropertyDescriptor(it, prop)
          if ('value' in desc)
            yield [prop, desc.value] as [string, unknown]
        }
      },
    }
  }

  // Subclasses should not generally override the visit*() methods.
  visit(it: unknown) {
    switch (typeof it) {
      case 'object': {
        if (it === null)
          return this.null()

        let ref: ReferenceInfo | undefined
        if (!(ref = this.ref_info(it, false))) return

        // Object.getOwnPropertyDescriptor would be safer, but bypasses proxying.
        if (to_repr in it && typeof (it as Record<symbol, unknown>)[to_repr] === 'function') {
          this.visit_to_repr(it as ToRepr)
        } else if (Array.isArray(it)) {
          this.array(it)
        } else if (it instanceof TypedArray) {
          this.typed_array(it as ArrayLike<unknown> & Iterable<unknown>)
        } else if (it instanceof Set) {
          this.set(it)
        } else if (it instanceof Map) {
          this.map(it)
        } else if (it instanceof Error) {
          this.error(it)
        } else if (it instanceof RegExp) {
          this.regexp(it)
        } else if (constructor_name_if_any(it) === 'Blob' && 'size' in it && 'type' in it) { // Node has no Blob before 18
          this.class_object_like('Blob', { size: (it as Blob).size, type: (it as Blob).type })
        } else {
          this.object(it, this.#iter(it), is_pojo(it))
        }
        ref.circular = false
        break
      }
      case 'string': return this.string(it)
      case 'number': return this.number(it)
      case 'boolean': return this.boolean(it)
      case 'bigint': return this.bigint(it)
      case 'undefined': return this.undefined()
      case 'symbol': {
        if (!this.ref_info(it, true)) return

        return this.symbol(it)
      }
      case 'function': {
        let ref: ReferenceInfo | undefined
        if (!(ref = this.ref_info(it, false))) return

        if (to_repr in it && typeof (it as unknown as Record<symbol, unknown>)[to_repr] === 'function') {
          return this.visit_to_repr(it as unknown as ToRepr)
        }

        this.function(it)
        ref.circular = false
        break
      }
      default: throw Error('Unknown type in repr.visit: ' + typeof it)
    }
  }
  /** Returns undefined for a repeated reference, after printing it; otherwise records and returns the reference. */
  ref_info(it: object, is_symbol: false): ReferenceInfo | undefined
  ref_info(it: symbol, is_symbol: true): ReferenceInfo | undefined
  ref_info(it: object | symbol, is_symbol = false) {
    let ref = this.state.refs.get(it as object)
    if (ref && (ref.circular || this.state.options.deduplicate_references !== false)) {
      this.reference(it, ref.circular, ref.path)
      return undefined
    }

    ref = {
      circular: !is_symbol,
      path: this.state.path.map(p => safe_string(p)),
    }
    if (is_symbol) this.state.symbol_refs.set(it as symbol, ref)
    else this.state.refs.set(it as object, ref)
    return ref
  }
  visit_set_like(value: Iterable<unknown>) {
    let i = 0
    for (const ch of value) {
      this.state.path.push(i)
      this.array_like_child(i).visit(ch)
      i++
      if (this.state.stop) return
      this.state.path.pop()
    }
  }
  visit_array(value: Array<unknown>) {
    let last_nonempty_idx = -1
    for (const nonempty_idx_str in value) {
      if (!/^\d+$/.test(nonempty_idx_str)) return // numeric array keys come before other keys
      if (this.state.stop) return

      const nonempty_idx = +nonempty_idx_str
      const empty_slots_skipped = nonempty_idx - last_nonempty_idx - 1
      if (empty_slots_skipped > 0) this.array_like_child(last_nonempty_idx + 1).span(`<${empty_slots_skipped} empty slot${empty_slots_skipped === 1 ? '' : 's'}>`, 'empty_slot')

      this.state.path.push(nonempty_idx)
      this.array_like_child(nonempty_idx).visit(value[nonempty_idx])
      this.state.path.pop()

      last_nonempty_idx = nonempty_idx
    }
    if (last_nonempty_idx !== value.length - 1) {
      const trailing_empty_slots = value.length - 1 - last_nonempty_idx
      this.array_like_child(last_nonempty_idx + 1).span(`<${trailing_empty_slots} empty slot${trailing_empty_slots === 1 ? '' : 's'}>`, 'empty_slot')
    }
  }
  visit_object_like(it: Iterable<[unknown, unknown]>, is_pojo = false) {
    let i = 0
    const open_bracket = it instanceof Map ? '' : '['
    const close_bracket = it instanceof Map ? '' : ']'
    const str_open_bracket = it instanceof Map ? '"' : ''
    const str_close_bracket = it instanceof Map ? '"' : ''
    for (const [name, value] of it) {
      this.state.path.push(name)
      this.object_like_child(i++, name, open_bracket, close_bracket, str_open_bracket, str_close_bracket, is_pojo).visit(value)
      if (this.state.stop) return
      this.state.path.pop()
    }
  }
  visit_to_repr(it: ToRepr) {
    it[to_repr](this)
  }

  get stopped() { return this.state.stop }
}

type ToRepr = { [to_repr](visitor: CustomRepresentationVisitor): void }

export class StringRepresentationVisitor extends RepresentationVisitor {
  parts: string[] = []

  constructor(options: Options) {
    super(undefined, options)
  }

  span(stuff: string, _type: SpanType) {
    if (stuff) {
      if (this.state.stop) return

      if ((this.state.char_limit -= stuff.length) < 3) {
        this.parts.push(safe_truncate(stuff, this.state.char_limit + stuff.length - 3))
        this.parts.push('...')
        this.state.stop = true
      } else
        this.parts.push(stuff)
    }
  }
  toString() {
    return this.parts.join('')
  }
}

function getPropertyDescriptor(it: object | null, prop: string) {
  while (it) {
    const desc = Object.getOwnPropertyDescriptor(it, prop)
    if (desc) return desc
    it = Object.getPrototypeOf(it)
  }
  throw Error('Unable to find property descriptor: ' + prop)
}

export const DEFAULT_REPR_CHAR_LIMIT = 50000

/** Returns a string representation of any JavaScript value, within `options.char_limit` characters. */
export function repr(value: unknown, options: Options = {}): string {
  const v = new StringRepresentationVisitor({ ...options, char_limit: options.char_limit ?? DEFAULT_REPR_CHAR_LIMIT })
  v.visit(value)
  return v.toString()
}
