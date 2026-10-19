import { HTMLElementBase } from '../element-base'
import './a-icon.css'
import './a-icon.shapes.css'
import './a-loader.css'

/** Compatibility class for applications that explicitly register `<a-icon>`.
 * Icon renders through CSS and does not require registration. */
export class AIconElement extends HTMLElementBase {}

/** Register the compatibility class when an integration requires a defined tag.
 * Ordinary Icon usage needs only its stylesheet. */
export function register_a_icon() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-icon')) {
    customElements.define('a-icon', AIconElement)
  }
}
