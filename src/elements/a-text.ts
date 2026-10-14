import { HTMLElementBase, isTextToggleReceiver, SYNC_TEXT_TOGGLE, type TextToggleReceiver } from '../anta_helpers'
import './a-text.css'
import type { TextPresentation } from '../general_types'

/** Light-DOM text with overflow measurement and expansion. The element keeps
 * state in ElementInternals; it never rewrites authored markup or attributes. */
export class ATextElement extends HTMLElementBase {
  static observedAttributes = ['expandable', 'truncate', 'collapsible']

  #internals: ElementInternals
  #expanded = false
  #resizeObserver?: ResizeObserver
  #contentObserver?: MutationObserver
  #content?: HTMLElement
  #control?: TextToggleReceiver
  #reportQueued = false
  #reported?: TextPresentation

  constructor() {
    super()
    this.#internals = this.attachInternals()
  }

  override addEventListener<K extends keyof HTMLElementEventMap>(type: K, callback: (this: HTMLElement, event: HTMLElementEventMap[K]) => unknown, options?: boolean | AddEventListenerOptions): void
  override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void
  override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
    if (callback) super.addEventListener(type, callback, options)
    // Hydration can attach its listener after the initial measurement. Replay
    // asynchronously so subscribing during render never invokes renderer state.
    if (type === 'textpresentationchange' && callback) this.#reportPresentation(true)
  }

  connectedCallback() {
    this.addEventListener('click', this.#onToggle)
    this.addEventListener('anta-text-control-ready', this.#onControlReady)
    this.#sync()
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onToggle)
    this.removeEventListener('anta-text-control-ready', this.#onControlReady)
    this.#resizeObserver?.disconnect()
    this.#contentObserver?.disconnect()
    this.#content = undefined
    this.#clearControl()
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return
    if (name === 'truncate' || name === 'expandable') this.#setExpanded(false)
    if (this.isConnected) this.#sync()
  }

  get #canExpand(): boolean {
    return this.hasAttribute('truncate') && this.hasAttribute('expandable')
  }

  /** Whether the current clamp hides content. Also used by truncated-only
   * tooltips. This layout read changes neither markup nor accessibility. */
  get isTruncated(): boolean {
    if (!this.hasAttribute('truncate') || this.#expanded) return false
    const content = this.#clampBox()
    if (!content || (content.clientWidth === 0 && content.clientHeight === 0)) return false
    return content.scrollHeight > content.clientHeight + 1 || content.scrollWidth > content.clientWidth + 1
  }

  #clampBox(): HTMLElement | null {
    return this.#canExpand ? this.querySelector(':scope > a-text-content') : this
  }

  #sync() {
    if (!this.#canExpand) {
      this.#resizeObserver?.disconnect()
      this.#contentObserver?.disconnect()
      this.#content = undefined
      this.#internals.states.delete('overflowing')
      this.#clearControl()
      this.#reportPresentation()
      return
    }
    this.#contentObserver ??= new MutationObserver(() => this.#sync())
    // A parser-connected element may not have its children yet. Watch for the
    // authored region and control, including renderer replacements later.
    this.#contentObserver.observe(this, { childList: true, subtree: true, characterData: true })
    const content = this.#clampBox()
    this.#resizeObserver ??= new ResizeObserver(() => this.#measureOverflow())
    if (content !== this.#content) {
      this.#resizeObserver.disconnect()
      if (content) this.#resizeObserver.observe(content)
      this.#content = content ?? undefined
    }
    const control = this.querySelector(':scope > a-button')
    const receiver = isTextToggleReceiver(control) ? control : undefined
    if (receiver !== this.#control) {
      this.#clearControl()
      this.#control = receiver
    }
    this.#syncControl()
    this.#reportPresentation()
    this.#measureOverflow()
  }

  #clearControl() {
    this.#control?.[SYNC_TEXT_TOGGLE]({ source: this, clear: true })
    this.#control = undefined
  }

  #syncControl() {
    this.#control?.[SYNC_TEXT_TOGGLE]({ source: this, expanded: this.#expanded })
  }

  #onControlReady = (event: Event) => {
    if ((event.target as Element).parentElement === this) this.#sync()
  }

  #onToggle = (event: Event) => {
    if (!this.#canExpand || event.defaultPrevented) return
    const control = this.querySelector(':scope > a-button')
    if (!control || !event.composedPath().includes(control)) return
    if (control.hasAttribute('disabled') || control.hasAttribute('loading')) return
    if (this.#expanded && !this.hasAttribute('collapsible')) return
    if (!this.#expanded && !this.isTruncated) return
    this.#setExpanded(!this.#expanded)
    if (!this.#expanded) this.#measureOverflow()
  }

  #setExpanded(next: boolean) {
    this.#expanded = next
    if (next) this.#internals.states.add('expanded')
    else this.#internals.states.delete('expanded')
    this.#syncControl()
    this.#reportPresentation()
  }

  #measureOverflow() {
    // Preserve the hint while expanded so a collapsible control stays usable.
    if (this.#expanded) return
    if (this.isTruncated) this.#internals.states.add('overflowing')
    else this.#internals.states.delete('overflowing')
    this.#reportPresentation()
  }

  #reportPresentation(replay = false) {
    if (replay) this.#reported = undefined
    if (this.#reportQueued) return
    this.#reportQueued = true
    this.view.queueMicrotask(() => {
      this.#reportQueued = false
      if (!this.isConnected) return
      const detail: TextPresentation = {
        expanded: this.#expanded,
        overflowing: this.#internals.states.has('overflowing'),
      }
      if (this.#reported?.expanded === detail.expanded && this.#reported.overflowing === detail.overflowing) return
      this.#reported = { ...detail }
      this.dispatchEvent(new this.view.CustomEvent('textpresentationchange', { detail }))
    })
  }
}

export function register_a_text() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-text')) customElements.define('a-text', ATextElement)
}

register_a_text()
