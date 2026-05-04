# Anta — Antithesis Design System

Published as `@antadesign/anta` on npm. Portable UI component library. Works in React apps out of the box, in Preact via compat aliasing (`react` → `preact/compat`), and in custom runtimes via `configure()`.

## Architecture

Two tiers per component:

- **`src/elements/`** — Web components (custom elements). Attribute-driven, shadow DOM for rendering, plain CSS for token definitions. Files: `a-{name}.ts`, `a-{name}.css`. The external CSS file defines CSS variable tokens on the host, and the shadow DOM style references those variables. No visible attributes are set from JS on the host element — only shadow-internal styles are modified (e.g. setting `--_percent` on an internal element).
- **`src/components/`** — JSX wrappers. State management, CSS modules. Files: `{Name}.tsx`, `{Name}.module.css`. These handle logic and provide a typed component API. Use `clsx` (imported as `cn`) for class joining. Forward `style` and extra props via spread to the underlying web component.

The tiers are decoupled — JSX wrappers emit `<a-*>` tags but never import element definitions. Binding is by tag name at runtime.

### Key files

- `src/jsx-runtime.ts` — Custom JSX runtime. Defaults to `React.createElement`. Call `configure(h)` to swap.
- `src/types.d.ts` — CSS module type declarations and `JSX.IntrinsicElements` for `a-*` custom elements.
- `src/elements/index.ts` — Barrel export that auto-registers all web components in browser contexts. **Must only be imported client-side** — `HTMLElement` does not exist in Node/SSR.
- `src/index.ts` — Barrel export for JSX components and `configure()`.

## Build & dev

Source lives in `src/`. Build output goes to `dist/`. The `dist/` directory is **committed to git** so the package can be consumed directly from GitHub (`github:antithesishq/anta#tag`).

```sh
pnpm run build        # Full build: JS + CSS + types
pnpm run build:js     # esbuild: TSX/TS → dist/*.js
pnpm run build:css    # Copy CSS files to dist (esbuild non-bundle mode doesn't output them)
pnpm run build:types  # tsc: emit .d.ts declarations
pnpm run typecheck    # Type check without emit
```

**Important**: esbuild runs in non-bundle mode (no `--bundle` flag). It compiles each entry point individually but does **not** process CSS imports — it leaves `import "./a-progress.css"` in the JS output without copying the CSS file. The `build:css` step copies CSS files manually. When adding a new component, add its CSS files to `build:css`.

Uses `jsx: "react-jsx"` with `jsxImportSource: "@antadesign/anta"` (automatic transform). The compiled output self-references the package via the exports map: `import { jsx } from "@antadesign/anta/jsx-runtime"`.

### Pre-commit hook

A git pre-commit hook (`/.git/hooks/pre-commit`) auto-rebuilds `dist/` when source files are staged. If the build fails, it warns but does not block the commit — CI catches build failures on PR merge.

### CI

`.github/workflows/ci.yml` runs on pull requests to main:
1. `pnpm run build` — build anta
2. `pnpm run typecheck` — type check
3. Verify `dist/` is up to date (no uncommitted build output drift)
4. `pnpm --filter anta-site build` — build the docs site

## Package consumption

Consumers can use anta via:
- **npm**: `"@antadesign/anta": "dev"` (prerelease) or a specific version
- **GitHub**: `"@antadesign/anta": "github:antithesishq/anta#v0.1.0"`
- **Local link**: `"@antadesign/anta": "link:/path/to/anta"` (for development)

The `exports` map handles all subpath imports. Explicit entries exist for `.`, `./jsx-runtime`, `./elements`, `./elements/*`, plus a `"./*"` wildcard fallback. `main` and `types` fields provide fallback for classic `moduleResolution: "node"`.

`react` is a **peer dependency** — consumers provide it (or alias it to `preact/compat`).

### SSR caveat

`@antadesign/anta/elements` registers custom elements using `HTMLElement`, which does not exist in Node.js. In SSR contexts (Astro, Next.js), import it client-side only:

```tsx
// In Astro: use a <script> tag (client-side by default)
<script>import '@antadesign/anta/elements'</script>

// In a Preact/React island: dynamic import inside useEffect
useEffect(() => { import('@antadesign/anta/elements') }, [])
```

## npm publishing

```sh
npm version prerelease --preid=dev   # Bump: 0.1.1-dev.1 → 0.1.1-dev.2
npm publish --access public --tag dev  # Publish prerelease under "dev" tag
```

Each version string is immutable on npm — always bump before publishing.

## Changelog

`CHANGELOG.md` at the repo root documents changes to **the `@antadesign/anta` package only** — code shipped to npm consumers (anything under `src/` and `dist/`, plus root files in the published tarball). The docs site under `site/` is its own thing and **does not** belong in the changelog. New site pages, component-docs polish, demos, layout tweaks — all of that ships only on `antadesign.dev` and isn't a consumer-facing change.

When in doubt: would a consumer who installs this version see this change in their app? If no, leave it out of `CHANGELOG.md`. Use commit messages and PR descriptions for the docs-site narrative.

## Documentation site

The `site/` folder is the anta design system documentation website, built as a pnpm workspace member.

**Stack**: Astro 5 (static output) + Preact + MDX + astro-expressive-code (syntax highlighting, tokyo-night theme). Remark plugins: GFM, math, directive, definition-list, attributes. Rehype plugins: slug, autolink-headings, mathjax.

**Structure**:
- `site/src/layouts/DocsLayout.astro` — Sidebar + main content shell. Imports `@antadesign/anta/elements` via client-side `<script>`.
- `site/src/pages/` — `.astro` pages for static content, `.mdx` pages for component docs with code examples
- `site/src/components/` — Preact island components (`.tsx`) for interactive demos, hydrated with `client:load`
- `site/src/styles/base.css` — Minimal reset and typography (inline values, no CSS variables — will adopt anta's global tokens when available)

**How it uses anta**: `"@antadesign/anta": "workspace:*"` resolves to the local package. Anta must be built first (`pnpm run build` in root). Preact compat (`@astrojs/preact({ compat: true })`) aliases `react` → `preact/compat`, so anta's jsx-runtime works without calling `configure()`.

```sh
cd site && pnpm run dev      # Dev server
cd site && pnpm run build    # Static build
```

**Adding a component docs page**: Create `site/src/pages/components/{name}.mdx` with `layout: ../../layouts/DocsLayout.astro`. For interactive demos, create a Preact island in `site/src/components/` and include it with `<Demo client:load />`.

## Design references

When naming components, props, CSS variables, internal class names, or suggesting patterns, reference established design systems: Material Design, shadcn/ui, Carbon Design System, and Shopify Polaris Web Components. Prefer terminology and conventions already used by these libraries over inventing new ones.

## Working with Figma

See `FIGMA.md` for rules when extracting tokens, components, or styles from the Anta Figma library. Key rule: **always read the full variable list directly from the collection** — don't infer the token set from `get_variable_defs` on a sample node, because tokens that aren't placed on the queried node won't appear, and you'll silently miss values.

## Color manipulation

**To tune the alpha of any color (variable, `currentColor`, hex, etc.), always use `color-mix(in oklch, <color> <percent>%, transparent)`**. Mixing in `oklch` keeps the perceived hue/lightness stable, while the percent maps directly to the desired alpha (e.g. `50%` → 0.5 alpha). This is the standard pattern in Anta — do not reach for `rgba(...)`, hex-with-alpha (`#rrggbbaa`), or `opacity` on the parent when only the alpha of one color needs to change.

```css
/* underline at half-strength of the link's color */
text-decoration-color: color-mix(in oklch, currentColor 50%, transparent);

/* token at 80% alpha */
border-color: color-mix(in oklch, var(--border-2) 80%, transparent);
```

The same rule applies anywhere we lighten/darken/desaturate a color: prefer `color-mix(in oklch, <color> <p>%, <other-color>)` so all interpolation happens in a perceptually-uniform space.

## Conventions

- **Declarative DOM** — Web components are pure declarative. **No element class — neither the constructor nor `attributeChangedCallback` nor any handler — may call `setAttribute`, mutate `className`, set inline `style`, or otherwise change anything on the host element that's visible in the DOM tree.** The host's attributes and inline styles must come from the JSX wrapper (or from the consumer writing `<a-…>` directly). Only shadow-internal elements may be mutated from JS.
- **ARIA goes in JSX wrappers, not web components.** All `role`, `aria-*`, `tabindex`, etc., are added by `src/components/<Name>.tsx` as attribute pass-through, never by `AXxxElement.constructor`. This keeps the web component re-renderable from any reactive engine without state churning the DOM, and keeps the elements usable in non-React/Preact contexts where the consumer adds ARIA themselves. The single exception is when the wrapper passes a value through (e.g. `aria-valuenow={value}`); the wrapper is a thin JSX→DOM bridge and that's its job.
- **Don't add new web components without a strong reason.** Each one occupies a global tag name. Prefer adding props to existing elements before introducing a new tag.
- **Shadow DOM pattern** — Web components use shadow DOM. The external CSS file (`a-{name}.css`) styles the host element and handles light/dark mode via `.dark` ancestor. The shadow DOM `<style>` declares only structural defaults on `:host`.
- **CSS variables for variant values** — Use `--{component}-*` variables for any property that changes across variants (tone, dark mode). In the base rule, declare all variables first, then leave an empty line before regular properties.
- **CSS variables for shadow internals** — Use `--_` prefix for shadow-internal-only variables set from JS (e.g. `--_percent`).
- **Dark mode** — Use `.dark` ancestor class in the external CSS.
- **Default variant in union types** — Include default value explicitly in the type union (e.g. `tone?: 'neutral' | 'info'`).
- **CSS modules only on JSX wrappers**, plain CSS for web components. Use `.container` as the top-level class in CSS modules.
- **Types** — Use React global types (e.g. `React.CSSProperties`) without importing React. Components must be compatible with both React and Preact.
- **Auto-registration** — `elements/index.ts` auto-registers all custom elements in browser contexts.
- **Component-token-first** — Each component defines its own CSS custom properties. Global tokens will be added later.

## Adding a new component

1. Create `src/elements/a-{name}.ts` — web component class + `register_a_{name}()` function
2. Create `src/elements/a-{name}.css` — plain CSS using tag selector, attribute selectors for variants
3. Add to `src/elements/index.ts` — import register function, re-export, add auto-register call
4. Create `src/components/{Name}.tsx` — JSX wrapper, import CSS module
5. Create `src/components/{Name}.module.css` — scoped styles for wrapper layout
6. Add to `src/index.ts` — re-export the component
7. Add `a-{name}` to `JSX.IntrinsicElements` in `src/types.d.ts`
8. Add entry points to `build:js` script in `package.json`
9. Add CSS files to `build:css` script in `package.json`
10. Run `pnpm run build` to verify
