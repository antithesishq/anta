import type { ABoxElement } from '@antadesign/anta/elements/a-box'
import type { BoxContext, BoxMeasurement } from '@antadesign/anta/box-types'
import type { CaptureConfiguration } from '../core/interactions/zoom_pan'
import { RESET_ZOOM_BUTTON } from '../core/presentation/reset_zoom'
import { tooltip_wrapper_style } from '../core/presentation/tooltip'
import { configure_capture, prepare_canvas, size_host } from './surface_support'
import type {
    PlotSurfacePresentation, PlotSurfaceMouseInput, PlotSurfaceCanvases, PlotSurfaceEventMap,
} from '../core/presentation/surface'
export type { PlotSurfacePresentation, PlotSurfaceCanvases, PlotSurfaceEventMap } from '../core/presentation/surface'

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

        readonly #box: ABoxElement
        readonly canvas: HTMLCanvasElement
        readonly highlight: HTMLCanvasElement
        readonly capture: HTMLElement
        readonly #reset: HTMLElement
        #ownership: 'unclaimed' | 'main' | 'worker' = 'unclaimed'
        #listeners: AbortController | null = null
        #inputListeners: AbortController | null = null
        #transferRequested = false
        #connection = 0

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
            this.capture.style.display = 'none'
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
                        this.#reset.hidden = true
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

            this.#listenForMouseInput()
            this.#scheduleTransfer()
        }

        disconnectedCallback(): void {
            this.#connection++
            this.#inputListeners?.abort()
            this.#inputListeners = null
            this.#listeners?.abort()
            this.#listeners = null
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

        #listenForMouseInput(): void {
            this.#inputListeners?.abort()
            this.#inputListeners = new AbortController()
            const { signal } = this.#inputListeners
            const scope = this.getAttribute('input-scope') === 'parent' ? this.parentElement : this
            if (scope === null) return

            const normalized = (event: MouseEvent): PlotSurfaceMouseInput | null => {
                if (event.target instanceof Node && this.#reset.contains(event.target)) return null
                if (this.capture.style.display === 'none') return null

                const rect = this.capture.getBoundingClientRect()
                const offsetX = event.clientX - rect.left
                const offsetY = event.clientY - rect.top
                if (rect.width <= 0 || rect.height <= 0 || offsetX < 0 || offsetY < 0
                    || offsetX > rect.width || offsetY > rect.height) return null

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

            scope.addEventListener('dblclick', event => {
                if (normalized(event) !== null) this.#emit('plotdoubleclick', undefined)
            }, { signal })
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
            this.capture.style.display = ''
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
