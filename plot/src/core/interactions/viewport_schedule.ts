import debounce from 'lodash/debounce'
import type { PointerOffset } from './hit'
import type { PanInput, PanUpdate, PlotInteractionController } from '../interaction_controller'
import type { Viewport, ViewportChange, ViewportRequest, ZoomPan } from '../types'
import { compatible_viewport, viewport_moved, type ViewportAxes } from './viewport'

export const UPDATE_INTERVAL_MS = 40
const REPORT_SETTLE_MS = 150
export const FRAME_THROTTLE = { leading: true, trailing: true, maxWait: UPDATE_INTERVAL_MS }

type ViewportHost<T> = {
    interactions(): PlotInteractionController<T> | null
    commit_mode: 'immediate' | 'throttled'
    on_commit(viewport: Viewport): void
    on_report(change: ViewportChange): void
}

/** Own viewport timing and cancellation; hosts supply rendering and callback delivery. */
export function create_viewport_schedule<T>(host: ViewportHost<T>) {
    const publish = () => {
        const interactions = host.interactions()
        if (interactions !== null) {
            host.on_commit(interactions.commit_viewport())
        }
    }
    const pending_commit = debounce(publish, UPDATE_INTERVAL_MS, FRAME_THROTTLE)
    const pending_report = debounce(() => {
        const change = host.interactions()?.viewport_change()
        if (change !== undefined && change !== null) {
            host.on_report(change)
        }
    }, REPORT_SETTLE_MS)

    const cancel = () => {
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
        handle_pan(input: PanInput, zoom_pan: ZoomPan): PanUpdate {
            const interactions = host.interactions()
            if (interactions === null) {
                return { started: false, changed: false, ended: false }
            }
            const update = interactions.handle_pan(input, zoom_pan)
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
            input: PointerOffset & { deltaY: number; ctrlKey: boolean },
            zoom_pan: ZoomPan,
        ): { changed: boolean; visit_changed: boolean } {
            const interactions = host.interactions()
            if (interactions === null) {
                return { changed: false, visit_changed: false }
            }
            const previous_visit = interactions.zoomed_this_visit
            if (!interactions.handle_wheel(input, zoom_pan)) {
                return { changed: false, visit_changed: false }
            }
            commit(interactions.staged_viewport)
            pending_report()
            return { changed: true, visit_changed: previous_visit !== interactions.zoomed_this_visit }
        },
        cancel,
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
        // A successful reset renders and reports immediately; a no-op leaves pending work alone.
        reset(axes: { x: boolean; y: boolean }): void {
            if (!host.interactions()?.reset_viewport(axes)) {
                return
            }
            cancel()
            publish()
            pending_report()
            pending_report.flush()
        },
    }
}
