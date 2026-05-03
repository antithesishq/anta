import { HTMLElementBase } from '../anta_helpers'

const SHADOW_STYLE = `
  :host {
    display: block;
    position: relative;
  }
  :host([inline]) {
    display: inline-block;
  }

  /* Default: slot disappears from layout so slotted nodes flow as
     direct children of the host. Truncation rules below give the slot
     a real display so it becomes the wrapper that holds the clamp. */
  slot {
    display: contents;
  }

  :host([truncate]) slot {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--line-clamp, 1);
    overflow: hidden;
  }

  /* Expandable — vertical fade for multi-line. */
  :host([truncate][expandable]) slot:not(.expanded) {
    -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 2em), transparent 97%);
            mask-image: linear-gradient(to bottom, black calc(100% - 2em), transparent 97%);
  }

  /* Expandable — horizontal right-edge fade for single-line. */
  :host([truncate="1"][expandable]) slot:not(.expanded) {
    -webkit-mask-image: linear-gradient(to right, black calc(100% - 7ch), transparent 97%);
            mask-image: linear-gradient(to right, black calc(100% - 7ch), transparent 97%);
  }

  /* Expanded — drop truncation entirely. */
  :host([truncate]) slot.expanded {
    display: block;
    -webkit-line-clamp: unset;
    overflow: visible;
  }

  /* Expand button. The whole button is the click target; the chevron
     icon is positioned absolutely in the button's bottom-right corner. */
  .expand-btn {
    appearance: none;
    background: transparent;
    border: none;
    margin: 0;
    padding: 0;
    color: var(--text-3);
    cursor: pointer;
    font: inherit;
    display: none;
    position: absolute;
    z-index: 1;
    opacity: 0;
    transition: opacity 150ms ease-out, color 150ms ease-out;
  }
  .expand-btn:hover {
    color: var(--text-1);
  }
  .expand-btn::before {
    content: '';
    position: absolute;
    right: -1px;
    bottom: -1px;
    width: 14px;
    height: 14px;
    background-color: currentColor;
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E");
            mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E");
    -webkit-mask-position: center;
            mask-position: center;
    -webkit-mask-repeat: no-repeat;
            mask-repeat: no-repeat;
    -webkit-mask-size: contain;
            mask-size: contain;
  }

  /* Multi-line — full-width strip pinned to the bottom of the host. */
  :host([truncate][expandable]) .expand-btn:not(.hidden) {
    display: block;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1.5em;
  }

  /* Single-line — narrow region pinned to the right side. */
  :host([truncate="1"][expandable]) .expand-btn:not(.hidden) {
    left: auto;
    top: 0;
    bottom: 0;
    width: 3em;
  }

  :host([truncate][expandable]:hover) .expand-btn:not(.hidden),
  :host([truncate][expandable]:focus-within) .expand-btn:not(.hidden) {
    opacity: 1;
  }
`

export class ATextElement extends HTMLElementBase {
  static observedAttributes = ['expandable', 'truncate']

  private slotEl: HTMLSlotElement
  private expandBtn: HTMLButtonElement

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = SHADOW_STYLE

    this.slotEl = document.createElement('slot')

    this.expandBtn = document.createElement('button')
    this.expandBtn.className = 'expand-btn'
    this.expandBtn.type = 'button'
    this.expandBtn.setAttribute('aria-label', 'Show more')
    this.expandBtn.setAttribute('aria-expanded', 'false')
    this.expandBtn.addEventListener('click', this.handleExpand)

    shadow.append(style, this.slotEl, this.expandBtn)
  }

  attributeChangedCallback() {
    // When the configuration changes, restart in the collapsed state.
    this.slotEl.classList.remove('expanded')
    this.expandBtn.classList.remove('hidden')
    this.expandBtn.setAttribute('aria-expanded', 'false')
  }

  private handleExpand = () => {
    if (this.slotEl.classList.contains('expanded')) return
    this.slotEl.classList.add('expanded')
    this.expandBtn.classList.add('hidden')
    this.expandBtn.setAttribute('aria-expanded', 'true')
  }
}

export function register_a_text() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-text')) {
    customElements.define('a-text', ATextElement)
  }
}
