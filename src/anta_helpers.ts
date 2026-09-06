import { jsx, useState, useMemo } from "./jsx-runtime"
import type { IconShape } from "./elements/a-icon.shapes"
import type { OptionPresentationProps } from "./general_types"

export function hasChildren(children: React.ReactNode): boolean {
  return Array.isArray(children) ? children.length > 0 : children != null
}

/**
 * Select the safe presentation attributes from a data-rendered option. Option
 * objects often carry application data, so wrappers must never spread them onto
 * their rendered element. Menu rows also own `data-menu-*`: those attributes
 * control closing and combobox navigation, and letting an option replace them
 * would desynchronize its selection behavior.
 */
export function optionPresentationAttrs(
  option: OptionPresentationProps,
  menu = false,
): OptionPresentationProps {
  const attrs: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(option)) {
    if (
      name === 'className' ||
      name === 'style' ||
      (name.startsWith('data-') &&
        (!menu || (!name.startsWith('data-menu-') && name !== 'data-anta-menu-item')))
    )
      attrs[name] = value
  }
  return attrs as OptionPresentationProps
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
/**
 * The event a cross-renderer `statechange` handler receives: React wraps the native
 * `CustomEvent` in a synthetic event (`.nativeEvent`); Preact passes it directly. `D`
 * is the per-component `detail` vocabulary. Pair with `nativeStateChange` to unwrap.
 * Exported so the stateful wrappers (`Banner`, and future ones) don't each re-declare
 * this union — the AGENTS.md "reuse shared wrapper helpers" rule.
 */
export type StateChangeEvent<D> = CustomEvent<D> | { nativeEvent: CustomEvent<D> }

export function nativeStateChange<D>(
  e: StateChangeEvent<D>,
): { event: CustomEvent<D>; detail?: D; isOwn: boolean } {
  const event = ('nativeEvent' in e ? e.nativeEvent : e) as CustomEvent<D>
  return { event, detail: event?.detail, isOwn: !event || event.target === event.currentTarget }
}

/** Adapt a callback to native or renderer-wrapped custom events with non-null detail. */
export function customEventHandler<D>(handler?: (event: CustomEvent<D>, detail: D) => void) {
  if (!handler) return undefined
  return (input: StateChangeEvent<D>) => {
    const { event, detail } = nativeStateChange(input)
    if (detail != null) handler(event, detail)
  }
}

/** Parse a finite number, falling back for missing, empty, or invalid values. */
export function finiteNumber(value: string | number | null, fallback: number): number {
  if (value == null || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
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

/** Install a delegated "dismiss from an action" click handler: any element inside
 *  `host` carrying `[attr]` runs `onDismiss` on click, scoped to the nearest host
 *  of `host`'s own tag (so a control inside a nested same-tag element doesn't also
 *  dismiss the outer one). A read-only light-DOM walk — no host / tree mutation —
 *  that catches any activated control (native `<button>`, `<a>`, `<a-button>`,
 *  `<a-menu-item>`) with keyboard activation for free. Shared by `a-toast`
 *  (`data-toast-dismiss`) and `a-banner` (`data-banner-dismiss`), mirroring
 *  `a-dialog`'s `data-dialog-close` family; keep the one copy here so a future fix
 *  (e.g. skipping `[disabled]` triggers) lands for every element at once. */
export function installDismissTrigger(host: HTMLElement, attr: string, onDismiss: () => void): void {
  host.addEventListener('click', (e) => {
    const target = e.target
    if (!(target instanceof Element)) return
    const trigger = target.closest(`[${attr}]`)
    if (trigger && trigger.closest(host.localName) === host) onDismiss()
  })
}

/** The six named tones every toned component shares. Anything else is a literal
 *  CSS color the element resolves through its `--{component}-tone-source` var. */
export const NAMED_TONES = new Set([
  'brand',
  'neutral',
  'info',
  'success',
  'warning',
  'critical',
])

/**
 * Inline-style helper for a custom (non-named) tone: hands the literal color to
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

/** Converts a numeric or string length to CSS text. Numbers become pixels. */
export function cssLength(length: number | string | undefined): string | undefined {
  if (typeof length === 'number') return `${length}px`
  return length || undefined
}

/** Adds a CSS length to an inline custom property. Numbers become pixels; a
 * non-empty string is used verbatim. Returns `base` unchanged when absent. */
export function lengthStyle(
  length: number | string | undefined,
  varName: string,
  base?: React.CSSProperties,
): React.CSSProperties | undefined {
  const value = cssLength(length)
  return value ? { ...base, [varName]: value } : base
}

/** Inline-style helper for a valued `round`. Its boolean form leaves the
 * element's default full-round radius in place. */
export function roundStyle(
  round: boolean | number | string | undefined,
  varName: string,
  base?: React.CSSProperties,
): React.CSSProperties | undefined {
  return lengthStyle(typeof round === 'number' || typeof round === 'string' ? round : undefined, varName, base)
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

/** How long the copy success / failure feedback stays on the control (ms). */
const COPY_FEEDBACK_MS = 2000

/**
 * Copy-feedback state for `ButtonCopy` / `MenuItemCopy` (and any future copy
 * preset). The `<a-button>` / `<a-menu-item>` element performs the clipboard
 * write and fires a `copydone` event; this hook holds the transient result and
 * maps it to the icon + tone the wrapper renders: a `check` / `success` on
 * success, an `x` / `critical` on failure, otherwise the caller's own values.
 * Returns the `handleCopied` listener the wrapper wires to `onCopied`.
 *
 * Kept here (not duplicated per preset) so the timing, glyph choice, and timer
 * cleanup live in one place. Hooks come through the `jsx-runtime` indirection, so
 * a custom non-React runtime supplies its own via `configure()`.
 */
export function useCopyFeedback(
  icon: IconShape | undefined,
  tone: string | undefined,
  onCopied?: (ok: boolean) => void,
): { shownIcon: IconShape | undefined; shownTone: string | undefined; handleCopied: (ok: boolean) => void } {
  const [status, setStatus] = useState<'idle' | 'ok' | 'fail'>('idle')
  // useMemo with [] deps is a stable per-instance holder — a useRef stand-in the
  // jsx-runtime indirection doesn't re-export.
  const box = useMemo(() => ({ timer: undefined as ReturnType<typeof setTimeout> | undefined }), [])

  const handleCopied = (ok: boolean) => {
    clearTimeout(box.timer)
    setStatus(ok ? 'ok' : 'fail')
    box.timer = setTimeout(() => setStatus('idle'), COPY_FEEDBACK_MS)
    onCopied?.(ok)
  }

  // Swap only during the feedback window; otherwise the caller's own icon / tone.
  const shownIcon: IconShape | undefined = status === 'ok' ? 'check' : status === 'fail' ? 'x' : icon
  const shownTone = status === 'ok' ? 'success' : status === 'fail' ? 'critical' : tone
  return { shownIcon, shownTone, handleCopied }
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
    // Re-plumb a pre-upgrade `selected` write through the accessor (standard
    // lazy-upgrade pattern): a property assigned before upgrade lands as an
    // own data property that would shadow the class accessor forever.
    if (Object.prototype.hasOwnProperty.call(this, 'selected')) {
      const v = this.selected
      delete (this as { selected?: boolean }).selected
      this.selected = v
    }
    if (this.hasAttribute('selected')) this.applyState(true)
  }

  attributeChangedCallback(name: string) {
    if (name === 'selected') this.applyState(this.hasAttribute('selected'))
  }

  get selected(): boolean {
    return this.internals?.states?.has('selected') ?? false
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
    if (on) this.internals?.states?.add('selected')
    else this.internals?.states?.delete('selected')
    this.internals[this.ariaProp] = on ? 'true' : 'false'
  }
}
