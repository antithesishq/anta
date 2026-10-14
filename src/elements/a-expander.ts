import { HTMLElementBase, parseOpenState } from '../anta_helpers'
import './a-expander.css'

type ExpanderState = 'open' | 'closed'
const INTERACTIVE_SELECTOR = 'a-button,a-checkbox,a-radio,a-radio-group,a-input,a-input-time,a-calendar,a-menu-item,a-tab,[data-anta][role="button"],button,a[href],input,select,textarea,label,[contenteditable=""],[contenteditable="true"]'
const DISABLED_SELECTOR = ':disabled,[disabled],[aria-disabled="true"]'

function ignoresToggle(element: Element): boolean {
  return element.hasAttribute('data-expander-ignore') ||
    (element.matches(INTERACTIVE_SELECTOR) && !element.matches(DISABLED_SELECTOR))
}

/** Disclosure with authored regions and an owned native button and inert body.
 * Manual projection changes neither authored attributes nor children. All
 * default styling is external; state requests remain cancelable. */
export class AExpanderElement extends HTMLElementBase {
  static observedAttributes = ['state', 'disabled']

  #internals: ElementInternals
  #summary: HTMLButtonElement
  #title: HTMLSlotElement
  #actions: HTMLSlotElement
  #indicator: HTMLSlotElement
  #content: HTMLSlotElement
  #region: HTMLDivElement
  #observer?: MutationObserver
  #seeded = false

  constructor() {
    super()
    this.#internals = this.attachInternals()
    const shadow = this.attachShadow({ mode: 'open', slotAssignment: 'manual' })
    const node = <K extends keyof HTMLElementTagNameMap>(tag: K, part: string) => {
      const element = this.ownerDocument.createElement(tag)
      element.setAttribute('part', part)
      return element
    }
    this.#summary = node('button', 'summary')
    this.#summary.type = 'button'
    this.#summary.setAttribute('aria-expanded', 'false')
    this.#title = node('slot', 'title')
    const indicator = node('span', 'indicator')
    indicator.setAttribute('aria-hidden', 'true')
    indicator.inert = true
    this.#indicator = node('slot', 'indicator-content')
    // The default glyph is an owned sibling, not fallback slot content.
    indicator.append(this.#indicator, node('span', 'glyph'))
    this.#summary.append(this.#title, indicator)
    this.#summary.addEventListener('click', this.#onSummaryClick)
    const header = node('div', 'header')
    this.#actions = node('slot', 'actions')
    header.append(this.#summary, this.#actions)
    this.#region = node('div', 'region')
    this.#region.inert = true
    this.#content = node('slot', 'content')
    this.#region.append(this.#content)
    shadow.append(header, this.#region)
  }

  get #controlled(): boolean { return this.hasAttribute('state') }
  get #current(): ExpanderState { return this.#summary.getAttribute('aria-expanded') === 'true' ? 'open' : 'closed' }

  connectedCallback() {
    this.#summary.disabled = this.hasAttribute('disabled')
    if (this.#controlled) this.#applyState(parseOpenState(this.getAttribute('state')))
    else if (!this.#seeded) this.#applyState(parseOpenState(this.getAttribute('default-state')))
    this.#seeded = true
    // Parser connection can precede children; renderer replacements also need
    // fresh projection. Only direct-child structure is observed.
    this.#observer ??= new MutationObserver(() => this.#project())
    this.#observer.observe(this, { childList: true })
    this.#project()
  }

  disconnectedCallback() { this.#observer?.disconnect() }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return
    if (name === 'disabled') this.#summary.disabled = this.hasAttribute('disabled')
    else if (name === 'state' && this.#controlled) this.#applyState(parseOpenState(newValue))
  }

  #project() {
    const children = [...this.children]
    this.#title.assign(...children.filter(node => node.localName === 'a-expander-summary' || node.localName === 'a-expander-title'))
    this.#actions.assign(...children.filter(node => node.localName === 'a-expander-actions'))
    this.#indicator.assign(...children.filter(node => node.localName === 'a-expander-indicator'))
    this.#content.assign(...children.filter(node => node.localName === 'a-expander-details'))
  }

  #applyState(state: ExpanderState) {
    const open = state === 'open'
    this.#summary.setAttribute('aria-expanded', String(open))
    this.#region.inert = !open
    this.#internals.states.delete(open ? 'closed' : 'open')
    this.#internals.states.add(state)
  }

  #clickIgnoresToggle(event: Event): boolean {
    const path = event.composedPath()
    // Bound nested disclosures and avoid realm-specific instanceof checks.
    const nearest = path.find(node => (node as Node).nodeType === 1 && (node as Element).localName === 'a-expander')
    if (nearest && nearest !== this) return true
    return path.slice(0, path.indexOf(this.#summary)).some(node =>
      (node as Node).nodeType === 1 && ignoresToggle(node as Element))
  }

  #titleControlHasFocus(): boolean {
    let active = this.ownerDocument.activeElement
    const titles = this.#title.assignedElements()
    while (active && active !== this) {
      if (titles.some(title => title.contains(active)) && ignoresToggle(active)) return true
      active = active.parentElement
    }
    return false
  }

  #titleHasSelection(): boolean {
    const selection = this.ownerDocument.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) return false
    const range = selection.getRangeAt(0)
    return this.#title.assignedNodes().some(node => range.intersectsNode(node))
  }

  #onSummaryClick = (event: MouseEvent) => {
    // Chromium can synthesize a summary click for Space in a projected input.
    // Keep that native ancestor activation from toggling the disclosure.
    if (this.hasAttribute('disabled') || this.#clickIgnoresToggle(event) ||
      (event.isTrusted && event.detail === 0 && this.#titleControlHasFocus()) ||
      (event.detail !== 0 && this.#titleHasSelection())) return
    const controlled = this.#controlled
    const prev = this.#current
    const next: ExpanderState = prev === 'open' ? 'closed' : 'open'
    const accepted = this.dispatchEvent(new this.view.CustomEvent('statechange', {
      cancelable: true, detail: { next, prev },
    }))
    // A controlled request cannot self-apply if its listener removes state.
    if (!controlled && !this.#controlled && accepted) this.#applyState(next)
  }
}

export function register_a_expander() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-expander')) customElements.define('a-expander', AExpanderElement)
}
register_a_expander()
