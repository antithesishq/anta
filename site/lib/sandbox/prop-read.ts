/**
 * prop-read.ts — code → form-state direction of the sync. Scans the
 * bound target element's opening tag for each known prop and tries
 * to extract a literal value. Anything non-literal (function calls,
 * computed refs, ternaries) returns `undefined` for that prop —
 * caller leaves the form control at its last known value.
 */
import { findAttribute, locateOpeningTag } from './locate-tag.ts'
import type { PropDescriptor } from './prop-patch.ts'

export type ReadResult = { kind: 'literal'; value: string | number | boolean } | { kind: 'expression' } | undefined

/**
 * Read a single prop from the target element's opening tag.
 * Returns:
 *   - { kind: 'literal', value } if the attribute is a string literal,
 *     a number literal inside `{…}`, or a boolean literal / shorthand.
 *   - { kind: 'expression' } if the attribute is present but its value
 *     is some other JS expression — the form should disable its control
 *     and indicate "set by code".
 *   - undefined if the attribute isn't present at all — the form should
 *     show its default value.
 */
export function readProp(
  source: string,
  componentName: string,
  prop: PropDescriptor,
  range?: { start: number; end: number },
): ReadResult {
  let open
  if (range) {
    const slice = source.slice(range.start, range.end)
    const localOpen = locateOpeningTag(slice, componentName)
    if (!localOpen) return undefined
    open = {
      start: localOpen.start + range.start,
      end: localOpen.end + range.start,
      selfClosing: localOpen.selfClosing,
      text: localOpen.text,
      attrsStart: localOpen.attrsStart + range.start,
      attrsEnd: localOpen.attrsEnd + range.start,
    }
  } else {
    open = locateOpeningTag(source, componentName)
    if (!open) return undefined
  }
  const attr = findAttribute(source, open, prop.name)
  if (!attr) return undefined

  // Boolean shorthand (`<Foo bar>`) — only valid when the prop is boolean.
  if (!attr.valueRange) {
    return prop.kind === 'boolean' ? { kind: 'literal', value: true } : { kind: 'expression' }
  }

  if (attr.valueRange.kind === 'string') {
    // Strip the surrounding quotes — show the unquoted text in the control.
    const raw = attr.valueRange.text.slice(1, -1)
    // Expression props now treat a bare string the same as string /
    // literal-union props: surface the *unquoted* value (so the field shows
    // `Search`, not `"Search"`). It re-serializes to `name="Search"` — a leading
    // quote is no longer read as an expression (see prop-patch).
    if (prop.kind === 'expression' || prop.kind === 'string' || prop.kind === 'literal-union') {
      return { kind: 'literal', value: raw }
    }
    // String value supplied to a number / boolean prop — unusual; surface
    // as expression so the form doesn't pretend it understood it.
    return { kind: 'expression' }
  }

  // Expression container: strip the `{ … }`.
  const inner = attr.valueRange.text.slice(1, -1).trim()
  // Expression prop: return the inner expression text verbatim so the
  // editable field shows exactly what's between the braces (the
  // brace-balanced scan in `findAttribute` already handled nesting).
  if (prop.kind === 'expression') {
    return { kind: 'literal', value: inner }
  }
  // Style object literal (`style={{ marginLeft: '16px' }}`) → CSS declarations string
  // for the field — the inverse of prop-patch's `cssDeclarationsToObjectLiteral`.
  if (prop.kind === 'style-css') {
    const css = objectLiteralToCssDeclarations(inner)
    return css !== undefined ? { kind: 'literal', value: css } : { kind: 'expression' }
  }
  // Numeric literal.
  if (prop.kind === 'number') {
    if (/^-?\d+(\.\d+)?$/.test(inner)) return { kind: 'literal', value: Number(inner) }
    return { kind: 'expression' }
  }
  // Boolean literal.
  if (prop.kind === 'boolean') {
    if (inner === 'true') return { kind: 'literal', value: true }
    if (inner === 'false') return { kind: 'literal', value: false }
    return { kind: 'expression' }
  }
  // String literal inside braces, e.g. `tone={'info'}`.
  if (prop.kind === 'string' || prop.kind === 'literal-union') {
    const m = inner.match(/^(['"])(.*)\1$/)
    if (m) return { kind: 'literal', value: m[2] }
    return { kind: 'expression' }
  }
  return { kind: 'expression' }
}

/**
 * Inverse of prop-patch's `cssDeclarationsToObjectLiteral`: turn a JSX style object
 * literal (`{ marginLeft: '16px', '--foo': 'bar' }`) back into a CSS declarations
 * string (`margin-left: 16px; --foo: bar`) for the style field. Returns undefined if
 * any value isn't a plain string / number literal (i.e. a computed expression) — the
 * caller then surfaces the whole prop as `{ kind: 'expression' }` ("set by code").
 */
function objectLiteralToCssDeclarations(objText: string): string | undefined {
  let s = objText.trim()
  if (!s.startsWith('{') || !s.endsWith('}')) return undefined
  s = s.slice(1, -1).trim()
  if (!s) return ''
  const decls: string[] = []
  for (const part of splitTopLevel(s, ',')) {
    const entry = part.trim()
    if (!entry) continue
    const colon = topLevelIndexOf(entry, ':')
    if (colon === -1) return undefined
    let key = entry.slice(0, colon).trim()
    const rawVal = entry.slice(colon + 1).trim()
    // Key: a quoted string (custom prop `--foo` or arbitrary) or a bare camelCase
    // identifier (marginLeft → margin-left).
    const kq = key.match(/^(['"])(.*)\1$/)
    if (kq) key = kq[2]
    else if (/^[A-Za-z_][\w$]*$/.test(key)) key = key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
    else return undefined
    // Value: a string literal, or a bare number (e.g. `zIndex: 5`). Anything else is
    // an expression we can't render as a CSS string.
    const vq = rawVal.match(/^(['"])(.*)\1$/)
    if (vq) decls.push(`${key}: ${vq[2]}`)
    else if (/^-?\d+(\.\d+)?$/.test(rawVal)) decls.push(`${key}: ${rawVal}`)
    else return undefined
  }
  return decls.join('; ')
}

/** Split `s` on top-level `delim`, ignoring delimiters inside quotes or nested (){}[]. */
function splitTopLevel(s: string, delim: string): string[] {
  const out: string[] = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      if (c === quote && s[i - 1] !== '\\') quote = ''
      continue
    }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === delim && depth === 0) {
      out.push(s.slice(start, i))
      start = i + 1
    }
  }
  out.push(s.slice(start))
  return out
}

/** First top-level index of `ch`, ignoring occurrences inside quotes or nested (){}[]. */
function topLevelIndexOf(s: string, ch: string): number {
  let depth = 0
  let quote = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      if (c === quote && s[i - 1] !== '\\') quote = ''
      continue
    }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === ch && depth === 0) return i
  }
  return -1
}
