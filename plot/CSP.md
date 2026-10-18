# Plot content security policy

Load `@antadesign/plot/plot.css` once in each browser document. JSX `Plot`,
`PlotSurface`, and standalone `<a-plot>` share this external stylesheet. All
JavaScript entries keep Plot's CSS separate. An application bundler must extract
CSS imports into a stylesheet loaded from an allowed origin. To load CSS from HTML,
serve `dist/plot.css` alongside your application bundle and use an external
stylesheet link.

## Styling audit

| Surface | Fixed presentation | Runtime presentation |
| --- | --- | --- |
| JSX wrapper | External `[data-plot-root]` layout | Accepted width and height pins, plus consumer `style` props |
| Standalone host | External `:where(a-plot)` defaults | Explicit dimension pins and restoration of previous CSSOM values |
| PlotSurface | External positioning, inherited typography, and canvas stacking | Measured canvas sizes, capture bounds, cursor, and theme filter |
| Selection rectangle | External border, fill, box sizing, and pointer behavior | Rectangle coordinates and dimensions; `hidden` controls visibility |
| Zoom menu anchor | External positioning and pointer behavior | Focus availability and menu action state |
| Tooltip | External divider styling and empty-body visibility | Renderer-owned content; Anta Tooltip owns following and popover positioning |

Plot creates no style elements, constructed stylesheets, or stylesheet rules at
runtime. It does not assign `cssText`, parse HTML, or call `setAttribute('style',
...)`. Dynamic geometry uses individual CSSOM properties or `setProperty()`.
Those properties still serialize into the DOM's style attribute. Lifecycle
capture visibility also uses direct CSSOM updates, so an unpresented capture
stays hidden while the shared stylesheet loads. The browser checks distinguish these writes from parsed inline attributes rather than
requiring the style attribute to be absent.

The shared stylesheet reserves Anta's cascade layers. Application CSS can override
host defaults. PlotSurface inherits the application font, feature settings, and
variable font settings. Light DOM and canvas ownership stay unchanged. Surfaces
retain their canvases across reconnection and document adoption. Load the shared
stylesheet and the application's Anta styles in the destination document before
adoption.

## Policy boundaries

The browser suite serves this policy as an HTTP response header:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; style-src-elem 'self'; style-src-attr 'none'; worker-src 'self'; object-src 'none'
```

External scripts and CSS load from the same origin. No nonce, hash, inline-style
permission, or evaluation permission is required by the Plot fixtures. A negative
control verifies that the browser rejects an injected style element and a parsed
style attribute while accepting direct CSSOM property updates.

React and Preact serialize explicit `plotArgs.width` / `height` and consumer
`style` props into inline attributes during server rendering. Those attributes
are blocked by `style-src-attr 'none'`. For strict SSR, omit dimension and `style`
props during server rendering and size the plot with an external class. Default
SSR markup emits no style attributes. Client-rendered dimension updates use
CSSOM. Custom tooltip content and application styles must meet the same policy.

Development CSS loaders that inject style elements need a different policy or
an extraction configuration. External workers need an allowed `worker-src`;
applications using blob workers must also allow `blob:`. The worker test uses
an external script and transfers both OffscreenCanvases to it. Plot does not
create the application's renderer worker or its DOM bridge.

## Browser validation

Run these commands from the repository root after building Anta and Plot:

```sh
pnpm --filter @antadesign/plot build
pnpm --filter @antadesign/plot typecheck
pnpm --filter @antadesign/plot check:package
pnpm --filter @antadesign/plot test:browser
pnpm --filter @antadesign/plot test:csp
pnpm --filter @antadesign/plot test:csp:package
ANTA_PLOT_COMPARE_REF=aa014ae37fe99b91a422fa6827a9267d7f50ea3b pnpm --filter @antadesign/plot test:csp
```

The CSP suite covers React and Preact hydration, low-level PlotSurface, every
public browser registration entry, capture geometry, visible highlights,
selection rectangles, tooltips, pointer and keyboard menus, zoom/pan, sizing,
theme/font inheritance, cleanup, reconnection, and document adoption. The
existing component suite additionally checks React StrictMode, discarded renders,
DPR changes, error recovery, and renderer lifecycle boundaries.

The package runner installs local npm tarballs of Plot and Anta in a temporary
consumer. It resolves every supported export and checks the bundled inputs for
package provenance before repeating the CSP matrix. It also compiles and runs
JSX, low-level surface, standalone, and overview examples extracted from the
installed Markdown documentation without repairing their imports. It does not use workspace
links or source aliases. Tarballs are packed with scripts disabled from the
already built output.

The comparison command uses the immutable commit before the external-CSS change.
Comparison tests require a repository checkout with that commit in its history.

The fast tier runs core Chromium regressions. The slow tier adds Firefox,
WebKit, all standalone entries, and isolated package installation. These engines
do not establish compatibility with every historical browser version.
`ANTA_PLOT_COMPARE_REF` adds light/dark screenshots, pixel comparisons, exact geometry,
and viewport interaction comparisons against the chosen Git revision. Baseline
pages allow their original injected styles. Current pages retain strict CSP.
Screenshot pages allow a hash for the exact
`body {}` rule that Playwright's WebKit screenshot code inserts to synchronize
animations. Functional pages use the unmodified policy above.
Artifacts are saved under `tests/.test-output/plot/`.
