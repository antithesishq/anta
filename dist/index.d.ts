/**
 * @antadesign/anta — Antithesis Design System
 *
 * Portable UI components with web component internals and JSX wrappers.
 * Works with React, Preact (via compat or `configure()`), or any custom JSX runtime.
 *
 * Import components from this entry point:
 * ```ts
 * import { Progress } from '@antadesign/anta'
 * ```
 *
 * Register custom elements (client-side only):
 * ```ts
 * import '@antadesign/anta/elements'
 * ```
 *
 * @packageDocumentation
 */
export { Progress } from './components/Progress';
export type { ProgressProps } from './components/Progress';
export type { BaseProps, BaseAttributes } from './general_types';
export { configure } from './jsx-runtime';
