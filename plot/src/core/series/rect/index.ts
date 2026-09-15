import type { RectSeries, SeriesType } from "../../types"
import { new_rect, rect_domain_extent } from "./factory"
import { rect_highlight_spec } from "./highlight"
import { rect_hit_test } from "./hit"
import { draw_rect } from "./paint"

export {
    new_rect,
    rect_domain_extent,
    resolve_rect_columns,
    type RectArgs,
    type RectOffsetArg,
    type RectSizeArg,
    type ResolvedRectColumns,
} from "./factory"
export { rect_highlight_spec } from "./highlight"
export { rect_hit_test } from "./hit"
export { draw_rect, make_rect_resolver } from "./paint"

export const rect_runtime = {
    kind: 'rect',
    factory: new_rect,
    paint: draw_rect,
    tooltip_hit_test: rect_hit_test,
    highlight_spec: rect_highlight_spec,
    domain_extent: rect_domain_extent,
} satisfies SeriesType<unknown, RectSeries>
