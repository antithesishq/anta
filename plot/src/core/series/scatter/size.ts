import type { ComposedScatter, ViewportChange } from '../../types'
import { validate_non_negative } from '../../template/validate'

/** Resolve once per composition so drawing, hit testing, and highlights share pixel sizes. */
export function resolve_scatter_sizes<T>(series: ComposedScatter<T>, viewport: ViewportChange): ComposedScatter<T> {
    const accessor = series.size_accessor
    if (accessor === undefined) return series
    const sizes = new Array<number | null>(series.x.length)
    for (let i = 0; i < sizes.length; i++) {
        const index = series.size_indices?.[i] ?? i
        sizes[i] = series.sizes?.[i] ?? validate_non_negative(
            accessor(series.rows![i], index, viewport),
            `plot.scatter: size accessor at row ${index}`,
        )
    }
    return { ...series, sizes }
}
