import { activeFocus, canFocus, containsFocus, cycleFocus, tabStops } from './focus'

export { activeFocus } from './focus'

const scopes = new WeakMap<Document, PanelFocusScope[]>()

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
    this.#lastInside = containsFocus(this.#surface, previous) ? previous : null
    this.#stack.push(this)
    this.#doc.addEventListener('focusin', this.#onFocus, true)
    // Bubble phase lets controls and nested menus handle Tab first.
    this.#doc.addEventListener('keydown', this.#onKeyDown)
  }

  focusInside(preferred: Element | null = this.#lastInside) {
    if (!this.#ownsFocus) return
    const target = containsFocus(this.#surface, preferred) && canFocus(preferred)
      ? preferred : tabStops(this.#surface)[0] ?? this.#surface
    target.focus({ preventScroll: true })
  }

  /** Remove listeners before hiding the popover, then restore focus after layout. */
  deactivate(): () => void {
    if (!this.#active) return () => {}
    const current = activeFocus(this.#doc)
    const restore = this.#stack.at(-1) === this && containsFocus(this.#surface, current)
    const previous = this.#previous
    const target = previous && !containsFocus(this.#surface, previous) ? previous : current
    this.#active = false
    const index = this.#stack.indexOf(this)
    if (index >= 0) this.#stack.splice(index, 1)
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
    event.preventDefault()
    cycleFocus(tabStops(this.#surface), activeFocus(this.#doc), event.shiftKey, this.#surface)
  }
}
