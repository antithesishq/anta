import { xy_extent } from "../../template/extent"
import type { ScatterSeries, SeriesType } from "../../types"
import { new_scatter } from "./factory"
import { scatter_highlight_spec } from "./highlight"
import { scatter_hit_test } from "./hit"
import { draw_scatter } from "./paint"

export { new_scatter, type ScatterArgs, type ScatterSizeArg } from "./factory"
export { scatter_highlight_spec } from "./highlight"
export { scatter_hit_test } from "./hit"
export { dot_radius, draw_scatter } from "./paint"

export const scatter_runtime = {
    kind: 'scatter',
    factory: new_scatter,
    paint: draw_scatter,
    tooltip_hit_test: scatter_hit_test,
    highlight_spec: scatter_highlight_spec,
    domain_extent: xy_extent,
} satisfies SeriesType<unknown, ScatterSeries>
