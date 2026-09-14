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
import * as preact from 'preact'
import * as preactHooks from 'preact/hooks'

/** Every runtime export of the anta barrel, filtered to valid JS identifiers so
 *  each name can be emitted as `export const <name>` in the bundler shim (drops
 *  `default` and any Symbol/toStringTag noise on the namespace object). */
const antaExportNames = Object.keys(anta).filter(
  (k) => k !== 'default' && /^[A-Za-z_$][\w$]*$/.test(k),
)

/** The named exports the bundler will expose for each module path. The
 *  resolve plugin uses these names to emit a deterministic shim per
 *  module. Each name must exist on `getDemoModules()[path]` at runtime. */
export const moduleManifest: Record<string, string[]> = {
  '@antadesign/anta': antaExportNames,
  '@antadesign/anta/elements': [],  // side-effect only
  'preact': ['createElement', 'Fragment', 'h', 'render'],
  'preact/hooks': ['useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useReducer'],
}

/** Build the registry the iframe's `window.__demo_modules__` is seeded
 *  with. Called once per Playground mount. */
export function getDemoModules(): Record<string, Record<string, unknown>> {
  return {
    // Spread the whole barrel — mirrors `moduleManifest['@antadesign/anta']`.
    '@antadesign/anta': Object.fromEntries(
      antaExportNames.map((k) => [k, (anta as any)[k]]),
    ),
    '@antadesign/anta/elements': {},
    'preact': {
      createElement: preact.createElement,
      Fragment: preact.Fragment,
      h: preact.h,
      render: preact.render,
    },
    'preact/hooks': {
      useState: preactHooks.useState,
      useEffect: preactHooks.useEffect,
      useRef: preactHooks.useRef,
      useMemo: preactHooks.useMemo,
      useCallback: preactHooks.useCallback,
      useReducer: preactHooks.useReducer,
    },
  }
}
