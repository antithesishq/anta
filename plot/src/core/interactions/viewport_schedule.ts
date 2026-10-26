import { debounce, throttle } from 'es-toolkit/function'
import type { WheelInput } from './target'
import type { DragInput, DragUpdate, PlotInteractionController } from '../interaction_controller'
import type { Viewport, ViewportChange, ViewportRequest, ZoomPan } from '../types'
import { compatible_viewport, viewport_moved, type ViewportAxes } from './viewport'

export const UPDATE_INTERVAL_MS = 40
const REPORT_SETTLE_MS = 150
const ANIMATION_FRAME_MS = 16

type ViewportHost<T> = {
    interactions(): PlotInteractionController<T> | null
    commit_mode: 'immediate' | 'throttled'
    on_commit(viewport: Viewport): void
    on_report(change: ViewportChange): void
    reduced_motion?(): boolean
}

/** Own viewport timing and cancellation; hosts supply rendering and callback delivery. */
export function create_viewport_schedule<T>(host: ViewportHost<T>) {
    let animation_timer: ReturnType<typeof setTimeout> | undefined
    let animation_started = 0
    let animation_generation = 0
    const report = () => {
        const change = host.interactions()?.viewport_change()
        if (change !== undefined && change !== null) host.on_report(change)
    }
    const publish = () => {
        const interactions = host.interactions()
        if (interactions !== null) {
            host.on_commit(interactions.commit_viewport())
        }
    }
    const pending_commit = throttle(publish, UPDATE_INTERVAL_MS)
    const pending_report = debounce(report, REPORT_SETTLE_MS)

    const stop_animation = (notify = false) => {
        animation_generation++
        if (animation_timer !== undefined) clearTimeout(animation_timer)
        animation_timer = undefined
        const interactions = host.interactions()
        const active = interactions?.zoom_animation_active ?? false
        interactions?.stop_zoom_animation()
        if (notify && active) report()
    }

    const animate = () => {
        animation_timer = undefined
        const interactions = host.interactions()
        if (!interactions?.zoom_animation_active) return
        const generation = animation_generation
        const progress = host.reduced_motion?.() ? 1
            : Math.min(1, (performance.now() - animation_started) / interactions.zoom_animation_duration)
        interactions.advance_zoom_animation(progress)
        publish()
        // A synchronous render may replace arguments, resize, or disconnect the host.
        if (generation !== animation_generation) return
        if (interactions.zoom_animation_active) {
            animation_timer = setTimeout(animate, ANIMATION_FRAME_MS)
        } else {
            report()
        }
    }

    const start_animation = () => {
        pending_commit.cancel()
        pending_report.cancel()
        animation_started = performance.now()
        animation_timer = setTimeout(animate, ANIMATION_FRAME_MS)
    }

    const cancel = () => {
        stop_animation()
        pending_commit.cancel()
        pending_report.cancel()
    }

    // Adopted requests replace pending gesture work without producing a change notification.
    const adopt = (request: ViewportRequest | undefined): boolean => {
        if (!host.interactions()?.adopt_viewport_request(request)) {
            return false
        }
        cancel()
        return true
    }

    // Stage immediately so successive gestures accumulate even before the next render.
    const commit = (next: Viewport): void => {
        host.interactions()?.stage_viewport(next)
        if (host.commit_mode === 'immediate') {
            publish()
        } else {
            pending_commit()
        }
    }

    return {
        // Only accepted movement schedules work; release flushes the final commit before its report.
        handle_drag(input: DragInput, zoom_pan: ZoomPan): DragUpdate {
            const interactions = host.interactions()
            if (interactions === null) {
                return { started: false, changed: false, ended: false }
            }
            if (input.phase === 'start' && input.target !== null) stop_animation(true)
            const update = interactions.handle_drag(input, zoom_pan, !host.reduced_motion?.())
            if (update.changed && interactions.zoom_animation_active) {
                start_animation()
                return update
            }
            if (update.changed) {
                commit(interactions.staged_viewport)
                pending_report()
            }
            if (update.ended) {
                pending_commit.flush()
                pending_report.flush()
            }
            return update
        },
        // Report successful zooms after settling, and tell the host when wheel ownership changes.
        handle_wheel(
            input: WheelInput,
            zoom_pan: ZoomPan,
        ): { changed: boolean; visit_changed: boolean } {
            const interactions = host.interactions()
            if (interactions === null) {
                return { changed: false, visit_changed: false }
            }
            if (input.target !== null && input.deltaY !== 0) stop_animation(true)
            const previous_visit = interactions.has_zoomed_target(input.target)
            if (!interactions.handle_wheel(input, zoom_pan)) {
                return { changed: false, visit_changed: false }
            }
            commit(interactions.staged_viewport)
            pending_report()
            return { changed: true, visit_changed: previous_visit !== interactions.has_zoomed_target(input.target) }
        },
        zoom_from_menu(input: { offsetX: number; offsetY: number; action: 'in' | 'out' }, zoom_pan: ZoomPan): boolean {
            stop_animation(true)
            const interactions = host.interactions()
            if (interactions === null || !interactions.zoom_from_menu(input, zoom_pan, !host.reduced_motion?.())) return false
            if (interactions.zoom_animation_active) {
                start_animation()
                return true
            }
            cancel()
            publish()
            pending_report()
            pending_report.flush()
            return true
        },
        cancel,
        stop_animation,
        adopt,
        // Reconcile a host's render snapshot after composition, then apply any new request.
        reconcile_rendered_viewport(
            rendered: Viewport,
            axes: ViewportAxes,
            request: ViewportRequest | undefined,
        ): Viewport {
            const compatible = compatible_viewport(rendered, axes)
            if (compatible !== rendered) {
                pending_report.cancel()
            }
            const interactions = host.interactions()
            if (interactions === null) {
                return compatible
            }
            adopt(request)
            interactions.normalize_viewport()
            const committed = interactions.committed_viewport
            return viewport_moved(rendered, committed) ? committed : rendered
        },
        // Reset shares the zoom transition, including reduced motion and the final report.
        reset(axes: { x: boolean; y: boolean }): void {
            stop_animation(true)
            const interactions = host.interactions()
            if (!interactions?.reset_viewport(axes, !host.reduced_motion?.())) {
                return
            }
            if (interactions.zoom_animation_active) {
                start_animation()
                return
            }
            cancel()
            publish()
            pending_report()
            pending_report.flush()
        },
    }
}
