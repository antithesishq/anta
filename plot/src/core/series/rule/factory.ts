import { resolve_column, validate_field_present, type ColumnMode } from "../../template/column"
import { resolve_color } from "../../template/color"
import { validate_finite, validate_hoverable, validate_non_negative, validate_positive } from "../../template/validate"
import type { ColorArg, FieldArg, RuleSeries, SelectFn, TooltipArg } from "../../types"

export type RuleValueArg = number | FieldArg

export type RuleArgs<TooltipContent = unknown> = {
    data?: Record<string, unknown>[]
    x?: RuleValueArg
    y?: RuleValueArg
    color?: ColorArg
    width?: number
    dash?: number[]
    tooltip?: TooltipArg<Record<string, unknown> | undefined, TooltipContent>
    on_select?: SelectFn<Record<string, unknown> | undefined>
    hoverable?: boolean
    highlight?: boolean
}

// one resolved rule column: the values on the rule's axis, plus what that column turned out to be
type ResolvedRule = {
    values: Float64Array
    mode: ColumnMode
    categories: string[] | null
    field?: string
}

/**
 * Rule series factory. Resolves the one value column (a bare number, a category, or a field over data rows)
 * and fills the other axis with NaN so the rule stays out of that axis' domain.
 * @param args - rule series args (x or y, data, color, width, dash)
 * @returns the resolved RuleSeries
 */
export function new_rule<TooltipContent = unknown>(args: RuleArgs<TooltipContent>): RuleSeries<TooltipContent> {
    const side = rule_side(args)
    const resolved = resolve_rule_column(args[side], args.data, side)
    const unconstrained = new Float64Array(resolved.values.length).fill(NaN)
    const series: RuleSeries<TooltipContent> = {
        kind: 'rule',
        side,
        x: side === 'x' ? resolved.values : unconstrained,
        y: side === 'y' ? resolved.values : unconstrained,
    }
    apply_rule_options(series, args)
    attach_rule_column(series, side, resolved)
    return series
}

/**
 * Which axis the rule's value lives on. Exactly one of x / y carries it — that's the whole orientation
 * declaration, mirroring how a bar takes its band from whichever side is categorical.
 * @param args - the rule series args
 * @returns the value's axis
 */
function rule_side(args: RuleArgs): 'x' | 'y' {
    const has_x = args.x !== undefined
    const has_y = args.y !== undefined

    if (has_x && has_y) {
        throw new Error('plot.rule: pass exactly one of x / y, got both. `y` draws a horizontal rule at that value, `x` a vertical one.')
    }

    if (!has_x && !has_y) {
        throw new Error('plot.rule: pass one of x / y. `y` draws a horizontal rule at that value, `x` a vertical one.')
    }
    return has_x ? 'x' : 'y'
}

/**
 * Resolve the rule's value column. Without data the value is the rule itself — a number, or a string naming a
 * category on a categorical axis. With data it's a field name or accessor, giving one rule per row.
 * @param value - the value arg from the rule's axis
 * @param data - the data rows, when the value is a field
 * @param side - the rule's axis, for error messages
 * @returns the resolved values plus mode, categories, and source field
 */
function resolve_rule_column(value: RuleValueArg | undefined, data: Record<string, unknown>[] | undefined, side: 'x' | 'y'): ResolvedRule {
    if (data === undefined) {
        return resolve_bare_rule(value, side)
    }

    if (typeof value === 'number') {
        throw new Error(`plot.rule: ${side} is a number (${value}) but data was passed. Drop data for a single rule at ${value}, or name the field holding each rule's value.`)
    }
    // rule_side established that value is present; after excluding number it is a field or accessor.
    const field_value = value as Exclude<RuleValueArg, number>

    if (data.length > 0) {
        validate_field_present(data[0], field_value, false, 'plot.rule', side)
    }
    const column = resolve_column(data, field_value, 'plot.rule', side)
    const resolved: ResolvedRule = { values: column.values, mode: column.mode, categories: column.categories }

    if (typeof field_value === 'string') {
        resolved.field = field_value
    }
    return resolved
}

/**
 * Resolve a rule given as the value itself, with no data rows: a number on a continuous axis, or a category
 * label on a categorical one (with no rows there's no field for a string to name).
 * @param value - the value arg from the rule's axis
 * @param side - the rule's axis, for error messages
 * @returns the single-value resolved column
 */
function resolve_bare_rule(value: RuleValueArg | undefined, side: 'x' | 'y'): ResolvedRule {
    if (typeof value === 'function') {
        throw new Error(`plot.rule: ${side} is an accessor but no data was passed. An accessor reads a value per row, so it needs data; pass the value directly for a single rule.`)
    }

    if (typeof value === 'string') {
        return { values: new Float64Array([0]), mode: 'categorical', categories: [value] }
    }
    return { values: new Float64Array([validate_finite(value as number, `plot.rule: ${side}`)]), mode: 'numeric', categories: null }
}

/**
 * Apply the optional rule args onto the series, validating each.
 * @param series - the series under construction
 * @param args - the rule series args
 */
function apply_rule_options<TooltipContent>(series: RuleSeries<TooltipContent>, args: RuleArgs<TooltipContent>): void {
    apply_rule_color(series, args)

    if (args.width !== undefined) {
        series.width = validate_positive(args.width, 'plot.rule: width')
    }

    if (args.dash !== undefined) {
        series.dash = args.dash.map((segment, i) => validate_non_negative(segment, `plot.rule: dash[${i}]`))
    }

    if (args.tooltip !== undefined) {
        series.tooltip = args.tooltip
    }

    if (args.on_select !== undefined) {
        series.on_select = args.on_select
    }
    const hoverable = validate_hoverable(args, 'plot.rule')

    if (hoverable !== undefined) {
        series.hoverable = hoverable
    }

    if (args.highlight !== undefined) {
        series.highlight = args.highlight
    }

    if (args.data !== undefined) {
        series.rows = args.data // Keep the caller's original rows for tooltip and selection payloads.
    }
}

/**
 * Resolve the rule color(s). With data, per-row colors work as they do for any series; a single rule takes a
 * uniform color only, since an accessor has no row to read.
 * @param series - the series under construction
 * @param args - the rule series args
 */
function apply_rule_color<TooltipContent>(series: RuleSeries<TooltipContent>, args: RuleArgs<TooltipContent>): void {
    const data = args.data

    if (data !== undefined) {
        const { color, colors } = resolve_color(data, args.color)

        if (color !== undefined) {
            series.color = color
        }

        if (colors !== undefined) {
            series.colors = colors
        }
        return
    }

    if (args.color === undefined) {
        return
    }

    if (typeof args.color === 'function') {
        throw new Error('plot.rule: color is an accessor but no data was passed. A single rule takes a color string or {light, dark}; pass data to color rules per row.')
    }
    series.color = args.color
}

/**
 * Attach the resolved column's axis kind, categories, and source field to the rule's own side. The other side
 * stays bare, which is what lets a rule sit on any axis without constraining it.
 * @param series - the series under construction
 * @param side - the rule's axis
 * @param resolved - the resolved value column
 */
function attach_rule_column<TooltipContent>(series: RuleSeries<TooltipContent>, side: 'x' | 'y', resolved: ResolvedRule): void {
    const axis_kind_key = side === 'x' ? 'x_axis_kind' : 'y_axis_kind'
    const categories_key = side === 'x' ? 'x_categories' : 'y_categories'
    const field_key = side === 'x' ? 'x_field' : 'y_field'

    if (resolved.mode !== 'undecided') {
        series[axis_kind_key] = resolved.mode
    }

    if (resolved.categories !== null) {
        series[categories_key] = resolved.categories
    }

    if (resolved.field !== undefined) {
        series[field_key] = resolved.field
    }
}
