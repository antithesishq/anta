import type { SeriesArgs } from '../types'

// Non-enumerable metadata stays out of public series schemas. A named property
// lets structural hashers include the input, unlike symbols or a WeakMap.
const factory_args_key = '__plot_factory_args'

export function retain_factory_args<Content>(series: object, args: SeriesArgs<Content>): void {
    Object.defineProperty(series, factory_args_key, { value: args })
}

export function original_factory_args<Content>(series: object): SeriesArgs<Content> | undefined {
    return (series as { [factory_args_key]?: SeriesArgs<Content> })[factory_args_key]
}

export function carry_factory_args<T extends object>(source: object, target: T): T {
    const args = original_factory_args(source)
    if (args !== undefined && source !== target) retain_factory_args(target, args)
    return target
}
