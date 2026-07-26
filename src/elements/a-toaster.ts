import { HTMLElementBase } from '../anta_helpers'
import './a-toaster.css'

/** Placement zones, in the order their `<slot name>` appears in the shadow. */
const ZONES = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const

/**
 * `<a-toaster>` — a viewport-anchored notification region. One instance hosts all
 * six placement zones; each `<a-toast>` routes to a corner/edge by its `slot`
 * attribute (`slot="bottom-right"`, …). The `<Toaster>` wrapper keeps it mounted
 * and renders its `<a-toast>` children through the reconciler; this element only
 * lays them out — it touches its own shadow and reads its children, never a host
 * or light-DOM write.
 *
 * Shadow structure:
 *
 *   <div part="region" popover="manual">   ← top-layer, viewport-covering, click-through
 *     <slot name="top-left">    …           ← one flex column per zone, pinned to its edge
 *     <slot name="bottom-right"> …
 *
 * The region is a `popover` so it renders in the top layer and escapes any
 * transformed / clipping ancestor of wherever `<Toaster>` is mounted. It's shown
 * only while it holds at least one toast (`showPopover`) and hidden when empty
 * (`hidePopover`), so it never sits in the top layer for nothing. Natural
 * top-layer ordering stands: a dialog or menu opened afterward can cover it (by
 * design — toasts don't force themselves above modals).
 */
export class AToasterElement extends HTMLElementBase {
  #region: HTMLElement
  #shown = false

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = SHADOW_STYLE

    // The popover surface: full-viewport, click-through, top layer. Only the
    // toasts inside opt back into pointer events (::slotted below).
    this.#region = document.createElement('div')
    this.#region.className = 'region'
    this.#region.setAttribute('part', 'region')
    this.#region.setAttribute('popover', 'manual')

    for (const zone of ZONES) {
      const slot = document.createElement('slot')
      slot.name = zone
      // slotchange bubbles to the region; one handler covers every zone.
      this.#region.append(slot)
    }
    this.#region.addEventListener('slotchange', this.#syncVisibility)

    shadow.append(style, this.#region)
  }

  connectedCallback() {
    // Children may already be present (the wrapper renders them into the region).
    this.#syncVisibility()
  }

  disconnectedCallback() {
    // The popover goes away with the shadow; drop our own state so a reconnect
    // re-shows cleanly.
    this.#shown = false
  }

  /** Show the region while it holds a toast, hide it when empty. A child count
   *  read + a shadow popover toggle — no host or light-DOM mutation. */
  #syncVisibility = () => {
    const region = this.#region as HTMLElement & {
      showPopover?: () => void
      hidePopover?: () => void
    }
    if (typeof region.showPopover !== 'function') return
    const has = this.childElementCount > 0
    if (has && !this.#shown) {
      if (!this.isConnected) return
      try {
        region.showPopover()
        this.#shown = true
      } catch {
        /* not yet connected / already open — ignore */
      }
    } else if (!has && this.#shown) {
      try {
        if (region.matches(':popover-open')) region.hidePopover!()
      } catch {
        /* already hidden — ignore */
      }
      this.#shown = false
    }
  }
}

// Shadow styles, injected verbatim into every <a-toaster> shadow root — kept
// COMMENT-FREE (it ships + re-injects per instance; see the "no comments inside
// shadow-<style> strings" rule in CLAUDE.md). Rationale:
//
//  • :host is display:contents — the host takes no layout box; the fixed popover
//    region does all the positioning. The tokens (--toaster-*) are defined on the
//    host in a-toaster.css and inherit across the shadow boundary.
//  • .region resets the UA [popover] chrome (border/background/padding) and covers
//    the viewport, click-through. display is set only on :popover-open so the UA
//    `[popover]:not(:popover-open){display:none}` keeps an empty region hidden.
//  • Each zone slot is the flex column itself (slot-is-the-box). Bottom zones use
//    `column` anchored to the bottom (newest sits at the edge, older rise); top
//    zones use `column-reverse` anchored to the top (newest at the edge). Items
//    stretch to the zone width; center zones translate to the middle.
//  • Only the toasts are interactive (::slotted pointer-events:auto).
const SHADOW_STYLE = `
  :host { display: contents; }

  .region {
    position: fixed;
    inset: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    overflow: visible;
    pointer-events: none;
    width: auto;
    height: auto;
  }
  .region:popover-open { display: block; }

  slot {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: var(--toaster-gap, 12px);
    width: min(var(--toaster-width, 380px), calc(100vw - 2 * var(--toaster-inset, 16px)));
    box-sizing: border-box;
    pointer-events: none;
  }

  ::slotted(*) { pointer-events: auto; }

  slot[name^="top-"] { top: var(--toaster-inset, 16px); flex-direction: column-reverse; }
  slot[name^="bottom-"] { bottom: var(--toaster-inset, 16px); flex-direction: column; }
  slot[name$="-left"] { left: var(--toaster-inset, 16px); }
  slot[name$="-right"] { right: var(--toaster-inset, 16px); }
  slot[name$="-center"] { left: 50%; transform: translateX(-50%); }
`

export function register_a_toaster() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-toaster')) {
    customElements.define('a-toaster', AToasterElement)
  }
}

// Importing this module registers the element (granular entry point). The barrel
// re-exports it, so importing the barrel registers it too. Idempotent.
register_a_toaster()
