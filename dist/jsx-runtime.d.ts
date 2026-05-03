import React from 'react';
type ComponentType = string | Function | symbol;
type JsxFunction = {
    h(type: ComponentType, props: Record<string, unknown> | null, ...children: unknown[]): unknown;
}['h'];
declare let _Fragment: ComponentType;
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
export declare function configure(jsx: JsxFunction, Fragment?: ComponentType): void;
export declare function jsx(type: ComponentType, props: Record<string, unknown> | null, key?: string | number): unknown;
export declare function jsxs(type: ComponentType, props: Record<string, unknown> | null, key?: string | number): unknown;
export { _Fragment as Fragment };
import type { AProgressAttributes, ATextAttributes, AIconAttributes, BaseAttributes } from './general_types';
export declare namespace JSX {
    type IntrinsicElements = React.JSX.IntrinsicElements & {
        'a-progress': AProgressAttributes;
        'a-progress-label': BaseAttributes;
        'a-progress-number': BaseAttributes;
        'a-progress-text': BaseAttributes;
        'a-progress-hint': BaseAttributes;
        'a-text': ATextAttributes;
        'a-icon': AIconAttributes;
    };
}
