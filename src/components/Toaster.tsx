import type { BaseProps } from "../general_types"
import { useMemo, useSyncExternalStore } from "../jsx-runtime"
import { createToaster, type Toaster as ToasterStore, type ToastEntry } from "../toaster"
import { Banner } from "./Banner"

export interface ToasterProps extends BaseProps {
  /** The store this region renders. Omit to bind the default store driven by
   *  `Toaster.manager`; pass a `createToaster()` for an isolated region. */
  toaster?: ToasterStore
  /** Accessible label for the region landmark.
   *  @defaultValue 'Notifications' */
  label?: string
}

/** One rendered toast. Calls the entry's render function and routes the result by
 *  type: a real DOM node goes to the element via the `content` property (the
 *  element slots it); a bare string / number is wrapped in a dismissible `Banner`
 *  (so a plain-text toast gets a surface and a working ✕ for free); everything
 *  else (JSX) is rendered as a child by the reconciler. Memoized on `rev` so the
 *  render runs once per in-place change (stable identity for a DOM node, no churn
 *  for JSX). */
const ToastItem = ({ entry, store }: { entry: ToastEntry; store: ToasterStore }) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- content is a function of id+rev only
  const content = useMemo(() => entry.render(entry.id), [entry.id, entry.rev])
  const isNode = typeof Node !== "undefined" && content instanceof Node
  const isText = typeof content === "string" || typeof content === "number"

  const common = {
    slot: entry.placement,
    duration: entry.duration,
    leaving: entry.leaving ? "" : undefined,
    rev: entry.rev,
    // Opt-in per-toast announcement. role=status/alert (not a bare aria-live) so
    // it announces when inserted — a plain aria-live region must pre-exist before
    // its content changes, which a freshly-added toast can't satisfy. Omitted (no
    // announcement) unless requested.
    role: entry.politeness === "assertive" ? "alert" : entry.politeness === "polite" ? "status" : undefined,
    // Fires after the exit animation; that's when the entry actually leaves.
    ondismiss: () => store.remove(entry.id),
  } as const

  if (isNode) return <a-toast {...common} content={content as Node} />
  if (isText)
    // Controlled (`dismissed={false}`) so the ✕ only *requests* — the toast owns
    // the exit animation, no double collapse. onDismiss (fired by the ✕ or any
    // `data-banner-dismiss` action) removes the toast.
    return (
      <a-toast {...common}>
        <Banner
          round
          message={content as string | number}
          dismissed={false}
          onDismiss={() => store.dismiss(entry.id)}
        />
      </a-toast>
    )
  return <a-toast {...common}>{content as React.ReactNode}</a-toast>
}

/**
 * `<Toaster>` — the mounted notification region. Keep one mounted somewhere in
 * your app (a portal is fine); toasts are added imperatively through the store
 * (`Toaster.manager`, or a `createToaster()` you pass as `toaster`). It
 * subscribes to the store and renders each toast through the reconciler, so
 * React/Preact owns the toast nodes.
 *
 * Announcement is opt-in **per toast** (`add(render, { politeness })`), not a
 * blanket live region on the whole toaster.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only) to
 * register the underlying custom elements.
 *
 * @example
 * ```tsx
 * <Toaster />   // mount once, keep it mounted
 *
 * // A bare string is auto-wrapped in a dismissible Banner:
 * Toaster.manager.add(() => 'Saved', { placement: 'bottom-right' })
 *
 * // Or toast a Banner yourself and wire its dismiss to the toast:
 * Toaster.manager.add((id) => (
 *   <Banner tone="success" message="Saved" onDismiss={() => Toaster.manager.dismiss(id)} />
 * ))
 * ```
 */
const ToasterImpl = ({
  toaster,
  label = "Notifications",
  className,
  style,
  // The region's children come from the store, not from JSX.
  children: _children,
  ...rest
}: ToasterProps) => {
  const store = toaster ?? getDefaultStore()
  const entries = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)

  return (
    <a-toaster role="region" aria-label={label} class={className} style={style} {...rest}>
      {entries.map((entry) => (
        <ToastItem key={entry.id} entry={entry} store={store} />
      ))}
    </a-toaster>
  )
}

// Lazy default store, exposed as `Toaster.manager`. A getter keeps it from being
// created at import — and out of SSR module state — until first use.
let defaultStore: ToasterStore | undefined
const getDefaultStore = () => (defaultStore ??= createToaster())

/**
 * The `<Toaster>` component, carrying the default toast store as a static:
 * `Toaster.manager.add(render, opts)`. A function-with-a-static (like
 * `Component.displayName`) — no class component, which would couple to a renderer.
 */
export const Toaster = ToasterImpl as typeof ToasterImpl & {
  /** The default toast store, bound to a `<Toaster>` mounted with no `toaster`. */
  readonly manager: ToasterStore
}
Object.defineProperty(Toaster, "manager", { get: getDefaultStore, enumerable: true })

export { createToaster } from "../toaster"
export type {
  Toaster as ToasterManager,
  ToastOptions,
  ToastPlacement,
  ToastContent,
  ToastRender,
} from "../toaster"
