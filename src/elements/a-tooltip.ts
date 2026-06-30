import { HTMLElementBase } from '../anta_helpers'
import { debounce } from 'es-toolkit'
import './a-tooltip.css'

/** Gap (px) the bubble keeps from the cursor / anchor / viewport edge. */
const MARGIN = 4
/** Approx pointer height — how far below the cursor the bubble sits in follow mode. */
const CURSOR_SIZE = 16
/** The bubble's horizontal padding (matches `padding: 4px 8px` in the shadow
 *  style). In cursor-follow mode the bubble is shifted left by this so the
 *  cursor lands at the start of the text, not to the left of the whole bubble. */
const PADDING_X = 8
/** Default show delay (ms) when nothing else is open. Never use 0 — use ~50. */
const DEFAULT_DELAY = 250
/** Enter/exit fade duration (ms). Mirrors `--_dur` in the shadow style. */
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
/** Transition (ms) on the proximity opacity channel — small, just to smooth the
 *  discrete mousemove steps. Must stay well under FADE_MS so it never competes
 *  with the enter / cross-fade on the outer container. */
const PROX_FADE_MS = 60
/**
 * Touch press-and-hold duration (ms) before a long-press opens the tooltip.
 * Touch has no hover, so a deliberate hold is the open gesture; a quick tap
 * does nothing (the synthesized mouse events and tap-focus are both ignored).
 */
const ENTER_TOUCH_DELAY = 500
/**
 * Default elements measured for `truncated-only` — Anta's ellipsizing label parts
 * (`<a-tab-label>` / `<a-button-label>` share the same overflow:hidden + ellipsis
 * pattern). A `truncated-selector` overrides this; otherwise we fall back to the
 * anchor itself. Append future ellipsizing parts here.
 */
const TRUNCATING_PARTS = 'a-tab-label, a-button-label'
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

/* ------------------------------------------------------------------ *
 * Module-level coordinator — PURE IN-MEMORY JS, never touches the DOM.
 * The host app may reconcile its DOM from a worker thread, so we must
 * not add/move nodes or write host attributes from here. This only
 * tracks "who is open" + a grace timer and calls each element's own
 * show()/hide() (which mutate only their own shadow internals).
 * ------------------------------------------------------------------ */
let currentOpen: ATooltipElement | null = null
let graceTimer: ReturnType<typeof setTimeout> | undefined

function graceActive(): boolean {
  return graceTimer !== undefined
}

/** Open is "hot" when another tooltip is showing or just closed — skip the delay. */
function isHot(): boolean {
  return currentOpen !== null || graceActive()
}

function clearGrace() {
  if (graceTimer !== undefined) {
    clearTimeout(graceTimer)
    graceTimer = undefined
  }
}

/** Called from an element as it shows: close the previous one (cross-fade) and claim the slot. */
function claimOpen(el: ATooltipElement) {
  if (currentOpen && currentOpen !== el) {
    // Normally hide() (animated cross-fade). But if the previous tooltip was
    // orphaned without its disconnectedCallback firing, the coordinator's
    // strong ref kept it — and its document/window listeners — alive; fully
    // tear it down instead so nothing leaks.
    if (currentOpen.isConnected) currentOpen.hide()
    else currentOpen.cleanup()
  }
  currentOpen = el
  clearGrace()
}

/** Called from an element as it hides: release the slot and arm the grace window. */
function releaseOpen(el: ATooltipElement) {
  if (currentOpen !== el) return
  currentOpen = null
  clearGrace()
  graceTimer = setTimeout(() => { graceTimer = undefined }, GRACE_MS)
}

/* ------------------------------------------------------------------ *
 * Lazy-listener observer: attach the (relatively heavy) hover/focus
 * listeners only while the anchor is actually on-screen, mirroring the
 * legacy behaviour. One observer for every <a-tooltip> on the page.
 * ------------------------------------------------------------------ */
const anchorToTooltip = new WeakMap<Element, ATooltipElement>()

function handleIntersection(entries: IntersectionObserverEntry[]) {
  for (const entry of entries) {
    const tooltip = anchorToTooltip.get(entry.target)
    if (!tooltip) continue
    if (!tooltip.listening && entry.isIntersecting) {
      requestAnimationFrame(() => tooltip.setupListeners())
    } else if (tooltip.listening && !entry.isIntersecting) {
      requestAnimationFrame(() => tooltip.teardownListeners())
    }
  }
}

// threshold 0 only: any higher would re-fire on animated size changes.
const lazyObserver: IntersectionObserver | null =
  typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(handleIntersection, { root: null, rootMargin: '0px', threshold: 0 })
    : null

/**
 * `<a-tooltip>` — floating bubble placed as a child of the element it
 * describes.
 *
 * Styling notes (`a-tooltip.css` ships comment-free):
 * - `a-tooltip:not(:defined)` is hidden — before upgrade the host is an
 *   unknown inline element and its content would flash *inside the anchor*.
 *   Once defined, the shadow `:host { display: contents }` governs and
 *   content renders only in the popover via the slot.
 * - Only the bubble "chrome" is tokenized (`--tooltip-*`): it lives inside
 *   the shadow popover, unreachable from plain consumer CSS; the custom
 *   properties inherit across the shadow boundary. The content is slotted
 *   light DOM — its font/color/size are already styleable from the page and
 *   are intentionally NOT tokens.
 * - The frost: `--tooltip-bg` is a mostly-opaque mix of `--bg-1` that, with
 *   the container's backdrop blur, reads as a frosted bubble. `--bg-1` is
 *   white in light / black in dark, so dark mode flips automatically (the
 *   `.dark` override just lowers the alpha and adds an inset white ring so
 *   the edge stays crisp on dark content). There's no real border by
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

  constructor() {
    super()
    // Built ONCE, here, off the reconciliation path. All later changes
    // are confined to this shadow subtree — never the host or light DOM.
    const shadow = this.attachShadow({ mode: 'open' })

    // Two layers of opacity (they multiply): `.container` is the popover and
    // owns the lifecycle fade — `allow-discrete` keeps the bubble rendered
    // through its fade-out after hidePopover(), and `@starting-style` starts
    // every open from opacity 0 so the first paint at a not-yet-computed
    // transform is invisible (no flash at a stale spot). `.bubble` owns the
    // visual chrome + the proximity (distance-from-anchor) opacity set from JS.
    // `.container` also resets the UA `[popover]` defaults (solid border, 0.25em
    // padding, Canvas background, overflow:auto) so only `.bubble` paints.
    //
    // No comments inside the CSS below: this string is injected verbatim into
    // every instance's shadow root and isn't run through the CSS minifier.
    // `.bubble` is the `<slot>` itself, promoted to `display:block` so it owns
    // a box (chrome + the slotted content lay out inside it). It's the single
    // text-baseline choke point — its font/letter properties flow down the
    // flat-tree to the slotted content (inheritance passes through a styled
    // slot), stopping the anchor's inheritable text styles from bleeding in; a
    // consumer overrides by styling their own content. `display` is not an
    // inherited property, so `display:block` on the slot does NOT leak onto the
    // slotted children — they keep their own layout.
    const style = document.createElement('style')
    // Shadow bubble CSS (kept comment-free — this string ships into every
    // consumer document). Non-obvious bits:
    // - The container establishes its own text baseline (font axes, spacing,
    //   transform all restated) so inheritable text properties from the
    //   anchor — a Button's condensed "wdth" 88, its letter-spacing, an
    //   uppercase transform — don't bleed into the slotted content. The
    //   content inherits from this container, the single choke point;
    //   consumers customize one tooltip by classing their own content.
    // - The fade uses transition + `allow-discrete`, which keeps the bubble
    //   rendered through its fade-out after hidePopover(), and
    //   `@starting-style` gives every open a from-opacity:0 — the first
    //   paint at a not-yet-computed transform is invisible, and reappearing
    //   is always clean.
    // - `pointer-events` is off by default (click-through bubble); the
    //   `[interactive]` host opts the container in so links/buttons inside
    //   are clickable.
    style.textContent = `
      :host { display: contents; }

      .container {
        --_dur: ${FADE_MS}ms;
        position: fixed;
        left: 0;
        top: 0;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        overflow: visible;
        box-sizing: border-box;
        width: fit-content;
        pointer-events: none;
        opacity: 0;
        transition:
          opacity var(--_dur) ease,
          overlay var(--_dur) ease allow-discrete,
          display var(--_dur) ease allow-discrete;
      }

      .container:popover-open { opacity: 1; }

      @starting-style {
        .container:popover-open { opacity: 0; }
      }

      .bubble {
        display: block;
        box-sizing: border-box;
        width: fit-content;
        max-width: var(--tooltip-max-width, min(calc(100vw - 20px), 80ch));
        max-height: calc(100vh - 20px);
        overflow: clip;
        text-align: left;
        background: var(--tooltip-bg, Canvas);
        color: var(--text-3, CanvasText);
        box-shadow: var(--tooltip-shadow, 0 1px 8px rgba(0, 0, 0, 0.2));
        -webkit-backdrop-filter: var(--tooltip-backdrop-filter, blur(8px));
        backdrop-filter: var(--tooltip-backdrop-filter, blur(8px));
        padding: var(--tooltip-padding, 4px 8px);
        border: var(--tooltip-border, none);
        border-radius: var(--tooltip-radius, 3px);
        outline: none;
        font-family: var(--sans-serif, system-ui, sans-serif);
        font-size: 14px;
        font-weight: 400;
        font-style: normal;
        font-stretch: normal;
        font-variation-settings: "wdth" 100, "slnt" 0, "ital" 0;
        line-height: 1.5;
        letter-spacing: 0.02ch;
        word-spacing: normal;
        text-transform: none;
        white-space: break-spaces;
        word-break: break-word;
        overflow-wrap: break-word;
        opacity: 1;
        transition: opacity ${PROX_FADE_MS}ms linear;
      }

      :host([interactive]) .container { pointer-events: auto; }
    `

    this.container = document.createElement('div')
    this.container.className = 'container'
    this.container.setAttribute('popover', 'manual')
    this.container.setAttribute('role', 'tooltip')

    // The bubble IS the slot (styled `display:block`): it projects the content
    // AND paints the visual chrome, and carries the proximity opacity; the
    // container owns the lifecycle/cross-fade opacity. One element, not a
    // div-wrapping-a-slot. Exposed as a shadow part so consumers can reach the
    // surface itself — `a-tooltip::part(bubble) { … }` (`::part` matches any
    // shadow element with the name, slots included) — for things the
    // `--tooltip-*` vars don't cover.
    this.bubble = document.createElement('slot')
    this.bubble.className = 'bubble'
    this.bubble.setAttribute('part', 'bubble')
    this.container.append(this.bubble)

    // Keep an interactive bubble open while the cursor is inside it (these
    // only fire when pointer-events is on, i.e. interactive mode). The
    // anchor's mouseleave schedules a hide; moving into the bubble within
    // that window cancels it, so you can travel anchor → bubble and click.
    this.container.addEventListener('mouseenter', () => { if (this.isInteractive) this.cancelHide() })
    this.container.addEventListener('mouseleave', () => { if (this.isInteractive && this.shown) this.scheduleHide() })

    shadow.append(style, this.container)
  }

  connectedCallback() {
    const parent = this.parentElement
    if (!parent) return
    this.anchor = parent
    anchorToTooltip.set(parent, this)
    lazyObserver?.observe(parent)
  }

  disconnectedCallback() {
    // Single source of truth for teardown: closes the popover now, detaches
    // every document/window/anchor listener, clears all timers, releases the
    // coordinator slot. (Don't wait out the fade — the element is going away.)
    this.cleanup()
    if (this.anchor) {
      if (anchorToTooltip.get(this.anchor) === this) {
        anchorToTooltip.delete(this.anchor)
        lazyObserver?.unobserve(this.anchor)
      }
      this.anchor = null
    }
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
    this.debouncedShow = debounce((e?: MouseEvent) => this.show(e), this.delay)
  }


  private get isInteractive(): boolean {
    return this.hasAttribute('interactive')
  }

  /** Pinned under the anchor (no cursor-following) — the DEFAULT. Following the
   *  cursor is opt-in via the `follow` attribute. `interactive` (you can't move
   *  into a bubble that chases the cursor) and a touch long-press (a finger
   *  can't track one) force pinned regardless of `follow`. */
  private get isPinned(): boolean {
    if (this.isInteractive || this.touchOpen) return true
    return !this.hasAttribute('follow')
  }

  private get prefersTop(): boolean {
    return this.getAttribute('placement') === 'top'
  }

  private get delay(): number {
    const attr = this.getAttribute('delay')
    if (attr == null) return DEFAULT_DELAY
    const n = parseInt(attr, 10)
    return Number.isFinite(n) ? n : DEFAULT_DELAY
  }

  // --- truncated-only gating (UI-thread layout READS — no mutation) ---

  /** When set, the tooltip only shows if its resolved target is actually
   *  truncated/clipped; a fitting label gets no tooltip. */
  private get truncatedOnly(): boolean {
    return this.hasAttribute('truncated-only')
  }

  /** The element whose overflow decides whether the tooltip shows: a
   *  `truncated-selector` resolved within the anchor wins; else the first of
   *  Anta's ellipsizing label parts inside the anchor; else the anchor itself
   *  (which may be the clipping box for a hand-authored target). */
  private resolveTruncationTarget(): HTMLElement | null {
    const anchor = this.anchor
    if (!anchor) return null
    const sel = this.getAttribute('truncated-selector')
    if (sel) {
      try {
        const found = anchor.querySelector(sel) as HTMLElement | null
        if (found) return found
      } catch {
        /* invalid selector → fall through to the defaults */
      }
    }
    return (anchor.querySelector(TRUNCATING_PARTS) as HTMLElement | null) ?? anchor
  }

  /** True when the resolved target overflows its box (horizontal ellipsis or
   *  vertical clamp). A 1px threshold absorbs sub-pixel rounding; a zero-size
   *  (hidden / detached) target counts as not truncated. Measured fresh on each
   *  show attempt, so late fonts / resizes self-correct with no observer. */
  private isTargetTruncated(): boolean {
    const t = this.resolveTruncationTarget()
    if (!t) return false
    if (t.clientWidth === 0 && t.clientHeight === 0) return false
    return t.scrollWidth - t.clientWidth > 1 || t.scrollHeight - t.clientHeight > 1
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
    this.positionFrame = this.view.requestAnimationFrame(() => {
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
  private place(left: number, top: number, boxWidth: number, vw: number) {
    if (left + boxWidth > vw) left = vw - boxWidth - MARGIN
    left = Math.max(MARGIN, left)
    top = Math.max(MARGIN, top)
    this.container.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
  }

  private positionToTarget = () => {
    this.schedulePosition(() => {
      if (!this.anchor || !this.shown) return
      const a = this.anchor.getBoundingClientRect()
      const box = this.container.getBoundingClientRect()
      const { innerWidth: vw, innerHeight: vh } = this.view
      // Touch long-press biases above the anchor so the fingertip resting on it
      // doesn't cover the bubble (auto-flips below when there's no room).
      const top = this.flipVertical(a.top - box.height - MARGIN, a.bottom + MARGIN, box.height, vh, this.prefersTop || this.touchOpen)
      this.place(a.left, top, box.width, vw)
    })
  }

  private positionToMouse = (e: MouseEvent) => {
    this.schedulePosition(() => {
      if (!this.shown && !this.fading) return
      const box = this.container.getBoundingClientRect()
      const { innerWidth: vw, innerHeight: vh } = this.view
      // Shift left by the bubble's left padding so the cursor sits at the start
      // of the text rather than to the left of the whole bubble.
      const top = this.flipVertical(e.clientY - box.height - MARGIN * 2, e.clientY + CURSOR_SIZE, box.height, vh, this.prefersTop)
      this.place(e.clientX - PADDING_X, top, box.width, vw)
    })
  }

  private position(e?: MouseEvent) {
    if (!this.isPinned && e) this.positionToMouse(e)
    else this.positionToTarget()
  }

  /** Opacity for the inner bubble from the cursor's distance to the anchor rect
   *  (0 inside the rect): 1 within PROX_NEAR, a linear ramp to 0 at PROX_FAR.
   *  Cursor-follow only — drives the "fade as you move away" behaviour. */
  private proximityOpacity(e: MouseEvent): number {
    if (!this.anchor) return 1
    const r = this.anchor.getBoundingClientRect()
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
    // truncated-only: bail unless the target is actually clipped (covers the
    // hot-path, focus, and touch long-press, which call show() directly).
    if (this.truncatedOnly && !this.isTargetTruncated()) return
    this.cancelHide() // re-showing (or a hand-off) cancels any pending close
    // Nested anchors: if this anchor *contains* the currently-open tooltip's
    // anchor, an inner (descendant) tooltip is showing — defer to it instead
    // of covering it with this ancestor's. (A descendant or unrelated anchor
    // falls through and takes over, giving the normal hand-off.) Without this
    // the outer + inner would thrash for the single open slot on every move.
    if (currentOpen && currentOpen !== this && this.anchor.contains(currentOpen.anchor)) {
      return
    }
    claimOpen(this) // closes any previously-open tooltip → cross-fade
    if (!this.shown) {
      this.shown = true
      this.fading = false
      // Start fully opaque — a fresh open, a re-enter, or a cross-fade-in all
      // begin at proximity 1; onDocMove then ramps it down as the cursor leaves.
      this.bubble.style.opacity = '1'
      if (this.fadeTimer !== undefined) { clearTimeout(this.fadeTimer); this.fadeTimer = undefined }
      this.container.showPopover()
      // A fixed-position popover doesn't scroll with the page, so dismiss
      // on any scroll (capture catches nested scroll containers too) rather
      // than leaving the bubble orphaned over empty space.
      this.view.addEventListener('scroll', this.hide, { capture: true, passive: true })
      this.doc.addEventListener('keydown', this.onKeyDown, true)
      // Follow the cursor for the whole time it's shown — including after the
      // pointer has left the anchor (close pending) AND through the exit fade
      // — so a following bubble keeps trailing the mouse instead of freezing.
      // (No-op for pinned tooltips.) Detached when the fade finishes.
      if (!this.docMoveBound) { this.doc.addEventListener('mousemove', this.onDocMove); this.docMoveBound = true }
    }
    // Position AFTER showPopover so the bubble is laid out & measurable
    // (wrapped to max-width). Opacity is still ~0 here, so setting the
    // transform never flashes.
    this.position(e)
  }

  hide = () => {
    this.cancelHide()
    if (!this.shown) return
    this.shown = false
    this.touchOpen = false
    this.container.hidePopover()
    // Keep the scroll / key / cursor-follow listeners through the exit fade (a
    // following bubble keeps trailing the pointer as it fades), then detach all.
    this.fading = true
    if (this.fadeTimer !== undefined) clearTimeout(this.fadeTimer)
    this.fadeTimer = setTimeout(() => this.detachGlobals(), FADE_MS)
    releaseOpen(this)
  }

  /** Remove every document / window listener this element binds and stop the
   *  fade timer. Used by hide() (after the exit fade) and by cleanup()
   *  (immediately). Idempotent. */
  private detachGlobals() {
    if (this.fadeTimer !== undefined) { clearTimeout(this.fadeTimer); this.fadeTimer = undefined }
    this.fading = false
    this.view.removeEventListener('scroll', this.hide, { capture: true } as any)
    this.doc.removeEventListener('keydown', this.onKeyDown, true)
    if (this.docMoveBound) {
      this.doc.removeEventListener('mousemove', this.onDocMove)
      this.docMoveBound = false
    }
  }

  /** Full, immediate teardown: close the popover now (no fade), detach every
   *  listener, clear all timers, release the coordinator slot, reset state.
   *  Idempotent. Called from disconnectedCallback, and from the orphan safety
   *  net (claimOpen / onDocMove) when the element is gone but
   *  disconnectedCallback didn't fire. Not `private` — the module coordinator
   *  calls it. */
  cleanup() {
    this.cancelHide()
    if (this.shown) {
      this.shown = false
      this.touchOpen = false
      if (this.container.matches(':popover-open')) this.container.hidePopover()
    }
    this.detachGlobals()
    this.teardownListeners()
    releaseOpen(this)
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
    if (!(this.shown || this.fading) || this.isPinned) return
    this.lastMouse = e
    const o = this.proximityOpacity(e)
    // Beyond PROX_FAR the cursor has clearly left: blank the bubble instantly
    // (no transition) AND dismiss now, so a fast flick can't leave it trailing
    // or fading across the screen. Doesn't wait on the close timer or further
    // mouse samples. Safe for the cross-fade — a >PROX_FAR jump means there's no
    // adjacent anchor to hand off to.
    if (o === 0) {
      this.bubble.style.transition = 'none'
      this.bubble.style.opacity = '0'
      if (this.shown) this.hide()
      return
    }
    // Within the ramp: follow the cursor and fade smoothly by distance.
    this.positionToMouse(e)
    this.bubble.style.transition = ''
    this.bubble.style.opacity = String(o)
  }

  /** Hide after CLOSE_DELAY unless something cancels it first (re-enter, or
   *  another tooltip claiming the slot). Lets the bubble bridge the gap to a
   *  neighbouring anchor — and survive the trip into an interactive bubble. */
  private scheduleHide = (delay = CLOSE_DELAY) => {
    this.cancelHide()
    this.closeTimer = setTimeout(() => { this.closeTimer = undefined; this.hide() }, delay)
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
    // Don't even arm the delayed show for a non-truncated target.
    if (this.truncatedOnly && !this.isTargetTruncated()) return
    if (isHot()) {
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
        if (!this.isPinned) this.positionToMouse(e)
      } else {
        // (Re)arm the delayed show. This also re-arms after the tooltip was
        // dismissed without leaving the anchor — e.g. moving back onto the
        // outer box after a nested inner tooltip claimed and hid it.
        this.trigger(e)
      }
    }

    const onLeave = () => {
      this.debouncedShow?.cancel()
      anchor.removeEventListener('pointermove', onPointerMove)
      anchor.removeEventListener('pointerleave', onLeave)
      anchor.removeEventListener('blur', onLeave)
      view.removeEventListener('pagehide', onLeave)
      doc.removeEventListener('visibilitychange', onLeave)
      this.scheduleHide() // linger briefly instead of vanishing on exit
    }

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      this.lastMouse = e
      anchor.addEventListener('pointermove', onPointerMove)
      anchor.addEventListener('pointerleave', onLeave)
      view.addEventListener('pagehide', onLeave)
      doc.addEventListener('visibilitychange', onLeave)
      this.trigger(e)
    }

    // --- keyboard focus ---------------------------------------------------
    // Gate on `:focus-visible` so only keyboard-style focus opens the tooltip.
    // A tap/click focuses the anchor too, but doesn't match `:focus-visible`,
    // so touch/mouse focus no longer pops the bubble (it was the main reason a
    // tap showed it). Mouse users still get it via hover above.
    const onFocus = () => {
      if (!anchor.matches(':focus-visible')) return
      anchor.addEventListener('blur', onLeave)
      view.addEventListener('pagehide', onLeave)
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
    }
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return // mouse uses the hover path above
      clearPressTimer()
      pressStart = { x: e.clientX, y: e.clientY }
      anchor.addEventListener('pointermove', onPressMove)
      anchor.addEventListener('pointerup', onPressEnd)
      anchor.addEventListener('pointercancel', onPressEnd)
      // Suppress the Android long-press context menu during the hold.
      anchor.addEventListener('contextmenu', preventContext)
      pressTimer = setTimeout(() => {
        pressTimer = undefined
        this.touchOpen = true
        this.show() // no event → pinned to the anchor, biased above (touchOpen)
      }, ENTER_TOUCH_DELAY)
    }

    anchor.addEventListener('pointerenter', onEnter)
    anchor.addEventListener('focus', onFocus)
    anchor.addEventListener('pointerdown', onPointerDown)

    this.teardown = () => {
      this.debouncedShow?.cancel()
      clearPressTimer()
      detachPress()
      anchor.removeEventListener('pointermove', onPointerMove)
      anchor.removeEventListener('pointerenter', onEnter)
      anchor.removeEventListener('pointerleave', onLeave)
      anchor.removeEventListener('focus', onFocus)
      anchor.removeEventListener('blur', onLeave)
      anchor.removeEventListener('pointerdown', onPointerDown)
      view.removeEventListener('pagehide', onLeave)
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
