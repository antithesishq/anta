import type { Axis, BandScale, CanvasContext, ColorTheme, ContinuousScale, GridSpec, Layout, Rect, Scale } from "../types"
import { resolve_text_color } from "../template/color"

type ContinuousTickScale = {
    (value: number | Date): number
    ticks(count: number): (number | Date)[]
    tickFormat(count: number, specifier?: string): (value: number | Date) => string
    domain(): (number | Date)[]
}

const AXIS_STROKE = '#777'
const TICK_LENGTH = 4
const TICK_LABEL_SIZE = 10 // default tick-label font size (px)
const TICK_LABEL_COLOR = '#777'
const TICK_LABEL_PADDING = 3
const AXIS_LABEL_SIZE = 12 // default axis-name font size (px)
const AXIS_LABEL_COLOR = TICK_LABEL_COLOR // axis names share the tick-label gray
const AXIS_LABEL_END_GAP = 10
const AXIS_LABEL_CANVAS_PAD = 2
const AXIS_LABEL_EDGE_PAD = 9
export const X_TICK_PX_TARGET = 60
export const Y_TICK_PX_TARGET = 50
const GRID_COLOR = { light: '#e0e0e0', dark: '#777' }
// min gap between adjacent tick labels before they're decimated
const LABEL_GAP = 8

function sans(size: number): string {
    return `${size}px sans-serif`
}

function tick_label_size_of(axis: Axis | undefined): number {
    return axis?.tick_label_size ?? TICK_LABEL_SIZE
}

function tick_label_font_of(axis: Axis | undefined): string {
    return sans(tick_label_size_of(axis))
}

function x_tick_label_top(inner: Rect): number {
    return inner.bottom + TICK_LENGTH + TICK_LABEL_PADDING
}

function x_tick_label_bottom(inner: Rect, axis: Axis | undefined): number {
    return x_tick_label_top(inner) + tick_label_size_of(axis)
}

const DAY_MS = 86_400_000
const DAY_TICKS_MAX_MS = 20 * DAY_MS
const MONTH_TICKS_MAX_MS = 180 * DAY_MS
const SI_THRESHOLD = 100_000

/**
 * Linear tick count for a pixel span, floored at 2 so narrow axes still show both endpoints.
 * @param span_px - the axis's inner pixel length
 * @param target - the target pixels per tick for the side
 * @returns the number of ticks to request
 */
export function linear_tick_count(span_px: number, target: number): number {
    return Math.max(2, Math.round(span_px / target))
}

function axis_tick_count(side: 'x' | 'y', inner: Rect): number {
    const is_x = side === 'x'
    const span = is_x ? inner.right - inner.left : inner.bottom - inner.top
    return linear_tick_count(span, is_x ? X_TICK_PX_TARGET : Y_TICK_PX_TARGET)
}

/**
 * Tick count for a time axis capped so a multi-day span keeps day-or-coarser ticks
 * rather than sub-day ticks, whose bare times ("00:00" / "12:00") repeat across days.
 * @param domain - the scale's [start, end]
 * @param side - axis side
 * @param inner - inner plot rect
 * @returns the number of ticks to request
 */
function time_tick_count(domain: (number | Date)[], side: 'x' | 'y', inner: Rect): number {
    const target = axis_tick_count(side, inner)
    const span_ms = Math.abs(Number(domain[domain.length - 1]) - Number(domain[0]))

    if (span_ms < 2 * DAY_MS) {
        return target
    }
    const max_day_ticks = Math.floor(span_ms / DAY_MS)
    return Math.max(2, Math.min(target, max_day_ticks))
}

/**
 * Keep every Nth label so they don't collide, returning N. The tighter the pixel spacing between items,
 * the larger N. x measures the widest label against the tick-label font; y uses a fixed line height.
 * @param ctx - canvas context, for measuring x label widths
 * @param side - axis side
 * @param spacing - pixels between adjacent items
 * @param labels - candidate labels (measured for x; ignored for y)
 * @returns the step between kept labels
 */
function label_skip(ctx: CanvasContext, side: 'x' | 'y', spacing: number, labels: string[], tick_size: number, tick_font: string): number {
    if (spacing <= 0) {
        return 1
    }

    if (side === 'y') {
        return Math.max(1, Math.ceil((tick_size + LABEL_GAP) / spacing))
    }
    // measure x label widths against the tick-label font, restoring whatever the caller had set
    const prev_font = ctx.font
    ctx.font = tick_font
    let max_width = 0

    for (const label of labels) {
        const width = ctx.measureText(label).width

        if (width > max_width) {
            max_width = width
        }
    }
    ctx.font = prev_font
    return Math.max(1, Math.ceil((max_width + LABEL_GAP) / spacing))
}

/**
 * Skip bands if category axis is too crowded and labels would overlap
 * @param ctx - canvas context, used to measure x label widths against the tick-label font
 * @param side - axis side
 * @param scale - the band scale
 * @param labels - the category labels in axis order
 * @returns the number of bands to step between drawn labels
 */
function categorical_skip(ctx: CanvasContext, side: 'x' | 'y', scale: BandScale, labels: string[], tick_size: number, tick_font: string): number {
    return label_skip(ctx, side, scale.step(), labels, tick_size, tick_font)
}

/**
 * A single d3 time-format specifier for the whole axis, chosen from the tick interval so every tick reads
 * the same way. d3's default mixes formats like "Fri 19" / "Jun 21" / "Jul".
 * @param ticks - the tick values (Dates for a time scale)
 * @returns a d3 time-format specifier
 */
function time_specifier(ticks: (number | Date)[]): string {
    const first_ms = Number(ticks[0])
    const second_ms = Number(ticks[1])
    const interval = ticks.length > 1 ? Math.abs(second_ms - first_ms) : 0

    if (interval > 0 && interval < DAY_MS) {
        return '%H:%M'
    }

    if (interval < DAY_TICKS_MAX_MS) {
        return '%b %d'
    }

    if (interval < MONTH_TICKS_MAX_MS) {
        return '%b %Y'
    }
    return '%Y'
}

/**
 * A d3 numeric-format specifier for the axis: SI-suffix ("~s" → "1k", "1.5M") once ticks reach the SI_THRESHOLD
 * @param ticks - the tick values (numbers for a numeric scale)
 * @returns a d3 format specifier, or undefined for d3's default
 */
function numeric_specifier(ticks: (number | Date)[]): string | undefined {
    let max_abs = 0

    for (const tick of ticks) {
        const value = Number(tick)
        max_abs = Math.max(max_abs, Math.abs(value))
    }
    return max_abs >= SI_THRESHOLD ? '~s' : undefined
}

/**
 * Even skip between kept continuous labels so they don't collide and gaps stay regular.
 * @param ctx - canvas context, for measuring x label widths
 * @param side - axis side
 * @param entries - all candidate ticks (pixel position + label), evenly spaced
 * @returns the number of ticks to step between kept labels
 */
function continuous_skip(ctx: CanvasContext, side: 'x' | 'y', entries: { pos: number; label: string }[], tick_size: number, tick_font: string): number {
    if (entries.length < 2) {
        return 1
    }
    const spacing = Math.abs(entries[1].pos - entries[0].pos)
    return label_skip(ctx, side, spacing, entries.map(entry => entry.label), tick_size, tick_font)
}

type ContinuousTicks = { pos: number; label: string }[]

export type AxisChrome = {
    layout: Layout
    inner: Rect
    x_axis: Axis | undefined
    y_axis: Axis | undefined
    x_scale: Scale
    y_scale: Scale
    theme: ColorTheme
    chrome_color: string | undefined
    x_ticks: ContinuousTicks | undefined
    y_ticks: ContinuousTicks | undefined
}

/**
 * Evenly-decimated continuous ticks with uniform labels, shared by grid and axis so both decimate together.
 * Time scales get one format and numeric scales keep d3's format.
 * @param ctx - canvas context, for measuring label widths
 * @param side - axis side
 * @param scale - the continuous scale
 * @param inner - inner plot rect
 * @returns the kept ticks as pixel position + label
 */
function continuous_tick_layout(ctx: CanvasContext, side: 'x' | 'y', scale: ContinuousScale, inner: Rect, axis: Axis | undefined): { pos: number; label: string }[] {
    const tick_scale = scale as ContinuousTickScale
    const domain = tick_scale.domain()
    const is_time = domain[0] instanceof Date
    const count = is_time ? time_tick_count(domain, side, inner) : axis_tick_count(side, inner)
    const ticks = tick_scale.ticks(count)

    if (ticks.length === 0) {
        return []
    }
    const specifier = is_time ? time_specifier(ticks) : numeric_specifier(ticks)
    const format = tick_scale.tickFormat(count, specifier)
    const custom_format = axis?.tick_label_format
    const entries = ticks.map((tick, i) => {
        const label = custom_format !== undefined ? custom_format(Number(tick), i) : format(tick)

        return { pos: tick_scale(tick), label }
    })
    const auto_stride = continuous_skip(ctx, side, entries, tick_label_size_of(axis), tick_label_font_of(axis))
    const indices = decimated_indices(entries.length, auto_stride)
    return indices.map(i => entries[i])
}

/**
 * The continuous tick layout for a side, or undefined for a (categorical) band scale. Computed once
 * per frame in draw() and passed to both the grid and the axis ticks
 * @param ctx - canvas context, for measuring label widths
 * @param side - axis side
 * @param scale - the side's scale
 * @param inner - inner plot rect
 * @param axis - the side's axis spec, carrying an optional tick_label_format override
 * @returns the tick layout, or undefined for a band scale
 */
export function continuous_axis_layout(ctx: CanvasContext, side: 'x' | 'y', scale: Scale, inner: Rect, axis: Axis | undefined): ContinuousTicks | undefined {
    if ('bandwidth' in scale) {
        return undefined
    }
    return continuous_tick_layout(ctx, side, scale, inner, axis)
}

/**
 * Category labels for an axis, or empty when the axis is absent or not categorical.
 * @param axis - the axis spec, or undefined
 * @returns the category labels in axis order
 */
function category_labels(axis: Axis | undefined): string[] {
    if (axis?.scale === 'category') {
        return axis.categories ?? []
    }
    return []
}

function category_display_labels(axis: Axis | undefined): string[] {
    const categories = category_labels(axis)
    const format = axis?.tick_label_format

    if (format === undefined) {
        return categories
    }
    return categories.map((label, i) => format(label, i))
}

/**
 * Pixel positions for ticks on a categorical axis, shared by tick and grid
 * drawing so they align. Continuous positions come precomputed via continuous_axis_layout instead.
 * @param ctx - canvas context, for measuring categorical label widths
 * @param side - axis side
 * @param scale - the band scale
 * @param labels - the category labels in axis order
 * @param edge_aligned - place lines at the delimiters between bands rather than centers
 * @returns tick pixel positions along the side
 */
function categorical_tick_positions(ctx: CanvasContext, side: 'x' | 'y', scale: BandScale, axis: Axis | undefined, labels: string[], edge_aligned: boolean): number[] {
    const positions: number[] = []
    const half = scale.bandwidth() / 2
    const domain = scale.domain()
    const centers: number[] = []

    for (let i = 0; i < domain.length; i++) {
        const band_start = scale(domain[i])

        if (band_start === undefined) {
            continue
        }
        centers.push(band_start + half)
    }

    if (edge_aligned) {
        for (let i = 0; i < centers.length - 1; i++) {
            positions.push((centers[i] + centers[i + 1]) / 2)
        }
        return positions
    }
    const indices = categorical_tick_indices(ctx, side, scale, axis, labels)

    for (const i of indices) {
        if (i < centers.length) {
            positions.push(centers[i])
        }
    }
    return positions
}

function categorical_tick_indices(ctx: CanvasContext, side: 'x' | 'y', scale: BandScale, axis: Axis | undefined, labels: string[]): number[] {
    const stride = categorical_skip(ctx, side, scale, labels, tick_label_size_of(axis), tick_label_font_of(axis))
    return decimated_indices(labels.length, stride)
}

function decimated_indices(count: number, stride: number): number[] {
    const indices: number[] = []

    for (let i = 0; i < count; i += stride) {
        indices.push(i)
    }
    return indices
}

/**
 * Draw both axes, each picking linear or categorical ticks independently so a plot can mix them.
 * An undefined axis paints no chrome on that side.
 * @param ctx - canvas context
 * @param chrome - the resolved per-frame chrome inputs
 */
export function draw_axes(ctx: CanvasContext, chrome: AxisChrome): void {
    const { layout, inner, x_axis, y_axis, x_scale, y_scale, theme, chrome_color, x_ticks, y_ticks } = chrome

    if (x_axis === undefined && y_axis === undefined) {
        return
    }

    ctx.save()
    ctx.strokeStyle = chrome_color ?? AXIS_STROKE
    ctx.lineWidth = 1

    const draw_x_line = x_axis !== undefined && x_axis.line !== false
    const draw_y_line = y_axis !== undefined && y_axis.line !== false
    draw_axis_lines(ctx, inner, draw_x_line, draw_y_line)

    if (x_axis !== undefined) {
        ctx.strokeStyle = tick_mark_color(x_axis, theme, chrome_color)
        ctx.fillStyle = resolve_text_color(x_axis.tick_label_color, theme, TICK_LABEL_COLOR)
        ctx.font = tick_label_font_of(x_axis)
        const draw_x_mark = x_axis.tick_mark !== false

        if (x_axis.scale === 'category') {
            draw_ticks_categorical(ctx, 'x', x_axis, x_scale as BandScale, inner, draw_x_mark)
        } else {
            draw_ticks_continuous(ctx, 'x', inner, x_ticks ?? [], draw_x_mark)
        }
    }

    if (y_axis !== undefined) {
        ctx.strokeStyle = tick_mark_color(y_axis, theme, chrome_color)
        ctx.fillStyle = resolve_text_color(y_axis.tick_label_color, theme, TICK_LABEL_COLOR)
        ctx.font = tick_label_font_of(y_axis)
        const draw_y_mark = y_axis.tick_mark !== false

        if (y_axis.scale === 'category') {
            draw_ticks_categorical(ctx, 'y', y_axis, y_scale as BandScale, inner, draw_y_mark)
        } else {
            draw_ticks_continuous(ctx, 'y', inner, y_ticks ?? [], draw_y_mark)
        }
    }

    draw_axis_labels(ctx, layout, inner, x_axis, y_axis, theme)

    ctx.restore()
}

/**
 * Tick-mark stroke color: the chrome_color override when set, else match the axis line when it's drawn,
 * else blend with the (theme-aware) grid.
 * @param axis - the axis spec
 * @param theme - the chrome theme
 * @param chrome_color - the resolved chrome_color override, or undefined
 * @returns the tick-mark stroke color
 */
function tick_mark_color(axis: Axis, theme: ColorTheme, chrome_color: string | undefined): string {
    if (chrome_color !== undefined) {
        return chrome_color
    }
    return axis.line === false ? GRID_COLOR[theme] : AXIS_STROKE
}

/**
 * Draw gridlines at the tick positions across the inner plot area, driven by the scales.
 * @param ctx - canvas context
 * @param chrome - the resolved per-frame chrome inputs
 */
export function draw_grid(ctx: CanvasContext, chrome: AxisChrome, sides: { x: boolean; y: boolean }): void {
    const { inner, x_scale, y_scale, x_axis, y_axis, theme, chrome_color, x_ticks, y_ticks } = chrome
    ctx.save()
    ctx.strokeStyle = chrome_color ?? GRID_COLOR[theme]
    ctx.lineWidth = 1

    // vertical lines at x ticks
    if (sides.x) {
        const x_edge_aligned = x_axis?.grid_align === 'edge'
        const x_positions = grid_positions(ctx, 'x', x_scale, x_axis, x_ticks, x_edge_aligned)

        for (const pos of x_positions) {
            const x = grid_line_pos(pos, x_edge_aligned)
            ctx.beginPath()
            ctx.moveTo(x, inner.top)
            ctx.lineTo(x, inner.bottom)
            ctx.stroke()
        }
    }

    // horizontal lines at y ticks
    if (sides.y) {
        const y_edge_aligned = y_axis?.grid_align === 'edge'
        const y_positions = grid_positions(ctx, 'y', y_scale, y_axis, y_ticks, y_edge_aligned)

        for (const pos of y_positions) {
            const y = grid_line_pos(pos, y_edge_aligned)
            ctx.beginPath()
            ctx.moveTo(inner.left, y)
            ctx.lineTo(inner.right, y)
            ctx.stroke()
        }
    }
    ctx.restore()
}

export function resolve_grid(grid: GridSpec | undefined): { x: boolean; y: boolean } {
    if (typeof grid === 'boolean' || grid === undefined) {
        return { x: grid === true, y: grid === true }
    }
    return { x: grid.x === true, y: grid.y === true }
}

/**
 * Grid-line positions for a side. Precomputed continuous tick positions when present, else the band-scale positions for a categorical axis.
 * @param ctx - canvas context, for measuring categorical label widths
 * @param side - axis side
 * @param scale - the side's scale
 * @param axis - the axis spec, or undefined
 * @param ticks - the precomputed continuous layout, or undefined for a band scale
 * @param edge_aligned - band scale only: lines at band delimiters rather than centers
 * @returns grid-line pixel positions along the side
 */
function grid_positions(ctx: CanvasContext, side: 'x' | 'y', scale: Scale, axis: Axis | undefined, ticks: ContinuousTicks | undefined, edge_aligned: boolean): number[] {
    if (ticks !== undefined) {
        return ticks.map(entry => entry.pos)
    }
    return categorical_tick_positions(ctx, side, scale as BandScale, axis, category_display_labels(axis), edge_aligned)
}

/**
 * Get pixel position of the grid line. Center aligned grid
 * lines snap to a pixel center so they render crisp under their
 * label. Edge-aligned band dividers stay at the true band edge.
 * @param pos - the raw scale position
 * @param edge_aligned - whether the line sits at a band delimiter rather than a tick
 * @returns the pixel coordinate to stroke at
 */
function grid_line_pos(pos: number, edge_aligned: boolean): number {
    if (edge_aligned) {
        return pos
    }
    return Math.round(pos) + 0.5
}

/**
 * Draw the x and/or y axis lines on the inner rect edges. Rounded then +0.5 so a 1px stroke lands crisp on a
 * device pixel (matching the grid) even when the inner edges or the device-pixel ratio are fractional.
 * @param ctx - canvas context
 * @param inner - inner plot rect
 * @param draw_x - whether to draw the x axis line
 * @param draw_y - whether to draw the y axis line
 */
function draw_axis_lines(ctx: CanvasContext, inner: Rect, draw_x: boolean, draw_y: boolean): void {
    const left = Math.round(inner.left) + 0.5
    const right = Math.round(inner.right) + 0.5
    const top = Math.round(inner.top) + 0.5
    const bottom = Math.round(inner.bottom) + 0.5
    ctx.beginPath()

    if (draw_x) {
        ctx.moveTo(left, bottom)
        ctx.lineTo(right, bottom)
    }

    if (draw_y) {
        ctx.moveTo(left, top)
        ctx.lineTo(left, bottom)
    }
    ctx.stroke()
}

/**
 * Draw continuous ticks and their labels along a side, perpendicular to the axis.
 * Covers linear, log, and time scales. Labels are uniformly formatted and evenly decimated,
 * and the grid reads the same layout so tick marks, labels, and gridlines decimate together.
 * @param ctx - canvas context
 * @param side - axis side, selects span, spacing, alignment, and tick geometry
 * @param scale - the continuous scale
 * @param inner - inner plot rect
 */
function draw_ticks_continuous(ctx: CanvasContext, side: 'x' | 'y', inner: Rect, ticks: ContinuousTicks, draw_mark: boolean): void {
    const is_x = side === 'x'
    ctx.textAlign = is_x ? 'center' : 'right'
    ctx.textBaseline = is_x ? 'top' : 'middle'

    for (const entry of ticks) {
        const pos = Math.round(entry.pos) + 0.5

        if (is_x) {
            if (draw_mark) {
                ctx.beginPath()
                ctx.moveTo(pos, inner.bottom + 0.5)
                ctx.lineTo(pos, inner.bottom + 0.5 + TICK_LENGTH)
                ctx.stroke()
            }
            ctx.fillText(entry.label, pos, x_tick_label_top(inner))
        } else {
            if (draw_mark) {
                ctx.beginPath()
                ctx.moveTo(inner.left + 0.5 - TICK_LENGTH, pos)
                ctx.lineTo(inner.left + 0.5, pos)
                ctx.stroke()
            }
            ctx.fillText(entry.label, inner.left - TICK_LENGTH - TICK_LABEL_PADDING, pos)
        }
    }
}

/**
 * Draw one tick and label per category, centered in the band.
 * @param ctx - canvas context
 * @param side - axis side
 * @param axis - the category axis spec
 * @param scale - the band scale
 * @param inner - inner plot rect
 */
function draw_ticks_categorical(
    ctx: CanvasContext,
    side: 'x' | 'y',
    axis: Axis,
    scale: BandScale,
    inner: Rect,
    draw_mark: boolean,
): void {
    const is_x = side === 'x'
    const labels = category_display_labels(axis)
    const half = scale.bandwidth() / 2
    const indices = categorical_tick_indices(ctx, side, scale, axis, labels)
    ctx.textAlign = is_x ? 'center' : 'right'
    ctx.textBaseline = is_x ? 'top' : 'middle'

    for (const i of indices) {
        const band_start = scale(i)

        if (band_start === undefined) {
            continue
        }
        const pos = Math.round(band_start + half) + 0.5

        if (is_x) {
            if (draw_mark) {
                ctx.beginPath()
                ctx.moveTo(pos, inner.bottom + 0.5)
                ctx.lineTo(pos, inner.bottom + 0.5 + TICK_LENGTH)
                ctx.stroke()
            }
            ctx.fillText(labels[i], pos, x_tick_label_top(inner))
        } else {
            if (draw_mark) {
                ctx.beginPath()
                ctx.moveTo(inner.left + 0.5 - TICK_LENGTH, pos)
                ctx.lineTo(inner.left + 0.5, pos)
                ctx.stroke()
            }
            ctx.fillText(labels[i], inner.left - TICK_LENGTH - TICK_LABEL_PADDING, pos)
        }
    }
}

/**
 * Draw each axis name centered in its margin band, across from the plot.
 * @param ctx - canvas context
 * @param layout - resolved layout
 * @param inner - inner plot rect
 * @param x_axis - x axis spec, or undefined
 * @param y_axis - y axis spec, or undefined
 */
function draw_axis_labels(ctx: CanvasContext, layout: Layout, inner: Rect, x_axis: Axis | undefined, y_axis: Axis | undefined, theme: ColorTheme): void {
    if (!x_axis?.label && !y_axis?.label) {
        return
    }

    if (x_axis?.label) {
        draw_x_axis_label(ctx, layout, inner, x_axis, theme)
    }

    if (y_axis?.label) {
        draw_y_axis_label(ctx, layout, inner, y_axis, theme)
    }
}

function set_axis_label_style(ctx: CanvasContext, axis: Axis, theme: ColorTheme): void {
    ctx.fillStyle = resolve_text_color(axis.label_color, theme, AXIS_LABEL_COLOR)
    ctx.font = sans(axis.label_size ?? AXIS_LABEL_SIZE)
}

/**
 * Vertical center for the x-axis name: midway between the bottom of the x tick labels and the canvas edge.
 * Falls back to centering in the whole bottom margin when that leaves the name no room.
 * @param layout - resolved layout
 * @param inner - inner plot rect
 * @param axis - x axis spec
 * @returns the y to draw the name at, with textBaseline 'middle'
 */
function x_axis_label_center_y(layout: Layout, inner: Rect, axis: Axis): number {
    const ticks_bottom = x_tick_label_bottom(inner, axis)
    const label_size = axis.label_size ?? AXIS_LABEL_SIZE

    if (ticks_bottom + label_size > layout.height) {
        return layout.height - layout.margin_bottom / 2
    }
    return (ticks_bottom + layout.height) / 2
}

/**
 * Draw the x-axis name in the bottom margin, all positions horizontal: 'center' (default) centered,
 * 'left' aligned to the axis start, 'right' aligned to the axis end.
 * @param ctx - canvas context
 * @param layout - resolved layout
 * @param inner - inner plot rect
 * @param axis - x axis spec (label already confirmed present by the caller)
 */
function draw_x_axis_label(ctx: CanvasContext, layout: Layout, inner: Rect, axis: Axis, theme: ColorTheme): void {
    const label = axis.label

    if (label === undefined) {
        return
    }
    set_axis_label_style(ctx, axis, theme)
    const position = axis.label_position ?? 'center'
    const center_y = x_axis_label_center_y(layout, inner, axis)
    ctx.textBaseline = 'middle'

    if (position === 'left') {
        ctx.textAlign = 'left'
        ctx.fillText(label, inner.left, center_y)
        return
    }

    if (position === 'right') {
        ctx.textAlign = 'right'
        ctx.fillText(label, inner.right, center_y)
        return
    }
    ctx.textAlign = 'center'
    ctx.fillText(label, (inner.left + inner.right) / 2, center_y)
}

/**
 * Draw the y-axis label. center is the default (rotated -90), top/bottom read horizontally/
 * @param ctx - canvas context
 * @param layout - resolved layout
 * @param inner - inner plot rect
 * @param axis - y axis spec (label already confirmed present by the caller)
 */
function draw_y_axis_label(ctx: CanvasContext, layout: Layout, inner: Rect, axis: Axis, theme: ColorTheme): void {
    const label = axis.label

    if (label === undefined) {
        return
    }
    set_axis_label_style(ctx, axis, theme)
    const position = axis.label_position ?? 'center'

    if (position === 'center') {
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.translate(layout.margin_left / 2, (inner.top + inner.bottom) / 2)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText(label, 0, 0)
        ctx.restore()
        return
    }
    const text_width = ctx.measureText(label).width
    const right_edge = Math.max(inner.left - AXIS_LABEL_END_GAP, AXIS_LABEL_CANVAS_PAD + text_width)
    ctx.textAlign = 'right'

    if (position === 'top') {
        ctx.textBaseline = 'bottom'
        ctx.fillText(label, right_edge, inner.top - AXIS_LABEL_EDGE_PAD)
        return
    }
    ctx.textBaseline = 'top'
    ctx.fillText(label, right_edge, inner.bottom + AXIS_LABEL_EDGE_PAD)
}
