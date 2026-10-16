import { HTMLElementBase, installDismissTrigger } from '../anta_helpers'
import './a-toast.css'

/** Exit animation duration (ms). Fallback for the external `--toast-dur` token. */
const EXIT_MS = 220
/** Auto-dismiss delay (ms) when `duration` is absent. `duration="Infinity"` disables it. */
const DEFAULT_DURATION = 5000

// Presence-based dismiss trigger: any element inside the toast carrying this
// attribute dismisses it on click. Mirrors `<a-banner>`'s `data-banner-dismiss`
// and `<a-dialog>`'s `data-dialog-close`. A click listener (a light-DOM READ,
// declarative-safe) rather than a bespoke event, so it catches ANY activated
// control — native `<button>`, `<a>`, `<a-button>`, `<a-menu-item>` — with
// keyboard activation for free (Enter/Space synthesizes a real click).
const DISMISS_ATTR = 'data-toast-dismiss'

/** One notification in a Toaster placement slot. The host owns entry/exit motion;
 * its shadow content slot carries the inherited `--toast-remaining` countdown.
 * The timer and countdown pause while hovered or focused. `Infinity` is sticky.
 *
 * JSX/raw authors own host attributes and children. Setting `content` transfers
 * insertion ownership of that exact node to the element, without cloning it or
 * changing authored siblings. Content must not belong to another reconciler.
 *
 * A `data-toast-dismiss` control, timer expiry, or authored `leaving` attribute
 * starts the exit. After it finishes, the element emits bubbling `dismiss` and
 * its owner removes the toast. The element never removes itself.
 */
export class AToastElement extends HTMLElementBase {
  // `leaving` triggers the exit; `rev` (bumped on an in-place update) restarts
  // the timer. `duration` is read on demand, not observed.
  static observedAttributes = ['leaving', 'rev']

  /** Off-DOM state channel — drives `:state(leaving)` for the exit fade. */
  #internals?: ElementInternals
  /** The content slot. Also the element the `--toast-remaining` countdown
   *  animates on, so slotted content can inherit the value (see a-toast.css). */
  #slot: HTMLSlotElement
  /** A DOM node handed in via the `content` property (the wrapper's DOM-node
   *  branch). String / JSX content arrives as slotted children instead. */
  #content?: Node
  /** The content node we last slotted, so an in-place update can swap or clear it
   *  without touching the reconciler's own children. */
  #slotted: Node[] = []
  #appliedContent?: Node
  #timer?: ReturnType<typeof setTimeout>
  #exitTimer?: ReturnType<typeof setTimeout>
  #timerView?: Window
  #exitView?: Window
  #countdownFallback?: Animation
  /** Time left on the auto-dismiss timer (ms), tracked across pause/resume. */
  #remaining = 0
  /** When the current run started, for computing remaining on pause. */
  #startedAt = 0
  #leaving = false
  #dismissed = false
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

    this.#slot = this.doc.createElement('slot')
    this.#slot.setAttribute('part', 'content')

    shadow.append(this.#slot)

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
    this.#hovered = this.matches(':hover')
    this.#focused = this.matches(':focus-within')
    // A region remount can re-render an entry that's already leaving; honour it.
    if (this.#leaving || this.hasAttribute('leaving')) {
      this.dismiss()
      return
    }
    this.#startTimer()
  }

  disconnectedCallback() {
    this.#clearTimer()
    this.#clearExitTimer()
    this.#internals?.states?.delete('counting')
    this.#countdownFallback?.cancel()
    this.#countdownFallback = undefined
    this.#hovered = false
    this.#focused = false
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
    this.#clearExitTimer()
    this.#leaving = false
    this.#dismissed = false
    this.#internals?.states?.delete('leaving')
    if (this.isConnected) this.restart()
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
    if (this.#content === this.#appliedContent) return
    for (const node of this.#slotted) {
      if (node.parentNode === this) this.removeChild(node)
    }
    this.#appliedContent = this.#content
    // Appending a fragment consumes it; track its actual children for replacement.
    this.#slotted = this.#content?.nodeType === 11
      ? Array.from(this.#content.childNodes)
      : this.#content ? [this.#content] : []
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
    this.#countdownFallback?.cancel()
    this.#countdownFallback = undefined
    if (Number.isFinite(this.#duration)) {
      this.#slot.style.setProperty('--_toast-countdown-duration', `${this.#duration}ms`)
      this.#internals?.states?.add('counting')
      // Chrome 135 can compute an external part animation name without resolving
      // its keyframes. Keep the values in CSS and use an owned runtime effect
      // only when the requested CSS animation did not materialize.
      try {
        const styles = this.view.getComputedStyle(this.#slot)
        if (styles.animationName.split(',').some(name => name.trim() === 'toast-remaining')
          && !this.#slot.getAnimations?.().some(a => (a as CSSAnimation).animationName === 'toast-remaining')) {
          this.#countdownFallback = this.#slot.animate?.({
            '--toast-remaining': [
              styles.getPropertyValue('--_toast-countdown-from').trim(),
              styles.getPropertyValue('--_toast-countdown-to').trim(),
            ],
          }, { duration: this.#duration, fill: 'forwards' })
        }
      } catch {
        /* Display-only: animation support must not prevent auto-dismissal. */
      }
      // Restart from the beginning even when the animation string is unchanged
      // (a same-duration `rev` restart wouldn't otherwise re-trigger it).
      this.#eachCountdown((a) => {
        a.currentTime = 0
      })
      // A restart while paused (hover / focus) or already leaving must not let the
      // fresh, auto-playing animation run ahead of the stopped dismiss timer.
      if (this.#paused || this.#leaving) this.#pauseCountdown()
    } else {
      this.#internals?.states?.delete('counting')
      this.#slot.style.removeProperty('--_toast-countdown-duration')
    }
  }

  /** Run `fn` for the `--toast-remaining` animation on the slot, if present.
   *  Guarded — `getAnimations` / animation control may be absent in a partial
   *  runtime, and the countdown is non-essential (never let it break the toast). */
  #eachCountdown(fn: (a: Animation) => void) {
    try {
      for (const a of this.#slot.getAnimations?.() ?? []) {
        if (a === this.#countdownFallback || (a as CSSAnimation).animationName === 'toast-remaining') fn(a)
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
    this.#timerView = this.view
    this.#timer = this.#timerView.setTimeout(() => {
      this.#timer = undefined
      this.#timerView = undefined
      this.dismiss()
    }, this.#remaining)
    // Keep the display countdown in lockstep with the dismiss timer.
    this.#playCountdown()
  }

  #clearTimer() {
    if (this.#timer != null) {
      this.#timerView?.clearTimeout(this.#timer)
      this.#timer = undefined
      this.#timerView = undefined
    }
  }

  #clearExitTimer() {
    if (this.#exitTimer != null) {
      this.#exitView?.clearTimeout(this.#exitTimer)
      this.#exitTimer = undefined
      this.#exitView = undefined
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
    // Focus moving between descendants must retain the same pause hold.
    queueMicrotask(() => {
      if (!this.isConnected) return
      this.#focused = this.matches(':focus-within')
      this.#armIfActive()
    })
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
    if (this.#leaving || !this.isConnected) return
    this.#clearTimer()
    this.#startTimer()
  }

  /** Play the exit (shadow only), then emit a bubbling `dismiss`. The owner
   *  removes the node on that event — the element never removes itself.
   *  Idempotent. */
  dismiss() {
    if (this.#exitTimer != null || this.#dismissed) return
    this.#leaving = true
    this.#clearTimer()
    this.#pauseCountdown()
    this.#internals?.states?.add('leaving')
    if (!this.isConnected) return
    const wait = this.#exitDuration()
    this.#exitView = this.view
    this.#exitTimer = this.#exitView.setTimeout(() => {
      this.#exitTimer = undefined
      this.#exitView = undefined
      this.#dismissed = true
      this.dispatchEvent(new this.view.CustomEvent('dismiss', { bubbles: true, composed: true }))
    }, wait)
  }
}

export function register_a_toast() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-toast')) {
    customElements.define('a-toast', AToastElement)
  }
}

// Importing this module registers the element (granular entry point). The barrel
// re-exports it, so importing the barrel registers it too. Idempotent.
register_a_toast()
