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
