import { HTMLElementBase } from '../anta_helpers'
import type {
  BoxContext,
  BoxFont,
  BoxInset,
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
  | 'devicePixelRatio'
>

/** What one user-agent read yields. Computed once per window. */
type DeviceSnapshot = Pick<
  BoxContext,
  'os' | 'osVersion' | 'browser' | 'browserVersion' | 'mobile'
>

const stores = new WeakMap<Window, BoxWindowStore>()

/** A class attribute holding `dark` or `light`, matched against a mutation's
 * recorded previous value (a string, so `classList` is not available). */
const MODE_CLASS = /(?:^|\s)(?:dark|light)(?:\s|$)/

function hasModeClass(element: Element): boolean {
  return element.classList.contains('dark') || element.classList.contains('light')
}

/**
 * One per-window observer shared by every `a-box` in that window. It owns the
 * media-query listeners, the mode-class observer, and the visibility observer;
 * individual boxes own only their own geometry and focus observation.
 *
 * Both halves are refcounted and start idle. A page whose boxes report no
 * context attaches no listeners at all, and the last box to leave takes the
 * observers and the store itself with it.
 */
class BoxWindowStore {
  #contextBoxes = new Set<ABoxElement>()
  #observedBoxes = new Set<ABoxElement>()
  #dark: MediaQueryList
  #finePointer: MediaQueryList
  #coarsePointer: MediaQueryList
  #hover: MediaQueryList
  #reducedMotion: MediaQueryList
  #queries: MediaQueryList[]
  #classObserver?: MutationObserver
  #visibility?: IntersectionObserver
  #pixelRatio?: MediaQueryList
  #lastPixelRatio = 0
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
    this.#queries = [this.#dark, this.#finePointer, this.#coarsePointer, this.#hover, this.#reducedMotion]
    this.#device = deviceSnapshot(view.navigator)
  }

  /** Only a box with a `contextchange` listener subscribes, so a page that never
   * reads context pays for no media listeners and no document observer. */
  subscribeContext(box: ABoxElement) {
    if (this.#contextBoxes.size === 0) this.#startWatching()
    this.#contextBoxes.add(box)
  }

  unsubscribeContext(box: ABoxElement) {
    if (!this.#contextBoxes.delete(box)) return
    if (this.#contextBoxes.size === 0) this.#stopWatching()
    this.#collect()
  }

  /** Only a box that measures is tracked, and it measures only while on screen. */
  observeVisibility(box: ABoxElement) {
    // #sync runs on every attribute change, so this has to be idempotent.
    if (this.#observedBoxes.has(box)) return
    if (typeof this.view.IntersectionObserver === 'undefined') {
      box.visibilityDidChange(true)
      return
    }
    // threshold 0 only: any higher would re-fire on animated size changes.
    this.#visibility ??= new this.view.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const box = entry.target as ABoxElement
          if (this.#observedBoxes.has(box)) box.visibilityDidChange(entry.isIntersecting)
        }
      },
      { root: null, rootMargin: '0px', threshold: 0 },
    )
    this.#observedBoxes.add(box)
    this.#visibility.observe(box)
  }

  unobserveVisibility(box: ABoxElement) {
    if (!this.#observedBoxes.delete(box)) return
    this.#visibility?.unobserve(box)
    if (this.#observedBoxes.size === 0) {
      this.#visibility?.disconnect()
      this.#visibility = undefined
    }
    this.#collect()
  }

  snapshot(): SharedContext {
    return {
      globalMode: modeFromElement(this.doc.documentElement),
      systemAppearance: this.#dark.matches ? 'dark' : 'light',
      ...this.#device,
      pointer: this.#finePointer.matches ? 'fine' : this.#coarsePointer.matches ? 'coarse' : 'none',
      hover: this.#hover.matches,
      reducedMotion: this.#reducedMotion.matches,
      devicePixelRatio: this.view.devicePixelRatio,
    }
  }

  /* devicePixelRatio has no change event of its own, so two signals cover it.
     A resolution query pinned to the current value stops matching the moment
     the ratio moves; each fire re-arms against the new value. Page zoom also
     resizes the CSS viewport, and `resize` catches the engines and paths where
     the query stays quiet. Both funnel through the same guard, so whichever
     arrives first reports and the other is a no-op. */
  #watchPixelRatio() {
    this.#pixelRatio?.removeEventListener('change', this.#pixelRatioDidChange)
    this.#pixelRatio = this.view.matchMedia(`(resolution: ${this.view.devicePixelRatio}dppx)`)
    this.#pixelRatio.addEventListener('change', this.#pixelRatioDidChange, { once: true })
    this.#lastPixelRatio = this.view.devicePixelRatio
  }

  #pixelRatioDidChange = () => {
    if (this.view.devicePixelRatio === this.#lastPixelRatio) return
    this.#watchPixelRatio()
    this.#notifyAll()
  }

  #startWatching() {
    for (const query of this.#queries) query.addEventListener('change', this.#notifyAll)
    this.#watchPixelRatio()
    this.view.addEventListener('resize', this.#pixelRatioDidChange, { passive: true })
    const root = this.doc.documentElement
    if (!root) return
    this.#classObserver = new this.view.MutationObserver(this.#handleClassChange)
    this.#classObserver.observe(root, {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['class'],
    })
  }

  #stopWatching() {
    for (const query of this.#queries) query.removeEventListener('change', this.#notifyAll)
    this.#pixelRatio?.removeEventListener('change', this.#pixelRatioDidChange)
    this.#pixelRatio = undefined
    this.view.removeEventListener('resize', this.#pixelRatioDidChange)
    this.#classObserver?.disconnect()
    this.#classObserver = undefined
  }

  /* Only the store the map currently points at may remove that entry. A box
     that was connected while its store went empty keeps a direct reference to
     it, so an evicted store can be re-subscribed and later empty again — by
     which time the map holds a live store with its own document observer.
     Deleting blind would drop that live store and leave its observer running
     while the next connect built a second one. */
  #collect() {
    if (this.#contextBoxes.size > 0 || this.#observedBoxes.size > 0) return
    if (stores.get(this.view) === this) stores.delete(this.view)
  }

  /* Only `dark` and `light` change what a box reports. Every other class toggle
     on the page — a route class, a scroll lock, a theme-unrelated modifier —
     is dropped here, before the ancestor scan runs. */
  #handleClassChange = (records: MutationRecord[]) => {
    const affected = new Set<ABoxElement>()
    for (const record of records) {
      const target = record.target
      if (!(target instanceof this.view.Element)) continue
      if (!hasModeClass(target) && !MODE_CLASS.test(record.oldValue ?? '')) continue
      for (const box of this.#contextBoxes) {
        if (target === box || target.contains(box)) affected.add(box)
      }
    }
    for (const box of affected) box.contextStoreDidChange()
  }

  #notifyAll = () => {
    for (const box of this.#contextBoxes) box.contextStoreDidChange()
  }
}

function windowStore(view: Window & typeof globalThis, doc: Document): BoxWindowStore {
  let store = stores.get(view)
  if (!store) {
    store = new BoxWindowStore(view, doc)
    stores.set(view, store)
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

/** Field equality, one level deep. `font` is rebuilt on every read, so an
 * identity check would report it changed on every focus move. */
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key])
}

function same<T extends object>(a: T | undefined, b: T): boolean {
  return a !== undefined && Object.keys(b).every((key) => equal(a[key as keyof T], b[key as keyof T]))
}

function changed<T extends object>(previous: T | undefined, current: T): Partial<T> {
  if (!previous) return { ...current }
  return Object.fromEntries(
    Object.entries(current).filter(([key, value]) => !equal(previous[key as keyof T], value)),
  ) as Partial<T>
}

function px(value: string): number {
  return parseFloat(value) || 0
}

function readInset(styles: CSSStyleDeclaration): BoxInset {
  return {
    paddingTop: px(styles.paddingTop),
    paddingRight: px(styles.paddingRight),
    paddingBottom: px(styles.paddingBottom),
    paddingLeft: px(styles.paddingLeft),
    borderTop: px(styles.borderTopWidth),
    borderRight: px(styles.borderRightWidth),
    borderBottom: px(styles.borderBottomWidth),
    borderLeft: px(styles.borderLeftWidth),
  }
}

/** `normal` is the computed spacing default; canvas wants a length. */
function spacing(value: string): string {
  return value === 'normal' ? '0px' : value
}

/**
 * The resolved text style, assembled for a canvas 2D context.
 *
 * The shorthand is built by hand because `getComputedStyle(el).font` is an empty
 * string in Chromium, Firefox and WebKit alike. Stretch and variant stay out of
 * it: computed `font-stretch` is a percentage, and a percentage in the shorthand
 * makes every engine reject the whole declaration and fall back to
 * `10px sans-serif`. Both have their own canvas attributes instead.
 */
function readFont(styles: CSSStyleDeclaration): BoxFont {
  const lineHeightPx = parseFloat(styles.lineHeight)
  const lineHeight = Number.isFinite(lineHeightPx) ? lineHeightPx : null
  const style = styles.fontStyle && styles.fontStyle !== 'normal' ? `${styles.fontStyle} ` : ''
  const weight = styles.fontWeight && styles.fontWeight !== '400' ? `${styles.fontWeight} ` : ''
  const height = lineHeight != null ? `/${lineHeight}px` : ''
  return {
    shorthand: `${style}${weight}${styles.fontSize}${height} ${styles.fontFamily}`,
    family: styles.fontFamily,
    size: parseFloat(styles.fontSize) || 0,
    weight: parseFloat(styles.fontWeight) || 400,
    style: styles.fontStyle,
    stretch: styles.fontStretch,
    lineHeight,
    letterSpacing: spacing(styles.letterSpacing),
    wordSpacing: spacing(styles.wordSpacing),
    color: styles.color,
    featureSettings: styles.fontFeatureSettings,
    variationSettings: styles.fontVariationSettings,
    kerning: styles.fontKerning,
    variantCaps: styles.fontVariantCaps,
    textRendering: styles.textRendering,
    direction: styles.direction,
  }
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * `<a-box>` is a light-DOM container that observes itself. It leaves the host
 * and its children entirely to the renderer: all output is read-only getters,
 * `measurechange` / `contextchange` events, and private `ElementInternals`
 * states. This keeps measurement usable when JSX itself cannot access the DOM.
 *
 * Observation is opt-in by attribute and pauses off screen. `fade` or
 * `observe="size"` turns measurement on, `observe="context"` turns
 * `contextchange` on, `observe="all"` (or a bare `observe`) turns on both, and a box
 * with neither runs no observers at all — not even the shared visibility one.
 * The `measurement` / `context` / `isTruncated` getters still read on demand.
 *
 * Attributes rather than "is a listener attached" on purpose. A listener tally
 * cannot see listeners added before the element upgrades (the SSR pattern in
 * AGENTS.md), cannot see `once` or `AbortSignal` removals, and churns on every
 * React 19 render, because React removes and re-adds an `on*` prop whenever its
 * identity changes. The JSX wrapper stamps both attributes from its handler
 * props, so this is invisible to anyone using `Box`.
 */
export class ABoxElement extends HTMLElementBase {
  static observedAttributes = ['fade', 'observe']

  #internals = this.attachInternals?.()
  #store?: BoxWindowStore
  #resizeObserver?: ResizeObserver
  #contentObserver?: MutationObserver
  #hostObserver?: MutationObserver
  #frame?: number
  #contextQueued = false
  #measurement?: BoxMeasurement
  #context?: BoxContext
  #measuring = false
  #clips = false
  #observedChildren = new Set<Element>()
  #reportingContext = false
  /* Undefined until the visibility observer first reports. `fade` is the one
     thing that cannot wait for it — the mask is painted from the CSS states, so
     a box that deferred its first measurement would flash unmasked. Everything
     else stays idle until it is known to be on screen, which keeps a page of
     hundreds of boxes from measuring every one of them once at connect only to
     tear it all down a frame later. */
  #visible?: boolean
  #initialMeasurement = false
  #initialContext = false

  connectedCallback() {
    this.#store = windowStore(this.view, this.doc)
    this.#sync()
  }

  disconnectedCallback() {
    this.#stopMeasuring()
    this.#stopReportingContext()
    this.#store?.unobserveVisibility(this)
    this.#store = undefined
    this.#visible = undefined
  }

  /* Guarded on the store, not on `isConnected`: upgrading an element that is
     already in the document runs this for every present attribute *before*
     connectedCallback, when there is no store yet. Syncing then would flip the
     started flags while `this.#store?.subscribeContext` silently did nothing,
     and the later connect would see the flags already set and skip it. */
  attributeChangedCallback() {
    if (this.#store) this.#sync()
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
    this.#queueContext()
    this.#queueMeasurement()
  }

  /** Called by the per-window visibility observer. Also not a JSX prop. */
  visibilityDidChange(visible: boolean) {
    if (this.#visible === visible) return
    this.#visible = visible
    this.#sync()
  }

  /* Nothing observes until something wants the answer, and a box scrolled off
     screen wants nothing until it comes back. Context reporting ignores
     visibility: a mode change has to reach an off-screen box too, and the store
     it subscribes to is already refcounted down to nothing. */
  #sync() {
    // A bare `observe` reads as `all`; an unrecognized value observes nothing,
    // the same way an unknown `tone` falls through rather than guessing.
    const observe = this.getAttribute('observe')
    const both = observe === '' || observe === 'all'
    const wantsMeasurement = this.hasAttribute('fade') || both || observe === 'size'
    const wantsContext = both || observe === 'context'

    const measure = this.isConnected && wantsMeasurement && (this.#visible ?? this.hasAttribute('fade'))
    if (measure) this.#startMeasuring()
    else this.#stopMeasuring()

    if (this.isConnected && wantsMeasurement) this.#store?.observeVisibility(this)
    else this.#store?.unobserveVisibility(this)

    if (this.isConnected && wantsContext) this.#startReportingContext()
    else this.#stopReportingContext()

    this.#syncHostObserver()
  }

  /* The host's own attributes need their own observer: one observer cannot take
     `subtree: true` for childList and `subtree: false` for attributes on the
     same target. A class on this box can flip it to `overflow: auto` without
     changing its size, and can restyle its text, so both halves want to know. */
  #syncHostObserver() {
    const wanted = this.#measuring || this.#reportingContext
    if (wanted === Boolean(this.#hostObserver)) return
    if (wanted) {
      this.#hostObserver = new this.view.MutationObserver(this.#hostDidChange)
      this.#hostObserver.observe(this, { attributes: true })
    } else {
      this.#hostObserver?.disconnect()
      this.#hostObserver = undefined
    }
  }

  #hostDidChange = () => {
    this.#queueMeasurement()
    this.#queueContext()
  }

  #startMeasuring() {
    if (this.#measuring) return
    this.#measuring = true
    this.#resizeObserver = new this.view.ResizeObserver(this.#queueMeasurement)
    this.#resizeObserver.observe(this)
    // ResizeObserver only fires when the box itself changes size. A fixed-width
    // box whose content grows keeps its size while its scrollWidth moves, so
    // structure and text need watching too.
    //
    // Descendant *attributes* deliberately are not watched: a child whose
    // attribute changes its size is reported by that child's ResizeObserver
    // entry below, on the actual resize rather than on every attribute that
    // might cause one. Watching them re-measured on ordinary app churn — 100
    // aria/class flips that moved nothing cost 57 layout reads. The one case
    // this gives up is a `display: contents` direct child, which has no box and
    // so is invisible to ResizeObserver, whose grandchild resizes purely by
    // attribute; childList and characterData still cover content changes there.
    this.#contentObserver = new this.view.MutationObserver(this.#queueMeasurement)
    this.#contentObserver.observe(this, {
      subtree: true,
      childList: true,
      characterData: true,
    })
    this.addEventListener('input', this.#queueMeasurement)
    this.addEventListener('scroll', this.#queueMeasurement, { passive: true })
    this.addEventListener('load', this.#queueMeasurement, true)
    this.doc.fonts?.addEventListener('loadingdone', this.#queueMeasurement)
    // The states drive the `fade` mask, so they have to be right on the first
    // frame. The matching event waits a frame, so a listener attached mid-render
    // is never called back synchronously from inside its own `addEventListener`.
    this.#measurement = this.#readMeasurement()
    this.#setMeasurementStates(this.#measurement)
    this.#syncChildObservation()
    this.#initialMeasurement = true
    this.#queueMeasurement()
  }

  /* A clipping box's scroll size can move because a child's own size moved for
     a reason nothing else here can see: a late upgrade attaching a shadow root,
     or a child resizing from its own internal state (an Expander opening).
     Neither is a light-DOM mutation, and a fixed-size box never resizes, so the
     direct children go into the same ResizeObserver. A box with visible
     overflow hides nothing — a growing child just grows the box, which its own
     entry already reports — so it observes no children at all. */
  #syncChildObservation() {
    if (!this.#clips || !this.#measuring) {
      for (const child of this.#observedChildren) this.#resizeObserver?.unobserve(child)
      this.#observedChildren.clear()
      return
    }
    const current = new Set<Element>(this.children)
    for (const child of this.#observedChildren) {
      if (current.has(child)) continue
      this.#resizeObserver?.unobserve(child)
      this.#observedChildren.delete(child)
    }
    for (const child of current) {
      if (this.#observedChildren.has(child)) continue
      this.#resizeObserver?.observe(child)
      this.#observedChildren.add(child)
    }
  }

  #stopMeasuring() {
    if (!this.#measuring) return
    this.#measuring = false
    this.#observedChildren.clear()
    this.#resizeObserver?.disconnect()
    this.#resizeObserver = undefined
    this.#contentObserver?.disconnect()
    this.#contentObserver = undefined
    if (this.#frame != null) this.view.cancelAnimationFrame(this.#frame)
    this.#frame = undefined
    this.removeEventListener('input', this.#queueMeasurement)
    this.removeEventListener('scroll', this.#queueMeasurement)
    this.removeEventListener('load', this.#queueMeasurement, true)
    this.doc.fonts?.removeEventListener('loadingdone', this.#queueMeasurement)
    // The last states stay set. Clearing them would flash the `fade` mask off
    // and back on as a box scrolls past the viewport edge.
  }

  #startReportingContext() {
    if (this.#reportingContext) return
    this.#reportingContext = true
    this.#store?.subscribeContext(this)
    this.addEventListener('focusin', this.#queueContext)
    this.addEventListener('focusout', this.#handleFocusOut)
    // A webfont arriving changes the resolved family and its metrics.
    this.doc.fonts?.addEventListener('loadingdone', this.#queueContext)
    this.#initialContext = true
    this.#queueContext()
  }

  #stopReportingContext() {
    if (!this.#reportingContext) return
    this.#reportingContext = false
    this.#store?.unsubscribeContext(this)
    this.removeEventListener('focusin', this.#queueContext)
    this.removeEventListener('focusout', this.#handleFocusOut)
    this.doc.fonts?.removeEventListener('loadingdone', this.#queueContext)
  }

  /* Tabbing between two descendants fires focusout then focusin, and WebKit runs
     a microtask checkpoint between the two — long enough to report a
     focusWithin: false that was never true for the reader. `relatedTarget` is
     where focus is heading (retargeted to the host for a shadow child), so a
     move that stays inside is not a change at all. */
  #handleFocusOut = (event: Event) => {
    const next = (event as FocusEvent).relatedTarget
    if (next instanceof this.view.Node && this.contains(next)) return
    this.#queueContext()
  }

  #queueMeasurement = () => {
    if (!this.#measuring || this.#frame != null) return
    this.#frame = this.view.requestAnimationFrame(() => {
      this.#frame = undefined
      if (!this.#measuring) return
      const initial = this.#initialMeasurement
      this.#initialMeasurement = false
      this.#reportMeasurement(initial)
    })
  }

  #queueContext = () => {
    if (!this.#reportingContext || this.#contextQueued) return
    this.#contextQueued = true
    queueMicrotask(() => {
      this.#contextQueued = false
      if (!this.#reportingContext) return
      const initial = this.#initialContext
      this.#initialContext = false
      this.#reportContext(initial)
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
    // Whether this box *can* hide content, not whether it currently does. The
    // child observation below keys off it, and keying off actual overflow would
    // be circular: an un-upgraded child is exactly why there is no overflow yet.
    this.#clips = styles.overflowX !== 'visible' || styles.overflowY !== 'visible'
    const clippedX = overflowX && styles.overflowX !== 'visible'
    const clippedY = overflowY && styles.overflowY !== 'visible'
    const scrollableX = overflowX && (styles.overflowX === 'auto' || styles.overflowX === 'scroll')
    const scrollableY = overflowY && (styles.overflowY === 'auto' || styles.overflowY === 'scroll')
    const scrollLeft = Math.round(this.scrollLeft)
    const scrollTop = Math.round(this.scrollTop)
    // A right-to-left box scrolls into negative `scrollLeft`, so the start edge
    // is whichever end the sign runs from. Clamping instead of taking the
    // magnitude matters during elastic overscroll, where the sign flips past the
    // resting edge: `Math.abs` would read that rubber-band as real distance and
    // flash a start-edge fade.
    const fromStartX = Math.max(0, styles.direction === 'rtl' ? -scrollLeft : scrollLeft)
    const fromStartY = Math.max(0, scrollTop)
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
    const shared = (this.#store ?? windowStore(this.view, this.doc)).snapshot()
    // One style read feeds the font, the inset, and the background.
    const styles = this.view.getComputedStyle(this)
    return {
      ...shared,
      mode: localMode(this),
      focusWithin: this.matches(':focus-within'),
      font: readFont(styles),
      inset: readInset(styles),
      backgroundColor: styles.backgroundColor,
    }
  }

  #reportMeasurement(initial: boolean) {
    const current = this.#readMeasurement()
    const previous = this.#measurement
    this.#measurement = current
    this.#setMeasurementStates(current)
    this.#syncChildObservation()
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
    if (active) this.#internals?.states?.add(name)
    else this.#internals?.states?.delete(name)
  }
}

export function register_a_box() {
  if (typeof customElements === 'undefined') return
  if (!customElements.get('a-box')) customElements.define('a-box', ABoxElement)
}

register_a_box()
