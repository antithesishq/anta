# Inspector

Inspector shows any JavaScript value as a tree you can explore, such as test
results, errors, and logs. Rows read like an object in browser DevTools and
open one level at a time, so a large value is read only as far as it's shown.
Select a row to open or close it.

## Open a level at a time

`expandDepth` sets how many levels start open; the default opens the value's
own properties. A closed row shows a one-line summary that ends in `…` 120
characters from the Inspector's start, or sooner in a narrower window. With
`layout="inline"`, the summary has up to `previewBudget` characters instead.
Wide arrays, objects, Maps, and Sets show `pageSize` children at a time, with a **Show more** row for the next page. Long and multiline strings,
such as stack traces, open into lines of text a page at a time.

```tsx
<Inspector value={testResult} pageSize={50} aria-label="Test result" />
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

The tree is one Tab stop. Once it has focus, the keys move a highlighted row:

| Key | Action |
| --- | --- |
| Down / Up | Next or previous row |
| Home / End | First or last row |
| Page Down / Page Up | Ten rows down or up |
| Right | Open a closed row; on an open row, or one that can't open, move to its ⋯ button |
| Left | Close an open row, or move to its parent |
| Enter / Space | Open or close a row, show the next page, or jump from a cycle to its row |
| Alt+Enter | Open or close a row and everything below it (also Alt+click) |
| Shift+F10 / Menu key | Open the copy menu for the row |

Give each Inspector an `aria-label`, such as the name of the value it shows.
Screen readers announce rows as tree items, with their level and whether
they're open. Opening a whole subtree stops after 500 rows, so one action can't
read an unbounded part of a value.

On a row's ⋯ button, Enter or Space opens the copy menu, Left or Escape returns
to the row, and Down or Up return to the tree and move a row. The button is
named "More actions", so the highlighted row's name ends with it while the tree
has focus.

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | unknown | — | The value to show. Any JavaScript value works, including cycles, Maps, errors, and proxies; nothing is read until its row is shown. |
| `aria-label?` | string | — | Accessible name for the tree. Give every Inspector one, such as the name of the value it shows, so screen readers can tell several apart. |
| `expandDepth?` | number | 1, or 0 with `layout="inline" | Levels open when the value first renders. `0` starts with the value closed to a one-line summary. Strings always start closed. |
| `layout?` | 'block' \| 'inline' | 'block' | `block` shows the tree on its own lines. `inline` shows a one-line summary that sits in a sentence or table cell, and becomes a block when opened. |
| `numericBase?` | 'binary' \| 'octal' \| 'decimal' \| 'hex' | 'decimal' | Base for numbers. |
| `pageSize?` | number | 100 | Children shown per page of an open array, object, Map, or Set. A "Show more" row shows the next page. |
| `previewBudget?` | number | 80 | Characters in a closed row's one-line summary with `layout="inline"`, counting the space after each comma and colon. Strings longer than this can open. In block layout, a summary instead ends at the row's edge. |
| `textPageSize?` | number | 5000 | Characters per page of an open string. Long and multiline strings open into lines of text. |
| `unquotedStrings?` | boolean | — | Show strings without quotes. |

## Web Component

`<a-inspector>` handles input for rows the JSX wrapper renders. The wrapper
renders each line as a direct `a-inspector-row` child with its ARIA and its
`row-id`, `type`, `expandable`, `open`, `group`, and `target` attributes. The
element owns focus, the highlighted row, and the keyboard, and never changes the
DOM. It reports what the reader asks for as events, so a renderer can answer
them, including one running in a worker:

| Event | Detail | Sent when |
| --- | --- | --- |
| `nodetoggle` | `{ id, open, deep? }` | A row should open or close; `deep` covers its whole subtree |
| `pagerequest` | `{ group }` | A **Show more** row asks for the next page |
| `rowmenu` | `{ id }` | A context menu opens on a row, or `null` outside any row |

Use the JSX `Inspector`, which renders the rows and answers these events.
Writing rows by hand means reimplementing that renderer.

## Styling

Rows use the monospace font and the theme's text colors, in light and dark.
`--inspector-font-size`, `--inspector-line-height`, and `--inspector-indent`
set the type size, row height, and indent per level. `--inspector-row-width`
sets where rows end, measured from the Inspector's start with indentation
included; it's `120ch` by default, and `100%` fills the width. Style `a-inspector` and
its `a-inspector-row` children with plain CSS; unlayered rules override Anta's
defaults without `!important`. `::highlight(anta-inspector-reveal)` styles the
brief highlight after jumping from a cycle.

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
