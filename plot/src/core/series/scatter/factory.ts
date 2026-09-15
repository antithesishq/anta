import { attach_resolved_columns, resolve_xy_columns } from "../../template/column"
import { resolve_color, resolve_stroke } from "../../template/color"
import { validate_hoverable, validate_non_negative } from "../../template/validate"
import type { ColorArg, FieldArg, MarkShape, ScatterSeries, SelectFn, StrokeArg, TooltipArg } from "../../types"

export type ScatterSizeArg = number | ((row: Record<string, unknown>, index: number) => number)

export type ScatterArgs<TooltipContent = unknown> = {
    data: Record<string, unknown>[]
    x?: FieldArg
    y?: FieldArg
    color?: ColorArg
    size?: ScatterSizeArg
    mark?: MarkShape
    stroke?: StrokeArg
    tooltip?: TooltipArg<Record<string, unknown>, TooltipContent>
    on_select?: SelectFn<Record<string, unknown>>
    hoverable?: boolean
    highlight?: boolean
}

/**
 * Resolve scatter arguments into aligned numeric/category columns plus per-mark presentation data.
 * @param args - scatter series arguments
 * @returns the resolved scatter series
 */
export function new_scatter<TooltipContent = unknown>(args: ScatterArgs<TooltipContent>): ScatterSeries<TooltipContent> {
    const x_arg = args.x ?? 'x'
    const y_arg = args.y ?? 'y'
    const resolved = resolve_xy_columns(args.data, x_arg, y_arg, 'plot.scatter', args.x === undefined, args.y === undefined)
    const series: ScatterSeries<TooltipContent> = {
        kind: 'scatter',
        x: resolved.x,
        y: resolved.y,
        ...resolve_color(args.data, args.color),
        ...resolve_size(args.data, args.size),
    }

    if (args.tooltip !== undefined) {
        series.tooltip = args.tooltip
    }

    if (args.on_select !== undefined) {
        series.on_select = args.on_select
    }
    const hoverable = validate_hoverable(args, 'plot.scatter')

    if (hoverable !== undefined) {
        series.hoverable = hoverable
    }

    if (args.highlight !== undefined) {
        series.highlight = args.highlight
    }

    if (args.mark !== undefined) {
        series.mark = args.mark
    }
    const stroke = resolve_stroke(args.stroke, 'plot.scatter')

    if (stroke !== undefined) {
        series.stroke = stroke
    }

    series.rows = args.data // Keep the caller's original rows for tooltip and selection payloads.
    attach_resolved_columns(series, resolved, x_arg, y_arg)
    return series
}

/**
 * Per-dot size resolution.
 * @param data - the data rows
 * @param arg - uniform number, per-dot accessor, or undefined
 * @returns the size and/or per-row sizes to attach to the series
 */
function resolve_size(
    data: Record<string, unknown>[],
    arg: ScatterSizeArg | undefined,
): Pick<ScatterSeries, 'size' | 'sizes'> {
    const accessor = typeof arg === 'function' ? arg : undefined
    const uniform = typeof arg === 'number' ? arg : undefined

    if (uniform !== undefined) {
        validate_non_negative(uniform, 'plot.scatter: size arg')
    }
    const has_per_item = data.some(r => typeof r.size === 'number')
    const result: Pick<ScatterSeries, 'size' | 'sizes'> = {}

    if (has_per_item || accessor !== undefined) {
        const sizes = new Array<number | null>(data.length)

        for (let i = 0; i < data.length; i++) {
            const row = data[i]
            let resolved: number | null = null

            if (typeof row.size === 'number') {
                resolved = validate_non_negative(row.size, `plot.scatter: row ${i} field 'size'`)
            } else if (accessor !== undefined) {
                resolved = validate_non_negative(accessor(row, i), `plot.scatter: size accessor at row ${i}`)
            } else if (uniform !== undefined) {
                resolved = uniform
            }
            sizes[i] = resolved
        }
        result.sizes = sizes
    }

    if (uniform !== undefined) {
        result.size = uniform
    }
    return result
}
