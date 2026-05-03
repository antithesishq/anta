export function hasChildren(children: React.ReactNode): boolean {
  return Array.isArray(children) ? children.length > 0 : children != null
}

/**
 * `HTMLElement` in browsers, a noop class in Node/Worker environments.
 * Use this as the base for custom element classes so importing the
 * module in a non-DOM environment doesn't throw on `extends HTMLElement`.
 * Instantiation in non-DOM environments still fails, but no consumer
 * should be doing that.
 */
export const HTMLElementBase = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement
