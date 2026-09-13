import { attach_resolved_columns, resolve_column, resolve_xy_columns, validate_field_present } from "../../template/column"
import { resolve_color, resolve_stroke } from "../../template/color"
import { array_extent, merged_extent } from "../../template/extent"
import { validate_finite, validate_hoverable, validate_non_negative, validate_positive } from "../../template/validate"
import type { AxisContext, ColorArg, ErrorBarSeries, FieldArg, MarkShape, SelectFn, StrokeArg, TooltipArg } from "../../types"

export type ErrorBarBoundArg = FieldArg | number

// `true` keeps the default crossbar, `false` draws plain ends, a number sets the crossbar length in pixels
export type ErrorBarCapArg = boolean | number

export type ErrorBarArgs<TooltipContent = unknown> = {
    data: Record<string, unknown>[]
    x?: FieldArg
    y?: FieldArg
    x_low?: ErrorBarBoundArg
    x_high?: ErrorBarBoundArg
    x_error?: ErrorBarBoundArg
    y_low?: ErrorBarBoundArg
    y_high?: ErrorBarBoundArg
    y_error?: ErrorBarBoundArg
    color?: ColorArg
    mark?: MarkShape
    size?: number
    stroke?: StrokeArg
    width?: number
    cap?: ErrorBarCapArg
    connect?: boolean
    tooltip?: TooltipArg<Record<string, unknown>, TooltipContent>
    on_select?: SelectFn<Record<string, unknown>>
    hoverable?: boolean
    highlight?: boolean
}

// the interval as the caller declared it: the axis it spans, and either a symmetric spread or explicit bounds
type IntervalDeclaration =
    | { side: 'x' | 'y'; mode: 'error'; error: ErrorBarBoundArg }
    | { side: 'x' | 'y'; mode: 'bounds'; low: ErrorBarBoundArg; high: ErrorBarBoundArg }

/**
 * Error bar series factory. Resolves the center on both axes, then the interval on whichever axis carries
 * it, into absolute low / high columns. `{side}_error` gives a symmetric spread around the center (an SD or
 * an SEM); `{side}_low` and `{side}_high` give the interval's own values (a confidence interval).
 * @param args - error bar series args (data, x, y, the interval fields, and presentation options)
 * @returns the resolved ErrorBarSeries
 */
export function new_error_bar<TooltipContent = unknown>(args: ErrorBarArgs<TooltipContent>): ErrorBarSeries<TooltipContent> {
    const x_arg = args.x ?? 'x'
    const y_arg = args.y ?? 'y'
    const resolved = resolve_xy_columns(args.data, x_arg, y_arg, 'plot.error_bar', args.x === undefined, args.y === undefined)
    const declaration = interval_declaration(args)
    const center = declaration.side === 'x' ? resolved.x : resolved.y
    const interval = resolve_interval(args.data, declaration, center)
    const series: ErrorBarSeries<TooltipContent> = {
        kind: 'error_bar',
        side: declaration.side,
        x: resolved.x,
        y: resolved.y,
        low: interval.low,
        high: interval.high,
        ...resolve_color(args.data, args.color),
    }

    apply_error_bar_options(series, args)
    series.rows = args.data // Keep the caller's original rows for tooltip and selection payloads.
    attach_resolved_columns(series, resolved, x_arg, y_arg)
    return series
}

/**
 * Which axis the interval spans and how the caller described it. An explicit arg wins; with none, the rows
 * are searched for the same field names, y before x, so the common vertical error bar needs no arg at all.
 * @param args - the error bar series args
 * @returns the interval declaration
 */
function interval_declaration(args: ErrorBarArgs): IntervalDeclaration {
    const x_declared = declared_interval(args, 'x')
    const y_declared = declared_interval(args, 'y')

    if (x_declared !== undefined && y_declared !== undefined) {
        throw new Error('plot.error_bar: the interval is declared on both x and y. An error bar spans one axis; pass the x_ fields for a horizontal bar or the y_ fields for a vertical one.')
    }
    const declared = x_declared ?? y_declared

    if (declared !== undefined) {
        return declared
    }
    const adopted = adopted_interval(args.data, 'y') ?? adopted_interval(args.data, 'x')

    if (adopted !== undefined) {
        return adopted
    }

    // No rows expose no fields to adopt. A series filtered down to nothing draws nothing either way, and
    // shouldn't take the plot down for an interval it has no rows to carry.
    if (args.data.length === 0) {
        return { side: 'y', mode: 'error', error: 0 }
    }
    throw new Error("plot.error_bar: no interval was declared. Pass y_error for a symmetric spread around y (an SD or an SEM), or y_low and y_high for the interval's own values; use the x_ fields for a horizontal bar.")
}

/**
 * One side's explicitly declared interval. The two shapes are exclusive: a spread is measured from the
 * center, where bounds are read off the axis, so a row carrying both has no one meaning.
 * @param args - the error bar series args
 * @param side - the axis to read the args for
 * @returns that side's declaration, or undefined when the caller declared none
 */
function declared_interval(args: ErrorBarArgs, side: 'x' | 'y'): IntervalDeclaration | undefined {
    const error = side === 'x' ? args.x_error : args.y_error
    const low = side === 'x' ? args.x_low : args.y_low
    const high = side === 'x' ? args.x_high : args.y_high
    const has_bound = low !== undefined || high !== undefined

    if (error !== undefined) {
        if (has_bound) {
            throw new Error(`plot.error_bar: ${side}_error is set alongside ${side}_low / ${side}_high. ${side}_error is a spread measured from the center, where the bounds are values on the ${side} axis; pass one or the other.`)
        }
        return { side, mode: 'error', error }
    }

    if (!has_bound) {
        return undefined
    }

    if (low === undefined || high === undefined) {
        const missing = low === undefined ? `${side}_low` : `${side}_high`
        throw new Error(`plot.error_bar: ${missing} is missing. An interval needs both ends, so pass ${side}_low and ${side}_high together, or ${side}_error for a symmetric spread.`)
    }
    return { side, mode: 'bounds', low, high }
}

/**
 * One side's interval adopted off the rows, for a caller who named their fields after the args. Checked only
 * when no interval was declared.
 * @param data - the data rows
 * @param side - the axis to look for fields on
 * @returns that side's declaration, or undefined when the rows carry no such fields
 */
function adopted_interval(data: Record<string, unknown>[], side: 'x' | 'y'): IntervalDeclaration | undefined {
    if (data.some(row => `${side}_error` in row)) {
        return { side, mode: 'error', error: `${side}_error` }
    }

    if (data.some(row => `${side}_low` in row) && data.some(row => `${side}_high` in row)) {
        return { side, mode: 'bounds', low: `${side}_low`, high: `${side}_high` }
    }
    return undefined
}

/**
 * Resolve the declared interval into the absolute low / high columns the paint and the domain both read. A
 * spread is folded into the center here, so nothing downstream has to know which shape the caller passed.
 * @param data - the data rows
 * @param declaration - the resolved interval declaration
 * @param center - the center column on the interval's own axis
 * @returns the interval's low and high columns
 */
function resolve_interval(
    data: Record<string, unknown>[],
    declaration: IntervalDeclaration,
    center: Float64Array,
): { low: Float64Array; high: Float64Array } {
    if (declaration.mode === 'bounds') {
        return {
            low: resolve_bound(data, declaration.low, declaration.side, 'low'),
            high: resolve_bound(data, declaration.high, declaration.side, 'high'),
        }
    }
    const error = resolve_bound(data, declaration.error, declaration.side, 'error')
    const low = new Float64Array(center.length)
    const high = new Float64Array(center.length)

    for (let i = 0; i < center.length; i++) {
        low[i] = center[i] - error[i]
        high[i] = center[i] + error[i]
    }
    return { low, high }
}

/**
 * Resolve one interval column. A number pins that bound at the same value for every row, which is how a
 * fixed tolerance is written; a field name or accessor reads it per row.
 * @param data - the data rows
 * @param arg - the field name, accessor, or pinned constant
 * @param side - the interval's axis, for error messages
 * @param slot - which of low / high / error this is, for error messages
 * @returns the resolved column
 */
function resolve_bound(
    data: Record<string, unknown>[],
    arg: ErrorBarBoundArg,
    side: 'x' | 'y',
    slot: 'low' | 'high' | 'error',
): Float64Array {
    const label = `${side}_${slot}`

    if (typeof arg === 'number') {
        const value = slot === 'error'
            ? validate_non_negative(arg, `plot.error_bar: ${label}`)
            : validate_finite(arg, `plot.error_bar: ${label}`)
        return new Float64Array(data.length).fill(value)
    }

    if (data.length > 0) {
        validate_field_present(data[0], arg, false, 'plot.error_bar', label)
    }
    const resolved = resolve_column(data, arg, 'plot.error_bar', label)

    if (resolved.mode === 'categorical') {
        throw new Error(`plot.error_bar: ${label} must be numeric — it places one end of the interval on the ${side} axis.`)
    }
    return resolved.values
}

/**
 * Apply the optional presentation args onto the series, validating each.
 * @param series - the series under construction
 * @param args - the error bar series args
 */
function apply_error_bar_options<TooltipContent>(series: ErrorBarSeries<TooltipContent>, args: ErrorBarArgs<TooltipContent>): void {
    if (args.mark !== undefined) {
        series.mark = args.mark
    }

    if (args.size !== undefined) {
        series.size = validate_non_negative(args.size, 'plot.error_bar: size')
    }
    const stroke = resolve_stroke(args.stroke, 'plot.error_bar')

    if (stroke !== undefined) {
        series.stroke = stroke
    }

    if (args.width !== undefined) {
        series.width = validate_positive(args.width, 'plot.error_bar: width')
    }

    const cap = resolve_cap(args.cap)

    if (cap !== undefined) {
        series.cap = cap
    }

    if (args.connect !== undefined) {
        series.connect = args.connect
    }

    if (args.tooltip !== undefined) {
        series.tooltip = args.tooltip
    }

    if (args.on_select !== undefined) {
        series.on_select = args.on_select
    }
    const hoverable = validate_hoverable(args, 'plot.error_bar')

    if (hoverable !== undefined) {
        series.hoverable = hoverable
    }

    if (args.highlight !== undefined) {
        series.highlight = args.highlight
    }
}

/**
 * Resolve the cap arg to a crossbar length in pixels. `false` is a zero-length crossbar, which is the plain
 * end the paint already draws for it; `true` leaves the length unset, so the paint's default stands.
 * @param cap - the caller's cap arg
 * @returns the crossbar length in pixels, or undefined to take the default
 */
function resolve_cap(cap: ErrorBarCapArg | undefined): number | undefined {
    if (cap === undefined || cap === true) {
        return undefined
    }

    if (cap === false) {
        return 0
    }
    return validate_non_negative(cap, 'plot.error_bar: cap')
}

/**
 * Reject an axis the interval can't be drawn against: it runs between two numeric values, so its own axis
 * can't be categorical. The center axis is free to be anything, which is what puts groups on one side.
 * @param x - the resolved x axis context
 * @param y - the resolved y axis context
 * @param series - the error bar series
 * @param index - the series' position in the plot, for messages
 */
export function validate_error_bar_axes(x: AxisContext, y: AxisContext, series: ErrorBarSeries, index: number): void {
    // an empty series exposes no column types and draws nothing
    if (series.x.length === 0) {
        return
    }
    const interval_axis = series.side === 'x' ? x : y

    if (interval_axis.is_category) {
        const other = series.side === 'x' ? 'y' : 'x'
        throw new Error(`plot: error bar series at index ${index} spans an interval on the ${series.side} axis, so ${series.side} can't be categorical. Put the categories on ${other}.`)
    }
}

/**
 * The error bar's data extent: the center axis spans its centers, the interval axis spans the whole interval
 * so a whisker reaching past its center still fits inside the plot.
 * @param series - the error bar series
 * @returns the [min, max] per axis
 */
export function error_bar_domain_extent(series: ErrorBarSeries): { x: [number, number]; y: [number, number] } {
    const center = series.side === 'x' ? series.x : series.y
    const [interval_min, interval_max] = merged_extent(series.low, series.high)
    const [center_min, center_max] = array_extent(center)
    // bounds mode reads the interval off the axis, so it need not contain the center
    const span: [number, number] = [Math.min(center_min, interval_min), Math.max(center_max, interval_max)]

    if (series.side === 'x') {
        return { x: span, y: array_extent(series.y) }
    }
    return { x: array_extent(series.x), y: span }
}
