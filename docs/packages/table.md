# Table

`Table` shows an array of objects as columns. From the rows alone it infers
column types and widths, and builds sorting, a text filter, filter facets,
search, column hiding, downloads, and an Expand action. Configure
[columns](#columns), [filter](#filtering), [search](#search), [select
rows](#selection), [size it](#sizing), [follow a growing
table](#growing-table), and choose what [downloads](#downloads) contain. The
package is experimental.

Rows render in a native scroll container by default, so every row is mounted.
Pass `VirtualScroll` as the `virtualizer` to mount only the rows near the
viewport; see [Virtualized rows](#virtualized-rows).

## Basic usage

Pass the rows as `data`. Each key becomes a column, in the order of the first
row. Numbers align right, booleans are colored, and primitive columns sort and
get a facet in the **Filter** menu. Click a header to sort.

```tsx
import { Table } from '@antadesign/table/bundle'

type Run = { id: string, suite: string, status: string, duration: number }

export function Runs({ runs }: { runs: Run[] }) {
  return <Table data={runs} />
}
```

The table reads the first 500 rows for column types, widths, and facet
options. A column whose values are not all primitives renders them as text,
and does not sort, filter, or get a facet.

## Install and configure

`@antadesign/table` is a separate package that builds on Anta. Install it
alongside its peers, Anta `^0.3.38` and React `^19.0.0`. The virtualizer is
optional:

```sh
npm install @antadesign/table @antadesign/anta react
npm install @antadesign/virtual-scroll
```

### Full bundle

Use the full bundle as the default setup. One import registers `<a-table>` and
the Anta elements it renders, loads its stylesheet, and exports the `Table`
component, the helpers, and the types:

```ts
import { Table } from '@antadesign/table/bundle'
```

### Granular entries (advanced)

Use these only to keep elements out of a server or worker build, or to load
the stylesheet yourself.

| Entry | Contents |
| --- | --- |
| `@antadesign/table` | The `Table` component, the helpers, and the types. It does not register elements, so it is safe to import on a server or in a worker. |
| `@antadesign/table/core` | The column, sorting, filtering, search, sizing, and download helpers, with no renderer or DOM. |
| `@antadesign/table/elements/a-table` | Registers `<a-table>` and the Anta elements a table renders, and loads its stylesheet. `/elements` registers every element in the package. |
| `@antadesign/table/table.css` | The stylesheet, for setups that load CSS separately. |

With the root entry, register the element once in the browser:

```ts
import '@antadesign/table/elements/a-table'
import { Table } from '@antadesign/table'
```

## Virtualized rows

`virtualizer` takes a component that renders rows on demand. Pass
`VirtualScroll` from `@antadesign/virtual-scroll` and the table mounts only the
rows near the viewport, with the list's scrollbars, keyboard input, and
scrollbar marks for search matches. Sorting, filtering, search, and selection
work the same with or without it.

This table has 10,000 rows, pinned columns on both sides, custom cells, a
header tooltip, and selection.

```tsx title="10,000 rows with VirtualScroll"
import { useState } from 'react'
import { Tag } from '@antadesign/anta/bundle'
import { Table, type TableColumn } from '@antadesign/table/bundle'
import { VirtualScroll } from '@antadesign/virtual-scroll/bundle'

type Run = { id: string, suite: string, status: 'passed' | 'failed' | 'running', duration: number, summary: string, owner: string, findings: number }

const columns: Record<string, TableColumn<Run>> = {
  id: { pin: 'left', width: 120 },
  status: { width: 110, renderCell: ({ row }) => <Tag size="small" label={row.status} />, searchText: ({ row }) => row.status },
  suite: { width: 130 },
  duration: { width: 120, header: { title: 'Duration', tooltip: 'Wall-clock time of the run' } },
  summary: { minWidth: 420 },
  owner: { width: 110 },
  findings: { pin: 'right', width: 110 },
}

export function Runs({ runs }: { runs: Run[] }) {
  const [selected, setSelected] = useState<number[]>([])
  return (
    <Table
      data={runs}
      virtualizer={VirtualScroll}
      columns={columns}
      height={420}
      selected={selected}
      onRowSelect={setSelected}
    />
  )
}
```

The table gives the virtualizer its rows as a range source, the header, the
columns' minimum total as `contentWidth`, and a `contentKey` that changes when
sorting or filtering moves rows. Pass more `VirtualScroll` props, such as
`wheelActivation` or `initialPosition`, through `virtualizerProps`. Any
component that accepts `TableVirtualizerProps` works as a virtualizer.

`data` also takes a range source: an object with a `length` and a
`slice(start, end)` that returns something with `toArray()`. With a
virtualizer and no sort or filter, the table reads only the mounted rows.
Sorting, filtering, and downloads read every row.

### Wide tables

When the columns are wider than the frame, the rows scroll sideways, and pinned
columns stay put. This table has 5,000 hosts and 24 hourly columns, with the
host pinned on the left. Scroll sideways with Shift + wheel, a trackpad, or the
horizontal scrollbar.

```tsx title="A wide virtualized table with a pinned column"
import { Table, type TableColumn } from '@antadesign/table'
import { VirtualScroll } from '@antadesign/virtual-scroll'

type HostLatency = { host: string } & Record<string, string | number>

const hours = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`)
const columns: Record<string, TableColumn<HostLatency>> = {
  host: { pin: 'left', width: 170 },
  ...Object.fromEntries(hours.map(hour => [hour, { width: 92 }])),
}

function Latency({ rows }: { rows: HostLatency[] }) {
  return <Table data={rows} virtualizer={VirtualScroll} columns={columns} height={400} />
}
```

## Columns

`columns` maps keys to column settings, and its keys are the columns, in
order. Without it, the table shows every key of the first rows.

- **Width.** `width` fixes a column, and a pinned column keeps its `width` or
  `minWidth`. The other columns start at their `minWidth`, which defaults to
  the inferred width, and share the rest of the row: columns with a `maxWidth`
  grow to it first, then the others split what is left evenly. When no column
  can take the rest, the last unpinned one does. When the minimum widths add
  up to more than the frame, the rows scroll sideways.
- **Header.** A string, `null` for a blank header, or `{ title, tooltip }`.
- **Pinning.** `pin: 'left'` or `'right'` keeps a column at that edge while
  the others scroll sideways. A tinted shadow marks the edge while
  columns are hidden behind it; `--table-pinned-shadow` sets its color.
- **Cells.** `renderCell` receives `{ value, row, key, index }`, where
  `index` is the row's index in `data`. `cellClassName` adds a class to every
  cell of the column.
- **Sorting.** Primitive columns sort by their inferred type. `sorting: false`
  turns it off; a function `(a, b) => number` replaces the comparison. Rows
  missing the key sort as the largest value.

```tsx title="Widths, headers, and pinned columns"
<Table
  data={runs}
  height={300}
  columns={{
    id: { pin: 'left', width: 110, header: 'Run' },
    status: { width: 100, header: null },
    suite: { minWidth: 120, maxWidth: 160 },
    summary: { minWidth: 520, header: { title: 'Summary', tooltip: 'The first finding, or Clean run.' } },
    duration: { width: 110, sorting: false },
    flaky: { pin: 'right', width: 80 },
  }}
/>
```

Click a header to sort by that column: ascending, descending, then unsorted.
Shift + click adds the column to the sort, so later columns break ties; a
number beside the arrow shows its place. `defaultSorting` sets the order on
mount, and `sorting` with `onSortingChange` controls it.

The **Columns** menu, under the actions button, hides and shows columns.
Alt + click a column to show only that one. `defaultHiddenColumns` hides
columns on mount; `columnHiding={false}` removes the menu.

## Filtering

The toolbar has a text filter and a **Filter** menu of facets. The text filter
keeps the rows where any text-filter column contains every word of the query.
Its buttons, or Alt + C, Alt + R, and Alt + N in the field, match case, treat
the query as a regular expression, and keep the rows that do not match.
`textFilterFields` picks its columns; they default to the primitive columns.

Each facet keeps the rows whose value is selected, and a row must pass every
facet. Facets default to one per primitive column with at most 100 distinct
values in the first 500 rows; `maxFilterOptions` changes that limit, and
`filterOptions` replaces the inferred facets. In tables at least
900px wide, selected facets also show as chips beside the menu; below 840px,
the text filter moves into the menu.

This filter is controlled. It starts on failed runs; the button sets two
facets at once.

```tsx title="A controlled filter"
import { useState } from 'react'
import { Table, type TableFilterValue } from '@antadesign/table/bundle'

export function FailedRuns({ runs }: { runs: Run[] }) {
  const [filter, setFilter] = useState<TableFilterValue>({ text: '', facets: { status: ['failed'] } })
  return (
    <Table
      data={runs}
      filterValue={filter}
      onFilterChange={setFilter}
      textFilterFields={['id', 'summary']}
      filterOptions={[
        { key: 'status', label: 'Status', options: ['passed', 'failed', 'running'] },
        { key: 'suite', label: 'Suite', options: ['checkout', 'ledger', 'search'] },
      ]}
    />
  )
}
```

`filterFacets` adds any `SelectFaceted` facet, such as a `custom` one with its
own editor. The built-in filter ignores those; pass a `filtering` function to
filter with them. It receives each row, the text filter split into per-column
filters, the facet selections, and the match rules, and replaces the built-in
filter while any filter is set. `filtering={false}` removes the text filter
and the menu.

## Search

Search marks matches in the cells without hiding rows. Enter and Shift +
Enter step through matches, and the table scrolls the active one into view,
sideways too. With a virtualizer, matching rows also show on the scrollbar,
and Ctrl or Cmd + F in the rows moves focus to the search field. In tables
narrower than 560px, the search field moves into the actions menu, and Ctrl or
Cmd + F opens the menu to it.

The table marks each match in cells it renders itself. For a column with
`renderCell`, it tints the whole cell instead. To mark matches inside a custom
cell, give the column `renderSearchedCell`: it receives `search`, whose
`mark(text)` wraps each match in the text it is given. `searchText` sets the
text a column contributes to search; return what the cell shows, in order, so
the match count agrees with the screen. `searchable: false` leaves a column
out.

```tsx title="A column that marks its own matches"
<Table
  data={runs}
  defaultSearch="twice"
  columns={{
    id: {},
    status: {
      renderCell: ({ row }) => <StatusTag status={row.status} />,
      renderSearchedCell: ({ row, search }) => <Tag size="small" label={search.mark(row.status)} />,
      searchText: ({ row }) => row.status,
    },
    summary: {},
  }}
/>
```

A search stops after 99 matching rows; the count shows `+`, and stepping past
the last match searches the rows after it. `searching={false}` removes the
field.

## Selection

`onRowSelect` turns on selection. It receives the whole new selection, as
indices in `data`, on every row click. Pass it back through `selected`.

| Input | Selection |
| --- | --- |
| Click | Only this row. Clicking the only selected row clears it. |
| Ctrl or Cmd + click | Adds or removes this row. |
| Shift + click | The rows from the last clicked row to this one, as displayed. |
| Ctrl or Cmd + Shift + click | Adds that range. |
| Escape | Clears the selection, with a `null` index. |

```tsx title="Controlled selection"
const [selected, setSelected] = useState<number[]>([])
<Table data={runs} selected={selected} onRowSelect={setSelected} />
```

`onRowClick` receives every row click with the row and its index, with or
without selection.

## Sizing

`height`, `minHeight`, and `maxHeight` size the frame: the bordered header and
rows. The toolbar and the row count are outside it.

| Props | Frame height |
| --- | --- |
| None | Fits the rows, at least `minRowsToDisplay` rows (10) when there are that many, at most the container's height. |
| `height` | `height`. |
| `height="auto"` | Every row; the frame never scrolls vertically. |
| `minHeight` | At least `minHeight`, even when the container is shorter. |
| `maxHeight` | At most `maxHeight`. |

A table in a container that sizes from its content, such as a block in normal
flow, shows `minRowsToDisplay` rows. In a container with a definite height,
such as a flex column, the table grows to fill it and stops at its last row.
The `minRowsToDisplay` rows count at `rowMinHeight` (26px) plus their border,
so taller rows show fewer of them.

Without a virtualizer, a fixed `height` still mounts every row, so the frame
scrolls natively. `height="auto"` grows the frame to every row.

```tsx title="Fixed, automatic, and container heights"
<Table data={runs} height={240} />
<Table data={fewRuns} height="auto" />
<div style={{ display: 'flex', flexDirection: 'column', height: 320 }}>
  <Table data={runs} />
</div>
```

`rowHeightFixed` pins every row to `rowMinHeight` and stops cell text
wrapping; with a virtualizer, rows are then not measured. `rowMaxHeight` clips
taller rows. `width` and `maxWidth` size the frame, which otherwise fills the
width of its container.

**Expand**, in the actions menu, fills the viewport with the table. The
toolbar keeps working, and **Collapse** puts it back.

## Growing table

With `follow`, the table starts on its last row and keeps it in view as rows
are appended. Scroll up and the view holds still while rows arrive; scroll
back to the bottom to follow again. It works with or without a virtualizer.

```tsx title="Follow new rows"
<Table data={rows} virtualizer={VirtualScroll} height={260} follow />
```

## Downloads

**Download**, in the actions menu, offers TXT, CSV, and JSON files of the
rows as displayed: filtered and in sort order. Each row is written whole, so
hidden columns and keys without a column are still in the file.

- `fileName` sets the base name; each format adds its extension.
- `serializeRow(row, index)` turns a row into the record that is written. Its
  keys become the TXT and CSV header and the JSON fields.
- `custom` replaces the built-in files. It receives `rows()`, which reads the
  displayed rows; call it inside `content`, after the reader picks a file. One
  entry shows as a single menu item.
- `save` writes the file. Without it, the table saves through a temporary
  link, which needs `document`. Pass `save` when the table renders in a worker.

```tsx title="A row serializer and a custom file"
<Table
  data={runs}
  download={{
    fileName: 'runs',
    serializeRow: (run, index) => ({ rank: index + 1, run: run.id, status: run.status.toUpperCase() }),
  }}
/>
<Table
  data={runs}
  download={{
    custom: ({ rows, rowCount }) => [{
      label: `Download ${rowCount} run IDs`,
      fileName: 'run-ids.txt',
      content: () => rows().map(({ row }) => row.id).join('\n'),
    }],
  }}
/>
```

`download={false}` removes the menu item. With `columnHiding`, `expand`, and
`download` all off, the actions button goes; with `searching` and `filtering`
off as well, so does the toolbar.

## Props

Each prop links to the section that demonstrates it. `className`, `style`, and
`id` go to the `<a-table>` root.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| [`data`](#basic-usage) | `TableSource<T>` | | The rows, as an array or a range source. Sets `T`. |
| [`columns`](#columns) | `Record<string, TableColumn<T>>` | | Column settings by key; its keys are the columns, in order. |
| [`virtualizer`](#virtualized-rows) | `TableVirtualizer` | | Renders rows on demand, such as `VirtualScroll`. Without it, every row is mounted. |
| [`virtualizerProps`](#virtualized-rows) | object | | More props for the virtualizer. |
| [`height`](#sizing) | number, `auto` | | Frame height, or `auto` for every row. |
| [`minHeight`](#sizing) | number | | Minimum frame height. |
| [`maxHeight`](#sizing) | number | | Maximum frame height. |
| [`minRowsToDisplay`](#sizing) | number | `10` | Rows the frame fits before its container asks for more. |
| [`width`](#sizing) | number | | Frame width. |
| [`maxWidth`](#sizing) | number | | Maximum frame width. |
| [`headerHeight`](#columns) | number | `34` | Header height; smaller values are ignored. |
| [`hideHeader`](#columns) | boolean | | Hide the header row. |
| [`hideRowCount`](#sizing) | boolean | | Hide the row count. |
| [`rowMinHeight`](#sizing) | number | `26` | Minimum row height, without its border. |
| [`rowMaxHeight`](#sizing) | number | | Clip rows taller than this. |
| [`rowHeightFixed`](#sizing) | boolean | | Every row is `rowMinHeight` tall; cell text does not wrap. |
| [`rowClassName`](#columns) | `(row: T, index) => string` | | Class for each row. |
| [`borders`](#styling) | `{ row?, column? }` | both | Row and column borders. |
| [`onRowClick`](#selection) | `(event, row: T, index) => void` | | Every row click. |
| [`selected`](#selection) | `number[]` | | Selected rows, by index in `data`. |
| [`onRowSelect`](#selection) | `(selected, event, index) => void` | | Turns on selection and receives each new selection. |
| [`filtering`](#filtering) | `false`, `TableFilterFn<T>` | | `false` removes filtering; a function replaces the built-in filter. |
| [`filterOptions`](#filtering) | `TableFilterOption[]` | | Facets for the Filter menu, replacing the inferred ones. |
| [`maxFilterOptions`](#filtering) | `number` | `100` | Inferred facets skip columns with more distinct values than this in their first 500 rows. |
| [`filterFacets`](#filtering) | `SelectFacet[]` | | More facets, seen only by a `filtering` function. |
| [`filterValue`](#filtering) | `{ text, facets }` | | Controlled filter state. |
| [`defaultFilterValue`](#filtering) | `{ text, facets }` | | Filter state on mount. |
| [`onFilterChange`](#filtering) | `(value) => void` | | Every filter change. |
| [`textFilterFields`](#filtering) | `string[]` | primitive columns | Columns the text filter searches. |
| [`textFilterPlaceholder`](#filtering) | string | `Filter by text` | Text filter placeholder. |
| [`searching`](#search) | boolean | `true` | The search field. |
| [`defaultSearch`](#search) | string | | Search query on mount. |
| [`sorting`](#columns) | `{ id, desc }[]` | | Controlled sort order. |
| [`defaultSorting`](#columns) | `{ id, desc }[]` | | Sort order on mount. |
| [`onSortingChange`](#columns) | `(sorting) => void` | | Every sort change. |
| [`columnHiding`](#columns) | boolean | `true` | The Columns menu. |
| [`defaultHiddenColumns`](#columns) | `string[]` | | Columns hidden on mount. |
| [`expand`](#sizing) | boolean | `true` | The Expand action. |
| [`download`](#downloads) | boolean, `TableDownloadOptions<T>` | `true` | The Download menu, or its options. |
| `dataLoading` | boolean | | The rows are placeholders; controls that act on rows are disabled. |
| [`follow`](#growing-table) | boolean | | Start at the last row and keep new rows in view. |
| [`onContainerResize`](#sizing) | `({ width, height }) => void` | | The size of the room for the frame, when measured. |
| [`empty`](#sizing) | ReactNode | `No rows` | Shown when there are no rows. |

### Column settings

| Field | Type | Description |
| --- | --- | --- |
| `width` | number | Fixed width, clamped to `minWidth` and `maxWidth`. |
| `minWidth` | number | Minimum width while sharing free width. Defaults to the inferred width. |
| `maxWidth` | number | Maximum width. |
| `header` | string, `null`, `{ title, tooltip }` | Header text, a blank header, or a title with a tooltip. Defaults to the key. |
| `renderCell` | `(cell) => ReactNode` | Renders the cell from `{ value, row, key, index }`. |
| `renderSearchedCell` | `(cell & { search }) => ReactNode` | Renders the cell during a search, to mark its own matches. |
| `searchText` | `(cell) => string` | The text the column contributes to search. |
| `searchable` | boolean | `false` leaves the column out of search. |
| `cellClassName` | string | Class on every cell of the column. |
| `sorting` | boolean, `(a, b) => number` | `false` turns sorting off; a function replaces the comparison. |
| `pin` | `left`, `right` | Keep the column at that edge. |

## Element reference

`Table` renders light DOM. Its root, `<a-table>`, is the only registered
element; the rest are tags that only the stylesheet gives meaning.

```text
a-table
└ a-panel                      Expand
  └ a-table-surface
    ├ a-table-toolbar          text filter, Filter menu, chips
    │ └ a-table-toolbar-end    search, actions
    ├ a-table-space            the room the frame can fill
    │ └ a-table-frame          role="table"
    │   └ a-virtual-scroll, or a-box > a-table-content (native scrolling)
    │     ├ a-table-head       a-table-header-cell …
    │     └ a-table-row        a-table-cell …
    └ a-table-footer           row count
```

### `<a-table>` attributes

| Attribute | Description |
| --- | --- |
| `virtual` | Rows render through a virtualizer, which changes how pinned columns stay in place. |
| `reveal-key` | Change to scroll the descendant matching `reveal-target` into view, for tables without a virtualizer. |
| `reveal-target` | Selector for `reveal-key`. |
| `focus-key` | Change to focus the descendant matching `focus-target`. |
| `focus-target` | Selector for `focus-key`. |

A renderer without DOM access, such as one in a worker, cannot scroll or move
focus. The element does both from these attributes, waiting up to 1 second for
the target to arrive.

### Cell and row attributes

| Attribute | On | Description |
| --- | --- | --- |
| `column` | cells | The column key. |
| `type` | cells | `number`, `boolean`, `string`, or `other`, for default cells. |
| `pin`, `pin-edge` | cells | The pinned side, and the cell that draws the pinned edge. |
| `search` | cells | `match` or `active` on a cell the table can only mark as a whole. |
| `selected` | rows | The row is selected. |
| `last` | rows | The last displayed row. |

## Styling

Rows and cells are light DOM; style them with plain CSS. `rowClassName` and
`cellClassName` add your own classes. `borders={{ column: false }}` drops the
column lines and `borders={{ row: false }}` the row lines.

```tsx
<Table className="runs" data={runs} rowClassName={run => run.status === 'failed' ? 'failed' : undefined} />
```

```css
a-table.runs a-table-row.failed {
  background: color-mix(in oklch, var(--text-1-critical) 6%, var(--bg-1));
}
a-table.runs a-table-cell[column="duration"] {
  font-variant-numeric: tabular-nums;
}
```

Search marks are `<mark data-table-match>`, and the active one also has
`data-active`. Pinned cells keep their place in both kinds of table with one
rule each: sticky positioning in a native scroll container, and a translation
by `--virtual-scroll-x` and `--virtual-scroll-max-x` with a virtualizer.

## Plain HTML tables

Anta's `reset.css` gives the native `<table>` element a polite baseline, so
plain tables look intentional without this package: top-left aligned cells
with 5 × 10px padding, hairline row separators in `--border-4`, semibold
`<thead>` cells, and no outer frame or column dividers. Set
`font-variant-numeric: tabular-nums` so numeric columns line up. All rules live
in `@layer anta`, so any consumer rule outside a layer overrides them.

### Default



      Token
      Value
      Usage




      --text-1
      #1c1f23
      Primary body copy


      --text-3
      #52575e
      Secondary labels, sidebar links


      --border-5
      #e8eaed
      Hairline dividers, table row separators



```html
<table>
  <thead>
    <tr><th>Token</th><th>Value</th><th>Usage</th></tr>
  </thead>
  <tbody>
    <tr><td>--text-1</td><td>#1c1f23</td><td>Primary body copy</td></tr>
    …
  </tbody>
</table>
```

### Bordered

Add `data-bordered` to draw the outer frame, column dividers, and 3px rounded
corners. The variant switches to `border-collapse: separate`, because
`border-radius` does not render reliably with collapsed borders.



      Token
      Value
      Usage




      --text-1
      #1c1f23
      Primary body copy


      --text-3
      #52575e
      Secondary labels, sidebar links


      --border-5
      #e8eaed
      Hairline dividers, table row separators



```html
<table data-bordered>
  …
</table>
```

### With a caption

A `<caption>` is the table's accessible name: screen readers announce it, and
it must be the table's first child. Browsers render it above the rows; Anta
only aligns it left, where browsers center it.

  Color tokens used by the docs sidebar


      Token
      Role




      --text-1-brand
      Logo wordmark


      --text-3
      Nav link, idle state


      --text-1
      Nav link, current page



```html
<table data-bordered>
  <caption>Color tokens used by the docs sidebar</caption>
  <thead>
    <tr><th>Token</th><th>Role</th></tr>
  </thead>
  <tbody>
    <tr><td>--text-1-brand</td><td>Logo wordmark</td></tr>
    …
  </tbody>
</table>
```
