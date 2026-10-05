import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

await build({
    stdin: { contents: `
        export { PlotController } from './src/core/controller'
        export { create_anta_host } from './src/integrations/anta_host'
        export { PlotHost } from './src/integrations/plot_host'
        export { capture_pointer_input, capture_wheel_input } from './src/integrations/anta_gestures'
        export { scatter } from './src/entries/index'
    `, resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
    bundle: true, platform: 'node', format: 'esm', external: ['react'],
    outfile: fileURLToPath(new URL('../.build/interaction-target-test.mjs', import.meta.url)),
})
const { PlotController, create_anta_host, PlotHost, capture_pointer_input, capture_wheel_input, scatter } =
    await import('../.build/interaction-target-test.mjs')
const noop = () => {}
const args = {
    series: [scatter({ data: [{ x: 0, y: 0 }, { x: 10, y: 10 }] })], margin: 100,
    axis: { y: { tick_label: { format: () => 'long label' } } },
}
// Known text metrics exercise the real composition and drawing paths without a browser.
function context() {
    return new Proxy({
        canvas: { width: 0, height: 0 },
        measureText: label => ({ width: label.length * 8, actualBoundingBoxLeft: label.length * 8,
            actualBoundingBoxDescent: 24 }),
    }, { get: (target, key) => key in target ? target[key] : noop })
}
function render(controller, width = 600, height = 400) {
    controller.compose({ width, height, device_pixel_ratio: 1, color_theme: 'light' })
    controller.draw(context())
}
const target = (controller, offsetX, offsetY) => controller.interaction_target({ offsetX, offsetY })

test('drawn tick bounds define margin-only strips, including hidden axes and resize', () => {
    const controller = new PlotController(args, failure => { throw failure.error })
    render(controller)
    assert.equal(target(controller, 200, 100), 'plot')
    assert.equal(target(controller, -80, 100), 'y-axis')
    assert.equal(target(controller, -88, 100), null)
    assert.equal(target(controller, 200, 230), 'x-axis')
    assert.equal(target(controller, 200, 232), null)
    assert.equal(target(controller, -1, 201), null)
    assert.equal(target(controller, 401, 210), null)
    assert.equal(target(controller, -10, -1), null)
    assert.equal(target(controller, 0, 200), 'plot')
    render(controller, 800, 500)
    assert.equal(target(controller, 200, 230), 'plot')
    assert.equal(target(controller, 500, 330), 'x-axis')
    controller.update_plot_args({ ...args, axis: { x: { hidden: true }, y: { hidden: true } } })
    render(controller)
    assert.equal(target(controller, -1, 100), null)
    assert.equal(target(controller, 200, 201), null)
    assert.equal(target(controller, 200, 100), 'plot')
})

test('short labels retain 20px strips and categorical labels use painted metrics', () => {
    const controller = new PlotController({ ...args, axis: { y: { categories: ['long label'] } },
        series: [scatter({ data: [{ x: 0, y: 'long label' }] })] }, failure => { throw failure.error })
    render(controller)
    assert.equal(target(controller, -86, 100), 'y-axis')
    controller.update_plot_args({ ...args, axis: { y: { tick_label: { format: () => '' } } } })
    render(controller)
    assert.equal(target(controller, -20, 100), 'y-axis')
    assert.equal(target(controller, -21, 100), null)
})

test('both hosts deliver identical targets, offsets, modifiers and wheel deltas', () => {
    const browser = new PlotHost({ commit_mode: 'immediate', resolve_hover: input => input,
        schedule: noop, hover: noop, clear_hover: noop, pointer: noop, viewport: noop,
        error: failure => { throw failure.error } })
    browser.update(args)
    const workerController = new PlotController(args)
    const worker = create_anta_host({ controller: workerController,
        on_measure: noop, on_context: noop, on_viewport: noop, on_viewport_report: noop,
        on_hover: noop, on_pointer_change: noop })
    const logs = []
    for (const controller of [browser.controller, workerController]) {
        render(controller)
        const log = []
        logs.push(log)
        controller.interactions.handle_pan = input => {
            log.push(input)
            return { started: false, changed: false, ended: false }
        }
        controller.interactions.handle_wheel = input => { log.push(input); return false }
    }
    const start = { localX: -50, localY: 100, pointerEvent: { clientX: 300, clientY: 400, ctrlKey: true } }
    for (const phase of ['start', 'move', 'cancel']) {
        const detail = { phase, start, localX: 20, localY: 100,
            pointerEvent: phase === 'cancel' ? null : { clientX: 370, clientY: 400, ctrlKey: false } }
        browser.interactions.handle_pan(capture_pointer_input(detail))
        worker.on_pointer_input({ detail })
    }
    const detail = { localX: 200, localY: 220, wheelEvent: { deltaX: 12, deltaY: -30, ctrlKey: true } }
    browser.interactions.handle_wheel(capture_wheel_input(detail))
    worker.on_wheel_input({ detail })
    assert.deepEqual(logs[0], logs[1])
    assert.equal(logs[0][0].target, 'y-axis')
    assert.equal(logs[0][0].offsetX, -50)
    assert.equal(logs[0][0].ctrlKey, true)
    assert.equal(logs[0][1].target, 'y-axis') // retain origin after crossing into the plot
    assert.equal(logs[0][1].offsetX, 20)
    assert.equal(logs[0][1].ctrlKey, false)
    assert.equal(logs[0][2].pointer, null)
    assert.deepEqual(logs[0][3], { offsetX: 200, offsetY: 220, deltaX: 12, deltaY: -30,
        ctrlKey: true, target: 'x-axis' })
    browser.disconnect()
    worker.disconnect()
})
