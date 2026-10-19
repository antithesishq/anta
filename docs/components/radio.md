# Radio

Use RadioGroup when someone needs to choose one option from a visible set,
such as a plan or contact method. Pass the choices through `options` and add
a group label to explain the decision.

## Options, label, and hint

```tsx
<RadioGroup
  label="How should we reach you?"
  hint="We'll only use this for account alerts."
  defaultValue="email"
  options={[
    { value: 'email', label: 'Email', hint: 'A confirmation link goes to your inbox.' },
    { value: 'sms', label: 'SMS', hint: 'Standard message rates apply.' },
    { value: 'push', label: 'Push notification' },
  ]}
/>
```

Give each option a unique `value` and a `label`. Add an option `hint` when a
choice needs explanation. The selected option's value is submitted with the form.

Use the group's `label` to name the whole set and its `hint` for instructions
that apply to every option.

Each option can also set `className`, `style`, and `data-*`.
`RadioGroup` forwards them to that option's `<a-radio>` so you can add
per-option presentation and application metadata.

## Tone

```tsx
{/* Usually one tone for the whole group: */}
<RadioGroup
  tone="info"
  defaultValue="a"
  options={[
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ]}
/>
```

Six named tones — `neutral` (default), `brand`, `info`, `success`, `warning`,
`critical`. `tone` colors the **mark** in every state — the selected-ring fill + dot
and (for a tinted tone) the unselected ring border (a light shade of the fill that
darkens on hover and active; `neutral` keeps a grey ring). The label and hint stay
neutral — color them in plain CSS with the `--text-N-{tone}` tokens. Set `tone` on
the `RadioGroup` to color every option, or on a single option to override just that
one. Any literal CSS color works too, for a one-off custom tone.

## Selected-only tone

```tsx
<RadioGroup
  tone="brand"
  toneScope="selected"
  defaultValue="a"
  options={[
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ]}
/>
```

`toneScope="selected"` applies the group's `tone` to the **selected option only** —
every unselected ring stays neutral grey. Use it when a resting tinted border would
read as a validation error. Set the scope on the group, or on a single option to
override the group.

To color the **label and hint**, there's no prop — add a `color` rule on the
option's `a-radio-label` / `a-radio-hint` with a `--text-N-{tone}` value.

## Size

```tsx
{/* Usually one size for the whole group: */}
<RadioGroup
  size="small"
  defaultValue="a"
  options={[
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ]}
/>
```

Three sizes scale the control circle **and** the label + hint type together:
`small` (14px ring / 13px label), `medium` (16px / 15px, the default), and
`large` (18px / 17px). Set it on the `RadioGroup`, or on a single option to
override one.

## Orientation and layout

```tsx
<RadioGroup
  orientation="horizontal"
  defaultValue="yes"
  options={[
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'maybe', label: 'Maybe' },
  ]}
/>
```

`vertical` (the default) stacks the options; `horizontal` lays them in a row.
Arrow keys move the selection either way.

For anything beyond that, the options live in a plain light-DOM `<a-radio-list>`,
so you can restyle their arrangement with ordinary CSS — no shadow parts:

```css
/* e.g. a two-column grid */
a-radio-group a-radio-list { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
```

## Disabled

```tsx
{/* `disabled` on one option, or on the group to disable the whole set */}
<RadioGroup
  defaultValue="checked"
  options={[
    { value: 'checked', label: 'Checked' },
    { value: 'unchecked', label: 'Unchecked', disabled: true },
  ]}
/>
```

Set `disabled` on a single option to disable just that one, or on the
`RadioGroup` to disable the whole set. Disabled options are skipped by keyboard
navigation and dropped from the tab order.

## Validation

```tsx
<RadioGroup
  label="Pick a plan"
  hint="Please choose a plan to continue."
  status="critical"
  options={[
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
  ]}
/>
```

`status` recolors the group `hint` for feedback — the same tone set as
[`Input`](./input.md): `critical`, `warning`, `success`, `info`, `brand`
(omit for neutral). It styles the message only; drive it from your own validation.

## Keyboard and accessibility

The group is one Tab stop: `Tab` moves into the selected option (or the first
enabled one), the arrow keys (`↑`/`↓`/`←`/`→`) move the selection between enabled
options (wrapping at the ends), and `Space` / `Enter` select the focused option.
Follows the [WAI-ARIA radio-group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/).

Each option's label names it for screen readers, and its hint supplies a
description. Give the group a `label` or `aria-label` so the choice itself also
has an accessible name.

## Forms

Add `name` to submit the selected option's value with a form. An uncontrolled
group returns to `defaultValue` on form reset. For a controlled group, handle
the reset request in `onStateChange` and update `value` as needed.

```tsx
<form>
  <RadioGroup name="contact" defaultValue="email" options={[
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
  ]} />
</form>
// FormData → contact=email
```

## Controlled vs. uncontrolled

Pass `defaultValue` when the group can manage its own selection:

```tsx
<RadioGroup name="plan" defaultValue="pro" options={[
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'team', label: 'Team' },
]} />
```

Pass `value` with `onStateChange` when the application controls selection.
Update `value` to accept a requested choice, or leave it unchanged to reject it.
For an uncontrolled group, call `event.preventDefault()` to cancel a user pick:

```tsx
const [plan, setPlan] = useState('pro')

<RadioGroup
  name="plan"
  value={plan}
  onStateChange={(_event, { next }) => { if (next !== null) setPlan(next) }}
  options={[
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'team', label: 'Team' },
  ]}
/>
```

`onStateChange`'s `detail` carries a `reason`: `'user'` for a pick (the only
**cancelable** one — `preventDefault()` vetoes it), and `'reset'` / `'restore'`
when a `<form>` reset or a bfcache/autofill restore moves the selection. Filter on
`reason` if you only want user picks; `next` is `null` when nothing is selected.

## Events

Three callbacks, in firing order:

| Callback | When | Cancelable | Payload |
|---|---|---|---|
| `onStateChange(e, { next, prev, reason })` | **before** a pick applies | ✅ (user picks only) | next / prev value + `reason` |
| `onChange(e)` | **after** selection applies | — | native `change` event |
| `onValueChange(e, attrs)` | **after** selection applies | — | `{ value, name }` |

Use `onStateChange` to control or cancel a selection request. Its `reason`
distinguishes a user pick from form reset or restoration. Use `onValueChange`
to save or react to an applied selection. `onChange` exposes the native event.
`onFocus` and `onBlur` report focus entering and leaving the group.

```tsx
<RadioGroup
  label="Contact method"
  onValueChange={(_event, { value }) => save(value)}
  options={[
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
  ]}
/>
```

## RadioGroup props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | RadioOption[] | — | The options. The wrapper renders one `<a-radio>` per entry and computes its `selected` / roving `tabindex` / `role` declaratively. |
| `defaultValue?` | string | — | Initial selected value for uncontrolled use. |
| `disabled?` | boolean | — | Disable the whole group. |
| `hint?` | string | — | Plain-text description for the group, rendered directly under `label` (above the options) — typically instructional copy. Per-option helper text goes on the option's own `hint` instead. |
| `label?` | string | — | Plain-text label for the whole group, rendered above the options. |
| `name?` | string | — | Form field name — the group submits one `name=value` (it's the form-associated element). |
| `onBlur?` | (event) => void | — | Fired when focus leaves the group entirely — wired to `focusout`. |
| `onChange?` | (event) => void | — | Fired *after* the selection changes — a native `change` event (the post-apply counterpart to `onStateChange`). Not cancelable; for a controlled group it fires once you've updated `value`. |
| `onFocus?` | (event) => void | — | Fired when focus enters the group (any option) — wired to `focusin`, since focus lands on an individual option, not the group element itself. |
| `onStateChange?` | (event, detail) => void | — | Fired whenever selection changes — event-first. `detail` is `{ next, prev, reason }`: `next`/`prev` are values (`null` = nothing selected); `reason` is `'user'` \| `'reset'` \| `'restore'`. A `'user'` pick fires *before* applying and is **cancelable** — `event.preventDefault()` vetoes it (uncontrolled), or in controlled mode answer by updating `value` (reject by doing nothing). `'reset'` (form reset) and `'restore'` (bfcache / autofill) are not cancelable — filter on `reason` if you only track user picks. |
| `onValueChange?` | (event, attrs) => void | — | Like `onChange`, but with a `{ value, name }` snapshot as the second argument, matching `Input`. |
| `orientation?` | 'vertical' \| 'horizontal' | 'vertical' | Layout + arrow-key axis. |
| `size?` | 'small' \| 'medium' \| 'large' | 'medium' | Size applied to every option (an option's own `size` wins). |
| `status?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' | 'neutral' | Validation/feedback tone for the group `hint` — recolors it (same tone set as `Input`'s `status`). Use `critical` for an error message, etc.; omit for the neutral default. |
| `tone?` | 'brand' \| 'neutral' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'neutral' | Mark tone applied to every option (an option's own `tone` wins), or any literal CSS color for a one-off custom tone. In the default `all` scope it colors the selected-ring fill + dot and the unselected ring border. Named tones track light/dark mode. Set `toneScope="selected"` to tone only the selected option and leave the rest neutral. The option text stays neutral — recolor it in plain CSS via the `--text-N-{tone}` tokens. |
| `toneScope?` | 'all' \| 'selected' | 'all' | Apply `tone` to every state, or only to the selected option so unselected rings stay neutral. An option's own `toneScope` wins. |
| `value?` | string | — | Controlled selected value. The group follows this prop and reports a requested change through `onStateChange`. Leave it undefined for uncontrolled use. |

## Web Component

Use the web component directly when you are not using React or Preact and a native control does not fit.

Use `state` for controlled selection or `default-state` for the initial
uncontrolled selection. The read-only `.value` property returns the applied
selection. Remove `state` to release control and retain that selection.
User picks update internal state without rewriting authored attributes.
Accept a controlled pick through `statechange` by setting `state` to
`event.detail.next`. An empty string is a valid option value.

Put options in `<a-radio-list>` and add `tabindex="0"` to the group for
keyboard access. The raw group manages focus among its options.

```html
<a-radio-group role="radiogroup" tabindex="0" name="plan" default-state="pro">
  <a-radio-group-label>Plan</a-radio-group-label>
  <a-radio-list>
    <a-radio role="radio" value="starter"><a-radio-label>Starter</a-radio-label></a-radio>
    <a-radio role="radio" value="pro"><a-radio-label>Pro</a-radio-label></a-radio>
  </a-radio-list>
</a-radio-group>
```

### Native HTML radio inputs

For a standard HTML form, add `data-anta` to each native radio. Radios that share
a `name` retain the browser's selection, keyboard behavior, labels, and form
submission while using Anta's control surface.

`size`, `tone`, and `tone-scope` use the matching RadioGroup option
treatments.

```html
<div style="display: grid; gap: 8px">
  <label><input data-anta type="radio" name="plan" value="starter" size="small" tone="brand"> Starter</label>
  <label><input data-anta type="radio" name="plan" value="pro" tone="success" tone-scope="selected" checked> Pro</label>
  <label><input data-anta type="radio" name="plan" value="enterprise" size="large" tone="warning"> Enterprise</label>
</div>
```

## Styling

Reach for the props first: **`tone`** chooses the mark color and **`toneScope`**
chooses whether it applies in all states or only to the selected option (any CSS
color can be set on the group or one option and derives the full curve in oklch), **`size`** the
dimensions + type. To tint the label + hint, add a `color` rule on the option's
`a-radio-label` / `a-radio-hint` with the `--text-N-{tone}` values — there's no
text-tone prop. The focus ring is the global [`--focus-ring`](../colors.md#focus-ring).

```tsx
<RadioGroup tone="#e0457b" defaultValue="a" options={[{ value: 'a', label: 'A' }]} />
```

For anything else, `<a-radio>` is light-DOM — the **ring is `::before`**, the **dot
is `::after`**, the label/hint are the `a-radio-label` / `a-radio-hint` children.
Target them with ordinary CSS, **per state** (an un-layered rule beats `@layer anta`
without `!important`). The groups below push it — an outlined (unfilled) selected
ring, square black/white marks, and a bigger ring with a heart-shaped mark (the dot,
masked — same heart as the checkbox):

```css
/* Outlined — an unfilled selected ring: keep the ring background and paint the
   border + dot in the tone color (light-dark() tunes both themes at once). */
a-radio-group.outlined a-radio:state(selected)::before {
  background: var(--radio-bg);
  border-color: light-dark(#5f4bc3, #7460d7);
}
a-radio-group.outlined a-radio:state(selected)::after { background: light-dark(#5f4bc3, #7460d7); }

/* Square — square ring + square dot, black/white per theme via light-dark() */
a-radio-group.square a-radio::before,
a-radio-group.square a-radio::after { border-radius: 0; }
a-radio-group.square a-radio:state(selected)::before { background: light-dark(#000, #fff); border-color: light-dark(#000, #fff); }
a-radio-group.square a-radio:state(selected)::after { background: light-dark(#fff, #000); }   /* contrasting dot */

/* Heart — a bigger ring with a heart mark (the dot ::after, masked) on a pink fill.
   Same heart SVG as the checkbox; mask-size: contain centers it in the bigger ring. */
a-radio-group.heart a-radio::before { inline-size: 22px; block-size: 22px; }   /* bigger ring */
a-radio-group.heart a-radio::after {
  inline-size: 13px; block-size: 13px; border-radius: 0;
  mask-image: url("data:image/svg+xml,%3Csvg …a heart path… /%3E");
  mask-size: contain; mask-repeat: no-repeat; mask-position: center;
}
a-radio-group.heart a-radio:state(selected)::before { background: light-dark(#ec4899, #f472b6); border-color: transparent; }
a-radio-group.heart a-radio:state(selected)::after { background: #fff; }   /* white heart */
```
