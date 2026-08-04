# Checkbox

Checkboxes let users select one or more items from a set, or toggle an option on or off. Use them for multiple independent choices; for a single immediate setting, use a switch instead.

The `Checkbox` wrapper renders an `<a-checkbox>` element that manages its own state. It works both controlled and uncontrolled with `checked` / `defaultChecked` (boolean or `'indeterminate'`) and `onStateChange` for updates.

## Tone

`tone` colours the **mark** — the checked-box fill and, for a tinted tone, the
unselected box border (a light shade of the fill that darkens on hover and active,
like the neutral border; `neutral` keeps a grey border). The label and hint stay
neutral. Six named tones (`neutral` default), or pass any CSS color for a custom tone.

```tsx
<Checkbox defaultChecked tone="neutral">Neutral</Checkbox>
<Checkbox defaultChecked tone="brand">Brand</Checkbox>
<Checkbox defaultChecked tone="critical">Critical</Checkbox>
<Checkbox defaultChecked tone="mediumaquamarine">Custom color</Checkbox>
```

## Selected-only tone

`toneSelected` tones the **checked mark only** — the empty box stays neutral grey
until it's checked. Reach for it instead of `tone` when a resting tinted border would
read as a validation error. Same value set as `tone`.

```tsx
<Checkbox toneSelected="brand">Off stays neutral</Checkbox>
<Checkbox defaultChecked toneSelected="critical">Checked mark tinted</Checkbox>
```

## Colouring the text

There's no text-tone prop. To tint the **label**, set `color` on the checkbox with a
theme-aware `--text-N-{tone}` token (the label inherits it); for the **hint**, add a
`color` rule on the `a-checkbox-hint` child. Pair either with `tone` / `toneSelected`
to tint the whole control.

```css
/* Mark via the prop, text via a plain color rule — the label inherits the host
   colour, the hint is targeted directly. The class is just for the demo — swap
   your own selector. */
a-checkbox.toned-text { color: var(--text-1-critical); }
a-checkbox.toned-text a-checkbox-hint { color: var(--text-3-critical); }
```

## Size

Three sizes scale the box **and** the label + hint type together: `small`
(14px box / 13px label), `medium` (16px / 15px, the default), and `large`
(18px / 17px).

```tsx
<Checkbox defaultChecked size="small">Small</Checkbox>
<Checkbox defaultChecked>Medium</Checkbox>
<Checkbox defaultChecked size="large">Large</Checkbox>
```

## Label & hint

Pass the label as `children` or the `label` prop. Add a `hint` for a secondary line beneath. For a label-less checkbox (e.g. a table "select all"), pass `aria-label`.

```tsx
<Checkbox label="Email notifications" hint="Weekly digest, never marketing." />
<Checkbox aria-label="Select all rows" />
```

## States

Checkboxes are unchecked, checked, or indeterminate (for partial selection in groups).

```tsx
<Checkbox defaultChecked label="Checked" />
<Checkbox label="Unchecked" />
<Checkbox defaultChecked="indeterminate" label="Indeterminate" />
```

## Disabled

The `disabled` attribute dims the checkbox and removes it from the tab order.

```tsx
<Checkbox disabled label="Disabled" />
<Checkbox disabled defaultChecked label="Disabled checked" />
```

## Controlled

Uncontrolled by default: pass `defaultChecked` and read the value from `onStateChange` or at form-submit. Make it controlled with `checked` and `onStateChange` to drive it from your store.

```tsx
const [agreed, setAgreed] = useState(false)

<Checkbox
  checked={agreed}
  onStateChange={(_e, { next }) => setAgreed(next as boolean)}
>
  I agree
</Checkbox>
```

`onStateChange` fires before the element applies, with signature `(event, { next, prev })`. Call `event.preventDefault()` to veto the change. A controlled checkbox with no `onStateChange` is read-only.

## Events

Three callbacks, in firing order:

| Callback | When | Cancelable | Payload |
|---|---|---|---|
| `onStateChange(e, { next, prev })` | **before** the toggle applies | ✅ `e.preventDefault()` vetoes | next / prev state |
| `onChange(e)` | **after** it applies | — | native `change` event |
| `onValueChange(e, attrs)` | **after** it applies | — | `{ checked, indeterminate, name, value }` |

Reach for **`onStateChange`** only to intercept or veto (or to drive a controlled
checkbox). For the everyday "react to the new value", use **`onValueChange`** — it
hands you the value without touching `event.target`. `onChange` is the plain
native hook. (In controlled mode `onChange`/`onValueChange` fire once you've updated
`checked`.) `onFocus` / `onBlur` work too — the host is the focusable element.

Checkbox has `onStateChange` (and `Input` doesn't) because its state is
**discrete** — `checked · unchecked · indeterminate` — so a transition can be
vetoed *before* it applies. A text field's value is free-form, with no discrete
state to model or veto, so `Input` (and the composed `Select`) expose only the
`onValueChange` half. The `onValueChange` shape is identical across all of them.

```tsx
<Checkbox onValueChange={(_e, { checked }) => save(checked)}>Subscribe</Checkbox>
```

## Indeterminate

Set `checked="indeterminate"` to show the "mixed" state (minus glyph). Common for a parent checkbox whose state derives from its children: all on = checked, all off = unchecked, mixed = indeterminate.

```tsx
function ParentChild() {
  const [on, setOn] = useState([true, false])
  return (
    <>
      <Checkbox
        checked={on[0] && on[1] ? true : on[0] || on[1] ? 'indeterminate' : false}
        onStateChange={(_e, { next }) => setOn([next === true, next === true])}
      >
        Parent
      </Checkbox>
      <div style={{ marginInlineStart: 24 }}>
        <Checkbox
          checked={on[0]}
          onStateChange={(_e, { next }) => setOn([next === true, on[1]])}
        >
          Child 1
        </Checkbox>
        <Checkbox
          checked={on[1]}
          onStateChange={(_e, { next }) => setOn([on[0], next === true])}
        >
          Child 2
        </Checkbox>
      </div>
    </>
  )
}
```

## Accessibility

The wrapper sets `role="checkbox"` and `aria-checked` (`"true"` / `"false"` / `"mixed"`), and derives the accessible name from `label` or `children`. For a label-less checkbox, pass `aria-label`.

Space toggles the checkbox. Follows the [WAI-ARIA checkbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/).

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked?` | CheckboxValue | — | Controlled checked state. When provided the checkbox is controlled — it
 renders exactly this and never self-applies; `onStateChange` is a *request*
 the consumer accepts by updating this prop. Use `defaultChecked` for an
 uncontrolled checkbox. `'indeterminate'` shows the minus glyph and takes
 visual precedence; clicking it requests `true`. |
| `defaultChecked?` | CheckboxValue | false | Initial checked state for an uncontrolled checkbox. Read once; later
 changes are ignored and the element updates its state after interaction. |
| `disabled?` | boolean | — | Disable the checkbox (no interaction, dropped from the tab order). |
| `hint?` | ReactNode | — | Secondary text rendered under the label — explanatory copy, like
 Input's hint. Not part of the accessible name. |
| `label?` | string | — | Visible label — the *value* of the checkbox (clicked along with the box).
 Convenience for the common single-string case; for richer content (markup,
 a link, an info icon) use `children`. When both are supplied, `label`
 renders first. Required unless `children` or `aria-label` is provided
 (a `role="checkbox"` takes its name from the author, not the markup). |
| `name?` | string | — | Form field name. Inside a `<form>` the checkbox submits under this name,
 contributing `value` when checked — like a native checkbox. |
| `onChange?` | (event) => void | — | Fired *after* the checked state changes — a native `change` event (the
 post-apply counterpart to `onStateChange`). Not cancelable. For a controlled
 checkbox this fires once you've updated `checked`. |
| `onStateChange?` | (event, detail) => void | — | Fired on click / Space *before* the element applies any change. Event-first
 so `event.preventDefault()` is the synchronous veto (uncontrolled mode);
 `detail` carries `{ next, prev }`. In controlled mode the element never
 self-applies — answer by updating `checked`, reject by doing nothing. |
| `onValueChange?` | (event, attrs) => void | — | Like `onChange`, but with a `{ checked, indeterminate, name, value }` snapshot
 as the 2nd argument — the ergonomic "just give me the new value" callback
 (mirrors `Input`'s `onValueChange`). |
| `round?` | boolean \| number \| string | — | Round the checkbox mark to a circle (`border-radius: 999px` on the box). Pass
 a `number` (px) or a CSS length string for a rounded-square mark instead. |
| `size?` | 'small' \| 'medium' \| 'large' | 'medium' | Size variant. small=14px, medium=16px, large=18px box. |
| `tone?` | 'brand' \| 'neutral' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'neutral' | Colour of the **mark** in every state — the checked-box fill *and* the
 unselected box border. A named tone or any literal CSS color (`'#ff1493'`,
 `'rebeccapurple'`) for a one-off custom tone. Named tones track light/dark mode
 automatically; a custom colour keeps its hue + chroma and pins lightness to the
 fill curve. Use `toneSelected` instead to tone only the checked mark and leave
 the empty box neutral. The label + hint stay neutral — recolour them in plain
 CSS via the theme-aware `--text-N-{tone}` tokens. |
| `toneSelected?` | 'brand' \| 'neutral' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'neutral' | Like `tone`, but coloured onto the **checked mark only** — the empty box stays
 neutral grey until it's checked. Prefer this over `tone` when a resting tinted
 border would read as a validation state. Same value set as `tone`; if both are
 set, `tone` governs the off-state border and `toneSelected` the checked fill. |
| `value?` | string | "on" | Value submitted with the form when checked — like a native checkbox. |

Use this when you are not using the React or Preact wrapper and a native HTML control does not fit: construct the equivalent Anta web component from the elements below.

The focusable host carries the state. Label and hint are light-DOM children.

```html
<a-checkbox role="checkbox" tabindex="0" name="updates" default-state="checked">
  <a-checkbox-label>Email updates</a-checkbox-label>
  <a-checkbox-hint>Product and security notices.</a-checkbox-hint>
</a-checkbox>
```

### Native HTML checkbox

For a standard HTML form, add `data-anta` to a native checkbox. It keeps the
browser's label behavior, checked and indeterminate states, and form submission
while using Anta's control surface.

`size`, `tone`, `tone-selected`, and `round` use the matching Checkbox visual
treatments.

```html
<div style="display: grid; gap: 8px">
  <label><input data-anta type="checkbox" name="updates" size="small" tone="brand"> Product updates</label>
  <label><input data-anta type="checkbox" name="security" tone-selected="success" checked> Security notices</label>
  <label><input data-anta type="checkbox" name="billing" size="large" round tone="warning" checked> Billing alerts</label>
</div>
```

Reach for the props first: **`tone`** colours the mark in every state,
**`toneSelected`** only the checked mark (any CSS colour for a custom tone — it
derives the full rest/hover/active curve in oklch), **`size`** the dimensions + type.
To tint the label + hint, add a `color` rule (on the host for the label, on
`a-checkbox-hint` for the hint) with the `--text-N-{tone}` tokens — there's no
text-tone prop. The focus ring is the global
[`--focus-ring`](../colors.md#focus-ring).

```tsx
<Checkbox tone="#e0457b" defaultChecked>Custom colour</Checkbox>
```

For anything else, `<a-checkbox>` is light-DOM — the **box is `::before`**, the
**check/minus glyph is `::after`** (a masked SVG — swap `--checkbox-mask-check` for a
custom mark), the label/hint are the `a-checkbox-label` / `a-checkbox-hint` children.
Target them with plain CSS, **per state** (an un-layered rule beats `@layer anta`
without `!important`). The classes below are just for the demos:

```css
/* Outlined — an unfilled box: the checked box keeps its background and paints the
   border + checkmark in the tone colour (light-dark() tunes both themes at once). */
a-checkbox.outlined:state(checked)::before {
  background: var(--checkbox-bg);
  border-color: light-dark(#5f4bc3, #7460d7);
}
a-checkbox.outlined:state(checked)::after {
  background-color: light-dark(#5f4bc3, #7460d7);
}

/* Customized — bold label, bigger circular box, bigger checkmark.
   Colours use light-dark() so they're tuned for both themes at once. */
a-checkbox.customized { font-weight: 700; }
a-checkbox.customized::before,
a-checkbox.customized::after { inline-size: 24px; block-size: 24px; margin-block-start: -2px; }
a-checkbox.customized::before { border-radius: 50%; border-width: 2px; }
a-checkbox.customized::after { mask-size: 16px; }                /* bigger mark */
a-checkbox.customized:state(checked)::before {
  background: light-dark(#1f6e5f, #2f9c84);
  border-color: light-dark(#1f6e5f, #2f9c84);
}

/* Beautified — a full white heart mark swapped in via --checkbox-mask-check
   (centred by the default mask-position), sized down a touch, on a pink fill */
a-checkbox.beautified {
  --checkbox-mask-check: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z'/%3E%3C/svg%3E");
}
a-checkbox.beautified::before { border-radius: 8px; }
a-checkbox.beautified::after { mask-size: 10px; }            /* smaller heart */
a-checkbox.beautified:state(checked)::before {
  background: light-dark(#ec4899, #f472b6);                  /* pink, both themes */
  border-color: transparent;
}
```
