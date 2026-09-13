import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PlotController, area, error_bar } from '../dist/index.js'

// Chrome off, so every recorded path comes from a series rather than the grid, axes, or border.
const BARE = { border: false, grid: false, background: false, axis: { x: { hidden: true }, y: { hidden: true } } }
const ENVIRONMENT = { width: 600, height: 300, color_theme: 'light', device_pixel_ratio: 1 }
const ZOOM_PAN = { enabled: false, modifier: true, x: false, y: false }

const GROUPS = [
    { group: 'a', mean: 10, sem: 2 },
    { group: 'b', mean: 14, sem: 3 },
]

/**
 * A canvas context that records the geometry it is asked to draw. Unknown methods are no-ops so the
 * chrome path can run without the test enumerating every call the renderer might make.
 */
function recording_context() {
    const segments = []
    const marks = []
    let pen = [0, 0]
    const record = {
        moveTo(x, y) { pen = [x, y] },
        lineTo(x, y) { segments.push({ from: pen, to: [x, y] }); pen = [x, y] },
        arc(x, y, r) { marks.push({ x, y, r }) },
        measureText() { return { width: 0 } },
        canvas: { width: 600, height: 300 },
    }
    const context = new Proxy(record, {
        get(target, key) {
            if (key in target) {
                return target[key]
            }
            return typeof key === 'string' ? () => {} : undefined
        },
        set() { return true },
    })
    return { context, segments, marks }
}

/** Compose a bare plot and return its controller, template series, and composed plot. */
function compose(series, overrides = {}) {
    const controller = new PlotController({ series: [series], ...BARE, ...overrides })
    const composed = controller.compose(ENVIRONMENT)
    assert.ok(composed, 'plot composed')
    return { controller, resolved: controller.template.series[0], composed }
}

/** Draw a bare plot and return the geometry its series produced. */
function draw(series, overrides = {}) {
    const { controller } = compose(series, overrides)
    const recorder = recording_context()
    controller.draw(recorder.context)
    return recorder
}

test('y_error resolves a symmetric interval around the center', () => {
    const { resolved } = compose(error_bar({ data: GROUPS, x: 'group', y: 'mean', y_error: 'sem' }))

    assert.equal(resolved.side, 'y')
    assert.deepEqual([...resolved.low], [8, 11])
    assert.deepEqual([...resolved.high], [12, 17])
})

test('low / high resolve the interval values themselves', () => {
    const data = [{ study: 'one', estimate: 1.2, lo: 0.8, hi: 1.9 }]
    const { resolved } = compose(error_bar({ data, x: 'estimate', y: 'study', x_low: 'lo', x_high: 'hi' }))

    assert.equal(resolved.side, 'x')
    assert.deepEqual([...resolved.low], [0.8])
    assert.deepEqual([...resolved.high], [1.9])
})

test('a number pins the same spread on every row', () => {
    const { resolved } = compose(error_bar({ data: GROUPS, x: 'group', y: 'mean', y_error: 1.5 }))

    assert.deepEqual([...resolved.low], [8.5, 12.5])
    assert.deepEqual([...resolved.high], [11.5, 15.5])
})

test('the interval is adopted off rows that name their fields after the args', () => {
    const { resolved } = compose(error_bar({ data: [{ x: 1, y: 2, y_low: 1, y_high: 3 }] }))

    assert.equal(resolved.side, 'y')
    assert.deepEqual([...resolved.low], [1])
    assert.deepEqual([...resolved.high], [3])
})

test('the domain spans the whole interval, not just the centers', () => {
    const { composed } = compose(error_bar({ data: GROUPS, x: 'group', y: 'mean', y_error: 'sem' }))
    const [low, high] = composed.y_scale.domain()

    assert.ok(low <= 8, `y domain starts at or below the lowest bound, got ${low}`)
    assert.ok(high >= 17, `y domain reaches the highest bound, got ${high}`)
})

test('a vertical bar draws an interval, two crossbars, and a center mark', () => {
    const { segments, marks } = draw(error_bar({ data: GROUPS, x: 'group', y: 'mean', y_error: 'sem' }))

    // two bars, each an interval plus two crossbars
    assert.equal(segments.length, 6)
    assert.equal(marks.length, 2)
    const [interval, low_cap, high_cap] = segments

    assert.equal(interval.from[0], interval.to[0], 'the interval holds one x')
    assert.ok(interval.from[1] > interval.to[1], 'low sits below high on screen')
    assert.equal(low_cap.from[1], low_cap.to[1], 'a crossbar runs across the interval')
    assert.equal(low_cap.to[0] - low_cap.from[0], 8, 'the default crossbar is 8px')
    assert.equal((low_cap.from[0] + low_cap.to[0]) / 2, interval.from[0], 'centered on the interval')
    assert.equal(Math.round(low_cap.from[1]), Math.round(interval.from[1]), 'sits at the low end')
    assert.equal(Math.round(high_cap.from[1]), Math.round(interval.to[1]), 'sits at the high end')
    assert.equal(marks[0].x, interval.from[0], 'the mark sits on the interval')
    assert.ok(marks[0].y < interval.from[1] && marks[0].y > interval.to[1], 'between the ends')
})

test('a horizontal bar runs its interval across and its crossbars down', () => {
    const data = [{ study: 'one', estimate: 1.2, lo: 0.8, hi: 1.9 }]
    const { segments } = draw(error_bar({ data, x: 'estimate', y: 'study', x_low: 'lo', x_high: 'hi' }))
    const [interval, low_cap] = segments

    assert.equal(interval.from[1], interval.to[1], 'the interval holds one y')
    assert.ok(interval.to[0] > interval.from[0], 'low to high runs left to right')
    assert.equal(low_cap.from[0], low_cap.to[0], 'the crossbar runs vertically')
})

test('cap sets the crossbar length and false drops it', () => {
    const wide = draw(error_bar({ data: GROUPS, x: 'group', y: 'mean', y_error: 'sem', cap: 20 }))
    assert.equal(wide.segments[1].to[0] - wide.segments[1].from[0], 20)

    const plain = draw(error_bar({ data: GROUPS, x: 'group', y: 'mean', y_error: 'sem', cap: false }))
    assert.equal(plain.segments.length, 2, 'two intervals and no crossbars')
})

test('connect joins the centers in data order', () => {
    const { segments } = draw(error_bar({ data: GROUPS, x: 'group', y: 'mean', y_error: 'sem', cap: false, connect: true }))

    // one connecting segment between the two centers, then each interval
    assert.equal(segments.length, 3)
})

test('the whole glyph answers the hit test, not only its center', () => {
    const series = error_bar({ data: GROUPS, x: 'group', y: 'mean', y_error: 'sem', on_select() {} })
    const { controller, composed } = compose(series)
    const { layout, x_scale, y_scale } = composed
    // handle_click takes offsets against the plot area, which sits inside the canvas margins
    const click = (x, y) => controller.interactions.handle_click(
        { offsetX: x - layout.margin_left, offsetY: y - layout.margin_top, ctrlKey: false },
        ZOOM_PAN,
    )
    const bar_x = x_scale(0) + x_scale.bandwidth() / 2

    assert.equal(click(bar_x, y_scale(10))?.y, 10, 'the center hits')
    assert.equal(click(bar_x, y_scale(8))?.y, 10, 'the low end hits')
    assert.equal(click(bar_x, y_scale(12))?.y, 10, 'the high end hits')
    assert.equal(click(bar_x, y_scale(11))?.y, 10, 'midway along the interval hits')
    assert.equal(click(bar_x, y_scale(8) + 40), undefined, 'well past the end misses')
    assert.equal(click(bar_x + 40, y_scale(10)), undefined, 'well off to the side misses')
})

test('a dropped row trims the interval columns alongside x and y', () => {
    const data = [...GROUPS, { group: 'c', mean: 30, sem: 1 }]
    const series = error_bar({ data, x: 'group', y: 'mean', y_error: 'sem' })
    // pinning categories drops row 'c', which has to take its interval values with it
    const { resolved } = compose(series, { axis: { x: { categories: ['a', 'b'], hidden: true }, y: { hidden: true } } })

    assert.equal(resolved.x.length, 2)
    assert.deepEqual([...resolved.low], [8, 11])
    assert.deepEqual([...resolved.high], [12, 17])
})

test("a dropped row trims an area band's second boundary too", () => {
    const data = [
        { group: 'a', mean: 10, upper: 12 },
        { group: 'b', mean: 14, upper: 17 },
        { group: 'c', mean: 30, upper: 33 },
    ]
    const series = area({ data, x: 'group', y: 'mean', y2: 'upper' })
    const { resolved } = compose(series, { axis: { x: { categories: ['a', 'b'], hidden: true }, y: { hidden: true } } })

    assert.equal(resolved.x.length, 2)
    assert.deepEqual([...resolved.y2], [12, 17])
})

test('an empty series draws nothing instead of failing', () => {
    const { resolved } = compose(error_bar({ data: [], x: 'group', y: 'mean' }))

    assert.equal(resolved.x.length, 0)
    assert.equal(resolved.low.length, 0)
})

test('an undeclared interval is rejected', () => {
    assert.throws(
        () => error_bar({ data: GROUPS, x: 'group', y: 'mean' }),
        /no interval was declared/,
    )
})

test('a spread and explicit bounds on one axis are rejected', () => {
    assert.throws(
        () => error_bar({ data: GROUPS, x: 'group', y: 'mean', y_error: 'sem', y_low: 'sem' }),
        /y_error is set alongside/,
    )
})

test('half an interval is rejected', () => {
    assert.throws(
        () => error_bar({ data: GROUPS, x: 'group', y: 'mean', y_low: 'sem' }),
        /y_high is missing/,
    )
})

test('an interval on both axes is rejected', () => {
    assert.throws(
        () => error_bar({ data: GROUPS, x: 'group', y: 'mean', y_error: 'sem', x_error: 'sem' }),
        /declared on both x and y/,
    )
})

test('a negative pinned spread is rejected', () => {
    assert.throws(
        () => error_bar({ data: GROUPS, x: 'group', y: 'mean', y_error: -1 }),
        /must be a non-negative finite number/,
    )
})

test('a categorical interval axis is rejected', () => {
    const series = error_bar({ data: GROUPS, x: 'mean', y: 'group', y_error: 1 })

    assert.throws(
        () => new PlotController({ series: [series], ...BARE }, failure => { throw failure.error }),
        /can't be categorical/,
    )
})
