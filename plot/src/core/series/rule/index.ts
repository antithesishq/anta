import { xy_extent } from "../../template/extent"
import type { RuleSeries, SeriesType } from "../../types"
import { new_rule } from "./factory"
import { rule_highlight_spec } from "./highlight"
import { rule_hit_test } from "./hit"
import { draw_rule } from "./paint"

export { new_rule, type RuleArgs, type RuleValueArg } from "./factory"
export { rule_highlight_spec } from "./highlight"
export { rule_hit_test } from "./hit"
export { crisp_rule_pos, DEFAULT_RULE_WIDTH, draw_rule, rule_values } from "./paint"

export const rule_runtime = {
    kind: 'rule',
    factory: new_rule,
    paint: draw_rule,
    tooltip_hit_test: rule_hit_test,
    highlight_spec: rule_highlight_spec,
    // The rule's unconstrained column is all NaN, producing the inverted extent that aggregation ignores.
    domain_extent: xy_extent,
} satisfies SeriesType<unknown, RuleSeries>
