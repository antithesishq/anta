import type { Axis, AxisArgs, AxisContext, AxisScale, AxisTemplate, CategoryAxisTemplate, Domain, LabelPosition, LinearAxisTemplate, LogarithmicAxisTemplate, PlotArgs, Series, ThemeColor, TimeAxisTemplate } from "../types"
import { compute_domains, needs_auto } from "./domain"
import { resolve_label } from "./plot_template"
import { validate_finite, validate_non_negative, validate_optional } from "./validate"
import { series_type } from "../registry"

// scaleLog requires positive domains. Non-positive values clamp to this floor with a warn.
const LOG_DOMAIN_FLOOR = 1

// per-axis resolution at template stage. Turns an Axis spec into an AxisTemplate plus
// per-series translation tables. dimension-independent, no scales or ranges.

// translations[i]: null means no remap (local matches axis prefix). Int32Array remaps local
// category index to canonical, with -1 marking unknowns to drop. Undefined for linear axes.
type AxisTemplateResolution = {
    axis_template: AxisTemplate
    translations?: (Int32Array | null)[]
}

/**
 * Resolve both axes end to end: validate and classify, compute auto domains, and build each
 * AxisTemplate plus its per-series translations.
 * @param series - the series
 * @param axis - the caller's axis declaration
 * @returns the resolved x and y axis templates and translations
 */
export function build_resolved_axes(series: Series[], axis: PlotArgs['axis']): { x_resolved: AxisTemplateResolution; y_resolved: AxisTemplateResolution } {
    const { x_axis, y_axis } = validate_and_build_axes_context(series, axis)
    const auto_domains = compute_auto_domains(series, x_axis, y_axis)

    return {
        x_resolved: resolve_axis_template(x_axis, series, 'x', auto_domains.x),
        y_resolved: resolve_axis_template(y_axis, series, 'y', auto_domains.y),
    }
}

/**
 * Auto-computed domains for linear/log sides. Skips the data scan when both sides are categorical or
 * fully pinned, returning a placeholder [0, 1] that resolve_axis_template won't read.
 * @param series - the series
 * @param x_axis - resolved x axis context
 * @param y_axis - resolved y axis context
 * @returns per-side auto domain
 */
function compute_auto_domains(series: Series[], x_axis: AxisContext, y_axis: AxisContext): { x: Domain; y: Domain } {
    const x_needs_auto = !x_axis.is_category && needs_auto(x_axis.args)
    const y_needs_auto = !y_axis.is_category && needs_auto(y_axis.args)

    if (x_needs_auto || y_needs_auto) {
        return compute_domains(series, x_axis.padding_mode, y_axis.padding_mode)
    }
    return { x: [0, 1] as Domain, y: [0, 1] as Domain }
}

/**
 * Validate and classify both axes before per-side template resolution. Builds each side, then runs
 * the cross-axis series-kind hooks (which compare both sides). Throws on any conflict.
 * @param series - the series
 * @param axis - the caller's axis declaration
 * @returns the resolved x and y axes (kind, rendered, label, scale, padding mode)
 */
function validate_and_build_axes_context(series: Series[], axis: PlotArgs['axis']): { x_axis: AxisContext; y_axis: AxisContext } {
    const x_axis = build_axis_side(series, axis?.x ?? {}, 'x')
    const y_axis = build_axis_side(series, axis?.y ?? {}, 'y')

    // cross-axis: these hooks compare both sides (e.g. bar needs exactly one band axis)
    for (let i = 0; i < series.length; i++) {
        series_type(series[i].kind).validate_axes?.(x_axis, y_axis, series[i], i)
    }

    apply_padding_modes(series, x_axis, y_axis)

    return { x_axis, y_axis }
}

/**
 * Flatten the overloaded axis input into the internal flat Axis
 * @param input - the caller's axis args
 * @returns the normalized flat axis
 */
function normalize_axis(input: AxisArgs): Axis {
    const { label, tick_label, ...rest } = input
    const label_parts = normalize_axis_label(label)

    return {
        ...rest,
        ...label_parts,
        tick_label_format: tick_label?.format,
        tick_label_size: tick_label?.size,
        tick_label_color: tick_label?.color,
    }
}

// Split the label arg: a bare string is just text; an object carries text plus size / color / position.
function normalize_axis_label(label: AxisArgs['label']): { label?: string; label_size?: number; label_color?: ThemeColor; label_position?: LabelPosition } {
    if (label === undefined) {
        return {}
    }

    if (typeof label === 'string') {
        return { label }
    }
    return { label: label.text, label_size: label.size, label_color: label.color, label_position: label.position }
}

/**
 * Build one side's resolved context: reconcile the declared/inferred kind, reject an incoherent
 * scale, and derive the rendered flag, label, scale, and seeded padding. Throws on conflict.
 * @param series - the series
 * @param input - the caller's axis spec for this side
 * @param side - axis side
 * @returns the resolved axis context (padding seeded to 'default', overridden later)
 */
function build_axis_side(series: Series[], input: AxisArgs, side: 'x' | 'y'): AxisContext {
    const args = normalize_axis(input)
    validate_label_position(args, side)

    // category declared by `scale: 'category'` or by a `categories` pin
    const declared_category = args.scale === 'category' || args.categories !== undefined

    // scale inference fires when the caller didn't pin a scale
    const scale_unset = args.scale === undefined
    const is_category = declared_category || reconcile_axis_kind(series, side, scale_unset, declared_category)

    // a categorical axis can't have a numeric scale
    if (is_category) {
        validate_category_scale_coherence(args, side)
    }

    if (!is_category && args.grid_align !== undefined) {
        throw new Error(`axis.${side}: grid_align is only valid on a categorical axis; remove it or set scale: 'category'.`)
    }

    validate_padding_orientation(args, side)

    // padding set to 'default'; apply_padding_modes will override once both axes have been resolved
    return {
        is_category,
        rendered: !args.hidden,
        field_label: common_field(series, side),
        scale: resolve_scale(args, is_category),
        padding_mode: 'default',
        args,
    }
}

/**
 * Reject pixel padding named for the wrong orientation: the x axis pads left / right, the y axis top / bottom.
 * Applies to both continuous and categorical axes.
 * @param args - the axis spec
 * @param side - axis side
 */
function validate_padding_orientation(args: Axis, side: 'x' | 'y'): void {
    if (side === 'x' && (args.padding_top !== undefined || args.padding_bottom !== undefined)) {
        throw new Error(`axis.x: padding_top / padding_bottom apply to the y axis; use padding_left / padding_right (or padding for both ends) on x.`)
    }

    if (side === 'y' && (args.padding_left !== undefined || args.padding_right !== undefined)) {
        throw new Error(`axis.y: padding_left / padding_right apply to the x axis; use padding_top / padding_bottom (or padding for both ends) on y.`)
    }
}

/**
 * Reject a label_position that doesn't match the axis orientation: the x axis reads left / right, the y axis top / bottom.
 * @param args - the axis spec
 * @param side - axis side
 */
function validate_label_position(args: Axis, side: 'x' | 'y'): void {
    const position = args.label_position

    if (position === undefined || position === 'center') {
        return
    }
    const allowed = side === 'x' ? ['left', 'right'] : ['top', 'bottom']

    if (!allowed.includes(position)) {
        const allowed_list = allowed.map(value => `'${value}'`).join(' / ')
        throw new Error(`axis.${side}: label.position '${position}' is invalid for the ${side} axis; use 'center' or ${allowed_list}.`)
    }
}

/**
 * The resolved scale kind: a categorical axis is 'category', otherwise the declared 'log' or the 'linear' default.
 * @param axis_args - the axis spec
 * @param is_category - whether the side resolved to categorical
 * @returns the resolved scale
 */
function resolve_scale(axis_args: Axis, is_category: boolean): AxisScale {
    if (is_category) {
        return 'category'
    }

    if (axis_args.scale === 'log') {
        return 'log'
    }

    if (axis_args.scale === 'time' || axis_args.scale === 'utc') {
        return axis_args.scale
    }
    return 'linear'
}

/**
 * Apply each side's domain padding mode in place: series-kind overrides (e.g. bar anchors at zero),
 * then a log scale forces pass-through. padding_mode is seeded to 'default' by the caller.
 * @param series - the series
 * @param x_axis_ctx - the resolved x axis
 * @param y_axis_ctx - the resolved y axis
 */
function apply_padding_modes(series: Series[], x_axis_ctx: AxisContext, y_axis_ctx: AxisContext): void {
    for (const series_item of series) {
        const series_padding = series_type(series_item.kind).padding_mode?.(x_axis_ctx, y_axis_ctx)

        if (series_padding?.x !== undefined) {
            x_axis_ctx.padding_mode = series_padding.x
        }

        if (series_padding?.y !== undefined) {
            y_axis_ctx.padding_mode = series_padding.y
        }
    }

    if (x_axis_ctx.scale === 'log') {
        x_axis_ctx.padding_mode = 'log'
    }

    if (y_axis_ctx.scale === 'log') {
        y_axis_ctx.padding_mode = 'log'
    }
}

/**
 * The field name shared by every series on a side, or undefined when they disagree or any series used an accessor. Drives the default axis label. Series that sit the axis out are skipped, so a rule doesn't cost the other series their label.
 * @param series - the series
 * @param side - axis side
 * @returns the shared field name, or undefined
 */
function common_field(series: Series[], side: 'x' | 'y'): string | undefined {
    let common: string | undefined

    for (let i = 0; i < series.length; i++) {
        if (!claims_axis(series[i], side)) {
            continue
        }
        const field = side === 'x' ? series[i].x_field : series[i].y_field

        if (field === undefined) {
            return undefined
        }

        if (common !== undefined && field !== common) {
            return undefined
        }
        common = field
    }
    return common
}

/**
 * Whether a series constrains an axis at all. A series with no rows has nothing on either side, and a series
 * that resolved only one column (a rule, which is a single value spanning the other axis) makes no claim on
 * the axis it spans: it contributes no categories, needs no category remap, and isn't held to the axis' kind.
 * @param series_item - the series
 * @param side - axis side
 * @returns true when the series has values on this side
 */
function claims_axis(series_item: Series, side: 'x' | 'y'): boolean {
    if (series_item.x.length === 0) {
        return false
    }
    const axis_kind = side === 'x' ? series_item.x_axis_kind : series_item.y_axis_kind
    return axis_kind !== undefined
}

/**
 * Reject a categorical axis combined with a linear or log scale.
 * @param axis_args - the called defined axis args
 * @param side - axis side, for the error message
 */
function validate_category_scale_coherence(axis_args: Axis, side: 'x' | 'y'): void {
    if (axis_args.scale === 'linear' || axis_args.scale === 'log' || axis_args.scale === 'time' || axis_args.scale === 'utc') {
        throw new Error(`axis.${side}: scale: '${axis_args.scale}' conflicts with the categories pin (categories require scale: 'category'). Drop one.`)
    }
}

/**
 * Reconcile one side's detected axis kind against the caller's declaration, inferring implicit
 * category. Throws when string data collides with a declared numeric scale.
 * @param series - the series
 * @param side - axis side
 * @param scale_unset - whether axis.<side>.scale was omitted
 * @param declared_category - whether the side was declared categorical
 * @returns whether the side is implicitly categorical
 */
function reconcile_axis_kind(series: Series[], side: 'x' | 'y', scale_unset: boolean, declared_category: boolean): boolean {
    let implicit_category = false

    for (let i = 0; i < series.length; i++) {
        const s = series[i]
        const kind = side === 'x' ? s.x_axis_kind : s.y_axis_kind

        if (kind !== 'categorical') {
            continue
        }

        if (!scale_unset && !declared_category) {
            throw new Error(`plot: series at index ${i} has a string-valued ${side} column but axis.${side}.scale is declared as a non-categorical scale ('linear', 'log', 'time', or 'utc'). Either remove the scale declaration on axis.${side} (plot will infer 'category'), set axis.${side}.scale to 'category' explicitly, or pass numeric ${side} values to plot.${s.kind}.`)
        }

        if (scale_unset) {
            implicit_category = true
        }
    }
    return implicit_category
}

/**
 * Resolve one axis's context into an AxisTemplate, plus per-series translations for categorical
 * @param axis - the resolved axis context (carries the spec, scale, rendered, label)
 * @param series - the series, for category collection
 * @param side - axis side
 * @param auto - auto-computed domain for linear/log
 * @returns the resolved axis template and any translations
 */
function resolve_axis_template(
    axis: AxisContext,
    series: Series[],
    side: 'x' | 'y',
    auto: Domain,
): AxisTemplateResolution {
    const padding = resolve_continuous_padding(axis.args, side)

    if (axis.scale === 'category') {
        return resolve_categorical(axis.args, series, side, axis.rendered, axis.field_label, padding)
    }

    if (axis.scale === 'log') {
        return resolve_logarithmic(axis.args, auto, side, axis.rendered, axis.field_label, padding)
    }

    if (axis.scale === 'time' || axis.scale === 'utc') {
        return resolve_time(axis.args, auto, axis.scale === 'utc', axis.rendered, axis.field_label, padding)
    }
    return resolve_linear(axis.args, auto, axis.rendered, axis.field_label, padding)
}

// pixel padding per end of a continuous axis.
type ContinuousPadding = { padding_min: number; padding_max: number }

function resolve_continuous_padding(axis_in: Axis, side: 'x' | 'y'): ContinuousPadding {
    const both = validate_optional(axis_in.padding, validate_non_negative, `plot: axis.${side}.padding`)

    let min_key: number | undefined
    let max_key: number | undefined
    let min_label: string
    let max_label: string

    if (side === 'x') {
        min_key = axis_in.padding_left
        max_key = axis_in.padding_right
        min_label = 'padding_left'
        max_label = 'padding_right'
    } else {
        min_key = axis_in.padding_bottom
        max_key = axis_in.padding_top
        min_label = 'padding_bottom'
        max_label = 'padding_top'
    }
    const padding_min = validate_optional(min_key, validate_non_negative, `plot: axis.${side}.${min_label}`)
    const padding_max = validate_optional(max_key, validate_non_negative, `plot: axis.${side}.${max_label}`)

    return {
        padding_min: padding_min ?? both ?? 0,
        padding_max: padding_max ?? both ?? 0,
    }
}

/**
 * Validate that any pinned min/max is finite and return the pinned bounds.
 * @param axis_in - the axis spec
 * @returns the pinned bounds, each undefined when the caller left it auto
 */
function validate_finite_bounds(axis_in: Axis): { min?: number, max?: number } {
    return {
        min: validate_optional(axis_in.min, validate_finite, 'plot: axis.min'),
        max: validate_optional(axis_in.max, validate_finite, 'plot: axis.max'),
    }
}

/**
 * Resolve a time axis, niced to calendar boundaries at compose. utc picks the d3 scale (scaleUtc vs scaleTime).
 * @param axis_in - the time axis spec
 * @param auto - auto-computed domain in epoch ms
 * @param utc - true for scale 'utc', false for local 'time'
 * @param rendered - whether the axis paints
 * @param auto_label - derived default label
 * @returns the resolved axis template
 */
function resolve_time(axis_in: Axis, auto: Domain, utc: boolean, rendered: boolean, auto_label: string | undefined, padding: ContinuousPadding): AxisTemplateResolution {
    const { min, max } = validate_finite_bounds(axis_in)

    const axis_template: TimeAxisTemplate = {
        kind: 'time',
        domain: [min ?? auto[0], max ?? auto[1]],
        utc,
        rendered,
        nice_min: min === undefined,
        nice_max: max === undefined,
        padding_min: padding.padding_min,
        padding_max: padding.padding_max,
    }

    if (rendered) {
        axis_template.axis = with_label(axis_in, auto_label)
    }
    return { axis_template }
}

function resolve_linear(axis_in: Axis, auto: Domain, rendered: boolean, auto_label: string | undefined, padding: ContinuousPadding): AxisTemplateResolution {
    const { min, max } = validate_finite_bounds(axis_in)

    const axis_template: LinearAxisTemplate = {
        kind: 'linear',
        domain: [min ?? auto[0], max ?? auto[1]],
        rendered,
        // an auto endpoint nices, a pinned one is preserved exactly
        nice_min: min === undefined,
        nice_max: max === undefined,
        padding_min: padding.padding_min,
        padding_max: padding.padding_max,
    }

    if (rendered) {
        axis_template.axis = with_label(axis_in, auto_label)
    }
    return { axis_template }
}

/**
 * Resolve a log axis. scaleLog needs positive domains, so non-positive bounds clamp to the floor with a warn (pinned non-positive throws).
 * @param axis_in - the axis spec
 * @param auto - auto-computed domain
 * @param side - axis side, for messages
 * @param rendered - whether the axis paints
 * @param auto_label - derived default label
 * @returns the resolved axis template
 */
function resolve_logarithmic(axis_in: Axis, auto: Domain, side: 'x' | 'y', rendered: boolean, auto_label: string | undefined, padding: ContinuousPadding): AxisTemplateResolution {
    const { min, max } = validate_finite_bounds(axis_in)

    const raw_min = min ?? auto[0]
    const raw_max = max ?? auto[1]
    const min_resolved = resolve_log_bound(raw_min, min !== undefined, side, 'min')
    const max_resolved = resolve_log_bound(raw_max, max !== undefined, side, 'max')

    if (min_resolved.clamped && max_resolved.clamped) {
        throw new Error(`plot: axis.${side} has no positive data values for log scale (all rows non-positive). Filter the data, switch to a linear scale, or pin axis.${side}.{min,max} to positive values.`)
    }

    if (min_resolved.value === max_resolved.value) {
        throw new Error(`plot: axis.${side} resolved to a degenerate log domain [${min_resolved.value}, ${max_resolved.value}]. Either filter the data or pin the endpoints to a non-degenerate positive range.`)
    }
    const axis_template: LogarithmicAxisTemplate = {
        kind: 'log',
        domain: [min_resolved.value, max_resolved.value],
        rendered,
        nice_min: min === undefined,
        nice_max: max === undefined,
        padding_min: padding.padding_min,
        padding_max: padding.padding_max,
    }

    if (rendered) {
        axis_template.axis = with_label(axis_in, auto_label)
    }
    return { axis_template }
}

/**
 * Attach the resolved axis name: explicit caller label wins, empty string suppresses it, else the derived label.
 * @param axis_in - the axis spec
 * @param auto_label - derived default label
 * @returns the axis spec with its label resolved
 */
function with_label(axis_in: Axis, auto_label: string | undefined): Axis {
    return { ...axis_in, label: resolve_label(axis_in.label, auto_label) }
}

/**
 * Resolve one log-scale endpoint. Positive passes through; non-positive throws when pinned, else clamps to the floor with a warn.
 * @param value - the raw endpoint
 * @param pinned - whether the caller pinned it
 * @param side - axis side, for messages
 * @param end - which endpoint
 * @returns the resolved value and whether it was clamped
 */
function resolve_log_bound(value: number, pinned: boolean, side: 'x' | 'y', end: 'min' | 'max'): { value: number; clamped: boolean } {
    if (value > 0) {
        return { value, clamped: false }
    }

    // pinned non-positive throws, auto-computed clamps and warns
    if (pinned) {
        throw new Error(`plot: axis.${side}.${end} = ${value} is not positive; log scale requires positive domains. Drop the pin or pass a positive value.`)
    }
    console.warn(`plot: auto-computed ${side} ${end} = ${value} is not positive; clamped to ${LOG_DOMAIN_FLOOR} for log scale. Either filter non-positive rows from the data or pin axis.${side}.${end} to a positive value.`)
    return { value: LOG_DOMAIN_FLOOR, clamped: true }
}

/**
 * Resolve a categorical axis. A pinned axis.categories is canonical, otherwise collect first-seen across series. Pinned categories absent from all series render as empty bands.
 * @param axis_in - the category axis spec
 * @param series - the series
 * @param side - axis side
 * @param rendered - whether the axis paints
 * @param auto_label - derived default label
 * @param padding - the pixel padding per end of the band range
 * @returns the resolved axis template and per-series translations
 */
function resolve_categorical(
    axis_in: Axis,
    series: Series[],
    side: 'x' | 'y',
    rendered: boolean,
    auto_label: string | undefined,
    padding: ContinuousPadding,
): AxisTemplateResolution {
    const { pinned, axis_categories, category_index } = seed_axis_categories(axis_in)

    require_categorical_columns(series, side)

    if (!pinned) {
        append_series_categories(series, side, axis_categories, category_index)
    }
    const translations = build_translations(series, side, axis_categories, category_index)

    const axis_template: CategoryAxisTemplate = {
        kind: 'category',
        categories: axis_categories,
        rendered,
        padding_min: padding.padding_min,
        padding_max: padding.padding_max,
    }

    if (rendered) {
        axis_template.axis = {
            ...with_label(axis_in, auto_label),
            scale: 'category',
            categories: axis_categories,
        }
    }
    return { axis_template, translations }
}

/**
 * Seed the canonical category list from the caller's pin (deduped), empty when unpinned and filled later by the series walk.
 * @param axis_in - the category axis spec
 * @returns whether pinned, the seeded categories, and their index map
 */
function seed_axis_categories(axis_in: Axis): { pinned: boolean; axis_categories: string[]; category_index: Map<string, number> } {
    const pinned = axis_in.categories !== undefined
    // defensive copy and dedup so caller mutations don't leak
    const axis_categories: string[] = pinned ? [...new Set(axis_in.categories!)] : []
    const category_index = new Map<string, number>()

    for (let i = 0; i < axis_categories.length; i++) {
        category_index.set(axis_categories[i], i)
    }
    return { pinned, axis_categories, category_index }
}

/**
 * Assert every series carries categorical data on this side, throwing otherwise.
 * @param series - the series
 * @param side - axis side
 */
function require_categorical_columns(series: Series[], side: 'x' | 'y'): void {
    for (let i = 0; i < series.length; i++) {
        const series_item = series[i]

        if (!claims_axis(series_item, side)) {
            continue
        }
        const categories = side === 'x' ? series_item.x_categories : series_item.y_categories

        if (categories === undefined || categories.length === 0) {
            throw new Error(`plot: axis.${side} is declared as 'category' but series at index ${i} has numeric ${side} values. Either pass string ${side} values, or declare axis.${side} as 'linear' (or omit the type declaration).`)
        }
    }
}

/**
 * Append first-seen series categories into the shared list (mutating). Only called when unpinned.
 * @param series - the series
 * @param side - axis side
 * @param axis_categories - the canonical list to grow
 * @param category_index - the category-to-index map to grow
 */
function append_series_categories(
    series: Series[],
    side: 'x' | 'y',
    axis_categories: string[],
    category_index: Map<string, number>,
): void {
    for (let i = 0; i < series.length; i++) {
        const series_item = series[i]

        // a series that sits this axis out contributes no categories to collect
        if (!claims_axis(series_item, side)) {
            continue
        }
        const categories = (side === 'x' ? series_item.x_categories : series_item.y_categories)!

        for (const category of categories) {
            if (category_index.has(category)) {
                continue
            }
            category_index.set(category, axis_categories.length)
            axis_categories.push(category)
        }
    }
}

/**
 * Build each series' local to axis category index map, or null when they already match. Unknown categories map to -1.
 * @param series - the series
 * @param side - axis side
 * @param axis_categories - canonical category order
 * @param category_index - category-to-index map
 * @returns per-series translation tables
 */
function build_translations(
    series: Series[],
    side: 'x' | 'y',
    axis_categories: string[],
    category_index: Map<string, number>,
): (Int32Array | null)[] {
    const translations: (Int32Array | null)[] = []

    for (let i = 0; i < series.length; i++) {
        const series_item = series[i]

        // nothing to remap for a series that sits this axis out
        if (!claims_axis(series_item, side)) {
            translations.push(null)
            continue
        }
        const categories = side === 'x' ? series_item.x_categories! : series_item.y_categories!

        // fast path: local already matches axis prefix, no remap
        if (matches_prefix(categories, axis_categories)) {
            translations.push(null)
            continue
        }
        const translation_map = new Int32Array(categories.length)
        const unknown_categories: string[] = []

        // -1 marks an unknown category, dropped per-row by build_resolved_series
        for (let j = 0; j < categories.length; j++) {
            const index = category_index.get(categories[j])

            if (index === undefined) {
                translation_map[j] = -1
                unknown_categories.push(categories[j])
            } else {
                translation_map[j] = index
            }
        }

        if (unknown_categories.length > 0) {
            const noun = unknown_categories.length === 1 ? 'category' : 'categories'
            console.warn(`plot: series at index ${i} has ${side} ${noun} not in caller-pinned axis.${side}.categories: ${unknown_categories.map(category => `'${category}'`).join(', ')} — rows with these ${noun} will be dropped.`)
        }
        translations.push(translation_map)
    }
    return translations
}

/**
 * Whether the local categories are a prefix of the canonical order, the fast path that needs no remap.
 * @param local - the series' local categories
 * @param axis_categories - canonical category order
 * @returns true when local matches the canonical prefix
 */
function matches_prefix(local: string[], axis_categories: string[]): boolean {
    if (local.length > axis_categories.length) {
        return false
    }

    for (let i = 0; i < local.length; i++) {
        if (local[i] !== axis_categories[i]) {
            return false
        }
    }
    return true
}
