import { PlotHost } from '../integrations/plot_host'
import { capture_pointer_input, capture_wheel_input } from '../integrations/anta_gestures'
import {
    create_browser_view, size_host, type BrowserView,
} from './browser_view'
import type {
    BoxContext, BoxContextChange, BoxMeasurement, BoxMeasurementChange,
    CapturePointerInput, CaptureWheelInput,
} from '@antadesign/anta'
import type { PointerOffset } from '../core/interactions/hit'
import type { APlotElement, PlotArgs, PlotTooltipRenderer } from './index'
import { clear_hover, render_hover } from './hover'
import { throttle } from 'es-toolkit/function'

import { UPDATE_INTERVAL_MS } from '../core/interactions/viewport_schedule'

/** The class is created at registration time so importing this module never reads HTMLElement. */
export function create_plot_element<T = Node>(): CustomElementConstructor {
    return class PlotElement extends HTMLElement implements APlotElement<T> {
        get #controller() { return this.#host.controller }
        #tooltip_renderer: PlotTooltipRenderer<T> | undefined
        #args: PlotArgs<T> | undefined
        #viewport_callback: PlotArgs<T>['on_viewport_change']
        #pending_frame_id: number | null = null
        #measurement: BoxMeasurement | null = null
        #context: BoxContext | null = null
        readonly #view: BrowserView

        // Adopt the latest resize at most every 40 ms, including the final size after a burst.
        readonly #resize = throttle((measurement: BoxMeasurement) => {
            this.#measurement = measurement
            this.#schedule()
        }, UPDATE_INTERVAL_MS, { edges: ['trailing'] })

        readonly #host = new PlotHost<T, { event: MouseEvent; offset: PointerOffset | undefined }>({
            commit_mode: 'immediate',
            schedule: () => this.#schedule(),
            viewport_commit: () => this.#clear_hover(),
            error: failure => this.#emit('ploterror', failure),
            viewport: change => {
                this.#emit('viewportchange', change)
                this.#viewport_callback?.(change)
            },
            resolve_hover: ({ event, offset }) => {
                if (!this.isConnected) return null
                return { ...(offset ?? this.#offset(event)), ctrlKey: event.ctrlKey }
            },
            hover: () => {
                if (this.#controller !== null) {
                    render_hover(this.#controller, this.#view.highlight, this.#view.tooltip,
                        this.#context?.devicePixelRatio ?? 1, this.#hover_renderer)
                }
                this.#update_cursor()
            },
            clear_hover: () => clear_hover(this.#view.highlight, this.#view.tooltip, this.#hover_renderer),
            pointer: () => this.#update_cursor(),
        })

        get #interaction_coordinator() { return this.#host.interactions }

        constructor() {
            super()
            this.#view = create_browser_view(this.ownerDocument)
            this.#listen_for_events()
        }

        // Route Box notifications and Capture events to rendering and interaction handlers.
        #listen_for_events(): void {
            this.#view.root.addEventListener('measurechange', event => {
                if (this.isConnected) {
                    this.#resize((event as CustomEvent<BoxMeasurementChange>).detail.current)
                }
            })
            this.#view.root.addEventListener('contextchange', event => {
                this.#context = (event as CustomEvent<BoxContextChange>).detail.current
                if (this.#host.update_context(this.#context)) this.#schedule()
            })
            this.#view.root.addEventListener('resetrequest', this.#interaction_coordinator.reset)
            this.#view.capture.addEventListener('dblclick', this.#interaction_coordinator.handle_double_click)
            this.#view.capture.addEventListener('wheelinput', event => {
                const detail = (event as CustomEvent<CaptureWheelInput>).detail
                this.#wheel(detail)
            })
            this.#view.capture.addEventListener('pointerinput', event => {
                this.#pointer((event as CustomEvent<CapturePointerInput>).detail)
            })
            this.#view.capture.addEventListener('mousemove', event => {
                if (!this.#controller?.interactions.pan_in_progress) {
                    // Snapshot target-relative offsets during dispatch; measure child targets after throttling.
                    const offset = event.target === this.#view.capture ? this.#offset(event) : undefined
                    this.#interaction_coordinator.move({ event, offset })
                }
            })
            this.#view.capture.addEventListener('mouseleave', () => this.#on_mouse_leave())
            this.#view.capture.addEventListener('click', event => this.#on_click(event))
            // Renderer-owned tooltips are siblings of the surface, so their input bypasses Capture.
            this.addEventListener('mousemove', event => {
                if (this.getAttribute('tooltip-mode') === 'external'
                    && !this.#view.capture.contains(event.target as Node)) {
                    this.#interaction_coordinator.move({ event, offset: undefined })
                }
            })
            this.addEventListener('click', event => {
                if (this.getAttribute('tooltip-mode') === 'external'
                    && !this.#view.capture.contains(event.target as Node)) {
                    this.#on_click(event)
                }
            })
            this.addEventListener('mouseleave', () => {
                if (this.getAttribute('tooltip-mode') === 'external') this.#on_mouse_leave()
            })
        }

        // Defer browser-owned DOM until configuration arrives, keeping hydration markup intact.
        connectedCallback(): void {
            this.#restore_properties()
            if (this.#args === undefined) return
            if (this.#view.root.parentNode !== this) {
                this.append(this.#view.root)
            }
            this.#attach_canvas()
            this.#refresh_environment()
        }

        // Apply arguments assigned before custom-element registration through the normal setter.
        #restore_properties(): void {
            for (const name of ['tooltipRenderer', 'plotArgs'] as const) {
                const descriptor = Object.getOwnPropertyDescriptor(this, name)
                if (descriptor !== undefined) {
                    Reflect.deleteProperty(this, name)
                    Reflect.set(this, name, descriptor.value)
                }
            }
        }

        // Cancel pending drawing and release gesture state; the detached child Box stops its own observers.
        disconnectedCallback(): void {
            if (this.#pending_frame_id !== null) {
                this.ownerDocument.defaultView?.cancelAnimationFrame(this.#pending_frame_id)
            }
            this.#pending_frame_id = null
            this.#host.disconnect()
            this.#resize.cancel()
            clear_hover(this.#view.highlight, this.#view.tooltip, this.#hover_renderer)
            this.#update_cursor()
        }

        // External tooltip content stays in the renderer's tree; no DOM target crosses this event.
        readonly #emit_tooltips: PlotTooltipRenderer<T> = tooltips => {
            this.#view.tooltip.hide()
            this.#emit('tooltipchange', tooltips)
        }

        get #hover_renderer(): PlotTooltipRenderer<T> | undefined {
            return this.getAttribute('tooltip-mode') === 'external' ? this.#emit_tooltips : this.#tooltip_renderer
        }

        get tooltipRenderer(): PlotTooltipRenderer<T> | undefined {
            return this.#tooltip_renderer
        }

        set tooltipRenderer(renderer: PlotTooltipRenderer<T> | undefined) {
            if (renderer === this.#tooltip_renderer) return
            this.#clear_hover()
            this.#view.tooltip.replaceChildren()
            this.#tooltip_renderer = renderer
            this.#schedule()
        }

        get plotArgs(): PlotArgs<T> | undefined {
            return this.#args
        }

        // Apply valid plot arguments while retaining the previous configuration if templating fails.
        set plotArgs(value: PlotArgs<T> | undefined) {
            if (value === undefined) {
                return
            }
            // Event handlers follow the consumer's latest state even if the plot retains an older template.
            this.#viewport_callback = value.on_viewport_change
            if (!this.#host.update(value)) return
            this.#attach_canvas()
            this.#args = value
            if (this.isConnected && this.#view.root.parentNode !== this) {
                this.append(this.#view.root)
            }
            size_host(this, this.#controller!.template)
            this.#clear_hover()
            this.#schedule()
        }

        // Read initial environment snapshots on connection; normal renders consume Box notifications.
        #refresh_environment(): void {
            this.#resize.cancel()
            if (this.isConnected) {
                this.#measurement = this.#view.root.measurement
                this.#context = this.#view.root.context
                this.#host.update_context(this.#context)
            }
            this.#controller?.invalidate_draw()
            this.#schedule()
        }

        #emit(name: string, detail: unknown): void {
            this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
        }

        readonly #canvas_host = {
            prepare: (width: number, height: number, dpr: number) => this.#view.root.prepareCanvas(width, height, dpr),
        }

        #attach_canvas(): void {
            if (this.isConnected) this.#host.attach(this.#canvas_host)
        }

        // Coalesce updates into one render before the browser’s next repaint.
        #schedule(): void {
            if (!this.isConnected || this.#pending_frame_id !== null) {
                return
            }
            this.#pending_frame_id = this.ownerDocument.defaultView!.requestAnimationFrame(() => {
                this.#pending_frame_id = null
                this.#render()
            })
        }

        // The shared host composes, reconciles the viewport, and draws; this host applies DOM presentation.
        #render(): void {
            if (this.#measurement === null || this.#context === null) return
            this.#host.measurement = this.#measurement
            const presentation = this.#host.render()
            if (presentation === null || this.#controller === null) return
            this.#view.root.present(presentation)
            this.#configure_capture()
            render_hover(this.#controller, this.#view.highlight, this.#view.tooltip,
                this.#context.devicePixelRatio, this.#hover_renderer)
            this.#update_cursor()
        }

        #configure_capture(): void {
            if (this.#controller !== null) this.#view.root.configureCapture(this.#host.capture())
        }

        #update_cursor(): void {
            this.#view.root.cursor = this.#host.cursor() ?? ''
        }

        #on_mouse_leave(): void {
            this.#interaction_coordinator.leave()
            this.#configure_capture()
        }

        // Select the topmost eligible hit and emit its point data.
        #on_click(event: MouseEvent): void {
            const controller = this.#controller
            if (controller === null) {
                return
            }
            if (controller.composed_plot === null) {
                return
            }
            const offset = this.#offset(event)
            const data = this.#interaction_coordinator.handle_click({ ...offset, ctrlKey: event.ctrlKey })
            if (data !== undefined) {
                this.#emit('select', data)
            }
        }

        // Native offsets are Capture-relative only for direct targets; children need a fresh origin.
        #offset(event: MouseEvent): PointerOffset {
            if (event.target === this.#view.capture) {
                return { offsetX: event.offsetX, offsetY: event.offsetY }
            }
            const rect = this.#view.capture.getBoundingClientRect()
            return { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top }
        }

        #clear_hover(): void {
            this.#interaction_coordinator.clear_hover()
            this.#update_cursor()
        }

        // Stage an accepted wheel zoom and publish the viewport if it changed.
        #wheel(detail: CaptureWheelInput): void {
            this.#interaction_coordinator.handle_wheel(capture_wheel_input(detail))
        }

        // Translate Capture start, move, end, and cancel phases into pan updates.
        #pointer(detail: CapturePointerInput): void {
            this.#interaction_coordinator.handle_pan(capture_pointer_input(detail))
        }

    }
}
