import type { CanvasContext, ComposedRule, Rect, RenderContext } from "../../types"
import { pixel_resolver } from "../../render/pixel_resolver"

export const DEFAULT_RULE_WIDTH = 1

/**
 * The column carrying the rule values — the other one is all NaN. Shared by paint, hit-testing, and highlight.
 * @param series - the composed rule series
 * @returns the values on the rule's own axis
 */
export function rule_values(series: ComposedRule): Float64Array {
    return series.side === 'x' ? series.x : series.y
}

/**
 * Draw a rule series: one straight line per value, spanning the inner rect on the other axis. Unlike a line
 * series the span isn't data-driven, so it reaches the plot edges exactly rather than stopping at the first
 * and last point.
 * @param series - the rule series
 * @param render - the shared render context (canvas, inner rect, scales, fallback color)
 */
export function draw_rule(series: ComposedRule, render: RenderContext): void {
    const { ctx, inner, x_scale, y_scale, color } = render
    const values = rule_values(series)

    if (values.length === 0) {
        return
    }
    const width = series.width ?? DEFAULT_RULE_WIDTH
    const resolve = pixel_resolver(series.side === 'x' ? x_scale : y_scale, values)
    const colors = series.colors
    ctx.lineWidth = width
    ctx.setLineDash(series.dash ?? [])
    ctx.strokeStyle = color

    for (let i = 0; i < values.length; i++) {
        const pos = resolve(i)

        if (pos === undefined || !Number.isFinite(pos)) {
            continue
        }

        if (colors !== undefined) {
            ctx.strokeStyle = colors[i] ?? color
        }
        stroke_rule(ctx, series.side, crisp_rule_pos(pos, width), inner)
    }
}

/**
 * Stroke one rule edge to edge across the inner rect.
 * @param ctx - canvas context
 * @param side - the axis the rule's value lives on
 * @param pos - the pixel position on that axis
 * @param inner - inner plot rect
 */
function stroke_rule(ctx: CanvasContext, side: 'x' | 'y', pos: number, inner: Rect): void {
    ctx.beginPath()

    if (side === 'x') {
        ctx.moveTo(pos, inner.top)
        ctx.lineTo(pos, inner.bottom)
    } else {
        ctx.moveTo(inner.left, pos)
        ctx.lineTo(inner.right, pos)
    }
    ctx.stroke()
}

/**
 * Snap a rule to a device pixel so a thin line paints solid instead of antialiasing across two rows.
 * @param pos - the raw scale position
 * @param width - the stroke width in pixels
 * @returns the pixel coordinate to stroke at
 */
export function crisp_rule_pos(pos: number, width: number): number {
    if (!Number.isInteger(width)) {
        return pos
    }

    if (width % 2 === 0) {
        return Math.round(pos)
    }
    return Math.round(pos) + 0.5
}
