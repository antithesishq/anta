// A stand-in for a worker renderer: it answers `rangechange` after a delay by
// mounting exactly the requested rows, keyed by `data-index`.
import '@antadesign/anta/tokens.css'
import '../src/entries/elements/a-virtual-scroll'

type Options = {
  count: number
  delay: number
  follow: boolean
  wide: boolean
  /** Rows pinned to `itemMinHeight` by CSS, with `item-height-fixed` set. */
  fixedHeight?: boolean
  height?: number
  maxHeight?: number
  itemMinHeight: number
  /** Rows appended per tick while streaming. */
  streamChunk: number
  /** `initial-position`, applied before the element connects. */
  initialPosition?: string
}

const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua error'.split(' ')

function textFor(index: number): string {
  let s = index * 2654435761 % 2 ** 32
  const words: string[] = []
  const length = 3 + (s % 7 === 0 ? 60 : s % 18)
  for (let i = 0; i < length; i++) {
    s = (s * 1103515245 + 12345) % 2 ** 31
    words.push(WORDS[s % WORDS.length])
  }
  return words.join(' ')
}

function matches(index: number): boolean {
  return index % 37 === 5
}

declare global {
  interface Window {
    mountList: (options?: Partial<Options>) => HTMLElement
    list: HTMLElement
    rendered: () => number[]
    ranges: { start: number, end: number }[]
    positions: unknown[]
    contentSizes: { height: number | null, width: number }[]
    renders: number
    setDelay: (ms: number) => void
    stream: (on: boolean) => void
    revealMatch: (step: 1 | -1) => void
    frames: (count?: number) => Promise<void>
  }
}

let options: Options
let pending: ReturnType<typeof setTimeout> | undefined
let streamTimer: ReturnType<typeof setInterval> | undefined
let activeMatch = -1

function row(index: number): HTMLElement {
  const el = document.createElement('div')
  el.className = options.fixedHeight ? 'demo-row fixed' : 'demo-row'
  el.dataset.index = String(index)
  const text = textFor(index)
  if (options.wide) {
    el.classList.add('wide')
    const pinned = document.createElement('div')
    pinned.className = 'pinned'
    pinned.textContent = `#${index}`
    el.append(pinned)
    for (let c = 0; c < 8; c++) {
      const cell = document.createElement('div')
      cell.className = 'cell'
      cell.textContent = c === 5 && matches(index) ? '' : `${text.slice(0, 40)} ${c}`
      if (c === 5 && matches(index)) {
        const mark = document.createElement('mark')
        mark.className = 'match'
        mark.textContent = 'error'
        cell.append('needle: ', mark)
      }
      el.append(cell)
    }
  } else {
    const label = document.createElement('b')
    label.textContent = `${index} `
    el.append(label, text)
    if (matches(index)) {
      const mark = document.createElement('mark')
      mark.className = 'match'
      mark.textContent = ' error '
      el.append(mark, ' tail text after the match')
    }
  }
  return el
}

function renderRange(start: number, end: number) {
  window.renders++
  const list = window.list
  const existing = new Map<number, Element>()
  for (const child of Array.from(list.children)) {
    if (child.hasAttribute('slot')) continue
    const index = Number((child as HTMLElement).dataset.index)
    if (index < start || index >= end) child.remove()
    else existing.set(index, child)
  }
  let before: Element | null = null
  for (let index = end - 1; index >= start; index--) {
    let el = existing.get(index)
    if (!el) el = row(index)
    if (el.nextElementSibling !== before || el.parentNode !== list) list.insertBefore(el, before)
    if (index === activeMatch) el.querySelector('mark')?.classList.add('active')
    else el.querySelector('mark.active')?.classList.remove('active')
    before = el
  }
}

window.mountList = (overrides = {}) => {
  options = { count: 100_000, delay: 16, follow: false, wide: false, itemMinHeight: 22, streamChunk: 3, ...overrides }
  window.list?.remove()
  window.ranges = []
  window.positions = []
  window.contentSizes = []
  window.renders = 0
  activeMatch = -1
  const list = document.createElement('a-virtual-scroll')
  list.setAttribute('count', String(options.count))
  list.setAttribute('item-min-height', String(options.itemMinHeight))
  list.setAttribute('tabindex', '0')
  list.setAttribute('scrollbar-hint', '')
  if (options.follow) list.setAttribute('follow', '')
  if (options.height !== undefined) list.setAttribute('height', String(options.height))
  if (options.maxHeight !== undefined) list.setAttribute('max-height', String(options.maxHeight))
  if (options.initialPosition) list.setAttribute('initial-position', options.initialPosition)
  if (options.wide) list.setAttribute('content-width', String(120 + 8 * 260))
  if (options.fixedHeight) list.setAttribute('item-height-fixed', '')
  list.setAttribute('marks', Array.from({ length: options.count }, (_, i) => i).filter(matches).slice(0, 5000).join(' '))
  const empty = document.createElement('div')
  empty.slot = 'empty'
  empty.textContent = 'No data to display'
  list.append(empty)
  list.addEventListener('rangechange', event => {
    const { start, end } = (event as CustomEvent<{ start: number, end: number }>).detail
    window.ranges.push({ start, end })
    clearTimeout(pending)
    if (options.delay <= 0) renderRange(start, end)
    else pending = setTimeout(() => renderRange(start, end), options.delay)
  })
  list.addEventListener('positionchange', event => window.positions.push((event as CustomEvent).detail))
  list.addEventListener('contentsizechange', event => window.contentSizes.push((event as CustomEvent).detail))
  window.list = list
  document.querySelector('#mount')!.append(list)
  return list
}

window.rendered = () => Array.from(window.list.children)
  .filter(child => !child.hasAttribute('slot'))
  .map(child => Number((child as HTMLElement).dataset.index))

window.setDelay = ms => { options.delay = ms }

window.stream = on => {
  clearInterval(streamTimer)
  if (!on) return
  streamTimer = setInterval(() => {
    options.count += options.streamChunk
    window.list.setAttribute('count', String(options.count))
    window.list.setAttribute('content-key', String(options.count))
  }, 100)
}

window.revealMatch = step => {
  let next = activeMatch
  do next += step
  while (next >= 0 && next < options.count && !matches(next))
  if (next < 0 || next >= options.count) return
  activeMatch = next
  const list = window.list
  list.setAttribute('reveal-target', 'mark.match.active')
  list.setAttribute('reveal-key', `${next}:0`)
  list.setAttribute('reveal-index', String(next))
  if (options.wide) list.setAttribute('reveal-x', `${120 + 5 * 260} 260 120 0`)
  // Re-mark the active match on mounted rows, as a worker re-render would.
  for (const child of Array.from(list.children)) {
    const index = Number((child as HTMLElement).dataset.index)
    child.querySelector('mark')?.classList.toggle('active', index === next)
  }
}

window.frames = async (count = 3) => {
  for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame)
}
