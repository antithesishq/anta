// per-column type detection shared by series factories. A column must be uniformly numeric
// or uniformly categorical, mixing throws on the first conflicting row. resolve_xy_columns is the
// common two-column convenience; a series needing a different column shape composes the exported
// primitives (make_column_resolver, validate_field_present) in its own directory.

import type { AxisKind, FieldArg } from "../types"

export type ColumnMode = 'undecided' | 'numeric' | 'categorical'

type SeriesColumnFields = {
    x_axis_kind?: AxisKind
    y_axis_kind?: AxisKind
    x_categories?: string[]
    y_categories?: string[]
    x_field?: string
    y_field?: string
}

type ResolvedColumns = {
    x: Float64Array
    y: Float64Array
} & ResolvedColumnMeta

export type ResolvedColumnMeta = {
    x_mode: ColumnMode
    y_mode: ColumnMode
    x_categories: string[] | null
    y_categories: string[] | null
}

export type ColumnResolver = {
    resolve(value: unknown, row: number, field: string): number
    mode(): ColumnMode
    categories(): string[] | null
}

export type ResolvedColumn = {
    values: Float64Array
    mode: ColumnMode
    categories: string[] | null
}

/**
 * Read a field off a row by name or (row, index) accessor.
 * @param arg - field name or accessor
 * @param row - the data row
 * @param index - the row index
 * @returns the raw cell value
 */
export function read_field(arg: FieldArg, row: Record<string, unknown>, index: number): unknown {
    return typeof arg === 'function' ? arg(row, index) : row[arg]
}

/**
 * Resolve one column to an aligned Float64Array plus its detected mode and categories. The shared per-column
 * primitive: series factories that need more than the x/y pair (e.g. rect's corners) compose this directly.
 * @param data - the data rows
 * @param arg - field name or accessor
 * @param error_prefix - label prefixed to thrown errors
 * @param fallback_label - error-message label used when arg is an accessor (not a field name)
 * @returns the resolved values plus mode and categories
 */
export function resolve_column(
    data: Record<string, unknown>[],
    arg: FieldArg,
    error_prefix: string,
    fallback_label: string,
): ResolvedColumn {
    const length = data.length
    const values = new Float64Array(length)
    const resolver = make_column_resolver(error_prefix)
    // keep the field name in error messages when given, else the caller's fallback
    const label = typeof arg === 'string' ? arg : fallback_label

    for (let i = 0; i < length; i++) {
        values[i] = resolver.resolve(read_field(arg, data[i], i), i, label)
    }
    return { values, mode: resolver.mode(), categories: resolver.categories() }
}

/**
 * Walk the rows and resolve x/y into aligned Float64Arrays, returning each column's mode and categories.
 * @param data - the data rows
 * @param x_arg - x field name or accessor
 * @param y_arg - y field name or accessor
 * @param error_prefix - label prefixed to thrown errors
 * @param x_defaulted - whether x fell back to the default field name
 * @param y_defaulted - whether y fell back to the default field name
 * @returns the resolved x/y arrays plus per-column mode and categories
 */
export function resolve_xy_columns(
    data: Record<string, unknown>[],
    x_arg: FieldArg,
    y_arg: FieldArg,
    error_prefix: string,
    x_defaulted: boolean,
    y_defaulted: boolean,
): ResolvedColumns {
    if (data.length > 0) {
        validate_field_present(data[0], x_arg, x_defaulted, error_prefix, 'x')
        validate_field_present(data[0], y_arg, y_defaulted, error_prefix, 'y')
    }
    const x = resolve_column(data, x_arg, error_prefix, 'x')
    const y = resolve_column(data, y_arg, error_prefix, 'y')
    return {
        x: x.values,
        y: y.values,
        x_mode: x.mode,
        y_mode: y.mode,
        x_categories: x.categories,
        y_categories: y.categories,
    }
}

/**
 * Attach resolved column metadata (axis kind, categories, source field name) onto a freshly built series, mutating it in place. Shared by series factories so the gated-attach pattern lives in one place.
 * @param series - the series under construction
 * @param resolved - the resolved column metadata (modes and categories)
 * @param x_arg - x field name or accessor
 * @param y_arg - y field name or accessor
 */
export function attach_resolved_columns(
    series: SeriesColumnFields,
    resolved: ResolvedColumnMeta,
    x_arg: FieldArg | undefined,
    y_arg: FieldArg | undefined,
): void {
    if (resolved.x_mode !== 'undecided') {
        series.x_axis_kind = resolved.x_mode
    }

    if (resolved.y_mode !== 'undecided') {
        series.y_axis_kind = resolved.y_mode
    }

    if (resolved.x_categories !== null) {
        series.x_categories = resolved.x_categories
    }

    if (resolved.y_categories !== null) {
        series.y_categories = resolved.y_categories
    }

    if (typeof x_arg === 'string') {
        series.x_field = x_arg
    }

    if (typeof y_arg === 'string') {
        series.y_field = y_arg
    }
}

/**
 * Up-front check on row 0 for string field args, catching forgotten x/y and typo'd field names.
 * @param row - the first data row
 * @param arg - the field name or accessor
 * @param defaulted - whether the field name was defaulted
 * @param error_prefix - label prefixed to the error
 * @param slot - which axis slot, for the message
 */
export function validate_field_present(
    row: Record<string, unknown>,
    arg: FieldArg,
    defaulted: boolean,
    error_prefix: string,
    slot: string,
): void {
    if (typeof arg !== 'string') {
        return
    }

    if (arg in row) {
        return
    }
    const available = Object.keys(row)
        .filter(k => typeof row[k] === 'number' || typeof row[k] === 'string')
        .sort()
    const available_str = available.length > 0 ? available.map(f => `'${f}'`).join(', ') : '(none)'
    const reason = defaulted
        ? `${slot} defaulted to '${arg}' (no ${slot} arg passed) but row 0 has no '${arg}' field`
        : `${slot}: '${arg}' but row 0 has no '${arg}' field`

    throw new Error(`${error_prefix}: ${reason}. Available numeric/string fields: ${available_str}.`)
}

/**
 * Build a per-column resolver that assigns each distinct category an index and enforces a uniform numeric-or-categorical type.
 * @param error_prefix - label prefixed to thrown errors
 * @returns a resolver with resolve, mode, and categories accessors
 */
export function make_column_resolver(error_prefix: string): ColumnResolver {
    let mode: ColumnMode = 'undecided'
    const string_map = new Map<string, number>()
    const categories: string[] = []
    return {
        resolve(value, row, field) {
            if (typeof value === 'string') {
                // strings don't mix with numeric
                if (mode === 'numeric') {
                    throw new Error(`${error_prefix}: row ${row} field '${field}' is a string but earlier rows were numeric (a column must be uniformly one type)`)
                }

                // first string sets categorical mode
                mode = 'categorical'
                let index = string_map.get(value)

                // assign the next index to each new category on first sight
                if (index === undefined) {
                    index = categories.length
                    categories.push(value)
                    string_map.set(value, index)
                }
                return index
            }

            if (typeof value === 'number' && Number.isFinite(value)) {
                if (mode === 'categorical') {
                    throw new Error(`${error_prefix}: row ${row} field '${field}' is a number but earlier rows were strings (a column must be uniformly one type)`)
                }
                mode = 'numeric'
                return value
            }
            throw new Error(`${error_prefix}: row ${row} field '${field}' is not a finite number or a string (got ${format_bad_value(value)})`)
        },
        mode() {
            return mode
        },
        categories() {
            return mode === 'categorical' ? categories : null
        },
    }
}

/**
 * Format a rejected cell value for an error message.
 * @param value - the offending value
 * @returns a short human-readable description
 */
function format_bad_value(value: unknown): string {
    if (value === undefined) {
        return 'undefined'
    }

    if (typeof value === 'number') {
        return String(value)
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- TODO: fix when next touching this code
        return JSON.stringify(value) ?? `<${typeof value}>`
    } catch {
        return `<${typeof value}>`
    }
}
