# Rect

A rect series represents data as rectangular regions, making it useful for
showing time intervals, occupied ranges, or cells in a heatmap. Use `x`, `x2`,
`y`, and `y2` to define the bounds, or place rectangles within categorical bands.

## Categorical cells

Compare hourly request volume across a week, with busier daytime hours and quieter weekends. Each cell represents one hour on one day, with color showing the request count.

```js
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))

  const data = days.flatMap((day, d) => hours.map((hour, h) => {
    const daytime = Math.exp(-(((h - 14) / 5) ** 2))
    const variation = 0.9 + 0.1 * Math.sin(h * 1.7 + d * 2.3)
    const requests = Math.round((120 + 880 * daytime) * (d < 5 ? 1 : 0.4) * variation)
    return { day, hour, requests }
  }))

  const weekly_heatmap = plot({
    series: [
      plot.rect({
        data,
        x: 'hour',
        y: 'day',
        inset: 0.75,
        color: pure(row => ({
          light: 'hsl(174, 65%, ' + (94 - Number(row.requests) * 0.06) + '%)',
          dark: 'hsl(174, 55%, ' + (16 + Number(row.requests) * 0.04) + '%)',
        })),
        tooltip: pure(({ row }) => h("span", {}, row.day + ' ' + row.hour + ':00 · ' + row.requests + ' requests')),
      }),
    ],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 38 },
    axis: { x: { categories: hours, label: '' }, y: { categories: days, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(weekly_heatmap)
  // presentation.blank("Weekly heatmap").print(weekly_heatmap)
```

## Intervals with explicit bounds

Set `x` and `x2` to show durations within categorical rows. Each rectangle retains its start and end values as the plot resizes.

```js
const data = [
    { task: 'Fetch', start: 0.5, end: 3.2 },
    { task: 'Parse', start: 2.8, end: 5.1 },
    { task: 'Build', start: 4.5, end: 9.4 },
    { task: 'Test', start: 7.8, end: 11.2 },
    { task: 'Ship', start: 10.8, end: 12.5 },
  ]

  const task_intervals = plot({
    series: [
      plot.rect({
        data,
        x: 'start',
        x2: 'end',
        y: 'task',
        inset: 9,
        color: { light: '#c4b5fd', dark: '#6d28d9' },
        stroke: { color: { light: '#7c3aed', dark: '#c4b5fd' }, width: 1 },
        hover_span_y: true,
        tooltip: pure(({ row }) => h("span", {}, row.task + ': ' + row.start + '–' + row.end + ' s')),
      }),
    ],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 44 },
    axis: { x: { min: 0, max: 14, label: '' }, y: { label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(task_intervals)
  // presentation.blank("Task intervals").print(task_intervals)
```

## Fixed pixel dimensions

Set `size` to draw rectangles with a consistent width and height at numeric coordinates. An outline keeps nearby marks distinct.

```js
const data = Array.from({ length: 32 }, (_, i) => ({
    x: 8 + (i * 23 % 84),
    y: 18 + (i * 13 % 65),
    value: 20 + (i * 17 % 80),
  }))

  const sized_rectangles = plot({
    series: [
      plot.rect({
        data,
        size: { width: 16, height: 9 },
        color: pure(row => Number(row.value) > 65
          ? { light: '#c2410c', dark: '#fdba74' }
          : { light: '#0891b2', dark: '#67e8f9' }),
        stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 1 },
        tooltip: pure(({ row }) => h("span", {}, 'Value: ' + row.value)),
      }),
    ],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 30 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(sized_rectangles)
  // presentation.blank("Sized rectangles").print(sized_rectangles)
```

## Run history

Place fixed-size rectangles on a time axis in Passed and Failed lanes. Use `band_align` to anchor both sets of marks to the shared divider, with passing runs above and failures below.

```js
const start = 1767258000000

  const data = Array.from({ length: 36 }, (_, i) => ({
    run: i + 1,
    end_ms: start + (i * 3 + (i % 3)) * 60000,
    lane: [5, 6, 14, 23, 24, 25, 32].includes(i) ? 'Failed' : 'Passed',
  }))

  const run_history = plot({
    series: [
      plot.rect({
        data: data.filter(row => row.lane === 'Passed'),
        x: 'end_ms',
        y: 'lane',
        size: { width: 10, height: 40 },
        band_align: 'end',
        inset: 0,
        color: { light: '#189e3e', dark: '#4ade80' },
        stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 0.5 },
        tooltip: pure(({ row }) => h("span", {}, 'Run ' + row.run + ': ' + row.lane)),
      }),
      plot.rect({
        data: data.filter(row => row.lane === 'Failed'),
        x: 'end_ms',
        y: 'lane',
        size: { width: 10, height: 40 },
        band_align: 'start',
        inset: 0,
        color: { light: '#c41e5e', dark: '#fb7185' },
        stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 0.5 },
        tooltip: pure(({ row }) => h("span", {}, 'Run ' + row.run + ': ' + row.lane)),
      }),
    ],
    height: 260,
    margin: { top: 5, right: 8, bottom: 24, left: 56 },
    axis: {
      x: {
        scale: 'utc',
        min: start - 5 * 60000,
        max: start + 115 * 60000,
        label: '',
        line: false,
        tick_label: { format: pure(value => String(Math.floor(Number(value) / 3600000) % 24).padStart(2, '0') + ':' + String(Math.floor(Number(value) / 60000) % 60).padStart(2, '0')) },
      },
      y: { categories: ['Failed', 'Passed'], grid_align: 'edge', label: '', line: false },
    },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: true,
    border: false,
    theme_invert: false,
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(run_history)
  // presentation.blank("Run history").print(run_history)
```

## Rect arguments

### RectArgs

| Field | Type | Default | Description |
|---|---|---|---|
| `data` | `{[key: string]: any}[]` | Required | Data points to plot. |
| `x?` | [`FieldArg`](../plot.md#data-fields) | `'x'` | Horizontal field name or accessor. |
| `x2?` | [`FieldArg`](../plot.md#data-fields) | `'x2'` when present in data | Opposite horizontal corner. Can be combined with `size.height`, but not `size.width` or a numeric `size`. A numeric x axis requires either `x2` or a width supplied through `size`. |
| `y?` | [`FieldArg`](../plot.md#data-fields) | `'y'` | Vertical field name or accessor. |
| `y2?` | [`FieldArg`](../plot.md#data-fields) | `'y2'` when present in data | Opposite vertical corner. Can be combined with `size.width`, but not `size.height` or a numeric `size`. A numeric y axis requires either `y2` or a height supplied through `size`. |
| `span?` | `'x' \| 'y'` | None | Stretch the rectangle across the full plot on this axis. |
| `size?` | `number \| { width?: number; height?: number }` | Derived from bounds or band | Fixed pixel size. A number sets both dimensions and cannot be combined with `x2` or `y2`. Use `{ width }` to set the width in pixels while `y` and `y2` determine the height, or `{ height }` to set the height in pixels while `x` and `x2` determine the width. |
| `min_size?` | `number` | `0` | Minimum width in pixels when using `x2`, and minimum height in pixels when using `y2`. |
| `band_align?` | `'center' \| 'start' \| 'end'` | `'center'` | Alignment of a fixed-size rectangle within a categorical band. |
| `hover_span_x?` | `boolean` | `false` | Extend the area that responds to tooltips, selection, and hover highlights along the x axis. |
| `hover_span_y?` | `boolean` | `false` | Extend the area that responds to tooltips, selection, and hover highlights along the y axis. |
| `inset?` | `number` | 1/6 of band width | Space left on each side within a categorical band, in pixels. |
| `offset?` | `{ x?: number; y?: number }` | `{ x: 0, y: 0 }` | Pixel offsets applied to each rectangle. |
| `color?` | [`ColorArg`](../plot.md#series-colors) | Black | Series color. Theme pairs provide separate light and dark colors. |
| `stroke?` | [`StrokeArg`](../plot.md#strokes) | None | Outline color and optional width. |
| `tooltip?` | [`TooltipArg`](../plot.md#tooltips) | None | Use `true` for the default tooltip, or a callback for custom content. |
| [`on_select?`](../plot.md#selection) | `SelectFn` | None | Callback receiving the selected point and its source data. |
| `hoverable?` | `boolean` | `true` | Enable tooltips, selection callbacks, and hover highlights for this series. |
| `highlight?` | `boolean` | `true` | Highlight a data point when you hover over it. |
| `highlight_color?` | [`ColorArg`](../plot.md#series-colors) | Automatic | Exact hover color, including opacity. |

This example draws rectangles bounded by `start`, `end`, `low`, and `high`, with an outline, tooltips, and a selection callback.

```js
const selected_data = new reactive.StateVar('Select a point to inspect its data.')

  const series = [plot.rect({
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
      tooltip: pure(({ x, y }) => h("span", {}, '(' + x + ', ' + y + ')')),
      on_select: pure(({ row }) => selected_data.set(JSON.stringify(row)), { selected_data }),
      hoverable: true,
      highlight: true,
    })]

  const bounded_rectangles_plot = plot({
    series,
    height: 260,
    margin: { top: 12, right: 12, bottom: 28, left: 36 },
    axis: { x: { min: 0, max: 7, label: '' }, y: { min: 0, max: 6, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: true,
    border: false,
    zoom_pan: false,
  })

  const bounded_rectangles = h(
    'div',
    {},
    bounded_rectangles_plot,
    h(
      pure(({ selected_data }) =>
        h('output', { 'aria-live': 'polite', style: { display: 'block' } }, selected_data.get()),
      ),
      { selected_data },
    ),
  )

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(bounded_rectangles)
  // presentation.blank("Bounded rectangles").print(bounded_rectangles)
```
For fixed-size marks in categorical bands, use `size` and `band_align`.
`inset` controls the space around a band when its size is not fixed:

```js
const series = [plot.rect({
      data: [{ group: 'A', row: 'First' }, { group: 'B', row: 'Second' }],
      x: 'group',
      y: 'row',
      size: { width: 12 },
      band_align: 'start',
      inset: 16,
      offset: { x: 2, y: 0 },
      hover_span_x: true,
      hover_span_y: true,
      color: 'steelblue',
      tooltip: true,
    })]

  const band_rectangles = plot({
    series,
    height: 260,
    margin: { top: 12, right: 12, bottom: 28, left: 62 },
    axis: { x: { categories: ['A', 'B'], grid_align: 'edge', label: '' }, y: { categories: ['First', 'Second'], grid_align: 'edge', label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: true,
    border: false,
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(band_rectangles)
  // presentation.blank("Band rectangles").print(band_rectangles)
```

Use `span` to fill one axis, leaving its coordinates unspecified. Add this
series before the data series to draw a background region:

```js
const series = [plot.rect({
      data: [{ low: 2, high: 5 }],
      span: 'x',
      y: 'low',
      y2: 'high',
      color: 'aliceblue',
      hoverable: false,
      highlight: false,
    })]

  const background_region = plot({
    series,
    height: 260,
    margin: { top: 12, right: 12, bottom: 28, left: 36 },
    axis: { x: { min: 0, max: 10, label: '' }, y: { min: 0, max: 7, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: true,
    border: false,
    zoom_pan: false,
  })

  // In Antithesis notebook, plot() returns a Printable. Uncomment below to display it:
  // print(background_region)
  // presentation.blank("Background region").print(background_region)
```

## Shared configuration

See [Install and configure](../plot.md#install-and-configure) to set up Plot.
The argument tables describe omitted fields; examples may override these defaults.
See [Data fields](../plot.md#data-fields), [Series colors](../plot.md#series-colors),
[Strokes](../plot.md#strokes), and [Mark shapes](../plot.md#mark-shapes) for shared options.
For callbacks, see [Tooltips](../plot.md#tooltips) and
[Selection](../plot.md#selection).
