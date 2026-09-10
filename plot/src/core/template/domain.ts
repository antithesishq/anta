import type { Axis, Domain, Series, SideMode } from "../types"
import { series_type } from "../registry"

// domain computation. Walks series for min/max, pads per side. Sits between series factories
// (raw x/y) and axis resolution (d3 scale).

// headroom past the tallest/deepest bar so it doesn't sit flush against the plot border.
const BAR_HEADROOM = 0.05

/**
 * Whether an axis needs auto domain computation, true when min or max is unset.
 * @param axis - the axis spec
 * @returns true when either endpoint is unset
 */
export function needs_auto(axis: Axis): boolean {
    return axis.min === undefined || axis.max === undefined
}

/**
 * Compute x and y domains by walking every series for min/max, then padding per side.
 * @param series - the series to scan
 * @param x_padding_mode - padding mode for x
 * @param y_padding_mode - padding mode for y
 * @returns the padded x and y domains
 */
export function compute_domains(
    series: Series[],
    x_padding_mode: SideMode,
    y_padding_mode: SideMode,
): { x: Domain; y: Domain } {
    let x_min = Infinity, x_max = -Infinity
    let y_min = Infinity, y_max = -Infinity

    for (const series_item of series) {
        const { x, y } = series_type(series_item.kind).domain_extent(series_item)

        if (x[0] < x_min) {
            x_min = x[0]
        }

        if (x[1] > x_max) {
            x_max = x[1]
        }

        if (y[0] < y_min) {
            y_min = y[0]
        }

        if (y[1] > y_max) {
            y_max = y[1]
        }
    }
    return {
        x: pad_or_fallback(x_min, x_max, x_padding_mode),
        y: pad_or_fallback(y_min, y_max, y_padding_mode),
    }
}

/**
 * Pad a raw [min, max] per the side's mode, falling back to [0, 1] for non-finite input.
 * @param min - raw minimum
 * @param max - raw maximum
 * @param padding_mode - the side's padding mode
 * @returns the padded domain
 */
function pad_or_fallback(min: number, max: number, padding_mode: SideMode): Domain {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return [0, 1]
    }

    if (padding_mode === 'log') {
        return [min, max]
    }

    if (padding_mode === 'anchor_zero') {
        if (min >= 0 && max >= 0) {
            if (max === 0) {
                return [0, 1]
            }
            return [0, max * (1 + BAR_HEADROOM)]
        }

        if (min <= 0 && max <= 0) {
            if (min === 0) {
                return [-1, 0]
            }
            return [min * (1 + BAR_HEADROOM), 0]
        }
        // straddles zero: pad both ends, both carry bars away from the baseline
        return [min * (1 + BAR_HEADROOM), max * (1 + BAR_HEADROOM)]
    }

    if (padding_mode === 'spark_symmetric') {
        const low = Math.min(min, 0)
        const high = Math.max(max, 0)

        if (low === high) {
            return [low - 0.5, high + 0.5]
        }
        // no visible baseline, so float both ends off the edges
        const headroom = (high - low) * BAR_HEADROOM
        return [low - headroom, high + headroom]
    }

    if (min === max) {
        return [min - 0.5, max + 0.5]
    }
    // 5% pad
    const padding = (max - min) * 0.05
    let padded_min = min - padding
    let padded_max = max + padding

    if (min >= 0 && padded_min < 0) {
        padded_min = 0
    }

    if (max <= 0 && padded_max > 0) {
        padded_max = 0
    }
    return [padded_min, padded_max]
}

export type AxisSpace = {
    to: (data_value: number) => number
    from: (space_value: number) => number
}

export const LINEAR_SPACE: AxisSpace = { to: (v) => v, from: (v) => v }
export const LOG_SPACE: AxisSpace = { to: Math.log10, from: (v) => 10 ** v }

/**
 * Clamp a window into `full_domain`: never wider than full (returns null, the full view), and shifted back
 * inside when an endpoint spills past an edge. Shared by the zoom/pan gestures and by a caller-supplied
 * viewport. Invalid working-space windows return the full view (for example, log of a non-positive
 * bound). The tightest-zoom floor is enforced upstream in `zoom_domain`.
 * @param domain - the window to clamp, in the axis's working space
 * @param full_domain - the full unzoomed domain, in the same space
 * @returns the clamped window, or null for the full view
 */
export function clamp_domain(domain: Domain, full_domain: Domain): Domain | null {
    const full_span = full_domain[1] - full_domain[0]
    let lo = domain[0]
    let hi = domain[1]

    // Reject bounds that the axis cannot represent before comparisons can let NaN propagate.
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) {
        return null
    }
    if (hi - lo >= full_span) {
        return null
    }

    if (lo < full_domain[0]) {
        hi += full_domain[0] - lo
        lo = full_domain[0]
    }

    if (hi > full_domain[1]) {
        lo -= hi - full_domain[1]
        hi = full_domain[1]
    }
    return [lo, hi]
}
