import chroma from "chroma-js"
import type { ColorTheme, ComposedPlot, HighlightSpec, Rect } from "../types"
import { series_type } from "../registry"
import type { NearestPoint } from "./hit"

type HighlightBox = {
    left: number
    top: number
    width: number
    height: number
    border_radius?: string
}

// Snap rectangle edges relative to the plot's explicit inner origin.
export function resolve_rect_highlight_box(
    spec: Extract<HighlightSpec, { shape: 'rect' }>,
    origin: Pick<Rect, 'left' | 'top'>,
): HighlightBox {
    const x = spec.x - origin.left
    const y = spec.y - origin.top
    const left = Math.round(x)
    const top = Math.round(y)

    // Snap each edge independently, keeping sub-pixel rectangles at least one pixel wide and tall.
    return {
        left,
        top,
        width: Math.max(1, Math.round(x + spec.width) - left),
        height: Math.max(1, Math.round(y + spec.height) - top),
        border_radius: spec.border_radius,
    }
}

// Expand CSS radius shorthand into clockwise corners, preserving separate horizontal/vertical radii.
export function resolve_highlight_corner_radii(
    value: string | undefined,
    width: number,
    height: number,
): { x: number; y: number }[] {
    const [horizontal, vertical = horizontal] = (value ?? '0').split('/')
    const x = radius_values(horizontal, width)
    const y = radius_values(vertical, height)

    return x.map((radius, index) => ({ x: radius, y: y[index] }))
}

// Core bars supply pixel radii; percentages are relative to the rounded box on each axis.
function radius_values(value: string, extent: number): number[] {
    const values = value.trim().split(/\s+/).map(token => {
        const radius = Math.max(0, parseFloat(token) || 0)
        return token.endsWith('%') ? radius * extent / 100 : radius
    })
    const [top_left, top_right = top_left, bottom_right = top_left, bottom_left = top_right] = values

    return [top_left, top_right, bottom_right, bottom_left]
}

// The highlight geometry for the topmost hovered point that defines one. A kind may hand back several shapes.
export function resolve_highlights<TooltipContent>(plot: ComposedPlot<TooltipContent>, hovered: NearestPoint[]): HighlightSpec[] {
    for (const hit of hovered) {
        const series = plot.series[hit.series_index]

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime bounds guard for stale hover state
        if (series === undefined || hit.point_index >= series.x.length) {
            // possible if the plot changes under the cursor
            continue
        }

        if (series.highlight === false) {
            continue
        }
        const spec = series_type<TooltipContent>(series.kind).highlight_spec?.(series, hit.point_index, plot.x_scale, plot.y_scale, plot.inner)

        if (spec === undefined || spec === null) {
            continue
        }
        const specs = Array.isArray(spec) ? spec : [spec]

        if (specs.length > 0) {
            return specs
        }
    }
    return []
}

const HOVER_DARKEN = 0.7
const HOVER_LIGHTEN = 0.7
const HOVER_ALPHA = 0.4

// Preserve translucent or unparseable CSS colors; shade opaque highlights for the active theme.
export function resolve_highlight_color(color: string, theme: ColorTheme): string {
    if (is_translucent(color)) {
        return color
    }

    try {
        const shifted = theme === 'dark' ? chroma(color).brighten(HOVER_LIGHTEN) : chroma(color).darken(HOVER_DARKEN)
        return shifted.alpha(HOVER_ALPHA).css()
    } catch {
        return color
    }
}

// Whether a resolved CSS color is semi-transparent (alpha < 1).
function is_translucent(color: string): boolean {
    const normalized = color.trim().toLowerCase()

    if (normalized === 'transparent') {
        return true
    }

    if (normalized.startsWith('#')) {
        return hex_has_alpha(normalized)
    }
    return functional_alpha_below_one(normalized)
}

// Alpha test for #rgba (4 digits) and #rrggbbaa (8 digits); #rgb / #rrggbb carry none.
function hex_has_alpha(hex: string): boolean {
    const digits = hex.slice(1)

    if (digits.length === 4) {
        return digits[3] !== 'f'
    }

    if (digits.length === 8) {
        return digits.slice(6) !== 'ff'
    }
    return false
}

// Alpha test for rgba() / hsla() / rgb() / hsl(): the 4th comma value, or the token after `/` in modern syntax.
function functional_alpha_below_one(color: string): boolean {
    const open = color.indexOf('(')
    const close = color.indexOf(')')

    if (open === -1 || close === -1) {
        return false
    }
    const args = color.slice(open + 1, close)
    const alpha_token = alpha_component(args)

    if (alpha_token === undefined) {
        return false
    }
    return parse_alpha(alpha_token) < 1
}

// The alpha token from a color function's arg list, or undefined when it carries none.
function alpha_component(args: string): string | undefined {
    if (args.includes('/')) {
        return args.split('/')[1]?.trim()
    }
    const parts = args.split(',')

    if (parts.length === 4) {
        return parts[3].trim()
    }
    return undefined
}

// Parse an alpha token to a 0..1 number: a bare number, or a percentage. NaN (unparseable) reads as opaque.
function parse_alpha(token: string): number {
    if (token.endsWith('%')) {
        return parseFloat(token) / 100
    }
    return parseFloat(token)
}
