import type { ComposedScatter, Scale } from "../../types"
import { nearest_point_hit } from "../../render/hit"
import { dot_radius } from "./paint"

/**
 * The scatter dot under the cursor, or null. Each dot is hittable within its drawn radius or a minimum
 * affordance, whichever is larger; where hit regions overlap, the nearest center wins.
 * @param series - the composed scatter series
 * @param cursor - cursor position in canvas pixels
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @returns the point index under the cursor, or null
 */
export function scatter_hit_test(series: ComposedScatter, cursor: { x: number; y: number }, x_scale: Scale, y_scale: Scale): number | null {
    return nearest_point_hit(series, cursor, x_scale, y_scale, i => dot_radius(series, i))
}
