/**
 * @antadesign/stickers — Anta sticker pack.
 *
 * Square illustrated stickers, two flavors per name: a lightweight
 * static SVG (`Sticker{Name}`) and a Lottie-driven animated version
 * (`Sticker{Name}Animated`). Each is its own named export from the
 * generated barrel below, so a consumer's bundler ships only the
 * stickers actually used.
 *
 * Companion to `@antadesign/anta` — it provides the JSX runtime and
 * shared helpers; this package adds the `<a-sticker>` /
 * `<a-sticker-animated>` elements, their wrappers, and the artwork.
 *
 * ```ts
 * import { StickerCoding, StickerCodingAnimated } from '@antadesign/stickers'
 * import '@antadesign/stickers/elements' // register elements (client-side)
 * ```
 *
 * @packageDocumentation
 */
export { Sticker } from './Sticker'
export type { StickerProps } from './Sticker'
export { StickerAnimated } from './StickerAnimated'
export type { StickerAnimatedProps } from './StickerAnimated'
export type {
  AStickerAttributes,
  AStickerAnimatedAttributes,
  StickerIntrinsicElements,
} from './jsx'

// Generated per-sticker components (Sticker{Name} / Sticker{Name}Animated).
export * from './generated'
