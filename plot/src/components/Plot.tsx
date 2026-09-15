import { Tooltip } from '@antadesign/anta'
import { useCallback, useLayoutEffect, useRef, useState } from '@antadesign/anta/jsx-runtime'
import type { BaseProps } from '@antadesign/anta/general_types'
import { PlotSurface } from './PlotSurface'
import { PlotController, type PlotLifecycleError } from '../core/controller'
import type { PlotArgs, ColorTheme, Viewport } from '../core/types'
import type { NearestPoint } from '../core/interactions/hit'
import { create_anta_host, type AntaHostAdapter } from '../integrations/anta_host'
import { resolve_canvas_size, type Dimensions } from '../core/compose/layout'
import { prepare_canvas_context } from '../core/render/canvas'
import { clear_highlights, update_highlight_canvas } from '../core/render/highlight'
import { plot_color_filter } from '../core/presentation/plot'
import { reset_zoom_presentation } from '../core/presentation/reset_zoom'
import type { PlotSurfaceEventMap, PlotSurfacePresentation } from '../core/presentation/surface'
import { render_tooltip_body, TOOLTIP_DIVIDER_STYLE, TOOLTIP_OPTIONS } from '../core/presentation/tooltip'
import type { ResolvedTooltip } from '../core/interactions/tooltip'

export interface PlotProps<Content = React.ReactNode> extends Omit<BaseProps, 'children'> {
    /** Complete configuration. Replace the object to apply changes. */
    plotArgs: PlotArgs<Content>
    /** Receives configuration, composition, and drawing failures. */
    onError?: (failure: PlotLifecycleError) => void
    /** Optional content validation at a renderer boundary. */
    validateTooltipContent?: (content: Content) => React.ReactNode | undefined
}

type Canvases = {
    main: OffscreenCanvasRenderingContext2D
    highlight: OffscreenCanvasRenderingContext2D
    dpr: number
}
type View<Content> = {
    presentation: PlotSurfacePresentation | null
    capture: ReturnType<AntaHostAdapter<Content>['capture_attributes']>
    cursor: string | undefined
    tooltips: ResolvedTooltip<Content>[]
}

/** The configured renderer owns controllers and drawing; the surface supplies transferable canvases. */
export function Plot<Content = React.ReactNode>({ plotArgs, onError, validateTooltipContent, className, style, ...rest }: PlotProps<Content>) {
    const controller = useRef<PlotController<Content> | null>(null)
    const [mounted, setMounted] = useState(false)
    // Mount browser-owned children after hydration has committed.
    useLayoutEffect(() => setMounted(true), [])
    const adapter = useRef<AntaHostAdapter<Content> | null>(null)
    const attached = useRef<Canvases | null>(null)
    const report = useRef(onError)
    const viewportCallback = useRef(plotArgs.on_viewport_change)
    const [measured, setMeasured] = useState<Dimensions | null>(null)
    const [environment, setEnvironment] = useState<{ theme: ColorTheme; dpr: number }>({ theme: 'light', dpr: 1 })
    const [viewport, setViewport] = useState<Viewport>({ x: null, y: null })
    const [hovered, setHovered] = useState<NearestPoint[]>([])
    const [revision, setRevision] = useState(0)
    const [canvases, setCanvases] = useState<Canvases | null>(null)
    const [view, setView] = useState<View<Content> | null>(null)
    const notify = useCallback(() => setRevision(value => value + 1), [])
    const reportError = useCallback((failure: PlotLifecycleError) => {
        if (report.current) report.current(failure)
        else console.warn(`plot: ${failure.phase} failed.`, failure.error)
    }, [])

    useLayoutEffect(() => {
        report.current = onError
        viewportCallback.current = plotArgs.on_viewport_change
    }, [onError, plotArgs.on_viewport_change])

    // Keep transferred contexts through effect replay. A real remount receives new canvases.
    useLayoutEffect(() => () => {
        adapter.current?.disconnect()
        controller.current?.set_draw_host(null)
        attached.current = null
        if (canvases) clear_highlights(canvases.highlight)
    }, [canvases])

    useLayoutEffect(() => {
        // User callbacks and controller mutations only run for committed renders.
        if (controller.current === null) {
            try {
                controller.current = new PlotController(plotArgs, reportError)
            } catch {
                return // The controller reports template failures before throwing.
            }
            adapter.current = create_anta_host({
                controller: controller.current,
                on_measure: setMeasured,
                on_context: (theme, dpr) => setEnvironment(previous =>
                    previous.theme === theme && previous.dpr === dpr ? previous : { theme, dpr }),
                on_viewport: setViewport,
                on_viewport_report: change => viewportCallback.current?.(change),
                on_hover: setHovered,
                on_pointer_change: notify,
            })
        } else {
            controller.current.update_plot_args(plotArgs)
        }
        const core = controller.current
        const host = adapter.current!
        const window = host.viewport_for_render(viewport)
        const size = resolve_canvas_size(core.template, measured)
        const dpr = environment.dpr
        const composed = size === null ? core.composed_plot : core.compose({
            ...size, color_theme: environment.theme, device_pixel_ratio: dpr,
        }, window)
        if (canvases) {
            if (attached.current !== canvases) {
                core.set_draw_host({ prepare(width, height, scale) {
                    prepare_canvas_context(canvases.main, width, height, scale)
                    return canvases.main
                } })
                attached.current = canvases
            }
            core.flush_draw()
            update_highlight_canvas(canvases.highlight, composed, dpr, () => core.interactions.resolve_highlights(hovered))
        }
        const next = host.reconcile_viewport(viewport)
        if (next !== viewport) setViewport(next)
        setView({
            presentation: composed === null ? null : {
                width: composed.layout.width,
                height: composed.layout.height,
                inner: composed.inner,
                filter: plot_color_filter(core.template, environment.theme),
                reset: reset_zoom_presentation(core, composed.inner, environment.theme),
            },
            capture: host.capture_attributes(composed, next),
            cursor: host.cursor_style(),
            tooltips: core.interactions.resolve_tooltips(hovered),
        })
    }, [plotArgs, measured, environment, viewport, hovered, revision, canvases])

    const onCanvasTransfer = useCallback((event: PlotSurfaceEventMap['canvastransfer']) => {
        try {
            const { canvas, highlight, scale } = event.detail
            const main = canvas.getContext('2d', { desynchronized: true, colorSpace: 'display-p3' })
            const overlay = highlight.getContext('2d', { desynchronized: true, colorSpace: 'display-p3' })
            if (!main || !overlay) throw new Error('Unable to get 2d context for offscreen canvas')
            setCanvases({ main, highlight: overlay, dpr: scale })
        } catch (error) {
            reportError({ phase: 'draw', error })
        }
    }, [reportError])

    const tooltip = render_tooltip_body(view?.tooltips ?? [], {
        custom: (content: Content): React.ReactNode | undefined => validateTooltipContent
            ? validateTooltipContent(content)
            : content == null || typeof content === 'boolean' ? undefined : content as React.ReactNode,
        text: (text: string) => text,
        line_break: () => <br />,
        divider: () => <hr style={TOOLTIP_DIVIDER_STYLE} />,
        group: (children: React.ReactNode[]) => <>{children}</>,
    })

    return <div {...rest} className={className} style={{
        display: 'block', position: 'relative', width: '100%', height: '100%',
        ...style,
        ...(plotArgs.width === undefined ? {} : { width: plotArgs.width }),
        ...(plotArgs.height === undefined ? {} : { height: plotArgs.height }),
    }}>
        {mounted && <PlotSurface
            {...view?.capture}
            presentation={view?.presentation}
            canvasOwner="worker"
            inputScope="parent"
            cursor={view?.cursor}
            onMeasureChange={event => adapter.current?.on_measure_change(event)}
            onContextChange={event => adapter.current?.on_context_change(event)}
            onWheelInput={event => adapter.current?.on_wheel_input(event)}
            onPointerInput={event => adapter.current?.on_pointer_input(event)}
            onPlotMove={event => adapter.current?.on_mouse_move(event.detail)}
            onPlotLeave={() => adapter.current?.on_mouse_leave()}
            onPlotClick={event => adapter.current?.on_click(event.detail)}
            onPlotDoubleClick={() => adapter.current?.on_double_click()}
            onResetRequest={() => adapter.current?.reset()}
            onCanvasTransfer={onCanvasTransfer}
            onSurfaceError={event => reportError({ phase: 'draw', error: new Error(event.detail.message) })}
        />}
        <Tooltip {...TOOLTIP_OPTIONS} style={tooltip.style}>
            <div style={tooltip.style}>{tooltip.body}</div>
        </Tooltip>
    </div>
}
