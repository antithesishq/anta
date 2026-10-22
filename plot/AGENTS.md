# @antadesign/plot

Follow the root AGENTS.md. This package owns plotting code, not the notebook adapter.

- `src/core/` contains series factories, composition, rendering, interactions, and presentation.
- `src/integrations/` connects host events to the core controllers. `PlotHost` shares controller lifecycle, composition, drawing, and presentation between JSX Plot and standalone a-plot; keep browser scheduling and renderer commit notifications in their respective hosts.
- `src/browser/` implements the optional light-DOM `<a-plot>` host. Preserve its established behavior during packaging.
- `src/components/` contains the public Anta JSX `Plot` and low-level `PlotSurface` wrapper. Both are exported from the package root. They must not register elements or access browser DOM. Plot owns controller and OffscreenCanvas drawing lifecycle on the configured renderer’s thread. Use Anta’s configured hooks, and mutate controllers only after commit. Browser verification covers React 19 and Preact, including cleanup and discarded renders.
- `src/entries/` defines the supported package exports. Keep internal imports private.
- Rendering lifecycle ownership is internal. Do not export controllers, canvas drawing helpers, or host adapters. Consumer extensions use series renderers, highlight renderers, and tooltip callbacks. The surface registration entry remains available for both components.
- Plot layout belongs in `src/browser/plot.css`, published as `@antadesign/plot/plot.css`. Every host requires it in its document, including after adoption. Copyable examples must include the Plot stylesheet. Anta tokens are optional; keep fallback colors usable without them and preserve inherited tokens when supplied. Validate generated examples through installed tarballs and include the site's prose stylesheet in layout checks. Keep Plot's stylesheet separate from JavaScript entries. Do not inject styles or parse style attributes. Keep dynamic sizes, coordinates, cursor, and filters as direct CSSOM property writes; JSX Plot defers dimension and consumer style props until commit so hydration applies CSSOM instead of parsed attributes. Low-level PlotSurface props retain normal renderer serialization.
- `scripts/build.mjs` emits JS, declarations, and CSS. Anta stays external to avoid duplicate component implementations.
- `scripts/verify-package.mjs` checks the built package from an isolated consumer directory.

Anta is a peer dependency requiring `^0.3.30` for the configured runtime hooks. Keep `workspace:*` only in devDependencies for local builds; do not add a separate runtime dependency on Anta. React is also a peer. Never add Star imports, notebook demos, notebook type shims, or notebook build aliases here.

Build Anta before plot. Run plot's build, typecheck, and check:package scripts after changes. Read ../RELEASING.md before publishing; use pnpm so workspace dependencies are rewritten. Keep plot release notes in this package, not the root Anta changelog.

Run `pnpm --filter @antadesign/plot test:csp` for HTTP CSP, renderer, lifecycle, and browser coverage. Run `test:csp:package` for isolated tarball consumers. `ANTA_PLOT_COMPARE_REF=<ref>` adds starting-implementation screenshots and geometry/interaction comparisons. The root component runner registers fast and slow Plot tiers.
