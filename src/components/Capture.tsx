import { customEventHandler } from '../anta_helpers'
import type { BaseProps } from '../general_types'
import type {
  CaptureInputDirections, CaptureInputModifier, CapturePan, CapturePanInput, CapturePointerCapture,
  CapturePointerInput, CaptureWheelActivation, CaptureWheelInput, CaptureWheelSettle,
} from '../capture-types'
import { directionAttribute, panAttributes, pointerCaptureAttributes, wheelSettleAttributes } from './capture-props'

/** Opt-in input ownership for the light-DOM capture surface. */
export interface CaptureProps extends BaseProps {
  /** Capture wheel input in the enabled directions and emit `onWheelInput`.
   * `true` accepts all directions. Omit or pass `false` to leave wheel input alone.
   * Nested native wheel controls and Anta menus are excluded.
   * All-false direction bounds preserve pointer settling while declining input.
   * A listener alone never enables capture. */
  wheelCapture?: CaptureInputDirections
  /** Pointer or focus condition required before wheel input can be captured.
   * Focus applies only to input targeted within this Capture.
   * @defaultValue settled */
  wheelActivation?: CaptureWheelActivation
  /** Required modifier for wheel capture. `none` preserves browser Ctrl/pinch zoom.
   * @defaultValue none */
  wheelModifier?: CaptureInputModifier
  /** Dwell delay, movement tolerance, and whether movement resets eligibility.
   * @defaultValue { delay: 150, tolerance: 5, resetOnMove: false } */
  wheelSettle?: CaptureWheelSettle
  /** Accepted wheel input, with a serialized original event, Capture-relative
   * geometry, focus state, and activation reason. Cancellation is already complete. */
  onWheelInput?: (event: CustomEvent<CaptureWheelInput>, detail: CaptureWheelInput) => void
  /** Emit raw data for a primary pointer until release or cancellation. An options object
   * filters devices/buttons and configures activation. Nested interactive controls
   * are excluded unless explicitly included. A listener alone enables nothing. */
  pointerCapture?: boolean | CapturePointerCapture
  /** Start, movement, end, and cancellation of an opted-in pointer session. */
  onPointerInput?: (event: CustomEvent<CapturePointerInput>, detail: CapturePointerInput) => void
  /** Emit custom pan motion. `true` enables touch panning on both axes without
   * momentum. Options select devices, axes, bounds directions, and optional inertia.
   * Captures the pointer internally; `pointerCapture` is not required.
   * Sets CSS touch-action through attributes before the gesture starts. */
  pan?: boolean | CapturePan
  /** Custom pan motion and its lifecycle. Inertial samples have no native pointer event. */
  onPanInput?: (event: CustomEvent<CapturePanInput>, detail: CapturePanInput) => void
}

/** A browser-thread input surface. Nothing is captured until a capability is enabled. */
export const Capture = ({
  wheelCapture,
  wheelActivation,
  wheelModifier,
  wheelSettle,
  onWheelInput,
  pointerCapture,
  onPointerInput,
  pan,
  onPanInput,
  className,
  children,
  ...rest
}: CaptureProps) => (
  <a-capture
    wheel-capture={directionAttribute(wheelCapture)}
    wheel-activation={wheelCapture ? wheelActivation : undefined}
    wheel-modifier={wheelCapture ? wheelModifier : undefined}
    {...wheelSettleAttributes(wheelCapture ? wheelSettle : undefined)}
    {...pointerCaptureAttributes(pointerCapture)}
    {...panAttributes(pan)}
    onwheelinput={customEventHandler(onWheelInput)}
    onpointerinput={customEventHandler(onPointerInput)}
    onpaninput={customEventHandler(onPanInput)}
    class={className}
    {...rest}
  >
    {children}
  </a-capture>
)
