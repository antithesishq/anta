# InputDate

**`InputDate`** is a date field that replaces the native `type="date"` (and, with
`time`, `type="datetime-local"`): a text field you can type into, backed by a
`Calendar` that opens when you click the field (or press ↓), marked by a
leading calendar icon. `Calendar`, the month grid it builds on, is documented lower
down.

The field accepts free text and resolves it on commit (blur / Enter): a lenient
parser reads the locale's order (`06/07/2026` is June 7 in en-US, July 6 in de-DE),
month names, and run-together digits, then rewrites the entry to the canonical
format. An unrecognized entry marks the field until you fix it. The value is an ISO
`YYYY-MM-DD` string, never a `Date`; it works controlled (`value` + `onValueChange`)
or uncontrolled (`defaultValue`), and submits under `name`.

## The date field

Type a date and it resolves on blur or Enter, or click the field to open
the calendar and pick a day. Either way the field settles on the locale's canonical
format and the value is ISO `YYYY-MM-DD`. A click keeps focus in the field, so you
can keep typing or click a day; ↓ opens the calendar and moves focus into
the grid, and Esc closes it back to the field. While you type, the calendar
previews the entry — it jumps to that month and highlights the day — and commits it on
Enter (which also closes the calendar); an unrecognized entry keeps the
calendar open and marks the field.

```tsx
<InputDate label="Due date" defaultValue="2026-06-15" onValueChange={(v) => save(v)} />
```

The placeholder shows the locale's format, and parsing follows the same order, so
`de-DE` reads and writes `TT.MM.JJJJ` while `en-US` uses `MM/DD/YYYY`. `min` / `max`
bound both the calendar and what a typed date will accept.

```tsx
<InputDate label="US English" locale="en-US" defaultValue="2026-06-15" />
<InputDate label="German" locale="de-DE" defaultValue="2026-06-15" />
```

`time` turns it into a date-time field (value `YYYY-MM-DDTHH:mm`). The menu grows a
time row under the calendar: an [`InputTime`](./input-time.md) (segmented hour / minute,
plus AM/PM in 12-hour locales) and a confirm (✓) button. Picking a day keeps the menu
open so you can set the time. The clock follows the locale (`en-US` is 12-hour, most
others 24), overridable with `hour12`. The field parses a trailing time after a space
(`06/15/2026 2:30pm` or `… 14:30`), and typing a 24-hour hour into the 12-hour time
field converts it (18 → 6 PM).

```tsx
{/* `size` scales the calendar, the time inputs, the AM/PM toggle, and the buttons together. */}
<InputDate size="small" label="Small" time defaultValue="2026-06-15T09:00" />
<InputDate size="medium" label="Medium" time defaultValue="2026-06-15T09:00" />
<InputDate size="large" label="Large" time defaultValue="2026-06-15T09:00" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `clearable?` | boolean | — | Show a clear button once the field has a value. |
| `defaultValue?` | string | — | Initial value for the uncontrolled case. |
| `disabled?` | boolean | — | Disable the field and the calendar. |
| `hint?` | ReactNode | — | Helper text under the field. Replaced by a format hint while the entry is
 unrecognized. |
| `hour12?` | boolean | — | Force the time cycle when `time` is on: `true` for 12-hour (AM/PM), `false`
 for 24-hour. Omit to follow the locale (`en-US` → 12-hour, most others → 24). |
| `icon?` | false \| IconShape | calendar-days | Leading icon at the start of the field — the calendar affordance. Pass
 another shape to change it, or `false` to drop it. |
| `label?` | ReactNode | — | Field label, above the control. |
| `locale?` | string | navigator.language | BCP-47 locale driving the display format, the placeholder mask, parsing order,
 and the calendar. |
| `max?` | string | — | Latest selectable date (ISO). |
| `min?` | string | — | Earliest selectable date (ISO). Earlier days disable, and a typed date before
 it stays uncommitted. |
| `name?` | string | — | Form field name — the ISO value submits under this key. |
| `offset?` | number | 4 | Gap in pixels between the field and the calendar menu. |
| `onValueChange?` | (value, attrs) => void | — | Fired after the value resolves (a recognized entry, a calendar pick, a time
 change, or a clear), with the new ISO value (`''` when cleared) and a
 `{ value, name }` snapshot. An unrecognized entry does not fire it. |
| `placeholder?` | string | the locale's format mask (e.g. `MM/DD/YYYY`, `MM/DD/YYYY HH:MM` with `time`) | Placeholder shown when empty. |
| `placement?` | 'left' \| 'right' \| 'bottom' \| 'top' \| 'bottom-start' \| 'bottom-end' \| 'top-start' \| 'top-end' \| 'right-start' \| 'right-end' \| 'left-start' \| 'left-end' | bottom-start | Preferred placement of the calendar menu relative to the field. Same values as
 `Menu`; it auto-flips and clamps when space runs out. |
| `round?` | boolean \| number \| string | — | Round the field corners — `true` for fully round, or a number / CSS length. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Field size. Also sizes the calendar and the time row. |
| `status?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' | neutral | Validation/feedback tone. An unrecognized entry forces `critical` until fixed. |
| `time?` | boolean | — | Include a time. The value becomes ISO `YYYY-MM-DDTHH:mm`, the field parses a
 trailing time after a space (`06/15/2026 14:30`, `… 2:30pm`), and the menu
 shows a time row (hours : minutes, an AM/PM toggle in 12-hour locales, then a
 Done button) under the calendar. Picking a day keeps the menu open so you can
 set the time. |
| `value?` | string | — | Controlled value — ISO `YYYY-MM-DD` (or `YYYY-MM-DDTHH:mm` with `time`), `''`
 for empty. Pair with `onValueChange`; the field and calendar follow it and a
 pick only *requests* a change. |

## Calendar

The sections below document `Calendar`, the month grid `InputDate` opens. Reach for
it directly when you want the grid inline, without a field.

`Calendar` uses Anta components in light DOM; it has no hidden shadow-root UI.
The day cells and previous/next chevrons are `<Button>`s inside a
form-associated `<a-calendar>` grid. Date calculations use the
[Temporal API](https://tc39.es/proposal-temporal/docs/) through
`temporal-polyfill`.

For a raw grid, import `buildMonth` from `@antadesign/anta`. It returns
localized weekday headers and day records with ISO values, accessible labels,
and selected, disabled, today, and outside-month state. It does not manage
navigation, roving focus, selection, or rendering. The value is an ISO
`YYYY-MM-DD` string, never a `Date`. Use `value` with `onStateChange` to
control it, or `defaultValue` for uncontrolled use. It participates in forms
under `name`.

**Not SSR-safe.** `Calendar` (and `InputDate`, which embeds it) reads the current
date (`Temporal.Now`) and locale (`navigator.language`) at render, so a server
render disagrees with the client on the highlighted "today" and on localized
labels, and the page hydrates with a mismatch. Render it client-side only: Astro
`client:only`, or a dynamic import inside `useEffect`. Every demo on this page uses
`client:only` for that reason.

## Selecting a date

Click a day, or focus the grid and press Enter / Space. The
selected day takes the tertiary-button selected look toned brand — a brand-tinted
filled cell with a ring. Today shows as a secondary Button, a resting fill.

```tsx
<Calendar defaultValue="2026-06-12" />
```

## Size

`size` scales the whole calendar: the day cells, the prev/next chevrons, and the
weekday and month-heading type. It follows Button's `small` / `medium` (default) /
`large` scale, with day-cell heights of 24 / 28 / 32px.

```tsx
<Calendar size="small" defaultValue="2026-06-28" />
<Calendar defaultValue="2026-06-28" />          {/* medium (default) */}
<Calendar size="large" defaultValue="2026-06-28" />
```

## Range

`min` and `max` (ISO strings) bound the selectable range. Days outside it render
disabled and skip keyboard focus, and the prev/next arrows stop at the range edge.
The jump menu adapts to how far the range reaches.

No `min` / `max`: the jump menu lists today ±3 years, each a submenu of its months.

```tsx
<Calendar size="small" defaultValue="2026-06-15" />
```

A range across years lists each year (here 2026 and 2027) as a submenu of months.
June 2026 disables days 1–7, and the back arrow stops at the range's start.

```tsx
<Calendar size="small" defaultValue="2026-06-15" min="2026-06-08" max="2027-06-24" />
```

A range inside one year skips the year level and lists months directly, March
through November enabled and the rest disabled.

```tsx
<Calendar size="small" defaultValue="2026-06-15" min="2026-03-01" max="2026-11-30" />
```

A range inside one month leaves nowhere to jump. Both arrows and the month/year
button are disabled, and only the in-range days stay selectable.

```tsx
<Calendar size="small" defaultValue="2026-06-15" min="2026-06-08" max="2026-06-24" />
```

## Locale

`Calendar` respects the browser locale by default (`navigator.language`). Pass a
BCP-47 `locale` to override it: the first day of week comes from the locale's week
info (never hard-coded to Sunday), and the weekday and month names are localized.

```tsx
<Calendar defaultValue="2026-06-28" locale="en-US" />  {/* week starts Sunday */}
<Calendar defaultValue="2026-06-28" locale="fr-FR" />  {/* week starts Monday */}
<Calendar defaultValue="2026-06-28" locale="ja-JP" />
```

## Controlled

Uncontrolled by default: pass `defaultValue` and read the date from `onValueChange`
or at form submit. Make it controlled with `value` + `onStateChange` to drive it
from your store. The grid then follows `value`, and a pick only *requests* a change:
answer by updating `value`, reject by doing nothing.

```tsx
const [date, setDate] = useState('2026-06-28')

<Calendar
  value={date}
  onStateChange={(_e, { next }) => setDate(next ?? '')}
/>
```

`onStateChange` fires before the element applies, with `(event, { next, prev, reason })`
where `next` / `prev` are ISO strings. For a `'user'` pick, `event.preventDefault()`
vetoes it (uncontrolled). A controlled calendar with no `onStateChange` is read-only.

## Disabled

`disabled` dims the whole calendar and removes it from interaction.

```tsx
<Calendar defaultValue="2026-06-28" disabled />
```

## Forms

`Calendar` is form-associated. Give it a `name` and it submits the selected ISO
date under that key, resets to `defaultValue` on form reset, and reports through
the standard constraint-validation pipeline.

```tsx
<form>
  <Calendar name="due-date" defaultValue="2026-06-28" />
</form>
```

## Accessibility

The calendar is a labelled **group** of day buttons, a flat grid rather than a
nested `grid`/`row`/`gridcell` tree. The group is named by the visible month
(`aria-labelledby`). Each day is a `<button>` whose `aria-label` is its full date
including weekday ("Sunday, June 28, 2026"), with `aria-pressed` on the selected day
and `aria-current="date"` on today. The decorative weekday headers are `aria-hidden`,
since each day already names its weekday. A roving `tabindex` keeps a single tab
stop, and an `aria-live` region announces the month when it changes.

| Key | Moves focus |
|---|---|
| ← / → | by one day |
| ↑ / ↓ | by one week |
| Home / End | to the start / end of the week |
| PageUp / PageDown | by one month |
| Shift + PageUp / PageDown | by one year |
| Enter / Space | select the focused day |

## Customization

`InputDate` uses Input, Menu, and Calendar. Calendar uses an `<a-calendar>`
element for the day grid and a JSX wrapper for navigation. The sections below
describe which layer provides each behavior and how to recreate the interface
without React.

### Build it from elements

`InputDate` has no `a-inputdate` element. Its wrapper renders an editable
`<Input>` and a `<Menu>` containing a `<Calendar>`. When `time` is set, the
hour/minute fields and AM/PM `Tabs` appear below the grid. The wrapper manages
draft text, parsing on commit, and the ISO value.

Clicking the field opens the menu while keeping focus in the field. Pressing
↓ opens the menu and moves focus to the grid. The wrapper passes a
`focusSignal` to Calendar, which renders `data-focus`; `<a-calendar>` then
focuses the active day. Calendar and Tabs emit their own `statechange` events,
but Menu responds only to changes in its own open state.

The `<a-calendar>` element provides grid behavior. It connects the supplied day
`<button>`s to click and keyboard navigation, including arrows, Home,
End, PageUp, and PageDown. It stores the form
value through `ElementInternals` and emits `statechange` / `change` on selection
and `navigate` when keyboard navigation leaves the displayed month. It is
framework-agnostic and does not track a current month, `min`, or `max`.

The JSX wrapper renders the controls above the grid as siblings of
`<a-calendar>`. The previous/next arrows are `<Button>`s. The month/year picker
is a `<Button>` that opens a `<Menu>` of year `MenuItem`s, each with a month
submenu. The wrapper stores the displayed-month cursor in state and derives day
cells and the arrows' `disabled` states from `min` and `max`. A click on an
arrow, a menu selection, or a `navigate` event updates the cursor and re-renders
the grid. The wrapper enforces the range. The element only ignores a day that
was rendered with `disabled`.

The element has no `min` or `max` because the wrapper provides the surrounding
controls. Without React, render the grid with `buildMonth` and add the
navigation behavior shown below:

```html
<!-- `.calendar` scopes this example. Use an application selector instead. -->
<div class="calendar" style="display: inline-flex; flex-direction: column; gap: 6px">
  <div style="display: flex; align-items: center">
    <a-button priority="tertiary" data-prev aria-label="Previous month"><a-icon shape="chevron-left"></a-icon></a-button>
    <a-button priority="tertiary" data-heading style="flex: 1; justify-content: center" aria-haspopup="menu"></a-button>
    <a-button priority="tertiary" data-next aria-label="Next month"><a-icon shape="chevron-right"></a-icon></a-button>
  </div>
  <!-- The element provides selection, keyboard behavior, form value, and events. -->
  <a-calendar role="group" name="date"></a-calendar>
</div>
<script type="module">
  import '@antadesign/anta/elements'
  import { buildMonth, parseISODate } from '@antadesign/anta'
  import { Temporal } from 'temporal-polyfill'

  const root = document.querySelector('.calendar')
  const grid = root.querySelector('a-calendar')
  const heading = root.querySelector('[data-heading]')
  let cursor = Temporal.Now.plainDateISO()

  function render() {
    const m = buildMonth({ anchor: cursor, locale: navigator.language })
    heading.textContent = m.heading
    grid.replaceChildren()
    for (const w of m.weekdays) {
      const s = Object.assign(document.createElement('span'), { textContent: w.narrow })
      s.setAttribute('data-part', 'weekday')
      s.setAttribute('aria-hidden', 'true')
      grid.append(s)
    }
    for (const d of m.weeks.flat()) {
      const b = Object.assign(document.createElement('a-button'), { textContent: String(d.day) })
      b.setAttribute('priority', 'tertiary')
      b.setAttribute('data-part', 'day-cell')
      b.setAttribute('data-date', d.iso)      // the element keys off this
      b.tabIndex = d.iso === cursor.toString() ? 0 : -1
      if (d.selected) b.setAttribute('selected', '')
      if (d.disabled) b.setAttribute('disabled', '')
      grid.append(b)
    }
  }

  root.querySelector('[data-prev]').addEventListener('click', () => { cursor = cursor.subtract({ months: 1 }); render() })
  root.querySelector('[data-next]').addEventListener('click', () => { cursor = cursor.add({ months: 1 }); render() })
  // Keyboard paging past the rendered grid: the element asks for a month flip.
  grid.addEventListener('navigate', (e) => { cursor = parseISODate(e.detail.date) ?? cursor; render() })
  render()
</script>
```

Tracking the cursor, painting the grid from `buildMonth`, and re-rendering on
`navigate` is what the React `Calendar` packages, plus the year/month jump menu,
which uses the same `Menu` composition shown on the [Menu](./menu.md) page.

`InputDate` has no host element. Rebuilding its text parsing, dropdown calendar,
localized day grid, month navigation, keyboard navigation, and focus management
in vanilla JavaScript is significant work, even with Anta's `buildMonth` and
`parseISODate` helpers. Use the `InputDate` wrapper when React or Preact is an
option. Otherwise, a native HTML date input is the practical baseline.

### Native HTML date input

Add `data-anta` to a `date`, `datetime-local`, `month`, `time`, or `week` input.
Nothing else is required: Anta styles the field while the browser keeps its picker,
icon, validation, and keyboard model. The picker itself and its date/time
formatting remain browser- and OS-owned.

`data-anta-size`, `round`, and a custom-color `tone` use the matching Input
field treatments.

```html
<!-- `data-anta` styles the field, not the native picker. -->
<input data-anta type="date" name="due-date" value="2026-06-15">
<input data-anta type="datetime-local" name="starts-at" value="2026-06-15T09:00">
<input data-anta type="month" name="billing-month" value="2026-06">
<input data-anta type="time" name="reminder-at" value="09:00">
<input data-anta type="week" name="sprint-week" value="2026-W25">
```

The calendar is **light DOM**, so everything is plain CSS, with no shadow parts or
hidden internals. The days and chevrons are real `<a-button>`s, so their colors,
hover, focus ring, and selected look come from the Button styles and theme
themselves; they sit inside the `<a-calendar>` grid, and the switcher header sits in
the `.anta-calendar` shell. An un-layered consumer rule beats `@layer anta` without
`!important`. The class below is for the demo.

```css
/* Bigger, circular day cells. `className` lands on the outer .anta-calendar
   shell; `--calendar-cell-width` / `--calendar-cell-height` drive the grid track
   and the cell box (inherited down), and you target the day Buttons directly. */
.anta-calendar.roomy { --calendar-cell-width: 40px; --calendar-cell-height: 40px; }
.anta-calendar.roomy a-button[data-part="day-cell"] { border-radius: 50%; }
```

Each day is a `<a-button data-part="day-cell" data-date="YYYY-MM-DD">`, so a
specific date is addressable by its `data-date`: tint it, or hang an event marker
off a `::after` (give the cell `position: relative` first). Below, three days carry a
brand dot and one is flagged in the critical color.

```css
/* Day cells are `<a-button data-part="day-cell" data-date="YYYY-MM-DD">`. Give them a
   positioning context, dot event days with a `::after`, and tint a date's text. */
.anta-calendar.events a-button[data-part="day-cell"] { position: relative; }
.anta-calendar.events a-button[data-part="day-cell"]:is(
  [data-date="2026-06-05"], [data-date="2026-06-12"], [data-date="2026-06-20"]
)::after {
  content: ""; position: absolute; inset-block-end: 3px; inset-inline-start: 50%;
  inline-size: 4px; block-size: 4px; transform: translateX(-50%);
  border-radius: 999px; background: var(--text-2-brand);
}
.anta-calendar.events a-button[data-part="day-cell"][data-date="2026-06-25"] {
  color: var(--text-2-critical); font-weight: 600;
}
```

The engine (`buildMonth`, `firstDayOfWeek`, …) is exported, so you can render a
fully custom grid and keep only the `<a-calendar>` form plumbing.
