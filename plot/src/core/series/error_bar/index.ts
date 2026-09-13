import type { ErrorBarSeries, SeriesType } from "../../types"
import { error_bar_domain_extent, new_error_bar, validate_error_bar_axes } from "./factory"
import { error_bar_highlight_spec } from "./highlight"
import { error_bar_hit_test } from "./hit"
import { draw_error_bar } from "./paint"

export {
    error_bar_domain_extent,
    new_error_bar,
    validate_error_bar_axes,
    type ErrorBarArgs,
    type ErrorBarBoundArg,
    type ErrorBarCapArg,
} from "./factory"
export { error_bar_highlight_spec } from "./highlight"
export { error_bar_hit_test } from "./hit"
export {
    draw_error_bar, error_bar_mark_radius, error_bar_resolver, is_vertical_error_bar, type ErrorBarPixels,
} from "./paint"

export const error_bar_runtime = {
    kind: 'error_bar',
    factory: new_error_bar,
    paint: draw_error_bar,
    tooltip_hit_test: error_bar_hit_test,
    highlight_spec: error_bar_highlight_spec,
    validate_axes: validate_error_bar_axes,
    domain_extent: error_bar_domain_extent,
} satisfies SeriesType<unknown, ErrorBarSeries>
