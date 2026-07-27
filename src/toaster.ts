/**
 * Toaster store — the data behind `<Toaster>` / `Toaster.manager`.
 *
 * A pure, renderer-agnostic store: it holds a list of toast entries and notifies
 * subscribers when it changes. It never touches the DOM. A mounted `<Toaster>`
 * subscribes to it (via `useSyncExternalStore`) and renders each entry through
 * the reconciler, so React/Preact owns every toast node — no imperative append,
 * no coordinator, no node refs.
 *
 * A toast's content is a **render function** `(id) => …`. Return a string, a JSX
 * node, or a real DOM `Node`; the `<Toaster>` renders a string / JSX through the
 * reconciler and hands a DOM node to the `<a-toast>` element to slot. The `id`
 * lets the content wire its own dismiss button (`() => manager.dismiss(id)`).
 *
 * Dismissal is two-phase so the exit animation plays: `dismiss(id)` marks the
 * entry `leaving` (it stays rendered), the `<a-toast>` element animates out and
 * fires `dismiss`, and only then is the entry removed. `remove` is the second
 * phase, called by the wrapper on that event.
 *
 * SSR-safe: no `HTMLElement` reference and no top-level DOM access; `getServerSnapshot`
 * returns an empty list, so nothing renders server-side.
 */

/** Where a toast is anchored in the viewport. */
export type ToastPlacement =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

/** The default corner. */
const DEFAULT_PLACEMENT: ToastPlacement = 'bottom-right'

/** What a toast's render function may return: a string / JSX (rendered through
 *  the reconciler) or a live DOM node (slotted by the element). */
export type ToastContent = React.ReactNode | Node

/** A toast's content, as a function of its id (so content can dismiss itself). */
export type ToastRender = (id: string) => ToastContent

/** Per-toast options for {@link Toaster.add}. */
export interface ToastOptions {
  /** Stable id. Reuse it to update a live toast in place (upsert) or to target
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
  /** Announce this toast to assistive tech via `aria-live` on the toast. Opt-in
   *  per toast — omit for no announcement (the content may carry its own live
   *  semantics, e.g. a `Banner`'s `role="status"`). `'assertive'` interrupts. */
  politeness?: 'polite' | 'assertive'
}

/** One live toast, as the mounted `<Toaster>` reads it. */
export interface ToastEntry {
  id: string
  render: ToastRender
  placement: ToastPlacement
  duration?: number
  closable: boolean
  /** `aria-live` politeness for this toast, or undefined for no announcement. */
  politeness?: 'polite' | 'assertive'
  /** True once dismissal has been requested — the entry stays rendered so the
   *  element can animate out, then `remove` drops it. */
  leaving: boolean
  /** Bumped on every add/update for an existing id, so the element restarts its
   *  timer (and the wrapper recomputes the content) on an in-place change. */
  rev: number
}

/** The toast controller returned by {@link createToaster}. */
export interface Toaster {
  /** Show `render()` as a toast; returns its id. Reusing an existing `id`
   *  replaces that toast in place and restarts its timer. */
  add(render: ToastRender, opts?: ToastOptions): string
  /** Request dismissal: the toast animates out, then leaves. */
  dismiss(id: string): void
  /** Replace a live toast's content in place. */
  update(id: string, render: ToastRender): void
  /** Dismiss every toast. */
  clear(): void
  /** Drop an entry now (no animation) — the wrapper calls this once the element
   *  reports it finished animating out. Rarely needed directly. */
  remove(id: string): void
  /** Subscribe to changes; returns an unsubscribe. For `useSyncExternalStore`. */
  subscribe(onChange: () => void): () => void
  /** Current entries (a stable reference until the next change). */
  getSnapshot(): readonly ToastEntry[]
  /** Server snapshot — always empty (toasts don't render server-side). */
  getServerSnapshot(): readonly ToastEntry[]
}

/** Shared stable empty snapshot for SSR (a fresh array each call would loop
 *  `useSyncExternalStore`). */
const EMPTY: readonly ToastEntry[] = Object.freeze([])

let uid = 0

/**
 * Create a toast store. Export one as your app singleton and drive it from
 * anywhere; bind it to a mounted region with `<Toaster toaster={…} />`. Most apps
 * use the built-in default, `Toaster.manager`, and a bare `<Toaster />`.
 *
 * @example
 * ```ts
 * export const toaster = createToaster()
 * toaster.add(() => <Card>Saved</Card>, { placement: 'bottom-right' })
 * ```
 */
export function createToaster(): Toaster {
  // Immutable snapshot, replaced on every mutation (so getSnapshot can hand back
  // a stable reference between changes — the useSyncExternalStore contract).
  let snapshot: readonly ToastEntry[] = EMPTY
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((fn) => fn())

  function add(render: ToastRender, opts: ToastOptions = {}): string {
    const id = opts.id ?? `t${++uid}`
    const i = snapshot.findIndex((e) => e.id === id)
    const next: ToastEntry = {
      id,
      render,
      placement: opts.placement ?? DEFAULT_PLACEMENT,
      duration: opts.duration,
      closable: opts.closable ?? false,
      politeness: opts.politeness,
      leaving: false,
      rev: i === -1 ? 0 : snapshot[i].rev + 1,
    }
    snapshot = i === -1 ? [...snapshot, next] : snapshot.map((e, j) => (j === i ? next : e))
    emit()
    return id
  }

  function dismiss(id: string): void {
    let changed = false
    snapshot = snapshot.map((e) => {
      if (e.id === id && !e.leaving) {
        changed = true
        return { ...e, leaving: true }
      }
      return e
    })
    if (changed) emit()
  }

  function update(id: string, render: ToastRender): void {
    let changed = false
    snapshot = snapshot.map((e) => {
      // Skip a toast that's already dismissing — updating a dying node would just
      // flash and vanish. Re-add with the same id to revive + replace instead.
      if (e.id === id && !e.leaving) {
        changed = true
        return { ...e, render, rev: e.rev + 1 }
      }
      return e
    })
    if (changed) emit()
  }

  function remove(id: string): void {
    const next = snapshot.filter((e) => e.id !== id)
    if (next.length !== snapshot.length) {
      snapshot = next
      emit()
    }
  }

  function clear(): void {
    let changed = false
    snapshot = snapshot.map((e) => {
      if (!e.leaving) {
        changed = true
        return { ...e, leaving: true }
      }
      return e
    })
    if (changed) emit()
  }

  return {
    add,
    dismiss,
    update,
    remove,
    clear,
    subscribe(onChange) {
      listeners.add(onChange)
      return () => {
        listeners.delete(onChange)
      }
    },
    getSnapshot() {
      return snapshot
    },
    getServerSnapshot() {
      return EMPTY
    },
  }
}
