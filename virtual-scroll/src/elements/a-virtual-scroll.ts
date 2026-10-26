import './a-virtual-scroll.css'
import '@antadesign/anta/elements/a-capture'
import '@antadesign/anta/elements/a-tooltip'
import { HTMLElementBase, IS_MAC, finiteNumber } from '@antadesign/anta/anta_helpers'
import type { CapturePanInput, CapturePointerInput, CaptureWheelInput } from '@antadesign/anta/capture-types'
import {
  DEFAULT_HEIGHT, DEFAULT_ITEM_MIN_HEIGHT, DEFAULT_MAX_NON_VIRTUAL_ITEMS, DEFAULT_SCROLLBAR_WIDTH,
  correct, fixedHeights, horizontalThumb, horizontalThumbDragTarget, horizontalTrackPressTarget, initialState,
  isBottomAligned, isMeasured, knownContentHeight, markPositions, maxNonVirtual, maxScrollX, pruneHeights,
  renderRange, revealState, revealX, rowsOffset, scrollByItem, scrollByPage, scrollByPixels, scrollToEnd,
  scrollToStart, scrollXBy, scrollXTo, scrollableHeight, showHorizontalScrollbar, showVerticalScrollbar,
  thumbDragTarget, trackPressTarget, verticalThumb, visibleIndices, windowBounds,
  type VirtualScrollConfig, type VirtualScrollState,
} from '../core/model'
import type { VirtualScrollContentSize, VirtualScrollPosition, VirtualScrollRange } from '../core/types'

export type { VirtualScrollContentSize, VirtualScrollPosition, VirtualScrollRange } from '../core/types'

const SETTLE_MS = 150
const PAGE_THROTTLE_MS = 60
const PAGE_REPEAT_MS = 200
const REVEAL_X_BUFFER = 16
// The thumb's padding (shadow style `.thumb`), which frames its fill inside the bar.
const THUMB_PADDING = 2
const KEY_STEP = 60
const INTERACTIVE_TARGETS = 'input, textarea, select, button, a[href], [contenteditable]:not([contenteditable="false"]), [role~="textbox"], a-input, a-button, a-menu, a-select'

type KeyCombo = { key: string, ctrl: boolean, meta: boolean, alt: boolean, shift: boolean }

/** Parses `intercept-keys`, e.g. `"Mod+f Shift+Mod+f Alt+r"`. `Mod` is Cmd on macOS and Ctrl elsewhere. */
function parseKeyCombos(value: string | null): KeyCombo[] {
  if (!value) return []
  return value.trim().split(/\s+/).map(token => {
    const parts = token.split('+')
    const key = (parts.pop() ?? '').toLowerCase()
    const mods = new Set(parts.map(part => part.toLowerCase()))
    const mod = mods.has('mod')
    return {
      key,
      ctrl: mods.has('ctrl') || (mod && !IS_MAC),
      meta: mods.has('meta') || (mod && IS_MAC),
      alt: mods.has('alt'),
      shift: mods.has('shift'),
    }
  }).filter(combo => combo.key)
}

function moved(prev: VirtualScrollState, next: VirtualScrollState): boolean {
  return prev.anchorIndex !== next.anchorIndex || prev.deltaPixels !== next.deltaPixels || prev.scrollX !== next.scrollX
}

// `overflow: clip` (after a `hidden` fallback) keeps focus() or find-in-page inside
// a row from scrolling the clip boxes, which would shift rows behind the transform.
// a-tooltip's tokens live on `a-tooltip` in its document stylesheet, which does
// not reach into this shadow root; the scrollbar hints repeat them here. The same
// goes for a-capture's stylesheet; the viewport and scrollbars set their own
// layout, `touch-action`, and `user-select`.
const SHADOW_STYLE = `
  :host {
    display: block;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
  }
  .sizer {
    height: var(--_size, 0px);
  }
  .viewport {
    position: absolute;
    top: 0;
    left: 0;
    right: var(--_vbar, 0px);
    bottom: var(--_hbar, 0px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    overflow: clip;
  }
  slot[name="header"] {
    display: block;
    flex: none;
    transform: translateX(calc(-1 * var(--virtual-scroll-x, 0px)));
  }
  .rows {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    overflow: clip;
  }
  /* Rows share one width: the list's, or the widest row's unbreakable content when that is wider. */
  .rows > slot:not([name]) {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    width: fit-content;
    min-width: max(100%, var(--_cw, 0px));
    transform: translate(calc(-1 * var(--virtual-scroll-x, 0px)), var(--_y, 0px));
  }
  :host(:hover) .rows > slot:not([name]) {
    will-change: transform;
  }
  slot[name="empty"] {
    display: none;
  }
  :host(:state(empty)) slot[name="empty"] {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--_min, 22px);
    color: var(--virtual-scroll-empty-color);
  }
  .gap {
    position: absolute;
    left: 0;
    right: 0;
    display: none;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent calc(var(--_min, 22px) - 1px),
      var(--virtual-scroll-placeholder-line) calc(var(--_min, 22px) - 1px),
      var(--virtual-scroll-placeholder-line) var(--_min, 22px)
    );
  }
  .gap.shown {
    display: block;
  }
  .bar {
    position: absolute;
    z-index: 10;
    display: flex;
    overflow: hidden;
    background: var(--virtual-scroll-bar-bg);
    -webkit-user-drag: none;
    touch-action: none;
    user-select: none;
  }
  .bar.v {
    top: 1px;
    right: 1px;
    bottom: 1px;
    width: var(--_sb, 16px);
    flex-direction: column;
    border-top-right-radius: var(--virtual-scroll-radius);
    border-bottom-right-radius: var(--virtual-scroll-radius);
  }
  .bar.h {
    left: 0;
    right: var(--_vbar, 0px);
    bottom: 0;
    height: var(--_sb, 16px);
    flex-direction: row;
  }
  .bar[hidden] {
    display: none;
  }
  .track-start {
    flex-shrink: 0;
  }
  .track-end {
    flex-grow: 1;
  }
  .track-start,
  .track-end {
    box-shadow: var(--virtual-scroll-track-shadow);
  }
  .bar:hover .track-start,
  .bar:hover .track-end {
    background: var(--virtual-scroll-track-hover-bg);
    box-shadow: var(--virtual-scroll-track-hover-shadow);
  }
  .thumb {
    position: absolute;
    display: flex;
    align-items: stretch;
    padding: 2px;
    -webkit-user-drag: none;
  }
  .bar.v .thumb {
    left: 0;
    right: 0;
  }
  .bar.h .thumb {
    top: 0;
    bottom: 0;
  }
  .thumb-fill {
    flex-grow: 1;
    background: var(--virtual-scroll-thumb);
    box-shadow: var(--virtual-scroll-thumb-shadow);
    border-radius: 24px;
    transition: background-color 0.2s ease-out;
  }
  .thumb:hover > .thumb-fill {
    transition: none;
    background: var(--virtual-scroll-thumb-hover);
  }
  .thumb.dragging > .thumb-fill {
    background: var(--virtual-scroll-thumb-active);
  }
  .marks {
    position: absolute;
    inset: 0;
    pointer-events: none;
    user-select: none;
  }
  .mark {
    position: absolute;
    left: 0;
    right: 0;
    min-height: 2px;
    background: var(--virtual-scroll-mark-bg);
    box-shadow: var(--virtual-scroll-mark-shadow);
  }
  .secondary .mark {
    background: var(--virtual-scroll-secondary-mark-bg);
    box-shadow: none;
  }
  .ring {
    display: none;
    position: absolute;
    inset: 0;
    z-index: 11;
    border: 1px solid var(--virtual-scroll-focus-border);
    border-radius: var(--virtual-scroll-radius);
    pointer-events: none;
  }
  :host(:focus) .ring {
    display: block;
  }
  a-tooltip {
    --tooltip-bg: light-dark(
      color-mix(in oklch, var(--bg-1) 80%, transparent),
      color-mix(in oklch, var(--bg-1) 70%, transparent)
    );
    --tooltip-shadow:
      0 1px 8px color-mix(in oklch, var(--text-1) 15%, transparent),
      0 0 1px color-mix(in oklch, var(--text-1) 50%, transparent);
    --tooltip-radius: 3px;
    --tooltip-max-width: min(calc(100vw - 20px), 80ch);
    --tooltip-border: none;
    --tooltip-backdrop-filter: blur(8px);
  }
  .hint {
    padding: 4px;
  }
  .hint-x {
    display: none;
  }
  :host(:state(scrollable-x)) .hint-x {
    display: inline;
  }
  .hint kbd {
    margin: 1px 2px;
    font: inherit;
    font-variation-settings: inherit;
    font-family: var(--monospace, monospace);
  }
`

const OBSERVED = [
  'count', 'item-min-height', 'max-non-virtual', 'scrollbar-width', 'content-width', 'height', 'max-height',
  'follow', 'content-key', 'reveal-index', 'reveal-key', 'reveal-target', 'reveal-x', 'marks',
  'wheel-activation', 'scrollbar-hint', 'intercept-keys', 'item-height-fixed', 'secondary-marks',
]

type Reveal = {
  key: string
  index: number
  target: string | null
  revealed: boolean
  userScrolled: boolean
  height: number
  xKey: string
}

type Drag =
  | { axis: 'y', startCenter: number }
  | { axis: 'x', startCenter: number }
  | { axis: 'page', direction: 1 | -1, y: number, startCenter: number, timer: ReturnType<typeof setInterval> }

function numberList(value: string | null): number[] {
  if (!value) return []
  return value.trim().split(/\s+/).map(Number).filter(Number.isFinite)
}

function hintContent(doc: Document, vertical: boolean): HTMLElement {
  const box = doc.createElement('div')
  box.className = 'hint'
  const line = (...parts: (string | [string])[]) => {
    box.append(doc.createElement('br'))
    for (const part of parts) {
      if (typeof part === 'string') box.append(part)
      else {
        const kbd = doc.createElement('kbd')
        kbd.textContent = part[0]
        box.append(kbd)
      }
    }
  }
  const title = doc.createElement('b')
  title.textContent = 'Keyboard shortcuts'
  box.append(title)
  const horizontalLine = doc.createElement('span')
  horizontalLine.className = 'hint-x'
  horizontalLine.append(doc.createElement('br'), doc.createElement('br'), 'Hold')
  const shift = doc.createElement('kbd')
  shift.textContent = 'Shift'
  horizontalLine.append(shift, ' to scroll horizontally')
  box.append(horizontalLine)
  if (vertical) {
    line('Press', ['Page Up'], ' / ', ['Page Down'], ' to scroll by page')
    line('Press', ['Ctrl'], '+', ['↑'], ' / ', ['↓'], ' to scroll by line')
    line('Press', ['Home'], ' / ', ['End'], ' to go to the first or last line')
    line('Hold', ['Shift'], ' and click the scroll bar to page up/down')
  }
  box.append(doc.createElement('br'), doc.createElement('br'), 'To scroll with the keyboard, click the')
  line('rows first so the list has focus.')
  return box
}

/**
 * `<a-virtual-scroll>` — a virtualized list that owns its scroll position.
 *
 * The consumer mounts the rows named by `rangechange` as direct children, each
 * with a `data-index` attribute. The element measures them, places them, and
 * handles wheel, touch, keyboard, and scrollbar input on the browser thread, so
 * scrolling never waits for whoever renders the rows (for example a worker).
 * Position is an anchor row plus a pixel offset; see `core/model.ts`.
 */
export class AVirtualScrollElement extends HTMLElementBase {
  static observedAttributes = OBSERVED

  #internals = this.attachInternals?.()
  #viewport: HTMLElement
  #rowsBox: HTMLDivElement
  #rowsSlot: HTMLSlotElement
  #headerSlot: HTMLSlotElement
  #sizer: HTMLDivElement
  #gapStart: HTMLDivElement
  #gapEnd: HTMLDivElement
  #vbar: HTMLElement
  #vTrackStart: HTMLDivElement
  #vThumb: HTMLDivElement
  #marks: HTMLDivElement
  #secondaryMarks: HTMLDivElement
  #hbar: HTMLElement
  #hTrackStart: HTMLDivElement
  #hThumb: HTMLDivElement
  #hints: [HTMLElement, HTMLElement][] = []
  #interceptKeys: KeyCombo[] = []

  #state: VirtualScrollState | undefined
  #heights = new Map<number, number>()
  #widths = new Map<number, number>()
  #rows = new Map<number, Element>()
  #observed = new Set<Element>()
  #measuredSize = 0
  #indexOf = new WeakMap<Element, number>()
  #renderedStart = 0
  #renderedEnd = 0
  #rowsWidth = 0
  #rowsHeight = 0
  #hostHeight = 0
  #vbarLength = 0
  #hbarLength = 0
  #headerHeight = 0
  #size = 0
  #range: VirtualScrollRange | undefined
  #frame: number | undefined
  #settleTimer: ReturnType<typeof setTimeout> | undefined
  #scrollingTimer: ReturnType<typeof setTimeout> | undefined
  #lastPosition = ''
  #lastContentSize = ''
  #lastMarks = ''
  #lastSecondaryMarks = ''
  #lastPage = 0
  #reveal: Reveal | undefined
  #drag: Drag | undefined
  #rowObserver: ResizeObserver | undefined
  #boxObserver: ResizeObserver | undefined
  #childObserver: MutationObserver | undefined
  #configCache: VirtualScrollConfig | undefined

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })
    const doc = this.doc
    const style = doc.createElement('style')
    style.textContent = SHADOW_STYLE
    const div = (className: string, part?: string) => {
      const el = doc.createElement('div')
      el.className = className
      if (part) el.setAttribute('part', part)
      return el
    }
    this.#sizer = div('sizer')
    // Wheel, pan, and pointer input arrive through Anta's capture surfaces, which cancel
    // accepted native input and re-emit it as `wheelinput`, `paninput`, and `pointerinput`.
    const capture = (className: string, part: string) => {
      const el = doc.createElement('a-capture')
      el.className = className
      el.setAttribute('part', part)
      return el
    }
    this.#viewport = capture('viewport', 'viewport')
    this.#headerSlot = doc.createElement('slot')
    this.#headerSlot.name = 'header'
    this.#headerSlot.setAttribute('part', 'header')
    this.#rowsBox = div('rows')
    this.#rowsSlot = doc.createElement('slot')
    this.#rowsSlot.setAttribute('part', 'rows')
    const emptySlot = doc.createElement('slot')
    emptySlot.name = 'empty'
    emptySlot.setAttribute('part', 'empty')
    this.#gapStart = div('gap')
    this.#gapEnd = div('gap')
    this.#rowsBox.append(this.#gapStart, this.#gapEnd, this.#rowsSlot, emptySlot)
    this.#viewport.append(this.#headerSlot, this.#rowsBox)

    this.#vbar = capture('bar v', 'scrollbar')
    this.#vTrackStart = div('track-start')
    const vTrackEnd = div('track-end')
    this.#marks = div('marks')
    this.#secondaryMarks = div('marks secondary')
    this.#vThumb = div('thumb')
    this.#vThumb.append(div('thumb-fill'))
    this.#vbar.append(this.#vTrackStart, vTrackEnd, this.#secondaryMarks, this.#marks, this.#vThumb)

    this.#hbar = capture('bar h', 'scrollbar-x')
    this.#hbar.hidden = true
    this.#hTrackStart = div('track-start')
    const hTrackEnd = div('track-end')
    this.#hThumb = div('thumb')
    this.#hThumb.append(div('thumb-fill'))
    this.#hbar.append(this.#hTrackStart, hTrackEnd, this.#hThumb)

    // Hints sit on each track and thumb, as in the original scrollbar: tracks wait longer than the thumb.
    for (const [parent, vertical, delay] of [
      [this.#vTrackStart, true, 400], [vTrackEnd, true, 400], [this.#vThumb, true, 200],
      [this.#hTrackStart, false, 400], [hTrackEnd, false, 400], [this.#hThumb, false, 50],
    ] as const) {
      const tooltip = doc.createElement('a-tooltip')
      tooltip.setAttribute('follow', '')
      tooltip.setAttribute('delay', String(delay))
      tooltip.append(hintContent(doc, vertical))
      this.#hints.push([parent, tooltip])
    }

    shadow.append(style, this.#sizer, this.#viewport, this.#vbar, this.#hbar, div('ring'))

    this.#rowsSlot.addEventListener('slotchange', () => this.#onSlotChange())
    this.#viewport.addEventListener('wheelinput', event => this.#onWheel((event as CustomEvent<CaptureWheelInput>).detail))
    this.#viewport.addEventListener('paninput', event => this.#onPan((event as CustomEvent<CapturePanInput>).detail))
    this.#vbar.addEventListener('pointerinput', event => this.#onVerticalBar((event as CustomEvent<CapturePointerInput>).detail))
    this.#hbar.addEventListener('pointerinput', event => this.#onHorizontalBar((event as CustomEvent<CapturePointerInput>).detail))
    this.#vbar.setAttribute('pointer-capture', 'mouse pen touch')
    this.#hbar.setAttribute('pointer-capture', 'mouse pen touch')
    this.#viewport.addEventListener('wheel', event => this.#onShiftWheel(event), { passive: false })
    this.#viewport.setAttribute('pan-inertia', '')
    // Capture phase on the target runs before listeners a consumer added first,
    // including ones that stop immediate propagation. Keys pressed inside a row
    // scroll in the bubble phase instead, so the row's own handlers can claim them
    // with preventDefault, as they would in a native scroller.
    this.addEventListener('keydown', event => this.#onKeyDown(event, true), { capture: true })
    this.addEventListener('keydown', event => this.#onKeyDown(event, false))
  }

  connectedCallback() {
    const view = this.view
    this.#rowObserver ??= new view.ResizeObserver(entries => this.#onRowsResized(entries))
    this.#boxObserver ??= new view.ResizeObserver(entries => this.#onBoxResized(entries))
    this.#childObserver ??= new view.MutationObserver(records => this.#onChildren(records))
    this.#boxObserver.observe(this.#rowsBox)
    this.#boxObserver.observe(this.#headerSlot)
    this.#boxObserver.observe(this)
    this.#boxObserver.observe(this.#vbar)
    this.#boxObserver.observe(this.#hbar)
    // Added and removed rows arrive through slotchange; this only catches a row that changes index in place.
    this.#childObserver.observe(this, { attributes: true, subtree: true, attributeFilter: ['data-index'] })
    this.#state ??= this.#restoredState()
    this.#interceptKeys = parseKeyCombos(this.getAttribute('intercept-keys'))
    this.#syncChildren()
    this.#syncHints()
    this.#render()
  }

  disconnectedCallback() {
    this.#observed.clear()
    this.#rowObserver?.disconnect()
    this.#boxObserver?.disconnect()
    this.#childObserver?.disconnect()
    this.#stopDrag()
    if (this.#frame !== undefined) this.view.cancelAnimationFrame(this.#frame)
    this.#frame = undefined
    clearTimeout(this.#settleTimer)
    clearTimeout(this.#scrollingTimer)
  }

  attributeChangedCallback(name: string, previous: string | null, value: string | null) {
    if (previous === value || !this.#state) return
    if (name === 'content-key') {
      if (!this.hasAttribute('follow')) this.#state = { ...this.#state, atEnd: false }
      pruneHeights(this.#heights, this.#config(), { start: this.#renderedStart, end: this.#renderedEnd }, true)
    }
    if (name === 'follow') {
      const follow = value !== null
      this.#state = { ...this.#state, stickToBottom: follow && this.#state.atEnd }
    }
    if (name === 'count' && Number(previous) > Number(value)) {
      pruneHeights(this.#heights, this.#config(), { start: 0, end: 0 })
    }
    if (name === 'scrollbar-hint') this.#syncHints()
    if (name === 'intercept-keys') this.#interceptKeys = parseKeyCombos(value)
    if (name === 'item-height-fixed' || name === 'content-width') this.#syncChildren()
    this.#configCache = undefined
    this.#schedule()
  }

  #number(name: string, fallback: number): number {
    return finiteNumber(this.getAttribute(name), fallback)
  }

  #optionalNumber(name: string): number | undefined {
    const value = this.getAttribute(name)
    if (value === null || value === '') return undefined
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }

  #restoredState(): VirtualScrollState {
    const count = Math.max(0, Math.floor(this.#number('count', 0)))
    const follow = this.hasAttribute('follow')
    const state = initialState({ count, follow })
    const [anchorIndex, deltaPixels, scrollX, stick] = numberList(this.getAttribute('initial-position'))
    if (anchorIndex === undefined) return state
    return {
      ...state,
      anchorIndex: Math.max(0, Math.min(anchorIndex, Math.max(count - 1, 0))),
      deltaPixels: deltaPixels ?? 0,
      scrollX: scrollX ?? 0,
      stickToBottom: stick === undefined ? state.stickToBottom : stick === 1,
      small: false,
    }
  }

  #config(): VirtualScrollConfig {
    if (this.#configCache) return this.#configCache
    const scrollbarWidth = this.#number('scrollbar-width', DEFAULT_SCROLLBAR_WIDTH)
    const contentWidthAttr = this.#optionalNumber('content-width')
    let measuredWidth = 0
    for (const index of this.#rows.keys()) measuredWidth = Math.max(measuredWidth, this.#widths.get(index) ?? 0)
    const contentWidth = contentWidthAttr ?? (measuredWidth || this.#rowsWidth)
    const base = {
      count: Math.max(0, Math.floor(this.#number('count', 0))),
      itemMinHeight: Math.max(1, this.#number('item-min-height', DEFAULT_ITEM_MIN_HEIGHT)),
      maxNonVirtualItems: this.#number('max-non-virtual', DEFAULT_MAX_NON_VIRTUAL_ITEMS),
      rowsWidth: this.#rowsWidth,
      contentWidth,
      scrollbarWidth,
      follow: this.hasAttribute('follow'),
      itemHeightFixed: this.hasAttribute('item-height-fixed'),
    }
    const hbar = contentWidth - this.#rowsWidth > 0 ? scrollbarWidth : 0
    const heightPx = this.#externallySized()
      ? this.#rowsHeight + hbar
      : this.#nominalHeight() - this.#headerHeight
    this.#configCache = { ...base, heightPx: Math.max(heightPx, base.itemMinHeight) }
    return this.#configCache
  }

  /** The height the list asks for: `height`, else `max-height`, else 500px. */
  #nominalHeight(): number {
    return this.#optionalNumber('height') ?? this.#optionalNumber('max-height') ?? DEFAULT_HEIGHT
  }

  /** True when consumer CSS sizes the host, rather than the height this element asks for. */
  #externallySized(): boolean {
    return this.#hostHeight > 0 && Math.abs(this.#hostHeight - this.#measuredSize) > 0.5
  }

  // Thumb geometry runs on a track the thumb's padded box fits inside, so the thumb
  // never reaches past either end of its bar. Pointer and drawing coordinates are
  // offset by the padding to match. Before the bars are measured, their CSS insets
  // give the length: the vertical bar is inset 1px at each end.
  #verticalTrack(config: VirtualScrollConfig): number {
    return (this.#vbarLength || config.heightPx + this.#headerHeight - 2) - 2 * THUMB_PADDING
  }

  #horizontalTrack(config: VirtualScrollConfig): number {
    return (this.#hbarLength || config.rowsWidth) - 2 * THUMB_PADDING
  }

  /** Measured heights, or every row at the minimum height when `item-height-fixed` is set. */
  #rowHeights(config: VirtualScrollConfig) {
    return config.itemHeightFixed ? fixedHeights(config.count, config.itemMinHeight) : this.#heights
  }

  /** Fixed-height rows are only observed when their width still has to be measured. */
  #observesRows(): boolean {
    return !this.hasAttribute('item-height-fixed') || !this.hasAttribute('content-width')
  }

  #schedule() {
    if (this.#frame !== undefined || !this.isConnected) return
    this.#frame = this.view.requestAnimationFrame(() => {
      this.#frame = undefined
      this.#render()
    })
  }

  #onBoxResized(entries: ResizeObserverEntry[]) {
    let widthChanged = false
    for (const entry of entries) {
      const size = entry.borderBoxSize?.[0]
      const width = size?.inlineSize ?? entry.contentRect.width
      const height = size?.blockSize ?? entry.contentRect.height
      if (entry.target === this.#rowsBox) {
        widthChanged = widthChanged || width !== this.#rowsWidth
        this.#rowsWidth = width
        this.#rowsHeight = height
      } else if (entry.target === this.#headerSlot) this.#headerHeight = height
      else if (entry.target === this) {
        this.#hostHeight = height
        this.#measuredSize = this.#size
      } else if (entry.target === this.#vbar) this.#vbarLength = height
      else if (entry.target === this.#hbar) this.#hbarLength = width
    }
    this.#configCache = undefined
    if (widthChanged && this.#state) {
      pruneHeights(this.#heights, this.#config(), windowBounds(this.#state, this.#config()), true)
    }
    this.#render()
  }

  #onRowsResized(entries: ResizeObserverEntry[]) {
    for (const entry of entries) {
      const index = this.#indexOf.get(entry.target)
      if (index === undefined) continue
      // Border-box sizes from the observer are unsnapped and need no layout read.
      // `clientHeight` would snap against the row's own offset and drift as rows stack.
      const size = entry.borderBoxSize?.[0]
      this.#heights.set(index, size?.blockSize ?? entry.contentRect.height)
      this.#widths.set(index, size?.inlineSize ?? entry.contentRect.width)
    }
    this.#configCache = undefined
    this.#render()
  }

  #onChildren(records: MutationRecord[]) {
    if (records.some(record => record.target.parentNode === this)) this.#onSlotChange()
  }

  #onSlotChange() {
    this.#syncChildren()
    this.#configCache = undefined
    this.#schedule()
  }

  /** Tracks the mounted rows. Re-observing a row makes the observer report its size again. */
  #syncChildren() {
    const observe = this.#observesRows()
    const seen = new Set<Element>()
    let start = Infinity
    let end = -Infinity
    this.#rows.clear()
    for (const child of Array.from(this.children)) {
      if (child.hasAttribute('slot')) continue
      const index = Number(child.getAttribute('data-index'))
      if (!child.hasAttribute('data-index') || !Number.isInteger(index)) continue
      seen.add(child)
      this.#rows.set(index, child)
      if (observe && (this.#indexOf.get(child) !== index || !this.#observed.has(child))) {
        this.#rowObserver?.unobserve(child)
        this.#rowObserver?.observe(child, { box: 'border-box' })
      }
      this.#indexOf.set(child, index)
      start = Math.min(start, index)
      end = Math.max(end, index + 1)
    }
    this.#renderedStart = Number.isFinite(start) ? start : 0
    this.#renderedEnd = Number.isFinite(end) ? end : 0
    // Rows that left stop being observed; their heights stay as estimates for later.
    for (const row of this.#observed) if (!observe || !seen.has(row)) this.#rowObserver?.unobserve(row)
    this.#observed = observe ? seen : new Set()
  }

  #render() {
    if (!this.isConnected || !this.#state) return
    if (this.#frame !== undefined) {
      this.view.cancelAnimationFrame(this.#frame)
      this.#frame = undefined
    }
    const config = this.#config()
    this.#applyReveal(config)
    const state = correct(this.#state, config, this.#rowHeights(config))
    this.#state = state

    const range = renderRange(state, config)
    if (!this.#range || range.start !== this.#range.start || range.end !== this.#range.end) {
      this.#range = range
      this.dispatchEvent(new this.view.CustomEvent<VirtualScrollRange>('rangechange', { detail: { ...range } }))
    }

    this.#applyLayout(state, config)
    this.#applyScrollbars(state, config)
    this.#applyStates(state, config)
    this.#applyCapture(state, config)
    this.#reportSizes(config)
    this.#schedulePosition()
  }

  #applyLayout(state: VirtualScrollState, config: VirtualScrollConfig) {
    const viewport = scrollableHeight(config)
    const hbar = showHorizontalScrollbar(config) ? config.scrollbarWidth : 0
    // The vertical scrollbar takes a column only while there is something to scroll;
    // otherwise the rows and the horizontal scrollbar use the full width.
    const vbar = showVerticalScrollbar(state, config, this.#rowHeights(config)) && config.count > 0 ? config.scrollbarWidth : 0
    const style = this.#viewport.style
    style.setProperty('--_vbar', `${vbar}px`)
    style.setProperty('--_hbar', `${hbar}px`)
    style.setProperty('--_min', `${config.itemMinHeight}px`)
    style.setProperty('--_cw', `${this.#optionalNumber('content-width') ?? 0}px`)
    style.setProperty('--virtual-scroll-x', `${state.scrollX}px`)
    this.#vbar.style.setProperty('--_sb', `${config.scrollbarWidth}px`)
    this.#hbar.style.setProperty('--_sb', `${config.scrollbarWidth}px`)
    this.#hbar.style.setProperty('--_vbar', `${vbar}px`)

    let renderedHeight = 0
    for (let i = this.#renderedStart; i < this.#renderedEnd; i++) renderedHeight += this.#rowHeights(config).get(i) || config.itemMinHeight
    const hasRows = this.#renderedEnd > this.#renderedStart
    let top: number
    if (isBottomAligned(state)) {
      top = viewport - renderedHeight
      style.setProperty('--_y', `calc(${viewport}px - 100%)`)
    } else {
      top = hasRows ? rowsOffset(state, config, this.#rowHeights(config), this.#renderedStart) : 0
      style.setProperty('--_y', `${top}px`)
    }
    // Stripes mark rows that exist but have not been mounted yet, e.g. while a worker catches up.
    const bottom = top + renderedHeight
    if (!hasRows) {
      this.#setGap(this.#gapStart, 0, config.count > 0 ? viewport : 0)
      this.#setGap(this.#gapEnd, 0, 0)
    } else {
      this.#setGap(this.#gapStart, 0, this.#renderedStart > 0 ? Math.min(top, viewport) : 0)
      this.#setGap(this.#gapEnd, Math.max(bottom, 0), this.#renderedEnd < config.count ? viewport : 0)
    }

    // Size the host: rows when they all fit and no height was asked for, else the requested height.
    // `max-height` only caps, as in CSS, so a short list still shrinks to its rows.
    const measured = knownContentHeight(config, this.#rowHeights(config))
    const content = measured.height + hbar + this.#headerHeight
    const heightAttr = this.#optionalNumber('height')
    const maxHeight = this.#optionalNumber('max-height')
    const size = config.count === 0
      ? config.itemMinHeight + this.#headerHeight
      : state.small && heightAttr === undefined
        ? Math.min(content, maxHeight ?? Infinity)
        : Math.min(maxHeight ?? Infinity, Math.max(this.#nominalHeight(), state.small ? content : 0))
    if (size !== this.#size) {
      this.#size = size
      this.#sizer.style.setProperty('--_size', `${size}px`)
    }
  }

  /** Redraws one mark layer when its positions change; returns the positions' key. */
  #drawMarks(layer: HTMLDivElement, attribute: string, lastKey: string, state: VirtualScrollState, config: VirtualScrollConfig): string {
    const positions = markPositions(config, state, this.#rowHeights(config), numberList(this.getAttribute(attribute)), this.#verticalTrack(config))
    const key = positions.join(';')
    if (key === lastKey) return key
    const doc = this.doc
    layer.replaceChildren(...positions.map(([top, height]) => {
      const mark = doc.createElement('div')
      mark.className = 'mark'
      mark.style.top = `${top + THUMB_PADDING}px`
      mark.style.height = `${height}px`
      return mark
    }))
    return key
  }

  #setGap(gap: HTMLDivElement, from: number, to: number) {
    const shown = to - from > 0.5
    gap.classList.toggle('shown', shown)
    if (shown) {
      gap.style.top = `${from}px`
      gap.style.height = `${to - from}px`
    }
  }

  #applyScrollbars(state: VirtualScrollState, config: VirtualScrollConfig) {
    const showV = showVerticalScrollbar(state, config, this.#rowHeights(config)) && config.count > 0
    this.#vbar.hidden = !showV
    if (showV) {
      const thumb = verticalThumb(state, config, this.#rowHeights(config), this.#verticalTrack(config))
      this.#vTrackStart.style.height = `${thumb.top + THUMB_PADDING + config.scrollbarWidth / 2}px`
      this.#vThumb.style.top = `${thumb.top}px`
      this.#vThumb.style.height = `${thumb.height}px`
      this.#vThumb.style.minHeight = `${config.scrollbarWidth}px`
      this.#lastSecondaryMarks = this.#drawMarks(this.#secondaryMarks, 'secondary-marks', this.#lastSecondaryMarks, state, config)
      this.#lastMarks = this.#drawMarks(this.#marks, 'marks', this.#lastMarks, state, config)
    }
    const showH = showHorizontalScrollbar(config) && config.count > 0
    this.#hbar.hidden = !showH
    if (showH) {
      const thumb = horizontalThumb(state, config, this.#horizontalTrack(config))
      this.#hTrackStart.style.width = `${thumb.left + THUMB_PADDING + config.scrollbarWidth / 2}px`
      this.#hThumb.style.left = `${thumb.left}px`
      this.#hThumb.style.width = `${thumb.width}px`
      this.#hThumb.style.minWidth = `${config.scrollbarWidth}px`
    }
  }

  #setState(name: string, on: boolean) {
    const states = this.#internals?.states
    if (!states) return
    try {
      if (on) states.add(name)
      else states.delete(name)
    } catch {
      // Engines without CustomStateSet keep working without the CSS hooks.
    }
  }

  #applyStates(state: VirtualScrollState, config: VirtualScrollConfig) {
    this.#setState('empty', config.count === 0)
    this.#setState('scrollable-y', showVerticalScrollbar(state, config, this.#rowHeights(config)))
    this.#setState('scrollable-x', showHorizontalScrollbar(config))
    this.#setState('following', isBottomAligned(state))
    this.#setState('at-start', state.anchorIndex === 0 && state.deltaPixels >= 0)
    this.#setState('at-end', state.atEnd)
    this.#setState('hidden-start-x', state.scrollX > 0)
    this.#setState('hidden-end-x', state.scrollX < maxScrollX(config))
  }

  #applyCapture(state: VirtualScrollState, config: VirtualScrollConfig) {
    const vertical = !state.small && config.count > 0
    const horizontal = showHorizontalScrollbar(config)
    const directions = [vertical ? 'up down' : '', horizontal ? 'left right' : ''].filter(Boolean).join(' ')
    const viewport = this.#viewport
    const activation = this.getAttribute('wheel-activation') ?? 'hover'
    // a-capture re-reads its options when one of these attributes changes, so write only changes.
    const set = (name: string, value: string | null) => {
      if (viewport.getAttribute(name) === value) return
      if (value === null) viewport.removeAttribute(name)
      else viewport.setAttribute(name, value)
    }
    set('wheel-capture', directions || null)
    set('wheel-activation', activation)
    set('pan', vertical && horizontal ? 'both' : vertical ? 'y' : horizontal ? 'x' : null)
    // Touch panning owns only the axes this list scrolls; the page keeps the others.
    this.#viewport.style.touchAction = vertical && horizontal ? 'none' : vertical ? 'pan-x' : horizontal ? 'pan-y' : 'auto'
  }

  #reportSizes(config: VirtualScrollConfig) {
    const measured = knownContentHeight(config, this.#rowHeights(config))
    const hbar = showHorizontalScrollbar(config) ? config.scrollbarWidth : 0
    const detail: VirtualScrollContentSize = {
      height: measured.complete ? measured.height + hbar : null,
      width: config.contentWidth,
    }
    const key = `${detail.height}|${detail.width}`
    if (key === this.#lastContentSize) return
    this.#lastContentSize = key
    this.dispatchEvent(new this.view.CustomEvent<VirtualScrollContentSize>('contentsizechange', { detail }))
  }

  #schedulePosition() {
    const state = this.#state
    if (!state) return
    const key = `${state.anchorIndex}|${state.deltaPixels}|${state.scrollX}|${state.stickToBottom}|${state.atEnd}`
    if (key === this.#lastPosition) return
    clearTimeout(this.#settleTimer)
    this.#settleTimer = setTimeout(() => {
      const current = this.#state
      if (!current || !this.isConnected) return
      const config = this.#config()
      this.#lastPosition = `${current.anchorIndex}|${current.deltaPixels}|${current.scrollX}|${current.stickToBottom}|${current.atEnd}`
      this.dispatchEvent(new this.view.CustomEvent<VirtualScrollPosition>('positionchange', {
        detail: {
          anchorIndex: current.anchorIndex,
          deltaPixels: current.deltaPixels,
          scrollX: current.scrollX,
          maxScrollX: maxScrollX(config),
          stickToBottom: current.stickToBottom,
          atEnd: current.atEnd,
          firstVisibleIndex: visibleIndices(current, config, this.#rowHeights(config))[0],
        },
      }))
    }, SETTLE_MS)
  }

  #syncHints() {
    const shown = this.hasAttribute('scrollbar-hint')
    for (const [parent, tooltip] of this.#hints) {
      if (shown && tooltip.parentNode !== parent) parent.append(tooltip)
      else if (!shown) tooltip.remove()
    }
  }

  // Reveal: snap to `reveal-index` when its key changes, on layout changes, and
  // until the target inside the row has been measured; never after the user scrolls away.
  #applyReveal(config: VirtualScrollConfig) {
    const state = this.#state
    if (!state) return
    const indexAttr = this.#optionalNumber('reveal-index')
    if (indexAttr === undefined || indexAttr < 0 || indexAttr >= config.count) {
      this.#reveal = undefined
      return
    }
    const key = this.getAttribute('reveal-key') ?? String(indexAttr)
    const viewport = scrollableHeight(config)
    let reveal = this.#reveal
    if (!reveal || reveal.key !== key || reveal.index !== indexAttr) {
      reveal = { key, index: indexAttr, target: this.getAttribute('reveal-target'), revealed: false, userScrolled: false, height: viewport, xKey: '' }
      this.#reveal = reveal
    }
    const layoutChanged = reveal.height !== viewport
    if (reveal.userScrolled) return
    if (!reveal.revealed || layoutChanged) {
      reveal.height = viewport
      const row = this.#rows.get(reveal.index)
      let targetTop: number | undefined
      let measured = false
      if (row && this.#rowHeights(config).has(reveal.index)) {
        const target = reveal.target ? row.querySelector(reveal.target) : null
        if (!reveal.target) measured = true
        else if (target) {
          targetTop = target.getBoundingClientRect().top - row.getBoundingClientRect().top
          measured = true
        }
      }
      this.#state = revealState(state, config, this.#rowHeights(config), { index: reveal.index, targetTop })
      reveal.revealed = measured
    }
    this.#applyRevealX(config, reveal, layoutChanged)
  }

  #applyRevealX(config: VirtualScrollConfig, reveal: Reveal, layoutChanged: boolean) {
    const [left, width, insetStart, insetEnd] = numberList(this.getAttribute('reveal-x'))
    if (left === undefined || width === undefined || !this.#state) {
      reveal.xKey = ''
      return
    }
    let targetLeft = left
    let targetWidth = width
    const row = this.#rows.get(reveal.index)
    const target = row && reveal.target ? row.querySelector(reveal.target) : null
    if (row && target) {
      const rowRect = row.getBoundingClientRect()
      const rect = target.getBoundingClientRect()
      const matchLeft = rect.left - rowRect.left
      // Prefer the measured match when it sits inside the column the consumer named,
      // with a buffer on both sides so it does not land against an edge.
      if (matchLeft >= left - 1 && matchLeft <= left + width + 1) {
        targetLeft = matchLeft - REVEAL_X_BUFFER
        targetWidth = rect.width + 2 * REVEAL_X_BUFFER
      }
    }
    const xKey = `${targetLeft}:${targetWidth}:${insetStart ?? 0}:${insetEnd ?? 0}`
    if (xKey === reveal.xKey && !layoutChanged) return
    reveal.xKey = xKey
    this.#state = revealX(this.#state, config, { left: targetLeft, width: targetWidth, insetStart, insetEnd })
  }

  #userScrolled() {
    if (this.#reveal) this.#reveal.userScrolled = true
  }

  #update(next: VirtualScrollState, vertical = true) {
    if (!this.#state || next === this.#state) return
    if (vertical && (next.anchorIndex !== this.#state.anchorIndex || next.deltaPixels !== this.#state.deltaPixels)) this.#userScrolled()
    this.#state = next
    this.#schedule()
  }

  #markScrolling() {
    this.#setState('scrolling', true)
    clearTimeout(this.#scrollingTimer)
    this.#scrollingTimer = setTimeout(() => this.#setState('scrolling', false), SETTLE_MS)
  }

  #pageThrottled(direction: 1 | -1) {
    const now = this.view.performance.now()
    if (now - this.#lastPage < PAGE_THROTTLE_MS) return
    this.#lastPage = now
    this.#update(scrollByPage(this.#state!, this.#config(), direction))
  }

  #onWheel(detail: CaptureWheelInput) {
    const state = this.#state
    if (!state) return
    const config = this.#config()
    const e = detail.wheelEvent
    const scale = this.#wheelScale(e.deltaMode, config)
    const dy = e.deltaY * scale
    const dx = e.deltaX * scale
    this.#markScrolling()
    if (dy !== 0 && !state.small) this.#update(scrollByPixels(state, dy))
    if (dx !== 0 && showHorizontalScrollbar(config)) this.#update(scrollXBy(this.#state!, config, dx), false)
  }

  #onPan(detail: CapturePanInput) {
    if (!this.#state) return
    if (detail.phase !== 'move' && detail.phase !== 'inertia') return
    const config = this.#config()
    this.#markScrolling()
    if (detail.deltaY) this.#update(scrollByPixels(this.#state, detail.deltaY))
    if (detail.deltaX) this.#update(scrollXBy(this.#state, config, detail.deltaX), false)
  }

  // The list takes only these keys, unmodified (Ctrl only with the vertical arrows),
  // and only when they would move it. Everything else reaches the page and the
  // browser: modified navigation, keys at an edge, keys typed into controls, and
  // keys a row's own handler prevented.
  #onKeyDown(event: KeyboardEvent, capture: boolean) {
    const state = this.#state
    if (!state || event.defaultPrevented || event.isComposing) return
    if (capture && this.#intercepted(event)) {
      event.preventDefault()
      return
    }
    if (event.altKey || event.metaKey || event.shiftKey) return
    const target = event.composedPath()[0]
    const own = target === this || (target instanceof this.view.Node && !!this.shadowRoot?.contains(target))
    if (own !== capture) return
    if (target instanceof this.view.Element && target.closest(INTERACTIVE_TARGETS)) return
    const config = this.#config()
    if (!config.count) return
    const vertical = !state.small
    const horizontal = showHorizontalScrollbar(config)
    let next: VirtualScrollState | undefined
    let axis: 'x' | 'y' = 'y'
    if (event.ctrlKey) {
      if (vertical && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        next = scrollByItem(state, config, this.#rowHeights(config), event.key === 'ArrowUp' ? -1 : 1)
      }
    } else {
      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowDown':
          if (vertical) next = scrollByPixels(state, event.key === 'ArrowUp' ? -KEY_STEP : KEY_STEP)
          break
        case 'PageUp':
        case 'PageDown':
          if (vertical) next = scrollByPage(state, config, event.key === 'PageUp' ? -1 : 1)
          break
        case 'Home':
          if (vertical) next = scrollToStart(state)
          break
        case 'End':
          if (vertical) next = scrollToEnd(state, config, this.#rowHeights(config))
          break
        case 'ArrowLeft':
        case 'ArrowRight':
          axis = 'x'
          if (horizontal) next = scrollXBy(state, config, event.key === 'ArrowLeft' ? -KEY_STEP : KEY_STEP)
          break
      }
    }
    if (!next || !moved(state, next)) return
    event.preventDefault()
    this.#update(next, axis === 'y')
  }

  /** Keys listed in `intercept-keys` have their default action prevented and still reach listeners. */
  #intercepted(event: KeyboardEvent): boolean {
    const key = event.key.toLowerCase()
    return this.#interceptKeys.some(combo => combo.key === key
      && combo.ctrl === event.ctrlKey && combo.meta === event.metaKey
      && combo.alt === event.altKey && combo.shift === event.shiftKey)
  }

  // Shift + wheel scrolls sideways. Capture input only takes unmodified wheels, so
  // Ctrl + wheel (zoom and trackpad pinch) and other modified wheels stay with the browser.
  #onShiftWheel(event: WheelEvent) {
    const state = this.#state
    if (!state || event.defaultPrevented || !event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
    const config = this.#config()
    if (!showHorizontalScrollbar(config)) return
    const delta = (event.deltaX || event.deltaY) * this.#wheelScale(event.deltaMode, config)
    const next = scrollXBy(state, config, delta)
    if (!moved(state, next)) return
    event.preventDefault()
    this.#markScrolling()
    this.#update(next, false)
  }

  #wheelScale(deltaMode: number, config: VirtualScrollConfig): number {
    if (deltaMode === 1) return config.itemMinHeight
    if (deltaMode === 2) return scrollableHeight(config)
    // Pixel-mode wheels outside macOS report coarse notches; a third of one matches the original feel.
    return IS_MAC ? 1 : 1 / 3
  }

  #renderNow() {
    this.#render()
  }

  #verticalThumbCenter(): number {
    const state = this.#state!
    const config = this.#config()
    const heights = this.#rowHeights(config)
    const thumb = verticalThumb(state, config, heights, this.#verticalTrack(config))
    return config.count <= maxNonVirtual(config) && isMeasured(state, config, heights)
      ? thumb.top + thumb.height / 2
      : thumb.center
  }

  #onVerticalBar(detail: CapturePointerInput) {
    const state = this.#state
    if (!state) return
    const config = this.#config()
    if (detail.phase === 'end' || detail.phase === 'cancel') {
      this.#stopDrag()
      return
    }
    if (detail.phase === 'start') {
      this.#userScrolled()
      const track = this.#verticalTrack(config)
      const y = detail.localY - THUMB_PADDING
      const thumb = verticalThumb(state, config, this.#rowHeights(config), track)
      const shift = detail.start.pointerEvent.shiftKey
      if (y >= thumb.top - THUMB_PADDING && y <= thumb.top + thumb.height + THUMB_PADDING) {
        this.#vThumb.classList.add('dragging')
        this.#drag = { axis: 'y', startCenter: this.#verticalThumbCenter() }
        return
      }
      const before = y < thumb.top
      if (!before && state.atEnd) return
      if (shift) {
        const direction = before ? -1 : 1
        const startCenter = thumb.center
        this.#pageThrottled(direction)
        const timer = setInterval(() => this.#pageRepeat(), PAGE_REPEAT_MS)
        this.#drag = { axis: 'page', direction, y, startCenter, timer }
        return
      }
      const target = trackPressTarget(config, this.#rowHeights(config), y, track)
      if ('edge' in target) {
        this.#update(target.edge === 'start' ? scrollToStart(state) : scrollToEnd(state, config, this.#rowHeights(config)))
      } else {
        this.#update({
          ...state,
          anchorIndex: target.index,
          deltaPixels: 0,
          stickToBottom: target.index === config.count - 1 ? state.stickToBottom : false,
          atEnd: target.index === config.count - 1 ? state.atEnd : false,
        })
      }
      // A press on the track keeps dragging from wherever the thumb lands.
      this.#renderNow()
      this.#vThumb.classList.add('dragging')
      this.#drag = { axis: 'y', startCenter: this.#verticalThumbCenter() - detail.movementY }
      return
    }
    const drag = this.#drag
    if (drag?.axis !== 'y') return
    const target = thumbDragTarget(config, this.#rowHeights(config), drag.startCenter + detail.movementY, this.#verticalTrack(config))
    this.#userScrolled()
    if (target.index === config.count - 1 && target.deltaPixels === 0) {
      this.#update(scrollToEnd(state, config, this.#rowHeights(config)))
    } else {
      this.#update({ ...state, anchorIndex: target.index, deltaPixels: target.deltaPixels, stickToBottom: false, atEnd: false })
    }
  }

  #pageRepeat() {
    const drag = this.#drag
    if (drag?.axis !== 'page' || !this.#state) return
    const config = this.#config()
    const center = verticalThumb(this.#state, config, this.#rowHeights(config), this.#verticalTrack(config)).center
    const half = config.scrollbarWidth / 2
    // Stop once the thumb reaches the pointer.
    if ((drag.direction < 0 && center - half <= drag.y) || (drag.direction > 0 && center + half >= drag.y)) {
      this.#stopDrag()
      return
    }
    this.#pageThrottled(drag.direction)
  }

  #onHorizontalBar(detail: CapturePointerInput) {
    const state = this.#state
    if (!state) return
    const config = this.#config()
    if (detail.phase === 'end' || detail.phase === 'cancel') {
      this.#stopDrag()
      return
    }
    if (detail.phase === 'start') {
      const track = this.#horizontalTrack(config)
      const x = detail.localX - THUMB_PADDING
      const thumb = horizontalThumb(state, config, track)
      if (x < thumb.left - THUMB_PADDING || x > thumb.left + thumb.width + THUMB_PADDING) {
        this.#update(scrollXTo(state, config, horizontalTrackPressTarget(config, x, track)), false)
        this.#renderNow()
      }
      this.#hThumb.classList.add('dragging')
      this.#drag = { axis: 'x', startCenter: horizontalThumb(this.#state!, config, track).center - detail.movementX }
      return
    }
    const drag = this.#drag
    if (drag?.axis !== 'x') return
    this.#update(scrollXTo(state, config, horizontalThumbDragTarget(config, drag.startCenter + detail.movementX, this.#horizontalTrack(config))), false)
  }

  #stopDrag() {
    if (this.#drag?.axis === 'page') clearInterval(this.#drag.timer)
    this.#drag = undefined
    this.#vThumb.classList.remove('dragging')
    this.#hThumb.classList.remove('dragging')
  }
}

export function register_a_virtual_scroll() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-virtual-scroll')) customElements.define('a-virtual-scroll', AVirtualScrollElement)
}

register_a_virtual_scroll()
