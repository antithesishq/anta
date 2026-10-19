import { create_plot_surface_element } from './plot_surface'
export type { APlotSurfaceElement, PlotSurfacePresentation, PlotSurfaceCanvases, PlotSurfaceEventMap } from './plot_surface'
import type { ResolvedTooltip } from '../core/interactions/tooltip'
import { create_plot_element } from './plot_element'
import type { PlotArgs, ScatterSeries, BarSeries, RectSeries, LineSeries, RuleSeries, AreaSeries, CustomSeries } from '../core/types'
import { new_scatter, type ScatterArgs as CoreScatterArgs } from '../core/series/scatter/factory'
import { new_bar, type BarArgs as CoreBarArgs } from '../core/series/bar/factory'
import { new_rect, type RectArgs as CoreRectArgs } from '../core/series/rect/factory'
import { new_line, type LineArgs as CoreLineArgs } from '../core/series/line/factory'
import { new_rule, type RuleArgs as CoreRuleArgs } from '../core/series/rule/factory'
import { new_area, type AreaArgs as CoreAreaArgs } from '../core/series/area/factory'
import { new_custom, type CustomArgs as CoreCustomArgs } from '../core/series/custom/factory'

// Reuse the core factories directly, with DOM Node tooltips at the browser boundary.
export const scatter: <Row>(args: ScatterArgs<Row>) => ScatterSeries<Row, Node> = new_scatter
export const bar: <Row>(args: BarArgs<Row>) => BarSeries<Row, Node> = new_bar
export const rect: <Row>(args: RectArgs<Row>) => RectSeries<Row, Node> = new_rect
export const line: <Row>(args: LineArgs<Row>) => LineSeries<Row, Node> = new_line
export const rule: <Row>(args: RuleArgs<Row>) => RuleSeries<Row, Node> = new_rule
export const area: <Row>(args: AreaArgs<Row>) => AreaSeries<Row, Node> = new_area
export const custom: <Row>(args: CustomArgs<Row>) => CustomSeries<Row, Node> = new_custom

export type ScatterArgs<Row> = CoreScatterArgs<Row, Node>
export type BarArgs<Row> = CoreBarArgs<Row, Node>
export type RectArgs<Row> = CoreRectArgs<Row, Node>
export type LineArgs<Row> = CoreLineArgs<Row, Node>
export type RuleArgs<Row> = CoreRuleArgs<Row, Node>
export type AreaArgs<Row> = CoreAreaArgs<Row, Node>
export type CustomArgs<Row> = CoreCustomArgs<Row, Node>

/** Renderer owns the target's children and receives an empty list when hover clears. */
export type PlotTooltipRenderer<Content = Node> =
    (tooltips: ResolvedTooltip<Content>[], target: HTMLElement) => void

/** Browser host configured through properties; custom tooltip content requires a renderer. */
export interface APlotElement<Content = Node> extends HTMLElement {
    plotArgs: PlotArgs<Content> | undefined
    tooltipRenderer: PlotTooltipRenderer<Content> | undefined
}

/** Register Plot and its internal Anta elements. No-op without a registry; existing definitions are preserved. */
export async function definePlotElement(): Promise<void> {
    if (typeof customElements === 'undefined') {
        return
    }
    if (already_registered()) return
    await definePlotSurfaceElement()
    const [tooltip] = await Promise.all([
        import('@antadesign/anta/elements/a-tooltip'),
    ])
    if (already_registered()) return // Another caller may have registered while imports loaded.
    tooltip.register_a_tooltip()
    const element = create_plot_element()
    customElements.define('a-plot', element)
}

export type { PlotArgs, Viewport, ViewportChange } from '../core/types'

function already_registered(): boolean {
    return customElements.get('a-plot') !== undefined
}

/** Register the shared surface without registering the standalone plot or its tooltip. */
export async function definePlotSurfaceElement(): Promise<void> {
    if (typeof customElements === 'undefined') {
        return
    }
    const registered = () => customElements.get('a-plot-surface') !== undefined
    if (registered()) return
    const [box, capture, menu, menu_item] = await Promise.all([
        import('@antadesign/anta/elements/a-box'),
        import('@antadesign/anta/elements/a-capture'),
        import('@antadesign/anta/elements/a-menu'),
        import('@antadesign/anta/elements/a-menu-item'),
    ])
    if (registered()) return
    box.register_a_box()
    capture.register_a_capture()
    menu.register_a_menu()
    menu_item.register_a_menu_item()
    const element = create_plot_surface_element()
    customElements.define('a-plot-surface', element)
}
