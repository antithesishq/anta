import type { BaseAttributes } from '@antadesign/anta/general_types'

/**
 * Attributes for the `<a-sticker>` static sticker carrier.
 *
 * The SVG payload is passed as the `svg` attribute — a markup string.
 * On change, the element writes it into its shadow DOM (no light-DOM
 * `<slot>`, so children aren't rendered). The JSX wrapper
 * (`Sticker{Name}`) sets it from the per-sticker module's inlined SVG.
 * Sizing comes from `--sticker-size`.
 */
export interface AStickerAttributes extends BaseAttributes {
  /** SVG markup string. On change the element drops it into its shadow
   *  DOM (`innerHTML`). */
  svg?: string
  role?: string
  'aria-label'?: string
  'aria-hidden'?: 'true' | 'false' | boolean
}

/**
 * Attributes for the `<a-sticker-animated>` Lottie sticker carrier.
 *
 * The Lottie payload is passed as the `animation` attribute — a JSON
 * string. On change the element `JSON.parse`s it once and drives a
 * `lottie-web` player (SVG renderer) inside its shadow DOM. The JSX
 * wrapper (`Sticker{Name}Animated`) sets it from the per-sticker
 * module's inlined JSON. Sizing comes from the `--sticker-size` CSS
 * variable; `paused`, `delay`, `play-once`, and `replay-on-click` control
 * playback.
 */
export interface AStickerAnimatedAttributes extends BaseAttributes {
  /** Lottie payload as a JSON string. The element parses it once on
   *  change. */
  animation?: string
  /** Present (any string value, including `""`) freezes the animation.
   *  A numeric string is parsed as seconds and the player seeks to
   *  that time before pausing. Omit to play. */
  paused?: string | boolean | number
  /** Seconds to wait at the first frame before playing. */
  delay?: string | number
  /** Present: play once, then hold the final frame. */
  'play-once'?: boolean | ''
  /** With `play-once`: activate the sticker to replay its animation. */
  'replay-on-click'?: boolean | ''
  role?: string
  'aria-label'?: string
  'aria-hidden'?: 'true' | 'false' | boolean
}

/**
 * The two sticker `<a-*>` tags. Companion to anta's
 * `AntaIntrinsicElements` — consumers using the global-merge pattern
 * extend both to get a complete set of intrinsic elements:
 *
 * ```ts
 * import type { AntaIntrinsicElements } from '@antadesign/anta'
 * import type { StickerIntrinsicElements } from '@antadesign/stickers'
 * declare global {
 *   namespace JSX {
 *     interface IntrinsicElements extends AntaIntrinsicElements, StickerIntrinsicElements {}
 *   }
 * }
 * ```
 */
export interface StickerIntrinsicElements {
  'a-sticker': AStickerAttributes
  'a-sticker-animated': AStickerAnimatedAttributes
}

// Teach anta's JSX runtime about this package's two custom-element tags.
// `<a-sticker>` / `<a-sticker-animated>` written directly in JSX type-check
// for consumers using `jsxImportSource: "@antadesign/anta"` — anta's
// module-scoped `JSX.IntrinsicElements` picks up these members via
// interface merging.
declare module '@antadesign/anta/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends StickerIntrinsicElements {}
  }
}
