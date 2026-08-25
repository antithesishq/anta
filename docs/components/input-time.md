# InputTime

**`InputTime`** is a segmented wall-clock field: one boxed input, like the others,
holding separate **hour** and **minute** sections — plus an **AM/PM** section in
12-hour locales — that behave as a single control. Each section is a native text
input:
↑/↓ steps its value (wrapping 59 → 00), ←/→
moves between sections at the caret boundary, and typing a digit fills the section
and advances to the next once it can't hold more. AM/PM accepts its locale text or
`a` / `p`.

A leading clock icon marks the affordance (change it with `icon`). Unlike a text
`Input` (which fills its container), the field **sizes to its content** — a time
is a small, fixed control — so set a `width` (e.g. `style={{ width: '100%' }}`) if
you want it to fill. The value is a 24-hour `"HH:mm"` string (`''` until both hour
and minute are set), never a `Date`. It works controlled (`value` + `onValueChange`)
or uncontrolled (`defaultValue`), and submits under `name` via the native form APIs.

## The field

Focus a section and edit it with the keyboard: ↑/↓ to step (it
wraps), PageUp/PageDown for a larger jump on minutes,
or enter the digits. Home/End, selection, deletion, and
paste behave as they do in a native text input. Typing
`9` then `3` `0` lands `09:30` and moves across the sections on its own; an
out-of-range digit (a `6` in the minutes) commits and advances immediately.
Backspace on an empty section selects the previous one. The whole thing
reads as one field while preserving native caret behavior. In a
12-hour field, typing a 24-hour hour converts it and flips AM/PM — `18` becomes
`6 PM`, so pasted 24-hour times work.

```tsx
<InputTime label="Start time" defaultValue="09:30" onValueChange={(_, { value }) => save(value)} />
```

## Locale

The clock follows the locale: `en-US` shows 12-hour with an AM/PM section, most
others show 24-hour with none. It's derived from `Intl` (the resolved `hourCycle`),
and the section **order**, the **separator**, and the **AM/PM text** all come from
the locale too — Japanese renders the period first (`午後2:05`), Finnish separates
with a dot (`14.05`), and 24-hour locales drop the AM/PM section entirely. Set
`hour12` to force one clock regardless of locale.

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
placeholder dashes. `disabled` behaves as it does on `Input`.

`min` and `max` (24-hour `"HH:mm"`) bound the value: a complete time outside the
range is clamped to the nearest bound as you step or leave the field, and flags
`rangeUnderflow` / `rangeOverflow` for form validity in the meantime.

```tsx
<InputTime label="Meeting" size="small" defaultValue="10:00" clearable />
<InputTime label="Deadline" status="critical" hint="Pick a time in the future." />
<InputTime label="Office hours" size="large" min="09:00" max="17:00" defaultValue="09:30" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `autoFocus?` | boolean | — | Focus this field when its containing `Dialog` opens. |
| `children?` | ReactNode | — | Extra content rendered under the field, above the hint (a no-box child like
 a `<Tooltip>` takes no space and anchors to the field). |
| `clearable?` | boolean | — | Show a clear button once the field has a value. |
| `defaultValue?` | string | — | Initial value for the uncontrolled case (24-hour `"HH:mm"`). |
| `dimActions?` | boolean | — | Dim the trailing adornments at rest; they brighten on hover / focus. |
| `disabled?` | boolean | — | Disable the field. |
| `hint?` | ReactNode | — | Message below the field. `status` recolors it and prefixes a glyph. |
| `hour12?` | boolean | — | Force the clock: `true` = 12-hour (AM/PM), `false` = 24-hour. Omit to follow
 the locale. |
| `icon?` | false \| IconShape | clock | Leading icon at the start of the field — the clock affordance. Pass another
 shape to change it, or `false` to drop it. |
| `label?` | ReactNode | — | Field label, shown above the control and used as the segment group's
 accessible name. |
| `locale?` | string | navigator.language | BCP-47 locale driving the clock (12h vs 24h), segment order, separator, and
 the AM/PM text. |
| `max?` | string | — | Latest allowed time, 24-hour `"HH:mm"`. A complete value above it is clamped
 down (on step / blur) and flagged `rangeOverflow`. |
| `min?` | string | — | Earliest allowed time, 24-hour `"HH:mm"`. A complete value below it is
 clamped up (on step / blur) and flagged `rangeUnderflow` for form validity. |
| `name?` | string | — | Form field name — the 24-hour value submits under this key. |
| `onBlur?` | (e) => void | — | Fires when the field loses focus. |
| `onClearInput?` | (e) => void | — | Fires after the built-in clear button has cleared the field. |
| `onFocus?` | (e) => void | — | Fires when the field gains focus. |
| `onValueChange?` | (event, attrs) => void | — | Fires on every edit (`input`), with the native event + an `attrs` snapshot
 (`value`, `name`, `empty`, `valid`, `validationMessage`). Also fires on
 `change` (blur) and on clear. |
| `required?` | boolean | — | Mark the field required (drives native validity). |
| `round?` | boolean \| number \| string | — | Fully-round the field, or a custom radius (`number` px / CSS length). |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Size variant. small=24px, medium=28px, large=32px tall. |
| `status?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' | — | Validation / feedback tone. Only `critical` marks the field invalid; the
 others are advisory. Omit (or `neutral`) for a plain field. |
| `statusIcon?` | (string & {}) \| false \| IconShape | — | Glyph before the `hint` when `status` is set (per-status default; pass a
 shape to override, or `false` to drop it). |
| `tone?` | string | — | Custom accent color — any literal CSS color tints the resting + hover
 border (focus ring stays `--focus-ring`); `status` overrides for validation. |
| `trailing?` | ReactNode | — | Content pinned to the end of the field (after the clear button). |
| `value?` | string | — | Controlled value — 24-hour `"HH:mm"`. Pair with `onValueChange`. |

Use the web component directly when you are not using React or Preact and a native control does not fit.

Slots supply the field label and leading icon.

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

`InputTime` renders an `<a-input-time>` whose field chrome mirrors `<a-input>`.
Route feedback color through `status`; everything else is reachable as plain CSS on
the host or through `::part()`. `segment` targets every editable input. `hour`,
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
