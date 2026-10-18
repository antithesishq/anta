# Slider

`Slider` selects a number or an interval within a numeric range. Use it for
settings such as volume, playback speed, or price limits when dragging helps
people choose a value. Use a separate numeric input when precise text entry is
also useful.

Give every slider a visible `label` or an accessible name. A string label supplies
the name; pair a rich label with `aria-label` or `aria-labelledby`.

## Managing the value

Pass `defaultValue` for an uncontrolled slider, or use `value` with
`onValueChange` when the application owns the number. A controlled slider changes
only when you update `value`. Turn off **Accept changes** in this example to see
requests without applying them. **Reset to 35%** changes the application value
without requesting another change.

```tsx title="Accept or reject a requested value"
import { useState } from 'preact/hooks'
import { Button, Checkbox, Slider } from '@antadesign/anta'

function SliderOwnershipDemo() {
  const [value, setValue] = useState(35)
  const [accept, setAccept] = useState(true)
  const [requested, setRequested] = useState(35)

  return (
    <>
      <Checkbox label="Accept changes" checked={accept} onStateChange={(_, { next }) => setAccept(next === true)} />
      <Slider
        label="Volume"
        value={value}
        valueSuffix="%"
        onValueChange={(_, { value: next }) => {
          setRequested(next)
          if (accept) setValue(next)
        }}
      />
      <Button onClick={() => setValue(35)}>Reset to 35%</Button>
      <p>Applied: {value}%. Requested: {requested}%.</p>
    </>
  )
}
```

`0` is a controlled numeric value. Omitting `value` or passing `undefined` selects
uncontrolled use. A numeric slider has no empty value.

`onValueChange` reports requested values while dragging. `onValueCommit` reports
the final request when the gesture ends, including cancellation or capture loss,
and after each keyboard step. Its value can differ from the applied value when
the application rejects a controlled request. `onInput` runs before
`onValueChange`; `onChange` runs before `onValueCommit`. Cancel a keyboard or
pointer default in `onKeyDown` or `onPointerDown`; the value notifications are
noncancelable. See the prop reference for callback snapshots and reset behavior.

## Forms

Pass `name` to include the applied number in form submission. A range submits two
entries under the same name; read them with `FormData.getAll(name)`. Disabled
sliders submit nothing.

Form reset restores an uncontrolled slider's `defaultValue`. Without one, it
restores `min`, or `[min, max]` for a range. A changed uncontrolled reset emits
both value callbacks. Controlled reset retains the application's value, and
restoration does not overwrite a controlled value. Restoration of an uncontrolled
value is silent.

```tsx
<form>
  <Slider label="Brightness" name="brightness" defaultValue={60} valueSuffix="%" />
  <Button type="reset">Reset brightness</Button>
</form>
```

## Relative dragging

With the default `trackClick="drag-only"`, pressing the rail starts dragging
from the current value. Moving right increases the value, and moving left
decreases it. The thumb does not move to the point where the rail was pressed.

Set `trackClick="jump"` to move the thumb to the pressed position before
dragging, as a native range input does.

Releasing the pointer or losing pointer capture ends the drag. Moving back over
the slider without pressing leaves its value unchanged.

Slider is horizontal. In inherited RTL, its minimum is at the right edge and
horizontal pointer and arrow movement follow that direction. Up and Down still
increase and decrease the value. Vertical orientation and readonly mode are not
part of its API. The control reserves touch gestures for dragging.

Arrow keys change by `step`. Home selects the minimum; End selects the nearest allowed
step to the maximum. PageUp and PageDown move by one tenth of the range.

```tsx
<Slider label="Relative drag" defaultValue={35} />
<Slider label="Jump on press" defaultValue={35} trackClick="jump" />
```

## Range values

Pass two numbers to `value` or `defaultValue` to show two thumbs. Drag either
thumb across the other to move past it. The thumb you grabbed keeps moving, and
the value stays ordered from low to high. For example, dragging the thumb at 20
past 70 to 85 changes `[20, 70]` to `[70, 85]`. Both thumbs can share a value.
Each thumb has its own keyboard focus. Their tab order stays fixed when they
cross.

`onValueChange` receives a number for a single-value slider and an ordered
`[number, number]` tuple for a range slider. `onValueCommit` uses the same shape.
For an uncontrolled range without `defaultValue`, form reset selects `[min, max]`.

```tsx title="Controlled range"
import { useState } from 'preact/hooks'
import { Slider } from '@antadesign/anta'

function SliderRangeDemo() {
  const [value, setValue] = useState<[number, number]>([20, 70])
  const [lastChange, setLastChange] = useState<[number, number] | null>(null)

  return (
    <>
      <Slider
        label="Selected interval"
        value={value}
        onValueChange={(_, { value: next }) => {
          setValue(next)
          setLastChange(next)
        }}
      />
      <p className="range-demo-output"><code>onValueChange</code>: <code>{lastChange ? JSON.stringify(lastChange) : '—'}</code></p>
    </>
  )
}
```

## Inverted fill

Set `inverted` to fill the other part of the rail. For one thumb, the fill runs
from the value to the maximum. For two thumbs, the fill covers the rail outside
the selected interval. The minimum and maximum stay at their usual rail ends;
thumb movement and keyboard controls stay the same.

```tsx
<Slider label="Inverted single value" defaultValue={40} inverted />
<Slider label="Inverted range" defaultValue={[20, 70]} inverted />
```

## Value placement

`valueDisplay="end"` is the default. Use `inline` for `Label: value`, `thumb` to keep a value above the thumb, or `none` to omit it. `valuePrefix` and `valueSuffix` add text to every live value display.

```tsx
<Slider label="End" defaultValue={48} valueSuffix="%" />
<Slider label="Inline" defaultValue={48} valueDisplay="inline" valueSuffix="%" />
<Slider label="Thumb" defaultValue={48} valueDisplay="thumb" valueSuffix="%" />
```

## Size, tones, and radius

`size` follows the input height scale: 24px, 28px, and 32px. `trackSize` sets the thickness of both rail segments without changing the control height; numbers use pixels and strings accept CSS lengths. `thumbSize` controls the thumb diameter, and `thumbFill` fills it with its resolved border color. `tone` colors the filled rail. `thumbTone` separately colors the thumb stroke. The unfilled rail stays neutral. `round` shapes both the rail and thumb. Pass `true` for fully round corners or a number or CSS length for a shared custom radius.

In the Antithesis theme, an omitted `thumbTone` follows the filled rail's color.
Other themes keep the thumb neutral. Pass `thumbTone="neutral"` to keep a neutral
thumb in every theme. The native range uses the same rule for `thumb-tone`.

```tsx
<Slider size="small" tone="info" label="Small" defaultValue={32} />
<Slider tone="brand" thumbTone="success" trackSize={4} thumbSize={20} thumbFill label="Medium, filled thumb" defaultValue={52} />
<Slider size="large" tone="success" round={4} label="Large, 4px corners" defaultValue={72} />
```

## Markers

`markers` places compact, muted labels below the rail. Values at or below `min` align left; values at or above `max` align right. Markers do not add dots or ticks to the rail.

```tsx
<Slider
  label="Playback speed"
  min={0.5}
  max={2}
  step={0.25}
  defaultValue={1}
  valueSuffix="×"
  markers={[
    { value: 0.5, label: '0.5×' },
    { value: 1, label: 'Normal' },
    { value: 2, label: '2×' },
  ]}
/>
```

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultValue?` | number \| SliderRangeValue | min | Initial uncontrolled value and form-reset baseline. Changes while pristine update the value; after interaction they affect the next reset. Without a default, scalar reset uses `min` and range reset uses `[min, max]`. |
| `disabled?` | boolean | — | Disables pointer and keyboard interaction. |
| `inverted?` | boolean | — | Fill the rail outside the selected value or range. |
| `label?` | ReactNode | — | Visible field label, shown above the rail. A string supplies the slider's accessible name; give a rich label an explicit `aria-label`. |
| `markers?` | SliderMarker[] | — | Compact text labels positioned below the rail. They do not add dots or ticks to the rail. |
| `max?` | number | 100 | Highest permitted value. A lower bound than `min` collapses the range to `min`. Nonfinite values use 100. |
| `min?` | number | 0 | Lowest permitted value and step origin. Nonfinite values use 0. |
| `name?` | string | — | Form field name. A range submits two values under this name. |
| `onValueChange?` | (event, attrs) => void | — | Reports each distinct requested value during a drag and each keyboard step. `onInput` runs first. The snapshot contains the requested value and effective constraints; the element's `value` remains the applied value. Controlled sliders accept by updating `value` and reject by leaving it unchanged. Events are notifications; `preventDefault()` does not veto a value request. |
| `onValueCommit?` | (event, attrs) => void | — | Reports the final requested value after a drag, cancellation, or capture loss, and after each keyboard step. `onChange` runs first. A drag ending at its starting value is silent. Controlled requests can commit without being accepted. Uncontrolled form reset emits both callbacks when it changes the value; state restoration and application updates are silent. |
| `round?` | boolean \| number \| string | — | Fully round the rail and thumb. Pass a number (px) or CSS length string for a shared custom radius. |
| `size?` | 'small' \| 'medium' \| 'large' | 'medium' | Size variant. small=24px, medium=28px, large=32px tall. |
| `step?` | number | 1 | Smallest keyboard and drag increment. Nonpositive and nonfinite values use 1. Page keys move by at least one step, or one tenth of the range. |
| `thumbFill?` | boolean | false | Fill the thumb with its resolved border color. This follows `thumbTone` and interactive states. |
| `thumbSize?` | number \| string | 16 | Diameter of the thumb. Numbers use pixels; strings are CSS lengths. Keep it at least as large as `trackSize`. |
| `thumbTone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'neutral' (the Antithesis theme follows `tone`) | Color of the thumb stroke. Pass a named tone or a literal CSS color for a one-off custom tone. An explicit `neutral` keeps the thumb neutral in every theme. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'neutral' | Color of the filled rail. Pass a named tone or a literal CSS color for a one-off custom tone. The unfilled rail stays neutral. |
| `trackClick?` | 'drag-only' \| 'jump' | 'drag-only' | Controls what happens when the rail is pressed. `drag-only` starts dragging from the current value. `jump` first moves to the pressed position. |
| `trackSize?` | number \| string | 2 | Thickness of both rail segments. Numbers use pixels; strings are CSS lengths. Keep it no larger than the thumb diameter. |
| `value?` | number \| SliderRangeValue | — | Controlled numeric value. A pair selects a range, ordered low to high. Omit or pass `undefined` for uncontrolled use; `0` stays controlled. Takes precedence over `defaultValue`, including on form reset. Values are clamped to the bounds and rounded to a step measured from `min`. There is no empty numeric state. |
| `valueDisplay?` | 'end' \| 'inline' \| 'thumb' \| 'none' | 'end' | Where the live value appears. `end` puts it at the right edge of the label row. `inline` renders `Label: value`. `thumb` keeps it above the thumb. |
| `valuePrefix?` | string | — | Text inserted before the live numeric value, such as `$`. |
| `valueSuffix?` | string | — | Text inserted after the live numeric value, such as `%` or `°C`. |

## Web Component

Use `<a-slider>` with `state` for a controlled value or `default-state` for an
uncontrolled initial value. `value` reads the applied number or sorted pair.
`input` and `change` events carry snapshots in `event.detail`; accept a controlled
request by setting `state` from `event.detail.value`. Application updates are
silent. See [Install and configure](../install-config.md) for imports and hydration setup.

The legacy `value` and `defaultvalue` attributes remain supported. `state` takes
precedence over `value`, and `default-state` takes precedence over `defaultvalue`.
Assigning the `value` or `defaultValue` property updates off-DOM input state
without rewriting authored attributes. To relinquish controlled ownership, use
an attribute input and remove it.

Add `tabindex="0"` to a scalar slider, and supply its accessible name. The element
provides the default slider or group role through `ElementInternals`.

For a range, separate the two numbers with a space in `state` or `default-state`.
Use `role="group"` and give the range an accessible name. Each thumb receives
its own slider role and keyboard focus. The element's `value` property and
change events expose a two-number array. If you set `name`, form submission
includes both values in low-to-high order. Read them with `FormData.getAll(name)`.

```html
<a-slider
  role="slider"
  tabindex="0"
  aria-label="Volume"
  name="volume"
  default-state="50"
  track-size="4px"
  thumb-fill
  thumb-size="20px"
  value-suffix="%"
>
  <span slot="label">Volume</span>
</a-slider>
```

```html
<a-slider role="group" aria-label="Selected interval" name="interval" default-state="20 70" inverted>
  <span slot="label">Selected interval</span>
</a-slider>
```

### Native HTML range input

Add `data-anta` to a native range input for Anta's rail, fill, thumb, and focus
treatment while retaining the browser's form, keyboard, and pointer behavior.

Use `size="small"` or `"large"` for the 24px and 32px control sizes.
`track-size` accepts a CSS length and changes both rail segments. `tone`,
`thumb-tone`, `thumb-fill`, `thumb-size`, and `round` use the same attributes
as `Slider`. In raw HTML, `round` needs a CSS length such as `"4px"`; JSX
`round={4}` remains a numeric pixel value.

```html
<input data-anta type="range" min="0" max="100" value="48" aria-label="Native range">
<input data-anta type="range" min="0" max="100" value="32" size="small" tone="info" aria-label="Small info native range">
<input data-anta type="range" min="0" max="100" value="52" tone="brand" thumb-tone="success" track-size="4px" thumb-fill thumb-size="20px" aria-label="Brand native range with a large filled success thumb">
<input data-anta type="range" min="0" max="100" value="72" size="large" tone="success" round="4px" aria-label="Large rounded success native range">
```

## Styling

`Slider` renders an `<a-slider>` with a circular thumb. `tone` and `thumbTone` accept named or custom CSS colors; custom values use the public `--slider-tone-source` and `--slider-thumb-tone-source` knobs. Use `round` to shape the rail and thumb together. Target its shadow parts to change their presentation without taking on the interaction code: `::part(thumb)` customizes the thumb’s surface and stroke. Existing parts remain available: `header`, `label`, `value`, `control`, `track`,
`fill`, `thumb`, `thumb-value`, `markers`, and `extras`. `thumb-1` and `thumb-2`
identify physical thumbs and retain their identity when crossing. Additional parts
include `rail-area`, `inline-value`, `end-value`, `value-separator`, `value-affix`,
`fill-start`, `fill-end`, `thumb-value-1`, and `thumb-value-2`.

Defaults load from external CSS, including styles for these shadow parts. Place
consumer overrides in `components`, `utilities`, or unlayered CSS; earlier `base`
rules lose to Anta defaults. Load Slider CSS in the same root as the host when
rendering inside a consumer shadow root. Existing part names may have additional
tokens, so use `[part~="thumb"]` for shadow queries.

Public host states describe applied presentation: `range`, `dragging`,
`pointer-focus`, `thumb-1-active`, and `thumb-2-active`. The active-thumb states
identify the most recently focused or pressed physical thumb. Region states
`has-header`, `has-markers`, `has-extras`, `has-fill`, `has-fill-end`,
`has-thumb-value`, and `has-thumb-value-end` indicate visible regions, including
coincident range bubbles.

Custom colors, radius, sizing, marker positions, and application `style` props can
serialize inline style attributes during SSR. Under `style-src-attr 'none'`, use
external consumer CSS for those values; see [CSP guidance](../install-config.md#content-security-policy).
Default external styling does not remove that separate inline-style constraint.

```css
/* The class is only for the demo. Use your own selector. */
.warm-slider::part(fill) { background: #e5484d; }
.warm-slider::part(thumb) {
  background: #fff7ed;
  border-color: #e5484d;
  border-radius: 4px;
}
```

### Editable value beside the label

Compose `Input` and `Slider` as separate controls. The grid puts the label and
small input on one row and the slider underneath. Pass `valueDisplay="none"` so the
slider does not repeat its value. Keep the input's text as a draft; when the
field loses focus or you press Enter, commit a number within the slider's range.
Dragging or using the slider's keyboard controls updates both values.

```tsx title="Slider with an editable value"
import { useState } from 'preact/hooks'
import { Input, Slider } from '@antadesign/anta'

function SliderEditableValueDemo() {
  const [value, setValue] = useState(55)
  const [draft, setDraft] = useState('55')

  const commit = () => {
    const number = Number(draft)
    const next = draft.trim() && Number.isFinite(number)
      ? Math.max(0, Math.min(100, Math.round(number)))
      : value
    setValue(next)
    setDraft(String(next))
  }

  return (
    <div className="editable-slider">
      <span className="editable-slider-label">Volume</span>
      <Input
        aria-label="Volume value"
        size="small"
        inputMode="numeric"
        trailing="%"
        value={draft}
        onInput={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
        }}
      />
      <Slider
        aria-label="Volume"
        value={value}
        valueDisplay="none"
        valueSuffix="%"
        onValueChange={(_, { value: next }) => {
          setValue(next)
          setDraft(String(next))
        }}
      />
    </div>
  )
}
```

```css title="Editable Slider layout"
.editable-slider {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px;
  align-items: center;
  gap: 0 12px;
  width: min(100%, 360px);
  margin-inline: auto;
}
.editable-slider-label {
  color: var(--text-3);
  font-size: 15px;
  font-weight: 500;
}
.editable-slider > a-slider { grid-column: 1 / -1; }
```
