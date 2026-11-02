import { TOOLTIP_OPTIONS } from '../core/presentation/tooltip'
import type { ATooltipElement } from '@antadesign/anta/elements/a-tooltip'
import type { APlotSurfaceElement } from './plot_surface'
export { size_host, get_canvas_context } from './surface_support'

export type BrowserView = {
    root: APlotSurfaceElement
    canvas: HTMLCanvasElement
    capture: HTMLElement
    highlight: HTMLCanvasElement
    tooltip: ATooltipElement
}

// Tooltip DOM belongs to the standalone host, independently of the shared surface.
export function create_browser_view(doc: Document): BrowserView {
    const root = doc.createElement('a-plot-surface') as APlotSurfaceElement
    const { canvas, highlight, capture } = root
    const tooltip = doc.createElement('a-tooltip') as ATooltipElement
    tooltip.className = 'plot-tooltip'
    if (TOOLTIP_OPTIONS.follow) tooltip.setAttribute('follow', '')
    tooltip.setAttribute('delay', String(TOOLTIP_OPTIONS.delay))
    capture.append(tooltip)
    return { root, canvas, highlight, capture, tooltip }
}
