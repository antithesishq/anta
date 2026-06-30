import { jsx } from "./jsx-runtime"

export function hasChildren(children: React.ReactNode): boolean {
  return Array.isArray(children) ? children.length > 0 : children != null
}

/**
 * Normalize a wrapper's label content the way `Button` / `Tabs` do: a bare string
 * or number becomes a `<tag>` — the ellipsis-capable label part (`a-button-label`,
 * `a-tab-label`, …) that carries the optical baseline nudge and truncates cleanly;
 * empty / whitespace strings and `NaN` carry no content and are dropped; a JSX
 * element is the consumer's own structure, passed through unwrapped (so an icon-only
 * child keeps its layout). Shared so the rule lives in one place — don't re-implement
 * it per component.
 */
export function wrapLabel(kids: React.ReactNode, tag: string): React.ReactNode {
  if (kids == null) return kids
  const arr = Array.isArray(kids) ? kids : [kids]
  return arr.map((child, i) => {
    if (typeof child === "string") return child.trim() === "" ? null : jsx(tag, { children: child }, i)
    if (typeof child === "number") return Number.isNaN(child) ? null : jsx(tag, { children: child }, i)
    if (child == null || typeof child === "boolean") return null
    return child
  }) as React.ReactNode
}

/**
 * Unwrap a `statechange` (or any) `CustomEvent` a renderer may deliver wrapped:
 * React hands a synthetic event with the real one on `.nativeEvent`; Preact passes
 * the native event directly. Returns the native event and its `detail`. Shared by
 * every stateful wrapper (`Menu`, `Expander`, `Checkbox`, `RadioGroup`) — don't
 * re-implement it per component.
 */
export function nativeStateChange<D>(
  e: CustomEvent<D> | { nativeEvent: CustomEvent<D> },
): { event: CustomEvent<D>; detail?: D } {
  const event = ('nativeEvent' in e ? e.nativeEvent : e) as CustomEvent<D>
  return { event, detail: event?.detail }
}

/** The six named tones every toned component shares. Anything else is a literal
 *  CSS colour the element resolves through its `--{component}-tone-source` var. */
export const NAMED_TONES = new Set([
  'brand',
  'neutral',
  'info',
  'success',
  'warning',
  'critical',
])

/**
 * Inline-style helper for a custom (non-named) tone: hands the literal colour to
 * the element via `varName` (e.g. `--radio-tone-source`) so the element's CSS
 * derives the fill/text/border curve in oklch. Named tones return `base` unchanged.
 */
export function toneStyle(
  tone: string | undefined,
  varName: string,
  base?: React.CSSProperties,
): React.CSSProperties | undefined {
  return tone != null && !NAMED_TONES.has(tone)
    ? { ...base, [varName]: tone }
    : base
}

/**
 * `HTMLElement` in browsers, a noop class in Node/Worker environments.
 * Use this as the base for custom element classes so importing the
 * module in a non-DOM environment doesn't throw on `extends HTMLElement`.
 * Instantiation in non-DOM environments still fails, but no consumer
 * should be doing that.
 */
const NativeHTMLElement = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement

/**
 * Base for Anta custom elements. Adds realm-correct `view` / `doc` getters:
 * the class may be defined in one realm while the element lives in another
 * (the docs playground renders into an iframe but reuses the parent page's
 * element class), so the module-global `window` / `document` can point at the
 * wrong frame. Anything viewport- or document-scoped — clamping,
 * `getComputedStyle`, scroll / key / pointer listeners — must go through these
 * so it's correct in any frame. Shared by a-tooltip and a-menu.
 */
export class HTMLElementBase extends NativeHTMLElement {
  /** This element's own window (the iframe's window when nested). */
  protected get view(): Window & typeof globalThis {
    return (this.ownerDocument?.defaultView as Window & typeof globalThis) ?? window
  }
  /** This element's own document (the iframe's document when nested). */
  protected get doc(): Document {
    return this.ownerDocument ?? document
  }
}
