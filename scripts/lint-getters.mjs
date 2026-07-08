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
  AMenuElement: ['isControlled', 'isSubmenu', 'triggerAnchor', 'isOpen'],
  ARadioGroupElement: ['value'],
  ATabsElement: ['value'],
  ACheckboxElement: ['checked', 'indeterminate'],
}

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

/** The name of the class a declaration `extends`, or undefined. */
function baseName(node) {
  const clause = node.heritageClauses?.find((c) => c.token === ts.SyntaxKind.ExtendsKeyword)
  const expr = clause?.types[0]?.expression
  return expr && ts.isIdentifier(expr) ? expr.text : undefined
}

// Parse every source file and register its class declarations by name.
const sources = new Map() // path -> SourceFile
const classes = new Map() // className -> { path, node, base }
for (const path of collectTsFiles(SRC).sort()) {
  const sf = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
  sources.set(path, sf)
  const visit = (node) => {
    if (ts.isClassDeclaration(node) && node.name) {
      classes.set(node.name.text, { path, node, base: baseName(node) })
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

/** Getter/setter violations for one element class, scoped to its own members. */
function scan(className, path, node) {
  const readonly = new Set(READONLY_ALLOWLIST[className] ?? [])
  const getters = [] // { name, member }
  const setters = new Set() // name

  for (const m of node.members) {
    if (!ts.isGetAccessorDeclaration(m) && !ts.isSetAccessorDeclaration(m)) continue
    if (m.modifiers?.some((mod) => mod.kind === STATIC)) continue // on the constructor, never assigned as an instance prop
    if (ts.isPrivateIdentifier(m.name)) continue // #private — invisible to React
    if (!ts.isIdentifier(m.name)) continue // computed / string-literal names aren't plain props
    if (ts.isSetAccessorDeclaration(m)) setters.add(m.name.text)
    else getters.push({ name: m.name.text, member: m })
  }

  const sf = sources.get(path)
  const violations = []
  for (const { name, member } of getters) {
    if (setters.has(name)) continue // assignable — paired in this class
    if (readonly.has(name)) continue // explicit, reviewed read-only opt-out
    const line = sf.getLineAndCharacterOfPosition(member.name.getStart(sf)).line + 1
    violations.push({ name, line, rel: relative(ROOT, path) })
  }
  return violations
}

const elements = [...classes].filter(([name]) => isElement(name))
const all = elements
  .flatMap(([name, { path, node }]) => scan(name, path, node))
  .sort((a, b) => a.rel.localeCompare(b.rel) || a.line - b.line)

for (const v of all) {
  console.error(
    `${v.rel}:${v.line}  getter \`${v.name}\` has no setter. ` +
      `Give it a \`set ${v.name}()\`, rename it to \`#${v.name}\` (true private), ` +
      `or add it to READONLY_ALLOWLIST in scripts/lint-getters.mjs if it is a deliberate read-only property.`,
  )
}

if (all.length) {
  console.error(
    `\n✗ ${all.length} getter${all.length === 1 ? '' : 's'} without a setter. ` +
      `React 19 assigns custom-element props as properties, so a getter-only ` +
      `property throws on assignment. See CLAUDE.md → "React 19 property assignment".`,
  )
  process.exit(1)
}
console.log(`✓ getter/setter rule: ${elements.length} element classes clean.`)
