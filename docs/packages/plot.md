# Plot

A canvas-based plotting library for React, Preact, and plain JavaScript.
Compose plots using built-in and custom [series](#series), with configurable [axes](#axes), [scales](#scales), and [styles](#styling).
Explore your data through [tooltip](#tooltips), [selection](#selection-callbacks), and [zoom](#zoom-and-pan) interactions.

```sh
npm install @antadesign/plot   # pulls @antadesign/anta; React 18 or 19 is a peer
```

## React playground

Hover over a point to see its tooltip. Scroll to zoom, click and drag to pan,
then use the reset control to restore the view.

This playground uses Preact’s React compatibility layer, like the other Anta demos. Edit the data or plot options to try an update.

## Props

`Plot` takes one complete configuration object and ordinary div attributes.

| Prop | Type | Default | Description |
|---|---|---|---|
| [`plotArgs`](#plot-arguments) | `PlotArgs<ReactNode>` | Required | The whole plot: series, axes, and presentation. Replace the object to apply a change; in-place mutation is not observed. |
| `onError?` | `(failure: ReactPlotError) => void` | `console.warn` | Receives registration, configuration, composition, and drawing failures. Defaults to `console.warn`. |

Inherited props (`className`, `style`, `aria-label`, and the rest of
`HTMLAttributes<HTMLDivElement>` except `children`).

Tooltip content is a `ReactNode` rendered through a portal, so it keeps
React ownership and context.

## Plot arguments

`PlotArgs` is the single object every host accepts.

| Field | Type | Default | Description |
|---|---|---|---|
| [`series`](#series) | `Series[]` | Required | What to draw, in paint order. Build each one with a factory. |
| [`axis?`](#axes) | `{ x?: AxisArgs, y?: AxisArgs }` | Inferred from data | Per-axis scale, label, ticks, and domain. |
| [`title?`](#title) | `string \| { text, size?, color? }` | None | Plot title. |
| `width?` | `number` | Container width | Canvas width in pixels. Overrides the wrapper's CSS width. |
| `height?` | `number` | `300` in React and standalone hosts | Canvas height in pixels. Overrides the wrapper's CSS height (default `300`). |
| [`margin?`](#margins) | `number \| { top?, right?, bottom?, left? }` | `60` per side; `2` without axes or title | Space reserved around the plot area for axes and title. |
| `border?` | `boolean` | `true` | Draws a border around the plot area. |
| [`grid?`](#grid) | `boolean \| { x?, y? }` | `false` | Grid lines, per axis. |
| [`chrome_color?`](#theme-colors) | `string \| { light, dark }` | Theme defaults | Color for axis lines, tick marks, grid lines, and the plot border. Text colors are configured separately. |
| [`background?`](#theme-colors) | `boolean \| string \| { light, dark }` | White | Plot fill. `false` paints none; `true` and an absent value use `#fff`. |
| [`theme_invert?`](#theme-colors) | `boolean` | Automatic | Forces dark-mode inversion on or off. Absent means invert unless a series color or the background is a `{ light, dark }` pair. |
| [`zoom_pan?`](#zoom-and-pan) | `boolean \| { x?, y?, modifier? }` | Both axes, Ctrl required | Zoom and pan, on both axes and Ctrl-gated by default. `modifier: false` zooms on a bare wheel; opting both axes out is the same as `false`. |
| [`viewport?`](#viewport) | `{ x?, y?, key? }` | Full domain | Requested starting window per axis. Applied at mount and on each `key` change, clamped to the full domain. |
| [`on_viewport_change?`](#viewport-changes) | `(change: ViewportChange) => void` | None | Fires with each axis's current window and full extent after a gesture or reset. |

A zoomed plot shows a **Reset zoom** button in the plot area; it
disappears once the view is back to its full extent.

### Axes

`axis.x` and `axis.y` both accept `AxisArgs`. Configure them independently;
fields you omit are inferred from the series or use the defaults below.
[`ThemeColor`](#theme-colors) accepts a CSS color string or a `{ light, dark }` pair.

| Field | Type | Default | Description |
|---|---|---|---|
| [`scale?`](#scales) | `'linear' \| 'log' \| 'category' \| 'time' \| 'utc'` | Inferred | Numeric data uses a linear scale; string data uses categories. Time scales take timestamps in milliseconds; `time` formats in local time and `utc` in UTC. |
| [`label?`](#axis-labels) | `LabelArg` | Shared field name, if available | Axis name, as text or an object with presentation options. Use `''` to omit it. |
| `min?` | `number` | Inferred from data | Lower continuous-domain bound. |
| `max?` | `number` | Inferred from data | Upper continuous-domain bound. |
| `categories?` | `string[]` | Inferred from data | Explicit category list and order; also declares a categorical axis. |
| `padding?` | `number` | `0` | Pixel padding at both ends of the axis, inside the plot area. |
| `padding_left?` | `number` | `padding` | Left-end padding for `axis.x`. |
| `padding_right?` | `number` | `padding` | Right-end padding for `axis.x`. |
| `padding_top?` | `number` | `padding` | Top-end padding for `axis.y`. |
| `padding_bottom?` | `number` | `padding` | Bottom-end padding for `axis.y`. |
| `grid_align?` | `'center' \| 'edge'` | `'center'` | Position grid lines at category centers or boundaries. Categorical axes only. |
| `line?` | `boolean` | `true` | Draw the axis line. |
| `hidden?` | `boolean` | `false` | Hide the axis presentation while retaining its scale. |
| [`tick_label?`](#tick-labels) | `TickLabelArg` | Automatic formatting | Tick text formatting, size, and color. |
| `tick_mark?` | `boolean` | `true` | Draw tick marks. Does not hide tick labels. |

## Series

A series describes a set of data and how to draw it. Pass one or more series
in `plotArgs.series`; they are drawn in array order. Import the series
functions from `@antadesign/plot`.

Defaults below describe omitted fields, not the values chosen in the examples.
[`FieldArg`](#data-fields) is a field name or `(row, index) => number | string` accessor.
[`ThemeColor`](#theme-colors) is a CSS color string or `{ light, dark }` pair; [`ColorArg`](#series-colors)
also accepts a per-row accessor. [`StrokeArg`](#strokes) is a color or `{ color, width }`.
[`TooltipArg`](#tooltips) is `true` or a callback returning tooltip content, and [`SelectFn`](#selection-callbacks)
receives the selected point. In React, custom tooltip content is a `ReactNode`.
[`MarkShape`](#mark-shapes) is `'circle'`, `'square'`, `'diamond'`, or `'triangle'`.

### Scatter

Draw a mark at each data point. Use `size`, [`mark`](#mark-shapes), and [`stroke`](#strokes) to control
its appearance. Set `tooltip: true` for a tooltip showing the point's values.

| Field | Type | Default | Description |
|---|---|---|---|
| `data` | `Record<string, unknown>[]` | Required | Rows used to build the series. |
| `x?` | [`FieldArg`](#data-fields) | `'x'` | Horizontal field name or accessor. |
| `y?` | [`FieldArg`](#data-fields) | `'y'` | Vertical field name or accessor. |
| `color?` | [`ColorArg`](#series-colors) | Black | Series color; theme pairs provide separate light and dark colors. |
| `size?` | `number \| ((row, index) => number)` | `5` | Mark diameter in pixels, or a per-row accessor. A row’s `size` takes precedence. |
| [`mark?`](#mark-shapes) | `MarkShape` | `'circle'` | Mark shape: circle, square, diamond, or triangle. |
| [`stroke?`](#strokes) | `StrokeArg` | None | Outline color and optional width. |
| [`tooltip?`](#tooltips) | `TooltipArg` | None | Use `true` for the default tooltip, or a callback for custom content. |
| [`on_select?`](#selection-callbacks) | `SelectFn` | None | Callback receiving the selected point and its source row. |
| `hoverable?` | `boolean` | `true` | Allow the series to participate in hit testing. |
| `highlight?` | `boolean` | `true` | Draw hover feedback for a hit point. |

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

### Line

Connect points in data order. Set `width` and `dash` for the line, or add
[`mark`](#mark-shapes) and `mark_size` to show the individual points.

| Field | Type | Default | Description |
|---|---|---|---|
| `data` | `Record<string, unknown>[]` | Required | Rows used to build the series. |
| `x?` | [`FieldArg`](#data-fields) | `'x'` | Horizontal field name or accessor. |
| `y?` | [`FieldArg`](#data-fields) | `'y'` | Vertical field name or accessor. |
| `color?` | [`ThemeColor`](#theme-colors) | Black | Series color; theme pairs provide separate light and dark colors. |
| `width?` | `number` | `2` | Line width in pixels. |
| `dash?` | `number[]` | Solid | Alternating dash and gap lengths in pixels. |
| [`mark?`](#mark-shapes) | `MarkShape` | None | Shape drawn at each point. |
| `mark_size?` | `number` | `6` | Point marker diameter in pixels. |
| [`mark_stroke?`](#strokes) | `StrokeArg` | None | Outline for the point markers. |
| [`tooltip?`](#tooltips) | `TooltipArg` | None | Use `true` for the default tooltip, or a callback for custom content. |
| [`on_select?`](#selection-callbacks) | `SelectFn` | None | Callback receiving the selected point and its source row. |
| `hoverable?` | `boolean` | `true` | Allow the series to participate in hit testing. |
| `highlight?` | `boolean` | `true` | Draw hover feedback for a hit point. |

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

### Bar

Draw one bar per category. Use a categorical field on one axis and a numeric
field on the other. Categories on `x` produce vertical bars; categories on
`y` produce horizontal bars.

| Field | Type | Default | Description |
|---|---|---|---|
| `data` | `Record<string, unknown>[]` | Required | Rows used to build the series. |
| `x?` | [`FieldArg \| string[]`](#data-fields) | `'x'` | Category or value field. An array of value fields creates horizontal stacks. |
| `y?` | [`FieldArg \| string[]`](#data-fields) | `'y'` | Category or value field. An array of value fields creates vertical stacks. |
| `color?` | [`ColorArg`](#series-colors)` \| ``ThemeColor``[]` | Black | Uniform or per-row color; a color array maps to stacked fields in order. |
| `border_radius?` | `number` | `0` | Bar corner radius in pixels. |
| `inset?` | `number` | One sixth of band width | Inset on each side of a categorical band, in pixels. |
| `min_size?` | `number` | `2` | Minimum rendered value length in pixels. |
| `hover_span_x?` | `boolean` | `false` | Extend the horizontal hit region across the categorical band. |
| `hover_span_y?` | `boolean` | `false` | Extend the vertical hit region across the categorical band. |
| [`tooltip?`](#tooltips) | `TooltipArg` | None | Use `true` for the default tooltip, or a callback for custom content. |
| [`on_select?`](#selection-callbacks) | `SelectFn` | None | Callback receiving the selected point and its source row. |
| `hoverable?` | `boolean` | `true` | Allow the series to participate in hit testing. |
| `highlight?` | `boolean` | `true` | Draw hover feedback for a hit point. |

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

#### Stacked bars

Pass an array of value-field names to stack them within each category.
Use `y` for vertical stacks or `x` for horizontal stacks. An array of
colors assigns one color to each field, in the same order.

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

### Area

Fill the space between two boundaries. Set `y2` for a second vertical value
or `x2` for a second horizontal value. The second boundary can be a field
name or a constant, such as a zero baseline.

| Field | Type | Default | Description |
|---|---|---|---|
| `data` | `Record<string, unknown>[]` | Required | Rows used to build the series. |
| `x?` | [`FieldArg`](#data-fields) | `'x'` | Horizontal field name or accessor. |
| `x2?` | [`FieldArg \| number`](#data-fields) | None | Second horizontal boundary, as a field, accessor, or constant. Use either `x2` or `y2`. |
| `y?` | [`FieldArg`](#data-fields) | `'y'` | Vertical field name or accessor. |
| `y2?` | [`FieldArg \| number`](#data-fields) | Zero baseline if neither bound is set | Second vertical boundary, as a field, accessor, or constant. |
| `color?` | [`ThemeColor`](#theme-colors) | Black | Series color; theme pairs provide separate light and dark colors. |
| [`stroke?`](#strokes) | `StrokeArg` | None | Outline color and optional width. |
| `dash?` | `number[]` | Solid | Alternating dash and gap lengths in pixels. |
| [`tooltip?`](#tooltips) | `TooltipArg` | None | Use `true` for the default tooltip, or a callback for custom content. |
| [`on_select?`](#selection-callbacks) | `SelectFn` | None | Callback receiving the selected point and its source row. |
| `hoverable?` | `boolean` | `true` | Allow the series to participate in hit testing. |
| `highlight?` | `boolean` | `true` | Draw hover feedback for a hit point. |

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

### Rect

Draw rectangles with explicit bounds. Use `x`, `x2`, `y`, and `y2` to select
the fields defining each rectangle's corners. Rectangles can represent
intervals, regions, or cells in a grid.

| Field | Type | Default | Description |
|---|---|---|---|
| `data` | `Record<string, unknown>[]` | Required | Rows used to build the series. |
| `x?` | [`FieldArg`](#data-fields) | `'x'` | Horizontal field name or accessor. |
| `x2?` | [`FieldArg`](#data-fields) | `'x2'` when present in data | Opposite horizontal corner. Numeric axes need a second corner or pixel size. |
| `y?` | [`FieldArg`](#data-fields) | `'y'` | Vertical field name or accessor. |
| `y2?` | [`FieldArg`](#data-fields) | `'y2'` when present in data | Opposite vertical corner. Numeric axes need a second corner or pixel size. |
| `span?` | `'x' \| 'y'` | None | Stretch the rectangle across the full plot on this axis. |
| `size?` | `number \| { width?: number; height?: number }` | Derived from bounds or band | Fixed pixel size, shared or per dimension. |
| `band_align?` | `'center' \| 'start' \| 'end'` | `'center'` | Alignment of a fixed-size rectangle within a categorical band. |
| `hover_span_x?` | `boolean` | `false` | Extend the horizontal hit region across the categorical band. |
| `hover_span_y?` | `boolean` | `false` | Extend the vertical hit region across the categorical band. |
| `inset?` | `number` | One sixth of band width | Inset on each side of a categorical band, in pixels. |
| `min_size?` | `number` | `0` | Minimum pixel length for a rectangle defined by data bounds. |
| `offset?` | `{ x?: number; y?: number }` | `{ x: 0, y: 0 }` | Pixel offsets applied to each rectangle. |
| `color?` | [`ColorArg`](#series-colors) | Black | Series color; theme pairs provide separate light and dark colors. |
| [`stroke?`](#strokes) | `StrokeArg` | None | Outline color and optional width. |
| [`tooltip?`](#tooltips) | `TooltipArg` | None | Use `true` for the default tooltip, or a callback for custom content. |
| [`on_select?`](#selection-callbacks) | `SelectFn` | None | Callback receiving the selected point and its source row. |
| `hoverable?` | `boolean` | `true` | Allow the series to participate in hit testing. |
| `highlight?` | `boolean` | `true` | Draw hover feedback for a hit point. |

```ts
import { rect } from '@antadesign/plot'

const series = [rect({
  data: [
    { start: 1, end: 3, low: 2, high: 5 },
    { start: 4, end: 6, low: 1, high: 4 },
  ],
  x: 'start',
  x2: 'end',
  y: 'low',
  y2: 'high',
  min_size: 2,
  offset: { x: 0, y: 0 },
  color: 'lightsteelblue',
  stroke: { color: 'steelblue', width: 1 },
  tooltip: ({ x, y }) => `(${x}, ${y})`,
  on_select: ({ row }) => console.log('Selected row:', row),
  hoverable: true,
  highlight: true,
})]
```
For fixed-size marks in categorical bands, use `size` and `band_align`.
`inset` controls the space around a band when its size is not fixed:

```ts
import { rect } from '@antadesign/plot'

const series = [rect({
  data: [{ group: 'A', row: 'First' }, { group: 'B', row: 'Second' }],
  x: 'group',
  y: 'row',
  size: { width: 12 },
  band_align: 'start',
  inset: 4,
  offset: { x: 2, y: 0 },
  hover_span_x: true,
  hover_span_y: true,
  color: 'steelblue',
  tooltip: true,
})]
```

Use `span` to fill one axis, leaving its coordinates unspecified. Add this
series before the data series to draw a background region:

```ts
import { rect } from '@antadesign/plot'

const series = [rect({
  data: [{ low: 2, high: 5 }],
  span: 'x',
  y: 'low',
  y2: 'high',
  color: 'aliceblue',
  hoverable: false,
  highlight: false,
})]
```

### Rule

Draw a reference line across the plot. Supply `x` for a vertical line or
`y` for a horizontal line. A single rule needs no data array; add it to the
same series array as the data it annotates.

| Field | Type | Default | Description |
|---|---|---|---|
| `data?` | `Record<string, unknown>[]` | None | Optional rows for multiple reference lines. |
| `x?` | [`number \| FieldArg`](#data-fields) | None | Vertical rule position, or a field/accessor when `data` is supplied. Set exactly one of `x` and `y`. |
| `y?` | [`number \| FieldArg`](#data-fields) | None | Horizontal rule position, or a field/accessor when `data` is supplied. |
| `color?` | [`ColorArg`](#series-colors) | Black | Series color; theme pairs provide separate light and dark colors. |
| `width?` | `number` | `1` | Rule width in pixels. |
| `dash?` | `number[]` | Solid | Alternating dash and gap lengths in pixels. |
| [`tooltip?`](#tooltips) | `TooltipArg` | None | Use `true` for the default tooltip, or a callback for custom content. |
| [`on_select?`](#selection-callbacks) | `SelectFn` | None | Callback receiving the selected point and its source row. |
| `hoverable?` | `boolean` | `true` | Allow the series to participate in hit testing. |
| `highlight?` | `boolean` | `true` | Draw hover feedback for a hit point. |

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

### Custom

Provide a [`renderer`](#custom-rendering) to draw directly on the canvas. Its second argument
includes the canvas context, plot bounds, scales, and helpers that convert
data positions into pixel coordinates.

| Field | Type | Default | Description |
|---|---|---|---|
| `data?` | `Record<string, unknown>[]` | None | Optional rows; required when using field selectors or hit testing. |
| `x?` | [`FieldArg`](#data-fields) | Unclaimed | Horizontal field or accessor; omitted axes do not contribute data bounds. |
| `y?` | [`FieldArg`](#data-fields) | Unclaimed | Vertical field or accessor; omitted axes do not contribute data bounds. |
| [`renderer`](#custom-rendering) | `CustomRendererFn` | Required | Draw the series using its data and the supplied canvas context and pixel resolvers. |
| [`hit_test?`](#custom-hit-testing) | `CustomHitTestFn` | None | Return a row index for a hit, or `null`. Required for custom tooltips and selection. |
| `color?` | [`ColorArg`](#series-colors) | Black | Color made available to the renderer, including optional per-row colors. |
| `axis_range?` | `{ x?: number[]; y?: number[] }` | Data extent | Explicit `[low, high]` bounds for either axis. |
| [`tooltip?`](#tooltips) | `TooltipArg` | None | Use `true` for the default tooltip, or a callback for custom content. |
| [`on_select?`](#selection-callbacks) | `SelectFn` | None | Callback receiving the selected point and its source row. |
| `hoverable?` | `boolean` | `true` | Allow the series to participate in hit testing. |

This example draws a cross at each point and finds the nearest cross within
eight pixels for tooltips and selection:

```ts
import { custom } from '@antadesign/plot'

const series = [custom({
  data: [{ x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 4 }],
  x: 'x',
  y: 'y',
  color: { light: 'steelblue', dark: 'lightskyblue' },
  axis_range: { x: [0, 4], y: [0, 6] },
  renderer: (series, { ctx, resolve_x, resolve_y, color_at }) => {
    ctx.save()
    ctx.lineWidth = 2
    for (let i = 0; i < series.x.length; i++) {
      const x = resolve_x(i)
      const y = resolve_y(i)
      if (x === undefined || y === undefined) continue
      ctx.strokeStyle = color_at(i)
      ctx.beginPath()
      ctx.moveTo(x - 4, y)
      ctx.lineTo(x + 4, y)
      ctx.moveTo(x, y - 4)
      ctx.lineTo(x, y + 4)
      ctx.stroke()
    }
    ctx.restore()
  },
  hit_test: (series, { cursor, resolve_x, resolve_y }) => {
    let nearest: number | null = null
    let distance = 8
    for (let i = 0; i < series.x.length; i++) {
      const x = resolve_x(i)
      const y = resolve_y(i)
      if (x === undefined || y === undefined) continue
      const candidate = Math.hypot(cursor.x - x, cursor.y - y)
      if (candidate <= distance) {
        nearest = i
        distance = candidate
      }
    }
    return nearest
  },
  tooltip: ({ x, y }) => `(${x}, ${y})`,
  on_select: ({ row }) => console.log('Selected row:', row),
  hoverable: true,
})]
```

For tooltips or selection, also provide `data` and a [`hit_test`](#custom-hit-testing) that returns
the matching row index, or `null` when there is no hit. Use `axis_range`
to declare bounds when they cannot be inferred from the data.

## Configuration details

### Title

`title` accepts a string or a `TitleArg` object:

| Field | Type | Default | Description |
|---|---|---|---|
| `text` | `string` | Required | Plot title text. |
| `size?` | `number` | `14` | Font size in pixels. |
| `color?` | [`ThemeColor`](#theme-colors) | Theme default | Title color. |

### Margins

`margin` accepts one number for all sides or a `SideMargins` object.
Margins reserve space outside the plot area for labels and the title;
axis padding adds space inside it.

| Field | Type | Default | Description |
|---|---|---|---|
| `top?` | `number` | `60` | Top margin in pixels. |
| `right?` | `number` | `60` | Right margin in pixels. |
| `bottom?` | `number` | `60` | Bottom margin in pixels. |
| `left?` | `number` | `60` | Left margin in pixels. |

When both axes are hidden and there is no title, omitted margins use `2`
pixels instead. Explicit margins still apply.

### Grid

`grid` accepts a boolean for both axes or this `GridSpec` object:

| Field | Type | Default | Description |
|---|---|---|---|
| `x?` | `boolean` | `false` | Draw vertical grid lines at x-axis ticks. |
| `y?` | `boolean` | `false` | Draw horizontal grid lines at y-axis ticks. |

### Theme colors

`ThemeColor` accepts a CSS color string or a `ColorPair`. Use a pair to choose
separate colors for light and dark themes.

| Form | Type | Example |
|---|---|---|
| One color | `string` | `'steelblue'`, `'#4682b4'`, `'rgb(70, 130, 180)'`, `'hsl(207, 44%, 49%)'` |
| Theme pair | `{ light: string; dark: string }` | `{ light: 'steelblue', dark: 'lightskyblue' }` |

Both fields in a `ColorPair` are required. `ColorTheme` is `'light'` or `'dark'`.
Plain colors remain subject to the plot's `theme_invert` setting.

### Zoom and pan

`zoom_pan` accepts a boolean for both axes or this `ZoomPanArg` object:

| Field | Type | Default | Description |
|---|---|---|---|
| `x?` | `boolean` | `true` | Enable horizontal zoom and pan on a continuous axis. |
| `y?` | `boolean` | `true` | Enable vertical zoom and pan on a continuous axis. |
| `modifier?` | `boolean` | `true` | Require Ctrl for gestures. Set `false` to allow gestures without a modifier. |

Setting both axes to `false` disables zoom and pan. Categorical axes do not zoom.

### Viewport

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

#### Viewport changes

`on_viewport_change` receives a `ViewportChange` after a gesture or reset:

| Field | Type | Description |
|---|---|---|
| `x` | `AxisViewport \| null` | Current horizontal viewport, or `null` for a categorical axis. |
| `y` | `AxisViewport \| null` | Current vertical viewport, or `null` for a categorical axis. |

Each `AxisViewport` contains:

| Field | Type | Description |
|---|---|---|
| `window` | `number[]` | Current visible `[min, max]`. |
| `full` | `number[]` | Full unzoomed `[min, max]`. |

### Scales

Set `axis.x.scale` or `axis.y.scale` to choose how data maps to positions.
Plot uses [D3 scales](https://d3js.org/d3-scale) internally.

| Value | D3 scale | Description |
|---|---|---|
| `'linear'` | `scaleLinear` | Equal differences in value produce equal distances. The default for numeric data. |
| `'log'` | `scaleLog` | Equal ratios produce equal distances. Use for positive values spanning several orders of magnitude. |
| `'category'` | `scaleBand` | Place discrete categories in evenly spaced bands. Inferred from string data. |
| `'time'` | `scaleTime` | Position timestamps on a continuous timeline, with ticks in local time. |
| `'utc'` | `scaleUtc` | Position timestamps on a continuous timeline, with ticks in UTC. |

Both time scales accept Unix timestamps in milliseconds. Use `categories`
to set a category order, or `min` and `max` to set continuous-domain bounds.

### Axis labels

`LabelArg` accepts a string or this object at `axis.x.label` or `axis.y.label`:

| Field | Type | Default | Description |
|---|---|---|---|
| `text` | `string` | Required | Axis label text. |
| `size?` | `number` | `12` | Font size in pixels. |
| `color?` | [`ThemeColor`](#theme-colors) | Theme default | Label color. |
| `position?` | `'center' \| 'left' \| 'right' \| 'top' \| 'bottom'` | `'center'` | Use `left` or `right` on x; `top` or `bottom` on y. |

### Tick labels

Use `TickLabelArg` at `axis.x.tick_label` or `axis.y.tick_label`:

| Field | Type | Default | Description |
|---|---|---|---|
| `format?` | `(value: number \| string, index: number) => string` | Scale-dependent | Format each tick value. Return `''` for an empty label. |
| `size?` | `number` | `10` | Font size in pixels. |
| `color?` | [`ThemeColor`](#theme-colors) | Theme default | Tick label color. |

### Data fields

`FieldArg` selects a value from each data row. Use it for series coordinates
such as `x` and `y`, or for a second boundary where the series supports one.

| Form | Type | Description |
|---|---|---|
| Field name | `string` | Read the named property from each row. |
| Accessor | `(row: Record<string, unknown>, index: number) => number \| string` | Compute a value from the row and its zero-based index. Return numbers for continuous axes or strings for categories. |

```ts
import type { FieldArg } from '@antadesign/plot'

const x: FieldArg = 'elapsed_ms'
const y: FieldArg = (row) => Number(row.duration_ms) / 1000
```

### Series colors

`ColorArg` adds a per-row accessor to [`ThemeColor`](#theme-colors). Scatter, bar, rect, rule,
and custom series accept it; line and area use one `ThemeColor` per series.

| Form | Type | Description |
|---|---|---|
| Shared color | [`ThemeColor`](#theme-colors) | Apply one color or theme pair to the series. |
| Accessor | [`(row: Record<string, unknown>, index: number) => ThemeColor`](#theme-colors) | Choose a color or theme pair for each row. |

```ts
import type { ColorArg } from '@antadesign/plot'

const color: ColorArg = (row) => Number(row.value) >= 10 ? 'coral' : 'steelblue'
```

For these series, a valid `color` on a data row takes precedence over the
series color or accessor. Stacked bars also accept a [`ThemeColor[]`](#theme-colors), with
one entry per stacked field.

### Mark shapes

`MarkShape` controls [`scatter.mark`](#scatter) and [`line.mark`](#line):

| Value | Description |
|---|---|
| `'circle'` | Circular mark. |
| `'square'` | Square mark. |
| `'diamond'` | Diamond mark. |
| `'triangle'` | Triangular mark. |

Scatter defaults to `'circle'`; line draws no marks unless `mark` is set.

### Strokes

`StrokeArg` accepts a [`ThemeColor`](#theme-colors) or a `Stroke` object. Use it for `stroke`
on scatter, area, and rect series, or `mark_stroke` on a line series.

| Field | Type | Default | Description |
|---|---|---|---|
| `color` | [`ThemeColor`](#theme-colors) | Required | Outline color or theme pair. |
| `width?` | `number` | Series-dependent | Outline width in pixels. Mark outlines scale with mark size when omitted. |

```ts
import type { StrokeArg } from '@antadesign/plot'

const stroke: StrokeArg = {
  color: { light: 'navy', dark: 'lightsteelblue' },
  width: 1,
}
```

### Tooltips

`TooltipArg<Row, TooltipContent>` accepts `true` or a `TooltipFn` callback.
Omit `tooltip` to show no tooltip for that series.

| Form | Type | Description |
|---|---|---|
| Default tooltip | `true` | Show the point's axis values using the host's default presentation. |
| Custom tooltip | [`(data: TooltipData<Row>) => TooltipContent`](#point-data) | Return content for the hovered point. |

With the React component, `TooltipContent` is a `ReactNode`, including strings
and JSX. With the standalone browser host, return a DOM `Node`. The core
leaves the content type to the host.

### Selection callbacks

`SelectFn<Row>` is [`(data: TooltipData<Row>) => unknown`](#point-data). Assign it to
`on_select` to respond when a point is selected. Its return value is ignored.

```ts
import type { SelectFn } from '@antadesign/plot'

const on_select: SelectFn = ({ x, y, row }) => {
  console.log('Selected point:', x, y, row)
}
```

#### Point data

Tooltip and selection callbacks receive the same `TooltipData<Row>` shape:

| Field | Type | Description |
|---|---|---|
| `x` | `number \| string` | Point's x value, or category label. |
| `y` | `number \| string` | Point's y value, or category label. |
| `row` | `Row` | Source data row. May be `undefined` for rule or custom series without data. |
| `label?` | `string` | Point label when available, such as the field name of a stacked bar segment. |

`Row` defaults to `Record<string, unknown>`. The related `PointData` type has
the same fields with an optional `row`.

### Custom rendering

`CustomRendererFn<TooltipContent>` receives the composed custom series and
its drawing context:

```ts
import type { ComposedCustom, CustomRenderContext } from '@antadesign/plot'

type Renderer = (series: ComposedCustom, context: CustomRenderContext) => void
```

The composed series contains resolved `x` and `y` columns, source `rows` when
provided, and theme-resolved colors. Category coordinates are stored as
indices; use the pixel resolvers to place them on the canvas.

| Context field | Type | Description |
|---|---|---|
| `ctx` | `CanvasContext` | Main-thread or offscreen 2D canvas context. |
| `inner` | `Rect` | Plot bounds in pixels: `left`, `right`, `top`, and `bottom`. |
| `x_scale` | `Scale` | Composed horizontal D3 scale. |
| `y_scale` | `Scale` | Composed vertical D3 scale. |
| `color` | `string` | Resolved fallback series color. |
| `x_categories?` | `string[]` | Horizontal category labels, when categorical. |
| `y_categories?` | `string[]` | Vertical category labels, when categorical. |
| `resolve_x` | `PixelResolver` | Resolve a row index to its x position in pixels. |
| `resolve_y` | `PixelResolver` | Resolve a row index to its y position in pixels. |
| `color_at` | `ColorResolver` | Resolve a row index to its color, including the series fallback. |

`PixelResolver` is `(index: number) => number | undefined`; skip points whose
position is `undefined`. `ColorResolver` is `(index: number) => string`.
`CanvasContext` is `CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D`.
`Scale` is a D3 linear, logarithmic, band, or time scale.

### Custom hit testing

`CustomHitTestFn<TooltipContent>` receives the composed custom series and a
`HitContext`. Return the matching row index or `null` when there is no hit.
Custom series need this callback for tooltips and selection.

```ts
import type { ComposedCustom, HitContext } from '@antadesign/plot'

type HitTest = (series: ComposedCustom, context: HitContext) => number | null
```

| Context field | Type | Description |
|---|---|---|
| `cursor` | `{ x: number; y: number }` | Pointer position in the same pixel coordinates as the resolvers. |
| `inner` | [`Rect`](#custom-rendering) | Plot bounds in pixels. |
| `x_scale` | [`Scale`](#custom-rendering) | Composed horizontal scale. |
| `y_scale` | [`Scale`](#custom-rendering) | Composed vertical scale. |
| `resolve_x` | [`PixelResolver`](#custom-rendering) | Resolve a row index to its x position. |
| `resolve_y` | [`PixelResolver`](#custom-rendering) | Resolve a row index to its y position. |

## Entry points

The entries divide on one question: whether the plot's lifecycle —
composition, drawing, viewport, tooltips — belongs to the package or to
the host. `Plot` and `<a-plot>` own it. The bare surface hands it over.

Start here, and read the framework-free core as the layer both levels sit on.

| Import | Contents |
|---|---|
| `@antadesign/plot` | Series factories, `PlotController`, `PlotInteractionController`, presentation helpers, `create_anta_host`, and every public type. Loads neither Anta nor React at runtime, so it is safe to import on a server. |
| `@antadesign/plot/plot.css` | The layout stylesheet. Required by every host. |

### The package owns the lifecycle

Give one host a complete [`plotArgs`](#plot-arguments) and it draws, hovers, zooms, and
renders the reset control on its own.

| Import | Contents |
|---|---|
| `@antadesign/plot/react` | The React `Plot` component, `PlotProps`, and `ReactPlotError`. Mounts `<a-plot>` after commit and keeps tooltip nodes under React ownership. React is a peer. |
| `@antadesign/plot/browser` | `definePlotElement()` for explicit registration, plus the same seven factories typed for DOM `Node` tooltips instead of a framework's nodes. |
| `@antadesign/plot/auto` | The same registration as a side effect, with a `plotElementReady` promise. Browser only. |

`definePlotElement()` registers `a-plot` together with everything under
it, so these three need no separate element import.

### The host owns the lifecycle

Drive `PlotController` yourself and use the surface for canvas stacking,
measurement, pointer capture, and the overlay. This is what Antithesis's
notebook does, and the only level that exposes worker canvas ownership.

| Import | Contents |
|---|---|
| `@antadesign/plot/components` | The `PlotSurface` JSX wrapper over `<a-plot-surface>` and its props. Maps attributes and surface events, nothing more: no controller, no DOM access, no registration. Its types come from Anta's JSX runtime, not React, so it works in React, Preact, or a custom Anta runtime. |
| `@antadesign/plot/elements` | Registers `a-plot-surface` and its Anta dependencies on import, and exports `plotSurfaceElementReady`. No `a-plot`, no tooltip element. |

These two are a pair: `/components` renders the element and `/elements`
is what defines it. Import `/elements` once at the app entry.

## Web Component

`<a-plot>` is a light-DOM custom element that takes the same arguments
as a property. Use it when the host is not React.

```ts
import { scatter, definePlotElement, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/plot.css'

await definePlotElement()
const plot = document.createElement('a-plot') as APlotElement
plot.plotArgs = { series: [scatter({ data: [{ x: 1, y: 2 }, { x: 2, y: 3 }] })] }
document.body.append(plot)
```

[`plotArgs`](#plot-arguments) is a property, not an attribute — assign the object rather
than serializing it. Registration is explicit so the import stays safe
during server rendering; `@antadesign/plot/auto` registers on import
instead.

## Styling

Everything inside the plot area is painted on canvas, so its appearance
comes from [`plotArgs`](#plot-arguments) rather than CSS: [`chrome_color`](#theme-colors) for axis lines, tick marks,
grid lines, and the plot border, `background` for the fill, and each series' own `color`.
Both take `{ light, dark }` pairs when a plot owns its theming; a plain
string stays subject to dark-mode inversion.

Set text colors separately with `title.color`, `axis.x.label.color` or
`axis.y.label.color`, and `axis.x.tick_label.color` or `axis.y.tick_label.color`.

`plot.css` is required, and it owns layout only: element display, canvas
stacking, and the overlay positions. A plot fills its container's width,
and falls back to `300px` tall rather than following the container's
height, because a canvas host inside a container with no definite height
measures zero. `300px` is a fallback, not a minimum.

Two ways to change that. CSS on the element wins outright, since the
package rule sits in `:where()` and carries no specificity:

```css
.dashboard-chart {
  width: 100%;
  max-width: 640px;
  aspect-ratio: 16 / 9;
}
```

```tsx
<Plot plotArgs={plotArgs} className="dashboard-chart" />
```

Or pass `width` / `height`, which land as inline styles on the host and
override the stylesheet. The previous inline value is saved and restored,
so dropping an argument returns the plot to your CSS.

Tooltip content is yours: return a `ReactNode` from a series' [`tooltip`](#tooltips)
and style it like any other markup. The reset control is an Anta
`Button`, so it follows the app's theme with no plot-specific override.

## Example

```tsx
import type { ReactNode } from 'react'
import { custom, line, scatter, type Series } from '@antadesign/plot'
import { Plot } from '@antadesign/plot/react'
import '@antadesign/plot/plot.css'

// Deterministic particles keep the scene stable while you edit its options.
const stars = [
  { x: 0, y: 0 },
  ...Array.from({ length: 180 }, (_, i) => ({
    x: ((i * 73.31) % 240) - 120,
    y: ((i * 41.73) % 160) - 80,
  })),
]

const palette = ['#67e8f9', '#a78bfa', '#f472b6', '#fbbf24']
const particles = Array.from({ length: 300 }, (_, i) => {
  const arm = i % 3
  const progress = Math.floor(i / 3) / 100
  const angle = progress * Math.PI * 3.4 + arm * Math.PI * 2 / 3
  const radius = 9 + progress * 82
  const jitter = Math.sin(i * 12.7) * (2 + progress * 5)
  return {
    x: Math.cos(angle) * radius + jitter,
    y: Math.sin(angle) * radius * 0.58 + Math.cos(i * 7.3) * 3,
    size: 2 + (1 - progress) * 3 + (i % 13 === 0 ? 3 : 0),
    color: palette[arm],
    arm: ['CYAN', 'VIOLET', 'ROSE'][arm],
    energy: Math.round((1 - progress) * 100),
  }
})

const orbits = palette.map((color, index) => {
  const rotation = -0.65 + index * 0.43
  const data = Array.from({ length: 241 }, (_, i) => {
    const angle = i / 240 * Math.PI * 2
    const x = Math.cos(angle) * (77 + index * 8)
    const y = Math.sin(angle) * (23 + index * 3)
    return {
      x: x * Math.cos(rotation) - y * Math.sin(rotation),
      y: x * Math.sin(rotation) + y * Math.cos(rotation),
    }
  })
  return { color, data }
})

const series: Series<ReactNode>[] = [
  custom<ReactNode>({
    data: stars,
    x: 'x',
    y: 'y',
    hoverable: false,
    renderer: (series, { ctx, inner, resolve_x, resolve_y }) => {
      const cx = resolve_x(0)
      const cy = resolve_y(0)
      if (cx === undefined || cy === undefined) return
      ctx.save()
      const radius = (inner.right - inner.left) * 0.45
      const nebula = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      nebula.addColorStop(0, '#383064')
      nebula.addColorStop(0.35, '#181b3c')
      nebula.addColorStop(1, '#070b18')
      ctx.fillStyle = nebula
      ctx.fillRect(inner.left, inner.top, inner.right - inner.left, inner.bottom - inner.top)
      for (let i = 1; i < series.x.length; i++) {
        const x = resolve_x(i)
        const y = resolve_y(i)
        if (x === undefined || y === undefined) continue
        ctx.fillStyle = i % 7 === 0 ? '#c4b5fd' : '#52617d'
        ctx.beginPath()
        ctx.arc(x, y, i % 7 === 0 ? 1.3 : 0.65, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    },
  }),
  ...orbits.flatMap(({ color, data }) => [
    line<ReactNode>({ data, color: '#282443', width: 6, hoverable: false }),
    line<ReactNode>({ data, color, width: 1, hoverable: false }),
  ]),
  scatter<ReactNode>({
    data: particles,
    mark: 'circle',
    tooltip: ({ row }) => (
      <div style={{ padding: '4px 8px' }}>
        <strong>{String(row.arm)} ARM</strong>
        <div>Energy {String(row.energy)}%</div>
      </div>
    ),
  }),
  scatter<ReactNode>({
    data: orbits.map(({ color, data }, i) => ({
      ...data[28 + i * 43],
      color,
      name: ['LYRA', 'NOVA', 'VEGA', 'SOL'][i],
    })),
    size: 11,
    stroke: { color: '#ffffff', width: 1.5 },
    tooltip: ({ row }) => <strong>{String(row.name)}</strong>,
  }),
  scatter<ReactNode>({ data: [{ x: 0, y: 0 }], size: 26, color: '#67569b', hoverable: false }),
  scatter<ReactNode>({ data: [{ x: 0, y: 0 }], size: 14, color: '#c4b5fd', hoverable: false }),
  scatter<ReactNode>({
    data: [{ x: 0, y: 0 }],
    size: 6,
    color: '#ffffff',
    tooltip: () => <strong>THE SINGULARITY</strong>,
  }),
]

/** @play props Plot options */
const options = {
  title: { text: 'AFTER HOURS', size: 20, color: '#e0e7ff' },
  width: 600,
  height: 400,
  border: false,
  chrome_color: '#334155',
  background: '#070b18',
  theme_invert: false,
}

/** @play props Axis */
const axis = {
  x: {
    min: -120,
    max: 120,
    label: 'X',
    line: true,
    tick_mark: false,
    hidden: true,
    tick_label: {
      size: 10,
      color: '#94a3b8',
      format: (value: number | string) => String(value),
    },
  },
  y: {
    min: -80,
    max: 80,
    label: 'Y',
    line: true,
    tick_mark: false,
    hidden: true,
    tick_label: {
      size: 10,
      color: '#94a3b8',
      format: (value: number | string) => String(value),
    },
  },
}

/** @play props Margin */
const margin = { top: 48, right: 16, bottom: 16, left: 16 }

/** @play props Grid */
const grid = { x: false, y: false }

/** @play props Zoom and pan */
const zoom_pan = { x: true, y: true, modifier: false }

// Replace the object to apply a change; Plot does not observe in-place mutation.
const plotArgs = { ...options, series, axis, margin, grid, zoom_pan }

function Demo() {
  return <Plot plotArgs={plotArgs} className="plot-demo" />
}
```
