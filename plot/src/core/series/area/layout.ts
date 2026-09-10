import type { AreaPixelRuns, ComposedArea, ComposedSeries, Scale } from "../../types"
import { pixel_resolver } from "../../render/pixel_resolver"

// The band's pixel geometry, built once per compose and read by both the paint and the hit test. Kept off
// the render path because the hit test runs per pointer frame, where rebuilding it is the dominant cost.

/**
 * Whether the band rides the y axis: an x2 pairs the boundaries on x, leaving y as the free axis.
 * @param series - the composed area series
 * @returns true for a vertical band
 */
export function is_vertical_area(series: ComposedArea): boolean {
    return series.x2 !== undefined
}

/**
 * Precompute the band's pixel geometry for the current scales. Runs once per compose (the `compose_layout`
 * hook), so the per-frame hit test and each redraw only index into it.
 * @param series - the composed area series
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @returns the series carrying its pixel runs
 */
export function compose_area_layout<TooltipContent>(series: ComposedArea<TooltipContent>, x_scale: Scale, y_scale: Scale): ComposedSeries<TooltipContent> {
    return { ...series, pixel_runs: area_pixel_runs(series, x_scale, y_scale) }
}

/**
 * The band's pixel runs: the ones compose built, or a fresh pass for a series that reached the renderer
 * without going through compose.
 * @param series - the composed area series
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @returns the pixel runs
 */
export function series_pixel_runs(series: ComposedArea, x_scale: Scale, y_scale: Scale): AreaPixelRuns {
    return series.pixel_runs ?? area_pixel_runs(series, x_scale, y_scale)
}

/**
 * How many runs the geometry holds. `run_starts` carries a trailing sentinel so run i spans
 * [run_starts[i], run_starts[i + 1]).
 * @param runs - the band's pixel runs
 * @returns the run count
 */
export function run_count(runs: AreaPixelRuns): number {
    return Math.max(runs.run_starts.length - 1, 0)
}

/**
 * Resolve every row to pixels, splitting into runs of consecutive placeable points. Columns are parallel and
 * hold only the survivors, so a run indexes them directly; `row` maps back to the source row for the tooltip.
 * @param series - the composed area series
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @returns the band's pixel runs
 */
function area_pixel_runs(series: ComposedArea, x_scale: Scale, y_scale: Scale): AreaPixelRuns {
    const vertical = is_vertical_area(series)
    const along_scale = vertical ? y_scale : x_scale
    const paired_scale = vertical ? x_scale : y_scale
    const resolve_along = pixel_resolver(along_scale, vertical ? series.y : series.x)
    const resolve_edge = pixel_resolver(paired_scale, vertical ? series.x : series.y)
    const resolve_base = base_resolver(series, paired_scale)
    const length = series.x.length
    const along = new Float64Array(length)
    const edge = new Float64Array(length)
    const base = new Float64Array(length)
    const row = new Int32Array(length)
    const run_starts: number[] = []
    let count = 0
    let in_run = false

    for (let i = 0; i < length; i++) {
        const point_along = resolve_along(i)
        const point_edge = resolve_edge(i)
        const point_base = resolve_base(i)

        if (!is_placeable(point_along) || !is_placeable(point_edge) || !is_placeable(point_base)) {
            in_run = false
            continue
        }

        if (!in_run) {
            run_starts.push(count)
            in_run = true
        }
        along[count] = point_along
        edge[count] = point_edge
        base[count] = point_base
        row[count] = i
        count++
    }
    // sentinel: closes the last run, and is the only entry when nothing was placeable
    run_starts.push(count)
    // trim only when rows were dropped, otherwise pass the full buffer through
    const full = count === length
    return {
        along: full ? along : along.slice(0, count),
        edge: full ? edge : edge.slice(0, count),
        base: full ? base : base.slice(0, count),
        row: full ? row : row.slice(0, count),
        run_starts: Int32Array.from(run_starts),
    }
}

/**
 * Whether a resolved pixel can be drawn. A band scale gives undefined for an unknown category, and a log
 * scale maps a non-positive value to a non-finite pixel — canvas discards a path holding one, so the whole
 * run would vanish rather than the band breaking at that point.
 * @param pixel - the resolved pixel, or undefined
 * @returns true when the point can be placed
 */
function is_placeable(pixel: number | undefined): pixel is number {
    return pixel !== undefined && Number.isFinite(pixel)
}

/**
 * The resolver for the band's second boundary: the paired data column, or the zero baseline when the band
 * has none.
 * @param series - the composed area series
 * @param paired_scale - the scale of the axis the boundaries live on
 * @returns a resolver giving the boundary pixel, or undefined to break the band
 */
function base_resolver(series: ComposedArea, paired_scale: Scale): (i: number) => number | undefined {
    if (series.x2 !== undefined) {
        return pixel_resolver(paired_scale, series.x2)
    }

    if (series.y2 !== undefined) {
        return pixel_resolver(paired_scale, series.y2)
    }
    return baseline_resolver(paired_scale)
}

/**
 * The zero-baseline resolver for a band with no second boundary. A band scale has no zero and a log scale
 * can't place it, so neither resolves and the series draws nothing (the factory rejects both up front).
 * @param paired_scale - the scale of the axis the boundaries live on
 * @returns a resolver giving the baseline pixel, or undefined when the scale has no zero
 */
function baseline_resolver(paired_scale: Scale): () => number | undefined {
    if ('bandwidth' in paired_scale) {
        return () => undefined
    }
    const baseline = paired_scale(0)

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- TODO: fix when next touching this code
    if (baseline === undefined || !Number.isFinite(baseline)) {
        return () => undefined
    }
    return () => baseline
}
