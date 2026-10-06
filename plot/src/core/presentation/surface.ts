import type { BoxContextChange, BoxMeasurementChange } from '@antadesign/anta/box-types'
import type { CapturePointerInput, CaptureWheelInput } from '@antadesign/anta/capture-types'
import type { InteractionRegions } from '../interactions/target'
import type { CaptureConfiguration } from '../interactions/zoom_pan'
import type { Rect } from '../types'
import type { PlotInteractionController } from '../interaction_controller'

export type PlotSurfacePresentation = {
    width: number
    height: number
    inner: Rect
    regions?: InteractionRegions | null
    capture_policy?: { plot: CaptureConfiguration; x: CaptureConfiguration; y: CaptureConfiguration }
    filter?: string
    menu: ReturnType<PlotInteractionController['menu_state']>
}

export type PlotSurfaceMouseInput = {
    offsetX: number
    offsetY: number
    ctrlKey: boolean
}

export type PlotSurfaceCanvases = {
    canvas: OffscreenCanvas
    highlight: OffscreenCanvas
}

export type PlotSurfaceEventMap = {
    measurechange: CustomEvent<BoxMeasurementChange>
    contextchange: CustomEvent<BoxContextChange>
    wheelinput: CustomEvent<CaptureWheelInput>
    pointerinput: CustomEvent<CapturePointerInput>
    zoomrequest: CustomEvent<PlotSurfaceMouseInput & { action: 'in' | 'out' | 'reset' }>
    plotmove: CustomEvent<PlotSurfaceMouseInput>
    plotleave: CustomEvent<void>
    plotclick: CustomEvent<PlotSurfaceMouseInput>
    canvastransfer: CustomEvent<PlotSurfaceCanvases & { scale: number }>
    surfaceerror: CustomEvent<{ message: string }>
}
