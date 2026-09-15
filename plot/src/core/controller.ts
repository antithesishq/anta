import { new_plot_template } from "./template/plot_template"
import { compose_plot } from "./compose/compose_plot"
import { draw as draw_plot } from "./render/canvas"
import { compatible_viewport, viewport_moved } from "./interactions/viewport"
import { PlotInteractionController } from "./interaction_controller"
import type { CanvasContext, ColorTheme, ComposedPlot, PlotArgs, PlotTemplate, Viewport } from "./types"

export type PlotLifecycleError = {
    phase: 'template' | 'compose' | 'draw'
    error: unknown
}

export type PlotEnvironment = {
    width: number
    height: number
    device_pixel_ratio: number
    color_theme: ColorTheme
}

export type PlotDrawHost = {
    /** Size/configure the host canvas for the latest composition before painting. */
    prepare(width: number, height: number, device_pixel_ratio: number): CanvasContext
}

/**
 * Realm-independent owner of templates, composition, drawing, and interaction state.
 * The host supplies canvas/environment inputs, scheduling, and error presentation.
 */
export class PlotController<TooltipContent = unknown> {
    readonly interactions: PlotInteractionController<TooltipContent>
    #plot_args: PlotArgs<TooltipContent>
    #template: PlotTemplate<TooltipContent>
    #composed_plot: ComposedPlot<TooltipContent> | null = null
    readonly #on_error: (failure: PlotLifecycleError) => void
    #draw_host: PlotDrawHost | null = null
    #draw_dirty = false
    #has_current_composition = false
    #environment: PlotEnvironment | null = null
    #last_composition_template: PlotTemplate<TooltipContent> | null = null
    #last_composition_viewport: Viewport = { x: null, y: null }

    constructor(plot_args: PlotArgs<TooltipContent>, on_error: (failure: PlotLifecycleError) => void = () => {}) {
        this.#on_error = on_error
        this.#plot_args = plot_args
        try {
            this.#template = new_plot_template(plot_args)
        } catch (error) {
            this.#on_error({ phase: 'template', error })
            // There is no valid template to retain during initial construction.
            throw error
        }
        this.interactions = new PlotInteractionController(() => this.#composed_plot, {
            x: this.#template.viewport?.window.x ?? null,
            y: this.#template.viewport?.window.y ?? null,
        })
    }

    get plot_args(): PlotArgs<TooltipContent> {
        return this.#plot_args
    }

    get template(): PlotTemplate<TooltipContent> {
        return this.#template
    }

    get composed_plot(): ComposedPlot<TooltipContent> | null {
        return this.#composed_plot
    }

    /** Whether the latest compose succeeded for the current template, rather than retaining an older plot. */
    get has_current_composition(): boolean {
        return this.#has_current_composition
    }

    /**
     * Replace the plot_args when its reference changes and rebuild the template atomically.
     * Failed updates report an error and retain the previous template without committing the args.
     */
    update_plot_args(plot_args: PlotArgs<TooltipContent>): void {
        if (plot_args === this.#plot_args) {
            return
        }

        let template: PlotTemplate<TooltipContent>
        try {
            template = new_plot_template(plot_args)
        } catch (error) {
            this.#on_error({ phase: 'template', error })
            return
        }
        this.interactions.update_axes(this.#template, template)
        this.#plot_args = plot_args
        this.#template = template
        this.#has_current_composition = false
    }

    /**
     * Compose the current template for its host environment. A failed composition leaves the last
     * successfully composed plot available.
     */
    compose(environment: PlotEnvironment, viewport: Viewport = { x: null, y: null }): ComposedPlot<TooltipContent> | null {
        this.#has_current_composition = false
        viewport = compatible_viewport(viewport, this.#template)
        const previous = this.#environment
        let composed_plot = this.#composed_plot
        const dpr_changed = previous?.device_pixel_ratio !== environment.device_pixel_ratio
        const recompose = this.needs_compose(environment, viewport)
        try {
            if (!Number.isFinite(environment.device_pixel_ratio) || environment.device_pixel_ratio <= 0) {
                throw new Error("plot: device pixel ratio must be positive and finite")
            }
            if (recompose) {
                composed_plot = compose_plot(this.#template, environment.width, environment.height, environment.color_theme, viewport)
            }
        } catch (error) {
            this.#on_error({ phase: 'compose', error })
            return this.#composed_plot
        }
        this.#environment = { ...environment }
        this.#last_composition_template = this.#template
        this.#last_composition_viewport = { x: viewport.x === null ? null : [...viewport.x], y: viewport.y === null ? null : [...viewport.y] }
        this.#composed_plot = composed_plot
        this.#has_current_composition = true
        if (recompose || dpr_changed) {
            this.invalidate_draw()
        }
        return composed_plot
    }

    needs_compose(environment: PlotEnvironment, viewport: Viewport): boolean {
        viewport = compatible_viewport(viewport, this.#template)
        const previous = this.#environment
        const template_changed = this.#last_composition_template !== this.#template
        const dimensions_changed = previous?.width !== environment.width || previous.height !== environment.height
        const theme_changed = previous?.color_theme !== environment.color_theme
        const viewport_changed = viewport_moved(this.#last_composition_viewport, viewport)
        return template_changed || dimensions_changed || theme_changed || viewport_changed
    }

    /** Attach or replace a surface; an already composed plot needs a fresh draw. */
    set_draw_host(host: PlotDrawHost | null): void {
        this.#draw_host = host
        this.invalidate_draw()
    }

    /** Mark the latest composition for drawing at the host's next flush. */
    invalidate_draw(): void {
        this.#draw_dirty = true
    }

    /** Draw at most once per invalidation, using the latest successful composition. */
    flush_draw(): void {
        const host = this.#draw_host
        const plot = this.#composed_plot

        if (!this.#draw_dirty || host === null || plot === null) {
            return
        }
        // Clear before drawing so a new invalidation during drawing survives until the next flush.
        this.#draw_dirty = false
        let ctx: CanvasContext
        try {
            ctx = host.prepare(plot.layout.width, plot.layout.height, this.#environment?.device_pixel_ratio ?? 1)
        } catch (error) {
            this.#on_error({ phase: 'draw', error })
            return
        }
        this.draw(ctx)
    }

    /** Draw directly to the host canvas. A failed draw may leave partial pixels. */
    draw(ctx: CanvasContext): void {
        if (this.#composed_plot === null) {
            this.#on_error({ phase: 'draw', error: new Error("plot: cannot draw before it has been composed") })
            return
        }
        try {
            draw_plot(ctx, this.#composed_plot)
        } catch (error) {
            this.#on_error({ phase: 'draw', error })
        }
    }
}
