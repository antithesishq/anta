import type { CanvasContext, ColorTheme, ComposedPlot, HighlightSpec, Rect } from '../types'
import {
    resolve_highlight_color, resolve_rect_highlight_box, resolve_highlight_corner_radii,
} from '../interactions/highlight'
import { draw_mark } from './mark'
import { prepare_canvas_context } from './canvas'
import type { NearestPoint } from '../interactions/hit'
import { resolve_highlights } from '../interactions/highlight'
import { custom_resolvers } from '../series/custom/paint'
import { color_resolver, DEFAULT_SERIES_COLOR } from '../template/color'

/** Draw the topmost eligible hit, including custom canvas renderers. */
export function update_hover_canvas<Content>(ctx: CanvasContext, plot: ComposedPlot<Content> | null, dpr: number, hits: NearestPoint[]): void {
    if (plot === null) {
        clear_highlights(ctx)
        return
    }
    prepare_canvas_context(ctx, plot.layout.width, plot.layout.height, dpr)
    clear_highlights(ctx)
    for (const hit of hits) {
        const series = plot.series[hit.series_index]
        if (!series || series.hoverable === false || series.highlight === false || hit.point_index < 0 || hit.point_index >= series.x.length) continue
        if (series.kind !== 'custom') {
            const specs = resolve_highlights(plot, [hit])
            if (specs.length === 0) continue
            draw_highlights(ctx, specs, plot.inner, plot.chrome_theme)
            return
        }
        ctx.save()
        try {
            const { inner, x_scale, y_scale, x_categories, y_categories } = plot
            ctx.beginPath()
            ctx.rect(inner.left, inner.top, inner.right - inner.left, inner.bottom - inner.top)
            ctx.clip()
            const render = { ctx, inner, x_scale, y_scale, x_categories, y_categories, color: series.color ?? DEFAULT_SERIES_COLOR }
            const i = hit.point_index
            if (series.render_highlight) {
                const color_at = color_resolver(series.colors, render.color)
                series.render_highlight(series, i, {
                    ...render, ...custom_resolvers(series, x_scale, y_scale), color_at,
                    highlight_color_at: index => resolve_highlight_color(color_at(index), plot.chrome_theme),
                })
            } else {
                const highlight_color = series.highlight_colors?.[i] ?? series.highlight_color
                const point_series = {
                    ...series,
                    x: series.x.slice(i, i + 1), y: series.y.slice(i, i + 1),
                    rows: series.rows?.slice(i, i + 1), colors: series.colors?.slice(i, i + 1),
                    labels: series.labels?.slice(i, i + 1),
                    highlight_colors: series.highlight_colors?.slice(i, i + 1),
                }
                if (highlight_color !== undefined) {
                    point_series.color = highlight_color
                    point_series.colors = [highlight_color]
                    render.color = highlight_color
                }
                series.renderer(point_series, {
                    ...render, ...custom_resolvers(point_series, x_scale, y_scale),
                    color_at: color_resolver(point_series.colors, render.color),
                })
            }
        } catch (error) {
            clear_highlights(ctx)
            console.warn('plot.custom: render_highlight threw, skipping highlight.', error)
        } finally {
            ctx.restore()
        }
        return
    }
}

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
            ctx.fillStyle = spec.highlight_color ?? resolve_highlight_color(spec.color, theme)
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
