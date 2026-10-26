// Enough of `react` for the element bundle: the shared helpers import the JSX
// runtime, which reads these at module load but never calls them here.
const unused = () => { throw new Error('react is not available in the virtual scroll fixture') }
export const createElement = unused
export const Fragment = Symbol('Fragment')
export const useState = unused
export const useId = unused
export const useMemo = unused
export const useRef = unused
export const useLayoutEffect = unused
export const useSyncExternalStore = unused
export default { createElement, Fragment, useState, useId, useMemo, useRef, useLayoutEffect, useSyncExternalStore }
