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
 *     <span slot="header">Title</span>      ← default title typography
 *     <a-button slot="actions" …>           ← top-right, siblings of the header
 *     …body… (the default slot)             ← default <Text>-like typography
 *     <span slot="footer"><a-button>…</a-button></span>  ← LEFT-aligned action row
 *   </a-card>
 *
 * Shadow structure — every node carries a `part` so consumers can reach it:
 *
 *   <a part="container">                    ← the box; a live link only with href
 *     <slot name="media" part="media">      ← display:none until filled
 *     <div part="content">                  ← the padded region (media bleeds outside it)
 *       <div class="header-row">            ← display:none until header/actions fill
 *         <slot name="header" part="header">
 *         <slot name="actions" part="actions">
 *       <slot part="body">                  ← the default slot IS the body box
 *       <slot name="footer" part="footer">  ← display:none until filled
 *
 * ## Link mode
 *
 * `.container` is always an `<a>`, but only carries `href` (and `target` / `rel` /
 * `download` / `ping`) — and thus becomes a focusable link — when the host has an
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
 * Nothing on the *host* is mutated from JS. The element only writes shadow-internal
 * nodes (the anchor's `href` / ARIA, the `has-content` classes) and reads the host
 * attributes + slotted text — all reads / shadow writes, never a host or light-DOM
 * mutation. Host attributes (`tone`, `priority`, `size`, `media-position`,
 * `selected`) are pure CSS hooks matched via `:host([…])`.
 */

// Shadow styles, injected verbatim into every <a-card> shadow root — kept
// COMMENT-FREE (it ships + re-injects per instance; see the "no comments inside
// shadow-<style> strings" rule in CLAUDE.md). Rationale lives here instead:
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
//  • Focus is an INSET indicator: 1px border (host) + 1px gap (a transparent inset
//    layer showing the card surface) + 1px --focus-ring, all inside the box.
//  • Region slots are display:none until filled (a slotchange toggles has-content —
//    CSS can't express "slot has assigned nodes"), so empty zones reserve no box.
//    The header slot / body slot / footer slot carry DEFAULT text styles (title /
//    Text-equivalent / muted) so raw <a-card> looks right with zero JSX; a slotted
//    <Title> / <Text> overrides them by setting its own font/colour.
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
    border-radius: var(--card-radius, 10px);
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

  [part="media"] { display: none; }
  [part="media"].has-content { display: block; }
  :host([media-position="left"]) [part="media"].has-content,
  :host([media-position="right"]) [part="media"].has-content { flex: none; }

  .content {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    gap: var(--card-gap, 8px);
    padding: var(--card-padding, 16px);
  }

  .header-row { display: none; }
  .header-row.has-content {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  slot[name="header"] { display: none; }
  slot[name="header"].has-content {
    display: block;
    flex: 1 1 auto;
    min-width: 0;
    font-size: 16px;
    font-weight: 560;
    line-height: 22px;
    color: var(--card-title, var(--text-1));
  }

  slot[name="actions"] { display: none; }
  slot[name="actions"].has-content {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: none;
  }

  slot[part="body"] {
    display: block;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    font-size: 15px;
    line-height: 20px;
    color: var(--card-text, var(--text-2));
  }

  slot[name="footer"] { display: none; }
  slot[name="footer"].has-content {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-start;
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
  #mediaSlot: HTMLSlotElement
  #headerRow: HTMLDivElement
  #headerSlot: HTMLSlotElement
  #actionsSlot: HTMLSlotElement
  #bodySlot: HTMLSlotElement
  #footerSlot: HTMLSlotElement

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = SHADOW_STYLE

    // The box + the (inert-until-href) link, in one node.
    this.#container = document.createElement('a')
    this.#container.className = 'container'
    this.#container.setAttribute('part', 'container')

    this.#mediaSlot = document.createElement('slot')
    this.#mediaSlot.name = 'media'
    this.#mediaSlot.setAttribute('part', 'media')

    const content = document.createElement('div')
    content.className = 'content'
    content.setAttribute('part', 'content')

    this.#headerRow = document.createElement('div')
    this.#headerRow.className = 'header-row'

    this.#headerSlot = document.createElement('slot')
    this.#headerSlot.name = 'header'
    this.#headerSlot.setAttribute('part', 'header')

    this.#actionsSlot = document.createElement('slot')
    this.#actionsSlot.name = 'actions'
    this.#actionsSlot.setAttribute('part', 'actions')

    // The default (unnamed) slot IS the body box (slot-is-the-box).
    this.#bodySlot = document.createElement('slot')
    this.#bodySlot.setAttribute('part', 'body')

    this.#footerSlot = document.createElement('slot')
    this.#footerSlot.name = 'footer'
    this.#footerSlot.setAttribute('part', 'footer')

    this.#headerRow.append(this.#headerSlot, this.#actionsSlot)
    content.append(this.#headerRow, this.#bodySlot, this.#footerSlot)
    this.#container.append(this.#mediaSlot, content)
    shadow.append(style, this.#container)

    // CSS can't express "slot has assigned nodes", so an empty zone is
    // display:none'd via a shadow-internal class toggled on slotchange. The
    // header row also hides when BOTH header and actions are empty. Header / body
    // text feed the link's accessible name, so re-derive it when they change.
    this.#mediaSlot.addEventListener('slotchange', () => this.#syncHasContent())
    this.#footerSlot.addEventListener('slotchange', () => this.#syncHasContent())
    this.#actionsSlot.addEventListener('slotchange', () => this.#syncHasContent())
    this.#headerSlot.addEventListener('slotchange', () => {
      this.#syncHasContent()
      this.#syncName()
    })
    this.#bodySlot.addEventListener('slotchange', () => this.#syncName())
  }

  connectedCallback() {
    this.#syncHasContent()
    this.#syncLink()
  }

  attributeChangedCallback() {
    // Every observed attribute (href / target / rel / download / ping / loading /
    // aria-label) feeds the link + its name — a single cheap re-sync covers all.
    this.#syncLink()
  }

  /** Toggle the per-zone `has-content` classes (empty zones reserve no box). */
  #syncHasContent() {
    const set = (el: HTMLElement, has: boolean) => el.classList.toggle('has-content', has)
    set(this.#mediaSlot, this.#mediaSlot.assignedNodes().length > 0)
    set(this.#footerSlot, this.#footerSlot.assignedNodes().length > 0)
    const header = this.#headerSlot.assignedNodes().length > 0
    const actions = this.#actionsSlot.assignedNodes().length > 0
    set(this.#headerSlot, header)
    set(this.#actionsSlot, actions)
    set(this.#headerRow, header || actions)
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
