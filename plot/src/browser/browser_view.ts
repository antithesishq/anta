import { TOOLTIP_OPTIONS } from '../core/presentation/tooltip'
import { RESET_ZOOM_BUTTON } from '../core/presentation/reset_zoom'
import { prepare_canvas_context } from '../core/render/canvas'
import type { ATooltipElement } from '@antadesign/anta/elements/a-tooltip'
import type { CaptureConfiguration } from '../core/interactions/zoom_pan'
import type { ABoxElement } from '@antadesign/anta/elements/a-box'

export type BrowserView = {
    root: HTMLDivElement
    box: ABoxElement
    canvas: HTMLCanvasElement
    capture: HTMLElement
    highlight: HTMLCanvasElement
    tooltip: ATooltipElement
    reset: HTMLElement
}

// Create the light-DOM surfaces; Box and Capture must already be registered in this document.
export function create_browser_view(doc: Document): BrowserView {
    const root = doc.createElement('div')
    root.className = 'plot-root'

    const box = doc.createElement('a-box') as ABoxElement
    box.setAttribute('observe', 'all')

    const canvas = doc.createElement('canvas')
    canvas.className = 'plot-canvas'

    const capture = doc.createElement('a-capture')
    capture.className = 'plot-capture'

    const highlight = doc.createElement('canvas')
    highlight.className = 'plot-highlight'

    const tooltip = doc.createElement('a-tooltip') as ATooltipElement
    tooltip.className = 'plot-tooltip'
    if (TOOLTIP_OPTIONS.follow) {
        tooltip.setAttribute('follow', '')
    }
    tooltip.setAttribute('delay', String(TOOLTIP_OPTIONS.delay))

    const reset = doc.createElement('a-button')
    reset.className = 'plot-reset'
    reset.setAttribute('type', 'button')
    reset.setAttribute('role', 'button')
    reset.setAttribute('priority', RESET_ZOOM_BUTTON.priority)
    reset.setAttribute('size', RESET_ZOOM_BUTTON.size)
    reset.tabIndex = 0

    const label = doc.createElement('a-button-label')
    label.textContent = RESET_ZOOM_BUTTON.label

    const icon = doc.createElement('a-icon')
    icon.setAttribute('shape', RESET_ZOOM_BUTTON.iconTrailing)
    icon.setAttribute('aria-hidden', 'true')
    reset.append(label, icon)
    reset.hidden = true

    capture.append(tooltip)
    root.append(box, canvas, highlight, capture, reset)

    return { root, box, canvas, capture, highlight, tooltip, reset }
}

type SavedDimension = { value: string; priority: string }
type HostDimensions = { width?: number; height?: number }

// Keep the caller's inline sizing while explicit plot dimensions temporarily override it.
const unpinned_dimensions = new WeakMap<HTMLElement, Partial<Record<'width' | 'height', SavedDimension>>>()

// Pin each host dimension independently, restoring its previous CSS when that pin is removed.
export function size_host(host: HTMLElement, dimensions: HostDimensions): void {
    const saved = unpinned_dimensions.get(host) ?? {}

    for (const axis of ['width', 'height'] as const) {
        const size = dimensions[axis]

        if (size !== undefined) {
            saved[axis] ??= {
                value: host.style.getPropertyValue(axis),
                priority: host.style.getPropertyPriority(axis),
            }
            host.style.setProperty(axis, `${size}px`, saved[axis].priority)
        } else if (saved[axis] !== undefined) {
            const original = saved[axis]

            if (original.value === '') {
                host.style.removeProperty(axis)
            } else {
                host.style.setProperty(axis, original.value, original.priority)
            }
            delete saved[axis]
        }
    }

    if (saved.width === undefined && saved.height === undefined) {
        unpinned_dimensions.delete(host)
    } else {
        unpinned_dimensions.set(host, saved)
    }
}

// Context options are fixed by the first lookup, including lookups made just to clear a canvas.
export function get_canvas_context(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
    return canvas.getContext('2d', { desynchronized: true, colorSpace: 'display-p3' })
}

// Size the backing store for DPR and keep drawing coordinates in CSS pixels.
export function prepare_canvas(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    dpr: number,
): CanvasRenderingContext2D {
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = get_canvas_context(canvas)

    if (ctx === null) {
        throw new Error('plot: unable to get a 2D canvas context')
    }

    prepare_canvas_context(ctx, width, height, dpr)
    return ctx
}

// Apply resolved gesture settings without rewriting unchanged attributes and restarting Capture state.
export function configure_capture(capture: HTMLElement, settings: CaptureConfiguration): void {
    const directions = settings.wheel_capture === 'both' ? 'up down' : settings.wheel_capture

    set_attribute(capture, 'wheel-capture', directions)
    set_attribute(capture, 'wheel-modifier', settings.wheel_modifier)
    set_attribute(capture, 'wheel-activation', settings.wheel_activation)
    set_attribute(capture, 'wheel-delay', String(settings.wheel_delay))
    set_attribute(capture, 'wheel-tolerance', String(settings.wheel_tolerance))
    set_attribute(capture, 'wheel-reset-on-move', settings.wheel_reset_on_move ? '' : null)
    set_attribute(capture, 'pointer-capture', settings.pointer_capture)
    set_attribute(capture, 'pointer-buttons', settings.pointer_buttons.join(' '))
    set_attribute(capture, 'pointer-threshold', String(settings.pointer_threshold))
    set_attribute(capture, 'pointer-modifier', settings.pointer_modifier)
}

function set_attribute(element: HTMLElement, name: string, value: string | null): void {
    if (value === null) {
        element.removeAttribute(name)
    } else if (element.getAttribute(name) !== value) {
        element.setAttribute(name, value)
    }
}
