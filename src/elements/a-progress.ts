import { HTMLElementBase } from '../anta_helpers'
import './a-progress.css'

/**
 * `<a-progress>` — progress bar element.
 *
 * Styling notes (`a-progress.css` ships comment-free):
 * - `--progress-indicator-edge` is a right-edge fade from the indicator's
 *   own bg to the border color, both opaque; tone variants re-tint it
 *   automatically because both endpoint tokens are re-aliased per tone.
 * - `border: 0px solid var(--progress-border-color)` is a per-component
 *   reset (same spirit as Tailwind preflight): style and color are declared
 *   at a known state so a consumer opts into a themed border by changing
 *   only `border-width`.
 */
export class AProgressElement extends HTMLElementBase {
  static observedAttributes = ['value', 'max', 'tone']
  indicator: HTMLDivElement

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = `
      :host {
        display: block;
        position: relative;
        overflow: hidden;
      }
      .indicator {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        width: var(--_percent, 0%);
        background: var(--progress-indicator-bg);
        border-radius: 0;
        transition: width 0.2s ease;
      }
      .indicator::after {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: 90px;
        box-sizing: border-box;
        background: var(--progress-indicator-edge);
        border-right: var(--progress-indicator-edge-border, none);
      }
      slot {
        display: block;
        position: relative;
      }
    `

    this.indicator = document.createElement('div')
    this.indicator.className = 'indicator'
    // Exposed as a shadow part so consumers can style the fill bar from plain CSS
    // — `a-progress::part(indicator)` — instead of the `--progress-indicator-*`
    // custom properties. (The track is the host: style `a-progress` directly.)
    this.indicator.setAttribute('part', 'indicator')

    const slot = document.createElement('slot')

    shadow.append(style, this.indicator, slot)
  }

  connectedCallback() {
    this.update()
  }

  attributeChangedCallback() {
    this.update()
  }

  update() {
    const value = Number(this.getAttribute('value') ?? 0)
    const max = Number(this.getAttribute('max') ?? 100)
    const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
    this.indicator.style.setProperty('--_percent', `${percent}%`)
  }
}

export function register_a_progress() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-progress')) {
    customElements.define('a-progress', AProgressElement)
  }
}

// Importing this module registers the element (granular entry point). The
// barrel re-exports it, so importing the barrel registers it too. Idempotent.
register_a_progress()
