import type { ComposedRect, HighlightSpec, Rect, Scale } from "../../types"
import { DEFAULT_SERIES_COLOR } from "../../template/color"
import { make_rect_resolver } from "./paint"

/**
 * The hover-select halo for a rect: its rectangle bounds in canvas pixels, in the rect's color. Reuses
 * make_rect_resolver so the bounds match the drawn rect exactly (band fill / data span / sized, plus align and offset).
 * @param series - the composed rect series
 * @param point_index - the hovered rect's row index
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @param inner - the plot area, which a spanned axis covers edge to edge
 * @returns the rect spec, or null if the rect has no pixel span (unknown category / non-finite)
 */
export function rect_highlight_spec(series: ComposedRect, point_index: number, x_scale: Scale, y_scale: Scale, inner: Rect): HighlightSpec | null {
    const rect = make_rect_resolver(series, x_scale, y_scale, inner)(point_index)

    if (rect === null) {
        return null
    }
    const color = series.colors?.[point_index] ?? series.color ?? DEFAULT_SERIES_COLOR
    return { shape: 'rect', x: rect.left, y: rect.top, width: rect.width, height: rect.height, color }
}
