import { HTMLElementBase } from '../anta_helpers'
import './a-menu-item.css'

declare global {
  interface Document {
    hasKeyListenerForAMenuItem?: boolean
  }
}

/**
 * `<a-menu-item>` — a single row inside an `<a-menu>`.
 *
 * No shadow DOM: its content (leading icon, label, trailing `kbd` /
 * chevron) is slotted light DOM, styled entirely from `a-menu-item.css`.
 * The element carries almost no logic — the parent `<a-menu>` owns
 * click delegation, keyboard navigation, and the close contract. This
 * class exists so the menu can identify items via `instanceof` and so
 * Enter / Space on a focused item synthesizes a click (the single
 * activation path that flows through the menu's click delegation).
 *
 * ARIA (`role="menuitem"`, `tabindex`, `aria-haspopup` on submenu parents) is
 * added by the `MenuItem` JSX wrapper, never here — the element must stay
 * re-renderable from any reactive engine, and a web component must not mutate
 * light DOM (it would desync the worker-thread reactive model that owns the
 * light tree). So submenu open state is NOT written to the parent's attributes
 * (no `aria-expanded`): the nested `a-menu` carries its own off-DOM
 * `:state(open)`, and the parent styles its open branch purely in CSS
 * (`a-menu-item:has(> a-menu:state(open))`, see `reflectOpen` there).
 *
 * Styling notes (`a-menu-item.css` ships comment-free):
 * - `a-menu-item:not(:defined)` is hidden against the pre-upgrade flash
 *   (items would render inline in the page before registration).
 * - The `--menu-item-*` custom properties are INTERNAL plumbing for the
 *   tone × dark matrix, not a public theming API: `--menu-item-color` is the
 *   text color and the hover/active tint mixes from `currentColor` at the
 *   `--menu-item-hover` / `--menu-item-active` percentages, so it tracks the
 *   tone for free (and toned rows don't read heavier than gray ones). Dark
 *   mode just raises the percentages.
 * - Focus ring mirrors a-button: 1px outline at +1px offset, sitting in the
 *   surface's 4px padding; pairs with the hover background so keyboard focus
 *   reads as tint + ring.
 * - Optical side padding (same idea as a-button): a non-only icon at an edge
 *   is trimmed ~2px on that side. Submenu items keep symmetric padding — the
 *   end-trim is scoped `:not([submenu])` — and the chevron / a trailing icon is
 *   instead nudged toward the edge with relative positioning (visual only, no
 *   reflow). The trim's `:not([submenu])` guard is why children (which include a
 *   submenu's nested `<a-menu>`) can render before the chevron without the
 *   chevron-as-last-child re-triggering the trim.
 */
export class AMenuItemElement extends HTMLElementBase {
  private internals?: ElementInternals

  constructor() {
    super()
    // Custom-state carrier for the combobox cursor (see `active` below). No form
    // association — `attachInternals` is used only for `states`.
    this.internals = this.attachInternals?.()
  }

  /** The active (combobox) cursor. `a-menu` sets this **property** (never an
   *  attribute — no DOM mutation, same rule as `a-radio.selected`) as ArrowUp/Down
   *  move the cursor while focus stays in the filter input; the item mirrors it to
   *  `:state(active)` for CSS. Off-DOM, so a reactive re-render never churns it. */
  set active(on: boolean) {
    if (!this.internals) return
    if (on) this.internals.states.add('active')
    else this.internals.states.delete('active')
  }
  get active(): boolean {
    return this.internals?.states.has('active') ?? false
  }

  connectedCallback() {
    // One delegated keydown per document (mirrors a-button). Bind to this
    // item's OWN document (`this.doc`), not the module-global `document`: the
    // class may be defined in the parent page while the item lives in an
    // iframe (the docs playground), and a-menu binds its own listeners through
    // `this.doc`/`this.view` too — a parent-frame listener here would leave
    // Enter/Space activation dead for items rendered in another frame.
    const doc = this.doc
    if (!doc.hasKeyListenerForAMenuItem) {
      doc.addEventListener('keydown', handleKeyDown, true)
      doc.hasKeyListenerForAMenuItem = true
    }
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Enter' && e.key !== ' ') return
  const el = (e.target as HTMLElement)?.closest?.('a-menu-item') as AMenuItemElement | null
  if (!el) return
  e.preventDefault()
  // Disabled items swallow the key without activating.
  if (el.hasAttribute('disabled')) return
  el.click()
}

export function register_a_menu_item() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-menu-item')) {
    customElements.define('a-menu-item', AMenuItemElement)
  }
}

// Importing this module registers the element (granular entry point). The
// barrel re-exports it, so importing the barrel registers it too. Idempotent.
register_a_menu_item()
