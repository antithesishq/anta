import type { ComposedScatter, RenderContext } from "../../types"
import { pixel_resolver } from "../../render/pixel_resolver"
import { draw_mark } from "../../render/mark"

const DOT_DIAMETER = 5

/**
 * Per-dot radius in pixels: per-row size, else the series size, else the default. Shared with
 * hit-testing so the hover region matches the drawn dot.
 * @param series - the scatter series
 * @param i - the row index
 * @returns the dot's pixel radius
 */
export function dot_radius(series: ComposedScatter, i: number): number {
    return (series.sizes?.[i] ?? series.size ?? DOT_DIAMETER) / 2
}

/**
 * Draw a scatter series as per-dot arcs, clipped to the inner rect. Per-row color and size override the series defaults.
 * @param series - the scatter series
 * @param render - the shared render context (canvas, inner rect, scales, fallback color)
 */
export function draw_scatter(series: ComposedScatter, render: RenderContext): void {
    const { ctx, x_scale, y_scale, color } = render
    ctx.fillStyle = color
    const length = series.x.length
    const colors = series.colors
    const mark = series.mark ?? 'circle'
    const stroke = series.stroke
    const resolve_x = pixel_resolver(x_scale, series.x)
    const resolve_y = pixel_resolver(y_scale, series.y)

    for (let i = 0; i < length; i++) {
        const center_x = resolve_x(i)

        if (center_x === undefined) {
            continue
        }
        const center_y = resolve_y(i)

        if (center_y === undefined) {
            continue
        }

        if (colors !== undefined) {
            ctx.fillStyle = colors[i] ?? color
        }
        const radius = dot_radius(series, i)
        draw_mark(ctx, mark, center_x, center_y, radius, stroke)
    }
}
