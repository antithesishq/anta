import type { Series, SeriesType } from "./types"
import { area_runtime } from "./series/area"
import { bar_runtime } from "./series/bar"
import { custom_runtime } from "./series/custom"
import { line_runtime } from "./series/line"
import { rect_runtime } from "./series/rect"
import { rule_runtime } from "./series/rule"
import { scatter_runtime } from "./series/scatter"

const SERIES_TYPES = {
    scatter: scatter_runtime,
    bar: bar_runtime,
    rect: rect_runtime,
    line: line_runtime,
    rule: rule_runtime,
    area: area_runtime,
    custom: custom_runtime,
}

/** Look up core behavior for a registered series kind. */
export function series_type<Row, TooltipContent = unknown>(series: Series<Row, TooltipContent>): SeriesType<Row, TooltipContent> {
    return SERIES_TYPES[series.kind]
}
