import type { ComposedPlot, PointData, TooltipData } from "../types"
import { resolve_point_data, type NearestPoint } from "./hit"

export type ResolvedTooltip<TooltipContent = unknown> =
    | { kind: 'default'; lines: string[] }
    | { kind: 'custom'; content: TooltipContent }

/** Resolve opted-in tooltips in hit order, leaving host content opaque. */
export function resolve_tooltips<TooltipContent>(plot: ComposedPlot<TooltipContent>, hits: NearestPoint[]): ResolvedTooltip<TooltipContent>[] {
    const resolved: ResolvedTooltip<TooltipContent>[] = []

    for (const hit of hits) {
        const tooltip = plot.series[hit.series_index]?.tooltip

        if (tooltip === undefined) {
            continue
        }
        const data = resolve_point_data(plot, hit)

        if (data === undefined) {
            continue
        }
        if (tooltip === true) {
            const lines = default_tooltip_lines(plot, data)
            if (lines.length > 0) {
                resolved.push({ kind: 'default', lines })
            }
        } else {
            // Column-backed series retain the existing payload with row omitted.
            resolved.push({ kind: 'custom', content: tooltip(data as TooltipData<any>) })
        }
    }
    return resolved
}

function default_tooltip_lines<TooltipContent>(plot: ComposedPlot<TooltipContent>, data: PointData): string[] {
    // the band side is whichever axis resolved to categories; the other side carries the value
    const x_is_band = plot.x_categories !== undefined
    const x_label = side_label(plot.x_axis?.label, 'x', data.label, !x_is_band)
    const y_label = side_label(plot.y_axis?.label, 'y', data.label, x_is_band)
    const lines: string[] = []

    if (has_value(data.x)) {
        lines.push(`${x_label}: ${data.x}`)
    }

    if (has_value(data.y)) {
        lines.push(`${y_label}: ${data.y}`)
    }
    return lines
}

// Whether one side of a hit has a value to print
function has_value(value: number | string): boolean {
    return typeof value === 'string' || Number.isFinite(value)
}

// One side's tooltip label: a per-mark label wins on the value side, then the axis label, then the axis letter.
function side_label(axis_label: string | undefined, fallback: string, mark_label: string | undefined, is_value_side: boolean): string {
    if (is_value_side && mark_label !== undefined) {
        return mark_label
    }
    return axis_label ?? fallback
}
