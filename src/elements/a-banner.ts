import { HTMLElementBase, installDismissTrigger, parseOpenState } from '../anta_helpers'
import './a-banner.css'

type BannerState = 'open' | 'closed'

/** Light-DOM notice with declarative regions and external styling. The element
 * owns dismissal through ElementInternals, without changing
 * application-owned markup, attributes, styles, or ARIA. */
export class ABannerElement extends HTMLElementBase {
  static observedAttributes = ['state']

  #internals: ElementInternals
  #seeded = false

  constructor() {
    super()
    this.#internals = this.attachInternals()
    // Button emits this Banner-specific event so a close control inside Dialog
    // does not request dismissal of the Dialog as well.
    this.addEventListener('dismissrequest', (event) => {
      const banner = event.composedPath().find(node => node instanceof this.view.Element && node.localName === 'a-banner')
      if (banner !== this) return
      event.stopPropagation()
      this.#requestDismiss()
    })
    installDismissTrigger(this, 'data-banner-dismiss', () => this.#requestDismiss())
  }

  get #controlled(): boolean {
    return this.hasAttribute('state')
  }

  get #current(): BannerState {
    return this.#internals.states.has('closed') ? 'closed' : 'open'
  }

  connectedCallback() {
    if (this.#controlled) {
      this.#applyState(parseOpenState(this.getAttribute('state')))
    } else if (!this.#seeded) {
      this.#applyState(this.getAttribute('default-state') === 'closed' ? 'closed' : 'open')
    }
    // Reparenting and leaving controlled mode retain the last applied state.
    this.#seeded = true
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return
    if (name === 'state' && this.#controlled) this.#applyState(parseOpenState(newValue))
  }

  #applyState(state: BannerState) {
    this.#internals.states.delete(state === 'closed' ? 'open' : 'closed')
    this.#internals.states.add(state)
  }

  #requestDismiss() {
    if (this.#current === 'closed') return
    const controlled = this.#controlled
    const accepted = this.dispatchEvent(new this.view.CustomEvent('statechange', {
      cancelable: true,
      detail: { next: 'closed', prev: 'open' },
    }))
    // A controlled request never self-applies, even if its listener removes state.
    if (!controlled && !this.#controlled && accepted) this.#applyState('closed')
  }
}

export function register_a_banner() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-banner')) customElements.define('a-banner', ABannerElement)
}

register_a_banner()
