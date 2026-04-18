# Anta — Antithesis Design System

Portable UI component library. Works in React apps out of the box, in Preact via compat aliasing, and in the notebook's custom worker-thread runtime via `configure()`.

## Architecture

Two tiers per component:

- **`elements/`** — Web components (custom elements). Attribute-driven, shadow DOM for rendering, plain CSS for token definitions. Files: `a-{name}.ts`, `a-{name}.css`. These are the declarative styling layer — the external CSS file defines CSS variable tokens on the host, and the shadow DOM style references those variables. No visible attributes are set from JS on the host element — only shadow-internal styles are modified (e.g. setting `--_percent` on an internal element). This keeps the DOM fully declarative and in sync with the worker thread caller.
- **`components/`** — JSX wrappers. State management, CSS modules. Files: `{Name}.tsx`, `{Name}.module.css`. These handle logic and provide a typed component API. Use `classnames` (imported as `cn`) for class joining. Forward `style` and extra props via spread to the underlying web component.

The tiers are decoupled — JSX wrappers emit `<a-*>` tags but never import element definitions. Binding is by tag name at runtime.

### Key files

- `jsx-runtime.ts` — Custom JSX runtime. Defaults to `React.createElement`. Call `configure(h)` to swap (e.g. notebook's `Printable` `h`).
- `types.d.ts` — CSS module type declarations and `JSX.IntrinsicElements` for `a-*` custom elements. Add new elements here.
- `elements/index.ts` — Barrel export that auto-registers all web components in browser contexts. Import this from the UI thread or any regular app. Never import from the worker thread.
- `index.ts` — Barrel export for JSX components and `configure()`.

## Build & dev

Anta has its own `tsconfig.json` in `src/` — standalone. Uses `jsx: "react-jsx"` with `jsxImportSource: "anta"` (automatic transform — no explicit `h` import needed in component files).

Pre-built to `dist/` (at repo root). The `dist/` directory contains both `.js` (from esbuild with automatic JSX transform) and `.d.ts` (from tsc).

```sh
# Type check
pnpm run typecheck

# Build (JS + declarations)
pnpm run build

# Or manually:
pnpm exec esbuild \
  src/components/Progress.tsx src/index.ts src/jsx-runtime.ts \
  src/general_types.ts src/anta_helpers.ts \
  src/elements/index.ts src/elements/a-progress.ts \
  --outdir=dist --outbase=src \
  --jsx=automatic --jsx-import-source=anta \
  --format=esm --target=ES2022 \
  --loader:.module.css=local-css --loader:.css=global-css
pnpm exec tsc -p src/tsconfig.json
```

## Design references

When naming components, props, CSS variables, internal class names, or suggesting patterns, reference established design systems: Material Design, shadcn/ui, Carbon Design System, and Shopify Polaris Web Components. Prefer terminology and conventions already used by these libraries over inventing new ones.

## Conventions

- **Declarative DOM** — The fundamental principle: no visible attributes or inline styles are set on the host element from JS. Only shadow-internal elements may be styled from `attributeChangedCallback`. This ensures the DOM stays in sync with the worker thread caller.
- **Shadow DOM pattern** — Web components use shadow DOM. The external CSS file (`a-{name}.css`) styles the host element with direct CSS properties and handles light/dark mode via `.dark` ancestor. The shadow DOM `<style>` (inline in the constructor) declares only structural defaults on `:host` (display, position, overflow) — visual properties like background, border, and border-radius are set externally and override `:host` via normal specificity.
- **CSS variables only for shadow internals** — Use `--{component}-*` variables only when external CSS needs to style elements inside shadow DOM (e.g. `--progress-indicator-bg` for the indicator background). Do not create variables that mirror host-level properties 1:1 — set those directly in the external CSS. For example, `padding`, `background`, `border`, `container-type` go directly on the element selector in the external CSS, not through a CSS variable. Reserve variables for values that must cross the shadow DOM boundary.
- **Dark mode** — Use `.dark` ancestor class in the external CSS: `.dark a-progress { background: #021A2D; }`.
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
8. Regenerate declarations: `pnpm run build:types`
