import { HTMLElementBase } from '../anta_helpers'
import './a-inspector.css'

/** Detail of `nodetoggle`: the row to open or close, and the state requested. */
export type InspectorToggleDetail = { id: string; open: boolean }
/** Detail of `pagerequest`: the group or string to show another page of. */
export type InspectorPageDetail = { group: string }
/** Detail of `rowmenu`: the row a context menu opened on, or `null` outside any row. */
export type InspectorMenuDetail = { id: string | null }

const REVEAL_HIGHLIGHT = 'anta-inspector-reveal'
const REVEAL_MS = 1500

/** Input for the Inspector's light-DOM rows. The JSX wrapper renders the rows
 * and owns which are open; this element turns clicks into serializable
 * requests. It never changes the DOM, so the wrapper can render from a worker. */
export class AInspectorElement extends HTMLElementBase {
  #revealTimer: ReturnType<typeof setTimeout> | undefined

  constructor() {
    super()
    this.addEventListener('click', this.#onClick)
    // Capture runs before the bubbling listener of a following `<Menu context>`,
    // whichever element upgrades first.
    this.addEventListener('contextmenu', this.#onContextMenu, true)
  }

  disconnectedCallback() {
    this.#clearReveal()
  }

  // The row an event happened in, if it belongs to this Inspector rather than a nested one.
  #rowOf(event: Event): Element | undefined {
    const row = event.composedPath().find(node =>
      (node as Node).nodeType === 1 && (node as Element).localName === 'a-inspector-row') as Element | undefined
    return row && row.closest('a-inspector') === this ? row : undefined
  }

  #onClick = (event: MouseEvent) => {
    const row = this.#rowOf(event)
    if (!row) return
    // A click that ends a text selection selects; it doesn't toggle.
    if (event.detail !== 0 && this.#hasSelectionIn(row)) return
    const target = row.getAttribute('target')
    if (target !== null) {
      this.#reveal(target)
    } else if (row.getAttribute('type') === 'more') {
      const group = row.getAttribute('group')
      if (group) this.#request<InspectorPageDetail>('pagerequest', { group })
    } else if (row.hasAttribute('expandable')) {
      const id = row.getAttribute('row-id')
      if (id) this.#request<InspectorToggleDetail>('nodetoggle', { id, open: !row.hasAttribute('open') })
    }
  }

  #onContextMenu = (event: MouseEvent) => {
    // Over selected text, leave the browser's own menu, with its Copy, in place.
    if (this.#hasSelectionIn(this)) {
      event.stopImmediatePropagation()
      return
    }
    this.#request<InspectorMenuDetail>('rowmenu', { id: this.#rowOf(event)?.getAttribute('row-id') ?? null })
  }

  // Scrolls to the ancestor a circular row refers to and highlights it briefly.
  // The highlight is a CSS Custom Highlight, so no DOM changes.
  #reveal(id: string) {
    const row = this.querySelector(`a-inspector-row[row-id="${this.view.CSS.escape(id)}"]`)
    if (!row || row.closest('a-inspector') !== this) return
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
  if (!customElements.get('a-inspector')) customElements.define('a-inspector', AInspectorElement)
}
register_a_inspector()
