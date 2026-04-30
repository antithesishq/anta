# Anta

Portable UI component library. Framework-agnostic web components with JSX wrappers that work in React, Preact, or any custom JSX runtime.

## Usage

### React

Works out of the box — no configuration needed.

```tsx
import { Progress } from 'anta'

<Progress value={42} max={100} tone="info" />
```

### Preact (compat mode)

If your project aliases `react` → `preact/compat`, anta works with no extra setup — same as React.

### Preact (no compat)

Call `configure()` before rendering any anta components:

```ts
import { configure } from 'anta'
import { h, Fragment } from 'preact'

configure(h, Fragment)
```

### Custom JSX runtime

Pass any `h(type, props, ...children)` function:

```ts
import { configure } from 'anta'
configure(myH, myFragment)
```

## Web components

Anta components are built on custom elements with shadow DOM. Import `anta/elements` to auto-register them, or use individual register functions:

```ts
import 'anta/elements'           // auto-register all
import { register_a_progress } from 'anta/elements'  // one at a time
```

Raw web components work without JSX:

```html
<a-progress value="42" max="100" tone="info"></a-progress>
```
