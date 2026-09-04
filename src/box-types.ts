/** Display modes supplied by `Box`. The element is a real light-DOM CSS box,
 * so every other layout property remains ordinary CSS on the host. */
export type BoxDisplay = 'block' | 'inline-block' | 'flex' | 'inline-flex' | 'grid' | 'inline-grid'

/** Color mode resolved from the closest `.light` or `.dark` ancestor. */
export type BoxMode = 'light' | 'dark'

/** Operating-system family. Anta deliberately does not expose a user-agent string. */
export type BoxOS = 'android' | 'ios' | 'linux' | 'macos' | 'windows' | 'unknown'

/** Browser family. */
export type BoxBrowser = 'chrome' | 'edge' | 'firefox' | 'opera' | 'safari' | 'unknown'

/** Primary pointing-device capability reported by the browser. */
export type BoxPointer = 'fine' | 'coarse' | 'none'

/** Current state that affects a box's rendering or interaction decisions. */
/**
 * Distance from the box's border edge to its content edge, in CSS pixels.
 *
 * Not derivable from `BoxMeasurement`: `width` / `height` are the border box and
 * `clientWidth` / `clientHeight` are the padding box, so neither the padding nor
 * the border thickness can be recovered from them. Add a padding and its border
 * to place content relative to the border box.
 */
export interface BoxInset {
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  borderTop: number
  borderRight: number
  borderBottom: number
  borderLeft: number
}

/**
 * The box's resolved text style, shaped to configure a canvas 2D context.
 *
 * Assign `shorthand` to `ctx.font` **first**: Chromium and Firefox reset
 * `fontStretch`, `fontVariantCaps`, `fontKerning` and `textRendering` when
 * `font` is assigned, so setting those before it loses them.
 */
export interface BoxFont {
  /** CSS `font` shorthand, assembled here because every engine returns an empty
   * string for the computed shorthand. `stretch` and `variantCaps` are left out
   * of it deliberately: a percentage `font-stretch` makes every engine reject
   * the whole string and fall back to `10px sans-serif`. Apply those through
   * `ctx.fontStretch` / `ctx.fontVariantCaps` after setting `ctx.font`. */
  shorthand: string
  /** Resolved family list, quoted as the engine reports it. */
  family: string
  /** Font size in CSS pixels. */
  size: number
  /** Numeric weight, 1-1000. */
  weight: number
  /** `normal`, `italic`, or an `oblique <angle>`. */
  style: string
  /** Computed `font-stretch`, a percentage such as `88%`. Canvas: `ctx.fontStretch`. */
  stretch: string
  /** Line height in CSS pixels, or `null` when it computes to `normal`. Canvas
   * ignores line height in `ctx.font`; this is for laying text out yourself. */
  lineHeight: number | null
  /** A length, never `normal` - `normal` is reported as `0px`, which is what
   * `ctx.letterSpacing` accepts. */
  letterSpacing: string
  /** Same normalization as `letterSpacing`. Canvas: `ctx.wordSpacing`. */
  wordSpacing: string
  /** Resolved text color. Canvas: `ctx.fillStyle`. */
  color: string
  /** Canvas 2D consumes neither of these. They are here for text you measure or
   * draw some other way. */
  featureSettings: string
  variationSettings: string
  /** Canvas: `ctx.fontKerning`. */
  kerning: string
  /** Canvas: `ctx.fontVariantCaps`. */
  variantCaps: string
  /** Canvas: `ctx.textRendering`, which WebKit does not implement. */
  textRendering: string
  /** Canvas: `ctx.direction`. */
  direction: string
}

export interface BoxContext {
  /** Closest scoped Anta mode. A local `.light` can override a dark document. */
  mode: BoxMode
  /** Mode on `<html>`, independent of an enclosing local scope. */
  globalMode: BoxMode
  /** Browser / operating-system color preference, independent of Anta classes. */
  systemAppearance: BoxMode
  /** Whether focus is on the box or any of its descendants, read from the
   * native `:focus-within`. For CSS, use that pseudo-class directly; this field
   * is for logic that cannot query the DOM. */
  focusWithin: boolean
  /** Operating-system family. */
  os: BoxOS
  /** Operating-system major version, or `0` when the browser withholds it.
   * Browsers freeze this: every engine reports macOS as `10.15.7` and Windows 11
   * as `10.0`, so only Android and iOS carry a real number. Treat it as a hint,
   * never as a gate. */
  osVersion: number
  /** Browser family. */
  browser: BoxBrowser
  /** Browser major version, or `0` when unknown. Minor and patch digits are
   * frozen by every engine, so only the major number is reported. */
  browserVersion: number
  /** Whether the browser reports a mobile device. */
  mobile: boolean
  /** Most precise available primary pointer. */
  pointer: BoxPointer
  /** Whether ordinary hover interaction is available. */
  hover: boolean
  /** Whether the reader asks for reduced motion. */
  reducedMotion: boolean
  /** `window.devicePixelRatio`: CSS pixels per device pixel. `1` on a standard
   * display, `2` on most Retina screens, and a fraction under OS or browser
   * zoom. Live — it re-reports on zoom and when the window moves to a monitor
   * with a different density. */
  devicePixelRatio: number
  /** Resolved text style, ready to hand to a canvas 2D context. */
  font: BoxFont
  /** Padding and border widths, for placing content inside the border box. */
  inset: BoxInset
  /** Resolved `background-color`. Needed when the box's content is drawn
   * somewhere else — an offscreen canvas, a worker, an export — where the box's
   * own background is not behind it. */
  backgroundColor: string
}

/** Current box dimensions and its content-overflow state. */
export interface BoxMeasurement {
  /** Border-box width and height in CSS pixels. */
  width: number
  height: number
  /** Padding-box dimensions, matching the browser's `clientWidth` / `clientHeight`. */
  clientWidth: number
  clientHeight: number
  /** Full scrollable-content dimensions, matching `scrollWidth` / `scrollHeight`. */
  scrollWidth: number
  scrollHeight: number
  /** Content exceeds the padding box on this axis, regardless of CSS overflow. */
  overflowX: boolean
  overflowY: boolean
  /** The exceeded content is visually clipped on this axis. */
  clippedX: boolean
  clippedY: boolean
  /** The exceeded content can be scrolled by the reader on this axis. */
  scrollableX: boolean
  scrollableY: boolean
  /** Current scroll offset, matching `scrollLeft` / `scrollTop`. */
  scrollLeft: number
  scrollTop: number
  /** Clipped content sits past this specific edge, in logical writing-mode
   * terms. A clipped box that has not been scrolled hides content past its end
   * edge only; scroll it to the end and the hidden content moves to the start.
   * These drive the `fade` mask. */
  hiddenStartX: boolean
  hiddenEndX: boolean
  hiddenStartY: boolean
  hiddenEndY: boolean
}

/** Every Box event includes just the changed fields and a complete current snapshot. */
export interface BoxChange<T> {
  changed: Partial<T>
  current: T
}

export type BoxContextChange = BoxChange<BoxContext>
export type BoxMeasurementChange = BoxChange<BoxMeasurement>
