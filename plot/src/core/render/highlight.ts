import type { CanvasContext, ColorTheme, ComposedPlot, HighlightSpec, Rect } from '../types'
import {
    resolve_highlight_color, resolve_rect_highlight_box, resolve_highlight_corner_radii,
} from '../interactions/highlight'
import { draw_mark } from './mark'
import { prepare_canvas_context } from './canvas'

/** Refresh a highlight surface, resolving geometry after clearing so failed resolution leaves no stale image. */
export function update_highlight_canvas(
    ctx: CanvasContext,
    plot: Pick<ComposedPlot, 'layout' | 'inner' | 'chrome_theme'> | null,
    dpr: number,
    resolve_specs: () => HighlightSpec[],
): void {
    if (plot === null) {
        clear_highlights(ctx)
        return
    }
    prepare_canvas_context(ctx, plot.layout.width, plot.layout.height, dpr)
    clear_highlights(ctx)
    draw_highlights(ctx, resolve_specs(), plot.inner, plot.chrome_theme)
}

/** Clear the entire backing store independently of the current DPR transform. */
export function clear_highlights(ctx: CanvasContext): void {
    ctx.save()
    try {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    } finally {
        ctx.restore()
    }
}

/** Paint highlight specs within the plot bounds, preserving the caller's canvas state. */
export function draw_highlights(
    ctx: CanvasContext,
    specs: HighlightSpec[],
    inner: Rect,
    theme: ColorTheme,
): void {
    ctx.save()
    try {
        ctx.beginPath()
        ctx.rect(inner.left, inner.top, inner.right - inner.left, inner.bottom - inner.top)
        ctx.clip()

        for (const spec of specs) {
            ctx.fillStyle = resolve_highlight_color(spec.color, theme)
            if (spec.shape === 'mark') {
                draw_mark(ctx, spec.mark, spec.cx, spec.cy, spec.r, undefined)
            } else {
                draw_rect_highlight(ctx, spec, inner)
            }
        }
    } finally {
        ctx.restore()
    }
}

// Match the old DOM overlay: snap relative to its origin and keep thin shapes at least one CSS pixel.
function draw_rect_highlight(
    ctx: CanvasContext,
    spec: Extract<HighlightSpec, { shape: 'rect' }>,
    inner: Rect,
): void {
    const { left, top, width, height } = resolve_rect_highlight_box(spec, inner)
    const radii = resolve_highlight_corner_radii(spec.border_radius, width, height)

    ctx.beginPath()
    ctx.roundRect(inner.left + left, inner.top + top, width, height, radii)
    ctx.fill()
}
