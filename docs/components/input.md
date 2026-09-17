# Input

Collect text with labels, feedback, validation, and optional field actions.

## Size and shape

`medium` is the default. Use `round` for a pill or pass a radius.

```tsx
<Input size="small" label="Small" />
<Input size="medium" label="Medium" />
<Input size="large" label="Large" />
<Input round label="Rounded" />
```

## Labels and help

Use `label` for the accessible name and `hint` for persistent help. Add a
`Tooltip` child for optional help.

```tsx
<Input label="Display name" defaultValue="Ada Lovelace" />
<Input label="API key" hint="Find this in Settings → Developers." />

<Input label="Workspace">
  <Tooltip>Lowercase letters and dashes only.</Tooltip>
</Input>
```

Labels and hints accept strings or React nodes. Anta connects both to the native
control for assistive technology.

## Status

`status` colors the field and hint. Only `critical` marks the field invalid.

```tsx
<Input status="info" hint="Lowercase letters and dashes only." />
<Input status="success" hint="Username is available." />
<Input status="warning" hint="Add more characters." />
<Input status="critical" hint="Enter a valid email address." />
<Input status="brand" hint="You’re on the Pro plan." />
```

| Status | Use |
| --- | --- |
| `info` | Guidance |
| `success` | Confirmed value |
| `warning` | Value needs attention |
| `critical` | Invalid value |
| `brand` | Product-specific feedback |

Set `statusIcon` to replace the default glyph or `false` to hide it.

## Content and actions

Use `leading` and `trailing` for icons, units, or buttons. `clearable` adds
a keyboard-accessible clear button.

```tsx
{/* Search adds a search icon and clear button */}
<Input label="Search" type="search" />

<Input label="Price" leading="$" trailing="USD" inputMode="decimal" />

<Input
  label="Date"
  leading={<Icon shape="calendar" />}
  trailing={<Button icon="chevron-down" aria-label="Choose date" />}
  dimActions
/>
```

`dimActions` quiets adornments until the field is hovered or focused.

**Password reveal**

```tsx
const [reveal, setReveal] = useState(false)

<Input
  label="Password"
  type={reveal ? 'text' : 'password'}
  trailing={
    <Button
      priority="tertiary"
      icon={reveal ? 'eye-closed' : 'eye'}
      aria-label={reveal ? 'Hide password' : 'Show password'}
      onClick={() => setReveal(value => !value)}
    />
  }
/>
```

Keep `type="password"` while hidden so password managers and autofill continue
to work.

## Multiline

Use `multiline` for an autogrowing textarea. Set `maxRows` to cap its height
or `rows` for a fixed height.

```tsx
<Input multiline maxRows={6} label="Bio" />
<Input multiline rows={3} label="Notes" />
```

## Forms and validation

Set `name` to include the field in `FormData`. Native constraints such as
`required`, `pattern`, `minLength`, `min`, and `max` participate in form
validation.

```tsx
<form onSubmit={handleSubmit}>
  <Input
    name="email"
    label="Email"
    type="email"
    autoComplete="email"
    required
    clearable
  />
  <Button type="submit" label="Sign up" />
  <Button type="reset" label="Reset" />
</form>
```

Use `status="critical"` with the field’s `validationMessage` to show native
errors in Anta’s feedback style. Pressing Enter does not implicitly submit across
the shadow boundary; handle `onKeyDown` and call `form.requestSubmit()` when
that behavior is needed.

## Values and events

Use `defaultValue` for an uncontrolled field or `value` for a controlled one.

```tsx
<Input defaultValue="Ada" onChange={(event) => save(event.target.value)} />

const [name, setName] = useState('')
<Input value={name} onInput={(event) => setName(event.target.value)} />
```

| Handler | Fires |
| --- | --- |
| `onInput` | Every edit |
| `onChange` | Commit on blur or Enter |
| `onValueChange` | Input, change, and clear |
| `onClearClick` | Before clearing; cancel with `preventDefault()` |
| `onClearInput` | After clearing |

Read the current value from `event.target.value`. `onValueChange` also receives
a snapshot with `value`, `name`, `empty`, `valid`, and
`validationMessage`.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `autoComplete?` | 'off' \| 'on' \| 'name' \| 'username' \| 'email' \| 'current-password' \| 'new-password' \| 'one-time-code' \| 'tel' \| 'url' \| (string & {}) | — | Native autocomplete token. Overrides the value derived from `type` (`email` / `tel` / `url`) — set it for the cases `type` can't express, e.g. `username`, `current-password`, `new-password`, `one-time-code`, or `off`. |
| `autoFocus?` | boolean | — | Focus this field when its containing `Dialog` opens. |
| `button?` | boolean | — | Render the field surface with a native button as its focus target. This is available for Input-styled popup triggers; the value becomes the button text and the placeholder is shown while it is empty. |
| `children?` | ReactNode | — | Extra content rendered directly under the field, above the hint/error (it pushes the message down). A no-box child like an Anta `<Tooltip>` takes no space and anchors to the field — consistent with how tooltips attach to any other element. Use the named `leading` / `trailing` props for in-field content. |
| `clearable?` | boolean | — | Show a clear button as the first trailing item once the field has a value. |
| `defaultValue?` | string | — | Initial value for the uncontrolled case. |
| `dimActions?` | boolean | — | Dim the `leading` / `trailing` adornments at rest; they brighten to full when the field is hovered or focused (a quiet-until-engaged affordance for trailing actions). |
| `disabled?` | boolean | — | Disable the field. |
| `hint?` | ReactNode | — | Message below the field. Neutral helper text by default; `status` recolors it and prefixes the matching glyph. |
| `inputMode?` | 'none' \| 'text' \| 'decimal' \| 'numeric' \| 'tel' \| 'search' \| 'email' \| 'url' | — | Virtual-keyboard hint. Overrides the value derived from `type`. |
| `label?` | ReactNode | — | Field label, shown above the control. A string is rendered with the label type scale; pass a node for full control. Associated with the control as its accessible name (the element mirrors the label text to `aria-label`, since `<label for>` can't cross the shadow boundary). |
| `leading?` | ReactNode | — | Content pinned to the start of the field (e.g. an icon). |
| `max?` | number \| string | — |  |
| `maxLength?` | number | — | Max input length. |
| `maxRows?` | number | — | Cap the autogrow height (in rows) of a `multiline` field with no `rows`. Omit for unbounded growth. |
| `min?` | number \| string | — | Min / max / step — for `type="number"`. |
| `minLength?` | number | — | Min input length. |
| `multiline?` | boolean | — | Render a `<textarea>` instead of an `<input>`. Without `rows` it grows with its content from one line (capped by `maxRows` if set). Autogrow uses CSS `field-sizing` where supported (Chrome/Edge, Safari ≥ 26.2) and falls back to a built-in JS resize elsewhere (Firefox, older Safari), so it grows in every browser. |
| `name?` | string | — | Form field name — submitted with the form via ElementInternals. |
| `onBlur?` | (e) => void | — | Fires when the field loses focus. |
| `onChange?` | (e) => void | — | Fires on **commit** (blur / Enter) — the platform `change` semantics, **not** React's per-keystroke `onChange`. This is a web component, so `onChange` keeps the native meaning; reach for `onInput` (every keystroke) or `onValueChange` (both) for live updates. Read `e.target.value`. |
| `onClearClick?` | (e) => void | — | Fires when the built-in clear button (`clearable`) is clicked, *before* the field is cleared. Call `e.preventDefault()` to keep the current value — the clear is cancelled and `onClearInput` won't fire. Backed by the element's cancelable, bubbling `clearclick` event. |
| `onClearInput?` | (e) => void | — | Fires after the built-in clear button (`clearable`) has cleared the field — so `onInput` / `onChange` fire too — making this useful for reacting specifically to a clear. Doesn't fire if `onClearClick` cancelled the clear. Backed by the element's bubbling `clearinput` event. |
| `onFocus?` | (e) => void | — | Fires when the field gains focus. |
| `onInput?` | (e) => void | — | Fires on every keystroke. Read `e.target.value`. |
| `onValueChange?` | (event, attrs) => void | — | Unified value-change handler — the easy path for state. Fires on `input` *and* `change` (and on clear), with the native `event` plus a convenience `attrs` snapshot (`value`, `name`, `empty`, `valid`, `validationMessage`) so you can do `setForm(s => ({ ...s, [attrs.name]: attrs.value }))` without digging into the event. Use `event.type` to tell a live edit (`input`) from a commit (`change`); read `id` / `type` / `className` off `event.target`. |
| `pattern?` | string | — | Validation pattern (single-line). |
| `placeholder?` | string | — | Placeholder shown when empty. |
| `readOnly?` | boolean | — | Make the field read-only. |
| `required?` | boolean | — | Mark the field required (drives native validity). |
| `role?` | string | — | ARIA `role` for the field — e.g. `combobox` when the input drives a suggestion `listbox` (see `InputAutocomplete`). The custom element delegates it, together with standard `aria-*` props, to the focused native shadow control. Left unset by default. |
| `round?` | boolean \| number \| string | — | Fully-round the field (`border-radius: 999px`). Pass a `number` (px) or a CSS length string for a custom radius. The `clearable` × button always rounds to a circle to match (it isn't sized by a custom field value). |
| `rows?` | number | — | Fixed visible row count — a constant-height `<textarea>` (implies `multiline`). |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Size variant. small=24px, medium=28px, large=32px tall; the type scale and icon track the size (small 13/16 + 14px icon · medium 15/20 + 16px · large 17/22 + 18px). |
| `spellCheck?` | boolean | — | Toggle native spell-checking. |
| `status?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' | — | Validation / feedback tone — colors the border + `hint` and prefixes a glyph. Only `critical` marks the field invalid (`aria-invalid`, blocks form submission, `:state(invalid)`); `success` / `warning` / `info` / `brand` are advisory and stay valid. Omit (or `neutral`) for a plain field. |
| `statusIcon?` | (string & {}) \| false \| IconShape | — | Glyph shown before the `hint` when `status` is set. Each status has a default (critical → `warning-diamond`, warning → `warning-triangle`, success → `circle-check`, info → `info`, brand → `circle-small-solid`); pass a shape to override, or `false` to drop it. `neutral` has no default glyph. |
| `step?` | number \| string | — |  |
| `tone?` | string | — | Custom accent color — any literal CSS color tints the resting + hover border (focus ring stays the global `--focus-ring`). For consistency with the other controls' custom-tone knob; a `status` still overrides for validation. |
| `trailing?` | ReactNode | — | Content pinned to the end of the field (e.g. icons, buttons), after the clear button when `clearable`. |
| `truncate?` | boolean | true | Ellipsize an overflowing single-line value. Read-only inputs already do this; pass `false` when an editable field should show the full value. |
| `type?` | 'text' \| 'search' \| 'email' \| 'password' \| 'tel' \| 'url' \| 'number' | text | Single-line input type. Ignored when `multiline`. `search` is a **wrapper-only** shorthand: it defaults a leading search icon and a clear button (both overridable — pass your own `leading`, or `clearable={false}`) and sets `inputmode="search"`, but the DOM input stays `type="text"`. The native `search` type never reaches the element, so the browser's own clear/search affordances never appear — Anta owns that chrome. |
| `value?` | string | — | Controlled value. Pair with `onChange` / `onInput`. |

## Web Component

Use `<a-input>` directly outside React or Preact. Slots provide the label, hint,
and field-edge content.

```html
<a-input name="email" type="email" autocomplete="email" placeholder="you@example.com">
  <span slot="label">Email</span>
  <span slot="hint">Used for account notices.</span>
</a-input>
```

Add `data-anta` to style native inputs and textareas with Anta.

```html
<input data-anta type="email" name="email" placeholder="you@example.com">
<textarea data-anta rows="3" name="notes" placeholder="Notes"></textarea>
```

Use `data-anta-size="small"` or `"large"` for native field sizing.

## Customization

Start with `status`, `tone`, `size`, and `round`. For deeper changes,
style the exposed shadow parts.

```css
a-input::part(field) {
  border-radius: 999px;
}

a-input::part(input) {
  font-variant-numeric: tabular-nums;
}

a-input::part(label) {
  text-transform: uppercase;
}
```

The available parts are `field`, `input`, `label`, `leading`, `trailing`,
`clear`, and `hint`.

Change the layout by redefining the host grid and placing its parts:

```css
a-input.label-side {
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: 12px;
  align-items: center;
}

a-input.label-side::part(label) {
  grid-column: 1;
}

a-input.label-side::part(field),
a-input.label-side::part(hint) {
  grid-column: 2;
}
```
