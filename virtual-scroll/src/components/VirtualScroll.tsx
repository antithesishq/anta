import { customEventHandler } from '@antadesign/anta/anta_helpers'
import { useState } from '@antadesign/anta/jsx-runtime'
import type { BaseProps } from '@antadesign/anta/general_types'
import type {
  VirtualScrollContentSize, VirtualScrollPosition, VirtualScrollRange, VirtualScrollRestorePosition,
  VirtualScrollRevealX, VirtualScrollSource, VirtualScrollWheelActivation,
} from '../core/types'
import {
  initialVirtualScrollRange, mapVirtualScrollRange, virtualScrollMarksAttribute,
  virtualScrollPositionAttribute, virtualScrollRevealXAttribute,
} from '../core/source'

// Re-exporting the attribute type also registers `<a-virtual-scroll>` with Anta's JSX types.
export type { AVirtualScrollAttributes } from '../elements/attributes'

/** A target to bring into view: a row, optionally a descendant of it, and optionally a horizontal span. */
export interface VirtualScrollReveal {
  index: number
  /** Changing the key reveals again, even for the same row. Defaults to the index. */
  key?: string
  /** Selector inside the row whose top is centered instead of the row's. */
  target?: string
  /** Horizontal span in content pixels, kept clear of pinned insets on either side. */
  x?: VirtualScrollRevealX
}

/** Props shared by both ways of supplying rows. */
export interface VirtualScrollBaseProps extends BaseProps {
  /** Minimum row height in pixels; rows not measured yet are assumed to be this tall.
   * @defaultValue 22 */
  itemMinHeight?: number
  /** Up to this many rows, every row stays mounted and the scrollbar is exact.
   * @defaultValue 500 */
  maxNonVirtualItems?: number
  /** Vertical scrollbar width and horizontal scrollbar thickness, in pixels.
   * @defaultValue 16 */
  scrollbarWidth?: number
  /** Width every row shares. Omit to measure the widest mounted row. */
  contentWidth?: number
  /** Height in pixels. Without `height` or `maxHeight` the list is 500px tall, or shorter when its rows fit. */
  height?: number
  maxHeight?: number
  /** Start at the end and keep following new rows until the reader scrolls up. */
  follow?: boolean
  /** Change when the data changes in a way that invalidates measured row heights. */
  contentKey?: string
  /** Position to start from, as reported by `onPositionChange`. Read once, on mount. */
  initialPosition?: VirtualScrollRestorePosition
  reveal?: VirtualScrollReveal
  /** Row indices to mark on the scrollbar track, such as search matches. */
  marks?: Iterable<number>
  /** Row indices to mark in a muted color under `marks`, such as rows the application flagged. */
  secondaryMarks?: Iterable<number>
  /** Every row is exactly `itemMinHeight` tall, so rows are not measured. Use it when CSS pins the row height. */
  itemHeightFixed?: boolean
  /** When an unmodified wheel starts scrolling the list.
   * @defaultValue hover */
  wheelActivation?: VirtualScrollWheelActivation
  /** Show the keyboard-shortcut hint on the scrollbars. */
  scrollbarHint?: boolean
  /** Space-separated key combinations, such as `Mod+f`, whose browser default is prevented so the application can handle them. `Mod` is Cmd on macOS and Ctrl elsewhere. */
  interceptKeys?: string
  /** Content pinned above the rows that scrolls horizontally with them, such as a table header. */
  header?: React.ReactNode
  /** Shown when there are no rows. */
  empty?: React.ReactNode
  onRangeChange?: (event: CustomEvent<VirtualScrollRange>, detail: VirtualScrollRange) => void
  onPositionChange?: (event: CustomEvent<VirtualScrollPosition>, detail: VirtualScrollPosition) => void
  onContentSizeChange?: (event: CustomEvent<VirtualScrollContentSize>, detail: VirtualScrollContentSize) => void
}

/** Rows from a data source. `T` is inferred from `items`, so `renderItem` receives typed rows. */
export interface VirtualScrollItemsProps<T> extends VirtualScrollBaseProps {
  /** The rows: an array, or a range source that builds rows on demand. Only mounted rows are read. */
  items: VirtualScrollSource<T>
  /** Renders one mounted row. */
  renderItem: (item: T, index: number) => React.ReactNode
  /** Class for each row's wrapper. */
  rowClassName?: (item: T, index: number) => string | undefined
  count?: never
}

/** Rows by index, when the application looks rows up itself. */
export interface VirtualScrollCountProps extends VirtualScrollBaseProps {
  /** Number of rows. */
  count: number
  /** Renders one mounted row. */
  renderItem: (index: number) => React.ReactNode
  /** Class for each row's wrapper. */
  rowClassName?: (index: number) => string | undefined
  items?: never
}

export type VirtualScrollProps<T = unknown> = VirtualScrollItemsProps<T> | VirtualScrollCountProps

/**
 * A virtualized list. The element owns scrolling and tells this wrapper which
 * rows to mount; the wrapper keeps that range as state and renders only those rows.
 *
 * @example
 * ```tsx
 * <VirtualScroll items={events} follow renderItem={(event, index) => <code>{event.text}</code>} />
 * ```
 */
export function VirtualScroll<T>(props: VirtualScrollItemsProps<T>): React.ReactNode
export function VirtualScroll(props: VirtualScrollCountProps): React.ReactNode
export function VirtualScroll<T>(props: VirtualScrollProps<T>): React.ReactNode {
  const {
    itemMinHeight,
    maxNonVirtualItems,
    scrollbarWidth,
    contentWidth,
    height,
    maxHeight,
    follow,
    contentKey,
    initialPosition,
    reveal,
    marks,
    secondaryMarks,
    itemHeightFixed,
    wheelActivation,
    scrollbarHint,
    interceptKeys,
    header,
    empty,
    onRangeChange,
    onPositionChange,
    onContentSizeChange,
    className,
    style,
    children: _children,
    ...rest
  } = props
  const count = props.items !== undefined ? props.items.length : props.count
  const [range, setRange] = useState<VirtualScrollRange>(() => initialVirtualScrollRange({
    count, follow, height, maxHeight, itemMinHeight, maxNonVirtualItems, initialPosition,
  }))

  const row = (index: number, rowClass: string | undefined, content: React.ReactNode) =>
    <div key={index} data-index={index} className={rowClass}>{content}</div>
  const rows: React.ReactNode[] = []
  if (props.items !== undefined) {
    const { renderItem, rowClassName } = props
    rows.push(...mapVirtualScrollRange(props.items, range, (item, index) => row(index, rowClassName?.(item, index), renderItem(item, index))))
  } else {
    const { renderItem, rowClassName } = props
    for (let index = range.start; index < Math.min(range.end, count); index++) {
      rows.push(row(index, rowClassName?.(index), renderItem(index)))
    }
  }

  const { items: _items, count: _count, renderItem: _renderItem, rowClassName: _rowClassName, ...attributes } = rest
  return (
    <a-virtual-scroll
      count={count}
      item-min-height={itemMinHeight}
      max-non-virtual={maxNonVirtualItems}
      scrollbar-width={scrollbarWidth}
      content-width={contentWidth}
      height={height}
      max-height={maxHeight}
      follow={follow ? '' : undefined}
      content-key={contentKey}
      initial-position={initialPosition && virtualScrollPositionAttribute(initialPosition)}
      reveal-index={reveal?.index}
      reveal-key={reveal ? reveal.key ?? String(reveal.index) : undefined}
      reveal-target={reveal?.target}
      reveal-x={reveal?.x && virtualScrollRevealXAttribute(reveal.x)}
      marks={marks && virtualScrollMarksAttribute(marks)}
      secondary-marks={secondaryMarks && virtualScrollMarksAttribute(secondaryMarks)}
      item-height-fixed={itemHeightFixed ? '' : undefined}
      wheel-activation={wheelActivation}
      scrollbar-hint={scrollbarHint ? '' : undefined}
      intercept-keys={interceptKeys}
      tabIndex={0}
      className={className}
      style={style}
      onrangechange={customEventHandler<VirtualScrollRange>((event, detail) => {
        setRange(detail)
        onRangeChange?.(event, detail)
      })}
      onpositionchange={customEventHandler(onPositionChange)}
      oncontentsizechange={customEventHandler(onContentSizeChange)}
      {...attributes}
    >
      {header != null && <div slot="header">{header}</div>}
      {empty != null && <div slot="empty">{empty}</div>}
      {rows}
    </a-virtual-scroll>
  )
}
