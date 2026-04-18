import React from 'react';
type JsxFunction = (type: any, props: any, key?: any) => any;
declare let _Fragment: any;
export declare function configure(jsx: JsxFunction, Fragment?: any): void;
export declare function jsx(type: any, props: any, key?: any): any;
export declare function jsxs(type: any, props: any, key?: any): any;
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
