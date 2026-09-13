import type { CanvasContext, ComposedErrorBar, RenderContext, Scale } from "../../types"
import { pixel_resolver } from "../../render/pixel_resolver"
import { draw_mark } from "../../render/mark"
import { crisp_rule_pos } from "../rule/paint"

const DEFAULT_MARK_DIAMETER = 6
const DEFAULT_WIDTH = 1.5
const DEFAULT_CAP_LENGTH = 8

// one error bar in pixels: where its center sits across the interval, and where the interval's ends land
export type ErrorBarPixels = {
    cross: number
    center: number
    low: number
    high: number
}

/**
 * The center mark's radius in pixels: half the mark size, else the default. Shared with hit-testing and the
 * highlight so the hover region matches the drawn mark.
 * @param series - the composed error bar series
 * @returns the mark radius
 */
export function error_bar_mark_radius(series: ComposedErrorBar): number {
    return (series.size ?? DEFAULT_MARK_DIAMETER) / 2
}

/**
 * Whether the interval runs down the canvas rather than across it. A `side` of y is the common vertical
 * error bar: the interval spans y, the center rides x.
 * @param series - the composed error bar series
 * @returns true when the interval runs vertically
 */
export function is_vertical_error_bar(series: ComposedErrorBar): boolean {
    return series.side === 'y'
}

/**
 * Build a resolver for one error bar's pixel geometry, hoisting the per-axis branch out of the caller's
 * loop the way pixel_resolver hoists the band branch. Returns undefined for a row that can't be placed.
 * @param series - the composed error bar series
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @returns a resolver mapping row index to its pixel geometry, or undefined to skip
 */
export function error_bar_resolver(series: ComposedErrorBar, x_scale: Scale, y_scale: Scale): (i: number) => ErrorBarPixels | undefined {
    const vertical = is_vertical_error_bar(series)
    const interval_scale = vertical ? y_scale : x_scale
    const resolve_cross = vertical ? pixel_resolver(x_scale, series.x) : pixel_resolver(y_scale, series.y)
    const resolve_center = pixel_resolver(interval_scale, vertical ? series.y : series.x)
    const resolve_low = pixel_resolver(interval_scale, series.low)
    const resolve_high = pixel_resolver(interval_scale, series.high)

    return (i) => {
        const cross = resolve_cross(i)
        const center = resolve_center(i)

        if (!is_placeable(cross) || !is_placeable(center)) {
            return undefined
        }
        // a bound the scale can't place (a non-positive value on a log axis) collapses that end onto the
        // center, so the bar still marks its measurement instead of vanishing
        const low = resolve_low(i)
        const high = resolve_high(i)
        return {
            cross,
            center,
            low: is_placeable(low) ? low : center,
            high: is_placeable(high) ? high : center,
        }
    }
}

/**
 * Draw an error bar series: the interval as a line through each center mark, a crossbar at each end unless
 * the caller turned it off, and the center marks optionally joined in data order. Per-row color applies to
 * the whole bar; the connecting line takes the series color, since it belongs to no single row.
 * @param series - the error bar series
 * @param render - the shared render context (canvas, inner rect, scales, fallback color)
 */
export function draw_error_bar(series: ComposedErrorBar, render: RenderContext): void {
    const { ctx, x_scale, y_scale, color } = render
    const length = series.x.length

    if (length === 0) {
        return
    }
    const resolve = error_bar_resolver(series, x_scale, y_scale)
    const vertical = is_vertical_error_bar(series)
    const width = series.width ?? DEFAULT_WIDTH
    const cap = series.cap ?? DEFAULT_CAP_LENGTH
    const radius = error_bar_mark_radius(series)
    const mark = series.mark ?? 'circle'
    const colors = series.colors

    ctx.setLineDash([])

    if (series.connect === true) {
        connect_centers(ctx, series, resolve, vertical, color, width)
    }

    for (let i = 0; i < length; i++) {
        const pixels = resolve(i)

        if (pixels === undefined) {
            continue
        }
        const row_color = colors?.[i] ?? color
        ctx.strokeStyle = row_color
        ctx.fillStyle = row_color
        // draw_mark leaves the previous row's mark border width behind
        ctx.lineWidth = width
        // snap the whole bar to one device pixel column so the thin interval line paints solid, and the
        // mark stays centered on it
        const cross = crisp_rule_pos(pixels.cross, width)
        stroke_segment(ctx, vertical, cross, pixels.low, pixels.high)
        draw_caps(ctx, vertical, cross, pixels, cap, width)
        draw_mark(ctx, mark, vertical ? cross : pixels.center, vertical ? pixels.center : cross, radius, series.stroke)
    }
}

/**
 * Join the center marks in data order, the way a line series joins its points. A row that can't be placed
 * breaks the line, restarting at the next one.
 * @param ctx - canvas context
 * @param series - the composed error bar series
 * @param resolve - the per-row pixel resolver
 * @param vertical - whether the interval runs vertically
 * @param color - the series color
 * @param width - the stroke width in pixels
 */
function connect_centers(
    ctx: CanvasContext,
    series: ComposedErrorBar,
    resolve: (i: number) => ErrorBarPixels | undefined,
    vertical: boolean,
    color: string,
    width: number,
): void {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    let pen_down = false

    for (let i = 0; i < series.x.length; i++) {
        const pixels = resolve(i)

        if (pixels === undefined) {
            pen_down = false
            continue
        }
        const px = vertical ? pixels.cross : pixels.center
        const py = vertical ? pixels.center : pixels.cross

        if (pen_down) {
            ctx.lineTo(px, py)
        } else {
            ctx.moveTo(px, py)
            pen_down = true
        }
    }
    ctx.stroke()
}

/**
 * Draw the crossbar at each end of the interval, perpendicular to it — the T shape that marks where the
 * interval stops. A zero-length cap draws nothing, leaving a plain end.
 * @param ctx - canvas context
 * @param vertical - whether the interval runs vertically
 * @param cross - the bar's snapped position across the interval
 * @param pixels - the bar's pixel geometry
 * @param cap - the crossbar length in pixels
 * @param width - the stroke width in pixels
 */
function draw_caps(ctx: CanvasContext, vertical: boolean, cross: number, pixels: ErrorBarPixels, cap: number, width: number): void {
    if (cap <= 0) {
        return
    }
    const half = cap / 2

    for (const end of [pixels.low, pixels.high]) {
        // the crossbar runs across the interval, so it snaps along the interval instead
        stroke_segment(ctx, !vertical, crisp_rule_pos(end, width), cross - half, cross + half)
    }
}

/**
 * Stroke one straight segment in the bar's own axes, mapped to canvas x/y by orientation.
 * @param ctx - canvas context
 * @param vertical - whether the segment runs down the canvas
 * @param cross - the segment's fixed position on the other axis
 * @param from - where the segment starts
 * @param to - where the segment ends
 */
function stroke_segment(ctx: CanvasContext, vertical: boolean, cross: number, from: number, to: number): void {
    ctx.beginPath()

    if (vertical) {
        ctx.moveTo(cross, from)
        ctx.lineTo(cross, to)
    } else {
        ctx.moveTo(from, cross)
        ctx.lineTo(to, cross)
    }
    ctx.stroke()
}

/**
 * Whether a resolved pixel can be drawn at: a band scale returns undefined for an unknown category, and a
 * continuous one returns a non-finite pixel for a value outside what it can map.
 * @param pixel - the resolved pixel, or undefined
 * @returns true when the pixel is a finite coordinate
 */
function is_placeable(pixel: number | undefined): pixel is number {
    return pixel !== undefined && Number.isFinite(pixel)
}
