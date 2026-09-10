# @antadesign/plot

Canvas plots with series factories, shared interaction controllers, host integration helpers, and an optional `<a-plot>` browser host. React and Preact wrappers are deferred. Anta is a regular dependency; React is a peer, as it is for stickers.

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

## Shared plot surface

`definePlotSurfaceElement()` from `/browser` registers `<a-plot-surface>` and its Box,
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
