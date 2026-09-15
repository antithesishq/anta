import type { BaseAttributes, BaseProps } from '@antadesign/anta/general_types'
import type { PlotArgs } from '../core/types'

export interface PlotAttributes extends Omit<BaseAttributes, 'children'> {
    plotArgs: PlotArgs<Node>
}

declare module '@antadesign/anta/jsx-runtime' {
    interface AntaIntrinsicElements {
        'a-plot': PlotAttributes
    }
}

export interface PlotProps extends Omit<BaseProps, 'children'> {
    /** Complete configuration. Replace the object to apply changes. Custom tooltips return DOM nodes. */
    plotArgs: PlotArgs<Node>
}

/** Browser-owned plot lifecycle. Register /elements/a-plot before rendering; the renderer must assign object properties. */
export const Plot = ({ className, plotArgs, ...rest }: PlotProps) => (
    <a-plot {...rest} class={className} plotArgs={plotArgs} />
)
