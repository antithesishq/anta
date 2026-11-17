import { HTMLElementBase } from '../anta_helpers'
import './a-inspector.css'

/** Detail of `nodetoggle`: the row to open or close, and the state requested. */
export type InspectorToggleDetail = { id: string; open: boolean }
/** Detail of `pagerequest`: the group or string to show another page of. */
export type InspectorPageDetail = { group: string }

/** Input for the Inspector's light-DOM rows. The JSX wrapper renders the rows
 * and owns which are open; this element turns clicks into serializable
 * requests. It never changes the DOM, so the wrapper can render from a worker. */
export class AInspectorElement extends HTMLElementBase {
  constructor() {
    super()
    this.addEventListener('click', this.#onClick)
  }

  #onClick = (event: MouseEvent) => {
    const row = event.composedPath().find(node =>
      (node as Node).nodeType === 1 && (node as Element).localName === 'a-inspector-row') as Element | undefined
    // Rows of an Inspector nested inside this one belong to that Inspector.
    if (!row || row.closest('a-inspector') !== this) return
    // A click that ends a text selection selects; it doesn't toggle.
    if (event.detail !== 0 && this.#hasSelectionIn(row)) return
    if (row.getAttribute('type') === 'more') {
      const group = row.getAttribute('group')
      if (group) this.#request<InspectorPageDetail>('pagerequest', { group })
    } else if (row.hasAttribute('expandable')) {
      const id = row.getAttribute('row-id')
      if (id) this.#request<InspectorToggleDetail>('nodetoggle', { id, open: !row.hasAttribute('open') })
    }
  }

  #hasSelectionIn(row: Element): boolean {
    const selection = this.doc.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) return false
    return selection.getRangeAt(0).intersectsNode(row)
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
