import { HTMLElementBase, parseOpenState } from '../anta_helpers'

/** Open or closed, in the same vocabulary as `a-expander`. */
export type TreeItemOpenState = 'open' | 'closed'
/** How far an open or close request reaches: the item alone, or the item and
 *  every item under it (Alt+click, Alt+Enter). */
export type TreeScope = 'item' | 'subtree'
/** Detail of an item's `statechange`. */
export type TreeItemStateChangeDetail = { next: TreeItemOpenState; prev: TreeItemOpenState; scope: TreeScope }

// ─────────────────────────────────────────────────────────────────────────────
// <a-tree-item> — one item of an <a-tree>, the sibling of <a-tab>.
//
// It owns its open state and nothing else; the enclosing <a-tree> handles every
// click and key. Its light DOM is plain tags: an <a-tree-row> (the clickable
// line, with <a-tree-actions> beside it), an <a-tree-group role="group"> of child
// items, and an optional <a-tree-after> line.
//
// THE INVARIANT: interaction never writes attributes or child DOM. The open state
// shows as :state(open) / :state(closed) and `ariaExpanded` through the item's
// OWN ElementInternals, as <a-tab> shows `selected`. CSS hides the group and the
// after line of a closed item, so a hand-built tree opens and closes with no
// script of its own.
//
// State follows the shared contract (STATEFUL-COMPONENTS.md), as <a-expander>
// does: controlled while `state` is present, otherwise uncontrolled, seeded from
// `default-state`. With neither, the item is a leaf: it can't open and has no
// aria-expanded. A request dispatches a cancelable, non-bubbling `statechange`
// BEFORE applying; controlled callers answer by setting `state`.
//
// Focus, `tabindex`, `role` and the accessible name are not this element's
// concern: the `Tree` wrapper renders them, and a hand-built tree's author
// writes `role="treeitem"`. See a-tree.ts.
// ─────────────────────────────────────────────────────────────────────────────
export class ATreeItemElement extends HTMLElementBase {
  static observedAttributes = ['state', 'default-state']

  #internals = this.attachInternals?.()
  #uncontrolled: TreeItemOpenState = 'closed'
  #seeded = false

  connectedCallback() {
    // Seed once, so an item moved in the DOM keeps what the user opened.
    if (!this.#seeded) {
      this.#uncontrolled = parseOpenState(this.getAttribute('default-state'))
      this.#seeded = true
    }
    this.#apply()
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return
    // Released control keeps the last applied state, as a-tabs does.
    if (name === 'state' && newValue === null && oldValue !== null) this.#uncontrolled = parseOpenState(oldValue)
    if (name === 'default-state' && !this.#seeded) this.#uncontrolled = parseOpenState(newValue)
    this.#apply()
  }

  /** True when the item can open: it has a `state` or `default-state`.
   *  A method, not a getter, so React 19 never assigns to it. */
  isExpandable(): boolean {
    return this.hasAttribute('state') || this.hasAttribute('default-state')
  }

  /** The applied state. A leaf reads as closed. */
  isOpen(): boolean {
    if (!this.isExpandable()) return false
    return this.hasAttribute('state') ? parseOpenState(this.getAttribute('state')) === 'open' : this.#uncontrolled === 'open'
  }

  /** The `item-id` attribute, the item's identity in its tree. */
  getItemId(): string | null {
    return this.getAttribute('item-id')
  }

  /**
   * Asks to open or close. Fires the cancelable `statechange`; an uncontrolled
   * item applies it unless vetoed. Returns whether it was accepted, so `a-tree`
   * can carry a subtree request to the items under this one.
   * @internal Called by `a-tree`.
   */
  requestState(next: TreeItemOpenState, scope: TreeScope): boolean {
    if (!this.isExpandable()) return false
    const prev: TreeItemOpenState = this.isOpen() ? 'open' : 'closed'
    if (next === prev && scope === 'item') return false
    const accepted = this.dispatchEvent(new this.view.CustomEvent<TreeItemStateChangeDetail>('statechange', {
      cancelable: true, detail: { next, prev, scope },
    }))
    if (accepted && !this.hasAttribute('state')) {
      this.#uncontrolled = next
      this.#apply()
    }
    return accepted
  }

  /** Applies a state to an uncontrolled item with no event, for a subtree
   *  request its ancestor accepted.
   *  @internal Called by `a-tree`. */
  applyUncontrolled(next: TreeItemOpenState) {
    if (!this.isExpandable() || this.hasAttribute('state')) return
    this.#uncontrolled = next
    this.#apply()
  }

  /** The keyboard's current item, shown as `:state(active)`. Off-DOM.
   *  @internal Set by `a-tree`. */
  set active(on: boolean) {
    this.#setState('active', on)
  }
  get active(): boolean {
    return this.#internals?.states?.has('active') ?? false
  }

  #apply() {
    const expandable = this.isExpandable()
    const open = this.isOpen()
    this.#setState('open', expandable && open)
    this.#setState('closed', expandable && !open)
    if (this.#internals) this.#internals.ariaExpanded = expandable ? String(open) : null
  }

  #setState(name: string, on: boolean) {
    try {
      if (on) this.#internals?.states?.add(name)
      else this.#internals?.states?.delete(name)
    } catch {
      /* custom states unsupported */
    }
  }
}

export function register_a_tree_item() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-tree-item')) customElements.define('a-tree-item', ATreeItemElement)
}
register_a_tree_item()
