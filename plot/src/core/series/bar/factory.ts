import { resolve_xy_columns, attach_resolved_columns, type ResolvedColumnMeta } from "../../template/column"
import { compact_column, dedupe_bands, warn_dropped_bands } from "./duplicates"
import { array_extent, xy_extent } from "../../template/extent"
import { resolve_color } from "../../template/color"
import { validate_hoverable, validate_hover_span, validate_non_negative } from "../../template/validate"
import type { AxisContext, BarSeries, ColorArg, FieldArg, SelectFn, SideMode, ThemeColor, TooltipArg } from "../../types"
import { expand_stack, resolve_stack_colors } from "./stack"

export type BarSideArg = FieldArg | string[]
export type BarColorArg = ColorArg | ThemeColor[]

export type BarArgs<TooltipContent = unknown> = {
    data: Record<string, unknown>[]
    x?: BarSideArg
    y?: BarSideArg
    color?: BarColorArg
    border_radius?: number
    inset?: number
    min_size?: number
    hover_span_x?: boolean
    hover_span_y?: boolean
    tooltip?: TooltipArg<Record<string, unknown>, TooltipContent>
    on_select?: SelectFn<Record<string, unknown>>
    hoverable?: boolean
    highlight?: boolean
}

/**
 * Bar series factory. Whichever of x / y is an array of field names is the stacked value side, and the
 * other side is the band: array y stacks vertically, array x stacks horizontally. Neither gives one bar per row.
 * @param args - bar series args (data, x, y, color)
 * @returns the resolved BarSeries
 */
export function new_bar<TooltipContent = unknown>(args: BarArgs<TooltipContent>): BarSeries<TooltipContent> {
    const x_arg = args.x ?? 'x'
    const y_arg = args.y ?? 'y'

    if (Array.isArray(y_arg)) {

        if (Array.isArray(x_arg)) {
            throw new Error(`plot.bar: both x and y are arrays of value fields. Stacked bars need exactly one value side (the array of field names) and one categorical band side.`)
        }
        return new_stacked_bar(args, x_arg, 'x', y_arg)
    }

    if (Array.isArray(x_arg)) {
        return new_stacked_bar(args, y_arg, 'y', x_arg)
    }
    return new_plain_bar(args, x_arg, y_arg)
}

/**
 * One bar per row. Detects column types and requires exactly one categorical axis.
 * @param args - bar series args
 * @param x_arg - the x field name or accessor
 * @param y_arg - the y field name or accessor
 * @returns the resolved BarSeries
 */
function new_plain_bar<TooltipContent>(args: BarArgs<TooltipContent>, x_arg: FieldArg, y_arg: FieldArg): BarSeries<TooltipContent> {
    const color = args.color

    if (Array.isArray(color)) {
        throw new Error(`plot.bar: color is an array, which pairs one color to each stacked segment, but this series isn't stacked. Pass a single color or an accessor, or stack it with y: ['first', 'second'].`)
    }
    // labels mirror resolve_xy_columns for consistent error messages
    const x_label = typeof x_arg === 'string' ? x_arg : 'x'
    const y_label = typeof y_arg === 'string' ? y_arg : 'y'

    const resolved = resolve_xy_columns(args.data, x_arg, y_arg, 'plot.bar', args.x === undefined, args.y === undefined)

    // empty data exposes no column types to detect. Empty series will render bare chrome
    if (args.data.length > 0) {

        if (resolved.x_mode === 'categorical' && resolved.y_mode === 'categorical') {
            throw new Error(`plot.bar: both x ('${x_label}') and y ('${y_label}') resolved to categorical columns. Bar series requires exactly one categorical (band) axis and one numeric (height) axis.`)
        }

        if (resolved.x_mode !== 'categorical' && resolved.y_mode !== 'categorical') {
            throw new Error(`plot.bar: neither x ('${x_label}') nor y ('${y_label}') is a categorical column. Pass string values on one column or use plot.scatter for two numeric columns.`)
        }
    }
    // a band on more than one row collapses to its last row
    const drawn = drop_shadowed_rows(args.data, resolved)
    const series: BarSeries<TooltipContent> = {
        kind: 'bar',
        x: drawn.x,
        y: drawn.y,
        ...resolve_color(drawn.data, color),
    }

    apply_bar_options(series, args)
    series.rows = drawn.data // caller's original for the tooltip
    attach_resolved_columns(series, resolved, x_arg, y_arg)
    return series
}

/**
 * Collapse repeated band values to their last row, leaving the columns untouched when every band is unique.
 * Category indices come from the full data, so a band keeps the axis position it earned on first sight.
 * @param data - the caller's rows
 * @param resolved - the resolved x / y columns and their modes
 * @returns the rows and columns to draw
 */
function drop_shadowed_rows(
    data: Record<string, unknown>[],
    resolved: ResolvedColumnMeta & { x: Float64Array; y: Float64Array },
): { data: Record<string, unknown>[]; x: Float64Array; y: Float64Array } {
    const x_is_band = resolved.x_mode === 'categorical'
    const band_values = x_is_band ? resolved.x : resolved.y
    const categories = (x_is_band ? resolved.x_categories : resolved.y_categories) ?? []

    // an empty or non-categorical series has no bands to collapse
    if (data.length === 0 || categories.length === 0) {
        return { data, x: resolved.x, y: resolved.y }
    }
    const duplicates = dedupe_bands(band_values, data.length, categories)

    if (duplicates === null) {
        return { data, x: resolved.x, y: resolved.y }
    }
    warn_dropped_bands(duplicates.repeated, 'plot.bar')
    const keep = duplicates.keep
    const kept_data: Record<string, unknown>[] = new Array(keep.length)

    for (let i = 0; i < keep.length; i++) {
        kept_data[i] = data[keep[i]]
    }
    return { data: kept_data, x: compact_column(resolved.x, keep), y: compact_column(resolved.y, keep) }
}

/**
 * Wide-form stacked bars: each row becomes one segment per value field, flattened to per-mark columns.
 * Band on x stacks vertically, band on y horizontally.
 * @param args - bar series args
 * @param band_arg - the band axis field name or accessor
 * @param band_side - which axis is the band; the other side carries the stacked values
 * @param value_fields - the per-segment value field names, in stacking order
 * @returns the resolved BarSeries
 */
function new_stacked_bar<TooltipContent>(args: BarArgs<TooltipContent>, band_arg: FieldArg, band_side: 'x' | 'y', value_fields: string[]): BarSeries<TooltipContent> {
    const expanded = expand_stack(args.data, band_arg, band_side, value_fields, 'plot.bar')
    const is_vertical = band_side === 'x'
    const value_side = is_vertical ? 'y' : 'x'
    const series: BarSeries<TooltipContent> = {
        kind: 'bar',
        x: is_vertical ? expanded.band : expanded.value,
        y: is_vertical ? expanded.value : expanded.band,
        stack_base: expanded.stack_base,
        is_tip: expanded.is_tip,
        labels: expanded.labels,
        ...resolve_stack_colors(expanded.rows, value_fields.length, args.color, value_side, 'plot.bar'),
    }

    apply_bar_options(series, args)
    series.rows = expanded.rows
    series.x_axis_kind = is_vertical ? 'categorical' : 'numeric'
    series.y_axis_kind = is_vertical ? 'numeric' : 'categorical'

    // categories and the source field name land on the band side only.
    // The value side has many source fields, so it carries no auto axis label
    const category_key = is_vertical ? 'x_categories' : 'y_categories'
    const field_key = is_vertical ? 'x_field' : 'y_field'

    if (expanded.categories.length > 0) {
        series[category_key] = expanded.categories
    }

    if (typeof band_arg === 'string') {
        series[field_key] = band_arg
    }
    return series
}

/**
 * Apply the options shared by plain and stacked bars, mutating the series in place.
 * @param series - the series under construction
 * @param args - the caller's bar args
 */
function apply_bar_options<TooltipContent>(series: BarSeries<TooltipContent>, args: BarArgs<TooltipContent>): void {
    if (args.border_radius !== undefined) {
        series.border_radius = validate_non_negative(args.border_radius, 'plot.bar: border_radius')
    }

    if (args.inset !== undefined) {
        series.inset = validate_non_negative(args.inset, 'plot.bar: inset')
    }

    if (args.min_size !== undefined) {
        series.min_size = validate_non_negative(args.min_size, 'plot.bar: min_size')
    }

    if (args.tooltip !== undefined) {
        series.tooltip = args.tooltip
    }

    if (args.on_select !== undefined) {
        series.on_select = args.on_select
    }

    const hoverable = validate_hoverable(args, 'plot.bar')

    if (hoverable !== undefined) {
        series.hoverable = hoverable
    }

    if (args.hover_span_x !== undefined) {
        series.hover_span_x = validate_hover_span(args.hover_span_x, hoverable, 'hover_span_x', 'plot.bar')
    }

    if (args.hover_span_y !== undefined) {
        series.hover_span_y = validate_hover_span(args.hover_span_y, hoverable, 'hover_span_y', 'plot.bar')
    }

    if (args.highlight !== undefined) {
        series.highlight = args.highlight
    }
}

/**
 * The [min, max] a bar series spans per axis. Stacked segments sit on running offsets, so the value side
 * spans each segment's start..start+value rather than the raw column extent.
 * @param series - the bar series
 * @returns the [min, max] per axis
 */
export function bar_domain_extent(series: BarSeries): { x: [number, number]; y: [number, number] } {
    const stack_base = series.stack_base

    if (stack_base === undefined) {
        return xy_extent(series)
    }
    const is_vertical = series.x_axis_kind === 'categorical'
    const values = is_vertical ? series.y : series.x
    let min = Infinity
    let max = -Infinity

    for (let i = 0; i < values.length; i++) {
        const start = stack_base[i]
        const end = start + values[i]

        min = Math.min(min, start, end)
        max = Math.max(max, start, end)
    }
    const value_extent: [number, number] = [min, max]

    if (is_vertical) {
        return { x: array_extent(series.x), y: value_extent }
    }
    return { x: value_extent, y: array_extent(series.y) }
}

/**
 * Require exactly one categorical axis (band) and one linear axis (height), and reject a log value axis
 * for a stacked series. Throws otherwise.
 * @param x - resolved x axis
 * @param y - resolved y axis
 * @param series - the bar series, to skip the check when it has no rows
 * @param index - series index, for the error message
 */
export function validate_bar_axes(x: AxisContext, y: AxisContext, series: BarSeries, index: number): void {

    // empty series has no detectable band axis; nothing to draw, so don't enforce the requirement
    if (series.x.length === 0) {
        return
    }

    if (x.scale === 'time' || x.scale === 'utc' || y.scale === 'time' || y.scale === 'utc') {
        throw new Error(`plot: bar series at index ${index} can't use a time axis. Bars need a categorical band axis and a numeric height axis`)
    }

    if (x.is_category === y.is_category) {
        throw new Error(`plot: bar series at index ${index} requires exactly one categorical axis (band) and one linear axis (height); got x_is_category=${x.is_category}, y_is_category=${y.is_category}.`)
    }

    // exactly one side is categorical by here, so the other side carries the values
    const value_axis = x.is_category ? y : x
    const value_side = x.is_category ? 'y' : 'x'

    if (series.stack_base !== undefined && value_axis.scale === 'log') {
        throw new Error(`plot: stacked bar series at index ${index} can't use a log ${value_side} axis. Segments stack by summing from a zero baseline, which a log scale has no room for. Use a linear ${value_side} axis, or drop the stack and pass a single ${value_side} field.`)
    }
}

/**
 * Anchor the value axis at zero. A hidden axis pads symmetrically so bars sit off the edges without a visible baseline.
 * @param x - resolved x axis
 * @param y - resolved y axis
 * @returns the value-side padding override
 */
export function bar_padding_mode(x: AxisContext, y: AxisContext): { x?: SideMode, y?: SideMode } {
    if (x.is_category && !y.is_category) {
        return { y: y.rendered ? 'anchor_zero' : 'spark_symmetric' }
    }

    if (!x.is_category && y.is_category) {
        return { x: x.rendered ? 'anchor_zero' : 'spark_symmetric' }
    }
    return {}
}
