import type { CapturePointerInput, CaptureWheelInput, CaptureInputGeometry } from '@antadesign/anta/capture-types'
import { interaction_target, type InteractionRegions } from '../core/interactions/target'
import type { Rect } from '../core/types'
import type { ABoxElement } from '@antadesign/anta/elements/a-box'
import type { BoxContext, BoxMeasurement } from '@antadesign/anta/box-types'
import { drag_rectangle, type CaptureConfiguration } from '../core/interactions/zoom_pan'
import type { AMenuElement } from '@antadesign/anta/elements/a-menu'
import { tooltip_wrapper_style } from '../core/presentation/tooltip'
import { configure_capture, prepare_canvas, size_host } from './surface_support'
import type {
    PlotSurfacePresentation, PlotSurfaceMouseInput, PlotSurfaceCanvases, PlotSurfaceEventMap,
} from '../core/presentation/surface'
export type { PlotSurfacePresentation, PlotSurfaceCanvases, PlotSurfaceEventMap } from '../core/presentation/surface'

// Light-DOM layout travels with each surface, including across document adoption.
const SURFACE_STYLES = `
a-plot-surface {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    /* Anta's theme classes also set typography; keep the plot's inherited font. */
    font: inherit;
    font-feature-settings: inherit;
}

a-plot-surface > a-box {
    display: block;
    position: absolute;
    inset: 0;
    pointer-events: none;
}

a-plot-surface > canvas {
    display: block;
    position: absolute;
    left: 0;
    top: 0;
}

a-plot-surface > a-capture {
    display: block;
    position: absolute;
}

a-plot-surface > a-capture[pointer-capture] {
    user-select: none;
}

a-plot-surface .plot-zoom-rectangle {
    position: absolute;
    pointer-events: none;
    box-sizing: border-box;
    border: 1px solid var(--border-3-brand);
    background: color-mix(in oklch, var(--text-1-brand) 12%, transparent);
}

a-plot-surface > .plot-highlight {
    pointer-events: none;
}

a-plot-surface [hidden] {
    display: none !important;
}
`

const CAPTURE_ATTRIBUTES = [
    'wheel-capture', 'wheel-modifier', 'wheel-activation', 'wheel-delay', 'wheel-tolerance', 'wheel-reset-on-move',
    'pointer-capture', 'pointer-buttons', 'pointer-threshold', 'pointer-modifier',
]

/** Light-DOM host only: callers own composition, rendering, interactions and tooltip content. */
export interface APlotSurfaceElement extends HTMLElement {
    readonly canvas: HTMLCanvasElement
    readonly highlight: HTMLCanvasElement
    readonly capture: HTMLElement
    readonly measurement: BoxMeasurement
    readonly context: BoxContext
    setSize(dimensions: { width?: number; height?: number }): void
    present(presentation: PlotSurfacePresentation): void
    configureCapture(configuration: CaptureConfiguration): void
    cursor: string
    prepareCanvas(width: number, height: number, dpr: number): CanvasRenderingContext2D
    /** Select worker ownership before any context lookup. This operation may only be attempted once. */
    transferCanvases(): PlotSurfaceCanvases
}

// Defer HTMLElement access until explicit browser registration.
export function create_plot_surface_element(): CustomElementConstructor {
    return class PlotSurfaceElement extends HTMLElement implements APlotSurfaceElement {
        static observedAttributes = [...CAPTURE_ATTRIBUTES, 'presentation', 'cursor', 'canvas-owner', 'input-scope']

        readonly #styles: HTMLStyleElement
        readonly #box: ABoxElement
        readonly canvas: HTMLCanvasElement
        readonly highlight: HTMLCanvasElement
        readonly capture: HTMLElement
        readonly #axisCapture: { x: HTMLElement; y: HTMLElement }
        #regions: InteractionRegions | null = null
        readonly #rectangle: HTMLElement
        #rectangleStart: { x: number; y: number; width: number; height: number } | null = null
        readonly #menuAnchor: HTMLElement
        readonly #menu: AMenuElement
        readonly #menuItems: Record<'in' | 'out' | 'reset', HTMLElement>
        #menuState: PlotSurfacePresentation['menu'] | null = null
        #menuInput: PlotSurfaceMouseInput | null = null
        #ownership: 'unclaimed' | 'main' | 'worker' = 'unclaimed'
        #listeners: AbortController | null = null
        #inputListeners: AbortController | null = null
        #transferRequested = false
        #connection = 0

        constructor() {
            super()
            const doc = this.ownerDocument
            this.#styles = doc.createElement('style')
            this.#styles.textContent = SURFACE_STYLES
            this.#box = doc.createElement('a-box') as ABoxElement
            this.#box.setAttribute('observe', 'all')
            this.canvas = doc.createElement('canvas')
            this.canvas.className = 'plot-canvas'
            this.highlight = doc.createElement('canvas')
            this.highlight.className = 'plot-highlight'
            this.capture = doc.createElement('a-capture')
            this.capture.className = 'plot-capture'
            this.capture.style.display = 'none'
            this.#rectangle = doc.createElement('div')
            this.#rectangle.className = 'plot-zoom-rectangle'
            this.#rectangle.hidden = true
            this.#rectangle.setAttribute('aria-hidden', 'true')
            this.capture.append(this.#rectangle)
            this.#axisCapture = { x: doc.createElement('a-capture'), y: doc.createElement('a-capture') }
            for (const [axis, capture] of Object.entries(this.#axisCapture)) {
                capture.className = `plot-axis-capture plot-axis-${axis}`
                capture.style.display = 'none'
            }
            this.#menuAnchor = doc.createElement('span')
            this.#menuAnchor.tabIndex = -1
            this.#menuAnchor.style.cssText = 'position:absolute;pointer-events:none'
            this.#menuAnchor.setAttribute('aria-label', 'Plot zoom menu')
            this.#menu = doc.createElement('a-menu') as AMenuElement
            this.#menu.setAttribute('context', '')
            this.#menu.setAttribute('coord', '')
            this.#menu.setAttribute('aria-label', 'Plot zoom')
            this.#menuItems = Object.fromEntries(
                (['in', 'out', 'reset'] as const).map(action => {
                    const item = doc.createElement('a-menu-item')
                    item.dataset.zoomAction = action
                    const label = doc.createElement('a-menu-item-label')
                    label.textContent = { in: 'Zoom In', out: 'Zoom Out', reset: 'Reset Zoom' }[action]
                    item.append(label)
                    this.#menu.append(item)
                    return [action, item]
                }),
            ) as Record<'in' | 'out' | 'reset', HTMLElement>
        }

        attributeChangedCallback(name: string, previous: string | null, value: string | null): void {
            if (previous === value) return

            if (CAPTURE_ATTRIBUTES.includes(name)) {
                if (value === null) this.capture.removeAttribute(name)
                else this.capture.setAttribute(name, value)
            } else if (name === 'cursor') {
                this.cursor = value ?? ''
            } else if (name === 'presentation') {
                try {
                    if (value === null) {
                        this.capture.style.display = 'none'
                        this.#clearRectangle()
                        this.#regions = null
                        for (const capture of Object.values(this.#axisCapture)) capture.style.display = 'none'
                        this.#menuState = null
                        this.#menu.close()
                    } else {
                        this.present(JSON.parse(value))
                    }
                } catch (error) {
                    // Defer until the caller has attached its event listeners in this DOM update.
                    const connection = this.#connection + (this.isConnected ? 0 : 1)
                    queueMicrotask(() => {
                        if (this.isConnected && connection === this.#connection) this.#reportError(error)
                    })
                }
            } else if (name === 'canvas-owner') {
                this.#scheduleTransfer()
            } else if (name === 'input-scope' && this.isConnected) {
                this.#listenForMouseInput()
            }
        }

        connectedCallback(): void {
            this.#connection++
            this.#listeners?.abort()
            this.#listeners = new AbortController()
            const { signal } = this.#listeners
            for (const name of ['measurechange', 'contextchange']) {
                this.#box.addEventListener(name, event => {
                    this.dispatchEvent(new CustomEvent(name, { detail: (event as CustomEvent).detail }))
                }, { signal })
            }
            for (const action of ['in', 'out', 'reset'] as const) {
                const item = this.#menuItems[action]
                item.addEventListener('click', () => {
                    if (item.hasAttribute('disabled') || this.#menuInput === null) return
                    this.#emit('zoomrequest', { ...this.#menuInput, action })
                    this.#menu.close()
                }, { signal })
            }
            // Every Capture reports offsets relative to the inner plot before crossing threads.
            for (const capture of [this.capture, this.#axisCapture.x, this.#axisCapture.y]) {
                capture.addEventListener('wheelinput', event => {
                    const detail = (event as CustomEvent<CaptureWheelInput>).detail
                    this.#emit('wheelinput', { ...detail, ...this.#inputGeometry(capture, detail) })
                }, { signal })
                capture.addEventListener('pointerinput', event => {
                    const detail = (event as CustomEvent<CapturePointerInput>).detail
                    if (capture === this.capture) this.#drawRectangle(detail)
                    this.#emit('pointerinput', {
                        ...detail, ...this.#inputGeometry(capture, detail),
                        start: { ...detail.start, ...this.#inputGeometry(capture, detail.start) },
                    })
                }, { signal })
            }
            if (this.#box.parentNode !== this) {
                this.append(this.#styles, this.#box, this.canvas, this.highlight, this.capture,
                    this.#axisCapture.x, this.#axisCapture.y, this.#menuAnchor, this.#menu)
            }

            this.#listenForMouseInput()
            this.#scheduleTransfer()
        }

        disconnectedCallback(): void {
            this.#menu.close()
            this.#menuInput = null
            this.#clearRectangle()
            this.#connection++
            this.#inputListeners?.abort()
            this.#inputListeners = null
            this.#listeners?.abort()
            this.#listeners = null
        }

        #clearRectangle(): void {
            this.#rectangleStart = null
            this.#rectangle.hidden = true
        }

        // Draw from Capture input on the browser thread, even when the plot lives in a worker.
        #drawRectangle(input: CapturePointerInput): void {
            if (input.phase === 'end' || input.phase === 'cancel') {
                this.#clearRectangle()
                return
            }
            if (input.phase === 'start') {
                this.#clearRectangle()
                if (!input.start.pointerEvent.ctrlKey) return
                this.#rectangleStart = {
                    x: input.start.localX, y: input.start.localY,
                    width: input.start.boxWidth, height: input.start.boxHeight,
                }
            }
            const start = this.#rectangleStart
            if (start === null) return
            const rect = drag_rectangle({ left: 0, top: 0, right: start.width, bottom: start.height }, start, {
                x: start.x + input.movementX, y: start.y + input.movementY,
            })
            Object.assign(this.#rectangle.style, {
                left: `${rect.left}px`, top: `${rect.top}px`,
                width: `${rect.right - rect.left}px`, height: `${rect.bottom - rect.top}px`,
            })
            this.#rectangle.hidden = false
        }

        #emit<K extends keyof PlotSurfaceEventMap>(name: K, detail: PlotSurfaceEventMap[K]['detail']): void {
            this.dispatchEvent(new CustomEvent(name, { detail }))
        }

        #reportError(error: unknown): void {
            this.#emit('surfaceerror', { message: error instanceof Error ? error.message : String(error) })
        }

        #scheduleTransfer(): void {
            if (!this.isConnected || this.getAttribute('canvas-owner') !== 'worker' || this.#transferRequested) return
            const connection = this.#connection

            // Normal DOM consumers attach listeners in the same mutation batch as mounting the element.
            queueMicrotask(() => {
                if (!this.isConnected || connection !== this.#connection || this.#transferRequested
                    || this.getAttribute('canvas-owner') !== 'worker') return

                this.#transferRequested = true
                try {
                    const canvases = this.transferCanvases()
                    this.#emit('canvastransfer', { ...canvases, scale: this.context.devicePixelRatio })
                } catch (error) {
                    this.#reportError(error)
                }
            })
        }

        #inputGeometry(capture: HTMLElement, input: CaptureInputGeometry): CaptureInputGeometry {
            if (capture === this.capture) return input
            const region = capture.getBoundingClientRect()
            const inner = this.capture.getBoundingClientRect()
            const localX = input.localX + region.left - inner.left
            const localY = input.localY + region.top - inner.top
            return {
                ...input, localX, localY, boxWidth: inner.width, boxHeight: inner.height,
                inside: localX >= 0 && localX <= inner.width && localY >= 0 && localY <= inner.height,
            }
        }

        #listenForMouseInput(): void {
            this.#inputListeners?.abort()
            this.#inputListeners = new AbortController()
            const { signal } = this.#inputListeners
            const scope = this.getAttribute('input-scope') === 'parent' ? this.parentElement : this
            if (scope === null) return

            const normalized = (event: MouseEvent): PlotSurfaceMouseInput | null => {
                if (event.composedPath().includes(this.#menu)) return null
                if (this.capture.style.display === 'none') return null

                const rect = this.capture.getBoundingClientRect()
                const offsetX = event.clientX - rect.left
                const offsetY = event.clientY - rect.top
                if (rect.width <= 0 || rect.height <= 0
                    || interaction_target(this.#regions, { offsetX, offsetY }) === null) return null

                return { offsetX, offsetY, ctrlKey: event.ctrlKey }
            }

            scope.addEventListener('mousemove', event => {
                const input = normalized(event)
                if (input === null) this.#emit('plotleave', undefined)
                else this.#emit('plotmove', input)
            }, { signal })

            scope.addEventListener('mouseleave', () => this.#emit('plotleave', undefined), { signal })

            scope.addEventListener('click', event => {
                const input = normalized(event)
                if (input !== null) this.#emit('plotclick', input)
            }, { signal })

            scope.addEventListener('contextmenu', event => {
                const input = normalized(event)
                if (input === null || !this.#menuState?.enabled || this.#rectangleStart !== null) return
                event.preventDefault()
                this.#menuInput = input
                const bounds = this.getBoundingClientRect()
                this.#menuAnchor.style.left = `${event.clientX - bounds.left}px`
                this.#menuAnchor.style.top = `${event.clientY - bounds.top}px`
                this.#emit('plotleave', undefined)
                this.#menu.open({ coord: [event.clientX, event.clientY], originEvent: event })
            }, { signal })
        }

        get measurement(): BoxMeasurement { return this.#box.measurement }
        get context(): BoxContext { return this.#box.context }
        get cursor(): string { return this.capture.style.cursor }
        set cursor(value: string) {
            this.capture.style.cursor = value
            for (const capture of Object.values(this.#axisCapture)) capture.style.cursor = value
        }
        setSize(dimensions: { width?: number; height?: number }): void { size_host(this, dimensions) }
        configureCapture(configuration: CaptureConfiguration): void {
            configure_capture(this.capture, configuration)
        }

        present({ width, height, inner, regions, axis_capture, filter, menu }: PlotSurfacePresentation): void {
            this.capture.style.display = ''
            this.#regions = regions ?? { plot: inner, x: null, y: null }
            for (const canvas of [this.canvas, this.highlight]) {
                canvas.style.width = `${width}px`
                canvas.style.height = `${height}px`
                canvas.style.filter = filter ?? ''
            }
            Object.assign(this.capture.style, tooltip_wrapper_style(inner))
            for (const axis of ['x', 'y'] as const) {
                const capture = this.#axisCapture[axis]
                const bounds = this.#regions[axis]
                const configuration = axis_capture?.[axis]
                if (bounds === null || configuration === undefined) {
                    capture.style.display = 'none'
                    continue
                }
                // Canvas labels outside the surface are clipped; their input regions are too.
                const visible: Rect = {
                    left: Math.max(0, bounds.left), right: Math.min(width, bounds.right),
                    top: Math.max(0, bounds.top), bottom: Math.min(height, bounds.bottom),
                }
                capture.style.display = visible.right > visible.left && visible.bottom > visible.top ? '' : 'none'
                Object.assign(capture.style, tooltip_wrapper_style(visible))
                configure_capture(capture, configuration)
            }
            this.#menuState = menu
            this.#menuItems.in.toggleAttribute('disabled', !menu.zoom_in)
            this.#menuItems.out.toggleAttribute('disabled', !menu.zoom_out)
            this.#menuItems.reset.toggleAttribute('disabled', !menu.reset)
            if (!menu.enabled) this.#menu.close()
        }

        prepareCanvas(width: number, height: number, dpr: number): CanvasRenderingContext2D {
            if (this.#ownership === 'worker') throw new Error('plot: canvas belongs to the worker')
            this.#ownership = 'main'
            return prepare_canvas(this.canvas, width, height, dpr)
        }

        transferCanvases(): PlotSurfaceCanvases {
            if (this.#ownership !== 'unclaimed') throw new Error('plot: canvas ownership already selected')
            // Mark before either transfer: partial failures cannot retry an already-transferred canvas.
            this.#ownership = 'worker'
            return {
                canvas: this.canvas.transferControlToOffscreen(),
                highlight: this.highlight.transferControlToOffscreen(),
            }
        }
    }
}
