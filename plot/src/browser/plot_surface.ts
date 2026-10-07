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
    /** Set fallback configuration. Presentation capture_policy takes precedence while supplied. */
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
        #captureBounds: Rect = { left: 0, top: 0, right: 0, bottom: 0 }
        #capturePolicy: PlotSurfacePresentation['capture_policy']
        #fallbackConfiguration: CaptureConfiguration | null = null
        #keyboardMenu = false
        #shiftWheelClaim: string | null = null
        #captureTarget: 'plot' | 'x-axis' | 'y-axis' | null = 'plot'
        #menuWheelActive = false
        #regions: InteractionRegions | null = null
        readonly #rectangle: HTMLElement
        #rectangleStart: { x: number; y: number; width: number; height: number; zoomX: boolean; zoomY: boolean } | null = null
        readonly #menuAnchor: HTMLElement
        readonly #menu: AMenuElement
        readonly #menuItems: Record<'in' | 'out' | 'reset', HTMLElement>
        #menuState: PlotSurfacePresentation['menu'] | null = null
        #menuInput: PlotSurfaceMouseInput | null = null
        #pointerInside = false
        #dragActive = false
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
            this.#menuAnchor = doc.createElement('span')
            this.#menuAnchor.tabIndex = 0
            this.#menuAnchor.style.cssText = 'position:absolute;inset:0;pointer-events:none'
            this.#menuAnchor.setAttribute('role', 'group')
            this.#menuAnchor.setAttribute('aria-label', 'Plot zoom controls. Press Shift+F10 to open the zoom menu.')
            this.#menu = doc.createElement('a-menu') as AMenuElement
            this.#menu.setAttribute('context', '')
            this.#menu.setAttribute('coord', '')
            this.#menu.setAttribute('aria-label', 'Plot zoom')
            this.#menuItems = Object.fromEntries(
                (['reset', 'out', 'in'] as const).map(action => {
                    const item = doc.createElement('a-menu-item')
                    item.dataset.zoomAction = action
                    item.setAttribute('role', 'menuitem')
                    item.tabIndex = 0
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
                if (this.#capturePolicy !== undefined) return
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
                        this.#capturePolicy = undefined
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
                item.addEventListener('click', event => {
                    if (item.hasAttribute('disabled') || this.#menuInput === null) return
                    // Menu input is deliberate plot interaction; closing it must not require a new dwell.
                    this.#menuWheelActive = this.#insideCapture(event)
                    this.#applyCapturePolicy()
                    this.#emit('zoomrequest', { ...this.#menuInput, action })
                    this.#menu.close()
                    if (this.#keyboardMenu) this.#menuAnchor.focus()
                    this.#keyboardMenu = false
                }, { signal })
            }
            // Menu items live outside Capture. Track actual coordinates across both surfaces,
            // including captured drags, and release this visit as soon as the pointer leaves.
            this.ownerDocument.addEventListener('pointermove', event => {
                if (this.#menuWheelActive && !this.#insideCapture(event)) this.#releaseMenuWheel()
            }, { signal })
            this.ownerDocument.addEventListener('pointerout', event => {
                if (event.relatedTarget === null && !this.#insideCapture(event)) this.#releaseMenuWheel()
            }, { signal })
            this.ownerDocument.defaultView?.addEventListener('blur', () => this.#releaseMenuWheel(), { signal })
            this.#menuAnchor.addEventListener('keydown', event => {
                if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
                if (!this.#menuState?.enabled || this.#dragActive) return
                event.preventDefault()
                event.stopPropagation()
                const rect = this.capture.getBoundingClientRect()
                const inner = this.#regions?.plot ?? this.#captureBounds
                const x = (inner.right - inner.left) / 2
                const y = (inner.bottom - inner.top) / 2
                this.#keyboardMenu = true
                this.#menuInput = { offsetX: x, offsetY: y, ctrlKey: false }
                this.#leavePlot()
                this.#menu.open({ coord: [rect.left + inner.left - this.#captureBounds.left + x, rect.top + inner.top - this.#captureBounds.top + y],
                    viaKeyboard: true, originEvent: event })
            }, { signal })
            // Choose the region policy before Capture claims the native event.
            const route = (event: MouseEvent) => {
                if (this.#shiftWheelClaim !== null) {
                    this.capture.setAttribute('wheel-capture', this.#shiftWheelClaim)
                    this.#shiftWheelClaim = null
                }
                const rect = this.capture.getBoundingClientRect()
                const inner = this.#regions?.plot ?? this.#captureBounds
                const input = {
                    offsetX: event.clientX - rect.left - (inner.left - this.#captureBounds.left),
                    offsetY: event.clientY - rect.top - (inner.top - this.#captureBounds.top),
                }
                this.#captureTarget = interaction_target(this.#regions, input)
                this.#applyCapturePolicy()
            }
            this.capture.addEventListener('pointerdown', route, { capture: true, signal })
            this.capture.addEventListener('mousemove', route, { capture: true, signal })
            this.capture.addEventListener('wheel', event => {
                route(event)
                const claim = this.capture.getAttribute('wheel-capture')
                if (event.shiftKey && !event.ctrlKey) {
                    // Ignore this sample inside Capture without hiding it from ancestor listeners.
                    if (claim !== null) {
                        this.#shiftWheelClaim = claim
                        this.capture.setAttribute('wheel-capture', 'none')
                        // Restore on the next native input, not a microtask between event listeners.
                    }
                    return
                }
                // Handle pinch immediately without changing Capture's activation or losing its dwell.
                if (this.#capturePolicy !== undefined && event.ctrlKey && this.#captureTarget !== null) {
                    this.#capturePinch(event, claim)
                }
            }, { capture: true, passive: false, signal })
            this.capture.addEventListener('wheelinput', event => {
                this.#pointerInside = true
                const detail = (event as CustomEvent<CaptureWheelInput>).detail
                this.#emit('wheelinput', { ...detail, ...this.#inputGeometry(detail) })
            }, { signal })
            this.capture.addEventListener('pointerinput', event => {
                const detail = (event as CustomEvent<CapturePointerInput>).detail
                this.#dragActive = detail.phase === 'start' || detail.phase === 'move'
                if (detail.phase === 'start') this.#pointerInside = true
                const normalized = {
                    ...detail, ...this.#inputGeometry(detail),
                    start: { ...detail.start, ...this.#inputGeometry(detail.start) },
                }
                this.#drawRectangle(normalized)
                this.#emit('pointerinput', normalized)
                if (!this.#dragActive) {
                    this.#captureTarget = interaction_target(this.#regions, { offsetX: normalized.localX, offsetY: normalized.localY })
                    this.#applyCapturePolicy()
                }
            }, { signal })
            if (this.#box.parentNode !== this) {
                this.append(this.#styles, this.#box, this.canvas, this.highlight, this.capture,
                    this.#menuAnchor, this.#menu)
            }

            this.#listenForMouseInput()
            this.#scheduleTransfer()
        }

        disconnectedCallback(): void {
            this.#menuWheelActive = false
            this.#pointerInside = false
            this.#dragActive = false
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
                if (!input.start.pointerEvent.ctrlKey || interaction_target(this.#regions, {
                    offsetX: input.start.localX, offsetY: input.start.localY,
                }) !== 'plot') return
                // Axis policies include both configuration and whether the axis is continuous.
                const zoomX = this.#capturePolicy === undefined || this.#capturePolicy.x.pointer_capture !== null
                const zoomY = this.#capturePolicy === undefined || this.#capturePolicy.y.pointer_capture !== null
                if (!zoomX && !zoomY) return
                this.#rectangleStart = {
                    x: input.start.localX, y: input.start.localY,
                    width: input.start.boxWidth, height: input.start.boxHeight,
                    zoomX, zoomY,
                }
            }
            const start = this.#rectangleStart
            if (start === null) return
            const rect = drag_rectangle({ left: 0, top: 0, right: start.width, bottom: start.height }, start, {
                x: start.x + input.movementX, y: start.y + input.movementY,
            })
            // The preview covers the viewport that release will select, including unchanged axes.
            if (!start.zoomX) { rect.left = 0; rect.right = start.width }
            if (!start.zoomY) { rect.top = 0; rect.bottom = start.height }
            Object.assign(this.#rectangle.style, {
                left: `${rect.left + (this.#regions?.plot.left ?? 0) - this.#captureBounds.left}px`,
                top: `${rect.top + (this.#regions?.plot.top ?? 0) - this.#captureBounds.top}px`,
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

        #capturePinch(event: WheelEvent, claim: string | null): void {
            if (claim === null || event.defaultPrevented || !event.cancelable || !this.#insideCapture(event)) return
            // Read units before deltas, matching Capture's Firefox compatibility handling.
            const deltaMode = event.deltaMode
            const { deltaX, deltaY, deltaZ } = event
            if (deltaY === 0 || Math.abs(deltaX) > Math.abs(deltaY)
                || !claim.split(' ').includes(deltaY < 0 ? 'up' : 'down')) return
            for (const node of event.composedPath()) {
                if (node instanceof this.ownerDocument.defaultView!.Element && (node.hasAttribute('data-capture-ignore')
                    || node.matches('textarea, select, input[type="number"], input[type="range"], a-menu'))) return
                if (node === this.capture) break
            }
            event.preventDefault()
            if (!event.defaultPrevented) return
            // Capture ignores an already claimed event, avoiding duplicate delivery.
            event.stopPropagation()
            const rect = this.capture.getBoundingClientRect()
            this.#pointerInside = true
            this.#emit('wheelinput', {
                ...this.#inputGeometry({
                    localX: event.clientX - rect.left, localY: event.clientY - rect.top,
                    boxWidth: rect.width, boxHeight: rect.height, inside: true,
                    focusWithin: this.capture.matches(':focus-within'),
                }),
                activationReason: 'immediate',
                wheelEvent: {
                    type: event.type, timeStamp: event.timeStamp, isTrusted: event.isTrusted,
                    cancelable: event.cancelable, defaultPrevented: event.defaultPrevented,
                    altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey,
                    button: event.button, buttons: event.buttons,
                    clientX: event.clientX, clientY: event.clientY, pageX: event.pageX, pageY: event.pageY,
                    screenX: event.screenX, screenY: event.screenY, offsetX: event.offsetX, offsetY: event.offsetY,
                    deltaMode, deltaX, deltaY, deltaZ,
                },
            })
        }

        #insideCapture(event: { clientX: number; clientY: number }): boolean {
            const rect = this.capture.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0
                && event.clientX >= rect.left && event.clientX <= rect.right
                && event.clientY >= rect.top && event.clientY <= rect.bottom
        }

        #releaseMenuWheel(): void {
            if (!this.#menuWheelActive) return
            this.#menuWheelActive = false
            this.#applyCapturePolicy()
        }

        #applyCapturePolicy(): void {
            const policy = this.#capturePolicy
            if (policy === undefined) {
                if (this.#fallbackConfiguration !== null) configure_capture(this.capture, this.#fallbackConfiguration)
                return
            }
            const target = this.#captureTarget
            const config = target === 'x-axis' ? policy.x : target === 'y-axis' ? policy.y : policy.plot
            // Keep pointer capture stable throughout a drag as the pointer crosses regions.
            if (this.#dragActive) return
            configure_capture(this.capture, {
                ...policy.plot,
                wheel_activation: this.#menuWheelActive ? 'hover' : policy.plot.wheel_activation,
                // Keep one pointer session and one dwell clock across the whole surface.
                // Core hit routing rejects drags on disabled axes and in the corner.
                wheel_capture: policy.plot.wheel_capture === null ? null
                    : target === null ? 'both' : config.wheel_capture === null ? 'none'
                    : this.#menuWheelActive ? 'both' : config.wheel_capture,
            })
        }

        #inputGeometry(input: CaptureInputGeometry): CaptureInputGeometry {
            const inner = this.#regions?.plot ?? this.#captureBounds
            const localX = input.localX - (inner.left - this.#captureBounds.left)
            const localY = input.localY - (inner.top - this.#captureBounds.top)
            const width = inner.right - inner.left
            const height = inner.bottom - inner.top
            return {
                ...input, localX, localY, boxWidth: width, boxHeight: height,
                inside: localX >= 0 && localX <= width && localY >= 0 && localY <= height,
            }
        }

        #leavePlot(): void {
            if (!this.#pointerInside) return
            this.#pointerInside = false
            this.#emit('plotleave', undefined)
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
                const inner = this.#regions?.plot ?? this.#captureBounds
                const offsetX = event.clientX - rect.left - (inner.left - this.#captureBounds.left)
                const offsetY = event.clientY - rect.top - (inner.top - this.#captureBounds.top)
                if (rect.width <= 0 || rect.height <= 0
                    || event.clientX < rect.left || event.clientX > rect.right
                    || event.clientY < rect.top || event.clientY > rect.bottom) return null

                return { offsetX, offsetY, ctrlKey: event.ctrlKey }
            }

            scope.addEventListener('mousemove', event => {
                const input = normalized(event)
                if (input === null) this.#leavePlot()
                else {
                    this.#pointerInside = true
                    this.#emit('plotmove', input)
                }
            }, { signal })

            scope.addEventListener('mouseleave', () => this.#leavePlot(), { signal })

            scope.addEventListener('click', event => {
                const input = normalized(event)
                if (input !== null) this.#emit('plotclick', input)
            }, { signal })

            scope.addEventListener('contextmenu', event => {
                // Ctrl-primary press belongs to rectangle zoom, including macOS secondary-click synthesis.
                if (this.#dragActive || (this.#menuState?.enabled && event.ctrlKey && event.button === 0)) {
                    event.preventDefault()
                    return
                }
                const input = normalized(event)
                if (input === null || !this.#menuState?.enabled || interaction_target(this.#regions, input) === null) return
                event.preventDefault()
                this.#keyboardMenu = false
                this.#menuInput = input
                this.#leavePlot()
                this.#menu.open({ coord: [event.clientX, event.clientY], originEvent: event })
            }, { signal })
        }

        get measurement(): BoxMeasurement { return this.#box.measurement }
        get context(): BoxContext { return this.#box.context }
        get cursor(): string { return this.capture.style.cursor }
        set cursor(value: string) {
            this.capture.style.cursor = value
        }
        setSize(dimensions: { width?: number; height?: number }): void { size_host(this, dimensions) }
        configureCapture(configuration: CaptureConfiguration): void {
            this.#shiftWheelClaim = null
            this.#fallbackConfiguration = configuration
            this.#applyCapturePolicy()
        }

        present({ width, height, inner, regions, capture_policy, filter, menu }: PlotSurfacePresentation): void {
            this.capture.style.display = ''
            this.#regions = regions ?? { plot: inner, x: null, y: null }
            for (const canvas of [this.canvas, this.highlight]) {
                canvas.style.width = `${width}px`
                canvas.style.height = `${height}px`
                canvas.style.filter = filter ?? ''
            }
            const bounds = [inner, this.#regions.x, this.#regions.y].filter((r): r is Rect => r !== null)
            this.#captureBounds = {
                left: Math.max(0, Math.min(...bounds.map(r => r.left))),
                top: Math.max(0, Math.min(...bounds.map(r => r.top))),
                right: Math.min(width, Math.max(...bounds.map(r => r.right))),
                bottom: Math.min(height, Math.max(...bounds.map(r => r.bottom))),
            }
            Object.assign(this.capture.style, tooltip_wrapper_style(this.#captureBounds))
            this.#shiftWheelClaim = null
            this.#capturePolicy = capture_policy
            this.#applyCapturePolicy()
            this.#menuState = menu
            this.#menuAnchor.tabIndex = menu.enabled ? 0 : -1
            this.#menuItems.in.toggleAttribute('disabled', !menu.zoom_in)
            this.#menuItems.out.toggleAttribute('disabled', !menu.zoom_out)
            this.#menuItems.reset.toggleAttribute('disabled', !menu.reset)
            for (const item of Object.values(this.#menuItems)) {
                item.setAttribute('aria-disabled', String(item.hasAttribute('disabled')))
            }
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
