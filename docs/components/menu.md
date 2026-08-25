# Menu

A dropdown or context menu that anchors to a target. Place
`<Menu>` immediately after the trigger — a button, an icon, a whole region —
and it opens on click, positions itself with room-aware flipping, and dismisses
on outside-click, `Escape`, or scroll. Rows are dedicated **`MenuItem`s** (not
buttons), with optional leading icons, trailing keyboard hints, separators,
grouped sections, and nested submenus.

Open state is uncontrolled by default — pass **`onStateChange`** (event-first:
`(event, { next, prev })`, or listen for the raw **`statechange`** event) to
observe it, or pass **`open`** to control it, applying `detail.next` to `open`
from your `onStateChange` handler (submenus stay uncontrolled). `statechange` is
**cancelable** and fires before the menu moves, so uncontrolled you can keep it
open with `event.preventDefault()`. You can also keep a `ref` and call
`.open()` / `.close()` / `.toggle()`.

## Dropdown from a button

Render `<Menu>` right after the trigger element. A `MenuItem` takes a leading
`icon`, a `label` (or `children`), and a trailing `kbd` hint. Selecting an item
closes the menu and fires its `onSelect(event, { value, label })`; `Escape` or an
outside click dismisses without selecting. Give items a `value` to route a single
handler — `onSelect` reports the chosen item's `value` and `label`, and never
fires for a submenu parent (that opens the flyout) or a selection bubbling up
from a nested submenu.

```tsx
// One handler, keyed by each item's `value`.
const onSelect = (e, { value }) => act(value)

<Button>Actions</Button>
<Menu>
  <MenuItem icon="edit" label="Edit" kbd="⌘E" value="edit" onSelect={onSelect} />
  <MenuItem icon="copy" label="Duplicate" kbd="⌘D" value="duplicate" onSelect={onSelect} />
  <MenuItem icon="download" label="Export" value="export" onSelect={onSelect} />
  <MenuSeparator />
  <MenuItem tone="critical" icon="trash" label="Delete" kbd="⌘⌫" value="delete" onSelect={onSelect} />
</Menu>
```

## Tone

`tone` colors an item's label, icon, and hover/selected tint (and its
`selectionIndicator`) with a semantic palette — `brand`, `info`, `success`,
`warning`, or `critical` — tracking light and dark mode automatically. Omit it (or
pass `neutral`) for the standard gray. `critical` is the conventional destructive
action. Pass **any CSS color** for a one-off custom tone — its hue and chroma are
kept while the lightness is pinned to match the brand text (resolved through
`--menu-item-tone-source`).

`toneSelected` applies the tone the same way, but **only while the row is `selected`**
— an unselected row stays neutral. It's the checkable-menu counterpart to `tone`
(`Select` uses it to tone the chosen row).

```tsx
<Menu>
  <MenuItem label="Neutral" />
  <MenuItem tone="brand" icon="star" label="Brand" />
  <MenuItem tone="info" icon="info" label="Info" />
  <MenuItem tone="success" icon="circle-check" label="Success" />
  <MenuItem tone="warning" icon="warning-triangle" label="Warning" />
  <MenuItem tone="critical" icon="trash" label="Critical" />
</Menu>
```

## Placement

`placement` sets the preferred side and edge alignment: `bottom-start` (the
default), `bottom-end`, `top-start`, or `top-end`. The `-start` / `-end` suffix
aligns the menu's left or right edge to the trigger. The menu auto-flips
vertically and clamps horizontally when there isn't room, so the placement is a
preference, not a constraint.

```tsx
<Button>bottom-start</Button>
<Menu placement="bottom-start">…</Menu>

<Button>bottom-end</Button>
<Menu placement="bottom-end">…</Menu>

<Button>top-start</Button>
<Menu placement="top-start">…</Menu>

<Button>top-end</Button>
<Menu placement="top-end">…</Menu>
```

The menu positions against the trigger's box. A trigger can narrow that: if it
implements **`getAnchorRect(): DOMRect`**, the menu positions against *that* rect
instead of its full border box. Anta's `Input` does this — it reports its field
box — so a `Menu` placed after an `<Input>` (as in `Select`) lines up with the
field, not the whole component (whose box also spans the label and hint).

## Open at the pointer

Pass `context` to open on right-click (the `contextmenu` event) of the region
the menu follows, positioned at the pointer — ideal for content surfaces like a
log viewer or canvas where secondary actions shouldn't clutter the UI. `coord`
on its own opens a normal left-click menu at the cursor instead of aligned to
the trigger box.

```tsx
<div class="canvas">Right-click anywhere here</div>
<Menu context>
  <MenuItem icon="link" label="Share log" onSelect={share} />
  <MenuItem icon="copy" label="Copy moment" onSelect={copy} />
</Menu>
```

## Submenus

Mark a `MenuItem` with `submenu` and nest a `<Menu>` inside it to create a
flyout (the nested menu detects it's a submenu from being inside the item). The
parent item gets a chevron (override it per item with `iconTrailing`),
`aria-haspopup="menu"`, and an `aria-expanded` that
tracks the flyout's open state; the submenu opens
to the side and flips when it nears the edge. Submenus open on **hover**
(with intent timing, so a quick pass-through doesn't trigger them) as well as on
click; add `nohover` to a submenu to make it click-only. Hover-intent is
mouse-only regardless: on touch a submenu opens on tap and stays open until you
dismiss it or open a sibling.

For a top-level dropdown, add `aria-haspopup="menu"` to your own trigger element
— it's a control you render, so the accessible name and popup hint live there.

Submenus nest arbitrarily deep — here `View → Columns → Visible columns` is three
flyouts in. The deepest one isn't `MenuItem`s but **custom content**: a checkbox
list whose region carries `data-menu-open`, so ticking a box (or the **Select all**
toggle, or a row's **Only** button — which leaves just that column on) updates state
**without closing the menu**.

```tsx
const COLUMNS = ['Name', 'Status', 'Owner', 'Created', 'Modified']
const [on, setOn] = useState(() => Object.fromEntries(COLUMNS.map((c) => [c, true])))
const allOn = COLUMNS.every((c) => on[c])
const someOn = COLUMNS.some((c) => on[c])
const only = (c) => setOn(Object.fromEntries(COLUMNS.map((k) => [k, k === c])))
// …toggle / toggleAll omitted

<Button>More</Button>
<Menu>
  <MenuItem icon="edit" label="Rename" />
  <MenuItem label="Move to" submenu>
    <Menu>
      <MenuItem icon="folder-open" label="Projects" />
      <MenuItem icon="folder-open" label="Archive" />
    </Menu>
  </MenuItem>
  <MenuItem label="View" submenu>
    <Menu>
      <MenuItem label="Columns" submenu>
        <Menu>
          <MenuItem label="Visible columns" submenu>
            <Menu>
              {/* custom content — never auto-closes thanks to data-menu-open */}
              <div class="menu-check-row" data-menu-open>
                {/* Checkbox takes 'indeterminate' directly — no ref poking */}
                <Checkbox
                  className="menu-check"
                  label="Select all"
                  checked={allOn ? true : someOn ? 'indeterminate' : false}
                  onStateChange={toggleAll}
                />
              </div>
              <MenuSeparator />
              {COLUMNS.map((c) => (
                <div class="menu-check-row" data-menu-open key={c}>
                  <Checkbox className="menu-check" label={c} checked={on[c]} onStateChange={() => toggle(c)} />
                  <Button priority="tertiary" size="small" onClick={() => only(c)}>Only</Button>
                </div>
              ))}
            </Menu>
          </MenuItem>
        </Menu>
      </MenuItem>
    </Menu>
  </MenuItem>
</Menu>
```

## Groups

Wrap related items in a `MenuGroup` with a `label` to add a titled section.
Headings are skipped during keyboard navigation, which flattens all items into a
single up/down sequence across group boundaries.

A `MenuSeparator` is a plain hairline when empty, but given text
(`<MenuSeparator>No results</MenuSeparator>`) it renders a small muted caption and
becomes an `aria-live="polite"` status region — the styled home for a status or
empty-state message (what `Select`'s `renderEmpty` uses).

```tsx
<Menu>
  <MenuGroup label="Sort by">
    <MenuItem icon="check" label="Name" />
    <MenuItem label="Date modified" />
  </MenuGroup>
  <MenuSeparator />
  <MenuGroup label="Show">
    <MenuItem label="Hidden files" data-menu-open />
  </MenuGroup>
</Menu>
```

## Pinned header and footer

`a-menu-header` and `a-menu-footer` name fixed regions around the scrolling
items. Put `a-select-header` or `a-select-footer` in the same slots when a
composed Select needs its own DOM anatomy. A `MenuSeparator` slotted into the
footer stays the menu's divider.

```tsx
<Button>Filter</Button>
<Menu inset={8}>
  <a-menu-header slot="header" data-menu-open>
    <Input size="small" placeholder="Filter…" />
  </a-menu-header>
  <MenuItem label="Design" />
  <MenuItem label="Engineering" />
  <MenuSeparator slot="footer" />
  <a-menu-footer slot="footer">
    <MenuItem icon="x" label="Clear filters" data-menu-open />
  </a-menu-footer>
</Menu>
```

## Custom content and the close behavior

The close decision is read straight from the DOM on click — never from whether a
handler called `preventDefault` — so it's safe in runtimes where event handlers
run off the UI thread. Walking out from the click, the nearest marker wins:

- A **`MenuItem`** is a choice → selecting it **closes** the menu.
- **Arbitrary content you inject never closes it** — drop a slider, an input, or
  any control straight into a `<Menu>` and interacting leaves the menu open.
- **`data-menu-open`** keeps the menu open past a click —
  put it on an item, a `MenuGroup`, or any wrapping element (toggles, multi-select).
- **`data-menu-close`** opts arbitrary content *into* closing — so a custom
  element (or a "Done" button inside a `data-menu-open` region) can dismiss the
  menu without being a `MenuItem`.

Selecting an item won't also click the region the menu sits in — the activation
click stops at the surface, so a `<Menu>` inside a clickable row or card is safe.
Other events still bubble; pass `stopPropagation` (`true` for clicks, or event
names like `"click pointerdown"`) to contain those too.

For programmatic open/close from app state, drive the `open` prop (the `state`
attribute, `"open"` / `"closed"`) and react via `onStateChange`, or keep a `ref`
and call `.open()` / `.close()` / `.toggle()`.

```tsx
<Menu>
  <MenuItem label="Profile" onSelect={openProfile} />
  {/* data-menu-open: a toggle that doesn't dismiss */}
  <MenuItem label="Notifications" data-menu-open onSelect={toggleNotifs} />
  <MenuSeparator />
  {/* data-menu-open region: interacting with the slider keeps the menu open;
      the Done button opts back into closing with data-menu-close */}
  <div data-menu-open class="zoom">
    <label>Zoom</label>
    <input type="range" />
    {/* a plain button, not a MenuItem — data-menu-close lets it dismiss */}
    <button data-menu-close>Done</button>
  </div>
</Menu>
```

## Inside a clickable row

A `<Menu>` can live inside a clickable row or card without its items triggering
that row's `onClick` — selecting an item is contained at the menu surface. In the
row below, the counter moves when you click the row, but not when you pick a menu
item. The kebab trigger is a plain button, so its click is stopped by hand; the menu
items need nothing. To contain more (a slotted control's clicks, say), add
`stopPropagation` to the `<Menu>`.

```tsx
<div className="row" onClick={openRow}>
  <span>Quarterly report.pdf</span>
  {/* the trigger is a plain button — stop its click so opening the
      menu isn't a row click; the menu items need no handling */}
  <Button
    icon="dots-vertical"
    aria-label="File actions"
    onClick={(e) => e.stopPropagation()}
  />
  <Menu>
    <MenuItem icon="edit" label="Rename" onSelect={rename} />
    <MenuItem icon="copy" label="Duplicate" onSelect={duplicate} />
    <MenuSeparator />
    <MenuItem icon="trash" tone="critical" label="Delete" onSelect={confirmDelete} />
  </Menu>
</div>
```

## Links

Give a `MenuItem` an **`href`** and it renders a native `<a>` instead of the
custom element — a real link. It navigates on click, opens in a new tab on
⌘ / middle-click, offers "copy link address", and takes the anchor attributes:
`target`, `rel`, `ping`, and **`download`** (`true` for the resource's default
filename, a string to rename it). The parent `Menu` treats it as a first-class
row — arrow-key navigation, Enter / Space activation, and close-on-select — mixed
freely with regular items. `onSelect` fires alongside the navigation; `disabled`
drops the `href` so it can't navigate; `selected` marks a current link
(`aria-current`).

Under the hood it's `<a role="menuitem" data-anta-menu-item href>`, the same
opt-in-marker pattern as [`Button`'s link mode](./button.md#link-mode).

```tsx
<Menu>
  {/* Real links — open in a new tab, or download */}
  <MenuItem icon="file" label="Documentation" href="/docs" target="_blank" iconTrailing="external-link" />
  <MenuItem icon="download" label="Download report" href="/report.pdf" download="report.pdf" />
  <MenuSeparator />
  {/* A regular action row, mixed in */}
  <MenuItem icon="settings" label="Preferences" onSelect={openPrefs} />
</Menu>
```

## Selected

`selected` gives a row a persistent background tint — the resting fill a pressed
row shows — marking it as chosen. It touches only the background, so nothing
shifts and no gutter is reserved. It's the building block for select-style
menus: mark one row for single-select, several for multi-select (pair with
`data-menu-open` to keep the menu open as choices toggle). The tint tracks
`tone`, so a toned row stays in its own color.

For a real checkable row, add **`selectionIndicator`** (`'checkbox'` or `'radio'`).
It renders a passive checkbox/radio at the leading edge (reusing the
[Checkbox](./checkbox.md) / [Radio](./radio.md) element visuals),
flips the row to `role="menuitemcheckbox"` / `"menuitemradio"`, and pairs
`aria-checked` — the row stays the control, the indicator is decorative. This is
what [Select](./select.md)'s `selection` modes render; use it directly for
a checkable menu.

```tsx
{/* Plain tint (no indicator) */}
<MenuItem label="Relevance" selected />

{/* Checkable rows — the row is the control; the mark is decorative */}
<MenuItem selectionIndicator="radio" label="Relevance" selected />
<MenuItem selectionIndicator="checkbox" label="Show archived" selected data-menu-open />
```

## Badges, counters, and hints

Drop a `<Tag>` (or any element) as a **child** of a `MenuItem` for a trailing
counter or badge. Children render after the label but before the `kbd` hint and
trailing icon, and the label's `flex: 1` right-aligns them — so a small tag sits
at the row's edge, just left of a shortcut or submenu chevron. Use `size="small"`
so it sits comfortably in the row.

Add `hint` for secondary text under the label — muted, and it tracks the row's
`tone`. It stacks in a column beneath the label while the icon, badge, and
chevron stay centered on the row, so it composes with a trailing counter.

```tsx
<Menu>
  <MenuItem icon="folder-open" label="Active" hint="12 open items"><Tag size="small" tone="info">12</Tag></MenuItem>
  <MenuItem icon="folder-close" label="Archived" hint="Read-only" />
  <MenuItem icon="trash" label="Trash"><Tag size="small">3</Tag></MenuItem>
</Menu>
```

`MenuItemCopy` is a row that copies to the clipboard when chosen — `copy` for a
literal string, `copyNode` for a DOM region. It composes a `<MenuItem>` with a
slotted `<a-copy>` element that performs the write, and keeps the menu open on
select so the check / retone feedback shows. `onCopied(ok)` fires after each
attempt. `iconPlacement="trailing"` moves the feedback glyph to the end of the
row; `"none"` shows a cursor-near confirmation instead.

Copy sits alongside normal items, so a "Share" menu can mix a copy-link row with
navigating links.

```tsx
<Button icon="share" iconTrailing="chevron-down" label="Share" />
<Menu>
  <MenuItemCopy copy={pageUrl} label="Copy link" kbd="⌘C" />
  <MenuItemCopy copy={embedHtml} icon="braces" label="Copy embed" />
  <MenuSeparator />
  <MenuItem icon="external-link" label="Open in new tab" href="/menu" target="_blank" />
</Menu>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children?` | ReactNode | — | Item content. With `label` set, children are extra content — most
 notably the nested `<Menu>` for a submenu parent. |
| `copiedLabel?` | string | Copied | Text in the successful no-icon confirmation. |
| `copy?` | string | — | Text copied to the clipboard on activation. |
| `copyNode?` | boolean \| string | — | Copy a DOM node as rich text (`text/html`) + plain text. `true` copies
 the nearest ancestor marked `data-copy-source`; a string is a CSS
 selector for an ancestor region (`closest`). The copy control is stripped
 from the copied output. |
| `copyUrl?` | true | — | Copy the current page URL (`location.href`). |
| `copyWithUrl?` | boolean | — | Prefix the copied text with `// URL: <current page URL>`. |
| `disabled?` | boolean | — | Disable the item: greyed out, not focusable for activation, no close. A
 disabled link also drops its `href`, so it can't navigate. |
| `hint?` | ReactNode | — | Secondary text under the label — explanatory copy, like `RadioGroup`'s
 option `hint`. Requires `label` (it stacks in a column beneath it). Muted
 (`--text-3`) and tracks the row's `tone`. A string, or any node. |
| `icon?` | IconShape | — | Leading icon shape. |
| `iconPlacement?` | 'leading' \| 'trailing' \| 'none' | 'leading' | Where the copy glyph sits relative to the label — or `'none'` to omit it.
 Without a glyph, a successful copy shows a confirmation label near the
 pointer and leaves the row unchanged. |
| `iconTrailing?` | IconShape | — | A trailing icon. On a `submenu` item this **overrides** the default
 chevron (omit it to keep the chevron); on a normal item it's the trailing
 glyph (omit for none). |
| `indeterminate?` | boolean | — | Only meaningful with `selectionIndicator="checkbox"`: render the box in the
 mixed state (`aria-checked="mixed"`) — e.g. a "Select all" row when some but
 not all of its options are selected. |
| `indicator?` | React.ReactNode | — | Replace the built-in selection-indicator *visual* with your own node,
 rendered at the **leading** edge (where the checkbox / radio sit). Pair with
 `selectionIndicator` to keep the semantics — the row stays the control and
 carries `role` + `aria-checked`; only the drawn mark changes. Suppresses the
 built-in checkbox / radio and the trailing `check` glyph. The node is made
 passive (aria-hidden, no pointer events) so the row receives the click. |
| `kbd?` | string | — | A trailing keyboard-shortcut hint, e.g. `"⌘E"`. |
| `label?` | ReactNode | — | The item's text. Usually a string, but any node is accepted — e.g. a filtered
 `Select` bolds the matched substring. Omit and pass `children` for richer
 content. |
| `onCopied?` | (ok) => void | — | Fires after the copy attempt with whether it succeeded. |
| `onCopyRequest?` | () => void | — | Compute the copy content lazily. Fires on pointerdown / keydown; update
 `copy` (a state change) here and the activation copies the latest value.
 The gap lets the update land even off the UI thread — only the
 serializable `copy` string crosses. |
| `onMouseDown?` | (event) => void | — | Raw `mousedown` on the row. Mainly to `preventDefault()` so the row doesn't
 take focus on a mouse press — e.g. a combobox option keeping focus in its
 input field while the click still selects. |
| `onSelect?` | (event, detail) => void | — | Activation handler — fires when *this* item is chosen (click / Enter /
 Space), unless it's `disabled`. It does **not** fire for a submenu parent
 (clicking that opens the flyout, which isn't a selection) nor for a
 selection bubbling up from a nested submenu. On a link item it fires
 alongside the navigation. Receives the event plus a `{ value, label }`
 detail. |
| `role?` | string | — | ARIA role override. Defaults to the role implied by `selectionIndicator`
 (`menuitem` / `menuitemcheckbox` / `menuitemradio`); set it to reparent the
 row under a different container role — e.g. `option` inside a `listbox`. |
| `selected?` | boolean | — | Mark the item as selected. On a plain row (no `selectionIndicator`) this is
 a persistent background tint, the same resting fill a pressed row shows —
 also the way to flag the current page on a link item. On a checkable row
 (`selectionIndicator` set) it instead drives the leading `checkbox` / `radio`
 indicator and the row's `aria-checked`. |
| `selectionIndicator?` | 'checkbox' \| 'radio' \| 'check' | — | Turn the row into a checkable item, driven by `selected` (the row stays the
 control and carries `aria-checked`):
 - `'checkbox'` → `role="menuitemcheckbox"`, a leading passive `<a-checkbox>`
   (before `icon`); the tint is dropped (the box carries state).
 - `'radio'` → `role="menuitemradio"`, a leading passive `<a-radio>`; tint dropped.
 - `'check'` → `role="menuitemradio"`, a trailing check glyph on the selected
   row *and* the background tint (the canonical single-select look).
 Omit for a plain row (the default). |
| `submenu?` | boolean | — | Marks this item as a submenu parent: adds the trailing chevron and
 `aria-haspopup="menu"`. Nest the flyout as a `<Menu>` child. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | neutral | Semantic tone — colors the label, icon, and hover/selected tint (and the
 `checkbox`/`radio` indicator, which adopts it). A named tone, or any literal
 CSS color (`'#ff1493'`, `'rebeccapurple'`) for a one-off custom tone whose
 hue + chroma are kept while the lightness is pinned to match the brand text.
 `critical` is the destructive action; `neutral` (the default) is the standard
 gray. |
| `toneSelected?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | neutral | Like `tone`, but applied only while the row is `selected` — an unselected row
 stays neutral. The whole selected row (label, icon, tint, and the `checkbox` /
 `radio` indicator) takes the tone. Same value set as `tone`; on a selected row
 `toneSelected` wins over `tone` when both are set. |
| `value?` | string \| number | — | An opaque value identifying this item, handed back in `onSelect`'s detail
 so a shared handler can tell which row was chosen without a per-item
 closure. |

## Keyboard

While open, the menu keeps Tab focus contained. Open the trigger with `Enter` /
`Space` to focus the first item.

- **↑ / ↓** — move between items (wraps; skips separators, headings, and disabled items)
- **Home / End** — first / last item
- **Type-ahead** — type to jump to the next item whose label matches
- **→ / Enter** — open a submenu (and focus its first item); **←** — close it, back to the parent
- **Enter / Space** — activate the focused item
- **Tab / Shift+Tab** — cycle through the focusables *inside* the menu — items **and** any nested controls (a slider, an input, a button) — wrapping at the ends so focus stays in the open menu. Arrow keys hand off to a nested control once it's focused
- **Esc** — close the topmost menu and return focus to its parent item or trigger

## Controlled vs Uncontrolled

Open state follows Anta's shared **state contract**. By default the menu is
*uncontrolled* — its triggers (click / right-click / `.open()`) own open/close,
so there's no prop to set. Pass `open` to *control* it: visibility follows the
prop, and a user dismiss only *requests* a change. The `<Menu>` wrapper takes a
boolean; the `<a-menu>` element takes a `state` string enum:

| | `<Menu>` (JSX) | `<a-menu>` (element) |
|---|---|---|
| **Uncontrolled** (default) — triggers own it | *(no prop)* | *(no `state` attribute)* |
| **Controlled** — you own it | `open` + `onStateChange` | `state="open" \| "closed"` + `statechange` |
| **Change event** | `onStateChange(event, { next, prev })` — `next` / `prev` are **booleans** | `statechange`, a `CustomEvent<{ next, prev }>` — `'open'` / `'closed'` (plus `coord` / `originEvent`) |

`statechange` is **cancelable** and fires *before* the menu moves. Uncontrolled,
call `event.preventDefault()` to keep the menu as-is (e.g. block a dismiss).
Controlled, the menu never self-moves — apply `detail.next` to `open` to accept,
or do nothing to reject. (Submenus are always uncontrolled, regardless of `open`.)

Use the web component directly when you are not using React or Preact and a native control does not fit.

Put a focusable trigger immediately before `<a-menu>` and omit `state` for an
uncontrolled menu. Its light-DOM `<a-menu-item>` rows need their own `tabindex`
values.

```html
<a-button role="button" tabindex="0" aria-haspopup="menu">
  <a-button-label>Actions</a-button-label>
</a-button>
<a-menu role="menu">
  <a-menu-item role="menuitem" tabindex="0" value="settings"><a-menu-item-label>Settings</a-menu-item-label></a-menu-item>
  <a-menu-item role="menuitem" tabindex="0" value="members"><a-menu-item-label>Members</a-menu-item-label></a-menu-item>
</a-menu>
```

The popover surface lives in shadow DOM and is exposed as a **part** — style its
chrome (background, frost, border, radius, shadow, padding, min-width) with
`::part(menu)`. Menu items are light DOM, so style them (and their
`a-icon` / `kbd` / `a-menu-item-label` children) directly. Match **both** item
shapes — the `a-menu-item` custom element and the `a[data-anta-menu-item]` link —
with `:is(a-menu-item, a[data-anta-menu-item])`, or a link row skips your item
rule. **Click the trigger** to open the styled menu; the `.fancy` class is just
for the demo:

```css
/* a "liquid glass" menu — more transparent + a stronger blur, big radius, fully
   rounded items with roomier padding and bigger icons / type. */
a-menu.fancy::part(menu) {
  border-radius: 22px;
  min-width: 240px;
  padding: 8px;
  background: light-dark(rgba(255,255,255,0.55), rgba(28,26,32,0.5));
  backdrop-filter: blur(28px) saturate(180%);
}
/* Items are light DOM — style them directly. `:is()` catches both an
   <a-menu-item> and a link row (<a data-anta-menu-item>). */
a-menu.fancy :is(a-menu-item, a[data-anta-menu-item]) {
  border-radius: 999px;
  padding: 10px 16px;
  font-size: 15px;
  --icon-size: 18px;           /* inherited by the item's <a-icon> */
}
```
