import { createElement } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'

/** Registers `<a-virtual-scroll>` from its package, after the island mounts in the browser. */
export function useVirtualScrollElement() {
  useEffect(() => { import('@antadesign/virtual-scroll/elements/a-virtual-scroll') }, [])
}

export type Range = { start: number, end: number }

export type Position = {
  anchorIndex: number
  deltaPixels: number
  scrollX: number
  maxScrollX: number
  stickToBottom: boolean
  atEnd: boolean
  firstVisibleIndex: number
}

/**
 * Answers `rangechange` by rendering the requested rows after `delay` milliseconds,
 * the way a worker answers after a render and a `postMessage`.
 */
export function useRemoteRows(delay = 0) {
  const [range, setRange] = useState<Range>({ start: 0, end: 0 })
  const delayRef = useRef(delay)
  delayRef.current = delay
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  const onRangeChange = useCallback((event: CustomEvent<Range>) => {
    const next = event.detail
    clearTimeout(timer.current)
    const apply = () => setRange(prev => prev.start === next.start && prev.end === next.end ? prev : next)
    if (delayRef.current <= 0) apply()
    else timer.current = setTimeout(apply, delayRef.current)
  }, [])
  return { range, onRangeChange }
}

const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ')

/** Deterministic text per row, so a row always has the same height. About one row in seven wraps over several lines. */
export function rowText(index: number, words = 0): string {
  let s = (index * 2654435761) % 2 ** 32
  const length = words || 3 + (s % 7 === 0 ? 50 : s % 16)
  const out: string[] = []
  for (let i = 0; i < length; i++) {
    s = (s * 1103515245 + 12345) % 2 ** 31
    out.push(WORDS[s % WORDS.length])
  }
  return out.join(' ')
}

/** `<a-virtual-scroll>` with attributes in the element's own spelling. */
export function VirtualScrollElement({ children, ...attributes }: Record<string, unknown> & { children?: ComponentChildren }) {
  return createElement('a-virtual-scroll', attributes, children)
}

/** Renders the rows in `range` that exist in a list of `count` rows. */
export function rowsFor(range: Range, count: number, render: (index: number) => ComponentChildren): ComponentChildren[] {
  const rows: ComponentChildren[] = []
  for (let index = range.start; index < Math.min(range.end, count); index++) rows.push(render(index))
  return rows
}
