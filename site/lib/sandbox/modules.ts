/**
 * modules.ts — the known-module registry the in-browser bundler resolves
 * imports against. esbuild's resolve plugin maps `@antadesign/anta` (and
 * friends) to virtual files whose content is a tiny shim that reads from
 * `window.__demo_modules__` on the iframe's window. The iframe is seeded
 * with that object on first load (see Playground's iframe wiring).
 *
 * Keep the surface small: only modules we expect playground code to need.
 * Unknown imports become compile errors with a friendly message — the
 * user sees "Module '…' is not available in the demo sandbox" instead
 * of a cryptic bundler failure.
 */
import * as anta from '@antadesign/anta'
import * as preact from 'preact'
import * as preactHooks from 'preact/hooks'

/** The named exports the bundler will expose for each module path. The
 *  resolve plugin uses these names to emit a deterministic shim per
 *  module. Each name must exist on `getDemoModules()[path]` at runtime. */
export const moduleManifest: Record<string, string[]> = {
  '@antadesign/anta': ['Progress', 'Text', 'Title', 'Tag', 'Expander', 'Icon', 'Button', 'Tooltip', 'Input', 'Calendar', 'Checkbox', 'RadioGroup', 'Menu', 'MenuItem', 'MenuSeparator', 'MenuGroup', 'configure'],
  '@antadesign/anta/elements': [],  // side-effect only
  'preact': ['createElement', 'Fragment', 'h', 'render'],
  'preact/hooks': ['useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useReducer'],
}

/** Build the registry the iframe's `window.__demo_modules__` is seeded
 *  with. Called once per Playground mount. */
export function getDemoModules(): Record<string, Record<string, unknown>> {
  return {
    '@antadesign/anta': {
      Progress: (anta as any).Progress,
      Text: (anta as any).Text,
      Title: (anta as any).Title,
      Tag: (anta as any).Tag,
      Expander: (anta as any).Expander,
      Icon: (anta as any).Icon,
      Button: (anta as any).Button,
      Tooltip: (anta as any).Tooltip,
      Input: (anta as any).Input,
      Calendar: (anta as any).Calendar,
      Checkbox: (anta as any).Checkbox,
      RadioGroup: (anta as any).RadioGroup,
      Menu: (anta as any).Menu,
      MenuItem: (anta as any).MenuItem,
      MenuSeparator: (anta as any).MenuSeparator,
      MenuGroup: (anta as any).MenuGroup,
      configure: (anta as any).configure,
    },
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
