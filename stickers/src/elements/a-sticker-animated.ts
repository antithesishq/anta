import lottie, { type AnimationItem } from 'lottie-web'
import { HTMLElementBase } from '@antadesign/anta/anta_helpers'
import './a-sticker-animated.css'

/**
 * `<a-sticker-animated>` — Lottie-driven sticker carrier.
 *
 * Receives the Lottie payload as the `animation` attribute (a JSON
 * string). On change, parses the JSON once and instantiates a
 * `lottie-web` player against a shadow-DOM container. The renderer is
 * SVG — `lottie-web` creates real `<svg>` elements in the shadow root
 * and updates path / transform attributes each frame. Rasterisation
 * goes through the browser's native SVG renderer (Skia / Core
 * Graphics), giving the same crispness as static `<svg>` content.
 *
 * Observed attributes:
 *  - `animation` — JSON string for `lottie-web`. Reset to null/missing
 *    tears the player down.
 *  - `paused` — present: freeze at current frame. Numeric value
 *    (seconds): seek to that time, then freeze. Absent: play.
 *
 * The shadow container is sized from `--sticker-size` (set by the JSX
 * wrapper's `size` prop or the consumer), with a 256px fallback — see
 * `<a-sticker>` for why sizing lives on the shadow node, not the host.
 *
 * The static counterpart is `<a-sticker>`.
 */
export class AStickerAnimatedElement extends HTMLElementBase {
  static observedAttributes = ['animation', 'paused']

  container: HTMLDivElement
  player: AnimationItem | null = null
  _animation: Record<string, unknown> | null = null

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = `
      :host { display: inline-block; }
      div { width: var(--sticker-size, 256px); height: var(--sticker-size, 256px); }
      div > svg { display: block; width: 100%; height: 100%; }
    `

    this.container = document.createElement('div')

    shadow.append(style, this.container)
  }

  connectedCallback() {
    if (this._animation != null && this.player == null) this.rebuild()
  }

  disconnectedCallback() {
    this.teardown()
  }

  attributeChangedCallback(name: string) {
    if (name === 'animation') {
      const value = this.getAttribute('animation')
      this._animation = value ? JSON.parse(value) : null
      if (this.isConnected) this.rebuild()
    } else if (name === 'paused') {
      this.applyPaused()
    }
  }

  rebuild() {
    this.teardown()
    if (this._animation == null) return

    this.player = lottie.loadAnimation({
      container: this.container,
      renderer: 'svg',
      loop: true,
      autoplay: !this.hasAttribute('paused'),
      animationData: this._animation,
    })

    // Apply any pre-existing `paused` value as soon as the player is
    // constructed. `lottie-web` accepts play / pause / goToAndStop
    // calls immediately; they're queued until DOM is ready.
    this.applyPaused()
  }

  applyPaused() {
    if (!this.player) return
    const attr = this.getAttribute('paused')
    if (attr === null) {
      this.player.play()
      return
    }
    const seconds = Number(attr)
    if (Number.isFinite(seconds) && seconds > 0) {
      const frame = seconds * this.player.frameRate
      const clamped = Math.min(this.player.totalFrames - 1, Math.max(0, frame))
      this.player.goToAndStop(clamped, true)
    } else {
      this.player.pause()
    }
  }

  teardown() {
    if (this.player) {
      this.player.destroy()
      this.player = null
    }
  }
}

export function register_a_sticker_animated() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-sticker-animated')) {
    customElements.define('a-sticker-animated', AStickerAnimatedElement)
  }
}

// Importing this module registers the element (granular entry point). The
// barrel re-exports it, so importing the barrel registers it too. Idempotent.
register_a_sticker_animated()
