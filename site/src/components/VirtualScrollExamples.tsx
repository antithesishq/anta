import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { Button, Input, Tag } from '@antadesign/anta'
import { VirtualScroll } from '@antadesign/virtual-scroll'
import type { VirtualScrollRange, VirtualScrollRangeSource } from '@antadesign/virtual-scroll'
import styles from './VirtualScrollDemo.module.css'
import {
  VirtualScrollElement, rowText, rowsFor, useRemoteRows, useVirtualScrollElement,
  type Position,
} from './virtual-scroll-kit'

export type VirtualScrollExampleName = 'large' | 'wide' | 'growing' | 'marks' | 'restore' | 'sizes' | 'inputs'

function TextRow({ index, text, className, onClick }: { index: number, text?: ComponentChildren, className?: string, onClick?: () => void }) {
  return (
    <div key={index} data-index={index} className={className ? `${styles.row} ${className}` : styles.row} onClick={onClick}>
      <b className={styles.index}>{index}</b> {text ?? rowText(index)}
    </div>
  )
}

type LogLine = { id: number, text: string }

/** 1,000 log lines built on demand: only a sliced range is ever created. */
const LOG_LINES: VirtualScrollRangeSource<LogLine> = {
  length: 1_000,
  slice: (start, end) => ({
    toArray: () => Array.from({ length: Math.max(0, end - start) }, (_, i) => ({ id: start + i, text: rowText(start + i) })),
  }),
}

/** 1. A large static list with the typed wrapper: `renderItem` receives `LogLine` rows. */
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
        rowClassName={() => styles.row}
        renderItem={line => <><b className={styles.index}>{line.id}</b> {line.text}</>}
        onRangeChange={(_, detail) => setRange(detail)}
      />
      <div className={styles.readout}>
        <Tag size="small" label="Rows" value={LOG_LINES.length.toLocaleString()} />
        <Tag size="small" label="Mounted" value={`${range.start} to ${range.end}`} />
      </div>
    </div>
  )
}

/** 2. A larger list whose rows are wider than the list, so it scrolls in both directions. */
function WideExample() {
  useVirtualScrollElement()
  const count = 10_000
  const remote = useRemoteRows()
  return (
    <div className={styles.demo}>
      <VirtualScrollElement className={styles.list} tabIndex={0} aria-label="10,000 wide rows" count={count} height={300}
        onrangechange={remote.onRangeChange}>
        {rowsFor(remote.range, count, index => (
          <div key={index} data-index={index} className={`${styles.row} ${styles.wide}`}>
            <b className={styles.index}>{index}</b> {rowText(index, 36)}
          </div>
        ))}
      </VirtualScrollElement>
      <div className={styles.readout}>
        <Tag size="small" label="Rows" value={count.toLocaleString()} />
        <Tag size="small" label="Mounted" value={`${remote.range.start} to ${remote.range.end}`} />
      </div>
    </div>
  )
}

/** 3. A list that keeps growing. It follows the newest row until the reader scrolls up, and again once they scroll back down. */
function GrowingExample() {
  useVirtualScrollElement()
  const [count, setCount] = useState(120)
  const [running, setRunning] = useState(true)
  const [position, setPosition] = useState<Position | undefined>(undefined)
  const remote = useRemoteRows()
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setCount(n => n + 1), 200)
    return () => clearInterval(id)
  }, [running])
  const following = position ? position.stickToBottom : true
  return (
    <div className={styles.demo}>
      <div className={styles.toolbar}>
        <Button size="small" priority="secondary" label={running ? 'Pause' : 'Resume'} onClick={() => setRunning(r => !r)} />
        <Tag size="small" tone={following ? 'success' : 'warning'} label="Following" value={following ? 'yes' : 'no, scrolled away'} />
        <Tag size="small" label="Rows" value={String(count)} />
      </div>
      <VirtualScrollElement className={styles.list} tabIndex={0} aria-label="Growing list" count={count} height={260} follow=""
        onrangechange={remote.onRangeChange} onpositionchange={(event: CustomEvent<Position>) => setPosition(event.detail)}>
        {rowsFor(remote.range, count, index => <TextRow index={index} />)}
      </VirtualScrollElement>
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
  const remote = useRemoteRows()
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
      <VirtualScrollElement className={styles.list} tabIndex={0} aria-label="Searchable list" count={count} height={300}
        marks={matches.join(' ') || undefined}
        secondary-marks={[...bookmarks].sort((a, b) => a - b).join(' ') || undefined}
        reveal-index={active} reveal-key={active === undefined ? undefined : `match:${active}`} reveal-target="mark[data-active]"
        onrangechange={remote.onRangeChange}>
        {rowsFor(remote.range, count, index => (
          <TextRow index={index} text={highlight(rowText(index), needle, index === active)}
            className={bookmarks.has(index) ? styles.bookmarked : undefined} onClick={() => toggleBookmark(index)} />
        ))}
      </VirtualScrollElement>
    </div>
  )
}

/** 5. Jumping to a row, and reopening the list where the reader left it. */
function RestoreExample() {
  useVirtualScrollElement()
  const count = 500
  const [generation, setGeneration] = useState(0)
  const [initial, setInitial] = useState<string | undefined>(undefined)
  const [row, setRow] = useState('250')
  const [position, setPosition] = useState<Position | undefined>(undefined)
  const [jump, setJump] = useState<{ index: number, key: number } | undefined>(undefined)
  const remote = useRemoteRows()
  const reopen = (value: string) => {
    setJump(undefined)
    setInitial(value)
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
          onClick={() => position && reopen(`${position.anchorIndex} ${position.deltaPixels} ${position.scrollX} 0`)} />
        <Tag size="small" label="Last position" value={position ? `row ${position.anchorIndex}, ${position.deltaPixels.toFixed(1)}px` : 'scroll first'} />
      </div>
      <VirtualScrollElement key={generation} className={styles.list} tabIndex={0} aria-label="Restorable list" count={count} height={260}
        initial-position={initial} reveal-index={jump?.index} reveal-key={jump && `jump:${jump.key}`}
        onrangechange={remote.onRangeChange} onpositionchange={(event: CustomEvent<Position>) => setPosition(event.detail)}>
        {rowsFor(remote.range, count, index => <TextRow index={index} />)}
      </VirtualScrollElement>
    </div>
  )
}

function SizedList({ count, label, ...attributes }: { count: number, label: string } & Record<string, unknown>) {
  const remote = useRemoteRows()
  return (
    <div>
      <p className={styles.caption}>{label}</p>
      <VirtualScrollElement className={styles.list} tabIndex={0} aria-label={label} count={count} onrangechange={remote.onRangeChange} {...attributes}>
        <div slot="empty">No data to display</div>
        {rowsFor(remote.range, count, index => <TextRow index={index} />)}
      </VirtualScrollElement>
    </div>
  )
}

/** 6. How `height` and `max-height` size short, long, and empty lists. */
function SizesExample() {
  useVirtualScrollElement()
  return (
    <div className={styles.columns}>
      <SizedList count={3} label="3 rows, no height: fits its rows" />
      <SizedList count={3} height={160} label='3 rows, height="160"' />
      <SizedList count={40} max-height={160} label='40 rows, max-height="160"' />
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
 * handled it: the list, the application through `intercept-keys`, or nobody,
 * in which case the browser's default action runs.
 */
function InputsExample() {
  useVirtualScrollElement()
  const count = 1_000
  const remote = useRemoteRows()
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
      <VirtualScrollElement className={styles.list} tabIndex={0} aria-label="Keyboard and wheel test" count={count} height={240}
        intercept-keys="Mod+f"
        onKeyDown={(event: KeyboardEvent) => {
          // The application's own shortcut. `intercept-keys` keeps the browser's find bar closed.
          if (event.key.toLowerCase() === 'f' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) handledByApp.current = true
        }}
        onrangechange={remote.onRangeChange}>
        {rowsFor(remote.range, count, index => (
          <div key={index} data-index={index} className={`${styles.row} ${styles.wide}`}>
            <b className={styles.index}>{index}</b> {rowText(index, 30)}
          </div>
        ))}
      </VirtualScrollElement>
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
