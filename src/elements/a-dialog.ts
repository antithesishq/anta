import { HTMLElementBase, parseOpenState } from '../anta_helpers'
import './a-dialog.css'

/**
 * `<a-dialog>` — a modal dialog (and, via `position`, an edge drawer) built on a
 * native `<dialog>` living in this element's **shadow DOM**. The native element
 * gives us the top layer, the focus trap, focus return, the `::backdrop`, and
 * Esc handling for free; this element layers Anta's shared state contract and a
 * few conveniences on top.
 *
 * Light-DOM composition (what the `<Dialog>` wrapper emits, or a vanilla author
 * writes by hand) is slot-based, like `<a-expander>` / `<a-input>`:
 *
 *   <a-dialog>
 *     <h2 slot="header">Title</h2>
 *     …body… (the default slot)
 *     <div slot="footer"><a-button>OK</a-button></div>
 *     <a-button slot="close" data-custom-event="closerequest" …>  ← close button (wrapper-owned)
 *   </a-dialog>
 *
 * Shadow structure — every node carries a `part` so consumers can reach it:
 *
 *   <dialog part="dialog">                 ← the native dialog; flex column when open
 *     <slot name="close" part="close">     ← top-right close button; display:none until filled
 *     <slot name="header" part="header">   ← display:none until filled
 *     <slot part="body">                   ← the default slot IS the scrollable body box
 *     <slot name="footer" part="footer">   ← display:none until filled
 *
 * ## Open state — the `state` contract (mirrors `<a-menu>` / `<a-expander>`)
 *
 * - **Uncontrolled** (no `state` attribute): the element owns its open state.
 *   `default-state="open"` seeds it (read once at connect), and the `name` +
 *   `data-dialog-open` / `data-dialog-close` trigger convenience (below) opens /
 *   closes it. Every dismiss path (Esc, backdrop click, close button) closes it.
 * - **Controlled** (`state="open"|"closed"` present): the attribute is the single
 *   source of truth. Triggers and dismiss paths do NOT self-apply; they only
 *   dispatch the cancelable `statechange` event and the consumer answers by
 *   updating `state`. Reflecting `state` opens/closes the native dialog directly,
 *   with no `statechange` (it's the consumer's own command).
 *
 * Either way, every *user-initiated* transition fires **`statechange`** —
 * `cancelable`, *before* it applies anything — with `detail: { next, prev }` in
 * the `'open'|'closed'` vocabulary. Uncontrolled, a handler vetoes with
 * `preventDefault()`; controlled, `preventDefault()` is moot and not-updating-
 * `state` is the reject.
 *
 * ## Dismiss
 *
 * The three dismiss paths — Esc (native `cancel`), a backdrop click, and the
 * close button (its bubbling `closerequest` event) — all funnel into one
 * `requestClose()`. `persistent` disables the light-dismiss paths (Esc +
 * backdrop) so the dialog only closes via explicit controls — for alert /
 * destructive-confirm dialogs. The close button and programmatic close still
 * work.
 *
 * A backdrop click counts only when the pointer press AND the release both land
 * on the dialog element itself (the backdrop retargets to it). A click on
 * slotted content — including a `Menu` / `Select` popover that overflows the
 * dialog's box — targets that content, not the dialog, so it never dismisses;
 * and a text-selection drag that starts inside and releases on the backdrop
 * doesn't either (the press began on content).
 *
 * A native close the element did NOT route — a `<form method="dialog">` submit,
 * a consumer calling the shadow `<dialog>`'s `close()`, bfcache — is reconciled
 * by a `close` listener so the DOM never drifts from the contract: controlled
 * re-asserts `state` (reopening if still `open`), uncontrolled records the
 * closed intent. Our own closes are flagged (`#programmaticClose`) and skipped —
 * a persistent flag, not a synchronous one, because the native `close` event
 * fires from a queued task.
 *
 * ## Focus
 *
 * On open, initial focus goes to the dialog CONTAINER (it carries `tabindex=-1`),
 * not the first focusable control — so the user Tabs to reach the first control,
 * focus never lands on a destructive button, and it behaves the same with or
 * without a ✕ or any focusable content. The container has an accessible name
 * (the mirrored header text), so a screen reader announces the dialog by title.
 * A consumer that wants a specific control focused instead puts `autofocus` on
 * it — the native dialog honors that and the element skips the container
 * override. The ✕ is the last tab stop (see the slot order). Focus return (to
 * the opener) on close comes from the native `<dialog>`.
 *
 * ## Lifecycle across re-parenting
 *
 * The intended open state lives in `#wantOpen` (JS, not the DOM), so it survives
 * a disconnect → reconnect (a framework moving the node). `disconnectedCallback`
 * force-closes the native dialog to free the top layer without touching that
 * intent; `connectedCallback` restores it. `default-state` seeds the intent only
 * on the FIRST connect — never re-seeding — so re-parenting neither reopens a
 * dialog the user dismissed nor drops a trigger-opened one.
 *
 * ## Triggers (uncontrolled convenience)
 *
 * Set a unique `name`, then any element carrying `data-dialog-open="{name}"`
 * opens it and `data-dialog-close="{name}"` closes it — wired through a document
 * click listener (a READ of the light DOM; no mutation). Active only while
 * uncontrolled: a controlled dialog ignores it (the consumer owns `state`).
 *
 * ## Declarative-DOM safety
 *
 * Nothing on the *host* is ever mutated from JS (the host may be reconciled off
 * the UI thread). `showModal()` / `close()` target the shadow `<dialog>` the
 * element created — its own sanctioned territory — and the trigger listener only
 * reads the light DOM.
 */

// Internal event the close button dispatches (via a-button's `data-custom-event`)
// when activated by click / Enter / Space — no framework hydration needed. The
// element turns it into a close request. CONTRACT: this string MUST stay in sync
// with the `data-custom-event` value the `<Dialog>` wrapper sets on its close
// `<Button>` (src/components/Dialog.tsx). Duplicated rather than shared because
// the wrapper can't import this module without pulling in element registration.
const CLOSE_TRIGGER = 'closerequest'

// Enter / exit transition duration (ms), interpolated into the shadow style's
// `--_dur`. Purely CSS-driven (the exit runs via `allow-discrete`), so no JS
// timer reads it — it's a single source for the two transitions' duration.
const ANIM_MS = 200

// Shadow styles, injected verbatim into every <a-dialog> shadow root — kept
// COMMENT-FREE (it ships + re-injects per instance; see the "no comments inside
// shadow-<style> strings" rule in CLAUDE.md). Rationale lives here instead:
//
//  • :host — display:contents so the host itself contributes no box; the dialog
//    renders in the top layer. a-dialog.css hides the host until :defined to
//    avoid a pre-upgrade flash of the light-DOM children.
//  • dialog — the token values (--dialog-bg / -border / -radius / -shadow /
//    -overlay / …) are DEFINED in a-dialog.css on the host and only REFERENCED
//    here with literal fallbacks, so external CSS (lower specificity than :host)
//    can still override them. The surface is --bg-1 with a composed box-shadow
//    whose first inset layer is the hairline border (drawn inside, so no reflow).
//    display flips to flex when [open] (flex-direction:column stays on the base
//    rule so it survives the exit — see the note there); the UA centers a modal
//    dialog, and the :host([position=…]) rules re-pin it to an edge as a drawer.
//  • enter / exit — opacity + transform transition with `overlay` / `display`
//    on `allow-discrete`, and `@starting-style` so every open starts from the
//    hidden state (fade/scale in). The exit runs because allow-discrete keeps the
//    dialog rendered through the transition after close(). ::backdrop fades its
//    --dialog-overlay the same way. All gated under prefers-reduced-motion.
//  • slots — header / footer / close are display:none until they hold content
//    (toggled via slotchange), so an empty zone reserves no box. The default slot
//    IS the scrollable body (slot-is-the-box). close is absolutely positioned
//    top-right, above the header.
const SHADOW_STYLE = `
  :host { display: contents; }

  dialog {
    --_dur: ${ANIM_MS}ms;

    position: fixed;
    box-sizing: border-box;
    padding: 0;
    border: none;
    max-width: calc(100vw - 2 * var(--dialog-margin, 32px));
    max-height: calc(100dvh - 2 * var(--dialog-margin, 32px));
    width: var(--dialog-width, 480px);
    height: var(--dialog-height, fit-content);
    overflow: visible;
    color: var(--dialog-text, inherit);
    background: var(--dialog-bg, #fff);
    border-radius: var(--dialog-radius, 10px);
    box-shadow: var(--dialog-shadow, inset 0 0 0 1px color-mix(in oklch, black 8%, transparent), 0 10px 38px color-mix(in oklch, black 28%, transparent));

    /* flex-direction lives here, NOT on dialog[open]: on close, display is held
       at flex through the exit fade by allow-discrete, but flex-direction isn't
       a transitioned property, so if it were [open]-scoped it would snap back to
       row the instant [open] drops — reflowing the zones into a row for the whole
       fade-out. Kept on the base rule it's inert while display:none and stays
       column through the exit. */
    flex-direction: column;
  }

  dialog[open] {
    display: flex;
  }

  dialog:focus, dialog:focus-visible { outline: none; }

  dialog::backdrop {
    background: var(--dialog-overlay, color-mix(in oklch, black 40%, transparent));
  }

  :host { --_enter-from: scale(0.97); }
  :host([position="left"]) { --_enter-from: translateX(-100%); }
  :host([position="right"]) { --_enter-from: translateX(100%); }
  :host([position="top"]) { --_enter-from: translateY(-100%); }
  :host([position="bottom"]) { --_enter-from: translateY(100%); }

  @media (prefers-reduced-motion: no-preference) {
    dialog {
      opacity: 0;
      transform: var(--_enter-from);
      transition:
        opacity var(--_dur) ease,
        transform var(--_dur) ease,
        overlay var(--_dur) ease allow-discrete,
        display var(--_dur) ease allow-discrete;
    }
    dialog[open] {
      opacity: 1;
      transform: none;
    }
    @starting-style {
      dialog[open] { opacity: 0; transform: var(--_enter-from); }
    }

    dialog::backdrop {
      background: transparent;
      transition:
        background var(--_dur) ease,
        overlay var(--_dur) ease allow-discrete,
        display var(--_dur) ease allow-discrete;
    }
    dialog[open]::backdrop { background: var(--dialog-overlay, color-mix(in oklch, black 40%, transparent)); }
    @starting-style {
      dialog[open]::backdrop { background: transparent; }
    }
  }

  :host([position="left"]) dialog,
  :host([position="right"]) dialog {
    width: var(--dialog-width, 380px);
    max-width: calc(100vw - var(--dialog-margin, 32px));
    height: var(--dialog-height, 100dvh);
    max-height: 100dvh;
    border-radius: 0;
  }
  :host([position="left"]) dialog { margin: 0 auto 0 0; }
  :host([position="right"]) dialog { margin: 0 0 0 auto; }

  :host([position="top"]) dialog,
  :host([position="bottom"]) dialog {
    width: var(--dialog-width, 100vw);
    max-width: 100vw;
    height: var(--dialog-height, fit-content);
    max-height: calc(100dvh - var(--dialog-margin, 32px));
    border-radius: 0;
  }
  :host([position="top"]) dialog { margin: 0 auto auto auto; }
  :host([position="bottom"]) dialog { margin: auto auto 0 auto; }

  :host([position="fullscreen"]) dialog {
    width: 100vw;
    max-width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    margin: 0;
    border-radius: 0;
  }

  slot[name="header"] {
    display: none;
    flex: 0 0 auto;
    padding: var(--dialog-header-padding, 18px 20px 8px);
    font-size: 17px;
    font-weight: 560;
    line-height: 24px;
  }
  slot[name="header"].has-content { display: block; }

  slot[part="body"] {
    display: block;
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: var(--dialog-body-padding, 8px 20px 12px);
  }

  slot[name="footer"] {
    display: none;
    flex: 0 0 auto;
    padding: var(--dialog-footer-padding, 8px 20px 18px);
  }
  slot[name="footer"].has-content {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    align-items: center;
    flex-wrap: wrap;
  }

  slot[name="close"] { display: none; }
  slot[name="close"].has-content {
    display: block;
    position: absolute;
    inset-block-start: 10px;
    inset-inline-end: 10px;
    z-index: 1;
  }
`

type DialogState = 'open' | 'closed'

export class ADialogElement extends HTMLElementBase {
  static observedAttributes = ['state', 'name']

  private dialog: HTMLDialogElement
  private headerSlot: HTMLSlotElement
  private footerSlot: HTMLSlotElement
  private closeSlot: HTMLSlotElement
  // Set before every `dialog.close()` WE initiate, and consumed by the `close`
  // listener. The native `close` event fires from a queued task (async), so a
  // synchronous "applying" guard can't span it — this persistent flag can. It
  // lets the `close` handler tell our own closes (ignore) from an out-of-band
  // one — `<form method="dialog">`, a consumer calling the shadow dialog's
  // close(), bfcache — which it must reconcile.
  #programmaticClose = false
  // The intended (uncontrolled) open state, held in JS so it survives a
  // disconnect → reconnect (a DOM move / re-parent). disconnectedCallback
  // force-closes the native dialog to free the top layer, but must not lose
  // whether the user had it open — otherwise a re-parented open dialog would
  // vanish (trigger-opened) or a re-parented closed one would pop back (a stale
  // `default-state="open"` re-seeding). Only ever reflects genuine open/close
  // intent, never the disconnect teardown.
  #wantOpen = false
  // default-state is read ONCE (the first connect), never again — re-seeding on
  // every connect would reopen a dialog the user has since closed.
  #seeded = false
  // Whether the current pointer press began on the backdrop (the dialog element
  // itself), so a press-inside → release-on-backdrop drag (text selection) is
  // NOT read as a backdrop dismiss.
  #pressedBackdrop = false
  // The document click listener wired for the `name`-trigger convenience, kept so
  // it can be torn down (and re-wired when `name` / controlled-ness changes).
  #triggerListener?: (e: Event) => void

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = SHADOW_STYLE

    this.dialog = document.createElement('dialog')
    this.dialog.setAttribute('part', 'dialog')
    // Programmatically focusable so we can land initial focus on the container
    // itself (see #open) — not in the tab order otherwise.
    this.dialog.tabIndex = -1

    this.closeSlot = document.createElement('slot')
    this.closeSlot.name = 'close'
    this.closeSlot.setAttribute('part', 'close')

    this.headerSlot = document.createElement('slot')
    this.headerSlot.name = 'header'
    this.headerSlot.setAttribute('part', 'header')

    // The default (unnamed) slot IS the scrollable body box (slot-is-the-box).
    const bodySlot = document.createElement('slot')
    bodySlot.setAttribute('part', 'body')

    this.footerSlot = document.createElement('slot')
    this.footerSlot.name = 'footer'
    this.footerSlot.setAttribute('part', 'footer')

    // CSS can't express "slot has assigned nodes", so toggle a class per zone —
    // an empty header / footer / close slot then reserves no box.
    for (const slot of [this.headerSlot, this.footerSlot, this.closeSlot]) {
      slot.addEventListener('slotchange', () =>
        slot.classList.toggle('has-content', slot.assignedNodes().length > 0),
      )
    }
    // Mirror the header text into the shadow dialog's aria-label so screen
    // readers announce the dialog by its title (IDREFs can't cross the shadow
    // boundary to reference the slotted header). Same approach as a-input's
    // label → control aria-label mirror; the dialog is shadow-internal, so this
    // is not a host / light-DOM mutation.
    this.headerSlot.addEventListener('slotchange', () => this.#syncAccessibleName())

    // Close slot is appended LAST so the ✕ is the LAST tab stop, not the first —
    // Tab from the container (see #open) reaches content controls first, the ✕
    // last. It's positioned top-right by CSS regardless of DOM order.
    this.dialog.append(this.headerSlot, bodySlot, this.footerSlot, this.closeSlot)
    shadow.append(style, this.dialog)

    // Esc → native `cancel` (cancelable). Always preventDefault so the UA never
    // auto-closes; route through the request flow so the contract + `persistent`
    // gate decide (uncontrolled → #close(); controlled → just announces).
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault()
      if (!this.#persistent) this.requestClose()
    })

    // Backdrop dismiss: only when BOTH the press and the release land on the
    // dialog element itself. Backdrop hits retarget to the dialog; a click on
    // slotted content (including a Menu / Select popover that overflows the
    // dialog box) targets that content, so it never closes. Tracking the press
    // origin also stops a text-selection drag that starts inside and releases on
    // the backdrop from dismissing.
    this.dialog.addEventListener('pointerdown', (e) => {
      this.#pressedBackdrop = e.target === this.dialog
    })
    this.dialog.addEventListener('click', (e) => {
      if (this.#persistent) return
      if (this.#pressedBackdrop && e.target === this.dialog) this.requestClose()
    })

    // A native close that bypassed our flow (`<form method="dialog">`, a consumer
    // calling the shadow dialog's `close()`, bfcache) would drift the DOM from
    // the contract. Reconcile: controlled → re-assert `state` (the source of
    // truth — reopens if still `open`); uncontrolled → record the closed intent.
    this.dialog.addEventListener('close', () => {
      if (this.#programmaticClose) {
        this.#programmaticClose = false
        return
      }
      if (this.#controlled) this.#reflect(parseOpenState(this.getAttribute('state')))
      else this.#wantOpen = false
    })

    // The close button (an <a-button data-custom-event="closerequest"> slotted at
    // `close`) fires CLOSE_TRIGGER on activation; turn it into a close request.
    this.addEventListener(CLOSE_TRIGGER, () => this.requestClose())
  }

  connectedCallback() {
    if (this.#controlled) {
      this.#reflect(parseOpenState(this.getAttribute('state')))
    } else {
      // Seed the intended open state from `default-state` on the FIRST connect
      // only; thereafter `#wantOpen` (which survives a disconnect) is the truth,
      // so a re-parent restores exactly what the user last had — no re-seeding.
      if (!this.#seeded) {
        this.#wantOpen = parseOpenState(this.getAttribute('default-state')) === 'open'
        this.#seeded = true
      }
      if (this.#wantOpen) this.#open()
    }
    this.#syncTriggerListener()
    this.#syncAccessibleName()
  }

  disconnectedCallback() {
    this.#teardownTriggerListener()
    // Leaving the DOM while open would strand the top-layer entry; close quietly.
    // Flag it as ours so the async `close` event doesn't clear `#wantOpen` — a
    // re-parent must restore the open state on reconnect. Close directly (not via
    // #close(), which would zero `#wantOpen`).
    if (this.dialog.open) {
      this.#programmaticClose = true
      this.dialog.close()
    }
  }

  attributeChangedCallback(name: string) {
    if (name === 'state') {
      // `state` is the controlled lever — reflect it. When it's REMOVED
      // (controlled → uncontrolled) `#controlled` is false, so skip: the current
      // open state is kept, not reset.
      if (this.#controlled) this.#reflect(parseOpenState(this.getAttribute('state')))
      this.#syncTriggerListener()
    } else if (name === 'name') {
      this.#syncTriggerListener()
    }
  }

  /** Controlled mode: the `state` attribute is present and owns the open state. */
  get #controlled(): boolean {
    return this.hasAttribute('state')
  }

  /** Light-dismiss (Esc + backdrop) disabled — the dialog closes only via
   *  explicit controls (close button / programmatic). */
  get #persistent(): boolean {
    return this.hasAttribute('persistent')
  }

  /** The currently *applied* open state (read from the native dialog — the
   *  source of truth for what's painted). */
  get #current(): DialogState {
    return this.dialog.open ? 'open' : 'closed'
  }

  /** Public imperative API — mirrors `<dialog>`. `show()` requests open,
   *  `close()` requests close; both honor the state contract. */
  show() {
    this.requestOpen()
  }
  close() {
    this.requestClose()
  }
  get open(): boolean {
    return this.dialog.open
  }

  /** Announce a requested OPEN (cancelable, before applying), then — uncontrolled
   *  and un-vetoed — apply it. Controlled: never self-apply. */
  requestOpen() {
    if (this.#current === 'open') return
    const ok = this.#announce('open')
    if (this.#controlled) return
    if (ok) this.#open()
  }

  /** Announce a requested CLOSE (cancelable, before applying), then — uncontrolled
   *  and un-vetoed — apply it. Controlled: never self-apply. */
  requestClose() {
    if (this.#current === 'closed') return
    const ok = this.#announce('closed')
    if (this.#controlled) return
    if (ok) this.#close()
  }

  /** Dispatch the cancelable `statechange` for a requested transition. Returns
   *  false if a handler vetoed it. */
  #announce(next: DialogState): boolean {
    return this.dispatchEvent(
      new CustomEvent('statechange', {
        cancelable: true,
        detail: { next, prev: this.#current },
      }),
    )
  }

  /** Reflect a controlled `state` onto the native dialog (idempotent). No
   *  `statechange` — this is the consumer's own command, not a user gesture. */
  #reflect(state: DialogState) {
    if (state === 'open') this.#open()
    else this.#close()
  }

  /** Raw open: show the modal dialog. Records the open intent (survives a
   *  disconnect). Guarded against a not-connected / already-open native element
   *  (both throw / no-op). */
  #open() {
    this.#wantOpen = true
    // showModal() fires neither `close` nor `cancel`, so no suppression is needed.
    if (this.dialog.open || !this.isConnected) return
    this.dialog.showModal()
    // showModal() lands initial focus on the first focusable descendant (the ✕
    // or a footer button — possibly destructive). Override to focus the dialog
    // CONTAINER instead, so the user tabs to reach the first control and a
    // screen reader announces the dialog + its name on open (WAI-ARIA's safe
    // default). A consumer that wants a specific control focused puts `autofocus`
    // on it — native honors that during showModal(), so we leave it be.
    if (!this.querySelector('[autofocus]')) this.dialog.focus()
  }

  /** Raw close. Records the closed intent and flags the pending `close` event as
   *  ours so the listener doesn't reconcile it. (The disconnect teardown closes
   *  the native dialog directly, NOT through here, to preserve `#wantOpen`.) */
  #close() {
    this.#wantOpen = false
    if (!this.dialog.open) return
    this.#programmaticClose = true
    this.dialog.close()
  }

  /** Publish the header text as the shadow dialog's accessible name (a-input's
   *  label-mirror pattern). Shadow-internal — not a host / light-DOM write. */
  #syncAccessibleName() {
    const text = this.headerSlot
      .assignedNodes()
      .map((n) => n.textContent ?? '')
      .join(' ')
      .trim()
    if (text) this.dialog.setAttribute('aria-label', text)
    else this.dialog.removeAttribute('aria-label')
  }

  // --- `name`-trigger convenience (uncontrolled only) ---

  #syncTriggerListener() {
    const wanted = !this.#controlled && !!this.getAttribute('name')
    if (wanted && !this.#triggerListener) this.#wireTriggerListener()
    else if (!wanted && this.#triggerListener) this.#teardownTriggerListener()
  }

  #wireTriggerListener() {
    this.#triggerListener = (e: Event) => {
      const name = this.getAttribute('name')
      if (!name) return
      const t = e.target
      if (!(t instanceof Element)) return
      if (t.closest(`[data-dialog-open="${CSS.escape(name)}"]`)) this.requestOpen()
      else if (t.closest(`[data-dialog-close="${CSS.escape(name)}"]`)) this.requestClose()
    }
    this.doc.addEventListener('click', this.#triggerListener)
  }

  #teardownTriggerListener() {
    if (this.#triggerListener) {
      this.doc.removeEventListener('click', this.#triggerListener)
      this.#triggerListener = undefined
    }
  }
}

export function register_a_dialog() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-dialog')) {
    customElements.define('a-dialog', ADialogElement)
  }
}

// Importing this module registers the element (granular entry point). The barrel
// re-exports it, so importing the barrel registers it too. Idempotent.
register_a_dialog()
