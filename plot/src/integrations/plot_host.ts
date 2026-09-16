import { PlotController, type PlotDrawHost, type PlotEnvironment, type PlotLifecycleError } from '../core/controller'
import { resolve_canvas_size, type Dimensions } from '../core/compose/layout'
import { create_interaction_coordinator } from '../core/interactions/coordinator'
import { capture_attributes, resolve_capture_configuration, zoom_pan_enabled } from '../core/interactions/zoom_pan'
import { plot_color_filter } from '../core/presentation/plot'
import { reset_zoom_presentation } from '../core/presentation/reset_zoom'
import type { PlotSurfacePresentation, PlotSurfaceMouseInput } from '../core/presentation/surface'
import type { PlotArgs, ViewportChange } from '../core/types'

export type PlotHostOptions<Input> = {
    commit_mode: 'immediate' | 'throttled'
    resolve_hover(input: Input): PlotSurfaceMouseInput | null
    schedule(): void
    hover(changed: boolean): void
    clear_hover(): void
    pointer(): void
    error(failure: PlotLifecycleError): void
    viewport(change: ViewportChange): void
}

/** Shared lifecycle work; callers supply scheduling, canvas access, and presentation. */
export class PlotHost<Content, Input = PlotSurfaceMouseInput> {
    controller: PlotController<Content> | null = null
    readonly interactions
    measurement: Dimensions | null = null
    environment: Omit<PlotEnvironment, 'width' | 'height'> | null = null
    #draw_host: PlotDrawHost | null = null

    constructor(private readonly options: PlotHostOptions<Input>) {
        this.interactions = create_interaction_coordinator({
            controller: () => this.controller,
            commit_mode: options.commit_mode,
            resolve_hover: options.resolve_hover,
            on_viewport_commit: () => options.schedule(),
            on_viewport_report: options.viewport,
            on_hover_update: options.hover,
            on_hover_clear: options.clear_hover,
            on_pointer_change: options.pointer,
            on_pan_end: options.schedule,
        })
    }

    update(args: PlotArgs<Content>): boolean {
        if (this.controller === null) {
            try {
                this.controller = new PlotController(args, this.options.error)
                this.controller.set_draw_host(this.#draw_host)
            } catch {
                return false // The controller reports initial template failures.
            }
        } else {
            this.controller.update_plot_args(args)
        }
        return this.controller.plot_args === args
    }

    attach(host: PlotDrawHost | null): void {
        if (host === this.#draw_host) return
        this.#draw_host = host
        this.controller?.set_draw_host(host)
    }

    disconnect(): void {
        this.interactions.disconnect()
        this.attach(null)
    }

    /** Reconcile keyed viewport requests against fresh domains before drawing. */
    render(): PlotSurfacePresentation | null {
        const controller = this.controller
        if (controller === null || this.environment === null) return null
        const dimensions = resolve_canvas_size(controller.template, this.measurement)
        if (dimensions === null || dimensions.width <= 0 || dimensions.height <= 0) return null
        const environment = { ...dimensions, ...this.environment }
        let plot = controller.compose(environment, controller.interactions.committed_viewport)
        if (plot === null) return null
        if (controller.has_current_composition) {
            const adopted = this.interactions.adopt_viewport(controller.template.viewport)
            const normalized = controller.interactions.normalize_viewport()
            if (adopted || normalized) {
                plot = controller.compose(environment, controller.interactions.committed_viewport)
            }
        }
        if (plot === null) return null
        controller.flush_draw()
        return {
            width: plot.layout.width, height: plot.layout.height, inner: plot.inner,
            filter: plot_color_filter(controller.template, environment.color_theme),
            reset: reset_zoom_presentation(controller, plot.inner, environment.color_theme),
        }
    }

    capture() {
        const controller = this.controller
        const axes = controller?.template.zoom_pan
        return resolve_capture_configuration(
            controller !== null && zoom_pan_enabled(controller.template), axes?.modifier ?? true,
            controller === null || axes === undefined ? 'none' : controller.interactions.wheel_claim(
                controller.composed_plot, controller.interactions.committed_viewport, axes,
            ),
        )
    }

    capture_attributes() { return capture_attributes(this.capture()) }

    cursor(): string | undefined {
        const controller = this.controller
        return controller?.interactions.cursor_style({
            ...controller.template.zoom_pan, enabled: zoom_pan_enabled(controller.template),
        })
    }
}
