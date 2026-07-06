import React from 'react'

type ComponentType = string | Function | symbol

type JsxFunction = {
  h(type: ComponentType, props: Record<string, unknown> | null, ...children: unknown[]): unknown
}['h']

/** The two hooks the stateful wrappers (currently only `RadioGroup`) need. Typed
 *  loosely to stay renderer-agnostic — any React-compatible hook implementation. */
type UseState = <S>(initial: S | (() => S)) => [S, (next: S | ((prev: S) => S)) => void]
type UseId = () => string

let _jsx: JsxFunction = React.createElement as JsxFunction
let _Fragment: ComponentType = React.Fragment as ComponentType
// Default to React's hooks. Under Preact-compat (the documented Preact path), the
// `react` specifier already aliases to `preact/compat`, so these resolve to Preact's
// hooks automatically — no `configure()` needed. A non-compat custom runtime passes
// its own via `configure(jsx, Fragment, { useState, useId })`.
let _useState: UseState = React.useState as UseState
let _useId: UseId = React.useId as UseId

/**
 * Swap the underlying JSX factory (and, optionally, the hooks) used by all anta
 * components.
 *
 * Not needed for React or Preact-with-compat — those work automatically. Call this
 * before rendering any anta components when using Preact without compat aliasing,
 * or a custom JSX runtime. Pass `hooks` when your runtime's hooks don't resolve via
 * the `react` specifier (the stateful wrappers — `RadioGroup` — need `useState` /
 * `useId`); omit it and they default to whatever `react` resolves to.
 *
 * @example Preact without compat
 * ```ts
 * import { configure } from '@antadesign/anta'
 * import { h, Fragment } from 'preact'
 * import { useState, useId } from 'preact/hooks'
 * configure(h, Fragment, { useState, useId })
 * ```
 */
export function configure(
  jsx: JsxFunction,
  Fragment?: ComponentType,
  hooks?: { useState?: UseState; useId?: UseId },
) {
  _jsx = jsx
  if (Fragment !== undefined) _Fragment = Fragment
  if (hooks?.useState) _useState = hooks.useState
  if (hooks?.useId) _useId = hooks.useId
}

/** Hooks indirection so wrappers depend on the configured renderer, not a hard
 *  `import … from 'react'`. Call these exactly like the React hooks. */
export function useState<S>(initial: S | (() => S)): [S, (next: S | ((prev: S) => S)) => void] {
  return _useState(initial)
}
export function useId(): string {
  return _useId()
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

import type { AProgressAttributes, ATextAttributes, ATitleAttributes, ATagAttributes, AExpanderAttributes, AIconAttributes, AButtonAttributes, ACheckboxAttributes, ATooltipAttributes, AInputAttributes, ARadioAttributes, ARadioGroupAttributes, AMenuAttributes, AMenuItemAttributes, AMenuGroupAttributes, ATabsAttributes, ATabAttributes, ATabpanelAttributes, BaseAttributes } from './general_types'

// Declared as an `interface` (not a type alias) so downstream companion
// packages — e.g. `@antadesign/stickers` — can augment it with their own
// custom-element tags via `declare module '@antadesign/anta/jsx-runtime'`.
export namespace JSX {
  export interface IntrinsicElements extends React.JSX.IntrinsicElements, AntaIntrinsicElements {}
  // Lets `key` (and other framework-managed attrs) be passed to *component*
  // elements — e.g. mapping `<MenuItem key=… />` in a list. Intrinsic `a-*`
  // elements already accept `key` via BaseAttributes; this is the equivalent for
  // wrapper components, which otherwise only accept their own props.
  export interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
}

export interface AntaIntrinsicElements {
  'a-progress': AProgressAttributes
  'a-progress-label': BaseAttributes
  'a-progress-number': BaseAttributes
  'a-progress-text': BaseAttributes
  'a-progress-hint': BaseAttributes
  'a-text': ATextAttributes
  'a-title': ATitleAttributes
  'a-tag': ATagAttributes
  'a-tag-label': BaseAttributes
  'a-tag-value': BaseAttributes
  'a-expander': AExpanderAttributes
  'a-expander-summary': BaseAttributes
  'a-expander-details': BaseAttributes
  'a-icon': AIconAttributes
  'a-button': AButtonAttributes
  'a-button-label': BaseAttributes
  'a-checkbox': ACheckboxAttributes
  'a-checkbox-label': BaseAttributes
  'a-checkbox-hint': BaseAttributes
  'a-tooltip': ATooltipAttributes
  'a-input': AInputAttributes
  'a-radio': ARadioAttributes
  'a-radio-group': ARadioGroupAttributes
  'a-radio-group-label': BaseAttributes
  'a-radio-group-hint': BaseAttributes
  'a-radio-list': BaseAttributes
  'a-radio-label': BaseAttributes
  'a-radio-hint': BaseAttributes
  'a-menu': AMenuAttributes
  'a-menu-item': AMenuItemAttributes
  'a-menu-item-label': BaseAttributes
  'a-menu-item-hint': BaseAttributes
  'a-menu-item-text': BaseAttributes
  'a-menu-separator': BaseAttributes
  'a-menu-group': AMenuGroupAttributes
  'a-menu-group-label': BaseAttributes
  'a-tabs': ATabsAttributes
  'a-tab': ATabAttributes
  'a-tab-label': BaseAttributes
  'a-tabpanel': ATabpanelAttributes
}
