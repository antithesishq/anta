import { HTMLElementBase } from '../anta_helpers'
import './a-icon.css'
import './a-icon.shapes.css'
import './a-loader.css'

/**
 * `<a-icon shape="…">` — pure declarative icon element.
 *
 * No shadow DOM and no JS state. Styling is driven entirely by external
 * CSS: the base rule (`a-icon.css`) sets up the mask compositing, and
 * the per-shape rules (`a-icon.shapes.css`, generated) supply the
 * `--icon` URL. Color follows `currentColor`.
 *
 * Sizing notes (`a-icon.css` ships comment-free):
 * - The 16px default lives in a plain `--icon-size: 16px` declaration,
 *   never inside `attr()` — Safari has no typed `attr()` for `<length>`,
 *   so a default on the attr() path can't resolve there and the
 *   var-substituted `width` would collapse to 0 on an empty inline-block.
 * - `<a-icon size="N">` maps to `--icon-size` via CSS Values 5 typed
 *   `attr()` (Chrome 133+ / Safari 18.2+) behind an `@supports` guard.
 *   Custom properties parse permissively, so without the guard the invalid
 *   `attr()` would only fail later, at `width: var(--icon-size)`
 *   substitution — collapsing the icon to 0×0 on unsupported engines
 *   instead of falling back to the 16px base. The `<Icon size={N}>` JSX
 *   wrapper sets `--icon-size` inline as a plain length and is the
 *   cross-browser path.
 */
export class AIconElement extends HTMLElementBase {}

export function register_a_icon() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-icon')) {
    customElements.define('a-icon', AIconElement)
  }
}

// Importing this module registers the element (granular entry point). The
// barrel re-exports it, so importing the barrel registers it too. Idempotent.
register_a_icon()
