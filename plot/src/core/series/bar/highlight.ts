import type { ComposedBar, HighlightSpec, Scale, BarPixelSpan } from "../../types"
import { DEFAULT_SERIES_COLOR } from "../../template/color"
import { resolve_bar_rect, bar_corner_radius_css, segment_border_radius, type BarRect } from "./paint"
import { series_value_span, bar_axes, type BarAxes } from "./layout"

/**
 * The hover-select halo for a bar: the bar's rectangle bounds in canvas pixels, in the bar's color. Reuses
 * bar_rect so the bounds match the drawn bar exactly (orientation, log / linear baseline, negative bars).
 * Hovering a stacked segment halos the whole stack, rebuilt segment by segment in each segment's own color, so
 * the halo is the same bar rather than one block over it. The tooltip still names the segment under the cursor.
 * @param series - the composed bar series
 * @param point_index - the hovered bar's row index
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @returns the rect spec (one per stacked segment), or null where the bar has no band position (unknown category) or paints nothing
 */
export function bar_highlight_spec(series: ComposedBar, point_index: number, x_scale: Scale, y_scale: Scale): HighlightSpec | HighlightSpec[] | null {
    const axes = bar_axes(series, x_scale, y_scale)
    const value_span = series_value_span(series, axes)
    const rect = resolve_bar_rect(series, point_index, axes, value_span)

    if (rect === null) {
        return null
    }

    if (series.stack_base === undefined) {
        if (rect.width === 0 || rect.height === 0) {
            return null
        }
        return mark_spec(series, point_index, rect)
    }
    return stack_specs(series, point_index, axes, value_span)
}

/**
 * One mark's halo: its drawn rectangle, its own color, and the rounding it actually painted.
 * @param series - the composed bar series
 * @param i - the mark index
 * @param rect - the mark's resolved rectangle
 * @returns the halo spec for that mark
 */
function mark_spec(series: ComposedBar, i: number, rect: BarRect): HighlightSpec {
    const color = series.colors?.[i] ?? series.color ?? DEFAULT_SERIES_COLOR
    const border_radius = bar_corner_radius_css(segment_border_radius(series, i), rect)
    return { shape: 'rect', x: rect.left, y: rect.top, width: rect.width, height: rect.height, color, border_radius }
}

/**
 * A halo per segment of the hovered mark's stack. Each segment carries its own color and its own tip rounding,
 * so the halo tiles into the same shape the stack painted.
 * @param series - the composed bar series
 * @param point_index - the hovered segment's index
 * @param axes - the series' resolved band / value axes
 * @param value_span - the series' value axis layout, shared with the paint
 * @returns one spec per drawn segment of the stack
 */
function stack_specs(series: ComposedBar, point_index: number, axes: BarAxes, value_span: BarPixelSpan): HighlightSpec[] {
    const band = axes.bands
    const hovered_band = band[point_index]
    const specs: HighlightSpec[] = []

    // one pass over the band column, so the stack needs no assumption about its segments being adjacent
    for (let i = 0; i < band.length; i++) {
        if (band[i] !== hovered_band) {
            continue
        }
        const rect = resolve_bar_rect(series, i, axes, value_span)

        if (rect === null) {
            continue
        }

        // a zero-valued segment paints nothing
        if (rect.width === 0 || rect.height === 0) {
            continue
        }
        specs.push(mark_spec(series, i, rect))
    }
    return specs
}
