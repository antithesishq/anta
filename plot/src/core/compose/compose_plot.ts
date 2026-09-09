import { scaleBand, scaleLinear, scaleLog, scaleTime, scaleUtc } from "d3-scale"
import type { AxisTemplate, ColorTheme, ComposedPlot, ComposedSeries, Domain, PlotTemplate, Scale, Series, Viewport } from "../types"
import { resolve_plot_background, resolve_series_colors, resolve_theme_color, should_invert_color } from "../template/color"
import { clamp_domain, LINEAR_SPACE, LOG_SPACE } from "../template/domain"
import { series_type } from "../registry"
import { linear_tick_count, X_TICK_PX_TARGET, Y_TICK_PX_TARGET } from "../render/axes"
import { inner_rect, resolve_layout } from "./layout"

/**
 * Turns a PlotTemplate into a renderable Plot
 * @param template - dimension-independent plot template
 * @param width - canvas width in CSS pixels
 * @param height - canvas height in CSS pixels
 * @param color_theme - the current browser color scheme
 * @param viewport - optional per-axis zoom/pan viewport; null on an axis uses the full domain
 * @returns the ComposedPlot with layout, scales, and color theme resolved series
 */
export function compose_plot<TooltipContent = unknown>(template: PlotTemplate<TooltipContent>, width: number, height: number, color_theme: ColorTheme, viewport?: Viewport): ComposedPlot<TooltipContent> {
    const layout = resolve_layout(
        width,
        height,
        template.x.rendered,
        template.y.rendered,
        template.title !== undefined,
        template.margin,
    )
    const x_range = pad_range([layout.margin_left, layout.width - layout.margin_right], template.x)
    const y_range = pad_range([layout.height - layout.margin_bottom, layout.margin_top], template.y)

    const x_tick_count = linear_tick_count(layout.width - layout.margin_left - layout.margin_right, X_TICK_PX_TARGET)
    const y_tick_count = linear_tick_count(layout.height - layout.margin_top - layout.margin_bottom, Y_TICK_PX_TARGET)

    const x_base_scale = build_scale(template.x, x_range, x_tick_count) // base scales are the original scalesunaffected by zoom/pan
    const y_base_scale = build_scale(template.y, y_range, y_tick_count)

    const x_full_domain = full_domain(template.x, x_base_scale)
    const y_full_domain = full_domain(template.y, y_base_scale)

    const x_override = clamp_window(viewport?.x ?? null, x_full_domain, template.x)
    const y_override = clamp_window(viewport?.y ?? null, y_full_domain, template.y)
    const x_scale = x_override === null ? x_base_scale : build_scale(apply_viewport(template.x, x_override), x_range, x_tick_count)
    const y_scale = y_override === null ? y_base_scale : build_scale(apply_viewport(template.y, y_override), y_range, y_tick_count)

    const chrome_theme = should_invert_color(template) ? 'light' : color_theme
    const chrome_color = template.chrome_color === undefined ? undefined : resolve_theme_color(template.chrome_color, chrome_theme)

    return {
        layout,
        inner: inner_rect(layout),
        x_scale,
        y_scale,
        x_full_domain,
        y_full_domain,
        series: template.series.map(s => compose_series(s, color_theme, x_scale, y_scale)),
        x_axis: template.x.rendered ? template.x.axis : undefined,
        y_axis: template.y.rendered ? template.y.axis : undefined,
        x_categories: template.x.kind === 'category' ? template.x.categories : undefined,
        y_categories: template.y.kind === 'category' ? template.y.categories : undefined,
        title: template.title,
        title_size: template.title_size,
        title_color: template.title_color,
        border: template.border,
        grid: template.grid,
        background: resolve_plot_background(template.background, color_theme),
        chrome_theme,
        chrome_color,
    }
}

/**
 * Compose one series: resolve its theme colors, then let its kind precompute any pixel geometry that needs the scales.
 * @param series - the template series
 * @param color_theme - the browser color scheme to resolve colors against
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @returns the composed series
 */
function compose_series<TooltipContent>(series: Series<TooltipContent>, color_theme: ColorTheme, x_scale: Scale, y_scale: Scale): ComposedSeries<TooltipContent> {
    const composed = resolve_series_colors(series, color_theme)
    const compose_layout = series_type<TooltipContent>(series.kind).compose_layout

    if (compose_layout === undefined) {
        return composed
    }
    return compose_layout(composed, x_scale, y_scale)
}

/**
 * Pad a continuous axis's pixel range by its per-end padding, shrinking it toward the middle so a mark at an endpoint clears the plot border.
 * @param range - the base pixel range [min-end, max-end] from the layout margins
 * @param template - the resolved axis template
 * @returns the padded range
 */
function pad_range(range: [number, number], template: AxisTemplate): [number, number] {
    const span = Math.abs(range[1] - range[0])
    let padding_min = template.padding_min
    let padding_max = template.padding_max
    const total = padding_min + padding_max

    // keep a sliver of range so the scale can't collapse or flip on oversized padding
    if (total > 0 && total >= span) {
        const scale = (span * 0.9) / total
        padding_min *= scale
        padding_max *= scale
    }
    const direction = Math.sign(range[1] - range[0]) || 1
    const padded_min = range[0] + direction * padding_min
    const padded_max = range[1] - direction * padding_max

    return [padded_min, padded_max]
}

function clamp_window(window: Domain | null, full: Domain | null, axis: AxisTemplate): Domain | null {
    if (window === null || full === null) {
        return null
    }
    const space = axis.kind === 'log' ? LOG_SPACE : LINEAR_SPACE
    const clamped = clamp_domain([space.to(window[0]), space.to(window[1])], [space.to(full[0]), space.to(full[1])])

    return clamped === null ? null : [space.from(clamped[0]), space.from(clamped[1])]
}

/**
 * Fold a per-axis zoom/pan override into the axis template: pin the domain to the chosen window and disable nicing.
 * Absent overrides and categorical axes pass through unchanged, so only continuous axes ever zoom or pan.
 */
function apply_viewport(axis: AxisTemplate, override: Domain | null | undefined): AxisTemplate {
    if (override === null || override === undefined || axis.kind === 'category') {
        return axis
    }

    return { ...axis, domain: override, nice_min: false, nice_max: false }
}

/**
 * The full (unzoomed) continuous domain [min, max] of an axis, read off its full scale so nicing is included.
 */
function full_domain(axis: AxisTemplate, full_scale: { domain(): (number | Date)[] }): Domain | null {
    if (axis.kind === 'category') {
        return null
    }
    const domain = full_scale.domain()
    return [Number(domain[0]), Number(domain[domain.length - 1])]
}

/**
 * Builds the only d3 scales in the plot. Linear and log nice each auto min/max while preserving any pinned one; category uses a band scale.
 * @param axis_template - resolved axis template with kind, domain, and padding
 * @param range - pixel range [start, end] for the scale
 * @returns the constructed d3 scale for the axis
 */
function build_scale(axis_template: AxisTemplate, range: [number, number], tick_count: number): ComposedPlot['x_scale'] {
    if (axis_template.kind === 'linear') {
        const scale = scaleLinear().domain(axis_template.domain).range(range)
        nice_continuous(scale, axis_template.nice_min, axis_template.nice_max, tick_count)
        return scale
    }

    if (axis_template.kind === 'log') {
        const scale = scaleLog().domain(axis_template.domain).range(range)
        nice_continuous(scale, axis_template.nice_min, axis_template.nice_max)
        return scale
    }

    if (axis_template.kind === 'time') {
        const construct = axis_template.utc ? scaleUtc : scaleTime
        const scale = construct().domain(axis_template.domain).range(range)
        nice_continuous(scale, axis_template.nice_min, axis_template.nice_max)
        return scale
    }
    const indices: number[] = []

    for (let i = 0; i < axis_template.categories.length; i++) {
        indices.push(i)
    }
    return scaleBand<number>()
        .domain(indices)
        .range(range)
}

type NiceableScale<D extends number | Date> = {
    domain(): D[]
    domain(domain: Iterable<D>): NiceableScale<D>
    nice(count?: number): NiceableScale<D>
}

/**
 * Applies d3's nice() in place to round unpinned min/max to human friendly round numbers (calendar boundaries for time).
 * @param scale - linear, log, or time scale to nice
 * @param nice_min - whether the min endpoint may be rounded
 * @param nice_max - whether the max endpoint may be rounded
 */
function nice_continuous<D extends number | Date>(scale: NiceableScale<D>, nice_min: boolean, nice_max: boolean, count?: number): void {
    if (!nice_min && !nice_max) {
        return
    }
    const [orig_min, orig_max] = scale.domain()
    scale.nice(count)
    const [niced_min, niced_max] = scale.domain()
    scale.domain([nice_min ? niced_min : orig_min, nice_max ? niced_max : orig_max])
}
