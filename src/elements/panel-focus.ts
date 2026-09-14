import { isFocusable, tabbable } from 'tabbable'

type FocusTarget = HTMLElement | SVGElement
const scopes = new WeakMap<Document, PanelFocusScope[]>()
const options = { getShadowRoot: true }

export function activeFocus(doc: Document): Element | null {
  let active = doc.activeElement
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  return active
}

/** Follow rendered ancestry through slots and shadow roots. */
function contains(scope: Element, node: Node | null): boolean {
  while (node) {
    if (node === scope) return true
    node = node instanceof Element && node.assignedSlot
      ? node.assignedSlot
      : node.parentNode instanceof ShadowRoot ? node.parentNode.host : node.parentNode
  }
  return false
}

function canFocus(node: Element | null): node is FocusTarget {
  return !!node && 'focus' in node && isFocusable(node, options)
}

/** One active Panel scope per document; later scopes suspend earlier ones. */
export class PanelFocusScope {
  #stack: PanelFocusScope[]
  #doc: Document
  #surface: HTMLSlotElement
  #previous: Element | null = null
  #lastInside: Element | null = null
  #active = false
  #redirecting = false

  constructor(surface: HTMLSlotElement) {
    this.#surface = surface
    this.#doc = surface.ownerDocument
    this.#stack = scopes.get(this.#doc) ?? []
    scopes.set(this.#doc, this.#stack)
  }

  get #ownsFocus(): boolean {
    return this.#stack.at(-1) === this && this.#surface.matches(':popover-open')
  }

  activate(previous: Element | null) {
    if (this.#active) return
    this.#active = true
    this.#previous = previous
    this.#lastInside = contains(this.#surface, previous) ? previous : null
    this.#stack.push(this)
    this.#doc.addEventListener('focusin', this.#onFocus, true)
    // Bubble phase lets controls and nested menus handle Tab first.
    this.#doc.addEventListener('keydown', this.#onKeyDown)
  }

  focusInside(preferred: Element | null = this.#lastInside) {
    if (!this.#ownsFocus) return
    const target = contains(this.#surface, preferred) && canFocus(preferred)
      ? preferred : tabbable(this.#surface, options)[0] ?? this.#surface
    target.focus({ preventScroll: true })
  }

  /** Remove listeners before hiding the popover, then restore focus after layout. */
  deactivate(): () => void {
    if (!this.#active) return () => {}
    const current = activeFocus(this.#doc)
    const restore = this.#stack.at(-1) === this && contains(this.#surface, current)
    const previous = this.#previous
    const target = previous && !contains(this.#surface, previous) ? previous : current
    this.#active = false
    this.#stack.splice(this.#stack.indexOf(this), 1)
    this.#doc.removeEventListener('focusin', this.#onFocus, true)
    this.#doc.removeEventListener('keydown', this.#onKeyDown)
    this.#previous = this.#lastInside = null
    return () => {
      if (!restore) return
      if (canFocus(target)) target.focus({ preventScroll: true })
      else if (canFocus(current)) current.focus({ preventScroll: true })
      else if (canFocus(previous)) previous.focus({ preventScroll: true })
      else this.#stack.at(-1)?.focusInside()
    }
  }

  #inModal(path: EventTarget[]): boolean {
    // A dialog containing the Panel does not suspend it. A dialog opened
    // inside or above the Panel owns focus until the browser closes it.
    for (const node of path) {
      if (node === this.#surface) return false
      if (node instanceof Element && node.matches(':modal')) return true
    }
    return false
  }

  #onFocus = (event: FocusEvent) => {
    if (!this.#ownsFocus || this.#redirecting) return
    const path = event.composedPath()
    if (this.#inModal(path)) return
    if (path.includes(this.#surface)) {
      this.#lastInside = activeFocus(this.#doc)
      return
    }
    this.#redirecting = true
    this.focusInside()
    this.#redirecting = false
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (!this.#ownsFocus || event.defaultPrevented || event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return
    if (this.#inModal(event.composedPath())) return
    const nodes = tabbable(this.#surface, options)
    const current = activeFocus(this.#doc)
    const index = nodes.indexOf(current as FocusTarget)
    const next = index < 0 ? (event.shiftKey ? nodes.length - 1 : 0)
      : (index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length
    event.preventDefault()
    ;(nodes[next] ?? this.#surface).focus()
  }
}
