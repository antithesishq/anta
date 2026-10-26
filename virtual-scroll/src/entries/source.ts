// Renderer-free: no JSX runtime and no DOM, so a worker-side renderer can import it.
export {
  initialVirtualScrollRange, mapVirtualScrollRange, readVirtualScrollRange, virtualScrollMarksAttribute,
  virtualScrollPositionAttribute, virtualScrollRevealXAttribute,
} from '../core/source'
export type { InitialRangeOptions } from '../core/source'
export type {
  VirtualScrollContentSize, VirtualScrollItem, VirtualScrollPosition, VirtualScrollPositionAttribute,
  VirtualScrollRange, VirtualScrollRangeSource, VirtualScrollRestorePosition, VirtualScrollRevealX,
  VirtualScrollRevealXAttribute, VirtualScrollSource, VirtualScrollWheelActivation,
} from '../core/types'
