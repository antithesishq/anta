import type { ComposedLine, HighlightSpec, Scale } from "../../types"
import { DEFAULT_SERIES_COLOR } from "../../template/color"
import { pixel_resolver } from "../../render/pixel_resolver"
import { vertex_radius } from "./paint"

/**
 * The hover-select halo for a line vertex. A line drawing no vertex marks gets no halo.
 * @param series - the composed line series
 * @param point_index - the hovered vertex's row index
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @returns the halo spec, or null where the line draws no marks or the vertex has no pixel position
 */
export function line_highlight_spec(series: ComposedLine, point_index: number, x_scale: Scale, y_scale: Scale): HighlightSpec | null {
    const mark = series.mark

    if (mark === undefined) {
        return null
    }
    const cx = pixel_resolver(x_scale, series.x)(point_index)

    if (cx === undefined) {
        return null
    }
    const cy = pixel_resolver(y_scale, series.y)(point_index)

    if (cy === undefined) {
        return null
    }
    const color = series.color ?? DEFAULT_SERIES_COLOR
    return { shape: 'mark', mark, cx, cy, r: vertex_radius(series), color }
}
