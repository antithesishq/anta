import type { ComposedRule, HighlightSpec, Rect, Scale } from "../../types"
import { DEFAULT_SERIES_COLOR } from "../../template/color"
import { pixel_resolver } from "../../render/pixel_resolver"
import { crisp_rule_pos, DEFAULT_RULE_WIDTH, rule_values } from "./paint"

/**
 * The hover-select halo for a rule: a band over the whole rule, as thick as the stroke. It spans the plot area
 * on the other axis and snaps to the same device pixel the stroke does, so it covers the drawn line exactly
 * rather than sitting half a pixel off or stopping short at the axis padding.
 * @param series - the composed rule series
 * @param point_index - the hovered rule's index
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @param inner - the plot area, which the rule spans on the axis it doesn't constrain
 * @returns the halo spec, or null if the rule has no pixel position (unknown band / non-finite)
 */
export function rule_highlight_spec(series: ComposedRule, point_index: number, x_scale: Scale, y_scale: Scale, inner: Rect): HighlightSpec | null {
    const is_vertical = series.side === 'x'
    const pos = pixel_resolver(is_vertical ? x_scale : y_scale, rule_values(series))(point_index)

    if (pos === undefined || !Number.isFinite(pos)) {
        return null
    }
    const thickness = series.width ?? DEFAULT_RULE_WIDTH
    const color = series.colors?.[point_index] ?? series.color ?? DEFAULT_SERIES_COLOR
    const drawn = crisp_rule_pos(pos, thickness)

    // edge to edge across the plot area, the same span draw_rule strokes
    if (is_vertical) {
        return { shape: 'rect', x: drawn - thickness / 2, y: inner.top, width: thickness, height: inner.bottom - inner.top, color }
    }
    return { shape: 'rect', x: inner.left, y: drawn - thickness / 2, width: inner.right - inner.left, height: thickness, color }
}
