# @antadesign/table

Follow the root AGENTS.md and `../src/AGENTS.md` for element, wrapper, CSS, and
writing conventions. This package owns the data table, not the notebook adapter.

- `src/core/` is DOM-free: column inference and layout (`table-columns.ts`),
  sorting, filtering, search, sizing, downloads, source reads, and the shared
  types. Keep it free of DOM, Anta, and renderer imports; `tests/core.test.mjs`
  runs it from the built `dist/core.js` in Node.
- `src/components/` holds the `Table` JSX wrapper, its toolbar, and the search
  highlighter. They use Anta's public JSX components and configured hooks, and
  never register elements or touch the DOM, except `saveWithLink`, which runs
  only from a download click when there is a `document`.
- `src/elements/` holds `<a-table>` (`table-element.ts`), the package stylesheet,
  and the attribute types for every `a-table-*` tag. `<a-table>` is the only
  registered element; the other tags are CSS-only structure. Its element module
  also registers the Anta elements a table renders.
- The table never imports `@antadesign/virtual-scroll`. A virtualizer arrives as
  a prop typed by `TableVirtualizerProps`; `tests/types.fixture.tsx` checks that
  `VirtualScroll` satisfies it. Keep both row bodies, virtualized and native,
  equal in features: sizing, pinning, search reveal, selection, and follow.
- Pinned columns are CSS only: sticky in the native scroller, translated by
  `--virtual-scroll-x` and `--virtual-scroll-max-x` with a virtualizer. Do not
  compute pinned offsets from the scroll position in render.
- CSS lays out the columns and sizes the frame. `layoutColumns` turns column
  settings into grid tracks and `tableHeight` into a few frame heights; neither
  reads a measurement. Do not measure the room or distribute widths in render.
  The one measurement left is the virtualizer's row height, because a
  virtualizer fills whatever room it gets.
- Give new files names that are unique across the repository.

Anta is a peer dependency (`^0.3.38`); keep `workspace:*` only in
devDependencies. React is also a peer. Never add Star imports, notebook demos,
or notebook type shims here.

Build Anta and the virtual scroll before this package. Run `build`,
`typecheck`, `check:package`, `test`, and `test:browser` after changes.
`pnpm --filter @antadesign/table run demo` serves the browser-test fixture
(`?mode=plain`, `?count=`) for manual checks. The docs page is
`site/src/content/packages/table/`; keep it for package users, with no notebook
history or divergences.

## Divergences from the notebook original

`DIVERGENCES.md` lists every intentional difference from the notebook's
`ui/widgets/table/`, and the prop mapping the notebook adapter needs. When a
change makes the port behave differently from the notebook version, add an
entry in the same change, with the reason. When the notebook version changes,
compare and either port the change or record why not. Wrap `DIVERGENCES.md` at
120 characters per line.

Read ../RELEASING.md before publishing; use pnpm so workspace dependencies are
rewritten. Keep release notes in this package's CHANGELOG.md, not the root one.
