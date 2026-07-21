/**
 * Shared "activate on key release" for Enter / Space, used by `<a-button>` and
 * `<a-menu-item>` (via one delegated keydown/keyup pair per document).
 *
 * Activation fires on **keyup**, not keydown. This matches the native `<button>`
 * (Space already activates on release), makes activation **cancelable** (move
 * focus between press and release → no fire), and — the reason it's uniform
 * across Enter and Space here — opens a **keydown→keyup gap** so a lazy copy
 * control can refresh its `copy` value between press and release before the write
 * (the keyboard analog of the pointerdown→click gap; see copy-behavior's "Lazy
 * content" note).
 *
 * keydown: `preventDefault()` (stop Space scrolling the page and a link's own
 * native Enter→click), run `preflight(el)` — the copy pre-request — and arm the
 * release. keyup: `activate(el)` only if the same element is still armed.
 *
 * Idempotency is the caller's job (each guards with its own per-document flag);
 * this just wires one keydown/keyup pair.
 */
export interface KeyActivation {
  /** Keys that activate — `['Enter', ' ']` for buttons/menu items. */
  keys: readonly string[]
  /** Resolve the activatable element from the event target (e.g. `closest`). */
  resolve(target: EventTarget | null): HTMLElement | null
  /** Blocked (disabled / loading) — swallow the key without activating. */
  blocked?(el: HTMLElement): boolean
  /** Runs on keydown, before the release: the lazy copy pre-request. */
  preflight?(el: HTMLElement): void
  /** Runs on keyup: the actual activation (a synthesized `click()`). */
  activate(el: HTMLElement): void
}

export function installKeyActivation(doc: Document, config: KeyActivation): void {
  // The element awaiting its keyup. One is enough — a keyboard has one focus.
  let armed: HTMLElement | null = null

  doc.addEventListener(
    'keydown',
    (e) => {
      // Ignore OS key-repeat — holding a key must not queue repeated activations.
      if (e.repeat || !config.keys.includes(e.key)) return
      const el = config.resolve(e.target)
      if (!el) return
      e.preventDefault()
      armed = config.blocked?.(el) ? null : el
      if (armed) config.preflight?.(armed)
    },
    true,
  )

  doc.addEventListener(
    'keyup',
    (e) => {
      if (!config.keys.includes(e.key)) return
      const el = config.resolve(e.target)
      // Only activate the same element the keydown armed — a focus move between
      // press and release cancels, like a native button.
      if (!el || el !== armed) {
        armed = null
        return
      }
      armed = null
      if (config.blocked?.(el)) return
      config.activate(el)
    },
    true,
  )
}
