import type { AxisTemplate, Domain, Margin, PlotArgs, PlotTemplate, RequestedViewportWindow, Series, ThemeColor, TitleArg, ViewportRequest, ZoomPan } from "../types"
import { build_resolved_axes } from "./axis"
import { build_resolved_series } from "./build_series"
import { validate_non_negative, validate_positive } from "./validate"

// Plot template factory. Runs at user-call time, validates, throws on bad config.
// Output is dimension-independent. compose_plot turns it into a renderable Plot.

/**
 * Build the dimension-independent PlotTemplate: validate args, infer axis kinds, compute domains.
 * @param args - the unvalidated plot args
 * @returns the resolved PlotTemplate
 */
export function new_plot_template<TooltipContent = unknown>(args: PlotArgs<TooltipContent>): PlotTemplate<TooltipContent> {
    validate_dimensions(args)
    const { series, axis } = args

    // Axis resolution and row remapping never inspect host tooltip content. Keep those helpers
    // non-generic while preserving the caller's tooltip type on the returned template.
    const structural_series = series as unknown as Series[]

    // validate, classify, and resolve both axes end to end
    const { x_resolved, y_resolved } = build_resolved_axes(structural_series, axis)

    // resolve series and using translations to map the series categories to the axis' category union if applicable
    const resolved_series = build_resolved_series(structural_series, x_resolved.translations, y_resolved.translations) as unknown as Series<TooltipContent>[]

    const title = normalize_title(args.title)

    return {
        series: resolved_series,
        x: x_resolved.axis_template,
        y: y_resolved.axis_template,
        title: resolve_label(title.text),
        title_size: title.size,
        title_color: title.color,
        margin: args.margin,
        width: args.width,
        height: args.height,
        border: args.border,
        grid: args.grid,
        chrome_color: args.chrome_color,
        background: args.background,
        theme_invert: args.theme_invert,
        zoom_pan: resolve_zoom_pan(args.zoom_pan),
        viewport: resolve_viewport(args.viewport, x_resolved.axis_template, y_resolved.axis_template),
        on_viewport_change: args.on_viewport_change,
    }
}

/**
 * Resolve the zoom/pan config into its enabled + modifier + per-axis flags. `true` and an absent arg both mean
 * the Ctrl-gated default on both axes; an object tunes the modifier and opts axes out. `enabled` mirrors
 * "some axis may move", so opting both out is the same as `zoom_pan: false`.
 * @param zoom_pan - the caller's zoom_pan arg
 * @returns the resolved config
 */
function resolve_zoom_pan(zoom_pan: PlotArgs['zoom_pan']): ZoomPan {
    if (zoom_pan === undefined || zoom_pan === true) {
        return { enabled: true, modifier: true, x: true, y: true }
    }

    if (zoom_pan === false) {
        return { enabled: false, modifier: true, x: false, y: false }
    }
    const x = zoom_pan.x ?? true
    const y = zoom_pan.y ?? true

    return { enabled: x || y, modifier: zoom_pan.modifier ?? true, x, y }
}

const KEEP = 'keep' as const // this side was omitted: leave that axis wherever it is
const UNUSABLE = 'unusable' as const // the data made this side nonsense: warned, and the request is dropped

/**
 * Resolve the window the caller wants the plot on. An absent side means that axis goes to its full extent.
 * The window is a request, not a limit: compose clamps it to the axis's full domain, so it can't widen the
 * zoom range, and it only lands at mount and on each `key` change, so a gesture may leave it behind.
 * @param viewport - the caller's viewport arg
 * @param x - the resolved x axis
 * @param y - the resolved y axis
 * @returns the resolved request, or undefined when the caller passed none
 */
function resolve_viewport(viewport: PlotArgs['viewport'], x: AxisTemplate, y: AxisTemplate): ViewportRequest | undefined {
    if (viewport === undefined) {
        return undefined
    }
    const x_window = viewport.x === undefined ? KEEP : resolve_window(viewport.x, x, 'plot: viewport.x')
    const y_window = viewport.y === undefined ? KEEP : resolve_window(viewport.y, y, 'plot: viewport.y')

    // One unusable side drops the whole request: leaving the plot where it is says "not applied", where
    // falling back to a side's full extent would be a move the caller never asked for.
    if (x_window === UNUSABLE || y_window === UNUSABLE) {
        return undefined
    }
    const window: RequestedViewportWindow = {}

    if (x_window !== KEEP) {
        window.x = x_window
    }

    if (y_window !== KEEP) {
        window.y = y_window
    }
    return { window, key: viewport.key }
}

/**
 * Validate one axis's requested window: a [low, high] pair of finite numbers, low first, and above zero on a
 * log axis. Shape mistakes throw, because only code can write them and they never come right on their own.
 * Unusable *values* only warn: a window derived from live data goes bad whenever a filter empties or matches
 * a single row, and a plot that's rendering fine shouldn't die for a request it can simply ignore.
 * @param window - the caller's window for this axis
 * @param axis - the resolved axis the window belongs to
 * @param label - fully-qualified label for the error
 * @returns the window, null when the caller asked for the full extent, or UNUSABLE when the values are
 *          nonsense and the whole request should be dropped
 */
function resolve_window(window: number[] | null, axis: AxisTemplate, label: string): Domain | null | typeof UNUSABLE {
    if (window === null) {
        return null
    }

    if (axis.kind === 'category') {
        throw new Error(`${label} is a categorical axis, which has no numeric window to move to; drop this side`)
    }

    if (window.length !== 2) {
        throw new Error(`${label} must be a [low, high] pair; got ${window.length} values`)
    }
    const [low, high] = window

    if (!Number.isFinite(low) || !Number.isFinite(high)) {
        return unusable_window(`${label} must be finite numbers; got [${low}, ${high}]`)
    }

    if (low >= high) {
        return unusable_window(`${label} must run low to high; got [${low}, ${high}]`)
    }

    if (axis.kind === 'log' && low <= 0) {
        return unusable_window(`${label} must be above zero on a log axis; got [${low}, ${high}]`)
    }
    return [low, high]
}

/**
 * Report a window the plot can't use and drop it. The template is memoized on the args hash, so a window
 * that's stuck bad warns once rather than once per render.
 * @param message - what's wrong with the window
 * @returns UNUSABLE, the signal that the whole request should be dropped
 */
function unusable_window(message: string): typeof UNUSABLE {
    console.warn(`${message} — viewport not applied`)
    return UNUSABLE
}

/**
 * Validate width, height, and margin.
 * @param args - the plot args
 * @returns the validated args
 */
function validate_dimensions<TooltipContent>(args: PlotArgs<TooltipContent>): PlotArgs<TooltipContent> {
    if (args.width !== undefined) {
        validate_positive(args.width, 'plot: width')
    }

    if (args.height !== undefined) {
        validate_positive(args.height, 'plot: height')
    }
    validate_margin(args.margin)
    return args
}

/**
 * Validate the margin: a number applies to all four sides, an object per side. Every value must be non-negative.
 * @param margin - the margin arg, or undefined
 */
function validate_margin(margin: Margin | undefined): void {
    if (margin === undefined) {
        return
    }

    if (typeof margin === 'number') {
        validate_non_negative(margin, 'plot: margin')
        return
    }

    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        const value = margin[side]

        if (value !== undefined) {
            validate_non_negative(value, `plot: margin.${side}`)
        }
    }
}

/**
 * Resolve an optional label: an explicit empty string opts out, otherwise the explicit value wins over the fallback
 * @param explicit - caller label, if any
 * @param fallback - derived default, used when no explicit label is given
 * @returns the label, or undefined
 */
export function resolve_label(explicit: string | undefined, fallback?: string): string | undefined {
    // explicit empty string is an intentional opt-out
    if (explicit === '') {
        return undefined
    }
    return explicit ?? fallback
}

/**
 * Split a title arg into its parts: a bare string is just text, an object carries text plus size / color.
 * @param title - the title arg, or undefined
 * @returns the text, size, and color (any of which may be undefined)
 */
function normalize_title(title: TitleArg | undefined): { text: string | undefined; size: number | undefined; color: ThemeColor | undefined } {
    if (title === undefined || typeof title === 'string') {
        return { text: title, size: undefined, color: undefined }
    }
    return { text: title.text, size: title.size, color: title.color }
}
