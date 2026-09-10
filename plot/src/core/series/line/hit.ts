import type { ComposedLine, Scale } from "../../types"
import { nearest_point_hit } from "../../render/hit"

/**
 * The line vertex under the cursor, or null. A vertex is hittable within its marker radius or a minimum
 * affordance, whichever is larger; where hit regions overlap, the nearest vertex wins.
 * @param series - the composed line series
 * @param cursor - cursor position in canvas pixels
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @returns the point index under the cursor, or null
 */
export function line_hit_test(series: ComposedLine, cursor: { x: number; y: number }, x_scale: Scale, y_scale: Scale): number | null {
    const marker_radius = series.mark === undefined ? 0 : (series.mark_size ?? 0) / 2
    return nearest_point_hit(series, cursor, x_scale, y_scale, () => marker_radius)
}
