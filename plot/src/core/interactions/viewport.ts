import type { AxisTemplate, AxisViewport, Domain, Viewport, ViewportChange } from "../types"

export type ViewportAxes = { x: Pick<AxisTemplate, 'kind'>; y: Pick<AxisTemplate, 'kind'> }

/** Retain usable windows after an axis change; incompatible axes return to their full extent. */
export function compatible_viewport(viewport: Viewport, axes: ViewportAxes): Viewport {
    const x = compatible_window(viewport.x, axes.x.kind)
    const y = compatible_window(viewport.y, axes.y.kind)
    return x === viewport.x && y === viewport.y ? viewport : { x, y }
}

function compatible_window(window: Domain | null, kind: AxisTemplate['kind']): Domain | null {
    if (window === null || kind === 'category') {
        return null
    }
    const [low, high] = window
    if (!Number.isFinite(low) || !Number.isFinite(high) || low >= high) {
        return null
    }
    return kind === 'log' && low <= 0 ? null : window
}

/**
 * Whether a zoom moved either axis. Compared by value, not reference: a zoom clamped at an extent hands back a
 * fresh window holding the same bounds, and that must not read as a move.
 * @param before - the viewport before the wheel
 * @param after - the viewport after it
 * @returns true when the plot moved
 */
export function viewport_moved(before: Viewport, after: Viewport): boolean {
    return !same_window(before.x, after.x) || !same_window(before.y, after.y)
}

/**
 * Whether two axis windows cover the same bounds. Null is the full view, so it only matches null.
 * @param before - one window, or null for the full view
 * @param after - the other window
 * @returns true when they're the same window
 */
function same_window(before: Domain | null, after: Domain | null): boolean {
    if (before === null || after === null) {
        return before === after
    }
    return before[0] === after[0] && before[1] === after[1]
}

/**
 * The change to report to the caller, per axis. Reads the plot's OWN full domains, never the pinned ones from
 * `zoomable_views`: a caller hears the real extent of an axis their `zoom_pan` opted out of, and `null` keeps
 * meaning only "this axis is categorical".
 * @param viewport - the window to report
 * @param domains - the plot's full extents, null on a categorical axis
 * @returns the per-axis change payload
 */
export function viewport_change(viewport: Viewport, domains: { x_full_domain: Domain | null; y_full_domain: Domain | null }): ViewportChange {
    return {
        x: axis_viewport(viewport.x, domains.x_full_domain),
        y: axis_viewport(viewport.y, domains.y_full_domain),
    }
}

/**
 * One axis's reported viewport. An unzoomed axis reports its full extent as the window, since the caller can't
 * derive it: it only exists after padding and d3's nice().
 * @param override - the axis's window, or null for the full view
 * @param full - the axis's full extent, or null when it's categorical
 * @returns the axis payload, or null for a categorical axis
 */
function axis_viewport(override: Domain | null, full: Domain | null): AxisViewport | null {
    if (full === null) {
        return null
    }
    return { window: [...(override ?? full)], full: [...full] }
}
