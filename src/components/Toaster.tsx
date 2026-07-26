import type { BaseProps } from "../general_types"
import { useMemo, useSyncExternalStore } from "../jsx-runtime"
import { createToaster, type Toaster as ToasterStore, type ToastEntry } from "../toaster"

export interface ToasterProps extends BaseProps {
  /** The store this region renders. Omit to bind the default store driven by
   *  `Toaster.manager`; pass a `createToaster()` for an isolated region. */
  toaster?: ToasterStore
  /** Accessible label for the region landmark.
   *  @defaultValue 'Notifications' */
  label?: string
  /** Live-region politeness for announcing new toasts to assistive tech.
   *  @defaultValue 'polite' */
  politeness?: "polite" | "assertive" | "off"
}

/** One rendered toast. Calls the entry's render function and routes the result:
 *  a real DOM node goes to the element via the `content` property (the element
 *  slots it), everything else (a string / JSX) is rendered as a child by the
 *  reconciler. Memoized on `rev` so the render runs once per in-place change
 *  (stable identity for a DOM node, no churn for JSX). */
const ToastItem = ({ entry, store }: { entry: ToastEntry; store: ToasterStore }) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- content is a function of id+rev only
  const content = useMemo(() => entry.render(entry.id), [entry.id, entry.rev])
  const isNode = typeof Node !== "undefined" && content instanceof Node

  const common = {
    slot: entry.placement,
    duration: entry.duration,
    closable: entry.closable ? "" : undefined,
    leaving: entry.leaving ? "" : undefined,
    rev: entry.rev,
    // Fires after the exit animation; that's when the entry actually leaves.
    ondismiss: () => store.remove(entry.id),
  } as const

  return isNode ? (
    <a-toast {...common} content={content as Node} />
  ) : (
    <a-toast {...common}>{content as React.ReactNode}</a-toast>
  )
}

/**
 * `<Toaster>` — the mounted notification region. Keep one mounted somewhere in
 * your app (a portal is fine); toasts are added imperatively through the store
 * (`Toaster.manager`, or a `createToaster()` you pass as `toaster`). It
 * subscribes to the store and renders each toast through the reconciler, so
 * React/Preact owns the toast nodes.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only) to
 * register the underlying custom elements.
 *
 * @example
 * ```tsx
 * <Toaster />   // mount once, keep it mounted
 *
 * // then from anywhere:
 * Toaster.manager.add((id) => <Banner tone="success" message="Saved" closable={false} />, {
 *   placement: 'bottom-right',
 *   closable: true,
 * })
 * ```
 */
const ToasterImpl = ({
  toaster,
  label = "Notifications",
  politeness = "polite",
  className,
  style,
  // The region's children come from the store, not from JSX.
  children: _children,
  ...rest
}: ToasterProps) => {
  const store = toaster ?? getDefaultStore()
  const entries = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)

  return (
    <a-toaster
      role="region"
      aria-label={label}
      aria-live={politeness}
      class={className}
      style={style}
      {...rest}
    >
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
