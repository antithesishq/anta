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
| `@antadesign/plot` | Seven series factories, controllers, and public types |
| `@antadesign/plot/host` | Canvas, highlight, tooltip, and reset-button presentation helpers |
| `@antadesign/plot/anta` | Box and Capture event integration |
| `@antadesign/plot/browser` | DOM tooltip factories and explicit `definePlotElement()` registration |
| `@antadesign/plot/auto` | Browser registration with the `plotElementReady` promise |
| `@antadesign/plot/plot.css` | Plot layout stylesheet |

The root, host, and Anta integration entries do not load Anta or React at runtime. Browser registration loads Anta elements lazily. Imports are safe during server rendering; call `definePlotElement()` only in a browser.

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
