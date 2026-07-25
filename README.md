# @antadesign/anta

<a href="https://antithesis.com" target="_blank" rel="noopener noreferrer">Antithesis</a> design system, **Anta**, has three layers: global CSS tokens, framework-agnostic web components that work with plain HTML, and JSX wrappers for React and Preact.

The Antithesis SaaS has an unusual architecture: most of its UI code runs inside a Worker thread, driven by a custom reactive engine that powers Antithesis notebooks. To keep state in sync between the Worker and the UI thread, Anta's web components must be **fully declarative** — they never mutate their own attributes (any internal state changes happen inside Shadow DOM, invisible to the outer document). A self-mutating attribute would break the Worker↔UI sync.

This constraint shapes the architecture: the web components carry the core styling and the occasional browser-API call (e.g. `getBoundingClientRect()`) without imposing a framework. Majority of web components are stateless. The React/Preact wrappers exist for dynamic state and conditional rendering.

## Installation

`@antadesign/anta` is an NPM package, so you can `npm install @antadesign/anta` or do that with `pnpm` / `bun`.

Use the latest version from npm, but **always pin an exact version** — `"@antadesign/anta": "0.2.0"` in your `package.json` — rather than a floating tag like `"latest"` or `"dev"`, which can change between installs.

### Usage

```tsx
import '@antadesign/anta/tokens.css'  // CSS custom properties (colors, sizes, fonts)
import '@antadesign/anta/reset.css'   // small reset + Anta's typography opinions
import '@antadesign/anta/elements'    // registers <a-progress> et al.
import { Progress } from '@antadesign/anta'

<Progress value={42} label="uploaded.." hint="3 of 7" />
```

### What you import (and why)

Anta exposes four core imports plus an optional theme. Tokens + elements + the JSX layer are the minimum to render a styled component; the reset is recommended but skippable; `theme-anta.css` is an opt-in palette.

| Import | Provides | Skip if… |
|---|---|---|
| `@antadesign/anta/tokens.css` | The CSS custom properties — six tone seeds (`--anta-seed-neutral`, `--anta-seed-brand`, …) plus the role scale (`--bg-1…5`, `--text-1…5`, `--border-1…5`) **derived from the seeds** via `oklch(from …)`, the `.dark`-ancestor toggling, the base `font-size: 15px`. Also declares the `@layer base, anta, components, utilities;` cascade order. Override a seed to reskin its whole tone; every component follows. | You're applying your own design tokens at the same variable names. |
| `@antadesign/anta/theme-anta.css` *(optional)* | Restores Anta's hand-tuned reference palette. The default palette is seed-derived (generative); import this **after** `tokens.css` + the element CSS for the exact prior values. | You want the seed-derived default, or your own palette. |
| `@antadesign/anta/reset.css` | Modern small reset (box-sizing, margin reset, replaced-element block, form-control font inheritance, text-wrap defaults) plus Anta's typography opinions for `h1-h6`, `strong`, `ul / ol / menu`, `a` / link states. Lives in `@layer anta`. | You already have a reset and don't want Anta's typography defaults. |
| `@antadesign/anta/elements` | Side-effect import that registers `<a-progress>`, `<a-text>`, `<a-icon>` as custom elements *and* attaches their per-element CSS (also in `@layer anta`). | You're rendering Anta only on the server (no DOM) and never hydrating. |
| `@antadesign/anta` | The JSX wrappers (`Progress`, `Text`, `Icon`) — typed React/Preact components that emit `<a-*>` tags. | You're writing the `<a-*>` elements by hand and don't need a JSX layer. |

The chain matters: the per-element CSS that ships with `/elements` references variables like `var(--text-1)` and `var(--bg-2)`. Those variables are *only defined* by `tokens.css`. Skip the tokens import and the components render with whatever the surrounding cascade provides — usually nothing styled at all.

`@antadesign/anta/elements` registers **all** elements — convenient, but it includes every element's code (and deps). To keep your bundle lean, import only the elements you use from their per-element entry points instead: `import '@antadesign/anta/elements/a-tooltip'` registers just `<a-tooltip>` **and loads just its CSS**. Unused elements — and any dependencies they pull in — then never enter your bundle. See [Registering elements](#registering-elements).

### Cascade layers

Anta's reset and element CSS live in `@layer anta`. `tokens.css` pre-declares an order of `@layer base, anta, components, utilities;`, which keeps Anta's defaults above any preflight resets (Tailwind's `@layer base`, Normalize, etc.) while letting your own `@layer components` rules and utility-class frameworks like Tailwind (`@layer utilities`) override Anta when you ask them to.

If you need a different order, declare it in your *own* CSS file that loads **before** `tokens.css`. The first mention of each layer name fixes its position:

```css
/* your global.css, loaded before anta */
@layer reset, anta, my-components, utilities;
```

CSS custom properties (the `:root { --… }` declarations in `tokens.css`) stay unlayered so they take effect everywhere unconditionally.

> **Gotcha: unlayered hard resets defeat Anta's element rules.**
>
> A snippet like this in your global CSS — common copy-paste from older reset guides — silently overrides every element rule Anta ships:
>
> ```css
> *, *::before, *::after { box-sizing: border-box; }
> * { margin: 0; }
> ```
>
> Unlayered styles **always** beat layered ones in the cascade, regardless of specificity. So `* { margin: 0 }` outranks Anta's `caption { margin-bottom: 0.25em }`, `p { margin: 0 0 1em }`, `ul / ol` padding, and any other per-element default Anta provides — even though those use stronger selectors.
>
> If you're importing `@antadesign/anta/reset.css`, Anta already does the same universal `box-sizing` and margin reset, *inside* `@layer anta`. The element-level rules sitting on top are intentionally polite defaults — sensible out of the box, trivially overridable when you want something else (any rule in `@layer components` / `@layer utilities`, or any unlayered rule of your own that targets specific elements, wins automatically). **Delete the duplicate hard reset from your global CSS** so those defaults can apply. If you want to keep your own reset, wrap it in `@layer base { … }` so it sits below `anta` in the declared order and Anta's rules still win element-by-element.

## Registering elements

The JSX wrappers (React components) as `Progress` render custom DOM elements as `<a-progress>`. The custom elements themselves must be registered with the browser **before** they appear in the DOM, and registration only works where `HTMLElement` exists — i.e. the UI thread of a real browser. **Node.js (SSR) and Worker threads don't have `HTMLElement`**, so the import is harmless in those environments: it does nothing — registration is skipped silently and the class uses a stand-in base instead of crashing — though it might extend your worker's bundle size a bit.

```ts
import '@antadesign/anta/elements'  // auto-registers all elements
```

**Register only what you use.** `/elements` is the all-in-one convenience import. To trim your bundle, import the specific element entry points instead — each registers just that element and loads just its CSS:

```ts
import '@antadesign/anta/elements/a-tooltip'  // only <a-tooltip> + its CSS
import '@antadesign/anta/elements/a-button'   // only <a-button> + its CSS
```

Both styles are side-effect imports (the act of importing registers the element), and both are idempotent and SSR-safe. The granular form keeps unused elements — and any dependencies they pull in — out of your bundle.

The cleanest pattern is a **static, synchronous import at your app's entry file** — outside any component, outside any hook:

```ts
// src/main.tsx (or wherever your root render lives)
import '@antadesign/anta/elements'
import { createRoot } from 'react-dom/client'
import App from './App'
createRoot(document.getElementById('root')!).render(<App />)
```

Bundlers resolve this at module-init time, so by the time any component renders an `<a-progress>`, the custom element class is already registered — there's no flash of un-upgraded elements.

> **Why not `useEffect(() => import('@antadesign/anta/elements'), [])`?**
>
> `useEffect` fires after paint, and the dynamic `import()` itself is asynchronous. In practice the browser paints unregistered custom elements (which collapse to nothing) for a few hundred milliseconds before the upgrade catches up. `useLayoutEffect` doesn't help either: the async import still resolves after paint, and `useLayoutEffect` warns during SSR hydration. A static import at the entry file avoids all of this.

Where to put the static import depends on the runtime:

**Plain HTML / static sites** — put it in a `<script type="module">` tag in the document head. That's client-side by default.

**SSR frameworks (Astro, Next.js)** — register from a script that the framework only ships to the client. In Astro: `<script>import '@antadesign/anta/elements'</script>` (Astro `<script>` tags are client-side by default). In Next.js: a top-level `import` in a Client Component file (the one with `'use client'` at the top) — that file is only bundled into the client chunk, so the import never reaches Node.

**React / Preact apps where the UI runs in a Worker thread (the Antithesis setup)** — register the elements in your UI-thread bootstrap code, the script that owns the real DOM. The Worker won't have `HTMLElement`, so the import must not run there.

## Framework setup

### React

Works out of the box.

### Preact with compat

If your bundler aliases `react` → `preact/compat`, anta works automatically — no extra setup.

### Preact without compat

Call `configure()` before rendering any anta components:

```ts
import { configure } from '@antadesign/anta'
import { h, Fragment } from 'preact'
configure(h, Fragment)
```

### TypeScript: typing raw `<a-*>` tags in JSX

If you only use the JSX wrappers (`<Button>`, `<Progress>`, …) you need no setup — they're typed like any React component. This section is only for writing the raw `<a-*>` tags directly in JSX.

**Option A (preferred)** — point your JSX types at anta in `tsconfig.json`:

```jsonc
{ "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "@antadesign/anta" } }
```

Every `a-*` tag type-checks, all standard HTML tags keep working, and importing anything from `@antadesign/stickers` adds the sticker tags automatically.

**Option B** — if you can't change `jsxImportSource` (a shared tsconfig, Emotion's `@emotion/react` source, an older `@types/react` without the `React.JSX` namespace), merge anta's tag map into your JSX namespace yourself. Anta exports it as a standalone interface, `AntaIntrinsicElements` — and `@antadesign/stickers` exports the matching `StickerIntrinsicElements` — so it's a single `extends` in any `.d.ts` covered by your tsconfig:

```ts
import type { AntaIntrinsicElements } from '@antadesign/anta'
import type { StickerIntrinsicElements } from '@antadesign/stickers' // only if you use stickers

declare global {
  namespace JSX {
    interface IntrinsicElements extends AntaIntrinsicElements, StickerIntrinsicElements {}
  }
}
```

On modern `@types/react` (≥18) with `jsx: "react-jsx"`, the JSX namespace is module-scoped and the global declaration above is silently ignored — target the `react` module instead:

```ts
import type { AntaIntrinsicElements } from '@antadesign/anta'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends AntaIntrinsicElements {}
  }
}
```

Either way the tags stay fully typed — unknown `a-*` tags and wrong prop types are still errors. New tags arrive automatically when you upgrade anta; there's no per-tag list to maintain.

### Raw web components (no JSX)

```html
<link rel="stylesheet" href="@antadesign/anta/elements/a-progress.css">
<script type="module">
  import '@antadesign/anta/elements'
</script>

<a-progress value="42" max="100" tone="info"></a-progress>
```

## Dark mode

Add the `dark` class to any ancestor element:

```html
<div class="dark">
  <Progress value={50} />
</div>
```

## Fonts

Anta is designed with a customized version of <a href="https://typetype.org/fonts/tt-interphases-pro" target="_blank" rel="noopener noreferrer">TT Interphases Pro</a> in mind, but it doesn't ship any font binaries. Components reference families through the `--sans-serif` and `--monospace` CSS variables and fall back to native system stacks when no font is registered. The base size is `font-size: 15px` on `:root` (so `1rem = 15px`), intentionally diverging from the browser default of 16px to match Antithesis's information-dense layouts — both the variables and the base size live in `tokens.css`.

To use the Antithesis fonts, register your own `@font-face` declarations and override the variables:

```css
@font-face {
  font-family: "Antithesis sans";
  src: url("/path/to/your/sans.woff2") format("woff2");
  /* ... */
}

:root {
  --sans-serif: "Antithesis sans", sans-serif;
  --monospace: "Antithesis mono", monospace;
}
```

## Browser support

Anta targets evergreen browsers and ships **no polyfills and no feature detection** for its baseline. The floor is set by the [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) (used by `<a-menu>` and `<a-tooltip>` for top-layer rendering):

| Browser | Minimum version |
| --- | --- |
| Chrome / Edge | 114 (May 2023) |
| Safari | 17 (Sep 2023) |
| Firefox | 125 (Apr 2024) |

This corresponds roughly to [Baseline 2024](https://web.dev/baseline). Within that floor, anta freely relies on: `popover` / `showPopover()` / `:popover-open`, `color-mix(in oklch, …)` and relative `oklch(from …)` colors, `:has()`, `dvh` units, CSS cascade layers, and constructable shadow DOM. On an older browser these fail hard (e.g. `showPopover()` throws) — there is no degraded mode by design; gate anta usage on your own support matrix instead.

Two features are used as **progressive enhancement** with explicit fallbacks: `checkVisibility()` (falls back to `getClientRects()`), and CSS typed `attr()` for `<a-icon size>` (Chrome 133+ / Safari 18.2+; elsewhere use the `<Icon size>` wrapper or the `--icon-size` variable, see the `a-icon` docs).
