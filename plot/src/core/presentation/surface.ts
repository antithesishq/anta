import type { BoxContextChange, BoxMeasurementChange } from '@antadesign/anta/box-types'
import type { CapturePointerInput, CaptureWheelInput } from '@antadesign/anta/capture-types'
import type { Rect } from '../types'
import type { reset_zoom_presentation } from './reset_zoom'

export type PlotSurfacePresentation = {
    width: number
    height: number
    inner: Rect
    filter?: string
    reset: ReturnType<typeof reset_zoom_presentation>
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
    resetrequest: CustomEvent<void>
    plotmove: CustomEvent<PlotSurfaceMouseInput>
    plotleave: CustomEvent<void>
    plotclick: CustomEvent<PlotSurfaceMouseInput>
    plotdoubleclick: CustomEvent<void>
    canvastransfer: CustomEvent<PlotSurfaceCanvases & { scale: number }>
    surfaceerror: CustomEvent<{ message: string }>
}
