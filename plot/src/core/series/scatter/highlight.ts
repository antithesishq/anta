import type { ComposedScatter, HighlightSpec, Scale } from "../../types"
import { DEFAULT_SERIES_COLOR } from "../../template/color"
import { pixel_resolver } from "../../render/pixel_resolver"
import { dot_radius } from "./paint"

/**
 * The hover-select halo for a scatter dot: a circle at the dot center sized to its radius, in the dot's color.
 * Mirrors the paint/hit geometry so the ring lands exactly on the drawn mark.
 * @param series - the composed scatter series
 * @param point_index - the hovered dot's row index
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @returns the halo spec, or null if the dot has no pixel position (unknown band category)
 */
export function scatter_highlight_spec(series: ComposedScatter, point_index: number, x_scale: Scale, y_scale: Scale): HighlightSpec | null {
    const cx = pixel_resolver(x_scale, series.x)(point_index)

    if (cx === undefined) {
        return null
    }
    const cy = pixel_resolver(y_scale, series.y)(point_index)

    if (cy === undefined) {
        return null
    }
    const color = series.colors?.[point_index] ?? series.color ?? DEFAULT_SERIES_COLOR
    return { shape: 'mark', mark: series.mark ?? 'circle', cx, cy, r: dot_radius(series, point_index), color }
}
