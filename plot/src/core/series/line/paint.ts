import type { ComposedLine, RenderContext } from "../../types"
import { pixel_resolver } from "../../render/pixel_resolver"
import { draw_mark } from "../../render/mark"

const DEFAULT_WIDTH = 2
const DEFAULT_MARK_DIAMETER = 6

/**
 * Draw a line series: connect the points in data order with straight segments, clipped to the inner rect.
 * A point that doesn't resolve (unknown category / non-finite) breaks the line, restarting a fresh segment
 * at the next valid point. With `mark` set, a vertex marker is drawn at each point in the line color.
 * @param series - the line series
 * @param render - the shared render context (canvas, inner rect, scales, fallback color)
 */
export function draw_line(series: ComposedLine, render: RenderContext): void {
    const { ctx, x_scale, y_scale, color } = render

    if (series.x.length === 0) {
        return
    }
    const length = series.x.length
    const resolve_x = pixel_resolver(x_scale, series.x)
    const resolve_y = pixel_resolver(y_scale, series.y)

    ctx.strokeStyle = color
    ctx.lineWidth = series.width ?? DEFAULT_WIDTH
    ctx.setLineDash(series.dash ?? [])

    ctx.beginPath()
    let pen_down = false

    for (let i = 0; i < length; i++) {
        const px = resolve_x(i)
        const py = resolve_y(i)

        if (px === undefined || py === undefined) {
            pen_down = false
            continue
        }

        if (pen_down) {
            ctx.lineTo(px, py)
        } else {
            ctx.moveTo(px, py)
            pen_down = true
        }
    }
    ctx.stroke()

    if (series.mark !== undefined) {
        draw_vertex_marks(ctx, series, resolve_x, resolve_y, color)
    }
}

/**
 * Draw a filled marker at each vertex, in the line color.
 * @param ctx - canvas context
 * @param series - the line series
 * @param resolve_x - x pixel resolver
 * @param resolve_y - y pixel resolver
 * @param color - the line (and marker) color
 */
function draw_vertex_marks(
    ctx: RenderContext['ctx'],
    series: ComposedLine,
    resolve_x: (i: number) => number | undefined,
    resolve_y: (i: number) => number | undefined,
    color: string,
): void {
    const radius = vertex_radius(series)
    const mark = series.mark ?? 'circle'
    const stroke = series.stroke
    ctx.setLineDash([])
    ctx.fillStyle = color

    for (let i = 0; i < series.x.length; i++) {
        const px = resolve_x(i)
        const py = resolve_y(i)

        if (px === undefined || py === undefined) {
            continue
        }
        draw_mark(ctx, mark, px, py, radius, stroke)
    }
}

/**
 * A line vertex's marker radius in pixels: half the mark size, else the default.
 * @param series - the line series
 * @returns the vertex marker radius
 */
export function vertex_radius(series: ComposedLine): number {
    return (series.mark_size ?? DEFAULT_MARK_DIAMETER) / 2
}
