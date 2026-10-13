import { HTMLElementBase } from '../anta_helpers'
import './a-card.css'

/**
 * A surface with optional media, icon, header, body, and footer slots.
 * External CSS owns its surface and shadow-part layout. The element owns only
 * the shadow anchor and slot structure; host attributes and light DOM remain
 * application-owned.
 *
 * With `href`, the anchor is a native link named from `aria-label`, header text,
 * body text, or the URL. `loading` removes its navigation attributes and marks
 * the owned anchor busy. Linked cards must not contain interactive controls.
 */
export class ACardElement extends HTMLElementBase {
  static observedAttributes = ['href', 'target', 'rel', 'ping', 'loading', 'aria-label']

  #container: HTMLAnchorElement
  #headerSlot: HTMLSlotElement
  #bodySlot: HTMLSlotElement

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    // The box + the (inert-until-href) link, in one node.
    this.#container = document.createElement('a')
    this.#container.className = 'container'
    this.#container.setAttribute('part', 'container')

    const mediaSlot = document.createElement('slot')
    mediaSlot.name = 'media'
    mediaSlot.setAttribute('part', 'media')

    const content = document.createElement('div')
    content.className = 'content'
    content.setAttribute('part', 'content')

    // Header SECTION: a padded row uniting an optional leading `icon` with the
    // title / subtitle column (the header slot). `part="header"` is on the section
    // (so ::part(header) styles the whole zone); the header slot is the text column,
    // reachable on its own as `part="title"`.
    const headerSection = document.createElement('div')
    headerSection.className = 'header'
    headerSection.setAttribute('part', 'header')

    const iconSlot = document.createElement('slot')
    iconSlot.name = 'icon'
    iconSlot.setAttribute('part', 'icon')

    this.#headerSlot = document.createElement('slot')
    this.#headerSlot.name = 'header'
    // The text column (title + subtitle) gets its own part so consumers can reach
    // it — `::part(header)` is the whole zone (icon + text), `::part(title)` just
    // the text column beside the icon.
    this.#headerSlot.setAttribute('part', 'title')

    headerSection.append(iconSlot, this.#headerSlot)

    // The default (unnamed) slot IS the body section (slot-is-the-box).
    this.#bodySlot = document.createElement('slot')
    this.#bodySlot.setAttribute('part', 'body')

    const footerSlot = document.createElement('slot')
    footerSlot.name = 'footer'
    footerSlot.setAttribute('part', 'footer')

    content.append(headerSection, this.#bodySlot, footerSlot)
    this.#container.append(mediaSlot, content)
    shadow.append(this.#container)

    // Slot changes update the owned link's name; CSS handles empty regions.
    this.#headerSlot.addEventListener('slotchange', () => this.#syncName())
    this.#bodySlot.addEventListener('slotchange', () => this.#syncName())
  }

  connectedCallback() {
    this.#syncLink()
  }

  attributeChangedCallback() {
    // Every observed attribute (href / target / rel / ping / loading /
    // aria-label) feeds the link + its name — a single cheap re-sync covers all.
    this.#syncLink()
  }

  /** Mirror the link attributes onto the shadow anchor — but drop `href` while
   *  `loading` so a loading card can't navigate. Also reflects `aria-busy`. */
  #syncLink() {
    const href = this.getAttribute('href')
    const loading = this.hasAttribute('loading')
    if (href != null && !loading) {
      this.#container.setAttribute('href', href)
      for (const name of ['target', 'rel', 'ping']) {
        const v = this.getAttribute(name)
        if (v != null) this.#container.setAttribute(name, v)
        else this.#container.removeAttribute(name)
      }
    } else {
      for (const name of ['href', 'target', 'rel', 'ping']) {
        this.#container.removeAttribute(name)
      }
    }
    if (loading) this.#container.setAttribute('aria-busy', 'true')
    else this.#container.removeAttribute('aria-busy')
    this.#syncName()
  }

  /** Name the anchor (link mode only): explicit aria-label → header → body → href. */
  #syncName() {
    if (!this.#container.hasAttribute('href')) {
      this.#container.removeAttribute('aria-label')
      return
    }
    const explicit = this.getAttribute('aria-label')?.trim()
    const name =
      explicit ||
      this.#slotText(this.#headerSlot) ||
      this.#slotText(this.#bodySlot) ||
      this.getAttribute('href') ||
      ''
    if (name) this.#container.setAttribute('aria-label', name)
    else this.#container.removeAttribute('aria-label')
  }

  #slotText(slot: HTMLSlotElement): string {
    return slot
      .assignedNodes()
      .map((n) => n.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
}

export function register_a_card() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-card')) {
    customElements.define('a-card', ACardElement)
  }
}

// Importing this module registers the element (granular entry point). The barrel
// re-exports it, so importing the barrel registers it too. Idempotent.
register_a_card()
