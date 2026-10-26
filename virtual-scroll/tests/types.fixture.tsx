import { VirtualScroll } from '../src/components/VirtualScroll'
import { mapVirtualScrollRange, readVirtualScrollRange, virtualScrollPositionAttribute } from '../src/core/source'
import type { VirtualScrollItem, VirtualScrollSource } from '../src/core/types'

type LogEvent = { text: string, at: number }

// Rows built on demand: `slice` returns another source, read with `toArray`.
declare class LazyRows<T> {
  get length(): number
  at(n: number): T | undefined
  slice(start?: number, end?: number): LazyRows<T>
  toArray(): T[]
}

declare const events: LogEvent[]
declare const lazyRows: LazyRows<LogEvent>

// Arrays and lazy sources are both sources, and the row type comes through.
const fromArray: VirtualScrollSource<LogEvent> = events
const fromLazyRows: VirtualScrollSource<LogEvent> = lazyRows
const sameItem: LogEvent = null as unknown as VirtualScrollItem<LazyRows<LogEvent>>
const sameArrayItem: LogEvent = null as unknown as VirtualScrollItem<readonly LogEvent[]>
const read: readonly LogEvent[] = readVirtualScrollRange(lazyRows, 0, 10)
const mapped: string[] = mapVirtualScrollRange(lazyRows, { start: 0, end: 10 }, (event, index) => `${index}: ${event.text}`)

// `renderItem` is typed from `items`.
const typedRows = <VirtualScroll items={lazyRows} renderItem={(event, index) => `${index} ${event.text} ${event.at.toFixed()}`} />
const typedArrayRows = <VirtualScroll items={events} rowClassName={event => event.at > 0 ? 'late' : undefined} renderItem={event => event.text} />
// @ts-expect-error The row type is LogEvent, which has no `message`.
const missingField = <VirtualScroll items={lazyRows} renderItem={event => event.message} />
// @ts-expect-error A renderer for another row type does not fit.
const wrongRow = <VirtualScroll items={events} renderItem={(event: { id: string }) => event.id} />
// @ts-expect-error A source of strings is not a source of LogEvent.
const wrongSource: VirtualScrollSource<LogEvent> = null as unknown as LazyRows<string>

// Both mark layers take any iterable of indices; fixed heights are a boolean.
const layered = <VirtualScroll items={events} marks={new Set([1])} secondaryMarks={[2, 3]} itemHeightFixed renderItem={event => event.text} />
const layeredElement = <a-virtual-scroll count={10} marks="1" secondary-marks="2 3" item-height-fixed="" />
// @ts-expect-error Marks are row indices, not rows.
const markedRows = <VirtualScroll items={events} secondaryMarks={events} renderItem={event => event.text} />

// By count, `renderItem` receives the index.
const byIndex = <VirtualScroll count={events.length} renderItem={index => events[index].text} />
// @ts-expect-error By count there is no item to receive.
const countWithItem = <VirtualScroll count={events.length} renderItem={(event: LogEvent) => event.text} />
// @ts-expect-error Rows come from `items` or `count`, not both.
const both = <VirtualScroll items={events} count={3} renderItem={(event: LogEvent) => event.text} />

// Event details are typed.
const handlers = <VirtualScroll items={events} renderItem={event => event.text}
  onRangeChange={(_, { start, end }) => start + end}
  onPositionChange={(_, { anchorIndex, stickToBottom }) => stickToBottom && anchorIndex}
/>
// @ts-expect-error A range has no `length`.
const badDetail = <VirtualScroll items={events} renderItem={event => event.text} onRangeChange={(_, range) => range.length} />

// The element's structured attributes are checked.
const element = <a-virtual-scroll count={10} initial-position={virtualScrollPositionAttribute({ anchorIndex: 4, deltaPixels: -10, scrollX: 0, stickToBottom: false })} />
const literal = <a-virtual-scroll count={10} initial-position="4 -10 0 1" reveal-x="100 220 96 0" wheel-activation="settled" />
// @ts-expect-error `initial-position` needs all four values.
const shortPosition = <a-virtual-scroll count={10} initial-position="4 -10" />
// @ts-expect-error Unknown activation modes do not compile.
const badActivation = <a-virtual-scroll count={10} wheel-activation="always" />
const elementEvents = <a-virtual-scroll count={10} onrangechange={event => 'detail' in event ? event.detail.start : event.nativeEvent.detail.end} />

void [fromArray, fromLazyRows, sameItem, sameArrayItem, read, mapped, typedRows, typedArrayRows, missingField, wrongRow, wrongSource,
  layered, layeredElement, markedRows, byIndex, countWithItem, both, handlers, badDetail, element, literal, shortPosition, badActivation, elementEvents]
