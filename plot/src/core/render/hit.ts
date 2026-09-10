import type { Scale } from "../types"
import { pixel_resolver } from "./pixel_resolver"

// floor on the hover radius, so a small mark keeps a forgiving hitbox even when drawn smaller than this
const MIN_HIT_RADIUS = 8

/**
 * The point under the cursor, or null: the nearest point whose distance is within its hit radius. Shared
 * by the scatter and line hover tests. radius_for(i) gives point i's drawn radius; each is floored to
 * MIN_HIT_RADIUS so small marks stay hittable, and where hit regions overlap the nearest point wins.
 * @param series - the x / y pixel-space columns
 * @param cursor - cursor position in canvas pixels
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @param radius_for - point i's drawn radius in pixels
 * @returns the point index under the cursor, or null
 */
export function nearest_point_hit(series: { x: Float64Array; y: Float64Array }, cursor: { x: number; y: number }, x_scale: Scale, y_scale: Scale, radius_for: (i: number) => number): number | null {
    const resolve_x = pixel_resolver(x_scale, series.x)
    const resolve_y = pixel_resolver(y_scale, series.y)

    let hit: number | null = null
    let best_distance_squared = Infinity

    for (let i = 0; i < series.x.length; i++) {
        const center_x = resolve_x(i)

        if (center_x === undefined) {
            continue
        }
        const center_y = resolve_y(i)

        if (center_y === undefined) {
            continue
        }
        const dx = center_x - cursor.x
        const dy = center_y - cursor.y
        const distance_squared = dx * dx + dy * dy
        const hit_radius = Math.max(radius_for(i), MIN_HIT_RADIUS)
        const within_hit = distance_squared <= hit_radius * hit_radius
        const is_nearest = distance_squared < best_distance_squared

        if (within_hit && is_nearest) {
            best_distance_squared = distance_squared
            hit = i
        }
    }

    return hit
}
