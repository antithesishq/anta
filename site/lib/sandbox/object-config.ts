/**
 * Object-literal helpers for annotated playground configuration.
 *
 * An `@playground` comment can target a `const` / `let` / `var` declaration
 * whose initializer is a JSON-like object. This scanner intentionally handles
 * only literal object keys and values: that keeps the form in sync with the
 * code the reader can see, while computed keys, spreads, and function calls
 * remain owned by the Code tab.
 */
import { skipBraced } from './locate-tag.ts'
import type { PropDescriptor } from './prop-patch.ts'

export interface ObjectRange {
  /** The opening `{` of the declared object literal. */
  start: number
  /** Index immediately after its closing `}`. */
  end: number
}

type ObjectValueKind = 'string' | 'number' | 'boolean' | 'expression'

export interface ObjectField {
  path: string[]
  valueStart: number
  valueEnd: number
  kind: ObjectValueKind
}

/** Return editable leaf values from a JSON-like object, in source order. */
export function listObjectFields(source: string, range: ObjectRange): ObjectField[] {
  if (source[range.start] !== '{' || source[range.end - 1] !== '}') return []
  return walkObject(source, range.start, range.end, [])
}

/** Read one annotated object value with the same result shape as `readProp`. */
export function readObjectValue(
  source: string,
  range: ObjectRange,
  prop: PropDescriptor,
): { kind: 'literal'; value: string | number | boolean } | { kind: 'expression' } | undefined {
  if (!prop.objectPath || !prop.objectValueKind) return undefined
  const field = listObjectFields(source, range).find((entry) => samePath(entry.path, prop.objectPath!))
  if (!field) return undefined
  const raw = source.slice(field.valueStart, field.valueEnd).trim()

  switch (prop.objectValueKind) {
    case 'string': {
      if (field.kind !== 'string') return { kind: 'expression' }
      return { kind: 'literal', value: raw.slice(1, -1) }
    }
    case 'number':
      return field.kind === 'number'
        ? { kind: 'literal', value: Number(raw) }
        : { kind: 'expression' }
    case 'boolean':
      return field.kind === 'boolean'
        ? { kind: 'literal', value: raw === 'true' }
        : { kind: 'expression' }
    case 'expression':
      return { kind: 'literal', value: raw }
  }
}

/** Replace one existing object-literal leaf. Fields are never inserted or
 * removed: add structure in the Code tab, then the Props form will discover it. */
export function replaceObjectValue(
  source: string,
  range: ObjectRange,
  prop: PropDescriptor,
  nextValue: string | number | boolean | null,
): string {
  if (!prop.objectPath || !prop.objectValueKind || nextValue == null) return source
  const field = listObjectFields(source, range).find((entry) => samePath(entry.path, prop.objectPath!))
  if (!field) return source

  const replacement = serializeObjectValue(prop.objectValueKind, nextValue)
  return source.slice(0, field.valueStart) + replacement + source.slice(field.valueEnd)
}

function walkObject(source: string, start: number, end: number, prefix: string[]): ObjectField[] {
  const fields: ObjectField[] = []
  let i = start + 1

  while (i < end - 1) {
    i = skipTrivia(source, i, end)
    if (i >= end - 1 || source[i] === '}') break

    const key = readKey(source, i, end)
    if (!key) break
    i = skipTrivia(source, key.end, end)
    if (source[i] !== ':') break
    i = skipTrivia(source, i + 1, end)
    const valueStart = i
    const delimiter = findValueDelimiter(source, valueStart, end)
    const valueEnd = trimEnd(source, valueStart, delimiter)
    if (valueEnd <= valueStart) break

    const nestedEnd = source[valueStart] === '{' ? skipBraced(source, valueStart) : null
    if (nestedEnd === valueEnd) {
      fields.push(...walkObject(source, valueStart, valueEnd, [...prefix, key.value]))
    } else {
      fields.push({
        path: [...prefix, key.value],
        valueStart,
        valueEnd,
        kind: classifyValue(source.slice(valueStart, valueEnd)),
      })
    }

    i = delimiter
    if (source[i] === ',') i++
  }

  return fields
}

function readKey(source: string, start: number, end: number): { value: string; end: number } | null {
  const first = source[start]
  if (first === '"' || first === "'") {
    const quotedEnd = skipQuoted(source, start, first)
    if (quotedEnd == null || quotedEnd > end) return null
    return { value: source.slice(start + 1, quotedEnd - 1), end: quotedEnd }
  }
  if (!/[A-Za-z_$]/.test(first ?? '')) return null
  let i = start + 1
  while (i < end && /[A-Za-z0-9_$]/.test(source[i])) i++
  return { value: source.slice(start, i), end: i }
}

/** Find the comma or closing brace at this object's current depth. */
function findValueDelimiter(source: string, start: number, objectEnd: number): number {
  let i = start
  let brace = 0
  let bracket = 0
  let paren = 0
  while (i < objectEnd) {
    const c = source[i]
    if (c === '"' || c === "'" || c === '`') {
      const next = skipQuoted(source, i, c)
      if (next == null) return objectEnd - 1
      i = next
      continue
    }
    if (c === '/' && source[i + 1] === '/') {
      const next = source.indexOf('\n', i + 2)
      i = next === -1 ? objectEnd : next + 1
      continue
    }
    if (c === '/' && source[i + 1] === '*') {
      const next = source.indexOf('*/', i + 2)
      i = next === -1 ? objectEnd : next + 2
      continue
    }
    if (c === '{') brace++
    else if (c === '}') {
      if (brace === 0 && bracket === 0 && paren === 0) return i
      brace--
    } else if (c === '[') bracket++
    else if (c === ']') bracket--
    else if (c === '(') paren++
    else if (c === ')') paren--
    else if (c === ',' && brace === 0 && bracket === 0 && paren === 0) return i
    i++
  }
  return objectEnd - 1
}

function skipTrivia(source: string, start: number, end: number): number {
  let i = start
  while (i < end) {
    if (/\s/.test(source[i])) {
      i++
      continue
    }
    if (source[i] === '/' && source[i + 1] === '/') {
      const next = source.indexOf('\n', i + 2)
      i = next === -1 ? end : next + 1
      continue
    }
    if (source[i] === '/' && source[i + 1] === '*') {
      const next = source.indexOf('*/', i + 2)
      i = next === -1 ? end : next + 2
      continue
    }
    break
  }
  return i
}

function skipQuoted(source: string, start: number, quote: string): number | null {
  let i = start + 1
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2
      continue
    }
    if (source[i] === quote) return i + 1
    i++
  }
  return null
}

function trimEnd(source: string, start: number, end: number): number {
  let i = end
  while (i > start && /\s/.test(source[i - 1])) i--
  return i
}

function classifyValue(raw: string): ObjectValueKind {
  const value = raw.trim()
  if (/^(['"])[\s\S]*\1$/.test(value)) return 'string'
  if (/^-?\d+(\.\d+)?$/.test(value)) return 'number'
  if (value === 'true' || value === 'false') return 'boolean'
  return 'expression'
}

function serializeObjectValue(kind: ObjectValueKind, value: string | number | boolean): string {
  switch (kind) {
    case 'string':
      return JSON.stringify(String(value))
    case 'number':
      return String(Number(value))
    case 'boolean':
      return value ? 'true' : 'false'
    case 'expression':
      return String(value)
  }
}

function samePath(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((part, index) => part === b[index])
}
