import { HTMLElementBase } from '@antadesign/anta/anta_helpers'
import './a-sticker.css'

/**
 * `<a-sticker>` — static sticker carrier.
 *
 * Receives SVG markup as the `svg` attribute. On change, drops it into
 * a shadow-DOM container so the host's light DOM stays untouched.
 *
 * External CSS sizes the owned `container` and `artwork` parts. The
 * container keeps its square size when consumer CSS resizes the host.
 *
 * The animated counterpart is `<a-sticker-animated>`.
 */
export class AStickerElement extends HTMLElementBase {
  static observedAttributes = ['svg']
  container: HTMLDivElement

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    this.container = document.createElement('div')
    this.container.part.add('container')
    shadow.append(this.container)
  }

  attributeChangedCallback() {
    this.container.innerHTML = this.getAttribute('svg') ?? ''
    for (const svg of this.container.querySelectorAll(':scope > svg')) {
      svg.part.add('artwork')
    }
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
