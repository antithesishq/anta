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
elements or import CSS. Load element entries in the browser's UI thread;
see [Registering elements](#registering-elements) for server and worker rendering.

Composed components have CSS-only entries for their layout styles:

| JSX wrapper | UI-side style entry |
|---|---|
| `Breadcrumbs` | `@antadesign/anta/elements/a-breadcrumbs` |
| `Steps` | `@antadesign/anta/elements/a-steps` |
| `InputDate` | `@antadesign/anta/elements/a-input-date` |
| `Select` | `@antadesign/anta/elements/a-select` |
| `SelectFaceted` | `@antadesign/anta/elements/a-select-faceted` |

These entries load layout CSS without registering a class or loading nested
elements. Import the browser elements used by the composition too. For example,
`Steps` uses Tabs and Tooltip, and may render icons, loaders, or panels depending
on its props:

```ts
// Browser UI entry, alongside shared tokens and the optional reset.
import '@antadesign/anta/elements/a-steps'
import '@antadesign/anta/elements/a-tabs'
import '@antadesign/anta/elements/a-tab'
import '@antadesign/anta/elements/a-tabpanel'
import '@antadesign/anta/elements/a-tooltip'
import '@antadesign/anta/elements/a-icon'
import '@antadesign/anta/elements/a-loader'
```

Import `Steps` from `@antadesign/anta` where you render JSX, including in a worker
or on the server. Select and SelectFaceted share one stylesheet, which bundlers
include once when both style entries are imported.

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
seed-derived default palette. These theme files do not load fonts. Choose fonts
separately; see [Fonts](#fonts).

### What you import (and why)

| Import | Provides |
|---|---|
| `@antadesign/anta/bundle` | All browser element definitions and the JSX API in one minified ESM runtime. |
| `@antadesign/anta/bundle.css` | Global tokens, reset, element, and composed wrapper styles in one minified stylesheet. |
| `@antadesign/anta/tokens.css` | Shared color roles, fonts, dark-mode support, and layer order for granular usage. |
| `@antadesign/anta/reset.css` | Optional reset and typography defaults in `@layer anta.reset`. |
| `@antadesign/anta/elements/a-*` | One element's behavior and CSS, or CSS alone for structural tags and composed layouts. |
| `@antadesign/anta/elements` | All browser element definitions, element styles, and composed layout styles through separate modules. |
| `@antadesign/anta` | Typed JSX wrappers for React, Preact, and configured runtimes, without CSS or element registration. |
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

JSX wrappers render `<a-*>` tags. Load their browser definitions and styles in
the UI thread before rendering or hydrating those tags. For full bundle usage,
and hooks:

```ts
// src/main.tsx (or wherever your root render lives)
import '@antadesign/anta/bundle.css'
import '@antadesign/anta/bundle'
import { createRoot } from 'react-dom/client'
import App from './App'
createRoot(document.getElementById('root')!).render(<App />)
```

The JavaScript bundle registers all browser elements. With granular usage, load
shared tokens, the optional reset, and the entries your app uses:

```ts
import '@antadesign/anta/tokens.css'
import '@antadesign/anta/reset.css'
import '@antadesign/anta/elements/a-tooltip'  // <a-tooltip> behavior and CSS
import '@antadesign/anta/elements/a-button'   // <a-button> behavior and CSS
import '@antadesign/anta/elements/a-title'    // Title CSS only
import '@antadesign/anta/elements/a-tag'      // Tag CSS only
```

To load all browser elements and layout styles, replace the individual element
imports with `import '@antadesign/anta/elements'`. Keep the shared tokens and
optional reset. Registration is idempotent and guarded when `customElements`
is unavailable. CSS imports need a bundler that handles stylesheets.

Static imports register classes before the app's first client render or
hydration. Server-rendered HTML can paint before the browser loads JavaScript;
load its CSS with the initial document, as in the Next.js setup below.

> Loading elements in `useEffect` can delay registration until after paint. The
> dynamic import resolves later, so unregistered elements can appear first.
> Moving the dynamic import into `useLayoutEffect` still leaves the import
> asynchronous. Use a static import at the top of the UI entry.

Choose the entry point for your runtime:

- **Plain HTML or static sites:** a module entry processed by a bundler that
  handles CSS imports; see [Raw web components](#raw-web-components-no-jsx).
- **Astro:** import the runtime in an Astro-processed `<script>` and the CSS in
  your layout. For full bundle usage, use `bundle` and `bundle.css`.
- **Next.js:** import the runtime from a `'use client'` file and the CSS from
  your root layout; see [Next.js](#nextjs).
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
For a custom JSX runtime, call `configure()` in the process or thread that
renders the wrappers; see [Framework setup](#framework-setup).

## Framework setup

### React

React needs no `configure()` call. Load the JavaScript and CSS entries for your
chosen import strategy before rendering.

### Next.js

For the full bundle setup, import its stylesheet in the App Router root layout:

```tsx
// app/layout.tsx
import '@antadesign/anta/bundle.css'
import type { ReactNode } from 'react'

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
```

Import the runtime and JSX wrappers in a Client Component:

```tsx
// app/page.tsx
'use client'

import { useState } from 'react'
import { Button, Title } from '@antadesign/anta/bundle'

export default function Page() {
  const [count, setCount] = useState(0)
  return <>
    <Title>Anta in Next.js</Title>
    <Button label={`Count: ${count}`} onClick={() => setCount(value => value + 1)} />
  </>
}
```

Next.js prerenders Client Components on the server for the initial page load.
`'use client'` marks the client/server module boundary; it does not disable
server rendering. Anta guards element registration when browser APIs are absent
and registers the elements when the client module runs before hydration.

For granular usage, replace the layout's bundle stylesheet with shared tokens
and the optional reset:

```ts
// app/layout.tsx imports
import '@antadesign/anta/tokens.css'
import '@antadesign/anta/reset.css'
```

Keep the same page component and replace its imports with:

```ts
// app/page.tsx
'use client'

import { useState } from 'react'
import '@antadesign/anta/elements/a-button'
import '@antadesign/anta/elements/a-title'
import { Button, Title } from '@antadesign/anta'
```

Both setups work with Next.js's default Turbopack bundler.

### Preact with compat

If your bundler aliases `react` to `preact/compat`, Anta needs no `configure()`
call. Load the entries for your chosen import strategy. The Vite Preact preset
provides these runtime aliases.

### Preact without compat

If `react` is not aliased to `preact/compat`, pass Preact's JSX factory and hooks
to `configure()` before rendering Anta components. For full bundle usage:

```ts
import '@antadesign/anta/bundle.css'
import { configure } from '@antadesign/anta/bundle'
import { h, Fragment } from 'preact'
import { useState, useId, useMemo, useRef, useLayoutEffect } from 'preact/hooks'
import { useSyncExternalStore } from 'preact/compat'

configure(h, Fragment, {
  useState, useId, useMemo, useRef, useLayoutEffect, useSyncExternalStore,
})
```

Import JSX wrappers from `@antadesign/anta/bundle` with this setup. For granular
usage, import both `configure` and the wrappers from `@antadesign/anta` and load
the UI entries separately. The root package and the prebuilt bundle each have
their own renderer configuration, so use `configure` from the same entry as
your wrappers. The explicit `preact/compat` hook import does not require an alias.

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

Elements also work in plain HTML without JSX wrappers. This example requires a
bundler that processes module scripts and CSS imports:

```html
<script type="module">
  import '@antadesign/anta/tokens.css'
  import '@antadesign/anta/reset.css'
  import '@antadesign/anta/elements/a-progress'
</script>

<a-progress value="42" max="100" tone="info"></a-progress>
```

An import map resolves module names but does not process the plain CSS imports
in Anta's element entries. When serving native modules without a bundler, use
a separately prepared JavaScript entry and linked stylesheets.

## Dark mode

For a page-wide dark mode, add `dark` to `html`. Shared tokens switch the palette
and root color scheme, including scrollbar colors. The reset, included in
`bundle.css` or loaded separately as `reset.css`, paints `body` with `--bg-2`:

```html
<html class="dark">
  <body>
    <a-progress value="50"></a-progress>
  </body>
</html>
```

Use `dark` or `light` on another ancestor to scope its color scheme and palette.
If you omit the reset, set your app's background and text color in your own CSS,
for example with `--bg-2` and `--text-2`.

## Fonts

`tokens.css` defines system stacks in `--sans-serif`, `--serif`, and
`--monospace`, and sets `1rem` to 15px. The optional themes keep those stacks
and do not register font faces or request font files. Components and theme rules
choose which stack to use.

Use fonts from Google Fonts or host font files in your application. Manage font
loading in a separate stylesheet such as `fonts.css`, and import it after the
Anta styles and optional theme. See [Font examples](./theming.md#fonts-in-a-theme)
for Google Fonts and the separate reference font setup used by anta.design.

Register application-owned fonts and redefine the variables in CSS loaded after
the Anta styles and optional theme. This example uses separate Roman and Italic
variable files in an application-owned `fonts.css`:

```css
@font-face {
  font-family: "App Sans";
  src: url("/fonts/app-sans-roman.woff2") format("woff2");
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}

@font-face {
  font-family: "App Sans";
  src: url("/fonts/app-sans-italic.woff2") format("woff2");
  font-style: italic;
  font-weight: 100 900;
  font-display: swap;
}

:root {
  --sans-serif: "App Sans", sans-serif;
  --serif: Georgia, serif;
  --monospace: ui-monospace, monospace;
}
```

Place this application stylesheet after `theme-antune.css` or
`theme-antithesis.css`, not before it. When all stylesheets are in the document
head, the override applies before the first paint. Anta's reset styles semantic
italics (`em`, `i`, `var`, and `dt`) to select the Italic face. If you omit the
reset, your application or the browser's default rules provide those styles.

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
