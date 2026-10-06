import type { PlotController } from '../controller'
import type { DragInput } from '../interaction_controller'
import type { PointData, Viewport, ViewportChange } from '../types'
import type { InteractionTarget, WheelInput } from './target'
import type { PointerOffset } from './hit'
import { create_hover_schedule } from './hover_schedule'
import { create_viewport_schedule } from './viewport_schedule'
import { zoom_pan_enabled } from './zoom_pan'

type InteractionHost<T, Input> = {
    controller(): PlotController<T> | null
    commit_mode: 'immediate' | 'throttled'
    resolve_hover(input: Input): (PointerOffset & { ctrlKey: boolean }) | null
    on_viewport_commit(viewport: Viewport): void
    on_viewport_report(change: ViewportChange): void
    on_hover_update(changed: boolean): void
    on_hover_clear(): void
    on_pointer_change(): void
    on_drag_end?(): void
}

/** Own interaction schedulers and their connections; hosts supply input conversion and visible feedback. */
export function create_interaction_coordinator<T, Input>(host: InteractionHost<T, Input>) {
    let drag_target: InteractionTarget = null
    const viewport = create_viewport_schedule({
        interactions: () => host.controller()?.interactions ?? null,
        commit_mode: host.commit_mode,
        on_commit: host.on_viewport_commit,
        on_report: host.on_viewport_report,
    })
    const hover = create_hover_schedule({
        controller: host.controller,
        resolve: host.resolve_hover,
        on_update: host.on_hover_update,
    })
    const clear_hover = (notify = true) => {
        hover.clear()
        if (notify) host.on_hover_clear()
    }

    const reset = (): void => {
        const controller = host.controller()
        if (controller !== null) {
            viewport.reset(controller.template.zoom_pan)
        }
    }

    return {
        reset,
        move: hover.move,
        clear_hover,
        adopt_viewport: viewport.adopt,
        reconcile_rendered_viewport: viewport.reconcile_rendered_viewport,
        handle_menu(input: PointerOffset & { action: 'in' | 'out' | 'reset' }): void {
            const controller = host.controller()
            if (controller === null || !zoom_pan_enabled(controller.template)) return
            if (input.action === 'reset') reset()
            else viewport.zoom_from_menu({ ...input, action: input.action }, controller.template.zoom_pan)
            clear_hover()
            host.on_pointer_change()
        },
        handle_click(input: PointerOffset & { ctrlKey: boolean }): PointData | undefined {
            const controller = host.controller()
            if (controller?.interaction_target(input) !== 'plot') return
            return controller.interactions.handle_click(input, controller.template.zoom_pan)
        },
        // Discard pending work and release transient input state without reporting or rendering on teardown.
        disconnect(): void {
            drag_target = null
            viewport.cancel()
            host.controller()?.interactions.end_drag()
            hover.leave()
        },
        handle_drag(input: Omit<DragInput, 'target'>): void {
            const controller = host.controller()
            if (controller === null) {
                return
            }
            if (input.phase === 'start') drag_target = controller.interaction_target(input)
            const update = viewport.handle_drag({ ...input, target: drag_target, release_target: controller.interaction_target(input) }, controller.template.zoom_pan)
            if (input.phase === 'end' || input.phase === 'cancel') drag_target = null
            if (update.started) {
                clear_hover()
                host.on_pointer_change()
            }
            if (update.ended) {
                host.on_pointer_change()
                host.on_drag_end?.()
            }
        },
        handle_wheel(input: Omit<WheelInput, 'target'>): void {
            const controller = host.controller()
            if (controller === null || !zoom_pan_enabled(controller.template)) {
                return
            }
            const had_hover = controller.interactions.hovered.length > 0
            const update = viewport.handle_wheel({
                ...input, target: controller.interaction_target(input),
            }, controller.template.zoom_pan)
            if (!update.changed) {
                return
            }
            clear_hover(had_hover)
            if (update.visit_changed) host.on_pointer_change()
        },
        leave(): void {
            hover.leave()
            host.on_hover_clear()
            host.on_pointer_change()
        },
    }
}
