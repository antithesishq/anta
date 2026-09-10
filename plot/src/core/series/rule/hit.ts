import type { ComposedRule, Scale } from "../../types"
import { pixel_resolver } from "../../render/pixel_resolver"
import { DEFAULT_RULE_WIDTH, rule_values } from "./paint"

// a hairline is too thin to hover, so hit-testing gets a grab band either side of it
const MIN_GRAB_RADIUS = 4

/**
 * The rule under the cursor, or null. A rule is hittable anywhere along its span (it has no endpoints), within
 * a grab band either side of the stroke; the nearest rule wins where two overlap.
 * @param series - the composed rule series
 * @param cursor - cursor position in canvas pixels
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @returns the rule's index, or null
 */
export function rule_hit_test(series: ComposedRule, cursor: { x: number; y: number }, x_scale: Scale, y_scale: Scale): number | null {
    const values = rule_values(series)
    const is_vertical = series.side === 'x'
    const resolve = pixel_resolver(is_vertical ? x_scale : y_scale, values)
    const cursor_pos = is_vertical ? cursor.x : cursor.y
    const grab_radius = Math.max((series.width ?? DEFAULT_RULE_WIDTH) / 2, MIN_GRAB_RADIUS)

    let nearest: number | null = null
    let nearest_distance = Infinity

    for (let i = 0; i < values.length; i++) {
        const pos = resolve(i)

        if (pos === undefined || !Number.isFinite(pos)) {
            continue
        }
        const distance = Math.abs(pos - cursor_pos)
        const is_closer = distance <= grab_radius && distance < nearest_distance

        if (is_closer) {
            nearest = i
            nearest_distance = distance
        }
    }
    return nearest
}
