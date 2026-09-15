// Canvas dimensions and per-side margin. margin is the space between the plot area and the
// canvas edge; chrome (tick labels, axis names, title) paints inside it. Default margins apply
// whenever the plot paints any chrome; with none (sparkbar — both axes hidden, no title) every
// side collapses to a small bare margin so the data fills the canvas.

import type { Layout, Margin, Rect, SideMargins } from "../types"

export type Dimensions = { width: number; height: number }

/** Prefer composed dimensions, then explicit pins, then whole CSS-pixel measurements. */
export function resolve_canvas_size(
    pinned: Partial<Dimensions>,
    measured: Dimensions | null,
    composed: Dimensions | null = null,
): Dimensions | null {
    const measured_width = measured === null ? undefined : Math.floor(measured.width)
    const measured_height = measured === null ? undefined : Math.floor(measured.height)
    const width = composed?.width ?? pinned.width ?? measured_width
    const height = composed?.height ?? pinned.height ?? measured_height

    if (width === undefined || height === undefined) {
        return null
    }
    return { width, height }
}

type Side = 'top' | 'right' | 'bottom' | 'left'

const DEFAULT_WIDTH = 650
const DEFAULT_HEIGHT = 400
const DEFAULT_MARGIN: Record<Side, number> = { top: 60, right: 60, bottom: 60, left: 60 }
const BARE_MARGIN = 2

/**
 * Resolves canvas dimensions and per-side margins from caller args and the chrome the plot paints.
 * @param args_width - caller-pinned width in CSS pixels, if any
 * @param args_height - caller-pinned height in CSS pixels, if any
 * @param x_rendered - whether the x axis paints
 * @param y_rendered - whether the y axis paints
 * @param title_declared - whether a title is set
 * @param margin - caller margin override
 * @returns the resolved Layout with dimensions and margins
 */
export function resolve_layout(
    args_width: number | undefined,
    args_height: number | undefined,
    x_rendered: boolean,
    y_rendered: boolean,
    title_declared: boolean,
    margin: Margin | undefined,
): Layout {
    const caller = normalize_margin(margin)
    // any rendered axis or a title keeps the full default margins on every side
    const has_chrome = x_rendered || y_rendered || title_declared

    const layout: Layout = {
        width: args_width ?? DEFAULT_WIDTH,
        height: args_height ?? DEFAULT_HEIGHT,
        margin_top: side_margin(has_chrome, 'top', caller.top),
        margin_right: side_margin(has_chrome, 'right', caller.right),
        margin_bottom: side_margin(has_chrome, 'bottom', caller.bottom),
        margin_left: side_margin(has_chrome, 'left', caller.left),
    }
    validate_layout_room(layout)
    return layout
}

/**
 * Normalizes the margin arg into per-side values; a number applies to all four sides.
 * @param margin - caller margin as a number, per-side object, or undefined
 * @returns per-side margins, empty when unset
 */
function normalize_margin(margin: Margin | undefined): SideMargins {
    if (margin === undefined) {
        return {}
    }

    if (typeof margin === 'number') {
        return { top: margin, right: margin, bottom: margin, left: margin }
    }
    return margin
}


/**
 * Resolves one side's margin: caller value wins, else the chrome default, collapsing to a bare margin when chromeless.
 * @param has_chrome - whether the plot paints any tick labels, axis names, or title
 * @param side - which margin side to resolve
 * @param caller - caller-pinned margin for this side, if any
 * @returns the side margin in CSS pixels
 */
function side_margin(has_chrome: boolean, side: Side, caller: number | undefined): number {
    if (caller !== undefined) {
        return caller
    }
    return has_chrome ? DEFAULT_MARGIN[side] : BARE_MARGIN
}

/**
 * Guards that the canvas and its margins leave a positive plot area, throwing a sized error otherwise.
 * @param layout - resolved canvas dimensions and per-side margins
 */
function validate_layout_room(layout: Layout): void {
    const { margin_left: left, margin_right: right, margin_top: top, margin_bottom: bottom } = layout

    if (layout.width <= 0) {
        throw new Error(`plot: canvas resolved to ${layout.width}px wide. width wasn't pinned and the parent container has no measurable width. Either pin \`width: <px>\` directly, or fix the parent's sizing (common causes: \`display: none\`, \`width: 0\`, or the parent hasn't been laid out yet).`)
    }

    if (layout.width - left - right <= 0) {
        throw new Error(`plot: margins (left ${left}px + right ${right}px = ${left + right}px) leave no horizontal room in a ${layout.width}px-wide canvas. Pin a larger width, hide an axis, or shrink the margin.`)
    }

    if (layout.height <= 0) {
        throw new Error(`plot: canvas resolved to ${layout.height}px tall. height wasn't pinned and the parent container has no measurable height. Either pin \`height: <px>\` directly, or fix the parent's sizing (common causes: flex column with no min-height, \`display: none\`, or the parent hasn't been laid out yet).`)
    }

    if (layout.height - top - bottom <= 0) {
        throw new Error(`plot: margins (top ${top}px + bottom ${bottom}px = ${top + bottom}px) leave no vertical room in a ${layout.height}px-tall canvas. Pin a larger height, hide an axis/title, or shrink the margin.`)
    }
}

/**
 * Inner plot rect, the canvas with margins subtracted, where series and grid paint.
 * @param layout - resolved layout
 * @returns the inner rect in canvas pixels
 */
export function inner_rect(layout: Layout): Rect {
    return {
        left: layout.margin_left,
        right: layout.width - layout.margin_right,
        top: layout.margin_top,
        bottom: layout.height - layout.margin_bottom,
    }
}
