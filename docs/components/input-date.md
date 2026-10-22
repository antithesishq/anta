# InputDate

Use InputDate to enter a date by typing or choosing a day from a calendar.
Add `time` when the task also needs a time of day. Use [Calendar](#calendar)
directly when the month grid should stay visible without a field.

Render InputDate and Calendar only on the client. Their current date and locale
can differ between server and browser rendering. In Astro, use `client:only`.
See [Server and worker rendering](../install-config.md#server-and-worker-rendering) for
setup guidance.

## The date field

Enter a date and press Enter or leave the field to confirm it.
InputDate accepts the locale's date order, month names, and dates without
separators, then formats the result. An unrecognized entry stays visible and
marks the field invalid so it can be corrected.

Select the field to open its calendar while keeping focus in the text.
Press ↓ to open the calendar and focus a day. Press Esc
to close it and return focus to the field. While you type, the calendar previews
recognized dates. Pressing Enter confirms the date and closes the
calendar. An unrecognized entry keeps the calendar open.

```tsx
<InputDate label="Due date" defaultValue="2026-06-15" onValueChange={(v) => save(v)} />
```

Set `locale` to choose the date format. For example, `06/07/2026` means June 7
in `en-US` and July 6 in `de-DE`. The placeholder shows the expected format.
Use `min` and `max` to limit both typed dates and calendar choices.

```tsx
<InputDate label="US English" locale="en-US" defaultValue="2026-06-15" />
<InputDate label="German" locale="de-DE" defaultValue="2026-06-15" />
```

Pass `time` to add a time field and confirmation button to the calendar.
Choosing a day keeps the calendar open so the time can be entered before
confirming. The clock follows the locale. Use `hour12` to override it.

You can also type a date and time together, such as `06/15/2026 2:30pm` or
`06/15/2026 14:30`. In a 12-hour time field, entering `18` converts to `6 PM`.

```tsx
{/* `size` scales the calendar, the time inputs, the AM/PM toggle, and the buttons together. */}
<InputDate size="small" label="Small" time defaultValue="2026-06-15T09:00" />
<InputDate size="medium" label="Medium" time defaultValue="2026-06-15T09:00" />
<InputDate size="large" label="Large" time defaultValue="2026-06-15T09:00" />
```

### Manage the value

Use `defaultValue` for an initial date, or pair `value` with `onValueChange`
to control it. InputDate reports an ISO string: `YYYY-MM-DD`, or
`YYYY-MM-DDTHH:mm` with `time`. An empty field reports `''`. Add `name` to
submit that value with a form.

```tsx
const [date, setDate] = useState('2026-06-15')

<InputDate label="Due date" name="due-date" value={date} onValueChange={setDate} />
```

## InputDate props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `clearable?` | boolean | — | Show a clear button once the field has a value. |
| `defaultValue?` | string | — | Initial value for the uncontrolled case. |
| `disabled?` | boolean | — | Disable the field and the calendar. |
| `hint?` | ReactNode | — | Helper text under the field. Replaced by a format hint while the entry is unrecognized. |
| `hour12?` | boolean | — | Force the time cycle when `time` is on: `true` for 12-hour (AM/PM), `false` for 24-hour. Omit to follow the locale (`en-US` → 12-hour, most others → 24). |
| `icon?` | false \| IconShape | calendar-days | Leading icon at the start of the field — the calendar affordance. Pass another shape to change it, or `false` to drop it. |
| `label?` | ReactNode | — | Field label, above the control. |
| `locale?` | string | navigator.language | BCP-47 locale driving the display format, the placeholder mask, parsing order, and the calendar. |
| `max?` | string | — | Latest selectable date (ISO). |
| `min?` | string | — | Earliest selectable date (ISO). Earlier days disable, and a typed date before it stays uncommitted. |
| `name?` | string | — | Form field name — the ISO value submits under this key. |
| `offset?` | number | 4 | Gap in pixels between the field and the calendar menu. |
| `onValueChange?` | (value, attrs) => void | — | Fired after the value resolves (a recognized entry, a calendar pick, a time change, or a clear), with the new ISO value (`''` when cleared) and a `{ value, name }` snapshot. An unrecognized entry does not fire it. |
| `placeholder?` | string | the locale's format mask (e.g. `MM/DD/YYYY`, `MM/DD/YYYY HH:MM` with `time`) | Placeholder shown when empty. |
| `placement?` | 'left' \| 'right' \| 'bottom' \| 'top' \| 'bottom-start' \| 'bottom-end' \| 'top-start' \| 'top-end' \| 'right-start' \| 'right-end' \| 'left-start' \| 'left-end' | bottom-start | Preferred placement of the calendar menu relative to the field. Same values as `Menu`; it auto-flips and clamps when space runs out. |
| `round?` | boolean \| number \| string | — | Round the field corners — `true` for fully round, or a number / CSS length. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Field size. Also sizes the calendar and the time row. |
| `status?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' | neutral | Validation/feedback tone. An unrecognized entry forces `critical` until fixed. |
| `time?` | boolean | — | Include a time. The value becomes ISO `YYYY-MM-DDTHH:mm`, the field parses a trailing time after a space (`06/15/2026 14:30`, `… 2:30pm`), and the menu shows a time row (hours : minutes, an AM/PM toggle in 12-hour locales, then a Done button) under the calendar. Picking a day keeps the menu open so you can set the time. |
| `value?` | string | — | Controlled value — ISO `YYYY-MM-DD` (or `YYYY-MM-DDTHH:mm` with `time`), `''` for empty. Pair with `onValueChange`; the field and calendar follow it and a pick only *requests* a change. |

## Calendar

Use Calendar for an inline date picker, such as a booking form with a month
always in view. It provides day selection, month navigation, keyboard access,
and form submission.

Like InputDate, Calendar must render only on the client. The examples use
Astro's `client:only` directive.

## Selecting a date

Select a day, or focus it and press Enter or Space.
The selected day has a brand-colored fill and ring. Today's date has a subtle
fill when it is not selected.

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

Calendar uses the browser's locale by default. Pass a locale tag such as
`en-US`, `fr-FR`, or `ja-JP` to choose the language and first day of the week.

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

Add `name` to submit the selected ISO date with a form. An uncontrolled Calendar
returns to `defaultValue` on form reset. For a controlled Calendar, handle the
reset request in `onStateChange` and update `value` as needed.

```tsx
<form>
  <Calendar name="due-date" defaultValue="2026-06-28" />
</form>
```

## Accessibility

InputDate identifies its calendar as a dialog associated with the field.
Opening it with ↓ moves focus into the calendar. Closing it with
Esc returns focus to the field.

Calendar announces the displayed month and gives each day its full date,
including the weekday. Screen readers can identify the selected day and today's
date. The day grid has one Tab stop, and changing months announces the new month.

| Key | Moves focus |
|---|---|
| ← / → | by one day |
| ↑ / ↓ | by one week |
| Home / End | to the start / end of the week |
| PageUp / PageDown | by one month |
| Shift + PageUp / PageDown | by one year |
| Enter / Space | select the focused day |

## Customization

Use the InputDate and Calendar wrappers for the complete date-entry interface.
For custom calendar rendering, `buildMonth` supplies localized weekday headers
and day records with ISO values, accessible labels, and selection and range
states. Your application supplies rendering and navigation.

### Build it from elements

InputDate combines Input, Menu, and Calendar. There is no separate InputDate host
element. Recreating it requires text parsing, date formatting, popup behavior,
and focus management. For a form that can use the browser's picker, consider
[Native HTML date input](#native-html-date-input).

For a custom month grid, use `<a-calendar>` with day buttons marked
`data-part="day-cell"` and `data-date="YYYY-MM-DD"`. It provides keyboard
navigation, selection requests, and form submission. Render the surrounding
month controls yourself and handle `navigate` when focus moves to another date.

`buildMonth` returns the month heading, weekdays, and day records. Pass `min`
and `max` to it when building a bounded grid, render out-of-range dates with
`disabled`, and limit your month controls to that range.

This example supplies previous and next month controls and a controlled
selection:

```html
<!-- `.calendar` scopes this example. Use an application selector instead. -->
<div class="calendar" style="display: inline-flex; flex-direction: column; gap: 6px">
  <div style="display: flex; align-items: center">
    <a-button role="button" tabindex="0" priority="tertiary" data-prev aria-label="Previous month"><a-icon shape="chevron-left" aria-hidden="true"></a-icon></a-button>
    <span data-heading style="flex: 1; text-align: center"></span>
    <a-button role="button" tabindex="0" priority="tertiary" data-next aria-label="Next month"><a-icon shape="chevron-right" aria-hidden="true"></a-icon></a-button>
  </div>
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
  grid.setAttribute('state', cursor.toString())

  function focusDate(iso) {
    grid.querySelector(`[data-date="${iso}"]`)?.focus()
  }

  function render() {
    const month = buildMonth({
      anchor: cursor,
      locale: navigator.language,
      selected: parseISODate(grid.value),
    })
    heading.textContent = month.heading
    grid.setAttribute('aria-label', month.heading)
    grid.replaceChildren()
    for (const weekday of month.weekdays) {
      const label = Object.assign(document.createElement('span'), { textContent: weekday.narrow })
      label.setAttribute('data-part', 'weekday')
      label.setAttribute('aria-hidden', 'true')
      grid.append(label)
    }
    for (const day of month.weeks.flat()) {
      const button = document.createElement('a-button')
      const label = Object.assign(document.createElement('a-button-label'), { textContent: String(day.day) })
      button.append(label)
      button.setAttribute('role', 'button')
      button.setAttribute('priority', day.today && !day.selected ? 'secondary' : 'tertiary')
      button.setAttribute('data-part', 'day-cell')
      button.setAttribute('data-date', day.iso)
      button.setAttribute('aria-label', day.label)
      button.setAttribute('aria-pressed', String(day.selected))
      button.tabIndex = day.iso === cursor.toString() ? 0 : -1
      if (day.selected) {
        button.setAttribute('selected', '')
        button.setAttribute('tone', 'brand')
      }
      if (day.disabled) button.setAttribute('disabled', '')
      if (day.today) {
        button.setAttribute('data-today', '')
        button.setAttribute('aria-current', 'date')
      }
      if (day.outside) button.setAttribute('data-outside', '')
      grid.append(button)
    }
  }

  root.querySelector('[data-prev]').addEventListener('click', () => {
    cursor = cursor.subtract({ months: 1 })
    render()
  })
  root.querySelector('[data-next]').addEventListener('click', () => {
    cursor = cursor.add({ months: 1 })
    render()
  })
  grid.addEventListener('statechange', (event) => {
    grid.setAttribute('state', event.detail.next ?? '')
    cursor = parseISODate(grid.value) ?? cursor
    render()
    focusDate(cursor.toString())
  })
  grid.addEventListener('navigate', (event) => {
    cursor = parseISODate(event.detail.date) ?? cursor
    render()
    focusDate(cursor.toString())
  })
  render()
</script>
```

Use the Calendar wrapper when you also need its year/month jump menu and
range-aware controls.

### Raw Calendar value and form API

Use `state` for controlled selection or `default-state` for an uncontrolled
initial and reset date. The read-only `.value` property returns the applied ISO
date, or `null` when empty. Read the reset date with
`getAttribute('default-state')`.

An empty `state=""` keeps the calendar controlled and empty. Remove `state` to
release control while retaining the applied date. Uncontrolled picks, reset, and
restoration leave those input attributes unchanged.

Accept controlled picks from `statechange` by updating `state`. `change` reports
applied selection. `navigate` requests a new focus date. The application renders
the requested month and focuses that day. Author the month label and each day
button's accessible name. Calendar does not generate those labels.

When migrating raw Calendar code, replace `value` / `defaultvalue` attributes
with `state` / `default-state`. Replace assignments to `.value` with
`setAttribute('state', date)` and assignments to `.defaultValue` with
`setAttribute('default-state', date)`. Remove `state` to release control.
The old attributes have no effect on selection, `.value` is read-only, and the
`.defaultValue` property is no longer provided.

Public `Calendar` and `InputDate` JSX props remain `value` and `defaultValue`.
For raw React or Preact markup, bind `state` directly; omitting it or setting it
to `undefined` releases control.

## Calendar props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `aria-label?` | string | — | Accessible name for the grid (defaults to the visible month heading). |
| `defaultValue?` | string | — | Initial selected date for the uncontrolled case (ISO `YYYY-MM-DD`). |
| `disabled?` | boolean | — | Disable the whole calendar (not focusable or selectable). |
| `focusSignal?` | number | — | Move keyboard focus onto the active day. Change this to a new value (e.g. increment a counter) to focus the cursor cell — `InputDate` bumps it when the calendar is opened from the field by keyboard (ArrowDown), so focus lands in the grid. The initial value never focuses; only a change does. |
| `locale?` | string | navigator.language | BCP-47 locale tag driving first-day-of-week, weekday, and month names. |
| `max?` | string | — | Latest selectable date (ISO `YYYY-MM-DD`) — later days render disabled. |
| `min?` | string | — | Earliest selectable date (ISO `YYYY-MM-DD`) — earlier days render disabled. |
| `name?` | string | — | Form field name — the selected ISO date submits under this key. |
| `onChange?` | (event) => void | — | Fired *after* the selection changes (post-apply). Not cancelable; for a controlled calendar it fires once you've updated `value`. |
| `onStateChange?` | (event, detail) => void | — | Fired whenever the selection changes — event-first. `detail` is `{ next, prev, reason }`: `next` / `prev` are ISO date strings (`null` = none); `reason` is `'user'` \| `'reset'` \| `'restore'`. A `'user'` pick fires *before* applying and is **cancelable** — `event.preventDefault()` vetoes it (uncontrolled), or in controlled mode answer by updating `value`. `'reset'` / `'restore'` are not cancelable. |
| `onValueChange?` | (event, attrs) => void | — | Like `onChange`, but with a `{ value, name }` snapshot as the second argument, matching `Input`. |
| `size?` | 'small' \| 'medium' \| 'large' | 'medium' | Size of the whole calendar — scales the day cells, the chevrons, and the weekday / month-heading type together (uses Button's `small` / `medium` / `large` scale). |
| `value?` | string | — | Controlled selected date — ISO `YYYY-MM-DD`. When provided, the application controls selection: the grid follows this prop and a pick only *requests* a change via `onStateChange`. Leave undefined for uncontrolled. |

## Web Component

Use a native date input when the browser's picker fits your form. To build a
custom picker without JSX, see [Build it from elements](#build-it-from-elements).

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

## Styling

Use ordinary CSS to style the calendar and its day buttons. `className` applies
to the outer `.anta-calendar` container. Unlayered consumer rules override Anta's
defaults. Replace the example classes with your own selectors.

Set `--calendar-cell-width` and `--calendar-cell-height` to make day targets
larger, then use `border-radius` to shape them:

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

For a custom month layout, use the exported `buildMonth` and `firstDayOfWeek`
helpers. See [Build it from elements](#build-it-from-elements).
