import type { ComposedBar, Rect, Scale } from "../../types"
import { resolve_bar_rect, type BarRect } from "./paint"
import { series_value_span, bar_axes, type BarAxes } from "./layout"

type HitSpan = { start: number; extent: number }

type HoverSpans = { band: boolean; value: boolean; value_bounds: HitSpan }

/**
 * The bar whose hit region contains the cursor, or null.
 * A value-axis hover span then makes the rest of the band answer too
 * @param series - the composed bar series
 * @param cursor - cursor position in canvas pixels
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @param inner - the plot area, which a value-axis hover span fills
 * @returns the point index under the cursor, or null
 */
export function bar_hit_test(series: ComposedBar, cursor: { x: number; y: number }, x_scale: Scale, y_scale: Scale, inner: Rect): number | null {
    const axes = bar_axes(series, x_scale, y_scale)
    const value_span = series_value_span(series, axes)
    const hover = hover_spans(series, axes, inner)
    let band_hit: number | null = null

    for (let i = 0; i < series.x.length; i++) {
        const drawn = resolve_bar_rect(series, i, axes, value_span)

        if (drawn === null) {
            continue
        }
        const band = band_hit_span(i, axes, drawn, hover.band)

        // a mark that paints nothing is never hit where it's drawn, but its band can still answer below
        if (is_drawn(drawn) && contains(cursor, band, drawn_value_span(axes, drawn), axes.is_vertical)) {
            return i
        }

        if (hover.value && band_hit === null && contains(cursor, band, hover.value_bounds, axes.is_vertical)) {
            band_hit = i
        }
    }

    return band_hit
}

/**
 * Map the caller's x / y hover spans onto the series' band and value axes, and measure the value axis' full
 * extent. A vertical bar bands on x and takes its value on y; a horizontal one is the other way around.
 * @param series - the composed bar series
 * @param axes - the series' resolved band / value axes
 * @param inner - the plot area
 * @returns which axes fill their span, and the value axis' extent
 */
function hover_spans(series: ComposedBar, axes: BarAxes, inner: Rect): HoverSpans {
    const span_x = series.hover_span_x === true
    const span_y = series.hover_span_y === true

    if (axes.is_vertical) {
        return { band: span_x, value: span_y, value_bounds: { start: inner.top, extent: inner.bottom - inner.top } }
    }
    return { band: span_y, value: span_x, value_bounds: { start: inner.left, extent: inner.right - inner.left } }
}

/**
 * The hit region's band axis span: the whole band when it fills its hover span, so the inset gaps between
 * bars hover the bar they belong to, else the bar's own thickness.
 * @param i - the mark index
 * @param axes - the series' resolved band / value axes
 * @param drawn - the mark's drawn rect
 * @param widen - whether the band axis fills its hover span
 * @returns the span on the band axis
 */
function band_hit_span(i: number, axes: BarAxes, drawn: BarRect, widen: boolean): HitSpan {
    const thickness = drawn_band_span(axes, drawn)

    if (!widen) {
        return thickness
    }
    const band_start = axes.band_scale(axes.bands[i])

    if (band_start === undefined) {
        return thickness
    }
    return { start: band_start, extent: axes.band_scale.bandwidth() }
}

// The mark's drawn extent across the band axis.
function drawn_band_span(axes: BarAxes, drawn: BarRect): HitSpan {
    if (axes.is_vertical) {
        return { start: drawn.left, extent: drawn.width }
    }
    return { start: drawn.top, extent: drawn.height }
}

// The mark's drawn extent along the value axis, which is zero for a zero-valued mark.
function drawn_value_span(axes: BarAxes, drawn: BarRect): HitSpan {
    if (axes.is_vertical) {
        return { start: drawn.top, extent: drawn.height }
    }
    return { start: drawn.left, extent: drawn.width }
}

// Whether a mark paints anything at all. A zero value, or an inset that eats the whole band, draws nothing.
function is_drawn(drawn: BarRect): boolean {
    return drawn.width > 0 && drawn.height > 0
}

/**
 * Whether the cursor is inside a hit region, given as its two axis spans.
 * @param cursor - cursor position in canvas pixels
 * @param band - the region's span across the band axis
 * @param value - the region's span along the value axis
 * @param is_vertical - whether the series bands on x
 * @returns true when the cursor is within both spans
 */
function contains(cursor: { x: number; y: number }, band: HitSpan, value: HitSpan, is_vertical: boolean): boolean {
    const across = is_vertical ? cursor.x : cursor.y
    const along = is_vertical ? cursor.y : cursor.x

    return within(across, band) && within(along, value)
}

// Whether a pixel position falls inside one axis' span, both ends inclusive.
function within(position: number, span: HitSpan): boolean {
    return position >= span.start && position <= span.start + span.extent
}
