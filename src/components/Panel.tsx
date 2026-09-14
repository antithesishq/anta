import { nativeStateChange } from '../anta_helpers'
import type { BaseProps, DOMEventHandlers, PanelState } from '../general_types'

export interface PanelProps extends BaseProps, DOMEventHandlers {
  /** Fill the browser viewport and contain keyboard focus within the panel.
   * When supplied, the application owns the state. */
  maximized?: boolean
  /** Initial viewport maximization for an uncontrolled panel, read once on connect. */
  defaultMaximized?: boolean
  /** Requested maximization change. Update `maximized` to accept a controlled
   * request, or prevent the event to veto an uncontrolled request. */
  onStateChange?: (event: CustomEvent, detail: { next: boolean; prev: boolean }) => void
}

/** A persistent container that maximizes its content without moving its DOM children. */
export const Panel = ({ maximized, defaultMaximized, onStateChange, className, children, ...rest }: PanelProps) => (
  <a-panel
    state={maximized === undefined ? undefined : maximized ? 'maximized' : 'normal'}
    default-state={maximized === undefined && defaultMaximized ? 'maximized' : undefined}
    onstatechange={onStateChange ? event => {
      const { event: native, detail, isOwn } = nativeStateChange<{ next: PanelState; prev: PanelState }>(event)
      if (isOwn && detail) onStateChange(native, {
        next: detail.next === 'maximized',
        prev: detail.prev === 'maximized',
      })
    } : undefined}
    class={className}
    {...rest}
  >
    {children}
  </a-panel>
)
