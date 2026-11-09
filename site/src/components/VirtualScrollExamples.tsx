import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { Button, Input, Tag } from '@antadesign/anta'
import { VirtualScroll } from '@antadesign/virtual-scroll'
import type { VirtualScrollPosition, VirtualScrollRange, VirtualScrollRestorePosition } from '@antadesign/virtual-scroll'
import styles from './VirtualScrollDemo.module.css'
import { rowText, useVirtualScrollElement } from './virtual-scroll-kit'

export type VirtualScrollExampleName = 'large' | 'wide' | 'growing' | 'marks' | 'restore' | 'sizes' | 'inputs'

const rowClass = () => styles.row
const wideRowClass = () => `${styles.row} ${styles.wide}`

function IndexedText({ index, text }: { index: number, text?: ComponentChildren }) {
  return <><b className={styles.index}>{index}</b> {text ?? rowText(index)}</>
}

type LogLine = { id: number, text: string }

const LOG_LINES: LogLine[] = Array.from({ length: 1_000 }, (_, id) => ({ id, text: rowText(id) }))

/** 1. A large list of typed rows: `renderItem` receives `LogLine` rows. */
function LargeExample() {
  useVirtualScrollElement()
  const [range, setRange] = useState<VirtualScrollRange>({ start: 0, end: 0 })
  return (
    <div className={styles.demo}>
      <VirtualScroll
        className={styles.list}
        aria-label="1,000 rows"
        items={LOG_LINES}
        height={300}
        rowClassName={rowClass}
        renderItem={line => <IndexedText index={line.id} text={line.text} />}
        onRangeChange={(_, detail) => setRange(detail)}
      />
      <div className={styles.readout}>
        <Tag size="small" label="Rows" value={LOG_LINES.length.toLocaleString()} />
        <Tag size="small" label="Mounted" value={`${range.start} to ${range.end}`} />
      </div>
    </div>
  )
}

/** 2. A larger list with a fixed row width wider than the list, so it scrolls in both directions. */
function WideExample() {
  useVirtualScrollElement()
  const count = 10_000
  const [range, setRange] = useState<VirtualScrollRange>({ start: 0, end: 0 })
  return (
    <div className={styles.demo}>
      <VirtualScroll className={styles.list} aria-label="10,000 wide rows" count={count} height={300} contentWidth={2400}
        rowClassName={wideRowClass}
        renderItem={index => <IndexedText index={index} text={rowText(index, 36)} />}
        onRangeChange={(_, detail) => setRange(detail)} />
      <div className={styles.readout}>
        <Tag size="small" label="Rows" value={count.toLocaleString()} />
        <Tag size="small" label="Mounted" value={`${range.start} to ${range.end}`} />
      </div>
    </div>
  )
}

/** 3. A list that keeps growing. It follows the newest row until the reader scrolls up, and again once they scroll back down. */
function GrowingExample() {
  useVirtualScrollElement()
  const [count, setCount] = useState(120)
  const [running, setRunning] = useState(true)
  const [following, setFollowing] = useState(true)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setCount(n => n + 1), 200)
    return () => clearInterval(id)
  }, [running])
  return (
    <div className={styles.demo}>
      <div className={styles.toolbar}>
        <Button size="small" priority="secondary" label={running ? 'Pause' : 'Resume'} onClick={() => setRunning(r => !r)} />
        <Tag size="small" tone={following ? 'success' : 'warning'} label="Following" value={following ? 'yes' : 'no, scrolled away'} />
        <Tag size="small" label="Rows" value={String(count)} />
      </div>
      <VirtualScroll className={styles.list} aria-label="Growing list" count={count} height={260} follow
        rowClassName={rowClass}
        renderItem={index => <IndexedText index={index} />}
        onPositionChange={(_, position) => setFollowing(position.stickToBottom)} />
    </div>
  )
}

/** Splits text around every occurrence of `query`. This is the demo's code, not the list's. */
function highlight(text: string, query: string, active: boolean): ComponentChildren {
  if (!query) return text
  const parts: ComponentChildren[] = []
  let from = 0
  let first = true
  for (let at = text.indexOf(query); at !== -1; at = text.indexOf(query, at + query.length)) {
    parts.push(text.slice(from, at))
    parts.push(<mark className={styles.hit} data-active={active && first ? '' : undefined}>{query}</mark>)
    first = false
    from = at + query.length
  }
  parts.push(text.slice(from))
  return parts
}

/** The row a click landed in, from the `data-index` the list puts on every row. */
function clickedIndex(event: MouseEvent): number | undefined {
  const row = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-index]') : null
  return row ? Number(row.dataset.index) : undefined
}

/**
 * 4. Scrollbar marks. The application decides which rows match and highlights
 * words inside them; the list only draws `marks` on its track and brings a row into view.
 */
function MarksExample() {
  useVirtualScrollElement()
  const count = 200
  const [query, setQuery] = useState('magna tempor')
  const [active, setActive] = useState<number | undefined>(undefined)
  // The application's own bookmarks: a click toggles one. The list only draws them on its track.
  const [bookmarks, setBookmarks] = useState<ReadonlySet<number>>(() => new Set([1, 40, 95, 150]))
  const toggleBookmark = (index: number) => setBookmarks(previous => {
    const next = new Set(previous)
    if (!next.delete(index)) next.add(index)
    return next
  })
  const needle = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (needle.length < 2) return []
    const found: number[] = []
    for (let i = 0; i < count; i++) if (rowText(i).includes(needle)) found.push(i)
    return found
  }, [needle])
  const go = (step: 1 | -1) => {
    if (!matches.length) return
    const at = active === undefined ? -1 : matches.indexOf(active)
    setActive(matches[(at + step + matches.length) % matches.length])
  }
  return (
    <div className={styles.demo}>
      <div className={styles.toolbar}>
        <label className={styles.field}>
          Find
          <Input size="small" aria-label="Find" value={query} onValueChange={(_, { value }) => { setQuery(value); setActive(undefined) }} style={{ width: 200 }} />
        </label>
        <Button size="small" priority="secondary" label="Previous" onClick={() => go(-1)} />
        <Button size="small" priority="secondary" label="Next" onClick={() => go(1)} />
        <Tag size="small" tone="warning" label="Matching rows" value={matches.length.toLocaleString()} />
        {active !== undefined && <Tag size="small" label="Active" value={`row ${active}`} />}
        <Tag size="small" label="Bookmarks" value={String(bookmarks.size)} />
      </div>
      <VirtualScroll className={styles.list} aria-label="Searchable list" count={count} height={300}
        marks={matches}
        secondaryMarks={bookmarks}
        reveal={active === undefined ? undefined : { index: active, key: `match:${active}`, target: 'mark[data-active]' }}
        rowClassName={index => bookmarks.has(index) ? `${styles.row} ${styles.bookmarked}` : styles.row}
        renderItem={index => <IndexedText index={index} text={highlight(rowText(index), needle, index === active)} />}
        onClick={(event: MouseEvent) => {
          const index = clickedIndex(event)
          if (index !== undefined) toggleBookmark(index)
        }} />
    </div>
  )
}

/** 5. Jumping to a row, and reopening the list where the reader left it. */
function RestoreExample() {
  useVirtualScrollElement()
  const count = 500
  const [generation, setGeneration] = useState(0)
  const [initial, setInitial] = useState<VirtualScrollRestorePosition | undefined>(undefined)
  const [row, setRow] = useState('250')
  const [position, setPosition] = useState<VirtualScrollPosition | undefined>(undefined)
  const [jump, setJump] = useState<{ index: number, key: number } | undefined>(undefined)
  const reopen = (saved: VirtualScrollPosition) => {
    setJump(undefined)
    setInitial({ ...saved, stickToBottom: false })
    setGeneration(g => g + 1)
  }
  const index = Number(row)
  const validRow = Number.isInteger(index) && index >= 0 && index < count
  return (
    <div className={styles.demo}>
      <div className={styles.toolbar}>
        <label className={styles.field}>
          Row
          <Input size="small" aria-label="Row" value={row} inputMode="numeric" onValueChange={(_, { value }) => setRow(value)} style={{ width: 120 }} />
        </label>
        <Button size="small" priority="secondary" label="Jump to row" disabled={!validRow}
          onClick={() => setJump(previous => ({ index, key: (previous?.key ?? 0) + 1 }))} />
        <Button size="small" priority="secondary" label="Reopen where I left off" disabled={!position}
          onClick={() => position && reopen(position)} />
        <Tag size="small" label="Last position" value={position ? `row ${position.anchorIndex}, ${position.deltaPixels.toFixed(1)}px` : 'scroll first'} />
      </div>
      <VirtualScroll key={generation} className={styles.list} aria-label="Restorable list" count={count} height={260}
        initialPosition={initial}
        reveal={jump && { index: jump.index, key: `jump:${jump.key}` }}
        rowClassName={rowClass}
        renderItem={index => <IndexedText index={index} />}
        onPositionChange={(_, detail) => setPosition(detail)} />
    </div>
  )
}

function SizedList({ count, label, height, maxHeight }: { count: number, label: string, height?: number, maxHeight?: number }) {
  return (
    <div>
      <p className={styles.caption}>{label}</p>
      <VirtualScroll className={styles.list} aria-label={label} count={count} height={height} maxHeight={maxHeight}
        empty="No data to display"
        rowClassName={rowClass}
        renderItem={index => <IndexedText index={index} />} />
    </div>
  )
}

/** 6. How `height` and `maxHeight` size short, long, and empty lists. */
function SizesExample() {
  useVirtualScrollElement()
  return (
    <div className={styles.columns}>
      <SizedList count={3} label="3 rows, no height: fits its rows" />
      <SizedList count={3} height={160} label="3 rows, height={160}" />
      <SizedList count={40} maxHeight={160} label="40 rows, maxHeight={160}" />
      <SizedList count={0} label="0 rows: the empty slot" />
    </div>
  )
}

type Outcome = 'list' | 'application' | 'browser'
type LogEntry = { id: number, input: string, outcome: Outcome }

const OUTCOMES: Record<Outcome, string> = {
  list: 'handled by the list',
  application: 'handled by the application',
  browser: 'passed to the browser',
}

function modifiers(event: KeyboardEvent | WheelEvent): string[] {
  return [event.ctrlKey && 'Ctrl', event.metaKey && 'Meta', event.altKey && 'Alt', event.shiftKey && 'Shift']
    .filter((name): name is string => !!name)
}

function describeKey(event: KeyboardEvent): string {
  return [...modifiers(event), event.key === ' ' ? 'Space' : event.key].join('+')
}

function describeWheel(event: WheelEvent): string {
  const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY)
  const direction = sideways ? (event.deltaX > 0 ? 'right' : 'left') : (event.deltaY > 0 ? 'down' : 'up')
  return [...modifiers(event), `wheel ${direction}`].join('+')
}

/**
 * 7. Input. Each key press and wheel gesture over the list is logged with who
 * handled it: the list, the application through `interceptKeys`, or nobody,
 * in which case the browser's default action runs.
 */
function InputsExample() {
  useVirtualScrollElement()
  const count = 1_000
  const [log, setLog] = useState<LogEntry[]>([])
  const nextId = useRef(0)
  const lastWheel = useRef('')
  const container = useRef<HTMLDivElement>(null)
  const handledByApp = useRef(false)

  useEffect(() => {
    const root = container.current
    if (!root) return
    const add = (input: string, event: Event) => {
      // Read the outcome after dispatch, once every listener has run.
      setTimeout(() => {
        const outcome: Outcome = handledByApp.current ? 'application' : event.defaultPrevented ? 'list' : 'browser'
        handledByApp.current = false
        setLog(entries => [{ id: nextId.current++, input, outcome }, ...entries].slice(0, 30))
      })
    }
    const onKey = (event: KeyboardEvent) => {
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return
      add(describeKey(event), event)
    }
    const onWheel = (event: WheelEvent) => {
      const input = describeWheel(event)
      // One entry per gesture, so a trackpad swipe does not flood the log.
      if (input === lastWheel.current) return
      lastWheel.current = input
      setTimeout(() => { lastWheel.current = '' }, 400)
      add(input, event)
    }
    root.addEventListener('keydown', onKey, true)
    root.addEventListener('wheel', onWheel, { capture: true, passive: true })
    return () => {
      root.removeEventListener('keydown', onKey, true)
      root.removeEventListener('wheel', onWheel, true)
    }
  }, [])

  return (
    <div className={styles.demo} ref={container}>
      <VirtualScroll className={styles.list} aria-label="Keyboard and wheel test" count={count} height={240}
        contentWidth={2000}
        interceptKeys="Mod+f"
        onKeyDown={(event: KeyboardEvent) => {
          // The application's own shortcut. `interceptKeys` keeps the browser's find bar closed.
          if (event.key.toLowerCase() === 'f' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) handledByApp.current = true
        }}
        rowClassName={wideRowClass}
        renderItem={index => <IndexedText index={index} text={rowText(index, 30)} />} />
      <div className={styles.log} aria-label="Input log" aria-live="polite">
        {log.length === 0
          ? <span>Click the list, then press keys or scroll. Try Ctrl+F, Alt+Left, Shift+Down, and Ctrl + wheel.</span>
          : log.flatMap(entry => [
            <span key={`${entry.id}i`}>{entry.input}</span>,
            <span key={`${entry.id}o`} className={entry.outcome === 'browser' ? styles.passed : styles.handled}>{OUTCOMES[entry.outcome]}</span>,
          ])}
      </div>
    </div>
  )
}

const EXAMPLES = {
  large: LargeExample,
  wide: WideExample,
  growing: GrowingExample,
  marks: MarksExample,
  restore: RestoreExample,
  sizes: SizesExample,
  inputs: InputsExample,
} satisfies Record<VirtualScrollExampleName, () => unknown>

export function VirtualScrollExample({ example }: { example: VirtualScrollExampleName }) {
  const Example = EXAMPLES[example]
  return <Example />
}
