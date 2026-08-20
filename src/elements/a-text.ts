import { HTMLElementBase } from '../anta_helpers'
import './a-text.css'

// Ships verbatim into every instance's shadow root — keep comment-free. The
// slot is the clamp box (-webkit-box under [truncate]); the fade mask and the
// expand button (its following sibling, via `slot.overflowing ~ .expand-btn`)
// are gated on `slot.overflowing`, a class JS sets only when content clips.
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

  :host([truncate][expandable]) slot.overflowing:not(.expanded) {
    -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 2em), transparent 97%);
            mask-image: linear-gradient(to bottom, black calc(100% - 2em), transparent 97%);
  }

  :host([truncate="1"][expandable]) slot.overflowing:not(.expanded) {
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

  :host([truncate][expandable]) slot.overflowing ~ .expand-btn {
    display: block;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1.5em;
  }

  :host([truncate="1"][expandable]) slot.overflowing ~ .expand-btn {
    left: auto;
    top: 0;
    bottom: 0;
    width: 3em;
  }

  :host([truncate][expandable]:hover) slot.overflowing ~ .expand-btn,
  :host([truncate][expandable]:focus-within) slot.overflowing ~ .expand-btn,
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
  /** The chevron — built only while expandable, removed on drop or one-way expand. */
  private expandBtn?: HTMLButtonElement
  /** Expanded state lives on the element — a stateless wrapper can't hold it. */
  private expanded = false
  // Re-sync `slot.overflowing`: the resize observer watches the box (width),
  // the mutation observer watches the slotted content — the clamped box never
  // resizes as content grows, so resize alone misses added lines.
  private overflowObserver?: ResizeObserver
  private contentObserver?: MutationObserver

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
    if (this.#isExpandable) this.startOverflowObserver()
  }

  disconnectedCallback() {
    this.overflowObserver?.disconnect()
    this.contentObserver?.disconnect()
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    // A no-op re-set (same value) must not discard the reader's expand; only a
    // real truncate/expandable change resets to collapsed.
    if (oldValue === newValue) return
    if (name === 'truncate' || name === 'expandable') this.setExpanded(false)
    this.syncExpandButton()
    if (name === 'truncate' || name === 'expandable') {
      if (this.#isExpandable) this.startOverflowObserver()
      else this.stopOverflowObserver()
    }
  }

  get #isExpandable(): boolean {
    return this.hasAttribute('truncate') && this.hasAttribute('expandable')
  }
  get #isCollapsible(): boolean {
    return this.hasAttribute('collapsible')
  }

  /** True when `truncate` currently hides some of the slotted content. This is
   *  a UI-thread layout read, used by a nested `a-tooltip`; it never writes to
   *  the host or light DOM. */
  get isTruncated(): boolean {
    if (!this.hasAttribute('truncate') || this.expanded) return false
    const s = this.slotEl
    if (s.clientWidth === 0 && s.clientHeight === 0) return false
    return s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1
  }

  /** Create or remove the chevron to match `expandable`, then refresh it. */
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
    if (!next) this.measureOverflow()
  }

  private startOverflowObserver() {
    if (!this.#isExpandable) return
    this.overflowObserver ??= new ResizeObserver(() => this.measureOverflow())
    this.contentObserver ??= new MutationObserver(() => this.measureOverflow())
    this.overflowObserver.observe(this.slotEl)
    this.contentObserver.observe(this, { childList: true, subtree: true, characterData: true })
    this.measureOverflow()
  }

  private stopOverflowObserver() {
    this.overflowObserver?.disconnect()
    this.contentObserver?.disconnect()
    this.slotEl.classList.remove('overflowing')
  }

  /** Toggle `slot.overflowing` (gates the fade + chevron) to whether the clamp
   *  clips. Frozen on while expanded; height catches wrapped text, width a long word. */
  private measureOverflow() {
    if (!this.#isExpandable || this.expanded) return
    this.slotEl.classList.toggle('overflowing', this.isTruncated)
  }

  /** Reflect state onto the button (label + `aria-expanded` + `.expanded`); a
   *  one-way expand removes it once open. */
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

// Importing this module self-registers the element (idempotent).
register_a_text()
