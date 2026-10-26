# @antadesign/virtual-scroll

A virtualized list for React, Preact, and browser custom elements. It shows
lists of any length by mounting only the rows near the viewport, and owns
scrolling, row measurement, and its scrollbars on the browser thread, so the
renderer can run in a worker without slowing scrolling down.

## Install

```sh
npm install @antadesign/virtual-scroll
```

The package requires Anta `^0.3.30` and React `^19.0.0`. Preact applications can
use their React compatibility aliases.

## Use in React

Register the element and render rows from an array or a source that builds
rows on demand. The row type flows from `items` to `renderItem`:

```tsx
import { VirtualScroll } from '@antadesign/virtual-scroll'
import '@antadesign/virtual-scroll/elements/a-virtual-scroll'

type LogLine = { text: string }

export function Log({ lines }: { lines: LogLine[] }) {
  return <VirtualScroll items={lines} height={300} follow renderItem={line => line.text} />
}
```

## Use as a browser element

Mount the rows named by `rangechange` as direct children, each with
`data-index`. The element measures and places them:

```ts
import '@antadesign/virtual-scroll/elements/a-virtual-scroll'

const list = document.createElement('a-virtual-scroll')
list.setAttribute('count', String(lines.length))
list.addEventListener('rangechange', event => {
  const { start, end } = event.detail
  list.replaceChildren(...lines.slice(start, end).map((line, i) => {
    const row = document.createElement('div')
    row.dataset.index = String(start + i)
    row.textContent = line
    return row
  }))
})
```

## Worker renderers

`@antadesign/virtual-scroll/source` exports the typed helpers and types with no
renderer and no DOM. `mapVirtualScrollRange(source, range, render)` renders the
rows of a `rangechange` range from an array or any source with a `length` and a
`slice(start, end).toArray()`.

See the documentation site's Virtual Scroll page for every attribute, event,
and input rule.
