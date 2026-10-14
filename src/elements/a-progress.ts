import { HTMLElementBase } from '../anta_helpers'
import './a-progress.css'

/** Progress fill with external part styling. The element only updates its
 * owned indicator; labels, attributes, and accessibility remain authored. */
export class AProgressElement extends HTMLElementBase {
  static observedAttributes = ['value', 'max', 'tone']
  indicator: HTMLDivElement

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    this.indicator = document.createElement('div')
    this.indicator.className = 'indicator'
    this.indicator.setAttribute('part', 'indicator')

    this.indicator.setAttribute('aria-hidden', 'true')

    const slot = document.createElement('slot')
    slot.setAttribute('part', 'content')
    // The authored indicator region paints before upgrade. Its named slot is
    // unassigned, so projecting content leaves that region's DOM untouched.
    shadow.append(this.indicator, slot)
  }

  connectedCallback() {
    this.update()
  }

  attributeChangedCallback() {
    this.update()
  }

  update() {
    const valueAttr = this.getAttribute('value')
    if (valueAttr == null) {
      this.indicator.style.removeProperty('--_percent')
      return
    }
    const value = Number(valueAttr)
    const max = Number(this.getAttribute('max') ?? 100)
    const percent = Number.isFinite(value) && Number.isFinite(max) && max > 0
      ? Math.min(100, Math.max(0, (value / max) * 100))
      : 0
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
