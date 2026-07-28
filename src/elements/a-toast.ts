import { HTMLElementBase, installDismissTrigger } from '../anta_helpers'
import './a-toast.css'

/** Exit animation duration (ms). Mirrors `--toast-dur` in the shadow style. */
const EXIT_MS = 220
/** Auto-dismiss delay (ms) when `duration` is absent. `duration="0"` disables it. */
const DEFAULT_DURATION = 5000

// Presence-based dismiss trigger: any element inside the toast carrying this
// attribute dismisses it on click. Mirrors `<a-banner>`'s `data-banner-dismiss`
// and `<a-dialog>`'s `data-dialog-close`. A click listener (a light-DOM READ,
// declarative-safe) rather than a bespoke event, so it catches ANY activated
// control — native `<button>`, `<a>`, `<a-button>`, `<a-menu-item>` — with
// keyboard activation for free (Enter/Space synthesizes a real click).
const DISMISS_ATTR = 'data-toast-dismiss'

/**
 * `<a-toast>` — one item inside an `<a-toaster>`. A style-neutral container around
 * slotted content (a `Banner`, `Card`, `Sticker`, a string, or a raw DOM node):
 * it owns the enter / exit animation and the auto-dismiss timer (paused while
 * hovered or focused), nothing else. No chrome of its own — no ✕, no surface; the
 * toasted content brings its own look and its own dismiss affordance. Its `slot`
 * attribute (`slot="bottom-right"`, …) routes it to a placement zone.
 *
 * Content arrives one of two ways: as slotted light-DOM children (a string / JSX
 * the `<Toaster>` renders through the reconciler), or as a live DOM node set on
 * the `content` property (the wrapper's DOM-node branch), which the element slots
 * into its own light DOM. Either way it projects through the shadow `<slot>`.
 *
 * ## Time left — `--toast-remaining`
 *
 * While the auto-dismiss timer runs, the element animates `--toast-remaining` from
 * `1` to `0` on the slot (paused in lockstep with the timer on hover / focus).
 * It's a registered `@property` (see `a-toast.css`) with `inherits: true`, so
 * slotted content inherits the live value and can draw a countdown with one CSS
 * rule — `transform: scaleX(var(--toast-remaining))` — with no timer of its own
 * and no re-render. Display only: the real dismiss is the JS timer, so it degrades
 * to a full bar where custom-property animation is unsupported. Sticky
 * (`duration="0"`) runs no countdown; the var stays `1`.
 *
 * ## Dismiss from an action — `data-toast-dismiss`
 *
 * Any element inside the toast carrying `data-toast-dismiss` dismisses it on click
 * — the same convention as `<a-banner>`'s `data-banner-dismiss` and `<a-dialog>`'s
 * `data-dialog-close`. It's a click listener (a light-DOM READ, declarative-safe),
 * so it catches any activated control — native `<button>`, `<a>`, `<a-button>`,
 * `<a-menu-item>` — and keyboard activation for free. A toasted `<Banner>` instead
 * dismisses through its own `onDismiss` (wire it to `manager.dismiss(id)`); its
 * built-in ✕ and any `data-banner-dismiss` action ride that channel.
 *
 * It **never removes itself**. Dismissal — from the timer, a `data-toast-dismiss`
 * control, or the `leaving` attribute the wrapper sets for a programmatic
 * `dismiss` — fades the host out (an off-DOM `:state(leaving)`), then emits a
 * bubbling **`dismiss`**; the owner removes the node on that event. So the element
 * writes only its own shadow + internals, reads its own attributes (and, read-only,
 * the light DOM for the dismiss trigger), appends only its own (wrapper-supplied)
 * content node, and dispatches events.
 *
 * Shadow structure — the host IS the box (no wrappers):
 *
 *   :host                            ← the fade/slide layer
 *     <slot>                         ← the content
 */
export class AToastElement extends HTMLElementBase {
  // `leaving` triggers the exit; `rev` (bumped on an in-place update) restarts
  // the timer. `duration` is read on demand, not observed.
  static observedAttributes = ['leaving', 'rev']

  /** Off-DOM state channel — drives `:state(leaving)` for the exit fade. */
  #internals?: ElementInternals
  /** The content slot. Also the element the `--toast-remaining` countdown
   *  animates on, so slotted content can inherit the value (see SHADOW_STYLE). */
  #slot: HTMLSlotElement
  /** A DOM node handed in via the `content` property (the wrapper's DOM-node
   *  branch). String / JSX content arrives as slotted children instead. */
  #content?: Node
  /** The content node we last slotted, so an in-place update can swap or clear it
   *  without touching the reconciler's own children. */
  #slotted?: Node
  #timer?: ReturnType<typeof setTimeout>
  #exitTimer?: ReturnType<typeof setTimeout>
  /** Time left on the auto-dismiss timer (ms), tracked across pause/resume. */
  #remaining = 0
  /** When the current run started, for computing remaining on pause. */
  #startedAt = 0
  #leaving = false
  // Independent pause holds — the countdown runs only when BOTH are false.
  #hovered = false
  #focused = false

  constructor() {
    super()
    // Off-DOM state for the exit fade. Guarded because the element may be built
    // in a runtime where `attachInternals` is missing or throws (worker DOM,
    // partial polyfill); degrade to no fade rather than break construction.
    try {
      this.#internals = this.attachInternals?.()
    } catch (err) {
      console.warn('a-toast: ElementInternals unavailable — exit fade disabled.', err)
    }
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = SHADOW_STYLE

    this.#slot = document.createElement('slot')

    shadow.append(style, this.#slot)

    // A control carrying `data-toast-dismiss` dismisses the toast on click (shared
    // helper — see a-banner's `data-banner-dismiss`).
    installDismissTrigger(this, DISMISS_ATTR, () => this.dismiss())
  }

  connectedCallback() {
    // Content may have been set (property) before insertion — slot it now.
    this.#applyContent()
    this.addEventListener('pointerenter', this.#onPointerEnter)
    this.addEventListener('pointerleave', this.#onPointerLeave)
    this.addEventListener('focusin', this.#onFocusIn)
    this.addEventListener('focusout', this.#onFocusOut)
    // A region remount can re-render an entry that's already leaving; honour it.
    if (this.hasAttribute('leaving')) {
      this.dismiss()
      return
    }
    this.#startTimer()
  }

  disconnectedCallback() {
    this.#clearTimer()
    if (this.#exitTimer != null) {
      this.view.clearTimeout(this.#exitTimer)
      this.#exitTimer = undefined
    }
    this.removeEventListener('pointerenter', this.#onPointerEnter)
    this.removeEventListener('pointerleave', this.#onPointerLeave)
    this.removeEventListener('focusin', this.#onFocusIn)
    this.removeEventListener('focusout', this.#onFocusOut)
  }

  attributeChangedCallback(name: string) {
    if (name === 'leaving') {
      if (this.hasAttribute('leaving')) {
        if (this.isConnected) this.dismiss()
      } else if (this.#leaving) {
        // Re-added while dismissing (upsert on the same id) — cancel the exit.
        this.#revive()
      }
    } else if (name === 'rev') {
      // An in-place update — restart the countdown from the (possibly new) duration.
      if (this.isConnected) this.restart()
    }
  }

  /** Cancel a pending exit and bring the toast back (an upsert landed during the
   *  exit window). */
  #revive() {
    if (this.#exitTimer != null) {
      this.view.clearTimeout(this.#exitTimer)
      this.#exitTimer = undefined
    }
    this.#leaving = false
    this.#internals?.states.delete('leaving')
    this.#startTimer()
  }

  /** A live DOM node to show as the content (set by the wrapper's DOM-node
   *  branch). Paired getter/setter so React 19's property assignment works. */
  get content(): Node | null {
    return this.#content ?? null
  }
  set content(node: Node | null) {
    this.#content = node ?? undefined
    this.#applyContent()
  }

  /** Slot the content node into our own light DOM. Only ever touches the node WE
   *  slotted (tracked in `#slotted`), never the reconciler's children: it removes
   *  the previous node and appends the new one, or removes it when `content` goes
   *  null (an in-place update swapping DOM-node content for a string / JSX — else
   *  the stale node would stack under the new content). String / JSX content
   *  arrives as reconciler-owned children, so `#content` is undefined and this
   *  only clears any node we had slotted. */
  #applyContent() {
    if (this.#content === this.#slotted) return
    if (this.#slotted?.parentNode === this) this.removeChild(this.#slotted)
    this.#slotted = this.#content
    if (this.#content) this.append(this.#content)
  }

  /** Auto-dismiss delay in ms. Empty / non-positive falls back to the 5000ms
   *  default; `Infinity` is sticky (never auto-dismisses). */
  get #duration(): number {
    const a = this.getAttribute('duration')
    if (a == null) return DEFAULT_DURATION
    const n = Number(a)
    if (n === Infinity) return Infinity
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_DURATION
  }

  /** Paused while either hold is active. */
  get #paused(): boolean {
    return this.#hovered || this.#focused
  }

  #startTimer() {
    this.#remaining = this.#duration
    this.#startCountdown()
    this.#armIfActive()
  }

  /** Set up (or restart) the display countdown that drives `--toast-remaining`
   *  1 → 0 on the slot over `duration`; slotted content inherits it. It's display
   *  only — the auto-dismiss above is the real JS timer — so it degrades to a
   *  static full bar where custom-property animation is unsupported. Sticky
   *  (`Infinity` duration) runs no countdown; the var stays at its initial 1. */
  #startCountdown() {
    if (Number.isFinite(this.#duration)) {
      this.#slot.style.animation = `toast-remaining ${this.#duration}ms linear forwards`
      // Restart from the beginning even when the animation string is unchanged
      // (a same-duration `rev` restart wouldn't otherwise re-trigger it).
      this.#eachCountdown((a) => {
        a.currentTime = 0
      })
      // A restart while paused (hover / focus) or already leaving must not let the
      // fresh, auto-playing animation run ahead of the stopped dismiss timer.
      if (this.#paused || this.#leaving) this.#pauseCountdown()
    } else {
      this.#slot.style.animation = ''
    }
  }

  /** Run `fn` for the `--toast-remaining` animation on the slot, if present.
   *  Guarded — `getAnimations` / animation control may be absent in a partial
   *  runtime, and the countdown is non-essential (never let it break the toast). */
  #eachCountdown(fn: (a: Animation) => void) {
    try {
      for (const a of this.#slot.getAnimations?.() ?? []) {
        if ((a as CSSAnimation).animationName === 'toast-remaining') fn(a)
      }
    } catch {
      /* display-only */
    }
  }

  #pauseCountdown() {
    this.#eachCountdown((a) => a.pause())
  }
  #playCountdown() {
    this.#eachCountdown((a) => a.play())
  }

  /** Start (or resume) the dismiss timer only when it should be running: a finite
   *  duration (a non-finite one is sticky), not leaving, not paused, not already
   *  running. */
  #armIfActive() {
    if (this.#timer != null || this.#leaving || this.#paused || !Number.isFinite(this.#duration)) return
    if (this.#remaining <= 0) {
      this.dismiss()
      return
    }
    this.#startedAt = Date.now()
    this.#timer = this.view.setTimeout(() => {
      this.#timer = undefined
      this.dismiss()
    }, this.#remaining)
    // Keep the display countdown in lockstep with the dismiss timer.
    this.#playCountdown()
  }

  #clearTimer() {
    if (this.#timer != null) {
      this.view.clearTimeout(this.#timer)
      this.#timer = undefined
    }
  }

  /** Freeze the timer, banking the time left, and freeze the display countdown
   *  with it. Idempotent. */
  #pause() {
    if (this.#timer == null) return
    this.#remaining -= Date.now() - this.#startedAt
    this.#clearTimer()
    this.#pauseCountdown()
  }

  #onPointerEnter = () => {
    this.#hovered = true
    this.#pause()
  }
  #onPointerLeave = () => {
    this.#hovered = false
    this.#armIfActive()
  }
  #onFocusIn = () => {
    this.#focused = true
    this.#pause()
  }
  #onFocusOut = () => {
    this.#focused = false
    this.#armIfActive()
  }

  #reducedMotion(): boolean {
    return this.view.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  }

  /** How long to wait after starting the exit before emitting `dismiss` (node
   *  removal). Read from the computed `--toast-dur` token so it tracks a consumer
   *  override and the removal fires exactly when the fade ends — instead of a
   *  fixed 220ms that desyncs from a changed `--toast-dur`. 0 under reduced motion
   *  (the shadow transition is gated off there); `EXIT_MS` if it can't be read. */
  #exitDuration(): number {
    if (this.#reducedMotion()) return 0
    const raw = this.view.getComputedStyle?.(this).getPropertyValue('--toast-dur').trim()
    if (raw) {
      const n = parseFloat(raw)
      if (Number.isFinite(n)) return raw.endsWith('ms') ? n : n * 1000
    }
    return EXIT_MS
  }

  /** Restart the auto-dismiss timer from the current `duration` (an in-place
   *  update). If the toast is currently paused, the fresh time is banked and the
   *  countdown stays paused until hover / focus releases. */
  restart() {
    if (this.#leaving) return
    this.#clearTimer()
    this.#startTimer()
  }

  /** Play the exit (shadow only), then emit a bubbling `dismiss`. The owner
   *  removes the node on that event — the element never removes itself.
   *  Idempotent. */
  dismiss() {
    if (this.#leaving) return
    this.#leaving = true
    this.#clearTimer()
    this.#pauseCountdown()
    this.#internals?.states.add('leaving')
    const wait = this.#exitDuration()
    this.#exitTimer = this.view.setTimeout(() => {
      this.#exitTimer = undefined
      this.dispatchEvent(new CustomEvent('dismiss', { bubbles: true, composed: true }))
    }, wait)
  }
}

// Shadow styles, injected verbatim into every <a-toast> shadow root — kept
// COMMENT-FREE (ships + re-injects per instance; see CLAUDE.md). Rationale:
//
//  • :host is the box: a display:block flex item the zone (in a-toaster) stretches
//    to the column width. It carries the enter/exit fade + slide itself — no
//    wrapper element, no chrome. Style-neutral (no elevation; the content brings
//    its own look). @starting-style gives every freshly-inserted toast a
//    from-opacity:0 / translated start; :state(leaving) (set off-DOM on dismiss)
//    fades it back out. Both transitions gate under prefers-reduced-motion.
//  • The toast-remaining keyframes animate --toast-remaining 1 → 0 on the slot
//    (the element sets the matching duration inline + pauses it with the timer);
//    slotted content inherits the live value to draw a "time left" indicator.
//    --toast-remaining is registered @property in a-toast.css so it interpolates.
const SHADOW_STYLE = `
  :host { display: block; opacity: 1; translate: 0 0; }
  :host(:state(leaving)) { opacity: 0; }

  @starting-style {
    :host { opacity: 0; translate: 0 12px; }
  }

  @media (prefers-reduced-motion: no-preference) {
    :host {
      transition:
        opacity var(--toast-dur, 220ms) ease,
        translate var(--toast-dur, 220ms) ease;
    }
  }

  slot { display: block; }

  @keyframes toast-remaining {
    from { --toast-remaining: 1; }
    to { --toast-remaining: 0; }
  }
`

export function register_a_toast() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-toast')) {
    customElements.define('a-toast', AToastElement)
  }
}

// Importing this module registers the element (granular entry point). The barrel
// re-exports it, so importing the barrel registers it too. Idempotent.
register_a_toast()
