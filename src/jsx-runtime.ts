import React from 'react'

type ComponentType = string | Function | symbol

type JsxFunction = {
  h(type: ComponentType, props: Record<string, unknown> | null, ...children: unknown[]): unknown
}['h']

/** The hooks the stateful wrappers need. Typed loosely to stay renderer-agnostic —
 *  any React-compatible hook implementation. */
type UseState = <S>(initial: S | (() => S)) => [S, (next: S | ((prev: S) => S)) => void]
type UseId = () => string
type UseMemo = <T>(factory: () => T, deps: unknown[]) => T
type UseSyncExternalStore = <T>(
  subscribe: (onChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
) => T

let _jsx: JsxFunction = React.createElement as JsxFunction
let _Fragment: ComponentType = React.Fragment as ComponentType
// Default to React's hooks. Under Preact-compat (the documented Preact path), the
// `react` specifier already aliases to `preact/compat`, so these resolve to Preact's
// hooks automatically — no `configure()` needed. A non-compat custom runtime passes
// its own via `configure(jsx, Fragment, { useState, useId })`.
let _useState: UseState = React.useState as UseState
let _useId: UseId = React.useId as UseId
let _useMemo: UseMemo = React.useMemo as UseMemo
let _useSyncExternalStore: UseSyncExternalStore = React.useSyncExternalStore as UseSyncExternalStore

/**
 * Swap the underlying JSX factory (and, optionally, the hooks) used by all anta
 * components.
 *
 * Not needed for React or Preact-with-compat — those work automatically. Call this
 * before rendering any anta components when using Preact without compat aliasing,
 * or a custom JSX runtime. Pass `hooks` when your runtime's hooks don't resolve via
 * the `react` specifier (the stateful wrappers — `RadioGroup`, `Calendar`,
 * `InputDate` — need `useState` / `useId` / `useMemo`); omit it and they default
 * to whatever `react` resolves to.
 *
 * @example Preact without compat
 * ```ts
 * import { configure } from '@antadesign/anta'
 * import { h, Fragment } from 'preact'
 * import { useState, useId, useMemo } from 'preact/hooks'
 * configure(h, Fragment, { useState, useId, useMemo })
 * ```
 */
export function configure(
  jsx: JsxFunction,
  Fragment?: ComponentType,
  hooks?: {
    useState?: UseState
    useId?: UseId
    useMemo?: UseMemo
    useSyncExternalStore?: UseSyncExternalStore
  },
) {
  _jsx = jsx
  if (Fragment !== undefined) _Fragment = Fragment
  if (hooks?.useState) _useState = hooks.useState
  if (hooks?.useId) _useId = hooks.useId
  if (hooks?.useMemo) _useMemo = hooks.useMemo
  if (hooks?.useSyncExternalStore) _useSyncExternalStore = hooks.useSyncExternalStore
}

/** Hooks indirection so wrappers depend on the configured renderer, not a hard
 *  `import … from 'react'`. Call these exactly like the React hooks. */
export function useState<S>(initial: S | (() => S)): [S, (next: S | ((prev: S) => S)) => void] {
  return _useState(initial)
}
export function useId(): string {
  return _useId()
}
export function useMemo<T>(factory: () => T, deps: unknown[]): T {
  return _useMemo(factory, deps)
}
export function useSyncExternalStore<T>(
  subscribe: (onChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
): T {
  return _useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
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

import type { AProgressAttributes, ALoaderAttributes, ATextAttributes, ATitleAttributes, ATagAttributes, AExpanderAttributes, AIconAttributes, AButtonAttributes, ACopyAttributes, ACheckboxAttributes, ASwitchAttributes, ATooltipAttributes, AInputAttributes, ASliderAttributes, AInputTimeAttributes, ACalendarAttributes, ARadioAttributes, ARadioGroupAttributes, AMenuAttributes, AMenuItemAttributes, AMenuGroupAttributes, ATabsAttributes, ATabAttributes, ATabpanelAttributes, ADialogAttributes, ACardAttributes, ABannerAttributes, AToasterAttributes, AToastAttributes, BaseAttributes } from './general_types'

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
  'a-loader': ALoaderAttributes
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
  'a-copy': ACopyAttributes
  'a-checkbox': ACheckboxAttributes
  'a-checkbox-label': BaseAttributes
  'a-checkbox-hint': BaseAttributes
  'a-switch': ASwitchAttributes
  'a-switch-label': BaseAttributes
  'a-switch-hint': BaseAttributes
  'a-tooltip': ATooltipAttributes
  'a-input': AInputAttributes
  'a-slider': ASliderAttributes
  'a-input-time': AInputTimeAttributes
  'a-calendar': ACalendarAttributes
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
  'a-menu-header': BaseAttributes
  'a-menu-footer': BaseAttributes
  'a-select-header': BaseAttributes
  'a-select-footer': BaseAttributes
  'a-select-chevron': BaseAttributes & { open?: boolean | '' }
  'a-select-faceted-summary': BaseAttributes
  'a-menu-group': AMenuGroupAttributes
  'a-menu-group-label': BaseAttributes
  'a-tabs': ATabsAttributes
  'a-tab': ATabAttributes
  'a-tab-label': BaseAttributes
  'a-tabpanel': ATabpanelAttributes
  'a-dialog': ADialogAttributes
  'a-card': ACardAttributes
  'a-card-icon-chip': BaseAttributes
  'a-input-date-time-container': BaseAttributes
  'a-banner': ABannerAttributes
  'a-banner-message': BaseAttributes
  'a-toaster': AToasterAttributes
  'a-toast': AToastAttributes
}
