# Anta docs-site guidance (`site/`)

This is the documentation site for `@antadesign/anta`, deployed at anta.design. It is **not** part of the published npm package — anything that ships to consumers lives in the repo root (`src/`, `dist/`).

Stack: Astro 5 static output, Preact islands (`@astrojs/preact`, with `compat: true` so `react` aliases to `preact/compat`), MDX for component pages, astro-expressive-code for syntax-highlighted code blocks, Monaco editor for the interactive playground.

The docs site consumes Anta via the workspace symlink (`"@antadesign/anta": "workspace:*"`), so Anta must be built first (`pnpm run build` at the repo root) before `site/` resolves `dist/` artifacts.

## Site topology

- `src/layouts/DocsLayout.astro` is the sidebar and main-content shell; it imports `@antadesign/anta/elements` in a client-side script.
- `src/pages/` holds static `.astro` pages and MDX component documentation.
- `src/components/` holds Preact islands. Use `client:load` or `client:visible`; `Playground.tsx` is the shared interactive component-demo surface, mounted by the prebuilt `PlaygroundEmbed.astro` runtime so it is not a Vite island. Custom islands are for demos it cannot express.
- `src/styles/base.css` owns the minimal site reset and typography.

Astro renders static output. The site uses MDX and astro-expressive-code, with GFM, math, directive, definition-list, and attributes Remark plugins; slug, autolink-headings, and MathJax Rehype plugins. Preact compat aliases `react` to `preact/compat`, so anta's JSX runtime works without `configure()`.

## CSS

- **All component styles stay co-located** (a `.astro` scoped `<style>` or a `.module.css`). `astro.config.mjs` sets `build.inlineStylesheets: 'never'` so scoped styles are emitted into *linked* bundles, never inlined into the page `<head>` — Astro's per-page inline path can land present-but-inert in production for a component used inside MDX wrapping a hydrated island. Per-route CSS code-splitting stays on (default), so heavy island CSS (Monaco/Playground) loads only where it's used.
- For a one-off style that must stay inline and untouched by Astro's pipeline, use **`<style is:inline>`** — it's rendered verbatim (no scoping, bundling, or hoisting).
- **In MDX docs pages, a styling example's live CSS goes in a `<style is:inline>` placed *inside* its `<Preview>` (as a child, after the element), targeting a demo class on that preview's element; the folded recipe under the preview is that same CSS.** Putting the `<style>` inside the preview means the applied rule is literally in the preview's DOM, right next to the element it styles — a reader can inspect the preview and find exactly the rule the recipe shows — and it's never a far-away or page-wide stylesheet. Don't hide the applied CSS behind a `style=""` attribute either: an attribute can't express what these examples need (`::part`, `::before`, `:hover`, `:state`, descendant selectors) — those are only legal in a stylesheet. Use a demo class (e.g. `.hide-chevron`, `.code-like`) so each example is self-identifying and examples don't collide, and tell the reader (once, near the first example) that the class is just for the demo and they'd swap their own selector. `expander.mdx`'s "Styling the chevron & header" section is the reference pattern.
- **`pnpm --filter anta-site lint:css` runs Stylelint** (config: `site/stylelint.config.mjs`) over `src/**/*.{css,astro}`, including the `<style>` blocks inside `.astro` files (`postcss-html` custom syntax). It's a CI step. The config is tuned for *correctness*, not house style — most stylistic rules are off; the point is to catch CSS that the browser would silently drop. **Watch for `*/` inside a CSS comment** — e.g. writing `data-*/aria-*` ends the comment early and spills the rest into the stylesheet as invalid CSS, which (when bundled with other components) silently drops their rules in production. Stylelint now flags this.

## ClientRouter (view transitions)

`DocsLayout.astro` renders Astro's `<ClientRouter />`: navigation swaps the page in place instead of reloading. The custom-element registry, fonts, and loaded CSS survive, so `a-*` elements upgrade instantly on every page, and the sidebar (`transition:persist="sidebar"`) keeps its scroll position and the hydrated ThemeSwitcher island. This changes the rules for every script and head element on the site:

- **Scripts run once per session.** The router never re-executes a script it has already seen (module scripts by URL, inline scripts by content). Anything that touches a specific page's DOM at module top level only ever sees the *first* page. Two sanctioned patterns:
  1. **Document-level delegation** (`document.addEventListener` + `closest()`) for event handling — see the drawer/theme-toggle handlers in `DocsLayout.astro` and the header-anchor handler in `Disclosure.astro`.
  2. **`document.addEventListener('astro:page-load', init)`** for per-page DOM scans/binding — fires on the initial load *and* after every swap; elements are fresh each time so re-binding never double-binds. See `CoverageMatrix.astro`.
  Never bind window/document-level listeners inside an `astro:page-load` handler (they'd stack once per navigation) — bind those at module level.
- **Delegated handlers that `preventDefault()` a link click must bind in the capture phase** (`addEventListener(…, true)`). The router's own click listener is bubble-phase and registered first; it honors `defaultPrevented` only if your handler ran before it. See `data-preserve-scroll` and `Disclosure.astro`.
- **Head elements are diffed on swap** — anything the incoming page's HTML doesn't contain is removed. A runtime-mutated head element survives only with `data-astro-transition-persist="<id>"` (the router then keeps the *live* node and discards the incoming copy). Persist ids in use: `sidebar` (the `<aside>`), `palette` (the theme `<link>`), `theme-color` (the mutated meta).
- **`<html>` attributes are replaced wholesale on swap.** The runtime `.dark` class is re-stamped onto `e.newDocument` in an `astro:before-swap` hook in `DocsLayout.astro` — any future runtime root attribute needs the same treatment.
- **Never `document.write`.** It only works during a full page parse; under the router it silently no-ops (this was the original palette-loading bug). Pre-paint work belongs in an `is:inline` head script that mutates elements already parsed above it.
- **Theme switching**: one stable `<link id="palette-link">` in the layout head, `href` is the single switch point (`/themes/default.css` stub ↔ `/themes/anta.css`, generated by `scripts/copy-theme-anta.mjs`). A future theme is a new file under `public/themes/` plus map entries in `ThemeSwitcher.tsx` and the inline palette script. The link element itself is never created or removed at runtime.
- **Islands and page state die with the page they're on.** `transition:persist` only carries an element to pages whose HTML also renders a matching persist id — it cannot preserve a page-exclusive island across leave-and-return. State that must survive navigation goes to storage (see `ThemingLab.tsx`, sessionStorage key `anta-theming-lab`).
- **Restoring stored state into an SSR'd island happens in a mount effect, never in the `useState` initializer.** Preact skips attribute patching during hydration, so initializer-restored state silently desyncs from the server-rendered DOM (stale `hidden`/`value` attributes). A post-mount `setState` is a normal update and patches everything (see `ThemingLab.tsx`).
- **Swapped-in subtrees upgrade custom elements parent-first.** Anta group elements (`a-tabs`, `a-radio-group`) defer their first child sync a microtask for exactly this reason (see `childrenReady` in `src/elements/a-tabs.ts`). A new element class that reads or writes its custom-element *children* at connect time must do the same, or swapped-in pages render it dead while full loads look fine.

## Playground

The `<Playground>` component (`site/src/components/Playground.tsx`) is the playground that lands on `/<name>/` pages. It is the largest single component in this directory and is intentionally self-contained so that a future migration to a dedicated package (`@antadesign/sandbox` or similar) and a dedicated repository can lift it out without disturbing the rest of the site. Pages import `PlaygroundEmbed.astro`, which serializes its props into a host for the prebuilt runtime.

Supporting code:

- `site/lib/sandbox/` — `bundler.ts`, `modules.ts`, `prop-patch.ts`, `prop-read.ts`, `props-form.ts`, `locate-tag.ts`. These are the long-lived primitives. When the sandbox moves to its own package, these go with it; the docs site is left with just `Playground.tsx` consuming the extracted package.
  - **`modules.ts` maps the imports the sandbox exposes to playground code.** The whole `@antadesign/anta` barrel is exposed automatically — `moduleManifest['@antadesign/anta']` and `getDemoModules()['@antadesign/anta']` are both derived from `Object.keys(import * as anta)`, so **any component (current or future) is importable/passable as children with no edit here**. Other paths (`preact`, `preact/hooks`, `@antadesign/anta/elements` side-effect) stay curated — add a new *non-anta* module to **both** the manifest and `getDemoModules()`, or `import { X }` resolves to `undefined` and the preview renders blank.
- `site/scripts/copy-esbuild-wasm.mjs` — copies `esbuild.wasm` into `site/public/` so the iframe can fetch `/esbuild.wasm` directly.
- `site/scripts/build-iframe-runtime.mjs` — pre-builds `site/public/iframe-anta-runtime.js`, a self-contained ESM bundle of `@antadesign/anta/elements` + per-element CSS that the iframe dynamic-imports to register custom elements on its own `customElements` registry.
- `site/scripts/build-playground-runtime.mjs` — pre-builds the changing editor app and its CSS, plus independent content-hashed Monaco, Shiki, and compiler bundles in `site/public/playground/`. Monaco includes its workers as blobs. It runs before both dev and production builds, so do not change the Playground back into a hydrated Astro island: that would reintroduce Vite's source-module graph in dev.
  The root dev watcher also rebuilds it after changes to its source or
  `site/lib/sandbox/`; wait for the runtime rebuild before refreshing a local
  Playground page.

### Props annotations

Use `/** @play props Title */` immediately before a demo's JSX component or a
`const` / `let` / `var` object-literal declaration to add a Props-panel section.
Component sections use the typed API schema; object sections expose the current
literal leaves, including nested paths and array expressions. Keep non-literal
structure in the Code tab. A single annotated section opens by default; when a
demo has multiple sections, they all start folded. Legacy `# Title` JSDoc
headings remain supported for existing JSX examples.

### Monaco is bundled from npm (no CDN)

Monaco lives in `dependencies` as `monaco-editor` and is built into its own cached runtime. `Playground.tsx` dynamically imports that generated bundle, while `playground-monaco.ts` owns the Monaco and worker imports:

```ts
import * as monaco from 'monaco-editor'                                         // namespace
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&inline'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker&inline'
```

`Playground.tsx` keeps the small `@monaco-editor/react` bridge in the app bundle
so it shares the app's Preact instance. After load, `MonacoEnvironment.getWorker(_, label)` returns a fresh `Worker` for `typescript`/`javascript` (ts.worker), `css`/`scss`/`less` (css.worker), and anything else (editor.worker). `loader.config({ monaco: monacoNs })` is what makes `@monaco-editor/react` skip its default CDN fetch.

The docs site is self-contained — no third-party JS fetch, offline-correct, and the runtime version is whatever `package.json` says. The runtime's content hash lets it remain cached while app code changes.

We only register workers for languages the playground actually uses. Adding JSON/HTML support means adding two more `?worker` imports and switch arms.

## Adding a component docs page

Create `site/src/pages/{name}.mdx` with `layout: ../layouts/DocsLayout.astro` (component pages are served at the site root, `/{name}/`, not under `/components/`; add the slug to `site/lib/component-slugs.ts` and the sidebar nav in `DocsLayout.astro`). For an interactive demo, import `PlaygroundEmbed.astro` as `Playground` and drop `<Playground component="…" layout="side" initialCode={…} />` near the top. It is mounted by the shared prebuilt runtime, so it does not take a `client:*` directive.

**Always use the shared `<Playground>` for the interactive demo — never hand-roll a bespoke per-component playground island.** The shared one gives a uniform editor + auto props form (from `api.json`) + isolated preview iframe across every page, and is slated for extraction into its own package; a one-off island fragments that and drifts. The `initialCode` is plain TSX — imports followed by a trailing JSX block that the bundler auto-wraps in a `<>…</>` fragment, so it can hold **multiple sibling or nested elements** (e.g. several anchors each wrapping a `<Tooltip>`); the props panel binds to the first instance of `component`. Keep `initialCode` in a sibling `{name}.demo.ts` (`export default \`…\``) so Astro's MDX pipeline doesn't mangle the template literal's indentation. Reserve custom islands for demos the playground genuinely can't express (e.g. a self-animating `AnimatedProgress`).

**Demos use Anta's own components wherever one exists — down to the incidental controls.** Any control the design system ships — `Checkbox`, `Input`, `Button`, `RadioGroup`, `Select`, `Tabs`, `Tag`, `Tooltip`, … — is what a demo reaches for, whether it's the component under test or just a knob beside it (a "simulate loading" toggle, a filter field, a segmented switcher). This holds in every demo surface: Playground `initialCode`, a hydrated island (`src/components/*.tsx`), and inline `.mdx` examples. The point is that every example dogfoods the library and looks/behaves like real usage; a raw `<input>` / `<button>` / `<select>` next to an Anta component reads as an oversight. Drop to a raw HTML control **only** when there's genuinely no Anta equivalent yet (e.g. `<input type="range">` — there's no slider component). The `Playground` island itself is exempt — it's editor/props-form infrastructure kept standalone for extraction, not a component demo.

The preview iframe loads Anta's built `bundle.js` + `bundle.css` through `site/scripts/build-iframe-runtime.mjs`. The iframe re-bundles that same package entry with its own Preact instance because custom elements and renderer state are scoped to its document. `DocsLayout.astro` also imports `bundle.css` render-blocking and registers elements from `bundle`, so the shell and every playground share Anta's shipped runtime and styles. New components enter both automatically through `src/index.ts` and `src/elements/index.ts`; no site-side stylesheet aggregator is needed.

```sh
pnpm run dev                 # ← run from the REPO ROOT (see below); the dev command for all work
cd site && pnpm run build    # static build (site only)
```

**Run the dev server with `pnpm run dev` from the repo root, not `cd site && pnpm run dev`.** The root command runs the site's `astro dev` *and* a `nodemon` watcher that rebuilds anta's `dist` on `src` changes, so package edits propagate to the running site; the site-only command does not rebuild anta. (See "Common commands" in the root [`AGENTS.md`](../AGENTS.md).)

The site's own `pnpm run dev` (which the root command invokes under the hood) chains through `docs:api` (typedoc → `src/api.json`), `docs:pages` (regenerate changelog partials), `docs:wasm` (copy esbuild.wasm), `docs:iframe-runtime` (rebuild iframe runtime), and `docs:playground-runtime` (rebuild the editor runtime) before starting Astro.

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
- **Each component page ends with a `## Styling` `<Disclosure>`, not a token table.** Per the [`../src/AGENTS.md`](../src/AGENTS.md) "Documented styling surface" doctrine, it leads with the props + the single `--{component}-tone-source` custom-color knob, then shows how to customize everything else with **plain CSS** (light-DOM components) or **`::part(...)`** (shadow-DOM components) — with a short `tsx folded` / `css folded` example. Do **not** enumerate the internal per-state output tokens (`--*-fill*`, `--*-bg`, `--*-fg`, …) as an override table, and examples must not set those `--*` vars. If you do list a kept knob (`--*-tone-source`, `--checkbox-mask-*`, `--expander-gutter`), it stays normal `` `code` `` (copyable code-pill styling is automatic).
