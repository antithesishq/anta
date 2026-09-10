import type { CanvasContext, ComposedBar, PixelRect, RenderContext, BarPixelSpan } from "../../types"
import { inset_band } from "../../render/band"
import { series_value_span, bar_axes, type BarAxes } from "./layout"

// The bar edge away from the value baseline — the end whose corners `radius` rounds.
type BarTipSide = 'top' | 'bottom' | 'left' | 'right'
export type BarRect = PixelRect & { tip_side: BarTipSide }

type BarSegment = { rect: BarRect; color: string }

/**
 * Draw a bar series. Each bar's rectangle comes from resolve_bar_rect.
 * @param series - the bar series
 * @param render - the shared render context (canvas, inner rect, scales, fallback color)
 */
export function draw_bar(series: ComposedBar, render: RenderContext): void {
    const { ctx, x_scale, y_scale, color } = render

    if (series.x.length === 0) {
        return
    }
    ctx.fillStyle = color
    const axes = bar_axes(series, x_scale, y_scale)
    const value_span = series_value_span(series, axes)
    const is_stacked = series.is_tip !== undefined
    const has_radius = series.border_radius !== undefined && series.border_radius > 0

    if (is_stacked && has_radius) {
        draw_stacks(ctx, series, axes, value_span, color)
    } else {
        draw_marks(ctx, series, axes, value_span, color)
    }
}

/**
 * Draw each mark on its own, rounding its own tip. Stacks reach here only without a radius, where a segment
 * and a stack paint the same square rectangles.
 * @param ctx - canvas context
 * @param series - the composed bar series
 * @param axes - the series' resolved band / value axes
 * @param value_span - the series' value axis layout
 * @param fallback - the series color, used where a mark has none
 */
function draw_marks(ctx: CanvasContext, series: ComposedBar, axes: BarAxes, value_span: BarPixelSpan, fallback: string): void {
    const colors = series.colors

    for (let i = 0; i < series.x.length; i++) {
        const rect = resolve_bar_rect(series, i, axes, value_span)

        if (rect === null) {
            continue
        }

        if (colors !== undefined) {
            ctx.fillStyle = colors[i] ?? fallback
        }
        fill_bar(ctx, rect, segment_border_radius(series, i))
    }
}

/**
 * Draw rounded stacks one at a time: clip to the whole stack's rounded silhouette, then fill its segments
 * square. Rounding the tip segment alone would clamp the radius to that segment's height, so a stack with a
 * short tip drew a flatter corner than its neighbours and the segment below it stayed square.
 * @param ctx - canvas context
 * @param series - the composed bar series
 * @param axes - the series' resolved band / value axes
 * @param value_span - the series' value axis layout
 * @param fallback - the series color, used where a segment has none
 */
function draw_stacks(ctx: CanvasContext, series: ComposedBar, axes: BarAxes, value_span: BarPixelSpan, fallback: string): void {
    const border_radius = series.border_radius ?? 0

    for (const segments of group_stacks(series, axes, value_span, fallback).values()) {
        ctx.save()
        trace_rounded_bar(ctx, stack_silhouette(segments), border_radius)
        ctx.clip()

        for (const segment of segments) {
            const rect = segment.rect
            ctx.fillStyle = segment.color
            ctx.fillRect(rect.left, rect.top, rect.width, rect.height)
        }
        ctx.restore()
    }
}

/**
 * Group the drawn segments into stacks, keyed by band and tip side so a band's positive and negative stacks round independently
 * @param series - the composed bar series
 * @param axes - the series' resolved band / value axes
 * @param value_span - the series' value axis layout
 * @param fallback - the series color, used where a segment has none
 * @returns the segments of each stack, in mark order
 */
function group_stacks(series: ComposedBar, axes: BarAxes, value_span: BarPixelSpan, fallback: string): Map<string, BarSegment[]> {
    const groups = new Map<string, BarSegment[]>()

    for (let i = 0; i < series.x.length; i++) {
        const rect = resolve_bar_rect(series, i, axes, value_span)

        if (rect === null) {
            continue
        }

        if (rect.width === 0 || rect.height === 0) {
            continue
        }

        const key = `${axes.bands[i]}|${rect.tip_side}`
        const segment = { rect, color: series.colors?.[i] ?? fallback }
        const existing = groups.get(key)

        if (existing === undefined) {
            groups.set(key, [segment])
            continue
        }
        existing.push(segment)
    }
    return groups
}

/**
 * The rectangle a whole stack occupies: the union of its segments, carrying their shared tip side.
 * @param segments - one stack's drawn segments, at least one
 * @returns the stack's bounding rectangle
 */
function stack_silhouette(segments: BarSegment[]): BarRect {
    const first = segments[0].rect
    let left = first.left
    let top = first.top
    let right = first.left + first.width
    let bottom = first.top + first.height

    for (const segment of segments) {
        const rect = segment.rect
        left = Math.min(left, rect.left)
        top = Math.min(top, rect.top)
        right = Math.max(right, rect.left + rect.width)
        bottom = Math.max(bottom, rect.top + rect.height)
    }
    return { left, top, width: right - left, height: bottom - top, tip_side: first.tip_side }
}

/**
 * The radius to round one mark with. A plain bar always rounds its own tip; a stacked segment rounds only
 * when it sits at the visible end of its stack, so inner and zero-valued segments stay square.
 * @param series - the composed bar series
 * @param i - the mark index
 * @returns the border radius to draw, or undefined for square corners
 */
export function segment_border_radius(series: ComposedBar, i: number): number | undefined {
    const is_tip = series.is_tip

    if (is_tip === undefined) {
        return series.border_radius
    }

    if (is_tip[i] === 1) {
        return series.border_radius
    }
    return undefined
}

// Fill one bar: a plain rect, or a path with the two tip-side corners rounded when border_radius is set.
function fill_bar(ctx: CanvasContext, rect: BarRect, border_radius: number | undefined): void {
    if (border_radius === undefined || border_radius <= 0) {
        ctx.fillRect(rect.left, rect.top, rect.width, rect.height)
        return
    }
    trace_rounded_bar(ctx, rect, border_radius)
    ctx.fill()
}

// Trace a bar path clockwise, rounding only the tip-side corners (border_radius clamped to half the bar).
function trace_rounded_bar(ctx: CanvasContext, rect: BarRect, border_radius: number): void {
    const right = rect.left + rect.width
    const bottom = rect.top + rect.height
    const r = Math.min(border_radius, rect.width / 2, rect.height / 2)
    const corner = tip_corner_radii(rect.tip_side, r)

    ctx.beginPath()
    ctx.moveTo(rect.left + corner.tl, rect.top)
    ctx.lineTo(right - corner.tr, rect.top)
    ctx.arcTo(right, rect.top, right, rect.top + corner.tr, corner.tr)
    ctx.lineTo(right, bottom - corner.br)
    ctx.arcTo(right, bottom, right - corner.br, bottom, corner.br)
    ctx.lineTo(rect.left + corner.bl, bottom)
    ctx.arcTo(rect.left, bottom, rect.left, bottom - corner.bl, corner.bl)
    ctx.lineTo(rect.left, rect.top + corner.tl)
    ctx.arcTo(rect.left, rect.top, rect.left + corner.tl, rect.top, corner.tl)
    ctx.closePath()
}

// Per-corner radii {top-left, top-right, bottom-right, bottom-left}: r on the two tip-side corners, 0 elsewhere.
function tip_corner_radii(tip_side: BarTipSide, r: number): { tl: number; tr: number; br: number; bl: number } {
    if (tip_side === 'top') {
        return { tl: r, tr: r, br: 0, bl: 0 }
    }

    if (tip_side === 'bottom') {
        return { tl: 0, tr: 0, br: r, bl: r }
    }

    if (tip_side === 'left') {
        return { tl: r, tr: 0, br: 0, bl: r }
    }
    return { tl: 0, tr: r, br: r, bl: 0 } // right
}

// The CSS border-radius (top-left top-right bottom-right bottom-left) matching a rounded bar's tip corners,
// or undefined when the bar has no radius.
export function bar_corner_radius_css(border_radius: number | undefined, rect: BarRect): string | undefined {
    if (border_radius === undefined || border_radius <= 0) {
        return undefined
    }
    const r = Math.min(border_radius, rect.width / 2, rect.height / 2)
    const corner = tip_corner_radii(rect.tip_side, r)
    return `${corner.tl}px ${corner.tr}px ${corner.br}px ${corner.bl}px`
}

/**
 * The pixel rectangle of one bar, or null if its band position is unknown (normally unreachable). Shared by the bar paint,
 * hit-test, and hover highlight. Places the bar across its band; the value axis comes ready-made in value_span.
 * @param series - the composed bar series
 * @param i - the bar's row index
 * @param axes - the series' resolved band / value axes
 * @param value_span - the series' value axis layout, from series_value_span
 * @returns the bar's { left, top, width, height } in canvas pixels, or null
 */
export function resolve_bar_rect(series: ComposedBar, i: number, axes: BarAxes, value_span: BarPixelSpan): BarRect | null {
    const { is_vertical, band_scale, bands } = axes
    const band_pos = band_scale(bands[i])

    if (band_pos === undefined) {
        return null
    }
    const baseline = value_span.baseline[i]
    const tip = value_span.tip[i]
    const linear_start = Math.min(tip, baseline)
    const linear_extent = Math.abs(tip - baseline)
    // shrink the bar within its band by the per-series inset (undefined keeps the default gap), centered
    const { start: band_start, extent: thickness } = inset_band(band_pos, band_scale.bandwidth(), series.inset)
    const tip_side = bar_tip_side(is_vertical, tip, baseline)

    if (is_vertical) {
        return { left: band_start, top: linear_start, width: thickness, height: linear_extent, tip_side }
    }
    return { left: linear_start, top: band_start, width: linear_extent, height: thickness, tip_side }
}

function bar_tip_side(is_vertical: boolean, tip: number, baseline: number): BarTipSide {
    if (is_vertical) {
        return tip <= baseline ? 'top' : 'bottom'
    }
    return tip >= baseline ? 'right' : 'left'
}
