# InputAutocomplete

`InputAutocomplete` is a text field with a suggestion list. Its value remains a
free-form string: text that is not in the list stays in the field, and selecting
a suggestion fills the field. Use [Select](./select.md) with `filter` when the
value must be one of the options.

InputAutocomplete uses an [Input](./input.md) for the field and a [Menu](./menu.md)
for suggestions. **`onValueChange`** reports field text. `onSelect` runs only
after someone chooses a suggestion. Use `value` to control it, or `defaultValue`
for uncontrolled use.

## Free text is the point

The value is always the text in the field. That's what separates this from a
[Select](./select.md): a Select constrains the value to one of its options, so a Select
with `filter` already covers "search a fixed list". `InputAutocomplete` is for when
the list only *suggests* and the user may commit something you didn't list.

The keyboard follows that intent. No suggestion is highlighted as you type, so
Enter commits the typed text and closes the list. ↓ highlights
the first suggestion (then ↑/↓ move through them), and
Enter on a highlighted row picks it. Esc or an outside click
closes the list; clicking the field to place the caret keeps it open.

## Filtering

`filter` decides how suggestions match the text:

- **`true`** (default): built-in case-insensitive substring match on each option's
  `value` / `label` / `hint`.
- **a function** `(option, query) => boolean`: a custom matcher, called for each option.
- **`false`**: show `suggestions` as-is, doing no local filtering. Use this when you
  fetch or filter results yourself (async / remote) and feed the current set through
  `suggestions`.

Suggestions are bare strings or `SelectOption`s, the same option shape
[Select](./select.md) uses: `value`, `label`, `hint`, `icon`, `tone`, `disabled`.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `suggestions` | string \| SelectOption[] | — | The suggestions: bare strings or `SelectOption`s (`value` / `label` / `hint` /
 `icon` / `tone` / `disabled`). A flat list; picking one fills the field. |
| `clearable?` | boolean | — | Show a clear button while the field has text. |
| `defaultValue?` | string | — | Initial value for uncontrolled use. |
| `disabled?` | boolean | — | Disable the field. |
| `filter?` | boolean \| (option, query) => boolean | true | How suggestions match the text. `true` uses the built-in case-insensitive
 substring match on `value` / `label` / `hint`; a function `(option, query) =>
 boolean` uses a custom matcher; `false` shows `suggestions` unchanged for
 application-provided async or remote filtering. |
| `hint?` | ReactNode | — | Hint under the field. |
| `label?` | ReactNode | — | Field label. |
| `leading?` | ReactNode | — | Leading adornment inside the field. |
| `name?` | string | — | Form field name. |
| `onSelect?` | (option) => void | — | Fires only when a suggestion is chosen, with that option. |
| `onValueChange?` | (value) => void | — | Fires as the text changes (typing, picking a suggestion, or clearing) with
 the new field text. |
| `placeholder?` | string | — | Placeholder text. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Field size. |
| `status?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' | — | Validation status. |
| `statusIcon?` | (string & {}) \| false \| IconShape | — | Status icon override, or `false` to drop it. |
| `tone?` | string | — | Custom accent color — a named tone or any CSS color. |
| `trailing?` | ReactNode | — | Trailing adornment inside the field. |
| `value?` | string | — | Controlled value: the field's text, a **free** string not constrained to a
 suggestion. Leave undefined for uncontrolled. |

`InputAutocomplete` combines an input with a Menu. Reproducing its filtering,
selection, focus, and popup coordination without the React or Preact wrapper is
a substantial amount of code.

### Native HTML input with autocomplete

For browser-native suggestions, pair a native input with a `<datalist>`. It
keeps free-form entry and lets the browser filter and fill matching options,
while `data-anta` supplies the field appearance.

The browser renders the suggestions popup. Use `InputAutocomplete` for custom
option content, popup styling, or consistent behavior across browsers.

```html
<input data-anta type="text" list="people" placeholder="Search people">

<datalist id="people">
  <option value="Maya Chen">
  <option value="Noah Williams">
  <option value="Olivia Martinez">
  <option value="Liam Johnson">
</datalist>
```

**The field** is styled through Input's props (`size`, `status`, `tone`, `round`,
`leading` / `trailing`) and its `::part`s; set its width with `style` / `className`
(forwarded to the field). **The suggestion popover** takes Menu's `::part(menu)`.

```tsx
// Give the field a width; tint it with a custom tone.
<InputAutocomplete tone="info" style={{ width: '260px' }} suggestions={frameworks} />
```
