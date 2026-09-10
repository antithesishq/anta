// shared per-row color resolution. `color` arg accepts two shapes:
//   string | { light, dark }   uniform for every row (a ThemeColor)
//   (row, i) => ThemeColor      accessor called per row
// per-row `color` field on data overrides the series-level shape for that row.
// renderer fallback chain: colors[i], color, DEFAULT_SERIES_COLOR.

import { validate_non_negative } from "./validate"
import type { ColorArg, ColorTheme, Stroke, StrokeArg, ThemeColor } from "../types"

const DEFAULT_BACKGROUND = '#fff'
export const DEFAULT_SERIES_COLOR = '#000'

/**
 * Whether the plot's canvas gets the dark-mode CSS invert: an explicit theme_invert wins, otherwise the
 * plot inverts unless its series or background already carry theme-specific ({ light, dark }) colors.
 * @param template - the plot template
 * @returns true when the canvas is CSS-inverted in dark mode
 */
type ColorBearingSeries = {
    color?: ThemeColor
    colors?: (ThemeColor | null)[]
    stroke?: Stroke
}

type ColorTemplate = {
    series: ColorBearingSeries[]
    background?: boolean | ThemeColor
    theme_invert?: boolean
}

export function should_invert_color(template: ColorTemplate): boolean {
    const themes_own_colors = series_have_theme_color_pair(template.series) || background_is_theme_color_pair(template.background)
    return template.theme_invert ?? !themes_own_colors
}

/**
 * Resolve a plot's `background` for the theme: false = paint none, true / undefined = the default fill color,
 * a ThemeColor = a concrete fill color (a { light, dark } pair collapses to the theme's variant).
 * @param background - the plot background arg
 * @param theme - the current browser color scheme
 * @returns false (paint none) or a concrete color string
 */
export function resolve_plot_background(background: boolean | ThemeColor | undefined, theme: ColorTheme): string | false {
    if (background === undefined) {
        return DEFAULT_BACKGROUND
    }

    if (typeof background === 'boolean') {
        return background ? DEFAULT_BACKGROUND : false
    }
    return resolve_theme_color(background, theme)
}

/**
 * Whether a plot background is a { light, dark } pair, so the plot owns its theming and opts out of the
 * dark-mode auto-invert (a plain string stays invertible, like a plain series color).
 * @param background - the plot background arg
 * @returns true when background is a light/dark pair
 */
export function background_is_theme_color_pair(background: boolean | ThemeColor | undefined): boolean {
    return is_light_dark_color_pair(background)
}

type ColorFields = {
    color?: ThemeColor
    colors?: (ThemeColor | null)[]
}

type ResolvedColorFields = {
    color?: string
    colors?: (string | null)[]
    stroke?: { color: string; width?: number }
}

type WithResolvedColors<S> = S extends unknown ? Omit<S, keyof ResolvedColorFields> & ResolvedColorFields : never

/**
 * Resolve per-row colors. A per-row `color` field wins, then the series arg (ThemeColor or accessor).
 * @param data - the data rows
 * @param arg - uniform ThemeColor, per-row accessor, or undefined
 * @returns the color and/or per-row colors to attach to the series
 */
export function resolve_color(
    data: Record<string, unknown>[],
    arg: ColorArg | undefined,
): ColorFields {
    const has_per_item = data.some(r => is_theme_color(r.color))
    const is_accessor = typeof arg === 'function'
    const uniform = is_theme_color(arg) ? arg : undefined
    const result: ColorFields = {}

    if (has_per_item || is_accessor) {
        const colors = new Array<ThemeColor | null>(data.length)

        for (let i = 0; i < data.length; i++) {
            const row = data[i]
            const per_item = is_theme_color(row.color) ? row.color : undefined
            colors[i] = per_item ?? resolve_color_arg(arg, row, i) ?? null
        }
        result.colors = colors
    }

    if (uniform !== undefined) {
        result.color = uniform
    }
    return result
}

/**
 * Normalize the stroke arg into { color, width? }, or undefined when unset. Shared by the mark / rect
 * series factories. Width is validated non-negative; an unset width auto-scales to the mark at paint time.
 * @param stroke - the stroke arg (a ThemeColor for just color, a { color, width } object, or undefined)
 * @param error_prefix - label prefixed to a thrown width error (e.g. 'plot.scatter')
 * @returns the resolved stroke, or undefined
 */
export function resolve_stroke(stroke: StrokeArg | undefined, error_prefix: string): Stroke | undefined {
    if (stroke === undefined) {
        return undefined
    }

    // a color string or light/dark pair: just the color, width auto-scales at paint time
    if (is_theme_color(stroke)) {
        return { color: stroke }
    }
    const { color, width } = stroke

    if (width === undefined) {
        return { color }
    }

    return { color, width: validate_non_negative(width, `${error_prefix}: stroke.width`) }
}

/**
 * Resolve every ThemeColor field on a series to a concrete string for the theme
 * @param series - the series template
 * @param theme - the current browser color scheme
 * @returns the series with its color fields resolved to strings
 */
export function resolve_series_colors<S extends ColorBearingSeries>(series: S, theme: ColorTheme): WithResolvedColors<S> {
    const base = {
        color: series.color === undefined ? undefined : resolve_theme_color(series.color, theme),
        colors: resolve_colors_for_theme(series.colors, theme),
    }

    const stroke = series_stroke(series)

    if (stroke !== undefined) {
        const resolved_stroke = { ...stroke, color: resolve_theme_color(stroke.color, theme) }
        // The spread replaces exactly the keys modeled by WithResolvedColors; TypeScript cannot prove
        // that relationship for a distributive conditional over generic series unions.
        return { ...series, ...base, stroke: resolved_stroke } as unknown as WithResolvedColors<S>
    }
    return { ...series, ...base, stroke: undefined } as unknown as WithResolvedColors<S>
}

/**
 * Build a per-row color resolver, hoisting the has-per-row-colors branch out of the caller's loop. Mirrors
 * pixel_resolver: the colors here are post-compose, so they are concrete strings rather than ThemeColors.
 * @param colors - the resolved per-row colors, or undefined
 * @param fallback - the series color, used where a row has none
 * @returns a resolver mapping row index to a concrete color
 */
export function color_resolver(colors: (string | null)[] | undefined, fallback: string): (i: number) => string {
    if (colors === undefined) {
        return () => fallback
    }
    return (i) => colors[i] ?? fallback
}

/**
 * Whether any series carries a { light, dark } pair
 * @param series - the resolved series list
 * @returns true when at least one color field is a light/dark pair
 */
export function series_have_theme_color_pair(series: ColorBearingSeries[]): boolean {
    for (const s of series) {
        if (is_light_dark_color_pair(s.color)) {
            return true
        }

        if (s.colors?.some(is_light_dark_color_pair)) {
            return true
        }

        const stroke = series_stroke(s)

        if (stroke !== undefined && is_light_dark_color_pair(stroke.color)) {
            return true
        }
    }
    return false
}

/**
 * The series' stroke, if its kind carries one: scatter, rect, area, and line — where the field holds the
 * vertex marker's border (the caller's `mark_stroke`), not the line itself. Bar and rule have none.
 * @param series - the series to test
 * @returns the stroke, or undefined
 */
function series_stroke(series: ColorBearingSeries): Stroke | undefined {
    return series.stroke
}

/**
 * Resolve a per-row colors array for the theme. When the array holds no {light,dark} pair (the common case)
 * it's already theme-independent, so it's reused untouched rather than reallocated on every compose (resize / theme).
 * @param colors - the per-row ThemeColor array, or undefined
 * @param theme - the current browser color scheme
 * @returns the per-row concrete color strings, or undefined
 */
function resolve_colors_for_theme(colors: (ThemeColor | null)[] | undefined, theme: ColorTheme): (string | null)[] | undefined {
    if (colors === undefined) {
        return undefined
    }

    if (is_plain_string_colors(colors)) {
        return colors
    }
    return colors.map(c => c === null ? null : resolve_theme_color(c, theme))
}

/**
 * Whether a colors array is already all plain strings (no {light,dark} pair), i.e. theme-independent.
 * @param colors - the per-row ThemeColor array
 * @returns true when no element is a light/dark pair
 */
function is_plain_string_colors(colors: (ThemeColor | null)[]): colors is (string | null)[] {
    return !colors.some(is_light_dark_color_pair)
}

// A resolved text color: the caller's ThemeColor for the theme, or the fallback when none is set.
export function resolve_text_color(color: ThemeColor | undefined, theme: ColorTheme, fallback: string): string {
    return color === undefined ? fallback : resolve_theme_color(color, theme)
}

/**
 * Resolve a ThemeColor to a concrete color string for the current theme. A plain string is theme-independent
 * @param color - the ThemeColor (string or { light, dark })
 * @param theme - the current browser color scheme
 * @returns the concrete color string
 */
export function resolve_theme_color(color: ThemeColor, theme: ColorTheme): string {
    if (is_light_dark_color_pair(color)) {
        return theme === 'dark' ? color.dark : color.light
    }
    return color
}

/**
 * Whether a value is a usable ThemeColor: a non-empty color string or a { light, dark } pair.
 * @param value - the value to test
 * @returns true when value is a usable ThemeColor
 */
export function is_theme_color(value: unknown): value is ThemeColor {
    if (is_nonempty_string(value)) {
        return true
    }
    return is_light_dark_color_pair(value)
}

/**
 * Whether a value is a non-empty string.
 * @param value - the value to test
 * @returns true when value is a non-empty string
 */
function is_nonempty_string(value: unknown): value is string {
    return typeof value === 'string' && value !== ''
}

/**
 * Whether a value is a { light, dark } color pair with non-empty string variants.
 * @param value - the value to test
 * @returns true when value is a color pair
 */
function is_light_dark_color_pair(value: unknown): value is { light: string; dark: string } {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    if ('light' in value && 'dark' in value) {
        return is_nonempty_string(value.light) && is_nonempty_string(value.dark)
    }
    return false
}

/**
 * Resolve the series color arg for one mark, returning undefined for absent or empty values.
 * @param arg - uniform ThemeColor, accessor, or undefined
 * @param row - the data row
 * @param index - the index handed to an accessor
 * @returns the resolved ThemeColor, or undefined
 */
export function resolve_color_arg(
    arg: ColorArg | undefined,
    row: Record<string, unknown>,
    index: number,
): ThemeColor | undefined {
    const value = typeof arg === 'function' ? arg(row, index) : arg
    return is_theme_color(value) ? value : undefined
}
