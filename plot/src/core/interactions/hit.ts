import { series_type } from "../registry"
import type { ComposedPlot, PointData } from "../types"

// A hit on a specific point of a composed series.
export type NearestPoint = {
    series_index: number
    point_index: number
}

export type PointerOffset = { offsetX: number; offsetY: number }

/** Whether two hit lists name the same points in the same order. */
export function same_hits(a: NearestPoint[], b: NearestPoint[]): boolean {
    if (a.length !== b.length) {
        return false
    }

    for (let i = 0; i < a.length; i++) {
        if (a[i].series_index !== b[i].series_index || a[i].point_index !== b[i].point_index) {
            return false
        }
    }
    return true
}

/** Convert overlay-relative pointer offsets into canvas coordinates. */
export function cursor_position<TooltipContent>(plot: ComposedPlot<TooltipContent>, event: PointerOffset): { x: number; y: number } {
    return {
        x: plot.layout.margin_left + event.offsetX,
        y: plot.layout.margin_top + event.offsetY,
    }
}

/** Find one hit per series under the cursor, ordered from topmost-drawn series to bottommost. */
export function find_hits<TooltipContent>(plot: ComposedPlot<TooltipContent>, cursor: { x: number; y: number }): NearestPoint[] {
    const hits: NearestPoint[] = []

    for (let series_index = plot.series.length - 1; series_index >= 0; series_index--) {
        const series = plot.series[series_index]

        if (series.hoverable === false) {
            continue
        }
        const point_index = series_type<TooltipContent>(series.kind).tooltip_hit_test(series, cursor, plot.x_scale, plot.y_scale, plot.inner)

        if (point_index !== null) {
            hits.push({ series_index, point_index })
        }
    }
    return hits
}

/** Return the topmost hovered point whose series has an on_select callback. */
export function selectable_hit<TooltipContent>(plot: ComposedPlot<TooltipContent>, hits: NearestPoint[]): NearestPoint | null {
    for (const hit of hits) {
        if (plot.series[hit.series_index]?.on_select !== undefined) {
            return hit
        }
    }
    return null
}

/** Resolve the host callback payload for a hit point. */
export function resolve_point_data<TooltipContent>(plot: ComposedPlot<TooltipContent>, point: NearestPoint): PointData | undefined {
    const series = plot.series[point.series_index]

    // A plot can change while a host is still rendering hover state from its previous composition.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime bounds guard for stale host state
    if (series === undefined || point.point_index >= series.x.length) {
        return undefined
    }
    const point_index = point.point_index
    const data: PointData = {
        x: point_value(series.x, plot.x_categories, point_index),
        y: point_value(series.y, plot.y_categories, point_index),
    }
    const row = series.rows?.[point_index]

    if (row !== undefined) {
        data.row = row
    }
    const label = series.labels?.[point_index]

    if (label !== undefined) {
        data.label = label
    }
    return data
}

function point_value(values: Float64Array, categories: string[] | undefined, index: number): number | string {
    const raw = values[index]
    return categories === undefined ? raw : (categories[raw] ?? raw)
}
