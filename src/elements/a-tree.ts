import { HTMLElementBase, isModifiedNavigationKey } from '../anta_helpers'
import { ATreeItemElement, type TreeScope } from './a-tree-item'
import './a-tree.css'

/** Detail of `navigate`: the item the keyboard's cursor moved to. */
export type TreeNavigateDetail = { id: string }
/** Detail of `itemmenu`: the item a context menu is opening on. */
export type TreeItemMenuDetail = { id: string }

const PAGE_ITEMS = 10
// Keys that, pressed on an action, return to the row and move.
const VERTICAL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'])
// Controls in a label that keep their own click, as in a-expander.ts
// (INTERACTIVE_SELECTOR there; kept in step by hand).
const CONTROL_SELECTOR = 'a-button,a-checkbox,a-radio,a-radio-group,a-input,a-input-time,a-calendar,a-menu-item,a-tab,[data-anta][role="button"],button,a[href],input,select,textarea,label,[contenteditable=""],[contenteditable="true"]'
const DISABLED_SELECTOR = ':disabled,[disabled],[aria-disabled="true"]'
// What counts as an action the arrow keys can reach.
const ACTION_SELECTOR = 'a-button,button,a[href],[role="button"],[tabindex]'

const isElement = (node: EventTarget): node is Element => (node as Node).nodeType === 1

// ─────────────────────────────────────────────────────────────────────────────
// <a-tree> — the tree's coordinator, the sibling of <a-tabs>. Its items are
// <a-tree-item>s nested through <a-tree-group role="group">; see a-tree-item.ts.
//
// THE INVARIANT: interaction never writes attributes or child DOM, so the tree
// can be rendered from a worker. It handles every click and key, asks items to
// open or close (each item fires its own `statechange`), moves focus with
// `focus()`, and marks the keyboard's current item off-DOM (:state(active)).
//
// Focus has two modes, decided by where `tabindex` lives, as in <a-tabs>:
//   • Hand-built: <a-tree tabindex="0"> is the one Tab stop. The element points
//     `internals.ariaActiveDescendantElement` at the current item.
//   • The `Tree` wrapper: each item carries a roving `tabindex` and real focus
//     lands on it. `focus()` on an item is a no-op without a tabindex and a real
//     move with one, so the element runs one path for both.
//
// Events, all serializable:
//   • `navigate` { id } (bubbles) — the cursor moved, as a-calendar's `navigate`.
//     The wrapper moves its roving tabindex to match.
//   • `activate` (on the item, no bubbling) — a leaf was selected by click,
//     Enter or Space.
//   • `itemmenu` { id } (no bubbling) — a context menu is opening on an item, sent
//     just before the `contextmenu` that opens a following <a-menu context>.
//   • `data-focus="<id>#<n>"` — input: focus and reveal that item. A new `n`
//     repeats the request, as in a-calendar.
//   • `data-reveal="<id>#<n>"` — input: scroll that item into view without
//     moving focus or the cursor.
// ─────────────────────────────────────────────────────────────────────────────
export class ATreeElement extends HTMLElementBase {
  static observedAttributes = ['data-focus', 'data-reveal']

  #internals = this.attachInternals?.()
  #active: ATreeItemElement | null = null
  // The active item's ancestors, nearest first, for when a re-render removes it.
  #activeAncestors: ATreeItemElement[] = []
  #observer?: MutationObserver
  // Set while the element sends its own `contextmenu`, from a key or an action.
  #menuFromUs = false
  // Set from a press until the task ends, so focus from a click is the user's.
  #pressing = false
  // Whether text in the tree was selected when the last press began; read by
  // the `contextmenu` that press opens.
  #selectedAtPress: boolean | undefined
  // The selection a right-click left when it opened the tree's menu, as its
  // endpoints, so a later press can tell it from one the reader made.
  #browserSelection: [Node, number, Node, number] | null = null

  constructor() {
    super()
    this.addEventListener('click', this.#onClick)
    this.addEventListener('keydown', this.#onKeyDown)
    this.addEventListener('focusin', this.#onFocusIn)
    this.addEventListener('pointerdown', this.#onPointerDown)
    // Capture runs before the bubbling listener of a following `<Menu context>`,
    // whichever element upgrades first.
    this.addEventListener('contextmenu', this.#onContextMenu, true)
  }

  connectedCallback() {
    // Closing an ancestor, or new data, can remove the active item.
    this.#observer ??= new this.view.MutationObserver(() => this.#keepActive())
    this.#observer.observe(this, { childList: true, subtree: true })
  }

  disconnectedCallback() {
    this.#observer?.disconnect()
  }

  attributeChangedCallback(name: string, _oldValue: string | null, value: string | null) {
    if ((name !== 'data-focus' && name !== 'data-reveal') || !value) return
    const cut = value.lastIndexOf('#')
    const id = cut >= 0 ? value.slice(0, cut) : value
    // The same render may insert the item; wait for it.
    queueMicrotask(() => {
      const item = this.#visibleItems().find(candidate => candidate.getItemId() === id)
      if (!item) return
      const behavior = this.view.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      // `data-focus` moves the cursor and focus there; `data-reveal` only
      // scrolls the item into view, leaving focus and the cursor alone.
      if (name === 'data-focus') this.#setActive(item, { focus: true, scroll: behavior })
      else (this.#row(item) ?? item).scrollIntoView({ block: 'nearest', behavior })
    })
  }

  // ─── Items ────────────────────────────────────────────────────────────────

  #owns(element: Element | null): boolean {
    return !!element && element.closest('a-tree') === this
  }

  #parentItem(item: Element): ATreeItemElement | null {
    const parent = item.parentElement?.closest('a-tree-item') as ATreeItemElement | null
    return parent && this.#owns(parent) ? parent : null
  }

  // Items shown now: every item of this tree with no closed ancestor.
  #visibleItems(): ATreeItemElement[] {
    return ([...this.querySelectorAll('a-tree-item')] as ATreeItemElement[]).filter(item => {
      if (!this.#owns(item)) return false
      for (let parent = this.#parentItem(item); parent; parent = this.#parentItem(parent)) {
        if (!parent.isOpen()) return false
      }
      return true
    })
  }

  // The item an event happened in, if it belongs to this tree.
  #itemOf(event: Event): ATreeItemElement | undefined {
    const item = event.composedPath().find(node =>
      isElement(node) && node.localName === 'a-tree-item') as ATreeItemElement | undefined
    return item && this.#owns(item) ? item : undefined
  }

  #child(item: Element, tag: string): HTMLElement | undefined {
    for (const child of item.children) if (child.localName === tag) return child as HTMLElement
    return undefined
  }

  #row(item: Element): HTMLElement | undefined {
    return this.#child(item, 'a-tree-row')
  }

  #actions(item: Element): HTMLElement | undefined {
    const row = this.#row(item)
    return row && this.#child(row, 'a-tree-actions')
  }

  #actionControls(item: Element): HTMLElement[] {
    const actions = this.#actions(item)
    if (!actions) return []
    // Each control once: skip disabled ones and anything inside another control.
    return ([...actions.querySelectorAll(ACTION_SELECTOR)] as HTMLElement[]).filter(control => {
      const outer = control.parentElement?.closest(ACTION_SELECTOR)
      return !control.matches(DISABLED_SELECTOR) && !(outer && actions.contains(outer))
    })
  }

  #disabled(item: Element): boolean {
    return item.hasAttribute('disabled') || item.getAttribute('aria-disabled') === 'true'
  }

  // ─── The active item ──────────────────────────────────────────────────────

  #setActive(item: ATreeItemElement | null, { focus = true, scroll = 'auto' as ScrollBehavior | false } = {}) {
    const changed = item !== this.#active
    if (this.#active && changed) this.#active.active = false
    this.#active = item
    this.#activeAncestors = []
    for (let parent = item && this.#parentItem(item); parent; parent = this.#parentItem(parent)) this.#activeAncestors.push(parent)
    if (this.#internals && 'ariaActiveDescendantElement' in this.#internals) this.#internals.ariaActiveDescendantElement = item
    if (!item) return
    item.active = true
    if (focus) this.#focusItem(item)
    if (scroll) (this.#row(item) ?? item).scrollIntoView({ block: 'nearest', behavior: scroll })
    const id = item.getItemId()
    if (changed && id !== null) this.#send<TreeNavigateDetail>('navigate', { id }, true)
  }

  // Real focus on the item when it has a tabindex (the wrapper), else on the host.
  #focusItem(item: ATreeItemElement) {
    if (item.hasAttribute('tabindex')) item.focus({ preventScroll: true })
    else this.focus({ preventScroll: true })
  }

  #currentItem(): ATreeItemElement | null {
    const active = this.#active
    return active && active.isConnected && this.#visibleItems().includes(active) ? active : null
  }

  // After a re-render, keep the active item, or move to its nearest remaining ancestor.
  #keepActive() {
    if (!this.#active || this.#currentItem()) return
    const visible = this.#visibleItems()
    const fallback = this.#activeAncestors.find(item => visible.includes(item)) ?? visible[0] ?? null
    this.#setActive(fallback, { focus: false, scroll: false })
  }

  #onPointerDown = () => {
    this.#pressing = true
    this.view.setTimeout(() => { this.#pressing = false })
    // Whether the reader had text selected before this press. WebKit selects
    // the word under a right-click as the press's default action, after this
    // listener, so the selection `contextmenu` sees may be the browser's own.
    // A selection WebKit made on an earlier right-click isn't the reader's either.
    this.#selectedAtPress = this.#hasSelectionIn(this) && !this.#isBrowserSelection()
  }

  #onFocusIn = (event: FocusEvent) => {
    const item = this.#itemOf(event)
    // The keys reach a row's actions only from that row. Focus landing on
    // another row's action without a press, as a closing menu hands it to the
    // first visible control in the tree, goes back to the active row instead.
    const current = this.#currentItem()
    if (item && current && item !== current && !this.#pressing) {
      const actions = this.#actions(item)
      if (actions && isElement(event.target!) && actions.contains(event.target)) {
        this.#focusItem(current)
        return
      }
    }
    if (item && event.target === item) {
      if (item !== this.#active) this.#setActive(item, { focus: false, scroll: false })
    } else if (event.target === this && !this.#currentItem()) {
      this.#setActive(this.#visibleItems()[0] ?? null, { focus: false })
    }
  }

  // ─── Clicks ───────────────────────────────────────────────────────────────

  #onClick = (event: MouseEvent) => {
    const item = this.#itemOf(event)
    if (!item) return
    const path = event.composedPath()
    const row = this.#row(item)
    const actions = this.#actions(item)
    // Only a click on an action control is an action. The container fills the
    // rest of the row, so a click on its empty part is a click on the row.
    const control = actions && path.find(node =>
      isElement(node) && node !== actions && actions.contains(node) && node.matches(ACTION_SELECTOR)) as HTMLElement | undefined
    if (actions && control) {
      // The control takes focus itself; the row still reads as current.
      this.#setActive(item, { focus: false, scroll: false })
      if (control.getAttribute('aria-haspopup') === 'menu' && !control.matches(DISABLED_SELECTOR)) this.#openMenuAt(item, control)
      return
    }
    // Only the row's own line toggles, not its after line or its children's.
    if (!row || !path.includes(row)) return
    const controlInLabel = path.slice(0, path.indexOf(row)).some(node =>
      isElement(node) && node.matches(CONTROL_SELECTOR) && !node.matches(DISABLED_SELECTOR))
    if (controlInLabel) return
    this.#setActive(item, { scroll: false })
    // A click that ends a text selection selects; it doesn't toggle.
    if (event.detail !== 0 && this.#hasSelectionIn(row)) return
    this.#activate(item, event.altKey ? 'subtree' : 'item')
  }

  // What a click, Enter or Space does to an item.
  #activate(item: ATreeItemElement, scope: TreeScope) {
    if (this.#disabled(item)) return
    if (item.isExpandable()) this.#toggle(item, scope)
    else item.dispatchEvent(new this.view.CustomEvent('activate'))
  }

  #toggle(item: ATreeItemElement, scope: TreeScope, next = item.isOpen() ? 'closed' as const : 'open' as const) {
    if (this.#disabled(item) || !item.isExpandable()) return
    const accepted = item.requestState(next, scope)
    // A controlled item's caller opens the subtree; an uncontrolled one opens here.
    if (!accepted || scope !== 'subtree' || item.hasAttribute('state')) return
    for (const descendant of item.querySelectorAll('a-tree-item') as NodeListOf<ATreeItemElement>) {
      // A disabled item can't open, so a subtree request passes it by.
      if (this.#owns(descendant) && !this.#disabled(descendant)) descendant.applyUncontrolled(next)
    }
  }

  // ─── Keys ─────────────────────────────────────────────────────────────────

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return
    const item = this.#itemOf(event)
    const actions = item && this.#actions(item)
    if (item && actions && event.target && isElement(event.target) && actions.contains(event.target)) {
      this.#actionKey(event, item, event.target as HTMLElement)
      return
    }
    // Keys belong to the tree only on the focused item, or on the host when hand-built.
    if (event.target !== this && event.target !== item) return
    this.#treeKey(event, event.target === this ? this.#currentItem() : item ?? null)
  }

  #treeKey(event: KeyboardEvent, current: ATreeItemElement | null) {
    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      event.preventDefault()
      if (current) this.#openMenu(current)
      return
    }
    if (event.key === 'Enter' && event.altKey) {
      event.preventDefault()
      if (current) this.#activate(current, 'subtree')
      return
    }
    if (isModifiedNavigationKey(event) || event.ctrlKey || event.metaKey || event.altKey) return
    const items = this.#visibleItems()
    if (!items.length) return
    const index = current ? items.indexOf(current) : -1
    const move = (to: number) => this.#setActive(items[Math.max(0, Math.min(items.length - 1, to))])
    switch (event.key) {
      case 'ArrowDown': move(index + 1); break
      case 'ArrowUp': move(index < 0 ? 0 : index - 1); break
      case 'Home': move(0); break
      case 'End': move(items.length - 1); break
      case 'PageDown': move(index + PAGE_ITEMS); break
      case 'PageUp': move(index - PAGE_ITEMS); break
      case 'ArrowRight': {
        if (!current) { move(0); break }
        // A closed item opens. An open item, or a leaf, moves to its first
        // action; Down already reaches an open item's first child, which Right
        // also reaches when there are no actions.
        if (current.isExpandable() && !current.isOpen()) { this.#toggle(current, 'item', 'open'); break }
        const [first] = this.#actionControls(current)
        if (first) first.focus({ preventScroll: true })
        else if (current.isOpen() && items[index + 1] && this.#parentItem(items[index + 1]) === current) move(index + 1)
        break
      }
      case 'ArrowLeft': {
        if (!current) { move(0); break }
        if (current.isExpandable() && current.isOpen()) { this.#toggle(current, 'item', 'closed'); break }
        const parent = this.#parentItem(current)
        if (parent) this.#setActive(parent)
        break
      }
      case 'Enter': case ' ':
        if (current) this.#activate(current, 'item')
        break
      default:
        return
    }
    event.preventDefault()
  }

  // Keys on one of a row's actions. Right and Left move between actions; Left
  // on the first, or Escape, returns to the row; a vertical move returns and
  // moves. Enter and Space stay with the control. Other keys, such as Tab, keep
  // their browser default.
  #actionKey(event: KeyboardEvent, item: ATreeItemElement, target: HTMLElement) {
    const controls = this.#actionControls(item)
    const index = controls.findIndex(control => control === target || control.contains(target))
    const plain = !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      event.preventDefault()
      this.#openMenuAt(item, controls[index] ?? target)
    } else if (plain && event.key === 'ArrowRight') {
      event.preventDefault()
      controls[index + 1]?.focus({ preventScroll: true })
    } else if (plain && event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      controls[index - 1].focus({ preventScroll: true })
    } else if (plain && (event.key === 'ArrowLeft' || event.key === 'Escape')) {
      event.preventDefault()
      this.#setActive(item, { scroll: false })
      this.#focusItem(item)
    } else if (VERTICAL_KEYS.has(event.key) && !isModifiedNavigationKey(event)) {
      this.#setActive(item, { scroll: false })
      this.#focusItem(item)
      this.#treeKey(event, item)
    }
  }

  // ─── Context menu ─────────────────────────────────────────────────────────

  // Opens the menu for an item from the keyboard: a synthetic right-click at the
  // row, so a following `<Menu context>` opens beside it. A keyboard-made
  // `contextmenu` event has no reliable position.
  #openMenu(item: ATreeItemElement) {
    const from = this.#row(item) ?? item
    const rect = from.getBoundingClientRect()
    this.#sendMenu(item, from, rect.left + Math.min(rect.width, 32), rect.bottom)
  }

  // Opens the menu from an action, at its bottom-left corner.
  #openMenuAt(item: ATreeItemElement, control: HTMLElement) {
    const rect = control.getBoundingClientRect()
    this.#sendMenu(item, control, rect.left, rect.bottom)
  }

  #sendMenu(item: ATreeItemElement, from: Element, clientX: number, clientY: number) {
    const id = item.getItemId()
    if (id !== null) this.#send<TreeItemMenuDetail>('itemmenu', { id })
    this.#menuFromUs = true
    try {
      from.dispatchEvent(new this.view.MouseEvent('contextmenu', {
        bubbles: true, cancelable: true, composed: true, button: 2, clientX, clientY,
      }))
    } finally {
      this.#menuFromUs = false
    }
  }

  #onContextMenu = (event: MouseEvent) => {
    if (this.#menuFromUs) return
    const item = this.#itemOf(event)
    // A browser-made keyboard `contextmenu` targets the focused host or item;
    // open the menu at that item's row instead.
    const current = this.#currentItem()
    if (event.isTrusted && current && (event.target === this || event.target === current)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      this.#openMenu(current)
      return
    }
    // Over text the reader selected, or outside any item, leave the browser's
    // own menu. The selection that counts is the one from before the press, so
    // the word WebKit selects on a right-click doesn't.
    const selected = this.#selectedAtPress ?? this.#hasSelectionIn(this)
    this.#selectedAtPress = undefined
    if (!item || selected) {
      event.stopImmediatePropagation()
      return
    }
    // Any selection now is the one this right-click made: remember it, so the
    // next press doesn't take it for the reader's.
    this.#browserSelection = this.#selectionRange()
    this.#setActive(item, { scroll: false })
    const id = item.getItemId()
    if (id !== null) this.#send<TreeItemMenuDetail>('itemmenu', { id })
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  // The current selection's endpoints, or null when nothing is selected.
  #selectionRange(): [Node, number, Node, number] | null {
    const selection = this.doc.getSelection()
    if (!selection || selection.isCollapsed || !selection.anchorNode || !selection.focusNode) return null
    return [selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset]
  }

  // Whether the selection is still the one a right-click left.
  #isBrowserSelection(): boolean {
    const now = this.#selectionRange()
    const was = this.#browserSelection
    return !!now && !!was && now.every((part, i) => part === was[i])
  }

  #hasSelectionIn(node: Node): boolean {
    const selection = this.doc.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) return false
    return selection.getRangeAt(0).intersectsNode(node)
  }

  #send<D>(type: string, detail: D, bubbles = false) {
    this.dispatchEvent(new this.view.CustomEvent(type, { detail, bubbles }))
  }
}

export function register_a_tree() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-tree-item')) customElements.define('a-tree-item', ATreeItemElement)
  if (!customElements.get('a-tree')) customElements.define('a-tree', ATreeElement)
}
register_a_tree()
