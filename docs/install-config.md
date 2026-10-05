# Install and configure

## Installation

```sh
npm install @antadesign/anta   # or pnpm / bun
```

Pin an exact version in `package.json` (`"@antadesign/anta": "0.3.16"`) instead
of a floating tag such as `"latest"`.

### Full bundle

Use the full bundle as the default setup. Import the JavaScript entry and its
stylesheet in your browser app entry:

```tsx
import '@antadesign/anta/bundle.css'
import { Progress } from '@antadesign/anta/bundle'

<Progress value={42} label="Uploaded" hint="3 of 7" />
```

`bundle` registers every custom element and exports the JSX wrappers.
`bundle.css` contains global tokens, the reset, element styles, and composed
wrapper styles. The JavaScript bundle does not import this stylesheet, so keep
both imports. Its React peer dependency and Preact configuration are the same
as the regular JSX entry.

Use this pair together. Adding granular element imports also loads their CSS,
duplicating rules already in `bundle.css`.

### Granular usage (advanced)

Use granular imports to choose which browser elements and styles your app loads,
or to render JSX on a server or in a worker. Load shared tokens once, optionally
include the reset, and import the element entries you use:

```tsx
import '@antadesign/anta/tokens.css'
import '@antadesign/anta/reset.css'
import '@antadesign/anta/elements/a-progress'
import '@antadesign/anta/elements/a-title'
import '@antadesign/anta/elements/a-tag'
import { Progress, Title, Tag } from '@antadesign/anta'

<>
  <Title>Uploads</Title>
  <Progress value={42} label="Uploaded" hint="3 of 7" />
  <Tag>In progress</Tag>
</>
```

Each element entry imports its own CSS for your bundler to include and registers
its browser class when needed. Title and Tag load only CSS; they have no custom
element class to register. Element entries do not import global tokens or the reset.

JSX wrappers produce `<a-*>` tags and attributes. They do not register browser
elements or load those elements' CSS. Composed wrappers such as Steps and Select
also import their own layout CSS. Load element entries in the browser's UI thread;
see [Registering elements](#registering-elements) for server and worker rendering.

To load all elements through the separate entries, replace the per-element imports
with `import '@antadesign/anta/elements'`. Keep the tokens and optional reset.

Individual stylesheets are also exported for direct CSS imports. With a bundler
that supports `?raw`, you can read a stylesheet as text:

```ts
import titleCss from '@antadesign/anta/elements/a-title.css?raw'
```

This returns CSS text; it does not apply styles or register an element.

### Optional theme

Add one optional theme after either the full bundle CSS or the granular styles:

```ts
import '@antadesign/anta/theme-antune.css'
```

Use `theme-antithesis.css` for Antithesis, or omit both themes to keep the
seed-derived default palette.

### What you import (and why)

| Import | Provides |
|---|---|
| `@antadesign/anta/bundle` | All browser element definitions and the JSX API in one minified ESM runtime. |
| `@antadesign/anta/bundle.css` | Global tokens, reset, element, and composed wrapper styles in one minified stylesheet. |
| `@antadesign/anta/tokens.css` | Shared color roles, fonts, dark-mode support, and layer order for granular usage. |
| `@antadesign/anta/reset.css` | Optional reset and typography defaults in `@layer anta.reset`. |
| `@antadesign/anta/elements/a-*` | One element's behavior and CSS, or CSS alone for Title and Tag. |
| `@antadesign/anta/elements` | All browser element definitions and their CSS through separate modules. |
| `@antadesign/anta` | Typed JSX wrappers for React, Preact, and configured runtimes. |
| `@antadesign/anta/elements/*.css` | Individual stylesheets without element registration. |
| `@antadesign/anta/theme-antune.css` | Optional Antune theme. |
| `@antadesign/anta/theme-antithesis.css` | Optional Antithesis theme. |

With granular usage, include `tokens.css` before element styles unless your app
provides those variables. Elements depend on them for their default appearance.

### Cascade layers

Anta's reset and element CSS use child layers inside `@layer anta`. Every Anta
stylesheet reserves the same order, so granular stylesheets remain safe when a
bundler loads them before `tokens.css`:

```css
@layer base, anta, components, utilities;
@layer anta.reset, anta.components, anta.theme;
```

`anta.theme` lets the optional reference palette replace component formulas. The
outer `anta` layer keeps its public cascade position.

To change that order, declare it in CSS loaded **before any Anta stylesheet**.
The first declaration fixes a layer's position:

```css
/* your global.css, loaded before anta */
@layer reset, anta, my-components, utilities;
```

Token custom properties stay unlayered so they apply everywhere.

> **Gotcha: an unlayered hard reset defeats Anta's element rules.**
>
> ```css
> *, *::before, *::after { box-sizing: border-box; }
> * { margin: 0; }
> ```
>
> Unlayered styles beat layered ones regardless of specificity. This reset
> overrides Anta's element defaults. Delete the duplicate, or put your reset in
> `@layer base { … }`; `reset.css` already applies the same universal reset in
> `@layer anta.reset`.

## AI setup

Anta includes version-matched Markdown documentation in its npm package.
Append this section to your application's agent instruction file, such as
`AGENTS.md`, `CLAUDE.md`, or your tool's equivalent. Keep existing project rules:

```md
## Anta

Before Anta UI work, read
`node_modules/@antadesign/anta/docs/index.md`
and the pages relevant to the task.
Verify component names, imports, props, and event signatures against the
installed documentation and TypeScript declarations. Do not infer Anta APIs
from similarly named components in other libraries.
```

The path is relative to the application directory where Anta is installed.
Adjust it for your workspace or package-manager layout. Installing Anta does
not modify your agent configuration.

For tools without local file access, provide the [web documentation index](https://anta.design/llms.txt)
and your installed Anta version. Web documentation may describe a newer release.

## Registering elements

JSX wrappers render `<a-*>` tags. Load element definitions in the browser's UI
thread before rendering or hydrating those tags. The full JavaScript bundle
already registers every element. With granular usage, select individual entries
or load the elements barrel:

```ts
import '@antadesign/anta/elements'  // auto-registers all elements
```

Per-element entries load their browser behavior and styles. CSS-only entries
load styles without registering a class:

```ts
import '@antadesign/anta/elements/a-tooltip'  // only <a-tooltip> + its CSS
import '@antadesign/anta/elements/a-button'   // only <a-button> + its CSS
import '@antadesign/anta/elements/a-title'    // only Title CSS
import '@antadesign/anta/elements/a-tag'      // only Tag CSS
```

Registration is idempotent and guarded when `customElements` is unavailable.
CSS imports still need a bundler that handles stylesheets.

Use a static import in your app entry, outside components and hooks:

```ts
// src/main.tsx (or wherever your root render lives)
import '@antadesign/anta/elements'
import { createRoot } from 'react-dom/client'
import App from './App'
createRoot(document.getElementById('root')!).render(<App />)
```

Module initialisation registers the classes before the first render, avoiding a
flash of un-upgraded elements.

> **Why not `useEffect(() => import('@antadesign/anta/elements'), [])`?**
> `useEffect` runs after paint and the import resolves later. The browser can
> paint unregistered elements first. `useLayoutEffect` is still asynchronous and
> warns during SSR hydration.

Choose the entry point for your runtime:

- **Plain HTML or static sites:** a `<script type="module">` in the document head.
- **Astro or Next.js:** a client-only script. In Astro, use
  `<script>import '@antadesign/anta/elements'</script>`; in Next.js, import it
  from a `'use client'` file.
- **Worker-rendered UI:** code that runs on the UI thread and initializes the
  DOM. A Worker has no `HTMLElement`.

### Server and worker rendering

Import JSX wrappers in the code that renders your UI:

```tsx
// Server or worker
import { Button, Title } from '@antadesign/anta'
```

Load the matching browser definitions and styles in a separate UI entry:

```ts
// Browser UI thread
import '@antadesign/anta/tokens.css'
import '@antadesign/anta/reset.css'
import '@antadesign/anta/elements/a-button'
import '@antadesign/anta/elements/a-title'
```

Rendering a JSX wrapper does not register its browser element. Raw `<a-*>`
markup uses the same browser entries and can omit the JSX wrappers.

## Framework setup

### React

Works out of the box.

### Preact with compat

If your bundler aliases `react` to `preact/compat`, Anta works without setup.

### Preact without compat

Call `configure()` before rendering any anta components:

```ts
import { configure } from '@antadesign/anta'
import { h, Fragment } from 'preact'
configure(h, Fragment)
```

### TypeScript: typing raw `<a-*>` tags in JSX

JSX wrappers such as `<Button>` and `<Progress>` need no extra typing. Configure
JSX only when you write raw `<a-*>` tags.

**Option A (preferred)** — point JSX types at Anta in `tsconfig.json`:

```jsonc
{ "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "@antadesign/anta" } }
```

Every `a-*` tag type-checks, standard HTML tags keep working, and importing
`@antadesign/stickers` adds its tags automatically.

**Option B** — if `jsxImportSource` cannot change, merge Anta's tag map into
your JSX namespace with `AntaIntrinsicElements` (and `StickerIntrinsicElements`
when needed):

```ts
import type { AntaIntrinsicElements } from '@antadesign/anta'
import type { StickerIntrinsicElements } from '@antadesign/stickers' // only if you use stickers

declare global {
  namespace JSX {
    interface IntrinsicElements extends AntaIntrinsicElements, StickerIntrinsicElements {}
  }
}
```

With `@types/react` 18+ and `jsx: "react-jsx"`, JSX is module-scoped. Extend
the `react` module instead:

```ts
import type { AntaIntrinsicElements } from '@antadesign/anta'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends AntaIntrinsicElements {}
  }
}
```

Both options reject unknown tags and invalid props. New tags arrive with Anta
upgrades; there is no per-tag list to maintain.

### Raw web components (no JSX)

Elements also work in plain HTML. Registration loads their CSS; resolve the bare
specifier with a bundler or import map.

```html
<script type="module">
  import '@antadesign/anta/elements'
</script>

<a-progress value="42" max="100" tone="info"></a-progress>
```

## Dark mode

For a page-wide dark mode, add `dark` to `html`. The `body` `--bg-2` background
then paints the browser canvas, and the root controls scrollbar colors:

```html
<html class="dark">
  <body>
    <Progress value={50} />
  </body>
</html>
```

Use `dark` or `light` on another ancestor to scope its color scheme and palette.

## Fonts

Without an optional theme, `tokens.css` defines system stacks in `--sans-serif`,
`--serif`, and `--monospace`. Reference themes register hosted fonts and replace
some of those same variables. Components and theme rules decide which stack to
use. Theme-free components do not force font-specific stylistic sets or
variable-font axes. `tokens.css` also sets `1rem` to 15px.

Register application-owned fonts and redefine the variables in CSS loaded after
the Anta styles and optional theme. This example uses separate Roman and Italic
variable files:

```css
@font-face {
  font-family: "App Sans";
  src: url("/fonts/app-sans-roman.woff2") format("woff2");
  font-style: normal;
  font-weight: 100 900;
}

@font-face {
  font-family: "App Sans";
  src: url("/fonts/app-sans-italic.woff2") format("woff2");
  font-style: italic;
  font-weight: 100 900;
}

:root {
  --sans-serif: "App Sans", sans-serif;
  --serif: Georgia, serif;
  --monospace: ui-monospace, monospace;
}
```

Place this application stylesheet after `theme-antune.css` or
`theme-antithesis.css`, not before it. When all stylesheets are in the document
head, the override applies before the first paint. Anta's semantic italics
(`em`, `i`, `var`, and `dt`) select the Italic face.

### Variable slant

A variable font with a standard `slnt` axis can provide both instances. Expose it
through `font-style: oblique` instead of setting `slnt` on italic elements:

```css
@font-face {
  font-family: "App Variable";
  src: url("/fonts/app-variable.woff2") format("woff2");
  font-style: oblique 0deg 12deg;
  font-weight: 100 900;
  font-stretch: 75% 100%;
}

:root {
  --sans-serif: "App Variable", sans-serif;
}
```

The browser selects `0deg` for normal text and `11deg` for semantic italics. Use
the range your font declares to avoid combining `slnt` with a synthetic oblique.

## Browser support

Anta targets evergreen browsers and ships **no baseline polyfills**. Its floor is [custom-element states](https://developer.mozilla.org/en-US/docs/Web/API/CustomStateSet), used throughout the components for their internal CSS state, alongside the [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API):

| Browser | Minimum version |
| --- | --- |
| Chrome / Edge | 125 (May 2024) |
| Safari | 17.4 (Mar 2024) |
| Firefox | 126 (May 2024) |

This is [Baseline 2024](https://web.dev/baseline). Anta also relies on relative
OKLCH, `:has()`, `dvh`, cascade layers, and constructable shadow DOM. Older
browsers can fail hard, including `:state()` being unrecognized or
`showPopover()` throwing. Gate Anta on your own support matrix when you support
older browsers.

Two features progressively enhance with fallbacks: `checkVisibility()` falls
back to `getClientRects()`, and typed CSS `attr()` supports raw
`<a-icon size>` in Chrome 133+ and Safari 18.2+. Elsewhere use `<Icon size>`
or `--icon-size`.
