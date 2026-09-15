import type { BarSeries, SeriesType } from "../../types"
import { bar_domain_extent, bar_padding_mode, new_bar, validate_bar_axes } from "./factory"
import { bar_highlight_spec } from "./highlight"
import { bar_hit_test } from "./hit"
import { compose_bar_layout } from "./layout"
import { draw_bar } from "./paint"

export { compact_column, dedupe_bands, warn_dropped_bands, type BandDuplicates } from "./duplicates"
export {
    bar_domain_extent,
    bar_padding_mode,
    new_bar,
    validate_bar_axes,
    type BarArgs,
    type BarColorArg,
    type BarSideArg,
} from "./factory"
export { bar_highlight_spec } from "./highlight"
export { bar_hit_test } from "./hit"
export { bar_axes, compose_bar_layout, series_value_span, type BarAxes } from "./layout"
export { bar_corner_radius_css, draw_bar, resolve_bar_rect, segment_border_radius, type BarRect } from "./paint"
export { expand_stack, resolve_stack_colors, type ExpandedStack, type StackColorArg } from "./stack"

export const bar_runtime = {
    kind: 'bar',
    factory: new_bar,
    paint: draw_bar,
    tooltip_hit_test: bar_hit_test,
    highlight_spec: bar_highlight_spec,
    compose_layout: compose_bar_layout,
    validate_axes: validate_bar_axes,
    padding_mode: bar_padding_mode,
    domain_extent: bar_domain_extent,
} satisfies SeriesType<unknown, BarSeries>
