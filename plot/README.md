# @antadesign/plot

Canvas plots with series factories, an Anta JSX `Plot` component, and a standalone `<a-plot>` browser host. Plot owns canvas setup, rendering, interactions, and cleanup. Customize marks and tooltips through callbacks; rendering lifecycle helpers are internal.

```ts
import { scatter, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/elements/a-plot'

const plot = document.createElement('a-plot') as APlotElement
plot.plotArgs = { series: [scatter({ data: [{ x: 1, y: 2 }, { x: 2, y: 3 }] })] }
document.body.append(plot)
```

Use a bundler that handles CSS imports. The browser entry loads Anta elements and their styles through the Anta dependency. The plot host and surface install their base styles automatically; no separate `plot.css` import is needed. Applications supply their Anta theme as usual.

## Entry points

| Import | Contents |
| --- | --- |
| `@antadesign/plot` | Series factories and public configuration, callback, and series types |
| `@antadesign/plot/browser` | DOM tooltip factories and explicit `definePlotElement()` registration |
| `@antadesign/plot/components` | `Plot` JSX component and its props; no element registration |
| `@antadesign/plot/elements/a-plot` | Registers the standalone plot and its surface dependency synchronously |
| `@antadesign/plot/elements/a-plot-surface` | Registers the internal surface dependency required by `Plot` |
| `@antadesign/plot/elements` | Registers `a-plot` and `a-plot-surface`; retains resolved readiness promises for compatibility |
| `@antadesign/plot/auto` | Compatibility alias for `/elements` registration with the `plotElementReady` promise |
| `@antadesign/plot/plot.css` | Optional compatibility stylesheet; base styles are installed automatically |

## Anta component

```tsx
import { Plot } from '@antadesign/plot/components'
import { scatter } from '@antadesign/plot'
import '@antadesign/plot/elements/a-plot-surface'
import '@antadesign/anta/elements/a-tooltip'

<Plot plotArgs={{ height: 300, series: [scatter({ data: [{ x: 1, y: 2 }], tooltip: true })] }} />
```

`Plot` uses Anta's configured renderer and hooks. Register
`@antadesign/plot/elements/a-plot-surface` and `@antadesign/anta/elements/a-tooltip`
before rendering. The existing `/elements/a-plot` registration also includes these dependencies.

The component owns the controller, composition, drawing, and cleanup. It receives
OffscreenCanvas objects from the surface and draws on the renderer's thread: the
main thread in ordinary React/Preact apps, or the worker through the notebook's DOM bridge.
Default and custom tooltips render through Anta's `Tooltip`, without DOM refs or portals.
Replace `plotArgs` to update the plot. Custom renderers supply `useState`, `useMemo`,
`useRef` and `useLayoutEffect` through `configure()` when their hooks
are not already provided by React aliases.

The root entry does not load Anta or React at runtime. Element registration requires
a CSS-aware bundler and is guarded when no browser registry is available.

## Build and verify

From the repository root, after installing workspace dependencies:

```sh
pnpm run build:dev
pnpm --filter @antadesign/plot run build
pnpm --filter @antadesign/plot run typecheck
pnpm --filter @antadesign/plot run check:package
pnpm --filter @antadesign/plot run test:registration
```

The plot build emits ESM, declarations, and CSS into `dist/`. Internal plot code and its data dependencies are bundled into shared chunks. Anta and React remain external. Ship the entire `dist/` directory, including chunks. Declarations use explicit ESM paths for NodeNext consumers.

`check:package` copies the built package into a temporary consumer directory and checks all seven factories, internal composition and interaction integration, server imports, the public API boundary, and Bundler/NodeNext declarations. It checks core declarations fully; third-party Anta declarations use `skipLibCheck`.

`prepare` and `prepublishOnly` rebuild the package. `dist/` and build metadata are ignored. Follow [the release instructions](../RELEASING.md) to publish. Plot uses the workspace Anta package and requires its configured hooks. Publish an Anta release containing those hooks before publishing Plot; pnpm writes that exact Anta version into the published dependency.

The notebook adapter remains in Star. Until Star adopts a published version, its migration source remains the active implementation; keep any intervening fixes synchronized.

## Component lifecycle

`Plot` accepts `plotArgs`, presentation props such as `className` and `style`, and
`onError` for lifecycle failures. `validateTooltipContent` optionally validates custom
content at a renderer boundary. Controller updates, composition, and drawing run
in layout effects after commit; discarded renders do not invoke plot callbacks.
The surface mounts after hydration and transfers each canvas once. Effects can
replay without retransferring canvases; a new component mount gets a new surface.

Both `Plot` and `a-plot` use the internal `PlotHost` for controller ownership,
composition, viewport reconciliation, drawing, and capture/cursor configuration.
The JSX component retains the host and publishes presentation through configured
hooks. It also handles surface events, transferred contexts, and measurement updates.
The standalone element supplies DOM lifecycle callbacks and animation-frame scheduling.
The shared host has no DOM or renderer dependency and executes in the notebook worker.

The component fills its parent. Give the parent a height or set `plotArgs.height`.
Explicit plot dimensions override the wrapper styles until removed.

Run `pnpm --filter @antadesign/plot run test:browser` after building. The browser
suite covers React and Preact, hydration, discarded renders, interactions, sizing,
and tooltip cleanup. Set `PLOT_TEST_BROWSER_EXECUTABLE` to a Chromium executable.

Standalone hosts can optionally assign `element.tooltipRenderer` to receive resolved
tooltip entries and their target element. The renderer owns the target's children
and receives an empty list when hover clears. Leave it undefined for the default
DOM renderer. Framework adapters must clean up their renderer on unmount.

## Rendering ownership

Use `Plot` or `<a-plot>` for every plot. Controllers, canvas drawing helpers,
highlight dispatch, host adapters, and `PlotSurface` are internal implementation
details, not exported APIs for application-owned rendering.

Custom series retain `renderer`, `hit_test`, and `highlight_renderer` callbacks.
Plot invokes them with the appropriate context and owns scheduling, canvas sizing,
clipping, clearing, and cleanup. Series and root tooltip callbacks customize content
without taking over the plot lifecycle.

The `/elements/a-plot-surface` registration entry remains available because the
JSX `Plot` component depends on that internal browser element. Registering it is
setup for `Plot`, not a supported standalone surface integration.
