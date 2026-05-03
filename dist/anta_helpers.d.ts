export declare function hasChildren(children: React.ReactNode): boolean;
/**
 * `HTMLElement` in browsers, a noop class in Node/Worker environments.
 * Use this as the base for custom element classes so importing the
 * module in a non-DOM environment doesn't throw on `extends HTMLElement`.
 * Instantiation in non-DOM environments still fails, but no consumer
 * should be doing that.
 */
export declare const HTMLElementBase: typeof HTMLElement;
