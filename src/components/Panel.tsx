import { useNativeEventProps } from '../native-event-props'
import { nativeStateChange, type StateChangeEvent } from '../anta_helpers'
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

type StateChangeDetail = { next: PanelState; prev: PanelState }

/** A scroll container that fills its parent and can maximize to the viewport.
 * Percentage height requires a parent with a defined height.
 * Inside another shadow root, load `@antadesign/anta/elements/a-panel.css`
 * there through a stylesheet link so its part rules can reach Panel. */
export const Panel = ({ maximized, defaultMaximized, onStateChange, className, children, ...rest }: PanelProps) => {
  const events = useNativeEventProps({
    onstatechange: onStateChange ? (event: StateChangeEvent<StateChangeDetail>) => {
      const { event: native, detail, isOwn } = nativeStateChange<StateChangeDetail>(event)
      if (isOwn && detail) onStateChange(native, {
        next: detail.next === 'maximized',
        prev: detail.prev === 'maximized',
      })
    } : undefined,
  })
  return (
    <a-panel
      state={maximized === undefined ? undefined : maximized ? 'maximized' : 'normal'}
      default-state={maximized === undefined && defaultMaximized ? 'maximized' : undefined}
      {...events}
      class={className}
      {...rest}
    >
      {children}
    </a-panel>
  )
}
