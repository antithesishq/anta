import type { ABoxElement } from '@antadesign/anta/elements/a-box'
import type {
    BoxContext, BoxMeasurement, BoxContextChange, BoxMeasurementChange,
    CapturePointerInput, CaptureWheelInput,
} from '@antadesign/anta'
import type { Rect } from '../core/types'
import type { CaptureConfiguration } from '../core/interactions/zoom_pan'
import { RESET_ZOOM_BUTTON, type reset_zoom_presentation } from '../core/presentation/reset_zoom'
import { tooltip_wrapper_style } from '../core/presentation/tooltip'
import { configure_capture, prepare_canvas, size_host } from './surface_support'

export type PlotSurfacePresentation = {
    width: number
    height: number
    inner: Rect
    filter?: string
    reset: ReturnType<typeof reset_zoom_presentation>
}

export type PlotSurfaceEventMap = {
    measurechange: CustomEvent<BoxMeasurementChange>
    contextchange: CustomEvent<BoxContextChange>
    wheelinput: CustomEvent<CaptureWheelInput>
    pointerinput: CustomEvent<CapturePointerInput>
    resetrequest: CustomEvent<void>
}

export type PlotSurfaceCanvases = {
    canvas: OffscreenCanvas
    highlight: OffscreenCanvas
}

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
        readonly #box: ABoxElement
        readonly canvas: HTMLCanvasElement
        readonly highlight: HTMLCanvasElement
        readonly capture: HTMLElement
        readonly #reset: HTMLElement
        #ownership: 'unclaimed' | 'main' | 'worker' = 'unclaimed'
        #listeners: AbortController | null = null

        constructor() {
            super()
            const doc = this.ownerDocument
            this.#box = doc.createElement('a-box') as ABoxElement
            this.#box.setAttribute('observe', 'all')
            this.canvas = doc.createElement('canvas')
            this.canvas.className = 'plot-canvas'
            this.highlight = doc.createElement('canvas')
            this.highlight.className = 'plot-highlight'
            this.capture = doc.createElement('a-capture')
            this.capture.className = 'plot-capture'
            this.#reset = doc.createElement('a-button')
            this.#reset.className = 'plot-reset'
            this.#reset.setAttribute('type', 'button')
            this.#reset.setAttribute('role', 'button')
            this.#reset.setAttribute('priority', RESET_ZOOM_BUTTON.priority)
            this.#reset.setAttribute('size', RESET_ZOOM_BUTTON.size)
            this.#reset.tabIndex = 0
            const label = doc.createElement('a-button-label')
            label.textContent = RESET_ZOOM_BUTTON.label
            const icon = doc.createElement('a-icon')
            icon.setAttribute('shape', RESET_ZOOM_BUTTON.iconTrailing)
            icon.setAttribute('aria-hidden', 'true')
            this.#reset.append(label, icon)
            this.#reset.hidden = true
        }

        connectedCallback(): void {
            this.#listeners?.abort()
            this.#listeners = new AbortController()
            const { signal } = this.#listeners
            for (const name of ['measurechange', 'contextchange']) {
                this.#box.addEventListener(name, event => {
                    this.dispatchEvent(new CustomEvent(name, { detail: (event as CustomEvent).detail }))
                }, { signal })
            }
            this.#reset.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('resetrequest'))
            }, { signal })
            // Capture's custom events do not bubble. Forward their detail without delaying wheel handling.
            for (const name of ['wheelinput', 'pointerinput']) {
                this.capture.addEventListener(name, event => {
                    this.dispatchEvent(new CustomEvent(name, { detail: (event as CustomEvent).detail }))
                }, { signal })
            }
            if (this.#box.parentNode !== this) {
                this.append(this.#box, this.canvas, this.highlight, this.capture, this.#reset)
            }
        }

        disconnectedCallback(): void {
            this.#listeners?.abort()
            this.#listeners = null
        }

        get measurement(): BoxMeasurement { return this.#box.measurement }
        get context(): BoxContext { return this.#box.context }
        get cursor(): string { return this.capture.style.cursor }
        set cursor(value: string) { this.capture.style.cursor = value }
        setSize(dimensions: { width?: number; height?: number }): void { size_host(this, dimensions) }
        configureCapture(configuration: CaptureConfiguration): void {
            configure_capture(this.capture, configuration)
        }

        present({ width, height, inner, filter, reset }: PlotSurfacePresentation): void {
            for (const canvas of [this.canvas, this.highlight]) {
                canvas.style.width = `${width}px`
                canvas.style.height = `${height}px`
                canvas.style.filter = filter ?? ''
            }
            Object.assign(this.capture.style, tooltip_wrapper_style(inner))
            Object.assign(this.#reset.style, reset.position, reset.button.style)
            this.#reset.hidden = !reset.visible
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
