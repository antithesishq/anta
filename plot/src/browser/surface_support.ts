import { prepare_canvas_context } from '../core/render/canvas'
import { capture_attributes, type CaptureConfiguration } from '../core/interactions/zoom_pan'

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
    for (const [name, value] of Object.entries(capture_attributes(settings))) {
        set_attribute(capture, name, value ?? null)
    }
}

function set_attribute(element: HTMLElement, name: string, value: string | null): void {
    if (value === null) {
        element.removeAttribute(name)
    } else if (element.getAttribute(name) !== value) {
        element.setAttribute(name, value)
    }
}
