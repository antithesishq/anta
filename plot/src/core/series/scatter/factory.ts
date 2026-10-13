import { attach_resolved_columns, resolve_xy_columns } from "../../template/column"
import { retain_factory_args } from "../factory_args"
import { resolve_color, resolve_stroke, resolve_highlight_colors } from "../../template/color"
import { validate_hoverable, validate_non_negative } from "../../template/validate"
import type { ColorArg, FieldArg, MarkShape, ScatterSeries, SelectFn, StrokeArg, TooltipArg, ViewportChange } from "../../types"

/** Numeric diameters or a pure accessor evaluated with the viewport at composition time. */
export type ScatterSizeArg<Row> = number | ((row: Row, index: number, viewport: ViewportChange) => number)

export type ScatterArgs<Row, TooltipContent = unknown> = {
    data: Row[]
    x?: FieldArg<Row>
    y?: FieldArg<Row>
    color?: ColorArg<Row>
    highlight_color?: ColorArg<Row>
    size?: ScatterSizeArg<Row>
    mark?: MarkShape
    stroke?: StrokeArg
    tooltip?: TooltipArg<Row, TooltipContent>
    on_select?: SelectFn<Row>
    hoverable?: boolean
    highlight?: boolean
}

/**
 * Resolve scatter arguments into aligned numeric/category columns plus per-mark presentation data.
 * @param args - scatter series arguments
 * @returns the resolved scatter series
 */
export function new_scatter<Row, TooltipContent = unknown>(args: ScatterArgs<Row, TooltipContent>): ScatterSeries<Row, TooltipContent> {
    const x_arg = args.x ?? 'x'
    const y_arg = args.y ?? 'y'
    const resolved = resolve_xy_columns(args.data, x_arg, y_arg, 'plot.scatter', args.x === undefined, args.y === undefined)
    const series: ScatterSeries<Row, TooltipContent> = {
        kind: 'scatter',
        rows: args.data,
        x: resolved.x,
        y: resolved.y,
        ...resolve_color(args.data, args.color),
        ...resolve_highlight_colors(args.data, args.highlight_color),
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

    attach_resolved_columns(series, resolved, x_arg, y_arg)
    retain_factory_args(series, args)
    return series
}

/**
 * Validate fixed sizes and retain accessors for composition, when the viewport is available.
 * @param data - the data rows
 * @param arg - uniform number, per-dot accessor, or undefined
 * @returns the size and/or per-row sizes to attach to the series
 */
function resolve_size<Row>(
    data: Row[],
    arg: ScatterSizeArg<Row> | undefined,
): Pick<ScatterSeries<Row>, 'size' | 'sizes' | 'size_accessor'> {
    if (arg !== undefined && typeof arg !== 'number' && typeof arg !== 'function') {
        throw new Error('plot.scatter: size must be a number or a size accessor')
    }
    const accessor = typeof arg === 'function' ? arg : undefined
    const uniform = typeof arg === 'number' ? arg : undefined

    if (uniform !== undefined) {
        validate_non_negative(uniform, 'plot.scatter: size arg')
    }
    const has_per_item = data.some(row => read_row_size(row) !== undefined)
    const result: Pick<ScatterSeries<Row>, 'size' | 'sizes' | 'size_accessor'> = {}

    if (accessor !== undefined) {
        result.size_accessor = accessor
    }

    if (has_per_item) {
        const sizes = new Array<number | null>(data.length)

        for (let i = 0; i < data.length; i++) {
            const size = read_row_size(data[i])
            let resolved: number | null = null

            if (size !== undefined) {
                resolved = validate_non_negative(size, `plot.scatter: row ${i} field 'size'`)
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

// Keep numeric overrides, including invalid numbers, for the existing size validator.
function read_row_size(row: unknown): number | undefined {
    if (row === null || (typeof row !== 'object' && typeof row !== 'function') || !('size' in row)) {
        return undefined
    }
    const size = row.size
    return typeof size === 'number' ? size : undefined
}
