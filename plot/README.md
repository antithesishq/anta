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
