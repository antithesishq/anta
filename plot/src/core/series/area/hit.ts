import type { AreaPixelRuns, ComposedArea, Scale } from "../../types"
import { is_vertical_area, run_count, series_pixel_runs } from "./layout"

/**
 * The area point under the cursor, or null. The band itself is the hit region: the cursor hits when it sits
 * between the two boundaries, and the nearer of the two points bracketing it wins (so the tooltip reads the
 * column you're closest to).
 * @param series - the composed area series
 * @param cursor - cursor position in canvas pixels
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @returns the point index under the cursor, or null
 */
export function area_hit_test(series: ComposedArea, cursor: { x: number; y: number }, x_scale: Scale, y_scale: Scale): number | null {
    const vertical = is_vertical_area(series)
    const along = vertical ? cursor.y : cursor.x
    const across = vertical ? cursor.x : cursor.y
    const runs = series_pixel_runs(series, x_scale, y_scale)
    const runs_tested = run_count(runs)

    for (let run = 0; run < runs_tested; run++) {
        const hit = run_hit(runs, runs.run_starts[run], runs.run_starts[run + 1], along, across)

        if (hit !== null) {
            return hit
        }
    }
    return null
}

/**
 * The point under the cursor within one run, or null.
 * @param runs - the band's pixel runs
 * @param start - the run's first point
 * @param end - one past the run's last point
 * @param along - the cursor's pixel on the free axis
 * @param across - the cursor's pixel on the paired axis
 * @returns the source row index, or null
 */
function run_hit(runs: AreaPixelRuns, start: number, end: number, along: number, across: number): number | null {
    for (let i = start; i + 1 < end; i++) {
        const hit = segment_hit(runs, i, along, across)

        if (hit !== null) {
            return hit
        }
    }
    return null
}

/**
 * The point under the cursor within one band segment, or null. Both boundaries are interpolated at the
 * cursor's position along the free axis, so a sloped band is hit only where it's actually drawn.
 * @param runs - the band's pixel runs
 * @param first - the segment's first point
 * @param along - the cursor's pixel on the free axis
 * @param across - the cursor's pixel on the paired axis
 * @returns the nearer end's source row index, or null when the cursor is outside the segment
 */
function segment_hit(runs: AreaPixelRuns, first: number, along: number, across: number): number | null {
    const second = first + 1
    const min_along = Math.min(runs.along[first], runs.along[second])
    const max_along = Math.max(runs.along[first], runs.along[second])
    const within_segment = along >= min_along && along <= max_along

    if (!within_segment) {
        return null
    }
    const fraction = interpolation_fraction(runs.along[first], runs.along[second], along)
    const edge = runs.edge[first] + (runs.edge[second] - runs.edge[first]) * fraction
    const base = runs.base[first] + (runs.base[second] - runs.base[first]) * fraction
    const within_band = across >= Math.min(edge, base) && across <= Math.max(edge, base)

    if (!within_band) {
        return null
    }
    return fraction < 0.5 ? runs.row[first] : runs.row[second]
}

/**
 * How far the cursor sits along a segment, 0 at the first point and 1 at the second. A zero-length segment
 * (repeated position) reads as 0.
 * @param first_along - the segment's first point on the free axis, in pixels
 * @param second_along - the segment's second point on the free axis, in pixels
 * @param cursor_along - the cursor's pixel on the free axis
 * @returns the fraction along the segment
 */
function interpolation_fraction(first_along: number, second_along: number, cursor_along: number): number {
    const span = second_along - first_along

    if (span === 0) {
        return 0
    }
    return (cursor_along - first_along) / span
}
