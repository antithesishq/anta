# @antadesign/anta

Antithesis Design System. Portable UI components built on web components with JSX wrappers for React and Preact.

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

## Components

### Progress

A progress indicator with an optional label area.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | — | Current progress value (required) |
| `max` | `number` | `100` | Upper bound of the range |
| `tone` | `'neutral' \| 'info'` | `'neutral'` | Color variant |
| `label` | `string` | — | Text label after the percentage |
| `hint` | `string` | — | Right-aligned hint text |
| `className` | `string` | — | CSS class on the root element |
| `children` | `ReactNode` | — | Custom content replacing the default label |

**Component tokens** (CSS custom properties for theming):

| Token | Description |
|-------|-------------|
| `--progress-indicator-bg` | Indicator bar fill color |
| `--progress-indicator-edge` | Gradient at the indicator's leading edge |
| `--progress-label-color` | Percentage number color |

## Registering elements

The JSX wrappers render `<a-progress>` and other custom elements. These must be registered before they appear in the DOM:

```ts
import '@antadesign/anta/elements'  // auto-registers all elements
```

In SSR environments (Astro, Next.js), this import must run **client-side only** — `HTMLElement` does not exist in Node.js:

```tsx
// Astro: <script> tags are client-side by default
<script>
  import '@antadesign/anta/elements'
</script>

// React/Preact: dynamic import in useEffect
useEffect(() => { import('@antadesign/anta/elements') }, [])
```

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
