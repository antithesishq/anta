import type { PlotSurfaceMouseInput } from '../core/presentation/surface'
import { throttle } from 'es-toolkit/function'
import type {
    CapturePointerInput, CaptureWheelInput, CaptureInputDirections, CaptureWheelActivation,
    CaptureInputModifier, CaptureWheelSettle, CapturePointerCapture,
} from '@antadesign/anta/capture-types'
import type { BoxContextChange, BoxMeasurementChange } from '@antadesign/anta/box-types'
import type { PlotController } from '../core/controller'
import type { Dimensions } from '../core/compose/layout'
import type { ColorTheme, ComposedPlot, Viewport, ViewportChange } from '../core/types'
import type { NearestPoint } from '../core/interactions/hit'
import { create_interaction_coordinator } from '../core/interactions/coordinator'
import { compatible_viewport } from '../core/interactions/viewport'
import { UPDATE_INTERVAL_MS } from '../core/interactions/viewport_schedule'
import { capture_attributes, resolve_capture_configuration, zoom_pan_enabled } from '../core/interactions/zoom_pan'
import { capture_pointer_input, capture_wheel_directions, capture_wheel_input } from './anta_gestures'

export type AntaHost<T> = {
    controller: PlotController<T>
    on_measure(dimensions: Dimensions): void
    on_context(theme: ColorTheme, device_pixel_ratio: number): void
    on_viewport(viewport: Viewport): void
    on_viewport_report(change: ViewportChange): void
    on_hover(points: NearestPoint[]): void
    on_pointer_change(): void
}

type MouseHandler = (event: PlotSurfaceMouseInput) => void
type PointerHandler = (event: CustomEvent<CapturePointerInput>) => void
type WheelHandler = (event: CustomEvent<CaptureWheelInput>) => void

// Use Anta's data contracts without importing its JSX component declaration graph.
type HostCaptureSettings = {
    wheelCapture?: CaptureInputDirections
    wheelActivation?: CaptureWheelActivation
    wheelModifier?: CaptureInputModifier
    wheelSettle?: CaptureWheelSettle
    pointerCapture?: boolean | CapturePointerCapture
}

type HostCaptureProps = HostCaptureSettings & {
    onMouseMove: MouseHandler
    onMouseLeave(): void
    onClick: MouseHandler
    ondblclick(): void
    onWheelInput: WheelHandler
    onPointerInput: PointerHandler
}

/** Host-facing handlers omit internal timer controls; disconnect owns cancellation. */
export type AntaHostAdapter<T> = {
    on_measure_change(event: CustomEvent<BoxMeasurementChange>): void
    on_context_change(event: CustomEvent<BoxContextChange>): void
    on_pointer_input: PointerHandler
    on_wheel_input: WheelHandler
    on_mouse_move: MouseHandler
    on_mouse_leave(): void
    on_click: MouseHandler
    on_double_click(): void
    reset(): void
    viewport_for_render(snapshot: Viewport): Viewport
    reconcile_viewport(snapshot: Viewport): Viewport
    capture_props(plot: ComposedPlot<T> | null, viewport: Viewport): HostCaptureProps
    capture_attributes(plot: ComposedPlot<T> | null, viewport: Viewport): ReturnType<typeof capture_attributes>
    cursor_style(): string | undefined
    disconnect(): void
}

/** Accept Anta events directly, retaining the worker host's measurement and interaction cadence. */
export function create_anta_host<T>(host: AntaHost<T>): AntaHostAdapter<T> {
    const controller = host.controller
    const interactions = controller.interactions
    let measured: Dimensions | null = null
    const sync_hover = () => host.on_hover(interactions.hovered)
    const coordinator = create_interaction_coordinator({
        controller: () => controller,
        commit_mode: 'throttled',
        resolve_hover: (event: PlotSurfaceMouseInput) => event,
        on_viewport_commit: host.on_viewport,
        on_viewport_report: host.on_viewport_report,
        on_hover_update: changed => {
            if (changed) {
                sync_hover()
                host.on_pointer_change()
            }
        },
        on_hover_clear: sync_hover,
        on_pointer_change: host.on_pointer_change,
    })

    const capture_configuration = (plot: ComposedPlot<T> | null, viewport: Viewport) => {
        const zoom_pan = controller.template.zoom_pan
        return resolve_capture_configuration(
            zoom_pan_enabled(controller.template), zoom_pan.modifier,
            interactions.wheel_claim(plot, viewport, zoom_pan),
        )
    }

    // Keep the previous height during transient zero-height measurements and publish only changed sizes.
    const on_measure_change = throttle((event: CustomEvent<BoxMeasurementChange>) => {
        const current = event.detail.current
        const height = current.height > 0 ? current.height : (measured?.height ?? current.height)
        if (measured?.width === current.width && measured.height === height) {
            return
        }
        measured = { width: current.width, height }
        host.on_measure(measured)
    }, UPDATE_INTERVAL_MS, { edges: ['trailing'] })

    const on_pointer_input = (event: CustomEvent<CapturePointerInput>): void => {
        coordinator.handle_pan(capture_pointer_input(event.detail))
    }
    const on_wheel_input = (event: CustomEvent<CaptureWheelInput>): void => {
        coordinator.handle_wheel(capture_wheel_input(event.detail))
    }

    return {
        on_measure_change,
        on_context_change(event: CustomEvent<BoxContextChange>): void {
            const { mode, devicePixelRatio } = event.detail.current
            host.on_context(mode, devicePixelRatio)
        },
        on_pointer_input,
        on_wheel_input,
        on_mouse_move: coordinator.move,
        on_mouse_leave: coordinator.leave,
        on_click: coordinator.handle_click,
        on_double_click: coordinator.handle_double_click,
        reset: coordinator.reset,
        viewport_for_render(snapshot: Viewport): Viewport {
            return compatible_viewport(snapshot, controller.template)
        },
        reconcile_viewport(snapshot: Viewport): Viewport {
            if (!controller.has_current_composition) {
                return snapshot
            }
            return coordinator.reconcile_rendered_viewport(
                snapshot, controller.template, controller.template.viewport,
            )
        },
        capture_props(plot: ComposedPlot<T> | null, viewport: Viewport) {
            const capture = capture_configuration(plot, viewport)
            const settings = {
                wheelCapture: capture.wheel_capture === null ? false : capture_wheel_directions(capture.wheel_capture),
                wheelActivation: capture.wheel_activation,
                wheelModifier: capture.wheel_modifier,
                wheelSettle: {
                    delay: capture.wheel_delay,
                    tolerance: capture.wheel_tolerance,
                    resetOnMove: capture.wheel_reset_on_move,
                },
                pointerCapture: capture.pointer_capture === null ? false : {
                    pointerTypes: [capture.pointer_capture],
                    buttons: capture.pointer_buttons,
                    threshold: capture.pointer_threshold,
                    modifier: capture.pointer_modifier,
                },
            } satisfies HostCaptureSettings
            return {
                ...settings,
                onMouseMove: coordinator.move,
                onMouseLeave: coordinator.leave,
                onClick: coordinator.handle_click,
                ondblclick: coordinator.handle_double_click,
                onWheelInput: on_wheel_input,
                onPointerInput: on_pointer_input,
            }
        },
        capture_attributes(plot, viewport) {
            return capture_attributes(capture_configuration(plot, viewport))
        },
        cursor_style(): string | undefined {
            return interactions.cursor_style({
                ...controller.template.zoom_pan,
                enabled: zoom_pan_enabled(controller.template),
            })
        },
        disconnect(): void {
            on_measure_change.cancel()
            coordinator.disconnect()
        },
    }
}
