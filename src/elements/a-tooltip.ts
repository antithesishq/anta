import { HTMLElementBase, anchorRect, isMenuOpen, isInsideOpenMenu } from '../anta_helpers'
import { debounce } from 'es-toolkit'
import './a-tooltip.css'

/** Gap (px) the bubble keeps from the cursor / anchor / viewport edge. */
const MARGIN = 4
/** Approx pointer height — how far below the cursor the bubble sits in follow mode. */
const CURSOR_SIZE = 16
/** The bubble's horizontal padding (matches `padding: 4px 8px` in the shadow
 *  stylesheet). In cursor-follow mode the bubble is shifted left by this so the
 *  cursor lands at the start of the text, not to the left of the whole bubble. */
const PADDING_X = 8
/** Default show delay (ms) when nothing else is open. Never use 0 — use ~50. */
const DEFAULT_DELAY = 300
/** Enter/exit fade duration (ms). Matches the container transition in a-tooltip.css. */
const FADE_MS = 150
/**
 * Grace window (ms) after a tooltip closes during which the *next* tooltip
 * opens immediately (skips the delay). This is what turns the hop from one
 * anchor to another into a clean cross-fade instead of a delayed re-open.
 */
const GRACE_MS = 300
/**
 * Close delay (ms): the bubble lingers this long after the cursor leaves the
 * anchor instead of vanishing instantly. Covers the gap between two separate
 * anchors so moving between them cross-fades (the outgoing bubble is still up
 * when the next one claims the slot), and gives a moment to move the cursor
 * into an interactive bubble before it dismisses.
 */
const CLOSE_DELAY = 120
/**
 * Cursor-follow proximity fade. While a following bubble is leaving (the cursor
 * has moved off the anchor), its opacity tracks the cursor's distance from the
 * anchor rect: full within PROX_NEAR, a linear ramp to transparent at PROX_FAR.
 * This makes it fade *as you move away* instead of hanging at full opacity and
 * trailing the cursor until the close timer fires. Removal is still timed.
 */
const PROX_NEAR = 10
const PROX_FAR = 100
/**
 * Touch press-and-hold duration (ms) before a long-press opens the tooltip.
 * Touch has no hover, so a deliberate hold is the open gesture; a quick tap
 * does nothing (the synthesized mouse events and tap-focus are both ignored).
 */
const ENTER_TOUCH_DELAY = 500
/**
 * Default elements measured for `truncated-only` — Anta's ellipsizing label parts.
 * A `truncated-selector` overrides this; otherwise we use every matching part,
 * then fall back to the anchor itself. Append future ellipsizing parts here.
 */
const TRUNCATING_PARTS = 'a-tab-label, a-button-label, a-step-hint'
/** True when an element answers the truncation question itself — `a-text` measures
 * its light-DOM clamp, `a-box` measures its own overflow — rather than
 * leaving it to a scrollWidth read on the host. */
function reportsTruncation(el: Element): el is HTMLElement & { isTruncated: boolean } {
  return typeof (el as HTMLElement & { isTruncated?: unknown }).isTruncated === 'boolean'
}
/** Internal marker emitted by JSX text-bearing components with truncation. Its
 * tooltip reads the anchor's rendered text instead of duplicating children. */
const AUTOMATIC_TEXT_TOOLTIP = 'data-anta-text-tooltip'
/**
 * How long (ms) a touch-opened tooltip lingers after the finger lifts, so it
 * stays readable once the anchor is no longer occluded by the fingertip.
 */
const LEAVE_TOUCH_DELAY = 1500
/**
 * Finger travel (px) during a press beyond which it's treated as a drag/scroll
 * rather than a hold — cancels the pending long-press.
 */
const TOUCH_SLOP = 10

type TooltipRegistry = {
  tooltips: Set<ATooltipElement>
  intersecting: boolean
  frame?: number
}
type TooltipCoordination = {
  currentOpen: ATooltipElement | null
  graceTimer?: ReturnType<typeof setTimeout>
  graceFollows: boolean
  anchors: WeakMap<Element, TooltipRegistry>
  observer?: IntersectionObserver
  anchorCount: number
}
const COORDINATION = Symbol.for('anta.tooltip-coordination')
type TooltipDocument = Document & { [COORDINATION]?: TooltipCoordination }

// A document owns its observation and handoff state, including when independently
// compiled entries or classes defined in another frame connect to it.
function coordination(doc: Document): TooltipCoordination {
  const owner = doc as TooltipDocument
  return owner[COORDINATION] ??= {
    currentOpen: null, graceFollows: false, anchors: new WeakMap(), anchorCount: 0,
  }
}

function isHot(next: ATooltipElement): boolean {
  if (!next.hasAttribute('follow')) return false
  const state = coordination(next.ownerDocument)
  if (state.currentOpen) return state.currentOpen.hasAttribute('follow')
  return state.graceTimer !== undefined && state.graceFollows
}

function clearGrace(state: TooltipCoordination) {
  if (state.graceTimer !== undefined) clearTimeout(state.graceTimer)
  state.graceTimer = undefined
  state.graceFollows = false
}

function claimOpen(el: ATooltipElement) {
  const state = coordination(el.ownerDocument)
  const previous = state.currentOpen
  if (previous && previous !== el) {
    if (previous.isConnected) previous.hide()
    else previous.cleanup()
  }
  state.currentOpen = el
  clearGrace(state)
}

function releaseOpen(el: ATooltipElement, doc: Document, grace = true) {
  const state = coordination(doc)
  if (state.currentOpen !== el) return
  state.currentOpen = null
  clearGrace(state)
  if (!grace) return
  state.graceFollows = el.hasAttribute('follow')
  state.graceTimer = setTimeout(() => {
    state.graceTimer = undefined
    state.graceFollows = false
  }, GRACE_MS)
}

/** Explicit content wins over the automatic tooltip appended by text wrappers. */
function preferredTooltip(registry: TooltipRegistry): ATooltipElement | undefined {
  let automatic: ATooltipElement | undefined
  let explicit: ATooltipElement | undefined
  for (const tooltip of registry.tooltips) {
    if (tooltip.hasAttribute(AUTOMATIC_TEXT_TOOLTIP)) automatic = tooltip
    else explicit = tooltip
  }
  return explicit ?? automatic
}

function syncAnchorListeners(anchor: Element, registry: TooltipRegistry, doc: Document) {
  const preferred = preferredTooltip(registry)
  for (const tooltip of registry.tooltips) {
    if (tooltip !== preferred) tooltip.cleanup()
  }
  const view = doc.defaultView
  if (registry.frame !== undefined) view?.cancelAnimationFrame(registry.frame)
  registry.frame = undefined
  if (!preferred || !registry.intersecting || !view) {
    preferred?.cleanup()
    return
  }
  registry.frame = view.requestAnimationFrame(() => {
    registry.frame = undefined
    const current = coordination(doc).anchors.get(anchor)
    if (current !== registry || !current.intersecting || preferredTooltip(current) !== preferred) return
    preferred.setupListeners()
  })
}

function observeAnchor(anchor: Element, doc: Document, state: TooltipCoordination) {
  const Observer = doc.defaultView?.IntersectionObserver
  if (!state.observer && Observer) {
    state.observer = new Observer(entries => {
      for (const entry of entries) {
        const registry = state.anchors.get(entry.target)
        if (!registry) continue
        registry.intersecting = entry.isIntersecting
        syncAnchorListeners(entry.target, registry, doc)
      }
    }, { root: null, rootMargin: '0px', threshold: 0 })
  }
  state.observer?.observe(anchor)
}

/**
 * `<a-tooltip>` — floating bubble placed as a child of the element it
 * describes.
 *
 * Styling notes (`a-tooltip.css` ships comment-free):
 * - `a-tooltip:not(:defined)` is hidden — before upgrade the host is an
 *   unknown inline element and its content would flash *inside the anchor*.
 *   Once defined, external host CSS applies `display: contents` and
 *   content renders only in the popover via the slot.
 * - Only the bubble "chrome" is tokenized (`--tooltip-*`): it lives inside
 *   the shadow popover, unreachable from plain consumer CSS; the custom
 *   properties inherit across the shadow boundary. The content is slotted
 *   light DOM — its font/color/size are already styleable from the page and
 *   are intentionally NOT tokens.
 * - The frost: `--tooltip-bg` is a mostly-opaque mix of `--bg-1` that, with
 *   the container's backdrop blur, reads as a frosted bubble. `light-dark()`
 *   lowers the dark alpha and adds an inset white ring so the edge stays crisp
 *   on dark content. There's no real border by
 *   default — the hairline edge comes from `--tooltip-shadow`; set
 *   `--tooltip-border` for an actual one.
 * - On coarse/no-hover pointers, an anchor that owns a tooltip
 *   (`:where(:has(> a-tooltip))`, specificity 0 for easy override)
 *   suppresses long-press text selection and the iOS callout so
 *   press-and-hold cleanly reveals the bubble (see the long-press handling
 *   below) instead of selecting text or popping the system menu.
 */
export class ATooltipElement extends HTMLElementBase {
  // Observe `delay` so changing it at runtime — e.g. the docs playground
  // patches the attribute on the live element — rebuilds the show debounce
  // with the new value instead of keeping the one captured at setup.
  static observedAttributes = ['delay']

  /** Shadow-internal popover surface — the only thing we ever mutate. */
  private container!: HTMLDivElement
  /** Inner bubble inside `.container`. This IS the `<slot>` (styled
   *  `display:block`), so it both projects the content and paints all visual
   *  chrome — one element instead of a div-wrapping-a-slot. It carries the
   *  proximity (distance-from-anchor) opacity, kept separate from the
   *  container's enter/exit/cross-fade opacity. */
  private bubble!: HTMLSlotElement
  private anchor: HTMLElement | null = null
  #connectedDocument?: Document
  #globalDocument?: Document
  #positionView?: Window
  #internals: ElementInternals

  listening = false
  private shown = false
  /** True while the current open was triggered by a touch long-press. Such a
   *  bubble is pinned (never cursor-follows) and biases above the anchor so the
   *  fingertip doesn't cover it. */
  private touchOpen = false
  private lastMouse?: MouseEvent

  private debouncedShow?: ((e?: MouseEvent) => void) & { cancel: () => void }
  private teardown?: () => void
  private closeTimer?: ReturnType<typeof setTimeout>
  private fading = false
  private fadeTimer?: ReturnType<typeof setTimeout>
  private docMoveBound = false
  /** Active only while shown: re-runs the empty gate when the slotted content
   *  changes under a live bubble. See observeContent(). */
  private contentObserver?: MutationObserver

  constructor() {
    super()
    // Built ONCE, here, off the reconciliation path. All later changes
    // are confined to this shadow subtree — never the host or light DOM.
    const shadow = this.attachShadow({ mode: 'open' })
    this.#internals = this.attachInternals()

    // The popover and styled slot retain independent lifecycle/proximity fades.
    // Defaults live in a-tooltip.css; runtime writes stay on these owned nodes.
    this.container = this.doc.createElement('div')
    this.container.className = 'container'
    this.container.setAttribute('part', 'container')
    this.container.setAttribute('popover', 'manual')
    this.container.setAttribute('role', 'tooltip')

    // The bubble IS the slot (styled `display:block`): it projects the content
    // AND paints the visual chrome, and carries the proximity opacity; the
    // container owns the lifecycle/cross-fade opacity. One element, not a
    // div-wrapping-a-slot. Exposed as a shadow part so consumers can reach the
    // surface itself — `a-tooltip::part(bubble) { … }` (`::part` matches any
    // shadow element with the name, slots included) — for things the
    // `--tooltip-*` vars don't cover.
    this.bubble = this.doc.createElement('slot')
    this.bubble.className = 'bubble'
    this.bubble.setAttribute('part', 'bubble')
    this.container.append(this.bubble)

    // Keep an interactive bubble open while the cursor is inside it (these
    // only fire when pointer-events is on, i.e. interactive mode). The
    // anchor's mouseleave schedules a hide; moving into the bubble within
    // that window cancels it, so you can travel anchor → bubble and click.
    this.container.addEventListener('mouseenter', () => { if (this.#isInteractive) this.cancelHide() })
    this.container.addEventListener('mouseleave', () => { if (this.#isInteractive && this.shown) this.scheduleHide() })

    this.container.addEventListener('focusin', () => { if (this.#isInteractive) this.cancelHide() })
    this.container.addEventListener('focusout', () => {
      if (this.#isInteractive && this.shown) this.scheduleHide()
    })
    for (const type of [
      'pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'pointerover', 'pointerout',
      'gotpointercapture', 'lostpointercapture',
      'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout',
      'click', 'dblclick', 'auxclick', 'contextmenu',
      'touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel',
    ]) {
      this.container.addEventListener(type, event => {
        if (this.#isInteractive && this.hasAttribute('contain-events')) event.stopPropagation()
      }, { passive: true })
    }
    shadow.append(this.container)
  }

  connectedCallback() {
    const parent = this.parentElement
    if (!parent) return
    this.anchor = parent
    const doc = this.#connectedDocument = this.doc
    const state = coordination(doc)
    let registry = state.anchors.get(parent)
    if (!registry) {
      registry = { tooltips: new Set(), intersecting: !doc.defaultView?.IntersectionObserver }
      state.anchors.set(parent, registry)
      state.anchorCount++
      observeAnchor(parent, doc, state)
    }
    registry.tooltips.add(this)
    syncAnchorListeners(parent, registry, doc)
  }

  disconnectedCallback() {
    this.cleanup()
    const doc = this.#connectedDocument
    if (this.anchor && doc) {
      const anchor = this.anchor
      const state = coordination(doc)
      const registry = state.anchors.get(anchor)
      registry?.tooltips.delete(this)
      if (registry && registry.tooltips.size === 0) {
        if (registry.frame !== undefined) doc.defaultView?.cancelAnimationFrame(registry.frame)
        state.anchors.delete(anchor)
        state.observer?.unobserve(anchor)
        if (--state.anchorCount === 0) {
          state.observer?.disconnect()
          state.observer = undefined
          clearGrace(state)
        }
      } else if (registry) {
        syncAnchorListeners(anchor, registry, doc)
      }
    }
    this.anchor = null
    this.#connectedDocument = undefined
  }

  attributeChangedCallback(name: string) {
    // `delay` is baked into the debounce, so rebuild it when the attribute
    // changes (only meaningful once listeners are wired).
    if (name === 'delay' && this.listening) this.makeDebouncedShow()
  }

  /** (Re)build the show debounce with the CURRENT `delay` (rebuilt when the
   *  `delay` attribute changes). Re-armed on each hover move (trailing), and
   *  fed the latest cursor event, so it shows at the cursor and so moving back
   *  onto an anchor after the tooltip was dismissed re-arms it. */
  private makeDebouncedShow() {
    this.debouncedShow?.cancel()
    this.debouncedShow = debounce((e?: MouseEvent) => this.show(e), this.#delay)
  }


  get #isInteractive(): boolean {
    return this.hasAttribute('interactive') || this.hasAttribute('contain-events')
  }

  /** Pinned under the anchor (no cursor-following) — the DEFAULT. Following the
   *  cursor is opt-in via the `follow` attribute. `interactive` (you can't move
   *  into a bubble that chases the cursor) and a touch long-press (a finger
   *  can't track one) force pinned regardless of `follow`. */
  get #isPinned(): boolean {
    if (this.#isInteractive || this.touchOpen) return true
    return !this.hasAttribute('follow')
  }

  get #prefersTop(): boolean {
    return this.getAttribute('placement') === 'top'
  }

  get #prefersLeft(): boolean {
    return this.getAttribute('placement') === 'left'
  }

  get #prefersRight(): boolean {
    return this.getAttribute('placement') === 'right'
  }

  get #delay(): number {
    const attr = this.getAttribute('delay')
    if (attr == null) return DEFAULT_DELAY
    const n = parseInt(attr, 10)
    return Number.isFinite(n) ? n : DEFAULT_DELAY
  }

  // --- truncated-only gating (UI-thread layout READS — no mutation) ---

  /** When set, the tooltip only shows if its resolved target is actually
   *  truncated/clipped; a fitting label gets no tooltip. */
  get #truncatedOnly(): boolean {
    return this.hasAttribute('truncated-only')
  }

  /** JSX truncation wrappers emit an empty marked tooltip. It takes its content
   * from the anchor, while a consumer-provided sibling tooltip takes precedence
   * even when that sibling is empty. */
  get #isAutomaticTextTooltip(): boolean {
    return this.hasAttribute(AUTOMATIC_TEXT_TOOLTIP)
  }

  private hasExplicitTextTooltip(): boolean {
    const anchor = this.anchor
    if (!this.#isAutomaticTextTooltip || !anchor) return false
    return Array.from(anchor.children).some(
      (child) =>
        child !== this &&
        child.localName === 'a-tooltip' &&
        !child.hasAttribute(AUTOMATIC_TEXT_TOOLTIP),
    )
  }

  /** Text rendered by the anchor, excluding every tooltip's light-DOM content.
   *  An automatic text tooltip has no light children itself, but nested custom
   *  tooltips might; including their hidden content would produce a misleading
   *  fallback string. */
  private anchorText(): string {
    const read = (node: Node): string => {
      if (node.nodeType === 3) return node.textContent ?? ''
      if (node.nodeType === 1 && (node as Element).localName === 'a-tooltip') return ''
      return Array.from(node.childNodes).map(read).join('')
    }
    return this.anchor ? Array.from(this.anchor.childNodes).map(read).join('').trim() : ''
  }

  private syncAutomaticTextContent() {
    if (this.#isAutomaticTextTooltip) this.bubble.textContent = this.anchorText()
  }

  /** The elements whose overflow decides whether the tooltip shows: every
   *  `truncated-selector` match within the anchor wins; else the anchor itself
   *  when it reports its own truncation; else every one of Anta's ellipsizing
   *  label parts inside the anchor; else the anchor itself (which may be the
   *  clipping box for a hand-authored target). */
  private resolveTruncationTargets(): HTMLElement[] {
    const anchor = this.anchor
    if (!anchor) return []
    const sel = this.getAttribute('truncated-selector')
    if (sel) {
      try {
        const found = Array.from(anchor.querySelectorAll(sel)) as HTMLElement[]
        if (found.length) return found
      } catch {
        /* invalid selector → fall through to the defaults */
      }
    }
    // An anchor that answers for itself has already decided. `a-box` IS the
    // clipping box, so a label part belonging to some child inside it says
    // nothing about whether the box clips: a Box full of Buttons that fit would
    // otherwise report "not truncated" while the Box hides half of them.
    // `truncated-selector` above still overrides this.
    if (reportsTruncation(anchor)) return [anchor]
    const parts = Array.from(
      anchor.querySelectorAll(TRUNCATING_PARTS),
    ) as HTMLElement[]
    return parts.length ? parts : [anchor]
  }

  /** True when any resolved target overflows its box (horizontal ellipsis or
   *  vertical clamp). A 1px threshold absorbs sub-pixel rounding; a zero-size
   *  (hidden / detached) target counts as not truncated. Measured fresh on each
   *  show attempt, so late fonts / resizes self-correct with no observer. */
  private isTargetTruncated(): boolean {
    return this.resolveTruncationTargets().some((target) => {
      // `a-text` owns the clamping box in shadow DOM. Its host itself does not
      // overflow, so consume the element's read-only UI-thread measurement first.
      if (reportsTruncation(target)) return target.isTruncated
      if (target.clientWidth === 0 && target.clientHeight === 0) return false
      if (target.scrollWidth - target.clientWidth > 1) return true
      // Tight line heights can produce vertical font overflow without an ellipsis.
      if (this.view.getComputedStyle(target).whiteSpace === 'nowrap') return false
      return target.scrollHeight - target.clientHeight > 1
    })
  }

  /** True when there's nothing worth showing: no element children (so an
   *  icon/image-only bubble still counts as content) and no non-whitespace text
   *  (so formatting whitespace / an empty conditional doesn't open a blank bubble).
   *  Re-checked on every show(), so a tooltip populated later self-corrects. */
  private isEmpty(): boolean {
    if (this.#isAutomaticTextTooltip) return this.anchorText() === ''
    return this.children.length === 0 && (this.textContent ?? '').trim() === ''
  }

  /** While shown, watch the slotted content so a bubble whose content is
   *  cleared out from under it — a reactive re-render dropping the text /
   *  children under one persistent anchor — self-hides. The mirror of
   *  isEmpty()'s "populated later self-corrects": the show-time gate can't fire
   *  again on its own once open, so this drives the reverse.
   *
   *  A MutationObserver, not `slotchange`, because reactive renderers update
   *  text in place — React sets an existing text node's nodeValue rather than
   *  replacing the node — which changes no assigned-node set and so fires no
   *  `slotchange`; childList + characterData + subtree catches both that and
   *  node removal. Observing our own light-DOM children is a READ (like the
   *  truncation measurements), so it stays within the no-host-mutation rule.
   *  Runs only while shown — attached here, disconnected by hide() / cleanup(). */
  private observeContent() {
    if (typeof MutationObserver === 'undefined') return
    if (!this.contentObserver) {
      this.contentObserver = new this.view.MutationObserver(() => {
        if (!this.shown) return
        this.syncAutomaticTextContent()
        if (this.isEmpty()) this.hide()
        else this.position(this.lastMouse)
      })
    }
    this.contentObserver.observe(this.#isAutomaticTextTooltip ? this.anchor ?? this : this, {
      childList: true,
      characterData: true,
      subtree: true,
    })
  }

  // --- positioning (sets only the shadow container's own transform) ---

  // Single pending position frame: a burst of mousemoves within one frame
  // coalesces to ONE layout read + transform write, using the LATEST geometry
  // (earlier samples never matter — only where the cursor ends the frame).
  private positionFrame?: number
  private pendingPosition?: () => void
  private schedulePosition(compute: () => void) {
    this.pendingPosition = compute
    if (this.positionFrame != null) return
    this.#positionView = this.view
    this.positionFrame = this.#positionView.requestAnimationFrame(() => {
      this.positionFrame = undefined
      const run = this.pendingPosition
      this.pendingPosition = undefined
      run?.()
    })
  }

  /** Pick the vertical origin: prefer the `above` candidate when `preferAbove`
   *  (auto-flipping to `below` if it'd clip the top), else `below` (flipping to
   *  `above` if it'd clip the bottom). Shared by anchor- and cursor-anchored
   *  placement — only the candidate origins differ. */
  private flipVertical(above: number, below: number, boxHeight: number, vh: number, preferAbove: boolean): number {
    if (preferAbove) return above < MARGIN ? below : above
    return below + boxHeight > vh ? above : below
  }

  /** Clamp a candidate (left, top) into the viewport and write it as the
   *  container's transform — the single place the transform is set. */
  private place(left: number, top: number, boxWidth: number, boxHeight: number, vw: number, vh: number) {
    if (left + boxWidth > vw) left = vw - boxWidth - MARGIN
    left = Math.max(MARGIN, left)
    if (top + boxHeight > vh) top = vh - boxHeight - MARGIN
    top = Math.max(MARGIN, top)
    this.container.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
  }

  private positionToTarget = () => {
    this.schedulePosition(() => {
      if (!this.anchor || !this.shown) return
      // The anchor's advertised rect (a-input reports its field, not the host).
      const a = anchorRect(this.anchor)
      const box = this.container.getBoundingClientRect()
      const { innerWidth: vw, innerHeight: vh } = this.view
      if (this.#prefersLeft || this.#prefersRight) {
        const before = a.left - box.width - MARGIN
        const after = a.right + MARGIN
        const left = this.#prefersRight
          ? (after + box.width <= vw - MARGIN ? after : before)
          : (before >= MARGIN ? before : after)
        const top = a.top + (a.height - box.height) / 2
        this.place(left, top, box.width, box.height, vw, vh)
        return
      }
      // Touch long-press biases above the anchor so the fingertip resting on it
      // doesn't cover the bubble (auto-flips below when there's no room).
      const top = this.flipVertical(a.top - box.height - MARGIN, a.bottom + MARGIN, box.height, vh, this.#prefersTop || this.touchOpen)
      this.place(a.left, top, box.width, box.height, vw, vh)
    })
  }

  private positionToMouse = (e: MouseEvent) => {
    this.schedulePosition(() => {
      if (!this.shown && !this.fading) return
      const box = this.container.getBoundingClientRect()
      const { innerWidth: vw, innerHeight: vh } = this.view
      if (this.#prefersLeft || this.#prefersRight) {
        const before = e.clientX - box.width - MARGIN
        const after = e.clientX + CURSOR_SIZE
        const left = this.#prefersRight
          ? (after + box.width <= vw - MARGIN ? after : before)
          : (before >= MARGIN ? before : after)
        this.place(left, e.clientY - box.height / 2, box.width, box.height, vw, vh)
        return
      }
      // Shift left by the bubble's left padding so the cursor sits at the start
      // of the text rather than to the left of the whole bubble.
      const top = this.flipVertical(e.clientY - box.height - MARGIN * 2, e.clientY + CURSOR_SIZE, box.height, vh, this.#prefersTop)
      this.place(e.clientX - PADDING_X, top, box.width, box.height, vw, vh)
    })
  }

  private position(e?: MouseEvent) {
    if (!this.#isPinned && e) this.positionToMouse(e)
    else this.positionToTarget()
  }

  /** Opacity for the inner bubble from the cursor's distance to the anchor rect
   *  (0 inside the rect): 1 within PROX_NEAR, a linear ramp to 0 at PROX_FAR.
   *  Cursor-follow only — drives the "fade as you move away" behavior. */
  private proximityOpacity(e: MouseEvent): number {
    if (!this.anchor) return 1
    const r = anchorRect(this.anchor)
    const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right)
    const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom)
    const dist = Math.hypot(dx, dy)
    if (dist <= PROX_NEAR) return 1
    if (dist >= PROX_FAR) return 0
    return 1 - (dist - PROX_NEAR) / (PROX_FAR - PROX_NEAR)
  }

  // --- show / hide ---

  show = (e?: MouseEvent) => {
    if (!this.anchor) return
    // While a menu is open, a tooltip anchored OUTSIDE the open menu system must
    // not show: both are top-layer popovers ordered by show time, so it would
    // paint over the menu (z-index can't reorder the top layer). A menu-item
    // tooltip (anchor inside the menu) still shows, above the menu. Mirrors the
    // menu dismissing its own trigger's tooltip on open.
    if (isMenuOpen(this.doc) && !isInsideOpenMenu(this.anchor)) return
    if (this.hasExplicitTextTooltip()) return
    // Nothing to show → don't open a blank bubble (checked here so every show
    // path — hot-path, focus, touch long-press — is covered).
    if (this.isEmpty()) return
    // truncated-only: bail unless the target is actually clipped (covers the
    // hot-path, focus, and touch long-press, which call show() directly).
    if (this.#truncatedOnly && !this.isTargetTruncated()) return
    this.syncAutomaticTextContent()
    this.cancelHide() // re-showing (or a hand-off) cancels any pending close
    // Nested anchors: if this anchor *contains* the currently-open tooltip's
    // anchor, an inner (descendant) tooltip is showing — defer to it instead
    // of covering it with this ancestor's. (A descendant or unrelated anchor
    // falls through and takes over, giving the normal hand-off.) Without this
    // the outer + inner would thrash for the single open slot on every move.
    const currentOpen = coordination(this.doc).currentOpen
    if (currentOpen && currentOpen !== this && currentOpen.anchor && this.anchor.contains(currentOpen.anchor)) {
      return
    }
    claimOpen(this) // closes any previously-open tooltip → cross-fade
    if (!this.shown) {
      this.shown = true
      this.fading = false
      // Start fully opaque — a fresh open, a re-enter, or a cross-fade-in all
      // begin at proximity 1; onDocMove then ramps it down as the cursor leaves.
      this.#internals.states.delete('proximity-hidden')
      this.bubble.style.opacity = '1'
      if (this.fadeTimer !== undefined) { clearTimeout(this.fadeTimer); this.fadeTimer = undefined }
      this.container.showPopover()
      this.#globalDocument = this.doc
      // A fixed-position popover doesn't scroll with the page, so dismiss
      // on external scroll (capture catches nested scroll containers too) rather
      // than leaving the bubble orphaned over empty space.
      this.view.addEventListener('scroll', this.onScroll, { capture: true, passive: true })
      this.doc.addEventListener('keydown', this.onKeyDown, true)
      // Follow the cursor for the whole time it's shown — including after the
      // pointer has left the anchor (close pending) AND through the exit fade
      // — so a following bubble keeps trailing the mouse instead of freezing.
      // (No-op for pinned tooltips.) Detached when the fade finishes.
      if (!this.docMoveBound) { this.doc.addEventListener('mousemove', this.onDocMove); this.docMoveBound = true }
      // Now that the bubble is up, watch for its content being emptied out from
      // under it so it self-hides (mirror of the show-time empty gate).
      this.observeContent()
    }
    // Position AFTER showPopover so the bubble is laid out & measurable
    // (wrapped to max-width). Opacity is still ~0 here, so setting the
    // transform never flashes.
    this.position(e)
    const initialPosition = this.pendingPosition
    if (initialPosition) {
      if (this.positionFrame !== undefined) this.#positionView?.cancelAnimationFrame(this.positionFrame)
      this.positionFrame = undefined
      this.pendingPosition = undefined
      initialPosition()
    }
  }

  private isInternalScroll = (event: Event) =>
    this.#isInteractive && event.composedPath().includes(this)

  private onScroll = (event: Event) => {
    if (!this.isInternalScroll(event)) this.hide()
  }

  hide = () => {
    this.cancelHide()
    if (!this.shown) return
    this.shown = false
    this.touchOpen = false
    this.contentObserver?.disconnect()
    this.container.hidePopover()
    // Keep the scroll / key / cursor-follow listeners through the exit fade (a
    // following bubble keeps trailing the pointer as it fades), then detach all.
    this.fading = true
    if (this.fadeTimer !== undefined) clearTimeout(this.fadeTimer)
    this.fadeTimer = setTimeout(() => this.detachGlobals(), FADE_MS)
    releaseOpen(this, this.#connectedDocument ?? this.doc)
  }

  /** Remove every document / window listener this element binds and stop the
   *  fade timer. Used by hide() (after the exit fade) and by cleanup()
   *  (immediately). Idempotent. */
  private detachGlobals() {
    if (this.fadeTimer !== undefined) { clearTimeout(this.fadeTimer); this.fadeTimer = undefined }
    this.fading = false
    const doc = this.#globalDocument
    doc?.defaultView?.removeEventListener('scroll', this.onScroll, { capture: true })
    doc?.removeEventListener('keydown', this.onKeyDown, true)
    if (this.docMoveBound) {
      doc?.removeEventListener('mousemove', this.onDocMove)
      this.docMoveBound = false
    }
    this.#globalDocument = undefined
  }

  /** Full, immediate teardown: close the popover now (no fade), detach every
   *  listener, clear all timers, release the coordinator slot, reset state.
   *  Idempotent. Called from disconnectedCallback, and from the orphan safety
   *  net (claimOpen / onDocMove) when the element is gone but
   *  disconnectedCallback didn't fire. Not `private` — the module coordinator
   *  calls it. */
  cleanup() {
    this.cancelHide()
    if (this.positionFrame !== undefined) this.#positionView?.cancelAnimationFrame(this.positionFrame)
    this.positionFrame = undefined
    this.#positionView = undefined
    this.pendingPosition = undefined
    this.lastMouse = undefined
    this.contentObserver?.disconnect()
    if (this.shown) {
      this.shown = false
      this.touchOpen = false
      if (this.container.matches(':popover-open')) this.container.hidePopover()
    }
    this.detachGlobals()
    this.teardownListeners()
    releaseOpen(this, this.#connectedDocument ?? this.doc, false)
    this.touchOpen = false
    this.#internals.states.delete('proximity-hidden')
    this.bubble.style.opacity = ''
  }

  /** While shown, track the cursor even after it has left the anchor (during
   *  the close delay). Only runs for `follow` tooltips — pinned bubbles
   *  (the default, `interactive`, touch) stay put. */
  private onDocMove = (e: MouseEvent) => {
    // Orphan safety net: if the host was removed without disconnectedCallback
    // firing, the coordinator's strong ref kept us (and this listener) alive.
    // The next mouse move tears us down — mousemove is the one global event
    // guaranteed to keep firing while a following bubble is up.
    if (!this.isConnected) { this.cleanup(); return }
    if (!(this.shown || this.fading) || this.#isPinned) return
    this.lastMouse = e
    const o = this.proximityOpacity(e)
    // Beyond PROX_FAR the cursor has clearly left: blank the bubble instantly
    // (no transition) AND dismiss now, so a fast flick can't leave it trailing
    // or fading across the screen. Doesn't wait on the close timer or further
    // mouse samples. Safe for the cross-fade — a >PROX_FAR jump means there's no
    // adjacent anchor to hand off to.
    if (o === 0) {
      this.#internals.states.add('proximity-hidden')
      this.bubble.style.opacity = '0'
      if (this.shown) this.hide()
      return
    }
    // Within the ramp: follow the cursor and fade smoothly by distance.
    this.positionToMouse(e)
    this.#internals.states.delete('proximity-hidden')
    this.bubble.style.opacity = String(o)
  }

  /** Hide after CLOSE_DELAY unless something cancels it first (re-enter, or
   *  another tooltip claiming the slot). Lets the bubble bridge the gap to a
   *  neighbouring anchor — and survive the trip into an interactive bubble. */
  private scheduleHide = (delay = CLOSE_DELAY) => {
    this.cancelHide()
    this.closeTimer = setTimeout(() => {
      this.closeTimer = undefined
      if (this.#isInteractive && this.matches(':focus-within')) return
      this.hide()
    }, delay)
  }

  private cancelHide() {
    if (this.closeTimer !== undefined) {
      clearTimeout(this.closeTimer)
      this.closeTimer = undefined
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.hide() // Escape dismisses immediately
  }

  /** Open now if another tooltip is hot (skip delay), else (re)arm the delayed
   *  show with the latest cursor event. */
  private trigger(e?: MouseEvent) {
    // Don't even arm the delayed show for an empty or non-truncated target.
    if (this.hasExplicitTextTooltip()) return
    if (this.isEmpty()) return
    if (this.#truncatedOnly && !this.isTargetTruncated()) return
    if (isHot(this)) {
      this.debouncedShow?.cancel()
      this.show(e)
    } else {
      this.debouncedShow?.(e)
    }
  }

  // --- lazy listener wiring (called by the intersection observer) ---

  setupListeners() {
    if (this.listening || !this.anchor) {
      this.listening = true
      return
    }
    const anchor = this.anchor
    const view = this.view // element's own frame — see the `view`/`doc` getters
    const doc = this.doc
    this.makeDebouncedShow()

    // --- hover (mouse pointers only) -------------------------------------
    // Pointer (not mouse) events so we can read `pointerType` and ignore the
    // synthesized mouse* sequence a touch tap fires — otherwise a tap would
    // open the tooltip via the emulated `mouseenter`. Listeners are bound to
    // the ANCHOR (not document): the cursor is over the anchor while hovering,
    // descendant moves bubble up to it, and it stays in the same document /
    // registry as this element (a document-level listener proved unreliable
    // across the playground's preview iframe). PointerEvent extends MouseEvent,
    // so positioning (clientX/clientY) is unchanged.
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      this.lastMouse = e
      if (this.shown) {
        if (!this.#isPinned) this.positionToMouse(e)
      } else {
        // (Re)arm the delayed show. This also re-arms after the tooltip was
        // dismissed without leaving the anchor — e.g. moving back onto the
        // outer box after a nested inner tooltip claimed and hid it.
        this.trigger(e)
      }
    }

    const onLeave = (event?: Event) => {
      if (event?.type === 'scroll' && this.isInternalScroll(event)) return
      this.debouncedShow?.cancel()
      anchor.removeEventListener('pointermove', onPointerMove)
      anchor.removeEventListener('pointerleave', onLeave)
      anchor.removeEventListener('blur', onLeave)
      view.removeEventListener('pagehide', onLeave)
      view.removeEventListener('scroll', onLeave, true)
      doc.removeEventListener('visibilitychange', onLeave)
      this.scheduleHide() // linger briefly instead of vanishing on exit
    }

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      this.lastMouse = e
      anchor.addEventListener('pointermove', onPointerMove)
      anchor.addEventListener('pointerleave', onLeave)
      view.addEventListener('pagehide', onLeave)
      view.addEventListener('scroll', onLeave, { capture: true, passive: true })
      doc.addEventListener('visibilitychange', onLeave)
      this.trigger(e)
    }

    // --- keyboard focus ---------------------------------------------------
    // Gate on `:focus-visible` so only keyboard-style focus opens the tooltip.
    // A tap/click focuses the anchor too, but doesn't match `:focus-visible`,
    // so touch/mouse focus no longer pops the bubble (it was the main reason a
    // tap showed it). Mouse users still get it via hover above.
    const onFocus = () => {
      const focused = anchor.shadowRoot?.activeElement ?? this.doc.activeElement
      if (!focused?.matches(':focus-visible')) return
      anchor.addEventListener('blur', onLeave)
      view.addEventListener('pagehide', onLeave)
      view.addEventListener('scroll', onLeave, { capture: true, passive: true })
      doc.addEventListener('visibilitychange', onLeave)
      this.trigger() // no pointer event → positions to the anchor
    }

    // --- touch press-and-hold --------------------------------------------
    // Touch has no hover, so a deliberate long-press is the open gesture.
    // `pointerdown` (touch/pen) arms a timer; if the finger stays put past
    // ENTER_TOUCH_DELAY the bubble opens pinned above the anchor. A move past
    // TOUCH_SLOP, an early lift, a `pointercancel` (the UA claimed the gesture
    // as a scroll), or a scroll all abort it. After a touch-open, the bubble
    // lingers LEAVE_TOUCH_DELAY past the lift so it's readable.
    let pressTimer: ReturnType<typeof setTimeout> | undefined
    let pressStart: { x: number; y: number } | undefined
    const preventContext = (e: Event) => e.preventDefault()
    const clearPressTimer = () => {
      if (pressTimer !== undefined) { clearTimeout(pressTimer); pressTimer = undefined }
      pressStart = undefined
    }
    const onPressMove = (e: PointerEvent) => {
      if (pressStart && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > TOUCH_SLOP) {
        clearPressTimer() // became a drag/scroll — not a hold
      }
    }
    // onPressEnd ⇄ detachPress reference each other; arrow closures resolve the
    // name at call time, so the forward reference is fine (neither runs during
    // declaration).
    const onPressEnd = () => {
      clearPressTimer()
      detachPress()
      // If the long-press opened the bubble, hold it for a readable beat after
      // the finger lifts before dismissing.
      if (this.shown && this.touchOpen) this.scheduleHide(LEAVE_TOUCH_DELAY)
    }
    const detachPress = () => {
      anchor.removeEventListener('pointermove', onPressMove)
      anchor.removeEventListener('pointerup', onPressEnd)
      anchor.removeEventListener('pointercancel', onPressEnd)
      anchor.removeEventListener('contextmenu', preventContext)
      view.removeEventListener('scroll', cancelPress, true)
    }
    const cancelPress = () => { clearPressTimer(); detachPress() }
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return // mouse uses the hover path above
      clearPressTimer()
      pressStart = { x: e.clientX, y: e.clientY }
      anchor.addEventListener('pointermove', onPressMove)
      anchor.addEventListener('pointerup', onPressEnd)
      anchor.addEventListener('pointercancel', onPressEnd)
      // Suppress the Android long-press context menu during the hold.
      anchor.addEventListener('contextmenu', preventContext)
      view.addEventListener('scroll', cancelPress, { capture: true, passive: true })
      pressTimer = setTimeout(() => {
        pressTimer = undefined
        this.touchOpen = true
        this.show() // no event → pinned to the anchor, biased above (touchOpen)
        if (!this.shown) this.touchOpen = false
      }, ENTER_TOUCH_DELAY)
    }

    anchor.addEventListener('pointerenter', onEnter)
    anchor.addEventListener('focusin', onFocus)
    anchor.addEventListener('pointerdown', onPointerDown)

    this.teardown = () => {
      this.debouncedShow?.cancel()
      clearPressTimer()
      detachPress()
      anchor.removeEventListener('pointermove', onPointerMove)
      anchor.removeEventListener('pointerenter', onEnter)
      anchor.removeEventListener('pointerleave', onLeave)
      anchor.removeEventListener('focusin', onFocus)
      anchor.removeEventListener('blur', onLeave)
      anchor.removeEventListener('pointerdown', onPointerDown)
      view.removeEventListener('pagehide', onLeave)
      view.removeEventListener('scroll', onLeave, true)
      doc.removeEventListener('visibilitychange', onLeave)
      this.listening = false
    }
    this.listening = true
  }

  teardownListeners() {
    this.teardown?.()
    this.teardown = undefined
  }
}

export function register_a_tooltip() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-tooltip')) {
    customElements.define('a-tooltip', ATooltipElement)
  }
}

// Importing this module registers the element (granular entry point). The
// barrel re-exports it, so importing the barrel registers it too. Idempotent.
register_a_tooltip()
