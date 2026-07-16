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
 *
 * `isOwn` is `true` when the event was dispatched on the element the listener is
 * bound to (`target === currentTarget`), `false` when it bubbled up from a
 * descendant. `statechange` is a shared event name with a per-component `detail`
 * vocabulary, so a container wrapper (`Dialog`, `Menu`, `Expander`) that projects
 * arbitrary children must gate on `isOwn` before acting: a foreign bubbling
 * `statechange` from a nested control would otherwise be read in the wrong
 * vocabulary (a checkbox toggle looking like a dialog close). Anta's own controls
 * no longer bubble `statechange`, so this is defense-in-depth against consumer /
 * third-party elements that do. Read synchronously during dispatch, so
 * `currentTarget` is still live. (Read as `true` for the falsy-event guard so a
 * missing event never spuriously reads as bubbled.)
 */
export function nativeStateChange<D>(
  e: CustomEvent<D> | { nativeEvent: CustomEvent<D> },
): { event: CustomEvent<D>; detail?: D; isOwn: boolean } {
  const event = ('nativeEvent' in e ? e.nativeEvent : e) as CustomEvent<D>
  return { event, detail: event?.detail, isOwn: !event || event.target === event.currentTarget }
}

// macOS labels the "isolate" accelerator ⌥ (Option); every other platform, Alt.
// `altKey` fires for both at runtime — only the hint wording differs.
export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent || '')
/** Default row hint teaching the Alt/⌥-click "select only this" accelerator on
 *  bulk-select rows (`Select` multiple, `SelectFaceted` multiple facets). Shared
 *  so the wording stays identical across both. */
export const ISOLATE_HINT = IS_MAC ? '⌥+Click to select only this' : 'Alt+Click to select only this'

/** Parse an open/closed `state` / `default-state` attribute — the shared
 *  open-state vocabulary (`a-dialog`, `a-expander`, …). Anything but the literal
 *  `'open'` is `'closed'`, so an absent / malformed attribute reads closed. Kept
 *  here so the two elements can't drift on how the token is parsed. */
export function parseOpenState(v: string | null): 'open' | 'closed' {
  return v === 'open' ? 'open' : 'closed'
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
 * Inline-style helper for a valued `round` — the polymorphic corner-radius prop
 * (`true` = fully round, a `number`/length = a custom radius). Mirrors `toneStyle`:
 * a custom value is handed to the element via `varName` (e.g. `--button-round`), so
 * the element's CSS resolves `border-radius: var(--{c}-round, <default>)`. This is
 * the portable path — the element's `attr(round type(<length>), …)` default only
 * resolves on newer engines, exactly like the tone-source `attr()`.
 *
 * A `number` becomes `<n>px`; a non-empty `string` is used verbatim (so `'1rem'` /
 * `'50%'` work). `true` / `false` / `undefined` add nothing (presence alone → the
 * element's default full-round). Returns `base` unchanged when there's no value.
 */
export function roundStyle(
  round: boolean | number | string | undefined,
  varName: string,
  base?: React.CSSProperties,
): React.CSSProperties | undefined {
  if (typeof round === 'number') return { ...base, [varName]: `${round}px` }
  if (typeof round === 'string' && round !== '') return { ...base, [varName]: round }
  return base
}

/**
 * Presence flag for a `round` attribute: `''` when a radius applies, else
 * `undefined`. A bare `round ? '' : undefined` wrongly drops `round={0}` — the
 * caller asking for square corners — since `0` is falsy; this keeps it (and drops
 * `false` / `undefined` / `''`). Mirrors what `roundStyle` emits a variable for.
 */
export function roundAttr(round: boolean | number | string | undefined): '' | undefined {
  return round || round === 0 ? '' : undefined
}

/**
 * The rect a floating-element anchor advertises for positioning. Any element may
 * implement `getAnchorRect(): DOMRect` to point positioners (`a-menu`,
 * `a-tooltip`) at a sub-region of itself — e.g. `a-input` returns its `.field`
 * box rather than the host, whose box also spans the label / hint, so a menu or
 * tooltip lines up with the field itself. Elements without it fall back to their
 * border box (`getBoundingClientRect`), so this is opt-in and back-compatible.
 * Shared by a-menu and a-tooltip.
 */
export function anchorRect(el: Element): DOMRect {
  const fn = (el as { getAnchorRect?: () => DOMRect }).getAnchorRect
  return typeof fn === 'function' ? fn.call(el) : el.getBoundingClientRect()
}

/**
 * Menu ↔ Tooltip presence coordinator — in-memory only, no DOM. `a-menu`
 * publishes whether a menu system is open and whether a node sits inside it;
 * `a-tooltip` reads this to suppress a tooltip anchored *outside* an open menu.
 * (Menu and tooltip are both top-layer popovers, stacked by show order, so a
 * tooltip opened while a menu is up would paint over it — z-index can't reorder
 * the top layer.) Decoupled on purpose: neither element imports the other, and
 * if `a-menu` never loads the provider stays null and every tooltip shows.
 */
export interface MenuPresence {
  /** Is any `a-menu` open? */
  isOpen(): boolean
  /** Is `node` inside the open menu system — a menu surface, a slotted item, or
   *  an open trigger? (A tooltip there is a menu-item tooltip and still shows,
   *  above the menu.) */
  contains(node: Node): boolean
}
let menuPresence: MenuPresence | null = null
/** `a-menu` registers its live open-state provider here (once, on load). */
export function setMenuPresence(p: MenuPresence | null): void {
  menuPresence = p
}
/** True while any `a-menu` is open. */
export function isMenuOpen(): boolean {
  return menuPresence?.isOpen() ?? false
}
/** True if `node` sits inside the open menu system. */
export function isInsideOpenMenu(node: Node): boolean {
  return menuPresence?.contains(node) ?? false
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

/**
 * Base for a coordinated presentational child — one option in a control whose
 * parent owns the selection (`<a-radio>` in `<a-radio-group>`, `<a-tab>` in
 * `<a-tabs>`). The parent is the single source of truth and pushes selection down
 * by setting the `selected` *property* (never an attribute — that would mutate the
 * child's DOM, which app-DOM-in-a-worker forbids). This child's only job is to
 * reflect that into a `:state(selected)` custom state (the CSS hook) and one ARIA
 * property — `aria-checked` for radios, `aria-selected` for tabs — through its OWN
 * ElementInternals. It owns no selection *logic*: the `internals` bit is a render
 * latch, not authoritative state.
 *
 * The `selected` attribute is a hand-author / raw-assembly seed for the initial
 * paint only. `connectedCallback` reads it **ON-only, never OFF**: under eager
 * element registration the parent connects first (parent-before-child tree order)
 * and has already set the property by the time this runs, so forcing OFF for an
 * absent attribute would silently clobber that initial selection (state right,
 * nothing painted). The resting latch is already off, so seeding only-ON loses
 * nothing. After connect, both the property setter and `attributeChangedCallback`
 * drive selection two-way. Encoding the guard here (not per element) is what makes
 * the clobber bug impossible by construction for every child that extends this.
 *
 * Subclasses set `ariaProp` to the ARIA reflection property their role needs.
 */
export class SelectableChildElement extends HTMLElementBase {
  static observedAttributes = ['selected']
  /** ARIA property this element reflects selection into. Subclass sets it. */
  protected ariaProp: 'ariaChecked' | 'ariaSelected' = 'ariaChecked'
  private internals? = this.attachInternals?.()

  connectedCallback() {
    if (this.hasAttribute('selected')) this.applyState(true)
  }

  attributeChangedCallback(name: string) {
    if (name === 'selected') this.applyState(this.hasAttribute('selected'))
  }

  get selected(): boolean {
    return this.internals?.states.has('selected') ?? false
  }
  /**
   * Live selection, held off the DOM as `:state(selected)` (mirrored to `ariaProp`).
   * The parent `a-radio-group` / `a-tabs` drives it by assigning the *property* a real
   * boolean from its `sync()` (`el.selected = r === selectedEl`), so a genuine boolean
   * is the only input the setter sees in practice.
   *
   * `!!on` is deliberate and matches native IDL booleans: `el.selected = ''` yields
   * `false`, exactly like `input.disabled = '' → false`. Empty string is a falsy
   * *value*; "presence means true" is an attribute-world rule (it governs `hasAttribute`
   * in `attributeChangedCallback` and CSS `[selected]` matching) and does not carry to
   * property assignment. React 19 assigns element props as properties, so a hand-written
   * `<a-radio selected="">` there reads as `false` while the same markup in plain HTML
   * reads as `true` — the split every boolean IDL property has. Write bare `selected` /
   * `selected={true}` for on; both paths agree. Do not "fix" `!!on` to treat `''` as true.
   */
  set selected(on: boolean) {
    this.applyState(!!on)
  }

  get value(): string {
    return this.getAttribute('value') ?? ''
  }
  set value(v: string) {
    this.setAttribute('value', v)
  }

  protected applyState(on: boolean) {
    if (!this.internals) return
    if (on) this.internals.states.add('selected')
    else this.internals.states.delete('selected')
    this.internals[this.ariaProp] = on ? 'true' : 'false'
  }
}
