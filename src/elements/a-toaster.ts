import { HTMLElementBase } from '../anta_helpers'
import { TOAST_PLACEMENTS } from '../toaster'
import './a-toaster.css'

/** Placement zones, in the order their `<slot name>` appears in the shadow.
 *  Sourced from the store's `TOAST_PLACEMENTS` so the slots and the
 *  `ToastPlacement` type can't drift (an unmatched placement would render no
 *  toast). `../toaster` is a pure, SSR-safe module — no element code. */
const ZONES = TOAST_PLACEMENTS

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
  #slots: HTMLSlotElement[] = []

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    // The popover surface: full-viewport, click-through, top layer. Only the
    // toasts inside opt back into pointer events through the external child rule.
    this.#region = this.doc.createElement('div')
    this.#region.className = 'region'
    this.#region.setAttribute('part', 'region')
    this.#region.setAttribute('popover', 'manual')

    for (const zone of ZONES) {
      const slot = this.doc.createElement('slot')
      slot.name = zone
      slot.setAttribute('part', `zone ${zone}`)
      // slotchange bubbles to the region; one handler covers every zone.
      this.#region.append(slot)
      this.#slots.push(slot)
    }
    this.#region.addEventListener('slotchange', this.#syncVisibility)

    shadow.append(this.#region)
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

  /** Show the popover while a placement has assigned elements. Unmatched
   * children do not keep an empty region in the top layer. */
  #syncVisibility = () => {
    const region = this.#region as HTMLElement & {
      showPopover?: () => void
      hidePopover?: () => void
    }
    if (typeof region.showPopover !== 'function') return
    const has = this.#slots.some(slot => slot.assignedElements().length > 0)
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

export function register_a_toaster() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-toaster')) {
    customElements.define('a-toaster', AToasterElement)
  }
}

// Importing this module registers the element (granular entry point). The barrel
// re-exports it, so importing the barrel registers it too. Idempotent.
register_a_toaster()
