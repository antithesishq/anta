# Rule

Draw a reference line across the plot. Supply `x` for a vertical line or
`y` for a horizontal line. A single rule needs no data array; add it to the
same series array as the data it annotates.

## Horizontal reference values

Use numeric `y` values for reference lines without a data array. A thin dashed target and a thick solid upper limit show how width and dash patterns distinguish reference values.

```ts
import { rule, line, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'

const plot = document.createElement('a-plot') as APlotElement

const data = Array.from({ length: 97 }, (_, i) => ({
  x: i / 4,
  y: 44 + 15 * Math.sin(i / 9) + 5 * Math.cos(i * 0.8)
    + 38 * Math.exp(-(((i - 62) / 10) ** 2)),
}))

plot.plotArgs = {
  series: [
    line({
      data,
      color: { light: '#0891b2', dark: '#67e8f9' },
      width: 2,
    }),
    rule({
      y: 60,
      color: { light: '#7c3aed', dark: '#c4b5fd' },
      width: 1,
      dash: [7, 4],
      tooltip: () => document.createTextNode('Target: 60 ms'),
    }),
    rule({
      y: 90,
      color: { light: '#c2410c', dark: '#fdba74' },
      width: 4,
      tooltip: () => document.createTextNode('Upper limit: 90 ms'),
    }),
  ],
  height: 260,
  margin: { top: 5, right: 8, bottom: 20, left: 30 },
  axis: { x: { min: 0, max: 24, label: '' }, y: { min: 0, max: 110, label: '' } },
  background: { light: '#ffffff', dark: '#151b28' },
  chrome_color: { light: '#e2e8f0', dark: '#334155' },
  grid: false,
  border: false,
  zoom_pan: false,
}

document.body.append(plot)
```

## Vertical event markers

Read `x` positions from data to mark events along a signal. A solid rule marks deployment; thinner dashed rules mark recovery events. Tooltips identify each event.

```ts
import { rule, line, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'

const plot = document.createElement('a-plot') as APlotElement

const data = Array.from({ length: 97 }, (_, i) => ({
  x: i / 4,
  y: 35 + 12 * Math.sin(i / 11) + 4 * Math.cos(i * 0.7)
    + (i >= 28 && i < 64 ? 30 : 0),
}))
const events = [
  { hour: 7, name: 'Deploy', recovery: false },
  { hour: 16, name: 'Rollback', recovery: true },
  { hour: 21, name: 'Verified', recovery: true },
]

plot.plotArgs = {
  series: [
    line({
      data,
      color: { light: '#6366f1', dark: '#a5b4fc' },
      width: 2,
    }),
    rule({
      data: events.filter(event => !event.recovery),
      x: 'hour',
      color: { light: '#c2410c', dark: '#fdba74' },
      width: 3,
      tooltip: ({ row }) => document.createTextNode(row?.name + ' at hour ' + row?.hour),
    }),
    rule({
      data: events.filter(event => event.recovery),
      x: 'hour',
      color: { light: '#0d9488', dark: '#5eead4' },
      width: 2,
      dash: [5, 4],
      tooltip: ({ row }) => document.createTextNode(row?.name + ' at hour ' + row?.hour),
    }),
  ],
  height: 260,
  margin: { top: 5, right: 8, bottom: 20, left: 30 },
  axis: { x: { min: 0, max: 24, label: '' }, y: { min: 0, max: 110, label: '' } },
  background: { light: '#ffffff', dark: '#151b28' },
  chrome_color: { light: '#e2e8f0', dark: '#334155' },
  grid: false,
  border: false,
  zoom_pan: false,
}

document.body.append(plot)
```

## Rule arguments

### RuleArgs

| Field | Type | Default | Description |
|---|---|---|---|
| `data?` | `{[key: string]: any}[]` | None | Optional rows for multiple reference lines. |
| `x?` | [`number \| FieldArg`](../plot.md#data-fields) | None | Vertical rule position, or a field/accessor when `data` is supplied. Set exactly one of `x` and `y`. |
| `y?` | [`number \| FieldArg`](../plot.md#data-fields) | None | Horizontal rule position, or a field/accessor when `data` is supplied. |
| `color?` | [`ColorArg`](../plot.md#series-colors) | Black | Series color. Theme pairs provide separate light and dark colors. |
| `width?` | `number` | `1` | Rule width in pixels. |
| `dash?` | `number[]` | Solid | Alternating dash and gap lengths in pixels. |
| `tooltip?` | [`TooltipArg`](../plot.md#tooltips) | None | Use `true` for the default tooltip, or a callback for custom content. |
| [`on_select?`](../plot.md#selection) | `SelectFn` | None | Callback receiving the selected point and its source row. |
| `hoverable?` | `boolean` | `true` | Enable tooltips, selection callbacks, and hover highlights for this series. |
| `highlight?` | `boolean` | `true` | Highlight a data point when you hover over it. |
| `highlight_color?` | [`ColorArg`](../plot.md#series-colors) | Automatic | Exact hover color, including opacity. For custom series, affects only the fallback renderer. Stacked bars also accept a `ThemeColor[]` palette. |

This example draws dashed horizontal lines at two thresholds, colors them by value, and adds tooltips and a selection callback.

```ts
import { rule } from '@antadesign/plot'

const series = [rule({
  data: [{ threshold: 5 }, { threshold: 8 }],
  y: 'threshold',
  color: (row) => Number(row.threshold) >= 8 ? 'tomato' : 'steelblue',
  width: 2,
  dash: [6, 4],
  tooltip: ({ x, y }) => `(${x}, ${y})`,
  on_select: ({ row }) => console.log('Selected row:', row),
  hoverable: true,
  highlight: true,
})]
```
For a single vertical reference line, supply a numeric `x` without `data`:

```ts
import { rule } from '@antadesign/plot'

const series = [rule({
  x: 3,
  color: 'tomato',
  width: 2,
  hoverable: false,
  highlight: false,
})]
```

## Shared configuration

See [Install and configure](../plot.md#install-and-configure) to set up Plot.
The argument tables describe omitted fields; examples may override these defaults.
See [Data fields](../plot.md#data-fields), [Series colors](../plot.md#series-colors),
[Strokes](../plot.md#strokes), and [Mark shapes](../plot.md#mark-shapes) for shared options.
For callbacks, see [Tooltips](../plot.md#tooltips) and
[Selection](../plot.md#selection).
