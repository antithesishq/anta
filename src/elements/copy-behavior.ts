/**
 * Copy-to-clipboard behavior for the `<a-copy>` element — the write half of the
 * productized "copy button" / "copying menu item". `<a-copy>` (slotted inside a
 * button or menu row) calls these on the host's activation: it performs the
 * clipboard write itself (rather than a UI-thread callback) and reports the
 * outcome with a `copydone` event. JSX presets can render visual feedback from
 * that event. Nothing here touches the DOM — no light-DOM mutation, no host
 * attributes, no ElementInternals.
 *
 * Events are dispatched non-bubbling (`bubbles: false`): the wrapper binds on the
 * host itself, so it catches them in the target phase, and not bubbling keeps a
 * nested copy row's `copydone` from flipping an ancestor copy row's feedback
 * (the same point-to-point rule Anta's `statechange` follows).
 *
 * Modes, chosen by attribute:
 * - `copy="<text>"` — copy the literal string on activation.
 * - `copy-url` — copy the current page URL (`location.href`); no `copy` needed.
 * - `copy-with-url` — prefix the copied `copy` string with `// URL: <href>`.
 * - `copy-node` / `copy-node="<selector>"` — copy a DOM node as rich text
 *   (`text/html`) + plain text. Bare `copy-node` copies the nearest ancestor
 *   marked `[data-copy-source]`; a value is a selector resolved with `closest()`
 *   (an ancestor region). The copy control is stripped from the serialized
 *   output (`[data-copy-node-button]`).
 *
 * ## Dynamic string targets
 *
 * A `copyrequest` event is emitted before activation when `copy` is present.
 * JSX applications respond by setting their controlled `copy` value; the next
 * render updates this attribute, which activation reads and writes.
 *
 * `<a-copy>` and the clipboard run on the browser UI thread, while an application
 * renderer can run in a worker. The UI thread cannot call an application function
 * by reference. The state update sends text through the renderer instead. The
 * request occurs on pointerdown or keydown before the activation that writes to
 * the clipboard, preserving the browser's user-activation requirement.
 *
 * Precedence when several are set (the discriminated-union prop types make this
 * unreachable from the wrappers, but hand-authored markup can): node → url →
 * literal `copy` (with the optional URL prefix).
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

/** The current page URL, or '' outside a document (SSR). */
function currentUrl(): string {
  return typeof location !== 'undefined' ? location.href : ''
}

/** Resolve the text a string-copy control writes: the page URL for `copy-url`,
 *  otherwise the `copy` value, optionally prefixed with the URL (`copy-with-url`). */
function resolveText(el: Element): string {
  if (el.hasAttribute('copy-url')) return currentUrl()
  const base = el.getAttribute('copy') ?? ''
  if (el.hasAttribute('copy-with-url')) return `// URL: ${currentUrl()}\n${base}`
  return base
}

/** True when `el` copies a string (vs a node) — `copy`, `copy-url`, or a
 *  URL-prefixed `copy`. */
function isTextCopy(el: Element): boolean {
  return el.hasAttribute('copy') || el.hasAttribute('copy-url')
}

/**
 * Ask a consumer to refresh its controlled copy string before activation. This
 * dispatches a non-bubbling, payload-free `copyrequest`. Only string-copy
 * controls need it; node and URL targets resolve on activation.
 */
export function emitCopyRequest(el: HTMLElement): void {
  if (!el.hasAttribute('copy')) return
  el.dispatchEvent(new CustomEvent('copyrequest', { bubbles: false }))
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
  if (!isTextCopy(el)) return false
  run(el, writeText(resolveText(el)))
  return true
}
