import { HTMLElementBase } from '../element-base'
import './a-loader.css'

/** Compatibility class for applications that explicitly register `<a-loader>`.
 * Loader renders through CSS and does not require registration. */
export class ALoaderElement extends HTMLElementBase {}

/** Register the compatibility class when an integration requires a defined tag.
 * Ordinary Loader usage needs only its stylesheet. */
export function register_a_loader() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-loader')) {
    customElements.define('a-loader', ALoaderElement)
  }
}
