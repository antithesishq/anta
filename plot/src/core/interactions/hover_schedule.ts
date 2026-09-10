import debounce from 'lodash/debounce'
import type { PlotController } from '../controller'
import type { PointerOffset } from './hit'
import { FRAME_THROTTLE, UPDATE_INTERVAL_MS } from './viewport_schedule'

type HoverInput = PointerOffset & { ctrlKey: boolean }

type HoverHost<T, Input> = {
    controller(): PlotController<T> | null
    resolve(input: Input): HoverInput | null
    on_update(changed: boolean): void
}

/** Throttle hit testing and discard queued pointer work when hover is invalidated. */
export function create_hover_schedule<T, Input>(host: HoverHost<T, Input>) {
    const move = debounce((input: Input) => {
        const controller = host.controller()
        if (controller === null || controller.interactions.pan_in_progress) {
            return
        }
        const pointer = host.resolve(input)
        if (pointer === null) {
            return
        }
        const changed = controller.interactions.handle_hover(pointer, controller.template.zoom_pan)
        host.on_update(changed)
    }, UPDATE_INTERVAL_MS, FRAME_THROTTLE)

    return {
        move,
        clear(): void {
            move.cancel()
            host.controller()?.interactions.on_mouse_leave()
        },
        leave(): void {
            move.cancel()
            host.controller()?.interactions.leave_pointer()
        },
    }
}
