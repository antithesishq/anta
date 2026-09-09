import type { BandScale, ComposedBar, ComposedSeries, NumericalScale, Scale, BarPixelSpan } from "../../types"

// Smallest a non-zero bar draws, so a value that maps to a sub-pixel extent stays visible. Per-series `min_size` overrides it.
const DEFAULT_MIN_BAR_SIZE = 2

export type BarAxes = {
    is_vertical: boolean
    band_scale: BandScale
    value_scale: NumericalScale
    bands: Float64Array
    values: Float64Array
}

/**
 * Resolve which side of a bar series is the band. The band axis is the one with a band scale, which plot.ts
 * guarantees is exactly one of the two.
 * @param series - the composed bar series
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @returns the band / value scales and columns
 */
export function bar_axes(series: ComposedBar, x_scale: Scale, y_scale: Scale): BarAxes {
    if ('bandwidth' in x_scale) {
        return {
            is_vertical: true,
            band_scale: x_scale,
            // a non-band axis is still linear | log | time in the union, and only a bar's value axis reaches here
            value_scale: y_scale as NumericalScale,
            bands: series.x,
            values: series.y,
        }
    }

    return {
        is_vertical: false,
        band_scale: y_scale as BandScale,
        value_scale: x_scale as NumericalScale,
        bands: series.y,
        values: series.x,
    }
}

/**
 * Attach a bar series' value-axis layout, so the paint, hit-test and hover halo all read the same pixels.
 * Runs once per compose, where the scales are built.
 * @param series - the color-resolved bar series
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @returns the series with its value_span filled in
 */
export function compose_bar_layout<TooltipContent>(series: ComposedBar<TooltipContent>, x_scale: Scale, y_scale: Scale): ComposedSeries<TooltipContent> {
    return { ...series, value_span: bar_value_span(series, bar_axes(series, x_scale, y_scale)) }
}

/**
 * The value-axis layout to draw a bar series with: the one compose already built, or a fresh pass for a series
 * that reached the renderer without going through compose.
 * @param series - the composed bar series
 * @param axes - the series' resolved band / value axes
 * @returns the series' value span
 */
export function series_value_span(series: ComposedBar, axes: BarAxes): BarPixelSpan {
    return series.value_span ?? bar_value_span(series, axes)
}

/**
 * Lay a bar series out along the value axis, in pixels. Each mark is sized first — its own size, floored at
 * `min_size`, with zero left at zero — and a stack then places its segments by adding those drawn sizes up from
 * the value baseline, on one running total per side of zero. Sizing before placing is what keeps a floored
 * segment from being painted over by the one above it, and keeps the two directions independent.
 * @param series - the composed bar series
 * @param axes - the series' resolved band / value axes
 * @returns the baseline and tip pixel of every mark, index-parallel with the series columns
 */
function bar_value_span(series: ComposedBar, axes: BarAxes): BarPixelSpan {
    const { value_scale: linear_scale, values, bands } = axes
    const baseline = new Float64Array(values.length)
    const tip = new Float64Array(values.length)
    const min_size = Math.max(series.min_size ?? DEFAULT_MIN_BAR_SIZE, 0)
    const origin = value_origin(series, linear_scale)
    const is_stacked = series.stack_base !== undefined
    let positive_total = 0
    let negative_total = 0

    for (let i = 0; i < values.length; i++) {
        // a stack is contiguous marks sharing one band (bands are deduped, so no two stacks share one), so a
        // new band value starts both running totals over
        if (i === 0 || bands[i] !== bands[i - 1]) {
            positive_total = 0
            negative_total = 0
        }
        const value = values[i]
        const raw = raw_span(series, i, linear_scale, value, origin)
        // pixels grow downward, so the raw tip's own sign is which way this mark grows
        const direction = raw.tip <= raw.baseline ? -1 : 1
        const size = value === 0 ? 0 : Math.max(Math.abs(raw.tip - raw.baseline), min_size)
        const stacked_below = stacked_offset(is_stacked, value, positive_total, negative_total)

        baseline[i] = origin + direction * stacked_below
        tip[i] = baseline[i] + direction * size

        if (value < 0) {
            negative_total += size
            continue
        }
        positive_total += size
    }

    return { baseline, tip }
}

/**
 * How far a mark starts from the value baseline: the drawn sizes of the segments below it on its own side of
 * zero. Only a stack piles up — a plain bar always starts at the baseline.
 * @param is_stacked - whether the series carries stack offsets
 * @param value - the mark's value, for which side of zero it stacks on
 * @param positive_total - the drawn size of the positive segments so far in this stack
 * @param negative_total - the drawn size of the negative segments so far in this stack
 * @returns the offset from the baseline, in pixels
 */
function stacked_offset(is_stacked: boolean, value: number, positive_total: number, negative_total: number): number {
    if (!is_stacked) {
        return 0
    }
    return value < 0 ? negative_total : positive_total
}

// The pixel a stack grows from: the value axis' zero, or the low end of the domain on a log axis, which has no zero.
function value_origin(series: ComposedBar, linear_scale: NumericalScale): number {
    const is_log = 'base' in linear_scale

    if (is_log && series.stack_base === undefined) {
        return linear_scale(linear_scale.domain()[0])
    }
    return linear_scale(0)
}

// What a mark would span with no minimum applied. A stacked segment is measured at its own place in the stack,
// so a non-linear scale sizes it where it actually sits; a plain bar is measured from the axis baseline.
function raw_span(
    series: ComposedBar,
    i: number,
    linear_scale: NumericalScale,
    value: number,
    origin: number,
): { baseline: number; tip: number } {
    const stack_base = series.stack_base

    if (stack_base === undefined) {
        return { baseline: origin, tip: linear_scale(value) }
    }
    const start = stack_base[i]

    return { baseline: linear_scale(start), tip: linear_scale(start + value) }
}
