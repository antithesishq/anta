# @antadesign/plot

Canvas charts for React, Preact, and browser custom elements. Create scatter, line,
bar, area, rectangle, and rule series, or draw custom marks. `Plot` handles sizing,
rendering, tooltips, zooming, and panning.

## Install and configure

Install the package and its peer dependencies:

```sh
npm install @antadesign/plot @antadesign/anta react react-dom
```

The package requires Anta `^0.3.30`, React `^19.0.0`, and a bundler that supports
ES modules and CSS imports. Preact applications can use their React compatibility
aliases. Register elements in your browser entry and load
`@antadesign/plot/plot.css` once per document. Anta's `tokens.css` is optional:
Plot uses fallback colors when tokens are absent, including for selection
rectangles, tooltips, and menus. When using Anta's theme colors, put tokens before
the Plot stylesheet. Omit the tokens import if your application already loads
Anta's full bundle:

```ts
import '@antadesign/anta/tokens.css'
import '@antadesign/plot/plot.css'
```

Anta's reset and themes are also optional. For strict CSP, configure your bundler
to extract Plot and Anta CSS into external files. Development loaders that inject
`<style>` elements need extraction or a development policy that explicitly permits
the loader. Worker rendering requires `worker-src` to allow the worker script's
origin, such as `worker-src 'self'` for same-origin scripts. If your renderer
creates blob workers, also allow `blob:`, for example `worker-src 'self' blob:`.
See [Load styles under a strict content security policy](#load-styles-under-a-strict-content-security-policy)
for the full setup.

Before hydrating, configure Anta with your
renderer hooks and `{ hydratingEvents: true }`; see the
[renderer and hydration setup](https://anta.design/install/).

Plot is a separate package. Anta's root bundle does not include its components,
elements, or stylesheet.

## Use in React

Import the component, register its browser elements, and load the Plot stylesheet:

```tsx
import { Plot, scatter } from '@antadesign/plot'
import '@antadesign/plot/elements/a-plot-surface'
import '@antadesign/plot/plot.css'
import '@antadesign/anta/elements/a-tooltip'

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
import '@antadesign/plot/plot.css'

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

## Use a low-level surface

Import `PlotSurface` from `@antadesign/plot`, register
`@antadesign/plot/elements/a-plot-surface` in the browser, and load the Plot
stylesheet. Give its parent a height or apply a CSS class with explicit
dimensions. Your application owns drawing and provides presentation and input
handlers. Use `Plot` when you need the complete chart lifecycle.

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
| `@antadesign/plot/plot.css` | Required shared styles for every host |

Importing the root does not register browser elements. Load
`@antadesign/plot/plot.css` once in the browser document for `Plot`,
`PlotSurface`, and standalone `<a-plot>`. Registration entries do not load Plot's
structural CSS. Load your application's Anta theme separately.

For compatibility, `/auto` registers both elements. All JavaScript entries,
including `/browser` and `/auto`, keep Plot's stylesheet separate.

## Load styles under a strict content security policy

Extract Plot and Anta CSS imports into external stylesheets served from an
allowed origin. Development loaders that inject `<style>` elements are blocked
by the policy below. Configure CSS extraction or serve emitted CSS through
stylesheet links. If your development server requires injected styles, its
development CSP must explicitly permit that loader.
To load CSS from HTML, serve the published `dist/plot.css` asset alongside your
application bundle and use `<link rel="stylesheet" href="/plot.css">`.
Load the stylesheet in each document, including a destination document before
adopting a plot into it. Surface styles inherit the application's font and theme.

Plot supports `style-src 'self'; style-src-elem 'self'; style-src-attr 'none'`
with externally bundled scripts and styles. Runtime sizing, capture and rectangle
coordinates, cursor, and canvas filters use direct CSSOM property updates.
These updates still appear in the DOM's `style` attribute. Plot does not parse
style attributes or inject style elements.

JSX `Plot` applies `plotArgs.width` / `height` and consumer `style` props after
commit through CSSOM, including after hydration. Its SSR markup relies on the
external stylesheet. Use an external CSS class to reserve a specific size before
hydration and prevent layout shifts. Low-level `PlotSurface` style props and
custom tooltip markup follow your renderer's normal serialization rules; use
external CSS for them under `style-src-attr 'none'`.
Put broad application resets in `@layer base` so they do not override component
layout unintentionally. Worker rendering requires `worker-src` to allow the
worker script's origin. Use `worker-src 'self'` for same-origin scripts, or
`worker-src 'self' blob:` if your renderer also creates blob workers. Plot does
not create your renderer worker or its DOM bridge.
See [the CSP audit and browser validation](CSP.md) for the tested boundaries.

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
Rectangle zoom and Reset Zoom animate over 200–400 ms with an ease-out, based on
the zoom ratio and center movement of the axis that changes most. Menu Zoom In
and Zoom Out keep a fixed 200 ms duration.
Disabled axes stay fixed, and logarithmic axes interpolate in log space. Reduced
motion skips the animation. A new gesture interrupts at the current frame;
`on_viewport_change` reports completion or gesture interruption, not every frame.
New plot arguments supersede the animation without reporting the old transition,
and resizing stops it at the current frame.

Plain drag pans; Ctrl-drag inside the plot draws a zoom rectangle. Over an axis,
plain drag zooms around the starting value, and scrolling zooms around the pointer.
Enabled continuous axes show directional arrows on hover. Pan by dragging inside
the plot; axis drags always zoom, with or without Ctrl.
Scrolling inside the plot zooms both enabled axes. Horizontal input is ignored.

Right-click for Reset Zoom, Zoom Out, and Zoom In. This replaces the reset button
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

Selecting a zoom menu action while the pointer is over the capture area makes
wheel zoom immediately available until the pointer leaves that area. This avoids
repeating the dwell delay when the menu closes, including during zoom animation.

Ctrl-wheel and pinch share the same browser signal. Small samples use 3× wheel
sensitivity; each Ctrl-wheel sample is capped at a 1.2× change in either direction
so physical mouse-wheel notches stay manageable. Pinching preserves any existing
plain-wheel dwell state.

Plain wheel input on a new visit, including the corner, waits for pointer settling. Ctrl-wheel
and pinch over interactive plot regions activate immediately. Shift-wheel is
ignored by Capture without stopping propagation to application wheel listeners.

For low-level PlotSurface consumers, `presentation.capture_policy` owns input
configuration while supplied. `configureCapture(config)` stores a fallback that
applies when no presentation policy is supplied; surface capture attributes also
apply only in that fallback mode. Use `present()` to update a region policy.
Public plot hosts configure their input through presentation alone.
