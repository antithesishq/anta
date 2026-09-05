/** Directions of wheel or scroll deltas. Positive Y is down; positive X is right. */
export type BoxInputDirection = 'up' | 'down' | 'left' | 'right'

/** `true` accepts every direction; omitted object entries decline that direction. */
export type BoxInputDirections = boolean | Partial<Record<BoxInputDirection, boolean>>

/** `none` accepts unmodified input; a named modifier must be pressed. */
export type BoxInputModifier = 'none' | 'any' | 'alt' | 'ctrl' | 'meta' | 'shift'

export type BoxWheelActivation = 'hover' | 'settled' | 'focus' | 'settled-or-focus'
export type BoxWheelActivationReason = 'immediate' | 'settled' | 'focus'

export interface BoxWheelSettle {
  /** Pointer dwell time in milliseconds.
   * @defaultValue 150 */
  delay?: number
  /** Maximum movement from the dwell anchor on either axis, in CSS pixels.
   * @defaultValue 5 */
  tolerance?: number
  /** Restart dwell after movement beyond tolerance, including after activation.
   * @defaultValue false */
  resetOnMove?: boolean
}

export type BoxPointerType = 'mouse' | 'pen' | 'touch'

export interface BoxPointerCapture {
  /** Accepted pointer devices. One primary pointer is tracked per Box.
   * @defaultValue ['mouse', 'pen', 'touch'] */
  pointerTypes?: readonly BoxPointerType[]
  /** Accepted initiating buttons, using PointerEvent.button values.
   * @defaultValue [0] */
  buttons?: readonly number[]
  /** Movement required before activation, in viewport CSS pixels.
   * @defaultValue 0 */
  threshold?: number
  /** Modifier required to start a capture session.
   * @defaultValue any */
  modifier?: BoxInputModifier
  /** Allow capture to start on a nested form control, link, or editable region.
   * @defaultValue false */
  includeInteractive?: boolean
}

export interface BoxPanInertia {
  /** Exponential velocity decay time constant in milliseconds.
   * @defaultValue 325 */
  timeConstant?: number
  /** Stop when speed on both axes falls below this value, in CSS pixels/ms.
   * @defaultValue 0.02 */
  minVelocity?: number
}

export interface BoxPan {
  /** Accepted pointer devices.
   * @defaultValue ['touch'] */
  pointerTypes?: readonly BoxPointerType[]
  /** Axes handled by custom panning. CSS touch-action leaves the other axis to the browser.
   * @defaultValue both */
  axis?: 'x' | 'y' | 'both'
  /** Movement required before activation, in viewport CSS pixels.
   * @defaultValue 3 */
  threshold?: number
  /** Allowed scroll directions. Updating these can stop motion at application bounds.
   * @defaultValue true */
  directions?: BoxInputDirections
  /** Continue panning after release with browser-side velocity decay.
   * @defaultValue false */
  inertia?: boolean | BoxPanInertia
}

/** Plain event data. DOM targets, methods, and browser objects are excluded. */
export interface SerializedMouseEvent {
  type: string
  timeStamp: number
  isTrusted: boolean
  cancelable: boolean
  defaultPrevented: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  button: number
  buttons: number
  clientX: number
  clientY: number
  pageX: number
  pageY: number
  screenX: number
  screenY: number
  /** Coordinates relative to the original event target's padding edge. */
  offsetX: number
  offsetY: number
}

/** Original wheel values, including their original units and signs. */
export interface SerializedWheelEvent extends SerializedMouseEvent {
  deltaX: number
  deltaY: number
  deltaZ: number
  deltaMode: number
}

export interface SerializedPointerEvent extends SerializedMouseEvent {
  pointerId: number
  pointerType: string
  isPrimary: boolean
  width: number
  height: number
  pressure: number
  tangentialPressure: number
  tiltX: number
  tiltY: number
  twist: number
}

/** Geometry measured at delivery. CSS transforms are included in the viewport rectangle. */
export interface BoxInputGeometry {
  /** Pointer position relative to the viewport bounding rectangle's top-left, in CSS pixels. */
  localX: number
  localY: number
  /** Dimensions of the same viewport bounding rectangle, in CSS pixels. */
  boxWidth: number
  boxHeight: number
  /** Whether the pointer is inside that rectangle. Capture can continue outside it. */
  inside: boolean
  focusWithin: boolean
}

/** An accepted wheel input. Cancellation has already happened on the browser thread. */
export interface BoxWheelInput extends BoxInputGeometry {
  wheelEvent: SerializedWheelEvent
  activationReason: BoxWheelActivationReason
}

export type BoxPointerActivationReason = 'pointer-down' | 'drag-threshold'
export type BoxInputCancelReason = 'pointer-cancel' | 'lost-capture' | 'disabled' | 'disconnected' | 'blur' | 'interrupted'

export interface BoxPointerStart extends BoxInputGeometry {
  pointerEvent: SerializedPointerEvent
}

/** A captured pointer session. Positive movement follows the pointer right/down. */
export interface BoxPointerInput extends BoxInputGeometry {
  phase: 'start' | 'move' | 'end' | 'cancel'
  /** Null when cancellation comes from lifecycle or configuration changes. */
  pointerEvent: SerializedPointerEvent | null
  start: BoxPointerStart
  /** Movement since the previous delivered sample, in viewport CSS pixels. */
  deltaX: number
  deltaY: number
  /** Total movement from the initial press, in viewport CSS pixels. */
  movementX: number
  movementY: number
  activationReason: BoxPointerActivationReason
  cancelReason?: BoxInputCancelReason
}

/** Custom scroll motion. Deltas have the opposite sign to finger movement. */
export interface BoxPanInput extends BoxInputGeometry {
  phase: 'start' | 'move' | 'release' | 'inertia' | 'end' | 'cancel'
  /** Null during momentum or cancellation without a pointer event. */
  pointerEvent: SerializedPointerEvent | null
  start: BoxPointerStart
  /** Incremental scroll motion in viewport CSS pixels. */
  deltaX: number
  deltaY: number
  /** Scroll velocity in viewport CSS pixels/ms. */
  velocityX: number
  velocityY: number
  activationReason: BoxPointerActivationReason
  cancelReason?: BoxInputCancelReason
}
