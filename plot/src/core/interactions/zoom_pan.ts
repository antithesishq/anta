import type { AxisTemplate, Domain, Scale, Viewport, ZoomPan } from "../types"
import { clamp_domain, LINEAR_SPACE, LOG_SPACE, type AxisSpace } from "../template/domain"

// Zoom + pan math for the plot's viewport override.
// Continuous axes carry a numeric full_domain and zoom/pan; a categorical axis passes it as null and holds.

const ZOOM_SPEED = 0.0015 // zoom-factor sensitivity
const MAX_ZOOM = 10000 // tightest zoom: the narrowest window is the full domain over this
const ZOOM_LIMIT_SLACK = 1e-6 // relative tolerance for floating point round-off tolerance, so the tightest zoom doesn't read as room left

export type WheelClaim = 'both' | 'up' | 'down' | 'none'

export type CaptureConfiguration = {
    wheel_capture: WheelClaim | null
    wheel_modifier: 'ctrl' | 'none'
    wheel_activation: 'hover' | 'settled'
    wheel_delay: number
    wheel_tolerance: number
    wheel_reset_on_move: boolean
    pointer_capture: 'mouse' | null
    pointer_buttons: number[]
    pointer_threshold: number
    pointer_modifier: 'ctrl' | 'any'
}

/** Plain attributes accepted by Capture and the plot surface, with no JSX or browser dependency. */
export function capture_attributes(settings: CaptureConfiguration) {
    return {
        'wheel-capture': (settings.wheel_capture === 'both' ? 'up down' : settings.wheel_capture) ?? undefined,
        'wheel-modifier': settings.wheel_modifier,
        'wheel-activation': settings.wheel_activation,
        'wheel-delay': String(settings.wheel_delay),
        'wheel-tolerance': String(settings.wheel_tolerance),
        'wheel-reset-on-move': settings.wheel_reset_on_move ? '' : undefined,
        'pointer-capture': settings.pointer_capture ?? undefined,
        'pointer-buttons': settings.pointer_buttons.join(' '),
        'pointer-threshold': String(settings.pointer_threshold),
        'pointer-modifier': settings.pointer_modifier,
    }
}

/** Resolve interaction policy once; hosts translate it into Capture props or attributes. */
export function resolve_capture_configuration(
    enabled: boolean,
    modifier: boolean,
    wheel_claim: WheelClaim,
): CaptureConfiguration {
    return {
        wheel_capture: enabled ? (modifier ? 'both' : wheel_claim) : null,
        wheel_modifier: modifier ? 'ctrl' : 'none',
        wheel_activation: modifier ? 'hover' : 'settled',
        wheel_delay: 150,
        wheel_tolerance: 5,
        wheel_reset_on_move: false,
        pointer_capture: enabled ? 'mouse' : null,
        pointer_buttons: [0],
        pointer_threshold: 3,
        pointer_modifier: modifier ? 'ctrl' : 'any',
    }
}

// a pan drag frame captured at pointer-down
type PanAxisFrame = { domain: Domain; space_delta_per_pixel: number; space: AxisSpace }

type AxisViews = {
    x_scale: Scale
    y_scale: Scale
    x_full_domain: Domain | null
    y_full_domain: Domain | null
}

export type PanSnapshot = {
    x_axis_frame: PanAxisFrame | null
    y_axis_frame: PanAxisFrame | null
    pointer_origin: { x: number; y: number }
}

/** Enable gestures only when at least one selected axis is continuous. */
export function zoom_pan_enabled(template: {
    x: Pick<AxisTemplate, 'kind'>
    y: Pick<AxisTemplate, 'kind'>
    zoom_pan: ZoomPan
}): boolean {
    if (!template.zoom_pan.enabled) {
        return false
    }
    const x_zoomable = template.zoom_pan.x && template.x.kind !== 'category'
    const y_zoomable = template.zoom_pan.y && template.y.kind !== 'category'
    return x_zoomable || y_zoomable
}

/**
 * The views a gesture may actually move: an axis opted out of `zoom_pan` reads as having no full domain, which
 * is exactly how a categorical axis already arrives here.
 * @param views - the plot's scales and full domains
 * @param axes - which axes zoom_pan may move
 * @returns the views with an opted-out axis pinned
 */
export function zoomable_views(views: AxisViews, axes: { x: boolean; y: boolean }): AxisViews {
    return {
        x_scale: views.x_scale,
        y_scale: views.y_scale,
        x_full_domain: axes.x ? views.x_full_domain : null,
        y_full_domain: axes.y ? views.y_full_domain : null,
    }
}

/**
 * A viewport held inside the plot's full extents, each axis in its own working space. Gesture windows are
 * already inside; a caller's window may not be, and compose clamps only what it renders — so without this the
 * hook's state would describe a window the plot isn't on, and `is_zoomed`, the wheel claim and the zoom
 * anchor would all read from it.
 * @param views - the plot's scales and full domains
 * @param viewport - the window to hold, per axis
 * @returns the clamped viewport
 */
export function clamp_viewport(views: AxisViews, viewport: Viewport): Viewport {
    return {
        x: clamp_axis_window(views.x_scale, views.x_full_domain, viewport.x),
        y: clamp_axis_window(views.y_scale, views.y_full_domain, viewport.y),
    }
}

/**
 * One axis's window, held inside its full domain. An axis with no numeric domain holds nothing.
 * @param scale - the axis's composed scale
 * @param full_domain - the full unzoomed domain, or null for a categorical axis
 * @param window - the window to hold, or null for the full view
 * @returns the clamped window, or null for the full view
 */
function clamp_axis_window(scale: Scale, full_domain: Domain | null, window: Domain | null): Domain | null {
    if (window === null || full_domain === null) {
        return null
    }
    const space = axis_space(scale)
    const full_lo = space.to(full_domain[0])
    const full_hi = space.to(full_domain[1])
    const clamped = clamp_domain([space.to(window[0]), space.to(window[1])], [full_lo, full_hi])

    // a caller-supplied window that merely covers the full domain is the full view, so null it here too
    if (clamped === null || is_full_view(clamped[1] - clamped[0], full_hi - full_lo)) {
        return null
    }
    return from_space(clamped, space)
}

/**
 * The viewport after a wheel zoom anchored at the cursor
 * @param views - the plot's scales and full domains
 * @param override - the current viewport (null on an axis = full view)
 * @param cursor - the cursor position in plot pixels
 * @param delta_y - the wheel event's deltaY
 * @returns the new viewport
 */
export function zoom_viewport(views: AxisViews, override: Viewport, cursor: { x: number; y: number }, delta_y: number): Viewport {
    const factor = zoom_factor(delta_y)
    return {
        x: zoom_axis(views.x_scale, views.x_full_domain, override.x, cursor.x, factor),
        y: zoom_axis(views.y_scale, views.y_full_domain, override.y, cursor.y, factor),
    }
}

/**
 * Which wheel directions still zoom, so a host can hand the wheel back once the plot has run out - the same
 * way a scroll container at its edge lets the page scroll on.
 * @param views - the plot's scales and full domains
 * @param override - the current viewport (null on an axis = full view)
 * @returns the directions still available
 */
export function wheel_claim(views: AxisViews, override: Viewport): WheelClaim {
    const zooms_in = axis_zooms_in(views.x_scale, views.x_full_domain, override.x)
        || axis_zooms_in(views.y_scale, views.y_full_domain, override.y)
    const zooms_out = axis_zooms_out(views.x_scale, views.x_full_domain, override.x)
        || axis_zooms_out(views.y_scale, views.y_full_domain, override.y)

    if (zooms_in && zooms_out) {
        return 'both'
    }

    if (zooms_in) {
        return 'up'
    }

    return zooms_out ? 'down' : 'none'
}

/**
 * The claim to hand the UI thread: the directions still zoomable, or every direction once this visit has
 * zoomed. A plot the user is actively zooming keeps the wheel at its extents too, rather than letting the page
 * scroll out from under a gesture - only leaving the data area releases it. A plot that can't zoom at all
 * (both axes categorical) never claims.
 * @param zoomable - the directions the plot could still zoom
 * @param zoomed_this_visit - whether a wheel has already moved the plot since the pointer arrived
 * @returns the claim to publish
 */
export function published_claim(zoomable: WheelClaim, zoomed_this_visit: boolean): WheelClaim {
    if (zoomable === 'none') {
        return 'none'
    }
    return zoomed_this_visit ? 'both' : zoomable
}

/**
 * The pan drag frame captured at pointer-down. Each axis's start window plus the pointer origin.
 * @param views - the plot's scales and full domains
 * @param override - the current viewport (null on an axis = full view)
 * @param pointer_origin - the pointer position at pan start
 * @returns the pan snapshot
 */
export function pan_frame(views: AxisViews, override: Viewport, pointer_origin: { x: number; y: number }): PanSnapshot {
    return {
        x_axis_frame: pan_axis_snapshot(views.x_scale, views.x_full_domain, override.x),
        y_axis_frame: pan_axis_snapshot(views.y_scale, views.y_full_domain, override.y),
        pointer_origin,
    }
}

/**
 * The viewport after a pan move. Shift each axis's snapshot window by the pointer delta since pan start.
 * @param snapshot - the pan frame from pan_frame
 * @param views - the plot's scales and full domains
 * @param override - the current window per axis, which an axis that can't pan keeps
 * @param pointer - the current pointer position
 * @returns the new viewport
 */
export function pan_viewport(snapshot: PanSnapshot, views: AxisViews, override: Viewport, pointer: { x: number; y: number }): Viewport {
    return {
        x: pan_axis(snapshot.x_axis_frame, views.x_full_domain, override.x, pointer.x - snapshot.pointer_origin.x),
        y: pan_axis(snapshot.y_axis_frame, views.y_full_domain, override.y, pointer.y - snapshot.pointer_origin.y),
    }
}

/**
 * Zoom factor from a wheel deltaY. `Math.exp` keeps the factor positive for any deltaY and makes zoom-in then zoom-out symmetric.
 * @param delta_y - the wheel event's deltaY
 * @returns the multiplicative zoom factor
 */
function zoom_factor(delta_y: number): number {
    return Math.exp(delta_y * ZOOM_SPEED)
}

/**
 * Per-axis zoom: a categorical axis keeps its override; a continuous one zooms around the cursor pixel position.
 * @param scale - the axis's composed scale
 * @param full_domain - the full unzoomed domain, or null for a categorical axis
 * @param override - the current window, or null for the full view
 * @param cursor_position - the cursor position in plot pixels
 * @param zoom_factor - the multiplicative zoom factor
 * @returns the new window, or null for the full view / an axis that doesn't zoom
 */
function zoom_axis(scale: Scale, full_domain: Domain | null, override: Domain | null, cursor_position: number, zoom_factor: number): Domain | null {
    if (full_domain === null) {
        return override
    }
    const range = scale_range(scale)

    if (range === undefined) {
        return override
    }
    const space = axis_space(scale)
    const full_space: Domain = [space.to(full_domain[0]), space.to(full_domain[1])]
    const override_space = to_space(override, space)
    const anchor = anchor_in_space(override_space ?? full_space, range, cursor_position)
    const window = zoom_domain(override_space, full_space, anchor, zoom_factor)
    return from_space(window, space)
}

/**
 * Whether this axis's window is still wider than the tightest zoom. Measured in the axis's working space, so a
 * log axis is compared against the same span `zoom_domain` would cap it at.
 * @param scale - the axis's composed scale
 * @param full_domain - the full unzoomed domain, or null for a categorical axis
 * @param override - the current window, or null for the full view
 * @returns whether a zoom-in would still move this axis
 */
function axis_zooms_in(scale: Scale, full_domain: Domain | null, override: Domain | null): boolean {
    if (full_domain === null) {
        return false
    }
    const space = axis_space(scale)
    const window: Domain = override ?? full_domain
    const window_span = space.to(window[1]) - space.to(window[0])
    const min_span = (space.to(full_domain[1]) - space.to(full_domain[0])) / MAX_ZOOM

    return window_span > min_span * (1 + ZOOM_LIMIT_SLACK)
}

// Whether this axis's window is still narrower than the full domain.
function is_full_view(window_span: number, full_span: number): boolean {
    return window_span >= full_span * (1 - ZOOM_LIMIT_SLACK)
}

function axis_zooms_out(scale: Scale, full_domain: Domain | null, override: Domain | null): boolean {
    // no full domain means the axis is pinned
    if (full_domain === null || override === null) {
        return false
    }
    const space = axis_space(scale)
    const window_span = space.to(override[1]) - space.to(override[0])
    const full_span = space.to(full_domain[1]) - space.to(full_domain[0])

    return !is_full_view(window_span, full_span)
}

/**
 * Snapshot a continuous axis's start window + data-per-pixel at pan start. Null for a categorical axis.
 * @param scale - the axis's composed scale
 * @param full_domain - the full unzoomed domain, or null for a categorical axis
 * @param override - the current window, or null for the full view
 * @returns the snapshot, or null for an axis that doesn't pan
 */
function pan_axis_snapshot(scale: Scale, full_domain: Domain | null, override: Domain | null): PanAxisFrame | null {
    if (full_domain === null) {
        return null
    }
    const space = axis_space(scale)
    const dpp = space_delta_per_pixel(scale, space)

    if (dpp === undefined) {
        return null
    }
    const window: Domain = override ?? full_domain
    return { domain: [space.to(window[0]), space.to(window[1])], space_delta_per_pixel: dpp, space }
}

/**
 * Per-axis pan: shift the snapshot window by the pixel delta (converted to data units). An axis that can't pan
 * keeps the window it is on, the same way `zoom_axis` does: a pinned axis holds its position, it doesn't lose it.
 * @param snapshot - the axis's pan-start snapshot, or null
 * @param full_domain - the full unzoomed domain, or null for a categorical or pinned axis
 * @param override - this axis's current window, or null for the full view
 * @param pixel_delta - the drag distance in pixels since pan start
 * @returns the shifted window, the untouched one for an axis that doesn't pan, or null for the full extent
 */
function pan_axis(snapshot: PanAxisFrame | null, full_domain: Domain | null, override: Domain | null, pixel_delta: number): Domain | null {
    if (snapshot === null || full_domain === null) {
        return override
    }
    const { space } = snapshot
    const full_space: Domain = [space.to(full_domain[0]), space.to(full_domain[1])]
    const shifted = pan_domain(snapshot.domain, full_space, -snapshot.space_delta_per_pixel * pixel_delta)
    return from_space(shifted, space)
}

// --- pure domain math (numeric windows) ---

/**
 * Scale the current window around `anchor` (the cursor position, in working-space coordinates) by factor, then
 * clamp to full_domain. The zoom-in factor is capped so the window lands exactly on the tightest zoom and never below.
 * A zoom-out that reaches the full extent returns null, not a window covering it
 */
function zoom_domain(override: Domain | null, full_domain: Domain, anchor: number, factor: number): Domain | null {
    const current_domain = override ?? full_domain
    const current_span = current_domain[1] - current_domain[0]
    const full_span = full_domain[1] - full_domain[0]

    const min_span = full_span / MAX_ZOOM // the narrowest span possible
    const capped = Math.max(factor, min_span / current_span) // cap zoom-in at min_span

    const lo = anchor + (current_domain[0] - anchor) * capped
    const hi = anchor + (current_domain[1] - anchor) * capped
    const next_window = clamp_domain([lo, hi], full_domain)

    // clamp_domain already nulls a window at or wider than full; is_full_view additionally catches one that lands a hair short
    if (next_window === null || is_full_view(next_window[1] - next_window[0], full_span)) {
        return null
    }
    return next_window
}

/**
 * Shift `start_domain` by `data_delta`, held inside `full`. At the full extent there's nothing to pan and it
 * returns null.
 */
function pan_domain(start_domain: Domain, full: Domain, data_delta: number): Domain | null {
    const span = start_domain[1] - start_domain[0]

    if (span >= full[1] - full[0]) {
        return null
    }
    const highest_low = full[1] - span
    const low = Math.min(Math.max(start_domain[0] + data_delta, full[0]), highest_low)

    return [low, low + span]
}

// --- scale ↔ pixel plumbing ---

// data value at a pixel on a continuous scale; undefined for a categorical scale
function pixel_to_data(scale: Scale, px: number): number | undefined {
    if ('invert' in scale) {
        return Number(scale.invert(px))
    }
    return undefined
}

// the scale's pixel range [start, end], stable across zoom.
function scale_range(scale: { range(): number[] }): [number, number] | undefined {
    const range = scale.range()
    const start = range[0]
    const end = range[range.length - 1]

    if (typeof start !== 'number' || typeof end !== 'number' || start === end) {
        return undefined
    }
    return [start, end]
}

// invert a cursor pixel to a working-space value within window_space
function anchor_in_space(window_space: Domain, range: [number, number], cursor_position: number): number {
    const [pixel_start, pixel_end] = range
    const [window_lo, window_hi] = window_space

    // how far the cursor sits along the pixel range: 0 at the start edge, 1 at the end edge
    const cursor_fraction = (cursor_position - pixel_start) / (pixel_end - pixel_start)

    // the value the same fraction of the way across the window is the one under the cursor
    const window_span = window_hi - window_lo
    return window_lo + cursor_fraction * window_span
}

// signed working-space units per pixel — constant per pixel in that space, so it stays exact when panning a log
// axis (y is negative: pixels grow downward while data grows upward)
function space_delta_per_pixel(scale: Scale, space: AxisSpace): number | undefined {
    const at0 = pixel_to_data(scale, 0)
    const at1 = pixel_to_data(scale, 1)

    if (at0 === undefined || at1 === undefined) {
        return undefined
    }
    return space.to(at1) - space.to(at0)
}

function axis_space(scale: Scale): AxisSpace {
    return 'base' in scale ? LOG_SPACE : LINEAR_SPACE
}

function to_space(domain: Domain | null, space: AxisSpace): Domain | null {
    return domain === null ? null : [space.to(domain[0]), space.to(domain[1])]
}

function from_space(domain: Domain | null, space: AxisSpace): Domain | null {
    return domain === null ? null : [space.from(domain[0]), space.from(domain[1])]
}
