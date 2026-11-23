# Changelog

Changes that ship in `@antadesign/table`.

## Unreleased

### Added

- The `Table` component (experimental): a data table that infers columns from
  its rows, with column widths, headers, and pinning, multi-column sorting, a
  text filter with match rules, filter facets, search with marked matches,
  column hiding, an Expand action, TXT, CSV, and JSON downloads, and row
  selection.
- `virtualizer` takes a component that renders rows on demand, such as
  `VirtualScroll`. Without one, every row renders in a native scroll container,
  including at a fixed `height`.
- `data` takes an array or a range source with `length` and
  `slice(start, end).toArray()`.
- `height`, `minHeight`, `maxHeight`, `width`, `maxWidth`, and
  `minRowsToDisplay` size the frame; `height="auto"` fits every row. Without
  them, the table fills a container with a definite height. CSS grid lays out
  the columns.
- `follow` keeps the newest row in view as rows are appended.
- Narrow tables fold the toolbar: the selected-facet chips hide below 900px,
  the text filter moves into the Filter menu below 840px, and the search field
  moves into the actions menu below 560px.
- `<a-table>` scrolls a revealed search match into view and focuses the search
  field for renderers without DOM access.
- `@antadesign/table/core` exports the renderer-free helpers;
  `@antadesign/table/bundle` registers the element, loads its stylesheet, and
  exports everything the root entry does.
