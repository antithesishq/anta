export type BandDuplicates = {
    keep: Int32Array
    repeated: string[]
}

/**
 * The rows to keep when a band value repeats, last row winning, or null when every band appears once.
 * Category indices are untouched, so a band keeps the axis position it earned on first sight.
 * @param band_values - the resolved band column, one entry per row
 * @param row_count - how many rows the series carries
 * @param categories - the band's category labels, indexed by the values in band_values
 * @returns the surviving rows and the repeated category names, or null when there's nothing to drop
 */
export function dedupe_bands(
    band_values: Float64Array,
    row_count: number,
    categories: string[],
): BandDuplicates | null {
    const last_row = new Map<number, number>()
    const rows_per_band = new Map<number, number>()

    for (let row = 0; row < row_count; row++) {
        const band = band_values[row]

        last_row.set(band, row)
        rows_per_band.set(band, (rows_per_band.get(band) ?? 0) + 1)
    }

    if (last_row.size === row_count) {
        return null
    }
    const keep = new Int32Array(last_row.size)
    const repeated: string[] = []
    let next = 0

    for (let row = 0; row < row_count; row++) {
        const band = band_values[row]

        if (last_row.get(band) !== row) {
            continue
        }
        keep[next] = row
        next++
    }

    // report in category order so the message is stable regardless of row order
    for (let band = 0; band < categories.length; band++) {
        const rows = rows_per_band.get(band) ?? 0

        if (rows > 1) {
            repeated.push(categories[band])
        }
    }
    return { keep, repeated }
}

/**
 * Warn that repeated bands collapsed to their last row. Dropping is deliberate rather than an error: the
 * earlier rows were already painted over, so this makes the data agree with the picture.
 * @param repeated - the repeated category names
 * @param error_prefix - label prefixed to the message
 */
export function warn_dropped_bands(repeated: string[], error_prefix: string): void {
    const noun = repeated.length === 1 ? 'category' : 'categories'
    const list = repeated.map(category => `'${category}'`).join(', ')

    console.warn(`${error_prefix}: band ${noun} on more than one row: ${list} — only the last row for each is drawn, since later rows paint over earlier ones. Pre-aggregate the data if you meant to combine them.`)
}

/**
 * Pick the kept rows out of a resolved column.
 * @param values - the full column, one entry per row
 * @param keep - the surviving row indices
 * @returns a column holding just the kept rows
 */
export function compact_column(values: Float64Array, keep: Int32Array): Float64Array {
    const compacted = new Float64Array(keep.length)

    for (let i = 0; i < keep.length; i++) {
        compacted[i] = values[keep[i]]
    }
    return compacted
}
