# @antadesign/plot

Canvas plots with series factories, shared interaction controllers, host integration helpers, and an optional `<a-plot>` browser host. React applications can use `Plot`; lower-level hosts can use the thin Anta `PlotSurface` wrapper. Anta is a regular dependency; React is a peer, as it is for stickers.

```ts
import { scatter, definePlotElement, type APlotElement } from '@antadesign/plot/browser'
import '@antadesign/plot/plot.css'

await definePlotElement()
const plot = document.createElement('a-plot') as APlotElement
plot.plotArgs = { series: [scatter({ data: [{ x: 1, y: 2 }, { x: 2, y: 3 }] })] }
document.body.append(plot)
```

Use a bundler that handles CSS imports. The browser entry loads Anta elements and their styles through the Anta dependency. `plot.css` supplies the plot layout. Applications supply their Anta theme as usual.

## Entry points

| Import | Contents |
| --- | --- |
| `@antadesign/plot` | Series factories, controllers, host presentation helpers, Anta event integration, and public types |
| `@antadesign/plot/browser` | DOM tooltip factories and explicit `definePlotElement()` registration |
| `@antadesign/plot/react` | React `Plot` adapter, props, and error types |
| `@antadesign/plot/components` | `PlotSurface` JSX wrapper and its props; no element registration |
| `@antadesign/plot/elements` | Registers only `a-plot-surface`; exports `plotSurfaceElementReady` |
| `@antadesign/plot/auto` | Browser registration with the `plotElementReady` promise |
| `@antadesign/plot/plot.css` | Plot layout stylesheet |

The root entry does not load Anta or React at runtime. Browser registration loads Anta elements lazily. Imports are safe during server rendering; call `definePlotElement()` only in a browser.

## Build and verify

From the repository root, after installing workspace dependencies:

```sh
pnpm run build:dev
pnpm --filter @antadesign/plot run build
pnpm --filter @antadesign/plot run typecheck
pnpm --filter @antadesign/plot run check:package
```

The plot build emits ESM, declarations, and CSS into `dist/`. Internal plot code and its data dependencies are bundled into shared chunks. Anta and React remain external. Ship the entire `dist/` directory, including chunks. Declarations use explicit ESM paths for NodeNext consumers.

`check:package` copies the built package into a temporary consumer directory and checks all seven factories, composition, interaction integration, server imports, exports, and Bundler/NodeNext declarations. It checks core declarations fully; third-party Anta declarations use `skipLibCheck`.

`prepare` and `prepublishOnly` rebuild the package. `dist/` and build metadata are ignored. Follow [the release instructions](../RELEASING.md) to publish with pnpm, which rewrites `workspace:*` to the current Anta version.

The notebook adapter remains in Star. Until Star adopts a published version, its migration source remains the active implementation; keep any intervening fixes synchronized.

## React adapter

```tsx
import { useMemo } from 'react'
import { scatter } from '@antadesign/plot'
import { Plot } from '@antadesign/plot/react'
import '@antadesign/plot/plot.css'

export function Chart({ data }: { data: { x: number; y: number }[] }) {
    const plotArgs = useMemo(() => ({
        series: [scatter({
            data,
            tooltip: point => <strong>{point.x}, {point.y}</strong>,
        })],
        zoom_pan: { x: true, y: true },
    }), [data])

    return <Plot plotArgs={plotArgs} onError={({ phase, error }) => console.warn(phase, error)} />
}
```

`Plot` accepts one complete `plotArgs` object and ordinary div attributes such as
`className`, `style`, and `aria-label`. Replace argument objects and data when
changing them; in-place mutations are not observed. The default height is 300px,
and width fills the parent. Explicit argument dimensions override wrapper styles;
removing them restores the style or fallback.

The component registers and mounts standalone `a-plot` after React commits. The separate `plot.css` import is required for canvas
stacking and surface layout. The root `@antadesign/plot` remains framework-free.

React owns tooltip content and its context/lifecycle through ReactDOM portals.
React consumers need matching `react` and `react-dom` versions. Default tooltips, custom
React nodes, and separators use the shared presentation helpers. Canvas contexts,
backing-store sizing, and drawing run on the main thread. Composition and
interactions, scheduling, and controller lifecycle belong to the standalone element.

Configuration, rendering callbacks, and controller updates run after React commits.
SSR emits the wrapper and empty custom elements without creating a controller;
hydration initializes the standalone element. Removing it cancels pending drawing,
gesture reports, and hover work. StrictMode effect replay reconnects the tooltip
renderer while retaining the element and its canvases.

`onError` receives `initialize`, `template`, `compose`, or `draw` failures.
Without a handler, failures are logged with `console.warn`. Initial template
failures can recover when a later valid configuration is committed.

The browser regression suite is `pnpm --filter @antadesign/plot run test:react`
after building. It uses the workspace's existing Playwright dependency and a
Chromium installation. Set `PLOT_TEST_BROWSER_EXECUTABLE` for a local browser, or
`CAPTURE_TEST_BROWSER_CHANNEL=chrome` for an installed Chrome. React browser
behavior is pending manual verification for this first adapter revision.

Standalone hosts can optionally assign `element.tooltipRenderer` to receive resolved
tooltip entries and their target element. The renderer owns the target's children
and receives an empty list when hover clears. Leave it undefined for the default
DOM renderer. Framework adapters must clean up their renderer on unmount.

## Shared plot surface

Import `@antadesign/plot/elements` to register the surface, and `plot.css` for its layout.
The published JavaScript and CSS are separate assets; both imports are required:

```ts
import '@antadesign/plot/elements'
import '@antadesign/plot/plot.css'
```

React, Preact, and other Anta JSX consumers can use the typed wrapper:

```tsx
import { PlotSurface } from '@antadesign/plot/components'

// Browser entry only:
import '@antadesign/plot/elements'
import '@antadesign/plot/plot.css'

// In the host render:
<PlotSurface
    presentation={presentation}
    canvasOwner="worker"
    onCanvasTransfer={event => attachCanvases(event.detail)}
/>
```

The wrapper serializes presentation and forwards Capture attributes and event
handlers. It has no DOM refs, hooks, controller, or drawing logic, so it also works
in worker-side renderers. `/components` uses Anta's JSX runtime; the root remains
free of framework runtime dependencies. Native custom-element consumers can keep
using `a-plot-surface` directly.

This leaves `a-plot` available for a host-owned wrapper. Registration is asynchronous;
existing surface elements upgrade when its Anta dependencies finish loading. Import
and await `plotSurfaceElementReady` from the same entry when registration must finish
before accessing surface methods. Registration failures are logged to the console;
the readiness promise also rejects. Server-side imports do nothing.

For explicit registration, `definePlotSurfaceElement()` from `/browser` registers `<a-plot-surface>` and its Box,
Capture, button and icon dependencies. It does not register `<a-plot>` or Tooltip.
The surface fills its parent; standalone plots retain their 300px default height.
Worker hosts should provide a 400px parent fallback when plot height is omitted.
`setSize({ width, height })` temporarily pins individual dimensions and restores the
previous inline CSS when a pin is removed.

The exported `APlotSurfaceElement` interface exposes:

- `present({ width, height, inner, filter, reset })` for composed geometry and reset
  presentation. Only canvases receive the filter.
- `configureCapture(configuration)` and `cursor` for controller-owned input policy.
- `measurechange`, `contextchange`, `wheelinput`, `pointerinput` and `resetrequest`
  events. Box and Capture details are forwarded unchanged. Capture cancels accepted
  wheel input synchronously. Native mouse events remain available on `capture`.
- `prepareCanvas(width, height, dpr)` for main-thread drawing, or `transferCanvases()`
  for worker ownership. Select ownership before acquiring either canvas context.
  Transfer is attempted once, including partial failure. The worker owns both
  backing stores and contexts thereafter; `present()` only changes CSS dimensions.
- Initial `measurement` and `context` snapshots. Use notifications for later changes.

Declarative hosts can use the same surface without a browser adapter:

- Set `presentation` to JSON encoding of `PlotSurfacePresentation`, and `cursor`
  to a CSS cursor. Removing presentation hides the capture area and reset control.
- Set native Capture attributes (`wheel-capture`, `wheel-modifier`,
  `pointer-capture`, etc.). `create_anta_host().capture_attributes(plot, viewport)`
  supplies these as strings suitable for a DOM bridge.
- Set `canvas-owner="worker"` before mounting. The surface emits one
  `canvastransfer` event with `{ canvas, highlight, scale }` after the mounting
  mutation batch. A worker bridge must include both canvases in its transfer list.
  The worker then acquires contexts and owns backing-store sizing.
- Listen for `plotmove`, `plotleave`, `plotclick`, and `plotdoubleclick` for
  coordinates relative to the capture area. `input-scope="parent"` also observes
  bubbling mouse events from host-owned tooltip siblings. Margins and reset
  controls are excluded from plot input.
- Listen for `surfaceerror` with `{ message }` to report presentation or transfer
  failures. Failed transfers are never retried.

`PlotSurfacePresentation`, `PlotSurfaceMouseInput`, `PlotSurfaceCanvases`, and
`PlotSurfaceEventMap` are available as types from the root package.

Disconnect removes forwarding listeners; Box and Capture stop their own observers,
listeners and pending work. Reconnection retains both canvases and their ownership.
A fresh worker mount must create a fresh surface. Hosts catch initialization/transfer
errors through their existing error-reporting path and must not retry transfer.

Tooltip content remains host-owned. Standalone attaches its tooltip to `capture`.
The notebook migration must keep its tooltip and VNodes in an outer worker-owned
wrapper, with the surface as a sibling, using Anta's following-tooltip behavior.
Publication and Star's dependency update are separate rollout steps; keep the current
notebook mounts until the new package is installed and notebook demos pass.

For focused browser lifecycle checks, run `pnpm run dev`, open the local site and
run this in its browser console (replace the absolute checkout path):

```js
const checks = await import('/@fs/absolute/path/to/anta/plot/scripts/check-surface-browser.mjs')
await checks.checkSurface()
```

The check replaces the current page body with a plot fixture. It covers notifications,
size pins, resize, hide/show, theme, context options, worker backing-store ownership,
single/partial transfers, reconnect/remount, synchronous Ctrl-wheel cancellation,
reset forwarding, teardown, and standalone sizing/drawing.

Host helpers and `create_anta_host` are exported directly from `@antadesign/plot`.
The former `/host` and `/anta` subpaths have been removed. Update those imports
when adopting this package version; browser registration remains in `/browser`.
