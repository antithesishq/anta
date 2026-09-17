# Button

Trigger an action with `Button`. Set `href` when it should navigate.

## Priority

Use priority to set emphasis. `secondary` is the default.

```tsx
<Button tone="brand" priority="primary" label="Publish" />
<Button tone="brand" priority="secondary" label="Move" />
<Button tone="brand" priority="tertiary" label="Cancel" />
<Button tone="brand" priority="quaternary" label="Remind" />
```

| Priority | Use |
| --- | --- |
| `primary` | Main action |
| `secondary` | Standard action |
| `tertiary` | Quiet action |
| `quaternary` | Text-like action |

## Tone

Tone communicates intent. Pass a named tone or any CSS color.

```tsx
<Button label="Save" />
<Button tone="brand" label="Publish" />
<Button tone="critical" label="Delete" />
<Button tone="info" label="Preview" />
<Button tone="success" label="Approve" />
<Button tone="warning" label="Archive" />
<Button tone="#e0457b" label="Custom color" />
```

## Size and shape

`medium` is the default. Use `round` for a pill or circle, or pass a radius.

```tsx
<Button size="small" tone="brand" label="Small" />
<Button size="medium" tone="brand" label="Medium" />
<Button size="large" tone="brand" label="Large" />
<Button round tone="brand" label="Pill" />
<Button round tone="brand" icon="heart" aria-label="Like" />
<Button round={10} tone="brand" label="10px" />
```

## States

`loading` runs a diagonal stripe across the button while blocking interaction.

```tsx
<Button tone="brand" loading label="Submitting" />
<Button tone="brand" disabled label="Locked" />
<Button tone="brand" selected label="Selected" />
```

| State | Behavior |
| --- | --- |
| `loading` | Animated stripe; blocks activation |
| `disabled` | Blocks activation |
| `selected` | Shows a persistent pressed state |

## Content and display

Add leading and trailing icons with `icon` and `iconTrailing`. An icon-only
button needs an accessible label.

```tsx
<Button tone="brand" icon="check" label="Confirm" />
<Button tone="brand" iconTrailing="external-link" label="Read the docs" />
<Button tone="critical" icon="trash" aria-label="Delete" />

<Button tone="brand" icon="check" label="Save" aria-keyshortcuts="Meta+s">
  <kbd aria-hidden="true">⌘S</kbd>
</Button>
```

Use `paddingless` for a quaternary button inside text. Use `underline` and
`underlineOnHover` for link-like treatments.

```tsx
<Button
  tone="brand"
  priority="quaternary"
  paddingless
  underline="solid"
  underlineOnHover
  label="Skip the example"
/>
```

## Copy button

`ButtonCopy` copies text and shows success or failure feedback.

```tsx
<ButtonCopy copy="npm i @antadesign/anta" label="Copy install command" />
<ButtonCopy copy="https://anta.design" priority="tertiary" />
```

It can also copy the page URL or a rendered DOM region. Its copy-specific props
are listed with the shared Button props in [Props](#props).

## Links and forms

Set `href` for navigation. An undefined `href` falls back to a button, which is
useful when a URL is conditional.

Inside a form, set `type="submit"` to submit or `type="reset"` to clear its fields.

```tsx
<Button href="/docs" label="Read the docs" />

<Button
  href={reportUrl}
  disabled={!reportUrl}
  label="View report"
/>

<form>
  <Button type="submit" label="Save" />
  <Button type="reset" label="Reset" />
</form>
```

For client-side routers, render an anchor with `role="button"` and `data-anta`.

```tsx
<Link to="/dashboard" role="button" data-anta tone="brand">
  <a-button-label>Dashboard</a-button-label>
</Link>
```

## Props

`ButtonCopy` accepts Button's appearance, content, and state props. It does not
accept `selected`, `iconTrailing`, or the link and form props.

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

Choose one copy target: `copy`, `copyNode`, or `copyUrl`.

| ButtonCopy-only prop | Type | Default | Description |
| --- | --- | --- | --- |
| `copy` | `string` | — | Text to copy |
| `copyNode` | `boolean \| string` | — | DOM region to copy as rich and plain text |
| `copyUrl` | `true` | — | Copy the current page URL |
| `copyWithUrl` | `boolean` | — | Add the page URL before copied text |
| `onCopyRequest` | `() => void` | — | Refresh controlled copy text before activation |
| `onCopied` | `(ok: boolean) => void` | — | Runs after a copy attempt |
| `iconPlacement` | `leading \| trailing \| none` | `leading` | Position or hide the copy glyph |
| `copiedLabel` | `string` | `Copied` | Success text when the glyph is hidden |

## Web Component

Use `<a-button>` directly outside React or Preact.

```html
<a-button role="button" tabindex="0" priority="primary">
  <a-icon shape="plus" aria-hidden="true"></a-icon>
  <a-button-label>Create project</a-button-label>
</a-button>
```

Add `data-anta` to style a native button with Anta.

```html
<button data-anta tone="brand" priority="primary">Save changes</button>
```

## Customization

Start with `tone`, `priority`, `size`, and `round`. For deeper changes, target
the light-DOM element with a class.

```tsx
<Button className="checkout" label="Checkout" />
```

```css
a-button.checkout {
  background: linear-gradient(135deg, #7c3aed, #db2777);
  color: white;
  border-radius: 999px;
  padding-inline: 24px;
}

a-button.checkout:hover {
  background: linear-gradient(135deg, #6d28d9, #be185d);
}
```
