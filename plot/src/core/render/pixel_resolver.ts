import type { Scale } from "../types"

/**
 * Build a value-to-pixel resolver, hoisting the band-vs-linear branch out of the caller's loop.
 * Band returns undefined for unknown categories so the caller can skip.
 * @param scale - the axis scale
 * @param values - the series values for that axis
 * @returns a resolver mapping row index to a pixel position, or undefined to skip
 */
export function pixel_resolver(scale: Scale, values: Float64Array): (i: number) => number | undefined {
    if ('bandwidth' in scale) {
        const half = scale.bandwidth() / 2
        return (i) => {
            const value = scale(values[i])
            return value === undefined ? undefined : value + half
        }
    }
    return (i) => scale(values[i])
}
