/**
 * Shared copy-to-clipboard behavior for `<a-button>` and `<a-menu-item>` — the
 * write half of the productized "copy button" / "copying menu item". The element
 * performs the clipboard write itself (rather than a UI-thread callback) and
 * reports the outcome with a bubbling `copydone` event; the JSX wrapper listens
 * and orchestrates the visual feedback (icon + tone swap). Nothing here touches
 * the DOM — no light-DOM mutation, no host attributes, no ElementInternals.
 *
 * Two modes, chosen by attribute:
 * - `copy="<text>"` — copy the literal string on activation.
 * - `copy-node` / `copy-node="<selector>"` — copy a DOM node as rich text
 *   (`text/html`) + plain text. Bare `copy-node` copies the nearest ancestor
 *   marked `[data-copy-source]`; a value is a selector resolved with `closest()`
 *   (an ancestor region). The copy control is stripped from the serialized
 *   output (`[data-copy-node-button]`).
 *
 * Lazy content (`copy-lazy`): the string isn't known until the click. On
 * activation with an empty `copy`, the element dispatches a bubbling
 * `copyrequest` and arms a pending write; when the reactive layer sets `copy`
 * back (an async round-trip, e.g. to a worker), `notifyCopyAttrChanged` completes
 * the write — as long as it lands inside the transient user-activation window the
 * click opened. This keeps the content out of the DOM until it's actually needed,
 * without losing the gesture the clipboard API requires.
 */

/** How long after activation a lazily-provided `copy` value is still written —
 *  the transient user-activation window the click opened. */
const LAZY_WINDOW_MS = 5000

/** Timestamp of a lazy activation still waiting for its `copy` value. */
const armedAt = new WeakMap<Element, number>()

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

/** Run a copy `work` promise and announce the outcome (bubbling `copydone`,
 *  `detail: { ok }`) so the wrapper can render feedback. */
function run(el: HTMLElement, work: Promise<boolean>): void {
  void work.then((ok) => {
    el.dispatchEvent(new CustomEvent('copydone', { bubbles: true, detail: { ok } }))
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
  if (!el.hasAttribute('copy')) return false

  const text = el.getAttribute('copy') ?? ''
  if (text === '' && el.hasAttribute('copy-lazy')) {
    // Lazy: ask for the content and arm a pending write. `notifyCopyAttrChanged`
    // finishes once the value lands (within the activation window).
    armedAt.set(el, Date.now())
    el.dispatchEvent(new CustomEvent('copyrequest', { bubbles: true }))
    return true
  }
  run(el, writeText(text))
  return true
}

/**
 * Call from the element's `attributeChangedCallback` for `copy`. Completes a
 * pending lazy copy when the value arrives inside the activation window.
 */
export function notifyCopyAttrChanged(el: HTMLElement): void {
  const at = armedAt.get(el)
  if (at == null) return
  const text = el.getAttribute('copy') ?? ''
  if (text === '') return
  armedAt.delete(el)
  if (Date.now() - at > LAZY_WINDOW_MS) return
  run(el, writeText(text))
}
