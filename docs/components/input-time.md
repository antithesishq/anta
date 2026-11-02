# InputTime

Use InputTime for a time of day, such as a meeting start or office hours.
The field provides hour and minute sections, with AM/PM in 12-hour locales.
Enter digits or use the arrow keys to adjust each section.

The value is a 24-hour `HH:mm` string, or `''` while the time is incomplete.
Use `defaultValue` for an initial time, or pair `value` with `onValueChange`
to control it. Add `name` to submit the value with a form.

## The field

Focus a section and enter digits. The caret advances when the section is
complete. For example, entering `9`, `3`, and `0` produces `09:30`.
In a 12-hour field, entering `18` sets `6 PM`. The period section accepts its
localized text or `a` and `p`.

Use the keyboard to adjust or move between sections:

- ↑ and ↓ step the value, wrapping at its limits.
- ← and → move between sections at the caret boundary.
- PageUp and PageDown make larger minute adjustments.
- Backspace in an empty section selects the previous section.

Home, End, selection, deletion, and paste keep their native text-field behavior.
When one digit cannot grow into a valid two-digit value, the field confirms
that section and advances. Entering `6` in minutes, for example, sets `06`.

The field sizes to its content. Set `width` when it should fill its container.
Use `icon` to replace the leading clock, or `icon={false}` to remove it.

```tsx
<InputTime label="Start time" defaultValue="09:30" onValueChange={(_, { value }) => save(value)} />
```

## Locale

Set `locale` to choose the clock format, section order, separator, and AM/PM
text. For example, `en-US` uses a 12-hour clock and `de-DE` uses a 24-hour clock.
Japanese can place the period first, and Finnish uses a dot separator.
Pass `hour12` or `hour12={false}` to override the locale's clock format.

The period section reserves enough space for either label, so switching AM/PM
does not change the field's width.

```tsx
<InputTime label="US English" locale="en-US" defaultValue="14:05" />   {/* 12-hour: 02 : 05 PM */}
<InputTime label="German"     locale="de-DE" defaultValue="14:05" />   {/* 24-hour: 14 : 05 */}
<InputTime label="Japanese"   locale="ja-JP" hour12 defaultValue="14:05" />  {/* 午後 02:05 — period first */}
<InputTime label="Force 24h"  hour12={false} defaultValue="14:05" />
```

## Size, status, and clearing

`size` (`small` / `medium` / `large`) matches the other inputs' scale; `status`
recolors the box and hint (only `critical` marks it invalid); `clearable` adds a
clear button once a value is set — clearing empties every section back to the
placeholder dashes. `disabled` prevents focus and editing. `readOnly` keeps the time selectable and focusable while preventing edits.

`min` and `max` (24-hour `"HH:mm"`) bound the value: a complete time outside the
range is clamped to the nearest bound as you step or leave the field, and flags
`rangeUnderflow` / `rangeOverflow` for form validity in the meantime.

```tsx
<InputTime label="Meeting" size="small" defaultValue="10:00" clearable />
<InputTime label="Deadline" status="critical" hint="Pick a time in the future." />
<InputTime label="Office hours" size="large" min="09:00" max="17:00" defaultValue="09:30" />
```

## Controlled values and clearing

Update `value` from `onValueChange` to control the time. An incomplete time reports
an empty string while the native segments retain the text being edited.
Omit `value` or pass `undefined` to release control and retain the current time.
Form reset and browser restoration preserve a controlled value; an uncontrolled
reset restores `defaultValue`. Call
`preventDefault()` in `onClearClick` to keep a value when clearing is disallowed.

```tsx
const [value, setValue] = useState('09:30')
const [keep, setKeep] = useState(false)

<InputTime label="Meeting" locale="en-US" value={value} clearable
  onValueChange={(_, attrs) => setValue(attrs.value)}
  onClearClick={event => { if (keep) event.preventDefault() }} />
<Checkbox checked={keep} onStateChange={(_, { next }) => setKeep(next === true)}>
  Keep the value when clearing
</Checkbox>
<Tag>{value || 'Incomplete time'}</Tag>
```

## InputTime props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `autoFocus?` | boolean | — | Focus this field when its containing `Dialog` opens. |
| `children?` | ReactNode | — | Extra content rendered under the field, above the hint (a no-box child like a `<Tooltip>` takes no space and anchors to the field). |
| `clearable?` | boolean | — | Show a clear button once the field has a value. |
| `defaultValue?` | string | — | Initial value for the uncontrolled case (24-hour `"HH:mm"`). |
| `dimActions?` | boolean | — | Dim the trailing adornments at rest; they brighten on hover / focus. |
| `disabled?` | boolean | — | Disable the field. |
| `hint?` | ReactNode | — | Message below the field. `status` recolors it and prefixes a glyph. |
| `hour12?` | boolean | — | Force the clock: `true` = 12-hour (AM/PM), `false` = 24-hour. Omit to follow the locale. |
| `icon?` | false \| IconShape | clock | Leading icon at the start of the field — the clock affordance. Pass another shape to change it, or `false` to drop it. |
| `label?` | ReactNode | — | Field label, shown above the control and used as the segment group's accessible name. |
| `locale?` | string | navigator.language | BCP-47 locale driving the clock (12h vs 24h), segment order, separator, and the AM/PM text. |
| `max?` | string | — | Latest allowed time, 24-hour `"HH:mm"`. A complete value above it is clamped down (on step / blur) and flagged `rangeOverflow`. |
| `min?` | string | — | Earliest allowed time, 24-hour `"HH:mm"`. A complete value below it is clamped up (on step / blur) and flagged `rangeUnderflow` for form validity. |
| `name?` | string | — | Form field name — the 24-hour value submits under this key. |
| `onBlur?` | (e) => void | — | Fires when the field loses focus. |
| `onClearClick?` | (e) => void | — | Fires before clearing. Call `preventDefault()` synchronously to keep the value. |
| `onClearInput?` | (e) => void | — | Fires after the built-in clear button has cleared the field. |
| `onFocus?` | (e) => void | — | Fires when the field gains focus. |
| `onValueChange?` | (event, attrs) => void | — | Fires on every edit (`input`), with the native event + an `attrs` snapshot (`value`, `name`, `empty`, `valid`, `validationMessage`). Also fires on `change` (blur) and on clear. Read-only blur is silent unless committing an edit made before the field became read-only. |
| `readOnly?` | boolean | — | Keep the time selectable and focusable while preventing edits. Blur emits `change` only if an edit was pending when the field became read-only. |
| `required?` | boolean | — | Mark the field required (drives native validity). |
| `round?` | boolean \| number \| string | — | Fully-round the field, or a custom radius (`number` px / CSS length). |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Size variant. small=24px, medium=28px, large=32px tall. |
| `status?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' | — | Validation / feedback tone. Only `critical` marks the field invalid; the others are advisory. Omit (or `neutral`) for a plain field. |
| `statusIcon?` | (string & {}) \| false \| IconShape | — | Glyph before the `hint` when `status` is set (per-status default; pass a shape to override, or `false` to drop it). |
| `tone?` | string | — | Custom accent color — any literal CSS color tints the resting + hover border (focus ring stays `--focus-ring`); `status` overrides for validation. |
| `trailing?` | ReactNode | — | Content pinned to the end of the field (after the clear button). |
| `value?` | string | — | Controlled value — 24-hour `"HH:mm"`. Pair with `onValueChange`. Reset and restoration preserve it; releasing control retains the current time. |

## Web Component

Use `<a-input-time>` directly outside JSX. Its `label`, `leading`, `clear`,
`trailing`, and `hint` slots accept field content. Use the `hour`, `minute`, and
`period` parts to style sections independently of their locale order.

In raw HTML, a `value` attribute makes the field controlled, so form reset and
browser restoration preserve its current time. Use `defaultvalue` without `value`
for an uncontrolled field that resets to its initial time. Remove `value` to
release control while retaining the current time.

If existing selectors target JSX grouping spans, update them to the
`a-input-time-label`, `a-input-time-leading`, `a-input-time-clear`,
`a-input-time-trailing`, and `a-input-time-hint` tags or their slot attributes.
Raw HTML can keep its existing slot markup.

For styles and renderer setup, follow [Install and configure](../install-config.md).
Custom colors and dimensions may require external CSS under a strict
[Content Security Policy](../install-config.md#content-security-policy).

The canonical value remains `HH:mm`, or an empty string for an incomplete time.
`input` bubbles and is composed; `change` bubbles on commit. A clear action first
fires cancelable, bubbling `clearclick`, then `input`, `change`, and `clearinput`
when accepted. Cancel `clearclick` synchronously to retain the value.

A read-only field emits `change` on blur only for an edit made before it became
read-only. Partial digits remain visible, with an empty canonical value until
editing resumes and completes the time. Removing the field while blur settles
still completes a pending commit, including range clamping on an editable field.

```html
<a-input-time name="start-time" defaultvalue="09:30">
  <span slot="label">Start time</span>
  <a-icon slot="leading" shape="clock" aria-hidden="true"></a-icon>
</a-input-time>
```

### Native HTML time input

For a form that can use the browser's time picker, add `data-anta` to a regular
time input. It gives the field Anta's resting chrome while the browser keeps its
own picker, validation, and keyboard behavior.

`data-anta-size`, `round`, and a custom-color `tone` use the matching Input
field treatments.

```html
<input data-anta type="time" name="reminder-at" value="09:00">
```

## Styling

Use `status` for feedback color and `tone` for a custom accent. Style the host
with ordinary CSS and its sections with `::part()`. Unlayered consumer rules
override Anta's defaults. `segment` targets every editable input. `hour`,
`minute`, and `period` target one segment type regardless of locale order. `literal`
targets the localized separator. The element also exposes `field`, `segments`,
`leading`, `label`, `hint`, `clear`, and `trailing`. Don't override the internal
`--input-time-*` values directly; they are defaults, not a styling API.

```css
/* Make one field fill its container (the default is content-width). Style all
   editable segments, then keep AM/PM and the locale separator quieter. */
.my-time { width: 100%; }
.my-time::part(segments) { color: #e5484d; }
.my-time::part(period) { color: var(--text-3); }
.my-time::part(literal) { color: var(--text-4); }
```

The example classes are consumer selectors; replace them with your own.

Drop the clock icon with the `icon={false}` prop, and point the `segments` part at
a monospaced family for fixed-width digits — a small `padding-top` re-centers the
tighter `1em` line:

```tsx
<InputTime icon={false} className="plain-time" defaultValue="09:30" />

<style>{`
  .plain-time::part(segments) {
    font-family: var(--monospace, ui-monospace, monospace);
    line-height: 1em;
    padding-top: 2px;
  }
`}</style>
```

For a one-off accent, `tone` takes **any literal CSS color** (e.g. `#7c3aed`) and
tints the resting + hover border — the focus ring stays the global ring. It's a
color, not a named tone; the named feedback tones live on `status`.

```tsx
<InputTime label="Accent" tone="#7c3aed" defaultValue="09:30" />
```
