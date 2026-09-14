import { HTMLElementBase } from '../anta_helpers'
import type { PanelState } from '../general_types'
import { activeFocus, PanelFocusScope } from './panel-focus'
import './a-panel.css'

const SHADOW_STYLE = `
  slot:not([popover]) { display: contents; }
  slot:popover-open {
    display: block;
    position: fixed;
    inset: 0;
    width: auto;
    height: auto;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    box-sizing: border-box;
    overflow: auto;
    overscroll-behavior: contain;
    color: inherit;
    background: transparent;
  }
  slot::backdrop { background: transparent; pointer-events: none; }
  .placeholder { display: none; }
  .placeholder.active {
    display: block;
    flex: 0 0 auto;
    max-width: 100%;
    pointer-events: none;
  }
`

const parseState = (value: string | null): PanelState => value === 'maximized' ? 'maximized' : 'normal'

/** A persistent container whose slotted surface can occupy the viewport. */
export class APanelElement extends HTMLElementBase {
  static observedAttributes = ['state']

  #surface: HTMLSlotElement
  #placeholder: HTMLDivElement
  #internals: ElementInternals
  #wanted: PanelState = 'normal'
  #seeded = false
  #ready = false
  #focus: PanelFocusScope

  constructor() {
    super()
    this.#internals = this.attachInternals()
    const shadow = this.attachShadow({ mode: 'open' })
    const doc = this.ownerDocument
    const style = doc.createElement('style')
    style.textContent = SHADOW_STYLE
    this.#surface = doc.createElement('slot')
    this.#surface.setAttribute('part', 'content')
    this.#focus = new PanelFocusScope(this.#surface)
    this.#placeholder = doc.createElement('div')
    this.#placeholder.className = 'placeholder'
    this.#placeholder.setAttribute('aria-hidden', 'true')
    shadow.append(style, this.#placeholder, this.#surface)

    // Native toggle events are queued. Reconcile against the latest intent,
    // including a controlled surface hidden directly through the browser API.
    this.#surface.addEventListener('toggle', () => {
      if (this.#ready && this.isConnected) this.#apply()
    })
    this.addEventListener('panelmaximizerequest', this.#onRequest)
    this.addEventListener('panelrestorerequest', this.#onRequest)
    this.addEventListener('paneltoggle', this.#onRequest)
  }

  get #current(): PanelState {
    return typeof this.#surface.showPopover === 'function' && this.#surface.matches(':popover-open') ? 'maximized' : 'normal'
  }

  connectedCallback() {
    if (this.hasAttribute('state')) this.#wanted = parseState(this.getAttribute('state'))
    else if (!this.#seeded) this.#wanted = parseState(this.getAttribute('default-state'))
    this.#seeded = true
    // Let slotted custom elements upgrade before measuring the normal layout.
    queueMicrotask(() => {
      if (!this.isConnected) return
      this.#ready = true
      this.#apply()
    })
  }

  disconnectedCallback() {
    this.#ready = false
    this.#restoreSurface(false)
  }

  attributeChangedCallback() {
    if (!this.hasAttribute('state')) return
    this.#wanted = parseState(this.getAttribute('state'))
    if (this.#ready && this.isConnected) this.#apply()
  }

  /** Request viewport maximization. Controlled panels wait for `state`. */
  requestMaximize() { this.#request('maximized') }

  /** Request a return to normal layout, keeping the content mounted. */
  requestRestore() { this.#request('normal') }

  #onRequest = (event: Event) => {
    const owner = event.composedPath().find(node => node instanceof Element && node.localName === 'a-panel')
    if (owner !== this || event.defaultPrevented) return
    this.#request(event.type === 'paneltoggle'
      ? this.#current === 'maximized' ? 'normal' : 'maximized'
      : event.type === 'panelmaximizerequest' ? 'maximized' : 'normal')
  }

  #request(next: PanelState) {
    const prev = this.#current
    if (next === prev) return
    const accepted = this.dispatchEvent(new CustomEvent('statechange', {
      cancelable: true,
      detail: { next, prev },
    }))
    if (!accepted || this.hasAttribute('state')) return
    this.#wanted = next
    if (this.#ready && this.isConnected) this.#apply()
  }

  #apply() {
    if (this.#current === this.#wanted && (this.#wanted === 'maximized' || !this.#surface.hasAttribute('popover'))) return
    if (this.#wanted === 'maximized') {
      if (typeof this.#surface.showPopover !== 'function') return
      const focused = activeFocus(this.ownerDocument)
      const styles = this.ownerDocument.defaultView!.getComputedStyle(this)
      const borderBox = styles.boxSizing === 'border-box'
      const width = parseFloat(styles.width) - (borderBox
        ? parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight) + parseFloat(styles.borderLeftWidth) + parseFloat(styles.borderRightWidth) : 0)
      const height = parseFloat(styles.height) - (borderBox
        ? parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom) + parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth) : 0)
      this.#placeholder.style.width = `${Math.max(0, width || 0)}px`
      this.#placeholder.style.height = `${Math.max(0, height || 0)}px`
      this.#placeholder.classList.add('active')
      this.#surface.tabIndex = -1
      this.#surface.setAttribute('popover', 'manual')
      this.#focus.activate(focused)
      this.#surface.showPopover()
      this.#internals.states.add('maximized')
      this.#focus.focusInside(focused)
    } else {
      this.#restoreSurface()
    }
  }

  #restoreSurface(restoreFocus = true) {
    const returnFocus = this.#focus.deactivate()
    if (this.#current === 'maximized') this.#surface.hidePopover()
    this.#surface.removeAttribute('popover')
    this.#surface.removeAttribute('tabindex')
    this.#placeholder.classList.remove('active')
    this.#internals.states.delete('maximized')
    if (restoreFocus) returnFocus()
  }
}

export function register_a_panel() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-panel')) customElements.define('a-panel', APanelElement)
}

register_a_panel()
