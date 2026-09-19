# Button

A button starts an action. Use its priority, tone, and size to match the action's
importance and context.

## Priority

Use one primary button for the main action in a group. Lower priorities reduce
visual emphasis.

```tsx
<Button tone="brand" priority="primary" label="Publish" />
<Button tone="brand" priority="secondary" label="Move" />
<Button tone="brand" priority="tertiary" label="Cancel" />
<Button tone="brand" priority="quaternary" label="Remind" />
```

- `primary`: main call to action
- `secondary`: supporting action and the default
- `tertiary`: low-emphasis action with a hover background
- `quaternary`: text-only action

## Tone

Choose a semantic tone for the action. The default is `neutral`. You can also
pass any CSS color for a one-off tone.

```tsx
<Button label="Save" />
<Button tone="brand" label="Publish" />
<Button tone="critical" label="Delete" />
<Button tone="info" label="Preview" />
<Button tone="success" label="Approve" />
<Button tone="warning" label="Archive" />
<Button tone="#e0457b" label="Custom tone" />
```

## Size

Buttons come in `small`, `medium`, and `large`. `medium` is the default.

```tsx
<Button tone="brand" size="small" label="Small" />
<Button tone="brand" size="medium" label="Medium" />
<Button tone="brand" size="large" label="Large" />
```

### Paddingless

Use `paddingless` with a quaternary button when an action should sit flush with
surrounding text.

```tsx
If you're familiar with the basics, click
<Button tone="critical" priority="quaternary" paddingless label="here" />
to skip the live demo.
```

## Round

Set `round` for a pill or circular icon button. Pass a number or CSS length for
a custom corner radius.

```tsx
<Button round tone="brand" label="Pill" />
<Button round tone="brand" icon="heart" aria-label="Like" />
<Button round={10} tone="brand" label="Custom 10px" />
```

## Icons

Use `icon` for a leading icon and `iconTrailing` for a trailing icon. See
[Icon](./icon.md) for available shapes.

```tsx
<Button tone="brand" priority="primary" icon="check" label="Confirm" />
<Button tone="brand" iconTrailing="external-link" label="Read the docs" />
<Button tone="brand" priority="tertiary" icon="filter" iconTrailing="chevron-down" label="Filter" />
```

### Icon-only

Omit the label for an icon-only button. Pass a clear `aria-label` when the icon
name does not describe the action well.

```tsx
<Button icon="dots-vertical" size="small" aria-label="More options" />
<Button tone="critical" icon="trash" aria-label="Delete" />
<Button round tone="brand" icon="check" size="large" aria-label="Confirm" />
```

### Children

Use children for inline content such as keyboard hints, badges, or counters.
Text and number children receive the same label styling as the `label` prop.

```tsx
<Button tone="brand" label="Save" icon="check" aria-keyshortcuts="Meta+s">
  <kbd aria-hidden="true">⌘S</kbd>
</Button>
```

## Underline

Tertiary and quaternary buttons support solid, dashed, and dotted underlines.
Use `underlineOnHover` to show the underline only on hover.

## States

`loading` and `disabled` prevent activation. `selected` communicates a toggled
or pressed state.

```tsx
<Button tone="brand" loading label="Submitting" />
<Button tone="brand" disabled label="Locked" />
<Button tone="brand" selected label="Toggled on" />
```

## ButtonCopy

`ButtonCopy` copies text and shows temporary success or failure feedback. Omit
the label for an icon-only copy button.

```tsx
<ButtonCopy copy="npm i @antadesign/anta" label="Copy install command" />
<ButtonCopy copy="https://anta.design" priority="tertiary" />
```

### Icon placement

Set `iconPlacement` to `leading`, `trailing`, or `none`. Use `copiedLabel` to
change the success message.

```tsx
<ButtonCopy copy={value} label="Leading" />
<ButtonCopy copy={value} label="Trailing" iconPlacement="trailing" />
<ButtonCopy copy={value} label="No icon" iconPlacement="none" />
```

### Copy a DOM node

Use `copyNode` to copy a rendered region as rich text and plain text. Bare
`copyNode` finds the nearest `data-copy-source`; a string selects an ancestor.

```tsx
<div data-copy-source>
  <Text>The quick brown fox jumps over the lazy dog.</Text>
  <ButtonCopy copyNode label="Copy card" />
</div>
```

### Copy the page URL

Use `copyUrl` for the current URL. `copyWithUrl` adds the current URL to copied
text.

```tsx
<ButtonCopy copyUrl label="Copy link" />
<ButtonCopy copy={snippet} copyWithUrl label="Copy snippet" />
```

### Copy dynamic text

For text generated on demand, update the controlled `copy` value in
`onCopyRequest`.

```tsx
const [report, setReport] = useState('')

<ButtonCopy
  copy={report}
  label="Copy report"
  onCopyRequest={() => setReport(generateReport())}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `copiedLabel?` | string | Copied | Text in the successful no-icon confirmation. |
| `copy?` | string | — | Text copied to the clipboard on activation. |
| `copyNode?` | boolean \| string | — | Copy a DOM node as rich text (`text/html`) + plain text. `true` copies the nearest ancestor marked `data-copy-source`; a string is a CSS selector for an ancestor region (`closest`). The copy control is stripped from the copied output. |
| `copyUrl?` | true | — | Copy the current page URL (`location.href`). |
| `copyWithUrl?` | boolean | — | Prefix the copied text with `// URL: <current page URL>`. |
| `disabled?` | boolean | — | Disable the button. |
| `download?` | string \| boolean | — | Anchor download attribute. Empty string / `true` triggers a download with the resource's default name; a string overrides the filename. |
| `form?` | string | — | Form id when the button isn't a descendant of its form. |
| `href?` | string | — | URL to link to. A definite string renders `<a role="button">`; omit it (or pass `undefined`) to render `<a-button>`, so `href={maybeUrl}` degrades to a plain button when the URL is absent. |
| `icon?` | IconShape | — | Leading icon shape. When set alone (no `label`, no `iconTrailing`, no `children`), the button renders as a square icon-only control and the wrapper auto-supplies `aria-label={icon}` (override by passing your own `aria-label`). |
| `iconPlacement?` | 'leading' \| 'trailing' \| 'none' | 'leading' | Where the copy glyph sits relative to the label — or `'none'` to omit it. Without a glyph, a successful copy shows a small confirmation label near the pointer and leaves the button unchanged. |
| `iconTrailing?` | IconShape | — | Trailing icon shape. Renders after `children`, last in the slot order. |
| `label?` | string | — | Label text. Renders between the leading icon and `children`. |
| `loading?` | boolean | — | Show a rotating loading indicator. Blocks clicks and keyboard activation, and removes the button from the tab order while active. |
| `onClick?` | (e) => void | — | Click handler. |
| `onCopied?` | (ok) => void | — | Fires after the copy attempt with whether it succeeded. |
| `onCopyRequest?` | () => void | — | Refresh a dynamic `copy` value before activation. Set the new string in application state so the next render updates `copy`. Return values are ignored. Fires on pointerdown and Enter/Space keydown. |
| `paddingless?` | boolean | — | Drops outer padding to zero. |
| `ping?` | string | — | Space-separated URLs the browser pings on navigation. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' \| 'quaternary' | secondary | Visual emphasis. |
| `rel?` | string | — | Anchor rel. |
| `role?` | string | button | ARIA role override (e.g. `'gridcell'` when a button is a cell in a grid). Forwarded to the underlying element. |
| `round?` | boolean \| number \| string | — | Fully-round corners — a pill for text buttons, a circle for icon-only ones (`border-radius: 999px`, clamped to the element's height). Pass a `number` (px) or a CSS length string (`'1rem'`) for a custom radius instead. |
| `selected?` | boolean | — | Toggled-on / pressed state, e.g. for filter chips. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Size variant. small=24px, medium=28px, large=32px. Omit the attribute or pass `'medium'` for the default — both render identically and emit no DOM attribute. |
| `tabIndex?` | number | 0 | Tab order. The button is keyboard-focusable by default (`0`) and becomes `-1` automatically while `disabled` or `loading` — `<a-button>` and `<a role="button">` aren't focusable without an explicit tabindex, and a loading button must stay out of the tab order so Enter/Space can't fire it mid-flight. |
| `target?` | string | — | Anchor target. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | neutral | Semantic tone, or any literal CSS color (`'#ff1493'`, `'rebeccapurple'`) for a one-off custom tone. Primary uses the color as-is; secondary, tertiary, and quaternary take its hue and pin lightness/chroma to the brand curve so any input stays legible. |
| `type?` | 'button' \| 'submit' \| 'reset' | — | Form submission type. |
| `underline?` | 'solid' \| 'dashed' \| 'dotted' | — | Underline style. |
| `underlineOnHover?` | boolean | — | Hide the underline at rest and reveal it on hover. |

## Link mode

Set `href` to render a link with button styling. An absent or `undefined` URL
keeps the regular button, which makes conditional links straightforward.

```tsx
<Button href="/docs" target="_blank" label="Read the docs" />
<Button
  href={reportUrl}
  disabled={!reportUrl}
  iconTrailing="external-link"
  label="View report"
/>
```

### Routing libraries

For client-side routing, wrap your router's link and add `role="button"` and
`data-anta` to its anchor output.

```tsx
import { Link } from 'react-router-dom'

export const LinkButton = ({ label, ...props }) => (
  <Link role="button" data-anta {...props}>
    <a-button-label>{label}</a-button-label>
  </Link>
)
```

## Forms and custom events

Use `type="submit"` or `type="reset"` with a form. The `form` prop associates a
button with a form elsewhere on the page.

```tsx
<form id="signup">
  <Button tone="brand" type="submit" label="Sign up" />
  <Button priority="tertiary" type="reset" label="Clear" />
</form>
<Button type="submit" form="signup" label="Submit from outside" />
```

Set `data-custom-event` to dispatch a bubbling custom event on activation.

```tsx
<Button label="Save" data-custom-event="save-clicked" />
```

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `disabled?` | boolean | — | Disable the button. |
| `download?` | string \| boolean | — | Anchor download attribute. Empty string / `true` triggers a download with the resource's default name; a string overrides the filename. |
| `form?` | string | — | Form id when the button isn't a descendant of its form. |
| `href?` | string | — | URL to link to. A definite string renders `<a role="button">`; omit it (or pass `undefined`) to render `<a-button>`, so `href={maybeUrl}` degrades to a plain button when the URL is absent. |
| `icon?` | IconShape | — | Leading icon shape. When set alone (no `label`, no `iconTrailing`, no `children`), the button renders as a square icon-only control and the wrapper auto-supplies `aria-label={icon}` (override by passing your own `aria-label`). |
| `iconTrailing?` | IconShape | — | Trailing icon shape. Renders after `children`, last in the slot order. |
| `label?` | string | — | Label text. Renders between the leading icon and `children`. |
| `loading?` | boolean | — | Show a rotating loading indicator. Blocks clicks and keyboard activation, and removes the button from the tab order while active. |
| `onClick?` | (e) => void | — | Click handler. |
| `paddingless?` | boolean | — | Drops outer padding to zero. |
| `ping?` | string | — | Space-separated URLs the browser pings on navigation. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' \| 'quaternary' | secondary | Visual emphasis. |
| `rel?` | string | — | Anchor rel. |
| `role?` | string | button | ARIA role override (e.g. `'gridcell'` when a button is a cell in a grid). Forwarded to the underlying element. |
| `round?` | boolean \| number \| string | — | Fully-round corners — a pill for text buttons, a circle for icon-only ones (`border-radius: 999px`, clamped to the element's height). Pass a `number` (px) or a CSS length string (`'1rem'`) for a custom radius instead. |
| `selected?` | boolean | — | Toggled-on / pressed state, e.g. for filter chips. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Size variant. small=24px, medium=28px, large=32px. Omit the attribute or pass `'medium'` for the default — both render identically and emit no DOM attribute. |
| `tabIndex?` | number | 0 | Tab order. The button is keyboard-focusable by default (`0`) and becomes `-1` automatically while `disabled` or `loading` — `<a-button>` and `<a role="button">` aren't focusable without an explicit tabindex, and a loading button must stay out of the tab order so Enter/Space can't fire it mid-flight. |
| `target?` | string | — | Anchor target. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | neutral | Semantic tone, or any literal CSS color (`'#ff1493'`, `'rebeccapurple'`) for a one-off custom tone. Primary uses the color as-is; secondary, tertiary, and quaternary take its hue and pin lightness/chroma to the brand curve so any input stays legible. |
| `type?` | 'button' \| 'submit' \| 'reset' | — | Form submission type. |
| `underline?` | 'solid' \| 'dashed' \| 'dotted' | — | Underline style. |
| `underlineOnHover?` | boolean | — | Hide the underline at rest and reveal it on hover. |

## Web Component

When using `<a-button>` directly, add its button role and keyboard tab stop.

```html
<a-button role="button" tabindex="0" priority="primary">
  <a-icon shape="plus" aria-hidden="true"></a-icon>
  <a-button-label>Create project</a-button-label>
</a-button>
```

Use `<button data-anta>` when you need native button and form behavior.

```html
<button data-anta tone="brand" priority="primary">Save changes</button>
<button data-anta disabled>Unavailable</button>
```

## Styling

Use `tone`, `priority`, `size`, and `round` before adding custom CSS. For a
distinct treatment, target a class on the button and cover its interaction
states.

```css
a-button.checkout {
  color: #fff;
  background: #673de6;
  border-radius: 999px;
  padding-inline: 20px;
}

a-button.checkout:hover { background: #5931c4; }
a-button.checkout:active { background: #48269f; }
```
