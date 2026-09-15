import { create_plot_element } from './plot_element'
import type { PlotArgs } from '../core/types'
import { new_scatter } from '../core/series/scatter/factory'
import { new_bar } from '../core/series/bar/factory'
import { new_rect } from '../core/series/rect/factory'
import { new_line } from '../core/series/line/factory'
import { new_rule } from '../core/series/rule/factory'
import { new_area } from '../core/series/area/factory'
import { new_custom } from '../core/series/custom/factory'

// Reuse the core factories directly, with DOM Node tooltips at the browser boundary.
export const scatter = new_scatter<Node>
export const bar = new_bar<Node>
export const rect = new_rect<Node>
export const line = new_line<Node>
export const rule = new_rule<Node>
export const area = new_area<Node>
export const custom = new_custom<Node>

export type ScatterArgs = Parameters<typeof scatter>[0]
export type BarArgs = Parameters<typeof bar>[0]
export type RectArgs = Parameters<typeof rect>[0]
export type LineArgs = Parameters<typeof line>[0]
export type RuleArgs = Parameters<typeof rule>[0]
export type AreaArgs = Parameters<typeof area>[0]
export type CustomArgs = Parameters<typeof custom>[0]

/** Internal host input: all plot behavior is configured through the complete argument object. */
export interface APlotElement extends HTMLElement {
    plotArgs: PlotArgs<Node> | undefined
}

const implementations = new WeakSet<CustomElementConstructor>()

/** Register Plot and its internal Anta elements. Safe to import without a DOM; call in the browser. */
export async function definePlotElement(): Promise<void> {
    if (typeof customElements === 'undefined') {
        throw new Error('plot: definePlotElement requires a browser custom-element registry')
    }
    if (already_registered()) return
    const [box, capture, button, icon, tooltip] = await Promise.all([
        import('@antadesign/anta/elements/a-box'),
        import('@antadesign/anta/elements/a-capture'),
        import('@antadesign/anta/elements/a-button'),
        import('@antadesign/anta/elements/a-icon'),
        import('@antadesign/anta/elements/a-tooltip'),
    ])
    if (already_registered()) return // Another caller may have registered while imports loaded.
    box.register_a_box()
    capture.register_a_capture()
    button.register_a_button()
    icon.register_a_icon()
    tooltip.register_a_tooltip()
    const element = create_plot_element()
    customElements.define('a-plot', element)
    implementations.add(element)
}

export type { PlotArgs, Viewport, ViewportChange } from '../core/types'

function already_registered(): boolean {
    const existing = customElements.get('a-plot')
    if (existing === undefined) return false
    if (!implementations.has(existing)) {
        throw new Error('plot: another implementation already registered <a-plot>')
    }
    return true
}
