/**
 * modules.ts — the known-module registry the in-browser bundler resolves
 * imports against. esbuild's resolve plugin maps `@antadesign/anta` (and
 * friends) to virtual files whose content is a tiny shim that reads from
 * `window.__demo_modules__` on the iframe's window. The iframe is seeded
 * with that object on first load (see Playground's iframe wiring).
 *
 * The `@antadesign/anta` barrel is exposed *whole* — every runtime export is
 * available in playground code automatically, so any component (current or
 * future) can be imported or passed as children without a hand-maintained
 * allow-list to keep in sync. Other module paths stay curated. Unknown imports
 * become compile errors with a friendly message — the user sees "Module '…' is
 * not available in the demo sandbox" instead of a cryptic bundler failure.
 */
import * as anta from '@antadesign/anta'

/** Every runtime export of the anta barrel, filtered to valid JS identifiers so
 *  each name can be emitted as `export const <name>` in the bundler shim (drops
 *  `default` and any Symbol/toStringTag noise on the namespace object). */
const antaExportNames = Object.keys(anta).filter(
  (k) => k !== 'default' && /^[A-Za-z_$][\w$]*$/.test(k),
)

/** The named exports the bundler will expose for each module path. The
 *  resolve plugin uses these names to emit a deterministic shim per
 *  module. Each name must exist in the matching iframe runtime registry. */
export const moduleManifest: Record<string, string[]> = {
  // Plot's names stay a hand-written list, unlike the anta barrel above: deriving
  // them would mean importing the plot runtime (d3-scale, chroma-js) into the
  // editor bundle just to read `Object.keys`. Add a name here when a demo needs it.
  '@antadesign/plot': ['scatter', 'bar', 'line', 'area', 'rect', 'rule', 'custom'],
  '@antadesign/plot/react': ['Plot'],
  '@antadesign/plot/plot.css': [],
  '@antadesign/anta': antaExportNames,
  '@antadesign/anta/elements': [],  // side-effect only
  'preact': ['createElement', 'Fragment', 'h', 'render'],
  'preact/hooks': ['useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useReducer'],
}
