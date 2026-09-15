import { resolve_column } from "../../template/column"
import { is_theme_color, resolve_color_arg } from "../../template/color"
import { dedupe_bands, warn_dropped_bands } from "./duplicates"
import type { ColorArg, FieldArg, ThemeColor } from "../../types"

export type StackColorArg = ColorArg | ThemeColor[]

// side-agnostic: the caller assigns band / value to x / y depending on which side carried the array
export type ExpandedStack = {
    band: Float64Array // the band axis column: category indices, repeated once per segment
    value: Float64Array // the value axis column: each segment's own value
    stack_base: Float64Array // per-mark running offset on the value axis: where this segment starts
    is_tip: Uint8Array // 1 when the mark is the outermost non-zero segment of its band, per direction
    labels: string[] // per-mark source field name, for the tooltip
    rows: Record<string, unknown>[] // the band's original row, repeated once per segment
    categories: string[]
}

/**
 * Expand wide-form stacked input into flat per-segment columns. Positive segments stack up from zero and
 * negative segments stack down, each on its own running offset, so a row can carry both directions.
 * @param data - the data rows, one per band
 * @param band_arg - the band axis field name or accessor
 * @param band_side - which axis is the band; the other side carries the values
 * @param value_fields - the per-segment value field names, in stacking order
 * @param error_prefix - label prefixed to thrown errors
 * @returns the flattened per-mark columns plus the band categories
 */
export function expand_stack(
    data: Record<string, unknown>[],
    band_arg: FieldArg,
    band_side: 'x' | 'y',
    value_fields: string[],
    error_prefix: string,
): ExpandedStack {
    const value_side = band_side === 'x' ? 'y' : 'x'

    if (value_fields.length === 0) {
        throw new Error(`${error_prefix}: ${value_side} is an empty array. Stacked bars need at least one value field name, e.g. ${value_side}: ['pass', 'fail'].`)
    }

    const band = resolve_column(data, band_arg, error_prefix, band_side)
    const band_label = typeof band_arg === 'string' ? band_arg : band_side

    // empty data exposes no column type to detect; an empty series renders bare chrome
    if (data.length > 0 && band.mode !== 'categorical') {
        throw new Error(`${error_prefix}: ${value_side} is an array of value fields (stacked bars), so ${band_side} ('${band_label}') must be a categorical band axis, but it resolved to numbers. Pass string values on ${band_side}.`)
    }

    const categories = band.categories ?? []

    const duplicates = dedupe_bands(band.values, data.length, categories)

    if (duplicates !== null) {
        warn_dropped_bands(duplicates.repeated, error_prefix)
    }
    const kept_rows = duplicates === null ? null : duplicates.keep
    const stack_count = kept_rows === null ? data.length : kept_rows.length
    const segment_count = value_fields.length
    // one entry per drawn rectangle, not per row: every stack contributes segment_count of them
    const mark_count = stack_count * segment_count
    const band_column = new Float64Array(mark_count)
    const value_column = new Float64Array(mark_count)
    const stack_base = new Float64Array(mark_count)
    const is_tip = new Uint8Array(mark_count)
    const labels: string[] = new Array(mark_count)
    const rows: Record<string, unknown>[] = new Array(mark_count)

    for (let stack = 0; stack < stack_count; stack++) {
        const row_index = kept_rows === null ? stack : kept_rows[stack]
        const row = data[row_index]
        let positive_offset = 0
        let negative_offset = 0
        let positive_tip = -1 // mark the index of the tip in case we need to apply border radius
        let negative_tip = -1

        for (let segment = 0; segment < segment_count; segment++) {
            const field = value_fields[segment]
            const value = read_segment_value(row, field, row_index, error_prefix)
            const mark = stack * segment_count + segment // flatten the (stack, segment) grid into the per-mark columns

            band_column[mark] = band.values[row_index]
            value_column[mark] = value
            labels[mark] = field
            rows[mark] = row

            if (value < 0) {
                stack_base[mark] = negative_offset
                negative_offset += value
                negative_tip = mark
                continue
            }
            stack_base[mark] = positive_offset
            positive_offset += value

            if (value > 0) {
                positive_tip = mark
            }
        }

        if (positive_tip >= 0) {
            is_tip[positive_tip] = 1
        }

        if (negative_tip >= 0) {
            is_tip[negative_tip] = 1
        }
    }

    return { band: band_column, value: value_column, stack_base, is_tip, labels, rows, categories }
}

/**
 * Resolve a color per stacked mark. A per-row `color` field wins and paints that band's whole stack; then
 * a positional array pairs one color to each value field; then an accessor, which receives the row and the
 * segment index. A single ThemeColor stays uniform and needs no per-mark array.
 * @param rows - the expanded per-mark rows (the band's row, repeated once per segment)
 * @param segment_count - how many segments each band carries
 * @param arg - the caller's color arg
 * @param value_side - the axis carrying the value fields, for the error message
 * @param error_prefix - label prefixed to thrown errors
 * @returns the uniform color and / or the per-mark colors to attach to the series
 */
export function resolve_stack_colors(
    rows: Record<string, unknown>[],
    segment_count: number,
    arg: StackColorArg | undefined,
    value_side: 'x' | 'y',
    error_prefix: string,
): { color?: ThemeColor; colors?: (ThemeColor | null)[] } {

    if (Array.isArray(arg) && arg.length !== segment_count) {
        throw new Error(`${error_prefix}: color has ${arg.length} ${arg.length === 1 ? 'entry' : 'entries'} but ${value_side} names ${segment_count} stacked value fields. A color array needs one entry per segment, in the same order.`)
    }

    const has_per_row = rows.some(row => is_theme_color(row.color))
    const varies_per_mark = has_per_row || Array.isArray(arg) || typeof arg === 'function'
    const uniform = is_theme_color(arg) ? arg : undefined
    const result: { color?: ThemeColor; colors?: (ThemeColor | null)[] } = {}

    if (varies_per_mark) {
        const colors = new Array<ThemeColor | null>(rows.length)

        for (let mark = 0; mark < rows.length; mark++) {
            const row = rows[mark]

            // the mark's position within its band's block is the segment it came from
            const segment = mark % segment_count
            const per_row = is_theme_color(row.color) ? row.color : undefined

            colors[mark] = per_row ?? segment_color(arg, row, segment) ?? null
        }
        result.colors = colors
    }

    if (uniform !== undefined) {
        result.color = uniform
    }
    return result
}

// One segment's color from the series-level arg: positional for an array, otherwise the shared accessor /
// uniform path with the segment index standing in for the row index.
function segment_color(
    arg: StackColorArg | undefined,
    row: Record<string, unknown>,
    segment: number,
): ThemeColor | undefined {
    if (Array.isArray(arg)) {
        const value = arg[segment]
        return is_theme_color(value) ? value : undefined
    }
    return resolve_color_arg(arg, row, segment)
}

// One segment's value. An absent field stacks as 0 (sparse rows are the norm); anything else non-numeric
// is a data error, so null / NaN / strings throw rather than silently vanishing.
function read_segment_value(
    row: Record<string, unknown>,
    field: string,
    row_index: number,
    error_prefix: string,
): number {
    const raw = row[field]

    if (raw === undefined) {
        // default to 0 value for missing fields
        return 0
    }

    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return raw
    }
    throw new Error(`${error_prefix}: row ${row_index} field '${field}' must be a finite number for a stacked segment; got ${describe_value(raw)}. Omit the field to stack it as 0.`)
}

// Short description of a rejected cell value, for the error message.
function describe_value(raw: unknown): string {
    if (raw === null) {
        return 'null'
    }

    if (typeof raw === 'number') {
        return String(raw)
    }
    return `a ${typeof raw}`
}
