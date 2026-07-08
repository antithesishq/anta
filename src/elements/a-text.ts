import { HTMLElementBase } from '../anta_helpers'
import './a-text.css'

// Shadow CSS (kept comment-free — this string ships into every consumer
// document). How it hangs together:
// - The slot defaults to `display: contents` so slotted nodes flow as direct
//   children of the host; the `[truncate]` rule gives it a real -webkit-box
//   display so it becomes the wrapper that holds the line clamp, and
//   `.expanded` drops the clamp entirely.
// - The expandable fade mask is vertical for multi-line, a right-edge
//   horizontal fade for single-line (`truncate="1"`).
// - The expand button is the whole fade strip (full-width bottom strip for
//   multi-line, narrow right region for single-line) — the chevron is just
//   a masked ::before pinned in its bottom-right corner. It appears on
//   hover / focus-within while collapsed; while expanded (the two-way
//   `collapsible` toggle) it stays visible with the chevron rotated to point
//   up. A one-way expand removes the button entirely (handled in JS).
const SHADOW_STYLE = `
  :host {
    display: block;
    position: relative;
  }
  :host([inline]) {
    display: inline-block;
  }

  slot {
    display: contents;
  }

  :host([truncate]) slot {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--line-clamp, 1);
    overflow: hidden;
  }

  :host([truncate][expandable]) slot:not(.expanded) {
    -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 2em), transparent 97%);
            mask-image: linear-gradient(to bottom, black calc(100% - 2em), transparent 97%);
  }

  :host([truncate="1"][expandable]) slot:not(.expanded) {
    -webkit-mask-image: linear-gradient(to right, black calc(100% - 7ch), transparent 97%);
            mask-image: linear-gradient(to right, black calc(100% - 7ch), transparent 97%);
  }

  :host([truncate]) slot.expanded {
    display: block;
    -webkit-line-clamp: unset;
    overflow: visible;
  }

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
    transition: transform 150ms ease-out;
  }

  :host([truncate][expandable]) .expand-btn {
    display: block;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1.5em;
  }

  :host([truncate="1"][expandable]) .expand-btn {
    left: auto;
    top: 0;
    bottom: 0;
    width: 3em;
  }

  :host([truncate][expandable]:hover) .expand-btn,
  :host([truncate][expandable]:focus-within) .expand-btn,
  .expand-btn.expanded {
    opacity: 1;
  }

  .expand-btn.expanded::before {
    transform: rotate(180deg);
  }
`

/**
 * `<a-text>` — body text element with truncation / expansion.
 *
 * Styling notes (`a-text.css` ships comment-free):
 * - `a-text[truncate] { min-width: 0 }` is the one external requirement of
 *   the shadow clamp: the host must be allowed to shrink inside flex/grid
 *   parents so the inner clamp can actually clip content.
 * - The default (no `priority`) is the SECONDARY level — body text reads at
 *   `--text-2` on the base rule; `priority="primary"` opts into the
 *   strongest `--text-1`.
 * - Priority/tone link colors: levels 1–2 keep the brand link color; levels
 *   3–5 mute the link to `currentColor` and step the hover up one level
 *   (3→2, 4→3, 5→4). Tinted variants do the same within their
 *   `--text-{N}-{tone}` ramp (level 1 has nothing above it — hover keeps the
 *   color and only the underline alpha changes).
 * - The `a-text a` rules layer on anta's global `a` defaults from
 *   `reset.css`, overriding only color and the one-step-up hover color
 *   (underline thickness/offset/alpha are inherited); the hover repeats the
 *   underline color so it tracks the priority color. Hover is gated to
 *   `(hover: hover) and (pointer: fine)` to avoid sticky hover after a tap.
 */
export class ATextElement extends HTMLElementBase {
  static observedAttributes = ['expandable', 'truncate', 'collapsible']

  private slotEl: HTMLSlotElement
  /** The expand/collapse chevron — built lazily, only while the element is
   *  expandable (a plain `<a-text>` never creates a button or a listener).
   *  Removed when `expandable` is dropped, and when a one-way expand completes. */
  private expandBtn?: HTMLButtonElement
  /** Expanded state lives here, on the element — a stateless wrapper can't hold
   *  it and the app DOM may be reconciled off the UI thread. */
  private expanded = false

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = SHADOW_STYLE

    this.slotEl = document.createElement('slot')

    shadow.append(style, this.slotEl)
  }

  connectedCallback() {
    this.syncExpandButton()
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    // A no-op re-render (a reactive engine re-setting an attribute to the same
    // value) must NOT discard the reader's expand — only a real change to the
    // truncation/expandability resets to collapsed. (`collapsible` flipping
    // changes the affordance, not the state.)
    if (oldValue === newValue) return
    if (name === 'truncate' || name === 'expandable') this.setExpanded(false)
    this.syncExpandButton()
  }

  get #isExpandable(): boolean {
    return this.hasAttribute('truncate') && this.hasAttribute('expandable')
  }
  get #isCollapsible(): boolean {
    return this.hasAttribute('collapsible')
  }

  /** Create or remove the chevron button to match `expandable`, then refresh
   *  its label/visibility — the single place the button's lifecycle lives. */
  private syncExpandButton() {
    if (this.#isExpandable && !this.expandBtn) {
      const btn = document.createElement('button')
      btn.className = 'expand-btn'
      btn.type = 'button'
      btn.addEventListener('click', this.handleToggle)
      this.shadowRoot!.append(btn)
      this.expandBtn = btn
    } else if (!this.#isExpandable && this.expandBtn) {
      this.expandBtn.remove()
      this.expandBtn = undefined
    }
    this.refreshButton()
  }

  private handleToggle = () => {
    this.setExpanded(!this.expanded)
  }

  private setExpanded(next: boolean) {
    if (next === this.expanded) return
    this.expanded = next
    this.slotEl.classList.toggle('expanded', next)
    this.refreshButton()
  }

  /** Reflect the current state onto the button: label + `aria-expanded` + the
   *  `.expanded` class (CSS keeps it visible and rotates the chevron up). A
   *  one-way expand (no `collapsible`) removes the button once expanded — there
   *  is nothing to collapse back to. */
  private refreshButton() {
    const btn = this.expandBtn
    if (!btn) return
    if (this.expanded && !this.#isCollapsible) {
      btn.remove()
      this.expandBtn = undefined
      return
    }
    btn.setAttribute('aria-expanded', this.expanded ? 'true' : 'false')
    btn.setAttribute('aria-label', this.expanded ? 'Show less' : 'Show more')
    btn.classList.toggle('expanded', this.expanded)
  }
}

export function register_a_text() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-text')) {
    customElements.define('a-text', ATextElement)
  }
}

// Importing this module registers the element (granular entry point). The
// barrel re-exports it, so importing the barrel registers it too. Idempotent.
register_a_text()
