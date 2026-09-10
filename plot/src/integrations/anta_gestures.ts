// Shared Anta event translation for both worker and browser hosts; no runtime Anta or DOM dependency.
import type { PanInput } from "../core/interaction_controller"
import type { WheelClaim } from "../core/interactions/zoom_pan"
import type { CaptureInputDirections, CapturePointerInput, CaptureWheelInput } from "@antadesign/anta/capture-types"

/** Convert Capture's drag coordinates to the shared controller input. */
export function capture_pointer_input(detail: CapturePointerInput): PanInput {
    const pointer = detail.phase === 'start' ? detail.start.pointerEvent : detail.pointerEvent
    return {
        phase: detail.phase,
        pointer: pointer === null ? null : { x: pointer.clientX, y: pointer.clientY },
    }
}

export type PlotWheelInput = {
    offsetX: number
    offsetY: number
    deltaY: number
    ctrlKey: boolean
}

/** Keep Capture enabled at bounds so its settled-pointer state survives direction changes. */
export function capture_wheel_directions(claim: WheelClaim): CaptureInputDirections {
    return {
        up: claim === 'up' || claim === 'both',
        down: claim === 'down' || claim === 'both',
        left: false,
        right: false,
    }
}

/** Native target offsets may refer to tooltip children; Capture's local coordinates refer to the overlay. */
export function capture_wheel_input(detail: CaptureWheelInput): PlotWheelInput {
    return {
        offsetX: detail.localX,
        offsetY: detail.localY,
        deltaY: detail.wheelEvent.deltaY,
        ctrlKey: detail.wheelEvent.ctrlKey,
    }
}
