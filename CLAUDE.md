# Anta — Antithesis Design System

Published as `@antadesign/anta` on npm. Portable UI component library. Works in React apps out of the box, in Preact via compat aliasing (`react` → `preact/compat`), and in custom runtimes via `configure()`.

This repo is a pnpm workspace with **two publishable packages** plus the docs site:
- `@antadesign/anta` — this package, at the repo root (`src/`, `dist/`).
- `@antadesign/stickers` — the sticker pack, in top-level [`stickers/`](stickers/CLAUDE.md). It owns the `<a-sticker>` / `<a-sticker-animated>` elements, the `Sticker` / `StickerAnimated` wrappers, the artwork, and the **only** `lottie-web` dependency. It depends on `@antadesign/anta` for the JSX runtime and shared helpers. Kept separate so anta carries no animation runtime. **Anything sticker-related — components, tokens, docs page, the generator — lives there, not here.**
- `site/` — the docs site (not published).

## Architecture

Two tiers per component:

- **`src/elements/`** — Web components (custom elements). Attribute-driven, shadow DOM for rendering, plain CSS for token definitions. Files: `a-{name}.ts`, `a-{name}.css`. The external CSS file defines CSS variable tokens on the host, and the shadow DOM style references those variables. No visible attributes are set from JS on the host element — only shadow-internal styles are modified (e.g. setting `--_percent` on an internal element).
- **`src/components/`** — JSX wrappers. State management, CSS modules. Files: `{Name}.tsx`, `{Name}.module.css`. These handle logic and provide a typed component API. Use `clsx` (imported as `cn`) for class joining. Forward `style` and extra props via spread to the underlying web component.

The tiers are decoupled — JSX wrappers emit `<a-*>` tags but never import element definitions. Binding is by tag name at runtime.

### Key files

- `src/jsx-runtime.ts` — Custom JSX runtime. Defaults to `React.createElement`. Call `configure(h)` to swap. **Owns the `JSX.IntrinsicElements` declarations for `a-*` tags** — they must live here (not elsewhere) because tsc's `jsxImportSource` mechanism resolves JSX element types from the `JSX` namespace exported by `<source>/jsx-runtime`, and because companion packages augment this exact module (`@antadesign/stickers` does `declare module '@antadesign/anta/jsx-runtime'` to add its tags).
- `src/general_types.ts` — Shared `BaseProps` / `BaseAttributes` plus the per-element `A{Name}Attributes` interfaces. A regular `.ts` module (never a `.d.ts` — tsc doesn't copy declaration inputs to `dist`) published as the `@antadesign/anta/general_types` subpath; `@antadesign/stickers` and all JSX wrappers import from it.
- `src/types.d.ts` — Internal-only ambient declarations: the wildcard `declare module '*.module.css'`. Can't merge into the files above — wildcard ambient module declarations are only legal in a global (non-module) declaration file. Not shipped to `dist`.
- `src/elements/index.ts` — Barrel export that auto-registers all web components in browser contexts. **Must only be imported client-side** — `HTMLElement` does not exist in Node/SSR.
- `src/index.ts` — Barrel export for JSX components and `configure()`.

These three type locations are each pinned by a different TypeScript mechanism (see above) — don't try to consolidate them.

## Build & dev

Source lives in `src/`. Build output goes to `dist/`. `dist/` is gitignored — `pnpm install` regenerates it via the `prepare` lifecycle script, and `npm publish` regenerates it via `prepublishOnly` so the published tarball is always fresh. The package is distributed only through npm; the GitHub-URL install path is not supported.

```sh
pnpm run build        # Full build: JS + CSS + types
pnpm run build:js     # esbuild: TSX/TS → dist/*.js
pnpm run build:css    # Copy CSS files to dist (esbuild non-bundle mode doesn't output them)
pnpm run build:types  # tsc: emit .d.ts declarations
pnpm run typecheck    # Type check without emit
```

### Running the dev server — always `pnpm run dev` from the repo root

**For any dev work — editing the anta package *or* the docs site — run `pnpm run dev` from the repo root** (run it in the background; it's long-lived). It does both halves together:

- a `nodemon -w src -w stickers/src` watcher that **rebuilds `dist`** (anta, then `@antadesign/stickers`) and regenerates the site's `docs:*` artifacts on every change to either package's `src/**/*.{ts,tsx,css}`, and
- the docs site's `astro dev` (HMR for `site/`).

The docs site consumes anta from the built `dist/` (workspace symlink), so this is what propagates an anta-source change through to the running site. **Do not** run `cd site && pnpm run dev` for package work — that starts only the site's Astro dev and will *not* rebuild `dist`, so anta `src` edits won't show up and you'd be stuck manually rebuilding + restarting. Pure `site/` edits (`.mdx`, Astro/Preact components) HMR fine under either, but the root command is the one to use so package edits Just Work too.

**Important**: esbuild runs in non-bundle mode (no `--bundle` flag). It compiles each entry point individually but does **not** process CSS imports — it leaves `import "./a-progress.css"` in the JS output without copying the CSS file. The `build:css` step copies CSS files manually. When adding a new component, add its CSS files to `build:css`.

Uses `jsx: "react-jsx"` with `jsxImportSource: "@antadesign/anta"` (automatic transform). The compiled output self-references the package via the exports map: `import { jsx } from "@antadesign/anta/jsx-runtime"`.

### CI

`.github/workflows/ci.yml` runs on pull requests to main:
1. `pnpm run build` — build anta
2. `pnpm run typecheck` — type check
3. `pnpm --filter anta-site build` — build the docs site

## Package consumption

Consumers can use anta via:
- **npm**: `"@antadesign/anta": "dev"` (prerelease) or a specific version
- **Local link**: `"@antadesign/anta": "link:/path/to/anta"` (for development)

The `exports` map handles all subpath imports. Explicit entries exist for `.`, `./jsx-runtime`, `./elements`, `./elements/*`, plus a `"./*"` wildcard fallback. `main` and `types` fields provide fallback for classic `moduleResolution: "node"`.

`react` is a **peer dependency** — consumers provide it (or alias it to `preact/compat`).

### SSR caveat

`@antadesign/anta/elements` registers custom elements using `HTMLElement`, which does not exist in Node.js. In SSR contexts (Astro, Next.js), import it client-side only:

```tsx
// In Astro: use a <script> tag (client-side by default)
<script>import '@antadesign/anta/elements'</script>

// In a Preact/React island: dynamic import inside useEffect
useEffect(() => { import('@antadesign/anta/elements') }, [])
```

## npm publishing

Two packages publish from this repo: **`@antadesign/anta`** (root) and **`@antadesign/stickers`** (`stickers/`). Both go out as prereleases under the npm `dev` dist-tag. Each version string is immutable on npm — **always bump before publishing**.

> **If asked to publish — or to recall how — walk the user through this, in order.** The order and the `pnpm` vs `npm` distinction are the two easy things to get wrong.

**Publish anta first, then stickers.** `@antadesign/stickers` depends on `@antadesign/anta` via `workspace:*`, which pnpm rewrites to anta's **exact current version** at pack time. So the anta version stickers will pin must already be on npm — and it must be the version that carries whatever exports stickers imports (e.g. `./anta_helpers`, `./general_types`). Publishing stickers against an anta version that isn't published yet (or predates an export it needs) makes `npm install @antadesign/stickers` unresolvable.

```sh
# 1) anta — from repo root
npm version prerelease --preid=dev        # 0.1.1-dev.8 → 0.1.1-dev.9 (or bump the version field by hand)
npm publish --access public --tag dev     # prepublishOnly rebuilds dist

# 2) stickers — from stickers/
cd stickers
pnpm publish --no-git-checks              # access/tag come from its publishConfig
```

- **Use `pnpm publish` for `stickers`, not `npm publish`.** Only pnpm rewrites the `workspace:*` protocol to a real version; `npm publish` would leave `workspace:*` in the tarball and the package would be uninstallable. (anta has no workspace deps, so `npm publish` is fine there.)
- `stickers/package.json` has `publishConfig: { access: "public", tag: "dev" }`, so its publish needs no `--access` / `--tag` flags. anta passes them explicitly.
- `prepublishOnly` (anta) / `prepare` (both) rebuild `dist` before the tarball is created, so published output is always fresh.
- Bumping the `version` field by hand (vs `npm version`) skips the auto git commit + tag. If you tag releases, create the tag manually; otherwise no action needed.
- 2FA: append `--otp=<code>` if your npm account requires it.

## Changelog

`CHANGELOG.md` at the repo root documents changes to **the `@antadesign/anta` package only** — code shipped to npm consumers (anything under `src/` and `dist/`, plus root files in the published tarball). The docs site under `site/` is its own thing and **does not** belong in the changelog. New site pages, component-docs polish, demos, layout tweaks — all of that ships only on `anta.design` and isn't a consumer-facing change.

When in doubt: would a consumer who installs this version see this change in their app? If no, leave it out of `CHANGELOG.md`. Use commit messages and PR descriptions for the docs-site narrative.

## Documentation site

The `site/` folder is the anta design system documentation website, built as a pnpm workspace member.

**Stack**: Astro 5 (static output) + Preact + MDX + astro-expressive-code (syntax highlighting, tokyo-night theme). Remark plugins: GFM, math, directive, definition-list, attributes. Rehype plugins: slug, autolink-headings, mathjax.

**Structure**:
- `site/src/layouts/DocsLayout.astro` — Sidebar + main content shell. Imports `@antadesign/anta/elements` via client-side `<script>`.
- `site/src/pages/` — `.astro` pages for static content, `.mdx` pages for component docs with code examples
- `site/src/components/` — Preact islands (`.tsx`), hydrated with `client:load`/`client:visible`. The shared `Playground.tsx` is the standard interactive demo for component pages (see "Adding a component docs page"); other islands here are one-off non-playground demos (e.g. `AnimatedProgress.tsx`)
- `site/src/styles/base.css` — Minimal reset and typography (inline values, no CSS variables — will adopt anta's global tokens when available)

**How it uses anta**: `"@antadesign/anta": "workspace:*"` resolves to the local package. Anta must be built first (`pnpm run build` in root). Preact compat (`@astrojs/preact({ compat: true })`) aliases `react` → `preact/compat`, so anta's jsx-runtime works without calling `configure()`.

```sh
cd site && pnpm run dev      # Dev server
cd site && pnpm run build    # Static build
```

**Adding a component docs page**: Create `site/src/pages/components/{name}.mdx` with `layout: ../../layouts/DocsLayout.astro`. For an interactive **playground** (editable code + live preview + auto props form), **use the shared `<Playground>` component** — `<Playground client:visible component="{Name}" layout="side" initialCode={…} />` — with the `initialCode` string kept in a sibling `{name}.demo.ts` file. The `initialCode` is plain TSX (imports + a trailing JSX block, auto-wrapped in a fragment, so it can contain multiple/nested elements). **Do not hand-roll a bespoke per-component playground island** — the shared one gives a consistent editor, props panel, and isolated iframe across every page, and is being extracted into its own package. Reserve custom Preact islands (`site/src/components/*.tsx`, `client:load`) for *non-playground* demos that the playground can't express — e.g. a self-animating preview like `AnimatedProgress`. See `site/CLAUDE.md` for the playground internals.

## Design references

When naming components, props, CSS variables, internal class names, or suggesting patterns, reference established design systems: Material Design, shadcn/ui, Radix UI, Carbon Design System, Shopify Polaris Web Components, Ant Design, Atlassian Design System, Base UI (base-ui.com), Mantine (mantine.dev), Blueprint, and Web Awesome. Prefer terminology and conventions already used by these libraries over inventing new ones.

## Working with Figma

See `FIGMA.md` for rules when extracting tokens, components, or styles from the Anta Figma library. Key rule: **always read the full variable list directly from the collection** — don't infer the token set from `get_variable_defs` on a sample node, because tokens that aren't placed on the queried node won't appear, and you'll silently miss values.

## Color manipulation

**To tune the alpha of any color (variable, `currentColor`, hex, etc.), always use `color-mix(in oklch, <color> <percent>%, transparent)`**. Mixing in `oklch` keeps the perceived hue/lightness stable, while the percent maps directly to the desired alpha (e.g. `50%` → 0.5 alpha). This is the standard pattern in Anta — do not reach for `rgba(...)`, hex-with-alpha (`#rrggbbaa`), or `opacity` on the parent when only the alpha of one color needs to change.

```css
/* underline at half-strength of the link's color */
text-decoration-color: color-mix(in oklch, currentColor 50%, transparent);

/* token at 80% alpha */
border-color: color-mix(in oklch, var(--border-4) 80%, transparent);
```

The same rule applies anywhere we lighten/darken/desaturate a color: prefer `color-mix(in oklch, <color> <p>%, <other-color>)` so all interpolation happens in a perceptually-uniform space.

## Conventions

- **Declarative DOM** — Web components are pure declarative. **No element class — neither the constructor nor `attributeChangedCallback` nor any handler — may call `setAttribute`, mutate `className`, set inline `style`, or otherwise change anything on the host element that's visible in the DOM tree.** The host's attributes and inline styles must come from the JSX wrapper (or from the consumer writing `<a-…>` directly). Only shadow-internal elements may be mutated from JS.
- **React 19 property assignment — every element getter needs a setter, or be `#`-private, or `@readonly`.** React 19 changed how it applies props to a custom element: for each prop it checks `key in domElement` and, when true, assigns the **property** (`el.placement = value`) instead of falling back to `setAttribute`. So a *getter with no setter* throws on assignment (`Cannot set property placement of #<AMenuElement> which has only a getter`), which unmounts the consumer's tree — a blank page. React 18 always used `setAttribute`, and the docs site runs on Preact, so this stays invisible until a real React-19 consumer renders the element. **A TypeScript `private` getter does NOT protect you** — `private` is erased at compile time, so at runtime it's a real, visible prototype accessor that `key in el` finds. Only `#name` (true ECMAScript private) is invisible. Therefore **every `get X()` on an element class must be one of**: (1) `get #X()` — truly private, for internal helpers nothing outside the class reads (this is where `placement`/`offset`/`delay` and every `isXxx`/`currentValue`/`radios`-style helper live now — never `private get`); (2) paired with a `set X()` **on the same class** that reflects the value, usually to the backing attribute (`set name(v) { this.setAttribute('name', v) }`, mirroring `a-input`'s `value`) — this is the fix for any getter that names a **settable attribute the wrapper passes** (`name`, `value`); a setter inherited from a base does *not* count, because an own getter-only accessor shadows the inherited pair; or (3) a deliberate read-only public property listed in **`READONLY_ALLOWLIST`** in `scripts/lint-getters.mjs` — a native mirror (`validity`, `validationMessage`, `willValidate`) or state derived from a *different* write channel (`isOpen`/`triggerAnchor` on `a-menu`, `value` on `a-radio-group`/`a-tabs`, `checked`/`indeterminate` on `a-checkbox` — the write channel is `state`), safe only because nothing passes it as a JSX prop. The allowlist (keyed by class name) is the explicit, reviewed opt-out, and lives in the linter (not as a comment on the component). `scripts/lint-getters.mjs` (`pnpm run lint`, gated in CI) enforces exactly this: it walks the TypeScript AST and checks every **element class** — any class under `src` whose `extends` chain reaches `HTMLElementBase`, so base classes like `SelectableChildElement` are covered without a hand-maintained file list. Static accessors are exempt (they live on the constructor, never assigned as instance props). The same script runs a **second** React-19 check: because `key in el` also finds **methods and plain fields** (access modifiers are erased, so even a `private show()` or `private seat` is a real runtime property), any camelCase attribute a wrapper can pass — every identifier-named prop in the element's `A{Name}Attributes` interface, minus `on*` handlers (React binds those via `addEventListener`, not property assignment) — must **not** collide with a method or field on the element or its bases: `el.show = value` would silently overwrite the method. A collision with a *paired* `get/set` is fine (intended reflection); rename the member to `#name` (true private, the usual fix) or rename the attribute. This is why internal helpers are `#`-private, not just `private`. Adding a setter is the consumer writing the property, not the element mutating its own host, so it's consistent with the declarative-DOM rule above.
- **ARIA goes in JSX wrappers, not web components.** All `role`, `aria-*`, `tabindex`, etc., are added by `src/components/<Name>.tsx` as attribute pass-through, never by `AXxxElement.constructor`. This keeps the web component re-renderable from any reactive engine without state churning the DOM, and keeps the elements usable in non-React/Preact contexts where the consumer adds ARIA themselves. The single exception is when the wrapper passes a value through (e.g. `aria-valuenow={value}`); the wrapper is a thin JSX→DOM bridge and that's its job. One narrow element-side exception exists for **ARIA state reflection**: live interaction state only the element knows (e.g. `a-menu` reflecting `aria-expanded` onto its anchor) may be set by the element — like `el.focus()`, it mirrors element-owned state; the wrapper still renders the static resting baseline so a reactive re-render self-heals.
- **Boolean attributes — emit presence, match by presence.** A JSX wrapper maps each boolean prop to `prop ? '' : undefined` — never the raw boolean, never `'true'`. The empty string renders the canonical presence form `attr=""` *consistently across React and Preact*; `undefined` omits the attribute. (Passing the raw boolean is non-portable: Preact stringifies `true` → `attr="true"`, while React 19 renders `attr=""`. `'true'` works but leaves a verbose, misleading `attr="true"` in the DOM.) The element's CSS must then match by **presence** — `a-button[disabled]`, **not** `[disabled="true"]` — so it catches `=""`, `="true"`, and bare presence alike, which also makes hand-authored `<a-… disabled>` work. This is safe against false-positives because the falsy state is always *absence*: `prop ? '' : undefined` makes `false → undefined`, which every React/Preact version omits (and even a raw boolean `false` is dropped by every current version — Preact always removes `false`; React drops `false` for both known boolean attrs and unknown/custom attrs since v16). The exception is **ARIA** attributes, which stay string-valued (`aria-pressed={selected ? 'true' : undefined}`) because ARIA is value-based, not presence-based. **Type the element attribute as `boolean | ''`** in `general_types.ts` (e.g. `disabled?: boolean | ''`) — `boolean` lets a hand-author write `<a-… disabled>` / `disabled={cond}` (runtime: `true`→present, `false`→omitted, both correct), and `''` is the form the wrapper emits. Do **not** widen it to `'' | 'true' | 'false' | boolean`: the string `'false'` is a footgun under presence-matching (`disabled="false"` is *present*, so it reads as **on**), and nothing in React/Preact ever emits `"false"` for a boolean (they omit it), so accepting that string only invites the bug. ARIA attrs are the opposite — keep them `'true' | 'false' | boolean` since the string value is meaningful there.
- **JSX wrappers never hold a ref to the rendered element.** The app DOM may render in a worker (see the no-DOM-mutation rule), so a React/Preact `ref` to an `<a-*>` host **does not resolve to a live DOM node** — `ref.current` is null/inert and calling element methods (`el.requestSync()`, `el.focus()`, reading layout) from a wrapper is a bug, not just discouraged. A wrapper is a pure attributes→children projection: it may keep component *state* (`useState`) and value-holding refs, but **never a pointer to a DOM element**. Any coordination that needs a live element handle (observing child mutations, measuring, imperative focus) belongs **inside the web component**, which does live in the DOM. When a wrapper seems to need a DOM ref, that's the signal to move the logic down into the element instead.
- **Reuse shared wrapper helpers — don't re-implement them per component.** Cross-cutting JSX-wrapper utilities belong in `src/anta_helpers.ts` (published as `@antadesign/anta/anta_helpers`): notably the cross-renderer `statechange`/CustomEvent **detail unwrap** (`'nativeEvent' in e ? e.nativeEvent : e` — React passes a synthetic wrapper, Preact the raw event), the `NAMED_TONES` set, and the custom-tone `--{component}-tone-source` style helper. When a new stateful or toned wrapper needs one of these, **import it from `anta_helpers`** rather than copy-pasting (re-implementing the unwrap in each of `Menu`/`Expander`/`Checkbox`/`RadioGroup` is exactly the drift hazard this avoids — change the rule once and a missed copy silently breaks `onStateChange` or renders a tone transparent). If the helper isn't there yet, add it there first, then consume it.
- **Don't add new web components without a strong reason.** Each one occupies a global tag name. Prefer adding props to existing elements before introducing a new tag.
- **Shadow DOM pattern** — Web components use shadow DOM. The external CSS file (`a-{name}.css`) styles the host element and handles light/dark mode via `.dark` ancestor. The shadow DOM `<style>` declares only structural defaults on `:host`.
- **Minimize shadow DOM depth — make the `<slot>` the element, don't wrap it.** A `<slot>` is a normal, stylable element; its only special trait is the UA default `display: contents` (no box), which is *not* `!important` and so is freely overridden. When a wrapper exists only to give a slot a box — chrome, a flex/grid layout, a grid item, padding — **promote the slot itself to `display: block | flex | grid`** and hang the styles (and the `part` attribute) on it, rather than nesting `<div><slot></slot></div>`. The projected content lays out inside the slot's box; inherited properties (font, color) still flow through it; and `::part(name)` matches a slot just like a div, so styling hooks are unchanged. Validated across Chromium, Firefox, and Safari/WebKit (incl. the grid `0fr↔1fr` collapse animation with the slot as the fr-sized grid item). This is the established pattern here — see `a-progress` (`slot { display: block }`), `a-expander`'s `actions`/`content` slots, and `a-tooltip`'s `bubble` slot. **Don't introduce a wrapper element whose sole job is to box a single slot.** `display` is not inherited, so `display: block` on a slot never leaks onto the slotted children. (Reserve a real wrapper only when there's a distinct second job — e.g. `a-tooltip`'s `.container` carries the popover + a separate opacity layer that must multiply with the slot's.)
- **CSS variables for variant values** — Use `--{component}-*` variables for any property that changes across variants (tone, dark mode). In the base rule, declare all variables first, then leave an empty line before regular properties. **`{component}` is the bare component name, NOT the element tag** — so `--input-bg`, `--button-bg`, `--tooltip-padding`; **never** prefix with the custom element's `a-` (no `--a-input-bg`). Every existing component follows this (`--button-*`, `--expander-*`, `--tooltip-*`).
- **CSS variables for shadow internals** — Use `--_` prefix for shadow-internal-only variables set from JS (e.g. `--_percent`).
- **Dark mode** — Use `.dark` ancestor class in the external CSS.
- **Default variant in union types** — Include default value explicitly in the type union (e.g. `tone?: 'neutral' | 'info'`).
- **CSS modules only on JSX wrappers**, plain CSS for web components. Use `.container` as the top-level class in CSS modules.
- **No comments inside shadow-`<style>` strings.** A shadow `<style>` string (the `SHADOW_STYLE` template literal in `a-{name}.ts`) is injected verbatim into every element instance's shadow root at runtime — `build:js` doesn't minify, and esbuild won't touch CSS *inside a string literal* even when it does — so any comment there ships **and** is re-injected per instance. Keep those strings comment-free; put the rationale in a TS comment directly above the string (or in the class docstring). **External `.css` files are exempt** — `build:css` runs esbuild with `--minify`, which strips all comments before `dist` (verified: `dist/elements/*.css` has zero comments), so source-level comments in `a-{name}.css` / `*.module.css` are fine and encouraged for clarity. (`tokens.css` / `reset.css` consumers read directly as theming reference, so their comments are intentional too.)
- **Types** — Use React global types (e.g. `React.CSSProperties`) without importing React. Components must be compatible with both React and Preact.
- **Wrappers are stateless and import no renderer runtime — except hooks via the jsx-runtime indirection.** Almost every wrapper is a pure props→`<a-*>` projection (types only, no `import … from 'react'`). The rare wrapper that genuinely needs component state (today only `RadioGroup`, which holds the selected value to render the roving `tabindex` — see the no-DOM-ref rule above for why that can't live on the element) imports its hooks from **`../jsx-runtime`** (`useState` / `useId`), **never** directly from `react`. Those re-exports delegate to whatever `configure(jsx, Fragment, { useState, useId })` was given, defaulting to what `react` resolves to (React, or `preact/compat` under the documented Preact path). So a custom non-compat runtime supplies its own hooks via `configure()` and no React runtime is hard-wired in. Add hooks to that indirection (not a `react` import) if another wrapper ever needs them.
- **Auto-registration (granular + barrel)** — each `a-{name}` module self-registers and imports its own CSS when loaded, so a granular `import '@antadesign/anta/elements/a-{name}'` registers just that element (and won't drag in other elements' code or deps). The `elements/index.ts` barrel re-exports every module, so `import '@antadesign/anta/elements'` registers them all. Registration is guarded against missing `customElements` (SSR-safe), but elements should still only be imported client-side. (The same pattern powers `@antadesign/stickers/elements` — its granular `a-sticker` path keeps `lottie-web` out, since only `a-sticker-animated` pulls it.)
- **Component-token-first; the only global tokens are color roles.** The global token vocabulary is deliberately tiny and lives in `src/tokens.css`: theme-aware *role* scales for **text** (`--text-*`), **container background** (`--bg-*`), and **container border** (`--border-*`), per tone, plus fonts, link colors, and **`--focus-ring`** — the one global *interaction* color, the first such family promoted (by explicit decision, once the value had stabilized everywhere); components reference `--focus-ring` **directly** for their focus outline (there is **no** per-component `--{component}-focus` token — those were removed). A component points at these roles only when a value clearly *is* one of those things (see `a-tag.css` — that's also what makes its dark mode free). Everything else — sizes, spacing, radii, other interaction-state colors, timings — is defined per component as `--{component}-*` with literal values, **on purpose**: values are still being tuned back and forth, and component-level definitions keep every part independently changeable. Component-local literal values are policy, not debt — do **not** "clean them up" by routing them through global tokens, and do **not** introduce primitive palette tokens or global spacing/size scales. New global role families (e.g. interactive fills) only by explicit decision, once the values have actually stabilized across components.
- **Document defaults with `@defaultValue`** — Every optional prop whose default isn't obvious (enums, numbers like `size`/`level`/`max`, a default tone/priority) **must** carry a `@defaultValue <value>` TSDoc tag on its declaration in `src/components/<Name>.tsx`. This is the single source of truth: TypeDoc captures it into `site/src/api.json`, `PropsTable.astro` renders it as the **Default** column, and the playground's `props-form.ts` reads it for control defaults. State the default *only* in the tag — don't also write "Defaults to …" in the prose description (the Default column would duplicate it). Skip the tag for booleans that default to `false` (obvious) and for required props (no default).
- **Documentation voice** — all prose we write follows the repo-root [`WRITING.md`](WRITING.md): docs-site pages, source comments, and TSDoc on props/params share one voice (lead with the point, values over adjectives, rare em dashes, no "not X, but Y" framing, no hype or signposts). It applies going forward; bring a section into voice when you edit it rather than rewriting untouched files.
- **Documented styling surface ≠ the full token set.** A component defines many `--{component}-*` internally (above) — but the docs (`## Styling` section on each component page) deliberately expose only the few a consumer **can't reproduce in one line of plain CSS**, in three buckets: (1) **the single custom-colour source** — `--{component}-tone-source`, fronted by the `tone` prop, which derives the whole rest/hover/active curve in oklch; (2) **a handful of invariant knobs** props don't cover (e.g. `--checkbox-mask-check`/`-indeterminate` to swap the glyph, `--expander-gutter`); (3) **necessity hatches** with no other reach (shadow-internal parts where there's no `::part`). Everything else stays **internal and undocumented**: the per-state resolved *outputs* (`--button-fg`/`-bg`, `--checkbox-fill*`/`-border*`, `--input-border*`, `--tag-bg`/`-border`, …) are NOT a public surface — overriding one only catches a single state (the others recompute), so it's a footgun; route colour through `tone`, and document everything else as **plain CSS** (light-DOM elements — target the host / `::before` / `::after` / light-DOM child tags; `@layer anta` means an un-layered consumer rule wins without `!important`) or **`::part(...)`** (shadow-DOM elements — Input/Tooltip/Menu/Expander/Progress expose parts). Doc examples customise via props / plain CSS / `::part`, **never by setting our internal `--*` outputs**. The section is titled **`## Styling`**, not "Component tokens". (The tokens still *exist* — this is about what we advertise as the override API, not deleting plumbing.)
- **Docs-in-sync** — When you rename a component prop, rename a `--{component}-*` token, add a token, or remove one, **update `site/src/pages/components/{name}.mdx` in the same change** so the docs page tracks the source of truth. The same applies to default values, prop type unions, and to any consumer-facing API note in `README.md`. Drift between the source and the docs site is the single most common bug report — easier to keep them in lockstep than to chase the divergence later.

## Adding a new component

1. Create `src/elements/a-{name}.ts` — web component class + `register_a_{name}()` function. At the **top** `import './a-{name}.css'` (so the CSS travels with the element on a granular import), and at the **bottom** call `register_a_{name}()` so the element **self-registers when the module is imported** (the granular entry point `@antadesign/anta/elements/a-{name}`).
2. Create `src/elements/a-{name}.css` — plain CSS using tag selector, attribute selectors for variants
3. Add to `src/elements/index.ts` — add an `export { AXxxElement, register_a_{name} } from './a-{name}'` line. Re-exporting evaluates the module, which self-registers + loads its CSS, so the barrel registers the whole set. (CSS-only styled tags with no module — like `a-title` — instead get a bare `import './a-{name}.css'` in the barrel.)
4. Create `src/components/{Name}.tsx` — JSX wrapper, import CSS module
5. Create `src/components/{Name}.module.css` — scoped styles for wrapper layout
6. Add to `src/index.ts` — re-export the component
7. Define `A{Name}Attributes` in `src/general_types.ts` (extending `BaseAttributes`), then add `a-{name}` to `JSX.IntrinsicElements` in `src/jsx-runtime.ts`
8. Add entry points to `build:js` script in `package.json`
9. Add CSS files to `build:css` script in `package.json`
10. Run `pnpm run build` to verify
