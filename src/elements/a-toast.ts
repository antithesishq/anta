import { HTMLElementBase } from '../anta_helpers'
import './a-toast.css'

/** Exit animation duration (ms). Mirrors `--toast-dur` in the shadow style. */
const EXIT_MS = 220
/** Auto-dismiss delay (ms) when `duration` is absent. `duration="0"` disables it. */
const DEFAULT_DURATION = 5000

/**
 * `<a-toast>` — one item inside an `<a-toaster>`. A thin holder around arbitrary
 * slotted content (a `Banner`, `Card`, `Sticker`, anything): it owns the enter /
 * exit animation, the auto-dismiss timer (paused while hovered or focused), and
 * an optional ✕. Its `slot` attribute (`slot="bottom-right"`, …) routes it to a
 * placement zone in the toaster.
 *
 * It **never removes itself**. On dismiss it plays the exit in its own shadow,
 * then emits a bubbling **`dismiss`** event; whoever added it (the toast manager,
 * or a consumer) removes the node. This keeps the element declarative — it writes
 * only its own shadow, reads its own attributes, and dispatches events.
 *
 * Shadow structure (`part` on the styling hooks):
 *
 *   <div class="outer">              ← height collapser for the exit
 *     <div class="clip">             ← clips content during collapse
 *       <div class="toast" part="toast">   ← the visual holder (elevation) + fade
 *         <slot>                     ← the content
 *         <button class="close" part="close">  ← ✕, shown only with [closable]
 */
export class AToastElement extends HTMLElementBase {
  #outer: HTMLDivElement
  #timer?: ReturnType<typeof setTimeout>
  /** Time left on the auto-dismiss timer (ms), tracked across pause/resume. */
  #remaining = 0
  /** When the current run started, for computing remaining on pause. */
  #startedAt = 0
  #leaving = false

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = SHADOW_STYLE

    this.#outer = document.createElement('div')
    this.#outer.className = 'outer'

    const clip = document.createElement('div')
    clip.className = 'clip'

    const toast = document.createElement('div')
    toast.className = 'toast'
    toast.setAttribute('part', 'toast')

    const slot = document.createElement('slot')

    const close = document.createElement('button')
    close.className = 'close'
    close.type = 'button'
    close.setAttribute('part', 'close')
    close.setAttribute('aria-label', 'Dismiss')
    close.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
    close.addEventListener('click', () => this.dismiss())

    toast.append(slot, close)
    clip.append(toast)
    this.#outer.append(clip)
    shadow.append(style, this.#outer)
  }

  connectedCallback() {
    this.#startTimer()
    // Pause the countdown while the pointer is over the toast or focus is inside
    // it, so reading / interacting with it doesn't let it vanish mid-action.
    this.addEventListener('pointerenter', this.#pause)
    this.addEventListener('pointerleave', this.#resume)
    this.addEventListener('focusin', this.#pause)
    this.addEventListener('focusout', this.#resume)
  }

  disconnectedCallback() {
    this.#clearTimer()
    this.removeEventListener('pointerenter', this.#pause)
    this.removeEventListener('pointerleave', this.#resume)
    this.removeEventListener('focusin', this.#pause)
    this.removeEventListener('focusout', this.#resume)
  }

  /** ms before auto-dismiss; `0` disables it. */
  get #duration(): number {
    const a = this.getAttribute('duration')
    if (a == null) return DEFAULT_DURATION
    const n = parseInt(a, 10)
    return Number.isFinite(n) ? Math.max(0, n) : DEFAULT_DURATION
  }

  #startTimer() {
    const d = this.#duration
    if (!d) return
    this.#remaining = d
    this.#run()
  }

  #run() {
    this.#startedAt = Date.now()
    this.#timer = this.view.setTimeout(() => this.dismiss(), this.#remaining)
  }

  #clearTimer() {
    if (this.#timer != null) {
      clearTimeout(this.#timer)
      this.#timer = undefined
    }
  }

  #pause = () => {
    if (this.#timer == null) return
    this.#remaining -= Date.now() - this.#startedAt
    this.#clearTimer()
  }

  #resume = () => {
    if (this.#leaving || this.#timer != null || !this.#duration) return
    if (this.#remaining <= 0) {
      this.dismiss()
      return
    }
    this.#run()
  }

  #reducedMotion(): boolean {
    return this.view.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  }

  /** Restart the auto-dismiss timer from the current `duration`. The manager
   *  calls this on an upsert (same id, new content). */
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
    this.#outer.classList.add('leaving')
    const wait = this.#reducedMotion() ? 0 : EXIT_MS
    this.view.setTimeout(() => {
      this.dispatchEvent(new CustomEvent('dismiss', { bubbles: true, composed: true }))
    }, wait)
  }
}

// Shadow styles, injected verbatim into every <a-toast> shadow root — kept
// COMMENT-FREE (ships + re-injects per instance; see CLAUDE.md). Rationale:
//
//  • :host is a display:block flex item; the zone (in a-toaster) stretches it to
//    the column width.
//  • .outer is a 1fr grid row that collapses to 0fr on exit (the a-expander
//    trick), so a dismissing toast shrinks its height and the stack reflows; .clip
//    hides the overflow during the collapse.
//  • .toast carries the elevation (drop-shadow hugs the content silhouette, so a
//    rounded Banner floats cleanly) and the enter/exit fade + slide. @starting-style
//    gives every freshly-inserted toast a from-opacity:0 / translated start; the
//    transition (and the collapse) are gated under prefers-reduced-motion.
//  • The ✕ is shadow-internal, shown only with [closable]; content usually brings
//    its own controls, so it's opt-in.
const SHADOW_STYLE = `
  :host { display: block; }

  .outer {
    display: grid;
    grid-template-rows: 1fr;
  }
  .outer.leaving { grid-template-rows: 0fr; }

  .clip {
    overflow: hidden;
    min-height: 0;
  }

  .toast {
    position: relative;
    filter: drop-shadow(var(--toast-shadow, 0 4px 12px rgba(0, 0, 0, 0.18)));
    opacity: 1;
    translate: 0 0;
  }
  .outer.leaving .toast { opacity: 0; }

  @starting-style {
    .toast { opacity: 0; translate: 0 12px; }
  }

  @media (prefers-reduced-motion: no-preference) {
    .outer { transition: grid-template-rows var(--toast-dur, 220ms) ease; }
    .toast {
      transition:
        opacity var(--toast-dur, 220ms) ease,
        translate var(--toast-dur, 220ms) ease;
    }
  }

  slot { display: block; }

  .close {
    position: absolute;
    top: 6px;
    inset-inline-end: 6px;
    display: none;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: var(--toast-close-bg, color-mix(in oklch, CanvasText 8%, transparent));
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
  }
  .close:hover { opacity: 1; }
  .close:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }
  .close svg { width: 14px; height: 14px; }

  :host([closable]) .close { display: inline-flex; }
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
