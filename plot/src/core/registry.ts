import type { Series, SeriesType } from "./types"
import { area_runtime } from "./series/area"
import { bar_runtime } from "./series/bar"
import { custom_runtime } from "./series/custom"
import { line_runtime } from "./series/line"
import { rect_runtime } from "./series/rect"
import { rule_runtime } from "./series/rule"
import { scatter_runtime } from "./series/scatter"

const SERIES_TYPES: Record<Series['kind'], SeriesType> = {
    scatter: scatter_runtime,
    bar: bar_runtime,
    rect: rect_runtime,
    line: line_runtime,
    rule: rule_runtime,
    area: area_runtime,
    custom: custom_runtime,
}

/** Look up core behavior for a registered series kind. */
export function series_type<TooltipContent = unknown>(kind: Series['kind']): SeriesType<TooltipContent> {
    // Runtime behavior does not inspect host tooltip content. The registry stores one implementation
    // per kind and restores the caller's host-specific content type at this lookup boundary.
    return SERIES_TYPES[kind] as unknown as SeriesType<TooltipContent>
}
