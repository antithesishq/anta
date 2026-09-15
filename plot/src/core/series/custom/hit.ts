import type { ComposedCustom, ComposedSeries, HitContext, Rect, Scale } from "../../types"
import { custom_resolvers } from "./paint"

/**
 * Hit-test a custom series by handing the cursor and the plot geometry to the caller's `hit_test`.
 * Returns null when the series declared none, when the caller reports no hit, or when it reports an index
 * outside the series — an out-of-range index would otherwise resolve to an undefined row. A hit test that
 * throws is warned about and treated as a miss, so a broken one costs the tooltip rather than the plot.
 * @param series - the composed custom series
 * @param cursor - cursor position in canvas pixels
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @param inner - the plot area
 * @returns the point index under the cursor, or null
 */
export function custom_hit_test<TooltipContent>(
    series: ComposedSeries<TooltipContent>,
    cursor: { x: number; y: number },
    x_scale: Scale,
    y_scale: Scale,
    inner: Rect,
): number | null {
    const custom = series as ComposedCustom<TooltipContent>
    const hit_test = custom.hit_test

    if (hit_test === undefined) {
        return null
    }
    const hit: HitContext = {
        cursor,
        inner,
        x_scale,
        y_scale,
        ...custom_resolvers(custom, x_scale, y_scale),
    }

    try {
        return bounded_index(hit_test(custom, hit), custom)
    } catch (error) {
        console.warn('plot.custom: hit_test threw, treating as no hit.', error)
        return null
    }
}

/**
 * Keep a caller's index inside the series, so a stray one reads as a miss rather than an undefined row.
 * @param index - the index the caller's hit test returned
 * @param series - the composed custom series
 * @returns the index, or null if it names no point
 */
function bounded_index<TooltipContent>(index: number | null, series: ComposedCustom<TooltipContent>): number | null {
    if (index === null) {
        return null
    }

    if (!Number.isInteger(index) || index < 0 || index >= series.x.length) {
        return null
    }
    return index
}
