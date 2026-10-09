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
        export { zoom_transition, zoom_transition_duration, pan_frame, pan_has_room, zoomable_views, zoom_viewport } from './src/core/interactions/zoom_pan'
    `, resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
    bundle: true, platform: 'node', format: 'esm', external: ['react'],
    outfile: fileURLToPath(new URL('../.build/interaction-target-test.mjs', import.meta.url)),
})
const { PlotController, create_anta_host, PlotHost, capture_pointer_input, capture_wheel_input, scatter,
    zoom_transition, zoom_transition_duration, pan_frame, pan_has_room, zoomable_views, zoom_viewport } =
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
        controller.interactions.handle_drag = input => {
            log.push(input)
            return { started: false, changed: false, ended: false }
        }
        controller.interactions.handle_wheel = input => { log.push(input); return false }
    }
    const start = { localX: -50, localY: 100, pointerEvent: { clientX: 300, clientY: 400, ctrlKey: true } }
    for (const phase of ['start', 'move', 'cancel']) {
        const detail = { phase, start, localX: 20, localY: 100,
            pointerEvent: phase === 'cancel' ? null : { clientX: 370, clientY: 400, ctrlKey: false } }
        browser.interactions.handle_drag(capture_pointer_input(detail))
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

function animationViews(scale = 'linear') {
    const controller = new PlotController({
        series: [scatter({ data: [{ x: 1, y: 1 }, { x: 256, y: 256 }] })],
        axis: { x: { scale, min: 1, max: 256, padding: 0 }, y: { scale, min: 1, max: 256, padding: 0 } },
    })
    return controller.compose({ width: 600, height: 400, device_pixel_ratio: 1, color_theme: 'light' })
}

for (const scale of ['linear', 'log', 'time', 'utc']) {
    test(`zoom transition retains exact endpoints and disabled axes (${scale})`, () => {
        const views = zoomable_views(animationViews(scale), { x: true, y: false })
        const start = { x: null, y: [8, 32] }, end = { x: [16, 64], y: start.y }
        const frame = zoom_transition(views, start, end)
        assert.deepEqual(frame(0), start)
        assert.deepEqual(frame(1), end)
        for (const progress of [0.1, 0.5, 0.9]) {
            const current = frame(progress)
            assert.deepEqual(current.y, start.y)
            assert.ok(current.x[0] >= views.x_full_domain[0] && current.x[0] <= end.x[0])
            assert.ok(current.x[1] <= views.x_full_domain[1] && current.x[1] >= end.x[1])
        }
    })
    test(`pan room requires an enabled axis with a narrower window (${scale})`, () => {
        const plot = animationViews(scale)
        for (const axes of [{ x: true, y: true }, { x: true, y: false }, { x: false, y: true }, { x: false, y: false }]) {
            const views = zoomable_views(plot, axes)
            for (const viewport of [{ x: null, y: null }, { x: [1, 64], y: null }, { x: null, y: [64, 256] }]) {
                const snapshot = pan_frame(views, viewport, { x: 0, y: 0 })
                assert.equal(pan_has_room(snapshot, views), (axes.x && viewport.x !== null) || (axes.y && viewport.y !== null))
            }
        }
    })
}

test('log transitions move endpoints geometrically rather than linearly', () => {
    const views = animationViews('log')
    // Cubic ease-out reaches 1/2 at this fraction of the elapsed time.
    const progress = 1 - Math.cbrt(0.5)
    const frame = zoom_transition(views, { x: [1, 256], y: null }, { x: [16, 64], y: null })(progress)
    assert.ok(Math.abs(frame.x[0] - 4) < 1e-12)
    assert.ok(Math.abs(frame.x[1] - 128) < 1e-10)
})

test('duration is bounded, symmetric for reset, and responds to center travel and either axis', () => {
    for (const scale of ['linear', 'log']) {
        const views = animationViews(scale)
        const start = { x: [1, 256], y: [1, 256] }
        const near = { x: [2, 255], y: start.y }
        const far = { x: [32, 64], y: start.y }
        const a = zoom_transition_duration(views, start, near)
        const b = zoom_transition_duration(views, start, far)
        assert.equal(zoom_transition_duration(views, start, start), 200)
        assert.ok(a >= 200 && a < b && b <= 400)
        assert.equal(b, zoom_transition_duration(views, far, start))
        assert.equal(b, zoom_transition_duration(views, start, { x: start.x, y: far.x }))
        assert.equal(zoom_transition_duration(zoomable_views(views, { x: false, y: false }), start, far), 200)
    }
    const views = animationViews()
    assert.ok(zoom_transition_duration(views, { x: [1, 64], y: null }, { x: [128, 191], y: null }) > 200)
    assert.equal(zoom_transition_duration(views, { x: [1, 256], y: null }, { x: [128, 129], y: null }), 400)
})

test('Ctrl-wheel retains small pinch sensitivity and caps large samples symmetrically', () => {
    const views = animationViews()
    const start = { x: [64, 128], y: [64, 128] }
    const cursor = { x: views.x_scale(96), y: views.y_scale(96) }
    const span = viewport => viewport.x[1] - viewport.x[0]
    const small = zoom_viewport(views, start, cursor, -10, true)
    assert.ok(Math.abs(64 / span(small) - Math.exp(0.045)) < 1e-12)
    for (const delta of [-100, 100, -1000, 1000]) {
        const zoomed = zoom_viewport(views, start, cursor, delta, true)
        const ratio = span(zoomed) / 64
        assert.ok(Math.abs(ratio - (delta < 0 ? 1 / 1.2 : 1.2)) < 1e-12)
    }
})

function animatedHost(t, mode = 'immediate', reducedMotion = false) {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
    t.mock.method(performance, 'now', () => Date.now())
    const reports = [], frames = []
    const host = new PlotHost({
        commit_mode: mode, resolve_hover: input => input,
        schedule: () => host.render(), viewport_commit: () => frames.push(host.controller.interactions.committed_viewport),
        hover: noop, clear_hover: noop, pointer: noop, viewport: change => reports.push(change),
        error: failure => { throw failure.error },
    })
    host.update(args)
    host.measurement = { width: 600, height: 400 }
    host.update_context({ mode: 'light', devicePixelRatio: 1, font: { family: 'serif' }, reducedMotion })
    host.attach({ prepare: () => context() })
    host.render()
    t.after(() => host.disconnect())
    const advance = ms => { for (let i = 0; i < ms; i += 16) t.mock.timers.tick(16) }
    return { host, reports, frames, advance }
}

for (const mode of ['immediate', 'throttled']) {
    test(`menu animation reports only on completion (${mode})`, t => {
        const { host, reports, frames, advance } = animatedHost(t, mode)
        host.interactions.handle_menu({ offsetX: 200, offsetY: 100, action: 'in' })
        advance(96)
        assert.ok(frames.length > 1)
        assert.equal(reports.length, 0)
        advance(400)
        assert.equal(reports.length, 1)
        assert.equal(host.controller.interactions.zoom_animation_active, false)
        assert.deepEqual(reports[0].x.window, host.controller.interactions.committed_viewport.x)
    })
    test(`wheel interruption reports the interrupted frame and cancels the old target (${mode})`, t => {
        const { host, reports, advance } = animatedHost(t, mode)
        host.interactions.handle_menu({ offsetX: 200, offsetY: 100, action: 'in' })
        advance(80)
        const interrupted = host.controller.interactions.committed_viewport.x.slice()
        host.interactions.handle_wheel({ offsetX: 200, offsetY: 100, deltaX: 0, deltaY: 10, ctrlKey: false })
        assert.equal(reports.length, 1)
        assert.deepEqual(reports[0].x.window, interrupted)
        assert.equal(host.controller.interactions.zoom_animation_active, false)
        advance(500)
        assert.equal(reports.length, 2)
        assert.ok(reports[1].x.window[1] - reports[1].x.window[0] > interrupted[1] - interrupted[0])
    })
}

test('reduced motion reports immediately without leaving animation work', t => {
    const { host, reports, frames, advance } = animatedHost(t, 'immediate', true)
    host.interactions.handle_menu({ offsetX: 200, offsetY: 100, action: 'in' })
    assert.equal(frames.length, 1)
    assert.equal(reports.length, 1)
    advance(500)
    assert.equal(frames.length, 1)
    assert.equal(reports.length, 1)
})

test('disconnect cancels animation without a late frame or report', t => {
    const { host, reports, frames, advance } = animatedHost(t)
    host.interactions.handle_menu({ offsetX: 200, offsetY: 100, action: 'in' })
    advance(64)
    host.disconnect()
    const count = frames.length
    advance(500)
    assert.equal(frames.length, count)
    assert.equal(reports.length, 0)
})

for (const mode of ['immediate', 'throttled']) {
    test(`rectangle and reset complete once and preserve the disabled axis (${mode})`, t => {
        const { host, reports, advance } = animatedHost(t, mode)
        host.update({ ...args, zoom_pan: { x: true, y: false } })
        host.render()
        host.interactions.handle_drag({ phase: 'start', offsetX: 50, offsetY: 50, ctrlKey: true, pointer: { x: 50, y: 50 } })
        host.interactions.handle_drag({ phase: 'end', offsetX: 300, offsetY: 150, ctrlKey: true, pointer: { x: 300, y: 150 } })
        advance(64)
        assert.equal(reports.length, 0)
        advance(500)
        assert.equal(reports.length, 1)
        assert.equal(host.controller.interactions.committed_viewport.y, null)
        assert.equal(reports[0].zoom_factor.y, 1)
        host.interactions.handle_menu({ offsetX: 200, offsetY: 100, action: 'reset' })
        advance(64)
        assert.equal(reports.length, 1)
        advance(500)
        assert.equal(reports.length, 2)
        assert.deepEqual(host.controller.interactions.committed_viewport, { x: null, y: null })
        assert.deepEqual(reports[1].zoom_factor, { x: 1, y: 1 })
    })
}
