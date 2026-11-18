import { HTMLElementBase, isModifiedNavigationKey } from '../anta_helpers'
import './a-inspector.css'

/** Detail of `nodetoggle`: the row to open or close, the state requested, and
 *  whether the request covers the row's whole subtree. */
export type InspectorToggleDetail = { id: string; open: boolean; deep?: boolean }
/** Detail of `pagerequest`: the group or string to show another page of. */
export type InspectorPageDetail = { group: string }
/** Detail of `rowmenu`: the row a context menu opened on, or `null` outside any row. */
export type InspectorMenuDetail = { id: string | null }

const REVEAL_HIGHLIGHT = 'anta-inspector-reveal'
const REVEAL_MS = 1500
const PAGE_ROWS = 10

/** One line of an Inspector. The wrapper renders its attributes and ARIA;
 *  `a-inspector` marks the keyboard's active row through the `active` property,
 *  which shows as `:state(active)`. Off-DOM, so a re-render never churns it. */
export class AInspectorRowElement extends HTMLElementBase {
  #internals = this.attachInternals?.()

  set active(on: boolean) {
    if (on) this.#internals?.states?.add('active')
    else this.#internals?.states?.delete('active')
  }
  get active(): boolean {
    return this.#internals?.states?.has('active') ?? false
  }
}

/**
 * Input for the Inspector's light-DOM rows. The JSX wrapper renders the
 * `a-inspector-row` children, their ARIA, and which are open; this element owns
 * focus, the active row, and the keyboard. It never changes the DOM, so the
 * wrapper can render from a worker.
 *
 * It reports requests as serializable, non-bubbling events: `nodetoggle`
 * (`InspectorToggleDetail`) to open or close a row, `pagerequest`
 * (`InspectorPageDetail`) for another page, and `rowmenu`
 * (`InspectorMenuDetail`) when a context menu opens on a row.
 */
export class AInspectorElement extends HTMLElementBase {
  #internals = this.attachInternals?.()
  #active: AInspectorRowElement | null = null
  #activeId: string | null = null
  #observer?: MutationObserver
  #revealTimer: ReturnType<typeof setTimeout> | undefined
  #menuFromKey = false

  constructor() {
    super()
    this.addEventListener('click', this.#onClick)
    this.addEventListener('keydown', this.#onKeyDown)
    this.addEventListener('focus', this.#onFocus)
    // Capture runs before the bubbling listener of a following `<Menu context>`,
    // whichever element upgrades first.
    this.addEventListener('contextmenu', this.#onContextMenu, true)
  }

  connectedCallback() {
    // Re-renders keep keyed rows, but closing an ancestor removes the active row.
    this.#observer ??= new MutationObserver(() => this.#keepActive())
    this.#observer.observe(this, { childList: true })
  }

  disconnectedCallback() {
    this.#observer?.disconnect()
    this.#clearReveal()
  }

  #rows(): AInspectorRowElement[] {
    return [...this.children].filter(child => child.localName === 'a-inspector-row') as AInspectorRowElement[]
  }

  #rowById(id: string): AInspectorRowElement | undefined {
    return this.#rows().find(row => row.getAttribute('row-id') === id)
  }

  // The row an event happened in, if it belongs to this Inspector rather than a nested one.
  #rowOf(event: Event): AInspectorRowElement | undefined {
    const row = event.composedPath().find(node =>
      (node as Node).nodeType === 1 && (node as Element).localName === 'a-inspector-row') as AInspectorRowElement | undefined
    return row && row.parentElement === this ? row : undefined
  }

  #level(row: Element): number {
    return Number(row.getAttribute('aria-level')) || 1
  }

  #setActive(row: AInspectorRowElement | null, scroll = true) {
    if (this.#active && this.#active !== row) this.#active.active = false
    this.#active = row
    this.#activeId = row?.getAttribute('row-id') ?? null
    if (row) {
      row.active = true
      if (scroll) row.scrollIntoView({ block: 'nearest' })
    }
    if (this.#internals) this.#internals.ariaActiveDescendantElement = row
  }

  // After a re-render, keep the active row, or move to its nearest remaining ancestor.
  #keepActive() {
    if (!this.#active || this.#active.isConnected && this.#active.parentElement === this) return
    let id = this.#activeId
    while (id) {
      const row = this.#rowById(id)
      if (row) { this.#setActive(row, false); return }
      const cut = id.lastIndexOf(':')
      id = cut > 0 ? id.slice(0, cut) : null
    }
    this.#setActive(this.#rows()[0] ?? null, false)
  }

  #onFocus = () => {
    if (!this.#active?.isConnected) this.#setActive(this.#rows()[0] ?? null)
  }

  #onClick = (event: MouseEvent) => {
    const row = this.#rowOf(event)
    if (!row) return
    this.#setActive(row, false)
    // A click that ends a text selection selects; it doesn't toggle.
    if (event.detail !== 0 && this.#hasSelectionIn(row)) return
    this.#activate(row, event.altKey)
  }

  // What a click, Enter or Space does to a row.
  #activate(row: AInspectorRowElement, deep: boolean) {
    const target = row.getAttribute('target')
    if (target !== null) {
      this.#reveal(target)
    } else if (row.getAttribute('type') === 'more') {
      const group = row.getAttribute('group')
      if (group) this.#request<InspectorPageDetail>('pagerequest', { group })
    } else if (row.hasAttribute('expandable')) {
      this.#toggle(row, !row.hasAttribute('open'), deep)
    }
  }

  #toggle(row: Element, open: boolean, deep = false) {
    const id = row.getAttribute('row-id')
    if (id) this.#request<InspectorToggleDetail>('nodetoggle', deep ? { id, open, deep } : { id, open })
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== this) return
    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      event.preventDefault()
      this.#openMenu()
      return
    }
    if (event.key === 'Enter' && event.altKey) {
      event.preventDefault()
      if (this.#active?.hasAttribute('expandable')) this.#toggle(this.#active, !this.#active.hasAttribute('open'), true)
      return
    }
    if (isModifiedNavigationKey(event) || event.ctrlKey || event.metaKey || event.altKey) return
    const rows = this.#rows()
    if (!rows.length) return
    const row = this.#active?.parentElement === this ? this.#active : null
    const index = row ? rows.indexOf(row) : -1
    const move = (to: number) => this.#setActive(rows[Math.max(0, Math.min(rows.length - 1, to))])
    switch (event.key) {
      case 'ArrowDown': move(index + 1); break
      case 'ArrowUp': move(index < 0 ? 0 : index - 1); break
      case 'Home': move(0); break
      case 'End': move(rows.length - 1); break
      case 'PageDown': move(index + PAGE_ROWS); break
      case 'PageUp': move(index - PAGE_ROWS); break
      case 'ArrowRight': {
        if (!row) { move(0); break }
        if (row.hasAttribute('expandable') && !row.hasAttribute('open')) this.#toggle(row, true)
        else if (row.hasAttribute('open') && rows[index + 1] && this.#level(rows[index + 1]) > this.#level(row)) move(index + 1)
        break
      }
      case 'ArrowLeft': {
        if (!row) { move(0); break }
        if (row.hasAttribute('expandable') && row.hasAttribute('open')) { this.#toggle(row, false); break }
        const level = this.#level(row)
        for (let i = index - 1; i >= 0; i--) if (this.#level(rows[i]) < level) { move(i); break }
        break
      }
      case 'Enter': case ' ':
        if (row) this.#activate(row, false)
        break
      default:
        return
    }
    event.preventDefault()
  }

  // Opens the copy menu for the active row: a synthetic right-click at the row,
  // so a following `<Menu context>` opens beside it. A keyboard-made
  // `contextmenu` event has no reliable position.
  #openMenu() {
    const row = this.#active?.parentElement === this ? this.#active : null
    if (!row) return
    const rect = row.getBoundingClientRect()
    this.#menuFromKey = true
    row.dispatchEvent(new this.view.MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, composed: true, button: 2,
      clientX: rect.left + Math.min(rect.width, 32), clientY: rect.bottom,
    }))
    this.#menuFromKey = false
  }

  #onContextMenu = (event: MouseEvent) => {
    // A browser-made keyboard `contextmenu` targets the focused host itself;
    // open the menu at the active row instead.
    if (event.isTrusted && event.target === this && !this.#menuFromKey && this.#active?.parentElement === this) {
      event.preventDefault()
      event.stopImmediatePropagation()
      this.#openMenu()
      return
    }
    // Over selected text, leave the browser's own menu, with its Copy, in place.
    if (this.#hasSelectionIn(this)) {
      event.stopImmediatePropagation()
      return
    }
    const row = this.#rowOf(event)
    if (row) this.#setActive(row, false)
    this.#request<InspectorMenuDetail>('rowmenu', { id: row?.getAttribute('row-id') ?? null })
  }

  // Scrolls to the ancestor a circular row refers to, makes it the active row,
  // and highlights it briefly. The highlight is a CSS Custom Highlight, so no
  // DOM changes.
  #reveal(id: string) {
    const row = this.#rowById(id)
    if (!row) return
    this.#setActive(row, false)
    const reduce = this.view.matchMedia('(prefers-reduced-motion: reduce)').matches
    row.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
    const highlights = this.view.CSS.highlights
    if (!highlights) return
    const range = this.doc.createRange()
    range.selectNodeContents(row)
    this.#clearReveal()
    highlights.set(REVEAL_HIGHLIGHT, new this.view.Highlight(range))
    this.#revealTimer = setTimeout(() => this.#clearReveal(), REVEAL_MS)
  }

  #clearReveal() {
    if (this.#revealTimer === undefined) return
    clearTimeout(this.#revealTimer)
    this.#revealTimer = undefined
    this.view.CSS.highlights?.delete(REVEAL_HIGHLIGHT)
  }

  #hasSelectionIn(node: Node): boolean {
    const selection = this.doc.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) return false
    return selection.getRangeAt(0).intersectsNode(node)
  }

  #request<D>(type: string, detail: D) {
    this.dispatchEvent(new this.view.CustomEvent(type, { detail }))
  }
}

export function register_a_inspector() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-inspector-row')) customElements.define('a-inspector-row', AInspectorRowElement)
  if (!customElements.get('a-inspector')) customElements.define('a-inspector', AInspectorElement)
}
register_a_inspector()
