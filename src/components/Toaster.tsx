import type { BaseProps } from "../general_types"
import { createToaster, type Toaster as ToasterStore } from "../toaster"

export interface ToasterProps extends BaseProps {
  /** Coordinator name — bind this region to a specific `createToaster(name)`.
   *  Omit to use the default region driven by `Toaster.manager`. */
  name?: string
  /** Accessible label for the region landmark.
   *  @defaultValue 'Notifications' */
  label?: string
}

/**
 * `<Toaster>` — the mounted notification region. Renders an `<a-toaster>` and
 * nothing else; toasts are added imperatively through the manager
 * (`Toaster.manager`, or a `createToaster(name)` you pass as `name`), never as
 * children. Keep one mounted somewhere in your app (a portal is fine) — the
 * manager renders into whichever region is currently mounted, and has nowhere to
 * show a toast if none is.
 *
 * Renders no JSX children on purpose: the reconciler never manages the region's
 * subtree, so the manager's imperatively-appended `<a-toast>` nodes are safe.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only) to
 * register the underlying custom elements.
 *
 * @example
 * ```tsx
 * // Mount once, anywhere that stays mounted:
 * <Toaster />
 *
 * // Then from anywhere in the app:
 * import { Toaster } from '@antadesign/anta'
 * const el = document.createElement('a-banner')
 * el.setAttribute('tone', 'success')
 * el.setAttribute('round', '')
 * el.textContent = 'Saved'
 * Toaster.manager.add(el, { placement: 'bottom-right' })
 * ```
 */
const ToasterImpl = ({
  name,
  label = "Notifications",
  className,
  style,
  // The region renders no children — pulled out of `rest` so it can't be spread in.
  children: _children,
  ...rest
}: ToasterProps) => {
  return (
    <a-toaster
      name={name}
      role="region"
      aria-label={label}
      class={className}
      style={style}
      {...rest}
    />
  )
}

// Lazy default store, exposed as `Toaster.manager`. A getter (not an eager
// assignment) keeps the store from being created at import — and out of SSR
// module state — until first use, and gives a stable object across renders.
let defaultStore: ToasterStore | undefined
const getDefaultStore = () => (defaultStore ??= createToaster("default"))

/**
 * The `<Toaster>` component, carrying the default toast manager as a static:
 * `Toaster.manager.add(node, opts)`. A function-with-a-static (like
 * `Component.displayName`) — no class component, which would couple to a renderer.
 */
export const Toaster = ToasterImpl as typeof ToasterImpl & {
  /** The default toast manager, bound to a `<Toaster>` mounted with no `name`. */
  readonly manager: ToasterStore
}
Object.defineProperty(Toaster, "manager", { get: getDefaultStore, enumerable: true })

export { createToaster } from "../toaster"
export type { Toaster as ToasterManager, ToastOptions, ToastPlacement } from "../toaster"
