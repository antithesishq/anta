import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

await build({
    stdin: { contents: `
        export { PlotController } from './src/core/controller'
        export { new_scatter as scatter } from './src/core/series/scatter/factory'
        export { draw_scatter } from './src/core/series/scatter/paint'
        export { scatter_hit_test } from './src/core/series/scatter/hit'
        export { scatter_highlight_spec } from './src/core/series/scatter/highlight'
    `, resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
    bundle: true, platform: 'node', format: 'esm',
    outfile: fileURLToPath(new URL('../.build/viewport-size-test.mjs', import.meta.url)),
})
const { PlotController, scatter, draw_scatter, scatter_hit_test, scatter_highlight_spec } = await import('../.build/viewport-size-test.mjs')
const environment = { width: 640, height: 360, device_pixel_ratio: 1, color_theme: 'light' }
const both = { x: true, y: true }
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8 * Math.max(1, b), `${a} != ${b}`)
const render = c => c.compose(environment, c.interactions.committed_viewport)
function controller(series, extra = {}, onError = failure => { throw failure.error }) {
    const c = new PlotController({ series: [series], axis: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } }, ...extra }, onError)
    render(c)
    return c
}
function wheel(c, factor, axes = both, commit = true) {
    c.interactions.on_scroll({ offsetX: 280, offsetY: 150, deltaY: -Math.log(factor) / .0015 }, axes)
    if (commit) c.interactions.commit_viewport()
}
const data = [{ x: 50, y: 50, weight: 2 }]
const grow = (row, index, viewport) => Math.min(16, Number(row.weight) * viewport.zoom.x ** .25)

test('combines row data with actual viewport zoom, independently of axis domains', () => {
    for (const [min, max, scale] of [[0, 1, 'linear'], [-1e9, 1e9, 'linear'], [1, 1e8, 'log'],
        [Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1), 'utc']]) {
        const c = controller(scatter({ data, size: grow }), { axis: { x: { min, max, scale }, y: { min: 0, max: 100 } } })
        close(render(c).series[0].sizes[0], 2)
        wheel(c, 16, { x: true, y: false })
        close(render(c).series[0].sizes[0], 4)
        close(c.interactions.viewport_change().zoom.x, 16)
        close(c.interactions.viewport_change().zoom.y, 1)
    }
})

test('accessor gets the composed windows and full domains, and runs again on pan', () => {
    const views = []
    const c = controller(scatter({ data, size: (row, i, viewport) => {
        views.push(viewport)
        return viewport.x.window[0] > 40 ? 20 : 10
    } }))
    assert.deepEqual(views.at(-1).x, { window: [0, 100], full: [0, 100] })
    wheel(c, 4)
    render(c)
    const before = views.at(-1)
    c.interactions.begin_pan({ x: 300, y: 150 }, both)
    c.interactions.advance_pan({ x: 0, y: 150 }, both)
    c.interactions.end_pan()
    c.interactions.commit_viewport()
    const plot = render(c)
    assert.notDeepEqual(views.at(-1).x.window, before.x.window)
    assert.deepEqual(views.at(-1).zoom, before.zoom)
    assert.deepEqual(views.at(-1), c.interactions.viewport_change())
    assert.equal(plot.series[0].sizes[0], 20)
})

test('category filtering preserves original indices and row size precedence', () => {
    const calls = []
    const rows = [{ x: 'drop', y: 0 }, { x: 'a', y: 50, size: 9 }, { x: 'b', y: 100 }]
    const series = scatter({ data: rows, size: (row, index, viewport) => {
        calls.push({ row, index, viewport }); return index + viewport.zoom.y
    } })
    assert.equal(calls.length, 0)
    const c = controller(series, { axis: { x: { categories: ['a', 'b'] }, y: { min: 0, max: 100 } } })
    assert.deepEqual(render(c).series[0].sizes, [9, 3])
    assert.equal(calls[0].row, rows[2])
    assert.equal(calls[0].index, 2)
    assert.equal(calls[0].viewport.x, null)
    wheel(c, 4)
    assert.deepEqual(render(c).series[0].sizes, [9, 6])
    assert.equal(calls.length, 2)
})

test('pending zoom is not passed to accessors until the composition is committed', () => {
    const c = controller(scatter({ data, size: grow }))
    wheel(c, 2, both, false)
    wheel(c, 8, both, false)
    close(render(c).series[0].sizes[0], 2)
    c.interactions.commit_viewport()
    close(render(c).series[0].sizes[0], 4)
    c.interactions.reset_viewport(both)
    close(render(c).series[0].sizes[0], 2)
})

test('data updates and resize retain gesture magnification; requests establish a new baseline', () => {
    const c = controller(scatter({ data, size: grow }), { viewport: { x: [40, 60] } })
    c.interactions.adopt_viewport_request(c.template.viewport)
    close(render(c).series[0].sizes[0], 2)
    wheel(c, 16)
    close(render(c).series[0].sizes[0], 4)
    c.update_plot_args({ ...c.plot_args, axis: { x: { min: -1e6, max: 1e6 }, y: { min: 0, max: 100 } } })
    close(render(c).series[0].sizes[0], 4)
    close(c.compose({ ...environment, width: 900 }, c.interactions.committed_viewport).series[0].sizes[0], 4)
    c.interactions.adopt_viewport_request({ key: 'new', window: { x: c.interactions.committed_viewport.x, y: null } })
    close(render(c).series[0].sizes[0], 2)
})

test('legacy accessors and fixed sizes remain valid; hover/hit/highlight reuse composition sizes', () => {
    const fixed = scatter({ data: [{ x: 50, y: 50, size: 7 }], size: 9 })
    assert.deepEqual(fixed.sizes, [7])
    const legacy = controller(scatter({ data, size: (row, i) => row.weight + i }))
    assert.deepEqual(render(legacy).series[0].sizes, [2])
    let calls = 0
    const c = controller(scatter({ data, size: (row, i, viewport) => {
        calls++; return Math.min(40, 10 * viewport.zoom.x)
    } }))
    wheel(c, 4)
    const p = render(c), series = p.series[0], arcs = []
    const count = calls
    const ctx = { beginPath() {}, arc: (...args) => arcs.push(args), fill() {} }
    draw_scatter(series, { ctx, ...p, color: 'black' })
    const x = p.x_scale(50), y = p.y_scale(50)
    assert.equal(arcs[0][2], 20)
    assert.equal(scatter_hit_test(series, { x: x + 19, y }, p.x_scale, p.y_scale), 0)
    assert.equal(scatter_hit_test(series, { x: x + 21, y }, p.x_scale, p.y_scale), null)
    assert.equal(scatter_highlight_spec(series, 0, p.x_scale, p.y_scale).r, 20)
    render(c)
    c.compose({ ...environment, device_pixel_ratio: 2 }, c.interactions.committed_viewport)
    assert.equal(calls, count)
})

test('bad accessor results fail composition atomically and recover on a later viewport', () => {
    for (const bad of [-1, NaN, Infinity, {}, undefined]) {
        const failures = []
        const c = controller(scatter({ data, size: (row, i, viewport) => viewport.zoom.x > 1 ? bad : 4 }), {}, f => failures.push(f))
        const valid = render(c)
        wheel(c, 2)
        assert.equal(render(c), valid)
        assert.equal(failures.at(-1).phase, 'compose')
        assert.match(failures.at(-1).error.message, /size accessor at row 0/)
        c.interactions.reset_viewport(both)
        assert.equal(render(c).series[0].sizes[0], 4)
        assert.equal(c.has_current_composition, true)
    }
})

test('zoom limits and round trips do not accumulate fictitious magnification', () => {
    const c = controller(scatter({ data, size: grow }))
    wheel(c, 1e12, { x: true, y: false })
    close(c.interactions.viewport_change().zoom.x, 10000)
    close(c.interactions.viewport_change().zoom.y, 1)
    c.interactions.reset_viewport(both)
    for (const factor of [1.1, 1.3, 1.7, 3, 7, 12]) {
        wheel(c, factor); render(c)
        wheel(c, 1 / factor); render(c)
        assert.equal(c.interactions.is_zoomed(both), false)
    }
})
