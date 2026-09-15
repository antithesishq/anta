# @antadesign/plot

Follow the root AGENTS.md. This package owns plotting code, not the notebook adapter.

- `src/core/` contains series factories, composition, rendering, interactions, and presentation.
- `src/integrations/` connects host events to the core controllers.
- `src/browser/` implements the optional light-DOM `<a-plot>` host. Preserve its established behavior during packaging.
- `src/components/` contains the Anta JSX `Plot` and `PlotSurface` wrappers, exposed through `/components`. They must not register elements or access browser DOM. Plot owns controller and OffscreenCanvas drawing lifecycle on the configured renderer’s thread. Use Anta’s configured hooks, and mutate controllers only after commit. Browser verification covers React 19 and Preact, including cleanup and discarded renders.
- `src/entries/` defines the supported package exports. Keep internal imports private.
- `scripts/build.mjs` emits JS, declarations, and CSS. Anta stays external to avoid duplicate component implementations.
- `scripts/verify-package.mjs` checks the built package from an isolated consumer directory.

Anta is pinned to `0.3.27` to match the notebook consumer. Do not replace it with `workspace:*`, which would publish the workspace's newer Anta version. React is a peer. Never add Star imports, notebook demos, notebook type shims, or notebook build aliases here.

Build Anta before plot. Run plot's build, typecheck, and check:package scripts after changes. Read ../RELEASING.md before publishing; use pnpm so workspace dependencies are rewritten. Keep plot release notes in this package, not the root Anta changelog.
