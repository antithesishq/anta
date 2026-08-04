# Select

`Select` lets people choose one or more options from a dropdown. Its read-only
field shows the selected value. Click the field to open the menu. The menu
closes when a user clicks outside it or presses Esc.

Select uses an [Input](./input.md) for its field and a [Menu](./menu.md) for its
dropdown. Pass `options` as an array of strings or objects. Use `value` with
**`onValueChange`** to control the selection, or use `defaultValue` for an
uncontrolled Select.

## Options

```tsx
<Select
  label="Field"
  options={[
    { value: 'output_text', hint: 'Raw log message or event payload', icon: 'file' },
    { value: 'stream', hint: 'Log level: error · info · internal', icon: 'braces' },
    { value: 'container', hint: 'Host where the event occurred', icon: 'cube' },
    { value: 'archived', hint: 'Read-only snapshot', icon: 'folder-close', disabled: true },
    { value: 'flagged', hint: 'Needs review', icon: 'warning-triangle', tone: 'warning' },
    { value: 'custom', hint: 'Your own field path', icon: 'asterisk', tone: '#c026d3' },
  ]}
/>
```

`options` takes bare strings or objects. A string is shorthand for
`{ value, label: value }`. An object adds a `label`, a `hint` (the secondary line),
a leading `icon`, a per-option `tone` (a named tone or a custom CSS color), or
`disabled`. Open the field: the chosen row is highlighted, and the disabled row is
skipped by the keyboard.

## Selection modes

```tsx
// Single-select marks (single value)
<Select indicator="check" options={OPTIONS} value={one} onValueChange={setOne} />  // trailing ✓ + tint
<Select indicator="radio" options={OPTIONS} value={one} onValueChange={setOne} />  // leading radio
<Select options={OPTIONS} value={one} onValueChange={setOne} />                    // tint only (default)

// Tone the selected row: named tone or custom color (the indicator adopts it)
<Select indicator="check" toneSelected="brand" options={OPTIONS} value={one} onValueChange={setOne} />
<Select indicator="radio" toneSelected="#c026d3" options={OPTIONS} value={one} onValueChange={setOne} />

// Multiple: checkboxes, count summary, Select-all row (default); value is an array
<Select
  selection="multiple"
  options={OPTIONS}
  value={many}
  onValueChange={setMany}
/>
```

`selection` sets **behavior**, `indicator` sets the single-select **mark**.

`selection="single"` (the default) keeps `value` a single value and closes on pick.
`indicator` then picks the row mark: **`"none"`** (default; a tint-only highlight),
**`"check"`** (a trailing checkmark on the chosen row that keeps the tint, the
canonical Select look), or **`"radio"`** (a leading radio on every row).

`selection="multiple"` makes `value` an **array**, puts a **checkbox** on
every row, keeps the menu open as you toggle, and summarises the selection in the
field: **`All`** when every option is on, the single label for one, else **"N
selected"** (pass **`verbose`** to spell the picks out — `3 selected: A, B, C`; or
take over the text entirely with [`renderSummary`](#selection-summary); an empty
selection shows the `placeholder`). A
**Select all** top row shows by default; it toggles everything, and
its box goes mixed when only some are on. Pass **`selectAll={false}`** to drop it.

In a multi-select, **`Alt`+Click** a row to clear every other selection and
select that row. On macOS, use Option instead of Alt.
The standard tooltip describes this shortcut when the pointer is over a row.
Set `SelectOption.tooltip` to replace it, or to `''` to hide it. The shortcut
is available only when `selectAll` is enabled, so `selectAll={false}` removes it.

Each checkable row is the control itself (`role="menuitemcheckbox"` /
`menuitemradio`, `aria-checked`); the checkbox / radio / check is a passive indicator
the row drives.

**`toneSelected`** tones the selected row(s): the whole row takes the tone, including
label, icon, indicator, and tint. Pass a named tone or any CSS color (a custom color
keeps its hue, with lightness pinned to the brand text). It reads strongest with
`indicator` `none` / `check`, which show the row tint; `radio` / `checkbox` have no
row tint, so it tones the label and indicator only.

## Filter

```tsx
// Built-in matcher: case-insensitive substring of value / label / hint
<Select filter indicator="check" options={OPTIONS} value={v} onValueChange={setV} />

// Custom matcher: a per-option predicate
<Select
  filter={(option, query) => option.value.startsWith(query)}
  options={OPTIONS}
  value={v}
  onValueChange={setV}
/>
```

Add **`filter`** for a search field at the top of the menu that narrows the options
as you type. `true` uses the built-in matcher: a case-insensitive substring of the
option's **value, label, or hint**. It's **whitespace-flexible** (a typed space
matches any run of whitespace) and **bolds the matched substring** in the results.
Pass a **function** `(option, query) => boolean` for custom matching (no highlight).

With `filter`, Select behaves as a **combobox**. Opening it focuses the search
field. ↑ and ↓ move through matching options while focus
stays in the field. Enter selects the active option, and Esc
closes the menu. The search field stays visible while the results scroll. A
"No matches" row appears when nothing matches, and the query resets when the
menu closes. In `multiple` mode, `selectAll` affects only the visible matches.

## Value and changes

```tsx
const [field, setField] = useState('stream')

<Select
  label="Field"
  options={['output_text', 'stream', 'container', 'vtime', 'custom']}
  value={field}
  onValueChange={(v) => setField(v)}
/>
```

The value is the **option's `value`** — `value="stream"` in single mode, an array
like `value={['stream', 'container']}` in `multiple`. It's the option's identity:
what `value` / `defaultValue` name and what `onValueChange` reports, so keep each
option's `value` **unique across the whole tree**. Selection is value-keyed and
global across groups / submenus, so a value repeated in two sections is one logical
pick (both rows toggle together; the trigger resolves to the last). Dev builds
`console.warn` on a duplicate.

Values aren't limited to strings. `Select` **infers its value type from `options`**:
pass `options={[{ value: 365 }, { value: 90 }]}` and `value`, `onValueChange`'s value,
and `attrs.value` are all `number` (the same for `boolean`). Values compare with `===`,
so `365` and `"365"` stay distinct and no string conversion is needed. The exported
`OptionValue` type is `string | number | boolean`; for anything richer (a date, an
object), give `value` a **stable primitive key** (a date's ISO string, a record's id)
and read the full value back off `attrs.option`.

```tsx
// Use the ID as the value and attach the full record to the option.
<Select
  options={runs.map((r) => ({ value: r.id, label: r.name, run: r }))}
  onValueChange={(id, attrs) => { if (!('all' in attrs)) openRun(attrs.option.run) }}
/>

// Use an ISO string as the value, then convert it back to a Date in the callback.
<Select
  options={days.map((d) => ({ value: d.toISOString(), label: fmt(d) }))}
  onValueChange={(iso) => setDay(new Date(iso))}
/>
```

For an **uncontrolled** Select, omit `value` and pass `defaultValue`. For a
**controlled** Select, pass `value` and update it in `onValueChange`. The field
then shows the value supplied by the application.

**`onValueChange(value, attrs)`** is the single selection callback. The new value
comes first (a single value, or an array in `multiple` mode), with a snapshot
second: `{ value, option }` for the changed row, plus `selected` in `multiple` mode
(or `{ all: true }` for the Select-all row). There's **no `onStateChange`**: Select
has no discrete element state to veto (Checkbox and RadioGroup do), so it follows
Input's model of one value callback, and a controlled consumer rejects a pick by not
updating `value`. See the [event-model note on Input](./input.md#events) for
the rationale.

### Deriving the selection tree

The callback hands you the new value (and the one row that changed); to read the
whole selection back against your hierarchy, use **`optionsWithSelection(options,
values)`**. It returns your `options` tree with every leaf marked `selected` and
every group / submenu carrying a rolled-up `selectionState` — `'all'`, `'none'`, or
`'some'` of its descendants. It's a pure function (no `Select` instance, reads
nothing off the event), so it behaves the same controlled or uncontrolled: hand it
your current `value` and render a grouped summary, a section indicator, or a diff.

The panel on the right is that projection, re-derived on every pick. Toggle scopes and
watch the leaf checks and the section `Tag`s (`some` / `all`) update:

```tsx
import { Select, optionsWithSelection } from '@antadesign/anta'

const [values, setValues] = useState<string[]>(['repo.read', 'billing.view'])

// `values` drives the Select; the tree is derived from it and rendered read-only.
const tree = optionsWithSelection(scopes, values)
// tree: [ { label: 'Repositories', selectionState: 'some', options: [
//           { value: 'repo.read',  label: 'Read',  selected: true  },
//           { value: 'repo.write', label: 'Write', selected: false }, … ] },
//         { label: 'Members', selectionState: 'some', options: [ …,
//           { label: 'Billing', selectionState: 'all', submenu: [
//             { value: 'billing.view',   label: 'View invoices', selected: true },
//             { value: 'billing.manage', label: 'Manage plan',   selected: true } ] } ] },
//         { value: 'audit.read', label: 'Audit log', selected: false } ]

<Select selection="multiple" options={scopes} value={values} onValueChange={setValues} />
{/* render `tree` however you like — a summary, section indicators, a diff */}
```

**Don't feed the tree back into `options` to control selection.** The projection
flows one way: `value` controls the `Select`, and the tree is a derived, read-only
view of it. `Select` resolves selection purely from `value` and never reads a
`selected` flag off `options`, so a `selected: true` in the tree changes nothing — it
rides along as inert data. Control the `Select` with the value array; keep the
annotated tree for rendering.

```tsx
// ✗ Wrong — `selected` is ignored, so the Select isn't controlled by this
<Select options={optionsWithSelection(scopes, values)} />

// ✓ Right — selection is value-keyed; drive it with `value`
<Select options={scopes} value={values} onValueChange={setValues} />
```

Bare-string options normalize to `{ value, label }`; a value under more than one
section marks the leaf everywhere it occurs (selection is value-keyed).

## Size and status

```tsx
<Select label="Small · info"    size="small"  status="info"     hint="Lowercase & dashes only" options={OPTIONS} defaultValue="stream" />
<Select label="Medium · success" size="medium" status="success"  hint="Field is valid" options={OPTIONS} defaultValue="stream" />
<Select label="Large · critical" size="large"  status="critical" hint="Pick a field" options={OPTIONS} placeholder="Required…" />
{/* statusIcon overrides the per-status glyph, or `false` drops it, as on Input */}
<Select status="info" statusIcon="sparkles" hint="Custom glyph" options={OPTIONS} defaultValue="stream" />
```

The trigger is an [Input](./input.md), so it inherits the field props.
**`size`** (`small` · `medium` · `large`) sets the height and type scale.
**`status`** paints a validation tone on the border, `hint`, and chevron, and
prefixes a glyph (`info` / `success` / `warning` / `critical`); **`statusIcon`**
overrides that glyph (any shape, or `false` to drop it), as on Input. The message
rides in `hint`.

`status` is a validation *state* over the same palette as `tone`: it also carries
the glyph and, for `critical`, validity. See the
[Input status note](./input.md#status). The field also takes `label`,
`placeholder`, `round`, and `disabled`, and fills its container; set a width via
`style` / `className` (both forwarded to the field).

## Customization

Select has no `<a-select>` element. The React and Preact wrapper coordinates an
Input and a Menu. You can use the wrapper, render custom option content with
`renderOption`, replace its selection mark with `renderIndicator`, or build the
same interaction from the raw elements.

Pass `placement` to control where the options menu opens relative to its field. It
uses the same values as `Menu` and still flips or clamps when space is limited.
`offset` sets the gap in pixels between the field and the menu:

```tsx
<Select placement="top-end" offset={8} options={OPTIONS} label="Field" />
```

### Build it from elements

The wrapper renders a read-only `<Input>` and a `<Menu>`. It updates the field
and each option's `selected` state from the value, and reports a pick through
`onValueChange`. Menu handles positioning, dismissal, and keyboard navigation.

The following example shows the equivalent markup without React or Preact. Place
the Menu directly after the Input so it can use that Input as its trigger.

```html
<!-- `.select` scopes this example's CSS. Use an application selector instead. -->
<div class="select" style="width: 240px">
  <!-- Read-only field trigger; `dim-actions` dims the chevron at rest. The
       trailing slot supplies the inline inset (--input-trailing-inset); the
       transition on the chevron matches <Select>. -->
  <a-input readonly dim-actions value="stream" aria-haspopup="menu">
    <a-icon slot="trailing" shape="chevron-down" style="transition: transform 150ms ease"></a-icon>
  </a-input>
  <a-menu role="menu">
    <a-menu-item role="menuitemradio" tabindex="0" aria-checked="false" value="output_text"><a-menu-item-label>output_text</a-menu-item-label></a-menu-item>
    <a-menu-item role="menuitemradio" tabindex="0" aria-checked="true" value="stream" selected><a-menu-item-label>stream</a-menu-item-label></a-menu-item>
    <a-menu-item role="menuitemradio" tabindex="0" aria-checked="false" value="container"><a-menu-item-label>container</a-menu-item-label></a-menu-item>
  </a-menu>
</div>
<script type="module">
  import '@antadesign/anta/elements'
  const root = document.querySelector('.select')
  const field = root.querySelector('a-input')
  const menu = root.querySelector('a-menu')
  const chevron = field.querySelector('a-icon')
  // Flip the chevron with the menu's open state (as <Select> does).
  menu.addEventListener('statechange', (e) => {
    chevron.style.transform = e.detail.next === 'open' ? 'rotate(180deg)' : ''
  })
  // On pick: mark the row selected + reflect its label into the field.
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('a-menu-item')
    if (!item) return
    menu.querySelectorAll('a-menu-item').forEach((el) => {
      const selected = el === item
      el.toggleAttribute('selected', selected)
      el.setAttribute('aria-checked', String(selected))
    })
    field.value = item.querySelector('a-menu-item-label').textContent
  })
</script>
```

The React and Preact `Select` wrapper performs those updates for you.

### Custom option rendering

```tsx
const TONE = { in_progress: 'info', completed: 'neutral', incomplete: 'critical' }
const LABEL = { in_progress: 'In progress', completed: 'Completed', incomplete: 'Incomplete' }

// The field fills its container, so the wrapper's width bounds the trigger.
// (<Select style={{ width: 260 }} …> works too; style forwards to the field.)
<div style={{ width: 260 }}>
  <Select
    label="Test run"
    filter                                     // name / date stay searchable
    options={runs}                             // { value, label, name, ranAt, status }[]
    value={run}
    onValueChange={setRun}
    renderOption={(option) => {
      const run = option as Run                 // index-signature fields are `unknown`
      return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 2 }}>
          {/* The ellipsized name is the anchor; the nested Tooltip (its children are the
              bubble) reveals the full name when the name is clipped. */}
          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {run.name}
            <Tooltip truncatedOnly>{run.name}</Tooltip>
          </span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-3)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{run.ranAt}</span>
            <Tag size="small" tone={TONE[run.status]} style={{ marginInlineStart: 'auto' }}>{LABEL[run.status]}</Tag>
          </div>
        </div>
      )
    }}
  />
</div>
```

**`renderOption(option, state)`** replaces the built-in `label`, `hint`, and
`icon` layout for a row. Select still renders the row container, click behavior,
ARIA attributes, and selection indicator. Set each option's `label` for the
closed field text.

Attach your own fields to each option (`SelectOption` carries an index signature) and
read them back off `option`; those extra fields are typed `unknown`, so cast once at
the top. `state` gives you `value` / `selected` / `disabled` for the row. Give your
root `flex: 1; min-width: 0` so it fills the row (an inner `margin-inline-start: auto`
right-aligns a trailing element, like the status `Tag` here).

`filter` still matches the option's `value`, `label`, and `hint`. Select does
not highlight matches in custom content because it cannot identify text within
the returned node. `indicator` and `selection` still provide the selection mark.
Use `renderIndicator` to replace that mark too; see
[Custom indicators](#custom-indicators).

### Limiting the width

```tsx
// Same ellipsis-ready row for both; it truncates once the menu is capped.
const renderPath = (o) => (
  <span style={{ display: 'block', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
    {o.label}
    <Tooltip truncatedOnly>{o.label}</Tooltip>   {/* reveals the full path when clipped */}
  </span>
)

// First: no cap, so the widest row stretches the menu past the trigger.
<div style={{ width: 220 }}>
  <Select label="No cap · grows to fit" options={paths} value={a} onValueChange={setA} renderOption={renderPath} />
</div>

// Second: cap the popover so the same rows truncate to the trigger width.
<style>{`.path-capped a-menu::part(menu) { max-width: 220px }`}</style>
<div className="path-capped" style={{ width: 220 }}>
  <Select label="Capped · ellipsizes" options={paths} value={b} onValueChange={setB} renderOption={renderPath} />
</div>
```

A menu **grows to fit its widest row**. The trigger width sets the floor; the
viewport sets the ceiling. Built-in `label`s stay bounded (they wrap), but **custom
`renderOption` content does whatever your CSS says**, so wide content stretches the
whole menu. Open both dropdowns: same rows, yet the first grows past its 220px field
while the second (capped) stays put and ellipsizes.

Enforce the limit on the **menu**: cap it with **`::part(menu) { max-width }`**. Only
then does ellipsis-ready content truncate, so give the row a shrinkable box
(`min-width: 0`) and single-line ellipsis (`overflow: hidden; text-overflow:
ellipsis; white-space: nowrap`). Nest a **`Tooltip truncatedOnly`** in that element
to reveal the full text on hover, only when it's clipped. `min-width: 0` alone won't
bound it: a shrink-to-fit popover grows to its content's max-content width, so the
cap is what does the work.

### Custom indicators

```tsx
<Select
  label="Log level"
  indicator="check"                     // keeps the semantics (role + aria-checked)
  options={levels}                       // { value, label, dot }[]
  value={level}
  onValueChange={setLevel}
  renderIndicator={(state) => {
    const dot = levels.find((l) => l.value === state.value).dot
    return (
      <span style={{
        width: 10, height: 10, borderRadius: '50%', display: 'inline-block',
        boxShadow: `inset 0 0 0 2px ${dot}`,
        background: state.selected ? dot : 'transparent',
      }} />
    )
  }}
/>
```

**`renderIndicator(state)`** replaces the row's selection **mark** with your own
node, drawn at the **leading** edge. The row stays the control: keep an `indicator`
(`'check'` / `'radio'`) or `selection="multiple"` for the `role` + `aria-checked`
semantics, and only the drawn glyph changes. `state` gives you `value` / `selected` /
`disabled`, so the mark can reflect selection (here, an outline ring that fills when
chosen). It composes with `renderOption`, so you can override the content, the mark,
both, or neither.

### Selection summary

```tsx
const teams = ['Engineering', 'Design', 'Operations', 'Sales', 'Support']
const [a, setA] = useState(['eng', 'design', 'ops'])
const [b, setB] = useState(['eng', 'design'])

// verbose: the count summary lists the picks
<Select selection="multiple" placeholder="Pick teams" options={teams} value={a} onValueChange={setA} verbose />

// renderSummary: build the text yourself
<Select
  selection="multiple"
  placeholder="Pick teams"
  options={teams}
  value={b}
  onValueChange={setB}
  // one label; a count past that; every option → "All teams"
  renderSummary={(selected) =>
    selected.length === teams.length
      ? 'All teams'
      : selected.length > 1
        ? `${selected.length} teams`
        : undefined // fall back to the single label
  }
/>
```

**`renderSummary(selected)`** builds the multi-select field text in place of the
built-in "`All` / one label / `N selected`". It runs while something is selected — an
empty selection still shows the `placeholder` — and takes the resolved `selected`
options (`selected.length` is the count). Return `undefined` for any case you'd rather
leave to the default, as above for the single-label case.

Return a **string**: it flows into the same read-only field the default uses, so a
long summary **ellipsizes at the field's width** the way a long value does
(`Engineering, Design, … `). For rich content — chips, several nodes — reach for
`renderTrigger` below, which replaces the whole field.

For the common case of just listing the picks, skip `renderSummary` and pass
**`verbose`**: the count summary becomes `3 selected: A, B, C` (labels comma-joined),
ellipsizing at the field width like any long value. `renderSummary` overrides it.

### Custom trigger

```tsx
const [value, setValue] = useState(['stream', 'message'])

<Select
  selection="multiple"
  options={fields}
  value={value}
  onValueChange={setValue}
  renderTrigger={({ open, selected }) => (
    // Return one focusable element. It supplies the required ARIA attributes.
    <Button icon="filter" label="Filter" priority="secondary"
      aria-haspopup="menu" aria-expanded={open ? 'true' : 'false'}>
      {selected.length > 0 && (
        <Tag size="small" priority="primary" tone="brand">
          {selected.length === fields.length ? 'All' : selected.length}
        </Tag>
      )}
    </Button>
  )}
/>
```

```tsx
const columns = ['Name', 'Status', 'Owner', 'Created', 'Duration', 'Environment', 'Branch', 'Commit']
const [hidden, setHidden] = useState([])

<Select
  selection="multiple"
  options={columns}
  value={hidden}
  onValueChange={setHidden}
  // selecting a column hides it: eye by default, eye-closed once hidden
  renderIndicator={({ selected }) => (
    <Icon shape={selected ? 'eye-closed' : 'eye'} />
  )}
  renderTrigger={({ open, selected }) => (
    <Button icon="columns-3-cog" priority="tertiary" aria-label="Configure columns"
      aria-haspopup="menu" aria-expanded={open ? 'true' : 'false'}>
      {selected.length > 0 && (
        <Tag size="small" priority="secondary" tone="neutral">{selected.length}</Tag>
      )}
    </Button>
  )}
/>
```

**`renderTrigger(state)`** replaces the default field. Return exactly one
focusable element, such as the Anta `Button` in this example. Select positions
the menu relative to that element and opens it when it is clicked. A fragment,
multiple sibling elements, or a non-focusable wrapper prevents Select from finding
the trigger. It logs a console warning when that happens. Add
`aria-haspopup="menu"` and `aria-expanded={state.open}` to the element.

`state` includes `open`, `value`, `selected`, `disabled`, and `icon`. `selected`
is the resolved option list, so `selected.length` is the multi-select count. The
default field props, including `label`, `size`, and `status`, do not apply to a
custom trigger. `state.icon` contains the Select `icon` prop so the replacement
trigger can display the same icon.

The second example uses a custom trigger and `renderIndicator` for a **column
visibility** control. The options are column names. In this example, a selected
option means that its column is hidden: the indicator changes from `eye` to
`eye-closed`. The Tag uses `selected.length`, so it appears only after a column
is hidden.

### Empty state

```tsx
const [options, setOptions] = useState(['bug', 'feature', 'chore', 'docs'])
const [value, setValue] = useState()
const [loading, setLoading] = useState(false) // application fetch state

<Select
  label="Tag"
  filter
  placeholder="Filter or create…"
  options={loading ? [] : options}
  value={value}
  onValueChange={setValue}
  renderEmpty={({ query }) =>
    loading ? (
      <MenuSeparator>Loading…</MenuSeparator>
    ) : (
      <>
        <MenuSeparator>No options are matching the filter</MenuSeparator>
        <MenuItem
          icon="plus"
          label={`Create "${query}"`}
          onSelect={() => { setOptions((o) => [...o, query]); setValue(query) }}
        />
      </>
    )
  }
/>
```

**`renderEmpty({ query })`** renders content when the option list is empty after
filtering. It can return a "No results" message, a loading indicator, or a row
that creates an option from `query`. A non-empty `query` means that filtering
removed every option; an empty `query` means that no options were supplied.

Select has no built-in empty message. If `renderEmpty` is omitted, an empty list
has no content. Loading also belongs to application state, so return a
`'Loading…'` branch when that state is true.

The returned content replaces the option rows. A `MenuSeparator` with text is a
muted caption and an `aria-live="polite"` region. Return a `MenuItem`, such as
the `Create "…"` row, when the content must be selectable by keyboard.

### Groups and submenus

```tsx
// The same tree drives both modes — selection is global, so `selection` is the
// only difference between the two selects below.
const fields = [
  'output_text',                                         // a plain option
  { label: 'Log', options: ['stream', 'message'] },      // an inline group
  {
    label: 'Metadata',                                   // a submenu (flyout)
    icon: 'braces',
    submenu: [
      'metadata.host',
      { label: 'Tags', options: ['tag.env', 'tag.team'] }, // group inside submenu
      { label: 'Custom', submenu: ['custom.a', 'custom.b'] }, // submenu inside submenu
    ],
  },
  { label: 'Time', submenu: ['vtime'], disabled: true }, // disabled → cascades
]

<Select label="Field · single" filter options={fields} value={one} onValueChange={setOne} />

<Select label="Fields · multiple" selection="multiple" filter options={fields} value={many} onValueChange={setMany} />
```

An `options` entry is a plain option, a **group** (`{ label, options }`, an inline
titled section), or a **submenu** (`{ label, submenu }`, a flyout). They nest and mix
freely. Discriminated by shape — an `options` array is a group, a `submenu` array is a
submenu, everything else is an option (so those two keys are reserved on an option).

**Selection stays global.** The Select's `selection` (single / multiple) applies to
every leaf wherever it sits; group headings and submenu parents organize but aren't
selectable. One `value`, one `onValueChange`, one count — unchanged. The two selects
above share the exact same `fields` tree and differ only by `selection`. `disabled` on
a group or submenu cascades to all its descendants. Because selection is global, a
leaf's `value` must be **unique across the whole tree** — the same value under two
sections is one pick (dev builds warn).

**A query flattens the tree.** With `filter`, typing collapses submenus into inline
groups (their label becomes the heading) and drops empty ones, so results read as one
scannable list instead of hiding matches behind flyouts.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | SelectItem[] | — | The options to choose from — bare strings, `SelectOption` objects, `SelectGroup`s
 (inline titled sections), or `SelectSubmenu`s (flyout branches). Groups and
 submenus nest and mix with plain options. Selection stays global (one `value`,
 leaf options only); a filter query flattens the tree into grouped results.

 `Select` infers its value type `V` from these options: `{ value: 365 }` makes
 `onValueChange` report `number`. A mix of value types widens `V` to the union.

 Each leaf `value` is the option's identity and must be **unique across the whole
 tree** (selection is value-keyed, so a value repeated in two sections is one logical
 pick: both rows toggle together, the trigger resolves to the last). Values that
 stringify alike (`365` and `"365"`) also collide as row keys; dev builds
 `console.warn` on either. |
| `clearable?` | boolean | — | Add a "Clear" row pinned in the menu **footer** that empties the selection
 (single → none, multiple → `[]`). Shown only while something is selected, so
 it never scrolls away in a long or filtered list. |
| `clearLabel?` | string | Clear | Label for the `clearable` footer row. |
| `defaultValue?` | V \| V[] | — | Initial selected option value for uncontrolled use. |
| `disabled?` | boolean | — | Disable the whole select. |
| `filter?` | boolean \| (option, query) => boolean | — | Add a search field at the top of the menu that filters the options as you
 type. `true` uses the built-in matcher — a case-insensitive substring of the
 option's **value / label / hint**. Pass a **function** `(option, query) =>
 boolean` for custom matching (called per option; return `true` to keep it). |
| `hint?` | string | — | Helper text under the field (Input's `hint`). |
| `icon?` | IconShape | — | Leading icon shown at the left of the field (the default trigger's `Input`
 `leading` slot). With a custom `renderTrigger`, it's passed through as
 `state.icon` instead — the consumer places it. |
| `indicator?` | 'none' \| 'check' \| 'radio' | none | The per-row mark for **single**-select: `'none'` (a tint-only highlight),
 `'check'` (a trailing checkmark on the selected row, keeping the tint — the
 canonical Select look), or `'radio'` (a leading radio on every row).
 Multi-select always uses checkboxes. |
| `label?` | string | — | Field label, above the trigger (Input's `label`). |
| `leading?` | ReactNode | — | Content for the default trigger's `leading` slot, such as a key prefix
 before the value. It replaces the icon derived from `icon`. Include an
 `<Icon>` in this content when both are needed. Ignored by `renderTrigger`. |
| `offset?` | number | 4 | Gap in pixels between the trigger and the options menu. |
| `onValueChange?` | (value, attrs) => void | — | Fires after the selection changes, with the new value and a
 `{ value, option }` snapshot. Select has no discrete element state, so
 there is no cancelable `onStateChange` (see the Input event-model note). |
| `placeholder?` | string | — | Text shown when nothing is selected. |
| `placement?` | 'left' \| 'right' \| 'bottom' \| 'top' \| 'bottom-start' \| 'bottom-end' \| 'top-start' \| 'top-end' \| 'right-start' \| 'right-end' \| 'left-start' \| 'left-end' | bottom-start | Preferred placement of the options menu relative to the trigger. The menu
 auto-flips vertically and clamps horizontally when needed. |
| `renderEmpty?` | (state) => ReactNode | — | Render content in the menu body when the (filtered) option list is empty —
 a "no results" message, a loading indicator (gated on your own external
 loading state), or a "create from the query" row. Receives an `EmptyState`
 (`query`, trimmed). There is no built-in empty message: when omitted, an empty
 list renders nothing. Whatever you return goes where the option rows would —
 a plain node is inert; return a `MenuItem` (e.g. a "Create" row) to make it
 focusable and selectable. |
| `renderIndicator?` | (state) => ReactNode | — | Replace each row's selection **mark** with your own node, drawn at the
 leading edge. The row stays the control (`role` + `aria-checked` from
 `indicator` / `selection`); only the drawn mark changes, so pair it with an
 `indicator` (`'check'` / `'radio'`) or `selection="multiple"` for the
 semantics. Composes with `renderOption`. |
| `renderOption?` | (option, state) => ReactNode | — | Replaces the built-in `label`, `hint`, and `icon` layout for each option row.
 Select still supplies the row container, click handling, ARIA attributes, and
 selection indicator. Read extra option fields through `SelectOption`'s index
 signature. `state` contains `value`, `selected`, and `disabled`. Filtering
 still matches the option's `value`, `label`, and `hint`, but Select cannot
 highlight matches within the returned content. |
| `renderSummary?` | (selected) => string \| undefined | — | `multiple` only: build the trigger's selection summary text yourself,
 replacing the built-in "`All` / one label / `N selected`" logic. Receives
 the resolved selected options (`selected.length` is the count) and runs only
 while something is selected — an empty selection still shows the
 `placeholder`. Return a **string**: it flows into the default trigger's
 read-only field, so a long summary ellipsizes at the field's width just
 like a long value (`Engineering, Design, … `). Return `undefined` to fall
 back to the default for that case (e.g. customize only the count, keeping
 the single-label case built-in). For rich content (chips, multiple nodes)
 use `renderTrigger`, which replaces the whole field. |
| `renderTrigger?` | (state) => ReactNode | — | Replaces the default field with a trigger returned from this function.
 Receives `open`, `value`, `selected`, `disabled`, and `icon`. Return exactly
 one focusable element, such as an Anta `Button`. The menu is positioned
 relative to that element and opens when it is clicked. Do not return a
 fragment, multiple siblings, or a non-focusable wrapper. Add
 `aria-haspopup="menu"` and `aria-expanded={state.open}` to the element.
 Field props (`label`, `hint`, `size`, `status`, `placeholder`, and `round`) and
 `className` / `style` apply only to the default field. Add styling and
 attributes to the returned element instead. |
| `round?` | boolean \| number \| string | — | Round the field corners — `true` for fully round, or a number / CSS length. |
| `selectAll?` | boolean | true | `multiple` only: shows a "Select all" row that toggles every enabled option,
 or only the visible options when a filter query is active. Its checkbox is
 mixed when some options are selected. It is on by default. Set it to `false`
 to remove the row and the Alt/Option-click shortcut that selects only one row. |
| `selectAllLabel?` | string | Select all | Label for the `selectAll` row. |
| `selection?` | 'single' \| 'multiple' | single | Selection mode. `'single'` (the default) keeps `value` a single value and
 closes the menu on pick. Switch to `'multiple'` for checkboxes + an
 array value. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Field size. |
| `status?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' | neutral | Validation/feedback tone for the field (Input's `status`). |
| `statusIcon?` | (string & {}) \| false \| IconShape | — | Glyph shown before the `hint` when `status` is set (Input's `statusIcon`).
 Each status has a default; pass a shape to override, or `false` to drop it. |
| `toneSelected?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | — | Tone applied to the **selected** row(s) — the whole row takes this tone
 (label, icon, indicator, and the background tint), like passing `tone` to just
 the chosen option. A named tone or a custom CSS color. Most visible with the
 tint-based marks (`indicator` `'none'` / `'check'`); with `'radio'` /
 `'checkbox'` it tones the label + indicator (those modes have no row tint). |
| `value?` | V \| V[] | — | Controlled value: the selected option's `value`. Update it through
 `onValueChange`. Leave it undefined for uncontrolled use. |
| `verbose?` | boolean | — | `multiple` only: spell the picks out in the count summary — `3 selected:
 A, B, C` (labels comma-joined) in place of the bare `3 selected`. Applies
 to the multi-count case only: `All` stays `All`, a single pick stays its
 own label, and an empty selection stays the `placeholder`. The list flows
 into the read-only field, so it ellipsizes at the field's width when long
 (`3 selected: Engineering, Des… `). `renderSummary` overrides this. |

### The `SelectItem` type

`options` takes a `SelectItem[]`. Each entry is one of four shapes, discriminated by
its keys — an `options` array is a group, a `submenu` array is a submenu, and a bare
string or a plain object is a single option:

| Shape | Renders as |
|---|---|
| `string` | One option; shorthand for `{ value: s, label: s }`. |
| `SelectOption` | One option with a label, hint, icon, tone, tooltip, or your own fields. |
| `SelectGroup` | A titled group of items, **inline** under a heading. |
| `SelectSubmenu` | A titled branch of items behind a **flyout**. |

`value` is unique across the whole tree — selection is value-keyed and global, so a
group or submenu only organizes (its heading isn't selectable), and a `disabled`
group or submenu cascades to every descendant.

The smallest form is three options, each carrying only a `value` (a bare string is
the same thing):

```tsx
<Select
  label="Priority"
  options={[
    { value: 'low' },
    { value: 'medium' },
    { value: 'high' },
  ]}
/>
// equivalent: options={['low', 'medium', 'high']}
```

**`SelectOption`** — one selectable row.

| Field | Type | Description |
|---|---|---|
| `value` | `OptionValue` | The option's identity: `string`, `number`, or `boolean` (`Select` infers the type from your `options`, compared with `===`). What `value` / `defaultValue` name and `onValueChange` reports. Required, unique across the tree. See [Value and changes](#value-and-changes) for non-string values and rich data. |
| `label` | `string` | Visible label. Defaults to `value`. |
| `hint` | `string` | Secondary line under the label. |
| `icon` | `IconShape` | Leading icon, after the selection indicator. |
| `disabled` | `boolean` | Disable just this option. |
| `tone` | `string` | The row's color across label, icon, hint, selected tint, and indicator. A named tone (`neutral` / `brand` / `info` / `success` / `warning` / `critical`) or any CSS color. |
| `tooltip` | `React.ReactNode` | Row tooltip. In a `multiple` select with `selectAll`, a row with no `tooltip` shows the default "select only this" (Alt/⌥-click) hint; set it to override, or `''` to suppress. |
| `[key: string]` | `unknown` | Your own data — attach anything and read it back in `renderOption`. |

**`SelectGroup`** — a heading with items rendered inline beneath it.

| Field | Type | Description |
|---|---|---|
| `label` | `string` | The section heading (non-interactive). |
| `options` | `SelectItem[]` | The grouped items — options, or nested groups / submenus. |
| `disabled` | `boolean` | Disable the whole group (cascades to all descendants). |

**`SelectSubmenu`** — a parent row whose items live behind a flyout.

| Field | Type | Description |
|---|---|---|
| `label` | `string` | The parent row's label, and the group heading when a filter query flattens the tree. |
| `icon` | `IconShape` | Leading icon on the parent row. |
| `submenu` | `SelectItem[]` | The branch's items — options, or nested groups / submenus. |
| `disabled` | `boolean` | Disable the whole branch (cascades to all descendants). |

All four shapes mix in one `options` array — a bare string, a full `SelectOption`, an
inline `SelectGroup`, and a flyout `SelectSubmenu` (whose items are themselves
`SelectItem`s, so groups and submenus nest freely):

```tsx
<Select
  label="Field"
  options={[
    'output_text',                                             // string shorthand
    { value: 'stream', label: 'Stream', hint: 'Log level', icon: 'braces' }, // SelectOption
    {                                                          // SelectGroup — inline heading
      label: 'Metadata',
      options: [
        { value: 'container', icon: 'cube' },
        { value: 'file_path', icon: 'file' },
      ],
    },
    {                                                          // SelectSubmenu — flyout branch
      label: 'Advanced',
      icon: 'folder-close',
      submenu: [
        'raw_bytes',
        { value: 'custom', hint: 'Your own field path', icon: 'asterisk', disabled: true },
      ],
    },
  ]}
/>
```

Use the web component directly when you are not using React or Preact and a native control does not fit.

`Select` has no host element. Compose a read-only `<a-input>` trigger with an
`<a-menu>` of options. The menu owns opening and dismissal; the short controller
reflects a picked option into the field and selected row.

```html
<div data-anta-composition="select" style="display: grid; gap: 4px; width: 280px">
  <a-input readonly value="stream">
    <span slot="label">Output</span>
    <span slot="trailing"><a-icon shape="chevron-down" aria-hidden="true"></a-icon></span>
  </a-input>
  <a-menu role="menu">
    <a-menu-item role="menuitem" tabindex="0" value="output_text"><a-menu-item-label>output_text</a-menu-item-label></a-menu-item>
    <a-menu-item role="menuitem" tabindex="0" value="stream" selected><a-menu-item-label>stream</a-menu-item-label></a-menu-item>
  </a-menu>
</div>
<script type="module">
  import '@antadesign/anta/elements'

  const root = document.querySelector('[data-anta-composition="select"]')
  const field = root.querySelector('a-input')
  const menu = root.querySelector('a-menu')

  menu.addEventListener('click', (event) => {
    const item = event.target instanceof Element ? event.target.closest('a-menu-item') : null
    if (!item || item.closest('a-menu') !== menu) return
    menu.querySelectorAll(':scope > a-menu-item').forEach((option) => {
      const selected = option === item
      option.toggleAttribute('selected', selected)
    })
    field.value = item.querySelector('a-menu-item-label').textContent.trim()
  })
</script>
```

### Native HTML select

When a native single-value select is enough, add `data-anta` to `<select>`. The
modern customizable-select model keeps native selection, keyboard behavior, and
form submission while exposing its trigger `button`, `selectedcontent`, options,
and optgroups for styling. Anta styles every supported part; browsers without that
model retain their regular native select. Use `Select` for filtering, multiple
selection, nested menus, or custom option coordination.

Use `data-anta-size="small"` or `"large"` for the field size. Native selects
continue to use their standard `size` attribute, and `round` gives the trigger matching rounded
corners.

```html
<select data-anta data-anta-size="small" round name="output">
  <!-- The native trigger; selectedcontent mirrors the chosen option. -->
  <button>
    <selectedcontent></selectedcontent>
    <a-icon shape="chevron-down" aria-hidden="true"></a-icon>
  </button>

  <option value="" selected disabled>Choose an output</option>
  <option value="stream">Stream</option>
  <option value="output_text">Output text</option>
  <optgroup label="Metadata">
    <option value="container">Container</option>
    <option value="file_path">File path</option>
  </optgroup>
</select>
```

Select is an [Input](./input.md) plus a [Menu](./menu.md), so it
inherits both surfaces' hooks. Reach for props first, then plain CSS or `::part` for
the rest. Don't override an element's internal `--*` output tokens.

**Selection color** routes through the props: a per-option `tone`, or `toneSelected`
for the chosen row(s). Both take a named tone or any CSS color (a custom color keeps
its hue, with lightness pinned to the brand text).

**The field** is styled through Input's props (`size`, `status`, `round`) and its
`::part`s; set its width with `style` / `className` (forwarded to the field). **The
popover** takes Menu's `::part(menu)`.

```tsx
// Tone the selection; give the trigger a width.
<Select toneSelected="brand" style={{ width: '220px' }} options={OPTIONS} />
```

**Borderless trigger.** The field's border is an inset `box-shadow`, so you can drop
it *at rest* and let the standard hover / focus shadow return on its own; no need to
re-declare it. Pair that with hiding the chevron for a field that reads as plain text
until you reach for it. Hide the chevron by targeting the trailing `a-icon` (its slot
wrapper is inline-`display:contents`, so hit the icon itself).

```css
/* Drop the resting border-shadow; the standard hover / focus shadow still shows. */
.ghost-select a-input:not(:hover):not(:focus-within)::part(field) {
  box-shadow: none;
}
/* Center the chosen label in the field. */
.ghost-select a-input::part(input) { text-align: center; }
/* The chevron's slot wrapper is inline display:contents; hide the icon itself. */
.ghost-select a-input [slot="trailing"] a-icon { display: none; }
```
