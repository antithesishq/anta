# @antadesign/anta

<a href="https://antithesis.com" target="_blank" rel="noopener noreferrer">Antithesis</a> design system, **Anta**, has three layers: global CSS tokens, framework-agnostic web components that work with plain HTML, and JSX wrappers for React and Preact.

The Antithesis SaaS has an unusual architecture: most of its UI code runs inside a Worker thread, driven by a custom reactive engine that powers Antithesis notebooks. To keep state in sync between the Worker and the UI thread, Anta's web components must be **fully declarative** — they never mutate their own attributes (any internal state changes happen inside Shadow DOM, invisible to the outer document). A self-mutating attribute would break the Worker↔UI sync.

This constraint shapes the architecture: the web components carry the core styling and the occasional browser-API call (e.g. `getBoundingClientRect()`) without imposing a framework. The React/Preact wrappers exist for dynamic state and conditional rendering — most components are stateless and driven entirely by attributes.

## Install

```sh
npm install @antadesign/anta
```

## Quick start

```tsx
import { Progress } from '@antadesign/anta'
import '@antadesign/anta/elements'  // registers <a-progress> custom element

<Progress value={60} />
<Progress value={42} label="Uploading files..." hint="3 of 7" />
<Progress value={75} tone="info" label="Processing" />
```

## Registering elements

The JSX wrappers render `<a-progress>` and other custom elements. The custom elements themselves must be registered with the browser **before** they appear in the DOM, and registration only works where `HTMLElement` exists — i.e. the UI thread of a real browser. **Node.js (SSR) and Worker threads don't have `HTMLElement`**, so the import will throw if it runs there.

```ts
import '@antadesign/anta/elements'  // auto-registers all elements
```

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

## Typography

Anta is designed with a customized version of [TT Interphases Pro](https://typetype.org/fonts/tt-interphases-pro) in mind, but it doesn't ship any font binaries. Components reference families through the `--sans-serif` and `--monospace` CSS variables and fall back to native system stacks when no font is registered.

Anta sets `font-size: 15px` on `:root` (so `1rem = 15px`), intentionally diverging from the browser default of 16px to match Antithesis's information-dense layouts. This is applied via `@antadesign/anta/anta_global_tokens.css`:

```ts
import '@antadesign/anta/anta_global_tokens.css'
```

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
