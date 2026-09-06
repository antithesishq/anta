import {
  cssLength,
  customEventHandler,
  lengthStyle,
  roundAttr,
  roundStyle,
} from '../anta_helpers'
import type {
  BoxContextChange,
  BoxDisplay,
  BoxMeasurementChange,
} from '../box-types'
import type { BaseProps } from '../general_types'
import type {
  BoxInputDirections, BoxInputModifier, BoxPan, BoxPanInput, BoxPointerCapture,
  BoxPointerInput, BoxWheelActivation, BoxWheelInput, BoxWheelSettle,
} from '../box-input-types'
import { directionAttribute, panAttributes, pointerCaptureAttributes, wheelSettleAttributes } from './box-input-props'

/** JSX props for the observing light-DOM `<a-box>` container. */
export interface BoxProps extends BaseProps {
  /** Layout model for the host. All other layout, sizing, mask, and shadow
   * properties stay ordinary `className` / `style` CSS on the Box itself.
   * @defaultValue block */
  display?: BoxDisplay
  /** Fully-round corners (`border-radius: 999px`, clamped to the box). Pass a
   * `number` (px) or a CSS length string (`'1rem'`) for a custom radius. Omit
   * for square corners. */
  round?: boolean | number | string
  /** Gap between children, matching the CSS `gap` property. A `number` is
   * pixels; a string is any CSS length or two-value gap (`'1rem'`,
   * `'8px 16px'`). Applies while the Box is a flex or grid container. */
  gap?: number | string
  /** What the Box watches, when a handler is not what turns it on. `'size'`
   * keeps the overflow CSS states (`:state(clipped-x)`, `:state(scrollable-y)`,
   * …) current — reach for it when your own CSS is the only reader. `'context'`
   * and `'all'` are there for symmetry; passing `onMeasureChange` or
   * `onContextChange` already turns the matching half on. */
  observe?: 'size' | 'context' | 'all'
  /** Fades out every edge that currently hides clipped content, and drops the
   * fade from an edge once the reader scrolls to it. */
  fade?: boolean
  /** Depth of the `fade` gradient. A `number` is pixels; a string is any CSS
   * length.
   * @defaultValue 24 */
  fadeSize?: number | string
  /** Fired after Box geometry or its content-overflow state changes. `detail`
   * contains the changed fields and a full current snapshot. */
  onMeasureChange?: (
    event: CustomEvent<BoxMeasurementChange>,
    detail: BoxMeasurementChange,
  ) => void
  /** Fired after Box's browser and local rendering context changes. `detail`
   * contains the changed fields and a full current snapshot. */
  onContextChange?: (
    event: CustomEvent<BoxContextChange>,
    detail: BoxContextChange,
  ) => void
  /** Capture wheel input in the enabled directions and emit `onWheelInput`.
   * `true` accepts all directions. Omit or pass `false` to leave wheel input alone.
   * Nested native wheel controls and Anta menus are excluded.
   * All-false direction bounds preserve pointer settling while declining input.
   * A listener alone never enables capture. */
  wheelCapture?: BoxInputDirections
  /** Pointer or focus condition required before wheel input can be captured.
   * Focus applies only to input targeted within this Box.
   * @defaultValue settled */
  wheelActivation?: BoxWheelActivation
  /** Required modifier for wheel capture. `none` preserves browser Ctrl/pinch zoom.
   * @defaultValue none */
  wheelModifier?: BoxInputModifier
  /** Dwell delay, movement tolerance, and whether movement resets eligibility.
   * @defaultValue { delay: 150, tolerance: 5, resetOnMove: false } */
  wheelSettle?: BoxWheelSettle
  /** Accepted wheel input, with a serialized original event, Box-relative
   * geometry, focus state, and activation reason. Cancellation is already complete. */
  onWheelInput?: (event: CustomEvent<BoxWheelInput>, detail: BoxWheelInput) => void
  /** Emit raw data for a primary pointer until release or cancellation. An options object
   * filters devices/buttons and configures activation. Nested interactive controls
   * are excluded unless explicitly included. A listener alone enables nothing. */
  pointerCapture?: boolean | BoxPointerCapture
  /** Start, movement, end, and cancellation of an opted-in pointer session. */
  onPointerInput?: (event: CustomEvent<BoxPointerInput>, detail: BoxPointerInput) => void
  /** Emit custom pan motion. `true` enables touch panning on both axes without
   * momentum. Options select devices, axes, bounds directions, and optional inertia.
   * Captures the pointer internally; `pointerCapture` is not required.
   * Sets CSS touch-action through attributes before the gesture starts. */
  pan?: boolean | BoxPan
  /** Custom pan motion and its lifecycle. Inertial samples have no native pointer event. */
  onPanInput?: (event: CustomEvent<BoxPanInput>, detail: BoxPanInput) => void
}

/**
 * A light-DOM CSS box with browser-owned observation. `Box` is deliberately a
 * thin JSX projection: it never holds a DOM ref. The element measures itself,
 * tracks clipping and focus within, and emits native custom events so this works
 * with React, Preact, and DOMs reconciled outside the UI thread.
 *
 * @example
 * ```tsx
 * <Box display="grid" onMeasureChange={(event, { current }) => {
 *   console.log(current.width, current.clippedX)
 * }}>
 *   <Text truncate>Long content</Text>
 * </Box>
 * ```
 */
/** Merges the `observe` prop with the halves the handlers imply. */
function observeAttr(
  observe: 'size' | 'context' | 'all' | undefined,
  onMeasureChange: unknown,
  onContextChange: unknown,
): 'size' | 'context' | 'all' | undefined {
  const size = observe === 'size' || observe === 'all' || onMeasureChange != null
  const context = observe === 'context' || observe === 'all' || onContextChange != null
  if (size && context) return 'all'
  if (size) return 'size'
  if (context) return 'context'
  return undefined
}

export const Box = ({
  display,
  round,
  gap,
  observe,
  fade,
  fadeSize,
  onMeasureChange,
  onContextChange,
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
  style,
  children,
  ...rest
}: BoxProps) => {
  return (
    <a-box
      display={display === 'block' ? undefined : display}
      round={roundAttr(round)}
      gap={gap != null ? '' : undefined}
      observe={observeAttr(observe, onMeasureChange, onContextChange)}
      fade={fade ? '' : undefined}
      fade-size={fade && fadeSize != null ? cssLength(fadeSize) : undefined}
      onmeasurechange={customEventHandler(onMeasureChange)}
      oncontextchange={customEventHandler(onContextChange)}
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
      style={lengthStyle(
        fade ? fadeSize : undefined,
        '--box-fade-size',
        lengthStyle(gap, '--box-gap', roundStyle(round, '--box-round', style)),
      )}
      {...rest}
    >
      {children}
    </a-box>
  )
}
