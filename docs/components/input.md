# Input

Enter and edit text with a label, helpful message, and optional actions. Use
Input for forms, search fields, passwords, and multiline notes. Its native
control supports browser editing and form validation.

## Size

```tsx
<Input size="small"  label="Small"  placeholder="24px tall" autoComplete="off" />
<Input size="medium" label="Medium" placeholder="28px tall" autoComplete="off" /> {/* default */}
<Input size="large"  label="Large"  placeholder="32px tall" autoComplete="off" />
```

`size` sets the field height, text size, and icon size. The default is `medium`.
Each size aligns with the matching `Text` and `Button`.

| Size | Field height | Font / line height | Icon |
|---|---|---|---|
| `small` | 24px | 13px / 16px | 14px |
| `medium` | 28px | 15px / 20px | 16px |
| `large` | 32px | 17px / 22px | 18px |

## Priority

`priority` changes the field surface without changing its size or behavior.
`primary` (the default) has a fill and border. `secondary` has a transparent
background and visible border. `tertiary` keeps both transparent at rest, then
uses secondary's border on hover or focus. Use it where the label or surrounding
content makes the field easy to find. All three show the same focus ring.
On an enabled field, a non-neutral `status` keeps its tinted fill and border
visible at rest.

```tsx
<Input label="Primary" placeholder="Filled field" autoComplete="off" />
<Input priority="secondary" label="Secondary" placeholder="Outlined field" autoComplete="off" />
<Input priority="tertiary" label="Tertiary" placeholder="Field on hover or focus" autoComplete="off" />
```

## Label and hint

```tsx
<Input label="Display name" defaultValue="Ada Lovelace" autoComplete="name" />
<Input label="API key" hint="Find this in Settings → Developers." placeholder="sk-…" autoComplete="off" />
```

`label` names the field and appears above it. `hint` provides persistent help
below it. Both accept text or JSX, including links and emphasis. Keep essential
instructions here so they remain available while someone types.

Standard `role` and `aria-*` declarations apply to the native control. See the
[Web Component reference](#web-component) for delegation and explicit overrides.

## Tooltip

```tsx
<Input label="API key" placeholder="sk-…" autoComplete="off">
  <Tooltip>Find this in Settings → Developers.</Tooltip>
</Input>
```

Place a `Tooltip` inside `Input` to anchor it to the field. It appears on hover
or keyboard focus. Use `leading` and `trailing` for content inside the field itself.

## Status

```tsx
{/* No status = neutral helper text */}
<Input label="Display name" defaultValue="Ada Lovelace" hint="This is your public name." autoComplete="name" />
<Input label="Workspace" defaultValue="acme" status="info" hint="Lowercase letters and dashes only." autoComplete="off" />
<Input label="Username" defaultValue="ada" status="success" hint="Username is available." autoComplete="username" />
<Input label="Password" type="password" defaultValue="hunter2" status="warning" hint="Weak — add more characters." autoComplete="new-password" />
<Input label="Email" type="email" defaultValue="not-an-email" status="critical" hint="Enter a valid email address." autoComplete="email" />
<Input label="Plan" defaultValue="Pro" status="brand" hint="You're on the Pro plan." autoComplete="off" />
```

`status` colors the field and hint and adds a status icon. Choose `critical`,
`warning`, `success`, `info`, or `brand`; each adapts to the active theme.
Put the message in `hint`.

`status="critical"` marks the field invalid and blocks normal form submission.
The other statuses add feedback without adding a validation error. Native
constraints, such as `required` or `type="email"`, still apply.

Use `statusIcon` to replace the default icon, or `statusIcon={false}` to hide it.
For a custom border color without status feedback, use `tone`.

## Leading, trailing, and clear

```tsx
import { useState } from 'preact/hooks'
import { Input, Icon, Button } from '@antadesign/anta'

function SearchActions() {
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [regex, setRegex] = useState(false)
  return (
    <>
      <Button priority="tertiary" icon="case-sensitive"
        aria-label="Case sensitive" title="Case sensitive"
        selected={caseSensitive} aria-pressed={caseSensitive}
        onClick={() => setCaseSensitive(value => !value)} />
      <Button priority="tertiary" icon="regex"
        aria-label="Regular expression" title="Regular expression"
        selected={regex} aria-pressed={regex}
        onClick={() => setRegex(value => !value)} />
    </>
  )
}

function Demo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}>
      <Input label="Leading icon" placeholder="Search…" leading={<Icon shape="search" />} autoComplete="off" />
      <Input label="Trailing actions" placeholder="Search…" trailing={<SearchActions />} dimActions autoComplete="off" />
      <Input label="Clear action" placeholder="Search…" clearable dimActions defaultValue="design tokens" autoComplete="off" />
      <Input label="All adornments" leading={<Icon shape="search" />} trailing={<SearchActions />} clearable dimActions defaultValue="design tokens" autoComplete="off" />
      <Input label="Text adornments" leading="from" trailing="each" defaultValue="$20" autoComplete="off" />
    </div>
  )
}
```

`leading` and `trailing` place icons, buttons, or text at the field edges.
Use either alone, combine them, or add a separate `clearable` action. The preview
includes independent case-sensitive and regular expression toggles, plus text
adornments.

Trailing icon buttons automatically fit the Input size: 20px in small fields,
24px in medium fields, and 28px in large fields. Clear buttons have a 2px inset
on all sides; trailing button groups have a 2px inset at the end of the field.

`dimActions` displays leading, trailing, and clear content at 60% opacity,
returning it to full opacity when the field is hovered or focused.

`clearable` adds a keyboard-focusable clear button, visible when an editable
field has a value. Clearing works before framework hydration. See
[Events](#events) to cancel a clear or respond after it completes.

`type="search"` defaults to a leading search icon and `clearable`. Override
`leading` or set `clearable={false}` to customize that shorthand.

### Password reveal

```tsx
const [reveal, setReveal] = useState(false)

<Input
  label="Password"
  autoComplete="current-password"
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

Use a trailing button to toggle `type` between `password` and `text` without
changing the value. The browser masks the password while it is hidden.
`autoComplete="current-password"` identifies an existing password for autofill.

## Multiline

```tsx
{/* Grows with content, capped at 6 rows, then scrolls */}
<Input multiline maxRows={6} label="Bio (autogrows)" placeholder="Tell us…" autoComplete="off" />

{/* Constant height of 3 rows */}
<Input multiline rows={3} label="Notes (fixed 3 rows)" placeholder="…" autoComplete="off" />
```

`multiline` renders a textarea. Without `rows`, it grows with its content.
Set `maxRows` to cap that growth and scroll longer content, or leave it unset
for unlimited growth. Set `rows` for a fixed height; `rows` also implies
`multiline`.

## Controlled and uncontrolled

```tsx
// Uncontrolled: the element updates its value after input.
<Input label="Name" defaultValue="Ada" autoComplete="name" onChange={(e) => console.log(e.target.value)} />

// Controlled: application state supplies the value.
const [value, setValue] = useState('')
<Input label="Name" value={value} autoComplete="name" onInput={(e) => setValue(e.target.value)} />
```

Use `defaultValue` for an uncontrolled field. For a controlled field, pass
`value` and update it with `onInput` or `onValueChange`. `onChange` fires on
commit, following native change-event behavior.

Read `e.target.value` from the Input host, or use the snapshot supplied to
`onValueChange`. Unchanged values are not rewritten to the native control,
preserving the caret during ordinary editing.

If a handler transforms a value, the next render applies it. Rejecting an edit
by setting state to the same string can leave the edit visible because the
framework may skip that render. Use `maxLength` to limit length, or normalize
the value in the handler when needed.

## Events

| Handler | When it fires | Value or action |
|---|---|---|
| `onInput(e)` | When editing changes the value, or the field is cleared | Read `e.target.value` |
| `onChange(e)` | On commit, such as blur or Enter, or when cleared | Read `e.target.value` |
| `onValueChange(e, attrs)` | On both `input` and `change` | `{ value, name, empty, valid, validationMessage }` |
| `onClearClick(e)` | Before clearing | Call `e.preventDefault()` synchronously to cancel |
| `onClearInput(e)` | After clearing | The value is empty |

Use `onValueChange` for a serializable snapshot of the value and validation
result. It can run more than once for an edit because it handles both event types.

Clearing empties the value, fires `input`, `change`, and `clearinput`, then
returns focus to the native control. Try **Clear** with **Protect draft** enabled,
then turn protection off and try again.

```tsx
import { useState } from 'preact/hooks'
import { Input, Checkbox, Button } from '@antadesign/anta'

function Demo() {
  const [value, setValue] = useState('Keep this draft')
  const [protect, setProtect] = useState(true)
  const [event, setEvent] = useState('Edit the field or select Clear.')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '320px', maxWidth: '100%' }}>
      <Input
        label="Draft"
        value={value}
        clearable
        hint={event}
        onValueChange={(event, { value }) => {
          setValue(value)
          setEvent(event.type === 'input' ? 'Draft updated.' : 'Draft committed.')
        }}
        onClearClick={event => {
          if (protect) {
            event.preventDefault()
            setEvent('Clear cancelled. Turn off Protect draft to clear it.')
          }
        }}
        onClearInput={() => setEvent('Draft cleared.')}
      />
      <Checkbox label="Protect draft" checked={protect}
        onStateChange={(_, { next }) => setProtect(next)} />
      <Button label="Restore draft" onClick={() => setValue('Keep this draft')} />
    </div>
  )
}
```

## Forms

```tsx
<form>
  <Input name="email" label="Email" type="email" autoComplete="email" required clearable />
  <Button tone="brand" type="submit" label="Sign up" />
  <Button priority="tertiary" type="reset" label="Reset" />
</form>
```

Input submits its value under `name` with the surrounding form, and
`new FormData(form)` includes it. Native constraints such as `required` block
normal submission while invalid. A reset button restores `defaultValue`.

## Types and validation

```tsx
<Input type="text"     label="Text"     autoComplete="off" />
<Input type="email"    label="Email"    autoComplete="email" />
<Input type="password" label="Password" autoComplete="current-password" />
<Input type="tel"      label="Tel"      autoComplete="tel" />
<Input type="url"      label="URL"      autoComplete="url" />
<Input type="number"   label="Number"   autoComplete="off" min={0} max={100} />
```

`type` accepts `text` (the default), `email`, `password`, `tel`, `url`, and
`number`. Use `search` for the search icon and clear-action shorthand.
Number fields also accept `min`, `max`, and `step`.

Set `autoComplete` to describe the field's purpose, such as `name`, `username`,
`current-password`, `new-password`, or `one-time-code`. The `email`, `tel`, and
`url` types default to their matching autocomplete token. Use `autoComplete="off"`
for fields that do not represent autofill data.

For numeric text that must preserve partial entries or trailing zeros, use
`type="text"` with `inputMode="decimal"` or `"numeric"`. Keep the raw string
in state and parse it when needed. Native number inputs can report an empty
value for incomplete numeric text; parsing and rendering a number on every edit
can also remove formatting. These [native number rules](https://html.spec.whatwg.org/multipage/input.html#number-state-(type=number))
apply to uncontrolled fields too. `inputMode` suggests a keyboard; it does not
validate the value.

Supported constraints depend on the native type: `required`, `pattern`,
`minLength`, `maxLength`, `min`, `max`, and `step`. They participate in form
validation automatically. `pattern` checks validity; it does not prevent typing.

### Native validation

```tsx
import { useState } from 'preact/hooks'
import { Input, Button } from '@antadesign/anta'

function Demo() {
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})

  function onSubmit(e: SubmitEvent) {
    e.preventDefault()
    const next: Record<string, string | undefined> = {}
    const form = e.currentTarget as HTMLFormElement
    form.querySelectorAll('a-input').forEach((el: any) => {
      if (!el.checkValidity()) next[el.name] = el.validationMessage
    })
    setErrors(next)
  }
  const clearError = (name: string) => setErrors(previous => ({ ...previous, [name]: undefined }))

  return (
    <form noValidate onSubmit={onSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '300px' }}>
      <Input name="email" label="Email" type="email" autoComplete="email"
        placeholder="you@example.com" required hint={errors.email}
        status={errors.email ? 'critical' : undefined}
        onInput={() => clearError('email')} />
      <Input name="site" label="Website" type="url" autoComplete="url"
        placeholder="https://…" hint={errors.site}
        status={errors.site ? 'critical' : undefined}
        onInput={() => clearError('site')} />
      <Input name="age" label="Age" type="number" autoComplete="off"
        placeholder="18 – 120" min="18" max="120" hint={errors.age}
        status={errors.age ? 'critical' : undefined}
        onInput={() => clearError('age')} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button type="submit" tone="brand" label="Submit" />
        <Button type="reset" priority="tertiary" label="Reset" onClick={() => setErrors({})} />
      </div>
    </form>
  )
}
```

Use `checkValidity()` and the browser's localized `validationMessage` to show
native validation errors in `hint`. Set `status="critical"` for fields with an
error. The form's `noValidate` attribute suppresses automatic browser validation
UI so the submit handler can check fields and display their messages.

Try submitting an empty email, an invalid address, or an age outside the range.

The shadow input does not trigger native implicit form submission on Enter.
Use the form's submit Button, or handle Enter in the application when that
interaction fits the form.

## Layout

Input uses a single-column grid for its label, field, and hint. Change the grid
on `a-input` and position `::part(label)`, `::part(field)`, and `::part(hint)` to
arrange them. Your unlayered CSS overrides the defaults in `@layer anta`.

Arrange multiple Inputs with an outer grid or flex container. Their internal
layout stays independent of the form layout.

The classes below scope each example. Replace them with your own selectors.

### Label on the left

Use two columns for the label and field. Place the hint in the field's column.

```tsx
<Input className="label-side" label="Display name" hint="Shown on your profile" autoComplete="name" />

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

Use `grid-template-columns: subgrid` to share the form's columns across Inputs.
Labels occupy a column sized to the longest label; fields align in the second
column, with each hint below its field.

```tsx
<div className="aligned-form">
  <Input label="Email" type="email" autoComplete="email" hint="We'll never share it." />
  <Input label="Confirm password" type="password" autoComplete="new-password" />
  <Input label="PIN" autoComplete="one-time-code" />
</div>

<style>{`
  .aligned-form { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 16px 12px; }
  .aligned-form > a-input { grid-column: 1 / -1; grid-template-columns: subgrid; align-items: center; }
  .aligned-form > a-input::part(label) { grid-column: 1; }
  .aligned-form > a-input::part(field),
  .aligned-form > a-input::part(hint)  { grid-column: 2; }
`}</style>
```

### Hint on the right

Place a short hint or counter beside the field. The label spans both columns,
and the hint aligns vertically with the field.

```tsx
<Input className="hint-right" label="Username" hint="3–20 characters" placeholder="ada" autoComplete="username" />

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

Use an outer grid to fit as many columns as the available width allows.
`minmax(200px, 1fr)` gives each field at least 200px and shares the remaining
space. Narrow the preview to see the fields wrap.

```tsx
<div className="wrap-fields">
  <Input label="First name" autoComplete="given-name" />
  <Input label="Last name" autoComplete="family-name" />
  <Input label="Email" type="email" autoComplete="email" />
  <Input label="Phone" type="tel" autoComplete="tel" />
</div>

<style>{`
  .wrap-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
`}</style>
```

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `autoComplete?` | 'off' \| 'on' \| 'name' \| 'username' \| 'email' \| 'current-password' \| 'new-password' \| 'one-time-code' \| 'tel' \| 'url' \| (string & {}) | — | Native autocomplete token describing the field purpose. Overrides the token derived from the email, tel, or url type. Set an explicit token for other purposes, such as `username`, `current-password`, or `one-time-code`. |
| `autoFocus?` | boolean | — | Focus this field when its containing `Dialog` opens. |
| `button?` | boolean | — | Render the field surface with a native button as its focus target. This is available for Input-styled popup triggers; the value becomes the button text and the placeholder is shown while it is empty. |
| `children?` | ReactNode | — | Extra content between the field and hint. A `Tooltip` child anchors to the field. Use `leading` and `trailing` for content inside the field. |
| `clearable?` | boolean | — | Show a clear button before trailing content when an editable field has a value. |
| `defaultValue?` | string | — | Initial value for an uncontrolled field, restored on form reset. |
| `dimActions?` | boolean | — | Display leading, trailing, and clear content at 60% opacity, returning to full opacity when the field is hovered or focused. |
| `disabled?` | boolean | — | Disable the field. |
| `hint?` | ReactNode | — | Persistent help or feedback below the field. `status` colors the message and adds a status icon. |
| `inputMode?` | 'none' \| 'text' \| 'decimal' \| 'numeric' \| 'tel' \| 'search' \| 'email' \| 'url' | — | Virtual keyboard hint. Overrides the value derived from `type` without changing validation. |
| `label?` | ReactNode | — | Visible field label and accessible name for the native control. Accepts text or JSX. Accessible naming follows the current label content. |
| `leading?` | ReactNode | — | Content at the start of the field, such as an icon or text. |
| `max?` | number \| string | — | Maximum value for `type="number"`. |
| `maxLength?` | number | — | Maximum text length for native types that support it. |
| `maxRows?` | number | — | Maximum row count for autogrow when `rows` is unset. Omit for unlimited growth. |
| `min?` | number \| string | — | Minimum value for `type="number"`. |
| `minLength?` | number | — | Minimum text length for native types that support it. |
| `multiline?` | boolean | — | Render a textarea. Without `rows`, it grows with content up to `maxRows` when set. Autogrow uses native field sizing where supported, with a JavaScript fallback in WebKit and browsers without support. |
| `name?` | string | — | Form field name, submitted through ElementInternals. Property updates stay internal; they do not reflect into the host's `name` attribute. |
| `onBlur?` | (e) => void | — | Fires when the field loses focus. |
| `onChange?` | (e) => void | — | Fires on native commit, such as blur or Enter, and on clear. Use `onInput` or `onValueChange` for live edits. Read `e.target.value`. |
| `onClearClick?` | (e) => void | — | Fires before the built-in clear action. Call `e.preventDefault()` synchronously to keep the value and cancel `onClearInput`. Corresponds to the cancelable, bubbling `clearclick` event. |
| `onClearInput?` | (e) => void | — | Fires after clearing, following `onInput` and `onChange`. Does not fire when clearing is canceled. Corresponds to the bubbling `clearinput` event. |
| `onFocus?` | (e) => void | — | Fires when the field gains focus. |
| `onInput?` | (e) => void | — | Fires when editing changes the value or the field is cleared. Read `e.target.value`. |
| `onValueChange?` | (event, attrs) => void | — | Fires on both `input` and `change`, including clear, with a serializable snapshot of `value`, `name`, `empty`, `valid`, and `validationMessage`. Can run more than once per edit. Use `event.type` to distinguish the events. |
| `pattern?` | string | — | Validation pattern for supported single-line types. Checks validity without preventing typing. |
| `placeholder?` | string | — | Placeholder shown when empty. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' | primary | Field emphasis. `primary` has a fill and border, `secondary` keeps the border without a fill, and `tertiary` makes the border transparent until hover or focus. Status borders remain visible at rest. |
| `readOnly?` | boolean | — | Make the field read-only. |
| `required?` | boolean | — | Mark the field required (drives native validity). |
| `role?` | string | — | ARIA role for the native control, such as `combobox` for an InputAutocomplete trigger. The element delegates this and standard `aria-*` props to its native shadow control. |
| `round?` | boolean \| number \| string | — | Use a 999px border radius. Pass a number in pixels or a CSS length for a custom radius. The clear button stays circular. |
| `rows?` | number | — | Fixed visible row count. Also enables `multiline`. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Field height, text size, and icon size. Field heights are 24px for small, 28px for medium, and 32px for large. |
| `spellCheck?` | boolean | — | Toggle native spell-checking. |
| `status?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' | — | Feedback color for the field and hint. `critical` marks the field invalid, sets `aria-invalid` and `:state(invalid)`, and blocks normal form submission. Other statuses add no validation error; native constraints still apply. Omit or use `neutral` for a plain field. |
| `statusIcon?` | (string & {}) \| false \| IconShape | — | Icon before the hint. The defaults are `warning-diamond` for critical, `warning-triangle` for warning, `circle-check` for success, `info` for info, and `circle-small-solid` for brand. Pass a shape to replace it or `false` to hide it. Neutral has no default icon. |
| `step?` | number \| string | — | Allowed increment for `type="number"`. |
| `tone?` | string | — | Custom CSS border color. A non-neutral `status` takes precedence. The focus ring uses the global `--focus-ring`. |
| `trailing?` | ReactNode | — | Content at the end of the field, after the clear button. Icon-only buttons automatically fit the Input size. |
| `truncate?` | boolean | true | Ellipsize an overflowing single-line value. Read-only inputs already do this; pass `false` when an editable field should show the full value. |
| `type?` | 'text' \| 'search' \| 'email' \| 'password' \| 'tel' \| 'url' \| 'number' | text | Native single-line input type. Ignored for multiline fields. `search` uses a native text input with a leading search icon, a clear button, and `inputmode="search"`. Override `leading` or set `clearable={false}` to customize it. |
| `value?` | string | — | Controlled value. Update it with `onInput` or `onValueChange` for live editing. |

## Web Component

Use `<a-input>` directly outside React or Preact.

Slots accept content; shadow parts expose regions for CSS. The `label`,
`leading`, `clear`, `trailing`, and `hint` slots are independent of the parts
with matching names. Unslotted children appear after the field and before the hint.

Standard `role` and `aria-*` declarations on the host apply to the native shadow
control. Later attribute updates, property updates such as `ariaLabel`, and
removals follow the same channel. Explicit accessible names, descriptions, and
popup relationships take precedence over generated references. Inspect the
native `[part="input"]` element through `element.shadowRoot`; the host remains
neutral.

The JSX `type="search"` shorthand uses a native text input. On a raw `<a-input>`,
`type="search"` uses a native search input. Listen for `clearclick` and
`clearinput` with `addEventListener()` to handle clearing without a JSX wrapper.

The `name` attribute supplies the form field name. Assigning the `name` property
updates the effective name and submitted FormData without changing the host
attribute. Read `element.name` for that effective value. Attribute selectors and
`form.elements.namedItem()` continue to use authored attributes. A later `name`
attribute update restores that attribute as the source of truth.

`checkValidity()`, `reportValidity()`, `validity`, `validationMessage`, and
`willValidate` expose form validation. `status="critical"` adds a custom error;
other statuses remain advisory. There is no public `setCustomValidity()` method.

Autogrow uses native field sizing where supported, with a JavaScript fallback
in WebKit and browsers without support. `rows` fixes the height; `maxrows` caps
autogrow when `rows` is absent. The fallback remeasures typography and width
changes on the next value update.

```html
<a-input name="email" type="email" autocomplete="email" placeholder="you@example.com">
  <span slot="label">Email</span>
  <span slot="hint">We only use it for account notices.</span>
</a-input>
```

### Native HTML inputs

For a standard HTML form, add `data-anta` to a native input. Text, search,
email, telephone, URL, password, and number inputs keep their native editing,
keyboard, validation, and form behavior while using Anta's field styling. Search
keeps its browser-supplied affordances; file keeps its native chooser and selected
file name, with an Anta-styled chooser button. `submit` and `reset` inputs use the
matching Anta button styling; set `priority="primary"` on a submit control when it
is the form's main action.

`<textarea data-anta>` uses the same field styling. Set `rows` for its height; one
field-height is the minimum, and it resizes vertically. Native textareas do not
autogrow; use Input's [`multiline`](#multiline) instead.

Use `data-anta-size="small"` or `"large"` for field sizing. Native inputs own
their `size` attribute, so Anta does not reuse it. `round` and a custom-color
`tone` work the same way as Input.

```html
<input data-anta data-anta-size="small" type="text" name="name" aria-label="Name" placeholder="Small text">
<input data-anta type="search" name="search" aria-label="Search" placeholder="Search">
<input data-anta type="email" name="email" aria-label="Email" placeholder="Email">
<input data-anta type="tel" name="phone" aria-label="Telephone" placeholder="Telephone">
<input data-anta round type="url" name="site" aria-label="Website" placeholder="Rounded URL">
<input data-anta type="password" name="password" aria-label="Password" value="password">
<input data-anta tone="rebeccapurple" type="number" name="seats" aria-label="Seats" value="3" min="1">
<textarea data-anta rows="3" name="notes" aria-label="Notes" placeholder="Notes"></textarea>
<input data-anta type="file" name="attachment" aria-label="Attachment" accept=".pdf,.docx">

<input data-anta type="submit" value="Submit" priority="primary">
<input data-anta type="reset" value="Reset">
```

## Styling

Use `priority` for the field surface, `status` for feedback, `tone` for a custom
border color, and `size` for dimensions. The focus ring uses the global
[`--focus-ring`](../colors.md#focus-ring).

```tsx
<Input tone="#e0457b" label="Custom accent" autoComplete="off" />
```

Style shadow regions with `::part(field)`, `::part(input)`, `::part(input-label)`,
`::part(label)`, `::part(leading)`, `::part(trailing)`, `::part(clear)`, and
`::part(hint)`. Use `:state(filled)` for a nonempty value,
`:state(invalid)` for critical status, and `:state(control-focus)::part(field)`
for the focused field. The clear button lives in the light DOM, so target it
with a regular selector. Use `light-dark()` for theme-specific colors.

In button fields, `::part(input)` targets the native button, and
`::part(input-label)` targets its value or placeholder text. `::part(label)`
targets the separate visible field label.

```css
a-input::part(field) { border-radius: 999px; }
a-input::part(input) { font-variant-numeric: tabular-nums; }
a-input::part(label) { text-transform: uppercase; }
```

An inset `box-shadow` draws the border: 0.5px at rest and 1px on hover, focus,
or non-neutral status. Changing its width does not change the field's size.

Input's default styles are external. If a Content Security Policy blocks inline
styles, use external CSS for custom colors and dimensions. Custom `tone`,
custom `round`, and application `style` props can serialize style attributes.

Chrome 135 can retain native number stepper buttons because its external
`::part(input)` rules do not suppress them. The buttons and keyboard stepping
keep their native behavior.

This example creates a borderless pill with a dark fill in light mode and a
light fill in dark mode. The fill changes on focus.

```css
a-input.fancy::part(field) {
  border-radius: 999px;
  box-shadow: none;
  background: light-dark(#3a3a3a, #ececec);
  padding-block: 10px;
  padding-inline: 20px;
}
a-input.fancy::part(input) { color: light-dark(#ffffff, #1a1a1a); }
a-input.fancy::part(input)::placeholder {
  color: light-dark(#b8b8b8, #666666);
  opacity: 1;
}
a-input.fancy:state(control-focus)::part(field) { background: light-dark(#161616, #ffffff); }
```

### Placeholder contrast

Use placeholders for example values or formatting cues. Keep an accessible
name and put essential instructions in a persistent label or hint.

Antune uses `--text-4` for placeholders. These ratios compare the neutral primary
field backgrounds with the example's fixed colors:

| Style | Placeholder | Background | Contrast |
| --- | --- | --- | --- |
| Antune light theme | `#7a737c` | `#ffffff` | 4.59:1 |
| Antune dark theme | `#7c737c` | `#000000` | 4.60:1 |
| Example | `#767676` | `#ffffff` | 4.54:1 |

W3C recommends [sufficient placeholder contrast](https://www.w3.org/WAI/tutorials/forms/instructions/#styling).
The example uses `#767676` on white for a contrast ratio above 4.5:1.

The example keeps the same colors in every state and theme.
Replace `.placeholder-contrast` with your own class.

```tsx
<Input className="placeholder-contrast" label="Email" type="email" autoComplete="email" placeholder="you@example.com" />
```

```css
a-input.placeholder-contrast::part(field) { background: #ffffff; }
a-input.placeholder-contrast::part(input) { color: #161616; }
a-input.placeholder-contrast::part(input)::placeholder {
  color: #767676;
  opacity: 1;
}
```

Check contrast separately if you use a different background.
Native inputs and textareas use `::placeholder` without `::part(input)`.
