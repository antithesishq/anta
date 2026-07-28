import { HTMLElementBase } from '../anta_helpers'
import './a-card.css'

/**
 * `<a-card>` — a surface container: a bordered, toned box that lays out an
 * optional `media` region plus a `header` / body / `footer` stack, and becomes a
 * link when given an `href`.
 *
 * Light-DOM composition (what the `<Card>` wrapper emits, or a vanilla author
 * writes by hand) is slot-based, like `<a-dialog>`:
 *
 *   <a-card href="/x">
 *     <img slot="media" …>                 ← full-bleed, padding-exempt
 *     <a-icon slot="icon" …>                ← leading visual, aligned to the title
 *     <a-title slot="header">Title</a-title> ← nest a-title for the heading style
 *     …body… (the default slot)             ← nest a-text for body typography
 *     <span slot="footer"><a-button>…</a-button></span>  ← LEFT-aligned action row
 *   </a-card>
 *
 * a-card stylizes only its own surface (box, border, radius, layout) — never the
 * typography of slotted content, which renders at its regular inherited style
 * unless it's an <a-title> / <a-text> that brings its own. The <Card> JSX wrapper
 * does that wrapping for a string header / body.
 *
 * Shadow structure — every node carries a `part` so consumers can reach it:
 *
 *   <a part="container">                    ← the box; a live link only with href
 *     <slot name="media" part="media">      ← full-bleed; display:none until filled
 *     <div part="content">                  ← unpadded flex-column group (media sits beside it)
 *       <div part="header">                 ← padded section: a row of…
 *         <slot name="icon" part="icon">    ← leading visual (flex:none)
 *         <slot name="header" part="title"> ← the title / subtitle text column
 *       <slot part="body">                  ← the default slot; padded body section
 *       <slot name="footer" part="footer">  ← padded section; display:none until filled
 *
 * header / body / footer are independent padded sections sharing --card-padding
 * (see the SHADOW_STYLE rationale). The header section is a flex row that unites an
 * optional leading `icon` with the title / subtitle column, so a leading icon /
 * image aligns as a unit with the heading instead of sitting inline in the title.
 * There is no actions slot — lay out any header controls (buttons, tags) inside the
 * header itself.
 *
 * ## Link mode
 *
 * `.container` is always an `<a>`, but only carries `href` (and `target` / `rel` /
 * `ping`) — and thus becomes a focusable link — when the host has an
 * `href`. Without it the anchor is an inert box, so there's no node-type branching
 * and a card ⇄ link is a pure attribute flip. `container-type: inline-size` on the
 * host (external CSS) also makes the card a query container.
 *
 * ## Accessible name (link mode only)
 *
 * A shadow anchor wrapping the whole card would otherwise take its accessible name
 * from the entire concatenated card text. So — only when it's a link — the element
 * names the anchor from a priority chain: an explicit host `aria-label`, else the
 * header text, else the body text, else the `href`. This is the `a-dialog`
 * header→aria-label mirror: a shadow-internal write, declarative-DOM-safe (the host
 * may be reconciled off the UI thread; only the shadow anchor is mutated). Nested
 * interactive content inside a link card is intentionally out of scope for now — a
 * link card is display content; a live control in one is a later (stretched-link)
 * refinement that won't change this API.
 *
 * ## Loading
 *
 * `loading` blocks the link (the anchor drops its `href`, so it can't navigate),
 * sets `aria-busy`, and paints a skeleton pulse. It's a boolean today; the visual
 * is deliberately minimal so it can grow into a loading-*type* enum later.
 *
 * ## Declarative-DOM safety
 *
 * Nothing on the *host* is mutated from JS. The element only writes the shadow
 * anchor (its `href` / ARIA) and reads the host attributes + slotted text — all
 * reads / shadow writes, never a host or light-DOM mutation. Empty-section hiding
 * is pure CSS (`:host(:has(…))`), no JS. Host attributes (`tone`, `priority`,
 * `size`, `media-position`, `selected`) are pure CSS hooks matched via `:host([…])`.
 */

// Shadow styles, injected verbatim into every <a-card> shadow root — kept
// COMMENT-FREE (it ships + re-injects per instance; see the "no comments inside
// shadow-<style> strings" rule in AGENTS.md). Rationale lives here instead:
//
//  • The visible box (border / background / radius / overflow-clip) lives on the
//    HOST in a-card.css so plain consumer CSS can override it and it paints before
//    upgrade; the shadow owns only layout + the anchor reset + the region defaults.
//  • .container is an <a> reset to behave as a div (display:flex, inherit colour,
//    no underline, default cursor, no drag) until [href] makes it a link (pointer
//    cursor, non-selectable content). Its border-radius mirrors --card-radius only
//    so the inset focus ring is rounded.
//  • media-position flips the container's flex axis: column (top, default) /
//    column-reverse (bottom) / row (left) / row-reverse (right). The container has
//    exactly two flex children (media slot + .content), so a reverse just swaps
//    them; an empty media slot is display:none and drops out.
//  • .content is an UNPADDED flex-column group holding the header / body / footer
//    sections — it exists only so media can sit beside the whole stack (the two
//    container children above). The padding lives on each SECTION, not here.
//  • Focus is an INSET indicator: 1px border (host) + 1px gap (a transparent inset
//    layer showing the card surface) + 1px --focus-ring, all inside the box.
//  • header / body / footer are independent padded SECTIONS, each `padding:
//    var(--card-padding)` here (their intrinsic layout). Empty-section HIDING and
//    the body-edge COLLAPSE can't live here: they key off the host's light-DOM
//    children, and a shadow stylesheet's :host(:has(…)) does NOT match on those
//    (engine limitation), so they live in the EXTERNAL sheet as
//    a-card:not(:has(> [slot="…"]))::part(…) / a-card:has(…)::part(body). See
//    a-card.css. (:has matches an ELEMENT child, so a body must be an element — the
//    <Card> wrapper wraps a string body in <a-text>; bare text isn't detected.)
//  • Padding ownership (enforced by those external collapse rules): a present
//    header owns its padding — top = the card's top inset (--card-padding), bottom
//    = the header→body gap, deliberately HALF (--card-padding / 2) so the title
//    sits closer to its body; a present footer owns its full padding (bottom = the
//    card's bottom inset, top = the gap from the body); the BODY only fills the
//    edges a neighbour left open (drops top under a header, bottom above a footer).
//    So no gap ever doubles. Media is full-bleed, not a section.
//  • There is no actions slot: a caller lays out anything (buttons, tags) inside
//    the header itself.
//  • The sections carry LAYOUT only (box + padding), never typography — a-card
//    stylizes only its own surface, so slotted text renders at its regular
//    inherited style. Typography comes from the nested component: the <Card>
//    wrapper wraps a string header in <Title> and a string body in <Text>, and a
//    raw <a-card> author slots their own <a-title> / <a-text>.
const SHADOW_STYLE = `
  .container {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-width: 0;
    color: inherit;
    text-decoration: none;
    cursor: default;
    border-radius: var(--card-radius, 8px);
    -webkit-user-drag: none;
  }
  :host([media-position="bottom"]) .container { flex-direction: column-reverse; }
  :host([media-position="left"]) .container { flex-direction: row; }
  :host([media-position="right"]) .container { flex-direction: row-reverse; }

  :host([href]) .container { user-select: none; }
  :host([href]:not([loading])) .container { cursor: pointer; }

  .container:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 1px transparent, inset 0 0 0 2px var(--focus-ring);
  }

  [part="media"] { display: block; }
  :host([media-position="left"]) [part="media"],
  :host([media-position="right"]) [part="media"] { flex: none; }

  .content {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    /* Base type for the content zone, matching the body <a-text> at this size. The
       title / subtitle / body all set their own font, so this changes nothing
       visible — it defines the em/ch base so the header gap (in ch) resolves against
       the body's type size. */
    font-size: var(--card-content-fs, 15px);
    line-height: var(--card-content-lh, 20px);
  }

  .header {
    display: flex;
    align-items: center;
    gap: 1ch;
    padding: var(--card-padding, 12px);
    padding-block-start: calc(var(--card-padding, 12px) - var(--card-header-nudge, 1px));
    padding-block-end: calc(var(--card-padding, 12px) / 2);
  }
  slot[name="icon"] {
    flex: none;
    display: flex;
    align-items: center;
    /* Off by default; secondary cards in light multiply the chip into the deeper
       surface (see --card-icon-blend in the external sheet). */
    mix-blend-mode: var(--card-icon-blend, normal);
  }
  slot[name="header"] {
    display: block;
    flex: 1 1 auto;
    min-width: 0;
  }
  slot[part="body"] {
    display: block;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    padding: var(--card-padding, 12px);
  }
  slot[name="footer"] {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-start;
    padding: var(--card-padding, 12px);
  }

  :host([selected]) .container { box-shadow: inset 0 0 0 2px var(--card-selected-ring, var(--focus-ring)); }
  :host([selected]) .container:focus-visible { box-shadow: inset 0 0 0 1px transparent, inset 0 0 0 2px var(--focus-ring); }

  :host([loading]) .container { pointer-events: none; }
  @media (prefers-reduced-motion: no-preference) {
    :host([loading]) [part="content"] { animation: card-pulse 1.4s ease-in-out infinite; }
  }
  @keyframes card-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
`

export class ACardElement extends HTMLElementBase {
  static observedAttributes = ['href', 'target', 'rel', 'ping', 'loading', 'aria-label']

  #container: HTMLAnchorElement
  #headerSlot: HTMLSlotElement
  #bodySlot: HTMLSlotElement

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = SHADOW_STYLE

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
    shadow.append(style, this.#container)

    // Empty sections hide themselves in pure CSS (:host(:has(…)), see SHADOW_STYLE).
    // The only slot JS left: header / body text feed the link's accessible name, so
    // re-derive it when either changes.
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
