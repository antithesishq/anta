// Run in a browser served by the Anta dev server; see README's surface verification command.
import { definePlotElement, definePlotSurfaceElement, scatter } from '../src/entries/browser.ts'

export async function checkSurface() {
    const passed = []
    const check = (condition, name) => {
        if (!condition) throw new Error(name)
        passed.push(name)
    }
    const rejects = (fn, name) => {
        let failed = false
        try { fn() } catch { failed = true }
        check(failed, name)
    }
    const wait = () => new Promise(resolve => setTimeout(resolve, 180))
    await Promise.all([definePlotSurfaceElement(), definePlotSurfaceElement()])
    const host = document.createElement('div')
    host.style.cssText = 'position:relative;width:640px;height:400px'
    document.body.replaceChildren(host)
    const surface = document.createElement('a-plot-surface')
    let measures = 0, contexts = 0, wheels = 0, resets = 0
    surface.addEventListener('measurechange', () => measures++)
    surface.addEventListener('contextchange', () => contexts++)
    surface.addEventListener('wheelinput', () => wheels++)
    surface.addEventListener('resetrequest', () => resets++)
    host.append(surface)
    await wait()
    check(measures > 0 && contexts > 0, 'initial Box notifications')
    check(surface.measurement.width === 640 && surface.measurement.height === 400, 'responsive dimensions')
    const canvas = surface.canvas, highlight = surface.highlight
    const transferred = surface.transferCanvases()
    rejects(() => surface.transferCanvases(), 'second transfer rejected')
    rejects(() => surface.prepareCanvas(640, 400, 1), 'main context after transfer rejected')
    const ctx = transferred.canvas.getContext('2d', { desynchronized: true, colorSpace: 'display-p3' })
    check(ctx !== null, 'worker context can be acquired')
    transferred.canvas.width = 1280
    transferred.highlight.width = 1280
    const presentation = {
        width: 640, height: 400, inner: { left: 40, top: 20, right: 620, bottom: 380 },
        filter: 'invert(1)',
        reset: { visible: true, position: { position: 'absolute', left: '48px', top: '28px' },
            button: { style: { padding: '5px' } } },
    }
    surface.present(presentation)
    check(transferred.canvas.width === 1280 && transferred.highlight.width === 1280, 'presentation preserves worker backing stores')
    check(surface.capture.style.filter === '' && surface.canvas.style.filter === 'invert(1)', 'filter only on canvases')
    const reset = surface.querySelector('.plot-reset')
    check(reset.style.left === '48px' && reset.style.top === '28px', 'reset at plottable top left')
    reset.click()
    check(resets === 1, 'reset request forwarded')
    surface.configureCapture({
        wheel_capture: 'both', wheel_modifier: 'ctrl', wheel_activation: 'hover', wheel_delay: 0,
        wheel_tolerance: 0, wheel_reset_on_move: false, pointer_capture: 'mouse', pointer_buttons: [0],
        pointer_threshold: 3, pointer_modifier: 'ctrl',
    })
    const rect = surface.capture.getBoundingClientRect()
    const wheel = new WheelEvent('wheel', { clientX: rect.left + 100, clientY: rect.top + 100, deltaY: 10, ctrlKey: true, bubbles: true, cancelable: true })
    surface.capture.dispatchEvent(wheel)
    check(wheel.defaultPrevented && wheels === 1, 'Ctrl-wheel canceled synchronously and forwarded once')
    const outside = new WheelEvent('wheel', { deltaY: 10, ctrlKey: true, bubbles: true, cancelable: true })
    host.dispatchEvent(outside)
    check(!outside.defaultPrevented, 'Ctrl-wheel outside surface unclaimed')
    surface.style.width = '90%'
    surface.setSize({ width: 420, height: 230 })
    check(surface.measurement.width === 420 && surface.measurement.height === 230, 'explicit size')
    surface.setSize({})
    check(surface.style.width === '90%' && surface.style.height === '', 'removed size pins restore CSS')
    surface.style.width = '100%'
    host.style.width = '500px'
    await wait()
    check(surface.measurement.width === 500, 'responsive resize')
    host.style.display = 'none'
    await wait()
    host.style.display = ''
    host.classList.add('dark')
    await wait()
    check(surface.measurement.width === 500 && surface.context.mode === 'dark', 'hide/show and theme observation')
    surface.remove()
    const previous = [measures, contexts, wheels, resets].join()
    surface.capture.dispatchEvent(new CustomEvent('wheelinput', { detail: {} }))
    reset.click()
    await wait()
    check([measures, contexts, wheels, resets].join() === previous, 'disconnect cancels forwarding and observation')
    host.append(surface)
    await wait()
    check(surface.canvas === canvas && surface.highlight === highlight, 'reconnect retains both canvases')
    rejects(() => surface.transferCanvases(), 'reconnect retains worker ownership')
    reset.click()
    check(resets === 2, 'reconnect installs exactly one reset listener')
    const fresh = document.createElement('a-plot-surface')
    host.replaceChildren(fresh)
    const freshTransfer = fresh.transferCanvases()
    check(freshTransfer.canvas !== transferred.canvas, 'fresh mount transfers fresh canvases')
    const workerURL = URL.createObjectURL(new Blob([`
        onmessage = ({data}) => {
            const ctx = data.canvas.getContext('2d', { desynchronized: true, colorSpace: 'display-p3' });
            const hi = data.highlight.getContext('2d', { desynchronized: true, colorSpace: 'display-p3' });
            data.canvas.width = 900; data.highlight.width = 900;
            ctx.fillRect(0, 0, 10, 10); hi.fillRect(0, 0, 10, 10);
            postMessage({width: data.canvas.width, highlight: data.highlight.width, color: ctx.getContextAttributes().colorSpace});
        }`], { type: 'text/javascript' }))
    const worker = new Worker(workerURL)
    try {
        const response = new Promise((resolve, reject) => {
            worker.onmessage = event => resolve(event.data)
            worker.onerror = reject
        })
        worker.postMessage(freshTransfer, [freshTransfer.canvas, freshTransfer.highlight])
        fresh.present(presentation)
        const result = await response
        check(result.width === 900 && result.highlight === 900 && result.color === 'display-p3', 'both canvases transferred to a real worker')
    } finally {
        worker.terminate()
        URL.revokeObjectURL(workerURL)
    }
    const partial = document.createElement('a-plot-surface')
    partial.highlight.getContext('2d')
    rejects(() => partial.transferCanvases(), 'partial transfer failure reported')
    rejects(() => partial.transferCanvases(), 'partial transfer is never retried')
    const main = document.createElement('a-plot-surface')
    const mainCtx = main.prepareCanvas(200, 100, 2)
    check(main.canvas.width === 400 && main.canvas.height === 200, 'main backing store follows DPR')
    check(mainCtx.getContextAttributes().colorSpace === 'display-p3', 'main context options preserved')
    rejects(() => main.transferCanvases(), 'transfer after main context rejected')
    await definePlotElement()
    const plot = document.createElement('a-plot')
    const failures = []
    plot.addEventListener('ploterror', event => failures.push(event.detail))
    plot.plotArgs = { series: [scatter({ data: [{ x: 1, y: 2 }, { x: 2, y: 3 }] })] }
    host.classList.remove('dark')
    host.replaceChildren(plot)
    await wait()
    check(plot.getBoundingClientRect().height === 300, 'standalone default height')
    check(plot.querySelector('canvas').width === 500 * devicePixelRatio, 'standalone draws responsive width')
    plot.plotArgs = { ...plot.plotArgs, width: 420, height: 250 }
    await wait()
    check(plot.getBoundingClientRect().height === 250, 'standalone explicit height')
    const { width, height, ...unpinned } = plot.plotArgs
    plot.plotArgs = unpinned
    await wait()
    check(plot.getBoundingClientRect().height === 300, 'standalone height pin removed')
    check(failures.length === 0, 'standalone initialization and drawing without errors')
    let selected = 0
    const custom = document.createElement('span')
    custom.textContent = 'Custom tooltip'
    const data = [{ x: 5, y: 5 }]
    plot.plotArgs = {
        axis: { x: { min: 0, max: 10 }, y: { min: 0, max: 10 } }, zoom_pan: true,
        series: [scatter({ data, tooltip: true }), scatter({ data, tooltip: () => custom, on_select: () => selected++ })],
    }
    await wait()
    const capture = plot.querySelector('a-capture')
    const bounds = capture.getBoundingClientRect()
    const point = { clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2, bubbles: true }
    capture.dispatchEvent(new MouseEvent('mousemove', point))
    await wait()
    const tooltip = plot.querySelector('a-tooltip')
    check(tooltip.contains(custom) && tooltip.querySelector('hr') !== null, 'default/custom tooltips and separator')
    capture.dispatchEvent(new MouseEvent('click', point))
    check(selected === 1, 'selection callback retained')
    custom.dispatchEvent(new MouseEvent('mousemove', point))
    await wait()
    check(tooltip.contains(custom), 'input over custom tooltip child retains hover')
    const zoom = new WheelEvent('wheel', { ...point, ctrlKey: true, deltaY: -150, cancelable: true })
    capture.dispatchEvent(zoom)
    await wait()
    const resetControl = plot.querySelector('.plot-reset')
    check(zoom.defaultPrevented && !resetControl.hidden, 'standalone zoom reveals reset')
    resetControl.click()
    await wait()
    check(resetControl.hidden, 'standalone reset restores viewport')
    return passed
}
