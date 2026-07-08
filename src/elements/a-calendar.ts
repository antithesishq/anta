import { HTMLElementBase } from '../anta_helpers'
import { Temporal } from 'temporal-polyfill'
import './a-calendar.css'

/**
 * `<a-calendar>` — a **light-DOM, form-associated** month grid, and the
 * **interaction authority** for it. It is the grid itself (`a-calendar.css` gives
 * it a flat 7-column CSS grid), owns the form value, and **dispatches the
 * selection and navigation events** — so it works for a vanilla consumer, not
 * only through the JSX wrapper.
 *
 * It does **not** build or mutate its own contents — that would break the
 * no-UI-thread-DOM-mutation rule (app DOM may render off a worker). Whoever
 * renders into it (the `Calendar` JSX wrapper, or a vanilla consumer using the
 * exported `buildMonth` engine) fills it with `<a-button>` day cells + weekday
 * headers and *re-renders* on the element's events. The element confines itself
 * to off-DOM work (form value, `ElementInternals` state), event dispatch, and
 * imperative focus of cells that already exist — the `<a-radio-group>` model.
 *
 * ## Events (all bubble; lowercase so React + Preact bind them)
 *
 * - `statechange` — cancelable, fired BEFORE a pick applies. `detail` is
 *   `{ next, prev, reason }`: ISO-string dates (or `null`), `reason` ∈
 *   `'user' | 'reset' | 'restore'`. `preventDefault()` vetoes a `'user'` pick in
 *   uncontrolled mode.
 * - `change` — fired AFTER a selection applies (uncontrolled), and on
 *   reset/restore.
 * - `navigate` — `detail: { date }` (ISO). Fired on keyboard navigation (and
 *   when the target month isn't rendered) so the renderer can move the roving tab
 *   stop and flip the displayed month.
 *
 * ## Controlled vs uncontrolled (like `<a-radio-group>`)
 *
 * Presence of the **`value`** attribute = controlled: a pick only *requests* a
 * change (fires `statechange`); the consumer answers by updating `value`. With
 * **`defaultvalue`** instead, the element owns selection — a pick self-applies
 * (form value + `change`) unless vetoed.
 *
 * ## Selection & keyboard
 *
 * Day cells are `<a-button>`s, so a click (and Enter/Space, which `<a-button>`
 * turns into a click) bubbles here; the element delegates off `data-part="day-cell"`.
 * Arrow / Home / End / PageUp / PageDown move focus among rendered cells directly,
 * and emit `navigate` for month changes. `data-focus` (`"<iso>#<nonce>"`, set by
 * the renderer) focuses a cell after a re-render lands a new month.
 */
export class ACalendarElement extends HTMLElementBase {
  static formAssociated = true
  static observedAttributes = ['value', 'data-focus']

  private internals?: ElementInternals
  /** Selection in uncontrolled mode (controlled reads the `value` attribute). */
  private selectedIso: string | null = null

  constructor() {
    super()
    try {
      this.internals = this.attachInternals?.()
    } catch (err) {
      console.warn('a-calendar: ElementInternals unavailable — form association disabled.', err)
    }
    this.addEventListener('click', this.onClick)
    this.addEventListener('keydown', this.onKeydown)
  }

  connectedCallback() {
    // A `value` property set before upgrade shadows the accessor — re-apply it.
    if (Object.prototype.hasOwnProperty.call(this, 'value')) {
      const v = (this as unknown as { value: string }).value
      delete (this as unknown as { value?: string }).value
      ;(this as unknown as { value: string }).value = v
    }
    this.selectedIso = this.getAttribute('value') || this.getAttribute('defaultvalue') || null
    this.applyFormValue(this.currentIso())
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null) {
    if (name === 'value') {
      this.applyFormValue(value)
      return
    }
    if (name === 'data-focus') {
      this.focusCell(value)
    }
  }

  /** Controlled when the `value` attribute is present (the renderer sets it only
   *  in controlled mode); otherwise the element owns selection. */
  private get controlled(): boolean {
    return this.hasAttribute('value')
  }
  private currentIso(): string | null {
    return this.controlled ? this.getAttribute('value') || null : this.selectedIso
  }

  private applyFormValue(value: string | null) {
    this.internals?.setFormValue(value || null)
    try {
      if (value) this.internals?.states.add('filled')
      else this.internals?.states.delete('filled')
    } catch {
      /* custom states unsupported */
    }
  }

  // --- Selection ----------------------------------------------------------

  private onClick = (e: MouseEvent) => {
    if (this.hasAttribute('disabled')) return
    const cell = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-part="day-cell"]')
    if (!cell || cell.hasAttribute('disabled')) return
    const iso = cell.dataset.date
    if (iso) this.requestSelect(iso)
  }

  /** Request selecting `iso`: fire cancelable `statechange`; in uncontrolled mode,
   *  if not vetoed, apply the form value and fire `change`. The renderer mirrors
   *  the new selection visually off `statechange`. */
  private requestSelect(iso: string) {
    const prev = this.currentIso()
    if (iso === prev) return
    // Non-bubbling: the wrapper binds `onstatechange` on this element directly, and
    // `a-menu` also uses `statechange` — a bubbling one would reach an ancestor menu
    // (e.g. inside `InputDate`) and be misread as a menu open/close.
    const proceed = this.dispatchEvent(
      new CustomEvent('statechange', {
        bubbles: false,
        cancelable: true,
        detail: { next: iso, prev, reason: 'user' },
      }),
    )
    if (this.controlled || !proceed) return
    this.selectedIso = iso
    this.applyFormValue(iso)
    this.dispatchEvent(new Event('change', { bubbles: true }))
  }

  // --- Keyboard navigation ------------------------------------------------

  private get dayCells(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>('[data-part="day-cell"]'))
  }

  private onKeydown = (e: KeyboardEvent) => {
    if (this.hasAttribute('disabled')) return
    const cells = this.dayCells
    if (cells.length === 0) return
    const focused =
      (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-part="day-cell"]') ??
      cells.find((c) => c.tabIndex === 0) ??
      null
    if (!focused?.dataset.date) return

    let targetIso: string | null = null
    switch (e.key) {
      case 'Home':
      case 'End': {
        // Row edge — by position in the flat grid, so it tracks the locale's
        // week order without re-deriving the first day of week.
        const idx = cells.indexOf(focused)
        if (idx < 0) return
        const rowStart = idx - (idx % 7)
        targetIso = cells[e.key === 'Home' ? rowStart : rowStart + 6]?.dataset.date ?? null
        break
      }
      default: {
        const cur = Temporal.PlainDate.from(focused.dataset.date)
        let next: Temporal.PlainDate
        switch (e.key) {
          case 'ArrowLeft': next = cur.subtract({ days: 1 }); break
          case 'ArrowRight': next = cur.add({ days: 1 }); break
          case 'ArrowUp': next = cur.subtract({ days: 7 }); break
          case 'ArrowDown': next = cur.add({ days: 7 }); break
          case 'PageUp': next = cur.add({ [e.shiftKey ? 'years' : 'months']: -1 }); break
          case 'PageDown': next = cur.add({ [e.shiftKey ? 'years' : 'months']: 1 }); break
          default: return // Enter/Space → the day button's native activation (→ click)
        }
        targetIso = next.toString()
      }
    }
    if (!targetIso) return
    e.preventDefault()
    // Focus the target now if it's a rendered, enabled cell (the no-wrapper path);
    // otherwise the navigate handler re-renders that month and `data-focus` lands it.
    const cell = cells.find((c) => c.dataset.date === targetIso)
    if (cell && !cell.hasAttribute('disabled')) cell.focus()
    this.dispatchEvent(new CustomEvent('navigate', { bubbles: true, detail: { date: targetIso } }))
  }

  // --- Focus signal -------------------------------------------------------

  /** Focus the day cell whose `data-date` matches the signal's ISO. Deferred to a
   *  microtask so a just-rendered new month has committed. Signal: `"<iso>#<nonce>"`. */
  private focusCell(signal: string | null) {
    if (!signal) return
    const iso = signal.split('#')[0]
    queueMicrotask(() => {
      this.querySelector<HTMLElement>(`[data-date="${iso}"]`)?.focus()
    })
  }

  // --- Public value API + form callbacks ----------------------------------

  private emitState(next: string | null, prev: string | null, reason: 'reset' | 'restore') {
    // Non-bubbling — see requestSelect (avoid colliding with an ancestor a-menu).
    this.dispatchEvent(
      new CustomEvent('statechange', { bubbles: false, detail: { next, prev, reason } }),
    )
    this.dispatchEvent(new Event('change', { bubbles: true }))
  }

  /** The selected date as an ISO string (`''` when empty). */
  get value(): string {
    return this.currentIso() ?? ''
  }
  set value(v: string) {
    this.selectedIso = v || null
    this.applyFormValue(v || null)
  }
  /** Form field name — mirrors the `name` attribute, like native `<input>.name`. */
  get name(): string {
    return this.getAttribute('name') ?? ''
  }

  formResetCallback() {
    const def = this.getAttribute('defaultvalue') || null
    const prev = this.currentIso()
    this.selectedIso = def
    this.applyFormValue(def)
    this.emitState(def, prev, 'reset')
  }
  formStateRestoreCallback(state: string) {
    const prev = this.currentIso()
    this.selectedIso = state || null
    this.applyFormValue(state || null)
    this.emitState(state || null, prev, 'restore')
  }
}

export function register_a_calendar() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-calendar')) {
    customElements.define('a-calendar', ACalendarElement)
  }
}

// Importing this module registers the element (granular entry point). The
// barrel re-exports it, so importing the barrel registers it too. Idempotent.
register_a_calendar()
