import type { BandScale, ComposedRect, PixelRect, Rect, Scale } from "../../types"
import { make_rect_resolver } from "./paint"

// The band geometry a hit region widens across when that axis fills its hover span.
type BandAxis = { band_scale: BandScale; bands: Float64Array }

/**
 * The rect whose hit region contains the cursor, or null. On overlap the last-drawn rect wins, matching paint
 * order. hover_span_x / hover_span_y widen the region to the whole band on a categorical axis; otherwise only
 * the drawn rect is hittable.
 * @param series - the composed rect series
 * @param cursor - cursor position in canvas pixels
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @param inner - the plot area, which a spanned axis covers edge to edge
 * @returns the point index under the cursor, or null
 */
export function rect_hit_test(series: ComposedRect, cursor: { x: number; y: number }, x_scale: Scale, y_scale: Scale, inner: Rect): number | null {
    // a drawn span already covers the plot area edge to edge, so that axis has nothing left to widen
    const widen_x = series.hover_span_x === true && series.span !== 'x'
    const widen_y = series.hover_span_y === true && series.span !== 'y'
    const rect_at = make_rect_resolver(series, x_scale, y_scale, inner)
    const x_band = widen_x ? band_axis(x_scale, series.x) : null
    const y_band = widen_y ? band_axis(y_scale, series.y) : null

    // last drawn rect wins on overlap, so keep the highest hit index rather than returning early
    let hit: number | null = null

    for (let i = 0; i < series.x.length; i++) {
        const drawn = rect_at(i)

        if (drawn === null) {
            continue
        }
        const rect = hit_region(drawn, i, x_band, y_band)
        const in_x = cursor.x >= rect.left && cursor.x <= rect.left + rect.width
        const in_y = cursor.y >= rect.top && cursor.y <= rect.top + rect.height

        if (in_x && in_y) {
            hit = i
        }
    }

    return hit
}

function band_axis(scale: Scale, bands: Float64Array): BandAxis | null {
    if ('bandwidth' in scale) {
        return { band_scale: scale, bands }
    }
    return null
}

/**
 * The region to hit-test one rect against: its drawn bounds, widened to the whole band on each axis that
 * fills its hover span. Unioning rather than replacing keeps a rect whose `size` overhangs its band hittable
 * over all of what it draws.
 * @param drawn - the rect's drawn bounds
 * @param i - the row index
 * @param x_band - the x band axis, or null when x isn't widened
 * @param y_band - the y band axis, or null when y isn't widened
 * @returns the hit region in canvas pixels
 */
function hit_region(drawn: PixelRect, i: number, x_band: BandAxis | null, y_band: BandAxis | null): PixelRect {
    const x = union_span(drawn.left, drawn.width, band_span(i, x_band))
    const y = union_span(drawn.top, drawn.height, band_span(i, y_band))

    return { left: x.start, top: y.start, width: x.extent, height: y.extent }
}

/**
 * The band one mark fills on an axis, or null where there is nothing to widen to — an axis that isn't
 * widened, or a band value outside the scale's domain.
 * @param i - the row index
 * @param axis - the axis' band geometry, or null
 * @returns the band's two ends, in either order
 */
function band_span(i: number, axis: BandAxis | null): [number, number] | null {
    if (axis === null) {
        return null
    }
    const band_start = axis.band_scale(axis.bands[i])

    if (band_start === undefined) {
        return null
    }
    return [band_start, band_start + axis.band_scale.bandwidth()]
}

/**
 * One axis of a hit region: the drawn span unioned with the band. A band range can run backwards, so its
 * ends are ordered rather than assumed.
 * @param start - the drawn span's low pixel
 * @param extent - the drawn span's pixel extent
 * @param span - the band to union in, or null to leave the drawn span alone
 * @returns the hit span's start and extent
 */
function union_span(start: number, extent: number, span: [number, number] | null): { start: number; extent: number } {
    if (span === null) {
        return { start, extent }
    }
    const low = Math.min(start, span[0], span[1])
    const high = Math.max(start + extent, span[0], span[1])

    return { start: low, extent: high - low }
}
