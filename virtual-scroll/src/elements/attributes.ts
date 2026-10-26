import type { BaseAttributes } from '@antadesign/anta/general_types'
import type {
  VirtualScrollContentSize, VirtualScrollPosition, VirtualScrollPositionAttribute, VirtualScrollRange,
  VirtualScrollRevealXAttribute, VirtualScrollWheelActivation,
} from '../core/types'

/**
 * Attributes for the virtualized list. Rows are its direct children, each with
 * `data-index`; it mounts nothing itself and asks for rows through `rangechange`.
 */
export interface AVirtualScrollAttributes extends BaseAttributes {
  count?: number | string
  'item-min-height'?: number | string
  'max-non-virtual'?: number | string
  'scrollbar-width'?: number | string
  'content-width'?: number | string
  height?: number | string
  'max-height'?: number | string
  follow?: boolean | ''
  'content-key'?: string
  /** Read once, on first connect. Build it with `virtualScrollPositionAttribute`. */
  'initial-position'?: VirtualScrollPositionAttribute
  'reveal-index'?: number | string
  'reveal-key'?: string
  'reveal-target'?: string
  /** Build it with `virtualScrollRevealXAttribute`. */
  'reveal-x'?: VirtualScrollRevealXAttribute
  /** Space-separated row indices. Build it with `virtualScrollMarksAttribute`. */
  marks?: string
  /** Space-separated row indices drawn in a muted color under `marks`, such as rows the application flagged. */
  'secondary-marks'?: string
  /** Every row is exactly `item-min-height` tall; rows are not measured. */
  'item-height-fixed'?: boolean | ''
  /** Space-separated key combinations such as `Mod+f Alt+r`; `Mod` is Cmd on macOS and Ctrl elsewhere. */
  'intercept-keys'?: string
  'wheel-activation'?: VirtualScrollWheelActivation
  'scrollbar-hint'?: boolean | ''
  onrangechange?: (event: CustomEvent<VirtualScrollRange> | { nativeEvent: CustomEvent<VirtualScrollRange> }) => void
  onpositionchange?: (event: CustomEvent<VirtualScrollPosition> | { nativeEvent: CustomEvent<VirtualScrollPosition> }) => void
  oncontentsizechange?: (event: CustomEvent<VirtualScrollContentSize> | { nativeEvent: CustomEvent<VirtualScrollContentSize> }) => void
}

declare module '@antadesign/anta/jsx-runtime' {
  interface AntaIntrinsicElements {
    'a-virtual-scroll': AVirtualScrollAttributes
  }
}
