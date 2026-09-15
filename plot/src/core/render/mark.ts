import type { CanvasContext, MarkShape } from "../types"

const STROKE_AUTO_FRACTION = 0.1 // border width as a fraction of the mark diameter
const STROKE_MIN_WIDTH = 0.5
const STROKE_MAX_WIDTH = 1.5

/**
 * Draw a filled mark, with an optional border. Shared by scatter dots and line vertex markers. The caller
 * sets the fill color (`ctx.fillStyle`, which may vary per row); the border color / width come from `stroke`.
 * An unpinned stroke width auto-scales to the mark diameter so it stays proportionate across sizes.
 * @param ctx - canvas context
 * @param shape - the mark shape
 * @param cx - center x in pixels
 * @param cy - center y in pixels
 * @param radius - the mark radius in pixels
 * @param stroke - the resolved border { color, width? }, or undefined for no border
 */
export function draw_mark(ctx: CanvasContext, shape: MarkShape, cx: number, cy: number, radius: number, stroke: { color: string; width?: number } | undefined): void {
    trace_mark(ctx, shape, cx, cy, radius)
    ctx.fill()

    if (stroke === undefined) {
        return
    }
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width ?? mark_stroke_width(radius)
    ctx.stroke()
}

/**
 * Derive a mark's border width from its radius, scaling with the diameter and clamped, so an unpinned
 * stroke stays proportionate across mark sizes.
 * @param radius - the mark radius in pixels
 * @returns the clamped stroke width in pixels
 */
function mark_stroke_width(radius: number): number {
    const derived = radius * 2 * STROKE_AUTO_FRACTION
    return Math.max(STROKE_MIN_WIDTH, Math.min(derived, STROKE_MAX_WIDTH))
}

// diamond is a square rotated 45°: side matches the square, so its half-diagonal is radius · √2
export const DIAMOND_HALF_DIAGONAL = Math.SQRT2

// upward equilateral triangle with side 2·radius
const TRIANGLE_HALF_BASE = 1
export const TRIANGLE_APEX_RISE = 2 / Math.sqrt(3)
export const TRIANGLE_BASE_DROP = 1 / Math.sqrt(3)
export const TRIANGLE_SIZE_SCALE = 1.2

/**
 * Trace a mark's outline as the current path (draw_mark fills / strokes it).
 * @param ctx - canvas context
 * @param shape - the mark shape
 * @param cx - center x in pixels
 * @param cy - center y in pixels
 * @param radius - the mark radius in pixels
 */
function trace_mark(ctx: CanvasContext, shape: MarkShape, cx: number, cy: number, radius: number): void {
    ctx.beginPath()

    switch (shape) {
        case 'square':
            ctx.rect(cx - radius, cy - radius, radius * 2, radius * 2)
            break

        case 'diamond': {
            const half_diagonal = radius * DIAMOND_HALF_DIAGONAL
            ctx.moveTo(cx, cy - half_diagonal)
            ctx.lineTo(cx + half_diagonal, cy)
            ctx.lineTo(cx, cy + half_diagonal)
            ctx.lineTo(cx - half_diagonal, cy)
            ctx.closePath()
            break
        }

        case 'triangle': {
            const r = radius * TRIANGLE_SIZE_SCALE
            const half_base = r * TRIANGLE_HALF_BASE
            const base_y = cy + r * TRIANGLE_BASE_DROP
            ctx.moveTo(cx, cy - r * TRIANGLE_APEX_RISE)
            ctx.lineTo(cx + half_base, base_y)
            ctx.lineTo(cx - half_base, base_y)
            ctx.closePath()
            break
        }

        // circle is the default
        default:
            ctx.arc(cx, cy, radius, 0, 2 * Math.PI)
    }
}
