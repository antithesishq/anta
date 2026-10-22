import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { configure } from '@antadesign/anta/jsx-runtime'
import { Plot, PlotSurface, scatter } from '@antadesign/plot'

configure(React.createElement, React.Fragment, React, { hydratingEvents: true })
const container = document.querySelector('#app')
const query = new URLSearchParams(location.search)
const kind = query.get('kind') ?? 'jsx'
const consumerStyle = query.get('ssr') === 'style' ? { width: 420, height: 260, backgroundColor: 'rgb(1, 2, 3)' } : undefined
let root, node
window.stats = { selected: 0, reports: [], errors: [], transfers: 0, measures: 0 }
const originalTransfer = HTMLCanvasElement.prototype.transferControlToOffscreen
HTMLCanvasElement.prototype.transferControlToOffscreen = function () {
    stats.transfers++
    return originalTransfer.call(this)
}
const data = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }]
const customTip = () => {
    if (kind === 'standalone') {
        const tip = document.createElement('strong')
        tip.textContent = 'Custom point'
        return tip
    }
    return React.createElement('strong', null, 'Custom point')
}
window.args = {
    ...(query.get('ssr') === 'pins' ? { width: 420, height: 260 } : {}),
    series: [scatter({ data, tooltip: true }), scatter({ data, tooltip: customTip, on_select: () => stats.selected++ })],
    axis: { x: { min: 0, max: 10 }, y: { min: 0, max: 10 } },
    zoom_pan: true,
    margin: 40,
    on_viewport_change: change => stats.reports.push(change),
}
window.update = (patch = {}) => {
    window.args = { ...window.args, ...patch }
    if (kind === 'standalone') node.plotArgs = args
    else root.render(React.createElement(Plot, { plotArgs: args, style: consumerStyle, onError: e => stats.errors.push(e.phase) }))
}
window.mount = () => {
    if (kind === 'standalone') {
        node = document.createElement('a-plot')
        node.addEventListener('ploterror', e => stats.errors.push(e.detail.phase))
        container.replaceChildren(node)
        update()
    } else if (kind === 'surface') {
        root = createRoot(container)
        root.render(React.createElement(PlotSurface, { onMeasureChange: () => stats.measures++ }))
    } else if (kind === 'hydrate') {
        root = hydrateRoot(container, React.createElement(Plot, { plotArgs: args, style: consumerStyle, onError: e => stats.errors.push(e.phase) }), {
            onRecoverableError: e => stats.errors.push(e.message),
        })
    } else {
        root = createRoot(container)
        update()
    }
}
window.unmount = () => { root?.unmount(); node?.remove(); root = null }
