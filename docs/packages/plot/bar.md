# Bar

Draw one bar per category. Use a categorical field on one axis and a numeric
field on the other. Categories on `x` produce vertical bars; categories on
`y` produce horizontal bars.

## Rounded bars and data colors

Set corner rounding and spacing independently. A color accessor highlights days with more than 80 requests per second.

```ts
import { bar, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'

const plot = document.createElement('a-plot') as APlotElement

const data = [
  { day: 'Mon', requests: 42 },
  { day: 'Tue', requests: 68 },
  { day: 'Wed', requests: 91 },
  { day: 'Thu', requests: 57 },
  { day: 'Fri', requests: 84 },
  { day: 'Sat', requests: 36 },
  { day: 'Sun', requests: 24 },
]

plot.plotArgs = {
  series: [bar({
    data,
    x: 'day',
    y: 'requests',
    border_radius: 6,
    inset: 5,
    color: row => Number(row.requests) > 80
      ? { light: '#c2410c', dark: '#fdba74' }
      : { light: '#0891b2', dark: '#67e8f9' },
    hover_span_x: true,
    tooltip: ({ x, y }) => document.createTextNode(x + ': ' + y + ' requests/s'),
  })],
  height: 260,
  margin: { top: 5, right: 8, bottom: 20, left: 30 },
  axis: { x: { label: '' }, y: { min: 0, max: 100, label: '' } },
  background: { light: '#ffffff', dark: '#151b28' },
  chrome_color: { light: '#e2e8f0', dark: '#334155' },
  grid: { x: false, y: true },
  border: false,
  zoom_pan: false,
}

document.body.append(plot)
```

## Horizontal bars

Place categories on the y-axis to leave room for their names. Hover anywhere along a category’s row to inspect its value.

```ts
import { bar, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'

const plot = document.createElement('a-plot') as APlotElement

const data = [
  { service: 'Search', requests: 92 },
  { service: 'Feed', requests: 78 },
  { service: 'Checkout', requests: 64 },
  { service: 'Profile', requests: 47 },
  { service: 'Upload', requests: 31 },
]

plot.plotArgs = {
  series: [bar({
    data,
    x: 'requests',
    y: 'service',
    border_radius: 4,
    inset: 8,
    color: { light: '#7c3aed', dark: '#c4b5fd' },
    hover_span_y: true,
    tooltip: ({ x, y }) => document.createTextNode(y + ': ' + x + ' requests/s'),
  })],
  height: 260,
  margin: { top: 5, right: 8, bottom: 20, left: 78 },
  axis: { x: { min: 0, max: 100, label: '' }, y: { label: '' } },
  background: { light: '#ffffff', dark: '#151b28' },
  chrome_color: { light: '#e2e8f0', dark: '#334155' },
  grid: { x: true, y: false },
  border: false,
  zoom_pan: false,
}

document.body.append(plot)
```

## Positive and negative values

Bars extend from zero in either direction. Use a color accessor to distinguish monthly gains from losses.

```ts
import { bar, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'

const plot = document.createElement('a-plot') as APlotElement

const data = [
  { month: 'Jan', change: 24 },
  { month: 'Feb', change: -16 },
  { month: 'Mar', change: 38 },
  { month: 'Apr', change: 12 },
  { month: 'May', change: -28 },
  { month: 'Jun', change: -9 },
  { month: 'Jul', change: 31 },
]

plot.plotArgs = {
  series: [bar({
    data,
    x: 'month',
    y: 'change',
    inset: 6,
    color: row => Number(row.change) >= 0
      ? { light: '#0d9488', dark: '#5eead4' }
      : { light: '#c2410c', dark: '#fdba74' },
    hover_span_x: true,
    tooltip: ({ x, y }) => document.createTextNode(x + ': ' + (Number(y) > 0 ? '+' : '') + y + '%'),
  })],
  height: 260,
  margin: { top: 5, right: 8, bottom: 20, left: 30 },
  axis: { x: { label: '' }, y: { min: -40, max: 40, label: '' } },
  background: { light: '#ffffff', dark: '#151b28' },
  chrome_color: { light: '#e2e8f0', dark: '#334155' },
  grid: { x: false, y: true },
  border: false,
  zoom_pan: false,
}

document.body.append(plot)
```

## Custom category order

Set `axis.x.categories` to order bars by severity, independently of the source row order.

```ts
import { bar, type PlotArgs } from '@antadesign/plot'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'
import type { APlotElement } from '@antadesign/plot/browser'

function categoryOrder(): PlotArgs<Node> {
  const data = [
    { severity: 'High', count: 28 }, { severity: 'Low', count: 46 },
    { severity: 'Critical', count: 12 }, { severity: 'Medium', count: 35 },
  ]
  return {
    series: [bar({ data, x: 'severity', y: 'count', inset: 10, border_radius: 3,
      color: { light: '#64748b', dark: '#94a3b8' },
      tooltip: ({ x, y }) => document.createTextNode(x + ': ' + y + ' issues'),
    })],
    height: 260,
    margin: { top: 5, right: 12, bottom: 24, left: 30 },
    axis: {
      x: { categories: ['Critical', 'High', 'Medium', 'Low'], label: '' },
      y: { min: 0, max: 50, label: '' },
    },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: false,
    zoom_pan: false,
  }
}

const plot = document.createElement('a-plot') as APlotElement
plot.plotArgs = categoryOrder()
document.body.append(plot)
```

## Bar arguments

### BarArgs

| Field | Type | Default | Description |
|---|---|---|---|
| `data` | `{[key: string]: any}[]` | Required | Rows used to build the series. |
| `x?` | [`FieldArg \| string[]`](../plot.md#data-fields) | `'x'` | Category or value field. An array of value fields creates horizontal stacks. |
| `y?` | [`FieldArg \| string[]`](../plot.md#data-fields) | `'y'` | Category or value field. An array of value fields creates vertical stacks. |
| `color?` | [`ColorArg`](../plot.md#series-colors) or [`ThemeColor[]`](../plot.md#theme-colors) | Black | Uniform or per-row color. A color array maps to stacked fields in order. |
| `border_radius?` | `number` | `0` | Bar corner radius in pixels. |
| `inset?` | `number` | One sixth of band width | Inset on each side of a categorical band, in pixels. |
| `min_size?` | `number` | `2` | Minimum rendered value length in pixels. |
| `hover_span_x?` | `boolean` | `false` | Extend the horizontal hit region across the categorical band. |
| `hover_span_y?` | `boolean` | `false` | Extend the vertical hit region across the categorical band. |
| `tooltip?` | [`TooltipArg`](../plot.md#tooltips) | None | Use `true` for the default tooltip, or a callback for custom content. |
| [`on_select?`](../plot.md#selection) | `SelectFn` | None | Callback receiving the selected point and its source row. |
| `hoverable?` | `boolean` | `true` | Enable tooltips, selection callbacks, and hover highlights for this series. |
| `highlight?` | `boolean` | `true` | Highlight a data point when you hover over it. |
| `highlight_color?` | [`ColorArg`](../plot.md#series-colors) | Automatic | Exact hover color, including opacity. For custom series, affects only the fallback renderer. Stacked bars also accept a `ThemeColor[]` palette. |

This example draws a bar for each `group` using its `count`, rounds the corners, and adds tooltips and a selection callback.

```ts
import { bar } from '@antadesign/plot'

const series = [bar({
  data: [{ group: 'A', count: 8 }, { group: 'B', count: 12 }],
  x: 'group',
  y: 'count',
  color: { light: 'steelblue', dark: 'lightskyblue' },
  border_radius: 3,
  inset: 4,
  min_size: 2,
  hover_span_x: true,
  hover_span_y: false,
  tooltip: ({ x, y }) => `(${x}, ${y})`,
  on_select: ({ row }) => console.log('Selected row:', row),
  hoverable: true,
  highlight: true,
})]
```

## Stacked bars

Pass an array of value-field names to stack them within each category.
Use `y` for vertical stacks or `x` for horizontal stacks. An array of
colors assigns one color to each field, in the same order.

Stacked values

Pass multiple value fields to stack them within each category. Colors follow the field order; hover a segment to see its contribution.

```ts
import { bar, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'

const plot = document.createElement('a-plot') as APlotElement

const data = [
  { day: 'Mon', network: 18, compute: 42, storage: 24 },
  { day: 'Tue', network: 24, compute: 32, storage: 18 },
  { day: 'Wed', network: 12, compute: 56, storage: 28 },
  { day: 'Thu', network: 28, compute: 24, storage: 16 },
  { day: 'Fri', network: 16, compute: 48, storage: 22 },
]

plot.plotArgs = {
  series: [bar({
    data,
    x: 'day',
    y: ['network', 'compute', 'storage'],
    color: [
      { light: '#0d9488', dark: '#5eead4' },
      { light: '#6366f1', dark: '#a5b4fc' },
      { light: '#d97706', dark: '#fcd34d' },
    ],
    inset: 8,
    tooltip: ({ label, y }) => document.createTextNode(label + ': ' + y + ' ms'),
  })],
  height: 260,
  margin: { top: 5, right: 8, bottom: 20, left: 30 },
  axis: { x: { label: '' }, y: { min: 0, max: 100, label: '' } },
  background: { light: '#ffffff', dark: '#151b28' },
  chrome_color: { light: '#e2e8f0', dark: '#334155' },
  grid: { x: false, y: true },
  border: false,
  zoom_pan: false,
}

document.body.append(plot)
```

Horizontal stacks

Pass multiple fields to `x` and categories to `y` to compare contributions across services.

```ts
import { bar, type PlotArgs } from '@antadesign/plot'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'
import type { APlotElement } from '@antadesign/plot/browser'

function stackedHorizontal(): PlotArgs<Node> {
  const data = [
    { service: 'Search', network: 18, compute: 46, storage: 14 },
    { service: 'Feed', network: 26, compute: 28, storage: 22 },
    { service: 'Upload', network: 42, compute: 16, storage: 32 },
    { service: 'Export', network: 12, compute: 36, storage: 18 },
  ]
  return {
    series: [bar({ data, x: ['network', 'compute', 'storage'], y: 'service',
      color: [
        { light: '#0d9488', dark: '#5eead4' },
        { light: '#6366f1', dark: '#a5b4fc' },
        { light: '#d97706', dark: '#fcd34d' },
      ],
      inset: 8, border_radius: 3,
      tooltip: ({ label, x }) => document.createTextNode(label + ': ' + x + ' ms'),
    })],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 64 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: true, y: false },
    border: false,
    zoom_pan: false,
  }
}

const plot = document.createElement('a-plot') as APlotElement
plot.plotArgs = stackedHorizontal()
document.body.append(plot)
```

Positive and negative stacks

Positive and negative values stack separately from zero. Each segment retains its sign and field label.

```ts
import { bar, type PlotArgs } from '@antadesign/plot'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'
import type { APlotElement } from '@antadesign/plot/browser'

function stackedDiverging(): PlotArgs<Node> {
  const data = [
    { month: 'Jan', new: 28, expansion: 12, churn: -14, contraction: -6 },
    { month: 'Feb', new: 18, expansion: 8, churn: -22, contraction: -10 },
    { month: 'Mar', new: 36, expansion: 16, churn: -8, contraction: -4 },
    { month: 'Apr', new: 24, expansion: 18, churn: -18, contraction: -12 },
    { month: 'May', new: 32, expansion: 10, churn: -12, contraction: -8 },
  ]
  return {
    series: [bar({ data, x: 'month', y: ['new', 'expansion', 'churn', 'contraction'],
      color: [
        { light: '#0d9488', dark: '#2dd4bf' },
        { light: '#5eead4', dark: '#99f6e4' },
        { light: '#ea580c', dark: '#fb923c' },
        { light: '#fdba74', dark: '#fed7aa' },
      ],
      inset: 7,
      tooltip: ({ label, y }) => document.createTextNode(label + ': ' + (Number(y) > 0 ? '+' : '') + y),
    })],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 36 },
    axis: { x: { label: '' }, y: { min: -40, max: 60, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: false,
    zoom_pan: false,
  }
}

const plot = document.createElement('a-plot') as APlotElement
plot.plotArgs = stackedDiverging()
document.body.append(plot)
```

Full-stack tooltips

Hover a segment to see every value in its stack. The callback reads the values from `row` and uses `label` to display the hovered segment’s name and value in bold.

```ts
import { bar, type PlotArgs } from '@antadesign/plot'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'
import type { APlotElement } from '@antadesign/plot/browser'

function stackedTooltip(): PlotArgs<Node> {
  const data = [
    { day: 'Mon', network: 18, compute: 42, storage: 24 },
    { day: 'Tue', network: 24, compute: 32, storage: 18 },
    { day: 'Wed', network: 12, compute: 56, storage: 28 },
    { day: 'Thu', network: 28, compute: 24, storage: 16 },
    { day: 'Fri', network: 16, compute: 48, storage: 22 },
  ]

  return {
    series: [bar({
      data,
      x: 'day',
      y: ['network', 'compute', 'storage'],
      color: [
        { light: '#0d9488', dark: '#5eead4' },
        { light: '#6366f1', dark: '#a5b4fc' },
        { light: '#d97706', dark: '#fcd34d' },
      ],
      inset: 10,
      hover_span_x: false,
      hover_span_y: false,
      tooltip: ({ label, row }) => {
        const content = document.createElement('div')
        const fields: (keyof typeof row)[] = ['network', 'compute', 'storage']
        for (const field of fields) {
          const entry = document.createElement('div')
          const value = document.createElement(field === label ? 'strong' : 'span')
          value.textContent = field + ': ' + row[field] + ' ms'
          entry.append(value)
          content.append(entry)
        }
        return content
      },
    })],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 30 },
    axis: { x: { label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: false,
    zoom_pan: false,
  }
}

const plot = document.createElement('a-plot') as APlotElement
plot.plotArgs = stackedTooltip()
document.body.append(plot)
```

```ts
import { bar } from '@antadesign/plot'

const series = [bar({
  data: [
    { group: 'A', passed: 8, failed: 2 },
    { group: 'B', passed: 12, failed: 3 },
  ],
  x: 'group',
  y: ['passed', 'failed'],
  color: ['seagreen', 'coral'],
  border_radius: 3,
  inset: 4,
  min_size: 2,
  hover_span_x: true,
  hover_span_y: false,
  tooltip: ({ label, y }) => `${label}: ${y}`,
  on_select: ({ label, row }) => console.log('Selected segment:', label, row),
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
