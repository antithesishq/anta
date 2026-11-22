# Inspector

Inspector shows any JavaScript value as a tree you can explore, such as test
results, errors, and logs. Rows read like an object in browser DevTools and
open one level at a time, so a large value is read only as far as it's shown.
Select a row to open or close it. Inspector is built on [Tree](./tree.md), with a
monospace look and a copy menu.

## Open a level at a time

`expandDepth` sets how many levels start open; the default opens the value's
own properties. A closed row shows a one-line summary that ends in `…` 120
characters from the Inspector's start, or sooner in a narrower window. With
`layout="inline"`, the summary has up to `previewBudget` characters instead.
Long and multiline strings, such as stack traces, open into lines of text
a page at a time, with a **Show more** row for the next page.

```tsx
<Inspector value={testResult} chunkSize={50} aria-label="Test result" />
```

## Show long lists

An array, object, Map, or Set with more than `chunkSize` children, 100 by
default, shows them in ranges, such as `[0…99]`, that open like any row. Ranges
nest by tens until a level has at most 10 ranges: 150 items show as `[0…99]` and
`[100…149]`, and 100,000 items show ranges of 10,000, then 1,000, then 100. A
range renders its children only when it's open, so revealing item 50,000 renders
the 100 items around it and none before them. Ranges are for display: they have
no ⋯ menu, and they never appear in a path. The demo above uses `chunkSize={50}`.

## Control which rows are open

Each row has a path key, a string built from its path in data terms, such as
`r/.results/1/.error` for `results[1].error`. Pass `open`, a list of path keys,
to hold the open rows yourself, and apply the requested list from
`onStateChange`. `defaultOpen` sets the first open rows without controlling
them.

`inspectorExpandToPath(value, open, path)` returns `open` plus every row above
`path`, including the ranges of a long list, so the row shows. Pass the same
`path` as `current` to scroll that row into view and mark it, without moving
focus. A path is a list of steps, such as `{ type: 'property', key: 'results' }`
and `{ type: 'index', index: 1 }`; `inspectorPathKey(path)` gives its key.

```tsx
import { inspectorExpandToPath, type InspectorPath } from '@antadesign/anta'

const errorPath: InspectorPath = [
  { type: 'property', key: 'results' }, { type: 'index', index: 1 }, { type: 'property', key: 'error' },
]
const [open, setOpen] = useState(['r'])
const [current, setCurrent] = useState<InspectorPath>()

<Button label="Expand to results[1].error" onClick={() => {
  setOpen(keys => inspectorExpandToPath(run, keys, errorPath))
  setCurrent(errorPath)
}} />
<Inspector value={run} open={open} onStateChange={(_event, { next }) => setOpen(next)} current={current} aria-label="Run" />
```

Path keys name properties by name, array elements by index, Map entries with a
string, number, bigint, boolean, null, or undefined key by that key, and Map
entries with any other key by position. A symbol-keyed property is named by its
symbol's description, with a count that tells apart symbols sharing one.

## Replace the value

Open rows are path keys, so they belong to the paths, not to one value. When
`value` changes, rows whose paths still exist stay open, and keys that name no
row are ignored. `expandDepth` applies only to the first value; after that, the
open rows carry over. Select the button to switch runs: the `nodes` row and
`api-2`, which both runs have, stay open.

```tsx
<Inspector value={runs[index]} defaultOpen={['r', 'r/.nodes', 'r/.nodes/.api-2']} aria-label="Run" />
```

## Search a value

`searchable` adds a search field above the tree. Type to count the matches,
then select the next or previous button, or press Enter or Shift+Enter, to
reveal the next or previous match. Press Escape to clear the field. Revealing a match opens the rows and ranges above it
and scrolls it into view, while focus stays in the field. Hits are highlighted,
and the current match's row is marked.

A row matches on its key or on its own value, once even when both match:

- A key is a property name, a Map key, or a symbol. Array indices aren't keys.
  A Map key that's an object or array doesn't match.
- A value is a primitive's text, a string's full text, or a container's type,
  as its open row shows it, such as `Array(3)` or `Map(2)`.
- A closed row's preview of its children never matches. Searching `countries`
  below finds each `countries` row once, not also the rows whose previews
  contain it.

The default search ignores case and treats spaces as any whitespace. Pass
`searchMatcher` to turn the query into a `RegExp`, whose hits are highlighted,
or a function of a row's text, which highlights the whole field. Searching
reads the whole value, without calling getters, and stops at cycles.
`inspectorSearch(value, matcher)` returns the same matches as paths, for a
search field of your own.

```tsx
<Inspector value={report} searchable aria-label="Region report" />
```

In a long list, revealing a match opens only the ranges above it. Search
`timeout` to reach items 900 and 50,000 of 100,000. This demo gives the tree a
height and scrolls it, so the search field stays in view; a match scrolls into
view inside it.

```tsx
<Inspector className="inspector-scroll" value={{ samples }} searchable aria-label="Latency samples" />
```

```css
a-inspector.inspector-scroll > a-tree {
  max-height: 320px;
  overflow: auto;
}
```

## Show a value inline

`layout="inline"` shows a one-line summary that fits in a sentence or a table
cell. Opening it makes a block under the line, with the full tree. Inline values
start closed.

```tsx
<Text>
  The assertion failed with <Inspector layout="inline" value={details} aria-label="Assertion details" /> after
  three retries.
</Text>
```

## Show values in a log or console

When an app prints values, such as log entries, test results, or a console's
output, render each one with an inline Inspector instead of a string. Short
values stay on one line, and people open the ones they need. Each Inspector
keeps its own open rows, and a closed value isn't read, so long logs stay cheap
to show. Parse values that arrive as JSON first; Maps, errors, and cycles work as
they are.

```tsx
function LogLine({ time, message, value }) {
  return (
    <Text>
      {time} {message} <Inspector layout="inline" value={value} aria-label={message} />
    </Text>
  )
}
```

## Copy values and paths

Right-click a row, or select the ⋯ that appears at its end on hover, to copy
it. The first item copies the row's value: **Copy
string** copies a string's raw text, and **Copy number** or **Copy object**
copies the value in the text form the rows use, which keeps Maps, cycles, and
errors intact. **Copy JSON** copies the value as compact JSON. It's
unavailable for values JSON can't express, such as Maps, cycles, and class
instances, and says where the first one is. **Copy path** copies a JavaScript path to the row, such as
`results[3].details.error` or `byKey.get("api-1")`. It's unavailable where no
expression reaches the value, such as items in a Set. On the keyboard, press
Shift+F10 or the Menu key on the focused row, or press Right to reach the row's
⋯ and then Enter; on a closed row, the first Right opens it. Right-clicking
selected text opens the browser's own menu, with its Copy.

## Errors, cycles, and repeated values

An error shows its name and message, and opens to its `cause`, the inner
`errors` of an `AggregateError`, and its `stack`. Summaries leave the stack out.
A value that contains itself shows `circular_ref[...]`; select it to jump to the
row it refers to. An object that appears in several places opens in each.

```tsx
const node = { id: 'api-1', role: 'leader', failure: new Error('commit failed', { cause }) }
node.self = node
<Inspector value={node} expandDepth={2} aria-label="Cluster node" />
```

## Custom types

A class can choose how it appears by defining a method under `inspectorRepr`.
The method receives a visitor and describes the value by calling its methods,
in place of listing the object's own properties. Use it to hide internal fields
or show a domain value in its familiar form.

| Visitor method | Shows | Example |
| --- | --- | --- |
| `constructor_call(name, ...args)` | A constructor call; each argument opens as a child | `Moment(4021.88, -88127n)` |
| `class_object_like(name, members)` | A named object with the members you choose | `Container{name:"api-1",pid:311}` |
| `iterable_like(name, items)` | A named list | `EventLog[…]` |
| `span(text, type)` | One piece of text in a token color, such as `'number'` | `1m 32.5s` |
| `visit(value)` | Another value, shown like any other | |

A method that throws shows `<inaccessible>`. The key is
`Symbol.for('anta.to-repr')`, so separately loaded copies of Anta recognize the
same method.

```tsx
import { inspectorRepr, type InspectorReprVisitor } from '@antadesign/anta'

class Moment {
  constructor(public vtime: number, public inputHash: bigint) {}
  [inspectorRepr](v: InspectorReprVisitor) { v.constructor_call('Moment', this.vtime, this.inputHash) }
}

class Container {
  socket = { fd: 7 }
  constructor(public name: string, public image: string, public pid: number) {}
  [inspectorRepr](v: InspectorReprVisitor) {
    v.class_object_like('Container', { name: this.name, image: this.image, pid: this.pid })
  }
}
```

<a id="keyboard-accessibility"></a>

## Keyboard and accessibility

The tree is one Tab stop. Once it has focus, the arrow keys move focus between rows:

| Key | Action |
| --- | --- |
| Down / Up | Next or previous row |
| Home / End | First or last row |
| Page Down / Page Up | Ten rows down or up |
| Right | Open a closed row; on an open row, or one that can't open, move to its ⋯ button |
| Left | Close an open row, or move to its parent |
| Enter / Space | Open or close a row or range, show the next page, or jump from a cycle to its row |
| Alt+Enter | Open or close a row and everything below it (also Alt+click) |
| Shift+F10 / Menu key | Open the copy menu for the row |

Give each Inspector an `aria-label`, such as the name of the value it shows.
Screen readers announce rows as tree items, with their level and whether
they're open, named by their text alone. Opening a whole subtree stops after 500 rows, so one action can't
read an unbounded part of a value.

On a row's ⋯ button, named "More actions", Enter or Space opens the copy menu,
Left or Escape returns to the row, and Down or Up return to the row and move.

In the search field, named "Search" and the Inspector's `aria-label`:

| Key | Action |
| --- | --- |
| Enter | Reveal the next match |
| Shift+Enter | Reveal the previous match |
| Escape | Clear the field |

The **Previous match** and **Next match** buttons after the count do the same
as Shift+Enter and Enter, and are disabled when nothing matches. The match
count, such as "2 of 5", is announced as it changes. The field sits
before the tree, outside its `role="tree"`.

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | unknown | — | The value to show. Any JavaScript value works, including cycles, Maps, errors, and proxies; nothing is read until its row is shown. |
| `aria-label?` | string | — | Accessible name for the tree. Give every Inspector one, such as the name of the value it shows, so screen readers can tell several apart. |
| `chunkSize?` | number | 100 | An array, object, Map, or Set with more children than this shows them in ranges, such as `[0…99]`, that open like any row. Ranges nest by tens until a level has at most 10: 100,000 items show as ranges of 10,000, then 1,000, then 100. A range reads its children only when it opens. |
| `current?` | InspectorPath | — | The row to reveal, by path: it's scrolled into view and marked `data-current`. Open its ancestors with `inspectorExpandToPath` so it's shown. Focus doesn't move. |
| `defaultOpen?` | string[] | — | Rows open on first render, as path keys, uncontrolled. When omitted, `expandDepth` decides. Replacing `value` keeps the open rows whose paths still exist. |
| `expandDepth?` | number | 1, or 0 with `layout="inline" | Levels open when the value first renders. `0` starts with the value closed to a one-line summary. Strings always start closed. |
| `layout?` | 'block' \| 'inline' | 'block' | `block` shows the tree on its own lines. `inline` shows a one-line summary that sits in a sentence or table cell, and becomes a block when opened. |
| `numericBase?` | 'binary' \| 'octal' \| 'decimal' \| 'hex' | 'decimal' | Base for numbers. |
| `onStateChange?` | (event, detail) => void | — | Fired before rows open or close. `detail.next` is the requested list of open path keys and `detail.prev` the current one; `scope` is `'subtree'` for Alt+click and Alt+Enter, and `'reveal'` when a search step opens a match's ancestors. `event.preventDefault()` vetoes an uncontrolled change; in controlled mode, apply `next` to `open`. |
| `open?` | string[] | — | Controlled open rows, as path keys (`inspectorPathKey`). When set, you own open and close: a click or key only requests a change through `onStateChange`. Keys that name no row, as after `value` changes, are ignored. Leave it undefined for uncontrolled. |
| `previewBudget?` | number | 80 | Characters in a closed row's one-line summary with `layout="inline"`, counting the space after each comma and colon. Strings longer than this can open. In block layout, a summary instead ends at the row's edge. |
| `searchable?` | boolean | — | Shows a search field above the tree. A row matches on its key or its own value: a primitive's text, a string's text, or a container's type, such as `Array(3)`, never a closed row's preview of its children. Array indices don't match. Enter or the next button reveals the next match, opening the rows above it; Shift+Enter or the previous button reveals the previous one; Escape clears the field. |
| `searchMatcher?` | (query) => InspectorMatcher | — | Turns the typed query into a matcher: a RegExp, whose hits are highlighted, or a function of a row's text, which highlights the whole field. The default ignores case and treats spaces as any whitespace. |
| `textPageSize?` | number | 5000 | Characters per page of an open string. Long and multiline strings open into lines of text. |
| `unquotedStrings?` | boolean | — | Show strings without quotes. |

## Web Component

The Inspector renders a [Tree](./tree.md#web-component): an `a-tree` of
`a-tree-item` rows inside `<a-inspector>`, a tag that only carries its styling,
followed by its copy menu. The rows come from the JSX `Inspector`, which reads
the value as rows are shown, so use the JSX component rather than writing rows
by hand.

## Styling

Rows use the monospace font and the theme's text colors, in light and dark.
`--inspector-font-size`, `--inspector-line-height`, and `--inspector-indent`
set the type size, row height, and indent per level. `--inspector-row-width`
sets where rows end, measured from the Inspector's start with indentation
included; it's `120ch` by default, and `100%` fills the width. Style
`a-inspector` and its rows, the `a-tree-*` tags described in
[Tree's styling](./tree.md#styling), with plain CSS; unlayered rules override Anta's defaults without `!important`. A row's
`data-type` is `node`, `text`, `chunk`, or `more`, and the row a cycle jumps to has
`data-revealed` for a moment. While searching, matching rows have `data-match`,
the current one has `data-current`, and hits are `<mark>` elements. The search
field is in an `a-tree-toolbar` before the `a-tree`. The ⋯ button follows the value, because the
Inspector sets Tree's `--tree-actions-align` to `start`; set it to `end` to pin
⋯ to the row's end.

The classes below identify demonstrations. Substitute your own selectors.

A larger size for reading on a wide screen.

```css
a-inspector.inspector-large {
  --inspector-font-size: 14px;
  --inspector-line-height: 22px;
}
```

A tighter indent for deeply nested values. Keep it at 14px or more so the 12px disclosure mark fits.

```css
a-inspector.inspector-tight {
  --inspector-indent: 14px;
}
```

The ⋯ button pinned to the row's end, where it stays in one place however long the value is.

```css
a-inspector.inspector-pinned {
  --tree-actions-align: end;
}
```

## Example

```tsx
import { Inspector, Text } from '@antadesign/anta'

function Demo() {
  const config = { retries: 3, timeout_ms: 2500, endpoint: 'http://api-1:8080' }
  const failure = new Error('Ledger total is not conserved', {
    cause: new RangeError('index 9 out of range'),
  })
  const run = {
    id: 'run_4f2a9c1e',
    started: new Date('2026-11-14T03:12:44.120Z'),
    summary: { total: 25, passing: 21, failing: 4 },
    properties: [
      { name: 'Ledger total is conserved', type: 'always', status: 'failing', hits: 40211, error: failure },
      { name: 'No account goes negative', type: 'always', status: 'passing', hits: 118342 },
      { name: 'Leader is elected after a partition heals', type: 'sometimes', status: 'passing', hits: 88 },
    ],
    logs: new Map([
      ['api-1', ['leader elected term=7', 'ECONNRESET from db-primary']],
      ['workload', [
        'transfer tx_9f31 ok',
        'Traceback (most recent call last):\\n  File "driver.py", line 42, in main\\n    client.transfer(src, dst, amount)\\nTransferError: connection reset by peer',
      ]],
    ]),
    coverage: Array.from({ length: 250 }, (_, i) => Math.round((1 - Math.exp(-i / 60)) * 1000) / 1000),
    config,
    retryConfig: config,
    self: null as unknown,
  }
  run.self = run
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Text>
        Assertion failed with{' '}
        <Inspector layout="inline" value={{ expected: 1000000, observed: 999987.5, account: 'acct_9f31' }} aria-label="Assertion details" />{' '}
        after 3 retries.
      </Text>
      <Inspector value={run} aria-label="Test run" />
    </div>
  )
}
```
