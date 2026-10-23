# Line

A line series connects data points in the order you provide them, showing how
values change across a sequence. Line plots can reveal trends, fluctuations,
and differences between datasets. Use `width` and `dash` to style the line,
or add [`mark`](../plot.md#mark-shapes) and `mark_size` to show individual samples.

## Solid and dashed lines

Compare measured values with a forecast. A solid line follows each fluctuation, while a dashed line distinguishes the expected trend.

```ts
import { line, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'

const plot = document.createElement('a-plot') as APlotElement

const data = Array.from({ length: 97 }, (_, i) => ({
  x: i / 4,
  expected: 45 + 22 * Math.sin(i / 18) + 12 * Math.cos(i / 7),
  measured: 45 + 22 * Math.sin(i / 18) + 12 * Math.cos(i / 7)
    + 7 * Math.sin(i * 1.1) + 4 * Math.cos(i * 2.3),
}))

plot.plotArgs = {
  series: [
    line({
      data,
      y: 'expected',
      color: { light: '#c2410c', dark: '#fdba74' },
      width: 2,
      dash: [7, 5],
      tooltip: ({ y }) => document.createTextNode('Expected: ' + Math.round(Number(y))),
    }),
    line({
      data,
      y: 'measured',
      color: { light: '#0891b2', dark: '#67e8f9' },
      width: 2,
      tooltip: ({ y }) => document.createTextNode('Measured: ' + Math.round(Number(y))),
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

## Point marks and outlines

Show individual samples with diamond marks. Set the line width, mark size, and mark outline independently to keep each measurement visible.

```ts
import { line, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'

const plot = document.createElement('a-plot') as APlotElement

const data = Array.from({ length: 13 }, (_, i) => ({
  x: i,
  y: 35 + i * 2 + 18 * Math.sin(i * 0.8) + 8 * Math.cos(i * 1.7),
}))

plot.plotArgs = {
  series: [line({
    data,
    color: { light: '#7c3aed', dark: '#c4b5fd' },
    width: 3,
    mark: 'diamond',
    mark_size: 10,
    mark_stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 2 },
    tooltip: ({ x, y }) => document.createTextNode('Sample ' + x + ': ' + Math.round(Number(y))),
  })],
  height: 260,
  margin: { top: 5, right: 8, bottom: 20, left: 30 },
  axis: { x: { min: -0.5, max: 12.5, label: '' }, y: { min: 0, max: 100, label: '' } },
  background: { light: '#ffffff', dark: '#151b28' },
  chrome_color: { light: '#e2e8f0', dark: '#334155' },
  grid: { x: false, y: true },
  border: false,
  zoom_pan: false,
}

document.body.append(plot)
```

## Comparing services

Compare response times during the same traffic surge. Search recovers quickly, checkout takes longer to clear its backlog, and catalog stays comparatively steady.

```js
const data = Array.from({ length: 1201 }, (_, i) => {
    const minute = i / 10
    const surge = Math.exp(-(((minute - 45) / 12) ** 2))
    const backlog = minute < 45 ? 0 : (1 - Math.exp(-(minute - 45) / 8)) * Math.exp(-(minute - 45) / 30)
    return {
      minute,
      search: 65 + surge * 90 + 5 * Math.sin(minute * 1.3),
      checkout: 95 + surge * 170 + backlog * 220 + 7 * Math.sin(minute * 0.9),
      catalog: 40 + surge * 35 + 3 * Math.sin(minute * 1.7),
    }
  })

  const service_latency = plot({
    series: [
      plot.line({
        data, x: 'minute', y: 'search',
        color: { light: '#0891b2', dark: '#67e8f9' },
        width: 2,
        tooltip: pure(({ y }) => h('span', {}, 'Search: ' + Math.round(Number(y)) + ' ms')),
      }),
      plot.line({
        data, x: 'minute', y: 'checkout',
        color: { light: '#c2410c', dark: '#fdba74' },
        width: 2, dash: [7, 4],
        tooltip: pure(({ y }) => h('span', {}, 'Checkout: ' + Math.round(Number(y)) + ' ms')),
      }),
      plot.line({
        data, x: 'minute', y: 'catalog',
        color: { light: '#7c3aed', dark: '#c4b5fd' },
        width: 2, dash: [2, 4],
        tooltip: pure(({ y }) => h('span', {}, 'Catalog: ' + Math.round(Number(y)) + ' ms')),
      }),
    ],
    height: 260,
    margin: { top: 12, right: 12, bottom: 40, left: 44 },
    axis: { x: { min: 0, max: 120, label: 'Minutes' }, y: { min: 0, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: false,
    zoom_pan: true,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(service_latency)
  // presentation.blank("Comparing services").print(service_latency)
```

## Contour map

This contour map demonstrates that lines can loop and change direction instead of progressing from left to right.

```js
const resolution = 64
  const terrain = Array.from({ length: (resolution + 1) ** 2 }, (_, index) => {
    const x = index % (resolution + 1) / resolution * 100
    const y = Math.floor(index / (resolution + 1)) / resolution * 100
    const ridgeX = x - 40 + 7 * Math.sin(y / 17)
    const height = 180 + 3 * x + 2 * y
      + 1250 * Math.exp(-(ridgeX ** 2 / 750 + (y - 48) ** 2 / 1500))
      + 550 * Math.exp(-((x - 83) ** 2 / 150 + (y - 22) ** 2 / 220))
      + 450 * Math.exp(-((x - 78) ** 2 / 200 + (y - 84) ** 2 / 140))
    return { x, y, height }
  })
  const contours = []
  for (let elevation = 300; elevation <= 1700; elevation += 100) {
    const edges = new Map()
    const connect = (triangle) => {
      const crossings = []
      for (let side = 0; side < 3; side++) {
        const a = triangle[side]
        const b = triangle[(side + 1) % 3]
        const start = terrain[a]
        const end = terrain[b]
        if ((start.height < elevation) === (end.height < elevation)) continue
        const key = Math.min(a, b) + ':' + Math.max(a, b)
        if (!edges.has(key)) {
          const t = (elevation - start.height) / (end.height - start.height)
          edges.set(key, {
            point: { x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y), elevation },
            neighbors: [],
          })
        }
        crossings.push(key)
      }
      if (crossings.length === 2) {
        edges.get(crossings[0]).neighbors.push(crossings[1])
        edges.get(crossings[1]).neighbors.push(crossings[0])
      }
    }
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const a = y * (resolution + 1) + x
        const b = a + 1
        const c = a + resolution + 1
        const d = c + 1
        connect([a, b, d])
        connect([a, d, c])
      }
    }
    const visited = new Set()
    const starts = [...edges.keys()].sort((a, b) => edges.get(a).neighbors.length - edges.get(b).neighbors.length)
    for (const start of starts) {
      if (visited.has(start)) continue
      const data = []
      let current = start
      while (!visited.has(current)) {
        visited.add(current)
        const edge = edges.get(current)
        data.push(edge.point)
        const next = edge.neighbors.find(key => !visited.has(key))
        if (next === undefined) {
          if (edge.neighbors.includes(start)) data.push(edges.get(start).point)
          break
        }
        current = next
      }
      const hue = 260 - (elevation - 300) / 1400 * 260
      contours.push({
        data,
        color: { light: 'hsl(' + hue + ' 85% 40%)', dark: 'hsl(' + hue + ' 90% 68%)' },
      })
    }
  }

  const contour_map = plot({
    series: contours.map(({ data, color }) => plot.line({
      data,
      color,
      width: 1.5,
      tooltip: pure(({ row }) => h('span', {}, 'Elevation: ' + row.elevation + ' m')),
    })),
    height: 260,
    margin: { top: 12, right: 12, bottom: 28, left: 32 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: true,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(contour_map)
  // presentation.blank("Contour map").print(contour_map)
```

## Line arguments

### LineArgs

| Field | Type | Default | Description |
|---|---|---|---|
| `data` | `{[key: string]: any}[]` | Required | Rows used to build the series. |
| `x?` | [`FieldArg`](../plot.md#data-fields) | `'x'` | Horizontal field name or accessor. |
| `y?` | [`FieldArg`](../plot.md#data-fields) | `'y'` | Vertical field name or accessor. |
| `color?` | [`ThemeColor`](../plot.md#theme-colors) | Black | Series color. Theme pairs provide separate light and dark colors. |
| `width?` | `number` | `2` | Line width in pixels. |
| `dash?` | `number[]` | `[]` | Alternating dash and gap lengths in pixels. An empty array draws a solid line. |
| [`mark?`](../plot.md#mark-shapes) | `MarkShape` | None | Shape drawn at each point. |
| `mark_size?` | `number` | `6` | Point marker diameter in pixels. |
| `mark_stroke?` | [`StrokeArg`](../plot.md#strokes) | None | Outline for the point markers. |
| `tooltip?` | [`TooltipArg`](../plot.md#tooltips) | None | Use `true` for the default tooltip, or a callback for custom content. |
| [`on_select?`](../plot.md#selection) | `SelectFn` | None | Callback receiving the selected point and its source row. |
| `hoverable?` | `boolean` | `true` | Enable tooltips, selection callbacks, and hover highlights for this series. |
| `highlight?` | `boolean` | `true` | Highlight a data point when you hover over it. |
| `highlight_color?` | [`ColorArg`](../plot.md#series-colors) | Automatic | Exact hover color, including opacity. |

This example connects `time` and `value` with a dashed line and outlined circle marks, and adds tooltips and a selection callback.

```ts
import { line } from '@antadesign/plot'

const series = [line({
  data: [{ time: 1, value: 3 }, { time: 2, value: 5 }, { time: 3, value: 4 }],
  x: 'time',
  y: 'value',
  color: { light: 'steelblue', dark: 'lightskyblue' },
  width: 2,
  dash: [6, 3],
  mark: 'circle',
  mark_size: 8,
  mark_stroke: { color: 'navy', width: 1 },
  tooltip: ({ x, y }) => `(${x}, ${y})`,
  on_select: ({ row }) => console.log('Selected row:', row),
  hoverable: true,
  highlight: true,
})]
```

## Shared configuration

See [Install and configure](../plot.md#install-and-configure) to set up Plot.
The argument tables describe omitted fields; examples may override these defaults.
See [Data fields](../plot.md#data-fields), [Series colors](../plot.md#series-colors),
[Strokes](../plot.md#strokes), and [Mark shapes](../plot.md#mark-shapes) for shared options.
For callbacks, see [Tooltips](../plot.md#tooltips) and
[Selection](../plot.md#selection).
