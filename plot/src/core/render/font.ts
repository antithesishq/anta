import type { CanvasContext, ResolvedFontConfig } from "../types"

/** Apply the same font state for drawing and measurement, including optional canvas text features. */
export function apply_canvas_font(ctx: CanvasContext, font: ResolvedFontConfig, fallback: 'sans-serif' | 'monospace' = 'sans-serif'): void {
    const style = font.italic ? 'italic' : 'normal'
    const stretch = font.condensed ? 'condensed' : 'normal'
    ctx.fillStyle = font.color
    ctx.font = `${style} ${font.weight} ${stretch} ${font.size}px ${font.family}, ${fallback}`

    if ('fontKerning' in ctx) ctx.fontKerning = 'normal'
    if ('fontStretch' in ctx) ctx.fontStretch = stretch
    if ('fontVariantCaps' in ctx) ctx.fontVariantCaps = font.caps
    if ('textRendering' in ctx) ctx.textRendering = 'optimizeLegibility'
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${font.letter_spacing}px`
    if ('wordSpacing' in ctx) ctx.wordSpacing = `${font.word_spacing}px`
}
