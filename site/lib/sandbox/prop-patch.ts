/**
 * prop-patch.ts — form-control → code edits via targeted string
 * replacement inside the opening tag of a bound JSX element.
 *
 * The Playground binds to a target component (e.g. `Progress`).
 * Every form change calls `replaceProp(code, target, name, value)`:
 * we find `<Target` in the source, locate the named attribute inside
 * the opening tag, and either replace its value, insert it, or remove
 * it (when the value matches the prop's default). Everything outside
 * the opening tag — sibling `<style>` blocks, wrapping fragments,
 * helper functions, the user's imports — is left untouched.
 */
import { findAttribute, locateOpeningTag } from './locate-tag.ts'

export interface PropDescriptor {
  /** Prop name as it appears in JSX. */
  name: string
  /** What to render the value as in JSX. Determines whether we emit
   *  `value="abc"` (string) or `value={42}` (expression). The two
   *  special kinds are:
   *  - `children`: not an attribute. The value replaces the JSX
   *    element's body content (between opening and closing tags).
   *  - `style-css`: the value is a CSS-declaration string like
   *    `color: red; padding: 8px` and is parsed into a JSX object
   *    literal — `style={{ color: 'red', padding: '8px' }}`.
   *  - `expression`: the value is a raw JS/JSX expression spliced
   *    verbatim inside braces — `actions={<Button label="Go" />}`.
   *    Used for `ReactNode`-typed props so the user can type any
   *    expression, parsed exactly as if typed in the CODE tab. An
   *    empty value removes the attribute. */
  kind: 'string' | 'number' | 'boolean' | 'literal-union' | 'children' | 'style-css' | 'expression'
  /** Default value — if `next === defaultValue` we omit the attribute. */
  defaultValue?: string | number | boolean | null
  /** A path inside an annotated object literal. When present, the playground
   *  edits the literal value rather than a JSX attribute. */
  objectPath?: string[]
  /** Serialization to use for an annotated object-literal value. */
  objectValueKind?: 'string' | 'number' | 'boolean' | 'expression'
}

/**
 * Replace (or insert or remove) a single attribute of the target
 * element. Returns the new source. If the target element can't be
 * located the original source is returned unchanged.
 *
 * When `range` is supplied, the locator is constrained to that slice
 * of the source — used by the multi-example playground so a form
 * tied to one example only edits that example's JSX.
 */
export function replaceProp(
  source: string,
  componentName: string,
  prop: PropDescriptor,
  nextValue: string | number | boolean | null | undefined,
  range?: { start: number; end: number },
): string {
  if (prop.kind === 'children') {
    return replaceChildren(source, componentName, nextValue, range)
  }
  if (range) {
    const slice = source.slice(range.start, range.end)
    const open = locateOpeningTag(slice, componentName)
    if (!open) return source
    const offsetOpen = shiftOpenTag(open, range.start)
    const existing = findAttribute(source, offsetOpen, prop.name)
    return applyEdit(source, prop, nextValue, offsetOpen, existing)
  }
  const open = locateOpeningTag(source, componentName)
  if (!open) return source
  const existing = findAttribute(source, open, prop.name)
  return applyEdit(source, prop, nextValue, open, existing)
}

/**
 * Replace the content between the opening and closing tags of the
 * first matching element. Self-closing tags are expanded into a
 * paired `<Foo>value</Foo>`; setting an empty value on a paired tag
 * leaves it as `<Foo></Foo>` (we don't collapse back to self-closing,
 * since that loses the user's structure).
 */
function replaceChildren(
  source: string,
  componentName: string,
  nextValue: string | number | boolean | null | undefined,
  range?: { start: number; end: number },
): string {
  let open
  if (range) {
    const slice = source.slice(range.start, range.end)
    const localOpen = locateOpeningTag(slice, componentName)
    if (!localOpen) return source
    open = shiftOpenTag(localOpen, range.start)
  } else {
    open = locateOpeningTag(source, componentName)
    if (!open) return source
  }
  const value = nextValue == null ? '' : String(nextValue)
  if (open.selfClosing) {
    const newOpenText = open.text.replace(/\s*\/>$/, '>')
    const replacement = newOpenText + value + `</${componentName}>`
    return source.slice(0, open.start) + replacement + source.slice(open.end)
  }
  const closeTag = `</${componentName}>`
  const closeStart = source.indexOf(closeTag, open.end)
  if (closeStart === -1) return source
  return source.slice(0, open.end) + value + source.slice(closeStart)
}

/**
 * Read the children content (text between opening and closing tags)
 * of the first matching element in the source. Returns `undefined`
 * when no opening tag can be located.
 */
export function readChildren(
  source: string,
  componentName: string,
  range?: { start: number; end: number },
): string | undefined {
  let open
  if (range) {
    const slice = source.slice(range.start, range.end)
    const localOpen = locateOpeningTag(slice, componentName)
    if (!localOpen) return undefined
    open = shiftOpenTag(localOpen, range.start)
  } else {
    open = locateOpeningTag(source, componentName)
    if (!open) return undefined
  }
  if (open.selfClosing) return ''
  const closeTag = `</${componentName}>`
  const closeStart = source.indexOf(closeTag, open.end)
  if (closeStart === -1) return undefined
  return source.slice(open.end, closeStart)
}

function applyEdit(
  source: string,
  prop: PropDescriptor,
  nextValue: string | number | boolean | null | undefined,
  open: ReturnType<typeof locateOpeningTag> & object,
  existing: ReturnType<typeof findAttribute>,
): string {
  // An expression with a blank (whitespace-only) value is treated as
  // empty — remove the attribute rather than emit `name={}`.
  const blankExpression = prop.kind === 'expression' && typeof nextValue === 'string' && nextValue.trim() === ''
  const shouldRemove = isAtDefault(nextValue, prop) || nextValue === '' || nextValue == null || blankExpression
  if (shouldRemove) {
    if (!existing) return source
    return removeAttribute(source, existing.start, existing.end)
  }
  const serialized = serializeAttribute(prop, nextValue!)
  if (existing) {
    return source.slice(0, existing.start) + serialized + source.slice(existing.end)
  }
  return insertAttribute(source, open, serialized)
}

function shiftOpenTag(
  open: NonNullable<ReturnType<typeof locateOpeningTag>>,
  delta: number,
): NonNullable<ReturnType<typeof locateOpeningTag>> {
  return {
    start: open.start + delta,
    end: open.end + delta,
    selfClosing: open.selfClosing,
    text: open.text,
    attrsStart: open.attrsStart + delta,
    attrsEnd: open.attrsEnd + delta,
  }
}

function isAtDefault(value: unknown, prop: PropDescriptor): boolean {
  if (prop.defaultValue === undefined) return false
  return value === prop.defaultValue
}

function serializeAttribute(prop: PropDescriptor, value: string | number | boolean): string {
  switch (prop.kind) {
    case 'string':
      // Use double quotes; escape any embedded double quotes.
      return `${prop.name}="${String(value).replace(/"/g, '&quot;')}"`
    case 'literal-union':
      return `${prop.name}="${String(value)}"`
    case 'boolean':
      return value ? `${prop.name}` : `${prop.name}={false}`
    case 'number':
      return `${prop.name}={${Number(value)}}`
    case 'style-css':
      return `${prop.name}={${cssDeclarationsToObjectLiteral(String(value))}}`
    case 'expression': {
      // ReactNode props accept JSX *or* a plain string. Splice verbatim inside
      // braces only when the value clearly *is* an expression — it starts like
      // JSX (`<`), an object/block (`{`), an array (`[`), or a group (`(`).
      // Everything else is treated as a plain string literal — including a value
      // that *starts* with a quote, so a stray leading quote can't open an
      // unterminated expression (`trailing={"foo}`), and a plain `error`/`hint`
      // message doesn't become an undefined identifier (`error={dghdgf}` → crash).
      // (Empty value is handled upstream in `applyEdit`.)
      const s = String(value)
      return /^\s*[<{[(]/.test(s)
        ? `${prop.name}={${s}}`
        : `${prop.name}="${s.replace(/"/g, '&quot;')}"`
    }
    case 'children':
      // Should never reach here — replaceProp short-circuits children
      // edits before serialization. Return empty just in case.
      return ''
  }
}

/**
 * Parse a CSS declarations string (`color: red; padding: 8px 12px`)
 * into a JSX-ready object literal (`{ color: 'red', padding: '8px 12px' }`).
 * Camel-cases property names except for CSS custom properties
 * (`--foo`), which stay hyphenated and need to be quoted as keys.
 */
function cssDeclarationsToObjectLiteral(css: string): string {
  const pairs: string[] = []
  for (const decl of css.split(';')) {
    const trimmed = decl.trim()
    if (!trimmed) continue
    const colon = trimmed.indexOf(':')
    if (colon === -1) continue
    const prop = trimmed.slice(0, colon).trim()
    const val = trimmed.slice(colon + 1).trim()
    if (!prop || !val) continue
    const isCustom = prop.startsWith('--')
    const key = isCustom
      ? JSON.stringify(prop)
      : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    pairs.push(`${key}: ${JSON.stringify(val)}`)
  }
  return `{ ${pairs.join(', ')} }`
}

function removeAttribute(source: string, attrStart: number, attrEnd: number): string {
  // Also eat the leading whitespace that separated this attribute from
  // its predecessor, so we don't leave a double space behind.
  let cleanStart = attrStart
  while (cleanStart > 0 && /[ \t]/.test(source[cleanStart - 1])) cleanStart--
  // If the previous character is a newline we keep one space — don't
  // collapse the indented line entirely.
  if (cleanStart > 0 && source[cleanStart - 1] === '\n') {
    // Remove the whole now-empty line.
    let lineEnd = attrEnd
    while (lineEnd < source.length && /[ \t]/.test(source[lineEnd])) lineEnd++
    if (source[lineEnd] === '\n') lineEnd++
    return source.slice(0, cleanStart) + source.slice(lineEnd)
  }
  return source.slice(0, cleanStart) + source.slice(attrEnd)
}

function insertAttribute(
  source: string,
  open: { attrsEnd: number; selfClosing: boolean; start: number },
  serialized: string,
): string {
  // `attrsEnd` is the index of the `/>` or `>` marker that closes
  // the opening tag. Insert just before it, separated by a space (or
  // a newline + matching indent if the existing attributes are
  // multi-line).
  const insertAt = open.attrsEnd
  const segment = source.slice(open.start, insertAt)
  const lastNewlineIdx = segment.lastIndexOf('\n')
  if (lastNewlineIdx === -1) {
    // Single-line opening tag — insert with a leading space.
    return source.slice(0, insertAt) + ' ' + serialized + source.slice(insertAt)
  }
  // Multi-line opening tag — match the existing indent of the last
  // attribute line.
  const lastLine = segment.slice(lastNewlineIdx + 1)
  const indentMatch = lastLine.match(/^[ \t]*/)
  const indent = indentMatch ? indentMatch[0] : ''
  // Trim any trailing whitespace on the existing last line, then add
  // a newline + indent + new attribute.
  let trimEnd = insertAt
  while (trimEnd > 0 && /[ \t]/.test(source[trimEnd - 1])) trimEnd--
  return source.slice(0, trimEnd) + '\n' + indent + serialized + source.slice(insertAt)
}
