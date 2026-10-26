# @antadesign/virtual-scroll

Follow the root AGENTS.md and `../src/AGENTS.md` for element, wrapper, CSS, and
writing conventions. This package owns the virtualized list, not the notebook
adapter. The table will follow as its own package and build on this one.

- `src/core/` is DOM-free. `model.ts` holds the anchor-model scroll math,
  `source.ts` the renderer-free typed helpers, and `types.ts` the shared types.
  Keep `core/` free of DOM, Anta, and renderer imports; `model.test.mjs` runs it
  directly in Node.
- `src/elements/` holds `<a-virtual-scroll>`, its stylesheet, and its attribute
  types. `attributes.ts` registers the tag with Anta's JSX types.
- `src/components/` holds the `VirtualScroll` JSX wrapper. It uses Anta's
  configured hooks and never registers elements or touches the DOM.
- `src/entries/` defines the package exports. `source` must stay renderer-free
  for worker-side renderers; `scripts/verify-package.mjs` enforces it.
- Use Anta only through its public entries: `anta_helpers`, `jsx-runtime`,
  `general_types`, `capture-types`, and element entries such as
  `elements/a-capture` and `elements/a-tooltip`. Never import Anta internals
  such as `elements/capture-input`.
- `scripts/build.mjs` emits ESM, declarations, and `virtual-scroll.css`, and
  prepends the stylesheet import to the element entries. Anta and React stay
  external.

Anta is a peer dependency (`^0.3.30`); keep `workspace:*` only in
devDependencies. React is also a peer. Never add Star imports, notebook demos,
or notebook type shims here.

Build Anta before this package. Run `build`, `typecheck`, `check:package`,
`test`, and `test:browser` after changes. `pnpm --filter @antadesign/virtual-scroll
run demo` serves the browser-test fixture with controls for manual checks; the
docs page is `site/src/content/packages/virtual-scroll/`. After changing the
element, also run the manual checks at the end of `DIVERGENCES.md`. Keep the
docs page for package users: no notebook history, divergences, or checklists.

## Divergences from the notebook original

`DIVERGENCES.md` lists every intentional difference from the notebook's
`virtual_scroll.ts`. It feeds the migration report. When a change makes the
port behave differently from the notebook version, add an entry in the same
change, with the reason. When the notebook version changes, compare and either
port the change or record why not.
Wrap `DIVERGENCES.md` at 120 characters per line.

Read ../RELEASING.md before publishing; use pnpm so workspace dependencies are
rewritten. Keep release notes in this package's CHANGELOG.md, not the root one.
