import type { AreaSeries, SeriesType } from "../../types"
import { area_domain_extent, new_area, validate_area_axes } from "./factory"
import { area_hit_test } from "./hit"
import { compose_area_layout } from "./layout"
import { draw_area } from "./paint"

export {
    area_domain_extent,
    new_area,
    validate_area_axes,
    type AreaArgs,
    type AreaBoundArg,
} from "./factory"
export { area_hit_test } from "./hit"
export { compose_area_layout, is_vertical_area, run_count, series_pixel_runs } from "./layout"
export { draw_area } from "./paint"

export const area_runtime = {
    kind: 'area',
    factory: new_area,
    paint: draw_area,
    tooltip_hit_test: area_hit_test,
    compose_layout: compose_area_layout,
    validate_axes: validate_area_axes,
    domain_extent: area_domain_extent,
} satisfies SeriesType<unknown, AreaSeries>
