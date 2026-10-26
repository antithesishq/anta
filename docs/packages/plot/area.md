# Area

An area series fills the space between two boundaries, showing how values
rise above a baseline or vary within a range. Area plots can show changing
magnitudes, uncertainty bands, or the gap between two measurements. Set `y2`
or `x2` to define the second boundary using a field, accessor, or constant.

## Fill to a baseline

Fill beneath a signal with a constant zero baseline. A stroke traces the area’s boundary.

```ts
import { area, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'

const plot = document.createElement('a-plot') as APlotElement

const data = Array.from({ length: 97 }, (_, i) => ({
  x: i / 4,
  y: 28 + 42 * Math.exp(-(((i - 55) / 24) ** 2))
    + 9 * Math.sin(i / 5) + 4 * Math.cos(i * 1.3),
}))

plot.plotArgs = {
  series: [
    area({
      data,
      y2: 0,
      color: { light: '#99f6e4', dark: '#134e4a' },
      stroke: { color: { light: '#0d9488', dark: '#5eead4' }, width: 2 },
      tooltip: ({ y }) => document.createTextNode('Load: ' + Math.round(Number(y))),
    }),
  ],
  height: 260,
  margin: { top: 5, right: 8, bottom: 20, left: 30 },
  axis: { x: { min: 0, max: 24, label: '' }, y: { min: 0, max: 100, label: '' } },
  background: { light: '#ffffff', dark: '#151b28' },
  chrome_color: { light: '#e2e8f0', dark: '#334155' },
  grid: { x: false, y: true },
  border: false,
  zoom_pan: false,
}

document.body.append(plot)
```

## A range between fields

Use two value fields to draw a changing interval. A dashed outline distinguishes its boundaries.

```ts
import { area, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'

const plot = document.createElement('a-plot') as APlotElement

const data = Array.from({ length: 81 }, (_, i) => {
  const center = 48 + 16 * Math.sin(i / 12) + 5 * Math.cos(i / 3)
  const spread = 8 + 10 * Math.sin(i / 17) ** 2
  return { x: i * 0.3, low: center - spread, high: center + spread }
})

plot.plotArgs = {
  series: [
    area({
      data,
      y: 'high',
      y2: 'low',
      color: { light: '#ddd6fe', dark: '#4c1d95' },
      stroke: { color: { light: '#7c3aed', dark: '#c4b5fd' }, width: 2 },
      dash: [5, 3],
      tooltip: ({ row }) => document.createTextNode(Math.round(Number(row.low)) + '–' + Math.round(Number(row.high))),
    }),
  ],
  height: 260,
  margin: { top: 5, right: 8, bottom: 20, left: 30 },
  axis: { x: { min: 0, max: 24, label: '' }, y: { min: 0, max: 100, label: '' } },
  background: { light: '#ffffff', dark: '#151b28' },
  chrome_color: { light: '#e2e8f0', dark: '#334155' },
  grid: { x: false, y: true },
  border: false,
  zoom_pan: false,
}

document.body.append(plot)
```

## Layered contributions

Compose adjacent areas with explicit cumulative bounds. Each band shows one contribution to the total.

```ts
import { area, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'

const plot = document.createElement('a-plot') as APlotElement

const data = Array.from({ length: 97 }, (_, i) => {
  const first = 18 + 7 * Math.sin(i / 13) + 3 * Math.cos(i / 4)
  const second = first + 22 + 9 * Math.sin(i / 18 + 1)
  const total = second + 16 + 6 * Math.cos(i / 9)
  return { x: i / 4, first, second, total }
})

plot.plotArgs = {
  series: [
    area({
      data,
      y: 'first',
      y2: 0,
      color: { light: '#2dd4bf', dark: '#0d9488' },
      tooltip: ({ row }) => document.createTextNode('Network: ' + Math.round(Number(row.first))),
    }),
    area({
      data,
      y: 'second',
      y2: 'first',
      color: { light: '#a5b4fc', dark: '#6366f1' },
      tooltip: ({ row }) => document.createTextNode('Compute: ' + Math.round(Number(row.second) - Number(row.first))),
    }),
    area({
      data,
      y: 'total',
      y2: 'second',
      color: { light: '#fcd34d', dark: '#b45309' },
      tooltip: ({ row }) => document.createTextNode('Storage: ' + Math.round(Number(row.total) - Number(row.second))),
    }),
  ],
  height: 260,
  margin: { top: 5, right: 8, bottom: 20, left: 30 },
  axis: { x: { min: 0, max: 24, label: '' }, y: { min: 0, max: 100, label: '' } },
  background: { light: '#ffffff', dark: '#151b28' },
  chrome_color: { light: '#e2e8f0', dark: '#334155' },
  grid: { x: false, y: true },
  border: false,
  zoom_pan: false,
}

document.body.append(plot)
```

## Horizontal intervals

Use `x` and `x2` for horizontal bounds. The filled band shows how an interval shifts along the vertical axis.

```ts
import { area, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'

const plot = document.createElement('a-plot') as APlotElement

const data = Array.from({ length: 81 }, (_, i) => {
  const center = 46 + 18 * Math.sin(i / 16) + 4 * Math.cos(i / 4)
  const spread = 9 + 6 * Math.cos(i / 11) ** 2
  return { y: i * 0.3, low: center - spread, high: center + spread }
})

plot.plotArgs = {
  series: [
    area({
      data,
      x: 'low',
      x2: 'high',
      color: { light: '#fed7aa', dark: '#7c2d12' },
      stroke: { color: { light: '#ea580c', dark: '#fdba74' }, width: 2 },
      tooltip: ({ row }) => document.createTextNode(Math.round(Number(row.low)) + '–' + Math.round(Number(row.high))),
    }),
  ],
  height: 260,
  margin: { top: 5, right: 8, bottom: 20, left: 30 },
  axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 24, label: '' } },
  background: { light: '#ffffff', dark: '#151b28' },
  chrome_color: { light: '#e2e8f0', dark: '#334155' },
  grid: { x: true, y: false },
  border: false,
  zoom_pan: false,
}

document.body.append(plot)
```

## Area arguments

### AreaArgs

| Field | Type | Default | Description |
|---|---|---|---|
| `data` | `{[key: string]: any}[]` | Required | Data points to plot. |
| `x?` | [`FieldArg`](../plot.md#data-fields) | `'x'` | Horizontal field name or accessor. |
| `x2?` | [`FieldArg \| number`](../plot.md#data-fields) | None | Second horizontal boundary, as a field, accessor, or constant. Cannot be used together with `y2`. |
| `y?` | [`FieldArg`](../plot.md#data-fields) | `'y'` | Vertical field name or accessor. |
| `y2?` | [`FieldArg \| number`](../plot.md#data-fields) | Zero baseline if neither bound is set | Second vertical boundary, as a field, accessor, or constant. Cannot be used together with `x2`. |
| `color?` | [`ThemeColor`](../plot.md#theme-colors) | Black | Series color. Theme pairs provide separate light and dark colors. |
| `stroke?` | [`StrokeArg`](../plot.md#strokes) | None | Outline color and optional width. |
| `dash?` | `number[]` | Solid | Alternating dash and gap lengths in pixels. |
| `tooltip?` | [`TooltipArg`](../plot.md#tooltips) | None | Use `true` for the default tooltip, or a callback for custom content. |
| [`on_select?`](../plot.md#selection) | `SelectFn` | None | Callback receiving the selected point and its source data. |
| `hoverable?` | `boolean` | `true` | Enable tooltips, selection callbacks, and hover highlights for this series. |
| `highlight?` | `boolean` | `true` | Highlight a data point when you hover over it. |
| `highlight_color?` | [`ColorArg`](../plot.md#series-colors) | Automatic | Exact hover color, including opacity. |

This example fills the band between `low` and `high` over `time`, adds a dashed outline, and enables tooltips and a selection callback.

```ts
import { area } from '@antadesign/plot'

const series = [area({
  data: [
    { time: 1, low: 2, high: 4 },
    { time: 2, low: 3, high: 6 },
    { time: 3, low: 2, high: 5 },
  ],
  x: 'time',
  y: 'high',
  y2: 'low',
  color: { light: 'lightsteelblue', dark: 'midnightblue' },
  stroke: { color: 'steelblue', width: 2 },
  dash: [6, 3],
  tooltip: ({ x, y }) => `(${x}, ${y})`,
  on_select: ({ row }) => console.log('Selected row:', row),
  hoverable: true,
  highlight: true,
})]
```
For a horizontal area, use `x2` instead of `y2`:

```ts
import { area } from '@antadesign/plot'

const series = [area({
  data: [{ low: 2, high: 4, time: 1 }, { low: 3, high: 6, time: 2 }],
  x: 'high',
  x2: 'low',
  y: 'time',
  color: 'lightsteelblue',
})]
```

## Shared configuration

See [Install and configure](../plot.md#install-and-configure) to set up Plot.
The argument tables describe omitted fields; examples may override these defaults.
See [Data fields](../plot.md#data-fields), [Series colors](../plot.md#series-colors),
[Strokes](../plot.md#strokes), and [Mark shapes](../plot.md#mark-shapes) for shared options.
For callbacks, see [Tooltips](../plot.md#tooltips) and
[Selection](../plot.md#selection).
