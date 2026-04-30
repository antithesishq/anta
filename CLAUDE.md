# Anta — Antithesis Design System

Portable UI component library. Works in React apps out of the box, in Preact via compat aliasing, and in the notebook's custom worker-thread runtime via `configure()`.

## Architecture

Two tiers per component:

- **`elements/`** — Web components (custom elements). Attribute-driven, shadow DOM for rendering, plain CSS for token definitions. Files: `a-{name}.ts`, `a-{name}.css`. These are the declarative styling layer — the external CSS file defines CSS variable tokens on the host, and the shadow DOM style references those variables. No visible attributes are set from JS on the host element — only shadow-internal styles are modified (e.g. setting `--_percent` on an internal element). This keeps the DOM fully declarative and in sync with the worker thread caller.
- **`components/`** — JSX wrappers. State management, CSS modules. Files: `{Name}.tsx`, `{Name}.module.css`. These handle logic and provide a typed component API. Use `clsx` (imported as `cn`) for class joining. Forward `style` and extra props via spread to the underlying web component.

The tiers are decoupled — JSX wrappers emit `<a-*>` tags but never import element definitions. Binding is by tag name at runtime.

### Key files

- `jsx-runtime.ts` — Custom JSX runtime. Defaults to `React.createElement`. Call `configure(h)` to swap (e.g. notebook's `Printable` `h`).
- `types.d.ts` — CSS module type declarations and `JSX.IntrinsicElements` for `a-*` custom elements. Add new elements here.
- `elements/index.ts` — Barrel export that auto-registers all web components in browser contexts. Import this from the UI thread or any regular app. Never import from the worker thread.
- `index.ts` — Barrel export for JSX components and `configure()`.

## Build & dev

Anta has its own `tsconfig.json` — standalone, not extending the notebook's config. Uses `jsx: "react-jsx"` with `jsxImportSource: "anta"` (automatic transform — no explicit `h` import needed in component files).

Anta is **pre-built** to `dist/` before the notebook builds. The `dist/` directory contains both `.js` (from esbuild with automatic JSX transform) and `.d.ts` (from tsc). The notebook consumes only pre-built output, never anta source `.tsx` files.

```sh
# Type check anta in isolation
cd notebook/anta && npx tsc --noEmit -p tsconfig.json

# Pre-build anta (JS + declarations)
cd notebook && ./node_modules/.bin/esbuild \
  anta/components/Progress.tsx anta/index.ts anta/jsx-runtime.ts \
  anta/general_types.ts anta/anta_helpers.ts \
  anta/elements/index.ts anta/elements/a-progress.ts \
  --outdir=anta/dist --outbase=anta \
  --jsx=automatic --jsx-import-source=anta \
  --format=esm --target=ES2022 \
  --loader:.module.css=local-css --loader:.css=global-css
cd notebook/anta && npx tsc -p tsconfig.json

# Type check the notebook
cd notebook && npx tsc --noEmit
```

### How the notebook sees anta

The notebook's tsconfig uses classic JSX (`jsxFactory: "h"`) — it **cannot** compile anta's `.tsx` files. Instead:

- Both tsc and esbuild path aliases point to `anta/dist/` (pre-built JS + declarations)
- The `"anta/*"` wildcard alias in tsconfigs is restricted to `anta/elements/*` only (pure `.ts`, no JSX)
- `anta/elements/` contains pure `.ts` files and can be imported directly
- In the Nix build (`default.nix`), `anta_declarations` generates `.d.ts` files, and `notebook_source_with_anta` layers them into the source tree — excluding `components/`, `index.ts`, and `jsx-runtime.ts` from the tsc source
- The tsc watch command generates declarations once before starting

### Config files that reference anta

- `tsconfig.base.json` — `"anta"` path alias + excludes
- `tsconfig.node.json` — has its own `paths` that **overrides** the base (anta aliases must be added there separately)
- `esbuild.json` / `esbuild.node.json` — `"anta"` and `"anta/*"` aliases for bundling
- `.eslintrc.js` — anta in `ignorePatterns`
- `.gitignore` — `notebook/anta/dist`

## Design references

When naming components, props, CSS variables, internal class names, or suggesting patterns, reference established design systems: Material Design, shadcn/ui, Carbon Design System, and Shopify Polaris Web Components. Prefer terminology and conventions already used by these libraries over inventing new ones.

## Conventions

- **Declarative DOM** — The fundamental principle: no visible attributes or inline styles are set on the host element from JS. Only shadow-internal elements may be styled from `attributeChangedCallback`. This ensures the DOM stays in sync with the worker thread caller.
- **Shadow DOM pattern** — Web components use shadow DOM. The external CSS file (`a-{name}.css`) styles the host element with direct CSS properties and handles light/dark mode via `.dark` ancestor. The shadow DOM `<style>` (inline in the constructor) declares only structural defaults on `:host` (display, position, overflow) — visual properties like background, border, and border-radius are set externally and override `:host` via normal specificity.
- **CSS variables for variant values** — Use `--{component}-*` variables for any property that changes across variants (tone, dark mode). This includes host-level properties like `background` and `border-color` — define them as variables so variant blocks only contain variable assignments. In the base rule, declare all variables first, then leave an empty line before regular properties that consume them.
- **CSS variables for shadow internals** — Also use `--{component}-*` variables when external CSS needs to style elements inside shadow DOM (e.g. `--progress-indicator-bg`). Use `--_` prefix for shadow-internal-only variables set from JS (e.g. `--_percent`).
- **Dark mode** — Use `.dark` ancestor class in the external CSS: `.dark a-progress { background: #021A2D; }`.
- **Default variant in union types** — When a prop like `tone` has a default/neutral value, include it explicitly in the type union (e.g. `tone?: 'neutral' | 'info'`). The JSX wrapper passes it through to the web component as-is — no need to map the default value to `undefined`. The CSS simply has no attribute selector for the default variant, so the base element styles apply naturally. Only non-default variants get `[attr="value"]` rules in CSS.
- **CSS modules only on JSX wrappers**, plain CSS for web components. Use `.container` as the top-level class in CSS modules (not `.wrapper`).
- **Types** — Use React global types (e.g. `React.CSSProperties` for `style` props) without importing React. These work in both React and Preact contexts. Anta components must be compatible with both.
- **Auto-registration** — `elements/index.ts` auto-registers all custom elements when imported in a browser context. Individual `register_a_*()` functions are also exported for fine-grained control.
- **JSX runtime substitution** — The notebook worker thread calls `configure(printable_h)` to swap in its custom `Printable`-returning `h`. Regular React/Preact consumers don't need to call `configure()`.

## Adding a new component

1. Create `elements/a-{name}.ts` — web component class + `register_a_{name}()` function
2. Create `elements/a-{name}.css` — plain CSS using tag selector `a-{name}`, attribute selectors for variants
3. Add to `elements/index.ts` — import register function, re-export, add auto-register call
4. Create `components/{Name}.tsx` — JSX wrapper, import CSS module
5. Create `components/{Name}.module.css` — scoped styles for wrapper layout
6. Add to `index.ts` — re-export the component
7. Add `a-{name}` to `JSX.IntrinsicElements` in `types.d.ts`
8. Regenerate declarations: `cd notebook/anta && npx tsc -p tsconfig.json`
