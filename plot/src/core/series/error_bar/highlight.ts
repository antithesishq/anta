import type { ComposedErrorBar, HighlightSpec, Scale } from "../../types"
import { DEFAULT_SERIES_COLOR } from "../../template/color"
import { error_bar_mark_radius, error_bar_resolver, is_vertical_error_bar } from "./paint"

/**
 * The hover-select halo for an error bar: a ring on its center mark, in the bar's color. Mirrors the paint
 * geometry so the ring lands exactly on the drawn mark.
 * @param series - the composed error bar series
 * @param point_index - the hovered bar's row index
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @returns the halo spec, or null when the bar has no pixel position (unknown band category)
 */
export function error_bar_highlight_spec(series: ComposedErrorBar, point_index: number, x_scale: Scale, y_scale: Scale): HighlightSpec | null {
    const pixels = error_bar_resolver(series, x_scale, y_scale)(point_index)

    if (pixels === undefined) {
        return null
    }
    const vertical = is_vertical_error_bar(series)
    const color = series.colors?.[point_index] ?? series.color ?? DEFAULT_SERIES_COLOR

    return {
        shape: 'mark',
        mark: series.mark ?? 'circle',
        cx: vertical ? pixels.cross : pixels.center,
        cy: vertical ? pixels.center : pixels.cross,
        r: error_bar_mark_radius(series),
        color,
    }
}
