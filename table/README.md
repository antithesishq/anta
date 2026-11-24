# @antadesign/table

A data table for React, Preact, and worker renderers. From an array of objects
it infers column types and widths, and builds sorting, a text filter, filter
facets, search, column hiding, downloads, selection, and sizing to its
container. Rows render in a native scroll container, or through a virtualizer
such as `VirtualScroll` from `@antadesign/virtual-scroll`.

## Install

```sh
npm install @antadesign/table
```

The package requires Anta `^0.3.38` and React `^19.0.0`. Preact applications can
use their React compatibility aliases. Install `@antadesign/virtual-scroll` to
virtualize rows.

## Use in React

Import from the full bundle, which registers the element and loads its
stylesheet. The row type flows from `data` to the column renderers:

```tsx
import { Table } from '@antadesign/table/bundle'

type Run = { id: string, status: string, duration: number }

export function Runs({ runs }: { runs: Run[] }) {
  return <Table data={runs} columns={{ id: { pin: 'left' }, status: {}, duration: {} }} />
}
```

## Virtualize rows

Pass `VirtualScroll` as the `virtualizer`, and the table mounts only the rows
near the viewport:

```tsx
import { Table } from '@antadesign/table/bundle'
import { VirtualScroll } from '@antadesign/virtual-scroll/bundle'

export function Runs({ runs }: { runs: Run[] }) {
  return <Table data={runs} virtualizer={VirtualScroll} height={420} />
}
```

## Worker renderers

`@antadesign/table` registers no elements, so a worker-side renderer can import
it; register `@antadesign/table/elements/a-table` on the browser thread.
`@antadesign/table/core` exports the column, sorting, filtering, search, sizing,
and download helpers with no renderer and no DOM.

See the documentation site's Table page for every prop and section.
