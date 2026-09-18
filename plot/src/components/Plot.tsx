import { Tooltip } from '@antadesign/anta'
import { useLayoutEffect, useRef, useState } from '@antadesign/anta/jsx-runtime'
import type { BaseProps } from '@antadesign/anta/general_types'
import { PlotSurface } from './PlotSurface'
import { throttle } from 'es-toolkit/function'
import { PlotHost } from '../integrations/plot_host'
import { capture_pointer_input, capture_wheel_input } from '../integrations/anta_gestures'
import { UPDATE_INTERVAL_MS } from '../core/interactions/viewport_schedule'
import { prepare_canvas_context } from '../core/render/canvas'
import { clear_highlights, update_hover_canvas } from '../core/render/highlight'
import type { PlotSurfaceEventMap, PlotSurfacePresentation } from '../core/presentation/surface'
import type { ResolvedTooltip } from '../core/interactions/tooltip'
import type { PlotLifecycleError, PlotDrawHost } from '../core/controller'
import type { PlotArgs } from '../core/types'
import { render_tooltip_body, TOOLTIP_DIVIDER_STYLE, TOOLTIP_OPTIONS } from '../core/presentation/tooltip'

export interface PlotProps<Content = React.ReactNode> extends Omit<BaseProps, 'children'> {
    /** Complete configuration. Replace the object to apply changes. */
    plotArgs: PlotArgs<Content>

    /** Receives configuration, composition, and drawing failures. */
    onError?: (failure: PlotLifecycleError) => void

    /** Optional content validation at a renderer boundary. */
    validateTooltipContent?: (content: Content) => React.ReactNode | undefined
}

type PlotView<Content> = {
    width: number | undefined
    height: number | undefined
    presentation: PlotSurfacePresentation | null
    capture: ReturnType<PlotHost<Content>['capture_attributes']>
    cursor: string | undefined
    tooltips: ResolvedTooltip<Content>[]
}

type MeasureHandler = (event: PlotSurfaceEventMap['measurechange']) => void

type PlotBinding<Content> = {
    host: PlotHost<Content> | null
    measure: ReturnType<typeof throttle<MeasureHandler>> | null
    canvas: PlotDrawHost | null
    highlight: OffscreenCanvasRenderingContext2D | null
    context_received: boolean
    report: PlotProps<Content>['onError']
    viewport: PlotArgs<Content>['on_viewport_change']
}

/** The configured renderer connects committed props and presentation to the shared plot host. */
export function Plot<Content = React.ReactNode>({
    plotArgs,
    onError,
    validateTooltipContent,
    className,
    style,
    ...rest
}: PlotProps<Content>) {
    const [revision, notify] = useState(0)
    const [view, setView] = useState<PlotView<Content> | null>(null)
    const retained = useRef<PlotBinding<Content>>({
        host: null,
        measure: null,
        canvas: null,
        highlight: null,
        context_received: false,
        report: undefined,
        viewport: undefined,
    })

    const reportError = (failure: PlotLifecycleError) => {
        const report = retained.current.report

        if (report) report(failure)
        else console.warn(`plot: ${failure.phase} failed.`, failure.error)
    }

    useLayoutEffect(() => {
        const binding = retained.current
        const changed = () => notify(value => value + 1)

        if (binding.host === null) {
            binding.host = new PlotHost<Content>({
                commit_mode: 'throttled',
                resolve_hover: input => input,
                schedule: changed,
                hover: didChange => { if (didChange) changed() },
                clear_hover: changed,
                pointer: changed,
                error: reportError,
                viewport: change => binding.viewport?.(change),
            })
            binding.host.environment = { color_theme: 'light', device_pixel_ratio: 1 }

            binding.measure = throttle((event: PlotSurfaceEventMap['measurechange']) => {
                const host = binding.host!
                const { width, height } = event.detail.current
                const previous = host.measurement
                const next = { width, height: height > 0 ? height : previous?.height ?? height }

                if (previous?.width === next.width && previous.height === next.height) return

                host.measurement = next
                changed()
            }, UPDATE_INTERVAL_MS, { edges: ['trailing'] })
        }

        return () => {
            binding.measure?.cancel()
            binding.host?.disconnect()

            if (binding.highlight) clear_highlights(binding.highlight)
        }
    }, [])

    useLayoutEffect(() => {
        const binding = retained.current
        const host = binding.host!

        binding.report = onError
        binding.viewport = plotArgs.on_viewport_change
        host.update(plotArgs)
        host.attach(binding.canvas)

        const presentation = host.render()
        const controller = host.controller

        if (binding.highlight) {
            update_hover_canvas(
                binding.highlight,
                controller?.composed_plot ?? null,
                host.environment?.device_pixel_ratio ?? 1,
                controller?.interactions.hovered ?? [],
            )
        }

        // TODO: Consider publishing interaction views before notifying to avoid the preliminary render.
        // Profiling found 268 renders / 134 effects, with 4.385 ms total in the Plot function;
        // measure child reconciliation and transport before prioritizing this optimization.
        setView({
            width: controller?.template.width,
            height: controller?.template.height,
            presentation,
            capture: host.capture_attributes(),
            cursor: host.cursor(),
            tooltips: controller?.interactions.resolve_tooltips() ?? [],
        })
    }, [plotArgs, onError, revision])

    const host = retained.current.host
    // Initial markup uses the supplied pins; subsequent renders follow the accepted template.
    const width = view === null ? plotArgs.width : view.width
    const height = view === null ? plotArgs.height : view.height

    const onContextChange = (event: PlotSurfaceEventMap['contextchange']) => {
        if (host === null) return

        const { mode, devicePixelRatio } = event.detail.current
        const previous = host.environment
        retained.current.context_received = true

        if (previous?.color_theme === mode && previous.device_pixel_ratio === devicePixelRatio) return

        host.environment = { color_theme: mode, device_pixel_ratio: devicePixelRatio }
        notify(value => value + 1)
    }

    const onCanvasTransfer = (event: PlotSurfaceEventMap['canvastransfer']) => {
        try {
            const { canvas, highlight, scale } = event.detail
            const main = canvas.getContext('2d', { desynchronized: true, colorSpace: 'display-p3' })
            const overlay = highlight.getContext('2d', { desynchronized: true, colorSpace: 'display-p3' })

            if (!main || !overlay) throw new Error('Unable to get 2d context for offscreen canvas')

            retained.current.canvas = {
                prepare(width, height, dpr) {
                    prepare_canvas_context(main, width, height, dpr)
                    return main
                },
            }
            retained.current.highlight = overlay
            // Transfer provides an initial DPR until Box reports the authoritative context.
            if (!retained.current.context_received && host?.environment) {
                host.environment = { ...host.environment, device_pixel_ratio: scale }
            }
            notify(value => value + 1)
        } catch (error) {
            reportError({ phase: 'draw', error })
        }
    }

    const tooltip = render_tooltip_body(view?.tooltips ?? [], {
        custom: (content: Content): React.ReactNode | undefined => validateTooltipContent
            ? validateTooltipContent(content)
            : content == null || typeof content === 'boolean'
                ? undefined
                : content as React.ReactNode,
        text: (text: string) => text,
        line_break: () => <br />,
        divider: () => <hr style={TOOLTIP_DIVIDER_STYLE} />,
        group: (children: React.ReactNode[]) => <>{children}</>,
    })

    return (
        <div
            {...rest}
            className={className}
            style={{
                display: 'block',
                position: 'relative',
                width: '100%',
                height: '100%',
                ...style,
                ...(width === undefined ? {} : { width }),
                ...(height === undefined ? {} : { height }),
            }}
        >
            {host && (
                <PlotSurface
                    {...view?.capture}
                    presentation={view?.presentation}
                    canvasOwner="worker"
                    inputScope="parent"
                    cursor={view?.cursor}
                    onMeasureChange={event => retained.current.measure?.(event)}
                    onContextChange={onContextChange}
                    onWheelInput={event => host.interactions.handle_wheel(capture_wheel_input(event.detail))}
                    onPointerInput={event => host.interactions.handle_pan(capture_pointer_input(event.detail))}
                    onPlotMove={event => host.interactions.move(event.detail)}
                    onPlotLeave={host.interactions.leave}
                    onPlotClick={event => host.interactions.handle_click(event.detail)}
                    onPlotDoubleClick={host.interactions.handle_double_click}
                    onResetRequest={host.interactions.reset}
                    onCanvasTransfer={onCanvasTransfer}
                    onSurfaceError={event => reportError({
                        phase: 'draw',
                        error: new Error(event.detail.message),
                    })}
                />
            )}

            <Tooltip {...TOOLTIP_OPTIONS} style={tooltip.style}>
                <div style={tooltip.style}>{tooltip.body}</div>
            </Tooltip>
        </div>
    )
}
