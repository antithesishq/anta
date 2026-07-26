/**
 * Toaster manager — the imperative controller behind `<Toaster>` and
 * `Toaster.manager`.
 *
 * It renders toasts into a **consumer-mounted** `<a-toaster>` region and never
 * creates or mutates `document.body`. The `<a-toaster>` element self-registers
 * here on connect (`registerToasterTarget`) and unregisters on disconnect — the
 * in-memory coordinator pattern of `a-menu`/`a-tooltip` (`setMenuPresence` /
 * `isMenuOpen`), not DOM mutation. `add()` looks up the registered region and
 * appends an `<a-toast>` into it. With no region connected, `add` queues; the
 * queue flushes — and any still-active toasts repaint — when a region
 * (re)connects, covering "placed, removed, re-placed".
 *
 * The one place light DOM is written is the manager appending into the
 * already-mounted region: the manager is a standalone imperative controller (not
 * a wrapper or element) and runs in the app's own realm, so it stays worker-safe.
 * The elements themselves only touch their own shadow.
 *
 * SSR-safe: no `HTMLElement` reference and no top-level `document` access, so it's
 * importable from the package barrel. Requires `@antadesign/anta/elements`
 * imported client-side to register `<a-toaster>` / `<a-toast>`, like every
 * component.
 */

/** Where a toast is anchored in the viewport. */
export type ToastPlacement =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

/** The default corner — matches `Toaster` / `<a-toast>`'s own default. */
const DEFAULT_PLACEMENT: ToastPlacement = 'bottom-right'

/** Per-toast options for {@link Toaster.add}. */
export interface ToastOptions {
  /** Stable id. Reuse it to update a live toast in place (upsert), or to target
   *  it with `dismiss` / `update`. Auto-generated when omitted. */
  id?: string
  /** Which corner / edge to show it in.
   *  @defaultValue 'bottom-right' */
  placement?: ToastPlacement
  /** Auto-dismiss delay in ms; `0` keeps it until dismissed. Omit to use the
   *  element default.
   *  @defaultValue 5000 */
  duration?: number
  /** Show a ✕ dismiss button on the toast.
   *  @defaultValue false */
  closable?: boolean
}

/** Imperative toast controller returned by {@link createToaster}. */
export interface Toaster {
  /** Show `content` (a DOM element or a string) as a toast; returns its id.
   *  Reusing an existing `id` replaces that toast's content in place and restarts
   *  its timer. */
  add(content: Element | string, opts?: ToastOptions): string
  /** Dismiss the toast with this id (plays the exit animation, then removes it). */
  dismiss(id: string): void
  /** Replace the content of a live toast without restarting its timer. */
  update(id: string, content: Element | string): void
  /** Dismiss every toast this manager owns. */
  clear(): void
}

/* ------------------------------------------------------------------ *
 * Coordinator — a live `<a-toaster>` publishes itself here per `name`,
 * so a manager can find the consumer-mounted region without a ref and
 * without importing the element module. PURE IN-MEMORY JS, no DOM.
 * ------------------------------------------------------------------ */

type TargetListener = (target: Element | null) => void

const targets = new Map<string, Element>()
const targetListeners = new Map<string, Set<TargetListener>>()

/** Called by `<a-toaster>` on connect: publish it as the region for `name`. */
export function registerToasterTarget(name: string, el: Element): void {
  targets.set(name, el)
  targetListeners.get(name)?.forEach((fn) => fn(el))
}

/** Called by `<a-toaster>` on disconnect: retract it if it's still the current
 *  region for `name`. */
export function unregisterToasterTarget(name: string, el: Element): void {
  if (targets.get(name) !== el) return
  targets.delete(name)
  targetListeners.get(name)?.forEach((fn) => fn(null))
}

function subscribeTarget(name: string, fn: TargetListener): void {
  let set = targetListeners.get(name)
  if (!set) {
    set = new Set()
    targetListeners.set(name, set)
  }
  set.add(fn)
}

/** The `<a-toast>` runtime surface the manager drives (public methods on the
 *  element). */
type ToastNode = HTMLElement & { dismiss(): void; restart(): void }

interface Descriptor {
  content: Element | string
  opts: ToastOptions
  /** The live `<a-toast>` when a region is showing it; cleared when the region
   *  unmounts so a future region repaints it fresh. */
  node?: ToastNode
}

let uid = 0

/**
 * Create a toast manager bound to the `<a-toaster>` region registered under
 * `name` (default `'default'`). Export one as your app singleton and drive it
 * from anywhere; a `<Toaster name={name} />` (or a hand-placed `<a-toaster
 * name="…">`) must be mounted for toasts to appear.
 *
 * @example
 * ```ts
 * export const toaster = createToaster()
 * // …later, anywhere:
 * const el = document.createElement('a-banner')
 * el.textContent = 'Saved'
 * toaster.add(el, { placement: 'bottom-right' })
 * ```
 */
export function createToaster(name = 'default'): Toaster {
  // Active toasts in insertion order (Map preserves it), keyed by id.
  const descriptors = new Map<string, Descriptor>()

  // Repaint into a region when one (re)connects; drop node refs when it leaves.
  subscribeTarget(name, (target) => {
    if (!target) {
      for (const d of descriptors.values()) d.node = undefined
      return
    }
    for (const [id, d] of descriptors) {
      if (!d.node || !d.node.isConnected) render(target, id, d)
    }
  })

  function setContent(node: Element, content: Element | string): void {
    const doc = node.ownerDocument
    node.replaceChildren(typeof content === 'string' ? doc.createTextNode(content) : content)
  }

  function render(target: Element, id: string, d: Descriptor): void {
    const node = target.ownerDocument.createElement('a-toast') as ToastNode
    node.slot = d.opts.placement ?? DEFAULT_PLACEMENT
    if (d.opts.duration != null) node.setAttribute('duration', String(d.opts.duration))
    if (d.opts.closable) node.setAttribute('closable', '')
    setContent(node, d.content)
    // The element plays its own exit animation and emits `dismiss` when done; the
    // manager (which appended the node) is what removes it — the element never
    // removes itself.
    node.addEventListener(
      'dismiss',
      () => {
        node.remove()
        descriptors.delete(id)
      },
      { once: true },
    )
    target.appendChild(node)
    d.node = node
  }

  function dismiss(id: string): void {
    const d = descriptors.get(id)
    if (!d) return
    if (d.node?.isConnected) d.node.dismiss()
    else descriptors.delete(id)
  }

  return {
    add(content, opts = {}) {
      const id = opts.id ?? `t${++uid}`
      const existing = descriptors.get(id)
      if (existing) {
        // Upsert: same id replaces content + options in place and restarts the timer.
        existing.content = content
        existing.opts = { ...existing.opts, ...opts }
        const node = existing.node
        if (node?.isConnected) {
          if (opts.placement) node.slot = opts.placement
          if (opts.duration != null) node.setAttribute('duration', String(opts.duration))
          setContent(node, content)
          node.restart()
        }
        return id
      }
      const d: Descriptor = { content, opts }
      descriptors.set(id, d)
      const target = targets.get(name)
      if (target) render(target, id, d)
      return id
    },
    dismiss,
    update(id, content) {
      const d = descriptors.get(id)
      if (!d) return
      d.content = content
      if (d.node?.isConnected) setContent(d.node, content)
    },
    clear() {
      for (const id of [...descriptors.keys()]) dismiss(id)
    },
  }
}
