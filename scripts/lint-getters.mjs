#!/usr/bin/env node
/**
 * lint-getters.mjs — enforce the React 19 getter/setter rule on Anta's web
 * components. Walks the TypeScript AST (via the compiler API — `typescript` is
 * already a devDependency, so no new deps) rather than scanning lines, which is
 * what makes it robust: get/set pairing is scoped to the real class node,
 * accessor detection is signature-shape-agnostic (multi-line, decorators, any
 * modifier order), `#`-private is a genuine `PrivateIdentifier` check, and
 * element classes are discovered by following `extends` — no hand-maintained
 * file list.
 *
 * WHY: React 19 applies props to a custom element as JS *properties* when a
 * property of that name exists anywhere on the prototype chain: `key in el` →
 * `el[key] = value`. A getter with no setter makes that assignment throw
 * ("Cannot set property X of #<AXElement> which has only a getter"), which
 * unmounts the consumer's tree. A TypeScript `private`/`protected` getter does
 * NOT help — access modifiers are erased at compile time, so the getter is a
 * real, visible prototype accessor at runtime. Only a `#name` (true ECMAScript
 * private) accessor is invisible to `key in el`.
 *
 * So every accessor `get X()` on an element class must be one of:
 *   1. `get #X()`            — truly private; React can't see it, and nothing
 *                              outside the class reads it.
 *   2. paired with `set X()` in the SAME class — assignable; the setter reflects
 *                              the value (usually to the backing attribute). A
 *                              setter inherited from a base does NOT count: an
 *                              own getter-only accessor shadows the inherited
 *                              pair, so `el.X = v` still throws.
 *   3. in the READONLY_ALLOWLIST below — a deliberate read-only public getter (a
 *                              native mirror like `validity`, or state derived
 *                              from a different write channel like `state`). Safe
 *                              only because nothing passes it as a JSX prop. The
 *                              allowlist lives here, not as a comment on the
 *                              component, and is the explicit reviewed opt-out.
 *
 * SECOND RULE (JSX wrappers) — a wrapper under `src/components/*.tsx` must never
 * call a method on a DOM element, including an `e.currentTarget` / `e.target`
 * handle taken from an event (not just a held ref). The app DOM may reconcile in
 * a worker thread, so that handle resolves to a serialized event snapshot, not a
 * live node: *reading* a serialized property (`e.currentTarget.value`) is fine,
 * but an imperative *method* call (`.click()`, `.focus()`, `.showPopover()`, …)
 * has no live node to run against and throws. Push such coordination into the web
 * component (which lives in the DOM), or express it declaratively via an
 * attribute/signal (see Calendar's `focusSignal`). This walk flags any
 * `<expr>.currentTarget.method(...)` / `<expr>.target.method(...)` call; property
 * reads and assignments are left alone. See src/AGENTS.md → "JSX wrappers never hold
 * a ref".
 *
 * Run: `node scripts/lint-getters.mjs` (wired as `pnpm run lint`). Exits 1 with
 * a report on any violation, 0 when clean.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

/**
 * The base every Anta custom element ultimately extends. A class is treated as
 * an element (and thus subject to the rule) iff its `extends` chain reaches it.
 * `HTMLElementBase` itself extends the native `HTMLElement`, which is outside
 * `src`, so it's the natural root to anchor the ancestry check on.
 */
const ELEMENT_ROOT = 'HTMLElementBase'

/**
 * Getters that are intentionally read-only public properties: native mirrors, or
 * state whose write channel is a *different* attribute (usually `state`). Safe
 * without a setter only because nothing passes them as a JSX prop, so React 19
 * never assigns them. Keyed by class name → getter names.
 */
const READONLY_ALLOWLIST = {
  // `view`/`doc` are protected internals on HTMLElementBase, never passed as a
  // JSX prop, so React 19 never assigns them.
  HTMLElementBase: ['view', 'doc'],
  AInputElement: ['validity', 'validationMessage', 'willValidate'],
  AInputTimeElement: ['validity', 'validationMessage', 'willValidate'],
  AMenuElement: ['isControlled', 'isSubmenu', 'triggerAnchor', 'isOpen'],
  ARadioGroupElement: ['value'],
  ATabsElement: ['value'],
  ACheckboxElement: ['checked', 'indeterminate'],
  ASwitchElement: ['checked'],
  // `open` mirrors the native <dialog>.open read; the write channel is the
  // `state` attribute / showModal(), and nothing passes `open` as a JSX prop
  // (ADialogAttributes uses `state`), so React 19 never assigns it.
  ADialogElement: ['open'],
}

/**
 * Opt-outs for the wrapper DOM-method rule (see the SECOND RULE in the header):
 * src-relative path → method names still tolerated on an event target there.
 * Empty — the keyboard-open that used to synthesize a click on a read-only
 * field's trigger (`e.currentTarget.click()` in Select / InputDate) now lives in
 * `<a-menu>` (its anchor keydown listener), so no wrapper calls a DOM method. Add
 * an entry only with a reviewed reason.
 */
const WRAPPER_DOM_CALL_ALLOWLIST = {}

/** Every `.ts` file under `src` (element classes are always `.ts` by
 *  convention). `.d.ts` declares no runtime accessors, so it's skipped. */
function collectTsFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectTsFiles(p))
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) out.push(p)
  }
  return out
}

/** Every `.tsx` file under `src` — the JSX wrappers (subject to the SECOND
 *  RULE: no DOM-method calls on event targets). */
function collectTsxFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectTsxFiles(p))
    else if (entry.name.endsWith('.tsx')) out.push(p)
  }
  return out
}

/** See through parentheses / `as T` / `!` so `(e.currentTarget as El).click()`
 *  and `e.currentTarget!.click()` are still recognized. */
function unwrap(node) {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node)
  )
    node = node.expression
  return node
}

/** The names a class/interface declaration `extends`, or []. */
function heritage(node) {
  return (node.heritageClauses ?? [])
    .filter((c) => c.token === ts.SyntaxKind.ExtendsKeyword)
    .flatMap((c) => c.types.map((t) => (ts.isIdentifier(t.expression) ? t.expression.text : null)))
    .filter(Boolean)
}

// Parse every source file; register class declarations and interface
// declarations by name. Interfaces feed the prop-collision check (rule 2).
const sources = new Map() // path -> SourceFile
const classes = new Map() // className -> { path, node, base }
const interfaces = new Map() // interfaceName -> { props: Set<string>, ext: string[] }
for (const path of collectTsFiles(SRC).sort()) {
  const sf = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
  sources.set(path, sf)
  const visit = (node) => {
    if (ts.isClassDeclaration(node) && node.name) {
      classes.set(node.name.text, { path, node, base: heritage(node)[0] })
    } else if (ts.isInterfaceDeclaration(node)) {
      const props = new Set()
      for (const m of node.members) {
        if (ts.isPropertySignature(m) && m.name && ts.isIdentifier(m.name)) props.add(m.name.text)
      }
      interfaces.set(node.name.text, { props, ext: heritage(node) })
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(sf, visit)
}

/** Does `name`'s `extends` chain reach ELEMENT_ROOT? Memoized; guards cycles. */
const elementCache = new Map()
function isElement(name, seen = new Set()) {
  if (name === ELEMENT_ROOT) return true
  if (!classes.has(name) || seen.has(name)) return false
  if (elementCache.has(name)) return elementCache.get(name)
  seen.add(name)
  const { base } = classes.get(name)
  const result = base ? isElement(base, seen) : false
  elementCache.set(name, result)
  return result
}

const STATIC = ts.SyntaxKind.StaticKeyword

/** The camelCase, JS-assignable members a class declares, keyed by name. A
 *  `#`-private member is skipped (it never creates a public `foo` key). An
 *  accessor is `paired` when the same class has both get and set. Computed /
 *  string-literal names are skipped — they aren't plain props React assigns. */
function ownMembers(node) {
  const get = new Map() // name -> accessor node (for line reporting)
  const set = new Set()
  const other = new Map() // name -> { kind: 'method' | 'field', node }
  for (const m of node.members) {
    if (m.modifiers?.some((mod) => mod.kind === STATIC)) continue
    if (!m.name || ts.isPrivateIdentifier(m.name) || !ts.isIdentifier(m.name)) continue
    const name = m.name.text
    if (ts.isGetAccessorDeclaration(m)) get.set(name, m)
    else if (ts.isSetAccessorDeclaration(m)) set.add(name)
    else if (ts.isMethodDeclaration(m)) other.set(name, { kind: 'method', node: m })
    else if (ts.isPropertyDeclaration(m)) other.set(name, { kind: 'field', node: m })
  }
  const members = new Map() // name -> { kind, node }
  for (const [name, node] of get) members.set(name, { kind: set.has(name) ? 'paired' : 'getter', node })
  for (const name of set) if (!get.has(name)) members.set(name, { kind: 'setter', node: null })
  for (const [name, info] of other) if (!members.has(name)) members.set(name, info)
  return members
}

/** Every assignable member on `className`'s prototype chain, resolved so an own
 *  member shadows an inherited one of the same name — matching how JS property
 *  lookup (and thus React's `el[key] = value`) sees the element. */
function resolveMembers(className) {
  const chain = []
  const seen = new Set()
  for (let cur = className; cur && classes.has(cur) && !seen.has(cur); cur = classes.get(cur).base) {
    seen.add(cur)
    chain.push(classes.get(cur))
  }
  const merged = new Map()
  for (const cls of chain.reverse()) {
    for (const [name, info] of ownMembers(cls.node)) merged.set(name, { ...info, path: cls.path })
  }
  return merged
}

/** All identifier-named attributes an element accepts (its own interface plus
 *  everything it `extends`), minus `on*` event handlers — React binds those via
 *  addEventListener, never as a property, so they can't clobber a member. */
function attrProps(interfaceName, seen = new Set()) {
  const iface = interfaces.get(interfaceName)
  if (!iface || seen.has(interfaceName)) return new Set()
  seen.add(interfaceName)
  const out = new Set()
  for (const p of iface.props) if (!/^on[A-Z]/.test(p)) out.add(p)
  for (const ext of iface.ext) for (const p of attrProps(ext, seen)) out.add(p)
  return out
}

const line = (path, node) =>
  node ? sources.get(path).getLineAndCharacterOfPosition(node.name.getStart(sources.get(path))).line + 1 : 0

const elements = [...classes].filter(([name]) => isElement(name))
const getterViolations = [] // rule 1: getter with no setter (a crash)
const collisions = [] // rule 2: an attribute name clobbers a method/field
const domCalls = [] // rule 3: a wrapper calls a method on an event target

for (const [className, { path }] of elements) {
  const readonly = new Set(READONLY_ALLOWLIST[className] ?? [])
  const members = resolveMembers(className)

  // Rule 1 — a getter with no setter throws when React assigns the property.
  for (const [name, m] of ownMembers(classes.get(className).node)) {
    if (m.kind !== 'getter' || readonly.has(name)) continue
    getterViolations.push({ name, rel: relative(ROOT, path), line: line(path, m.node) })
  }

  // Rule 2 — an attribute React can assign as a property must not land on a
  // method or plain field (silently overwriting it). A paired/setter accessor
  // is fine (intended reflection); a getter-only is already rule 1.
  for (const name of attrProps(className.replace(/Element$/, 'Attributes'))) {
    const m = members.get(name)
    if (!m || m.kind === 'paired' || m.kind === 'setter' || m.kind === 'getter') continue
    collisions.push({ name, kind: m.kind, className, rel: relative(ROOT, m.path), line: line(m.path, m.node) })
  }
}

// Rule 3 — a JSX wrapper invoking a method on an `e.currentTarget` / `e.target`
// handle. Parse each wrapper as TSX and flag any `CallExpression` whose callee
// is `<obj>.method` where `<obj>` (through parens / `as` / `!`) is a property
// access ending in `.currentTarget` or `.target`. Property *reads*
// (`e.currentTarget.value`) aren't calls, so they're untouched.
for (const path of collectTsxFiles(SRC).sort()) {
  const sf = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const rel = relative(ROOT, path)
  const allowed = new Set(WRAPPER_DOM_CALL_ALLOWLIST[rel] ?? [])
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression)
      if (ts.isPropertyAccessExpression(callee)) {
        const obj = unwrap(callee.expression)
        if (
          ts.isPropertyAccessExpression(obj) &&
          (obj.name.text === 'currentTarget' || obj.name.text === 'target')
        ) {
          const method = callee.name.text
          if (!allowed.has(method)) {
            const ln = sf.getLineAndCharacterOfPosition(callee.name.getStart(sf)).line + 1
            domCalls.push({ rel, line: ln, target: obj.name.text, method })
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(sf, visit)
}

getterViolations.sort((a, b) => a.rel.localeCompare(b.rel) || a.line - b.line)
collisions.sort((a, b) => a.rel.localeCompare(b.rel) || a.line - b.line)
domCalls.sort((a, b) => a.rel.localeCompare(b.rel) || a.line - b.line)

for (const v of getterViolations) {
  console.error(
    `${v.rel}:${v.line}  getter \`${v.name}\` has no setter. ` +
      `Give it a \`set ${v.name}()\`, rename it to \`#${v.name}\` (true private), ` +
      `or add it to READONLY_ALLOWLIST in scripts/lint-getters.mjs if it is a deliberate read-only property.`,
  )
}
for (const c of collisions) {
  console.error(
    `${c.rel}:${c.line}  ${c.kind} \`${c.name}\` collides with the \`${c.name}\` attribute of ${c.className}. ` +
      `React 19 assigns that prop as a property (\`el.${c.name} = value\`), overwriting this ${c.kind}. ` +
      `Rename the ${c.kind} to \`#${c.name}\` (true private) or rename the attribute.`,
  )
}
for (const d of domCalls) {
  console.error(
    `${d.rel}:${d.line}  \`e.${d.target}.${d.method}()\` calls a method on a DOM element in a JSX wrapper. ` +
      `The app DOM may render in a worker, so \`e.${d.target}\` is a serialized event snapshot, not a live node — ` +
      `an imperative call has nothing to run against. Move the coordination into the web component, or express ` +
      `it declaratively via an attribute/signal (see Calendar's \`focusSignal\`). ` +
      `See src/AGENTS.md → "JSX wrappers never hold a ref".`,
  )
}

const propHazards = getterViolations.length + collisions.length
const total = propHazards + domCalls.length
if (total) {
  if (propHazards) {
    console.error(
      `\n✗ ${propHazards} React-19 property-assignment hazard${propHazards === 1 ? '' : 's'}. ` +
        `React 19 assigns custom-element props as properties (\`key in el\` → \`el[key] = value\`). ` +
        `See src/AGENTS.md → "React 19 property assignment".`,
    )
  }
  if (domCalls.length) {
    console.error(
      `\n✗ ${domCalls.length} DOM-method call${domCalls.length === 1 ? '' : 's'} on an event target in a JSX wrapper. ` +
        `Wrappers must not invoke element methods — the app DOM may live in a worker. ` +
        `See src/AGENTS.md → "JSX wrappers never hold a ref".`,
    )
  }
  process.exit(1)
}
console.log(
  `✓ React-19 property rules: ${elements.length} element classes clean. ` +
    `Wrapper DOM-call rule: clean.`,
)
