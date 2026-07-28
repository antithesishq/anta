import { HTMLElementBase } from '@antadesign/anta/anta_helpers'
import './a-sticker.css'

/**
 * `<a-sticker>` — static sticker carrier.
 *
 * Receives SVG markup as the `svg` attribute. On change, drops it into
 * a shadow-DOM container so the host's light DOM stays untouched.
 *
 * The shadow container is sized from `--sticker-size` (set by the JSX
 * wrapper's `size` prop, or by the consumer), with a 256px fallback. The
 * size lives on the shadow node, not the host: a light-DOM rule sizing
 * the host loses to unlayered consumer styles (tree-of-origin outranks
 * specificity), which was collapsing the sticker to its intrinsic size.
 * Shadow descendants are unreachable by document CSS, so this holds.
 *
 * The host is a `place-items: center` grid, so when its box differs
 * from `--sticker-size` (a consumer sizing the host directly), the
 * fixed-size shadow box stays centered rather than anchoring top-left.
 *
 * The animated counterpart is `<a-sticker-animated>`.
 */
export class AStickerElement extends HTMLElementBase {
  static observedAttributes = ['svg']
  container: HTMLDivElement

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = `
      :host { display: inline-grid; place-items: center; }
      div { width: var(--sticker-size, 256px); height: var(--sticker-size, 256px); }
      div > svg { display: block; width: 100%; height: 100%; }
    `

    this.container = document.createElement('div')

    shadow.append(style, this.container)
  }

  attributeChangedCallback() {
    this.container.innerHTML = this.getAttribute('svg') ?? ''
  }
}

export function register_a_sticker() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-sticker')) {
    customElements.define('a-sticker', AStickerElement)
  }
}

// Importing this module registers the element (granular entry point). The
// barrel re-exports it, so importing the barrel registers it too. Idempotent.
register_a_sticker()
