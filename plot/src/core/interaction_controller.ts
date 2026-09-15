import { cursor_position, find_hits, resolve_point_data, same_hits, selectable_hit, type NearestPoint, type PointerOffset } from "./interactions/hit"
import { compatible_viewport, viewport_change, viewport_moved, type ViewportAxes } from "./interactions/viewport"
import { resolve_tooltips, type ResolvedTooltip } from "./interactions/tooltip"
import { resolve_highlights } from "./interactions/highlight"
import { clamp_viewport, pan_frame, pan_viewport, published_claim, wheel_claim, zoom_viewport, zoomable_views, type PanSnapshot, type WheelClaim } from "./interactions/zoom_pan"
import type { ComposedPlot, HighlightSpec, PointData, TooltipData, Viewport, ViewportChange, ViewportRequest, ZoomPan } from "./types"

export type PanInput = {
    phase: 'start' | 'move' | 'end' | 'cancel'
    pointer: { x: number; y: number } | null
}

export type PanUpdate = {
    started: boolean
    changed: boolean
    ended: boolean
}

/** Framework-independent interaction state for one plot controller. */
export class PlotInteractionController<TooltipContent = unknown> {
    readonly #get_composed_plot: () => ComposedPlot<TooltipContent> | null
    #hovered: NearestPoint[] = []
    #staged_viewport: Viewport
    #committed_viewport: Viewport
    #adopted_viewport_key: string | null = null
    #pan_snapshot: PanSnapshot | null = null
    #zoomed_this_visit = false
    #pan_modifier_ready = false

    constructor(get_composed_plot: () => ComposedPlot<TooltipContent> | null, initial_viewport: Viewport = { x: null, y: null }) {
        this.#get_composed_plot = get_composed_plot
        this.#staged_viewport = initial_viewport
        this.#committed_viewport = initial_viewport
    }

    get staged_viewport(): Viewport {
        return this.#staged_viewport
    }

    get committed_viewport(): Viewport {
        return this.#committed_viewport
    }

    /** Stage gesture input immediately; the host decides when to commit a render. */
    stage_viewport(next: Viewport): void {
        this.#staged_viewport = next
    }

    commit_viewport(): Viewport {
        this.#committed_viewport = this.#staged_viewport
        return this.#committed_viewport
    }

    /** Adopt a window without reporting it; the host cancels pending work first. */
    settle_viewport(next: Viewport): Viewport {
        this.stage_viewport(next)
        return this.commit_viewport()
    }

    /** Reconcile retained windows and stop changed axes from using an obsolete drag coordinate system. */
    update_axes(previous: ViewportAxes, next: ViewportAxes): void {
        this.#staged_viewport = compatible_viewport(this.#staged_viewport, next)
        this.#committed_viewport = compatible_viewport(this.#committed_viewport, next)
        if (this.#pan_snapshot === null) {
            return
        }
        if (previous.x.kind !== next.x.kind) {
            this.#pan_snapshot.x_axis_frame = null
        }
        if (previous.y.kind !== next.y.kind) {
            this.#pan_snapshot.y_axis_frame = null
        }
    }

    /** Apply an argument request once per key, preserving omitted axes and deferring during a drag. */
    adopt_viewport_request(request: ViewportRequest | undefined): boolean {
        const plot = this.#get_composed_plot()
        if (request === undefined || plot === null || this.pan_in_progress) {
            return false
        }
        const key = request.key === undefined ? 'mount only' : `key ${request.key}`
        if (key === this.#adopted_viewport_key) {
            return false
        }
        this.#adopted_viewport_key = key
        const current = this.#staged_viewport
        const effective = clamp_viewport(plot, {
            x: request.window.x === undefined ? current.x : request.window.x,
            y: request.window.y === undefined ? current.y : request.window.y,
        })
        if (!viewport_moved(current, effective)) {
            return false
        }
        this.settle_viewport(effective)
        return true
    }

    /** Reconcile fresh domains; return whether the host needs another composition. */
    normalize_viewport(): boolean {
        const plot = this.#get_composed_plot()
        if (plot === null) {
            return false
        }
        const committed = clamp_viewport(plot, this.#committed_viewport)
        const staged = clamp_viewport(plot, this.#staged_viewport)
        const changed = viewport_moved(this.#committed_viewport, committed)
        if (changed) {
            this.#committed_viewport = committed
        }
        // A throttled gesture may be ahead of the rendered window; preserve that newer movement.
        if (viewport_moved(this.#staged_viewport, staged)) {
            this.#staged_viewport = staged
        }
        return changed
    }

    reset_viewport(axes: { x: boolean; y: boolean }): boolean {
        const current = this.#staged_viewport
        const full: Viewport = { x: axes.x ? null : current.x, y: axes.y ? null : current.y }

        if (!viewport_moved(current, full)) {
            return false
        }
        this.settle_viewport(full)
        return true
    }

    is_zoomed(axes: { x: boolean; y: boolean }): boolean {
        return (axes.x && this.#committed_viewport.x !== null) || (axes.y && this.#committed_viewport.y !== null)
    }

    /** Resolve the staged window against the latest plot's full, unpinned domains. */
    viewport_change(): ViewportChange | null {
        const plot = this.#get_composed_plot()
        return plot === null ? null : viewport_change(this.#staged_viewport, plot)
    }

    get pan_in_progress(): boolean {
        return this.#pan_snapshot !== null
    }

    /** Apply a normalized drag phase; hosts render and schedule the resulting changes. */
    handle_pan(input: PanInput, zoom_pan: ZoomPan): PanUpdate {
        const result: PanUpdate = { started: false, changed: false, ended: false }
        if (input.phase === 'start') {
            if (input.pointer !== null && this.begin_pan(input.pointer, zoom_pan)) {
                this.#pan_modifier_ready = false
                this.on_mouse_leave()
                result.started = true
            }
            return result
        }
        if (!this.pan_in_progress) {
            return result
        }
        if (input.phase !== 'cancel' && input.pointer !== null) {
            result.changed = this.advance_pan(input.pointer, zoom_pan)
        }
        if (input.phase === 'end' || input.phase === 'cancel') {
            this.end_pan()
            this.update_pointer_modifier(input.phase === 'end', zoom_pan)
            result.ended = true
        }
        return result
    }

    /** Ignore hover during a drag; otherwise update hits and modifier readiness together. */
    handle_hover(event: PointerOffset & { ctrlKey: boolean }, zoom_pan: ZoomPan): boolean {
        if (this.pan_in_progress) {
            return false
        }
        const previous = this.#hovered
        const modifier_changed = this.update_pointer_modifier(event.ctrlKey, zoom_pan)
        this.on_mouse_move(event)
        return modifier_changed || previous !== this.#hovered
    }

    /** An accepted zoom clears stale hover; rejected or unchanged input preserves it. */
    handle_wheel(event: PointerOffset & { deltaY: number; ctrlKey: boolean }, zoom_pan: ZoomPan): boolean {
        if (!zoom_pan.enabled || (zoom_pan.modifier && !event.ctrlKey)) {
            return false
        }
        if (!this.on_scroll(event, zoom_pan)) {
            return false
        }
        this.on_mouse_leave()
        return true
    }

    /** Ctrl belongs to zoom when modifier gating is configured, not to selection. */
    handle_click(event: PointerOffset & { ctrlKey: boolean }, zoom_pan: ZoomPan): PointData | undefined {
        if (zoom_pan.modifier && event.ctrlKey) {
            return
        }
        return this.on_click(event)
    }

    /** Leaving clears hover and releases both modifier readiness and wheel ownership. */
    leave_pointer(): void {
        this.on_mouse_leave()
        this.release_zoom()
    }

    /** Track modifier readiness independently of the host's rendered hover snapshot. */
    update_pointer_modifier(ctrl_key: boolean, zoom_pan: ZoomPan): boolean {
        const ready = this.#pan_enabled(zoom_pan) && zoom_pan.modifier && ctrl_key
        if (ready === this.#pan_modifier_ready) {
            return false
        }
        this.#pan_modifier_ready = ready
        return true
    }

    /** Resolve cursor precedence from shared interaction state. */
    cursor_style(zoom_pan: ZoomPan): string | undefined {
        if (this.pan_in_progress) {
            return 'grabbing'
        }
        if (this.#pan_enabled(zoom_pan) && this.#pan_modifier_ready) {
            return 'all-scroll'
        }
        return this.has_selectable_hover ? 'pointer' : undefined
    }

    #pan_enabled(zoom_pan: ZoomPan): boolean {
        const plot = this.#get_composed_plot()
        if (!zoom_pan.enabled || plot === null) {
            return false
        }
        return (zoom_pan.x && plot.x_full_domain !== null) || (zoom_pan.y && plot.y_full_domain !== null)
    }

    /** Capture the scales and pointer origin for an accepted drag. */
    begin_pan(pointer: { x: number; y: number }, axes: { x: boolean; y: boolean }): boolean {
        const plot = this.#get_composed_plot()

        if (plot === null) {
            return false
        }
        this.#pan_snapshot = pan_frame(zoomable_views(plot, axes), this.#staged_viewport, pointer)
        return true
    }

    /** Stage a drag move; the host schedules a commit and report only when it moved. */
    advance_pan(pointer: { x: number; y: number }, axes: { x: boolean; y: boolean }): boolean {
        const snapshot = this.#pan_snapshot
        const plot = this.#get_composed_plot()

        if (snapshot === null || plot === null) {
            return false
        }

        const before = this.#staged_viewport
        const panned = pan_viewport(snapshot, zoomable_views(plot, axes), before, pointer)

        if (!viewport_moved(before, panned)) {
            return false
        }
        this.stage_viewport(panned)
        return true
    }

    end_pan(): void {
        this.#pan_snapshot = null
        this.#pan_modifier_ready = false
    }

    get zoomed_this_visit(): boolean {
        return this.#zoomed_this_visit
    }

    /** Stage an accepted wheel event, with offsets relative to the inner overlay. */
    on_scroll(event: PointerOffset & { deltaY: number }, axes: { x: boolean; y: boolean }): boolean {
        const plot = this.#get_composed_plot()

        if (plot === null) {
            return false
        }
        const before = this.#staged_viewport
        const zoomed = zoom_viewport(zoomable_views(plot, axes), before, cursor_position(plot, event), event.deltaY)

        if (!viewport_moved(before, zoomed)) {
            return false
        }
        this.#zoomed_this_visit = true
        this.stage_viewport(zoomed)
        return true
    }

    /** Leaving the overlay releases the wheel ownership acquired during this visit. */
    release_zoom(): void {
        this.#pan_modifier_ready = false
        this.#zoomed_this_visit = false
    }

    /** Use this render's plot and committed window, not a previous composition or staged gesture. */
    wheel_claim(
        plot: Pick<ComposedPlot<TooltipContent>, 'x_scale' | 'y_scale' | 'x_full_domain' | 'y_full_domain'> | null,
        rendered: Viewport,
        axes: { x: boolean; y: boolean },
    ): WheelClaim {
        if (plot === null) {
            return 'none'
        }
        return published_claim(wheel_claim(zoomable_views(plot, axes), rendered), this.#zoomed_this_visit)
    }

    /** Resolve tooltip data/content from the latest composition and the host's rendered hover snapshot. */
    resolve_tooltips(hits: NearestPoint[] = this.#hovered): ResolvedTooltip<TooltipContent>[] {
        const plot = this.#get_composed_plot()
        return plot === null ? [] : resolve_tooltips(plot, hits)
    }

    /** Resolve canvas geometry for the topmost rendered hover hit that supports a highlight. */
    resolve_highlights(hits: NearestPoint[] = this.#hovered): HighlightSpec[] {
        const plot = this.#get_composed_plot()
        return plot === null ? [] : resolve_highlights(plot, hits)
    }

    get hovered(): NearestPoint[] {
        return this.#hovered
    }

    get has_selectable_hover(): boolean {
        const plot = this.#get_composed_plot()
        return plot !== null && selectable_hit(plot, this.#hovered) !== null
    }

    /** Update hover state from a pointer move relative to the plot's inner overlay. */
    on_mouse_move(event: PointerOffset): NearestPoint[] {
        const plot = this.#get_composed_plot()

        if (plot === null) {
            return this.on_mouse_leave()
        }
        const hovered = find_hits(plot, cursor_position(plot, event))

        if (!same_hits(this.#hovered, hovered)) {
            this.#hovered = hovered
        }
        return this.#hovered
    }

    /** Select once and return the callback's point data for a host notification, independently of hover state. */
    on_click(event: PointerOffset): PointData | undefined {
        const plot = this.#get_composed_plot()

        if (plot === null) {
            return
        }
        const hit = selectable_hit(plot, find_hits(plot, cursor_position(plot, event)))

        if (hit === null) {
            return
        }
        const data = resolve_point_data(plot, hit)
        const on_select = plot.series[hit.series_index]?.on_select

        if (data !== undefined && on_select !== undefined) {
            // Column-backed series omit row; retain the callback boundary's existing payload shape.
            on_select(data as TooltipData<any>)
        }
        return data
    }

    /** Clear hover state when the pointer leaves the plot or a gesture takes ownership. */
    on_mouse_leave(): NearestPoint[] {
        if (this.#hovered.length > 0) {
            this.#hovered = []
        }
        return this.#hovered
    }
}
