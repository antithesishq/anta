# @antadesign/anta

<a href="https://antithesis.com" target="_blank" rel="noopener noreferrer">Antithesis</a> design system, **Anta**, has three layers: global CSS tokens with swappable themes, framework-agnostic web components that work in plain HTML, and JSX wrappers for React and Preact.

One constraint shapes the architecture. Antithesis runs most of its UI in a Worker thread, driven by a custom reactive engine, and a component that mutates its own attributes would desync the Worker from the UI thread. So Anta's web components are **fully declarative**: they never touch their own attributes, and internal state lives in Shadow DOM, invisible to the outer document. The components carry the styling without imposing a framework, and most are stateless; the JSX wrappers exist for dynamic state and conditional rendering.

## Installation

```sh
npm install @antadesign/anta   # or pnpm / bun
```

Pin an exact version in your `package.json` (`"@antadesign/anta": "0.3.12"`) rather than a floating tag like `"latest"`, which can change between installs.

### Usage

```tsx
import '@antadesign/anta/tokens.css'  // CSS custom properties (colors, sizes, fonts)
import '@antadesign/anta/reset.css'   // small reset + Anta's typography opinions
import '@antadesign/anta/elements'    // registers <a-progress> et al.
import { Progress } from '@antadesign/anta'

<Progress value={42} label="uploaded.." hint="3 of 7" />
```

### What you import (and why)

Five imports, listed in the order you'd add them. Tokens + elements + the JSX layer render a styled component; the reset is recommended; the theme is opt-in.

| Import | Provides | Skip if… |
|---|---|---|
| `@antadesign/anta/tokens.css` | The CSS custom properties: six tone seeds (`--anta-seed-neutral`, `--anta-seed-brand`, …), the role scales derived from them (`--bg-1…5`, `--text-1…5`, `--border-1…5`), the `.dark` ancestor toggle, and the base `font-size: 15px`. Also declares the `@layer base, anta, components, utilities` order. Override a seed to reskin its whole tone. | You're supplying your own values for the same variables. |
| `@antadesign/anta/reset.css` | Small modern reset (box-sizing, margins, form-control font inheritance) plus Anta's typography for headings, lists, and links. Lives in `@layer anta`. | You already have a reset and don't want Anta's typography defaults. |
| `@antadesign/anta/elements` | Side-effect import: registers every `<a-*>` element and attaches its CSS (also `@layer anta`). Per-element entries register just one — see [Registering elements](#registering-elements). | You render only on the server, or you import per-element entries instead. |
| `@antadesign/anta` | The JSX wrappers (`Progress`, `Text`, `Icon`, …): typed React/Preact components that emit `<a-*>` tags. | You write the `<a-*>` elements by hand. |
| `@antadesign/anta/theme-anta.css` *(optional)* | Anta's hand-tuned reference palette. The default palette is seed-derived; import this last for the exact hand-tuned values. | The seed-derived default, or your own palette, is what you want. |

The order matters at the top: the element CSS reads `var(--text-1)`, `var(--bg-2)`, and friends, and only `tokens.css` defines them. Skip the tokens import and components render unstyled.

### Cascade layers

Anta's reset and element CSS live in `@layer anta`. `tokens.css` pre-declares `@layer base, anta, components, utilities;`: Anta's defaults sit above preflight resets (Tailwind's `@layer base`, Normalize) and below your `@layer components` rules and utility frameworks.

For a different order, declare it in your own CSS loaded **before** `tokens.css` — the first mention of each layer name fixes its position:

```css
/* your global.css, loaded before anta */
@layer reset, anta, my-components, utilities;
```

CSS custom properties (the `:root { --… }` declarations in `tokens.css`) stay unlayered so they take effect everywhere unconditionally.

> **Gotcha: an unlayered hard reset defeats Anta's element rules.**
>
> ```css
> *, *::before, *::after { box-sizing: border-box; }
> * { margin: 0; }
> ```
>
> Unlayered styles beat layered ones regardless of specificity, so this common copy-paste outranks every per-element default Anta ships (`p` margins, list padding, and the rest). `reset.css` already does the same universal reset inside `@layer anta` — delete the duplicate from your global CSS, or wrap your own reset in `@layer base { … }` so Anta's element rules still win.

## Registering elements

The JSX wrappers render `<a-*>` tags, and the classes behind those tags must be registered **before** they appear in the DOM. Registration needs `HTMLElement`, which exists only in the UI thread of a real browser; in Node.js (SSR) and Worker threads the import is a silent no-op that costs nothing but bundle size.

```ts
import '@antadesign/anta/elements'  // auto-registers all elements
```

**Register only what you use.** `/elements` registers everything; per-element entry points register one element and load just its CSS, keeping unused elements (and their dependencies) out of your bundle:

```ts
import '@antadesign/anta/elements/a-tooltip'  // only <a-tooltip> + its CSS
import '@antadesign/anta/elements/a-button'   // only <a-button> + its CSS
```

Both forms are side-effect imports, idempotent, and SSR-safe.

The cleanest pattern is a static import at your app's entry file, outside any component or hook:

```ts
// src/main.tsx (or wherever your root render lives)
import '@antadesign/anta/elements'
import { createRoot } from 'react-dom/client'
import App from './App'
createRoot(document.getElementById('root')!).render(<App />)
```

Bundlers resolve this at module-init time, so the element classes are registered before anything renders: no flash of un-upgraded elements.

> **Why not `useEffect(() => import('@antadesign/anta/elements'), [])`?**
> `useEffect` fires after paint and the dynamic import resolves later still, so the browser paints unregistered elements (which collapse to nothing) until the upgrade catches up. `useLayoutEffect` doesn't help: the import is still async, and it warns during SSR hydration.

Where the static import goes depends on the runtime:

**Plain HTML / static sites** — a `<script type="module">` tag in the document head.

**SSR frameworks (Astro, Next.js)** — a script the framework ships only to the client. In Astro: `<script>import '@antadesign/anta/elements'</script>` (Astro `<script>` tags are client-side by default). In Next.js: a top-level import in a `'use client'` file, which only enters the client chunk.

**UI in a Worker thread (the Antithesis setup)** — the UI-thread bootstrap, the script that owns the real DOM. The Worker has no `HTMLElement`, so the import must not run there.

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

**Option B** — if you can't change `jsxImportSource` (a shared tsconfig, Emotion's `@emotion/react` source), merge anta's tag map into your JSX namespace yourself: anta exports it as `AntaIntrinsicElements` (and `@antadesign/stickers` as `StickerIntrinsicElements`), one `extends` in any `.d.ts` your tsconfig covers:

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

The elements work in plain HTML; registering them also loads their CSS. The bare specifier needs a bundler or an import map to resolve.

```html
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

Anta is designed for a customized <a href="https://typetype.org/fonts/tt-interphases-pro" target="_blank" rel="noopener noreferrer">TT Interphases Pro</a> but ships no font binaries. Components reference families through the `--sans-serif` and `--monospace` variables and fall back to system stacks. The base size is `font-size: 15px` on `:root` (so `1rem = 15px`), a deliberate step down from the browser's 16px for Antithesis's information-dense layouts. Both live in `tokens.css`.

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
