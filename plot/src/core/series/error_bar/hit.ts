import type { ComposedErrorBar, Scale } from "../../types"
import { MIN_HIT_RADIUS } from "../../render/hit"
import { error_bar_mark_radius, error_bar_resolver, is_vertical_error_bar } from "./paint"

/**
 * The error bar under the cursor, or null. The whole glyph is hittable, not just its center mark: the cursor
 * is measured to the nearest point on the interval, so a long whisker answers along its length. Each bar is
 * hittable within its mark radius or a minimum affordance, whichever is larger, and where bars overlap the
 * nearest one wins.
 * @param series - the composed error bar series
 * @param cursor - cursor position in canvas pixels
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @returns the point index under the cursor, or null
 */
export function error_bar_hit_test(series: ComposedErrorBar, cursor: { x: number; y: number }, x_scale: Scale, y_scale: Scale): number | null {
    const resolve = error_bar_resolver(series, x_scale, y_scale)
    const vertical = is_vertical_error_bar(series)
    const along_cursor = vertical ? cursor.y : cursor.x
    const cross_cursor = vertical ? cursor.x : cursor.y
    const hit_radius = Math.max(error_bar_mark_radius(series), MIN_HIT_RADIUS)

    let hit: number | null = null
    let best_distance_squared = Infinity

    for (let i = 0; i < series.x.length; i++) {
        const pixels = resolve(i)

        if (pixels === undefined) {
            continue
        }
        const cross_distance = cross_cursor - pixels.cross
        // the interval spans the center, so measuring to it covers the center mark as well
        const along_distance = distance_to_span(along_cursor, pixels.low, pixels.high)
        const distance_squared = cross_distance * cross_distance + along_distance * along_distance
        const within_hit = distance_squared <= hit_radius * hit_radius

        if (within_hit && distance_squared < best_distance_squared) {
            best_distance_squared = distance_squared
            hit = i
        }
    }
    return hit
}

/**
 * How far a cursor sits outside an interval, zero when it falls inside. The ends arrive in axis order, which
 * a descending scale (every y axis) reverses in pixels, so they're compared rather than assumed.
 * @param position - the cursor's position along the interval's axis
 * @param low - one end of the interval in pixels
 * @param high - the other end in pixels
 * @returns the distance to the nearest point on the interval
 */
function distance_to_span(position: number, low: number, high: number): number {
    const start = Math.min(low, high)
    const end = Math.max(low, high)

    if (position < start) {
        return start - position
    }

    if (position > end) {
        return position - end
    }
    return 0
}
