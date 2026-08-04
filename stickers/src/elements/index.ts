/**
 * Barrel: registers BOTH sticker custom elements (the convenience path).
 *
 * Each `a-{name}` module self-registers and imports its own CSS when loaded,
 * so re-exporting them here (which evaluates each module) registers the pair
 * + injects their CSS. Importing this barrel for side effects —
 * `import '@antadesign/stickers/elements'` — gives you both.
 *
 * To reduce bundle size, import only the element you use:
 *   import '@antadesign/stickers/elements/a-sticker'   // static only — no lottie-web
 * The animated element is the only one that pulls in `lottie-web`, so the
 * granular static path keeps it out of your bundle entirely.
 *
 * Must only be imported client-side — registration is guarded against missing
 * `customElements` (SSR), but there's no reason to load it server-side.
 */
export { AStickerElement, register_a_sticker } from './a-sticker'
export { AStickerAnimatedElement, register_a_sticker_animated } from './a-sticker-animated'
