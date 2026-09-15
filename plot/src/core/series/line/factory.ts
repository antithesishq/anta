import { attach_resolved_columns, resolve_xy_columns } from "../../template/column"
import { resolve_stroke } from "../../template/color"
import { validate_hoverable, validate_non_negative, validate_positive } from "../../template/validate"
import type { FieldArg, LineSeries, MarkShape, SelectFn, StrokeArg, ThemeColor, TooltipArg } from "../../types"

export type LineArgs<TooltipContent = unknown> = {
    data: Record<string, unknown>[]
    x?: FieldArg
    y?: FieldArg
    color?: ThemeColor
    width?: number
    dash?: number[]
    mark?: MarkShape
    mark_size?: number
    mark_stroke?: StrokeArg
    tooltip?: TooltipArg<Record<string, unknown>, TooltipContent>
    on_select?: SelectFn<Record<string, unknown>>
    hoverable?: boolean
    highlight?: boolean
}

/**
 * Resolve line arguments into aligned numeric/category columns and validated presentation options.
 * @param args - line series arguments
 * @returns the resolved line series
 */
export function new_line<TooltipContent = unknown>(args: LineArgs<TooltipContent>): LineSeries<TooltipContent> {
    const x_arg = args.x ?? 'x'
    const y_arg = args.y ?? 'y'
    const resolved = resolve_xy_columns(args.data, x_arg, y_arg, 'plot.line', args.x === undefined, args.y === undefined)
    const series: LineSeries<TooltipContent> = {
        kind: 'line',
        x: resolved.x,
        y: resolved.y,
    }

    if (args.color !== undefined) {
        series.color = args.color
    }

    if (args.width !== undefined) {
        series.width = validate_positive(args.width, 'plot.line: width')
    }

    if (args.dash !== undefined) {
        series.dash = args.dash.map((segment, i) => validate_non_negative(segment, `plot.line: dash[${i}]`))
    }

    if (args.mark !== undefined) {
        series.mark = args.mark
    }

    if (args.mark_size !== undefined) {
        series.mark_size = validate_non_negative(args.mark_size, 'plot.line: mark_size')
    }
    const stroke = resolve_stroke(args.mark_stroke, 'plot.line: mark_stroke')

    if (stroke !== undefined) {
        series.stroke = stroke
    }

    if (args.tooltip !== undefined) {
        series.tooltip = args.tooltip
    }

    if (args.on_select !== undefined) {
        series.on_select = args.on_select
    }
    const hoverable = validate_hoverable(args, 'plot.line')

    if (hoverable !== undefined) {
        series.hoverable = hoverable
    }

    if (args.highlight !== undefined) {
        series.highlight = args.highlight
    }

    series.rows = args.data // Keep the caller's original rows for tooltip and selection payloads.
    attach_resolved_columns(series, resolved, x_arg, y_arg)
    return series
}
