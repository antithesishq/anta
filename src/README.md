# Anta

Portable UI component library. Framework-agnostic web components with JSX wrappers that work in React, Preact, or any custom JSX runtime.

## Usage

### React

Works out of the box — no configuration needed.

```tsx
import { Progress } from '@antadesign/anta/bundle'

<Progress value={42} max={100} tone="info" />
```

### Preact (compat mode)

If your project aliases `react` → `preact/compat`, anta works with no extra setup — same as React.

### Preact (no compat)

Call `configure()` before rendering any anta components:

```ts
import { configure } from '@antadesign/anta'
import { h, Fragment } from 'preact'

configure(h, Fragment)
```

### Custom JSX runtime

Pass any `h(type, props, ...children)` function:

```ts
import { configure } from '@antadesign/anta'
configure(myH, myFragment)
```

## Web components

Anta combines CSS-only light-DOM components with custom elements for browser
behavior. Import the element barrel to load their styles and register browser
classes, or load individual entries:

```ts
import '@antadesign/anta/elements'  // All styles and browser classes
import '@antadesign/anta/elements/a-progress'  // CSS-only Progress entry
```

Raw web components work without JSX:

```html
<a-progress value="42" max="100" tone="info" role="progressbar"
  aria-label="Upload" aria-valuenow="42" aria-valuemin="0" aria-valuemax="100">
  <a-progress-indicator aria-hidden="true">
    <svg width="42%" height="100%"></svg>
  </a-progress-indicator>
</a-progress>
```
