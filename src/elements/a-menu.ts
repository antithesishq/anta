import { HTMLElementBase, anchorRect } from '../anta_helpers'
import { AMenuItemElement } from './a-menu-item'
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

type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'bottom' | 'top'

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
 *  viewport root is shrunk (via negative rootMargin) to el's current rect; el
 *  sliding past the threshold drops `isIntersecting`. Read-only (no DOM
 *  mutation). Returns a disconnect fn. (Ported from the prior menu's
 *  browser_utils.trackPosition.) */
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
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) onEscape()
    },
    { root: null, rootMargin, threshold: ANCHOR_VISIBLE_RATIO },
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

  listening = false
  private _shown = false
  private teardown?: () => void

  /** A controlled menu was told to dismiss (it emitted `statechange→'closed'`)
   *  but stays visible until the consumer flips `state`. The flag lets the
   *  `closeAll` backstop skip a duplicate emit. Cleared on every show. */
  _dismissNotified = false

  // Submenu hover-intent timers.
  private openTimer?: ReturnType<typeof setTimeout>
  private closeTimer?: ReturnType<typeof setTimeout>

  // Typeahead state (root navigation).
  private typeBuffer = ''
  private typeTimer?: ReturnType<typeof setTimeout>

  constructor() {
    super()
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
        box-sizing: border-box;
        flex-direction: column;
        gap: 1px;
        min-width: max(var(--menu-min-width, 88px), var(--_anchor-width, 0px));
        max-width: calc(100vw - ${2 * MARGIN}px);
        max-height: calc(100dvh - ${2 * MARGIN}px);
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        padding: var(--menu-padding, 4px);
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
          display 100ms allow-discrete,
          overlay 100ms allow-discrete;
      }
      /* Enter: start from the closed state and transition in. */
      @starting-style {
        .container:popover-open { opacity: 0; translate: 0 -4px; }
      }
    `
    this.surface = document.createElement('div')
    this.surface.className = 'container'
    // Exposed as a shadow part so consumers can style the popover surface
    // (background, radius, shadow, padding) from plain CSS — `a-menu::part(menu)` —
    // instead of the `--menu-*` custom properties.
    this.surface.setAttribute('part', 'menu')
    this.surface.setAttribute('popover', 'manual')
    this.surface.append(document.createElement('slot'))

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
      if (this.isSubmenu && this.isHover) this.scheduleClose()
    })

    // Single delegated click for activation + the close contract.
    this.surface.addEventListener('click', this.onSurfaceClick)

    shadow.append(style, this.surface)
  }

  connectedCallback() {
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
  /** A submenu is an `<a-menu>` nested inside an `<a-menu-item>` — derived from
   *  structure, no `submenu` attribute needed (the parent item is the anchor). */
  get isSubmenu(): boolean {
    return !!this.closest('a-menu-item')
  }
  private get isContext(): boolean {
    return this.hasAttribute('context')
  }
  private get isCoord(): boolean {
    return this.hasAttribute('coord')
  }
  // Submenus open on hover by default; `nohover` opts out (click-only). Root
  // menus never consult this — it's read only on the submenu paths.
  private get isHover(): boolean {
    return !this.hasAttribute('nohover')
  }
  private get offset(): number {
    const n = parseInt(this.getAttribute('offset') ?? '', 10)
    return Number.isFinite(n) ? n : MARGIN
  }
  private get placement(): Placement {
    const p = this.getAttribute('placement')
    if (
      p === 'bottom-end' || p === 'top-start' || p === 'top-end' ||
      p === 'bottom' || p === 'top'
    )
      return p
    return 'bottom-start'
  }

  /** Root menu: the previous element sibling is the trigger. Submenu: the
   *  enclosing menu item. One deterministic rule per case — no ambiguity. */
  get triggerAnchor(): HTMLElement | null {
    // Nested in an item → submenu (anchor = that item); otherwise a root menu
    // (anchor = its previous element sibling).
    return (
      (this.closest('a-menu-item') as HTMLElement | null) ??
      (this.previousElementSibling as HTMLElement | null)
    )
  }

  /** For a submenu: the menu that contains its anchor item. */
  private get ownerMenu(): AMenuElement | null {
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

  /** Every tabbable element belonging to THIS menu (items + nested controls
   *  like inputs / sliders / buttons), in DOM order, visible and enabled —
   *  used to trap Tab within the open menu. Submenu contents are excluded
   *  (their nearest `a-menu` is the submenu). */
  private focusables(): HTMLElement[] {
    const sel =
      'a-menu-item, a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]),' +
      ' select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    return (Array.from(this.querySelectorAll(sel)) as HTMLElement[]).filter(
      (el) =>
        el.closest('a-menu') === this && !el.hasAttribute('disabled') && this.isVisible(el),
    )
  }

  private focusFirstItem() {
    // `preventScroll`: the surface is already positioned in-view, so letting the
    // browser scroll the document to the freshly-focused item is redundant — and
    // when the item sits near a viewport edge that programmatic scroll fires the
    // just-bound scroll-dismiss listener, closing the menu the instant it opens.
    this.focusableItems()[0]?.focus({ preventScroll: true })
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
      const parent = this.ownerMenu
      if (parent) {
        const pidx = openStack.indexOf(parent)
        if (pidx !== -1) {
          for (let i = openStack.length - 1; i > pidx; i--) openStack[i]._doHide()
          openStack.length = pidx + 1
        }
      }
    } else if (!openStack.includes(this)) {
      // Root menu: a fresh root closes any other open menu system entirely.
      // Skip when THIS same menu is already open — a context/coord re-trigger
      // is a quiet reposition (below), not a close-then-reopen, which would run
      // closeAll() → a spurious statechange('closed') that dismisses a
      // controlled menu instead of moving it.
      closeAll()
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

    if (viaKeyboard) this.focusFirstItem()
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
    this.reflectExpanded(true)
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
    this.reflectExpanded(false)
    this.cancelOpenTimer()
    this.cancelCloseTimer()
  }

  /** Mirror the open state onto a SUBMENU parent's `aria-expanded`. This is the
   *  one sanctioned light-DOM ARIA mutation (like `el.focus()`): the anchor is
   *  an `<a-menu-item>` the `MenuItem` wrapper renders WITH a resting
   *  `aria-expanded="false"` baseline, so a reactive re-render resets it to a
   *  valid value and the next open/close re-syncs.
   *
   *  A ROOT menu's trigger is a consumer-owned sibling we don't render and have
   *  no baseline for — writing to it would mutate foreign DOM (and couldn't
   *  self-heal), so we leave its `aria-expanded` to the consumer. The menu is
   *  still announced and Esc-dismissable; consumers add `aria-haspopup="menu"`
   *  to their trigger themselves. (`context` menus aren't triggers either.) */
  private reflectExpanded(open: boolean) {
    if (!this.isSubmenu) return
    this.triggerAnchor?.setAttribute('aria-expanded', open ? 'true' : 'false')
  }

  /* ============================ positioning ============================ */

  private position(coord?: [number, number], sync = false) {
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
        left = it.right + this.offset
        if (left + box.width > vw - MARGIN) {
          // Flip to the left of the parent item.
          left = it.left - box.width - this.offset
        }
        left = Math.max(MARGIN, left)
        // Line the submenu's FIRST row up with the parent item. The first row
        // sits border-top + padding-top below the surface's box edge (which is
        // what `top` sets), so offset by that real inset — not a bare MARGIN, or
        // the unaccounted 1px border drifts the flyout down a pixel per level
        // and the drift compounds through nested submenus.
        const cs = view.getComputedStyle(surface)
        const insetTop = parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop)
        top = it.top - insetTop
        if (top + box.height > vh - MARGIN) top = vh - box.height - MARGIN
        top = Math.max(MARGIN, top)
      } else {
        const a = this.triggerAnchor ? anchorRect(this.triggerAnchor) : null
        if (!a) return
        // A root menu is never narrower than its trigger: publish the anchor width
        // so the surface min-width floors to it (see the shadow style's `max()`).
        // Content can still make it wider; it never shrinks below the trigger.
        surface.style.setProperty('--_anchor-width', `${Math.ceil(a.width)}px`)
        const p = this.placement
        const spaceBelow = vh - a.bottom - 2 * MARGIN
        const spaceAbove = a.top - 2 * MARGIN

        // Decide the vertical side: honor the placement, flip if the preferred
        // side lacks room and the other side has more.
        let onTop = p.startsWith('top')
        const natural = surface.scrollHeight
        if (onTop && spaceAbove < natural && spaceBelow > spaceAbove) onTop = false
        else if (!onTop && spaceBelow < natural && spaceAbove > spaceBelow) onTop = true

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

        top = onTop ? a.top - box.height - this.offset : a.bottom + this.offset
        top = Math.max(MARGIN, top)
      }

      surface.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
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
        // Detected STRUCTURALLY (a nested `<a-menu>`), matching `isSubmenu` —
        // not the `submenu` attribute, which the wrapper only emits when the
        // consumer passes `submenu` (so a bare nested `<Menu>` would otherwise
        // open then immediately get dismissed by closeSystem here).
        if (node.querySelector('a-menu')) return
        return this.closeSystem(e)
      }

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
   *  Enter / Space activation is handled by a-menu-item's own global keydown
   *  (which synthesizes a click → routed through onSurfaceClick). */
  handleKey(e: KeyboardEvent) {
    const active = this.doc.activeElement as HTMLElement | null

    // Escape always closes the topmost menu, wherever focus is inside it.
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      const anchor = this.triggerAnchor
      this.requestClose(e)
      anchor?.focus()
      return
    }

    // Trap Tab within the open menu: a non-modal popover doesn't contain focus,
    // so native Tab would walk out the back while the menu is still open. Move
    // focus among ALL of this menu's focusables (items + nested controls),
    // wrapping at the ends so it never escapes.
    if (e.key === 'Tab') {
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

    // Arrow / Home / End / type-ahead drive the item cursor — but only while
    // focus is on a menu item (or still outside, entering via ArrowDown). If
    // the user has Tabbed onto a NESTED control in this menu (input, slider,
    // button), hand the keys back to it.
    const within = active?.closest('a-menu') === this
    if (within && !(active instanceof AMenuItemElement)) return

    const items = this.focusableItems()
    const idx = active ? items.indexOf(active as AMenuItemElement) : -1

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        items[idx < 0 ? 0 : (idx + 1) % items.length]?.focus()
        break
      case 'ArrowUp':
        e.preventDefault()
        items[idx <= 0 ? items.length - 1 : idx - 1]?.focus()
        break
      case 'Home':
        e.preventDefault()
        items[0]?.focus()
        break
      case 'End':
        e.preventDefault()
        items[items.length - 1]?.focus()
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
    // Structural detection (a nested `<a-menu>`), matching `isSubmenu` — so
    // ArrowRight opens the flyout whether or not the `submenu` attribute is set
    // (the wrapper only emits it when the consumer passes `submenu`).
    if (!item || !(item instanceof AMenuItemElement)) return null
    return item.querySelector('a-menu') as AMenuElement | null
  }

  private typeahead(ch: string, items: AMenuItemElement[]) {
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
  private itemLabel(it: AMenuItemElement): string {
    const label = it.querySelector('a-menu-item-label')
    return ((label ?? it).textContent ?? '').trim().toLowerCase()
  }

  /* ====================== trigger listener wiring ====================== */

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
      if (this.isHover) {
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
    } else if (this.isContext) {
      const onContext = (e: MouseEvent) => {
        e.preventDefault()
        this.requestOpen({ coord: [e.clientX, e.clientY], originEvent: e })
      }
      anchor.addEventListener('contextmenu', onContext)
      this.teardown = () => {
        anchor.removeEventListener('contextmenu', onContext)
        this.listening = false
      }
    } else {
      const onClick = (e: MouseEvent) => {
        // detail === 0 ⇒ keyboard-synthesized click (Enter/Space on the
        // trigger) ⇒ open and move focus to the first item.
        const viaKeyboard = e.detail === 0
        // A coord menu opens at the pointer — but a keyboard click reports
        // clientX/clientY = 0, which would pin it to the top-left corner. Fall
        // back to the trigger's own rect (a DOM read, not a mutation) so it
        // opens at the focused trigger instead.
        let coord: [number, number] | undefined
        if (this.isCoord) {
          if (viaKeyboard) {
            const r = anchorRect(anchor)
            coord = [r.left, r.bottom]
          } else {
            coord = [e.clientX, e.clientY]
          }
        }
        if (this._shown) this.requestClose(e)
        else this.requestOpen({ coord, viaKeyboard, originEvent: e })
      }
      anchor.addEventListener('click', onClick)
      this.teardown = () => {
        anchor.removeEventListener('click', onClick)
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
    this.cancelCloseTimer()
    this.closeTimer = setTimeout(() => {
      this.closeTimer = undefined
      this.requestClose()
    }, SUBMENU_CLOSE_DELAY)
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
