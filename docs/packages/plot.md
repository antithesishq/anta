# Plot

A canvas-based plotting library for React, Preact, and plain JavaScript.
Compose plots using built-in and custom [series](#series), with configurable [axes](#axes), [scales](#scales), and [styles](#styling).
Explore your data through [tooltip](#tooltips), [selection](#selection), and [zoom](#zoom-and-pan) interactions.

## Series types

Select a series type below to see its options and examples.










## Composed examples

Combine multiple series in one plot to compare values, show trends, and add context.



```js
const forecast = Array.from({ length: 97 }, (_, i) => {
    const hour = i / 4
    const morning = 150 * Math.exp(-(((hour - 9) / 2.8) ** 2))
    const evening = 240 * Math.exp(-(((hour - 17) / 3.4) ** 2))
    const expected = 85 + morning + evening
    const spread = 22 + 12 * Math.sin(hour / 5) ** 2
    return { hour, expected, low: expected - spread, high: expected + spread }
  })

  const observations = forecast.map((point, i) => {
    const burst = i >= 61 && i <= 68 ? 65 * Math.sin((i - 60) / 9 * Math.PI) : 0
    const actual = Math.round(point.expected + 13 * Math.sin(i * 1.8) + 8 * Math.cos(i * 0.7) + burst)
    return { ...point, actual, outside: actual > point.high || actual < point.low }
  })

  const trend = observations.map((point, i) => {
    const window = observations.slice(Math.max(0, i - 3), Math.min(observations.length, i + 4))
    return { hour: point.hour, average: window.reduce((sum, row) => sum + row.actual, 0) / window.length }
  })

  const meanExpected = forecast.reduce((sum, point) => sum + point.expected, 0) / forecast.length

  const series = [
    plot.area({
      data: forecast,
      x: 'hour',
      y: 'high',
      y2: 'low',
      color: { light: '#ede9fe', dark: '#30274e' },
      hoverable: false,
    }),
    plot.rule({
      y: meanExpected,
      color: { light: '#d97706', dark: '#fbbf24' },
      width: 2,
      dash: [8, 4],
      hoverable: false,
    }),
    plot.line({
      data: forecast,
      x: 'hour',
      y: 'expected',
      color: { light: '#8b5cf6', dark: '#c4b5fd' },
      width: 2,
      dash: [5, 5],
      tooltip: pure(({ x, y }) => h('span', {}, 'Forecast at ' + x + 'h: ' + Math.round(Number(y)) + ' requests/s')),
    }),
    plot.line({
      data: trend,
      x: 'hour',
      y: 'average',
      color: { light: '#0891b2', dark: '#67e8f9' },
      width: 3,
      tooltip: pure(({ x, y }) => h('span', {}, 'Trend at ' + x + 'h: ' + Math.round(Number(y)) + ' requests/s')),
    }),
    plot.scatter({
      data: observations.filter(point => !point.outside),
      x: 'hour',
      y: 'actual',
      color: { light: '#0891b2', dark: '#67e8f9' },
      size: 4,
      tooltip: pure(({ x, y }) => h('span', {}, 'Observed at ' + x + 'h: ' + y + ' requests/s')),
    }),
    plot.scatter({
      data: observations.filter(point => point.outside),
      x: 'hour',
      y: 'actual',
      color: { light: '#e76f51', dark: '#fda489' },
      mark: 'diamond',
      size: 9,
      stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 1 },
      tooltip: pure(({ x, y }) => h('span', {}, 'Outside forecast range: ' + x + 'h · ' + y + ' requests/s')),
    }),
  ]

  const request_volume = plot({
    height: 280,
    series,
    axis: {
      x: { min: 0, max: 24, label: 'Hour' },
      y: { min: 0, max: 440, label: 'Requests/s' },
    },
    margin: { top: 12, right: 16, bottom: 42, left: 74 },
    grid: false,
    border: false,
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    background: { light: '#ffffff', dark: '#151b28' },
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(request_volume)
  // presentation.blank('Request volume').print(request_volume)
```



```js
const data = [
    { x: 'A', solar: 28, wind: 35, demand: 72 },
    { x: 'B', solar: 48, wind: 18, demand: 54 },
    { x: 'C', solar: 19, wind: 25, demand: 62 },
    { x: 'D', solar: 36, wind: 42, demand: 69 },
    { x: 'E', solar: 52, wind: 12, demand: 78 },
    { x: 'F', solar: 24, wind: 30, demand: 46 },
    { x: 'G', solar: 41, wind: 28, demand: 58 },
    { x: 'H', solar: 16, wind: 22, demand: 51 },
  ]

  const site_power = plot({
    series: [
      plot.bar({
        data,
        y: ['solar', 'wind'],
        color: [
          { light: '#fbbf24', dark: '#d97706' },
          { light: '#2dd4bf', dark: '#0d9488' },
        ],
        inset: 5,
        border_radius: 3,
        tooltip: pure(({ x, y, label }) =>
          h('span', {}, 'Site ' + x + ' · ' + label + ': ' + y + ' kW'),
        ),
      }),
      plot.scatter({
        data,
        y: 'demand',
        mark: 'diamond',
        size: 7,
        tooltip: pure(({ x, y }) => h('span', {}, 'Site ' + x + ' · Demand: ' + y + ' kW')),
        color: { light: '#7c3aed', dark: '#c4b5fd' },
        stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 1.5 },
      }),
    ],
    axis: { x: { label: 'Site' }, y: { min: 0, max: 90, label: 'Power (kW)' } },
    background: { light: '#ffffff', dark: '#151b28' },
    border: false,
    grid: false,
    height: 280,
    margin: { top: 12, right: 16, bottom: 42, left: 58 },
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(site_power)
  // presentation.blank("Site power").print(site_power)
```



```js
const density = (x) =>
    48 * Math.exp(-(((x - 65) / 24) ** 2)) + 19 * Math.exp(-(((x - 135) / 38) ** 2))

  const bins = Array.from({ length: 24 }, (_, i) => {
    const x = i * 10
    return { x: x + 1, x2: x + 9, y: density(x + 5) * (0.8 + 0.3 * Math.sin(i * 2.3) ** 2), y2: 0 }
  })

  const curve = Array.from({ length: 121 }, (_, i) => ({ x: i * 2, y: density(i * 2) }))

  const latency_distribution = plot({
    series: [
      plot.area({
        data: curve,
        y2: 0,
        color: { light: '#fce7f3', dark: '#452039' },
        hoverable: false,
      }),
      plot.rect({
        data: bins,
        color: { light: '#f472b6', dark: '#be185d' },
        tooltip: pure(({ row, y }) =>
          h(
            'span',
            {},
            Number(row.x) -
              1 +
              '–' +
              (Number(row.x2) + 1) +
              ' ms · ' +
              Math.round(Number(y)) +
              ' requests',
          ),
        ),
      }),
      plot.line({
        data: curve,
        color: { light: '#9d174d', dark: '#fbcfe8' },
        width: 2.5,
        tooltip: pure(({ x, y }) =>
          h('span', {}, 'Distribution at ' + x + ' ms: ' + Number(y).toFixed(1) + ' requests'),
        ),
      }),
    ],
    axis: {
      x: { min: 0, max: 240, label: 'Latency (ms)' },
      y: { min: 0, max: 60, label: 'Requests' },
    },
    background: { light: '#ffffff', dark: '#151b28' },
    border: false,
    grid: false,
    height: 280,
    margin: { top: 12, right: 16, bottom: 42, left: 58 },
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(latency_distribution)
  // presentation.blank("Latency distribution").print(latency_distribution)
```



```js
const points = [
    { x: 12, y: 74 },
    { x: 25, y: 57 },
    { x: 39, y: 85 },
    { x: 48, y: 18 },
    { x: 62, y: 70 },
    { x: 73, y: 37 },
    { x: 86.5, y: 86 },
    { x: 92, y: 22 },
    { x: 15, y: 27 },
    { x: 36, y: 64 },
    { x: 57, y: 88 },
  ]

  const paths = [
    [
      { x: 25, y: 0 },
      { x: 36, y: 19 },
      { x: 41, y: 15 },
      { x: 56, y: 37 },
      { x: 65, y: 23 },
      { x: 72, y: 48 },
      { x: 76, y: 44 },
      { x: 93, y: 63 },
      { x: 100, y: 68 },
    ],
    [
      { x: 0, y: 73 },
      { x: 9, y: 87 },
      { x: 13, y: 84 },
      { x: 20, y: 92 },
      { x: 29, y: 79 },
      { x: 39, y: 96 },
      { x: 42, y: 93 },
      { x: 48, y: 100 },
    ],
  ]

  const smoothPaths = paths.map((path) =>
    path.flatMap((point, i) => {
      const next = path[i + 1]
      if (!next) return [point]
      return Array.from({ length: 16 }, (_, j) => {
        const t = j / 16
        const blend = (1 - Math.cos(Math.PI * t)) / 2
        return { x: point.x + (next.x - point.x) * t, y: point.y + (next.y - point.y) * blend }
      })
    }),
  )

  const colors = [
    { light: '#7c3aed', dark: '#c4b5fd' },
    { light: '#e11d48', dark: '#fda4af' },
    { light: '#0284c7', dark: '#7dd3fc' },
    { light: '#d97706', dark: '#fcd34d' },
  ]

  const mixed_series = plot({
    series: [
      plot.area({
        data: Array.from({ length: 81 }, (_, i) => {
          const x = i * 1.25
          const center = 50 + 7 * Math.sin(i / 9) + 3 * Math.cos(i / 4)
          const spread = 3 + 1.5 * Math.sin(i / 11) ** 2
          return { x, y: center + spread, y2: center - spread }
        }),
        color: { light: '#99f6e4', dark: '#115e59' },
        stroke: { color: { light: '#14b8a6', dark: '#5eead4' }, width: 1 },
      }),
      ...points.map((point, i) =>
        plot.scatter({
          data: [point],
          size: [7, 12, 21, 10, 15, 9, 26, 13, 11, 8, 14][i],
          mark: 'circle',
          color: colors[i % colors.length],
          tooltip: pure(
            ({ x, y }) => h('span', {}, 'Point ' + (i + 1) + ' · (' + x + ', ' + y + ')'),
            { i },
          ),
          stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 1.5 },
        }),
      ),
      plot.rect({
        data: [{ x: 32, x2: 44, y: 31, y2: 47 }],
        color: { light: '#ddd6fe', dark: '#5b21b6' },
        stroke: { color: { light: '#8b5cf6', dark: '#c4b5fd' }, width: 1.5 },
      }),
      plot.rect({
        data: [{ x: 76, x2: 97, y: 76, y2: 96 }],
        color: { light: 'rgba(254, 215, 170, 0.55)', dark: 'rgba(154, 52, 18, 0.55)' },
        stroke: { color: { light: '#f97316', dark: '#fdba74' }, width: 1.5 },
      }),
      ...smoothPaths.map((data, i) =>
        plot.line({
          data,
          width: 2.5,
          dash: i === 1 ? [7, 5] : [],
          tooltip: pure(
            ({ x, y }) =>
              h(
                'span',
                {},
                'Line ' + (i + 1) + ' · (' + Number(x).toFixed(1) + ', ' + Number(y).toFixed(1) + ')',
              ),
            { i },
          ),
          color:
            i % 2 === 0
              ? { light: '#0d9488', dark: '#5eead4' }
              : { light: '#f97316', dark: '#fdba74' },
        }),
      ),
      plot.rule({ y: 10, color: { light: '#0284c7', dark: '#7dd3fc' }, width: 1.5, dash: [6, 4] }),
    ],
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    border: false,
    grid: false,
    height: 280,
    margin: { top: 12, right: 16, bottom: 42, left: 58 },
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(mixed_series)
  // presentation.blank("Mixed series").print(mixed_series)
```

## Install and configure

<a id="install"></a>

Install `@antadesign/plot` alongside Anta and your renderer.

These setup snippets are for web applications. Antithesis notebooks provide
`plot` directly and do not need these imports or registration steps.

```sh
npm install @antadesign/plot @antadesign/anta react react-dom
```

Plot requires Anta `^0.3.30`, React `^19.0.0`, and a bundler that supports ES
modules and CSS imports. Preact applications use `preact/compat` aliases for
React and React DOM. See Anta's [renderer setup](../install-config.md#preact-with-compat) for configuration.

Load `@antadesign/plot/plot.css` once in your browser entry. The shared Plot
stylesheet is required for JSX `Plot`, low-level
`PlotSurface`, and standalone `<a-plot>`, including the `/browser` and `/auto`
entries. Element registration loads the supporting Anta element styles.

Anta's `tokens.css` is optional. Selection rectangles, tooltips, and menus use
fallback colors when tokens are absent. When using Anta's theme colors, put
tokens before the Plot stylesheet. Omit the tokens import if your application
already loads Anta's full bundle:

```ts
import '@antadesign/anta/tokens.css'
import '@antadesign/plot/plot.css'
```

Anta's `reset.css` and themes are also optional application-wide choices.

### JSX plots

Import the component, register its surface and tooltip elements in the browser,
and load the Plot stylesheet:

```tsx
import { Plot, line } from '@antadesign/plot'
import '@antadesign/plot/elements/a-plot-surface'
import '@antadesign/anta/elements/a-tooltip'
import '@antadesign/plot/plot.css'

const plotArgs = {
  height: 300,
  series: [line({ data: [{ x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 4 }] })],
}

export function Chart() {
  return <Plot plotArgs={plotArgs} />
}
```

`Plot` uses Anta's configured JSX factory and hooks. Importing the root package
does not register browser elements or load CSS. For server rendering, keep
registration and stylesheet imports in your application's browser entry.
Before hydrating, configure Anta with your renderer's hooks and
`{ hydratingEvents: true }` as described in [SSR and hydration](../install-config.md#browser-hydration).

By default, `Plot` fills its parent. Give the parent a height or set
`plotArgs.height`, as above. Replace `plotArgs` to update the chart.
`Plot` owns canvas rendering, interactions, tooltips, and cleanup.

### Browser elements

Register `<a-plot>` and assign its configuration through the `plotArgs` property:

```ts
import { scatter, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'

const plot = document.createElement('a-plot') as APlotElement
plot.plotArgs = {
  height: 300,
  series: [scatter({ data: [{ x: 1, y: 2 }, { x: 2, y: 5 }, { x: 3, y: 4 }] })],
}
document.body.append(plot)
```

The registration import includes the surface and tooltip elements. To register
programmatically, import and await `definePlotElement()` from
`@antadesign/plot/browser`. Both paths require the shared stylesheet.

### Low-level surfaces

Use `PlotSurface` when your application owns drawing and supplies the surface's
presentation and input handlers:

```tsx
import { PlotSurface } from '@antadesign/plot'
import '@antadesign/plot/elements/a-plot-surface'
import '@antadesign/plot/plot.css'

export function Surface() {
  return <PlotSurface className="custom-surface" />
}
```

Give the surface a height in your application's external stylesheet:

```css
.custom-surface {
  width: 100%;
  height: 300px;
}
```

The wrapper measures its host and forwards input. Controllers and drawing
lifecycle helpers remain internal. With a worker renderer and a DOM bridge that
transfers the surface's canvases, `Plot` can run in the worker while the surface
and browser registration stay in the UI thread.

### Styles and content security policy

Load an optional Anta theme after the base styles, for example
`import '@antadesign/anta/theme-antune.css'`. Plot inherits the application's
font and theme. Put broad application resets in `@layer base` so they do not
unintentionally override the component rules in `anta.components`.

For a strict content security policy (CSP), configure your bundler to extract
Plot and Anta CSS imports into external stylesheets served from an allowed
origin. For same-origin stylesheets, Plot supports:

```text
style-src 'self'; style-src-elem 'self'; style-src-attr 'none'
```

A stylesheet link to the published `dist/plot.css` asset also works alongside
your application bundle. Load it in each destination document before adopting
a plot there.

Development CSS loaders that inject `<style>` elements are blocked by this
policy. Configure CSS extraction or serve emitted CSS through stylesheet links.
If your development server requires injected styles, its development CSP must
explicitly permit that loader.

Runtime dimensions, capture visibility, coordinates, cursor, and canvas filters
use direct CSSOM updates. JSX `Plot` applies dimension and `style` props after
commit, including after hydration, so its SSR markup has no inline styles.
Use an external CSS class to reserve space before hydration and prevent layout
shifts. Low-level `PlotSurface` style props and custom tooltip HTML still follow
your renderer's normal serialization rules. Use external CSS for them under
`style-src-attr 'none'`.

Worker rendering requires `worker-src` to allow the worker script's origin.
Use `worker-src 'self'` for same-origin worker scripts. If your renderer creates
blob workers, also allow `blob:`, for example `worker-src 'self' blob:`. Plot
does not create your renderer worker or its DOM bridge.

## Plot arguments

`PlotArgs` configures the whole plot: its series, axes, and presentation. Pass it
as the required `plotArgs` prop to `<Plot plotArgs={plotArgs} />`, or assign it to
the `plotArgs` property on `<a-plot>`. Replace the object to apply changes;
in-place mutation is not observed.

Title, background, and grid

Set a title, reserve space with `margin`, and style the plot background and horizontal grid lines.

```js
const examplePoints = [
    { x: 8, y: 14 },
    { x: 36, y: 40 },
    { x: 52, y: 32 },
    { x: 44, y: 59 },
    { x: 64, y: 54 },
    { x: 92, y: 86 },
  ]

  const plot_configuration = plot({
    series: [
      plot.scatter({
        data: examplePoints,
        size: 3,
        color: { light: '#9ca3af', dark: '#6b7280' },
        hoverable: false,
      }),
    ],
    title: { text: 'Plot title', font: { size: 16, color: { light: '#374151', dark: '#e5e7eb' } } },
    height: 260,
    margin: { top: 38, right: 16, bottom: 42, left: 52 },
    background: { light: '#f3f4f6', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    grid: { x: false, y: true },
    border: true,
    axis: { x: { min: 0, max: 100, label: 'Time' }, y: { min: 0, max: 100, label: 'Value' } },
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(plot_configuration)
  // presentation.blank("Plot configuration").print(plot_configuration)
```

Border and spacing

Set `border: true` and `grid: false` to frame the plot without grid lines. Use `margin` to reserve space around the axes and their labels.

```js
const examplePoints = [
    { x: 8, y: 14 },
    { x: 36, y: 40 },
    { x: 52, y: 32 },
    { x: 44, y: 59 },
    { x: 64, y: 54 },
    { x: 92, y: 86 },
  ]

  const plot_spacing = plot({
    series: [
      plot.scatter({
        data: examplePoints,
        size: 3,
        color: { light: '#9ca3af', dark: '#6b7280' },
        hoverable: false,
      }),
    ],
    height: 260,
    margin: { top: 40, right: 40, bottom: 68, left: 88 },
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    axis: { x: { min: 0, max: 100, label: 'Time' }, y: { min: 0, max: 100, label: 'Value' } },
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(plot_spacing)
  // presentation.blank("Plot spacing").print(plot_spacing)
```

### PlotArgs

| Field | Type | Default | Description |
|---|---|---|---|
| `series` | [`Series[]`](#series) | Required | What to draw, in paint order. Build each one with a factory. |
| `axis?` | [`{ x?: AxisArgs, y?: AxisArgs }`](#axes) | Inferred from data | Per-axis scale, label, ticks, and domain. |
| [`title?`](#title) | `string \| { text, font? }` | None | Plot title. |
| `font?` | [`FontArg`](#font) | [Role defaults](#font-role-defaults) | Shared font configuration. |
| `width?` | `number` | Container width | Canvas width in pixels. Overrides the wrapper's CSS width. |
| `height?` | `number` | Parent height for `Plot`; `300` for `<a-plot>` | Canvas height in pixels. Overrides the host's CSS height. |
| [`margin?`](#margins) | `number \| { top?, right?, bottom?, left? }` | `60` per side; `2` without axes or title | Space reserved around the plot area for axes and title. |
| `border?` | `boolean` | `true` | Draws a border around the plot area. |
| [`grid?`](#grid) | `boolean \| { x?, y? }` | `false` | Grid lines, per axis. |
| `chrome_color?` | [Theme colors](#theme-colors) | Theme defaults | Color for axis lines, tick marks, grid lines, and the plot border. Text colors are configured separately. |
| `background?` | `boolean` or [Theme colors](#theme-colors) | White | Plot fill. `false` paints none. `true` and an absent value use `#fff`. |
| `theme_invert?` | `boolean` | Automatic | Forces dark-mode inversion on or off. When omitted, inversion is enabled unless any `{ light, dark }` color pair is passed to the plot. |
| [`zoom_pan?`](#zoom-and-pan-options) | `boolean \| { x?, y?, menu_zoom_step? }` | `true` for continuous axes | Scroll to zoom and drag to pan. Scroll or drag on an axis to affect only that axis. Set both axes to `false` to disable zoom and pan. |
| `viewport?` | [`{ x?, y?, key? }`](#viewport-options) | Full domain | Requested starting window per axis. Applied at mount and on each `key` change, clamped to the full domain. |
| `on_viewport_change?` | [`(change: ViewportChange) => void`](#viewport-changes) | None | Fires with each axis's current window and full extent after a gesture or reset. |

### Series

A series describes a set of data and how to draw it. Pass one or more series
in `plotArgs.series`; they are drawn in array order, with the last series on top.

Each series type has its own function, such as `plot.line()`, `plot.scatter()`,
or `plot.custom()`. Call the function with the data and
options for that series, including which fields supply its coordinates, its
colors, and its tooltip behavior. The function returns a series configuration.
It does not display a plot by itself.

Pass the returned configurations in the `series` array when calling `plot()`.
The plot combines them on shared axes and applies plot-wide settings such as
the title, dimensions, and zoom controls.

In web applications, import the series functions from `@antadesign/plot` and
pass their results in the plot's `series` array.

- <a id="scatter"></a> [Scatter](./plot/scatter.md)
- <a id="line"></a> [Line](./plot/line.md)
- <a id="bar"></a> [Bar](./plot/bar.md)
- <a id="area"></a> [Area](./plot/area.md)
- <a id="rect"></a> [Rect](./plot/rect.md)
- <a id="rule"></a> [Rule](./plot/rule.md)
- <a id="custom"></a> [Custom](./plot/custom.md)
- <a id="stacked-bars"></a> [Stacked bars](./plot/bar.md#stacked-bars)
- <a id="size"></a> [Scatter size](./plot/scatter.md#size)
- <a id="custom-rendering"></a> [Custom rendering](./plot/custom.md#custom-rendering)
- <a id="custom-hover-highlights"></a> [Custom hover highlights](./plot/custom.md#custom-hover-highlights)

### Axes

`axis.x` and `axis.y` both accept `AxisArgs`. Configure them independently.
Omitted fields are inferred from the series or use the documented defaults.
[`ThemeColor`](#theme-colors) accepts a CSS color string or a `{ light, dark }` pair.

Logarithmic scale

Use a logarithmic axis to compare values across orders of magnitude. Format large tick values with a `k` suffix.

```js
const examplePoints = [
    { x: 8, y: 14 },
    { x: 36, y: 40 },
    { x: 52, y: 32 },
    { x: 44, y: 59 },
    { x: 64, y: 54 },
    { x: 92, y: 86 },
  ]

  const data = examplePoints.map(({ x, y }) => ({ x, y: 10 ** (y / 20 - 1) }))

  const logarithmic_axes = plot({
    series: [
      plot.scatter({ data, size: 3, color: { light: '#9ca3af', dark: '#6b7280' }, hoverable: false }),
    ],
    height: 260,
    margin: { top: 12, right: 14, bottom: 44, left: 80 },
    axis: {
      x: { min: 0, max: 100, label: 'Batch' },
      y: {
        scale: 'log',
        min: 0.1,
        max: 10000,
        label: 'Duration (ms)',
        tick_label: {
          format: pure((value) =>
            Number(value) >= 1000 ? Number(value) / 1000 + 'k' : String(value),
          ),
        },
      },
    },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: true,
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(logarithmic_axes)
  // presentation.blank("Logarithmic axes").print(logarithmic_axes)
```

Time and tick formatting

Plot timestamps on a UTC axis and add a percent suffix to the vertical ticks.

```js
const examplePoints = [
    { x: 8, y: 14 },
    { x: 36, y: 40 },
    { x: 52, y: 32 },
    { x: 44, y: 59 },
    { x: 64, y: 54 },
    { x: 92, y: 86 },
  ]

  const start = 1768176000000 // 2026-01-12T00:00:00Z

  const data = examplePoints.map(({ x, y }) => ({ x: start + (x / 100) * 86400000, y }))

  const time_axes = plot({
    series: [
      plot.scatter({ data, size: 3, color: { light: '#9ca3af', dark: '#6b7280' }, hoverable: false }),
    ],
    height: 260,
    margin: { top: 12, right: 16, bottom: 44, left: 76 },
    axis: {
      x: {
        scale: 'utc',
        min: start,
        max: start + 86400000,
        label: 'Time (UTC)',
        padding: 8,
      },
      y: {
        min: 0,
        max: 100,
        label: 'Utilization',
        tick_mark: false,
        tick_label: { format: pure((value) => value + '%') },
      },
    },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: true, y: false },
    border: true,
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(time_axes)
  // presentation.blank("Time axes").print(time_axes)
```

#### AxisArgs

| Field | Type | Default | Description |
|---|---|---|---|
| [`scale?`](#scales) | `'linear' \| 'log' \| 'category' \| 'time' \| 'utc'` | Inferred | Numeric data uses a linear scale. String data uses categories. Time scales take timestamps in milliseconds. `time` formats in local time and `utc` in UTC. |
| `label?` | [`LabelArg`](#axis-labels) | Shared field name, if available | Axis name, as text or an object with presentation options. Use `''` to omit it. |
| `min?` | `number` | Inferred from data | Lower continuous-domain bound. |
| `max?` | `number` | Inferred from data | Upper continuous-domain bound. |
| `categories?` | `string[]` | Inferred from data | Declares a categorical axis and sets its category list and order across all series. Series data with unlisted categories is omitted. Listed categories without data retain empty bands. If a name appears more than once in the `categories` list, only its first occurrence is used. |
| `padding?` | `number` | `0` | Pixel padding at both ends of the axis, inside the plot area. |
| `padding_left?` | `number` | `0` | Pixel padding at the left end of `axis.x`. Inherits `axis.x.padding` when omitted. Set this field to override it for this end. |
| `padding_right?` | `number` | `0` | Pixel padding at the right end of `axis.x`. Inherits `axis.x.padding` when omitted. Set this field to override it for this end. |
| `padding_top?` | `number` | `0` | Pixel padding at the top end of `axis.y`. Inherits `axis.y.padding` when omitted. Set this field to override it for this end. |
| `padding_bottom?` | `number` | `0` | Pixel padding at the bottom end of `axis.y`. Inherits `axis.y.padding` when omitted. Set this field to override it for this end. |
| `grid_align?` | `'center' \| 'edge'` | `'center'` | Position grid lines at the centers or boundaries of category bands. Setting this option on a continuous axis produces an error. |
| `line?` | `boolean` | `true` | Draw the axis line. |
| `hidden?` | `boolean` | `false` | Hide the axis presentation while retaining its scale. |
| `tick_label?` | [`TickLabelArg`](#tick-labels) | Automatic formatting | Tick text formatting, size, and color. |
| `tick_mark?` | `boolean` | `true` | Draw tick marks. Does not hide tick labels. |

## Interactions

Interact with a plot to inspect data points, select them, or change the visible
range. Configure these behaviors on the plot or its individual series:

- [Hover highlights](#hover-highlights) change a point's appearance when you move the pointer over it.
- [Tooltips](#tooltips) show details about the data under the pointer.
- [Selection](#selection) executes the callback you provide when you select a data point.
- [Zoom and pan](#zoom-and-pan) let you focus on a smaller range or move through the data. Use [`on_viewport_change`](#viewport-changes) to notify your application when the visible range changes.

### Hover highlights

When you move the pointer over a data point, a hover highlight temporarily
changes its appearance to show which point you are hovering over. By default,
Plot draws a highlight over the point using its series color. Opaque colors
are darkened in light mode or lightened in dark mode and applied at 40% opacity.
Colors that are already translucent keep their color and opacity, blending
over the original point.

Set `highlight_color` to a CSS color, a `{ light, dark }` pair, or a per-row accessor. Stacked bars also accept a color array with one entry per segment. Anta uses the resolved color without shading or changing its opacity. Translucent highlights blend over the original mark. Omit the property to keep the default highlight.

For custom series, this property changes the fallback renderer's `color`, `colors`, and `color_at`. An explicit `highlight_renderer` keeps control of its canvas colors and helpers. A fallback renderer must use the supplied colors to reflect the override; a hard-coded canvas fill will stay unchanged.

Hover feedback is temporary. For custom geometry, supply a [hit-testing callback](#custom-hit-testing).

- Bars A and B use the default highlight.
- Bar C uses an opaque orange `highlight_color`.
- Bar D uses a translucent magenta `highlight_color`.
- Bar E sets `highlight: false`, so its appearance stays unchanged.
- Bar F uses `hoverable: false`, so it does not participate in hit testing.

```js
const data = [
    { x: 'A', y: 64 },
    { x: 'B', y: 82 },
    { x: 'C', y: 53 },
    { x: 'D', y: 71 },
    { x: 'E', y: 44 },
    { x: 'F', y: 61 },
  ]

  const hover_highlights = plot({
    series: [
      plot.bar({
        data: data.slice(0, 2),
        inset: 7,
        border_radius: 4,
        color: { light: 'rgba(13, 148, 136, 0.35)', dark: 'rgba(94, 234, 212, 0.35)' },
      }),
      plot.bar({
        data: data.slice(2, 4),
        inset: 7,
        border_radius: 4,
        color: { light: '#0d9488', dark: '#5eead4' },
        highlight_color: pure((row) =>
          row.x === 'C'
            ? { light: '#f97316', dark: '#fdba74' }
            : 'color-mix(in oklch, magenta 50%, transparent)',
        ),
      }),
      plot.bar({
        data: data.slice(4, 5),
        inset: 7,
        border_radius: 4,
        color: { light: '#7c3aed', dark: '#c4b5fd' },
        highlight: false,
      }),
      plot.bar({
        data: data.slice(5),
        inset: 7,
        border_radius: 4,
        color: { light: '#94a3b8', dark: '#64748b' },
        hoverable: false,
      }),
    ],
    height: 260,
    margin: { top: 8, right: 12, bottom: 24, left: 32 },
    axis: {
      x: { categories: data.map((row) => row.x), label: '' },
      y: { min: 0, max: 100, label: '' },
    },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(hover_highlights)
  // presentation.blank("Hover highlights").print(hover_highlights)
```

#### Custom hit testing

Hit testing determines which data point, if any, is under the pointer. Plot uses
the result for hover highlights, tooltips, and selection. For custom shapes,
provide a callback that checks whether the pointer is over your geometry.

The `hit_test` callback receives the series and a `HitContext` describing the
pointer position and plot geometry. Return the matching item's index in `data`,
or `null` when there is no hit. Custom series need this callback for tooltips
and selection.

##### HitContext

| Context field | Type | Description |
|---|---|---|
| `cursor` | `{ x: number; y: number }` | Pointer position in the same pixel coordinates as the resolvers. |
| `inner` | [`Rect`](./plot/custom.md#custom-rendering) | Plot bounds in pixels. |
| `x_scale` | [`Scale`](./plot/custom.md#custom-rendering) | Composed horizontal scale. |
| `y_scale` | [`Scale`](./plot/custom.md#custom-rendering) | Composed vertical scale. |
| `resolve_x` | [`PixelResolver`](./plot/custom.md#custom-rendering) | Resolve a row index to its x position. |
| `resolve_y` | [`PixelResolver`](./plot/custom.md#custom-rendering) | Resolve a row index to its y position. |

### Tooltips

Hover a rectangle to inspect its data. The series with `tooltip: true` shows the default tooltip. The series with a tooltip callback shows custom content describing its bounds. Where the two series overlap, both tooltip entries appear together, separated by a divider. The tooltip follows the pointer.

Use `tooltip: true` for default content. In Antithesis notebook, custom callbacks
return a Printable using `h(...)`, as in the example. Standalone browser callbacks
return a DOM node, and React callbacks can return JSX. All receive the
[tooltip and selection callback parameters](#tooltip-and-selection-callback-parameters).
Omit `tooltip` to keep hover feedback without a tooltip. See
[Tooltip content](#tooltip-content) for the callback types.

```js
const data = [
    { x: 8, x2: 38, y: 15, y2: 48, name: 'Window A' },
    { x: 55, x2: 86, y: 48, y2: 82, name: 'Window B' },
  ]

  const window_tooltips = plot({
    series: [
      plot.rect({
        data,
        color: { light: 'rgba(13, 148, 136, 0.45)', dark: 'rgba(94, 234, 212, 0.45)' },
        stroke: { color: { light: '#0d9488', dark: '#5eead4' }, width: 2 },
        tooltip: true,
      }),
      plot.rect({
        data: data.map((row) => ({
          ...row,
          x: row.x + 12,
          x2: row.x2 + 8,
          y: row.y + 12,
          y2: row.y2 + 10,
        })),
        color: { light: 'rgba(124, 58, 237, 0.45)', dark: 'rgba(196, 181, 253, 0.45)' },
        stroke: { color: { light: '#7c3aed', dark: '#c4b5fd' }, width: 2 },
        tooltip: pure(({ row }) =>
          h(
            'div',
            {},
            h('strong', {}, String(row.name)),
            h('div', {}, 'Bounds: x ' + row.x + '–' + row.x2 + ', y ' + row.y + '–' + row.y2),
          ),
        ),
      }),
    ],
    height: 260,
    margin: { top: 8, right: 12, bottom: 24, left: 32 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(window_tooltips)
  // presentation.blank("Window tooltips").print(window_tooltips)
```

#### Tooltip content

`tooltip` accepts `true` or a callback that returns tooltip content.
Omit `tooltip` to show no tooltip for that series.

#### TooltipArg

- `true` shows the default tooltip with the point's axis values.
- A callback, [`(data: TooltipData) => TooltipContent`](#tooltip-and-selection-callback-parameters), returns custom content for the hovered point.

`false` is not accepted. Omit `tooltip` to disable it.

With the React component, `TooltipContent` is a `ReactNode`, including strings
and JSX. With the standalone browser host, return a DOM `Node`. The core
leaves the content type to the host.

#### Composing tooltips across series

Set `tooltip` on the plot to combine information from multiple series into one
tooltip. This callback overrides the individual series' tooltip callbacks.

The callback receives an array in the same order as your `series` array:

- Each hovered series contributes `{ series, data }`, containing its original options and the hovered point's data.
- A series with no point under the pointer contributes `undefined`.

Return the combined tooltip content, or `null` to hide it.

In this example, hover the overlapping rectangles to compare baseline and
current bounds side by side. The tooltip shows the difference between them
and uses “—” where a value is missing.

```js
const data = [
    { x: 8, x2: 38, y: 15, y2: 48, name: 'Window A' },
    { x: 55, x2: 86, y: 48, y2: 82, name: 'Window B' },
  ]

  const window_comparison = plot({
    series: [
      plot.rect({
        data,
        tooltip: true,
        color: { light: 'rgba(13, 148, 136, 0.45)', dark: 'rgba(94, 234, 212, 0.45)' },
        stroke: { color: { light: '#0d9488', dark: '#5eead4' }, width: 2 },
      }),
      plot.rect({
        data: data.map((row) => ({
          ...row,
          x: row.x + 12,
          x2: row.x2 + 8,
          y: row.y + 12,
          y2: row.y2 + 10,
        })),
        color: { light: 'rgba(124, 58, 237, 0.45)', dark: 'rgba(196, 181, 253, 0.45)' },
        stroke: { color: { light: '#7c3aed', dark: '#c4b5fd' }, width: 2 },
        tooltip: pure(({ row }) =>
          h(
            'div',
            {},
            h('strong', {}, String(row.name)),
            h('div', {}, 'Bounds: x ' + row.x + '–' + row.x2 + ', y ' + row.y + '–' + row.y2),
          ),
        ),
      }),
    ],
    tooltip: pure(([baseline_hit, current_hit]) => {
      const baseline = baseline_hit?.data.row
      const current = current_hit?.data.row
      const bounds = [
        ['x', 'X start'],
        ['x2', 'X end'],
        ['y', 'Y start'],
        ['y2', 'Y end'],
      ]
      return h(
        'div',
        {},
        h('strong', {}, String((current ?? baseline)?.name ?? 'Window comparison')),
        h(
          'table',
          {},
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              ...['Bound', 'Baseline', 'Current', 'Change'].map((label) =>
                h('th', { scope: 'col' }, label),
              ),
            ),
          ),
          h(
            'tbody',
            {},
            ...bounds.map(([field, label]) => {
              const before = baseline?.[field]
              const after = current?.[field]
              const delta =
                typeof before === 'number' && typeof after === 'number' ? after - before : undefined
              return h(
                'tr',
                {},
                h('th', { scope: 'row' }, label),
                ...[
                  before ?? '—',
                  after ?? '—',
                  delta === undefined ? '—' : (delta > 0 ? '+' : '') + delta,
                ].map((value) => h('td', {}, String(value))),
              )
            }),
          ),
        ),
      )
    }),
    height: 260,
    margin: { top: 8, right: 12, bottom: 24, left: 32 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(window_comparison)
  // presentation.blank("Window comparison").print(window_comparison)
```

### Selection

<a id="selection-callbacks"></a>

Select a point to display its source data in the preview’s text readout. `on_select` receives the selected point and its original row, so you can update a detail panel or application state. Its return value is ignored.

The callback does not create persistent selection styling. This preview keeps the last selected value in a text readout. See [Tooltip and selection callback parameters](#tooltip-and-selection-callback-parameters) for the fields passed to the callback.

```js
const data = Array.from({ length: 24 }, (_, i) => ({
    x: 8 + ((i * 19) % 84),
    y: 12 + ((i * 29) % 76),
    name: 'Sample ' + (i + 1),
  }))

  const selected_point = new reactive.StateVar('Select a point to inspect its data.')

  const interactive_plot = plot({
    series: [
      plot.scatter({
        data,
        size: 13,
        color: { light: '#0891b2', dark: '#67e8f9' },
        tooltip: true,
        on_select: pure(
          ({ row, x, y }) => selected_point.set(row.name + ' · x: ' + x + ' · y: ' + y),
          { selected_point },
        ),
      }),
    ],
    height: 260,
    margin: { top: 8, right: 12, bottom: 24, left: 32 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  })

  const point_selection = h(
    'div',
    {},
    interactive_plot,
    h(
      pure(({ selected_point }) =>
        h('output', { 'aria-live': 'polite', style: { display: 'block' } }, selected_point.get()),
      ),
      { selected_point },
    ),
  )

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(point_selection)
  // presentation.blank("Point selection").print(point_selection)
```

### Tooltip and selection callback parameters

Tooltip and selection callbacks receive a `TooltipData` object with these fields:

#### TooltipData

| Field | Type | Description |
|---|---|---|
| `x` | `number \| string` | Point's x value, or category label. |
| `y` | `number \| string` | Point's y value, or category label. |
| `row` | Data item or `undefined` | The original item from your `data` array. May be `undefined` for rule or custom series without data. |
| `label?` | `string` | Point label when available, such as the field name of a stacked bar segment. |

### Zoom and pan

Zooming lets you inspect a smaller range of data in more detail. Panning moves
the visible range so you can explore other parts of the plot. Scroll to zoom
around the pointer, or click and drag to pan. Hold Ctrl while clicking and
dragging to draw a rectangle. Releasing zooms into that region within each
enabled axis's limits.

Zoom and pan apply to continuous axes. Categorical axes do not zoom. See
[Zoom and pan options](#zoom-and-pan-options) to configure each axis.

Right-click the plot to open a menu with **Zoom In**, **Zoom Out**, and
**Reset Zoom**. Reset Zoom restores the full data range.
Menu zoom anchors at the context-click position and applies the same factor to
both enabled axes, with independent limits. Set
`zoom_pan: { menu_zoom_step: 1.5 }` to change that factor from its default of `2`.

```js
const data = Array.from({ length: 201 }, (_, i) => ({
    x: i / 2,
    y: 45 + 18 * Math.sin(i / 18) + 9 * Math.cos(i / 5) + 4 * Math.sin(i * 1.3),
  }))

  const viewport_report = new reactive.StateVar(
    'Scroll to zoom, drag to pan, or Ctrl-drag to zoom to a rectangle.',
  )

  const interactive_plot = plot({
    series: [
      plot.line({
        data,
        width: 2,
        color: { light: '#6366f1', dark: '#a5b4fc' },
        tooltip: true,
      }),
    ],
    height: 420,
    margin: { top: 8, right: 12, bottom: 24, left: 32 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: { x: true, y: true },
    on_viewport_change: pure(
      ({ x, y }) => {
        const format = (axis) =>
          axis ? axis.window.map((value) => value.toFixed(1)).join('–') : 'categorical axis'
        viewport_report.set('Visible x: ' + format(x) + ' · y: ' + format(y))
      },
      { viewport_report },
    ),
  })

  const zoom_and_pan = h(
    'div',
    {},
    interactive_plot,
    h(
      pure(({ viewport_report }) =>
        h('output', { 'aria-live': 'polite', style: { display: 'block' } }, viewport_report.get()),
      ),
      { viewport_report },
    ),
  )

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(zoom_and_pan)
  // presentation.blank("Zoom and pan").print(zoom_and_pan)
```

Navigate an axis

Scroll over an axis to zoom around the pointer, or drag on the axis to zoom around the value where the drag started. No modifier is needed. Enabled continuous axes show directional arrows on hover. Drag inside the plot to pan. Drag right on x or up on y to zoom in; drag the other way to zoom out. Moving a quarter of the full axis length halves or doubles the starting span, subject to zoom limits. The other axis keeps its viewport.

```js
const data = Array.from({ length: 201 }, (_, i) => ({
    x: i / 2,
    y: 45 + 18 * Math.sin(i / 18) + 9 * Math.cos(i / 5) + 4 * Math.sin(i * 1.3),
  }))

  const viewport_report = new reactive.StateVar(
    'Scroll to zoom, drag to pan, or Ctrl-drag to zoom to a rectangle.',
  )

  const interactive_plot = plot({
    series: [
      plot.line({
        data,
        width: 2,
        color: { light: '#6366f1', dark: '#a5b4fc' },
        tooltip: true,
      }),
    ],
    height: 260,
    margin: { top: 8, right: 12, bottom: 24, left: 32 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: { x: true, y: true },
    on_viewport_change: pure(
      ({ x, y }) => {
        const format = (axis) =>
          axis ? axis.window.map((value) => value.toFixed(1)).join('–') : 'categorical axis'
        viewport_report.set('Visible x: ' + format(x) + ' · y: ' + format(y))
      },
      { viewport_report },
    ),
  })

  const scrollable_plot = h(
    'div',
    {},
    interactive_plot,
    h(
      pure(({ viewport_report }) =>
        h('output', { 'aria-live': 'polite', style: { display: 'block' } }, viewport_report.get()),
      ),
      { viewport_report },
    ),
  )

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(scrollable_plot)
  // presentation.blank("Scrollable plot").print(scrollable_plot)
```

Zoom on one axis

Scroll to zoom or drag to pan. Only the horizontal window changes; the vertical range stays fixed. Set `x: false, y: true` for vertical-only navigation.

```js
const data = Array.from({ length: 201 }, (_, i) => ({
    x: i / 2,
    y: 45 + 18 * Math.sin(i / 18) + 9 * Math.cos(i / 5) + 4 * Math.sin(i * 1.3),
  }))

  const viewport_report = new reactive.StateVar(
    'Scroll to zoom, drag to pan, or Ctrl-drag to zoom to a rectangle.',
  )

  const interactive_plot = plot({
    series: [
      plot.line({
        data,
        width: 2,
        color: { light: '#6366f1', dark: '#a5b4fc' },
        tooltip: true,
      }),
    ],
    height: 260,
    margin: { top: 8, right: 12, bottom: 24, left: 32 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: { x: true, y: false },
    on_viewport_change: pure(
      ({ x, y }) => {
        const format = (axis) =>
          axis ? axis.window.map((value) => value.toFixed(1)).join('–') : 'categorical axis'
        viewport_report.set('Visible x: ' + format(x) + ' · y: ' + format(y))
      },
      { viewport_report },
    ),
  })

  const horizontal_zoom = h(
    'div',
    {},
    interactive_plot,
    h(
      pure(({ viewport_report }) =>
        h('output', { 'aria-live': 'polite', style: { display: 'block' } }, viewport_report.get()),
      ),
      { viewport_report },
    ),
  )

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(horizontal_zoom)
  // presentation.blank("Horizontal zoom").print(horizontal_zoom)
```

#### Zoom and pan options

`zoom_pan` accepts a boolean for both axes or this `ZoomPanArg` object:

##### ZoomPanArg

| Field | Type | Default | Description |
|---|---|---|---|
| `x?` | `boolean` | `true` | Enable horizontal zoom and pan on a continuous axis. |
| `y?` | `boolean` | `true` | Enable vertical zoom and pan on a continuous axis. |
| `menu_zoom_step?` | `number` | `2` | Multiplicative menu zoom factor. Must be finite and greater than 1. Does not affect wheel or drag sensitivity. |

Setting both axes to `false` disables zoom and pan. Categorical axes do not zoom.

<a id="controlling-the-viewport"></a>

### Viewport

Use the buttons to focus on a range or restore the full extent. You can still zoom and pan horizontally after a button sets the view.

Set `viewport` to control the visible range. Increment its `key` to apply a new request after the user zooms or pans. See [Viewport](#viewport) for initialization and reset behavior.

`on_viewport_change` reports the visible and full ranges. Keep this notification separate from viewport requests to avoid reapplying the view on every gesture. See [Viewport changes](#viewport-changes) for the callback parameters.

```js
const data = Array.from({ length: 201 }, (_, i) => ({
    x: i / 2,
    y: 45 + 18 * Math.sin(i / 18) + 9 * Math.cos(i / 5) + 4 * Math.sin(i * 1.3),
  }))

  const viewport_report = new reactive.StateVar(
    'Scroll to zoom, drag to pan, or Ctrl-drag to zoom to a rectangle.',
  )

  const requested_viewport = new reactive.StateVar({ x: [20, 45], y: null, key: 0 })

  const controlled_viewport = h(
    pure(({ data, requested_viewport, viewport_report }) => {
      const viewport_plot = plot({
        series: [
          plot.line({
            data,
            width: 2,
            color: { light: '#6366f1', dark: '#a5b4fc' },
            tooltip: true,
          }),
        ],
        height: 260,
        margin: { top: 8, right: 12, bottom: 24, left: 32 },
        axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
        background: { light: '#ffffff', dark: '#151b28' },
        chrome_color: { light: '#e2e8f0', dark: '#334155' },
        grid: false,
        border: false,
        zoom_pan: { x: true, y: false },
        viewport: requested_viewport.get(),
        on_viewport_change: pure(
          ({ x, y }) => {
            const format = (axis) =>
              axis ? axis.window.map((value) => value.toFixed(1)).join('–') : 'categorical axis'
            viewport_report.set('Visible x: ' + format(x) + ' · y: ' + format(y))
          },
          { viewport_report },
        ),
      })
      const windows = [
        ['Focus 20–45', [20, 45]],
        ['Focus 55–80', [55, 80]],
        ['Full extent', null],
      ]
      const controls = h(
        'div',
        {},
        ...windows.map(([label, x]) =>
          h(
            internal.anta.Button,
            {
              type: 'button',
              onClick: pure(
                () => {
                  const current = requested_viewport.get()
                  requested_viewport.set({ x, y: null, key: current.key + 1 })
                },
                { requested_viewport, x },
              ),
            },
            label,
          ),
        ),
      )
      return h(
        'div',
        {},
        viewport_plot,
        controls,
        h(
          pure(({ viewport_report }) =>
            h(
              'output',
              { 'aria-live': 'polite', style: { display: 'block' } },
              viewport_report.get(),
            ),
          ),
          { viewport_report },
        ),
      )
    }),
    { data, requested_viewport, viewport_report },
  )

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(controlled_viewport)
  // presentation.blank("Controlled viewport").print(controlled_viewport)
```

#### Viewport options

`viewport` requests a visible window within the full data domain. It applies
at mount and when `key` changes; user gestures can then move away from it.
Changing only `x` or `y` with the same key does not reapply the request.

| Field | Type | Default | Description |
|---|---|---|---|
| `x?` | `number[] \| null` | Leave unchanged | Requested `[min, max]` on x, clamped to the full domain. `null` restores its full extent. |
| `y?` | `number[] \| null` | Leave unchanged | Requested `[min, max]` on y, clamped to the full domain. `null` restores its full extent. |
| `key?` | `string \| number` | None | Change this value to apply a new viewport request. |

At mount, an omitted axis starts at its full extent. Viewport windows apply
to continuous axes.

<a id="viewport-changes"></a>

#### ViewportChange

`on_viewport_change` receives one `ViewportChange` object after a gesture or
reset. Its fields describe both axes and their zoom magnification.

| Field | Type | Description |
|---|---|---|
| `x` | [`AxisViewport`](#axisviewport) or `null` | Current horizontal viewport, or `null` for a categorical axis. |
| `y` | [`AxisViewport`](#axisviewport) or `null` | Current vertical viewport, or `null` for a categorical axis. |
| `zoom_factor` | `{ x: number; y: number }` | Per-axis gesture magnification, initially 1. Preserved during pan, resize, and data-domain changes. |

For a continuous axis, `ViewportChange.x` or `ViewportChange.y` contains an
`AxisViewport` object with these fields. For a categorical axis, that field is
`null`.

##### AxisViewport

| Field | Type | Description |
|---|---|---|
| `window` | `number[]` | Current visible `[min, max]`. |
| `full` | `number[]` | Full unzoomed `[min, max]`. |

## Configuration details

### Font

`font` on the plot supplies shared text settings. `title.font`,
`axis.x.label.font`, `axis.y.label.font`, and each axis's `tick_label.font`
accept local overrides. A string is shorthand for `{ family: string }`.
Fields resolve individually from local settings, plot settings, and role defaults.
Font assets are supplied by the application.

#### FontConfig

| Field | Type | Constraint |
| --- | --- | --- |
| `family?` | `string` | CSS font family or family list. |
| `size?` | `number` | Positive finite CSS pixels. |
| `weight?` | `number` | Finite CSS weight from 1 to 1000. |
| `color?` | [`ThemeColor`](#theme-colors) | Color string or light/dark pair. |
| `italic?` | `boolean` | Select italic text. |
| `condensed?` | `boolean` | Select condensed text. |
| `letter_spacing?` | `number` | Finite CSS pixels. Negative values are allowed. |
| `word_spacing?` | `number` | Finite CSS pixels. Negative values are allowed. |
| `caps?` | `boolean \| FontCaps` | `true` means `all-small-caps`. `false` means `normal`. |

`FontCaps` accepts `normal`, `small-caps`, `all-small-caps`, `petite-caps`,
`all-petite-caps`, `unicase`, and `titling-caps`.

Canvas drawing and text measurement use the same resolved font settings.

#### Font role defaults

- Titles: 14px, using the inherited CSS font family with a sans-serif fallback.
- Axis labels: 12px, using the inherited CSS font family with a sans-serif fallback.
- Tick labels: 10px monospace.

All roles default to a font weight of 400. Root settings override these role
defaults, and local settings override the root field by field.

Plots capture the inherited CSS font family once when they mount. Explicit
plot-level and local families take precedence. Later CSS font changes and
font-loading completion do not trigger a redraw. Make fonts available before
drawing; replacing `plotArgs` applies explicit font configuration changes.

Different fonts by role

The title combines bold weight, condensed width, and tighter letters. The axes switch to italic serif and spaced monospace, with colors that adapt to the theme.

```js
const font_roles = plot({
    series: [
      plot.scatter({
        data: [
          { x: 12, y: 18 },
          { x: 30, y: 42 },
          { x: 48, y: 35 },
          { x: 58, y: 64 },
          { x: 76, y: 58 },
          { x: 88, y: 82 },
        ],
        size: 3,
        color: { light: '#9ca3af', dark: '#6b7280' },
        hoverable: false,
      }),
    ],
    height: 260,
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    zoom_pan: false,
    margin: { top: 48, right: 20, bottom: 58, left: 72 },
    font: {
      family: '"TT Interphases Pro Variable", sans-serif',
      size: 13,
      weight: 450,
      color: { light: '#713fff', dark: '#c4b5fd' },
    },
    title: {
      text: '22px · bold · condensed',
      font: { size: 22, weight: 750, condensed: true, letter_spacing: -0.35 },
    },
    axis: {
      x: {
        min: 0,
        max: 100,
        label: {
          text: 'Serif · italic · 16px',
          font: {
            family: 'Georgia, serif',
            size: 16,
            italic: true,
            color: { light: '#c2410c', dark: '#fdba74' },
          },
        },
      },
      y: {
        min: 0,
        max: 100,
        label: {
          text: 'Mono · +1px letters',
          font: { family: 'monospace', size: 12, letter_spacing: 1 },
        },
      },
    },
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(font_roles)
  // presentation.blank("Font roles").print(font_roles)
```

Shared settings and local overrides

The title inherits italic small caps and expanded spacing. The horizontal label resets caps, italic, and both spacing values; the vertical label selects `small-caps` explicitly. Tick labels use compact monospace overrides.

```js
const font_overrides = plot({
    series: [
      plot.scatter({
        data: [
          { x: 12, y: 18 },
          { x: 30, y: 42 },
          { x: 48, y: 35 },
          { x: 58, y: 64 },
          { x: 76, y: 58 },
          { x: 88, y: 82 },
        ],
        size: 3,
        color: { light: '#9ca3af', dark: '#6b7280' },
        hoverable: false,
      }),
    ],
    height: 260,
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    zoom_pan: false,
    margin: { top: 48, right: 20, bottom: 58, left: 72 },
    font: {
      family: '"TT Interphases Pro Variable", sans-serif',
      size: 14,
      weight: 600,
      italic: true,
      caps: true,
      letter_spacing: 1,
      word_spacing: 4,
      color: { light: '#0f766e', dark: '#5eead4' },
    },
    title: { text: 'Small caps · +4px words', font: { size: 20 } },
    axis: {
      x: {
        min: 0,
        max: 100,
        label: {
          text: 'Normal caps · zero spacing',
          font: {
            caps: false,
            italic: false,
            letter_spacing: 0,
            word_spacing: 0,
            color: { light: '#c2410c', dark: '#fdba74' },
          },
        },
        tick_label: {
          font: {
            family: 'monospace',
            size: 10,
            weight: 400,
            italic: false,
            caps: false,
            letter_spacing: 0,
            word_spacing: 0,
          },
        },
      },
      y: {
        min: 0,
        max: 100,
        label: {
          text: 'Italic · small caps',
          font: { caps: 'small-caps', letter_spacing: 0.5, word_spacing: 0 },
        },
        tick_label: {
          font: {
            family: 'monospace',
            size: 10,
            weight: 400,
            italic: false,
            caps: false,
            letter_spacing: 0,
            word_spacing: 0,
          },
        },
      },
    },
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(font_overrides)
  // presentation.blank("Font overrides").print(font_overrides)
```

### Title

Set the title text and font styles.

The plot below uses a custom title size and purple colors for light and dark themes.

```js
const plot_title = plot({
    series: [
      plot.scatter({
        data: [
          { x: 12, y: 18 },
          { x: 30, y: 42 },
          { x: 48, y: 35 },
          { x: 58, y: 64 },
          { x: 76, y: 58 },
          { x: 88, y: 82 },
        ],
        size: 3,
        color: { light: '#9ca3af', dark: '#6b7280' },
        hoverable: false,
      }),
    ],
    height: 260,
    axis: { x: { min: 0, max: 100, label: 'Time' }, y: { min: 0, max: 100, label: 'Value' } },
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    zoom_pan: false,
    margin: { top: 44, right: 24, bottom: 48, left: 76 },
    title: { text: 'Plot title', font: { size: 20, color: { light: '#713fff', dark: '#c4b5fd' } } },
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(plot_title)
  // presentation.blank("Plot title").print(plot_title)
```

`title` accepts a string or a `TitleArg` object:

#### TitleArg

| Field | Type | Default | Description |
|---|---|---|---|
| `text` | `string` | Required | Plot title text. |
| `font?` | `string` \| [`FontConfig`](#fontconfig) | [Role defaults](#font-role-defaults) | Font family, size, weight, color, and other text styles. |

### Margins

`margin` reserves space in pixels around the plot area for axis labels, tick labels,
and the title. Set one number for all four sides, or an object with `top`, `right`,
`bottom`, and `left` to adjust each side independently.

The plot below uses different margins on each side. A gray canvas background
makes the space around the plot area visible.

```js
const plot_margins = plot({
    series: [
      plot.scatter({
        data: [
          { x: 12, y: 18 },
          { x: 30, y: 42 },
          { x: 48, y: 35 },
          { x: 58, y: 64 },
          { x: 76, y: 58 },
          { x: 88, y: 82 },
        ],
        size: 3,
        color: { light: '#9ca3af', dark: '#6b7280' },
        hoverable: false,
      }),
    ],
    height: 260,
    axis: { x: { min: 0, max: 100, label: 'Time' }, y: { min: 0, max: 100, label: 'Value' } },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    zoom_pan: false,
    margin: { top: 40, right: 40, bottom: 64, left: 88 },
    background: { light: 'white', dark: '#202124' },
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(plot_margins)
  // presentation.blank("Plot margins").print(plot_margins)
```

`margin` accepts one number for all sides or a `SideMargins` object.
Margins reserve space outside the plot area for labels and the title;
axis padding adds space inside it.

#### SideMargins

| Field | Type | Default | Description |
|---|---|---|---|
| `top?` | `number` | `60` | Top margin in pixels. |
| `right?` | `number` | `60` | Right margin in pixels. |
| `bottom?` | `number` | `60` | Bottom margin in pixels. |
| `left?` | `number` | `60` | Left margin in pixels. |

When both axes are hidden and there is no title, omitted margins use `2`
pixels instead. Explicit margins still apply.

### Grid

`grid` adds lines across the plot to help compare values against the axes.
Enable both directions with `true`, or configure `x` and `y` independently.

The plots below show both grid directions, each direction separately, and no
grid. Seven categories determine the vertical grid positions.

Both grid directions

```js
const categories = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

  const grid_both = plot({
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    zoom_pan: false,
    height: 160,
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    series: [
      plot.scatter({
        data: categories.map((x, i) => ({ x, y: 20 + i * 9 })),
        size: 3,
        color: { light: '#9ca3af', dark: '#6b7280' },
        hoverable: false,
      }),
    ],
    axis: {
      x: { categories, label: '', tick_mark: false, tick_label: { format: pure(() => '') } },
      y: { min: 0, max: 100, label: '', tick_mark: false, tick_label: { format: pure(() => '') } },
    },
    grid: { x: true, y: true },
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(grid_both)
  // presentation.blank("Grid both").print(grid_both)
```

Vertical grid lines

```js
const categories = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

  const grid_x = plot({
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    zoom_pan: false,
    height: 160,
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    series: [
      plot.scatter({
        data: categories.map((x, i) => ({ x, y: 20 + i * 9 })),
        size: 3,
        color: { light: '#9ca3af', dark: '#6b7280' },
        hoverable: false,
      }),
    ],
    axis: {
      x: { categories, label: '', tick_mark: false, tick_label: { format: pure(() => '') } },
      y: { min: 0, max: 100, label: '', tick_mark: false, tick_label: { format: pure(() => '') } },
    },
    grid: { x: true, y: false },
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(grid_x)
  // presentation.blank("Grid x").print(grid_x)
```

Horizontal grid lines

```js
const categories = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

  const grid_y = plot({
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    zoom_pan: false,
    height: 160,
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    series: [
      plot.scatter({
        data: categories.map((x, i) => ({ x, y: 20 + i * 9 })),
        size: 3,
        color: { light: '#9ca3af', dark: '#6b7280' },
        hoverable: false,
      }),
    ],
    axis: {
      x: { categories, label: '', tick_mark: false, tick_label: { format: pure(() => '') } },
      y: { min: 0, max: 100, label: '', tick_mark: false, tick_label: { format: pure(() => '') } },
    },
    grid: { x: false, y: true },
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(grid_y)
  // presentation.blank("Grid y").print(grid_y)
```

No grid lines

```js
const categories = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

  const grid_none = plot({
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    zoom_pan: false,
    height: 160,
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    series: [
      plot.scatter({
        data: categories.map((x, i) => ({ x, y: 20 + i * 9 })),
        size: 3,
        color: { light: '#9ca3af', dark: '#6b7280' },
        hoverable: false,
      }),
    ],
    axis: {
      x: { categories, label: '', tick_mark: false, tick_label: { format: pure(() => '') } },
      y: { min: 0, max: 100, label: '', tick_mark: false, tick_label: { format: pure(() => '') } },
    },
    grid: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(grid_none)
  // presentation.blank("Grid none").print(grid_none)
```

`grid` accepts a boolean for both axes or this `GridSpec` object:

#### GridSpec

| Field | Type | Default | Description |
|---|---|---|---|
| `x?` | `boolean` | `false` | Draw vertical grid lines at x-axis ticks. |
| `y?` | `boolean` | `false` | Draw horizontal grid lines at y-axis ticks. |

### Theme colors

Theme colors let you use one CSS color in both themes or choose different
colors with a `{ light, dark }` pair.

The plot below uses `tomato` for scatter marks in light mode and `lightskyblue`
in dark mode. Switch the site theme to compare them.

```js
const theme_colors = plot({
    height: 260,
    margin: { top: 20, right: 24, bottom: 48, left: 76 },
    axis: { x: { min: 0, max: 100, label: 'Time' }, y: { min: 0, max: 100, label: 'Value' } },
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    zoom_pan: false,
    series: [
      plot.scatter({
        data: [
          { x: 20, y: 30 },
          { x: 50, y: 65 },
          { x: 80, y: 45 },
        ],
        size: 18,
        color: { light: 'tomato', dark: 'lightskyblue' },
        hoverable: false,
      }),
    ],
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(theme_colors)
  // presentation.blank("Theme colors").print(theme_colors)
```

`ThemeColor` accepts a CSS color string or a `ColorPair`. Use a pair to choose
separate colors for light and dark themes.

#### ThemeColor

| Form | Type | Example |
|---|---|---|
| One color | `string` | `'steelblue'`, `'#4682b4'`, `'rgb(70, 130, 180)'`, `'hsl(207, 44%, 49%)'` |
| Theme pair | `{ light: string; dark: string }` | `{ light: 'steelblue', dark: 'lightskyblue' }` |

Both fields in a `ColorPair` are required. `ColorTheme` is `'light'` or `'dark'`.
Plain colors remain subject to the plot's `theme_invert` setting.

### Scales

Compare linear and logarithmic axes, then time and category axes. Each axis label names its scale.

Linear and logarithmic scales

```js
const plot_scales = plot({
    height: 260,
    margin: { top: 20, right: 24, bottom: 48, left: 76 },
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    zoom_pan: false,
    series: [
      plot.scatter({
        data: [1, 10, 100, 1000, 10000].map((y, i) => ({ x: 10 + i * 20, y })),
        size: 4,
        color: { light: '#9ca3af', dark: '#6b7280' },
        hoverable: false,
      }),
    ],
    axis: {
      x: { scale: 'linear', min: 0, max: 100, label: 'Linear' },
      y: {
        scale: 'log',
        min: 1,
        max: 10000,
        label: 'Logarithmic',
        tick_label: {
          format: pure((value) =>
            Number(value) >= 1000 ? Number(value) / 1000 + 'k' : String(value),
          ),
        },
      },
    },
    grid: { y: true },
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(plot_scales)
  // presentation.blank("Plot scales").print(plot_scales)
```

Time and category scales

```js
const start = 1768176000000 // 2026-01-12T00:00:00Z

  const time_categories = plot({
    height: 260,
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    zoom_pan: false,
    series: [
      plot.scatter({
        data: [
          { x: start, y: 'Alpha' },
          { x: start + 3600000, y: 'Beta' },
          { x: start + 7200000, y: 'Alpha' },
          { x: start + 10800000, y: 'Gamma' },
          { x: start + 14400000, y: 'Beta' },
        ],
        size: 4,
        color: { light: '#9ca3af', dark: '#6b7280' },
        hoverable: false,
      }),
    ],
    margin: { top: 20, right: 24, bottom: 48, left: 94 },
    axis: {
      x: {
        scale: 'time',
        min: start,
        max: start + 14400000,
        label: 'Time',
        padding: 8,
      },
      y: { scale: 'category', categories: ['Alpha', 'Beta', 'Gamma'], label: 'Category' },
    },
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(time_categories)
  // presentation.blank("Time categories").print(time_categories)
```

Set `axis.x.scale` or `axis.y.scale` to choose how data maps to positions.
Plot uses [D3 scales](https://d3js.org/d3-scale) internally.

#### Scale values

| Value | D3 scale | Description |
|---|---|---|
| `'linear'` | `scaleLinear` | Equal differences in value produce equal distances. The default for numeric data. |
| `'log'` | `scaleLog` | Equal ratios produce equal distances. Use for positive values spanning several orders of magnitude. |
| `'category'` | `scaleBand` | Place discrete categories in evenly spaced bands. Inferred from string data. |
| `'time'` | `scaleTime` | Position timestamps on a continuous timeline, with ticks in local time. |
| `'utc'` | `scaleUtc` | Position timestamps on a continuous timeline, with ticks in UTC. |

Both time scales accept Unix timestamps in milliseconds. Use `categories`
to set a category order, or `min` and `max` to set continuous-domain bounds.

When `categories` is omitted, categories follow their first appearance across
the series. An explicit list applies to all series on that axis: unlisted
categories are omitted with a console warning, and listed categories without
data retain empty bands. If a name appears more than once in the `categories`
list, only its first occurrence is used. Providing `categories` implies
`scale: 'category'`. Combining it with a continuous scale reports a configuration error.

### Axis labels

`axis.x.label` and `axis.y.label` name the axes. Set the text directly, or use
an object to configure the text, font styles, and position.

The plots below show axis labels with different sizes and colors, aligned
right and top in one plot and left and bottom in the other.

Right and top labels

```js
const axis_labels = plot({
    series: [
      plot.scatter({
        data: [
          { x: 12, y: 18 },
          { x: 30, y: 42 },
          { x: 48, y: 35 },
          { x: 58, y: 64 },
          { x: 76, y: 58 },
          { x: 88, y: 82 },
        ],
        size: 3,
        color: { light: '#9ca3af', dark: '#6b7280' },
        hoverable: false,
      }),
    ],
    height: 260,
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    zoom_pan: false,
    margin: { top: 44, right: 28, bottom: 62, left: 94 },
    axis: {
      x: {
        min: 0,
        max: 100,
        label: {
          text: 'Time',
          position: 'right',
          font: { size: 18, color: { light: '#713fff', dark: '#c4b5fd' } },
        },
      },
      y: {
        min: 0,
        max: 100,
        label: {
          text: 'Value',
          position: 'top',
          font: { size: 12, color: { light: '#c2410c', dark: '#fdba74' } },
        },
      },
    },
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(axis_labels)
  // presentation.blank("Axis labels").print(axis_labels)
```

Left and bottom labels

```js
const opposite_axis_labels = plot({
    series: [
      plot.scatter({
        data: [
          { x: 12, y: 18 },
          { x: 30, y: 42 },
          { x: 48, y: 35 },
          { x: 58, y: 64 },
          { x: 76, y: 58 },
          { x: 88, y: 82 },
        ],
        size: 3,
        color: { light: '#9ca3af', dark: '#6b7280' },
        hoverable: false,
      }),
    ],
    height: 260,
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    zoom_pan: false,
    margin: { top: 44, right: 28, bottom: 62, left: 94 },
    axis: {
      x: {
        min: 0,
        max: 100,
        label: {
          text: 'Time',
          position: 'left',
          font: { size: 12, color: { light: '#c2410c', dark: '#fdba74' } },
        },
      },
      y: {
        min: 0,
        max: 100,
        label: {
          text: 'Value',
          position: 'bottom',
          font: { size: 20, color: { light: '#713fff', dark: '#c4b5fd' } },
        },
      },
    },
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(opposite_axis_labels)
  // presentation.blank("Opposite axis labels").print(opposite_axis_labels)
```

`LabelArg` accepts a string or this object at `axis.x.label` or `axis.y.label`:

#### LabelArg

| Field | Type | Default | Description |
|---|---|---|---|
| `text` | `string` | Required | Axis label text. |
| `font?` | `string` \| [`FontConfig`](#fontconfig) | [Role defaults](#font-role-defaults) | Font family, size, weight, color, and other text styles. |
| `position?` | `'center' \| 'left' \| 'right' \| 'top' \| 'bottom'` | `'center'` | Use `left` or `right` on x. Use `top` or `bottom` on y. |

### Tick labels

`tick_label` controls the text at each axis tick. Use a formatting callback
to add units or change how values appear, and `font` to style the text.

The plot below adds units to the tick labels and uses purple text on the
horizontal axis and larger orange text on the vertical axis.

```js
const tick_labels = plot({
    series: [
      plot.scatter({
        data: [
          { x: 12, y: 18 },
          { x: 30, y: 42 },
          { x: 48, y: 35 },
          { x: 58, y: 64 },
          { x: 76, y: 58 },
          { x: 88, y: 82 },
        ],
        size: 3,
        color: { light: '#9ca3af', dark: '#6b7280' },
        hoverable: false,
      }),
    ],
    height: 260,
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    zoom_pan: false,
    margin: { top: 44, right: 28, bottom: 62, left: 94 },
    axis: {
      x: {
        min: 0,
        max: 100,
        label: 'Elapsed time',
        tick_label: {
          format: pure((value) => value + ' s'),
          font: { size: 10, color: { light: '#713fff', dark: '#c4b5fd' } },
        },
      },
      y: {
        min: 0,
        max: 100,
        label: 'Utilization',
        tick_label: {
          format: pure((value) => value + '%'),
          font: { size: 15, color: { light: '#c2410c', dark: '#fdba74' } },
        },
      },
    },
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(tick_labels)
  // presentation.blank("Tick labels").print(tick_labels)
```

Use `TickLabelArg` at `axis.x.tick_label` or `axis.y.tick_label`:

#### TickLabelArg

| Field | Type | Default | Description |
|---|---|---|---|
| `format?` | `(value: number \| string, index: number) => string` | Scale-dependent | Format each tick value. Return `''` for an empty label. |
| `font?` | `string` \| [`FontConfig`](#fontconfig) | [Role defaults](#font-role-defaults) | Font family, size, weight, color, and other text styles. |

### Series colors

`color` sets the color of a series. Series that support color accessors can
also choose a color for each data point.

The plot below uses a color accessor to highlight values at or above 60 in
orange and show lower values in gray.

```js
const series_colors = plot({
    height: 260,
    margin: { top: 20, right: 24, bottom: 48, left: 76 },
    axis: { x: { min: 0, max: 100, label: 'Time' }, y: { min: 0, max: 100, label: 'Value' } },
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    zoom_pan: false,
    series: [
      plot.scatter({
        data: [
          { x: 12, y: 18 },
          { x: 30, y: 42 },
          { x: 48, y: 35 },
          { x: 58, y: 64 },
          { x: 76, y: 58 },
          { x: 88, y: 82 },
        ],
        size: 8,
        color: pure((row) =>
          Number(row.y) >= 60
            ? { light: '#c2410c', dark: '#fdba74' }
            : { light: '#64748b', dark: '#94a3b8' },
        ),
        hoverable: false,
      }),
    ],
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(series_colors)
  // presentation.blank("Series colors").print(series_colors)
```

`ColorArg` adds a per-row accessor to [`ThemeColor`](#theme-colors). Scatter, bar, rect, rule,
and custom series accept it; line and area use one `ThemeColor` per series.

#### ColorArg

| Form | Type | Description |
|---|---|---|
| Shared color | [`ThemeColor`](#theme-colors) | Apply one color or theme pair to the series. |
| Accessor | [`(row, index) => ThemeColor`](#theme-colors) | Choose a color or theme pair for each data item. The callback receives the item and its zero-based index. |

```js
const data = [
    { x: 1, value: 6 },
    { x: 2, value: 14 },
    { x: 3, value: 9 },
  ]

  const data_colors = plot({
    height: 280,
    series: [
      plot.scatter({
        data,
        y: 'value',
        color: pure((row) => (row.value >= 10 ? 'coral' : 'steelblue')),
      }),
    ],
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(data_colors)
  // presentation.blank("data colors").print(data_colors)
```

For these series, a valid `color` on a data row takes precedence over the
series color or accessor. Stacked bars also accept a [`ThemeColor[]`](#theme-colors), with
one entry per stacked field.

### Mark shapes

`mark` chooses the shape used for scatter points or point markers on a line.
Use shapes to distinguish groups of data.

The plot below assigns a circle, square, diamond, or triangle to each category.

```js
const marks = ['circle', 'square', 'diamond', 'triangle']

  const mark_shapes = plot({
    height: 260,
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    zoom_pan: false,
    series: marks.map((mark, i) =>
      plot.scatter({
        data: [{ x: mark, y: 40 + i * 10 }],
        mark,
        size: 12,
        color: [
          { light: '#7c3aed', dark: '#c4b5fd' },
          { light: '#db2777', dark: '#f9a8d4' },
          { light: '#0891b2', dark: '#67e8f9' },
          { light: '#ea580c', dark: '#fdba74' },
        ][i],
        hoverable: false,
      }),
    ),
    axis: { x: { categories: [...marks], label: '' }, y: { min: 0, max: 100, label: '' } },
    margin: { top: 20, right: 12, bottom: 32, left: 32 },
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(mark_shapes)
  // presentation.blank("Mark shapes").print(mark_shapes)
```

`MarkShape` controls [`scatter.mark`](./plot/scatter.md#scatter) and [`line.mark`](./plot/line.md#line):

#### MarkShape

| Value | Description |
|---|---|
| `'circle'` | Circular mark. |
| `'square'` | Square mark. |
| `'diamond'` | Diamond mark. |
| `'triangle'` | Triangular mark. |

Scatter defaults to `'circle'`; line draws no marks unless `mark` is set.

### Strokes

`stroke` sets the outline color and width for scatter, area, and rectangle
series. Use `mark_stroke` to outline point markers on a line.

The plot below compares outlines with widths of 1, 3, and 5 pixels on
equal-sized circles.

```js
const series_strokes = plot({
    height: 260,
    margin: { top: 20, right: 24, bottom: 48, left: 76 },
    axis: { x: { min: 0, max: 100, label: 'Time' }, y: { min: 0, max: 100, label: 'Value' } },
    background: { light: '#ffffff', dark: '#202124' },
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    zoom_pan: false,
    series: [1, 3, 5].map((width, i) =>
      plot.scatter({
        data: [{ x: 25 + i * 25, y: 50 }],
        size: 18,
        color: { light: '#f0abfc', dark: '#c026d3' },
        stroke: { color: { light: '#7e22ce', dark: '#f5d0fe' }, width },
        hoverable: false,
      }),
    ),
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(series_strokes)
  // presentation.blank("Series strokes").print(series_strokes)
```

`StrokeArg` accepts a [`ThemeColor`](#theme-colors) or a `Stroke` object. Use it for `stroke`
on scatter, area, and rect series, or `mark_stroke` on a line series.

#### Stroke

| Field | Type | Default | Description |
|---|---|---|---|
| `color` | [`ThemeColor`](#theme-colors) | Required | Outline color or theme pair. |
| `width?` | `number` | Series-dependent | Outline width in pixels. Mark outlines scale with mark size when omitted. |

```js
const stroke = { color: { light: 'navy', dark: 'lightsteelblue' }, width: 1 }

  const outlined_points = plot({
    height: 280,
    series: [
      plot.scatter({
        data: [
          { x: 1, y: 4 },
          { x: 2, y: 9 },
        ],
        size: 16,
        color: 'lightblue',
        stroke,
      }),
    ],
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(outlined_points)
  // presentation.blank("outlined points").print(outlined_points)
```

### Data fields

Data fields such as `x` and `y` tell a series which values to plot. Supply a
property name to read from your data, or an accessor function to compute a value.

The example below reads horizontal values from `elapsed_ms` and converts
`duration_ms` to seconds for the vertical axis.

#### FieldArg

| Form | Type | Description |
|---|---|---|
| Field name | `string` | Read the named property from each row. |
| Accessor | `(row, index) => number \| string` | Compute a value from the data item and its zero-based index. Return numbers for continuous axes or strings for categories. |

```js
const data = [
    { elapsed_ms: 0, duration_ms: 250 },
    { elapsed_ms: 100, duration_ms: 400 },
    { elapsed_ms: 200, duration_ms: 300 },
  ]

  const timing_fields = plot({
    height: 280,
    series: [
      plot.line({
        data,
        x: 'elapsed_ms',
        y: pure((row) => row.duration_ms / 1000),
      }),
    ],
    axis: { x: { label: 'Elapsed (ms)' }, y: { label: 'Duration (s)' } },
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(timing_fields)
  // presentation.blank("timing fields").print(timing_fields)
```

## Web Component

Use `<a-plot>` directly from plain JavaScript or TypeScript. It handles setup,
drawing, and cleanup in the browser. Set `element.plotArgs` to your
[plot configuration object](#plot-arguments).

Import `@antadesign/plot/elements/a-plot` to register `<a-plot>` and the supporting
elements it needs. This import is safe to repeat and can be used during server
rendering.

```ts
import { scatter, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/plot/plot.css'

const plot = document.createElement('a-plot') as APlotElement
plot.plotArgs = { series: [scatter({ data: [{ x: 1, y: 2 }, { x: 2, y: 3 }] })] }
document.body.append(plot)
```

## Styling

Use CSS to style the plot container, and `plotArgs` to configure the colors,
lines, and text drawn inside it. JSX `Plot` fills its container, so give the
container a height. The standalone `<a-plot>` defaults to a height of 300px.

The plot below has a rounded border, padding, and a responsive aspect ratio.
It uses `background: false` so the container's background shows through.

```js
const scatter_plot = plot({
    series: [
      plot.scatter({
        data: [
          { x: 12, y: 18 },
          { x: 30, y: 42 },
          { x: 48, y: 35 },
          { x: 58, y: 64 },
          { x: 76, y: 58 },
          { x: 88, y: 82 },
        ],
        size: 3,
        color: { light: '#9ca3af', dark: '#6b7280' },
        hoverable: false,
      }),
    ],
    margin: { top: 16, right: 16, bottom: 40, left: 60 },
    axis: { x: { min: 0, max: 100, label: 'Time' }, y: { min: 0, max: 100, label: 'Value' } },
    background: false,
    chrome_color: { light: '#9ca3af', dark: '#d1d5db' },
    border: true,
    grid: false,
    zoom_pan: false,
  })

  const styled_plot = h(
    'div',
    {
      style: {
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '460px',
        marginInline: 'auto',
        padding: '16px',
        border: '1px solid #9ca3af',
        borderRadius: '16px',
        background: 'color-mix(in oklch, #9ca3af 12%, transparent)',
      },
    },
    h('div', { style: { width: '100%', aspectRatio: '4 / 3' } }, scatter_plot),
  )

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(styled_plot)
  // presentation.blank("Styled plot").print(styled_plot)
```

```css
.plot-card {
  box-sizing: border-box;
  width: 100%;
  max-width: 460px;
  margin-inline: auto;
  padding: 16px;
  border: 1px solid #9ca3af;
  border-radius: 16px;
  background: rgb(156 163 175 / 12%);
}

.styled-plot {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 4 / 3;
}
```

Use `className` or `style` for a JSX plot's container, or CSS classes for `<a-plot>`.
You can also set `width` and `height` in `plotArgs` for explicit dimensions.

Configure the drawing through these options:

- `chrome_color` sets axis lines, tick marks, grid lines, and the plot border.
- `background` sets the plot fill, and each series' `color` sets its marks.
- `font.color` sets text colors, with overrides for titles, axis labels, and tick labels.

Colors accept [theme colors](#theme-colors) for light and dark modes.
For content security policy requirements, see
[Styles and content security policy](#styles-and-content-security-policy).
