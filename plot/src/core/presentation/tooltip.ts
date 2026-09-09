import type { Rect } from '../types'
import type { ResolvedTooltip } from '../interactions/tooltip'

export const TOOLTIP_OPTIONS = { follow: true, delay: 10 }
export const TOOLTIP_DIVIDER_STYLE = {
    border: '0',
    borderTop: '1px solid rgba(160, 160, 160, 0.4)',
    margin: '5px 0 4px',
}

type TooltipRenderer<Content, Body, Text> = {
    custom(content: Content): Body | undefined
    text(value: string): Text
    line_break(): Body
    divider(): Body
    group(children: (Body | Text)[]): Body
}

/** Format default lines and separate valid bodies; hosts create nodes and validate custom content. */
export function render_tooltip_bodies<Content, Body, Text>(
    tooltips: ResolvedTooltip<Content>[],
    renderer: TooltipRenderer<Content, Body, Text>,
) {
    const bodies: Body[] = []
    for (const tooltip of tooltips) {
        let body: Body | undefined
        if (tooltip.kind === 'custom') {
            body = renderer.custom(tooltip.content)
        } else {
            const lines: (Body | Text)[] = []
            for (const line of tooltip.lines) {
                if (lines.length > 0) {
                    lines.push(renderer.line_break())
                }
                lines.push(renderer.text(line))
            }
            body = renderer.group(lines)
        }
        if (body === undefined) {
            continue
        }
        if (bodies.length > 0) {
            bodies.push(renderer.divider())
        }
        bodies.push(body)
    }
    const hidden = bodies.length === 0
    return { bodies, hidden, style: hidden ? { display: 'none' } : undefined }
}

/** Mount as one body, wrapping only multiple entries so a single custom body keeps its identity. */
export function render_tooltip_body<Content, Body, Text>(
    tooltips: ResolvedTooltip<Content>[],
    renderer: TooltipRenderer<Content, Body, Text>,
) {
    const { bodies, style } = render_tooltip_bodies(tooltips, renderer)
    let body: Body | undefined
    if (bodies.length === 1) {
        body = bodies[0]
    } else if (bodies.length > 1) {
        body = renderer.group(bodies)
    }
    return { style, body }
}

/** Place the tooltip's input overlay at the inner-plot origin. */
export function tooltip_wrapper_style(inner: Rect) {
    return {
        position: 'absolute' as const,
        left: `${inner.left}px`,
        top: `${inner.top}px`,
        width: `${inner.right - inner.left}px`,
        height: `${inner.bottom - inner.top}px`,
    }
}
