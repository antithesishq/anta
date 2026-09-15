import { Tooltip } from '@antadesign/anta'
import { useState, useSyncExternalStore } from '@antadesign/anta/jsx-runtime'
import type { BaseAttributes, BaseProps } from '@antadesign/anta/general_types'
import type { PlotArgs } from '../core/types'
import type { PlotLifecycleError } from '../core/controller'
import type { ResolvedTooltip } from '../core/interactions/tooltip'
import { render_tooltip_body, TOOLTIP_DIVIDER_STYLE, TOOLTIP_OPTIONS } from '../core/presentation/tooltip'

export type PlotTooltipChange = CustomEvent<ResolvedTooltip<React.ReactNode>[]>

export interface PlotAttributes extends BaseAttributes {
    plotArgs?: PlotArgs<React.ReactNode>
    'tooltip-mode'?: 'external'
    ontooltipchange?: (event: PlotTooltipChange) => void
    onploterror?: (event: CustomEvent<PlotLifecycleError>) => void
}

declare module '@antadesign/anta/jsx-runtime' {
    interface AntaIntrinsicElements {
        'a-plot': PlotAttributes
    }
}

export interface PlotProps extends Omit<BaseProps, 'children'> {
    /** Complete configuration. Replace the object to apply changes. */
    plotArgs: PlotArgs<React.ReactNode>
    /** Reports configuration, composition, and drawing failures from the browser host. */
    onPlotError?: (event: CustomEvent<PlotLifecycleError>) => void
}

const noSubscription = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

/** Register /elements/a-plot before rendering. The configured renderer owns tooltip content and state. */
export const Plot = ({ className, plotArgs, onPlotError, ...rest }: PlotProps) => {
    // Hydration does not assign custom-element object props. Publish them on the first client update.
    const clientReady = useSyncExternalStore(noSubscription, clientSnapshot, serverSnapshot)
    const [tooltips, setTooltips] = useState<ResolvedTooltip<React.ReactNode>[]>([])
    const tooltip = render_tooltip_body(tooltips, {
        custom: (content: React.ReactNode) => content == null || typeof content === 'boolean' ? undefined : content,
        text: (text: string) => text,
        line_break: () => <br />,
        divider: () => <hr style={TOOLTIP_DIVIDER_STYLE} />,
        group: (children: React.ReactNode[]) => <>{children}</>,
    })

    return (
        <a-plot
            {...rest}
            class={className}
            tooltip-mode="external"
            ontooltipchange={event => setTooltips(event.detail)}
            onploterror={onPlotError}
            plotArgs={clientReady ? plotArgs : undefined}
        >
            <Tooltip {...TOOLTIP_OPTIONS} style={tooltip.style}>
                {/* Keep a content container so Tooltip can schedule showing before the hover state commits. */}
                <div style={tooltip.style}>{tooltip.body}</div>
            </Tooltip>
        </a-plot>
    )
}
