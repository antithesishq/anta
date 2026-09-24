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
  BoxObservation,
} from '../box-types'
import { boxObservation } from '../box-observation'
import type { BaseProps } from '../general_types'

/** JSX props for the observing light-DOM `<a-box>` container. */
export interface BoxProps extends BaseProps {
  /** Layout model for the host. Sizing, alignment, mask, and shadow properties
   * stay ordinary `className` / `style` CSS on the Box itself.
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
  /** CSS selector for descendants whose border boxes are included in
   * `measurement.rects` when Box measures. Coordinates are relative to this
   * Box's top-left border edge; matches are in document order. */
  includeRectsFor?: string
  /** Inner spacing, matching CSS `padding`. Numbers are pixels; strings accept
   * CSS shorthand, percentages, and custom properties. Omission adds no style. */
  padding?: number | string
  /** Outer spacing, matching CSS `margin`. Numbers are pixels; strings accept
   * CSS shorthand, `auto`, negative lengths, and custom properties.
   * Omission adds no style. */
  margin?: number | string
  /** One selection or an array of selections, in any order. `'size'` watches width
   * and height; `'context'` watches rendering context; `'overflow'` watches
   * content dimensions and clipping. `'edges'` reports which edges hide content;
   * `'scroll'` reports offsets, potentially every frame; `'all'` selects everything.
   * Selections are independent: use `['size', 'edges']` to combine them.
   * A measurement handler implies `'size'` when no measurement is selected;
   * a context handler adds `'context'`. Size skips content and scroll observers;
   * overflow adds content observation; hidden edges and scroll add scroll reads.
   * Without handlers or `fade`, omission stays idle. */
  observe?: BoxObservation | readonly BoxObservation[]
  /** Minimum interval between measurement events, in milliseconds. The first
   * report has no added delay; a trailing report delivers the latest values.
   * Active observers and CSS clipping states are not throttled.
   * @defaultValue 0 */
  throttle?: number
  /** Fades out every edge that currently hides clipped content, and drops the
   * fade from an edge once the reader scrolls to it. */
  fade?: boolean
  /** Depth of the `fade` gradient. A `number` is pixels; a string is any CSS
   * length.
   * @defaultValue 24 */
  fadeSize?: number | string
  /** Fired when a selected measurement field changes. `detail.changed` contains
   * changed measurement fields; `detail.current` includes matching rects. */
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
}

/** Adds handler defaults without widening an explicit measurement selection. */
function observeAttr(
  observe: BoxProps['observe'],
  onMeasureChange: unknown,
  onContextChange: unknown,
): string | undefined {
  const tokens = [...new Set(observe == null ? [] : typeof observe === 'string' ? [observe] : observe)]
  const { fields, context } = boxObservation(tokens.join(' ') || null)
  if (onMeasureChange != null && fields.size === 0) tokens.push('size')
  if (onContextChange != null && !context) tokens.push('context')
  return tokens.join(' ') || undefined
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
export const Box = ({
  display,
  round,
  gap,
  includeRectsFor,
  padding,
  margin,
  observe,
  throttle,
  fade,
  fadeSize,
  onMeasureChange,
  onContextChange,
  className,
  style,
  children,
  ...rest
}: BoxProps) => {
  let boxStyle = roundStyle(round, '--box-round', style)
  boxStyle = lengthStyle(gap, '--box-gap', boxStyle)
  boxStyle = lengthStyle(padding, '--box-padding', boxStyle)
  boxStyle = lengthStyle(margin, '--box-margin', boxStyle)
  boxStyle = lengthStyle(fade ? fadeSize : undefined, '--box-fade-size', boxStyle)
  return (
    <a-box
      display={display === 'block' ? undefined : display}
      round={roundAttr(round)}
      gap={gap != null ? '' : undefined}
      include-rects-for={includeRectsFor}
      padding={padding != null ? '' : undefined}
      margin={margin != null ? '' : undefined}
      observe={observeAttr(observe, onMeasureChange, onContextChange)}
      throttle={throttle}
      fade={fade ? '' : undefined}
      fade-size={fade && fadeSize != null ? cssLength(fadeSize) : undefined}
      onmeasurechange={customEventHandler(onMeasureChange)}
      oncontextchange={customEventHandler(onContextChange)}
      class={className}
      style={boxStyle}
      {...rest}
    >
      {children}
    </a-box>
  )
}
