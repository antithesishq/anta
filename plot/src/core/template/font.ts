import type { FontArg, FontCaps, FontConfig, ResolvedFontConfig, ThemeColor } from "../types"
import { resolve_theme_color } from "./color"
import { validate_finite, validate_font_weight, validate_positive } from "./validate"

type FontRoleDefaults = {
    family?: string
    size: number
    color: ThemeColor
}

const font_caps = new Set<string>([
    'normal', 'small-caps', 'all-small-caps', 'petite-caps',
    'all-petite-caps', 'unicase', 'titling-caps',
])

// Normalize the string shorthand into a family-only font config.
function normalize_font(font: FontArg | undefined): FontConfig {
    if (font === undefined) {
        return {}
    }
    const config = typeof font === 'string' ? { family: font } : font
    // An empty family would invalidate the entire canvas font shorthand, including its size.
    if (config.family?.trim() === '') return { ...config, family: undefined }
    return config
}

// Validate font fields and return the normalized object form.
export function validate_font(font: FontArg | undefined, label: string): FontConfig {
    const config = normalize_font(font)

    if (config.caps !== undefined && typeof config.caps !== 'boolean' && !font_caps.has(config.caps)) {
        throw new Error(`${label}.caps must be a boolean or one of: ${[...font_caps].join(', ')}; got ${config.caps}`)
    }

    if (config.size !== undefined) {
        validate_positive(config.size, `${label}.size`)
    }

    if (config.weight !== undefined) {
        validate_font_weight(config.weight, `${label}.weight`)
    }

    if (config.letter_spacing !== undefined) {
        validate_finite(config.letter_spacing, `${label}.letter_spacing`)
    }

    if (config.word_spacing !== undefined) {
        validate_finite(config.word_spacing, `${label}.word_spacing`)
    }
    return config
}

// Resolve family through the role, explicit plot root, role/environment default, then internal fallback.
function resolved_font_family(local: FontConfig | undefined, root: FontConfig, defaults: FontRoleDefaults): string {
    return local?.family ?? root.family ?? defaults.family ?? 'sans-serif'
}

// Resolve one text role through local config, root config, then role/base defaults.
export function resolve_font(
    local: FontConfig | undefined,
    root: FontConfig,
    defaults: FontRoleDefaults,
    theme: 'light' | 'dark',
): ResolvedFontConfig {
    const color = local?.color ?? root.color ?? defaults.color

    return {
        family: resolved_font_family(local, root, defaults),
        size: local?.size ?? root.size ?? defaults.size,
        weight: local?.weight ?? root.weight ?? 400,
        color: resolve_theme_color(color, theme),
        italic: local?.italic ?? root.italic ?? false,
        condensed: local?.condensed ?? root.condensed ?? false,
        letter_spacing: local?.letter_spacing ?? root.letter_spacing ?? 0,
        word_spacing: local?.word_spacing ?? root.word_spacing ?? 0,
        caps: resolved_font_caps(local, root),
    }
}

function resolved_font_caps(local: FontConfig | undefined, root: FontConfig): FontCaps {
    const caps = local?.caps ?? root.caps ?? false

    if (typeof caps === 'boolean') {
        return caps ? 'all-small-caps' : 'normal'
    }
    return caps
}
