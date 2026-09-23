import React, { StrictMode, Suspense, createContext, useContext, useEffect, startTransition } from 'react'
import { h, Fragment, render as renderPreact } from 'preact'
import { useState as preactUseState, useRef as preactUseRef, useLayoutEffect as preactUseLayoutEffect } from 'preact/hooks'
import { useSyncExternalStore as preactUseSyncExternalStore } from 'preact/compat'
import { configure } from '@antadesign/anta/jsx-runtime'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { Plot } from '../dist/index.js'
import { Plot as AntaPlot } from '../dist/index.js'
import '../dist/elements/a-plot-surface.js'
import '@antadesign/anta/elements/a-tooltip'
import { scatter } from '../dist/index.js'

const Context = createContext('missing')
const container = document.querySelector('#app')
let root = null
const blocked = new Promise(() => {})
window.stats = { transfers: 0, mounted: 0, unmounted: 0, selected: 0, reports: [], errors: [], formatted: {}, renders: [] }
const transferCanvas = HTMLCanvasElement.prototype.transferControlToOffscreen
HTMLCanvasElement.prototype.transferControlToOffscreen = function () {
    stats.transfers++
    return transferCanvas.call(this)
}
window.addEventListener('error', event => stats.errors.push(event.message))
window.addEventListener('unhandledrejection', event => stats.errors.push(String(event.reason)))

function Tip({ label }) {
    const context = useContext(Context)
    useEffect(() => {
        stats.mounted++
        return () => { stats.unmounted++ }
    }, [])
    return <span data-tooltip>{context}:{label}</span>
}

function Suspend() {
    throw blocked
}

function argsFor(options) {
    const label = options.label ?? 'committed'
    const data = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }]
    return {
        series: [
            scatter({ data, tooltip: true }),
            scatter({
                data,
                tooltip: () => <Tip label={label} />,
                on_select: () => { stats.selected++ },
            }),
        ],
        axis: {
            y: { min: 0, max: 10 },
            x: { min: 0, max: 10, tick_label: { format: value => {
                stats.formatted[label] = (stats.formatted[label] ?? 0) + 1
                return String(value)
            } } },
        },
        zoom_pan: { x: true, y: true },
        on_viewport_change: change => stats.reports.push({ label, change }),
        ...options.args,
    }
}

function App({ options }) {
    stats.renders.push(options.label ?? 'committed')
    return <Context.Provider value="provided">
        <Suspense fallback={<span>Pending</span>}>
            <Plot plotArgs={argsFor(options)} onError={failure => stats.errors.push(failure.phase)}
                data-plot style={options.style} />
            {options.suspend && <Suspend />}
        </Suspense>
    </Context.Provider>
}

window.renderPlot = (options = {}) => {
    root ??= createRoot(container)
    const app = <StrictMode><App options={options} /></StrictMode>
    if (options.suspend) startTransition(() => root.render(app))
    else root.render(app)
}
window.hydratePlot = () => {
    root = hydrateRoot(container, <StrictMode><App options={{}} /></StrictMode>)
}
window.unmountPlot = () => {
    root?.unmount()
    root = null
}
window.ready = true

window.renderAntaPlot = (height = 220, renderer = 'react', customTooltip = false) => {
    configure(renderer === 'preact' ? h : React.createElement, renderer === 'preact' ? Fragment : React.Fragment, {
        useRef: renderer === 'preact' ? preactUseRef : React.useRef,
        useLayoutEffect: renderer === 'preact' ? preactUseLayoutEffect : React.useLayoutEffect,
        useState: renderer === 'preact' ? preactUseState : React.useState,
        useSyncExternalStore: renderer === 'preact' ? preactUseSyncExternalStore : React.useSyncExternalStore,
    })
    root ??= renderer === 'preact'
        ? { render: vnode => renderPreact(vnode, container), unmount: () => renderPreact(null, container) }
        : createRoot(container)
    const plotArgs = {
        series: [
            scatter({ data: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }], tooltip: true }),
            ...(customTooltip ? [scatter({
                data: [{ x: 0.5, y: 0.5 }],
                on_select: () => { stats.selected++ },
                tooltip: () => renderer === 'preact'
                    ? h('strong', { 'data-anta-tooltip': '' }, 'Custom point')
                    : <Tip label="Anta point" />,
            })] : []),
        ],
        height,
        axis: { y: { min: 0, max: 1 }, x: { min: 0, max: 1, tick_label: { format: value => {
            stats.formatted.anta = (stats.formatted.anta ?? 0) + 1
            return String(value)
        } } } },
    }
    window.antaArgs = plotArgs
    root.render(renderer === 'preact'
        ? h(AntaPlot, { plotArgs, className: 'anta-plot' })
        : <StrictMode><Context.Provider value="provided"><AntaPlot plotArgs={plotArgs} className="anta-plot" /></Context.Provider></StrictMode>)
}
