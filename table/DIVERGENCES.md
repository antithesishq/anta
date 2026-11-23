# Divergences from the notebook table

`@antadesign/table` is a port of the notebook's `notebook/ui/widgets/table/` (Star): `index.tsx`, `table_search.ts`,
`table_search_input.tsx`, `table_download.tsx`, and `table.module.css`. This file records every place the port behaves
differently **on purpose**, for the migration report. It is not published (`files` ships only `dist`).

Add an entry whenever a change makes the two differ, and say why. A difference that is not deliberate is a bug, not an
entry here. The prop mapping the notebook adapter needs is at the end.

Star baseline: `main` at `cb4cc92518b` (2026-11-10).

## Architecture

1. **The virtualizer is a prop.** `virtualizer={VirtualScroll}` mounts rows on demand; without it, every row renders
   in a native scroll container. The table never imports `@antadesign/virtual-scroll`. Star always renders through
   `vscroll_component`, and `virtualization: false` only raises `max_non_virtual_items` to infinity inside it, so it
   cannot fix the height of a table that mounts every row. A fixed `height` without a virtualizer now does exactly that.
2. **No TanStack.** Sorting and column visibility are a few dozen lines of the package's own (`core/table-sorting.ts`)
   instead of `@tanstack/table-core`, which Star uses only for those two and has to configure around frozen objects
   (`sortUndefined: false`, `enableGlobalFilter: false`).
3. **Renderer-free core.** Column inference and layout, sorting, filtering, search, sizing, and download serializers
   live in `@antadesign/table/core` and are unit tested in Node. Star computes all of them inside the component.
4. **One registered element.** `<a-table>` scrolls a revealed search match into view and focuses the search field,
   which a worker renderer cannot do. Every other tag is CSS-only. Star registers empty `a-table`, `a-table-wrapper`,
   `a-row`, `a-header`, `a-header-cell`, and `a-cell` classes in `shell/browser/a_table.ts` and reaches the search
   field through the notebook's `x-focuser`.
5. **Data is an array or a range source** (`length` + `slice(start, end).toArray()`), the shape `VirtualScroll` and
   Star's `Sequence` share. Without a sort or filter, a virtualized table reads only the mounted range. Star reads
   rows with `Sequence.at`, which needs the notebook's transient-step workaround for unmaterialized rows.

## Layout and sizing

6. **`height`, `minHeight`, `maxHeight`, `width`, and `maxWidth` all size the frame** (header, rows, scrollbars,
   and border). Star's `height` and `min_height` size the rows area, `max_height` the whole widget less the toolbar
   and row count, and `width` and `max_width` the column total.
7. **CSS sizes the frame.** Flexbox fits the frame to its rows, shrinks it to the room a definite-height container
   gives, and grows it there up to the last row; the table only passes the heights it asks for. Star measures the
   whole panel and subtracts constants (`UTIL_ROW_HEIGHT`, `BELOW_TABLE_ROW_HEIGHT`), so a toolbar taller than the
   constant, for example with a theme's larger controls, makes the surface report more room each render and the
   table grow. A virtualizer fills any room it gets, so with one the frame's maximum is the rows' measured height.
8. **Few rows fit their measured height.** A table with no more than `minRowsToDisplay` rows asks for their measured
   height, so wrapped rows are not clipped in a content-sized container. Star asks for `row_min_height` per row and
   shows a scrollbar.
9. **No editor height.** Star caps tables in a notebook cell at 580px (`in_editor`). The adapter passes `maxHeight`.
10. **`height="auto"`** fits every row. Star's closest is `virtualization: false`, which also mounts every row but
    keeps the rest of its sizing.
11. **Columns are CSS grid tracks.** Every row and the header share one `grid-template-columns`, and the rows fill
    the room left of the scrollbar. Star distributes the measured width in render, less a 16px scrollbar, and widens
    only the last header cell over the scrollbar, which leaves a blank strip at the end of every row when the list
    has nothing to scroll. The port keeps Star's look: the scrollbar starts below the header, and the header's
    background and bottom border fill the corner above it. Following from the tracks:
    - A column with `maxWidth` grows to it before the unbounded columns share the rest. Star grows every column
      evenly until one reaches its bound.
    - Pinned columns keep their `width` or `minWidth`; they do not share free width, so the sticky offsets are known
      without layout. Star's pinned columns share it.
    - When no column is unbounded, the last unpinned column stretches. Star stretches the last column when every
      column has a `width`, and narrows the table when every column reached its `max_width`.
12. **Row min height counts the row border.** The estimate adds 1px when row borders are on. Star adds it when
    column borders are on.

## Pinned columns

13. **Pins are CSS only.** Without a virtualizer, pinned cells are `position: sticky` with offsets from the column
    layout. With one, they translate by `--virtual-scroll-x`, and right pins also by `--virtual-scroll-max-x`, a
    variable this port added to `<a-virtual-scroll>`. Star recomputes every pinned cell's `left` from `table_scroll_x`
    on each horizontal scroll, which re-renders every row from the worker.
14. **Pinned-edge shadows switch on and off** with the scroller's `:state(hidden-start-x)` and `:state(hidden-end-x)`
    instead of growing with the scroll offset up to 32px, which needed the offset in render. They fade over 30px
    from `--bg-4` (`--table-pinned-shadow`), per the design spec, so they read as more columns rather than depth; Star's
    fade the cell's own background.

## Filtering

15. **Facets combine with AND.** A row must match every facet with a selection. Star keeps a row that matches any
    facet (its loop returns on the first match), so selecting `status: failed` and `suite: checkout` showed every
    failed run and every checkout run (bug fix).
16. **Facet keys are column keys.** Star maps a facet's `section_title` back to a key by lowercasing it and replacing
    spaces with underscores unless a `filter_options` entry names the key.
17. **Custom facets reach only a custom `filtering` function.** Star's built-in filter applies every facet value with
    `includes` and asserts it is an array, so a custom facet without `filtering` threw.
18. **Controlled filter.** `filterValue` with `onFilterChange` controls the filter; `defaultFilterValue` seeds an
    uncontrolled one. Star reads `filter_value` once, and only when `on_filter_change` is also set.
19. **Text filter columns default to the table's columns.** Star defaults to every primitive key of the data, even
    keys without a column.

## Search

20. **Plain-text search is a phrase match** with the same rules as Star (one search word, escaped unless regex), but
    the scan, the active match, and stepping work on any source, without the transient-step reads.
21. **A rescan keeps the active match by its index in `data`**, as Star does through `row.original`.

## Sorting

22. **The sort header shows the multi-sort position** (a superscript number) when more than one column is sorted, and
    the header cell carries `aria-sort`. Star shows only the arrow.

## Selection and rows

23. **Selected rows use `selected` on `a-table-row`**: a tinted background and a 2px edge on the first cell. Star
    styles the vscroll item's `_selected` class with a 1px stripe pinned to the viewport. Selection works the same with
    or without a virtualizer.
24. **Escape clears the selection only when there is one**, so Escape still reaches the page otherwise.

## Downloads

25. **Downloads save through `download.save`**, or a temporary link when there is a `document`. Star renders lazy
    download links through the notebook's `create_lazy_download_link` external component. `serializeRow` takes
    `(row, index)` rather than `{ row_data, row_index }`, and `custom` returns `{ label, fileName, content, type }`.

## Toolbar

26. **Below 560px the search field moves into the actions menu**, after the chips (900px) and the text filter (840px)
    fold as in Star. Star keeps the 300px field in the toolbar, which overflows narrow containers. With the field
    folded, Mod + F opens the actions menu and focuses it.
27. **Inferred facets stop at 100 distinct values**, and `maxFilterOptions` changes the limit. Star stops at 1,000.
    Its closed Filter menu keeps every option in the DOM, so a table of numeric columns could carry tens of thousands
    of option elements and make the whole page slow.

## Prop mapping for the notebook adapter

| Star option | Port prop |
| --- | --- |
| `width`, `max_width` | `width`, `maxWidth` plus the 2px border and, with a virtualizer, the 16px scrollbar |
| `height`, `min_height` | `height`, `minHeight` plus the header height and 2px border |
| `max_height` | `maxHeight` less the toolbar and row count |
| `header_height`, `hide_header`, `hide_row_count` | `headerHeight`, `hideHeader`, `hideRowCount` |
| `row_min_height`, `row_max_height`, `row_height_fixed` | `rowMinHeight`, `rowMaxHeight`, `rowHeightFixed` |
| `min_rows_to_display` | `minRowsToDisplay` |
| `row_class` | `rowClassName` |
| `on_row_click`, `selected`, `on_row_select` | `onRowClick`, `selected`, `onRowSelect` |
| `borders` | `borders` |
| `filtering`, `filter_options`, `filter_facets` | `filtering`, `filterOptions` (`section_title` → `label`, `name` → `label`), `filterFacets` |
| `filter_value`, `on_filter_change` | `filterValue` (`primary_value` → `text`, `secondary_value` → `facets`), `onFilterChange` |
| `primary_filter_fields`, `primary_filter_placeholder` | `textFilterFields`, `textFilterPlaceholder` |
| `searching`, `search_input_value` | `searching`, `defaultSearch` |
| `initial_sorting` | `defaultSorting` |
| `initial_column_visibility` | `defaultHiddenColumns` (the keys set to `false`) |
| `column_hiding`, `expand`, `download` | `columnHiding`, `expand`, `download` (`file_name` → `fileName`, `serialize_row` → `serializeRow`) |
| `data_loading`, `stick_to_bottom` | `dataLoading`, `follow` |
| `on_container_resize` | `onContainerResize` (reports the frame's room, not the panel) |
| `virtualization` | `virtualizer={VirtualScroll}` when true |
| column `width`, `min_width`, `max_width`, `header`, `cell_class`, `sorting`, `pin` | `width`, `minWidth`, `maxWidth`, `header` (`tooltip_content` → `tooltip`), `cellClassName`, `sorting`, `pin` |
| column `create_cell_content`, `create_searched_cell_content` | `renderCell`, `renderSearchedCell` (`cell_data` → `value`, `row_data` → `row`, `row_index` → `index`) |
| column `get_searchable_text`, `searchable` | `searchText`, `searchable` |

The adapter also passes `virtualizerProps={{ wheelActivation: 'settled-or-focus' }}` and an `initialPosition` from the
cell's backup state, as the sequence printer's adapter does, and `download.save` through the notebook's file download.
Star's `shell/browser/a_table.ts` registers an empty `a-table` class first; it must stop registering `a-table` before
the port's element can define it.
