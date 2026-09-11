import { reset_zoom_presentation } from '../core/presentation/reset_zoom'
import { create_interaction_coordinator } from '../core/interactions/coordinator'
import { capture_pointer_input, capture_wheel_input } from '../integrations/anta_gestures'
import { resolve_canvas_size } from '../core/compose/layout'
import {
    create_browser_view, size_host, type BrowserView,
} from './browser_view'
import type {
    BoxContext, BoxContextChange, BoxMeasurement, BoxMeasurementChange,
    CapturePointerInput, CaptureWheelInput,
} from '@antadesign/anta'
import { PlotController, type PlotEnvironment } from '../core/controller'
import type { PointerOffset } from '../core/interactions/hit'
import { plot_color_filter } from '../core/presentation/plot'
import type { ComposedPlot, ViewportChange } from '../core/types'
import type { APlotElement, PlotArgs, PlotTooltipRenderer } from './index'
import { clear_hover, render_hover } from './hover'
import { resolve_capture_configuration, zoom_pan_enabled } from '../core/interactions/zoom_pan'
import { throttle } from 'es-toolkit/function'

import { UPDATE_INTERVAL_MS } from '../core/interactions/viewport_schedule'

/** The class is created at registration time so importing this module never reads HTMLElement. */
export function create_plot_element<T = Node>(): CustomElementConstructor {
    return class PlotElement extends HTMLElement implements APlotElement<T> {
        #controller: PlotController<T> | null = null
        #tooltip_renderer: PlotTooltipRenderer<T> | undefined
        #args: PlotArgs<T> | undefined
        #pending_frame_id: number | null = null
        #measurement: BoxMeasurement | null = null
        #context: BoxContext | null = null
        readonly #view: BrowserView

        // Adopt the latest resize at most every 40 ms, including the final size after a burst.
        readonly #resize = throttle((measurement: BoxMeasurement) => {
            this.#measurement = measurement
            this.#schedule()
        }, UPDATE_INTERVAL_MS, { edges: ['trailing'] })

        readonly #interaction_coordinator = create_interaction_coordinator({
            controller: () => this.#controller,
            commit_mode: 'immediate',
            on_viewport_commit: () => {
                this.#clear_hover()
                this.#schedule()
            },
            on_viewport_report: change => this.#report_viewport(change),
            resolve_hover: ({ event, offset }: { event: MouseEvent; offset: PointerOffset | undefined }) => {
                if (!this.isConnected) {
                    return null
                }
                return { ...(offset ?? this.#offset(event)), ctrlKey: event.ctrlKey }
            },
            on_hover_update: () => {
                if (this.#controller !== null) {
                    render_hover(
                        this.#controller, this.#view.highlight, this.#view.tooltip,
                        this.#context?.devicePixelRatio ?? 1, this.#tooltip_renderer,
                    )
                }
                this.#update_cursor()
            },
            on_hover_clear: () => clear_hover(this.#view.highlight, this.#view.tooltip, this.#tooltip_renderer),
            on_pointer_change: () => this.#update_cursor(),
            on_pan_end: () => this.#schedule(),
        })

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
                this.#schedule()
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
        }

        // Mount the view so Box starts observing, restore assigned properties, and schedule the first draw.
        connectedCallback(): void {
            if (this.#view.root.parentNode !== this) {
                this.append(this.#view.root)
            }
            this.#restore_properties()
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
            this.#interaction_coordinator.disconnect()
            this.#resize.cancel()
            this.#controller?.set_draw_host(null)
            clear_hover(this.#view.highlight, this.#view.tooltip, this.#tooltip_renderer)
            this.#update_cursor()
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
            if (this.#controller === null) {
                try {
                    this.#controller = new PlotController(value, failure => this.#emit('ploterror', failure))
                } catch {
                    // Constructor already reported the template error.
                    return
                }
                this.#attach_canvas()
            } else {
                this.#controller.update_plot_args(value)
                if (this.#controller.plot_args !== value) {
                    return
                }
            }
            this.#args = value
            size_host(this, this.#controller.template)
            this.#clear_hover()
            this.#schedule()
        }

        // Read initial environment snapshots on connection; normal renders consume Box notifications.
        #refresh_environment(): void {
            this.#resize.cancel()
            if (this.isConnected) {
                this.#measurement = this.#view.root.measurement
                this.#context = this.#view.root.context
            }
            this.#controller?.invalidate_draw()
            this.#schedule()
        }

        #emit(name: string, detail: unknown): void {
            this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
        }

        #attach_canvas(): void {
            if (!this.isConnected) {
                return
            }
            this.#controller?.set_draw_host({
                prepare: (width, height, dpr) => this.#view.root.prepareCanvas(width, height, dpr),
            })
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

        // Compose from the current environment, flush drawing, and update the overlays.
        #render(): void {
            const controller = this.#controller
            const measurement = this.#measurement
            const context = this.#context
            if (controller === null || measurement === null || context === null) {
                return
            }
            const dimensions = resolve_canvas_size(controller.template, measurement)
            if (dimensions === null || dimensions.width <= 0 || dimensions.height <= 0) {
                return
            }
            const { width, height } = dimensions
            const color_theme = context.mode
            const plot = this.#compose({
                width,
                height,
                color_theme,
                device_pixel_ratio: context.devicePixelRatio,
            })
            if (plot === null) {
                return
            }
            controller.flush_draw()
            const { inner } = plot
            this.#view.root.present({
                width, height, inner,
                filter: plot_color_filter(controller.template, color_theme),
                reset: reset_zoom_presentation(controller, inner, color_theme),
            })
            this.#configure_capture()
            render_hover(controller, this.#view.highlight, this.#view.tooltip, context.devicePixelRatio, this.#tooltip_renderer)
            this.#update_cursor()
        }

        // Apply newly keyed argument requests and normalize the current window against fresh domains.
        #compose(environment: PlotEnvironment): ComposedPlot<T> | null {
            const controller = this.#controller
            if (controller === null) {
                return null
            }
            const current = controller.interactions.committed_viewport
            const plot = controller.compose(environment, current)

            // A failed composition retains the old plot; it cannot normalize against the new domains.
            if (plot === null || !controller.has_current_composition) {
                return plot
            }

            const adopted = this.#interaction_coordinator.adopt_viewport(controller.template.viewport)
            const normalized = controller.interactions.normalize_viewport()
            if (!adopted && !normalized) {
                return plot
            }
            return controller.compose(environment, controller.interactions.committed_viewport)
        }

        // Allow zoom and pan when enabled and at least one selected axis is continuous.
        #zoom_enabled(): boolean {
            const template = this.#controller?.template
            return template !== undefined && zoom_pan_enabled(template)
        }

        // Configure wheel ownership and drag activation from the current plot state.
        #configure_capture(): void {
            const controller = this.#controller
            if (controller === null) {
                return
            }
            const enabled = this.#zoom_enabled()
            const axes = controller.template.zoom_pan
            const wheel_claim = controller.interactions.wheel_claim(
                controller.composed_plot,
                controller.interactions.committed_viewport,
                axes,
            )

            this.#view.root.configureCapture(
                resolve_capture_configuration(enabled, axes.modifier, wheel_claim),
            )
        }

        // Match the old precedence: active pan, modifier-ready pan, selectable hit, then default.
        #update_cursor(): void {
            const controller = this.#controller
            this.#view.root.cursor = controller?.interactions.cursor_style({
                ...controller.template.zoom_pan,
                enabled: zoom_pan_enabled(controller.template),
            }) ?? ''
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

        #report_viewport(change: ViewportChange): void {
            this.#emit('viewportchange', change)
            this.#controller?.template.on_viewport_change?.(change)
        }
    }
}
