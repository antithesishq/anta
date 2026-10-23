# Scatter

A scatter series displays each data point as a mark positioned by its x and y
values. Scatter plots can reveal relationships, clusters, and individual values.
Use `size`, [`mark`](../plot.md#mark-shapes),
and [`stroke`](../plot.md#strokes) to control each point's appearance. Set
`tooltip: true` for a tooltip showing the point's values.

## Size and color from data

Use a size accessor to vary mark diameter and a color accessor to highlight larger values. An outline keeps overlapping bubbles distinct.

```ts
import { scatter, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'

const plot = document.createElement('a-plot') as APlotElement

const data = Array.from({ length: 24 }, (_, i) => ({
  x: 12 + (i * 17 % 83),
  y: 15 + (i * 31 % 72),
  volume: 20 + (i * 43 % 180),
}))

plot.plotArgs = {
  series: [scatter({
    data,
    size: row => (5 + Math.sqrt(Number(row.volume)) * 1.8) * 1.3,
    color: row => Number(row.volume) > 120
      ? { light: '#e76f51', dark: '#fda489' }
      : { light: '#0891b2', dark: '#67e8f9' },
    stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 2 },
    tooltip: ({ row }) => document.createTextNode('Volume: ' + row.volume),
  })],
  height: 260,
  margin: { top: 12, right: 12, bottom: 28, left: 36 },
  axis: { x: { min: 0, max: 110, label: '' }, y: { min: 0, max: 100, label: '' } },
  background: { light: '#ffffff', dark: '#151b28' },
  chrome_color: { light: '#e2e8f0', dark: '#334155' },
  border: false,
  zoom_pan: true,
}

document.body.append(plot)
```

## Mark shapes and outlines

Use different marks to distinguish groups without relying on color alone. Each series sets its own shape, size, and stroke.

```ts
import { scatter, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'

const plot = document.createElement('a-plot') as APlotElement

const data = Array.from({ length: 18 }, (_, i) => ({
  x: 10 + i * 4.5,
  y: 18 + i * 2.5 + Math.sin(i * 2.1) * 12,
}))

plot.plotArgs = {
  series: [
    scatter({
      data,
      mark: 'square',
      size: 11,
      color: { light: '#c4b5fd', dark: '#8b5cf6' },
      stroke: { color: { light: '#6d28d9', dark: '#ddd6fe' }, width: 2 },
      tooltip: ({ x, y }) => document.createTextNode('Squares: ' + x + ', ' + Math.round(Number(y))),
    }),
    scatter({
      data: data.map(point => ({ x: point.x + 5, y: 95 - point.y })),
      mark: 'diamond',
      size: 13,
      color: { light: '#99f6e4', dark: '#0d9488' },
      stroke: { color: { light: '#0f766e', dark: '#5eead4' }, width: 2 },
      tooltip: ({ x, y }) => document.createTextNode('Diamonds: ' + x + ', ' + Math.round(Number(y))),
    }),
  ],
  height: 260,
  margin: { top: 12, right: 12, bottom: 28, left: 36 },
  axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
  background: { light: '#ffffff', dark: '#151b28' },
  chrome_color: { light: '#e2e8f0', dark: '#334155' },
  border: false,
  zoom_pan: true,
}

document.body.append(plot)
```

## Latency under load

Blue points show successful requests and red points show errors over 12 minutes.
Zoom into the spike near 315 seconds to inspect the incident, or into the baseline
to compare individual request latencies. The axes show seconds and milliseconds.

```js
const noise = (index) => {
    const value = Math.sin(index * 12.9898) * 43758.5453
    return value - Math.floor(value)
  }

  const requests = Array.from({ length: 800 }, (_, i) => {
    const seconds = i / 799 * 720
    const r1 = noise(i)
    const r2 = noise(i + 9999)
    const incident = Math.exp(-((seconds - 315) ** 2) / 128)
    const outlier = incident < 0.1 && r1 > 0.985 ? 400 + r2 * 300 : 0
    const failed = incident > 0.4 && r2 > 0.5
    const latency = 170 + r1 * 60 + incident * (900 + r2 * 700) + outlier + (failed ? 300 : 0)
    return { seconds, latency, status: failed ? 'Error' : 'OK' }
  })

  const request_latency = plot({
    series: [
      plot.scatter({
        data: requests.filter(request => request.status === 'OK'),
        x: 'seconds',
        y: 'latency',
        size: pure((_row, _index, viewport) => Math.min(12, 2.5 * Math.max(viewport.zoom_factor.x, viewport.zoom_factor.y) ** 0.35)),
        color: {
          light: 'color-mix(in oklch, #1e6edc 45%, transparent)',
          dark: 'color-mix(in oklch, #60a5fa 45%, transparent)',
        },
        tooltip: pure(({ row }) => h('span', {},
          row.status + ' · ' + row.seconds.toFixed(1) + ' s · ' + Math.round(row.latency) + ' ms',
        )),
      }),
      plot.scatter({
        data: requests.filter(request => request.status === 'Error'),
        x: 'seconds',
        y: 'latency',
        size: pure((_row, _index, viewport) => Math.min(12, 3 * Math.max(viewport.zoom_factor.x, viewport.zoom_factor.y) ** 0.35)),
        color: { light: '#dc2828', dark: '#f87171' },
        tooltip: pure(({ row }) => h('span', {},
          row.status + ' · ' + row.seconds.toFixed(1) + ' s · ' + Math.round(row.latency) + ' ms',
        )),
      }),
    ],
    height: 260,
    margin: { top: 12, right: 12, bottom: 28, left: 46 },
    axis: {
      x: { min: 0, max: 720, label: '' },
      y: { min: 0, label: '' },
    },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: true,
    border: false,
    zoom_pan: true,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(request_latency)
  // presentation.blank("Latency under load").print(request_latency)
```

## Dense data

A noisy dataset has a slight upward trend. Small, translucent marks reveal where points overlap. Scroll to zoom or hold Ctrl and drag a rectangle to inspect individual points.

```js
const sample = (index) => {
    const value = Math.sin(index * 127.1 + 311.7) * 43758.5453
    return value - Math.floor(value)
  }

  const data = Array.from({ length: 7200 }, (_, i) => {
    const x = 10 + sample(i * 3) * 80
    const spread = i < 6000 ? 45 : 18
    const noise = (sample(i * 3 + 1) + sample(i * 3 + 2) - 1) * spread
    return { x, y: 50 + (x - 50) * 0.28 + noise }
  })

  const dense_points = plot({
    series: [plot.scatter({
      data,
      size: pure((_row, _index, viewport) => Math.min(12, 4 * Math.max(viewport.zoom_factor.x, viewport.zoom_factor.y) ** 0.35)),
      color: {
        light: 'color-mix(in oklch, #0e7490 22%, transparent)',
        dark: 'color-mix(in oklch, #67e8f9 22%, transparent)',
      },
      tooltip: pure(({ x, y }) => h('span', {},
        'x: ' + Number(x).toFixed(1) + ' · y: ' + Number(y).toFixed(1),
      )),
    })],
    height: 260,
    margin: { top: 12, right: 12, bottom: 28, left: 36 },
    axis: { x: { min: 10, max: 90, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    border: false,
    zoom_pan: true,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(dense_points)
  // presentation.blank("Dense data").print(dense_points)
```

## Scatter arguments

### ScatterArgs

| Field | Type | Default | Description |
|---|---|---|---|
| `data` | `{[key: string]: any}[]` | Required | Data points to plot. |
| `x?` | [`FieldArg`](../plot.md#data-fields) | `'x'` | Horizontal field name or accessor. |
| `y?` | [`FieldArg`](../plot.md#data-fields) | `'y'` | Vertical field name or accessor. |
| `color?` | [`ColorArg`](../plot.md#series-colors) | Black | Series color. Theme pairs provide separate light and dark colors. |
| [`size?`](#size) | `number \| ((row, index, viewport) => number)` | `5` | Mark diameter in pixels, or a per-row accessor. A row’s `size` takes precedence. |
| [`mark?`](../plot.md#mark-shapes) | `MarkShape` | `'circle'` | Mark shape: circle, square, diamond, or triangle. |
| `stroke?` | [`StrokeArg`](../plot.md#strokes) | None | Outline color and optional width. |
| `tooltip?` | [`TooltipArg`](../plot.md#tooltips) | None | Use `true` for the default tooltip, or a callback for custom content. |
| [`on_select?`](../plot.md#selection) | `SelectFn` | None | Callback receiving the selected point and its source row. |
| `hoverable?` | `boolean` | `true` | Enable tooltips, selection callbacks, and hover highlights for this series. |
| `highlight?` | `boolean` | `true` | Highlight a data point when you hover over it. |
| `highlight_color?` | [`ColorArg`](../plot.md#series-colors) | Automatic | Exact hover color, including opacity. For custom series, affects only the fallback renderer. Stacked bars also accept a `ThemeColor[]` palette. |

This example maps `time` and `value` to coordinates, uses color and size to
distinguish values, and adds tooltips and a selection callback.

```ts
import { scatter } from '@antadesign/plot'

const series = [scatter({
  data: [{ time: 1, value: 3 }, { time: 2, value: 5 }, { time: 3, value: 4 }],
  x: 'time',
  y: 'value',
  color: (row) => Number(row.value) >= 5 ? 'coral' : 'steelblue',
  size: (row) => Number(row.value) * 2,
  mark: 'diamond',
  stroke: { color: 'navy', width: 1 },
  tooltip: ({ x, y }) => `(${x}, ${y})`,
  on_select: ({ row }) => console.log('Selected row:', row),
  hoverable: true,
  highlight: true,
})]
```

## Size

Set `size` to a diameter in pixels, or use a callback to size each point from
its data and the current zoom level. The callback receives `(row, index, viewport)`.

The plot below compares fixed-size points with points that grow as you zoom in.
Scroll near **50** to compare the growth rates. **Reset Zoom** restores their
starting sizes.

```ts
import { scatter, type PlotArgs } from '@antadesign/plot'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'
import type { APlotElement } from '@antadesign/plot/browser'

export function viewportSizes(): PlotArgs<Node> {
  const labels = ['Fixed 4px', 'Data + gradual zoom', 'Data + faster zoom']
  const positions = [0, 10, 25, 40, 45, 48, 49, 49.5, 49.75, 50, 50.25, 50.5, 51, 52, 55, 60, 75, 90, 100]
  const rows = (label: string) => positions.map((x, i) => ({ x, y: label, weight: i % 2 ? 4 : 2 }))
  return {
    height: 260,
    margin: { top: 24, right: 20, bottom: 48, left: 160 },
    axis: { x: { min: 0, max: 100, label: 'Zoom near 50' }, y: { categories: labels, label: '' } },
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#64748b', dark: '#cbd5e1' },
    grid: false,
    zoom_pan: { x: true, y: false },
    series: [
      scatter({ data: rows(labels[0]), size: 4,
        color: { light: '#64748b', dark: '#cbd5e1' }, tooltip: true }),
      scatter({ data: rows(labels[1]),
        size: (row, index, viewport) => Math.min(16, Number(row.weight) * viewport.zoom_factor.x ** 0.25),
        color: { light: '#7c3aed', dark: '#c4b5fd' }, tooltip: true }),
      scatter({ data: rows(labels[2]),
        size: (row, index, viewport) => Math.min(16, Number(row.weight) * viewport.zoom_factor.x ** 0.5),
        color: { light: '#c2410c', dark: '#fdba74' }, tooltip: true }),
    ],
  }
}

const plot = document.createElement('a-plot') as APlotElement
plot.plotArgs = viewportSizes()
document.body.append(plot)
```

Use `viewport.zoom_factor.x` or `viewport.zoom_factor.y` to scale points with
zoom. A factor of `1` represents the starting zoom level. See
[Viewport changes](../plot.md#viewport-changes) for the other callback fields.

The callback is evaluated as the view changes, so keep it fast and free of side
effects. Return a finite, non-negative size. A data item's own `size` value
takes precedence over the series setting.

## Shared configuration

See [Install and configure](../plot.md#install-and-configure) to set up Plot.
The argument tables describe omitted fields; examples may override these defaults.
See [Data fields](../plot.md#data-fields), [Series colors](../plot.md#series-colors),
[Strokes](../plot.md#strokes), and [Mark shapes](../plot.md#mark-shapes) for shared options.
For callbacks, see [Tooltips](../plot.md#tooltips) and
[Selection](../plot.md#selection).
