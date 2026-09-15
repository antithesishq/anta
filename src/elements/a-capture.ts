import './a-capture.css'
import { HTMLElementBase } from '../anta_helpers'
import { CAPTURE_INPUT_ATTRIBUTES, disconnectCaptureInput, syncCaptureInput } from './capture-input'

/** A light-DOM input surface with no enabled capabilities by default. */
export class ACaptureElement extends HTMLElementBase {
  static observedAttributes = CAPTURE_INPUT_ATTRIBUTES

  connectedCallback() {
    syncCaptureInput(this)
  }

  disconnectedCallback() {
    disconnectCaptureInput(this)
  }

  attributeChangedCallback(name: string) {
    syncCaptureInput(this, name)
  }
}

export function register_a_capture() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-capture')) customElements.define('a-capture', ACaptureElement)
}

register_a_capture()
