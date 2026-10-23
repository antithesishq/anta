# Input

Use Input for forms, search, passwords, and longer text. Add a label to explain
what to enter, a hint for guidance, and actions such as clearing or revealing a
password.

## Size

```tsx
<Input size="small"  label="Small"  placeholder="Enter text…" autoComplete="off" />
<Input size="medium" label="Medium" placeholder="Enter text…" autoComplete="off" /> {/* default */}
<Input size="large"  label="Large"  placeholder="Enter text…" autoComplete="off" />
```

Choose `small`, `medium`, or `large` to suit the surrounding interface.
Text, icons, and action buttons adjust together. The default is `medium`.

## Priority

```tsx
<Input label="Primary" placeholder="Filled field" autoComplete="off" />
<Input priority="secondary" label="Secondary" placeholder="Outlined field" autoComplete="off" />
<Input priority="tertiary" label="Tertiary" placeholder="Field on hover or focus" autoComplete="off" />
```

Use `priority` to choose how much the field stands out. `primary` has a filled
background, `secondary` has an outline, and `tertiary` stays subtle until someone
interacts with it. Use tertiary where the label or context makes the field easy
to find. Status feedback and focus remain visible with every priority.

## Label and hint

```tsx
<Input label="Display name" defaultValue="Ada Lovelace" autoComplete="name" />
<Input label="API key" hint="Find this in Settings → Developers." placeholder="sk-…" autoComplete="off" />
```

`label` names the field and appears above it. `hint` provides persistent help
below it. Both accept text or JSX, including links and emphasis. Keep essential
instructions here so they remain available while someone types.

The label also names the field for screen readers, and the hint provides its
description.

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

Use `critical` for an error that must be fixed before submitting the form.
Other statuses provide feedback without marking the field invalid. Required
fields and email fields still need valid values.

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

Use `leading` and `trailing` to place icons, buttons, or short text inside the
field. Use either on its own or combine them with a clear button. The preview
shows search options and text such as “from” and “each.”

Trailing icon buttons adjust to the field size, with space around them to keep them
inside the border. You don't need to size them separately.

Use `dimActions` to keep these extras subtle until someone hovers over or
focuses the field.

`clearable` shows a clear button when an editable field has a value. After
clearing, focus returns to the field so typing can continue. See
[Events](#events) to cancel a clear or respond after it completes.

For a search field, use `type="search"` to add a search icon and clear button.
You can replace the icon with `leading` or hide the button with
`clearable={false}`.

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
{/* Grows with content, then scrolls */}
<Input multiline maxRows={6} label="Bio (autogrows)" placeholder="Tell us…" autoComplete="off" />

{/* Keeps a fixed height */}
<Input multiline rows={3} label="Notes (fixed height)" placeholder="…" autoComplete="off" />
```

Use `multiline` for longer text. The field grows as someone types.
Set `maxRows` to limit its growth, or `rows` to keep a fixed height and scroll
longer content.

## Controlled and uncontrolled

```tsx
// Uncontrolled: the element updates its value after input.
<Input label="Name" defaultValue="Ada" autoComplete="name" onChange={(e) => console.log(e.target.value)} />

// Controlled: application state supplies the value.
const [value, setValue] = useState('')
<Input label="Name" value={value} autoComplete="name" onInput={(e) => setValue(e.target.value)} />
```

Use `defaultValue` when the field can manage its own value. Use `value` with
`onInput` or `onValueChange` when your application needs to keep track of every
edit, such as updating a search or showing a character count.

Omit `value` or pass `undefined` to release control and retain the current text.
Form reset and browser restoration preserve controlled text; reset it by updating
`value`. An uncontrolled reset restores `defaultValue`.

Read the current text from `e.target.value`, or use the value provided by
`onValueChange`. Use `onChange` for edits that are committed, such as when the
field loses focus.

Changing the value in state updates the field. Setting state to the same value
may not undo a typed edit. Use `maxLength` for a length limit, and apply any text
formatting in your change handler.

## Events

| Handler | When it fires | Value or action |
|---|---|---|
| `onInput(e)` | When editing changes the value, or the field is cleared | Read `e.target.value` |
| `onChange(e)` | On commit, such as blur or Enter, or when cleared | Read `e.target.value` |
| `onValueChange(e, attrs)` | On both `input` and `change` | `{ value, name, empty, valid, validationMessage }` |
| `onClearClick(e)` | Before clearing | Call `e.preventDefault()` synchronously to cancel |
| `onClearInput(e)` | After clearing | The value is empty |

Use `onValueChange` to receive the current text and validation result together.
It runs while editing and when an edit is committed, so it can run more than
once for the same value.

Use `onClearClick` to keep a draft from being cleared. Try **Clear** with
**Protect draft** enabled, then turn protection off and try again.

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
normal submission while invalid. A reset button restores `defaultValue` on uncontrolled fields.

## Types and validation

```tsx
<Input type="text"     label="Text"     autoComplete="off" />
<Input type="email"    label="Email"    autoComplete="email" />
<Input type="password" label="Password" autoComplete="current-password" />
<Input type="tel"      label="Tel"      autoComplete="tel" />
<Input type="url"      label="URL"      autoComplete="url" />
<Input type="number"   label="Number"   autoComplete="off" min={0} max={100} />
```

Choose `type` to match what someone will enter: text, an email address,
a password, a phone number, a URL, or a number. Use `search` for a search field.

Set `autoComplete` to help the browser fill in familiar information, such as a
name or saved password. Email, telephone, and URL fields already use matching
autocomplete hints. Use `autoComplete="off"` where autofill isn't useful.

For numeric text that needs to keep partial entries or trailing zeros, use
`type="text"` with `inputMode="decimal"` or `"numeric"`. Keep the text as entered
and convert it to a number when needed. `inputMode` suggests a keyboard without
restricting what can be entered.

Use `required`, length limits, a `pattern`, or numeric limits to check values
before submission. Available checks depend on the field type. A `pattern`
checks the finished value without blocking typing.

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

You can show the browser's validation messages as hints. Check each field
with `checkValidity()`, put its `validationMessage` in `hint`, and use
`status="critical"` for errors. Add `noValidate` to the form when your handler
will display the messages instead of the browser's popup.

Try submitting an empty email, an invalid address, or an age outside the range.
Use **Submit** to send the form. Input does not submit automatically on Enter.

## Layout

Labels appear above their fields and hints below. Use CSS to move a label
beside its field, align labels across a form, or place a hint alongside a field.
The examples show the selectors to use.

You can also arrange whole fields in columns or let them wrap as the available
space changes.

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

Keep labels in a shared column so fields line up even when their labels have
different lengths. Each hint stays with its field.

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

Let fields share a row when there is room and wrap when space is limited.
Narrow the preview to see the layout adjust.

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
| `dimActions?` | boolean | — | Keep leading, trailing, and clear content subtle until someone hovers over or focuses the field. |
| `disabled?` | boolean | — | Disable the field. |
| `hint?` | ReactNode | — | Persistent help or feedback below the field. `status` colors the message and adds a status icon. |
| `inputMode?` | 'none' \| 'text' \| 'decimal' \| 'numeric' \| 'tel' \| 'search' \| 'email' \| 'url' | — | Virtual keyboard hint. Overrides the value derived from `type` without changing validation. |
| `label?` | ReactNode | — | Explain what to enter. Accepts text or JSX and also names the field for screen readers. |
| `leading?` | ReactNode | — | Content at the start of the field, such as an icon or text. |
| `max?` | number \| string | — | Maximum value for `type="number"`. |
| `maxLength?` | number | — | Maximum text length for native types that support it. |
| `maxRows?` | number | — | Maximum row count for autogrow when `rows` is unset. Omit for unlimited growth. |
| `min?` | number \| string | — | Minimum value for `type="number"`. |
| `minLength?` | number | — | Minimum text length for native types that support it. |
| `multiline?` | boolean | — | Allow longer text and grow the field as someone types. Use `maxRows` to limit growth or `rows` to keep a fixed height. |
| `name?` | string | — | Form field name for submission, named form lookup, and attribute selectors. |
| `onBlur?` | (e) => void | — | Fires when the field loses focus. |
| `onChange?` | (e) => void | — | Fires on native commit, such as blur or Enter, and on clear. Use `onInput` or `onValueChange` for live edits. Read `e.target.value`. |
| `onClearClick?` | (e) => void | — | Fires before the built-in clear action. Call `e.preventDefault()` synchronously to keep the value and cancel `onClearInput`. Corresponds to the cancelable, bubbling `clearclick` event. |
| `onClearInput?` | (e) => void | — | Fires after clearing, following `onInput` and `onChange`. Does not fire when clearing is canceled. Corresponds to the bubbling `clearinput` event. |
| `onFocus?` | (e) => void | — | Fires when the field gains focus. |
| `onInput?` | (e) => void | — | Fires when editing changes the value or the field is cleared. Read `e.target.value`. |
| `onValueChange?` | (event, attrs) => void | — | Receive the current text, field name, and validation result while editing and when an edit is committed, including clear. Can run more than once for the same value. Use `event.type` to distinguish the events. |
| `pattern?` | string | — | Validation pattern for supported single-line types. Checks validity without preventing typing. |
| `placeholder?` | string | — | Placeholder shown when empty. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' | primary | Field emphasis. `primary` has a fill and border, `secondary` keeps the border without a fill, and `tertiary` makes the border transparent until hover or focus. Status borders remain visible at rest. |
| `readOnly?` | boolean | — | Make the field read-only. |
| `required?` | boolean | — | Mark the field required (drives native validity). |
| `role?` | string | — | ARIA role for the native control, such as `combobox` for an InputAutocomplete trigger. The element delegates this and standard `aria-*` props to its native shadow control. |
| `round?` | boolean \| number \| string | — | Give the field fully rounded corners. Pass a number in pixels or a CSS length for a custom radius. The clear button stays circular. |
| `rows?` | number | — | Fixed visible row count. Also enables `multiline`. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Adjust the field, text, icons, and action buttons together to suit the surrounding interface. |
| `spellCheck?` | boolean | — | Toggle native spell-checking. |
| `status?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' | — | Feedback for the field and hint. Use `critical` for an error that must be fixed before submission. Other statuses provide feedback without adding a validation error. Required fields and other validation rules still apply. |
| `statusIcon?` | (string & {}) \| false \| IconShape | — | Icon before the hint. The defaults are `warning-diamond` for critical, `warning-triangle` for warning, `circle-check` for success, `info` for info, and `circle-small-solid` for brand. Pass a shape to replace it or `false` to hide it. Neutral has no default icon. |
| `step?` | number \| string | — | Allowed increment for `type="number"`. |
| `tone?` | string | — | Custom CSS border color. A non-neutral `status` takes precedence. The focus ring uses the global `--focus-ring`. |
| `trailing?` | ReactNode | — | Content at the end of the field, after the clear button. Anta buttons fit the field height and keep their padding. Icon-only Buttons are square; text buttons keep their natural width. Pass buttons directly or in a fragment for compact spacing. Other wrapping elements keep the text inset. Override either inset with the `--input-trailing-inset` CSS property. |
| `truncate?` | boolean | true | Ellipsize an overflowing single-line value. Read-only inputs already do this; pass `false` when an editable field should show the full value. |
| `type?` | 'text' \| 'search' \| 'email' \| 'password' \| 'tel' \| 'url' \| 'number' | text | Choose the kind of information to enter. Ignored for multiline fields. `search` adds a search icon and clear button. Replace the icon with `leading` or hide the button with `clearable={false}`. |
| `value?` | string | — | Controlled value. Update it with `onInput` or `onValueChange` for live editing. Form reset and restoration preserve controlled text; release retains the current text. |

## Web Component

Use `<a-input>` directly outside React or Preact.

Slots accept content; shadow parts expose regions for CSS. The `label`,
`leading`, `clear`, `trailing`, and `hint` slots are independent of the parts
with matching names. Unslotted children appear after the field and before the hint.

Group trailing buttons in `<a-input-trailing slot="trailing">` to use compact
action spacing. Mixed content keeps the text inset. The grouping tag needs no
JavaScript registration.

Anta buttons fit the field height and keep their own padding. A button with one
direct icon child and only optional Tooltip or copy helpers is square. Other
element children keep their natural width. For a raw button with an icon
and visible text, wrap the text in `<a-button-label>` to keep its natural width.
The JSX Button wrapper does this for plain text automatically.

The `data-anta-icon-only` sizing override has been removed. For a custom SVG or
image action, set its width with CSS to match the field's action height.

Set `role` and `aria-*` on `<a-input>` to describe the field to assistive
technology. Input applies them to the control that receives focus. Explicit
names and descriptions take precedence over its label and hint.

The JSX `type="search"` shorthand uses a native text input. On a raw `<a-input>`,
`type="search"` uses a native search input. Listen for `clearclick` and
`clearinput` with `addEventListener()` to handle clearing without a JSX wrapper.

The `name` property and attribute stay in sync. Updating either changes the
submitted field name, `form.elements.namedItem()` lookup, and attribute selectors.
Removing the name excludes the field from form submission.

`checkValidity()`, `reportValidity()`, `validity`, `validationMessage`, and
`willValidate` expose form validation. `status="critical"` adds a custom error;
other statuses remain advisory. There is no public `setCustomValidity()` method.

Use `rows` for a fixed height or `maxrows` to limit growth. Some browsers
recalculate a growing field's height on the next value change after its width
or font changes.

```html
<a-input name="email" type="email" autocomplete="email" placeholder="you@example.com">
  <span slot="label">Email</span>
  <span slot="hint">We only use it for account notices.</span>
</a-input>
```

### Native HTML inputs

Add `data-anta` to an HTML input to give it Anta styling while keeping its
usual browser behavior. Search and file inputs keep their built-in controls.
Submit and reset inputs look like Anta buttons. Use `priority="primary"` for
the form's main action.

Use `<textarea data-anta>` for longer text with a manually resizable height.
For a field that grows as someone types, use [multiline Input](#multiline).

Choose a size with `data-anta-size="small"` or `"large"`.
Use `round` for rounded corners and `tone` for a custom border color.

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
`:state(invalid)` for critical status, and `:focus::part(field)` when the
editable control is focused. Focus on a slotted action does not match this rule. The clear button lives in the light DOM, so target it
with a regular selector. Use `light-dark()` for theme-specific colors.

Set `--input-trailing-inset` to override the ending space for any trailing
content. Text and mixed content use the field's text inset by default;
buttons-only groups use compact spacing.

In button fields, `::part(input)` targets the native button, and
`::part(input-label)` targets its value or placeholder text. `::part(label)`
targets the separate visible field label.

Select uses the same field styling. See [Select styling](./select.md#styling) for
trigger customization.

```css
a-input::part(field) { border-radius: 999px; }
a-input::part(input) { font-variant-numeric: tabular-nums; }
a-input::part(label) { text-transform: uppercase; }
a-input.custom-inset { --input-trailing-inset: 4px; }
```

To remove the field's border, use `box-shadow: none` as shown in the example.

If your policy blocks inline styles, set custom colors and dimensions in an
external stylesheet. See [Content Security Policy](../install-config.md#content-security-policy)
for customization props that emit inline styles.

Some browsers may show native number steppers or controls on a raw
`<a-input type="search">`. These keep their browser behavior. The JSX
`<Input type="search">` uses a text input with Anta's own search icon and clear
button.

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
a-input.fancy:focus::part(field) { background: light-dark(#161616, #ffffff); }
```

### Placeholder contrast

Use placeholders for example values or formatting cues. Keep an accessible
name and put essential instructions in a persistent label or hint.

Keep placeholder text readable against the field background in both light and
dark themes. See W3C's [placeholder contrast guidance](https://www.w3.org/WAI/tutorials/forms/instructions/#styling).

This example uses a darker placeholder on a fixed light background.
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
