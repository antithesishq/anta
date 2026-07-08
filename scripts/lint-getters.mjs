#!/usr/bin/env node
/**
 * lint-getters.mjs — enforce the React 19 getter/setter rule on the web
 * components in `src/elements`.
 *
 * React 19 applies props to a custom element as JS *properties* when a property
 * of that name exists anywhere on the prototype chain: `key in el` → `el[key] =
 * value`. A getter with no setter makes that assignment throw
 * ("Cannot set property X of #<AXElement> which has only a getter"), which
 * unmounts the consumer's tree. A TypeScript `private` getter does NOT help —
 * `private` is erased at compile time, so the getter is a real, visible
 * prototype accessor at runtime. Only a `#name` (true ECMAScript private)
 * accessor is invisible to `key in el`.
 *
 * So every accessor `get X()` on an element class must be one of:
 *   1. `get #X()`            — truly private; React can't see it, and
 *                              nothing outside the class reads it.
 *   2. paired with `set X()`  — assignable; the setter reflects the value
 *                              (usually to the backing attribute).
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
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ELEMENTS_DIR = join(ROOT, 'src', 'elements')

/**
 * Getters that are intentionally read-only public properties: native mirrors, or
 * state whose write channel is a *different* attribute (usually `state`). Safe
 * without a setter only because nothing passes them as a JSX prop, so React 19
 * never assigns them. Keyed by element filename → getter names.
 */
const READONLY_ALLOWLIST = {
  'a-input.ts': ['validity', 'validationMessage', 'willValidate'],
  'a-menu.ts': ['isControlled', 'isSubmenu', 'triggerAnchor', 'isOpen'],
  'a-radio-group.ts': ['value'],
  'a-tabs.ts': ['value'],
  'a-checkbox.ts': ['checked', 'indeterminate'],
}

/** Accessor declaration: optional modifiers, then `get`/`set`, a name (which
 *  may be `#`-private), and an opening paren. `getFoo(` / `this.getAttribute(`
 *  don't match — `get`/`set` must be a standalone keyword followed by a space.
 *  Group 1 captures the modifiers so `static` accessors can be skipped: they
 *  live on the constructor, not instances, so React never assigns to them. */
const ACCESSOR = /^\s*((?:public\s+|protected\s+|private\s+|static\s+|override\s+)*)(get|set)\s+(#?[A-Za-z_$][\w$]*)\s*\(/

function scan(file, basename) {
  const readonly = new Set(READONLY_ALLOWLIST[basename] ?? [])
  const lines = readFileSync(file, 'utf8').split('\n')
  const getters = new Map() // name -> line index
  const setters = new Set() // name
  lines.forEach((line, i) => {
    const m = ACCESSOR.exec(line)
    if (!m) return
    const [, mods, kind, name] = m
    if (/\bstatic\b/.test(mods)) return // static accessors aren't instance props
    if (kind === 'set') setters.add(name)
    else getters.set(name, i)
  })

  const violations = []
  for (const [name, i] of getters) {
    if (name.startsWith('#')) continue // truly private — invisible to React
    if (setters.has(name)) continue // assignable
    if (readonly.has(name)) continue // explicit, reviewed read-only opt-out
    violations.push({ name, line: i + 1 })
  }
  return violations
}

const files = readdirSync(ELEMENTS_DIR)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))

let total = 0
for (const basename of files) {
  const violations = scan(join(ELEMENTS_DIR, basename), basename)
  if (!violations.length) continue
  total += violations.length
  for (const v of violations) {
    console.error(
      `src/elements/${basename}:${v.line}  getter \`${v.name}\` has no setter. ` +
        `Give it a \`set ${v.name}()\`, rename it to \`#${v.name}\` (true private), ` +
        `or add it to READONLY_ALLOWLIST in scripts/lint-getters.mjs if it is a deliberate read-only property.`,
    )
  }
}

if (total) {
  console.error(
    `\n✗ ${total} getter${total === 1 ? '' : 's'} without a setter. ` +
      `React 19 assigns custom-element props as properties, so a getter-only ` +
      `property throws on assignment. See CLAUDE.md → "React 19 property assignment".`,
  )
  process.exit(1)
}
console.log(`✓ getter/setter rule: ${files.length} element files clean.`)
