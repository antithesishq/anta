import { HTMLElementBase, anchorRect, setMenuPresence } from '../anta_helpers'
import { AMenuItemElement, isMenuItemEl, ensureMenuItemKeyListener } from './a-menu-item'
import { emitCopyRequest } from './copy-behavior'
import './a-menu.css'

/** Gap (px) the surface keeps from the anchor / viewport edge. */
const MARGIN = 4
/** Smallest usable surface height when space is tight (it scrolls inside). */
const MIN_HEIGHT = 96
/** Hover-open / hover-close intent delays for submenus (ms). */
const SUBMENU_OPEN_DELAY = 130
const SUBMENU_CLOSE_DELAY = 130
/** Typeahead buffer reset window (ms). */
const TYPEAHEAD_RESET = 500
/** The open system dismisses once its trigger has scrolled so that less than this
 *  fraction of it still overlaps the spot it occupied when the menu opened — a
 *  size-proportional delta (an IntersectionObserver threshold), not a fixed px.
 *  See trackPosition: this replaces a raw scroll listener, so it reacts to the
 *  anchor moving for ANY reason (page scroll, a scroll container, a layout shift)
 *  and never self-dismisses from the page nudge that opening can cause. */
const ANCHOR_VISIBLE_RATIO = 0.5

/** Triggers that turn Enter/Space into a click on their own — native
 *  buttons/links, `[role=button]`, and `<a-button>`. The keyboard-open skips
 *  them: their click already opens, so a second open would toggle shut. */
const SELF_ACTIVATING =
  'a-button, button, a[href], input[type="button"], input[type="submit"], input[type="reset"], [role="button"]'
/** Text-entry triggers that aren't read-only: Enter/Space belong to the field
 *  (typing / commit), so only the arrows open the menu — the native `<select>`
 *  gesture. Read-only or non-field triggers open on Enter / Space / arrows alike. */
const EDITABLE_FIELD =
  'input:not([readonly]), textarea:not([readonly]), a-input:not([readonly]), a-input-time:not([readonly])'

type Placement =
  | 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'bottom' | 'top'
  | 'right-start' | 'right-end' | 'left-start' | 'left-end' | 'right' | 'left'

/** `statechange` event detail (see STATEFUL-COMPONENTS.md). `next` is the
 *  requested state, `prev` the current one — both in the `'open'|'closed'`
 *  vocabulary of the `state` attribute, so a controlled handler reads
 *  `setState(e.detail.next)`. `coord` (computed context placement) and
 *  `originEvent` (what triggered it) are derived results the caller can't
 *  recompute, so they belong in the payload. */
type MenuState = 'open' | 'closed'
type StateChangeDetail = {
  next: MenuState
  prev: MenuState
  coord?: [number, number]
  originEvent?: Event
}

/* ------------------------------------------------------------------ *
 * Module-level coordinator — PURE IN-MEMORY JS, never touches the DOM
 * tree or host attributes (the host app may reconcile light DOM from a
 * worker thread). It only tracks the open stack and calls each element's
 * own _doShow()/_doHide(), which mutate only their shadow internals, plus
 * el.focus() (moving focus is not a tree mutation).
 * ------------------------------------------------------------------ */
const openStack: AMenuElement[] = []

let docBound = false
let boundDoc: Document | null = null
let boundView: (Window & typeof globalThis) | null = null
/** Disconnect for the open system's anchor position tracker (see trackPosition /
 *  armPositionTracker). The system dismisses when the root trigger scrolls out of
 *  the spot it held at open, instead of on raw scroll events. */
let removePosTracker: (() => void) | null = null

function bindDocListeners(doc: Document, view: Window & typeof globalThis) {
  if (docBound) return
  doc.addEventListener('pointerdown', onDocPointerDown, true)
  doc.addEventListener('keydown', onDocKeyDown, true)
  doc.addEventListener('keyup', onDocKeyUp, true)
  doc.addEventListener('contextmenu', onDocContextMenu, true)
  view.addEventListener('resize', onResize)
  boundDoc = doc
  boundView = view
  docBound = true
}

function unbindDocListeners() {
  if (!docBound) return
  boundDoc?.removeEventListener('pointerdown', onDocPointerDown, true)
  boundDoc?.removeEventListener('keydown', onDocKeyDown, true)
  boundDoc?.removeEventListener('keyup', onDocKeyUp, true)
  boundDoc?.removeEventListener('contextmenu', onDocContextMenu, true)
  boundView?.removeEventListener('resize', onResize)
  removePosTracker?.()
  removePosTracker = null
  boundDoc = null
  boundView = null
  docBound = false
}

/** Fire `onEscape` once `el` has moved so that less than ANCHOR_VISIBLE_RATIO of
 *  it still overlaps the rect it occupied at setup. An IntersectionObserver whose
 *  root is shrunk (via negative rootMargin) to el's current rect; el sliding past
 *  the threshold drops `isIntersecting`. Read-only (no DOM mutation). Returns a
 *  disconnect fn. (Ported from the prior menu's browser_utils.trackPosition.) */
function trackPosition(el: HTMLElement, onEscape: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {}
  const doc = el.ownerDocument
  // Window the observer to el's OWN box — it's the element we observe, so the
  // intersection ratio is (el ∩ window) / el, ≈1 at rest and only dropping as el
  // scrolls away. Do NOT use anchorRect here: getAnchorRect may advertise a
  // sub-region (a-input returns its `.field`, excluding the label + hint), and
  // windowing the full host to that smaller rect starts the ratio below the
  // threshold — a tall label+hint field would self-dismiss the instant it opened.
  // (Positioning still uses anchorRect elsewhere, to align the menu to the field.)
  const rect = el.getBoundingClientRect()
  const vw = doc.documentElement.clientWidth
  const vh = doc.documentElement.clientHeight
  // Negative margins shrink the viewport root down to el's current rect.
  const rootMargin = `${-rect.top}px ${-(vw - rect.right)}px ${-(vh - rect.bottom)}px ${-rect.left}px`
  // Root choice depends on the frame context:
  //   • Top level: `null` (the viewport). The negative rootMargin windows the
  //     viewport to el's open-time rect, so scrolling el out of view drops the
  //     ratio and dismisses — what we want. A pinned `documentElement` root
  //     scrolls together with el, so its ratio never drops and the menu floats
  //     detached, which is wrong here.
  //   • Inside an iframe: a `null` root resolves against the TOP-LEVEL viewport,
  //     so the iframe-relative rootMargin windows the wrong region and reports the
  //     at-rest anchor out-of-view, dismissing a frame after it opens.
  //     `documentElement` keeps the measurement iframe-local (and, scrolling with
  //     el, leaves an embedded preview's menu open as the outer page scrolls).
  const win = doc.defaultView
  const root = win && win !== win.top ? doc.documentElement : null
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) onEscape()
    },
    { root, rootMargin, threshold: ANCHOR_VISIBLE_RATIO },
  )
  io.observe(el)
  return () => io.disconnect()
}

/** A node is "inside the open menu system" if the event path crosses any
 *  open menu's surface or its anchor. `composedPath` crosses shadow
 *  boundaries, so slotted custom content (a slider, an input) counts as
 *  inside — clicking it never dismisses the menu.
 *
 *  `primaryClick` marks a left-button pointerdown. A context menu's anchor is
 *  the whole region it follows and re-triggers ONLY on right-click, so on a
 *  normal left-click it isn't part of the menu system — a click on it must
 *  dismiss like any outside click. (A click-trigger anchor stays exempt so its
 *  own click handler toggles instead of racing the dismiss.) */
function pathHitsMenus(e: Event, primaryClick = false): boolean {
  const path = e.composedPath()
  for (const m of openStack) {
    if (path.includes(m.surface)) return true
    const anchor = m.triggerAnchor
    if (!anchor) continue
    if (primaryClick && m.hasAttribute('context')) continue
    if (path.includes(anchor)) return true
  }
  return false
}

function pathCrossesTopLayerBeforeAnchor(e: Event, anchor: HTMLElement): boolean {
  for (const node of e.composedPath()) {
    if (node === anchor) return false
    if (
      (node instanceof HTMLDialogElement && node.matches(':modal')) ||
      (node instanceof HTMLElement && node.matches(':popover-open'))
    )
      return true
  }
  return false
}

/** Is `node` part of any open menu — its shadow surface or its slotted
 *  light-DOM content (the menu items)? Published to `anta_helpers` so
 *  `a-tooltip` suppresses every tooltip that isn't part of an open menu (it
 *  would otherwise paint over the menu). The trigger anchor is deliberately
 *  NOT counted: a context menu's anchor is the whole right-clicked region, and
 *  even a dropdown's trigger sits outside the menu, so their tooltips must stay
 *  suppressed while the menu is open. */
function nodeHitsMenus(node: Node): boolean {
  for (const m of openStack) {
    if (m.contains(node) || m.surface.contains(node)) return true
  }
  return false
}

// Live open-state provider (reads `openStack` directly, so no push/pop
// instrumentation is needed). Set once on module load; `a-tooltip` consumes it.
setMenuPresence({
  isOpen: () => openStack.length > 0,
  contains: nodeHitsMenus,
})

function onDocPointerDown(e: Event) {
  if (!openStack.length) return
  if (!pathHitsMenus(e, (e as MouseEvent).button === 0)) dismiss(e)
}

function onDocContextMenu(e: Event) {
  if (!openStack.length) return
  // Right-click inside the menu system (or on an open anchor) is left alone —
  // a context anchor's own handler repositions rather than toggling.
  if (!pathHitsMenus(e)) dismiss(e)
}

function onResize() {
  if (!openStack.length) return
  dismiss()
}

function onDocKeyDown(e: KeyboardEvent) {
  const menu = openStack[openStack.length - 1]
  if (!menu) return
  menu.handleKey(e)
}

function onDocKeyUp(e: KeyboardEvent) {
  const menu = openStack[openStack.length - 1]
  if (!menu) return
  menu.handleKeyUp(e)
}

/** Dismiss the open system (outside-click / resize / anchor scrolled out of
 *  view). Routed through the root's `requestClose`, so it emits `statechange` and
 *  respects a controlled root (which stays open until the consumer flips
 *  `state`). */
function dismiss(originEvent?: Event) {
  openStack[0]?.requestClose(originEvent)
}

/** Force-close the whole stack, top-down, emitting `statechange` for each menu
 *  that was open. Used when a fresh root menu takes over (a hard replace) —
 *  the backstop for the "at most one menu system on screen" invariant. A
 *  controlled menu is force-hidden too: its polite, controlled-respecting
 *  dismissal already happened via the outside-pointerdown path (see
 *  `_dismissNotified`, which keeps it from receiving `statechange` twice). A
 *  consumer who ignores `statechange` ends with `state="open"` but a hidden
 *  menu — the same misuse class as ignoring `onChange` on a controlled input.
 *  This is a force-close backstop, so the emit is notify-only (the veto result
 *  is ignored). */
function closeAll() {
  for (let i = openStack.length - 1; i >= 0; i--) {
    const m = openStack[i]
    if (m.isOpen && !m._dismissNotified) m.emitChange('closed')
    m._doHide()
  }
  openStack.length = 0
  unbindDocListeners()
}

/* ------------------------------------------------------------------ *
 * Lazy-listener observer — attach the trigger listeners only while the
 * anchor is on-screen (also correctness under DOM reconciliation: it
 * re-attaches when the anchor reappears, tears down when it leaves).
 * ------------------------------------------------------------------ */
const anchorToMenu = new WeakMap<Element, AMenuElement>()

function handleIntersection(entries: IntersectionObserverEntry[]) {
  for (const entry of entries) {
    const menu = anchorToMenu.get(entry.target)
    if (!menu) continue
    if (!menu.listening && entry.isIntersecting) {
      requestAnimationFrame(() => menu.setupListeners())
    } else if (menu.listening && !entry.isIntersecting) {
      requestAnimationFrame(() => {
        menu.teardownListeners()
        // An anchor scrolled out of view shouldn't leave an orphaned menu.
        if (menu.isOpen) menu.close()
      })
    }
  }
}

const lazyObserver: IntersectionObserver | null =
  typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(handleIntersection, { root: null, rootMargin: '0px', threshold: 0 })
    : null

/**
 * `<a-menu>` — dropdown / context menu surface (shadow popover, JS
 * positioning, keyboard nav, click delegation, open-stack coordination).
 *
 * Styling notes (`a-menu.css` ships comment-free):
 * - `a-menu:not(:defined)` is hidden — before upgrade the host is an unknown
 *   inline element and its light-DOM items would flash in the page. Once
 *   defined, the shadow `:host { display: contents }` governs and content
 *   renders only inside the popover surface via the slot.
 * - Only the surface "chrome" is tokenized (`--menu-*`): it lives inside the
 *   shadow popover, unreachable from plain consumer CSS; the custom
 *   properties inherit across the shadow boundary into the surface. Items are
 *   slotted light DOM (see `a-menu-item.css`), directly styleable.
 */
export class AMenuElement extends HTMLElementBase {
  static observedAttributes = ['placement', 'context', 'coord', 'offset', 'nohover', 'state']

  /** Shadow-internal popover surface — the only thing we ever mutate. */
  surface!: HTMLDivElement
  /** The scrolling body inside the surface (holds the items). */
  private scrollEl!: HTMLDivElement

  listening = false
  private _shown = false
  private teardown?: () => void

  /** A controlled menu was told to dismiss (it emitted `statechange→'closed'`)
   *  but stays visible until the consumer flips `state`. The flag lets the
   *  `closeAll` backstop skip a duplicate emit. Cleared on every show. */
  _dismissNotified = false

  // Custom-state carrier — exposes the menu's own open state as `:state(open)`
  // (off-DOM, like `a-menu-item`'s `:state(active)`). Never used to mutate light
  // DOM; see `reflectOpen`.
  private internals?: ElementInternals

  // Submenu hover-intent timers.
  private openTimer?: ReturnType<typeof setTimeout>
  private closeTimer?: ReturnType<typeof setTimeout>

  // Typeahead state (root navigation).
  private typeBuffer = ''
  private typeTimer?: ReturnType<typeof setTimeout>

  // Combobox (filter) state — engaged when a `[data-menu-search]` field is slotted
  // in (e.g. `Select` with `filter`). Focus stays in that field; ArrowUp/Down move
  // `activeItem` (a cursor, not DOM focus) and REPORT it via the `activedescendant`
  // event, which the reactive layer reflects onto the field's `aria-activedescendant`.
  private activeItem: AMenuItemElement | null = null
  private comboObserver?: MutationObserver
  // The vertical side chosen at open (true = flipped above the anchor). A re-anchor
  // (filtering changes height) keeps this side rather than re-deciding — a shrunk
  // menu shouldn't hop back under the trigger.
  private _flippedTop: boolean | null = null
  // The horizontal side chosen at open for a `right`/`left` placement (true =
  // flipped to the left of the anchor). Same reanchor-stability role as `_flippedTop`.
  private _flippedSide: boolean | null = null

  constructor() {
    super()
    // Off-DOM state only (`:state(open)`); guarded for non-standard runtimes.
    try {
      this.internals = this.attachInternals?.()
    } catch {}
    const shadow = this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    // Shadow surface CSS (kept comment-free — this string ships into every
    // consumer document). The shadow root holds exactly one element, the
    // surface div with a <slot> inside, so the bare `div` selector is
    // unambiguous; slotted light DOM isn't matched by shadow selectors.
    // Two non-obvious rules, learned the hard way:
    // - `display` is set ONLY on `:popover-open`. Any author display on the
    //   closed state beats the UA `[popover]:not(:popover-open){display:none}`
    //   rule regardless of specificity, which would keep a CLOSED popover laid
    //   out in the top layer — invisible yet still hoverable/clickable. Closed
    //   stays UA-governed (plus the discrete `display` transition below), so a
    //   closed menu is truly gone once the exit finishes.
    // - Enter AND exit are a CSS transition (opacity + a vertical `translate`),
    //   with `display`/`overlay` transitioned via `allow-discrete` so the menu
    //   animates OUT before leaving the top layer, and `@starting-style` driving
    //   the enter. (An earlier attempt got stuck at display:flex/opacity 0 after
    //   close — including `overlay` in the transition is what fixes that.)
    //   Resting at opacity 0 also hides the first paint, before position() sets
    //   the transform. Where `allow-discrete`/`@starting-style` are unsupported
    //   (older Safari/Firefox) it degrades to an instant open/close.
    style.textContent = `
      :host { display: contents; }

      .container {
        position: fixed;
        left: 0;
        top: 0;
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        flex-direction: column;
        min-width: max(var(--menu-min-width, 88px), var(--_anchor-width, 0px));
        max-width: calc(100vw - ${2 * MARGIN}px);
        max-height: calc(100dvh - ${2 * MARGIN}px);
        overflow: hidden;
        background: var(--menu-bg, Canvas);
        color: var(--text-2, CanvasText);
        border: var(--menu-border, 1px solid);
        border-radius: var(--menu-radius, 8px);
        box-shadow: var(--menu-shadow, 0 8px 24px rgba(0,0,0,0.2));
        -webkit-backdrop-filter: var(--menu-backdrop-filter, blur(20px));
        backdrop-filter: var(--menu-backdrop-filter, blur(20px));
        outline: none;

        /* Closed / exit state — fade + a tiny vertical settle (no horizontal
           shift). This 140ms governs the EXIT (open → closed); the enter is a
           touch quicker (see :popover-open below) so the menu feels snappy to
           open but unhurried to dismiss. 'display' and 'overlay' transition with
           'allow-discrete' so the menu stays in the top layer and visible while
           it animates OUT, then hides. */
        opacity: 0;
        translate: 0 -4px;
        transition:
          opacity 140ms ease-out,
          translate 140ms ease-out,
          width var(--menu-width-duration, 160ms) ease,
          display 140ms allow-discrete,
          overlay 140ms allow-discrete;
      }
      .container:popover-open {
        display: flex;
        opacity: 1;
        translate: 0 0;
        /* Enter (closed → open) — quicker than the exit above. */
        transition:
          opacity 100ms ease-out,
          translate 100ms ease-out,
          width var(--menu-width-duration, 160ms) ease,
          display 100ms allow-discrete,
          overlay 100ms allow-discrete;
      }
      /* Enter: start from the closed state and transition in. */
      @starting-style {
        .container:popover-open { opacity: 0; translate: 0 -4px; }
      }
      /* The scrolling body — only the items scroll; the header / footer slots stay
         fixed above and below it. min-height:0 lets it shrink so its own scrollbar
         engages instead of the flex item overflowing. The 1px inter-item gap that
         used to live on the container lives here now. */
      .scroll {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        /* The menu's padding lives here (not on the clipping container) so an item's
           focus outline has room inside the scroll box instead of being clipped at
           the edge; scroll-padding keeps a focused row off the edge when scrolled. */
        padding: var(--menu-padding, 4px);
        scroll-padding-block: var(--menu-padding, 4px);
        /* Soft scroll edges: fade the content into the top / bottom only on the side
           with more to scroll (the --fade-* vars, set from JS, are 0 otherwise). The
           top also clears a hard --gap-top band (fully transparent, ahead of the ramp)
           so a row scrolling up disappears cleanly under a pinned header / filter field
           before the fade begins, instead of bleeding right against it. */
        --fade-top: 0px;
        --fade-bottom: 0px;
        --gap-top: 0px;
        -webkit-mask-image: linear-gradient(to bottom, transparent 0, transparent var(--gap-top), #000 var(--fade-top), #000 calc(100% - var(--fade-bottom)), transparent 100%);
        mask-image: linear-gradient(to bottom, transparent 0, transparent var(--gap-top), #000 var(--fade-top), #000 calc(100% - var(--fade-bottom)), transparent 100%);
      }
    `
    this.surface = document.createElement('div')
    this.surface.className = 'container'
    // Exposed as a shadow part so consumers can style the popover surface
    // (background, radius, shadow, padding) from plain CSS — `a-menu::part(menu)` —
    // instead of the `--menu-*` custom properties.
    this.surface.setAttribute('part', 'menu')
    this.surface.setAttribute('popover', 'manual')
    // Three regions: a fixed `header` slot, a scrolling body (the default slot,
    // holding the items), and a fixed `footer` slot. Only the body scrolls, so
    // pinned content (a filter field, a footer action) stays put and the scrollbar
    // spans just the items. `header`/`footer` slots are empty (0-height) for a plain
    // menu, so the body fills the surface exactly as before.
    const header = document.createElement('slot')
    header.setAttribute('name', 'header')
    const scroll = document.createElement('div')
    scroll.className = 'scroll'
    scroll.setAttribute('part', 'scroll')
    scroll.append(document.createElement('slot'))
    scroll.addEventListener('scroll', () => this.updateScrollFade(), { passive: true })
    this.scrollEl = scroll
    const footer = document.createElement('slot')
    footer.setAttribute('name', 'footer')
    this.surface.append(header, scroll, footer)

    // Keep an open submenu alive while the pointer is inside it. Hover-intent is
    // mouse-only: touch/pen emit compatibility pointerenter/leave for a tap, and
    // acting on those would close a just-tapped submenu (the synthetic leave
    // fires the moment the finger lifts / the popover appears). Touch falls back
    // to tap-to-open, which stays open until dismissed.
    this.surface.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return
      if (this.isSubmenu) this.cancelCloseTimer()
    })
    this.surface.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return
      if (this.isSubmenu && this.#isHover) this.scheduleClose()
    })

    // Single delegated click for activation + the close contract.
    this.surface.addEventListener('click', this.onSurfaceClick)

    shadow.append(style, this.surface)
  }

  connectedCallback() {
    // Ensure Enter/Space activation works even for a menu built only from link
    // items (`<a data-anta-menu-item>`), where no `<a-menu-item>` ever upgrades
    // to install the listener itself. Idempotent per document.
    ensureMenuItemKeyListener(this.doc)
    const anchor = this.triggerAnchor
    if (anchor) {
      anchorToMenu.set(anchor, this)
      lazyObserver?.observe(anchor)
    }
    // Apply an initial controlled state (e.g. <a-menu state="open">) once
    // connected — attributeChangedCallback may have fired before this during
    // upgrade, when the anchor / layout weren't ready yet.
    if (this.hasAttribute('state')) requestAnimationFrame(() => this.syncState())
  }

  disconnectedCallback() {
    // Silent teardown — don't emit `statechange` for an element being removed.
    this.hide()
    this.teardownListeners()
    this.cancelOpenTimer()
    this.cancelCloseTimer()
    const anchor = this.triggerAnchor
    if (anchor && anchorToMenu.get(anchor) === this) {
      anchorToMenu.delete(anchor)
      lazyObserver?.unobserve(anchor)
    }
  }

  attributeChangedCallback(name: string) {
    // `state` is the controlled lever: reflect it into visibility, SILENTLY
    // (no `statechange` — the consumer set it, so re-emitting would just echo
    // back into their own handler; that silence is what prevents a loop).
    if (name === 'state') {
      this.syncState()
      return
    }
    // Trigger-shaping attributes changed — rewire the anchor listeners.
    if (this.listening) {
      this.teardownListeners()
      this.setupListeners()
    }
  }

  /** Apply the controlled `state` attribute to actual visibility, silently.
   *  Absent → uncontrolled (no-op here; triggers manage it). */
  private syncState() {
    if (!this.isConnected) return // initial state is applied from connectedCallback
    const v = this.getAttribute('state')
    if (v === 'open' && !this._shown) this.show()
    else if (v === 'closed' && this._shown) this.hide()
  }

  /** Controlled iff the consumer is managing the `state` attribute. */
  get isControlled(): boolean {
    return this.hasAttribute('state')
  }


  /* --- config getters --- */
  /** A submenu is an `<a-menu>` that is a DIRECT child of an `<a-menu-item>` —
   *  derived from structure, no `submenu` attribute needed (the parent item is the
   *  anchor). A menu merely *nested somewhere inside* an item's subtree (a composed
   *  control — `Select` / `InputDate` — slotted into a flyout) is NOT a submenu: it
   *  anchors to its own previous sibling and nests as a child of its container. */
  get isSubmenu(): boolean {
    return !!this.parentElement && isMenuItemEl(this.parentElement)
  }
  get #isContext(): boolean {
    return this.hasAttribute('context')
  }
  get #isCoord(): boolean {
    return this.hasAttribute('coord')
  }
  // Submenus open on hover by default; `nohover` opts out (click-only). Root
  // menus never consult this — it's read only on the submenu paths.
  get #isHover(): boolean {
    return !this.hasAttribute('nohover')
  }
  get #offset(): number {
    const n = parseInt(this.getAttribute('offset') ?? '', 10)
    return Number.isFinite(n) ? n : MARGIN
  }
  get #placement(): Placement {
    const p = this.getAttribute('placement')
    if (
      p === 'bottom-end' || p === 'top-start' || p === 'top-end' ||
      p === 'bottom' || p === 'top' ||
      p === 'right-start' || p === 'right-end' || p === 'left-start' ||
      p === 'left-end' || p === 'right' || p === 'left'
    )
      return p
    return 'bottom-start'
  }

  /** Root menu: the previous element sibling is the trigger. Submenu: the
   *  enclosing menu item. One deterministic rule per case — no ambiguity. */
  get triggerAnchor(): HTMLElement | null {
    // A DIRECT child of an `<a-menu-item>` is that item's submenu (anchor = the
    // item). Otherwise it's a root / composed menu whose anchor is its explicit
    // previous element sibling — e.g. `Select`'s field, `InputDate`'s field.
    // This holds even when the menu sits deep inside another item's subtree (a
    // composed control slotted into a flyout): its anchor is still the sibling
    // control it was authored next to, NOT the enclosing menu-item. (Using
    // `closest('a-menu-item')` here bound such a menu to the wrong ancestor item,
    // so it never opened from its real trigger.)
    const parent = this.parentElement
    if (parent && isMenuItemEl(parent)) return parent
    return this.previousElementSibling as HTMLElement | null
  }

  /** The focusable element to hand focus back to — the anchor itself if it's
   *  focusable, else the first focusable within it. Positioning still uses the
   *  anchor's box; this only picks the focus target. A custom `renderTrigger`
   *  that returns a single focusable element (the documented contract) resolves
   *  to that element; if it wrongly returns a non-focusable node with none
   *  inside, this is null and `focusTrigger` warns. */
  get #triggerFocusable(): HTMLElement | null {
    const a = this.triggerAnchor
    if (!a) return null
    const sel =
      'a-input, a-button, button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'
    return a.matches(sel) ? a : a.querySelector<HTMLElement>(sel)
  }

  /** Return focus to the trigger. Focuses the first focusable in the anchor; if
   *  there is none (a mis-authored trigger — e.g. `renderTrigger` returning a
   *  fragment or a non-focusable node), warns instead of silently focusing air. */
  private focusTrigger() {
    const f = this.#triggerFocusable
    if (f) f.focus()
    else if (this.triggerAnchor) {
      console.warn(
        '[a-menu] trigger has no focusable element — a menu trigger (or `Select` renderTrigger) must be a single focusable element.',
      )
    }
  }

  /** For a submenu: the menu that contains its anchor item. */
  get #ownerMenu(): AMenuElement | null {
    if (!this.isSubmenu) return null
    return (this.triggerAnchor?.closest('a-menu') as AMenuElement | null) ?? null
  }

  get isOpen(): boolean {
    return this._shown
  }

  /* --- focusable items belonging to THIS menu (not nested submenus) --- */
  /** Skip elements that can't actually take focus — `display:none` (incl. a
   *  closed submenu's contents), `visibility:hidden`, `content-visibility`
   *  skipped — so navigation never lands on a hidden node (programmatic
   *  `.focus()` on one silently fails). `getClientRects` is the fallback where
   *  `checkVisibility` isn't available. */
  private isVisible(el: HTMLElement): boolean {
    const check = (el as any).checkVisibility as
      | ((opts?: { visibilityProperty?: boolean; contentVisibilityAuto?: boolean }) => boolean)
      | undefined
    if (typeof check === 'function') {
      return check.call(el, { visibilityProperty: true, contentVisibilityAuto: true })
    }
    return el.getClientRects().length > 0
  }

  /** The subset of `focusables()` that are menu items (drives arrow / Home /
   *  End / type-ahead navigation). Same visibility / disabled / ownership
   *  filter — just narrowed to `a-menu-item`. */
  private focusableItems(): AMenuItemElement[] {
    return this.focusables().filter(
      (el): el is AMenuItemElement => el instanceof AMenuItemElement,
    )
  }

  /** The rows the arrow keys / Home / End / initial-focus step between:
   *  `focusableItems()` PLUS native-anchor link items (`<a data-anta-menu-item>`),
   *  in DOM order, of THIS menu. Broader than `focusableItems()`, which stays
   *  custom-element-only because the combobox cursor (`setActive`) and selection
   *  seating are `a-menu-item` affordances a plain link doesn't carry. */
  private navigableItems(): HTMLElement[] {
    return this.focusables().filter((el) => isMenuItemEl(el))
  }

  /** Every tabbable element belonging to THIS menu (items + nested controls
   *  like inputs / sliders / buttons), in DOM order, visible and enabled —
   *  used to trap Tab within the open menu. Submenu contents are excluded
   *  (their nearest `a-menu` is the submenu). */
  private focusables(): HTMLElement[] {
    // `a-input` is listed explicitly: its real control lives in shadow, so the bare
    // `input` selector can't see it, and without this a slotted Anta field (a time
    // input, a filter) drops out of the Tab cycle — focus on it then Tab jumps to
    // the first item instead of the next field. `.focus()` on the host delegates in.
    const sel =
      'a-menu-item, a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]),' +
      ' a-input:not([disabled]), select:not([disabled]), textarea:not([disabled]),' +
      ' [tabindex]:not([tabindex="-1"]), [data-menu-search]'
    return (Array.from(this.querySelectorAll(sel)) as HTMLElement[]).filter(
      (el) =>
        el.closest('a-menu') === this && !el.hasAttribute('disabled') && this.isVisible(el),
    )
  }

  /** On open, seat initial focus like a native `<select>` / macOS menu: a menu
   *  carrying a current value opens *at* that value, not at the top. Brings the
   *  first selected row into view and, when opened via keyboard, focuses it;
   *  with no selected row it focuses the first item (keyboard) and does nothing
   *  otherwise. "Selected" = a `selected` row (tint) or `aria-checked` /
   *  `aria-selected="true"` (checkable rows) — the first such visible item of
   *  THIS menu, so a leaf buried in a closed submenu (not visible) is skipped and
   *  a multi-select lands on its topmost checked row. */
  private seatInitialFocus(viaKeyboard: boolean) {
    const items = this.navigableItems()
    const selected = items.find(
      (el) =>
        el.hasAttribute('selected') ||
        el.getAttribute('aria-checked') === 'true' ||
        el.getAttribute('aria-selected') === 'true',
    )
    if (selected) this.scrollItemIntoView(selected)
    // `preventScroll`: the surface is already positioned in-view, so letting the
    // browser scroll the document to the freshly-focused item is redundant — and
    // when the item sits near a viewport edge that programmatic scroll fires the
    // just-bound scroll-dismiss listener, closing the menu the instant it opens.
    // scrollItemIntoView (above) handles bringing a selected row into view by
    // touching only the internal scroll container.
    if (viaKeyboard) (selected ?? items[0])?.focus({ preventScroll: true })
  }

  /** Scroll THIS menu's body so `item` sits inside the visible scroll viewport,
   *  touching only the internal `.scroll` container — never the document, whose
   *  scroll would trip the anchor-scrolled-out dismiss. No-op for a menu short
   *  enough not to scroll. */
  private scrollItemIntoView(item: HTMLElement) {
    const c = this.scrollEl
    if (!c) return
    const pad = 4
    const cr = c.getBoundingClientRect()
    const ir = item.getBoundingClientRect()
    if (ir.top < cr.top + pad) c.scrollTop -= cr.top + pad - ir.top
    else if (ir.bottom > cr.bottom - pad) c.scrollTop += ir.bottom - cr.bottom + pad
  }

  /** Fade the scrolling body's content into the top / bottom edges — but only on the
   *  side that actually has more to scroll, so a short (non-scrolling) menu and the
   *  true top / bottom stay crisp. Drives the `--fade-*` / `--gap-top` vars the
   *  `.scroll` mask reads; runs on scroll and after every (re)position.
   *  Shadow-internal only. */
  private updateScrollFade() {
    const el = this.scrollEl
    if (!el) return
    const top = el.scrollTop > 1
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1
    el.style.setProperty('--fade-top', top ? '16px' : '0px')
    el.style.setProperty('--gap-top', top ? '3px' : '0px')
    el.style.setProperty('--fade-bottom', bottom ? '14px' : '0px')
  }

  /* ------------------------------ combobox mode ------------------------------ */

  /** Combobox-anchor mode: the trigger anchor ITSELF is the filter field (it
   *  carries `[data-menu-search]`), as in `InputAutocomplete` where an editable
   *  `<a-input>` is the always-visible field the menu hangs under. null for the
   *  normal case — `Select`/`SelectFaceted` slot the field as a child, so their
   *  anchor never carries the marker and this stays inert for them. */
  get #comboAnchor(): HTMLElement | null {
    const a = this.triggerAnchor
    return a?.matches('[data-menu-search]') ? a : null
  }

  /** The filter field of THIS menu, or null. A slotted child (never a submenu's)
   *  wins; else the anchor when it's the field (combobox-anchor mode). Its
   *  presence switches the menu to the combobox keyboard. */
  get #searchField(): HTMLElement | null {
    const el = this.querySelector('[data-menu-search]') as HTMLElement | null
    if (el && el.closest('a-menu') === this) return el
    return this.#comboAnchor
  }

  /** Move the combobox cursor. Sets the item's `active` **property** (off-DOM
   *  `:state(active)`, no attribute churn) for the highlight, and REPORTS the
   *  active id via the `activedescendant` event so the reactive layer can set
   *  `aria-activedescendant` on the light-DOM field. `null` clears the cursor. */
  private setActive(item: AMenuItemElement | null) {
    if (this.activeItem && this.activeItem !== item) this.activeItem.active = false
    this.activeItem = item
    if (item) {
      item.active = true
      item.scrollIntoView?.({ block: 'nearest' })
    }
    // The cursor *highlight* rides the item's off-DOM `:state(active)` above. The
    // ARIA `aria-activedescendant` relationship, though, points from the (light-DOM)
    // filter field to the active option — and a web component must not write that
    // light-DOM attribute itself (it would desync the worker-thread reactive
    // model). So we only REPORT the active id; the reactive layer that owns the
    // field (e.g. `Select`) reflects it onto `aria-activedescendant`.
    this.dispatchEvent(
      new CustomEvent('activedescendant', { detail: { id: item?.id ?? null } }),
    )
  }

  /** Re-seat the cursor on the first option — but only once the filter has input.
   *  An empty filter (e.g. right after opening) shows NO active row, so the first
   *  ArrowDown is what steps onto the list; typing then keeps the top match active.
   *  Rows marked `data-menu-skip-active` (e.g. a Select-all action) are skipped as
   *  the seat target — the cursor lands on the first real option — but they stay
   *  arrow-reachable. */
  private resetActive() {
    const q = (this.#searchField as { value?: string } | null)?.value
    if (!q || !q.trim()) return this.setActive(null)
    // Combobox-anchor (free-text autocomplete): never auto-seat a match, so Enter
    // commits the typed text — the user arrows down to highlight a suggestion
    // first. (The slotted-filter case below still seats the top match.)
    if (this.#comboAnchor) return this.setActive(null)
    const items = this.focusableItems()
    this.setActive(items.find((it) => !it.hasAttribute('data-menu-skip-active')) ?? items[0] ?? null)
  }

  /** Combobox arrow / PageUp / PageDown / Enter handling; returns true if it
   *  consumed the key (so `handleKey` stops). Home / End are deliberately NOT
   *  handled: focus is in a text field, so they must reach it for caret movement
   *  (line start/end); PageUp / PageDown jump the option list to first / last
   *  instead. Any other key falls through to the input (typing). */
  private handleComboKey(e: KeyboardEvent): boolean {
    const items = this.focusableItems()
    const idx = this.activeItem ? items.indexOf(this.activeItem) : -1
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        this.setActive(items[idx < 0 ? 0 : (idx + 1) % items.length] ?? null)
        return true
      case 'ArrowUp':
        e.preventDefault()
        this.setActive(items[idx <= 0 ? items.length - 1 : idx - 1] ?? null)
        return true
      case 'PageUp':
        e.preventDefault()
        this.setActive(items[0] ?? null)
        return true
      case 'PageDown':
        e.preventDefault()
        this.setActive(items[items.length - 1] ?? null)
        return true
      case 'Enter':
        if (this.activeItem) {
          e.preventDefault()
          // Activate on keyup (see handleKeyUp), not here — the keydown→keyup gap
          // lets a lazy copy row refresh `copy` between press and release, the
          // same contract as the roving path (key-activation) and pointer. The
          // copy attribute now lives on the row's slotted `<a-copy>` child, so
          // fire the pre-request there (the child's own delegated keydown can't
          // reach it on this path — focus is on the filter, not the row). No-ops
          // on a non-copy row.
          const copyEl = this.activeItem.querySelector(':scope > a-copy')
          if (copyEl) emitCopyRequest(copyEl as HTMLElement)
          this.#pendingComboActivate = this.activeItem
        }
        return true
      default:
        return false
    }
  }

  /** The combobox cursor armed by an Enter keydown in the filter field, consumed
   *  on the matching keyup. Only the combobox path arms this — the roving Enter/
   *  Space activation is `<a-menu-item>`'s (also keyup, via key-activation). */
  #pendingComboActivate: HTMLElement | null = null

  /** Combobox keyup: activate the item a filter-field Enter armed. Paired with the
   *  keydown pre-request in `handleComboKey` so lazy content resolves in the gap. */
  handleKeyUp(e: KeyboardEvent) {
    if (e.key !== 'Enter') return
    const el = this.#pendingComboActivate
    this.#pendingComboActivate = null
    el?.click()
  }

  /* ============================ open / close ============================ */

  /** Public imperative API. Routes through the same intent path as the
   *  triggers, so it emits `statechange` and respects controlled mode. */
  open(opts?: { coord?: [number, number]; viaKeyboard?: boolean; originEvent?: Event }) {
    this.requestOpen(opts)
  }
  close(originEvent?: Event) {
    this.requestClose(originEvent)
  }
  toggle(opts?: { coord?: [number, number]; viaKeyboard?: boolean; originEvent?: Event }) {
    if (this._shown) this.requestClose(opts?.originEvent)
    else this.requestOpen(opts)
  }

  /** Dispatch the single `statechange` event (requested + previous state),
   *  `cancelable` and *before* applying. Returns `false` if a handler vetoed it
   *  via `preventDefault()` — the uncontrolled veto (see requestOpen/Close). */
  emitChange(next: MenuState, opts?: { coord?: [number, number]; originEvent?: Event }): boolean {
    return this.dispatchEvent(
      new CustomEvent<StateChangeDetail>('statechange', {
        cancelable: true,
        detail: {
          next,
          prev: this._shown ? 'open' : 'closed',
          coord: opts?.coord,
          originEvent: opts?.originEvent,
        },
      }),
    )
  }

  /** Intent to open (trigger / method / keyboard). Emits the cancelable
   *  `statechange`; applies the visibility itself ONLY when uncontrolled and
   *  not vetoed — a controlled menu waits for the consumer to flip `state`. */
  requestOpen(opts?: { coord?: [number, number]; viaKeyboard?: boolean; originEvent?: Event }) {
    if (this._shown) {
      this.show(opts?.coord, opts?.viaKeyboard, opts?.originEvent) // reposition
      return
    }
    const ok = this.emitChange('open', opts)
    if (this.isControlled) return
    if (ok) this.show(opts?.coord, opts?.viaKeyboard, opts?.originEvent)
  }

  /** Intent to close. Emits the cancelable `statechange`; hides itself only when
   *  uncontrolled and not vetoed. */
  requestClose(originEvent?: Event) {
    if (!this._shown) return
    // Close any menus stacked ABOVE this one first — e.g. `Calendar`'s year/month
    // jump menu, which sits inside `InputDate`'s popover: toggling that popover
    // shut via its own anchor closes it but would otherwise leave the jump menu in
    // the stack with its controlled consumer still holding `open === true`, so it
    // can never be reopened. Emit a notify-only `statechange('closed')` for each
    // (as `closeAll` / `show`'s trim do) so a controlled one resets, then hide +
    // pop them. No-op in the common case where this IS the top of the stack.
    const idx = openStack.indexOf(this)
    if (idx !== -1) {
      for (let i = openStack.length - 1; i > idx; i--) {
        const m = openStack[i]
        if (m.isOpen && !m._dismissNotified) m.emitChange('closed')
        m._doHide()
      }
      openStack.length = idx + 1
    }
    const ok = this.emitChange('closed', { originEvent })
    if (this.isControlled) {
      this._dismissNotified = true
      return
    }
    if (ok) this.hide()
  }

  /** Apply OPEN to the DOM (no event) — used by uncontrolled intent and by the
   *  controlled `state` sync. */
  private show(coord?: [number, number], viaKeyboard = false, _originEvent?: Event) {
    if (this.isSubmenu) {
      // Collapse any deeper menus opened from sibling items.
      const parent = this.#ownerMenu
      if (parent) {
        const pidx = openStack.indexOf(parent)
        if (pidx !== -1) {
          for (let i = openStack.length - 1; i > pidx; i--) openStack[i]._doHide()
          openStack.length = pidx + 1
        }
      }
    } else if (!openStack.includes(this)) {
      // A fresh root normally closes any other open menu system entirely. But if
      // this menu's trigger lives inside an already-open menu's content — a menu
      // opened from within another menu, e.g. `Calendar`'s year/month jump menu
      // sitting inside `InputDate`'s popover — nest on top of that container
      // instead: trim the stack to it and stack above, so the container stays
      // open. (Slotted content are light-DOM children of the `<a-menu>`, so
      // `contains` finds the container.) Skip when THIS same menu is already open
      // (handled below) — a context/coord re-trigger is a quiet reposition, not a
      // close-then-reopen, which would run closeAll() → a spurious
      // statechange('closed') that dismisses a controlled menu instead of moving it.
      const anchor = this.triggerAnchor
      // The INNERMOST open menu that contains our anchor — walk the stack from the
      // top so a control nested inside a flyout (which is itself inside the root)
      // nests on top of the *flyout*, not the root. `find` returns the outermost
      // (the root also `contains()` the anchor), which would trim away the flyout.
      let container: AMenuElement | undefined
      if (anchor)
        for (let i = openStack.length - 1; i >= 0; i--) {
          if (openStack[i] !== this && openStack[i].contains(anchor)) {
            container = openStack[i]
            break
          }
        }
      if (container) {
        const idx = openStack.indexOf(container)
        // Trim everything stacked above the container. Emit a notify-only
        // `statechange('closed')` for each (as closeAll does), so a controlled
        // menu among them isn't left `open` in consumer state with no surface.
        for (let i = openStack.length - 1; i > idx; i--) {
          const m = openStack[i]
          if (m.isOpen && !m._dismissNotified) m.emitChange('closed')
          m._doHide()
        }
        openStack.length = idx + 1
      } else {
        closeAll()
      }
    }

    if (openStack.includes(this)) {
      // Already open — just reposition (e.g. a context re-trigger).
      this.position(coord)
      return
    }

    const wasEmpty = openStack.length === 0
    // Opening atop an already-open menu (a submenu over its parent, or a
    // sibling submenu) appears INSTANTLY — the enter-fade reads as a blink next
    // to the static menu already on screen. A fresh root menu still fades in.
    this._doShow(coord, !wasEmpty)
    openStack.push(this)
    if (wasEmpty) {
      bindDocListeners(this.doc, this.view)
      this.armPositionTracker()
    }

    const search = this.#searchField
    if (search) {
      // Combobox: focus the filter field on open (mouse OR keyboard) so typing
      // narrows immediately, seat the cursor on the first option, and watch for the
      // filtered list changing.
      ;(search as HTMLElement).focus({ preventScroll: true })
      this.resetActive()
      this.startComboObserver()
    } else {
      this.seatInitialFocus(viaKeyboard)
    }
  }

  /** While a filter field is open, the visible option list changes as the user
   *  types (the consumer re-renders the matches); re-seat the cursor on the first
   *  match. `childList` only — an item toggling its own `selected` (multi-select)
   *  mutates deep in its subtree, not this menu's direct children, so it won't
   *  spuriously reset the cursor. */
  private startComboObserver() {
    this.comboObserver?.disconnect()
    this.comboObserver = new this.view.MutationObserver(() => {
      if (!this._shown || !this.#searchField) return
      this.resetActive()
      // The filtered list changed the menu's height — re-anchor to the trigger,
      // keeping the side chosen at open (`reanchor`). Matters when flipped ABOVE:
      // its `top` derives from its height, so a shrunk list must move down to stay
      // against the field instead of floating where the taller list reached — and
      // it must NOT flip back under the field once it's short enough to fit.
      this.position(undefined, false, true)
    })
    this.comboObserver.observe(this, { childList: true })
  }

  /** Watch the root trigger and dismiss the system once it scrolls out of the
   *  spot it held at open (see trackPosition). Deferred a frame so the trigger's
   *  post-open layout has settled before the rect is snapshotted; guarded in case
   *  the menu closed in between. Tracks the root anchor only — submenus ride
   *  inside it, so if the root anchor goes, the whole system should go. */
  private armPositionTracker() {
    const anchor = this.triggerAnchor
    if (!anchor) return
    this.view.requestAnimationFrame(() => {
      if (!this._shown || openStack[0] !== this) return
      removePosTracker?.()
      removePosTracker = trackPosition(anchor, () => dismiss())
    })
  }

  /** Apply CLOSE to the DOM (no event). Closes this menu and everything stacked
   *  above it (its submenus). */
  private hide() {
    // Tear down combobox state (no-op for a plain menu).
    this.comboObserver?.disconnect()
    this.comboObserver = undefined
    this.setActive(null)
    this._flippedTop = null // re-decide the side on the next open
    this._flippedSide = null
    const idx = openStack.indexOf(this)
    if (idx === -1) {
      if (this._shown) this._doHide()
      return
    }
    for (let i = openStack.length - 1; i >= idx; i--) openStack[i]._doHide()
    openStack.length = idx
    if (openStack.length === 0) unbindDocListeners()
  }

  /** Shadow-only show: open the popover and position it. `instant` positions
   *  synchronously (no rAF), so a menu opening over an already-visible one is
   *  placed before its first paint — it still fades in via the CSS transition.
   *  Relies on the Popover API without feature detection — see "Browser
   *  support" in README.md. */
  _doShow(coord?: [number, number], instant = false) {
    if (this.surface.isConnected && !this._shown) this.surface.showPopover()
    this._shown = true
    this._dismissNotified = false
    this.reflectOpen(true)
    this.hideAnchorTooltip()
    // `instant` (opening over an already-open menu) only positions synchronously
    // now — no fade-skip needed; the CSS transition + @starting-style handle the
    // enter, and a brief fade-in over an existing menu reads fine.
    this.position(coord, instant)
  }

  /** Dismiss any tooltip on the trigger as the menu opens, so the trigger's
   *  hover tooltip doesn't linger over the just-opened menu. `a-tooltip.hide()`
   *  mutates only its own shadow internals (like `el.focus()`), so this is
   *  allowed under the no-light-DOM-mutation rule. No-op when the trigger has no
   *  tooltip (or it hasn't upgraded). */
  private hideAnchorTooltip() {
    this.triggerAnchor
      ?.querySelectorAll('a-tooltip')
      .forEach((t) => (t as HTMLElement & { hide?: () => void }).hide?.())
  }

  /** Shadow-only hide. */
  _doHide() {
    if (this.surface.isConnected && this._shown) this.surface.hidePopover()
    this._shown = false
    this.reflectOpen(false)
    this.cancelOpenTimer()
    this.cancelCloseTimer()
  }

  /** Expose the menu's OWN open state as an off-DOM custom state (`:state(open)`),
   *  never a light-DOM attribute. A web component must not mutate light DOM — it
   *  desyncs the worker-thread reactive model, which owns the light tree. A
   *  submenu parent lights its open branch purely in CSS via
   *  `a-menu-item:has(> a-menu:state(open))`; the state is element-owned (like
   *  `a-menu-item`'s `:state(active)`) and, being off-DOM, survives a reactive
   *  re-render without the element ever writing an attribute. Set on every menu
   *  (harmless on roots — no `a-menu-item` parent matches the selector). */
  private reflectOpen(open: boolean) {
    try {
      if (open) this.internals?.states.add('open')
      else this.internals?.states.delete('open')
    } catch {}
  }

  /* ============================ positioning ============================ */

  private position(coord?: [number, number], sync = false, reanchor = false) {
    const run = () => {
      if (!this._shown) return
      const view = this.view
      const vw = view.innerWidth
      const vh = view.innerHeight
      const surface = this.surface

      let left = MARGIN
      let top = MARGIN

      if (coord) {
        surface.style.maxHeight = `${Math.max(MIN_HEIGHT, vh - 2 * MARGIN)}px`
        const box = surface.getBoundingClientRect()
        left = coord[0]
        if (left + box.width > vw - MARGIN) left = vw - box.width - MARGIN
        left = Math.max(MARGIN, left)
        top = coord[1]
        if (top + box.height > vh - MARGIN) top = top - box.height
        top = Math.max(MARGIN, top)
      } else if (this.isSubmenu) {
        const it = this.triggerAnchor ? anchorRect(this.triggerAnchor) : null
        if (!it) return
        surface.style.maxHeight = `${Math.max(MIN_HEIGHT, vh - 2 * MARGIN)}px`
        const box = surface.getBoundingClientRect()
        left = it.right + this.#offset
        if (left + box.width > vw - MARGIN) {
          // Flip to the left of the parent item.
          left = it.left - box.width - this.#offset
        }
        left = Math.max(MARGIN, left)
        // Line the submenu's FIRST row up with the parent item. The first row
        // sits border-top + padding-top below the surface's box edge (which is
        // what `top` sets), so offset by that real inset — not a bare MARGIN, or
        // the unaccounted 1px border drifts the flyout down a pixel per level
        // and the drift compounds through nested submenus. The body's own
        // padding lives on `.scroll` (not the surface), so add it too.
        const cs = view.getComputedStyle(surface)
        const scs = view.getComputedStyle(this.scrollEl)
        const insetTop =
          parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop) + parseFloat(scs.paddingTop)
        top = it.top - insetTop
        if (top + box.height > vh - MARGIN) top = vh - box.height - MARGIN
        top = Math.max(MARGIN, top)
      } else {
        const a = this.triggerAnchor ? anchorRect(this.triggerAnchor) : null
        if (!a) return
        // A root menu is never narrower than its trigger: publish the anchor width
        // so the surface min-width floors to it (see the shadow style's `max()`).
        // Content can still make it wider; it never shrinks below the trigger.
        // `autowidth` opts out — the surface sizes to its content (floored only at
        // --menu-min-width) for a content menu whose trigger is a wide field (e.g.
        // InputDate's calendar under a full-width input), rather than stretching to it.
        if (this.hasAttribute('autowidth')) surface.style.removeProperty('--_anchor-width')
        else surface.style.setProperty('--_anchor-width', `${Math.ceil(a.width)}px`)
        const p = this.#placement

        if (p.startsWith('right') || p.startsWith('left')) {
          // Place BESIDE the anchor (primary axis horizontal, cross axis vertical),
          // like a submenu flyout. Flip to the other side when the preferred one
          // lacks room and the other has more. Cross axis: `-start` top-aligns to the
          // anchor, `-end` bottom-aligns, no suffix centers.
          surface.style.removeProperty('--_anchor-width') // a side menu sizes to content
          surface.style.maxHeight = `${Math.max(MIN_HEIGHT, vh - 2 * MARGIN)}px`
          const box = surface.getBoundingClientRect()
          const spaceRight = vw - a.right - 2 * MARGIN
          const spaceLeft = a.left - 2 * MARGIN
          let onLeft = p.startsWith('left')
          if (reanchor && this._flippedSide !== null) onLeft = this._flippedSide
          else if (onLeft && spaceLeft < box.width && spaceRight > spaceLeft) onLeft = false
          else if (!onLeft && spaceRight < box.width && spaceLeft > spaceRight) onLeft = true
          this._flippedSide = onLeft

          left = onLeft ? a.left - box.width - this.#offset : a.right + this.#offset
          left = Math.max(MARGIN, Math.min(left, vw - box.width - MARGIN))
          const valign = p.endsWith('end') ? 'end' : p.endsWith('start') ? 'start' : 'center'
          top =
            valign === 'center' ? a.top + a.height / 2 - box.height / 2
            : valign === 'end' ? a.bottom - box.height
            : a.top
          if (top + box.height > vh - MARGIN) top = vh - box.height - MARGIN
          top = Math.max(MARGIN, top)
        } else {
          const spaceBelow = vh - a.bottom - 2 * MARGIN
          const spaceAbove = a.top - 2 * MARGIN

          // Decide the vertical side: honor the placement, flip if the preferred
          // side lacks room and the other side has more.
          let onTop = p.startsWith('top')
          // The body scrolls (not the surface), so a capped surface no longer reports
          // its natural height. Drop the cap, read the full height, then re-cap below.
          // Synchronous, so the unconstrained layout never paints.
          surface.style.maxHeight = ''
          const natural = surface.scrollHeight
          if (reanchor && this._flippedTop !== null) {
            // Keep the side chosen at open — don't let a shrunk (filtered) menu hop
            // back under the trigger just because it now fits there.
            onTop = this._flippedTop
          } else {
            if (onTop && spaceAbove < natural && spaceBelow > spaceAbove) onTop = false
            else if (!onTop && spaceBelow < natural && spaceAbove > spaceBelow) onTop = true
          }
          this._flippedTop = onTop

          // Cap the surface to the chosen side's space (it scrolls if taller).
          const space = onTop ? spaceAbove : spaceBelow
          surface.style.maxHeight = `${Math.max(MIN_HEIGHT, Math.floor(space))}px`

          const box = surface.getBoundingClientRect()
          // Cross axis: align the surface's own edge to the trigger's — `-start`
          // left-to-left, `-end` right-to-right, and no suffix (`bottom` / `top`)
          // centers the menu on the trigger. The box edge meets the trigger edge
          // (no padding compensation).
          const align = p.endsWith('end') ? 'end' : p.endsWith('start') ? 'start' : 'center'
          left =
            align === 'center' ? a.left + a.width / 2 - box.width / 2
            : align === 'end' ? a.right - box.width
            : a.left
          if (left + box.width > vw - MARGIN) left = vw - box.width - MARGIN
          left = Math.max(MARGIN, left)

          top = onTop ? a.top - box.height - this.#offset : a.bottom + this.#offset
          top = Math.max(MARGIN, top)
        }
      }

      surface.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
      this.updateScrollFade()
    }
    // Sync (instant open atop an already-open menu) avoids both the rAF delay
    // and the unpositioned first frame; otherwise position next frame.
    if (sync) run()
    else requestAnimationFrame(run)
  }

  /* ====================== click / close contract ====================== */

  /**
   * Fully declarative close contract — decided synchronously from the DOM, so
   * it never depends on the consumer's click handler (which in a worker-thread
   * runtime can't `preventDefault` on the UI thread). The menu never
   * stops/prevents the click, so the consumer's selection handler always runs.
   *
   * Walk the click's composedPath outward to the surface; the NEAREST marker
   * wins:
   *   - `data-menu-open`  → keep the menu open (a Done button can still close
   *                          from inside such a region — it's hit first).
   *   - `a-menu-item` (a choice) or `data-menu-close` → close the menu.
   *   - nothing → keep open (plain custom content doesn't dismiss).
   */
  private onSurfaceClick = (e: MouseEvent) => {
    // Selection pass — do the "which item was actually activated?" walk HERE, on
    // the UI thread where the composed path is real, and emit a pre-filtered
    // `menuselect` on that item. The `MenuItem` wrapper then reacts with a pure
    // handler (no `.closest()` / `e.target` walking — a worker-thread reactive
    // engine has no live tree to traverse). Dispatched as a MouseEvent so it
    // carries the modifier keys (`Select`'s Alt/Option-click isolate reads
    // `altKey`). Fires regardless of the open/close decision below — a
    // `data-menu-open` multi-select row selects AND stays open. The innermost
    // a-menu-item wins (a bubbled child click doesn't re-fire on ancestors); a
    // submenu parent (nested `<a-menu>`) opens its flyout, so it's not a selection.
    // A submenu's leaf bubbles through this parent surface too (the nested `<a-menu>`
    // is a real descendant — never portaled), so dispatch only for an item that
    // belongs to THIS menu (`closest('a-menu') === this`); its own submenu dispatches
    // for it, otherwise `menuselect` would fire once per ancestor menu level.
    for (const node of e.composedPath()) {
      if (node === this.surface) break
      if (node instanceof AMenuItemElement) {
        if (!node.hasAttribute('disabled') && !node.querySelector(':scope > a-menu') && node.closest('a-menu') === this) {
          node.dispatchEvent(
            new MouseEvent('menuselect', {
              bubbles: false,
              altKey: e.altKey,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey,
              shiftKey: e.shiftKey,
            }),
          )
        }
        break
      }
    }

    for (const node of e.composedPath()) {
      if (node === this.surface) break // reached the menu boundary
      if (!(node instanceof Element)) continue

      // Nearest `data-menu-open` keeps it open (replaces the legacy
      // `data-popover-stay`; put it on an item, a group, or any container).
      if (node.hasAttribute('data-menu-open')) return

      if (node instanceof AMenuItemElement) {
        if (node.hasAttribute('disabled')) {
          e.preventDefault()
          return
        }
        // Submenu parent → its own handler opens the submenu; don't close.
        // Detected structurally by a DIRECT-child `<a-menu>` (matching `isSubmenu`),
        // not the `submenu` attribute, which the wrapper only emits when the consumer
        // passes `submenu` (so a bare nested `<Menu>` would otherwise open then get
        // dismissed by closeSystem here). Direct-child (`:scope >`) so a composed
        // control slotted deeper (a `Select` / `InputDate` with its own menu) is a
        // normal selectable/plain node, not mistaken for a submenu parent.
        if (node.querySelector(':scope > a-menu')) return
        return this.closeSystem(e)
      }

      // A native-anchor link item closes the system on activation, like an
      // `<a-menu-item>` choice — it matters for a link that doesn't navigate the
      // current document (target="_blank" / download); a same-tab link unloads
      // the page anyway. Disabled links carry pointer-events:none, so a click
      // never lands on them to reach here.
      if (node.matches('a[data-anta-menu-item]')) return this.closeSystem(e)

      // Custom content opts into closing with `data-menu-close`.
      if (node.hasAttribute('data-menu-close')) return this.closeSystem(e)
    }
    // No marker in the path → plain content, stay open.
  }

  /** Close the whole open menu system from the root down. */
  private closeSystem(e?: Event) {
    const root = openStack[0] ?? this
    root.requestClose(e)
  }

  /* ============================ keyboard ============================ */

  /** Called by the coordinator on the topmost open menu. Handles navigation;
   *  roving Enter / Space activation is `<a-menu-item>`'s own delegated keyup
   *  (synthesizes a click → routed through onSurfaceClick). Combobox Enter (focus
   *  in the filter field) is handled here via handleComboKey / handleKeyUp. */
  handleKey(e: KeyboardEvent) {
    const active = this.doc.activeElement as HTMLElement | null

    // Escape always closes the topmost menu, wherever focus is inside it.
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      this.requestClose(e)
      this.focusTrigger()
      return
    }

    // Trap Tab within the open menu: a non-modal popover doesn't contain focus,
    // so native Tab would walk out the back while the menu is still open. Move
    // focus among ALL of this menu's focusables (items + nested controls),
    // wrapping at the ends so it never escapes.
    if (e.key === 'Tab') {
      // Combobox-anchor (autocomplete): the field is outside the menu, so DON'T
      // trap Tab in the list. Let Tab do its native thing — close the list and
      // move focus to the next form control. (A menu with a slotted filter still
      // traps below; focus is inside it there.)
      if (this.#comboAnchor) {
        this.requestClose(e)
        return
      }
      const f = this.focusables()
      if (!f.length) return
      e.preventDefault()
      const i = active ? f.indexOf(active) : -1
      // Focus isn't on a listed focusable (the surface itself, or an unmatched
      // slotted node) → step to the first item rather than wrapping to the last.
      if (i === -1) {
        f[0]?.focus()
        return
      }
      const next = e.shiftKey
        ? i === 0
          ? f.length - 1
          : i - 1
        : i === f.length - 1
          ? 0
          : i + 1
      f[next]?.focus()
      return
    }

    // Combobox: focus is in the filter field → arrows / Home / End / Enter move &
    // activate the cursor (focus stays put so you keep typing); every other key
    // falls through to the input. Suppresses the plain-menu item nav + type-ahead.
    const search = this.#searchField
    if (search && (active === search || search.contains(active as Node))) {
      this.handleComboKey(e)
      return
    }

    // Arrow / Home / End / type-ahead drive the item cursor — but only while
    // focus is on a menu item (or still outside, entering via ArrowDown). If
    // the user has Tabbed onto a NESTED control in this menu (input, slider,
    // button), hand the keys back to it.
    const within = active?.closest('a-menu') === this
    if (within && !isMenuItemEl(active)) return

    const items = this.navigableItems()
    const idx = active ? items.indexOf(active as HTMLElement) : -1

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        items[idx < 0 ? 0 : (idx + 1) % items.length]?.focus({ preventScroll: true })
        break
      case 'ArrowUp':
        e.preventDefault()
        items[idx <= 0 ? items.length - 1 : idx - 1]?.focus({ preventScroll: true })
        break
      case 'Home':
        e.preventDefault()
        items[0]?.focus({ preventScroll: true })
        break
      case 'End':
        e.preventDefault()
        items[items.length - 1]?.focus({ preventScroll: true })
        break
      case 'ArrowRight': {
        const sub = this.submenuOf(active)
        if (sub) {
          e.preventDefault()
          sub.requestOpen({ viaKeyboard: true })
        }
        break
      }
      case 'ArrowLeft':
        if (this.isSubmenu) {
          e.preventDefault()
          const anchorItem = this.triggerAnchor
          this.requestClose(e)
          anchorItem?.focus()
        }
        break
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          this.typeahead(e.key, items)
        }
    }
  }

  private submenuOf(item: HTMLElement | null): AMenuElement | null {
    // A DIRECT-child `<a-menu>` (matching `isSubmenu`), so ArrowRight opens the flyout
    // whether or not the `submenu` attribute is set (the wrapper only emits it when the
    // consumer passes `submenu`). Direct-child so a composed control slotted deeper (a
    // `Select` / `InputDate` with its own menu) isn't opened as if it were a submenu.
    if (!item || !(item instanceof AMenuItemElement)) return null
    return item.querySelector(':scope > a-menu') as AMenuElement | null
  }

  private typeahead(ch: string, items: HTMLElement[]) {
    this.typeBuffer += ch.toLowerCase()
    clearTimeout(this.typeTimer)
    this.typeTimer = setTimeout(() => (this.typeBuffer = ''), TYPEAHEAD_RESET)
    const match = items.find((it) => this.itemLabel(it).startsWith(this.typeBuffer))
    match?.focus()
  }

  /** The item's own visible label for type-ahead. Prefers the
   *  `<a-menu-item-label>` text so it excludes a trailing `kbd` hint AND — for
   *  a submenu parent — the entire nested `<a-menu>` flyout's text (which is a
   *  light-DOM descendant, so it'd otherwise be folded into `textContent`). */
  private itemLabel(it: HTMLElement): string {
    const label = it.querySelector('a-menu-item-label')
    return ((label ?? it).textContent ?? '').trim().toLowerCase()
  }

  /* ====================== trigger listener wiring ====================== */

  /** Pointer coord for a keyboard-opened `coord` menu: the trigger's own rect
   *  (a DOM read, not a mutation) instead of the 0,0 a keyboard event reports. */
  #anchorCoord(anchor: HTMLElement): [number, number] {
    const r = anchorRect(anchor)
    return [r.left, r.bottom]
  }

  setupListeners() {
    if (this.listening) return
    const anchor = this.triggerAnchor
    if (!anchor) {
      this.listening = true
      return
    }

    if (this.isSubmenu) {
      // The enclosing item drives the submenu: click OPENS (never toggles shut —
      // re-clicking the parent that spawned the flyout keeps it open, just
      // repositions); hover opens/closes with intent timing unless `nohover`.
      // Closing is owned by the usual paths: outside-click, Esc, ←, hover-away,
      // or picking an item.
      const onClick = (e: MouseEvent) => {
        // Only a DIRECT click on the parent item (re)opens the flyout. A click
        // that bubbled up from inside the already-open submenu — e.g. ticking a
        // checkbox in `data-menu-open` custom content — would otherwise re-enter
        // show() and collapse this submenu (and any deeper) via the
        // sibling-collapse pass. Ignore those.
        if (e.composedPath().includes(this.surface)) return
        this.requestOpen({ originEvent: e })
      }
      anchor.addEventListener('click', onClick)
      let onEnter: ((e: PointerEvent) => void) | undefined
      let onLeave: ((e: PointerEvent) => void) | undefined
      if (this.#isHover) {
        // Mouse-only hover-intent (see the surface listeners above): touch/pen
        // taps emit synthetic pointerenter/leave that would open-then-close.
        onEnter = (e) => { if (e.pointerType === 'mouse') this.scheduleOpen() }
        onLeave = (e) => { if (e.pointerType === 'mouse') this.scheduleClose() }
        anchor.addEventListener('pointerenter', onEnter)
        anchor.addEventListener('pointerleave', onLeave)
      }
      this.teardown = () => {
        anchor.removeEventListener('click', onClick)
        if (onEnter) anchor.removeEventListener('pointerenter', onEnter)
        if (onLeave) anchor.removeEventListener('pointerleave', onLeave)
        this.listening = false
      }
    } else if (this.#isContext) {
      const onContext = (e: MouseEvent) => {
        if (pathCrossesTopLayerBeforeAnchor(e, anchor)) return
        e.preventDefault()
        this.requestOpen({ coord: [e.clientX, e.clientY], originEvent: e })
      }
      anchor.addEventListener('contextmenu', onContext)
      this.teardown = () => {
        anchor.removeEventListener('contextmenu', onContext)
        this.listening = false
      }
    } else if (this.#comboAnchor) {
      // Combobox-anchor (autocomplete): the editable anchor IS the filter field.
      // Wire NO click-toggle — clicking to place the caret or typing must not
      // close the list. The reactive wrapper owns open state via controlled
      // `state`; Esc / outside-click / picking a suggestion still close. No
      // listeners to remove, but honor the teardown contract every branch keeps:
      // reset `listening` so a later setupListeners() (guarded by `if
      // (this.listening) return`) can re-wire if the anchor leaves combobox mode.
      this.teardown = () => { this.listening = false }
      this.listening = true
      return
    } else {
      const onClick = (e: MouseEvent) => {
        // detail === 0 ⇒ a keyboard-synthesized click (a button / <a-button>
        // turning Enter/Space into one) ⇒ open + focus the first item. Fields with
        // no such click go through onKey below.
        const viaKeyboard = e.detail === 0
        // A coord menu opens at the pointer; a keyboard click reports 0,0, so fall
        // back to the trigger's rect.
        const coord = this.#isCoord
          ? viaKeyboard
            ? this.#anchorCoord(anchor)
            : ([e.clientX, e.clientY] as [number, number])
          : undefined
        if (this._shown) this.requestClose(e)
        else this.requestOpen({ coord, viaKeyboard, originEvent: e })
      }
      // Keyboard open for a field trigger (no click of its own). Lives here, not
      // in the wrapper, so no wrapper synthesizes a click on the live node — which
      // breaks under worker-thread DOM.
      const onKey = (e: KeyboardEvent) => {
        if (this._shown) return // open-only; while open the surface owns the keys
        if (anchor.matches(SELF_ACTIVATING) || anchor.hasAttribute('disabled')) return
        // Either arrow opens (the menu can flip above the trigger, and native
        // <select> opens on both); Enter/Space also open a non-editable trigger,
        // but stay with the text on an editable one.
        const editable = anchor.matches(EDITABLE_FIELD)
        const opens =
          e.key === 'ArrowDown' ||
          e.key === 'ArrowUp' ||
          (!editable && (e.key === 'Enter' || e.key === ' '))
        if (!opens) return
        e.preventDefault()
        const coord = this.#isCoord ? this.#anchorCoord(anchor) : undefined
        this.requestOpen({ coord, viaKeyboard: true, originEvent: e })
      }
      anchor.addEventListener('click', onClick)
      anchor.addEventListener('keydown', onKey)
      this.teardown = () => {
        anchor.removeEventListener('click', onClick)
        anchor.removeEventListener('keydown', onKey)
        this.listening = false
      }
    }

    this.listening = true
  }

  teardownListeners() {
    this.teardown?.()
    this.teardown = undefined
  }

  /* --- submenu hover-intent timers --- */
  private scheduleOpen() {
    this.cancelCloseTimer()
    if (this._shown) return
    this.cancelOpenTimer()
    this.openTimer = setTimeout(() => {
      this.openTimer = undefined
      this.requestOpen()
    }, SUBMENU_OPEN_DELAY)
  }
  private scheduleClose() {
    this.cancelOpenTimer()
    if (!this._shown) return
    // Keyboard focus has moved into this submenu (a `:focus-visible` element
    // inside it) — the user is navigating by keyboard now, so a mouse hover-away
    // must not yank the flyout out from under them. The explicit close paths
    // (Esc, ArrowLeft, outside-click, focus leaving on Tab) still close it, and a
    // deeper flyout keeps its ancestors open (they `contains()` it too).
    if (this.#hasKeyboardFocusInside) return
    // A menu nested inside this flyout is open — a composed control's own popup
    // (an `InputDate` calendar, a `Select`), or a deeper submenu. The user is
    // mid-interaction with it, so a mouse hover-away must not collapse this
    // flyout and take that popup with it. It closes on the explicit paths once
    // its descendants are gone.
    if (openStack.some((m) => m !== this && (this.contains(m) || (m.triggerAnchor != null && this.contains(m.triggerAnchor)))))
      return
    this.cancelCloseTimer()
    this.closeTimer = setTimeout(() => {
      this.closeTimer = undefined
      this.requestClose()
    }, SUBMENU_CLOSE_DELAY)
  }

  /** True when the document's focused element is inside this menu AND is
   *  keyboard-focused (`:focus-visible`). Distinguishes "arrowed into the flyout"
   *  (keep it open on hover-out) from a mouse-click focus (close as usual).
   *  `activeElement` retargets to the shadow host at the document level, so a
   *  focused menu item (or its delegated inner control) reads as a light-DOM
   *  descendant here. */
  get #hasKeyboardFocusInside(): boolean {
    const active = this.doc.activeElement as HTMLElement | null
    return !!active && this.contains(active) && active.matches(':focus-visible')
  }
  private cancelOpenTimer() {
    if (this.openTimer !== undefined) {
      clearTimeout(this.openTimer)
      this.openTimer = undefined
    }
  }
  private cancelCloseTimer() {
    if (this.closeTimer !== undefined) {
      clearTimeout(this.closeTimer)
      this.closeTimer = undefined
    }
  }
}

export function register_a_menu() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-menu')) {
    customElements.define('a-menu', AMenuElement)
  }
}

// Importing this module registers the element (granular entry point). The
// barrel re-exports it, so importing the barrel registers it too. Idempotent.
register_a_menu()
