import { HTMLElementBase } from '../anta_helpers'
import './a-toast.css'

/** Exit animation duration (ms). Mirrors `--toast-dur` in the shadow style. */
const EXIT_MS = 220
/** Auto-dismiss delay (ms) when `duration` is absent. `duration="0"` disables it. */
const DEFAULT_DURATION = 5000

/**
 * `<a-toast>` — one item inside an `<a-toaster>`. A thin holder around slotted
 * content (a `Banner`, `Card`, `Sticker`, a string, or a raw DOM node): it owns
 * the enter / exit animation, the auto-dismiss timer (paused while hovered or
 * focused), and an optional ✕. Its `slot` attribute (`slot="bottom-right"`, …)
 * routes it to a placement zone.
 *
 * Content arrives one of two ways: as slotted light-DOM children (a string / JSX
 * the `<Toaster>` renders through the reconciler), or as a live DOM node set on
 * the `content` property (the wrapper's DOM-node branch), which the element slots
 * into its own light DOM. Either way it projects through the shadow `<slot>`.
 *
 * It **never removes itself**. Dismissal — from the timer, the ✕, or the
 * `leaving` attribute the wrapper sets for a programmatic `dismiss` — plays the
 * exit in its own shadow, then emits a bubbling **`dismiss`**; the owner removes
 * the node on that event. So the element writes only its own shadow, reads its
 * own attributes, appends only its own (wrapper-supplied) content node, and
 * dispatches events.
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
  // `leaving` triggers the exit; `rev` (bumped on an in-place update) restarts
  // the timer. `duration` / `closable` are read on demand, not observed.
  static observedAttributes = ['leaving', 'rev']

  #outer: HTMLDivElement
  /** A DOM node handed in via the `content` property (the wrapper's DOM-node
   *  branch). String / JSX content arrives as slotted children instead. */
  #content?: Node
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
    this.#outer.classList.remove('leaving')
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

  /** Slot the content node into our own light DOM. Only ever touches THIS
   *  element's subtree, and only with the node the wrapper handed us; string /
   *  JSX content comes as reconciler-owned children and this is a no-op. */
  #applyContent() {
    if (this.#content) this.replaceChildren(this.#content)
  }

  /** ms before auto-dismiss; `0` disables it. */
  get #duration(): number {
    const a = this.getAttribute('duration')
    if (a == null) return DEFAULT_DURATION
    const n = parseInt(a, 10)
    return Number.isFinite(n) ? Math.max(0, n) : DEFAULT_DURATION
  }

  /** Paused while either hold is active. */
  get #paused(): boolean {
    return this.#hovered || this.#focused
  }

  #startTimer() {
    this.#remaining = this.#duration
    this.#armIfActive()
  }

  /** Start (or resume) the countdown only when it should be running: a positive
   *  duration, not leaving, not paused, not already running. */
  #armIfActive() {
    if (this.#timer != null || this.#leaving || this.#paused || this.#duration <= 0) return
    if (this.#remaining <= 0) {
      this.dismiss()
      return
    }
    this.#startedAt = Date.now()
    this.#timer = this.view.setTimeout(() => {
      this.#timer = undefined
      this.dismiss()
    }, this.#remaining)
  }

  #clearTimer() {
    if (this.#timer != null) {
      this.view.clearTimeout(this.#timer)
      this.#timer = undefined
    }
  }

  /** Freeze the countdown, banking the time left. Idempotent. */
  #pause() {
    if (this.#timer == null) return
    this.#remaining -= Date.now() - this.#startedAt
    this.#clearTimer()
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
    this.#outer.classList.add('leaving')
    const wait = this.#reducedMotion() ? 0 : EXIT_MS
    this.#exitTimer = this.view.setTimeout(() => {
      this.#exitTimer = undefined
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
//  • .toast carries the enter/exit fade + slide (no elevation of its own — the
//    holder is style-neutral, the content brings its own look). @starting-style
//    gives every freshly-inserted toast a from-opacity:0 / translated start; the
//    transition (and the collapse) are gated under prefers-reduced-motion.
//  • The ✕ chip tunes alpha with color-mix(in oklch, …) per CLAUDE.md; it's
//    shadow-internal, shown only with [closable] (content usually brings its own).
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
