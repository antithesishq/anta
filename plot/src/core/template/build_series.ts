import type { Series, ThemeColor } from "../types"

// This file remaps band indices (if applicabble), drops rows with unknown categories, and strips
// internal *_categories and *_axis_kind fields.

/**
 * Remap each series' band indices to canonical order, drop unknown-category rows
 * @param input - the input series
 * @param x_translations - per-series x translation tables, or undefined
 * @param y_translations - per-series y translation tables, or undefined
 * @returns the rebuilt series
 */
export function build_resolved_series(
    input: Series[],
    x_translations: (Int32Array | null)[] | undefined,
    y_translations: (Int32Array | null)[] | undefined,
): Series[] {
    if (x_translations === undefined && y_translations === undefined) {
        return input
    }
    return input.map((series_item, i) => rebuild_series(
        series_item,
        x_translations?.[i] ?? null,
        y_translations?.[i] ?? null,
    ))
}

/**
 * Rebuild one series. Fast-paths to the input unchanged when there's no remap and nothing to strip.
 * @param series_item - the series to rebuild
 * @param x_translation - x translation table, or null for no remap
 * @param y_translation - y translation table, or null for no remap
 * @returns the rebuilt series
 */
function rebuild_series(
    series_item: Series,
    x_translation: Int32Array | null,
    y_translation: Int32Array | null,
): Series {
    // null translation plus categorical means local matched prefix, still need to strip
    const has_categories = series_item.x_axis_kind === 'categorical' || series_item.y_axis_kind === 'categorical'

    if (x_translation === null && y_translation === null && !has_categories) {
        return series_item
    }
    const remapped = remap_rows(series_item, x_translation, y_translation)
    return assemble_output_series(series_item, remapped)
}

// walk rows, drop -1 hits, copy survivors. Arrays trimmed only when rows dropped.
type RemappedBuffers = {
    x: Float64Array
    y: Float64Array
    x2?: Float64Array
    y2?: Float64Array
    colors?: (ThemeColor | null)[]
    sizes?: (number | null)[]
    rows?: Record<string, unknown>[]
    labels?: string[]
}

/**
 * Walk the rows, drop unknown-category hits (-1), and copy survivors. Buffers are trimmed only when rows were dropped.
 * @param series_item - the source series
 * @param x_translation - x translation table, or null
 * @param y_translation - y translation table, or null
 * @returns the remapped x/y (and any x2/y2, colors, sizes, rows, labels) buffers
 */
function remap_rows(
    series_item: Series,
    x_translation: Int32Array | null,
    y_translation: Int32Array | null,
): RemappedBuffers {
    const length = series_item.x.length
    const buffer_x = new Float64Array(length)
    const buffer_y = new Float64Array(length)
    const input_colors = series_item.colors
    const buffer_colors = input_colors !== undefined ? new Array<ThemeColor | null>(length) : undefined
    const input_sizes = series_item.kind === 'scatter' ? series_item.sizes : undefined
    const buffer_sizes = input_sizes !== undefined ? new Array<number | null>(length) : undefined

    const input_x2 = 'x2' in series_item ? series_item.x2 : undefined
    const input_y2 = 'y2' in series_item ? series_item.y2 : undefined
    const buffer_x2 = input_x2 !== undefined ? new Float64Array(length) : undefined
    const buffer_y2 = input_y2 !== undefined ? new Float64Array(length) : undefined

    const input_rows = series_item.rows
    const buffer_rows = input_rows !== undefined ? new Array<Record<string, unknown>>(length) : undefined
    const input_labels = series_item.labels
    const buffer_labels = input_labels !== undefined ? new Array<string>(length) : undefined

    let write_index = 0

    for (let row_index = 0; row_index < length; row_index++) {
        const translated_x = x_translation !== null ? x_translation[series_item.x[row_index]] : series_item.x[row_index]
        const translated_y = y_translation !== null ? y_translation[series_item.y[row_index]] : series_item.y[row_index]

        // -1 marks unknown category, only meaningful when a translation table exists
        if ((x_translation !== null && translated_x === -1) || (y_translation !== null && translated_y === -1)) {
            continue
        }
        buffer_x[write_index] = translated_x
        buffer_y[write_index] = translated_y

        if (buffer_colors !== undefined) {
            buffer_colors[write_index] = input_colors![row_index]
        }

        if (buffer_sizes !== undefined) {
            buffer_sizes[write_index] = input_sizes![row_index]
        }

        if (buffer_x2 !== undefined) {
            buffer_x2[write_index] = input_x2![row_index]
        }

        if (buffer_y2 !== undefined) {
            buffer_y2[write_index] = input_y2![row_index]
        }

        if (buffer_rows !== undefined) {
            buffer_rows[write_index] = input_rows![row_index]
        }

        if (buffer_labels !== undefined) {
            buffer_labels[write_index] = input_labels![row_index]
        }
        write_index++
    }
    // trim only when rows were dropped, otherwise pass the full buffer through
    const full = write_index === length
    const result: RemappedBuffers = {
        x: full ? buffer_x : buffer_x.slice(0, write_index),
        y: full ? buffer_y : buffer_y.slice(0, write_index),
    }

    if (buffer_colors !== undefined) {
        result.colors = full ? buffer_colors : buffer_colors.slice(0, write_index)
    }

    if (buffer_sizes !== undefined) {
        result.sizes = full ? buffer_sizes : buffer_sizes.slice(0, write_index)
    }

    if (buffer_x2 !== undefined) {
        result.x2 = full ? buffer_x2 : buffer_x2.slice(0, write_index)
    }

    if (buffer_y2 !== undefined) {
        result.y2 = full ? buffer_y2 : buffer_y2.slice(0, write_index)
    }

    if (buffer_rows !== undefined) {
        result.rows = full ? buffer_rows : buffer_rows.slice(0, write_index)
    }

    if (buffer_labels !== undefined) {
        result.labels = full ? buffer_labels : buffer_labels.slice(0, write_index)
    }
    return result
}

/**
 * Build the output series: carry over kind and public fields, re-attach the remapped row buffers, and drop the pipeline-internal *_axis_kind / *_categories / *_field (canonical info lives on the AxisTemplate). Kind-agnostic, so a new series type needs no branch here.
 * @param series_item - the source series
 * @param remapped - the remapped buffers
 * @returns the output series
 */
function assemble_output_series(series_item: Series, remapped: RemappedBuffers): Series {
    const output: Series = { ...series_item, x: remapped.x, y: remapped.y }
    delete output.x_axis_kind
    delete output.y_axis_kind
    delete output.x_categories
    delete output.y_categories
    delete output.x_field
    delete output.y_field

    // replace the row-aligned buffers with the remapped (trimmed) versions, or drop them when the
    // remap produced none
    if (remapped.colors !== undefined) {
        output.colors = remapped.colors
    } else {
        delete output.colors
    }

    if (output.kind === 'scatter') {
        if (remapped.sizes !== undefined) {
            output.sizes = remapped.sizes
        } else {
            delete output.sizes
        }
    }

    if ('x2' in output && remapped.x2 !== undefined) {
        output.x2 = remapped.x2
    }

    if ('y2' in output && remapped.y2 !== undefined) {
        output.y2 = remapped.y2
    }

    if (remapped.rows !== undefined) {
        output.rows = remapped.rows
    }

    if (remapped.labels !== undefined) {
        output.labels = remapped.labels
    }
    return output
}
