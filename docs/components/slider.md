# Slider

**`Slider`** selects one number or an interval between two numbers. Pass a number
for one thumb or a two-number tuple for two thumbs. Its label sits above the
rail, and the value appears at the right side of the label row by default. Use
`value` with `onValueChange` to control it, or `defaultValue` for uncontrolled use.

## Relative dragging

With the default `trackClick="drag-only"`, pressing the rail starts dragging
from the current value. Moving right increases the value, and moving left
decreases it. The thumb does not move to the point where the rail was pressed.

Set `trackClick="jump"` to move the thumb to the pressed position before
dragging, as a native range input does.

Releasing the pointer or losing pointer capture ends the drag. Moving back over
the slider without pressing leaves its value unchanged.

Arrow keys change by `step`. Home and End set the minimum and maximum. PageUp and PageDown move by one tenth of the range.

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
<Slider label="Volume" defaultValue={48} valueSuffix="%" />
<Slider label="Volume" defaultValue={48} valueDisplay="inline" valueSuffix="%" />
<Slider label="Volume" defaultValue={48} valueDisplay="thumb" valueSuffix="%" />
```

## Size, tones, and radius

`size` follows the input height scale: 24px, 28px, and 32px. `trackSize` sets the thickness of both rail segments without changing the control height; numbers use pixels and strings accept CSS lengths. `thumbSize` controls the thumb diameter, and `thumbFill` fills it with its resolved border color. `tone` colors the filled rail. `thumbTone` separately colors the thumb stroke. The unfilled rail stays neutral. `round` shapes both the rail and thumb. Pass `true` for fully round corners or a number or CSS length for a shared custom radius.

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
| `defaultValue?` | number \| SliderRangeValue | 0 | Initial uncontrolled value. |
| `disabled?` | boolean | — | Disables pointer and keyboard interaction. |
| `inverted?` | boolean | — | Fill the rail outside the selected value or range. |
| `label?` | ReactNode | — | Visible field label, shown above the rail. A string supplies the slider's accessible name; give a rich label an explicit `aria-label`. |
| `markers?` | SliderMarker[] | — | Compact text labels positioned below the rail. They do not add dots or ticks to the rail. |
| `max?` | number | 100 | Highest permitted value. |
| `min?` | number | 0 | Lowest permitted value. |
| `name?` | string | — | Form field name. A range submits two values under this name. |
| `onValueChange?` | (event, attrs) => void | — | Fires on every keyboard or pointer value change. |
| `onValueCommit?` | (event, attrs) => void | — | Fires after a drag ends and after each keyboard value change. |
| `round?` | boolean \| number \| string | — | Fully round the rail and thumb. Pass a number (px) or CSS length string for a shared custom radius. |
| `size?` | 'small' \| 'medium' \| 'large' | 'medium' | Size variant. small=24px, medium=28px, large=32px tall. |
| `step?` | number | 1 | Smallest keyboard and drag increment. |
| `thumbFill?` | boolean | false | Fill the thumb with its resolved border color. This follows `thumbTone` and interactive states. |
| `thumbSize?` | number \| string | 16 | Diameter of the thumb. Numbers use pixels; strings are CSS lengths. Keep it at least as large as `trackSize`. |
| `thumbTone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'neutral' | Color of the thumb stroke. Pass a named tone or a literal CSS color for a one-off custom tone. Omit it to keep the thumb neutral. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'neutral' | Color of the filled rail. Pass a named tone or a literal CSS color for a one-off custom tone. The unfilled rail stays neutral. |
| `trackClick?` | 'drag-only' \| 'jump' | 'drag-only' | Controls what happens when the rail is pressed. `drag-only` starts dragging from the current value. `jump` first moves to the pressed position. |
| `trackSize?` | number \| string | 2 | Thickness of both rail segments. Numbers use pixels; strings are CSS lengths. Keep it no larger than the thumb diameter. |
| `value?` | number \| SliderRangeValue | — | Controlled value. A pair of numbers selects a range. Update it from `onValueChange`. |
| `valueDisplay?` | 'end' \| 'inline' \| 'thumb' \| 'none' | 'end' | Where the live value appears. `end` puts it at the right edge of the label row. `inline` renders `Label: value`. `thumb` keeps it above the thumb. |
| `valuePrefix?` | string | — | Text inserted before the live numeric value, such as `$`. |
| `valueSuffix?` | string | — | Text inserted after the live numeric value, such as `%` or `°C`. |

## Web Component

Use `<a-slider>` when you are not using React or Preact. Add its `role` and accessible name yourself, then register it from `@antadesign/anta/elements`.

For a range, separate the two numbers with a space in `value` or `defaultvalue`.
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
  defaultvalue="50"
  track-size="4px"
  thumb-fill
  thumb-size="20px"
  value-suffix="%"
>
  <span slot="label">Volume</span>
</a-slider>
```

```html
<a-slider role="group" aria-label="Selected interval" name="interval" defaultvalue="20 70" inverted>
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

`Slider` renders an `<a-slider>` with a circular thumb. `tone` and `thumbTone` accept named or custom CSS colors; custom values use the public `--slider-tone-source` and `--slider-thumb-tone-source` knobs. Use `round` to shape the rail and thumb together. Target its shadow parts to change their presentation without taking on the interaction code: `::part(thumb)` customizes the thumb’s surface and stroke. The element exposes `header`, `label`, `value`, `control`, `track`, `fill`, `thumb`, `thumb-value`, `markers`, and `extras`.

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
