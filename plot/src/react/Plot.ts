import {
    createElement, Fragment, useEffect, useLayoutEffect, useRef, useState,
    type HTMLAttributes, type ReactNode, type ReactElement,
} from 'react'
import { createPortal } from 'react-dom'
import { definePlotElement, type APlotElement } from '../browser/index'
import type { PlotArgs } from '../core/types'
import type { PlotLifecycleError } from '../core/controller'
import type { ResolvedTooltip } from '../core/interactions/tooltip'
import { render_tooltip_body, TOOLTIP_DIVIDER_STYLE } from '../core/presentation/tooltip'

export type ReactPlotError = PlotLifecycleError | { phase: 'initialize'; error: unknown }

export interface PlotProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onError'> {
    /** Complete plot configuration. Replace the object to apply changes; in-place mutation is not observed. */
    plotArgs: PlotArgs<ReactNode>
    /** Receives registration, configuration, composition, and drawing failures. Defaults to console.warn. */
    onError?: (failure: ReactPlotError) => void
}

// Effects are absent during SSR; client layout effects publish only committed configurations.
const use_commit_effect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** Standalone plot lifecycle with React-owned tooltip content rendered through a portal. */
export function Plot({ plotArgs, onError, style, ...attributes }: PlotProps): ReactElement {
    const plot_ref = useRef<APlotElement<ReactNode> | null>(null)
    const ready = useRef(false)
    const tooltip_target = useRef<HTMLElement | null>(null)
    const [portal, set_portal] = useState<HTMLElement | null>(null)
    const committed = useRef<{ plotArgs: PlotArgs<ReactNode>; onError: PlotProps['onError'] } | null>(null)
    const [tooltips, set_tooltips] = useState<ResolvedTooltip<ReactNode>[]>([])

    use_commit_effect(() => {
        committed.current = { plotArgs, onError }
        const aPlotElement = plot_ref.current
        if (ready.current && aPlotElement && aPlotElement.plotArgs !== plotArgs) aPlotElement.plotArgs = plotArgs
    }, [plotArgs, onError])

    use_commit_effect(() => {
        let cancelled = false
        const report = (failure: ReactPlotError) => {
            if (cancelled) return
            const handler = committed.current?.onError
            if (handler) handler(failure)
            else console.warn(`plot: ${failure.phase} failed.`, failure.error)
        }

        const aPlotElement = plot_ref.current!
        const handle_error = (event: Event) => report((event as CustomEvent<PlotLifecycleError>).detail)
        aPlotElement.addEventListener('ploterror', handle_error)

        void definePlotElement().then(() => {
            if (cancelled || committed.current === null) return
            const container = aPlotElement.ownerDocument.createElement('div')
            set_portal(container)
            aPlotElement.tooltipRenderer = (next, target) => {
                if (cancelled) return
                tooltip_target.current = target
                if (next.length === 0) target.style.display = 'none'
                if (container.parentNode !== target) target.append(container)
                set_tooltips(next)
            }
            ready.current = true
            aPlotElement.plotArgs = committed.current.plotArgs
        }).catch(error => report({ phase: 'initialize', error }))

        return () => {
            cancelled = true
            ready.current = false
            aPlotElement.removeEventListener('ploterror', handle_error)
            aPlotElement.tooltipRenderer = undefined
            if (tooltip_target.current) tooltip_target.current.style.removeProperty('display')
            tooltip_target.current = null
        }
    }, [])

    const tooltip = render_tooltip_body(tooltips, {
        custom: (content: ReactNode) => content == null || typeof content === 'boolean' ? undefined : content,
        text: (text: string) => text,
        line_break: () => createElement('br'),
        divider: () => createElement('hr', { style: TOOLTIP_DIVIDER_STYLE }),
        // Variadic children have stable positions; custom content retains React context and lifecycle.
        group: (children: ReactNode[]) => createElement(Fragment, null, ...children),
    })

    use_commit_effect(() => {
        if (tooltip_target.current) tooltip_target.current.style.display = tooltip.style?.display ?? ''
    }, [tooltips])

    return createElement('div', {
        ...attributes,
        style: {
            display: 'block',
            position: 'relative',
            width: '100%',
            height: 300,
            ...style,
            ...(plotArgs.width === undefined ? {} : { width: plotArgs.width }),
            ...(plotArgs.height === undefined ? {} : { height: plotArgs.height }),
        },
    },
    createElement('a-plot', { ref: plot_ref, style: { width: '100%', height: '100%' } }),
    portal === null ? null : createPortal(
        createElement('div', { style: tooltip.style }, tooltip.body), portal,
    ))
}
