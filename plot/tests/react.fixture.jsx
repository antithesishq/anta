import React, { StrictMode, Suspense, createContext, useContext, useEffect, startTransition } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { Plot } from '../dist/react.js'
import { scatter } from '../dist/index.js'
import '../dist/plot.css'

const Context = createContext('missing')
const container = document.querySelector('#app')
let root = null
const blocked = new Promise(() => {})
window.stats = { mounted: 0, unmounted: 0, selected: 0, reports: [], errors: [], formatted: {}, renders: [] }
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
            x: { tick_label: { format: value => {
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
