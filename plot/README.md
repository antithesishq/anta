# @antadesign/plot

Canvas charts for React, Preact, and browser custom elements. Create scatter, line,
bar, area, rectangle, and rule series, or draw custom marks. `Plot` handles sizing,
rendering, tooltips, zooming, and panning.

## Install

Install the package and its peer dependencies:

```sh
npm install @antadesign/plot
```

The package requires Anta `^0.3.30`, React `^19.0.0`, and a bundler that supports
ES modules and CSS imports. Preact applications can use their React compatibility
aliases. The root component imports shown below require `0.1.3` or later.

## Use in React

Import the component, register its browser elements, and load an Anta theme:

```tsx
import { Plot, scatter } from '@antadesign/plot'
import '@antadesign/plot/elements/a-plot-surface'
import '@antadesign/anta/elements/a-tooltip'
import '@antadesign/anta/theme-antune.css'

const series = [
  scatter({
    data: [{ x: 1, y: 2 }, { x: 2, y: 5 }, { x: 3, y: 4 }],
    tooltip: true,
  }),
]

export function Chart() {
  return <Plot plotArgs={{ height: 300, series }} />
}
```

Set `plotArgs.height` or give the parent a height. The plot fills the available
space unless you provide explicit dimensions. Replace `plotArgs` to update the
chart. Pass `onError` to handle rendering and configuration failures.

`Plot` uses Anta's configured renderer and hooks. Custom JSX runtimes can supply
hooks through Anta's `configure()` API.

## Use as a browser element

Register `<a-plot>` and assign its configuration through the `plotArgs` property:

```ts
import { scatter, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'
import '@antadesign/anta/theme-antune.css'

const plot = document.createElement('a-plot') as APlotElement
plot.plotArgs = {
  height: 300,
  series: [
    scatter({
      data: [{ x: 1, y: 2 }, { x: 2, y: 5 }, { x: 3, y: 4 }],
      tooltip: true,
    }),
  ],
}
document.body.append(plot)
```

The registration import includes the surface and tooltip elements. To register
programmatically, import and await `definePlotElement()` from
`@antadesign/plot/browser` instead.

## Customize a chart

The package exports `scatter`, `line`, `bar`, `area`, `rect`, `rule`, and `custom`
series factories, along with their TypeScript argument types. Combine series in
`plotArgs.series` and configure axes through `plotArgs.axis`.

Set a series' `tooltip` to `true` for the default tooltip, or provide a callback
for custom content. JSX plots accept React-compatible content; browser element
factories accept DOM nodes. Browser elements also expose `tooltipRenderer` for
applications that need to manage the tooltip's contents directly.

Custom series support `renderer`, `hit_test`, and `highlight_renderer` callbacks.
`PlotSurface` is exported as a low-level JSX wrapper. Use `Plot` for a complete
chart; controllers and drawing lifecycle helpers remain internal.

## Imports

| Import | Provides |
| --- | --- |
| `@antadesign/plot` | `Plot`, `PlotSurface`, series factories, and public types |
| `@antadesign/plot/browser` | Series factories for DOM tooltips, browser element types, and `definePlotElement()` |
| `@antadesign/plot/elements/a-plot` | Registers the standalone chart and its dependencies |
| `@antadesign/plot/elements/a-plot-surface` | Registers the surface used by the JSX components |
| `@antadesign/plot/elements` | Registers both plot elements |

Importing the root does not register browser elements. Base element styles are
installed automatically; load your application's Anta theme separately.

For compatibility, `/auto` registers both elements, and `/plot.css` supplies the
standalone layout stylesheet.
A separate `/plot.css` import is not needed for the examples above.

## Size scatter marks with the viewport

A numeric `size` stays fixed in CSS pixels. A size accessor receives
`(row, index, viewport)` and returns a non-negative finite diameter:

```ts
scatter({
  data,
  size: (row, index, viewport) =>
    Math.min(12, Number(row.weight) * viewport.zoom_factor.x ** 0.25),
})
```

`viewport` has the same shape as the `on_viewport_change` payload:

- `x` and `y` contain `{ window: [min, max], full: [min, max] }`, or `null` for a categorical axis.
- `zoom_factor` contains `{ x, y }` gesture magnification, initially 1 per axis.

Use `viewport.zoom_factor.x`, `viewport.zoom_factor.y`, or `Math.max(viewport.zoom_factor.x, viewport.zoom_factor.y)`
for zoom-relative sizing. Magnification follows accepted gestures, including zoom
limits and logarithmic axes. Panning, resizing, and data-domain updates preserve
it. Reset and new keyed viewport requests establish factor 1 on their affected
axes. Zooming out beyond a requested initial view can yield factors below 1.
The window and full domains remain available for other viewport-dependent logic.

Accessors run during composition, after the viewport and scales are known, rather
than during series construction. They run again for zoom, pan, and other changes
that require composition. Existing one- and two-argument accessors remain valid,
but their execution and validation now happen at composition time. Keep them pure
and inexpensive: each retained row without a numeric `size` override is evaluated.
The index remains the original input-row index after category filtering.

Drawing, hit testing, and highlights share the resolved numeric sizes; hover and
redrawing an unchanged composition do not rerun the accessor. Invalid results
report a composition error and retain the last successful plot. Numeric row
`size` fields retain precedence over the accessor. No application state updates,
`on_viewport_change` handler, or series reconstruction are needed.

Viewport-aware sizing is supported by the scatter size accessor. Rectangle
sizes, line widths, font sizes, and other size declarations accept numbers.

## Interaction configuration migration

Zoom and pan use fixed gestures. Remove `zoom_pan.modifier` from existing configs.
Plain drag pans; Ctrl-drag inside the plot draws a zoom rectangle. Over an axis,
plain drag zooms around the starting value, and scrolling zooms around the pointer.
Enabled continuous axes show directional arrows on hover. Pan by dragging inside
the plot; axis drags always zoom, with or without Ctrl.
Scrolling inside the plot zooms both enabled axes. Horizontal input is ignored.

Right-click for Zoom In, Zoom Out, and Reset Zoom. This replaces the reset button
and double-click reset. Unavailable actions remain visible and disabled.
`zoom_pan` still accepts a boolean or an object with optional `x` and `y` flags.
The object also accepts `menu_zoom_step`, a finite number greater than 1, default
`2`. Zoom In divides spans by this value; Zoom Out multiplies them. It affects
only menu zoom. Wheel and drag sensitivity are unchanged.

Low-level `PlotSurface` consumers now supply `presentation.menu` action states
and handle `onZoomRequest` (`in`, `out`, or `reset`, plus context-click offsets).
The old `presentation.reset`, `onResetRequest`, and `onPlotDoubleClick` are removed.
The public `Plot` and standalone `a-plot` hosts handle these details internally.

Keyboard users can focus the plot zoom controls and press Shift+F10 or the
Context Menu key. Keyboard menu zoom anchors at the plot center, and Escape
returns focus to the controls. Ctrl-primary click is reserved for rectangle
zoom on macOS; use a secondary click to open the pointer menu. Plain wheel and
Ctrl-wheel/pinch zoom the plot; horizontal and Shift-wheel input are left to the
browser. A rectangle only needs nonzero extent on enabled continuous axes.

PlotSurface uses one Capture spanning the interior and visible axis strips.
Its `capture_policy` presentation supplies wheel availability per region.
After pointer settling, the extra corner in that bounding rectangle consumes
vertical scroll without zooming or scrolling the page. Horizontal/Shift-wheel input remains with the
browser. Pointer and wheel events retain offsets relative to the plot interior.

Plain wheel input, including the corner, waits for pointer settling. Ctrl-wheel
and pinch over interactive plot regions activate immediately. Shift-wheel is
ignored by Capture without stopping propagation to application wheel listeners.

For low-level PlotSurface consumers, `presentation.capture_policy` owns input
configuration while supplied. `configureCapture(config)` stores a fallback that
applies when no presentation policy is supplied; surface capture attributes also
apply only in that fallback mode. Use `present()` to update a region policy.
Public plot hosts configure their input through presentation alone.
