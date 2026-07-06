/**
 * props-form.ts — walks the build-time typedoc output (`site/src/api.json`)
 * to derive a control schema for a component's props. The same JSON drives
 * `PropsTable.astro` (the static reference table); reusing it here keeps
 * the playground form in lockstep with the documented prop set.
 *
 * Walk: `api.children` → find the `{ComponentName}Props` declaration →
 * collect its prop list (direct `children` for an `interface` declaration,
 * or `flattenType` over `decl.type` for a `type` alias built from
 * intersections / discriminated unions) → map each prop's type into a
 * `Control` descriptor.
 */
import api from '../../src/api.json'
import type { PropDescriptor } from './prop-patch.ts'
import { findAttribute, listAttributes, locateOpeningTag } from './locate-tag.ts'

/** Props with no place among the playground controls — renderer plumbing
 *  (`key`, `ref`) or attributes only meaningful in real app code (`id`,
 *  `title`, `tabIndex`), not for exploring the component. Global to every
 *  component. */
const EXCLUDED_PROP_NAMES = new Set(['key', 'ref', 'id', 'title', 'tabIndex'])

/** Per-component control exclusions, applied on top of the global set. */
const EXCLUDED_BY_COMPONENT: Record<string, Set<string>> = {
  // Button's anchor/submit attributes are real but niche — keep the panel
  // focused on appearance + content. `href` / `target` stay (anchor mode).
  Button: new Set(['download', 'ping', 'rel', 'type', 'form']),
}

/** Explicit control order per component. Listed names lead in this order;
 *  any prop not listed keeps its natural (flatten) position after them. The
 *  discriminated-union prop types can't express this order at the type level
 *  without collapsing the unions that give them type-safety, so it lives
 *  here as a display concern. */
const PROP_ORDER: Record<string, string[]> = {
  Button: [
    'priority', 'tone', 'size', 'underline', 'paddingless',
    'label', 'icon', 'iconTrailing',
    'loading', 'disabled', 'selected',
    'href', 'target', 'children', 'className', 'style',
  ],
  Tabs: [
    'priority', 'tone', 'size', 'orientation', 'mounting', 'noslide', 'disabled',
    'label', 'value', 'defaultValue',
    'children', 'className', 'style',
  ],
}

/** Props whose validity depends on another prop's value — the discriminated
 *  unions a flat control list can't express. The predicate receives the
 *  current control values; a `false` result hides the control. Mirrors
 *  Button's `PriorityMode` (underline only on tertiary/quaternary,
 *  paddingless only on quaternary). */
export const CONDITIONAL_PROPS: Record<string, Record<string, (v: Record<string, unknown>) => boolean>> = {
  Button: {
    underline: (v) => v.priority === 'tertiary' || v.priority === 'quaternary',
    paddingless: (v) => v.priority === 'quaternary',
  },
}

export type Control =
  | { kind: 'slider'; name: string; min: number; max: number; step: number; defaultValue?: number; description?: string }
  | { kind: 'number'; name: string; defaultValue?: number; description?: string }
  | { kind: 'text'; name: string; defaultValue?: string; description?: string }
  | { kind: 'boolean'; name: string; defaultValue?: boolean; description?: string }
  /** `clearable` adds a leading "none" button that removes the
   *  attribute entirely. Set for optional props with no `@defaultValue`,
   *  where omitting the attribute is a meaningful state the radiogroup
   *  otherwise can't express (e.g. Button's `underline`). */
  | { kind: 'segmented'; name: string; options: string[]; defaultValue?: string; clearable?: boolean; description?: string }
  /** Named-tone tabs + a "Custom" tab that reveals a color input. `options`
   *  are the named literals; a value outside them is treated as a custom
   *  color. Serialized as a plain string attribute (`tone="…"`). */
  | { kind: 'tone'; name: string; options: string[]; defaultValue?: string; description?: string }
  /** Read-only entry for props we can't drive with a generic input
   *  — `children`, `style`, `ReactNode`, named references, etc. The
   *  form renders the name + type + description so the prop is
   *  documented in place, without offering an edit affordance. */
  | { kind: 'documentation'; name: string; type: string; description?: string }

export interface PropEntry {
  control: Control
  prop: PropDescriptor
  /** TypeScript-style optional flag — surfaced in the form label as
   *  `name?` so users see at a glance which props can be omitted. */
  optional: boolean
}

/** Walk api.json for a component's prop schema. Returns `[]` if the
 *  component (or its `{Name}Props` interface) isn't in the doc set.
 *
 *  Two declaration shapes are supported:
 *
 *    1. `interface FooProps extends BaseProps { … }` — typedoc emits
 *       the prop list as `decl.children`, including inherited members
 *       (with `flags.isInherited`). Read directly.
 *    2. `type FooProps = X & Y & Z` (intersection of named types and
 *       inline object literals) — typedoc emits `decl.type` describing
 *       the structure. `flattenType` walks it, recursing through
 *       intersections, unions of object literals (discriminated
 *       unions), reflections (`{ … }`), and named references back
 *       into `api.children`.
 *
 *  Both paths converge on a flat prop list, then map each prop to a
 *  `Control`. */
export function controlsFor(componentName: string): PropEntry[] {
  const ifaceName = `${componentName}Props`
  const root: any = api as any
  const decl = root.children?.find((c: any) => c.name === ifaceName)
  if (!decl) return []

  const props = decl.children
    ? (decl.children as any[])
    : flattenType(decl.type, root)

  const perComponent = EXCLUDED_BY_COMPONENT[componentName]
  const entries: PropEntry[] = []
  for (const p of props) {
    if (EXCLUDED_PROP_NAMES.has(p.name)) continue
    if (perComponent?.has(p.name)) continue
    const ctl = controlFor(p, root)
    if (!ctl) continue
    entries.push(ctl)
  }

  // Apply the explicit display order, if any. Listed names sort to the front
  // in order; unlisted props tie at the end and keep their relative order
  // (Array.prototype.sort is stable).
  const order = PROP_ORDER[componentName]
  if (order) {
    const rank = (n: string) => {
      const i = order.indexOf(n)
      return i === -1 ? order.length : i
    }
    entries.sort((a, b) => rank(a.control.name) - rank(b.control.name))
  }
  return entries
}

/** Recursively flatten a typedoc type node into a list of prop
 *  declarations shaped like the `children` of an interface. Handles
 *  intersections (merge by name, first non-`never` wins), unions of
 *  object literals (merge by name, take the union of literal value
 *  spaces across branches — that's how `priority` ends up with all
 *  four values from the three `PriorityMode` branches), reflections
 *  (inline `{ … }` types — take their `children` verbatim), and
 *  references to other named types in `api.children` (recurse on
 *  their `type` if a type alias, or use their `children` if an
 *  interface). Anything else returns `[]`. */
function flattenType(type: any, root: any): any[] {
  if (!type) return []
  switch (type.type) {
    case 'intersection': {
      const seen = new Map<string, any>()
      for (const member of type.types ?? []) {
        for (const field of flattenType(member, root)) {
          const existing = seen.get(field.name)
          if (!existing || isNeverType(existing.type)) {
            seen.set(field.name, field)
          }
        }
      }
      return [...seen.values()].filter((f) => !isNeverType(f.type))
    }
    case 'union': {
      const byName = new Map<string, any[]>()
      for (const branch of type.types ?? []) {
        for (const field of flattenType(branch, root)) {
          if (!byName.has(field.name)) byName.set(field.name, [])
          byName.get(field.name)!.push(field)
        }
      }
      const merged: any[] = []
      for (const occurrences of byName.values()) {
        const m = mergeUnionField(occurrences)
        if (m) merged.push(m)
      }
      return merged
    }
    case 'reflection':
      return (type.declaration?.children ?? []) as any[]
    case 'reference': {
      const target = root.children?.find((c: any) => c.name === type.name)
      if (!target) return []
      if (target.children) return target.children as any[]
      return flattenType(target.type, root)
    }
    default:
      return []
  }
}

/** Merge multiple appearances of the same prop across union branches.
 *  `never` branches are dropped from the type merge — they're the
 *  discriminator pattern used to forbid a prop in one variant (e.g.
 *  `type?: never` on the anchor branch of Button's `SubmitMode`). If
 *  every branch is `never`, the prop collapses to nothing and we
 *  return null. For
 *  literal / literal-union types we take the union of all values
 *  across branches; for any other shape we keep the first documented
 *  branch. The merged prop is marked optional whenever any branch
 *  marks it optional OR any branch types it as `never` — in the
 *  latter case the prop can be omitted by selecting that variant. */
function mergeUnionField(fields: any[]): any | null {
  const real = fields.filter((f) => !isNeverType(f.type))
  if (real.length === 0) return null
  const optional =
    fields.some((f) => f.flags?.isOptional) || real.length < fields.length

  if (real.length === 1) {
    return {
      ...real[0],
      flags: { ...real[0].flags, isOptional: optional },
    }
  }

  const allLiteralish = real.every((f) => isLiteralOrLiteralUnion(f.type))
  if (allLiteralish) {
    const collected: any[] = []
    for (const f of real) collectLiterals(f.type, collected)
    const seenValues = new Set<string>()
    const dedup: any[] = []
    for (const lit of collected) {
      const k = `${typeof lit.value}:${lit.value}`
      if (seenValues.has(k)) continue
      seenValues.add(k)
      dedup.push(lit)
    }
    const mergedType =
      dedup.length === 1 ? dedup[0] : { type: 'union', types: dedup }
    return {
      ...(real.find((f) => f.comment) ?? real[0]),
      type: mergedType,
      flags: { ...real[0].flags, isOptional: optional },
    }
  }
  return {
    ...(real.find((f) => f.comment) ?? real[0]),
    flags: { ...real[0].flags, isOptional: optional },
  }
}

function isNeverType(t: any): boolean {
  return t?.type === 'intrinsic' && t?.name === 'never'
}

function isLiteralOrLiteralUnion(t: any): boolean {
  if (!t) return false
  if (t.type === 'literal') return true
  if (t.type === 'union' && Array.isArray(t.types)) {
    return t.types.every((x: any) => x.type === 'literal')
  }
  return false
}

function collectLiterals(t: any, out: any[]): void {
  if (t.type === 'literal') out.push(t)
  else if (t.type === 'union') for (const x of t.types ?? []) collectLiterals(x, out)
}

function controlFor(p: any, root?: any): PropEntry | null {
  const name: string = p.name
  const description = renderComment(p.comment)
  const optional = !!p.flags?.isOptional

  const t = p.type
  if (!t) return null

  // Skip function-typed props (event handlers like `onClick`, `onChange`,
  // etc.). They aren't meaningfully editable from a UI panel, and showing
  // them as documentation rows clutters the list. TypeDoc represents a
  // function type as a `reflection` whose `declaration.signatures[]` is
  // populated with the call signature.
  if (t.type === 'reflection' && Array.isArray(t.declaration?.signatures) && t.declaration.signatures.length > 0) {
    return null
  }

  const wrap = (control: Control, prop: PropDescriptor): PropEntry => ({
    control, prop, optional,
  })

  // The two structural props inherited from BaseProps that the form
  // surfaces as editable text inputs:
  // - `children`: edit the JSX element's body content.
  // - `style`: a CSS declarations string, serialized to a JSX object
  //   literal so the prop type stays correct downstream.
  if (name === 'children') {
    return wrap(
      { kind: 'text', name, description },
      { name, kind: 'children' },
    )
  }
  if (name === 'style') {
    return wrap(
      { kind: 'text', name, description: description || 'CSS declarations (e.g. `color: red; padding: 8px`).' },
      { name, kind: 'style-css' },
    )
  }
  // `round` is polymorphic (`boolean | number | string` — a toggle OR a custom
  // radius), so its union would otherwise resolve to a number input (it contains
  // a `number` intrinsic, like `Text`'s `truncate`). In the playground we only
  // expose the binary toggle; the custom-length form is a code/docs feature, not
  // an interactive control. Force a boolean control here.
  if (name === 'round') {
    return wrap(
      { kind: 'boolean', name, description },
      { name, kind: 'boolean' },
    )
  }

  // `intrinsic` types: string / number / boolean.
  if (t.type === 'intrinsic') {
    if (t.name === 'number') {
      return wrap(
        { kind: 'number', name, description },
        { name, kind: 'number' },
      )
    }
    if (t.name === 'string') {
      return wrap(
        { kind: 'text', name, description },
        { name, kind: 'string' },
      )
    }
    if (t.name === 'boolean') {
      return wrap(
        { kind: 'boolean', name, description },
        { name, kind: 'boolean' },
      )
    }
    // Fall through to the documentation row for anything else.
  }

  // `union` of all `literal` members → segmented buttons. Boolean-only
  // literal unions (`true | false`) reduce to a plain boolean control
  // — that's how discriminated-union booleans (one branch sets `true`,
  // the other `false`) appear after the prop merger flattens them.
  if (t.type === 'union' && Array.isArray(t.types)) {
    // Boolean-only literal union (`true | false`) — render as a boolean
    // toggle. Catches discriminated-union booleans after merging.
    const allBoolean = t.types.length > 0 && t.types.every((x: any) => x.type === 'literal' && typeof x.value === 'boolean')
    if (allBoolean) {
      return wrap(
        { kind: 'boolean', name, description },
        { name, kind: 'boolean' },
      )
    }
    // All string literals → segmented buttons.
    const literals = t.types.filter((x: any) => x.type === 'literal' && typeof x.value === 'string')
    if (literals.length === t.types.length && literals.length > 0) {
      const options = literals.map((x: any) => String(x.value))
      // The runtime default for the UI fallback comes from a
      // `@defaultValue` JSDoc tag on the prop. We deliberately don't
      // fall back to `options[0]` — that lies when the first option
      // isn't the runtime default (Text.tone, Text.size). Without an
      // explicit tag, no button is highlighted when the source has no
      // literal, which truthfully reflects "implicit default
      // applies." The default is also intentionally *not* placed on
      // the PropDescriptor: that would make `applyEdit` strip the
      // attribute when the user picks the default, hiding the
      // selection from the rendered output.
      const defaultValue = readDefaultValueTag(p.comment)
      // An optional prop with no documented default can be omitted
      // entirely — surface that as a leading "none" button rather than
      // leaving the radiogroup with no active selection.
      const clearable = optional && defaultValue === undefined
      return wrap(
        { kind: 'segmented', name, options, defaultValue, clearable, description },
        { name, kind: 'literal-union' },
      )
    }
    // Union of number literals (e.g. Title's `level: 1 | 2 | … | 6`) →
    // surface as a number input rather than six tiny buttons.
    const numberLiterals = t.types.filter((x: any) => x.type === 'literal' && typeof x.value === 'number')
    if (numberLiterals.length === t.types.length && numberLiterals.length > 0) {
      return wrap(
        { kind: 'number', name, description },
        { name, kind: 'number' },
      )
    }
    // Mixed union that includes a number intrinsic (e.g. Text's
    // `truncate?: boolean | number`) — render as a number input. Empty
    // value means the prop is absent.
    const hasNumberIntrinsic = t.types.some((x: any) => x.type === 'intrinsic' && x.name === 'number')
    if (hasNumberIntrinsic) {
      return wrap(
        { kind: 'number', name, description },
        { name, kind: 'number' },
      )
    }
    // Mixed union: literal members + an open string (the `(string & {})`
    // TypeScript trick used by e.g. Button's `tone` to keep literal
    // autocomplete while accepting any CSS color). Surface as a plain
    // text input so the user can type either a literal name or a custom
    // value. The `string` can appear raw or wrapped in an intersection
    // with a reflection (TypeDoc's representation of `string & {}`).
    const hasOpenString = t.types.some((x: any) => {
      if (x.type === 'intrinsic' && x.name === 'string') return true
      if (x.type === 'intersection' && Array.isArray(x.types)) {
        return x.types.some((y: any) => y.type === 'intrinsic' && y.name === 'string')
      }
      return false
    })
    if (hasOpenString && literals.length > 0) {
      // `tone` gets a richer control: named-tone tabs + a "custom" tab with a
      // color input. Any other open-string union stays a plain text input.
      if (name === 'tone') {
        // Tone order follows the source declaration. TS canonicalizes union
        // members into an arbitrary internal order, so the `union-source-order`
        // typedoc plugin reorders them in api.json back to how they're written
        // in the type — meaning these literals already arrive in source order
        // and need no sorting here.
        return wrap(
          {
            kind: 'tone',
            name,
            options: literals.map((x: any) => String(x.value)),
            defaultValue: readDefaultValueTag(p.comment),
            description,
          },
          { name, kind: 'string' },
        )
      }
      return wrap(
        { kind: 'text', name, description },
        { name, kind: 'string' },
      )
    }
    // Open-string / icon-name union with no plain string literals — e.g.
    // `iconError: IconShape | (string & {}) | false`. Render a text input,
    // seeded from the `@defaultValue` tag so the panel shows the runtime default.
    const hasIconShape = t.types.some((x: any) => x.type === 'reference' && x.name === 'IconShape')
    if (hasOpenString || hasIconShape) {
      return wrap(
        { kind: 'text', name, defaultValue: readDefaultValueTag(p.comment), description },
        { name, kind: 'string' },
      )
    }
    // Fall through.
  }

  // Icon-name types (`icon` / `iconTrailing`) — an open-ended set of
  // string keys, far too many for segmented buttons. In api.json these
  // surface either as a `reference` to the `IconShape` alias (the JSX
  // wrapper props) or as the inlined `keyof IconShapes` typeOperator (the
  // raw element attrs). Either way, render a text input so the user can
  // type a shape name; the value emits as a string attribute.
  if (
    (t.type === 'reference' && t.name === 'IconShape') ||
    (t.type === 'typeOperator' && t.operator === 'keyof') ||
    // TypeDoc sometimes serializes `keyof IconShapes` as a stringified
    // `unknown` node instead of a structured reference / typeOperator —
    // it does this for interface members (Tag) but not type-literal
    // members (Button's ContentMode). Treat it the same: a text input.
    (t.type === 'unknown' && typeof t.name === 'string' && /IconShapes?\b/.test(t.name))
  ) {
    return wrap(
      { kind: 'text', name, description },
      { name, kind: 'string' },
    )
  }

  // `ReactNode`-typed props (e.g. Expander's `actions`, `title`) — make
  // them editable via a text input whose content is spliced into the
  // code as a raw JSX expression (`actions={<Button … />}`), parsed
  // exactly as if typed in the CODE tab. Detected as a reference to
  // React's `ReactNode`. Genuinely non-authorable references
  // (`CSSProperties`, named refs, functions) fall through to the
  // documentation row below.
  if (t.type === 'reference' && (t.name === 'ReactNode' || t.qualifiedName === 'React.ReactNode')) {
    return wrap(
      { kind: 'text', name, description: description || 'A JSX expression, e.g. `<Button label="Download" />`.' },
      { name, kind: 'expression' },
    )
  }

  // A reference to a local type alias (e.g. `TabsMounting`, `CheckboxValue`). Resolve it
  // and treat it like the inline shape would have been:
  if (t.type === 'reference' && root) {
    const target = root.children?.find((c: any) => c.name === t.name)
    const resolved = target?.type
    // Boolean-ish union (`boolean | 'indeterminate'`) → a boolean toggle. Handled here, not
    // by recursion, because the inline union path only maps `true | false` to a toggle — the
    // non-boolean members aren't reachable from the binary control, by design.
    if (
      resolved?.type === 'union' &&
      Array.isArray(resolved.types) &&
      resolved.types.some((x: any) => x.type === 'intrinsic' && x.name === 'boolean')
    ) {
      return wrap({ kind: 'boolean', name, description }, { name, kind: 'boolean' })
    }
    // Any other alias → run its underlying type back through controlFor, so an aliased
    // union behaves EXACTLY like the same union written inline (segmented buttons for string
    // literals, a number input for number literals, a text input for an open-string union,
    // …) rather than re-implementing a subset of the arms here and silently dropping the
    // rest. Recursion terminates: an alias-of-alias re-enters this branch and resolves again.
    if (resolved) {
      const viaAlias = controlFor({ ...p, type: resolved }, root)
      if (viaAlias) return viaAlias
    }
  }

  // Anything else — `CSSProperties`, named references,
  // intersection / mapped types, etc. Surface as a documentation
  // row: name + rendered type + description, no input. Lets the
  // panel double as the prop reference, eliminating the need for a
  // separate Props table beneath the playground.
  return wrap(
    { kind: 'documentation', name, type: renderType(t), description },
    // PropDescriptor isn't meaningful for read-only docs; use a
    // placeholder that the form's onChange path never references.
    { name, kind: 'string' },
  )
}

/** Render a TypeDoc type node as a short, human-readable string —
 *  shared format with `PropsTable.astro` so the playground reads
 *  the same way as the static reference table did. */
function renderType(type: any): string {
  if (!type) return '—'
  switch (type.type) {
    case 'intrinsic':
      return type.name
    case 'literal':
      return typeof type.value === 'string' ? `'${type.value}'` : String(type.value)
    case 'union':
      return type.types.map(renderType).join(' | ')
    case 'reference':
      if (type.name) return type.name
      return '—'
    case 'array':
      return `${renderType(type.elementType)}[]`
    case 'typeOperator':
      if (type.operator === 'keyof' && type.target?.name === 'IconShapes') return 'IconShape'
      return `${type.operator} ${renderType(type.target)}`
    default:
      return type.name || '—'
  }
}

function renderComment(comment: any): string | undefined {
  if (!comment?.summary) return undefined
  const text = comment.summary
    .map((part: any) => part.text)
    .join('')
    // TSDoc source wraps prose across lines with a `*  ` continuation indent;
    // typedoc keeps those newlines + leading spaces in the summary. Collapse all
    // whitespace runs to single spaces so the description reads as flowing prose —
    // otherwise the tooltip bubble (`white-space: break-spaces`) renders the source
    // line-breaks and indent verbatim.
    .replace(/\s+/g, ' ')
    .trim()
  return text || undefined
}

/** Read the value of a prop's `@defaultValue` (or `@default`) JSDoc
 *  block tag. Typedoc wraps a bare token like `medium` in a
 *  ```` ```ts\n…\n``` ```` fence; quoted forms (`'medium'`) come back as
 *  inline-code or text. Strip whichever wrapping is present. Returns
 *  `undefined` when neither tag is present. */
function readDefaultValueTag(comment: any): string | undefined {
  const tags = comment?.blockTags
  if (!Array.isArray(tags)) return undefined
  for (const tag of tags) {
    if (tag.tag !== '@defaultValue' && tag.tag !== '@default') continue
    const raw = (tag.content ?? [])
      .map((p: any) => p.text ?? '')
      .join('')
      .trim()
    if (!raw) continue
    return raw
      .replace(/^```[a-zA-Z]*\s*\n?/, '')
      .replace(/\n?```$/, '')
      .replace(/^[`'"](.*)[`'"]$/, '$1')
      .trim()
  }
  return undefined
}

/** Derive a Control schema for a JSX example by introspecting the
 *  tag in the source. Two paths:
 *
 *  1. If `tagName` is documented in `api.json` (e.g. `Progress`),
 *     return its full schema via `controlsFor`.
 *  2. Otherwise, walk the opening tag's attributes and emit a
 *     control per attribute whose value we can infer a kind from
 *     (string / number / boolean). Useful when the example uses a
 *     local helper component (`AnimatedProgress`) defined in the
 *     preamble — we can't know its full prop surface, but we can
 *     surface whatever the JSX is currently passing.
 *
 *  Both paths filter out `children`, `style`, `key`, `ref`. */
export function controlsForExample(
  tagName: string,
  source: string,
  range: { start: number; end: number },
): PropEntry[] {
  const known = controlsFor(tagName)
  if (known.length > 0) {
    return known.filter((e) => !EXCLUDED_PROP_NAMES.has(e.control.name))
  }
  return controlsFromJsxAttributes(tagName, source, range)
}

function controlsFromJsxAttributes(
  tagName: string,
  source: string,
  range: { start: number; end: number },
): PropEntry[] {
  const slice = source.slice(range.start, range.end)
  const open = locateOpeningTag(slice, tagName)
  if (!open) return []
  // Translate slice-local OpenTagRange back to absolute coordinates
  // so findAttribute matches `source` indexes.
  const absOpen = {
    start: open.start + range.start,
    end: open.end + range.start,
    selfClosing: open.selfClosing,
    text: open.text,
    attrsStart: open.attrsStart + range.start,
    attrsEnd: open.attrsEnd + range.start,
  }
  const names = listAttributes(source, absOpen)
  const entries: PropEntry[] = []
  const seen = new Set<string>()
  for (const name of names) {
    if (EXCLUDED_PROP_NAMES.has(name) || seen.has(name)) continue
    seen.add(name)
    const attr = findAttribute(source, absOpen, name)
    if (!attr) continue
    const kind = inferAttributeKind(attr)
    if (!kind) continue
    if (kind === 'number') {
      entries.push({
        prop: { name, kind: 'number' },
        control: { kind: 'number', name },
        optional: true,
      })
    } else if (kind === 'boolean') {
      entries.push({
        prop: { name, kind: 'boolean' },
        control: { kind: 'boolean', name },
        optional: true,
      })
    } else {
      entries.push({
        prop: { name, kind: 'string' },
        control: { kind: 'text', name },
        optional: true,
      })
    }
  }
  return entries
}

/** Infer a kind for an attribute by sniffing its value text.
 *  Returns null if we don't recognise the value at all (e.g. spread
 *  or unparseable expression). */
function inferAttributeKind(
  attr: { valueRange: { kind: 'string' | 'expression'; text: string } | null },
): 'string' | 'number' | 'boolean' | null {
  if (!attr.valueRange) return 'boolean'
  if (attr.valueRange.kind === 'string') return 'string'
  const inner = attr.valueRange.text.slice(1, -1).trim()
  if (/^-?\d+(\.\d+)?$/.test(inner)) return 'number'
  if (inner === 'true' || inner === 'false') return 'boolean'
  // String wrapped in `{'…'}` or `{"…"}` literal.
  if (/^(['"`]).*\1$/.test(inner)) return 'string'
  // Unrecognised expression — show as text so the user can still see it
  // (and the field will read as "set by code" via readProp's expression path).
  return 'string'
}
