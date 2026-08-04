# Switch

Switches change a single setting immediately. Use a checkbox when people select one or more values to submit together.

The `Switch` wrapper renders a form-associated `<a-switch>` element. It works uncontrolled with `defaultChecked`, or controlled with `checked` and `onStateChange`.

## Tone

`tone` colors the whole control: the checked track, plus the unchecked track border and thumb. Six named tones are available, or pass any CSS color for a custom tone. The label and hint stay neutral.

```tsx
<Switch defaultChecked tone="neutral" label="Neutral" />
<Switch defaultChecked tone="brand" label="Brand" />
<Switch defaultChecked tone="critical" label="Critical" />
<Switch defaultChecked tone="mediumaquamarine" label="Custom color" />
```

## Selected-only tone

`toneSelected` colors the checked track only. The unchecked track and thumb stay neutral until the switch is on. Use it when a resting tinted control could imply a validation state. It accepts the same values as `tone`.

```tsx
<Switch toneSelected="brand" label="Off stays neutral" />
<Switch defaultChecked toneSelected="critical" label="Checked track tinted" />
```

## Coloring the text

There is no text-tone prop. To tint the label, set `color` on the switch with a theme-aware `--text-N-{tone}` token; to tint the hint, target `a-switch-hint`. Pair either with `tone` or `toneSelected` to color the whole control.

```css
/* The class is only for the demo — use your own selector. */
a-switch.toned-text { color: var(--text-1-critical); }
a-switch.toned-text a-switch-hint { color: var(--text-3-critical); }
```

## Size

Three sizes scale the track, thumb, and label together: `small` (26×16px track), `medium` (30×18px, the default), and `large` (34×20px).

```tsx
<Switch defaultChecked size="small" label="Small" />
<Switch defaultChecked label="Medium" />
<Switch defaultChecked size="large" label="Large" />
```

## Round or square

Switches are fully rounded by default. Pass `round` with a number (pixels) or CSS length to set the track radius; the thumb radius is 3px smaller. Pass `round={0}` for square track corners.

```tsx
<Switch defaultChecked round={6} label="6px round" />
<Switch defaultChecked round={2} label="2px round" />
<Switch defaultChecked round={0} label="Square" />
```

## Label and hint

Pass a plain label through `label`, or pass richer label content as children. Add `hint` for a secondary line beneath. `labelPosition="start"` places the label and hint before the control visually while source order remains stable. For a label-less switch, pass `aria-label`.

```tsx
<Switch defaultChecked label="Email notifications" hint="Weekly digest, never marketing." />
<Switch defaultChecked label="Automatic updates" labelPosition="start" />
```

## States

Switches are either unchecked or checked.

```tsx
<Switch label="Unchecked" />
<Switch defaultChecked label="Checked" />
```

## Disabled

The `disabled` attribute dims the switch and removes it from the tab order.

```tsx
<Switch disabled label="Disabled" />
<Switch disabled defaultChecked label="Disabled checked" />
```

## Controlled

Uncontrolled by default: pass `defaultChecked` and read the value from `onStateChange` or at form submit. Make it controlled with `checked` and `onStateChange` to drive it from your store.

```tsx
const [enabled, setEnabled] = useState(false)

<Switch
  checked={enabled}
  onStateChange={(_e, { next }) => setEnabled(next)}
  label="Enable notifications"
/>
```

`onStateChange` fires before the element applies a user toggle, with `(event, { next, prev })`. Call `event.preventDefault()` to veto an uncontrolled change. A controlled switch with no `onStateChange` is read-only.

## Events

Three callbacks, in firing order:

| Callback | When | Cancelable | Payload |
|---|---|---|---|
| `onStateChange(e, { next, prev })` | **before** the toggle applies | ✅ `e.preventDefault()` vetoes | next / previous boolean |
| `onChange(e)` | **after** it applies | — | native `change` event |
| `onValueChange(e, attrs)` | **after** it applies | — | `{ checked, name, value }` |

Use **`onStateChange`** to intercept a toggle or drive a controlled switch. Use **`onValueChange`** when you only need the new form value.

```tsx
<Switch
  name="notifications"
  onValueChange={(_e, { checked }) => saveNotificationPreference(checked)}
  label="Email notifications"
/>
```

## Accessibility

The wrapper sets `role="switch"` and keeps `aria-checked` in sync with the current value. It derives the accessible name from `label` or text children. For a label-less switch, pass `aria-label`.

Space toggles the switch. It follows the [WAI-ARIA switch pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/).

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked?` | boolean | — | Controlled checked value. In controlled mode, update this in `onStateChange`. |
| `defaultChecked?` | boolean | false | Initial checked value for an uncontrolled switch. |
| `disabled?` | boolean | — | Disables interaction and removes the switch from the tab order. |
| `hint?` | ReactNode | — | Secondary text rendered under the label. It does not become part of the
accessible name. |
| `label?` | string | — | Visible, stable label for the setting. Use `children` for richer label content. |
| `labelPosition?` | 'start' \| 'end' | 'end' | Put the visible label before or after the control. Grid layout changes only
the visual order, preserving DOM/source order for assistive technologies. |
| `name?` | string | — | Form field name. A checked switch submits `value` under this name. |
| `onChange?` | (event) => void | — | Native post-apply `change` event. |
| `onStateChange?` | (event, detail) => void | — | Fired before a user toggle applies. Call `event.preventDefault()` to veto an
uncontrolled change; controlled consumers accept by updating `checked`. |
| `onValueChange?` | (event, attrs) => void | — | Post-apply callback with the new form-relevant value snapshot. |
| `round?` | boolean \| number \| string | — | Fully round the thumb and track. Pass a `number` (px) or CSS length string
for a custom track radius; the thumb radius is 3px smaller. |
| `size?` | 'small' \| 'medium' \| 'large' | 'medium' | Size variant. small=26×16px, medium=30×18px, large=34×20px. |
| `tone?` | 'brand' \| 'neutral' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'brand' | Color of the track and thumb. A tinted tone also colors the unchecked
track border and thumb; use `toneSelected` to color only the checked track. |
| `toneSelected?` | 'brand' \| 'neutral' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'brand' | Like `tone`, but applies only while the switch is checked. The unchecked
track and thumb stay neutral. If both are set, `tone` colors the unchecked
state and `toneSelected` colors the checked track. |
| `value?` | string | "on" | Value submitted while checked. |

Use the web component directly when you are not using React or Preact and a native control does not fit.

The focusable host carries the state. Label and hint are light-DOM children.

```html
<a-switch role="switch" tabindex="0" name="updates" default-state="checked">
  <a-switch-label>Email updates</a-switch-label>
  <a-switch-hint>Product and security notices.</a-switch-hint>
</a-switch>
```

Reach for the props first: **`tone`** colors the checked track plus the unchecked chrome, while **`toneSelected`** colors only the checked track. Both accept any CSS color; **`size`** scales the control, label, and hint. The focus ring is the global [`--focus-ring`](../colors.md#focus-ring).

```tsx
<Switch tone="#e0457b" defaultChecked label="Custom color" />
```

`<a-switch>` is light DOM. The **track is `::before`**, the **thumb is `::after`**, and the label / hint are `a-switch-label` / `a-switch-hint` children. Target them with plain CSS. The classes in these examples are demo hooks. Replace them with a selector you own.

```css
a-switch.strong-label {
  color: var(--text-1-brand);
  font-weight: 700;
}

/* A CSS-only check / × in the free part of the track. */
a-switch.track-marks::before {
  display: flex;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}
a-switch.track-marks:state(checked)::before {
  content: "✓";
  justify-content: flex-start;
  padding-inline-start: 4px;
  color: var(--switch-thumb);
}
a-switch.track-marks:not(:state(checked))::before {
  content: "×";
  justify-content: flex-end;
  padding-inline-end: 4px;
  color: var(--switch-track-off-stroke);
}
```
