import type { BaseAttributes, BaseProps } from '@antadesign/anta/general_types'
import type { capture_attributes } from '../core/interactions/zoom_pan'
import type { PlotSurfaceEventMap, PlotSurfacePresentation } from '../core/presentation/surface'

type CaptureAttributes = Partial<ReturnType<typeof capture_attributes>>
type SurfaceEvents = {
    [Name in keyof PlotSurfaceEventMap as `on${Name}`]?: (event: PlotSurfaceEventMap[Name]) => void
}

export type PlotSurfaceAttributes = BaseAttributes & CaptureAttributes & SurfaceEvents & {
    presentation?: string
    'canvas-owner'?: 'worker'
    'input-scope'?: 'parent'
    cursor?: string
}

declare module '@antadesign/anta/jsx-runtime' {
    interface AntaIntrinsicElements {
        'a-plot-surface': PlotSurfaceAttributes
    }
}

/** Declarative surface props; controllers still own composition, drawing, and interaction policy. */
export interface PlotSurfaceProps extends BaseProps, CaptureAttributes {
    presentation?: PlotSurfacePresentation | null
    /** Select worker ownership before mounting. Omit for imperative main-thread drawing. */
    canvasOwner?: 'worker'
    /** Observe bubbling input from host-owned siblings, including following tooltips. */
    inputScope?: 'parent'
    cursor?: string
    onMeasureChange?: (event: PlotSurfaceEventMap['measurechange']) => void
    onContextChange?: (event: PlotSurfaceEventMap['contextchange']) => void
    onWheelInput?: (event: PlotSurfaceEventMap['wheelinput']) => void
    onPointerInput?: (event: PlotSurfaceEventMap['pointerinput']) => void
    onPlotMove?: (event: PlotSurfaceEventMap['plotmove']) => void
    onPlotLeave?: (event: PlotSurfaceEventMap['plotleave']) => void
    onPlotClick?: (event: PlotSurfaceEventMap['plotclick']) => void
    onPlotDoubleClick?: (event: PlotSurfaceEventMap['plotdoubleclick']) => void
    onResetRequest?: (event: PlotSurfaceEventMap['resetrequest']) => void
    onCanvasTransfer?: (event: PlotSurfaceEventMap['canvastransfer']) => void
    onSurfaceError?: (event: PlotSurfaceEventMap['surfaceerror']) => void
}

/** Thin Anta JSX wrapper. Register browser elements separately through @antadesign/plot/elements. */
export const PlotSurface = ({
    presentation, canvasOwner, inputScope, cursor, className, children,
    onMeasureChange, onContextChange, onWheelInput, onPointerInput,
    onPlotMove, onPlotLeave, onPlotClick, onPlotDoubleClick,
    onResetRequest, onCanvasTransfer, onSurfaceError, ...rest
}: PlotSurfaceProps) => (
    <a-plot-surface
        {...rest}
        class={className}
        presentation={presentation == null ? undefined : JSON.stringify(presentation)}
        canvas-owner={canvasOwner}
        input-scope={inputScope}
        cursor={cursor}
        onmeasurechange={onMeasureChange}
        oncontextchange={onContextChange}
        onwheelinput={onWheelInput}
        onpointerinput={onPointerInput}
        onplotmove={onPlotMove}
        onplotleave={onPlotLeave}
        onplotclick={onPlotClick}
        onplotdoubleclick={onPlotDoubleClick}
        onresetrequest={onResetRequest}
        oncanvastransfer={onCanvasTransfer}
        onsurfaceerror={onSurfaceError}
    >
        {children}
    </a-plot-surface>
)
