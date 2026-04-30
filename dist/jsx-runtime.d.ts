import React from 'react';
type ComponentType = string | Function | symbol;
type JsxFunction = {
    h(type: ComponentType, props: Record<string, unknown> | null, ...children: unknown[]): unknown;
}['h'];
declare let _Fragment: ComponentType;
export declare function configure(jsx: JsxFunction, Fragment?: ComponentType): void;
export declare function jsx(type: ComponentType, props: Record<string, unknown> | null, key?: string | number): unknown;
export declare function jsxs(type: ComponentType, props: Record<string, unknown> | null, key?: string | number): unknown;
export { _Fragment as Fragment };
import type { AProgressAttributes, BaseAttributes } from './general_types';
export declare namespace JSX {
    type IntrinsicElements = React.JSX.IntrinsicElements & {
        'a-progress': AProgressAttributes;
        'a-progress-label': BaseAttributes;
        'a-progress-number': BaseAttributes;
        'a-progress-text': BaseAttributes;
        'a-progress-hint': BaseAttributes;
    };
}
