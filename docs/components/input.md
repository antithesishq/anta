# Input

A text field. The `Input` wrapper renders an `<a-input>` web component whose
real `<input>` / `<textarea>` lives in **shadow DOM** — so the field is
self-contained (you never pass a control in) yet fully native underneath:
focus, IME, autofill, and form submission all work, and the control is reachable
for styling through `::part(input)`.

## Sizes

```tsx
<Input size="small"  label="Small"  placeholder="24px tall" />
<Input size="medium" label="Medium" placeholder="28px tall" /> {/* default */}
<Input size="large"  label="Large"  placeholder="32px tall" />
```

Three sizes (`medium` is the default). The field **height**, the **type scale**
(font / line-height), and the **icon** all track the size. Each step matches
Anta's text scale, so a field lines up with same-size `Text` / `Button`.

| size | height | font / line | icon |
|---|---|---|---|
| `small` | 24px | 13 / 16 | 14px |
| `medium` | 28px | 15 / 20 | 16px |
| `large` | 32px | 17 / 22 | 18px |

## Label and hint

```tsx
<Input label="Display name" defaultValue="Ada Lovelace" />
<Input label="API key" hint="Find this in Settings → Developers." placeholder="sk-…" />
```

`label` sits above the field; `hint` is neutral helper text below it
(`--text-3`, no icon). Both accept a **string or a React node**, so you can
embed links, `<code>`, or a `<Text>` for full control.

The label is wired as the control's accessible name automatically — the element
mirrors the label text into `aria-label`, since a native `<label for>` can't
cross the shadow boundary. The `hint` (or error) is mirrored the same way into
`aria-description`, so a screen reader announces the message too.

## Tooltip

```tsx
{/* Drop a <Tooltip> in as a child — it attaches to the field and shows on hover,
    exactly like a tooltip on any other element. */}
<Input label="API key" placeholder="sk-…">
  <Tooltip>Find this in Settings → Developers.</Tooltip>
</Input>
```

Attach a tooltip by dropping an Anta `<Tooltip>` in as a **child** — no slot or
prop needed. It anchors to the field and shows on hover, consistent with how
tooltips attach to a `<Button>` or any other element. (Children with no `slot`
are projected into a default slot; use `leading` / `trailing` for *in-field*
content.)

## Status

```tsx
{/* No status = neutral helper text */}
<Input label="Display name" defaultValue="Ada Lovelace" hint="This is your public name." />
<Input label="Workspace" defaultValue="acme" status="info" hint="Lowercase letters and dashes only." />
<Input label="Username" defaultValue="ada" status="success" hint="Username is available." />
<Input label="Password" type="password" defaultValue="hunter2" status="warning" hint="Weak — add more characters." />
<Input label="Email" defaultValue="not-an-email" status="critical" hint="Enter a valid email address." />
<Input label="Plan" defaultValue="Pro" status="brand" hint="You're on the Pro plan." />
```

`status` tints the border and the `hint`, and prefixes a glyph — `critical`,
`warning`, `success`, `info`, or `brand`. Each pulls its tone's role tokens, so
dark mode is automatic. The message always rides in `hint`; `status` only
recolors it.

It reuses the tone palette but isn't `tone`: **`status` is a validation *state*** (it
also carries the glyph and, for `critical`, validity), whereas `tone` — elsewhere in
Anta — is decorative color. On `Input` the named tones live on `status`; `tone` is
reserved for a one-off custom border color.

Only `status="critical"` carries validity — it sets `aria-invalid`, flips the
`:state(invalid)` hook, and reports invalid to a surrounding `<form>` through
`ElementInternals`. The other tones are advisory and stay valid.

Each status has a default glyph (`critical` → `warning-diamond`, `warning` →
`warning-triangle`, `success` → `circle-check`, `info` → `info`, `brand` →
`circle-small-solid`). Override it with **`statusIcon`** (any shape), or drop it
with `statusIcon={false}`.

## Leading, trailing, and clear

```tsx
{/* clearable — the clear button shows once there's a value */}
{/* dimActions — adornments rest quiet, brighten when the field is hovered/focused */}
<Input label="Search" placeholder="Search…" clearable dimActions defaultValue="design tokens" />

{/* type="search" is a shorthand for the leading search icon + clearable below */}
<Input label="Search" type="search" placeholder="Search…" />

{/* leading / trailing take any node — see the live playground above */}
<Input label="Search" leading={<Icon shape="search" />} clearable dimActions />
<Input
  label="Date"
  leading={<Icon shape="calendar" />}
  trailing={<Button priority="quaternary" size="small" icon="eye" aria-label="Pick" />}
  dimActions
/>
```

`leading` and `trailing` paste any node at the field edges (like the expander's
`actions`) — an icon, a button, a unit label. A leading item is inset from the
left by the same `pad-x` as the text, so it lines up on the field's rhythm; the
playground at the top of this page shows a live leading icon alongside the clear
button.

**`type="search"`** is a shorthand for that search pattern: it defaults a leading
search icon and `clearable` (override either — pass your own `leading`, or
`clearable={false}`). It's wrapper-only — the native `search` type never reaches the
DOM input, so the browser's own clear/search chrome never appears; Anta owns it.

**`dimActions`** rests the adornments quiet (60% opacity) and brightens them to
full when the field is hovered or focused — a "quiet until engaged" look for
trailing actions. It dims the whole slot, so it covers icons and buttons alike.

`clearable` adds a clear button at the right edge, shown once the field has a
value. It's a real `<a-button>` in the `clear` slot — full button styling,
**keyboard-focusable** — and it works **without framework hydration**: a-button's
global handler fires a `clearrequest` trigger on click and Enter/Space, which the
element turns into the lifecycle below.

Two hooks bracket the clear. **`onClearClick`** fires first and is **cancelable** —
`e.preventDefault()` keeps the value (e.g. a "discard unsaved text?" confirm). If
it isn't prevented, the field clears: it empties, fires `input` / `change` (a
controlled `onChange` runs with the empty value), refocuses, then fires
**`onClearInput`**. On a raw `<a-input>`, bind both lowercase (`onclearclick` /
`onclearinput`) — that form binds in React and Preact alike.

Note: there's no `type="search"` — that type makes browsers inject their own
clear button and magnifier (and style them inconsistently). Anta owns every
in-field control, and the element resets the native search/number/reveal
decorations across browsers.

### Password reveal

```tsx
// Reveal toggle = flip `type` between password and text. Native masking when
// hidden, plain text when shown; password managers keep working.
const [reveal, setReveal] = useState(false)

<Input
  label="Password"
  type={reveal ? 'text' : 'password'}
  defaultValue="hunter2"
  dimActions
  trailing={
    <Button
      priority="tertiary"
      icon={reveal ? 'eye-closed' : 'eye'}
      aria-label={reveal ? 'Hide password' : 'Show password'}
      onClick={() => setReveal(v => !v)}
    />
  }
/>
```

A `trailing` eye `<Button>` flips the field's `type` between `password` and
`text` — native disc masking when hidden, plain text when revealed. Because it
stays a real `type="password"` when hidden, password managers and autofill keep
working, and the uncontrolled value is preserved across the toggle.

The mask glyph stays the browser default — restyling it means dropping
`type="password"`, which loses password-manager support and isn't masked in
Firefox. So Anta keeps the native field.

## Multiline

```tsx
{/* Grows with content, capped at 6 rows, then scrolls */}
<Input multiline maxRows={6} label="Bio (autogrows)" placeholder="Tell us…" />

{/* Constant height of 3 rows */}
<Input multiline rows={3} label="Notes (fixed 3 rows)" placeholder="…" />
```

`multiline` renders a `<textarea>` under the same API. With **no `rows`** it
**autogrows** with its content via CSS `field-sizing: content` — capped by
`maxRows` if you set one (omit for unbounded growth), then it scrolls. Pass a
fixed **`rows`** count for a constant-height box instead.

Autogrow uses CSS `field-sizing` where supported (Chromium, Safari ≥ 26.2) and a
built-in JS resize everywhere else (Firefox, older Safari), so it grows in every
browser.

## Controlled and uncontrolled

```tsx
// Uncontrolled: the element updates its value after input.
<Input label="Name" defaultValue="Ada" onChange={(e) => log(e.target.value)} />

// Controlled: application state supplies the value.
const [v, setV] = useState('')
<Input label="Name" value={v} onInput={(e) => setV(e.target.value)} />
```

Like a native input: pass `defaultValue` for **uncontrolled**, or `value` +
`onInput` / `onChange` for **controlled**. The controlled value is reflected to
the shadow control only when it differs from what's there, so the caret never
jumps mid-edit.

Read the value off `e.target.value` in either handler — the event retargets to
the `<a-input>` host, whose `value` getter returns the control's value.

Note: like other custom-element form controls (and unlike React's built-in
`<input>`), a controlled value that you *transform* applies on the next render,
but one you *reject* — set state back to the same string — isn't auto-reverted,
since the framework skips the re-render. Constrain hard with `maxLength` /
`pattern` / `type`, or transform in the handler.

## Events

| handler | fires | payload |
|---|---|---|
| `onInput(e)` | on **every keystroke** | read `e.target.value` |
| `onChange(e)` | on **commit** (blur / Enter) — native `change` semantics, *not* React's per-keystroke `onChange` | read `e.target.value` |
| `onValueChange(e, attrs)` | on `input` **and** `change` (and clear) | `{ value, name, empty, valid, validationMessage }` |
| `onClearClick(e)` | before the `clearable` × clears | ✅ `e.preventDefault()` keeps the value |

**Input has no `onStateChange`, on purpose.** That event belongs to components
with a *discrete* state — a small enum like `Checkbox`'s `checked · unchecked ·
indeterminate` or a menu's `open · closed` — where a transition can be vetoed as
a unit before it applies. A text field's value is **free-form**, not a discrete
state, so there's nothing to model as `state` and nothing to veto wholesale;
you control it the native way (`value` + `onInput`/`onChange`, reject by not
updating). Reach for `onValueChange` as the one unified "the value changed"
handler — it's the same callback `Checkbox`, `RadioGroup`, and `Select` expose,
so form code reads the same across all of them. (`Select`, likewise composed and
value-based, also has only `onValueChange`.)

## Forms

```tsx
<form onSubmit={handle}>
  <Input name="email" label="Email" type="email" required clearable />
  <Button tone="brand" type="submit" label="Sign up" />
  <Button priority="tertiary" type="reset" label="Reset" />
</form>
```

Because `<a-input>` is form-associated, it submits with the surrounding
`<form>` under its `name` — `new FormData(form)` includes it, no hidden mirror
needed. `required` participates in native validity, and `<Button type="reset">`
restores the field to its `defaultValue` via `formResetCallback`.

## Types and validation

```tsx
<Input type="text"     label="Text" />
<Input type="email"    label="Email" />
<Input type="password" label="Password" />
<Input type="tel"      label="Tel" />
<Input type="url"      label="URL" />
<Input type="number"   label="Number" min={0} max={100} />
```

`type` accepts `text` (default), `email`, `password`, `tel`, `url`, and
`number` — each gets the right mobile keyboard, autofill behavior, and native
constraint validation. (`search` is omitted on purpose — see above.)
`number` also takes `min` / `max` / `step`.

For a **controlled** numeric field — one whose `value` you hold in state — prefer
`type="text"` with `inputMode="decimal"` (or `"numeric"`) over `type="number"`. A
number input runs value sanitization, so a mid-typing `"1."` or `"1.0"` reports an
empty `value` and can't be entered; storing the parsed `Number` and rendering it
back drops the decimal for the same reason. Keep the raw string in state and parse
to a number where you use it — `inputMode` still brings up the numeric keypad. An
**uncontrolled** `type="number"` (no bound `value`) has neither problem.

Every type carries its native constraints (`required`, the `type` itself,
`pattern`, `min`/`max`, `min`/`maxLength`). The field reports them to the
surrounding `<form>` automatically (via `ElementInternals`), so submission is
blocked while invalid — no extra wiring.

### Native validation

```tsx
// Surface the browser's own validity messages as Anta's critical-status UI.
const [errors, setErrors] = useState({})

function onSubmit(e) {
  e.preventDefault()
  const next = {}
  e.currentTarget.querySelectorAll('a-input').forEach((el) => {
    if (!el.checkValidity()) next[el.name] = el.validationMessage
  })
  setErrors(next)
}

<form noValidate onSubmit={onSubmit}>
  <Input name="email" type="email" required hint={errors.email}
         status={errors.email ? 'critical' : undefined}
         onInput={() => setErrors(p => ({ ...p, email: undefined }))} />
  <Input name="age" type="number" min="18" max="120" hint={errors.age}
         status={errors.age ? 'critical' : undefined}
         onInput={() => setErrors(p => ({ ...p, age: undefined }))} />
  <Button type="submit" label="Submit" />
</form>
```

The element proxies native validity: `<a-input>` exposes `checkValidity()` and
`validationMessage` (the browser's localized message).

Pass `validationMessage` to **`hint`** and set **`status="critical"`** — the
field goes red, shows the warning glyph, and reports invalid to the form. Mark
the form `noValidate` so the browser's default bubbles step aside for Anta's
styling. Try submitting empty, or with a bad email / out-of-range age.

**Enter doesn't submit the form.** The real `<input>` lives in shadow DOM, so
it isn't a light-DOM member of the `<form>`, and pressing Enter won't trigger
native implicit submission — a deliberate choice, since auto-submitting a
half-filled multi-field form is usually more annoyance than help. To submit on
Enter, handle it yourself (`onKeyDown` → `form.requestSubmit()`), or reach for
Anta's upcoming `<Form>` component. Everything else — value submission under
`name`, `checkValidity()`, `formReset` — works natively.

## Layout

The label, field, and hint **aren't hardcoded to "stacked."** The element lays
them out as a single-column **grid** (hence the default label-above / hint-below
rhythm) and exposes each region as a shadow part (`label`, `field`, `hint`).
Rearrange them from your own CSS: re-template the grid on `a-input`, then place
the parts. No layout prop to learn — your rule wins because the element's
defaults live in `@layer anta`.

And because each `<a-input>` is itself a normal grid/flex item, **wrapping** is
just sizing: give the inputs a `min-width` (and maybe `max-width`) inside any
wrapping container and they reflow by available width — the field's internal
grid is independent of how the fields themselves flow.

The `.label-side` / `.aligned-form` / `.wrap-fields` classes below are only to
scope each demo — swap your own selector.

### Label on the left

Re-template the host to two columns and drop each part into one. The hint stays
under the field by landing in the same column.

```tsx
<Input className="label-side" label="Display name" hint="Shown on your profile" />

{/* .label-side is just for the demo — use your own selector */}
<style>{`
  a-input.label-side {
    grid-template-columns: max-content minmax(0, 1fr);
    column-gap: 12px;
    align-items: center;
  }
  a-input.label-side::part(label) { grid-column: 1; }
  a-input.label-side::part(field) { grid-column: 2; }
  a-input.label-side::part(hint)  { grid-column: 2; }
`}</style>
```

### Label column

Put the fields in a grid and let each one adopt the form's tracks with
`grid-template-columns: subgrid` — which reaches *through* the shadow boundary,
so every label shares one column sized to the longest label, and every field
left-edge lines up. Each hint still tucks under its own field.

```tsx
<div className="aligned-form">
  <Input label="Email" type="email" hint="We'll never share it." />
  <Input label="Confirm password" type="password" />
  <Input label="PIN" />
</div>

<style>{`
  /* one shared label column; subgrid lets each field adopt the form's tracks */
  .aligned-form { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 16px 12px; }
  .aligned-form > a-input { grid-column: 1 / -1; grid-template-columns: subgrid; align-items: center; }
  .aligned-form > a-input::part(label) { grid-column: 1; }
  .aligned-form > a-input::part(field),
  .aligned-form > a-input::part(hint)  { grid-column: 2; }
`}</style>
```

### Hint on the right

Put the hint beside the field instead of under it — a short note, a counter, a
unit. Two columns (field, then hint); the label spans the top, and the hint
centers against the field.

```tsx
<Input className="hint-right" label="Username" hint="3–20 characters" placeholder="ada" />

<style>{`
  a-input.hint-right {
    grid-template-columns: minmax(0, 1fr) max-content;
    column-gap: 10px;
  }
  a-input.hint-right::part(label) { grid-column: 1 / -1; }
  a-input.hint-right::part(field) { grid-column: 1; grid-row: 2; }
  a-input.hint-right::part(hint)  { grid-column: 2; grid-row: 2; align-self: center; padding-top: 0; }
`}</style>
```

### Wrap by field width

Leave the fields stacked and let an outer grid flow them into as many columns as
fit — `minmax(200px, 1fr)` makes each field claim at least 200px, so the row
wraps to fewer columns as it narrows. Resize the preview to see it reflow.

```tsx
<div className="wrap-fields">
  <Input label="First name" />
  <Input label="Last name" />
  <Input label="Email" type="email" />
  <Input label="Phone" type="tel" />
</div>

<style>{`
  /* fields stay stacked; the grid wraps them by available width */
  .wrap-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
`}</style>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `autoComplete?` | 'off' \| 'on' \| 'name' \| 'username' \| 'email' \| 'current-password' \| 'new-password' \| 'one-time-code' \| 'tel' \| 'url' \| (string & {}) | — | Native autocomplete token. Overrides the value derived from `type`
 (`email` / `tel` / `url`) — set it for the cases `type` can't express, e.g.
 `username`, `current-password`, `new-password`, `one-time-code`, or `off`. |
| `children?` | ReactNode | — | Extra content rendered directly under the field, above the hint/error (it
 pushes the message down). A no-box child like an Anta `<Tooltip>` takes no
 space and anchors to the field — consistent with how tooltips attach
 to any other element. Use the named `leading` / `trailing` props for
 in-field content. |
| `clearable?` | boolean | — | Show a clear button as the first trailing item once the field has a
 value. |
| `defaultValue?` | string | — | Initial value for the uncontrolled case. |
| `dimActions?` | boolean | — | Dim the `leading` / `trailing` adornments at rest; they brighten to full
 when the field is hovered or focused (a quiet-until-engaged affordance for
 trailing actions). |
| `disabled?` | boolean | — | Disable the field. |
| `hint?` | ReactNode | — | Message below the field. Neutral helper text by default; `status` recolors
 it and prefixes the matching glyph. |
| `inputMode?` | 'none' \| 'text' \| 'decimal' \| 'numeric' \| 'tel' \| 'search' \| 'email' \| 'url' | — | Virtual-keyboard hint. Overrides the value derived from `type`. |
| `label?` | ReactNode | — | Field label, shown above the control. A string is rendered with the
 label type scale; pass a node for full control. Associated with the
 control as its accessible name (the element mirrors the label text to
 `aria-label`, since `<label for>` can't cross the shadow boundary). |
| `leading?` | ReactNode | — | Content pinned to the start of the field (e.g. an icon). |
| `max?` | number \| string | — |  |
| `maxLength?` | number | — | Max input length. |
| `maxRows?` | number | — | Cap the autogrow height (in rows) of a `multiline` field with no `rows`.
 Omit for unbounded growth. |
| `min?` | number \| string | — | Min / max / step — for `type="number"`. |
| `minLength?` | number | — | Min input length. |
| `multiline?` | boolean | — | Render a `<textarea>` instead of an `<input>`. Without `rows` it grows
 with its content from one line (capped by `maxRows` if set). Autogrow uses
 CSS `field-sizing` where supported (Chrome/Edge, Safari ≥ 26.2) and falls
 back to a built-in JS resize elsewhere (Firefox, older Safari), so it grows
 in every browser. |
| `name?` | string | — | Form field name — submitted with the form via ElementInternals. |
| `onBlur?` | (e) => void | — | Fires when the field loses focus. |
| `onChange?` | (e) => void | — | Fires on **commit** (blur / Enter) — the platform `change` semantics, **not**
 React's per-keystroke `onChange`. This is a web component, so `onChange` keeps
 the native meaning; reach for `onInput` (every keystroke) or `onValueChange`
 (both) for live updates. Read `e.target.value`. |
| `onClearClick?` | (e) => void | — | Fires when the built-in clear button (`clearable`) is clicked, *before*
 the field is cleared. Call `e.preventDefault()` to keep the current value
 — the clear is cancelled and `onClearInput` won't fire. Backed by the
 element's cancelable, bubbling `clearclick` event. |
| `onClearInput?` | (e) => void | — | Fires after the built-in clear button (`clearable`) has cleared the field
 — so `onInput` / `onChange` fire too — making this useful for reacting
 specifically to a clear. Doesn't fire if `onClearClick` cancelled the
 clear. Backed by the element's bubbling `clearinput` event. |
| `onFocus?` | (e) => void | — | Fires when the field gains focus. |
| `onInput?` | (e) => void | — | Fires on every keystroke. Read `e.target.value`. |
| `onValueChange?` | (event, attrs) => void | — | Unified value-change handler — the easy path for state. Fires on `input`
 *and* `change` (and on clear), with the native `event` plus a convenience
 `attrs` snapshot (`value`, `name`, `empty`, `valid`, `validationMessage`) so
 you can do `setForm(s => ({ ...s, [attrs.name]: attrs.value }))` without
 digging into the event. Use `event.type` to tell a live edit (`input`) from
 a commit (`change`); read `id` / `type` / `className` off `event.target`. |
| `pattern?` | string | — | Validation pattern (single-line). |
| `placeholder?` | string | — | Placeholder shown when empty. |
| `readOnly?` | boolean | — | Make the field read-only. |
| `required?` | boolean | — | Mark the field required (drives native validity). |
| `role?` | string | — | ARIA `role` for the field — e.g. `combobox` when the input drives a
 suggestion `listbox` (see `InputAutocomplete`). Left unset by default. |
| `round?` | boolean \| number \| string | — | Fully-round the field (`border-radius: 999px`). Pass a `number` (px) or a CSS
 length string for a custom radius. The `clearable` × button always rounds to
 a circle to match (it isn't sized by a custom field value). |
| `rows?` | number | — | Fixed visible row count — a constant-height `<textarea>` (implies
 `multiline`). |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Size variant. small=24px, medium=28px, large=32px tall; the type scale and
 icon track the size (small 13/16 + 14px icon · medium 15/20 + 16px ·
 large 17/22 + 18px). |
| `spellCheck?` | boolean | — | Toggle native spell-checking. |
| `status?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' | — | Validation / feedback tone — colors the border + `hint` and prefixes a
 glyph. Only `critical` marks the field invalid (`aria-invalid`, blocks form
 submission, `:state(invalid)`); `success` / `warning` / `info` / `brand`
 are advisory and stay valid. Omit (or `neutral`) for a plain field. |
| `statusIcon?` | (string & {}) \| false \| IconShape | — | Glyph shown before the `hint` when `status` is set. Each status has a
 default (critical → `warning-diamond`, warning → `warning-triangle`,
 success → `circle-check`, info → `info`, brand → `circle-small-solid`); pass a
 shape to override, or `false` to drop it. `neutral` has no default glyph. |
| `step?` | number \| string | — |  |
| `tone?` | string | — | Custom accent color — any literal CSS color tints the resting + hover
 border (focus ring stays the global `--focus-ring`). For consistency with the
 other controls' custom-tone knob; a `status` still overrides for validation. |
| `trailing?` | ReactNode | — | Content pinned to the end of the field (e.g. icons, buttons), after the
 clear button when `clearable`. |
| `truncate?` | boolean | true | Ellipsize an overflowing single-line value. Read-only inputs already do
this; pass `false` when an editable field should show the full value. |
| `type?` | 'text' \| 'search' \| 'email' \| 'password' \| 'tel' \| 'url' \| 'number' | text | Single-line input type. Ignored when `multiline`. `search` is a
 **wrapper-only** shorthand: it defaults a leading search icon and a clear
 button (both overridable — pass your own `leading`, or `clearable={false}`)
 and sets `inputmode="search"`, but the DOM input stays `type="text"`. The
 native `search` type never reaches the element, so the browser's own
 clear/search affordances never appear — Anta owns that chrome. |
| `value?` | string | — | Controlled value. Pair with `onChange` / `onInput`. |

Use the web component directly when you are not using React or Preact and a native control does not fit.

Slots hold the label, hint, and controls around the native field.

```html
<a-input name="email" placeholder="you@example.com">
  <span slot="label">Email</span>
  <span slot="hint">We only use it for account notices.</span>
</a-input>
```

### Native HTML inputs

For a standard HTML form, add `data-anta` to a native input. Text, search,
email, telephone, URL, password, and number inputs keep their native editing,
keyboard, validation, and form behavior while using Anta's field chrome. Search
keeps its browser-supplied affordances; file keeps its native chooser and selected
file name, with an Anta-styled chooser button. `submit` and `reset` inputs use the
matching Anta button chrome; set `priority="primary"` on a submit control when it
is the form's main action.

Use `data-anta-size="small"` or `"large"` for field sizing. Native inputs own
their `size` attribute, so Anta does not reuse it. `round` and a custom-color
`tone` work the same way as Input.

```html
<input data-anta data-anta-size="small" type="text" name="name" placeholder="Small text">
<input data-anta type="search" name="search" placeholder="Search">
<input data-anta type="email" name="email" placeholder="Email">
<input data-anta type="tel" name="phone" placeholder="Telephone">
<input data-anta round type="url" name="site" placeholder="Rounded URL">
<input data-anta type="password" name="password" value="password">
<input data-anta tone="rebeccapurple" type="number" name="seats" value="3" min="1">
<input data-anta type="file" name="attachment" accept=".pdf,.docx">

<input data-anta type="submit" value="Submit" priority="primary">
<input data-anta type="reset" value="Reset">
```

Reach for the props first: **`status`** sets a validation tone (border + message),
**`tone`** a custom accent color for the border (any CSS color), **`size`** the
dimensions. The focus ring is the global [`--focus-ring`](../colors.md#focus-ring).

```tsx
<Input tone="#e0457b" label="Custom accent" />
```

For everything else, `<a-input>` is shadow-DOM — style its **parts** with plain
CSS: `::part(field | input | label | leading | trailing | clear | hint)`, plus the
`:state(filled)` / `:state(invalid)` state hooks and `:focus-within::part(field)`
for the focused state. The clear button is a real `<a-button>` in the `clear` slot,
so style it directly. `light-dark()` works too (Anta sets `color-scheme` from its
theme toggle).

```css
a-input::part(field) { border-radius: 999px; }
a-input::part(input) { font-variant-numeric: tabular-nums; }
a-input::part(label) { text-transform: uppercase; }
```

The border is drawn as an **inset `box-shadow`**, not a real `border`, so its width
(`0.5px` → `1px` when a `status` is set) and placement never change the box size —
the field height stays locked to the matching Button. Drop the leading `inset` to
draw the border as an outset ring instead. You can also re-point an `--input-*`
color token on one instance (`style={{ '--input-border': 'var(--border-1)' }}`)
or a wrapping selector; the resolver lives in `@layer anta`, so any un-layered rule
of yours wins.

The `.fancy` class is just for the demo — a borderless pill that fills dark-grey
and darkens on focus in light mode, and the inverse in dark:

```css
/* a borderless pill — the resting border is a box-shadow, so clear it. Dark-grey
   fill that darkens on focus, white text; the inverse in dark mode via light-dark()
   (Anta drives color-scheme from its theme toggle). */
a-input.fancy::part(field) {
  border-radius: 999px;
  box-shadow: none;                          /* remove the box-shadow border */
  background: light-dark(#3a3a3a, #ececec);
  padding-block: 10px;
  padding-inline: 20px;                      /* roomier */
}
a-input.fancy::part(input) { color: light-dark(#ffffff, #1a1a1a); }
a-input.fancy:focus-within::part(field) { background: light-dark(#161616, #ffffff); }
```
