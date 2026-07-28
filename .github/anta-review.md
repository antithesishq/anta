# Anta-specific review guidance

You are reviewing a PR for **Anta**, a portable design system (`@antadesign/anta`):
framework-agnostic `<a-*>` web components (`src/elements/`) plus JSX wrappers
(`src/components/`), and an Astro + Preact docs site (`site/`). The project's
The root `AGENTS.md` is loaded through `CLAUDE.md` — read it, then the closest
scoped `AGENTS.md` for every touched area. The checks below are the project-specific
invariants that matter most here and that a generic reviewer would miss. **Treat
violations of these as real findings, not nits**, and cite the offending file/line.
Skip a section when the diff doesn't touch it.

**Know which rules apply where — this is critical:**

- **The published packages** — `src/` (anta) and `stickers/src/` (stickers) —
  are the portable library that may run anywhere, including a Web Worker. The
  "Correctness & portability" rules below apply **only here**.
- **The docs site** — `site/` — is an ordinary Astro + Preact web app running on
  the main thread in a browser. **`useEffect`, other effect hooks, and browser
  APIs (`window`, `document`, etc.) are perfectly fine in `site/`** — do NOT flag
  them there. Only the "Docs site" section (and the relevant API/docs-sync
  points) apply to `site/`. Do not apply package rules to site code.

## Correctness & portability — packages only (`src/`, `stickers/src/`)

These apply to the published library, **not** to `site/`. The library's JSX may
be rendered from a **Web Worker**, and the host app may reconcile the light DOM
from a worker thread. The following are hard rules **for package code**:

- **No `useEffect` in package JSX wrappers.** `src/components/*.tsx` (and any
  `stickers/src/` wrappers) must never use `useEffect` (or other effect hooks
  that assume a DOM/main-thread lifecycle). Flag any introduction of one. (This
  does **not** apply to `site/` — effect hooks are fine in site islands.)
- **No browser/DOM APIs in package JSX.** Package JSX wrappers must not touch
  `window`, `document`, `navigator`, `localStorage`, timers tied to the DOM,
  etc. — the component may execute in a worker with no `document`. Logic that
  needs the DOM belongs in the web component's shadow internals, not the wrapper.
  (Again: `site/` code may use browser APIs freely.)
- **No host / light-DOM mutation from element JS.** An element class
  (constructor, `attributeChangedCallback`, handlers) must never `setAttribute`,
  set `className`, set inline `style`, or add/move/remove nodes on the **host**
  or anywhere in the light DOM. Only shadow-internal elements may be mutated
  (e.g. setting `--_percent` on an internal node). Cross-element coordination is
  in-memory JS only — never via the document.
- **ARIA lives in the JSX wrapper, not the element class.** `role`, `aria-*`,
  `tabindex` are added by `src/components/<Name>.tsx` as pass-through, never by
  the element constructor. (Exception: a wrapper passing a value through, e.g.
  `aria-valuenow={value}`.)
- **Boolean attributes — emit presence, match presence.** Wrappers map a boolean
  prop to `prop ? '' : undefined` (never the raw boolean, never `'true'`). The
  element CSS must match by presence — `a-button[disabled]`, **not**
  `[disabled="true"]`. The element attribute type in `general_types.ts` is
  `boolean | ''`. ARIA is the exception: keep it string-valued
  (`aria-pressed={selected ? 'true' : undefined}`, typed `'true' | 'false' | boolean`).
- **Elements are SSR-safe and self-registering.** Each `a-{name}.ts` imports its
  own CSS at the top and calls `register_a_{name}()` at the bottom, guarded by
  `typeof customElements !== 'undefined'`. Elements must only be imported
  client-side.

## Tokens & CSS

- **Component-token-first.** New CSS vars are `--{component}-*` with literal
  values. The only global tokens are the color roles in `src/tokens.css`
  (`--text-*`, `--bg-*`, `--border-*` per tone). Do **not** add new global
  spacing/size/timing scales or primitive palette tokens, and do not "clean up"
  component-local literals by routing them through globals.
- **`@layer anta`** — Anta CSS is wrapped in `@layer anta { … }` so un-layered
  consumer CSS can override it. Flag new rules outside the layer.
- **`--_` prefix** for shadow-internal-only variables set from JS.
- **Dark mode** via a `.dark` ancestor selector, not `@media (prefers-color-scheme)`.

## API & docs sync

- **`@defaultValue` TSDoc** on every optional prop whose default isn't obvious
  (enums, `size`/`level`/`max`, default tone/priority). State the default only in
  the tag, not also in prose. Skip for booleans defaulting to `false` and for
  required props.
- **Docs-in-sync (same PR).** When a PR renames a prop, changes a default, adds
  or removes a token, or changes a type union / behavior, the matching
  `site/src/pages/components/{name}.mdx` must be updated in the same change. Flag
  drift.
- **`CHANGELOG.md` is consumer-facing only.** It documents `@antadesign/anta`
  package changes (under `src/`). Docs-site-only changes (`.mdx`, demos, layout)
  must **not** appear in the changelog. Conversely, a consumer-facing API change
  with no changelog entry is a finding.
- **Reuse the prop vocabulary** — `priority` / `tone` / `size` / `level`. Don't
  introduce a new `variant` or `color` prop for concepts already covered.

## Build & packaging

- **New component plumbing.** A new component must be wired into all of: the
  `build:css` script (CSS isn't auto-copied in esbuild non-bundle mode), the
  `build:js` entry set, both barrels (`src/index.ts` and `src/elements/index.ts`),
  `A{Name}Attributes` in `general_types.ts`, and `JSX.IntrinsicElements` in
  `jsx-runtime.ts`. Missing CSS in `build:css` ships a broken component.
- **`dist/` is never committed** — flag any `dist/` files in the diff.
- **Stickers stay separate.** All sticker code/artwork/`lottie-web` lives in
  `stickers/`, never in core anta `src/`.

## Docs site

- **Prefer JSX wrappers over raw `<a-*>`** in site pages/islands (raw
  `<a-icon size>` collapses to 0×0 on iOS Safari). Raw elements are acceptable
  only inside playground code examples that intentionally show that API.
- **Use the shared `<Playground>`** for component demos rather than hand-rolled
  per-component islands; keep `initialCode` in a sibling `{name}.demo.ts`.
