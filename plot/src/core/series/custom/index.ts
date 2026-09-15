import type { CustomSeries, SeriesType } from "../../types"
import { custom_domain_extent, new_custom } from "./factory"
import { custom_hit_test } from "./hit"
import { draw_custom } from "./paint"

export {
    custom_domain_extent,
    new_custom,
    type CustomArgs,
    type CustomAxisRangeArg,
} from "./factory"
export { custom_hit_test } from "./hit"
export { custom_resolvers, draw_custom } from "./paint"

export const custom_runtime = {
    kind: 'custom',
    factory: new_custom,
    paint: draw_custom,
    tooltip_hit_test: custom_hit_test,
    domain_extent: custom_domain_extent,
} satisfies SeriesType<unknown, CustomSeries>
