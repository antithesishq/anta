/**
 * The [min, max] of a numeric column, or [Infinity, -Infinity] when empty.
 * NaN values naturally do not affect the result.
 * @param values - the column values
 * @returns the column extent
 */
export function array_extent(values: Float64Array): [number, number] {
    let min = Infinity, max = -Infinity

    for (const value of values) {
        if (value < min) {
            min = value
        }

        if (value > max) {
            max = value
        }
    }
    return [min, max]
}

type XYColumns = {
    x: Float64Array
    y: Float64Array
}

/**
 * The extent of a series that occupies just its x / y points.
 * @param series - an object containing resolved x and y columns
 * @returns the [min, max] per axis
 */
export function xy_extent(series: XYColumns): { x: [number, number]; y: [number, number] } {
    return {
        x: array_extent(series.x),
        y: array_extent(series.y),
    }
}
