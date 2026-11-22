# Tree

Tree shows nested items that open and close, such as a folder browser, a list of
checks grouped by kind, or a test run's steps. Pass the items as data in
`items`; Tree renders every row from them. Select a row to open or close it. The
tree is one Tab stop, and the arrow keys move between rows.
[Inspector](./inspector.md) is an implementation of Tree for
exploring JavaScript values.

## Show nested items

Each item has an `id`, unique in the tree, and a `label`. An item with
`children` can open; leave `children` out for a leaf. `defaultOpen` lists the
ids open on first render. Selecting a leaf, by pointer or with Enter or Space,
calls its `onClick`.

`indicator` sets the open and closed mark for every item that can open. Pass a
node for each state to show folder icons. An item's own `indicator` replaces the
tree's, such as a file icon on a leaf. While an item is open, its `before`
shows on its row after the label, and its `after` on a line below its
children, such as an opening and a closing bracket.

```tsx
const toItems = entries => entries.map(entry => ({
  id: entry.path,
  label: entry.name,
  children: entry.entries && toItems(entry.entries),
  indicator: entry.entries ? undefined : <Icon shape="file" />,
  onClick: entry.entries ? undefined : () => openFile(entry.path),
}))

<Tree
  aria-label="Project files"
  items={toItems(project)}
  defaultOpen={['src']}
  indicator={{ closed: <Icon shape="folder-close" />, open: <Icon shape="folder-open" /> }}
/>
```

## Choose the mark

`indicator` accepts `chevron`, the default, `triangle`, or `plus`.
`indicatorPlacement="end"` moves the mark after the label. Leaves keep the
mark's space at the start, so labels line up. `renderIndicator` and
`renderLabel` replace the mark or the label of every row, with the item and
whether it's open.

```tsx
<Tree aria-label="Checks" items={checks} defaultOpen={['safety']} />
<Tree aria-label="Checks" items={checks} defaultOpen={['safety']} indicator="triangle" />
<Tree aria-label="Checks" items={checks} defaultOpen={['safety']} indicator="plus" indicatorPlacement="end" />
```

## Add actions and a context menu

An item's `actions` are buttons at the end of its row. They show on hover and
when the row has keyboard focus, and Right reaches them from the keyboard, so
they never add Tab stops. On a touch screen they always show. Give each one an
`icon` and a `label`, which names it for screen readers. Add a `tooltip` to show
text on hover and focus.

Actions are Anta buttons, sized to the row's line so they don't make it taller,
and at least 24px on a touch screen. Icon-only actions stay square, so each theme
gives them its own shape. Clicking the empty part of a row, beside its actions,
still opens or closes it. `--tree-actions-align` places the actions: `end`, the
default, pins them to the row's end, and `start` puts them right after the
label.

Place a `<Menu context>` right after the Tree to give every row a context menu.
It opens on right-click, Shift+F10, or the Menu key, and from an action with
`opensMenu`. `onItemMenu` reports which item the menu opened on. When the tree
renders from a worker, the menu can open before that report arrives, so keep the
menu's items unavailable until it does.

```tsx
const [menuItem, setMenuItem] = useState(null)

<Tree
  aria-label="Project files"
  items={items.map(item => ({
    ...item,
    actions: [{ icon: 'more', label: 'More actions', opensMenu: true }],
  }))}
  onItemMenu={(event, { id }) => setMenuItem(id)}
/>
<Menu context>
  <MenuItem label="Rename" disabled={menuItem === null} onSelect={() => rename(menuItem)} />
</Menu>
```

Each action in a row is its own button. With the mouse, select a button; from the
keyboard, press Right to reach the first one, and Right or Left to move between
them; on a touch screen, tap one. With short labels, `--tree-actions-align`
shows the difference: the actions sit at the row's end by default, and right
after the label with `start`.

```tsx
<Tree
  aria-label="Services"
  items={services.map(service => ({
    ...service,
    actions: [
      { icon: 'refresh', label: `Restart ${service.label}`, onClick: () => restart(service) },
      { icon: 'copy', label: `Copy ${service.label}`, onClick: () => copy(service) },
    ],
  }))}
/>
```

```css
a-tree.tree-actions-start {
  --tree-actions-align: start;
}
```

## Control the open items

Pass `open` to own the open items, and update it from `onStateChange`.
`detail.next` lists the open ids requested. `detail.scope` is `subtree` for
Alt+click and Alt+Enter, which open or close an item and everything under it.
An uncontrolled tree applies that to the items it has; a controlled tree's
application decides.

Children can arrive later. Pass `children: []` for an item whose children
aren't loaded yet; it can still open. Load them when its id appears in `open`.

```tsx
const [open, setOpen] = useState([])
const [loaded, setLoaded] = useState({})

<Tree
  aria-label="Test runs"
  items={roots.map(root => ({ id: root.id, label: root.name, children: loaded[root.id] ?? [] }))}
  open={open}
  onStateChange={(event, { next }) => {
    setOpen(next)
    for (const id of next) if (!loaded[id]) load(id).then(children => setLoaded(l => ({ ...l, [id]: children })))
  }}
/>
```

`focusRequest` moves focus to an item and scrolls it into view. Pass a new `n`
to repeat a request for the same item.

## Mark the current item

`current` names an item, such as a search match. The item gets `data-current`
and scrolls into view when `current` changes, while focus and the keyboard's
position stay where they are, so a search field keeps focus. Open the item's
ancestors so it's shown. `toolbar` renders content, such as a search field, in an
`a-tree-toolbar` before the tree, outside its `role="tree"`. Search, below, uses
both.

## Search

Tree has no search of its own; attach it with four exported pieces:

- `TreeSearchBar`, a search field with a match count and Previous match and
  Next match buttons, in the `toolbar` slot. Enter and Shift+Enter step
  through the matches, and Escape clears the field.
- `treeSearch(items, query)`, which returns the matching items in the order the
  open tree shows them. Each match has the item's `id` and its `ancestors`.
- `open` and `current`: to reveal a match, add its `ancestors` to `open` and
  set `current` to its `id`.
- `treeHighlight(text, query)`, which wraps each hit in `<mark>`, for the
  items' labels. Tree styles the marks, and the current item's more strongly.

A string query matches literally, ignoring case. Pass a `RegExp`, or a function
of an item's text, for anything else, and `null` for no query. An item's text
is its `label` when that's a string; pass `getText` to search other text.

```tsx
import { Tree, TreeSearchBar, treeHighlight, treeSearch, type TreeItem } from '@antadesign/anta'

function FileSearch({ files }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<number | null>(null)
  const [open, setOpen] = useState<string[]>([])

  const toItems = (entries, label): TreeItem[] => entries.map(entry => ({
    id: entry.path,
    label: label(entry.name),
    children: entry.entries && toItems(entry.entries, label),
  }))
  // Search the plain names, then render the same items with the hits marked.
  const matches = treeSearch(toItems(files, name => name), query)

  const step = (direction: 1 | -1) => {
    if (!matches.length) return
    const next = index === null ? (direction === 1 ? 0 : matches.length - 1) : (index + direction + matches.length) % matches.length
    setIndex(next)
    setOpen(keys => [...new Set([...keys, ...matches[next].ancestors])])
  }

  return (
    <Tree
      aria-label="Repository"
      items={toItems(files, name => treeHighlight(name, query))}
      open={open}
      onStateChange={(_event, { next }) => setOpen(next)}
      current={index === null ? undefined : matches[index]?.id}
      toolbar={
        <TreeSearchBar
          query={query}
          onQueryChange={next => { setQuery(next); setIndex(null) }}
          count={matches.length}
          index={index}
          onStep={step}
          aria-label="Search files"
        />
      }
    />
  )
}
```

A custom matcher changes what counts as a match. Here the query is a file
extension, such as `ts` or `md`, and a function finds the files that end in it.

```tsx
const extension = query.trim().replace(/^\./, '')
const matcher = extension ? (name: string) => name.endsWith(`.${extension}`) : null
const matches = treeSearch(items, matcher)
// …and treeHighlight(name, matcher) for the labels.
```

Search covers only the items in `items`. A folder whose children load when it
opens, given as `children: []` until then, has nothing to search, and searching
never loads it. To search what hasn't loaded, search on your server, load the
folders above each match, then reveal it. The
[Inspector's search](./inspector.md#search-a-value) uses the same search field.

<a id="keyboard-accessibility"></a>

## Keyboard and accessibility

The tree is one Tab stop. Focus moves with the arrow keys, and Tab returns to the
row last focused:

| Key | Action |
| --- | --- |
| Down / Up | Next or previous row |
| Home / End | First or last row |
| Page Down / Page Up | Ten rows down or up |
| Right | Open a closed item; on an open item or a leaf, move to the row's first action |
| Left | Close an open item, or move to its parent |
| Enter / Space | Open or close an item, or select a leaf |
| Alt+Enter | Open or close an item and everything under it (also Alt+click) |
| Shift+F10 / Menu key | Open the context menu for the row |

On a row's actions, Right and Left move between them. Left on the first action,
or Escape, returns to the row, and Down or Up return and move a row. Enter and
Space press the action.

Give each Tree an `aria-label`. Screen readers announce rows as tree items, with
their level and whether they're open. Each row's name is its label alone.
A `disabled` item can't open or be selected, and stays focusable so readers can
still find it.

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | TreeItem[] | — | The items, as data: the tree's single source. |
| `aria-label?` | string | — | Accessible name. Give every tree one. |
| `current?` | string | — | The current item, such as a search match: it's marked `data-current` and scrolled into view after rendering, without moving focus or the keyboard's cursor. The first render doesn't scroll; only a change does. |
| `defaultOpen?` | string[] | — | Items open on first render, uncontrolled. After that the Tree owns open and close itself. |
| `focusRequest?` | — | — | Moves focus to an item and scrolls it into view. A new `n` repeats the request, so the same item can be focused again. The first render never focuses; only a change does. The item must be shown: every ancestor open. |
| `indicator?` | TreeIndicator | 'chevron' | The open/closed mark for every item that can open. |
| `indicatorPlacement?` | 'start' \| 'end' | 'start' | Put the mark before the label or after it. |
| `onItemMenu?` | (event, detail) => void | — | Fired when a context menu opens on an item: a right-click, Shift+F10, the Menu key, or an action with `opensMenu`. `detail.id` is that item. Put your own `<Menu context>` right after the Tree: it opens by itself, since a root Menu's trigger region is the element before it. From a worker, the menu can open before this reaches you, so render its items for "no item yet" until it does. |
| `onStateChange?` | (event, detail) => void | — | Fired before items open or close. `detail.next` is the requested list of open ids and `detail.prev` the current one. `scope` is `'subtree'` for Alt+click and Alt+Enter, which open or close the item and everything under it, and `'item'` otherwise. An uncontrolled Tree applies a subtree request to the `items` it has; a controlled caller with children it hasn't loaded yet works out the rest. `event.preventDefault()` vetoes an uncontrolled change; in controlled mode, apply `next` to `open` to accept. |
| `open?` | string[] | — | Controlled open items, by id. When set, you own open and close: the tree shows exactly this, and a click or key only requests a change through `onStateChange`. `[]` is controlled with nothing open. Leave it undefined (and use `defaultOpen`) for uncontrolled. |
| `renderIndicator?` | (item, state) => ReactNode | — | Replaces each row's mark. |
| `renderLabel?` | (item, state) => ReactNode | — | Replaces each row's label. The actions keep their own container, so this never renders them. |
| `toolbar?` | ReactNode | — | Content shown before the tree, outside it, such as a search field. |

## Item props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | string | — | The item's identity, unique in the tree. `open`, `defaultOpen` and `onStateChange` speak in these ids. |
| `label` | ReactNode | — | The row's content. A string gets the default styling; a node is rendered as given. The Tree's `renderLabel` overrides both. |
| `actions?` | TreeAction[] | — | Buttons at the end of the row, in their own container. They show on hover and on the focused row. Right from the row reaches the first one; they're never Tab stops. |
| `after?` | ReactNode | — | Shown on its own line below the children while the item is open, such as a closing bracket. It isn't a tree item: it can't take focus, and screen readers skip it. |
| `before?` | ReactNode | — | Shown on the row after the label while the item is open, such as an opening bracket. |
| `children?` | TreeItem[] | — | Child items. Defined means the item can open, even when empty: pass `[]` for children that aren't loaded yet, as for a closed item whose children you only compute once it opens. Leave it out for a leaf. |
| `className?` | string | — | CSS class on the option's rendered row. |
| `disabled?` | boolean | — | Can't open or be selected; still focusable, as a disabled tab is. |
| `indicator?` | TreeIndicator | — | This item's mark, overriding the Tree's `indicator`. On a leaf, only a node renders (a file icon, say); a leaf without one keeps the mark's space, so labels line up. |
| `onClick?` | (event) => void | — | Selecting a leaf, by click, Enter, or Space. An item that can open opens instead. |
| `style?` | CSSProperties | — | Inline styles on the option's rendered row. |

## Action props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | IconShape | — | The button's icon. |
| `label` | string | — | Accessible name, announced by screen readers. |
| `disabled?` | boolean | — | Shows the button but can't be pressed, and the arrow keys skip it. |
| `onClick?` | (event) => void | — | Pressing the button, by pointer, Enter, or Space. It doesn't open or close the row. |
| `opensMenu?` | boolean | — | Opens the `<Menu context>` that follows the Tree, at this button, for this item: `onItemMenu` fires, then the menu opens. |
| `tooltip?` | ReactNode | — | Tooltip shown on hover and focus. Leave it out for none. |

## Web Component

`<a-tree>` handles every click and key for its `<a-tree-item>` children and never
changes the DOM, so a tree can render from a worker. An item with `state`
(controlled) or `default-state` (uncontrolled), set to `open` or `closed`, can
open; an item with neither is a leaf. Children go in an `a-tree-group` child.
A hand-built tree opens and closes with no script:

```html
<a-tree role="tree" tabindex="0" aria-label="Project files">
  <a-tree-item role="treeitem" item-id="src" default-state="open" aria-labelledby="src-label">
    <a-tree-row>
      <a-tree-indicator shape="chevron" aria-hidden="true"></a-tree-indicator>
      <a-tree-value id="src-label">src</a-tree-value>
    </a-tree-row>
    <a-tree-group role="group">
      <a-tree-item role="treeitem" item-id="src/index.ts" aria-labelledby="index-label">
        <a-tree-row><a-tree-value id="index-label">index.ts</a-tree-value></a-tree-row>
      </a-tree-item>
    </a-tree-group>
  </a-tree-item>
</a-tree>
```

With `tabindex="0"` on `a-tree`, the tree is the Tab stop and points at the
current item. The JSX `Tree` instead gives each item a moving `tabindex`. Put
row buttons in an `a-tree-actions` child of `a-tree-row`, with `tabindex="-1"`.
Add `data-anta` to a native `<button>` there for Anta's button styles and the
same sizing as the JSX `Tree`'s actions:

```html
<a-tree-actions>
  <button type="button" data-anta priority="tertiary" tabindex="-1" aria-label="New file">
    <a-icon shape="plus" aria-hidden="true"></a-icon>
  </button>
</a-tree-actions>
```

The JSX `Tree` renders actions with `Button`, so a page that registers elements
one at a time also registers `a-button`, `a-icon`, and `a-tooltip`.

| Event | Fired on | Detail | Sent when |
| --- | --- | --- | --- |
| `statechange` | `a-tree-item` | `{ next, prev, scope }` | Before an item opens or closes; cancelable |
| `activate` | `a-tree-item` | | A leaf is selected |
| `navigate` | `a-tree` | `{ id }` | Focus moves to another item; bubbles |
| `itemmenu` | `a-tree` | `{ id }` | Just before a context menu opens on an item |

Set `data-focus="<item-id>#<n>"` on `a-tree` to focus an item, and
`data-reveal="<item-id>#<n>"` to scroll an item into view without focusing it.

## Styling

Tree uses the page's font and sizes in `em`. `--tree-indent` sets the indent per
level, `--tree-row-padding` the space above and below each row,
`--tree-indicator-size` the mark's size, `--tree-gap` the space between a row's
parts, `--tree-row-hover` the background of a hovered or focused row, and
`--tree-row-current` the background of the current item.
`--tree-action-size` sets the actions' size, the row's line height by default,
and `--tree-actions-align` places them in the row. Style
the `a-tree-item`, `a-tree-row`, `a-tree-value`, `a-tree-indicator`,
`a-tree-actions`, `a-tree-group`, `a-tree-before`, `a-tree-after`, and
`a-tree-toolbar` tags with plain CSS. The current item has `data-current`, and its row
takes the `--tree-row-current` background by default. An item shows its state as `:state(open)` or `:state(closed)`, and
the focused item as `:state(active)`. Unlayered rules override Anta's defaults
without `!important`.

The classes below identify demonstrations. Substitute your own selectors.

A compact tree for a sidebar.

```css
a-tree.tree-compact {
  --tree-indent: 1em;
  --tree-row-padding: 0;
  font-size: 13px;
}
```

## Example

```tsx
import { Icon, Menu, MenuItem, Tree } from '@antadesign/anta'

function Demo() {
  const file = name => ({ id: name, label: name.split('/').pop(), indicator: <Icon shape="file" /> })
  const items = [
    {
      id: 'src', label: 'src',
      actions: [{ icon: 'more', label: 'More actions', opensMenu: true }],
      children: [
        file('src/index.ts'),
        { id: 'src/ledger', label: 'ledger', children: [file('src/ledger/transfer.ts'), file('src/ledger/balance.ts')] },
        { id: 'src/fixtures', label: 'fixtures', children: [] },
      ],
    },
    { id: 'workload', label: 'workload', children: [file('workload/driver.ts')] },
    file('README.md'),
  ]
  return (
    <>
      <Tree
        aria-label="Project files"
        items={items}
        defaultOpen={['src']}
        indicator={{ closed: <Icon shape="folder-close" />, open: <Icon shape="folder-open" /> }}
      />
      <Menu context>
        <MenuItem label="Rename" />
        <MenuItem label="Delete" tone="critical" />
      </Menu>
    </>
  )
}
```
