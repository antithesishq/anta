# Select

`Select` lets people choose one or more options from a dropdown. Use it to
choose a setting, filter a view, or configure a list. Add search for longer
lists, and use groups or submenus to organize related options.

Give the field a visible `label`. If you omit it, provide `aria-label` or
`aria-labelledby` so people using assistive technology can identify the control.
Include any meaningful prefix in that name; leading content and the chevron
are decorative.

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

Use strings for a simple list, or option objects when people need more context.
Add a `label` for a readable name, a `hint` for supporting information, or an
`icon` to help distinguish choices. Use `tone` to communicate a meaningful
status alongside the text.

Set `disabled` on an unavailable option to keep it visible without allowing
selection. Disabled options are also skipped during keyboard navigation.

### Groups and submenus

```tsx
// The same tree drives both modes — selection is global, so `selection` is the
// only difference between the two selects below.
const [one, setOne] = useState('stream')
const [many, setMany] = useState(['stream', 'tag.env'])
const fields = [
  'output_text',                                         // a plain option
  { label: 'Log', options: ['stream', 'message', 'severity'] }, // an inline group
  {
    label: 'Metadata',                                   // a submenu (flyout)
    icon: 'braces',
    submenu: [
      'metadata.host',
      'metadata.region',
      { label: 'Tags', options: ['tag.env', 'tag.team'] }, // group inside submenu
      { label: 'Custom', submenu: ['custom.a', 'custom.b'] }, // submenu inside submenu
    ],
  },
  { label: 'Time', submenu: ['vtime', 'wall_clock'], disabled: true }, // disabled → cascades
]

<Select label="Field · single" filter options={fields} value={one} onValueChange={setOne} />

<Select label="Fields · multiple" selection="multiple" filter options={fields} value={many} onValueChange={setMany} />
```

Use groups to divide a list into named sections. Use submenus when a category
needs a separate list of choices. Both can contain further groups or submenus.

The examples use the same options with single and multiple selection. Group
headings and submenu parents organize the choices; only their options are
selectable. Keep option values unique across the whole tree. Disabling a group
or submenu disables its descendants.

When someone searches, matching options appear together in a flat list with
group headings. They can find a match without opening each submenu.

## Selection modes

```tsx
const options = ['output_text', 'stream', 'container', 'vtime', 'custom']
const [check, setCheck] = useState('stream')
const [radio, setRadio] = useState('stream')
const [many, setMany] = useState(['stream', 'container'])

<Select label="Checkmark · brand tone" indicator="check" tone="brand"
  toneScope="selected" options={options} value={check} onValueChange={setCheck} />

<Select label="Radio · custom tone" indicator="radio" tone="#c026d3"
  toneScope="selected" options={options} value={radio} onValueChange={setRadio} />

<Select label="Multiple · brand tone" selection="multiple" tone="brand"
  toneScope="selected" placeholder="Select fields…"
  options={options} value={many} onValueChange={setMany} />
```

Use single selection when someone must choose one option, such as a default
field. Choosing an option closes the menu. Use `selection="multiple"` for a
set of choices, such as the fields shown in a table. The menu stays open so
people can continue selecting.

Multiple selection shows checkboxes and summarizes the chosen options in the
field. Use `verbose` to list their labels or customize the
[selection summary](#selection-summary).

### Indicators and selection colors

For single selection, choose the mark that suits the list: `indicator="none"`
highlights the chosen row, `"check"` adds a checkmark, and `"radio"` shows a
radio indicator beside every option. Multiple selection always uses checkboxes.

Use `tone` with `toneScope="selected"` to give chosen options a shared color.
Named tones and custom CSS colors are supported. Tint-based indicators color
the row background; radio and checkbox indicators color the text and mark.

### Select all and selection shortcuts

Multiple selection includes a **Select all** row. It selects or clears enabled
options and shows a mixed checkbox when only some are selected. With an active
search, it affects only matching options. Set `selectAll={false}` to remove it.

Alt-click an option to select it and clear every other choice. On macOS, use
Option instead of Alt. The default row tooltip explains
this shortcut. Set an option's `tooltip` to replace the hint, or to `''` to hide
it. The shortcut is available only while `selectAll` is enabled.

<a id="filter"></a>

## Filtering options

```tsx
const options = [
  { value: 'output_text', hint: 'Raw log message or event payload' },
  { value: 'stream', hint: 'Log level: error · info · internal' },
  { value: 'container', hint: 'Host where the event occurred' },
  { value: 'vtime', hint: 'Simulation time in seconds' },
  { value: 'source', hint: 'Emitting system or process' },
  { value: 'message', hint: 'Assertion description' },
  { value: 'condition', hint: 'Passing or failing' },
  { value: 'fault', hint: 'Injected fault type and name' },
]
const [one, setOne] = useState('stream')
const [many, setMany] = useState(['stream'])

<Select label="Single · filter" filter indicator="check"
  options={options} value={one} onValueChange={setOne} />

<Select label="Multiple · filter" filter selection="multiple"
  placeholder="Fields…" options={options} value={many} onValueChange={setMany} />
```

For prefix matching instead of the built-in search:

```tsx
<Select label="Field" options={options}
  filter={(option, query) => String(option.value).startsWith(query)} />
```

Add `filter` when people need to find an option in a longer list. Search matches
option values, labels, and hints without requiring the same capitalization.
Matching text is highlighted in the built-in option layout.

Pass a function to `filter` when your application needs different matching rules.
Custom matching does not highlight text. Use `renderEmpty` to explain when no
options match; see [Empty and loading states](#empty-and-loading-states).

### Keyboard interaction

Opening a searchable Select focuses the search field. Press ↑ or
↓ to move through matching options, then Enter to select
the active option. Focus stays in the search field while you navigate.

The search field stays visible while results scroll. Press Esc or
select outside the popup to dismiss it. Closing the popup resets the query.

<a id="value-and-changes"></a>

## Managing the value

```tsx
const [field, setField] = useState('stream')

<Select
  label="Field"
  options={['output_text', 'stream', 'container', 'vtime', 'custom']}
  value={field}
  onValueChange={(v) => setField(v)}
/>
```

Pass `value` and update it in `onValueChange` when your application manages the
selection. For a Select that manages its own selection, omit `value` and pass
`defaultValue` to choose an initial option.

Single selection uses one option value. Multiple selection uses an array of
values. Keep each option's value unique across groups and submenus.

Values can be strings, numbers, or booleans. Select preserves their types, so a
numeric ID can remain a number in your application state. Use a stable primitive
key for richer data, and attach the record to its option when you need it in a
callback:

```tsx
<Select
  label="Run"
  options={runs.map((run) => ({ value: run.id, label: run.name, run }))}
  onValueChange={(id, attrs) => {
    if (!('all' in attrs)) openRun(attrs.option.run)
  }}
/>
```

For dates, use an ISO string as the option value and convert it back in the
callback. The API reference describes the additional change information passed
to `onValueChange`.

<a id="deriving-the-selection-tree"></a>

### Building a grouped selection summary

Use `optionsWithSelection(options, values)` to build a grouped summary or show
how much of each section is selected. It returns your options tree annotated
with selected leaves and each group's `selectionState`: `all`, `some`, or `none`.

The example displays a summary alongside the Select. Choose permissions and
watch the section indicators update.

```tsx
import { Select, optionsWithSelection } from '@antadesign/anta'

const [values, setValues] = useState<string[]>(['repo.read', 'billing.view', 'billing.manage'])

// `values` drives the Select; the tree is derived from it and rendered read-only.
const tree = optionsWithSelection(scopes, values)

<Select label="Scopes" selection="multiple" filter placeholder="Select scopes…"
  options={scopes} value={values} onValueChange={setValues} />
{/* render `tree` however you like — a summary, section indicators, a diff */}
```

Keep `value` as the source of selection. The annotated tree is a derived view
for rendering; passing it back as `options` does not control which rows are
selected.

## Size and status

```tsx
<Select label="Small · info"    size="small"  status="info"     hint="Lowercase & dashes only" options={OPTIONS} defaultValue="stream" />
<Select label="Medium · success" size="medium" status="success"  hint="Field is valid" options={OPTIONS} defaultValue="stream" />
<Select label="Large · critical" size="large"  status="critical" hint="Pick a field" options={OPTIONS} placeholder="Required…" />
{/* statusIcon overrides the per-status glyph, or `false` drops it, as on Input */}
<Select label="Small · custom icon" size="small" status="info" statusIcon="sparkles" hint="statusIcon override" options={OPTIONS} defaultValue="stream" />
```

Choose `size` to fit the surrounding controls. Use `status` and a helpful `hint`
to explain validation or feedback. `statusIcon` lets you replace the status icon
or hide it with `false`.

A `critical` status also marks the control as invalid for assistive technology.
Use `disabled` when the whole Select is unavailable.

### Using Select in forms

Select reports choices through `onValueChange`. It does not submit a form value
or block submission. Include the selected value in your application's form
handling, and validate it before accepting the submission.

<a id="build-it-from-elements"></a>

## Customization

Customize the option content, selection indicators, summary, or trigger to suit
the task. Select coordinates an [Input](./input.md) field and a [Menu](./menu.md):
Input provides the field, label, and hint; Menu provides positioning, dismissal,
and keyboard navigation. Select keeps their displayed selection in sync with
the value.

Use `placement` when the menu should open on a particular side of the trigger.
It adjusts to the available space. Set `offset` to change the gap:

```tsx
<Select placement="top-end" offset={8} options={OPTIONS} label="Field" />
```

For field and menu appearance, use the supported hooks in [Styling](#styling).

<a id="custom-option-rendering"></a>

### Custom option content

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

Use `renderOption` when people need richer context to choose an option, such
as a run's status and time. Attach that information to each option and render
it beside the label. Keep `label` meaningful because it becomes the closed
field's text and remains searchable.

Select provides the selectable row, keyboard behavior, accessible attributes,
and selection indicator. Your renderer supplies the content. Give its root
`flex: 1` and `min-width: 0` so it can fill and shrink within the row.

Search still uses the option's value, label, and hint. Custom content is not
highlighted automatically. To replace the selection mark as well, use
[Custom indicators](#custom-indicators).

<a id="limiting-the-width"></a>

### Menu width and long labels

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

Cap the menu width when long option content should stay within a compact
layout. The examples show the same paths: one menu grows to fit them, while the
other stays within the field's width and truncates the labels.

Set `max-width` on the menu's `::part(menu)`. Give custom row content
`min-width: 0` and the single-line ellipsis styles shown in the recipe.
Both are needed: shrinkable text alone does not limit the menu's width.

Use `Tooltip truncatedOnly` to reveal a full label when it has been clipped.
Built-in labels wrap; this recipe is for custom single-line content.

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

Use `renderIndicator` to draw a selection mark that fits your content. This
example fills a colored ring when a log level is selected.

Keep `indicator="check"`, `indicator="radio"`, or `selection="multiple"` so
the row exposes its checked state to assistive technology. Render a decorative
mark; Select keeps the row itself selectable. You can combine this with
`renderOption` to customize both the content and its indicator.

### Selection summary

```tsx
const teams = [
  { value: 'eng', label: 'Engineering' },
  { value: 'design', label: 'Design' },
  { value: 'ops', label: 'Operations' },
  { value: 'sales', label: 'Sales' },
  { value: 'support', label: 'Support' },
]
const [a, setA] = useState(['eng', 'design', 'ops'])
const [b, setB] = useState(['eng', 'design'])

// verbose: the count summary lists the picks
<Select label="verbose" selection="multiple" placeholder="Pick teams" options={teams} value={a} onValueChange={setA} verbose />

// renderSummary: build the text yourself
<Select
  label="renderSummary"
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

Use `verbose` when people should see the chosen labels in a multiple-selection
field. For several choices, it shows a count followed by their names. Long text
truncates to the field's width.

Use `renderSummary` for task-specific text, such as “All teams” or “2 teams”.
Return `undefined` to keep the standard summary for a case, as this example
does for a single selection. An empty selection shows the placeholder.

The summary is text. For chips or other rich content, use a
[Custom trigger](#custom-trigger).

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

Use `renderTrigger` when a button or another control suits the task better
than a field. The first example opens a field filter with a selection
count. The second configures column visibility: a selected option means that
its column is hidden, and the eye indicator reflects that choice.

Return one focusable element with a visible label or accessible name. Add
`aria-haspopup="menu"` and `aria-expanded={open}` as shown. For a searchable
Select, use `aria-haspopup="dialog"` instead.

Style and label the returned element directly. Default field props such as
`label`, `size`, and `status` apply to the standard field. Use the renderer's
`disabled` state to disable your custom trigger when appropriate.

You can replace the trigger as the selection or layout changes, including
switching between a custom trigger and the default field. The menu reconnects
to the replacement element.

<a id="empty-state"></a>

### Empty and loading states

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

Use `renderEmpty` to explain an empty list or offer a next step. This example
shows loading feedback while the application fetches options, then lets people
create a tag when their search has no matches.

Select provides no default empty message. Return the message your task needs.
Loading state belongs to the application; pass an empty options list while
loading when you want this content to replace the rows.

Use `MenuSeparator` for a status message announced politely to assistive
technology. Use `MenuItem` for an action that people can reach and select with
the keyboard. Validate the query before offering to create an option.

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | SelectItem[] | — | The options to choose from — bare strings, `SelectOption` objects, `SelectGroup`s (inline titled sections), or `SelectSubmenu`s (flyout branches). Groups and submenus nest and mix with plain options. Selection stays global (one `value`, leaf options only); a filter query flattens the tree into grouped results. `Select` infers its value type `V` from these options: `{ value: 365 }` makes `onValueChange` report `number`. A mix of value types widens `V` to the union. Each leaf `value` is the option's identity and must be **unique across the whole tree** (selection is value-keyed, so a value repeated in two sections is one logical pick: both rows toggle together, the trigger resolves to the last). Values that stringify alike (`365` and `"365"`) also collide as row keys; dev builds `console.warn` on either. |
| `clearable?` | boolean | — | Add a "Clear" row pinned in the menu **footer** that empties the selection (single → none, multiple → `[]`). Shown only while something is selected, so it never scrolls away in a long or filtered list. |
| `clearLabel?` | string | Clear | Label for the `clearable` footer row. |
| `defaultValue?` | V \| V[] | — | Initial selected option value for uncontrolled use. |
| `dimActions?` | boolean | true | Dim the default trigger's leading content and chevron at rest. They brighten on hover or focus. Ignored by `renderTrigger`. |
| `disabled?` | boolean | — | Disable the whole select. |
| `filter?` | boolean \| (option, query) => boolean | — | Add a search field that filters option values, labels, and hints. `true` uses case-insensitive substring matching. A space in the trimmed query matches a run of whitespace. Built-in row text highlights matches. A custom `(option, query) => boolean` receives the trimmed query and returns whether to keep the option, without automatic highlighting. It runs once per option on each render, including for an empty query. Rows, empty content, and filtered Select all use the same results. A query flattens groups and submenus into grouped results. Closing the popup resets the query. |
| `hint?` | string | — | Helper text under the field. |
| `icon?` | IconShape | — | Leading icon shown at the left of the field. With a custom `renderTrigger`, it's passed through as `state.icon` instead — the consumer places it. |
| `indicator?` | 'none' \| 'check' \| 'radio' | none | The per-row mark for **single**-select: `'none'` (a tint-only highlight), `'check'` (a trailing checkmark on the selected row, keeping the tint — the canonical Select look), or `'radio'` (a leading radio on every row). Multi-select always uses checkboxes. |
| `label?` | string | — | Visible field label and accessible name for the default trigger. If omitted, provide `aria-label` or `aria-labelledby` that identifies the field. Leading content and the chevron are hidden from assistive technologies and do not label the trigger. |
| `leading?` | ReactNode | — | Content before the default trigger's value, such as a key prefix before the value. It replaces the icon derived from `icon`. Include an `<Icon>` in this content when both are needed. Hidden from assistive technologies. Include any meaningful prefix in `label` or `aria-label`. Ignored by `renderTrigger`. |
| `offset?` | number | 4 | Gap in pixels between the trigger and the options menu. |
| `onValueChange?` | (value, attrs) => void | — | Reports the new value and a `{ value, option }` snapshot after a pick. Clear reports `undefined` with `{ all: true, selected: false }`. Narrow on `'all' in attrs` before reading `option`. Update `value` to accept a controlled change. There is no cancelable `onStateChange`; see the Input event-model note. |
| `placeholder?` | string | — | Text shown when nothing is selected. |
| `placement?` | 'left' \| 'right' \| 'bottom' \| 'top' \| 'bottom-start' \| 'bottom-end' \| 'top-start' \| 'top-end' \| 'right-start' \| 'right-end' \| 'left-start' \| 'left-end' | bottom-start | Preferred placement of the options menu relative to the trigger. The menu auto-flips vertically and clamps horizontally when needed. |
| `renderEmpty?` | (state) => ReactNode | — | Render content in the menu body when the (filtered) option list is empty — a "no results" message, a loading indicator (gated on your own external loading state), or a "create from the query" row. Receives an `EmptyState` (`query`, trimmed). There is no built-in empty message: when omitted, an empty list renders nothing. Whatever you return goes where the option rows would — a plain node is inert; return a `MenuItem` (e.g. a "Create" row) to make it focusable and selectable. |
| `renderIndicator?` | (state) => ReactNode | — | Replace each row's selection **mark** with your own node, drawn at the leading edge. The row stays the control (`role` + `aria-checked` from `indicator` / `selection`); only the drawn mark changes, so pair it with an `indicator` (`'check'` / `'radio'`) or `selection="multiple"` for the semantics. Composes with `renderOption`. |
| `renderOption?` | (option, state) => ReactNode | — | Replaces the built-in `label`, `hint`, and `icon` layout for each option row. Select still supplies the row container, click handling, ARIA attributes, and selection indicator. Read extra option fields through `SelectOption`'s index signature. `state` contains `value`, `selected`, and `disabled`. Filtering still matches the option's `value`, `label`, and `hint`, but Select cannot highlight matches within the returned content. |
| `renderSummary?` | (selected) => string \| undefined | — | `multiple` only: build the trigger's selection summary text yourself, replacing the built-in "`All` / one label / `N selected`" logic. Receives the resolved selected options (`selected.length` is the count) and runs only while something is selected — an empty selection still shows the `placeholder`. Return a **string**: it becomes the default trigger's value, so a long summary ellipsizes at the field's width just like a long value (`Engineering, Design, … `). Return `undefined` to fall back to the default for that case (e.g. customize only the count, keeping the single-label case built-in). For rich content (chips, multiple nodes) use `renderTrigger`, which replaces the whole field. |
| `renderTrigger?` | (state) => ReactNode | — | Replaces the default field with a trigger returned from this function. Receives `open`, `value`, `selected`, `disabled`, and `icon`. Return exactly one focusable element, such as an Anta `Button`. The menu is positioned relative to that element and opens when it is clicked. Do not return a fragment, multiple siblings, or a non-focusable wrapper. Add `aria-haspopup={filter ? 'dialog' : 'menu'}` and `aria-expanded={state.open}` to the returned button. An Anta `Button` already carries the correct role. Field props (`label`, `hint`, `size`, `status`, `placeholder`, and `round`) and `className` / `style` apply only to the default field. Add styling and attributes to the returned element instead. |
| `round?` | boolean \| number \| string | — | Round the field corners — `true` for fully round, or a number / CSS length. |
| `selectAll?` | boolean | true | `multiple` only: shows a "Select all" row that toggles every enabled option, or only the visible options when a filter query is active. Its checkbox is mixed when some options are selected. It is on by default. Set it to `false` to remove the row and the Alt/Option-click shortcut that selects only one row. |
| `selectAllLabel?` | string | Select all | Label for the `selectAll` row. |
| `selection?` | 'single' \| 'multiple' | single | Selection mode. `'single'` (the default) keeps `value` a single value and closes the menu on pick. Switch to `'multiple'` for checkboxes + an array value. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Field size. |
| `status?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' | neutral | Validation/feedback tone for the field. |
| `statusIcon?` | (string & {}) \| false \| IconShape | — | Glyph shown before the `hint` when `status` is set. Each status has a default; pass a shape to override, or `false` to drop it. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | — | Default option-row tone. An option's own `tone` wins. A named tone or a custom CSS color. Most visible with tint-based marks (`indicator` `'none'` / `'check'`); with `'radio'` / `'checkbox'` it also tones the indicator. |
| `toneScope?` | 'all' \| 'selected' | 'all' | Apply the default row tone in every state, or only to selected rows. An option's own `toneScope` wins. |
| `value?` | V \| V[] | — | Controlled value: the selected option's `value`. Update it through `onValueChange`. Leave it undefined for uncontrolled use. |
| `verbose?` | boolean | — | `multiple` only: spell the picks out in the count summary — `3 selected: A, B, C` (labels comma-joined) in place of the bare `3 selected`. Applies to the multi-count case only: `All` stays `All`, a single pick stays its own label, and an empty selection stays the `placeholder`. The list flows into the default trigger's value, so it ellipsizes at the field's width when long (`3 selected: Engineering, Des… `). `renderSummary` overrides this. |

### Change details

`onValueChange(value, attrs)` reports the new value and a snapshot of the change:

| Change | Snapshot |
| --- | --- |
| One option | `value` and the resolved `option`; multiple selection also includes `selected`. |
| Select all or Clear | `all: true` and `selected`, with no single `option`. |

Check `'all' in attrs` before reading `attrs.option`, including in single mode
when `clearable` is enabled. A controlled Select accepts a change when you update
`value`; it has no cancelable `onStateChange`. See the
[Input event model](./input.md#events) for the shared approach.

<a id="the-selectitem-type"></a>

### Option types

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
| `value` | `OptionValue` | The option's identity: `string`, `number`, or `boolean` (`Select` infers the type from your `options`, compared with `===`). What `value` / `defaultValue` name and `onValueChange` reports. Required, unique across the tree. See [Managing the value](#managing-the-value) for non-string values and rich data. |
| `label` | `string` | Visible label. Defaults to `value`. |
| `hint` | `string` | Secondary line under the label. |
| `icon` | `IconShape` | Leading icon, after the selection indicator. |
| `disabled` | `boolean` | Disable just this option. |
| `tone` | `string` | The row's color across label, icon, hint, selected tint, and indicator. A named tone (`neutral` / `brand` / `info` / `success` / `warning` / `critical`) or any CSS color. |
| `tooltip` | `React.ReactNode` | Row tooltip. In a `multiple` select with `selectAll`, a row with no `tooltip` shows the default "select only this" (Alt/⌥-click) hint; set it to override, or `''` to suppress. |
| `className` | `string` | CSS class on the rendered menu row. |
| `style` | `React.CSSProperties` | Inline styles on the rendered menu row. |
| `data-*` | `unknown` | Data attributes on the rendered menu row. `data-menu-*` is reserved for Select's selection and keyboard behavior. |
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

## Web Component

Without JSX, compose the Input and Menu elements to build a Select. There is
no separate `a-select` element to register.

Compose an `<a-input button>` trigger with an `<a-menu>` of options. The menu owns opening and dismissal; the short controller
reflects a picked option into the field and selected row. Keep the Menu directly
after its trigger. Menu associates them through an ARIA element reference,
without requiring a popup ID, and preserves an authored `aria-controls`.

```html
<div data-anta-composition="select" style="display: grid; gap: 4px; width: 280px">
  <a-input button value="stream" aria-haspopup="menu" aria-expanded="false">
    <span slot="label">Output</span>
    <a-icon slot="trailing" shape="chevron-down" aria-hidden="true"></a-icon>
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
  menu.addEventListener('statechange', (event) => {
    field.setAttribute('aria-expanded', String(event.detail.next === 'open'))
  })

  menu.addEventListener('menuselect', (event) => {
    const item = event.target instanceof Element ? event.target.closest('a-menu-item') : null
    if (!item || item.closest('a-menu') !== menu) return
    menu.querySelectorAll(':scope > a-menu-item').forEach((option) => {
      const selected = option === item
      option.toggleAttribute('selected', selected)
    })
    field.value = item.querySelector('a-menu-item-label').textContent.trim()
  }, true)
</script>
```

### Native HTML select

When a native single-value select is enough, add `data-anta` to `<select>`. The
modern customizable-select model keeps native selection, keyboard behavior, and
form submission while exposing its trigger `button`, `selectedcontent`, options,
and optgroups for styling. Anta styles the customizable parts. Browser support and fallback behavior are
covered in [Install and configure](../install-config.md#browser-support). Use `Select` for filtering, multiple
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

## Styling

Select composes an [Input](./input.md) and a [Menu](./menu.md). Reach for props first, then plain CSS or `::part` for
the rest. Don't override an element's internal `--*` output tokens.

**Selection color** routes through `tone`: set it per option or on the Select as a
default, then use `toneScope="selected"` for chosen rows only. It takes a named tone or any CSS color (a custom color keeps
its hue, with lightness pinned to the brand text).

**The field** takes `size`, `status`, and `round`. Set its width with `style` /
`className`, forwarded to `<a-input>`. Style the field through `::part(field)`
and its selected text through `::part(input-label)`. `::part(input)` targets
the native button for alignment and other control styles. The trigger uses
`:focus-visible` for its focus ring and ellipsizes long values. **The popover**
takes Menu's `::part(menu)`.

The leading content and chevron dim at rest and brighten on hover or focus.
Set `dimActions={false}` to keep them fully visible. Custom triggers control
their own adornments. Use Input's parts to style slots and `a-select-chevron`
to style the chevron.

Select's fixed leading layout and chevron color use external CSS. Consumer
`style` props, custom color or radius values, and render-hook content can still
produce inline styles. A custom `renderIndicator` also uses MenuItem's inline
layout wrapper. Follow the [CSP guidance](../install-config.md#content-security-policy)
when choosing styles for a restricted policy.

### Migrate field styles

The default Select field now renders `<a-input button>` and uses Input's label,
hint, and leading slots. This changes the wrapper's DOM structure. Pass a class
name through `className` to target your Select in CSS. The class is applied to
`<a-input>`, and `::part(field)` selects the visible field inside its shadow DOM.
For example, this Select rounds its field and gives the selected text more weight:

```tsx
<Select className="my-select" label="Team" options={['Design', 'Engineering']} />
```

```css
.my-select::part(field) {
  border-radius: 6px;
}
.my-select::part(input-label) {
  font-weight: 600;
}
```

With `className="my-select"`, update existing selectors as follows:

| Previous selector | Input field selector |
| --- | --- |
| `.my-select > a-button` | `.my-select::part(field)` |
| `.my-select > a-button > a-button-label` | `.my-select::part(input-label)` |
| `.my-select > a-select-label` | `.my-select::part(label)` |
| `.my-select > a-select-hint` | `.my-select::part(hint)` |
| `.my-select a-select-leading` | `.my-select::part(leading)` |

Existing raw compositions using `a-select-field`, `a-select-label`,
`a-select-hint`, and `a-select-leading` retain their CSS, JSX types, and Button
label and hint behavior. New raw compositions can use `<a-input button>` as
shown above.

```tsx
// Tone the selection; give the trigger a width.
<Select tone="brand" toneScope="selected" style={{ width: '220px' }} options={OPTIONS} />
```

**Borderless trigger.** Hide the field's inset `box-shadow` while it is not hovered.
The standard hover border and `:focus-visible` keyboard focus outline remain
available. Hide the chevron by targeting `a-select-chevron` to make the field
read as plain text at rest.

```css
/* Hide the border off hover; keep the standard keyboard focus outline. */
.ghost-select a-input:not(:hover)::part(field) {
  box-shadow: none;
}
/* Center the chosen label in the field. */
.ghost-select a-input::part(input) { text-align: center; }
/* Hide the chevron. */
.ghost-select a-select-chevron { display: none; }
```
