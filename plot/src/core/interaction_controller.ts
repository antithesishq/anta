import { clamp } from 'es-toolkit/math'
import { cursor_position, find_hits, resolve_point_data, same_hits, selectable_hit, type NearestPoint, type PointerOffset } from "./interactions/hit"
import { compatible_viewport, viewport_change, viewport_moved, type ViewportAxes } from "./interactions/viewport"
import { resolve_tooltips, type ResolvedTooltip } from "./interactions/tooltip"
import { resolve_highlights } from "./interactions/highlight"
import { zoom_viewport_by_factor, rectangle_zoom_viewport, type RectangleZoomSnapshot, axis_zoom_frame, axis_zoom_viewport, type AxisZoomSnapshot, clamp_viewport, magnify_zoom, pan_has_room, pan_frame, pan_viewport, published_claim, wheel_claim, zoom_viewport, zoomable_views, type PanSnapshot, type WheelClaim } from "./interactions/zoom_pan"
import { UNIT_ZOOM, type ViewportZoom } from './interactions/viewport_zoom'
import { zoom_transition, zoom_transition_duration } from './interactions/zoom_pan'
import type { ComposedPlot, HighlightSpec, PointData, TooltipData, Viewport, ViewportChange, ViewportRequest, ZoomPan } from "./types"
import { target_axes, type InteractionTarget, type WheelInput } from './interactions/target'

export type DragInput = PointerOffset & {
    ctrlKey: boolean
    target: InteractionTarget
    release_target?: InteractionTarget
    phase: 'start' | 'move' | 'end' | 'cancel'
    pointer: { x: number; y: number } | null
}

export type DragUpdate = {
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
    #staged_zoom: ViewportZoom = UNIT_ZOOM
    #committed_zoom: ViewportZoom = UNIT_ZOOM
    #adopted_viewport_key: string | null = null
    #pan_snapshot: PanSnapshot | null = null
    #axis_zoom_snapshot: AxisZoomSnapshot | null = null
    #rectangle_snapshot: RectangleZoomSnapshot | null = null
    #zoom_animation: ((progress: number) => void) | null = null
    #zoom_animation_duration = 200
    #zoomed_targets = new Set<InteractionTarget>()
    #zoom_hover_target: InteractionTarget = null

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

    get committed_zoom(): ViewportZoom {
        return this.#committed_zoom
    }

    /** Stage gesture input immediately; the host decides when to commit a render. */
    stage_viewport(next: Viewport): void {
        this.#staged_viewport = next
    }

    commit_viewport(): Viewport {
        this.#committed_viewport = this.#staged_viewport
        this.#committed_zoom = this.#staged_zoom
        return this.#committed_viewport
    }

    /** Adopt a window without reporting it; the host cancels pending work first. */
    settle_viewport(next: Viewport): Viewport {
        this.stage_viewport(next)
        return this.commit_viewport()
    }

    /** Reconcile retained windows and stop changed axes from using an obsolete drag coordinate system. */
    update_axes(previous: ViewportAxes, next: ViewportAxes): void {
        this.stop_zoom_animation()
        const retained_zoom = (zoom: ViewportZoom): ViewportZoom => ({
            x: previous.x.kind === next.x.kind ? zoom.x : 1,
            y: previous.y.kind === next.y.kind ? zoom.y : 1,
        })
        this.#staged_zoom = retained_zoom(this.#staged_zoom)
        this.#committed_zoom = retained_zoom(this.#committed_zoom)
        this.#staged_viewport = compatible_viewport(this.#staged_viewport, next)
        this.#committed_viewport = compatible_viewport(this.#committed_viewport, next)
        if (previous.x.kind !== next.x.kind || previous.y.kind !== next.y.kind) {
            this.#rectangle_snapshot = null
        }
        const zoom_axis = this.#axis_zoom_snapshot?.axis
        if (zoom_axis !== undefined && previous[zoom_axis].kind !== next[zoom_axis].kind) {
            this.#axis_zoom_snapshot = null
        }
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
        if (request === undefined || plot === null || this.drag_in_progress) {
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
        // An explicit requested window establishes a new zoom-1 view on its supplied axes.
        const zoom = this.#staged_zoom
        const next_zoom = {
            x: request.window.x === undefined ? zoom.x : 1,
            y: request.window.y === undefined ? zoom.y : 1,
        }
        if (!viewport_moved(current, effective) && next_zoom.x === zoom.x && next_zoom.y === zoom.y) {
            return false
        }
        this.#staged_zoom = next_zoom
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

    reset_viewport(axes: { x: boolean; y: boolean }, animate = false): boolean {
        this.end_drag()
        const current = this.#staged_viewport
        const full: Viewport = { x: axes.x ? null : current.x, y: axes.y ? null : current.y }

        const zoom = this.#staged_zoom
        const next_zoom = { x: axes.x ? 1 : zoom.x, y: axes.y ? 1 : zoom.y }
        if (!viewport_moved(current, full) && next_zoom.x === zoom.x && next_zoom.y === zoom.y) {
            return false
        }
        const plot = this.#get_composed_plot()
        if (animate && plot !== null) {
            return this.stage_zoom(zoomable_views(plot, axes), current, full, true, next_zoom)
        }
        this.#staged_zoom = next_zoom
        this.settle_viewport(full)
        return true
    }

    is_zoomed(axes: { x: boolean; y: boolean }): boolean {
        return (axes.x && (this.#committed_viewport.x !== null || this.#committed_zoom.x !== 1))
            || (axes.y && (this.#committed_viewport.y !== null || this.#committed_zoom.y !== 1))
    }

    /** Resolve the staged window against the latest plot's full, unpinned domains. */
    viewport_change(): ViewportChange | null {
        const plot = this.#get_composed_plot()
        return plot === null ? null : viewport_change(this.#staged_viewport, plot, this.#staged_zoom)
    }

    get drag_in_progress(): boolean {
        return this.#pan_snapshot !== null || this.#axis_zoom_snapshot !== null || this.#rectangle_snapshot !== null
    }

    /** Apply a normalized drag phase; hosts render and schedule the resulting changes. */
    handle_drag(input: DragInput, zoom_pan: ZoomPan, animate_rectangle = false): DragUpdate {
        const result: DragUpdate = { started: false, changed: false, ended: false }
        const axes = target_axes(input.target, zoom_pan)
        if (input.phase === 'start') {
            this.end_drag()
            if (!zoom_pan.enabled || !this.#pan_enabled({ ...zoom_pan, ...axes }) || input.pointer === null) return result
            let started = false
            const plot = this.#get_composed_plot()
            const axis = input.target === 'x-axis' ? 'x' : input.target === 'y-axis' ? 'y' : null
            if (plot !== null && axis !== null) {
                this.#axis_zoom_snapshot = axis_zoom_frame(zoomable_views(plot, axes),
                    this.#staged_viewport, axis, cursor_position(plot, input), input.pointer,
                    axis === 'x' ? plot.inner.right - plot.inner.left : plot.inner.bottom - plot.inner.top)
                started = this.#axis_zoom_snapshot !== null
            } else if (plot !== null && input.target === 'plot' && input.ctrlKey) {
                this.#rectangle_snapshot = {
                    views: zoomable_views(plot, axes), viewport: this.#staged_viewport,
                    inner: plot.inner, cursor: cursor_position(plot, input), pointer: input.pointer,
                }
                started = true
            } else if (input.target === 'plot') {
                started = this.begin_pan(input.pointer, axes)
            }
            if (started) {
                this.#zoom_hover_target = null
                this.on_mouse_leave()
                result.started = true
            }
            return result
        }
        if (!this.drag_in_progress) {
            return result
        }
        if (input.phase !== 'cancel' && input.pointer !== null) {
            if (this.#rectangle_snapshot !== null) {
                if (input.phase === 'end') result.changed = this.finish_rectangle_zoom(input.pointer, axes, animate_rectangle)
            } else {
                result.changed = this.#axis_zoom_snapshot !== null
                    ? this.advance_axis_zoom(input.pointer, axes)
                    : this.advance_pan(input.pointer, axes)
            }
        }
        if (input.phase === 'end' || input.phase === 'cancel') {
            this.end_drag()
            this.update_zoom_hover(input.ctrlKey, zoom_pan, input.phase === 'cancel' ? null : input.release_target === undefined ? input.target : input.release_target)
            result.ended = true
        }
        return result
    }

    /** Ignore hover during a drag; otherwise update hits and modifier readiness together. */
    handle_hover(event: PointerOffset & { ctrlKey: boolean; target: InteractionTarget }, zoom_pan: ZoomPan): boolean {
        if (this.drag_in_progress || this.zoom_animation_active) {
            return false
        }
        const previous = this.#hovered
        const modifier_changed = this.update_zoom_hover(event.ctrlKey, zoom_pan, event.target)
        if (event.target === 'plot') this.on_mouse_move(event)
        else this.on_mouse_leave()
        return modifier_changed || previous !== this.#hovered
    }

    /** An accepted zoom clears stale hover; rejected or unchanged input preserves it. */
    handle_wheel(event: WheelInput, zoom_pan: ZoomPan): boolean {
        if (this.drag_in_progress || !zoom_pan.enabled || event.deltaY === 0) {
            return false
        }
        if (!this.on_scroll(event, target_axes(event.target, zoom_pan), event.target)) {
            return false
        }
        this.on_mouse_leave()
        return true
    }

    /** Ctrl is reserved for zoom gestures; ordinary clicks still select. */
    handle_click(event: PointerOffset & { ctrlKey: boolean }, zoom_pan: ZoomPan): PointData | undefined {
        if (this.#pan_enabled(zoom_pan) && event.ctrlKey) {
            return
        }
        return this.on_click(event)
    }

    /** Leaving clears hover and releases both modifier readiness and wheel ownership. */
    leave_pointer(): void {
        this.on_mouse_leave()
        this.release_zoom()
    }

    /** Track zoom readiness independently of the host's rendered hover snapshot. */
    update_zoom_hover(ctrl_key: boolean, zoom_pan: ZoomPan, target: InteractionTarget = 'plot'): boolean {
        const axes = target_axes(target, zoom_pan)
        const ready = target === 'x-axis' || target === 'y-axis' || ctrl_key
        const ready_target = ready && this.#pan_enabled({ ...zoom_pan, ...axes }) ? target : null
        if (ready_target === this.#zoom_hover_target) {
            return false
        }
        this.#zoom_hover_target = ready_target
        return true
    }

    /** Resolve cursor precedence from shared interaction state. */
    cursor_style(zoom_pan: ZoomPan): string | undefined {
        if (this.#rectangle_snapshot !== null) return 'crosshair'
        if (this.#axis_zoom_snapshot !== null) {
            return this.#axis_zoom_snapshot.axis === 'x' ? 'ew-resize' : 'ns-resize'
        }
        if (this.#pan_snapshot !== null) {
            const plot = this.#get_composed_plot()
            const can_pan = zoom_pan.enabled && plot !== null
                && pan_has_room(this.#pan_snapshot, zoomable_views(plot, zoom_pan))
            return can_pan ? 'grabbing' : 'default'
        }
        const target = this.#zoom_hover_target
        if (target !== null && this.#pan_enabled({ ...zoom_pan, ...target_axes(target, zoom_pan) })) {
            if (target === 'x-axis') return 'ew-resize'
            if (target === 'y-axis') return 'ns-resize'
            return 'crosshair'
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

    /** Stage axis zoom through the same commit/report path as panning and wheel zoom. */
    private advance_axis_zoom(pointer: { x: number; y: number }, axes: { x: boolean; y: boolean }): boolean {
        const snapshot = this.#axis_zoom_snapshot
        const plot = this.#get_composed_plot()
        if (snapshot === null || plot === null) return false
        const views = zoomable_views(plot, axes)
        const before = this.#staged_viewport
        const zoomed = axis_zoom_viewport(snapshot, views, before, pointer)
        if (!viewport_moved(before, zoomed)) return false
        this.#staged_zoom = magnify_zoom(views, before, zoomed, this.#staged_zoom)
        this.stage_viewport(zoomed)
        return true
    }

    private finish_rectangle_zoom(pointer: { x: number; y: number }, axes: { x: boolean; y: boolean }, animate: boolean): boolean {
        const snapshot = this.#rectangle_snapshot
        const plot = this.#get_composed_plot()
        if (snapshot === null || plot === null) return false
        const views = zoomable_views(plot, axes)
        const before = this.#staged_viewport
        const zoomed = rectangle_zoom_viewport(snapshot, views, before, pointer)
        return this.stage_zoom(views, before, zoomed, animate)
    }

    /** Rectangle and menu zoom share interpolation and magnification bookkeeping. */
    private stage_zoom(views: ReturnType<typeof zoomable_views>, before: Viewport, zoomed: Viewport, animate: boolean, reset_zoom?: ViewportZoom, duration?: number): boolean {
        if (!viewport_moved(before, zoomed) && reset_zoom === undefined) return false
        if (animate) {
            this.#zoom_animation_duration = duration ?? zoom_transition_duration(views, before, zoomed)
            const frame = zoom_transition(views, before, zoomed)
            const zoom = this.#staged_zoom
            this.#zoom_animation = progress => {
                const next = frame(progress)
                // Reset also restores magnification after data changes or an explicit viewport request.
                // Its final zoom must be exactly 1, independent of the current domain-span ratio.
                const eased = 1 - (1 - progress) ** 3
                this.#staged_zoom = reset_zoom === undefined ? magnify_zoom(views, before, next, zoom)
                    : progress >= 1 ? reset_zoom : {
                        x: zoom.x === reset_zoom.x ? zoom.x
                            : Math.exp(Math.log(zoom.x) * (1 - eased) + Math.log(reset_zoom.x) * eased),
                        y: zoom.y === reset_zoom.y ? zoom.y
                            : Math.exp(Math.log(zoom.y) * (1 - eased) + Math.log(reset_zoom.y) * eased),
                    }
                this.stage_viewport(next)
            }
            return true
        }
        this.#staged_zoom = magnify_zoom(views, before, zoomed, this.#staged_zoom)
        this.stage_viewport(zoomed)
        return true
    }

    get zoom_animation_active(): boolean {
        return this.#zoom_animation !== null
    }

    get zoom_animation_duration(): number {
        return this.#zoom_animation_duration
    }

    advance_zoom_animation(progress: number): void {
        this.#zoom_animation?.(progress)
        if (progress >= 1) this.#zoom_animation = null
    }

    /** Keep the last committed frame when new input or plot arguments supersede a transition. */
    stop_zoom_animation(): void {
        if (this.#zoom_animation === null) return
        this.#zoom_animation = null
        this.#staged_viewport = this.#committed_viewport
        this.#staged_zoom = this.#committed_zoom
    }

    end_drag(): void {
        this.#rectangle_snapshot = null
        this.#axis_zoom_snapshot = null
        this.#pan_snapshot = null
        this.#zoom_hover_target = null
    }

    has_zoomed_target(target: InteractionTarget): boolean {
        return this.#zoomed_targets.has(target)
    }

    /** Stage an accepted wheel event, with offsets relative to the inner overlay. */
    on_scroll(event: PointerOffset & { deltaY: number; ctrlKey?: boolean }, axes: { x: boolean; y: boolean }, target: InteractionTarget = 'plot'): boolean {
        const plot = this.#get_composed_plot()

        if (plot === null) {
            return false
        }
        const before = this.#staged_viewport
        const views = zoomable_views(plot, axes)
        const zoomed = zoom_viewport(views, before, cursor_position(plot, event), event.deltaY, event.ctrlKey)

        if (!viewport_moved(before, zoomed)) {
            return false
        }
        this.#zoomed_targets.add(target)
        this.#staged_zoom = magnify_zoom(views, before, zoomed, this.#staged_zoom)
        this.stage_viewport(zoomed)
        return true
    }

    menu_state(zoom_pan: ZoomPan) {
        const plot = this.#get_composed_plot()
        const enabled = this.#pan_enabled(zoom_pan)
        const claim = !enabled || plot === null ? 'none'
            : wheel_claim(zoomable_views(plot, zoom_pan), this.#committed_viewport)
        return {
            enabled,
            zoom_in: claim === 'up' || claim === 'both',
            zoom_out: claim === 'down' || claim === 'both',
            reset: enabled && this.is_zoomed(zoom_pan),
        }
    }

    zoom_from_menu(input: PointerOffset & { action: 'in' | 'out' }, zoom_pan: ZoomPan, animate = false): boolean {
        const plot = this.#get_composed_plot()
        if (plot === null || !this.#pan_enabled(zoom_pan) || this.drag_in_progress) return false
        const before = this.#staged_viewport
        const views = zoomable_views(plot, zoom_pan)
        const cursor = cursor_position(plot, input)
        cursor.x = clamp(cursor.x, plot.inner.left, plot.inner.right)
        cursor.y = clamp(cursor.y, plot.inner.top, plot.inner.bottom)
        const factor = input.action === 'in' ? 1 / zoom_pan.menu_zoom_step : zoom_pan.menu_zoom_step
        const zoomed = zoom_viewport_by_factor(views, before, cursor, factor)
        return this.stage_zoom(views, before, zoomed, animate, undefined, 200)
    }

    /** Leaving the overlay releases the wheel ownership acquired during this visit. */
    release_zoom(): void {
        this.#zoom_hover_target = null
        this.#zoomed_targets.clear()
    }

    /** Use this render's plot and committed window, not a previous composition or staged gesture. */
    wheel_claim(
        plot: Pick<ComposedPlot<TooltipContent>, 'x_scale' | 'y_scale' | 'x_full_domain' | 'y_full_domain'> | null,
        rendered: Viewport,
        axes: { x: boolean; y: boolean },
        target: InteractionTarget = 'plot',
    ): WheelClaim {
        if (plot === null) {
            return 'none'
        }
        return published_claim(wheel_claim(zoomable_views(plot, axes), rendered), this.#zoomed_targets.has(target))
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
