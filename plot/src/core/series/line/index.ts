import { xy_extent } from "../../template/extent"
import type { LineSeries, SeriesType } from "../../types"
import { new_line } from "./factory"
import { line_highlight_spec } from "./highlight"
import { line_hit_test } from "./hit"
import { draw_line } from "./paint"

export { new_line, type LineArgs } from "./factory"
export { line_highlight_spec } from "./highlight"
export { line_hit_test } from "./hit"
export { draw_line, vertex_radius } from "./paint"

export const line_runtime = {
    kind: 'line',
    factory: new_line,
    paint: draw_line,
    tooltip_hit_test: line_hit_test,
    highlight_spec: line_highlight_spec,
    domain_extent: xy_extent,
} satisfies SeriesType<unknown, LineSeries>
