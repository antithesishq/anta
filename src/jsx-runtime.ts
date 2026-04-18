import React from 'react'

type JsxFunction = (type: any, props: any, key?: any) => any

let _jsx: JsxFunction = React.createElement
let _Fragment: any = React.Fragment

export function configure(jsx: JsxFunction, Fragment?: any) {
  _jsx = jsx
  if (Fragment !== undefined) _Fragment = Fragment
}

export function jsx(type: any, props: any, key?: any): any {
  const { children, ...rest } = props ?? {}
  const p = key !== undefined ? { ...rest, key } : rest
  if (children !== undefined) {
    return _jsx(type, p, children)
  }
  return _jsx(type, p)
}

export function jsxs(type: any, props: any, key?: any): any {
  const { children, ...rest } = props ?? {}
  const p = key !== undefined ? { ...rest, key } : rest
  if (children !== undefined) {
    return _jsx(type, p, ...children)
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
