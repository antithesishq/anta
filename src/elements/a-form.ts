import { HTMLElementBase, isComposingKey } from '../anta_helpers'
import './a-form.css'

// ─────────────────────────────────────────────────────────────────────────────
// <a-form> — the behavior around a native <form>.
//
// Light DOM, no shadow root: `<a-form><form>…fields…</form></a-form>`. The
// native form stays the form. It owns the fields, validation, `FormData`, and
// the `submit` event, and Button finds it with `closest('form')` as before.
// A shadow `<form>` around a slot would not own slotted fields, so the form
// has to be a light-DOM child.
//
// `a-form.css` lays out the fields of `a-form > form` and of a plain
// `form[data-anta]` the same way. A plain `form[data-anta]` gets that layout
// and nothing from this element.
//
//   submit-hotkey="mod+enter"  Ctrl+Enter or Cmd+Enter in a field activates
//                              the form's primary submit <a-button>. A form
//                              without one ignores the chord.
//   submit-hotkey="enter"      Enter in a single-line <a-input> activates the
//                              form's first submit button, native or Anta.
//                              With no submit button, Enter submits only a
//                              form that has one text field.
//   sticky-actions             CSS only. See a-form.css.
//
// Without `submit-hotkey` no key submits. A space-separated list turns on both.
// The key listeners run in the bubble phase on this element, so a field, a
// popup, or an application handler inside the form that calls
// `preventDefault()` on the keydown goes first and keeps the key. A focused
// radio or Button does that, with or without a modifier. An unavailable button
// is left alone.
//
// Enter acts when the key is released, as Button's own key activation does.
// By then the field has fired `change`, which a native form also delivers
// before `submit`, and no part of the key press is left for an element that a
// submit handler focuses. The chord acts on keydown and cancels the key,
// because macOS sends no keyup for Enter while Cmd is held. The focused
// field's `change` then follows on blur, after `submit`.
//
// Fields glide when the number of grid columns changes. The glide plays a Web
// Animation on the form's direct Anta children; it writes no attribute and no
// inline style. It is off under reduced motion.
//
// THE INVARIANT: this element never writes attributes or DOM.
// ─────────────────────────────────────────────────────────────────────────────

type Place = readonly [x: number, y: number]

const SUBMIT_BUTTONS = 'a-button[type="submit"], button, input[type="submit"], input[type="image"]'
/** Native input types that take part in implicit submission. */
const TEXT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'date', 'month', 'week', 'time', 'datetime-local', 'number'])
/** Limit animation to these direct children of the form. */
const GLIDES = 'a-input, a-input-time, a-radio-group, a-checkbox, a-switch, a-slider, a-button, a-box, button[data-anta]'
const GLIDE = { duration: 240, easing: 'cubic-bezier(0.2, 0, 0, 1)', composite: 'add' } as const

/** The form an element belongs to in its own tree: the one its `form`
 *  attribute names, or its closest form ancestor. */
function formOf(el: Element): HTMLFormElement | null {
  const id = el.getAttribute('form')
  const candidate = id === null
    ? el.closest('form')
    : (el.getRootNode() as Document | ShadowRoot).getElementById?.(id)
  return candidate?.namespaceURI === 'http://www.w3.org/1999/xhtml' && candidate.localName === 'form'
    ? candidate as HTMLFormElement
    : null
}

/** The form's submit buttons in tree order, native and Anta alike. A button
 *  outside the form counts when its `form` attribute names it. */
function submitButtons(form: HTMLFormElement): HTMLElement[] {
  const root = form.getRootNode() as Document | ShadowRoot
  return Array.from(root.querySelectorAll<HTMLElement>(SUBMIT_BUTTONS)).filter(el => {
    if (el.localName === 'a-button') return formOf(el) === form
    const native = el as HTMLButtonElement | HTMLInputElement
    return native.form === form && (native.localName === 'input' || native.type === 'submit')
  })
}

function unavailable(button: HTMLElement): boolean {
  // A native button's `:disabled` already follows its fieldset, including the
  // first-legend exemption.
  if (button.localName !== 'a-button') return button.matches(':disabled')
  return button.hasAttribute('disabled') || button.hasAttribute('loading')
    || button.matches(':disabled') || button.closest('fieldset[disabled]') !== null
}

function isSingleLineInput(el: Element): boolean {
  return el.localName === 'a-input' && !el.hasAttribute('multiline') && !el.hasAttribute('rows') && !el.hasAttribute('button')
}

/** How many of the form's fields take part in implicit submission. The filter
 *  field inside a Select's menu is not one of them. */
function textFieldCount(form: HTMLFormElement): number {
  return Array.from(form.elements).filter(el =>
    (isSingleLineInput(el) && !el.closest('a-menu')) || (el.localName === 'input' && TEXT_TYPES.has((el as HTMLInputElement).type)),
  ).length
}

/** A child's layout position in its form, unaffected by a running glide. */
function placeOf(el: Element, form: HTMLElement): Place | null {
  const child = el as HTMLElement
  // No offset parent: not rendered, or fixed like an open popover.
  if (!child.offsetParent) return null
  return child.offsetParent === form
    ? [child.offsetLeft, child.offsetTop]
    : [child.offsetLeft - form.offsetLeft, child.offsetTop - form.offsetTop]
}

/** How many grid columns the form has now. Collapsed `auto-fit` tracks resolve to 0px. */
function columnCount(form: HTMLElement, view: Window): number {
  const tracks = view.getComputedStyle(form).gridTemplateColumns
  return tracks === 'none' ? 1 : tracks.split(' ').filter(track => parseFloat(track) > 0).length
}

export class AFormElement extends HTMLElementBase {
  #observer?: ResizeObserver
  /** The form's column count and where each child sat at the last notification. */
  #seen?: { form: HTMLFormElement; columns: number; places: Map<Element, Place> }
  /** The field whose Enter keydown is waiting for its keyup. */
  #armed?: Element

  /** The native form this element wraps. */
  get #form(): HTMLFormElement | null {
    return this.querySelector<HTMLFormElement>(':scope > form')
  }

  connectedCallback() {
    this.addEventListener('keydown', this.#onKeyDown)
    this.addEventListener('keyup', this.#onKeyUp)
    const view = this.ownerDocument.defaultView
    if (!view || typeof view.ResizeObserver !== 'function') return
    this.#observer = new view.ResizeObserver(this.#onResize)
    // The host is here before its form when the parser upgrades it. Its own
    // first notification picks the form up.
    this.#observer.observe(this)
  }

  disconnectedCallback() {
    this.removeEventListener('keydown', this.#onKeyDown)
    this.removeEventListener('keyup', this.#onKeyUp)
    this.#observer?.disconnect()
    this.#observer = undefined
    this.#seen = undefined
    this.#armed = undefined
  }

  #hotkey(key: string): boolean {
    return (this.getAttribute('submit-hotkey') ?? '').split(/\s+/).includes(key)
  }

  #onKeyDown = (e: KeyboardEvent) => {
    // A held key repeats its keydown. The first one decides.
    if (e.key !== 'Enter' || e.repeat) return
    this.#armed = undefined
    if (e.defaultPrevented || e.altKey || e.shiftKey || isComposingKey(e)) return
    const form = this.#form
    if (!form) return
    // The composed path reaches a field inside a shadow root, which the
    // retargeted `e.target` hides.
    const path = e.composedPath().filter((node): node is Element => (node as Node).nodeType === 1)

    if (e.metaKey || e.ctrlKey) {
      if (!this.#hotkey('mod+enter')) return
      const owner = path.map(formOf).find(Boolean)
      if (owner !== form) return
      const button = submitButtons(form).find(el => el.localName === 'a-button' && el.getAttribute('priority') === 'primary')
      if (!button || unavailable(button)) return
      e.preventDefault()
      button.click()
      return
    }

    if (!this.#hotkey('enter')) return
    // Only the field's own text control, not a button or link slotted into it,
    // and not the filter field inside a Select's menu.
    const field = path.find(el => el.localName === 'a-input')
    if (!field || !isSingleLineInput(field) || path[0]?.getRootNode() !== field.shadowRoot || field.closest('a-menu')) return
    if (formOf(field) !== form) return
    this.#armed = field
  }

  #onKeyUp = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return
    const field = this.#armed
    this.#armed = undefined
    const form = this.#form
    // Only the field the keydown armed. A focus move between press and release
    // cancels, as it does for a button.
    if (!field || !form || !e.composedPath().includes(field) || formOf(field) !== form) return
    const [button] = submitButtons(form)
    if (button) {
      if (!unavailable(button)) button.click()
    } else if (textFieldCount(form) === 1) {
      form.requestSubmit()
    }
  }

  /**
   * A glide runs only when the form's number of columns changed. Keep the
   * previous positions so a column-count change can animate eligible children
   * from their last measured offsets.
   *
   * Nothing glides when children only track their column edge, when a row is
   * pushed down because a hint or label above it wrapped, or when a field grows
   * while someone types.
   */
  #onResize = () => {
    const form = this.#form
    const view = this.ownerDocument.defaultView
    if (!form || !view) { this.#seen = undefined; return }
    // Observing again is a no-op. A form sized on its own also notifies.
    this.#observer?.observe(form)
    if (view.matchMedia('(prefers-reduced-motion: reduce)').matches) { this.#seen = undefined; return }

    const before = this.#seen?.form === form ? this.#seen : undefined
    const columns = columnCount(form, view)
    const places = new Map<Element, Place>()
    for (const el of form.children) {
      const place = el.matches(GLIDES) ? placeOf(el, form) : null
      if (place) places.set(el, place)
    }
    this.#seen = { form, columns, places }
    if (!before || before.columns === columns) return

    for (const [el, [x, y]] of places) {
      const from = before.places.get(el)
      if (!from) continue
      const dx = from[0] - x
      const dy = from[1] - y
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
      // A sticky row is placed by the scroll position, not by the reshuffle.
      if (view.getComputedStyle(el).position === 'sticky') continue
      // Added to the element's own transform, which stays in effect.
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }], GLIDE)
    }
  }
}

export function register_a_form() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-form')) customElements.define('a-form', AFormElement)
}
register_a_form()
