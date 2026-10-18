# InputAutocomplete

`InputAutocomplete` offers suggestions while people enter text. Use it for
package names, search queries, or other fields where common entries help but
people can also enter their own value. Choosing a suggestion fills the field
with its value. Use [Select](./select.md) when an option's identity is the value.

Give the field a visible `label`. If you omit it, provide `aria-label` or
`aria-labelledby`. A placeholder alone does not name the field.

## Free text is the point

The field keeps whatever someone types, including text absent from the list.
`onValueChange` reports that text as it changes. Use `onSelect` when the
application also needs to know that someone chose a suggestion.

```tsx
const frameworks = ['React', 'Preact', 'Solid', 'Svelte', 'Vue', 'Angular', 'Qwik', 'Lit', 'Astro']
const [value, setValue] = useState('')

<InputAutocomplete
  label="Framework"
  placeholder="Type to search…"
  clearable
  suggestions={frameworks}
  value={value}
  onValueChange={setValue}
/>
<div>Value: <code>{value || '(empty)'}</code></div>
```

## Suggestions

Use strings for a simple list, or option objects to show a readable `label`, a
supporting `hint`, or an `icon`. Choosing a row fills the field with its `value`,
so the **Anta** suggestion here fills in `@antadesign/anta`. Disabled suggestions
remain visible and are skipped during keyboard navigation.

```tsx
<InputAutocomplete
  label="Package"
  hint="Choose a package name or enter another."
  suggestions={[
    { value: '@antadesign/anta', label: 'Anta', hint: 'UI components', icon: 'cube' },
    { value: '@antadesign/plot', label: 'Plot', hint: 'Canvas charts', icon: 'workflow' },
    { value: '@antadesign/stickers', label: 'Stickers', hint: 'Illustrations', icon: 'asterisk' },
    { value: '@antadesign/archived', label: 'Archived', hint: 'Unavailable', disabled: true },
  ]}
/>
```

## Managing the value

Pass `value` and update it through `onValueChange` when another part of your
application needs the text. Reset controlled text with `''`. For a field that
keeps its own text, use `defaultValue`; a form reset restores that default.

```tsx
const [value, setValue] = useState('React')

<InputAutocomplete label="Framework" suggestions={frameworks}
  value={value} onValueChange={setValue} clearable />
<Button label="Reset text" onClick={() => setValue('')} />
```

## Filtering

The built-in filter matches the value, label, and hint without case sensitivity,
and highlights matching label and hint text. Use a function when your
application needs a different rule, such as matching word prefixes. It receives
the original field text, including whitespace; decide whether to trim it in
your matcher.

```tsx
<InputAutocomplete
  label="Framework prefix"
  suggestions={frameworks}
  filter={(option, query) => option.value.toLowerCase().startsWith(query.trim().toLowerCase())}
/>
```

### Application-provided results

Pass `filter={false}` when your application already selects or ranks the
suggestions. This preserves their order and skips local highlighting. The
example supplies matching projects in reverse order; fetched results use the
same pattern.

```tsx
const projects = ['Billing service', 'Billing dashboard', 'Build tools', 'Customer portal']
const [value, setValue] = useState('')
const results = projects.filter(name => name.toLowerCase().includes(value.toLowerCase())).slice().reverse()

<InputAutocomplete
  label="Project"
  hint="Results use the application's order. You can also enter a new project."
  suggestions={results}
  filter={false}
  value={value}
  onValueChange={setValue}
/>
```

Replace `suggestions` as results arrive. New results update an open list; they
do not reopen it after Escape or focus loss. Your application owns loading,
request cancellation, and discarding responses for older queries.

## Keyboard interaction

Typing leaves every suggestion inactive, so Enter keeps the typed text and
closes the list. Arrow Down highlights the first enabled suggestion; Arrow Up
and Arrow Down move through the list. Enter on an active suggestion fills the
field. Editing again clears that active suggestion. Input-method composition
keeps its own candidate navigation and confirmation keys.

Escape closes the list and keeps focus in the field. Tab closes it and moves
to the next control. A mouse selection keeps focus in the field, and clicking
within an open field leaves the list open while placing the caret. The field
exposes combobox semantics, the popup is a listbox, and the active suggestion is
associated directly with the focused input.

## Events

Use `onValueChange` for application text state. `onInput`, `onFocus`, `onBlur`,
and `onKeyDown` also receive their field events. An input event reports an edit
that already happened; `preventDefault()` does not reject the text.

A consumer `onKeyDown` can prevent the wrapper's plain-Enter dismissal.
Menu handles active suggestions and navigation earlier in document capture.
Those actions cannot be canceled from the field callback, and Escape is
consumed before it reaches the field. See the callback reference for ordering.

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `suggestions` | string \| SelectOption[] | — | The suggestions: bare strings or `SelectOption`s (`value` / `label` / `hint` / `icon` / `tone` / `disabled`). A flat list; picking one fills the field. |
| `clearable?` | boolean | — | Show a clear button while the field has text. |
| `defaultValue?` | string | — | Initial uncontrolled text and the value restored by a form reset. |
| `disabled?` | boolean | — | Disable the field. |
| `filter?` | boolean \| (option, query) => boolean | true | How suggestions match the text. `true` uses the built-in case-insensitive substring match on `value` / `label` / `hint`; a function `(option, query) => boolean` receives the original field text, including whitespace, once per option on each render, including when empty. Custom matching has no automatic highlighting. `false` shows `suggestions` unchanged for application-provided async or remote filtering, without automatic highlighting. Replacing results updates an open list but does not reopen a dismissed list. |
| `hint?` | ReactNode | — | Hint under the field. |
| `label?` | ReactNode | — | Field label. |
| `leading?` | ReactNode | — | Leading adornment inside the field. |
| `name?` | string | — | Form field name. |
| `onBlur?` | (event) => void | — | Observe focus loss. The suggestion list closes without changing the text. |
| `onFocus?` | (event) => void | — | Observe focus before the suggestion list opens. |
| `onInput?` | (event) => void | — | Observe editing before `onValueChange`. The input event reports text that has already changed; `preventDefault()` does not reject that text. |
| `onKeyDown?` | (event) => void | — | Observe keys before the wrapper's plain-Enter dismissal. `preventDefault()` keeps that dismissal from running. Menu handles navigation and active-option activation earlier, in document capture; this callback cannot veto those actions. Composing keys remain with the input method. |
| `onSelect?` | (option) => void | — | Fires after `onValueChange` when a suggestion is chosen, with the normalized option. This reports the choice even if a controlled parent rejects the value. Typing and clearing do not call it. |
| `onValueChange?` | (value) => void | — | Reports text changes from typing, picking a suggestion, clearing, or form reset. |
| `placeholder?` | string | — | Placeholder text. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Field size. |
| `status?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' | — | Validation status. |
| `statusIcon?` | (string & {}) \| false \| IconShape | — | Status icon override, or `false` to drop it. |
| `tone?` | string | — | Custom accent color — a named tone or any CSS color. |
| `trailing?` | ReactNode | — | Trailing adornment inside the field. |
| `value?` | string | — | The controlled field text. Any string is valid, including `''` for an empty field. Omit or pass `undefined` for uncontrolled use. Parent updates do not call `onValueChange`. |

## Web Component

`InputAutocomplete` composes [Input](./input.md) and [Menu](./menu.md). It has no
`a-input-autocomplete` element or registration entry. Raw authors own the text,
filtering, popup state, and equivalent ARIA declarations. See
[Install and configure](../install-config.md) for imports, renderer setup, and CSP guidance.

### Native HTML input with autocomplete

For browser-native suggestions, pair a native input with a `datalist`. The
browser supplies the popup and keeps free-form entry. Use InputAutocomplete
when you need Anta's suggestion rows and popup styling.

```html
<label for="autocomplete-people">Person</label>
<input id="autocomplete-people" data-anta type="text" list="people" placeholder="Search people">
<datalist id="people">
  <option value="Maya Chen">
  <option value="Noah Williams">
  <option value="Olivia Martinez">
  <option value="Liam Johnson">
</datalist>
```

## Styling

Use Input's `size`, `status`, `tone`, and adornment props to configure the field.
`className` and `style` apply to its `a-input`. Target Input's parts for field
styles and the adjacent Menu's `::part(menu)` for the suggestion popup. Option
objects accept `className`, `style`, and application data attributes on their
rows.

The `package-field` class below belongs to this example. Replace it with your
own selector.

```tsx
<InputAutocomplete className="package-field" label="Package" suggestions={packages} tone="info" />
```

```css
.package-field { width: 260px; }
.package-field::part(field) { border-radius: 12px; }
.package-field + a-menu::part(menu) { border-radius: 12px; }
```
