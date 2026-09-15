import { attach_resolved_columns, resolve_column, validate_field_present, type ResolvedColumn } from "../../template/column"
import { array_extent } from "../../template/extent"
import { resolve_color } from "../../template/color"
import { validate_finite, validate_hoverable } from "../../template/validate"
import type { ColorArg, CustomHitTestFn, CustomRendererFn, CustomSeries, Domain, FieldArg, SelectFn, TooltipArg } from "../../types"

export type CustomAxisRangeArg = { x?: number[]; y?: number[] }

export type CustomArgs<TooltipContent = unknown> = {
    data?: Record<string, unknown>[]
    x?: FieldArg
    y?: FieldArg
    renderer: CustomRendererFn<TooltipContent>
    hit_test?: CustomHitTestFn<TooltipContent>
    color?: ColorArg
    axis_range?: CustomAxisRangeArg
    tooltip?: TooltipArg<Record<string, unknown> | undefined, TooltipContent>
    on_select?: SelectFn<Record<string, unknown> | undefined>
    hoverable?: boolean
}

/**
 * Custom series factory. Resolves whichever of x / y the caller claimed, leaves the other unclaimed, and
 * carries the caller's renderer through to render time.
 * @param args - custom series args (renderer, plus optional data, x, y, color, axis_range)
 * @returns the resolved CustomSeries
 */
export function new_custom<TooltipContent = unknown>(args: CustomArgs<TooltipContent>): CustomSeries<TooltipContent> {
    const resolved_x = resolve_custom_column(args.data, args.x, 'x')
    const resolved_y = resolve_custom_column(args.data, args.y, 'y')
    const series: CustomSeries<TooltipContent> = {
        kind: 'custom',
        x: resolved_x.values,
        y: resolved_y.values,
        renderer: args.renderer,
    }
    apply_custom_options(series, args)
    attach_resolved_columns(
        series,
        {
            x_mode: resolved_x.mode,
            y_mode: resolved_y.mode,
            x_categories: resolved_x.categories,
            y_categories: resolved_y.categories,
        },
        args.x,
        args.y,
    )
    return series
}

/**
 * Resolve one axis' column. An axis the caller didn't name is left unclaimed: NaN at every row, so indices
 * still line up with `rows` while the axis' domain stays untouched (array_extent returns the inverted
 * [Infinity, -Infinity] that compute_domains merges away). With no data at all the column is empty, which is
 * what makes a static overlay possible. Throws if a field is named but no data was passed.
 * @param data - the data rows, when the value is a field
 * @param field - the field name or accessor for this axis, or undefined
 * @param side - the axis, for error messages
 * @returns the resolved column plus its mode and categories
 */
function resolve_custom_column(
    data: Record<string, unknown>[] | undefined,
    field: FieldArg | undefined,
    side: 'x' | 'y',
): ResolvedColumn {
    if (field === undefined) {
        const length = data?.length ?? 0
        return { values: new Float64Array(length).fill(NaN), mode: 'undecided', categories: null }
    }

    if (data === undefined) {
        throw new Error(`plot.custom: ${side} names a field but no data was passed. Pass data to read ${side} per row, or drop ${side} and position what you draw from the scales.`)
    }

    if (data.length > 0) {
        validate_field_present(data[0], field, false, 'plot.custom', side)
    }
    return resolve_column(data, field, 'plot.custom', side)
}

/**
 * Apply the optional custom args onto the series, validating each.
 * @param series - the series under construction
 * @param args - the custom series args
 */
function apply_custom_options<TooltipContent>(series: CustomSeries<TooltipContent>, args: CustomArgs<TooltipContent>): void {
    apply_custom_color(series, args)

    if (args.axis_range !== undefined) {
        series.axis_range = validate_axis_range(args.axis_range)
    }
    apply_custom_hover(series, args)

    if (args.data !== undefined) {
        series.rows = args.data // caller's original, so a renderer can read whatever the accessors didn't
    }
}

/**
 * Apply the hover args, rejecting the combinations that would silently never fire. Hover on a custom series
 * runs entirely through the caller's `hit_test`, and its result indexes the series' own points — so a
 * tooltip without a hit test, or either without rows to index, is a bug rather than a no-op.
 * @param series - the series under construction
 * @param args - the custom series args
 */
function apply_custom_hover<TooltipContent>(series: CustomSeries<TooltipContent>, args: CustomArgs<TooltipContent>): void {
    const hoverable = validate_hoverable(args, 'plot.custom')
    const wants_hover = args.tooltip !== undefined || args.on_select !== undefined

    if (wants_hover && args.hit_test === undefined) {
        throw new Error('plot.custom: tooltip / on_select are set but hit_test is not. A custom series is only ever hovered through its own hit_test, so nothing would fire. Add hit_test, or drop them.')
    }

    if (args.hit_test !== undefined && args.data === undefined) {
        throw new Error('plot.custom: hit_test is set but no data was passed. A hit test returns the index of a point, and the hovered x / y / row are read back from the series at that index, so a series with no rows can never report a hit. Pass data.')
    }

    if (args.hit_test !== undefined && !wants_hover) {
        throw new Error('plot.custom: hit_test is set but neither tooltip nor on_select is. A custom series has no hover highlight, so a hit test with nothing to fire runs on every pointer move and shows nothing. Add tooltip or on_select, or drop hit_test.')
    }

    if (hoverable !== undefined) {
        series.hoverable = hoverable
    }

    if (args.hit_test !== undefined) {
        series.hit_test = args.hit_test
    }

    if (args.tooltip !== undefined) {
        series.tooltip = args.tooltip
    }

    if (args.on_select !== undefined) {
        series.on_select = args.on_select
    }
}

/**
 * Resolve the series color(s). With data, per-row colors work as they do for any series; without it there's
 * no row for an accessor to read, so only a uniform color is accepted. Throws on an accessor without data.
 * @param series - the series under construction
 * @param args - the custom series args
 */
function apply_custom_color<TooltipContent>(series: CustomSeries<TooltipContent>, args: CustomArgs<TooltipContent>): void {
    const data = args.data

    if (data !== undefined) {
        const { color, colors } = resolve_color(data, args.color)

        if (color !== undefined) {
            series.color = color
        }

        if (colors !== undefined) {
            series.colors = colors
        }
        return
    }

    if (args.color === undefined) {
        return
    }

    if (typeof args.color === 'function') {
        throw new Error('plot.custom: color is an accessor but no data was passed. An accessor reads a color per row; pass a color string or {light, dark} for a series with no rows.')
    }
    series.color = args.color
}

/**
 * Validate a declared axis_range: each side present must be exactly [low, high], finite, and non-inverted.
 * The schema only checks that the entries are numbers.
 * @param axis_range - the caller's axis_range
 * @returns the validated axis_range
 */
function validate_axis_range(axis_range: { x?: number[]; y?: number[] }): { x?: Domain; y?: Domain } {
    const validated: { x?: Domain; y?: Domain } = {}

    if (axis_range.x !== undefined) {
        validated.x = validate_axis_range_side(axis_range.x, 'x')
    }

    if (axis_range.y !== undefined) {
        validated.y = validate_axis_range_side(axis_range.y, 'y')
    }
    return validated
}

/**
 * Validate one side of a declared axis_range.
 * @param side_range - the [low, high] pair
 * @param side - the axis, for error messages
 * @returns the validated [low, high]
 */
function validate_axis_range_side(side_range: number[], side: 'x' | 'y'): Domain {
    if (side_range.length !== 2) {
        throw new Error(`plot.custom: axis_range.${side} takes exactly [low, high], got ${side_range.length} value(s).`)
    }
    const low = validate_finite(side_range[0], `plot.custom: axis_range.${side} low`)
    const high = validate_finite(side_range[1], `plot.custom: axis_range.${side} high`)

    if (low > high) {
        throw new Error(`plot.custom: axis_range.${side} is [${low}, ${high}], which is inverted. Pass [low, high].`)
    }
    return [low, high]
}

/**
 * The domain this series claims per axis: the declared axis_range where the caller gave one, otherwise the span
 * of its own points. Per side, so declaring one axis leaves the other reading its points.
 * @param series - the custom series
 * @returns the [min, max] per axis
 */
export function custom_domain_extent(series: CustomSeries): { x: [number, number]; y: [number, number] } {
    return {
        x: series.axis_range?.x ?? array_extent(series.x),
        y: series.axis_range?.y ?? array_extent(series.y),
    }
}
