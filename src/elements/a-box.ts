import { HTMLElementBase } from '../anta_helpers'
import type {
  BoxContext,
  BoxContextChange,
  BoxMeasurement,
  BoxMeasurementChange,
  BoxBrowser,
  BoxMode,
  BoxOS,
} from '../box-types'
import './a-box.css'

type SharedContext = Pick<
  BoxContext,
  | 'globalMode' | 'systemAppearance' | 'os' | 'osVersion' | 'browser'
  | 'browserVersion' | 'mobile' | 'pointer' | 'hover' | 'reducedMotion'
>

/** What one user-agent read yields. Computed once per window. */
type DeviceSnapshot = Pick<
  BoxContext,
  'os' | 'osVersion' | 'browser' | 'browserVersion' | 'mobile'
>

const contextStores = new WeakMap<Window, BoxContextStore>()

/** One browser-context observer shared by every `a-box` in a window. It owns
 * media-query listeners and the mode-class observer; individual boxes only own
 * their own geometry and focus observation. */
class BoxContextStore {
  #boxes = new Set<ABoxElement>()
  #dark: MediaQueryList
  #finePointer: MediaQueryList
  #coarsePointer: MediaQueryList
  #hover: MediaQueryList
  #reducedMotion: MediaQueryList
  #classObserver?: MutationObserver
  #device: DeviceSnapshot

  constructor(
    private readonly view: Window & typeof globalThis,
    private readonly doc: Document,
  ) {
    this.#dark = view.matchMedia('(prefers-color-scheme: dark)')
    this.#finePointer = view.matchMedia('(pointer: fine)')
    this.#coarsePointer = view.matchMedia('(pointer: coarse)')
    this.#hover = view.matchMedia('(hover: hover)')
    this.#reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)')
    this.#device = deviceSnapshot(view.navigator)

    for (const query of [this.#dark, this.#finePointer, this.#coarsePointer, this.#hover, this.#reducedMotion]) {
      query.addEventListener('change', this.#notifyAll)
    }

    const root = doc.documentElement
    if (root) {
      this.#classObserver = new view.MutationObserver((records) => {
        const affected = new Set<ABoxElement>()
        for (const record of records) {
          if (!(record.target instanceof this.view.Element)) continue
          for (const box of this.#boxes) {
            if (record.target === box || record.target.contains(box)) affected.add(box)
          }
        }
        for (const box of affected) box.contextStoreDidChange()
      })
      this.#classObserver.observe(root, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
      })
    }
  }

  subscribe(box: ABoxElement) {
    this.#boxes.add(box)
  }

  unsubscribe(box: ABoxElement) {
    this.#boxes.delete(box)
  }

  snapshot(): SharedContext {
    return {
      globalMode: modeFromElement(this.doc.documentElement),
      systemAppearance: this.#dark.matches ? 'dark' : 'light',
      ...this.#device,
      pointer: this.#finePointer.matches ? 'fine' : this.#coarsePointer.matches ? 'coarse' : 'none',
      hover: this.#hover.matches,
      reducedMotion: this.#reducedMotion.matches,
    }
  }

  #notifyAll = () => {
    for (const box of this.#boxes) box.contextStoreDidChange()
  }
}

function contextStore(view: Window & typeof globalThis, doc: Document): BoxContextStore {
  let store = contextStores.get(view)
  if (!store) {
    store = new BoxContextStore(view, doc)
    contextStores.set(view, store)
  }
  return store
}

function modeFromElement(element: Element | null): BoxMode {
  return element?.classList.contains('dark') ? 'dark' : 'light'
}

function localMode(element: Element): BoxMode {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (current.classList.contains('dark')) return 'dark'
    if (current.classList.contains('light')) return 'light'
  }
  return modeFromElement(element.ownerDocument.documentElement)
}

/** Browser-family detection order matters: Edge and Opera both carry `chrome/`,
 * and Chrome carries `safari/`, so the most specific brand has to win first. */
const BROWSER_VERSION: Record<BoxBrowser, RegExp> = {
  edge: /edg[ea]?\/(\d+)/,
  opera: /opr\/(\d+)/,
  firefox: /(?:firefox|fxios)\/(\d+)/,
  chrome: /(?:chrome|crios)\/(\d+)/,
  safari: /version\/(\d+)/,
  unknown: /(?!)/,
}

const OS_VERSION: Partial<Record<BoxOS, RegExp>> = {
  windows: /windows nt ([\d.]+)/,
  macos: /mac os x (\d+[._]\d+(?:[._]\d+)?)/,
  ios: /os (\d+[._]\d+(?:[._]\d+)?)/,
  android: /android (\d+(?:\.\d+)*)/,
}

/**
 * One user-agent read, reduced to a coarse family plus a major version. Never
 * exposes the raw user-agent string.
 *
 * Every engine freezes parts of what it reports: macOS is pinned at `10.15.7`,
 * Windows 11 reports `10.0`, and browser minor/patch digits are zeroed. Both
 * versions are therefore major-only numbers, and both are hints. Client Hints
 * (`userAgentData.brands`) supplies the browser when available — it is the
 * non-deprecated source — and the user-agent string covers every other engine.
 * The high-entropy `getHighEntropyValues()` path is deliberately not used: it is
 * async, Chromium-only, and a fingerprinting surface.
 */
function deviceSnapshot(navigator: Navigator): DeviceSnapshot {
  const uaData = navigator as Navigator & {
    userAgentData?: {
      mobile?: boolean
      platform?: string
      brands?: { brand: string; version: string }[]
    }
  }
  const ua = (navigator.userAgent ?? '').toLowerCase()
  const source = `${uaData.userAgentData?.platform ?? ''} ${navigator.platform ?? ''} ${ua}`.toLowerCase()

  const os: BoxOS = /android/.test(source)
    ? 'android'
    : /iphone|ipad|ipod|ios/.test(source)
      ? 'ios'
      : /mac/.test(source)
        ? 'macos'
        : /win/.test(source)
          ? 'windows'
          : /linux/.test(source)
            ? 'linux'
            : 'unknown'

  const browser: BoxBrowser = /edg[ea]?\//.test(ua)
    ? 'edge'
    : /opr\/|opera/.test(ua)
      ? 'opera'
      : /firefox\/|fxios\//.test(ua)
        ? 'firefox'
        : /chrome\/|crios\//.test(ua)
          ? 'chrome'
          : /safari\//.test(ua)
            ? 'safari'
            : 'unknown'

  // Client Hints report the major version directly. `Not_A Brand` is deliberate
  // padding, and generic `Chromium` loses to the branded entry beside it.
  const brands = uaData.userAgentData?.brands ?? []
  const branded = brands
    .filter((b) => !/not.a.brand/i.test(b.brand))
    .sort((a, b) => Number(/chromium/i.test(a.brand)) - Number(/chromium/i.test(b.brand)))[0]

  return {
    os,
    osVersion: parseInt(ua.match(OS_VERSION[os] ?? /(?!)/)?.[1] ?? '', 10) || 0,
    browser,
    browserVersion: Number(branded?.version ?? ua.match(BROWSER_VERSION[browser])?.[1]) || 0,
    mobile: uaData.userAgentData?.mobile ?? /android|mobi|iphone|ipad|ipod/.test(source),
  }
}

function same<T extends object>(a: T | undefined, b: T): boolean {
  return a !== undefined && Object.keys(b).every((key) => a[key as keyof T] === b[key as keyof T])
}

function changed<T extends object>(previous: T | undefined, current: T): Partial<T> {
  if (!previous) return { ...current }
  return Object.fromEntries(
    Object.entries(current).filter(([key, value]) => previous[key as keyof T] !== value),
  ) as Partial<T>
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * `<a-box>` is a light-DOM container that observes itself. It leaves the host
 * and its children entirely to the renderer: all output is read-only getters,
 * `measurechange` / `contextchange` events, and private `ElementInternals`
 * states. This keeps measurement usable when JSX itself cannot access the DOM.
 */
export class ABoxElement extends HTMLElementBase {
  #internals = this.attachInternals?.()
  #store?: BoxContextStore
  #resizeObserver?: ResizeObserver
  #contentObserver?: MutationObserver
  #frame?: number
  #contextQueued = false
  #measurement?: BoxMeasurement
  #context?: BoxContext

  connectedCallback() {
    this.#store = contextStore(this.view, this.doc)
    this.#store.subscribe(this)
    this.#resizeObserver = new this.view.ResizeObserver(this.#queueMeasurement)
    this.#resizeObserver.observe(this)
    this.#contentObserver = new this.view.MutationObserver(this.#queueMeasurement)
    this.#contentObserver.observe(this, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    })
    this.addEventListener('focusin', this.#queueContext)
    this.addEventListener('focusout', this.#queueContext)
    this.addEventListener('input', this.#queueMeasurement)
    this.addEventListener('scroll', this.#queueMeasurement, { passive: true })
    this.addEventListener('load', this.#queueMeasurement, true)
    this.doc.fonts?.addEventListener('loadingdone', this.#queueMeasurement)
    this.#reportMeasurement(true)
    this.#reportContext(true)
  }

  disconnectedCallback() {
    this.#resizeObserver?.disconnect()
    this.#contentObserver?.disconnect()
    if (this.#frame != null) this.view.cancelAnimationFrame(this.#frame)
    this.#frame = undefined
    this.#store?.unsubscribe(this)
    this.removeEventListener('focusin', this.#queueContext)
    this.removeEventListener('focusout', this.#queueContext)
    this.removeEventListener('input', this.#queueMeasurement)
    this.removeEventListener('scroll', this.#queueMeasurement)
    this.removeEventListener('load', this.#queueMeasurement, true)
    this.doc.fonts?.removeEventListener('loadingdone', this.#queueMeasurement)
  }

  /** A fresh measurement snapshot. For notifications, prefer `measurechange`:
   * it batches browser observers and includes the field-level delta. */
  get measurement(): BoxMeasurement {
    return this.#readMeasurement()
  }

  /** A fresh context snapshot. For changes, prefer `contextchange`. */
  get context(): BoxContext {
    return this.#readContext()
  }

  /** Allows a nested `Tooltip truncatedOnly` to use Box's clipping decision. */
  get isTruncated(): boolean {
    const measurement = this.#readMeasurement()
    return measurement.clippedX || measurement.clippedY
  }

  /** Called by the per-window context cache. It is intentionally not a JSX prop. */
  contextStoreDidChange() {
    this.#reportContext(false)
    this.#queueMeasurement()
  }

  #queueMeasurement = () => {
    if (!this.isConnected || this.#frame != null) return
    this.#frame = this.view.requestAnimationFrame(() => {
      this.#frame = undefined
      this.#reportMeasurement(false)
    })
  }

  #queueContext = () => {
    if (!this.isConnected || this.#contextQueued) return
    this.#contextQueued = true
    queueMicrotask(() => {
      this.#contextQueued = false
      if (this.isConnected) this.#reportContext(false)
    })
  }

  #readMeasurement(): BoxMeasurement {
    const rect = this.getBoundingClientRect()
    const clientWidth = this.clientWidth
    const clientHeight = this.clientHeight
    const scrollWidth = this.scrollWidth
    const scrollHeight = this.scrollHeight
    const hasBox = clientWidth > 0 || clientHeight > 0
    const overflowX = hasBox && scrollWidth > clientWidth + 1
    const overflowY = hasBox && scrollHeight > clientHeight + 1
    const styles = this.view.getComputedStyle(this)
    const clippedX = overflowX && styles.overflowX !== 'visible'
    const clippedY = overflowY && styles.overflowY !== 'visible'
    const scrollableX = overflowX && (styles.overflowX === 'auto' || styles.overflowX === 'scroll')
    const scrollableY = overflowY && (styles.overflowY === 'auto' || styles.overflowY === 'scroll')
    const scrollLeft = Math.round(this.scrollLeft)
    const scrollTop = Math.round(this.scrollTop)
    // A right-to-left box scrolls into negative `scrollLeft`, so distance from
    // the logical start edge is the magnitude, not the signed value.
    const fromStartX = Math.abs(scrollLeft)
    const fromStartY = Math.abs(scrollTop)
    return {
      width: rounded(rect.width),
      height: rounded(rect.height),
      clientWidth,
      clientHeight,
      scrollWidth,
      scrollHeight,
      overflowX,
      overflowY,
      clippedX,
      clippedY,
      scrollableX,
      scrollableY,
      scrollLeft,
      scrollTop,
      hiddenStartX: clippedX && fromStartX > 1,
      hiddenEndX: clippedX && fromStartX < scrollWidth - clientWidth - 1,
      hiddenStartY: clippedY && fromStartY > 1,
      hiddenEndY: clippedY && fromStartY < scrollHeight - clientHeight - 1,
    }
  }

  #readContext(): BoxContext {
    const shared = (this.#store ?? contextStore(this.view, this.doc)).snapshot()
    return {
      ...shared,
      mode: localMode(this),
      focusWithin: this.matches(':focus-within'),
    }
  }

  #reportMeasurement(initial: boolean) {
    const current = this.#readMeasurement()
    const previous = this.#measurement
    this.#measurement = current
    this.#setMeasurementStates(current)
    if (!initial && same(previous, current)) return
    const detail: BoxMeasurementChange = {
      changed: initial ? { ...current } : changed(previous, current),
      current,
    }
    this.dispatchEvent(new this.view.CustomEvent('measurechange', { detail }))
  }

  #reportContext(initial: boolean) {
    const current = this.#readContext()
    const previous = this.#context
    this.#context = current
    if (!initial && same(previous, current)) return
    const detail: BoxContextChange = {
      changed: initial ? { ...current } : changed(previous, current),
      current,
    }
    this.dispatchEvent(new this.view.CustomEvent('contextchange', { detail }))
  }

  /* Only measurement states exist. Everything the context reports has a native
     CSS equivalent — `:focus-within` for focus, the `.dark` ancestor class for
     mode, `prefers-color-scheme` / `pointer` / `hover` / `prefers-reduced-motion`
     media queries for the rest — so `contextchange` is a JS-side event only.
     Overflow is the one thing CSS cannot ask about, which is what these are for. */
  #setMeasurementStates(measurement: BoxMeasurement) {
    this.#setState('overflow-x', measurement.overflowX)
    this.#setState('overflow-y', measurement.overflowY)
    this.#setState('clipped-x', measurement.clippedX)
    this.#setState('clipped-y', measurement.clippedY)
    this.#setState('scrollable-x', measurement.scrollableX)
    this.#setState('scrollable-y', measurement.scrollableY)
    this.#setState('hidden-start-x', measurement.hiddenStartX)
    this.#setState('hidden-end-x', measurement.hiddenEndX)
    this.#setState('hidden-start-y', measurement.hiddenStartY)
    this.#setState('hidden-end-y', measurement.hiddenEndY)
  }

  #setState(name: string, active: boolean) {
    if (active) this.#internals?.states.add(name)
    else this.#internals?.states.delete(name)
  }
}

export function register_a_box() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-box')) customElements.define('a-box', ABoxElement)
}

register_a_box()
