import { HTMLElementBase } from '../anta_helpers'
import './a-loader.css'

/**
 * `<a-loader>` — a declarative, icon-sized loading indicator.
 *
 * Its visual treatment is entirely external CSS. The wrapper supplies
 * `--loader-value` for a determinate ring; no shadow DOM or element state is
 * needed.
 */
export class ALoaderElement extends HTMLElementBase {}

export function register_a_loader() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-loader')) {
    customElements.define('a-loader', ALoaderElement)
  }
}

// Importing this module registers the element (granular entry point). The
// barrel re-exports it, so importing the barrel registers it too. Idempotent.
register_a_loader()
