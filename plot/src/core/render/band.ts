export const DEFAULT_BAND_INSET_FRACTION = 1 / 6

/**
 * The band interval [start, start + extent] after applying a per-series inset.
 * @param start - the band's scale-start pixel
 * @param bandwidth - the full band width in pixels (positive)
 * @param inset - pixels trimmed from each side, or undefined for the default fraction
 * @returns the inset start and extent
 */
export function inset_band(start: number, bandwidth: number, inset: number | undefined): { start: number; extent: number } {
    const raw = inset ?? bandwidth * DEFAULT_BAND_INSET_FRACTION
    const clamped = Math.min(Math.max(0, raw), bandwidth / 2)

    return { start: start + clamped, extent: bandwidth - 2 * clamped }
}
