import './a-table.css'
// The Anta elements a Table renders, so registering the table registers what it needs.
import '@antadesign/anta/elements/a-box'
import '@antadesign/anta/elements/a-button'
import '@antadesign/anta/elements/a-icon'
import '@antadesign/anta/elements/a-input'
import '@antadesign/anta/elements/a-loader'
import '@antadesign/anta/elements/a-menu'
import '@antadesign/anta/elements/a-menu-item'
import '@antadesign/anta/elements/a-menu-separator'
import '@antadesign/anta/elements/a-panel'
import '@antadesign/anta/elements/a-select'
import '@antadesign/anta/elements/a-select-faceted'
import '@antadesign/anta/elements/a-tag'
import '@antadesign/anta/elements/a-tooltip'
import { HTMLElementBase } from '@antadesign/anta/anta_helpers'

// Rows can arrive in later DOM batches than the attribute, for example from a worker renderer.
const WAIT_FOR_TARGET_MS = 1000
// Room left beside a revealed match that was hidden past a horizontal edge.
const REVEAL_X_BUFFER = 16

/**
 * `<a-table>` — the root of a `Table`. Its children are light DOM, laid out
 * and styled by the package stylesheet.
 *
 * The element does two things a renderer without DOM access cannot do. When
 * `reveal-key` changes, it scrolls the descendant matching `reveal-target` to
 * the middle of a table without a virtualizer, below the header and clear of
 * pinned columns. Only the table's own scroller moves, never the page. When
 * `focus-key` changes, it focuses the descendant matching `focus-target`. A
 * virtualizer reveals its own rows, so the wrapper sets `reveal-*` only
 * without one.
 */
export class ATableElement extends HTMLElementBase {
  static observedAttributes = ['reveal-key', 'focus-key']
  #pending = new Map<string, () => void>()

  connectedCallback() {
    if (this.hasAttribute('reveal-key')) this.#reveal()
  }

  disconnectedCallback() {
    for (const cancel of this.#pending.values()) cancel()
    this.#pending.clear()
  }

  attributeChangedCallback(name: string, previous: string | null, value: string | null) {
    if (value === null || value === previous) return
    // A renderer may set these mid-commit: Preact sets an element's attributes before it updates its children, so the
    // target has not moved yet, and React restores the focus it saw before the commit. Act once the commit is done,
    // which also lets a menu opened in the same commit show the focus target.
    this.view.queueMicrotask(() => {
      if (name === 'reveal-key') {
        this.#reveal()
      } else if (name === 'focus-key') {
        this.#whenFound('focus', this.getAttribute('focus-target'), target => {
          if (target instanceof this.view.HTMLElement) target.focus()
        })
      }
    })
  }

  #reveal() {
    this.#whenFound('reveal', this.getAttribute('reveal-target'), target => {
      const scroller = target.closest('a-table-frame > a-box')
      if (!(scroller instanceof this.view.HTMLElement) || !this.contains(scroller)) return
      const box = scroller.getBoundingClientRect()
      const rect = target.getBoundingClientRect()
      const header = scroller.querySelector('a-table-head')?.getBoundingClientRect().height ?? 0
      const middle = box.top + header + (scroller.clientHeight - header) / 2
      scroller.scrollTop += rect.top + rect.height / 2 - middle
      const cell = target.closest('a-table-cell')
      if (cell?.hasAttribute('pin')) return
      const pinned = (side: 'left' | 'right') => [...cell?.parentElement?.querySelectorAll(`:scope > [pin="${side}"]`) ?? []]
        .reduce((width, pin) => width + pin.getBoundingClientRect().width, 0)
      const start = box.left + pinned('left')
      const end = box.left + scroller.clientWidth - pinned('right')
      if (rect.left < start) scroller.scrollLeft -= start - rect.left + REVEAL_X_BUFFER
      else if (rect.right > end) scroller.scrollLeft += rect.right - end + REVEAL_X_BUFFER
    })
  }

  #whenFound(kind: string, selector: string | null, action: (target: Element) => void) {
    this.#pending.get(kind)?.()
    this.#pending.delete(kind)
    if (!selector || !this.isConnected) return
    const find = () => {
      try {
        return this.querySelector(selector)
      } catch {
        return null
      }
    }
    const found = find()
    if (found) {
      action(found)
      return
    }
    const observer = new this.view.MutationObserver(() => {
      const target = find()
      if (!target) return
      cancel()
      action(target)
    })
    const timer = this.view.setTimeout(() => cancel(), WAIT_FOR_TARGET_MS)
    const cancel = () => {
      observer.disconnect()
      this.view.clearTimeout(timer)
      this.#pending.delete(kind)
    }
    observer.observe(this, { childList: true, subtree: true, attributes: true })
    this.#pending.set(kind, cancel)
  }
}

export function register_a_table() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-table')) customElements.define('a-table', ATableElement)
}
