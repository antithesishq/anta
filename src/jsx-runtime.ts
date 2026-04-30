import React from 'react'

type ComponentType = string | Function | symbol

type JsxFunction = {
  h(type: ComponentType, props: Record<string, unknown> | null, ...children: unknown[]): unknown
}['h']

let _jsx: JsxFunction = React.createElement as JsxFunction
let _Fragment: ComponentType = React.Fragment as ComponentType

/**
 * Swap the underlying JSX factory used by all anta components.
 *
 * Not needed for React or Preact-with-compat — those work automatically.
 * Call this before rendering any anta components when using Preact without
 * compat aliasing, or a custom JSX runtime.
 *
 * @example Preact without compat
 * ```ts
 * import { configure } from '@antadesign/anta'
 * import { h, Fragment } from 'preact'
 * configure(h, Fragment)
 * ```
 */
export function configure(jsx: JsxFunction, Fragment?: ComponentType) {
  _jsx = jsx
  if (Fragment !== undefined) _Fragment = Fragment
}

export function jsx(type: ComponentType, props: Record<string, unknown> | null, key?: string | number): unknown {
  const { children, ...rest } = props ?? {}
  const p: Record<string, unknown> = key !== undefined ? { ...rest, key } : rest
  if (children !== undefined) {
    return _jsx(type, p, children)
  }
  return _jsx(type, p)
}

export function jsxs(type: ComponentType, props: Record<string, unknown> | null, key?: string | number): unknown {
  const { children, ...rest } = props ?? {}
  const p: Record<string, unknown> = key !== undefined ? { ...rest, key } : rest
  if (children !== undefined) {
    return _jsx(type, p, ...(children as unknown[]))
  }
  return _jsx(type, p)
}

export { _Fragment as Fragment }

import type { AProgressAttributes, BaseAttributes } from './general_types'

export namespace JSX {
  export type IntrinsicElements = React.JSX.IntrinsicElements & {
    'a-progress': AProgressAttributes
    'a-progress-label': BaseAttributes
    'a-progress-number': BaseAttributes
    'a-progress-text': BaseAttributes
    'a-progress-hint': BaseAttributes
  }
}
