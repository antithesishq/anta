/**
 * Shared copy-to-clipboard behavior for `<a-button>` and `<a-menu-item>` — the
 * write half of the productized "copy button" / "copying menu item". The element
 * performs the clipboard write itself (rather than a UI-thread callback) and
 * reports the outcome with a `copydone` event; the JSX wrapper listens and
 * orchestrates the visual feedback (icon + tone swap). Nothing here touches the
 * DOM — no light-DOM mutation, no host attributes, no ElementInternals.
 *
 * Events are dispatched non-bubbling (`bubbles: false`): the wrapper binds on the
 * host itself, so it catches them in the target phase, and not bubbling keeps a
 * nested copy row's `copydone` from flipping an ancestor copy row's feedback
 * (the same point-to-point rule Anta's `statechange` follows).
 *
 * Three modes, chosen by attribute:
 * - `copy="<text>"` — copy the literal string on activation.
 * - `copy-node` / `copy-node="<selector>"` — copy a DOM node as rich text
 *   (`text/html`) + plain text. Bare `copy-node` copies the nearest ancestor
 *   marked `[data-copy-source]`; a value is a selector resolved with `closest()`
 *   (an ancestor region). The copy control is stripped from the serialized
 *   output (`[data-copy-node-button]`).
 * - `copy-lazy` — the content isn't known until the click. Activation dispatches
 *   `copyrequest` whose `detail.provide(text)` the consumer calls with the value
 *   (synchronously, or after an `await` — the browser's transient-activation
 *   window still covers the write). Nothing lands in the DOM, and there's no
 *   attribute round-trip to reset. Takes precedence over any `copy` value.
 *
 * Precedence when several are set (the discriminated-union prop types make this
 * unreachable from the wrappers, but hand-authored markup can): node → lazy →
 * literal `copy`.
 */

/** Write plain text to the clipboard. Resolves `true` on success. */
async function writeText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Serialize a node to `text/html` + `text/plain` and write it. Falls back to
 *  plain text where `ClipboardItem` is unavailable. */
async function writeNode(node: Element): Promise<boolean> {
  // Clone so we can strip the copy control(s) without touching the live tree
  // (the app DOM may be owned by a worker — never mutate light DOM here).
  const clone = node.cloneNode(true) as Element
  clone.querySelectorAll('[data-copy-node-button]').forEach((n) => n.remove())
  const html = clone.outerHTML
  const text = clone.textContent ?? ''
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ])
      return true
    }
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Resolve the node a `copy-node` control targets, or `null`. */
function resolveNodeTarget(el: Element): Element | null {
  const sel = el.getAttribute('copy-node')
  if (sel == null) return null
  // Bare `copy-node` → nearest ancestor region; a value → that selector, both via
  // closest() (ancestor-or-self).
  return el.closest(sel === '' ? '[data-copy-source]' : sel)
}

/** Run a copy `work` promise and announce the outcome (non-bubbling `copydone`,
 *  `detail: { ok }`) so the wrapper can render feedback. */
function run(el: HTMLElement, work: Promise<boolean>): void {
  void work.then((ok) => {
    el.dispatchEvent(new CustomEvent('copydone', { bubbles: false, detail: { ok } }))
  })
}

/**
 * Perform a copy on activation (click / Enter / Space / menu select). Returns
 * `true` if the element is a copy control (so the caller knows the copy path
 * ran); `false` for a plain, non-copy element.
 */
export function runCopy(el: HTMLElement): boolean {
  if (el.hasAttribute('copy-node')) {
    const target = resolveNodeTarget(el)
    run(el, target ? writeNode(target) : Promise.resolve(false))
    return true
  }
  if (el.hasAttribute('copy-lazy')) {
    // Ask for the content via a one-shot `provide` callback; the consumer calls
    // it with the value (sync or after an await, within the activation window).
    let done = false
    el.dispatchEvent(
      new CustomEvent('copyrequest', {
        bubbles: false,
        detail: {
          provide(text: string) {
            if (done) return
            done = true
            run(el, writeText(String(text ?? '')))
          },
        },
      }),
    )
    return true
  }
  if (!el.hasAttribute('copy')) return false
  run(el, writeText(el.getAttribute('copy') ?? ''))
  return true
}
