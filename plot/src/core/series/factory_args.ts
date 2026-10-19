import type { Series, SeriesArgs } from '../types'

// Non-enumerable metadata stays out of public series schemas. A named property
// lets structural hashers include the input, unlike symbols or a WeakMap.
const factory_args_key = '__plot_factory_args'

export function retain_factory_args<Row, Content>(series: object, args: SeriesArgs<Row, Content>): void {
    Object.defineProperty(series, factory_args_key, { value: args })
}

export function original_factory_args<Row, Content>(series: Series<Row, Content>): SeriesArgs<Row, Content> | undefined {
    return (series as { [factory_args_key]?: SeriesArgs<Row, Content> })[factory_args_key]
}

export function carry_factory_args<Row, Content, T extends object>(source: Series<Row, Content>, target: T): T {
    const args = original_factory_args<Row, Content>(source)
    if (args !== undefined && source !== target) retain_factory_args(target, args)
    return target
}
