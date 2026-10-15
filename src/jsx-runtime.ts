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
type UseRef = <T>(initial: T) => { current: T }
type UseLayoutEffect = (effect: () => void | (() => void), deps?: unknown[]) => void
type UseSyncExternalStore = <T>(
  subscribe: (onChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
) => T

let _jsx: JsxFunction = React.createElement as JsxFunction
let _Fragment: ComponentType = React.Fragment as ComponentType
/** Renderer hooks used by Anta wrappers. Pass the runtime's hooks object to
 * `configure()`. Only hooks used by the rendered components need to be present. */
export interface RendererHooks {
  useState?: UseState
  useId?: UseId
  useMemo?: UseMemo
  useRef?: UseRef
  useLayoutEffect?: UseLayoutEffect
  useSyncExternalStore?: UseSyncExternalStore
}

/** Renderer behavior configured before mounting components. */
export interface RendererOptions {
  /** Use `direct` when the renderer installs native event props immediately.
   * `after-mount` applies the browser hydration workaround. Server and worker
   * projections without `window` always forward event props immediately.
   * @defaultValue after-mount */
  nativeEventProps?: 'direct' | 'after-mount'
}

let _hooks: RendererHooks = React as RendererHooks
let _nativeEventProps: NonNullable<RendererOptions['nativeEventProps']> = 'after-mount'

/** @internal Read the event mode without exposing mutable renderer configuration. */
export function nativeEventPropsMode() {
  return _nativeEventProps
}

/**
 * Configure the JSX factory, fragment, and hooks before rendering Anta components.
 * React and Preact with React compatibility aliases work without configuration.
 *
 * Pass your runtime's hooks object as a whole. It replaces the previous object;
 * omitted hooks never fall back to another renderer. A missing hook reports an
 * error when a component uses it. Omitting the object restores React's hooks.
 * Configure the same package entry in each process or thread that renders JSX.
 * Set `options.nativeEventProps` to `direct` for renderers that install event
 * subscriptions immediately, including workers with a `window` shim. Omitting
 * options restores the browser's `after-mount` behavior. Configure before mounting;
 * do not switch event modes for a mounted tree.
 *
 * @example Custom renderer
 * ```ts
 * import { configure } from '@antadesign/anta'
 * import { h, Fragment } from 'preact'
 * import * as hooks from 'preact/hooks'
 * configure(h, Fragment, hooks)
 * ```
 */
export function configure(
  jsx: JsxFunction,
  Fragment?: ComponentType,
  hooks: RendererHooks = React as RendererHooks,
  options: RendererOptions = {},
) {
  _jsx = jsx
  if (Fragment !== undefined) _Fragment = Fragment
  _hooks = hooks
  _nativeEventProps = options.nativeEventProps ?? 'after-mount'
}

function rendererHook<K extends keyof RendererHooks>(name: K): NonNullable<RendererHooks[K]> {
  const hook = _hooks[name]
  if (typeof hook !== 'function') {
    throw new Error(`Anta: the configured renderer is missing ${name}. Pass its hooks object to configure().`)
  }
  return hook as NonNullable<RendererHooks[K]>
}

/** Hooks delegate to the object supplied to `configure()`, or React by default. */
export function useState<S>(initial: S | (() => S)): [S, (next: S | ((prev: S) => S)) => void] {
  return rendererHook('useState')(initial)
}
export function useId(): string {
  return rendererHook('useId')()
}
export function useMemo<T>(factory: () => T, deps: unknown[]): T {
  return rendererHook('useMemo')(factory, deps)
}
export function useRef<T>(initial: T): { current: T } {
  return rendererHook('useRef')(initial)
}
export function useLayoutEffect(effect: () => void | (() => void), deps?: unknown[]): void {
  return rendererHook('useLayoutEffect')(effect, deps)
}
export function useSyncExternalStore<T>(
  subscribe: (onChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
): T {
  return rendererHook('useSyncExternalStore')(subscribe, getSnapshot, getServerSnapshot)
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

import type { AAvatarAttributes, AProgressAttributes, ALoaderAttributes, ATextAttributes, ATextContentAttributes, ABoxAttributes, ACaptureAttributes, APanelAttributes, ATitleAttributes, ATagAttributes, AExpanderAttributes, AExpanderSummaryAttributes, AExpanderIndicatorAttributes, AIconAttributes, AButtonAttributes, ACopyAttributes, ACheckboxAttributes, ASwitchAttributes, ATooltipAttributes, AInputAttributes, ASliderAttributes, AInputTimeAttributes, ACalendarAttributes, ARadioAttributes, ARadioGroupAttributes, AMenuAttributes, AMenuItemAttributes, AMenuGroupAttributes, ATabsAttributes, ATabAttributes, ATabpanelAttributes, ADialogAttributes, ACardAttributes, ABannerAttributes, AToasterAttributes, AToastAttributes, BaseAttributes } from './general_types'

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
  'a-avatar': AAvatarAttributes
  'a-progress': AProgressAttributes
  'a-loader': ALoaderAttributes
  'a-progress-label': BaseAttributes
  'a-progress-number': BaseAttributes
  'a-progress-text': BaseAttributes
  'a-progress-hint': BaseAttributes
  'a-text': ATextAttributes
  'a-text-content': ATextContentAttributes
  'a-box': ABoxAttributes
  'a-capture': ACaptureAttributes
  'a-panel': APanelAttributes
  'a-title': ATitleAttributes
  'a-tag': ATagAttributes
  'a-tag-label': BaseAttributes
  'a-tag-value': BaseAttributes
  'a-expander': AExpanderAttributes
  'a-expander-summary': AExpanderSummaryAttributes
  'a-expander-title': BaseAttributes
  'a-expander-actions': BaseAttributes
  'a-expander-indicator': AExpanderIndicatorAttributes
  'a-expander-details': BaseAttributes
  'a-icon': AIconAttributes
  'a-button': AButtonAttributes
  'a-button-label': BaseAttributes
  'a-breadcrumbs': BaseAttributes
  'a-breadcrumb-separator': BaseAttributes
  'a-copy': ACopyAttributes
  'a-checkbox': ACheckboxAttributes
  'a-checkbox-label': BaseAttributes
  'a-checkbox-hint': BaseAttributes
  'a-switch': ASwitchAttributes
  'a-switch-label': BaseAttributes
  'a-switch-hint': BaseAttributes
  'a-tooltip': ATooltipAttributes
  'a-input': AInputAttributes
  'a-input-label': BaseAttributes
  'a-input-leading': BaseAttributes
  'a-input-clear': BaseAttributes
  'a-input-trailing': BaseAttributes
  'a-input-hint': BaseAttributes
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
  'a-select-field': BaseAttributes & { size?: string; status?: string; disabled?: boolean | '' }
  'a-select-label': BaseAttributes
  'a-select-hint': BaseAttributes
  'a-select-leading': BaseAttributes
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
  'a-steps': BaseAttributes
  'a-step-marker': BaseAttributes
  'a-step-desc': BaseAttributes
  'a-step-hint': BaseAttributes
  'a-dialog': ADialogAttributes
  'a-card': ACardAttributes
  'a-card-icon-chip': BaseAttributes
  'a-card-footer': BaseAttributes
  'a-card-media': BaseAttributes
  'a-card-content': BaseAttributes
  'a-card-header': BaseAttributes
  'a-card-icon': BaseAttributes
  'a-card-title': BaseAttributes
  'a-card-body': BaseAttributes
  'a-input-date-time-container': BaseAttributes
  'a-banner': ABannerAttributes
  'a-banner-message': BaseAttributes
  'a-banner-content': BaseAttributes
  'a-banner-actions': BaseAttributes
  'a-banner-close': BaseAttributes
  'a-toaster': AToasterAttributes
  'a-toast': AToastAttributes
}
