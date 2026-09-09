import { resolve_xy_columns, attach_resolved_columns, resolve_column, validate_field_present } from "../../template/column"
import { array_extent } from "../../template/extent"
import { validate_finite, validate_non_negative, validate_hoverable } from "../../template/validate"
import { resolve_stroke } from "../../template/color"
import type { AreaSeries, AxisContext, FieldArg, SelectFn, StrokeArg, ThemeColor, TooltipArg } from "../../types"

export type AreaBoundArg = FieldArg | number

export type AreaArgs<TooltipContent = unknown> = {
    data: Record<string, unknown>[]
    x?: FieldArg
    x2?: AreaBoundArg
    y?: FieldArg
    y2?: AreaBoundArg
    color?: ThemeColor
    stroke?: StrokeArg
    dash?: number[]
    tooltip?: TooltipArg<Record<string, unknown>, TooltipContent>
    on_select?: SelectFn<Record<string, unknown>>
    hoverable?: boolean
    highlight?: boolean
}

type AreaBound = { side: 'x' | 'y'; values: Float64Array; pinned: boolean }

/**
 * Area series factory. Resolves x / y and the second boundary (x2 or y2) into aligned Float64Arrays and
 * validates the boundary dash pattern.
 * @param args - area series args (data, x, x2, y, y2, color, stroke, dash)
 * @returns the resolved AreaSeries
 */
export function new_area<TooltipContent = unknown>(args: AreaArgs<TooltipContent>): AreaSeries<TooltipContent> {
    const x_arg = args.x ?? 'x'
    const y_arg = args.y ?? 'y'
    const resolved = resolve_xy_columns(args.data, x_arg, y_arg, 'plot.area', args.x === undefined, args.y === undefined)
    const bound = resolve_bound(args)
    const stroke = resolve_stroke(args.stroke, 'plot.area')
    const series: AreaSeries<TooltipContent> = {
        kind: 'area',
        x: resolved.x,
        y: resolved.y,
    }

    if (bound?.side === 'x') {
        series.x2 = bound.values
    }

    if (bound?.side === 'y') {
        series.y2 = bound.values
    }

    if (bound?.pinned === true) {
        series.bound_pinned = true
    }

    if (args.color !== undefined) {
        series.color = args.color
    }

    if (stroke !== undefined) {
        series.stroke = stroke
    }

    if (args.dash !== undefined) {
        series.dash = args.dash.map((segment, i) => validate_non_negative(segment, `plot.area: dash[${i}]`))
    }

    if (args.tooltip !== undefined) {
        series.tooltip = args.tooltip
    }

    if (args.on_select !== undefined) {
        series.on_select = args.on_select
    }

    const hoverable = validate_hoverable(args, 'plot.area')

    if (hoverable !== undefined) {
        series.hoverable = hoverable
    }

    if (args.highlight !== undefined) {
        series.highlight = args.highlight
    }

    series.rows = args.data // caller's original for the tooltip
    attach_resolved_columns(series, resolved, x_arg, y_arg)
    return series
}

/**
 * Resolve the band's second boundary: which axis it pairs on, and its column. A number pins the boundary at
 * that constant for every row.
 * @param args - the area series args
 * @returns the resolved bound, or undefined when the band fills to the zero baseline
 */
function resolve_bound(args: AreaArgs): AreaBound | undefined {
    const field = bound_field(args)

    if (field === undefined) {
        return undefined
    }
    const slot = `${field.side}2`

    if (typeof field.arg === 'number') {
        const value = validate_finite(field.arg, `plot.area: ${slot}`)
        return { side: field.side, values: new Float64Array(args.data.length).fill(value), pinned: true }
    }

    if (args.data.length > 0) {
        validate_field_present(args.data[0], field.arg, field.defaulted, 'plot.area', slot)
    }
    const resolved = resolve_column(args.data, field.arg, 'plot.area', slot)

    if (resolved.mode === 'categorical') {
        throw new Error(`plot.area: ${slot} must be numeric to pair with ${field.side}.`)
    }
    return { side: field.side, values: resolved.values, pinned: false }
}

/**
 * Which boundary pair the caller declared, and so which way the band runs: `y2` gives a horizontal band
 * riding x, `x2` a vertical band riding y. Neither arg defaults to horizontal, and the band fills to the zero baseline.
 * @param args - the area series args
 * @returns the second boundary's axis, its field name / accessor / pinned constant, and whether that name
 * was adopted off the rows rather than passed, or undefined for a baseline fill
 */
function bound_field(args: AreaArgs): { side: 'x' | 'y'; arg: AreaBoundArg; defaulted: boolean } | undefined {
    if (args.x2 !== undefined && args.y2 !== undefined) {
        throw new Error('plot.area: pass y2 (a horizontal band riding the x axis) or x2 (a vertical band riding the y axis), not both. Two bounds on each axis is a box per row, which is plot.rect.')
    }

    if (args.x2 !== undefined) {
        return { side: 'x', arg: args.x2, defaulted: false }
    }

    if (args.y2 !== undefined) {
        return { side: 'y', arg: args.y2, defaulted: false }
    }

    if (args.data.some(row => 'y2' in row)) {
        return { side: 'y', arg: 'y2', defaulted: true }
    }

    if (args.data.some(row => 'x2' in row)) {
        return { side: 'x', arg: 'x2', defaulted: true }
    }
    return undefined
}

/**
 * Reject axes the band can't be drawn against: the paired axis carries two numeric boundaries, a baseline
 * band needs room for zero on it, and a pinned boundary has to be placeable on it.
 * @param x - the resolved x axis context
 * @param y - the resolved y axis context
 * @param series - the area series
 * @param index - the series' position in the plot, for messages
 */
export function validate_area_axes(x: AxisContext, y: AxisContext, series: AreaSeries, index: number): void {
    // an empty series exposes no column types and draws nothing
    if (series.x.length === 0) {
        return
    }

    if (series.x2 !== undefined) {
        if (x.is_category) {
            throw new Error(`plot: area series at index ${index} has x2, so it runs between two numeric x values and can't use a categorical x axis. Put the categories on y.`)
        }
        validate_pinned_bound(series, series.x2, x, 'x', index)
        return
    }

    if (y.is_category) {
        throw new Error(`plot: area series at index ${index} can't use a categorical y axis. The band runs between two numeric y values; put the categories on x.`)
    }

    if (series.y2 === undefined) {
        if (y.scale === 'log') {
            throw new Error(`plot: area series at index ${index} has no y2, so it fills to the zero baseline, which a log y axis has no room for. Pass y2 to bound the band, or use a linear y axis.`)
        }
        return
    }
    validate_pinned_bound(series, series.y2, y, 'y', index)
}

/**
 * Reject a pinned boundary the axis can't place. A constant is a caller instruction rather than data, so a
 * non-positive pin on a log scale is an error the way a non-positive `axis.{min,max}` is; a data column that
 * can't be placed only breaks the band.
 * @param series - the area series
 * @param bound - the second boundary's column
 * @param axis - the axis context the boundaries live on
 * @param side - which axis that is, for the message
 * @param index - the series' position in the plot, for messages
 */
function validate_pinned_bound(series: AreaSeries, bound: Float64Array, axis: AxisContext, side: 'x' | 'y', index: number): void {
    if (series.bound_pinned !== true || axis.scale !== 'log') {
        return
    }
    const pinned = bound[0]

    if (pinned > 0) {
        return
    }
    throw new Error(`plot: area series at index ${index} pins ${side}2 at ${pinned}, which a log ${side} axis can't place. Pin ${side}2 to a positive value, or use a linear ${side} axis.`)
}

/**
 * The area's data extent: the free axis spans its points, the paired axis spans both boundaries. With no
 * second boundary the band fills to zero, so that extent includes it.
 * @param series - the area series
 * @returns the [min, max] per axis
 */
export function area_domain_extent(series: AreaSeries): { x: [number, number]; y: [number, number] } {
    if (series.x2 !== undefined) {
        return {
            x: merged_extent(series.x, series.x2),
            y: array_extent(series.y),
        }
    }

    if (series.y2 !== undefined) {
        return {
            x: array_extent(series.x),
            y: merged_extent(series.y, series.y2),
        }
    }
    const [y_min, y_max] = array_extent(series.y)
    return {
        x: array_extent(series.x),
        y: [Math.min(y_min, 0), Math.max(y_max, 0)],
    }
}

/**
 * The extent covering both of a band's boundary columns.
 * @param first - one boundary's values
 * @param second - the other boundary's values
 * @returns the [min, max] spanning both
 */
function merged_extent(first: Float64Array, second: Float64Array): [number, number] {
    const [first_min, first_max] = array_extent(first)
    const [second_min, second_max] = array_extent(second)
    return [Math.min(first_min, second_min), Math.max(first_max, second_max)]
}
