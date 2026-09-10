import { resize_canvas } from '../core/render/canvas'
import { clear_highlights, update_highlight_canvas } from '../core/render/highlight'
import { get_canvas_context } from './browser_view'
import type { ATooltipElement } from '@antadesign/anta/elements/a-tooltip'
import type { ComposedPlot } from '../core/types'
import type { NearestPoint } from '../core/interactions/hit'
import { render_tooltip_bodies, TOOLTIP_DIVIDER_STYLE } from '../core/presentation/tooltip'
import type { PlotController } from '../core/controller'

type HoverSnapshot = {
    plot: ComposedPlot<Node>
    hits: NearestPoint[]
    dpr: number
}

const rendered_hover = new WeakMap<HTMLCanvasElement, HoverSnapshot>()

// Clear visible feedback and invalidate its snapshot when a gesture, update, or leave takes ownership.
export function clear_hover(canvas: HTMLCanvasElement, tooltip: ATooltipElement): void {
    rendered_hover.delete(canvas)
    tooltip.replaceChildren()
    tooltip.hide()
    const ctx = get_canvas_context(canvas)
    if (ctx === null) {
        return
    }

    clear_highlights(ctx)
}

/** Paint core highlight geometry and mount host-specific tooltip Nodes without parsing HTML. */
export function render_hover(
    controller: PlotController<Node>,
    canvas: HTMLCanvasElement,
    tooltip: ATooltipElement,
    dpr: number,
): void {
    const plot = controller.composed_plot

    if (plot === null) {
        return
    }

    const hits = controller.interactions.hovered
    const previous = rendered_hover.get(canvas)

    // The controller preserves hit-array identity until the hovered points actually change.
    if (previous?.plot === plot && previous.hits === hits && previous.dpr === dpr) {
        return
    }

    const ctx = get_canvas_context(canvas)

    if (ctx !== null) {
        update_highlight_canvas(ctx, plot, dpr, () => controller.interactions.resolve_highlights(hits))
    } else {
        resize_canvas(canvas, plot.layout.width, plot.layout.height, dpr)
    }

    const doc = tooltip.ownerDocument
    const { bodies, hidden } = render_tooltip_bodies(controller.interactions.resolve_tooltips(hits), {
        custom: (content: unknown) => custom_tooltip_content(content, tooltip),
        text: (line: string) => doc.createTextNode(line),
        line_break: () => doc.createElement('br'),
        divider: () => {
            const divider = doc.createElement('hr')
            divider.className = 'plot-tooltip-divider'
            Object.assign(divider.style, TOOLTIP_DIVIDER_STYLE)
            return divider
        },
        group: (children: Node[]) => {
            const body = doc.createElement('div')
            body.append(...children)
            return body
        },
    })

    tooltip.replaceChildren(...bodies)

    if (hidden) {
        tooltip.hide()
    }

    rendered_hover.set(canvas, { plot, hits, dpr })
}

// Validate custom content at the DOM boundary, omitting invalid bodies like the notebook host does.
function custom_tooltip_content(value: unknown, tooltip: ATooltipElement): Node | undefined {
    // Element, Text, CDATA, ProcessingInstruction, Comment, or DocumentFragment; never an ancestor.
    if (is_dom_node(value, tooltip) && [1, 3, 4, 7, 8, 11].includes(value.nodeType)
        && !value.contains(tooltip)) {
        return value
    }

    console.error(
        'Invalid plot tooltip return value. Return a DOM Node that can be inserted into the tooltip.',
        value,
    )
    return undefined
}

// Use the DOM's Node argument check so nodes from other windows or detached documents also work.
function is_dom_node(value: unknown, tooltip: ATooltipElement): value is Node {
    try {
        Reflect.apply(tooltip.compareDocumentPosition, tooltip, [value])
        return true
    } catch {
        return false
    }
}
