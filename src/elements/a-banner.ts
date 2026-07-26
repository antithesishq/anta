import { HTMLElementBase, parseOpenState } from '../anta_helpers'
import './a-banner.css'

/**
 * `<a-banner>` — a full-width, dismissible message strip (borderless by default;
 * opt into a rule via `border-bottom-width` / `border-width`, the Progress pattern).
 *
 * A close cousin of `<a-card>`: the same toned surface vocabulary, but laid out
 * as a single horizontal bar of *small* content rather than a stacked panel. The
 * content row is centered, and (when closable) a ✕ button fills the right edge (glyph centered).
 *
 * Light-DOM composition (what the `<Banner>` wrapper emits, or a vanilla author
 * writes by hand) is slot-based:
 *
 *   <a-banner>
 *     <a-banner-message slot="message">Heads up…</a-banner-message>  ← leading message
 *     …children… (the default slot)                                  ← middle, between message + actions
 *     <span slot="actions"><a-button>…</a-button></span>             ← trailing action row
 *     <a-button slot="close" data-custom-event="dismissrequest" …>   ← ✕ (wrapper-owned)
 *   </a-banner>
 *
 * Shadow structure — the host itself is the centered bar (no wrapper element); the
 * slots are its flex items, each carrying a `part`:
 *
 *   :host  (the light-DOM <a-banner>, styled `display: flex` in a-banner.css)
 *     <slot name="message" part="message"> ← display:contents (message nodes ARE flex items)
 *     <slot part="content">                ← the default slot; display:contents (middle content)
 *     <slot name="actions" part="actions"> ← a flex row of trailing controls
 *     <slot name="close" part="close">     ← the ✕, a 40px-wide full-height strip on the right edge (glyph centered)
 *
 * The bar layout (flex, centering, gap, min-height, padding) lives on the HOST in
 * a-banner.css — not a shadow wrapper — so it paints before upgrade and consumers
 * can override it in plain CSS. The message / content slots are `display: contents`,
 * so their projected nodes are direct flex items of the host and centering + `gap`
 * treat them uniformly; an empty slot contributes nothing. The close slot is
 * absolutely positioned, so it's out of flow and never knocks the group off-center.
 *
 * ## Visibility — the `state` contract (mirrors `<a-dialog>` / `<a-expander>`)
 *
 * - **Uncontrolled** (no `state` attribute): the element owns visibility.
 *   `default-state="open"` seeds it (read once at connect; a banner is shown by
 *   default). Clicking ✕ dismisses it.
 * - **Controlled** (`state="open"|"closed"` present): the attribute is the single
 *   source of truth. ✕ does NOT self-apply; it only dispatches the cancelable
 *   `statechange` event and the consumer answers by updating `state`.
 *
 * Either way, a ✕ dismiss fires **`statechange`** — `cancelable`, *before* it
 * applies anything — with `detail: { next, prev }` in the `'open'|'closed'`
 * vocabulary. The `<Banner>` wrapper presents this as `dismissed` / `onDismiss`
 * (closed = dismissed). See STATEFUL-COMPONENTS.md.
 *
 * ## How a dismissed banner disappears (declarative-DOM safe)
 *
 * The element never mutates the host. Visibility lives OFF the DOM as a custom
 * state via `ElementInternals` (`:state(open)` / `:state(closed)`); the external
 * `a-banner.css` collapses the host with `a-banner:state(closed) { display: none }`
 * (plus the `[state]` / `[default-state]` attribute forms, which catch the
 * pre-upgrade / controlled paint before the element sets the custom state). So the
 * host is reconcilable off the UI thread — the same rule as every other element.
 */

// The ✕ button (an <a-button data-custom-event="dismissrequest">) fires this
// bubbling event on activation — no framework hydration needed. The element turns
// it into a dismiss request. CONTRACT: this string MUST stay in sync with the
// `data-custom-event` the `<Banner>` wrapper sets on its close <Button>
// (src/components/Banner.tsx). Duplicated (not shared) because the wrapper can't
// import this module without pulling in element registration. A banner-specific
// name — NOT a-dialog's `closerequest` — so a Banner nested inside a Dialog
// doesn't also close the dialog when its own ✕ is clicked.
const DISMISS_TRIGGER = 'dismissrequest'

// The host is the flex bar (styled in a-banner.css); the shadow only projects the
// slots. The message / content slots are display:contents so their nodes ARE the
// host's flex items; actions is a nested flex row; close is a 40px-wide, full-height
// ✕ strip on the right edge (its glyph vertically centered).
const SHADOW_STYLE = `
  slot[name="message"], slot:not([name]) { display: contents; }

  slot[name="actions"] {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  slot[name="close"] {
    position: absolute;
    inset-inline-end: 0;
    inset-block: 0;
    display: grid;
    place-items: center;
    /* Dim the ✕ at rest; brighten only when the ✕ itself is hovered or focused
       (not the whole banner) — the a-input dim-actions affordance, scoped tight. */
    opacity: 0.65;
    transition: opacity 150ms ease;
  }
  slot[name="close"]:hover,
  slot[name="close"]:focus-within {
    opacity: 1;
  }
`

type BannerState = 'open' | 'closed'
// Shared open-state parser (a-dialog / a-expander) — one definition of how the
// `open`/`closed` token is read, so the contracts can't drift.
const parseState = parseOpenState

export class ABannerElement extends HTMLElementBase {
  static observedAttributes = ['state']

  // Visibility is held here as a custom state (`:state(open)` / `:state(closed)`),
  // NOT a host attribute — declarative-DOM safe (no host mutation, no reconcile
  // churn). Guarded for engines without attachInternals (no-op there; the banner
  // then simply never self-hides, matching every other element's :state() hook).
  #internals?: ElementInternals

  constructor() {
    super()
    this.#internals = typeof this.attachInternals === 'function' ? this.attachInternals() : undefined
    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = SHADOW_STYLE

    const messageSlot = document.createElement('slot')
    messageSlot.name = 'message'
    messageSlot.setAttribute('part', 'message')

    // The default (unnamed) slot IS the middle content region.
    const contentSlot = document.createElement('slot')
    contentSlot.setAttribute('part', 'content')

    const actionsSlot = document.createElement('slot')
    actionsSlot.name = 'actions'
    actionsSlot.setAttribute('part', 'actions')

    const closeSlot = document.createElement('slot')
    closeSlot.name = 'close'
    closeSlot.setAttribute('part', 'close')

    // The slots project directly under the host (no wrapper element); the host is
    // the flex bar (see a-banner.css).
    shadow.append(style, messageSlot, contentSlot, actionsSlot, closeSlot)

    // The ✕ dispatches DISMISS_TRIGGER on activation; turn it into a dismiss request.
    this.addEventListener(DISMISS_TRIGGER, () => this.#requestDismiss())
  }

  /** Controlled mode: the `state` attribute is present and owns visibility. */
  get #controlled(): boolean {
    return this.hasAttribute('state')
  }

  /** The currently *applied* state (read from the custom state — the source of
   *  truth for what's painted). Reads open until the element has applied a state. */
  get #current(): BannerState {
    return this.#internals?.states.has('closed') ? 'closed' : 'open'
  }

  connectedCallback() {
    this.#applyState(this.#seedState())
  }

  /** The state to apply at connect. Controlled → reflect `state`. Uncontrolled → a
   *  banner is shown by DEFAULT, so seed `open` unless `default-state="closed"` is
   *  explicit. (Unlike a-dialog / a-expander, whose absent default-state means
   *  closed — a banner is the inverse, so it can't share `parseState` for the
   *  uncontrolled seed. A hand-authored `<a-banner>` with no attributes shows.) */
  #seedState(): BannerState {
    if (this.#controlled) return parseState(this.getAttribute('state'))
    return this.getAttribute('default-state') === 'closed' ? 'closed' : 'open'
  }

  attributeChangedCallback(name: string) {
    // `state` is the controlled lever — reflect it (this is also how a controlled
    // banner is re-shown: `state="open"` un-hides it). When removed (controlled →
    // uncontrolled) `#controlled` is false, so skip and keep the applied state.
    if (name === 'state' && this.#controlled) this.#applyState(parseState(this.getAttribute('state')))
  }

  /** Mirror the state to `:state(open)` / `:state(closed)` (idempotent). The
   *  external sheet collapses the host on `:state(closed)`. Off-DOM only. */
  #applyState(state: BannerState) {
    if (!this.#internals) return
    try {
      if (state === 'closed') {
        this.#internals.states.add('closed')
        this.#internals.states.delete('open')
      } else {
        this.#internals.states.add('open')
        this.#internals.states.delete('closed')
      }
    } catch {}
  }

  /** Announce a requested dismiss (cancelable, before applying), then — uncontrolled
   *  and un-vetoed — apply it. Controlled: never self-apply; the consumer answers
   *  via `state`. See STATEFUL-COMPONENTS.md. */
  #requestDismiss() {
    if (this.#current === 'closed') return
    const ok = this.dispatchEvent(
      new CustomEvent('statechange', { cancelable: true, detail: { next: 'closed', prev: 'open' } }),
    )
    if (this.#controlled) return
    if (ok) this.#applyState('closed')
  }
}

export function register_a_banner() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-banner')) {
    customElements.define('a-banner', ABannerElement)
  }
}

// Importing this module registers the element (granular entry point). The barrel
// re-exports it, so importing the barrel registers it too. Idempotent.
register_a_banner()
