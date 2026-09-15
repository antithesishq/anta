import { attach_resolved_columns, resolve_column, validate_field_present, type ColumnMode, type ResolvedColumn } from "../../template/column"
import { array_extent } from "../../template/extent"
import { validate_finite, validate_non_negative, validate_hoverable, validate_hover_span } from "../../template/validate"
import { resolve_color, resolve_stroke } from "../../template/color"
import type { ColorArg, FieldArg, RectAlign, RectSeries, SelectFn, StrokeArg, TooltipArg } from "../../types"

export type RectSizeArg = number | { width?: number; height?: number }
export type RectOffsetArg = { x?: number; y?: number }

export type RectArgs<TooltipContent = unknown> = {
    data: Record<string, unknown>[]
    x?: FieldArg
    x2?: FieldArg
    y?: FieldArg
    y2?: FieldArg
    span?: 'x' | 'y'
    size?: RectSizeArg
    band_align?: RectAlign
    hover_span_x?: boolean
    hover_span_y?: boolean
    inset?: number
    min_size?: number
    offset?: RectOffsetArg
    color?: ColorArg
    stroke?: StrokeArg
    tooltip?: TooltipArg<Record<string, unknown>, TooltipContent>
    on_select?: SelectFn<Record<string, unknown>>
    hoverable?: boolean
    highlight?: boolean
}

/**
 * Rect series factory. Resolves x / y (and the opposite corners x2 / y2) into aligned Float64Arrays,
 * validates each axis, and resolves color.
 * @param args - rect series args (data, x, x2, y, y2, color)
 * @returns the resolved RectSeries
 */
export function new_rect<TooltipContent = unknown>(args: RectArgs<TooltipContent>): RectSeries<TooltipContent> {
    const span = args.span
    validate_span(args, span)

    const x_fields = axis_field_args(args, 'x')
    const y_fields = axis_field_args(args, 'y')

    const resolved = resolve_rect_columns(args.data, x_fields.value, x_fields.corner, y_fields.value, y_fields.corner, 'plot.rect', args.x === undefined, args.y === undefined)
    const size = resolve_size(args.size)
    const offset = resolve_offset(args.offset)
    const stroke = resolve_stroke(args.stroke, 'plot.rect')

    // empty data exposes no column types to detect; an empty series renders nothing
    if (args.data.length > 0) {
        if (span !== 'x') {
            validate_rect_axis('x', 'x2', resolved.x_mode, x_fields.corner !== undefined, resolved.x2_mode, size?.width !== undefined)
        }

        if (span !== 'y') {
            validate_rect_axis('y', 'y2', resolved.y_mode, y_fields.corner !== undefined, resolved.y2_mode, size?.height !== undefined)
        }
    }

    const series: RectSeries<TooltipContent> = {
        kind: 'rect',
        x: resolved.x1,
        y: resolved.y1,
        ...resolve_color(args.data, args.color),
    }

    if (span !== undefined) {
        series.span = span
    }

    if (resolved.x2 !== undefined) {
        series.x2 = resolved.x2
    }

    if (resolved.y2 !== undefined) {
        series.y2 = resolved.y2
    }

    if (size !== undefined) {
        series.size = size
    }

    if (args.band_align !== undefined) {
        series.band_align = args.band_align
    }

    if (args.inset !== undefined) {
        series.inset = validate_non_negative(args.inset, 'plot.rect: inset')
    }

    if (args.min_size !== undefined) {
        series.min_size = validate_non_negative(args.min_size, 'plot.rect: min_size')
    }

    if (offset !== undefined) {
        series.offset = offset
    }

    if (stroke !== undefined) {
        series.stroke = stroke
    }

    if (args.tooltip !== undefined) {
        series.tooltip = args.tooltip
    }

    if (args.on_select !== undefined) {
        series.on_select = args.on_select
    }

    const hoverable = validate_hoverable(args, 'plot.rect')

    if (hoverable !== undefined) {
        series.hoverable = hoverable
    }

    if (args.hover_span_x !== undefined) {
        series.hover_span_x = validate_hover_span(args.hover_span_x, hoverable, 'hover_span_x', 'plot.rect')
    }

    if (args.hover_span_y !== undefined) {
        series.hover_span_y = validate_hover_span(args.hover_span_y, hoverable, 'hover_span_y', 'plot.rect')
    }

    if (args.highlight !== undefined) {
        series.highlight = args.highlight
    }

    series.rows = args.data // caller's original for the tooltip
    attach_resolved_columns(series, resolved, x_fields.value, y_fields.value)
    return series
}

/**
 * The field args for one axis. A spanned axis reads nothing on that side, so both come back undefined;
 * otherwise the value column defaults to the axis' own name and the corner follows the x2 / y2 convention.
 * @param args - the rect series args
 * @param axis - the axis to resolve fields for
 * @returns the value and corner field args for that axis
 */
function axis_field_args(args: RectArgs, axis: 'x' | 'y'): { value: FieldArg | undefined; corner: FieldArg | undefined } {
    if (args.span === axis) {
        return { value: undefined, corner: undefined }
    }
    const corner_field = axis === 'x' ? 'x2' : 'y2'
    return {
        value: args[axis] ?? axis,
        corner: default_corner(args[corner_field], args.data, corner_field),
    }
}

/**
 * Default an optional corner field: the caller's arg wins; otherwise adopt the same-named field ('x2' /
 * 'y2') when any row carries it, else leave it unset (so center+size or band mode applies).
 * @param corner_arg - the caller's x2 / y2 arg, or undefined
 * @param data - the data rows
 * @param field - the conventional field name for this corner
 * @returns the resolved corner field arg, or undefined when none applies
 */
function default_corner(corner_arg: FieldArg | undefined, data: Record<string, unknown>[], field: string): FieldArg | undefined {
    if (corner_arg !== undefined) {
        return corner_arg
    }

    if (data.some(row => field in row)) {
        return field
    }
    return undefined
}

/**
 * Normalize the size arg into per-axis pixel sizes, validating each is non-negative and finite.
 * A number is a square; an object sets width / height independently.
 * @param size - the size arg (number, object, or undefined)
 * @returns the per-axis pixel size, or undefined when none applies
 */
function resolve_size(size: RectArgs['size']): { width?: number; height?: number } | undefined {
    if (size === undefined) {
        return undefined
    }

    if (typeof size === 'number') {
        const pixels = validate_non_negative(size, 'plot.rect: size')
        return { width: pixels, height: pixels }
    }
    const result: { width?: number; height?: number } = {}

    if (size.width !== undefined) {
        result.width = validate_non_negative(size.width, 'plot.rect: size.width')
    }

    if (size.height !== undefined) {
        result.height = validate_non_negative(size.height, 'plot.rect: size.height')
    }

    if (result.width === undefined && result.height === undefined) {
        return undefined
    }
    return result
}

/**
 * Normalize the offset arg into a per-axis pixel shift.
 * @param offset - the offset arg ({ x?, y? }, or undefined)
 * @returns the per-axis pixel offset, or undefined when none applies
 */
function resolve_offset(offset: RectArgs['offset']): { x?: number; y?: number } | undefined {
    if (offset === undefined) {
        return undefined
    }
    const result: { x?: number; y?: number } = {}

    if (offset.x !== undefined) {
        result.x = validate_finite(offset.x, 'plot.rect: offset.x')
    }

    if (offset.y !== undefined) {
        result.y = validate_finite(offset.y, 'plot.rect: offset.y')
    }

    if (result.x === undefined && result.y === undefined) {
        return undefined
    }
    return result
}

/**
 * Reject args that contradict `span`. A spanned axis gets its extent from the plot, so data or a pixel size on
 * that side describes a different rect than the one the caller asked for.
 * @param args - the rect series args
 * @param span - the spanned axis, or undefined
 */
function validate_span(args: RectArgs, span: 'x' | 'y' | undefined): void {
    if (span === undefined) {
        return
    }
    const corner = span === 'x' ? 'x2' : 'y2'
    const dimension = span === 'x' ? 'width' : 'height'
    const conflicts: string[] = []

    if (args[span] !== undefined) {
        conflicts.push(span)
    }

    if (args[corner] !== undefined) {
        conflicts.push(corner)
    }
    const size_conflict = spanned_size_conflict(args.size, dimension)

    if (size_conflict !== undefined) {
        conflicts.push(size_conflict)
    }

    if (conflicts.length === 0) {
        return
    }
    const fields = conflicts.join(', ')
    throw new Error(`plot.rect: span: '${span}' fills the whole ${span} axis, so ${fields} can't apply. Drop ${fields}, or drop span and place the rect on ${span} yourself.`)
}

/**
 * The `size` conflict for a spanned axis, if any. A bare number sizes both axes, so it clashes even when the
 * caller only meant the other one.
 * @param size - the size arg
 * @param dimension - the spanned axis' dimension
 * @returns the conflicting field, for the error message, or undefined
 */
function spanned_size_conflict(size: RectArgs['size'], dimension: 'width' | 'height'): string | undefined {
    if (typeof size === 'number') {
        return `size (a bare number sizes both axes; pass { ${dimension === 'width' ? 'height' : 'width'} } for the other one)`
    }

    if (size?.[dimension] !== undefined) {
        return `size.${dimension}`
    }
    return undefined
}

/**
 * Enforce the rect rules for one axis: a categorical axis fills the band (no corner) unless a size
 * overrides it with a centered pixel size; a numeric axis sets its span with exactly one of an opposite
 * corner or a center-mode size.
 * @param axis - axis side, for messages
 * @param corner - the opposite-corner field name, for messages
 * @param mode - the first column's detected type
 * @param has_corner - whether the opposite corner was provided
 * @param corner_mode - the opposite corner's detected type
 * @param has_size - whether a center-mode size (width/height) applies to this axis
 */
function validate_rect_axis(axis: 'x' | 'y', corner: 'x2' | 'y2', mode: string, has_corner: boolean, corner_mode: string, has_size: boolean): void {
    const dimension = axis === 'x' ? 'width' : 'height'

    if (mode === 'categorical') {
        if (has_corner) {
            throw new Error(`plot.rect: ${axis} is categorical, so the rect fills the band; drop ${corner}.`)
        }

        return
    }

    if (has_corner && has_size) {
        throw new Error(`plot.rect: numeric ${axis} got both ${corner} and a size ${dimension}; use one (a data span or a centered pixel size).`)
    }

    if (!has_corner && !has_size) {
        throw new Error(`plot.rect: numeric ${axis} needs ${corner} (a data span) or a size ${dimension} (a centered pixel size).`)
    }

    if (has_corner && corner_mode === 'categorical') {
        throw new Error(`plot.rect: ${corner} must be numeric to pair with ${axis}.`)
    }
}

/**
 * The rect's data extent per axis: a numeric axis spans x..x2 (so the domain must cover both corners),
 * a categorical axis falls back to its band indices (unused, the band scale owns its layout).
 * @param series - the rect series
 * @returns the [min, max] per axis
 */
export function rect_domain_extent(series: RectSeries): { x: [number, number]; y: [number, number] } {
    return {
        x: span_extent(series.x, series.x2),
        y: span_extent(series.y, series.y2),
    }
}

/**
 * The [min, max] across a column and its optional opposite corner.
 * @param lo - the first corner per row
 * @param hi - the opposite corner per row, or undefined
 * @returns the combined extent
 */
function span_extent(lo: Float64Array, hi: Float64Array | undefined): [number, number] {
    const [lo_min, lo_max] = array_extent(lo)

    if (hi === undefined) {
        return [lo_min, lo_max]
    }
    const [hi_min, hi_max] = array_extent(hi)
    return [Math.min(lo_min, hi_min), Math.max(lo_max, hi_max)]
}

function unconstrained_column(length: number): ResolvedColumn {
    return { values: new Float64Array(length).fill(NaN), mode: 'undecided', categories: null }
}

export type ResolvedRectColumns = {
    x1: Float64Array
    y1: Float64Array
    x2?: Float64Array
    y2?: Float64Array
    x_mode: ColumnMode
    y_mode: ColumnMode
    x2_mode: ColumnMode
    y2_mode: ColumnMode
    x_categories: string[] | null
    y_categories: string[] | null
}

/**
 * Resolve a rect series' columns: x / y always, plus the optional opposite corners x2 / y2. Each column
 * gets its own type detection; the factory enforces the rect rules (a corner must be numeric, a
 * categorical axis carries no corner).
 * @param data - the data rows
 * @param x_arg - x (first corner / band) field name or accessor
 * @param x2_arg - x2 (opposite corner) field name or accessor, or undefined
 * @param y_arg - y field name or accessor
 * @param y2_arg - y2 field name or accessor, or undefined
 * @param error_prefix - label prefixed to thrown errors
 * @param x_defaulted - whether x fell back to the default field name
 * @param y_defaulted - whether y fell back to the default field name
 * @returns the resolved arrays plus per-column mode and categories
 */
export function resolve_rect_columns(
    data: Record<string, unknown>[],
    x_arg: FieldArg | undefined,
    x2_arg: FieldArg | undefined,
    y_arg: FieldArg | undefined,
    y2_arg: FieldArg | undefined,
    error_prefix: string,
    x_defaulted: boolean,
    y_defaulted: boolean,
): ResolvedRectColumns {
    if (data.length > 0) {
        if (x_arg !== undefined) {
            validate_field_present(data[0], x_arg, x_defaulted, error_prefix, 'x')
        }

        if (y_arg !== undefined) {
            validate_field_present(data[0], y_arg, y_defaulted, error_prefix, 'y')
        }

        if (x2_arg !== undefined) {
            validate_field_present(data[0], x2_arg, false, error_prefix, 'x2')
        }

        if (y2_arg !== undefined) {
            validate_field_present(data[0], y2_arg, false, error_prefix, 'y2')
        }
    }
    const x = x_arg === undefined ? unconstrained_column(data.length) : resolve_column(data, x_arg, error_prefix, 'x')
    const y = y_arg === undefined ? unconstrained_column(data.length) : resolve_column(data, y_arg, error_prefix, 'y')
    const x2 = x2_arg === undefined ? undefined : resolve_column(data, x2_arg, error_prefix, 'x2')
    const y2 = y2_arg === undefined ? undefined : resolve_column(data, y2_arg, error_prefix, 'y2')
    return {
        x1: x.values,
        y1: y.values,
        x2: x2?.values,
        y2: y2?.values,
        x_mode: x.mode,
        y_mode: y.mode,
        x2_mode: x2?.mode ?? 'undecided',
        y2_mode: y2?.mode ?? 'undecided',
        x_categories: x.categories,
        y_categories: y.categories,
    }
}
