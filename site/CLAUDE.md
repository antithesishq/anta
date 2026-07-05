# Anta docs site (`site/`)

This is the documentation site for `@antadesign/anta`, deployed at anta.design. It is **not** part of the published npm package — anything that ships to consumers lives in the repo root (`src/`, `dist/`).

Stack: Astro 5 static output, Preact islands (`@astrojs/preact`, with `compat: true` so `react` aliases to `preact/compat`), MDX for component pages, astro-expressive-code for syntax-highlighted code blocks, Monaco editor for the interactive playground.

The docs site consumes Anta via the workspace symlink (`"@antadesign/anta": "workspace:*"`), so Anta must be built first (`pnpm run build` at the repo root) before `site/` resolves `dist/` artifacts.

## CSS

- **All component styles stay co-located** (a `.astro` scoped `<style>` or a `.module.css`). `astro.config.mjs` sets `build.inlineStylesheets: 'never'` so scoped styles are emitted into *linked* bundles, never inlined into the page `<head>` — Astro's per-page inline path can land present-but-inert in production for a component used inside MDX wrapping a hydrated island. Per-route CSS code-splitting stays on (default), so heavy island CSS (Monaco/Playground) loads only where it's used.
- For a one-off style that must stay inline and untouched by Astro's pipeline, use **`<style is:inline>`** — it's rendered verbatim (no scoping, bundling, or hoisting).
- **In MDX docs pages, a styling example's live CSS goes in a `<style is:inline>` placed *inside* its `<Preview>` (as a child, after the element), targeting a demo class on that preview's element; the folded recipe under the preview is that same CSS.** Putting the `<style>` inside the preview means the applied rule is literally in the preview's DOM, right next to the element it styles — a reader can inspect the preview and find exactly the rule the recipe shows — and it's never a far-away or page-wide stylesheet. Don't hide the applied CSS behind a `style=""` attribute either: an attribute can't express what these examples need (`::part`, `::before`, `:hover`, `:state`, descendant selectors) — those are only legal in a stylesheet. Use a demo class (e.g. `.hide-chevron`, `.code-like`) so each example is self-identifying and examples don't collide, and tell the reader (once, near the first example) that the class is just for the demo and they'd swap their own selector. `expander.mdx`'s "Styling the chevron & header" section is the reference pattern.
- **`pnpm --filter anta-site lint:css` runs Stylelint** (config: `site/stylelint.config.mjs`) over `src/**/*.{css,astro}`, including the `<style>` blocks inside `.astro` files (`postcss-html` custom syntax). It's a CI step. The config is tuned for *correctness*, not house style — most stylistic rules are off; the point is to catch CSS that the browser would silently drop. **Watch for `*/` inside a CSS comment** — e.g. writing `data-*/aria-*` ends the comment early and spills the rest into the stylesheet as invalid CSS, which (when bundled with other components) silently drops their rules in production. Stylelint now flags this.

## Playground

The `<Playground>` component (`site/src/components/Playground.tsx`) is the playground that lands on `/components/<name>/` pages. It is the largest single component in this directory and is intentionally self-contained so that a future migration to a dedicated package (`@antadesign/sandbox` or similar) and a dedicated repository can lift it out without disturbing the rest of the site.

Supporting code:

- `site/lib/sandbox/` — `bundler.ts`, `modules.ts`, `prop-patch.ts`, `prop-read.ts`, `props-form.ts`, `locate-tag.ts`. These are the long-lived primitives. When the sandbox moves to its own package, these go with it; the docs site is left with just `Playground.tsx` consuming the extracted package.
  - **`modules.ts` maps the imports the sandbox exposes to playground code.** The whole `@antadesign/anta` barrel is exposed automatically — `moduleManifest['@antadesign/anta']` and `getDemoModules()['@antadesign/anta']` are both derived from `Object.keys(import * as anta)`, so **any component (current or future) is importable/passable as children with no edit here**. Other paths (`preact`, `preact/hooks`, `@antadesign/anta/elements` side-effect) stay curated — add a new *non-anta* module to **both** the manifest and `getDemoModules()`, or `import { X }` resolves to `undefined` and the preview renders blank.
- `site/scripts/copy-esbuild-wasm.mjs` — copies `esbuild.wasm` into `site/public/` so the iframe can fetch `/esbuild.wasm` directly.
- `site/scripts/build-iframe-runtime.mjs` — pre-builds `site/public/iframe-anta-runtime.js`, a self-contained ESM bundle of `@antadesign/anta/elements` + per-element CSS that the iframe dynamic-imports to register custom elements on its own `customElements` registry.

### Monaco is bundled from npm (no CDN)

Monaco lives in `dependencies` as `monaco-editor` and is bundled by Vite into the playground's lazy chunk. The wiring is in `Playground.tsx`'s mount effect:

```ts
import('monaco-editor')                                                         // namespace
import('monaco-editor/esm/vs/editor/editor.worker?worker')                      // fallback worker
import('monaco-editor/esm/vs/language/typescript/ts.worker?worker')             // TS service
import('monaco-editor/esm/vs/language/css/css.worker?worker')                   // CSS tab
import('@monaco-editor/react')                                                  // React wrapper
```

After load, `MonacoEnvironment.getWorker(_, label)` returns a fresh `Worker` for `typescript`/`javascript` (ts.worker), `css`/`scss`/`less` (css.worker), and anything else (editor.worker). `loader.config({ monaco: monacoNs })` is what makes `@monaco-editor/react` skip its default CDN fetch.

Trade-off: ~1.5 MB Monaco enters the `/components/<name>/` lazy chunk. The docs site is self-contained — no third-party JS fetch, offline-correct, and the runtime version is whatever `package.json` says.

We only register workers for languages the playground actually uses. Adding JSON/HTML support means adding two more `?worker` imports and switch arms.

## Adding a component docs page

Create `site/src/pages/components/{name}.mdx` with `layout: ../../layouts/DocsLayout.astro`. For an interactive demo, drop `<Playground client:visible component="…" layout="side" initialCode={…} />` near the top.

**Always use the shared `<Playground>` for the interactive demo — never hand-roll a bespoke per-component playground island.** The shared one gives a uniform editor + auto props form (from `api.json`) + isolated preview iframe across every page, and is slated for extraction into its own package; a one-off island fragments that and drifts. The `initialCode` is plain TSX — imports followed by a trailing JSX block that the bundler auto-wraps in a `<>…</>` fragment, so it can hold **multiple sibling or nested elements** (e.g. several anchors each wrapping a `<Tooltip>`); the props panel binds to the first instance of `component`. Keep `initialCode` in a sibling `{name}.demo.ts` (`export default \`…\``) so Astro's MDX pipeline doesn't mangle the template literal's indentation. Reserve custom islands for demos the playground genuinely can't express (e.g. a self-animating `AnimatedProgress`).

The preview iframe loads `tokens.css` + `reset.css` + the registered elements via `site/scripts/build-iframe-runtime.mjs` (→ `public/iframe-anta-runtime.js`), so component CSS that references `--bg-*` / `--text-*` / `--border-*` resolves the same as on the docs site. If a new component's appearance depends on a stylesheet not in that bundle, add it there.

**`site/src/layouts/element-host-styles.css` is a hand-maintained aggregator** — it `@import`s every element's `dist/elements/a-*.css` so `DocsLayout.astro` can link the host/light-DOM chrome render-blocking in `<head>` (otherwise the element CSS only arrives when the client `@antadesign/anta/elements` JS registers the elements, flashing an unstyled box on load). **When you add a new component, add its `a-{name}.css` `@import` here too** (the same manual step as `build:css` and `elements/index.ts`), or its host chrome will flash before upgrade on the docs site.

```sh
pnpm run dev                 # ← run from the REPO ROOT (see below); the dev command for all work
cd site && pnpm run build    # static build (site only)
```

**Run the dev server with `pnpm run dev` from the repo root, not `cd site && pnpm run dev`.** The root command runs the site's `astro dev` *and* a `nodemon` watcher that rebuilds anta's `dist` on `src` changes, so package edits propagate to the running site; the site-only command does not rebuild anta. (See "Running the dev server" in the root `CLAUDE.md`.)

The site's own `pnpm run dev` (which the root command invokes under the hood) chains through `docs:api` (typedoc → `src/api.json`), `docs:pages` (regenerate index.mdx from README.md), `docs:wasm` (copy esbuild.wasm), and `docs:iframe-runtime` (rebuild iframe runtime) before starting Astro.

## Docs prose style

Prose voice for the whole repo lives in the repo-root [`WRITING.md`](../WRITING.md):
lead with the point, give values not adjectives, rare em dashes, no "not X, but Y"
framing, no hype or signposts. It governs docs pages, source comments, and TSDoc
alike. Read it before writing or editing page copy.

Most existing pages predate that guide and read in a denser voice with more dashes;
bring a section into voice when you edit it. This file covers the page *structure*
(below); `WRITING.md` covers the words.

## Component reference tables

- **Props table is automatic.** `<PropsTable component="Button" />` derives everything from `src/api.json` (typedoc) and `PropsTable.astro` owns the rendering, so it's uniform across pages — don't hand-format props. How it renders (for reference, all in `PropsTable.astro`): prop name = monospace, weight 475, no code pill; the optional `?` is a separate `--text-5` element with `user-select: none` (double-click selects just the name, copy omits the `?`); the type column lists each union member on its own line (no `|`), with **type names** (`string`/`number`/`boolean` and named types like `IconShape`) as plain `--text-3` monospace and **literal values** as copyable `<code>` pills with the surrounding quotes stripped (e.g. `neutral`); "no value" em-dashes in the Type/Default columns use `--text-5`.
- **Each component page ends with a `## Styling` `<Disclosure>`, not a token table.** Per the root CLAUDE.md "Documented styling surface" doctrine, it leads with the props + the single `--{component}-tone-source` custom-colour knob, then shows how to customise everything else with **plain CSS** (light-DOM components) or **`::part(...)`** (shadow-DOM components) — with a short `tsx folded` / `css folded` example. Do **not** enumerate the internal per-state output tokens (`--*-fill*`, `--*-bg`, `--*-fg`, …) as an override table, and examples must not set those `--*` vars. If you do list a kept knob (`--*-tone-source`, `--checkbox-mask-*`, `--expander-gutter`), it stays normal `` `code` `` (copyable code-pill styling is automatic).
