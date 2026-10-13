import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

await build({
    stdin: {
        contents: `
            export { continuous_axis_layout } from './src/core/render/axes'
            export { new_scatter } from './src/core/series/scatter/factory'
            export { new_line } from './src/core/series/line/factory'
            export { new_bar } from './src/core/series/bar/factory'
            export { new_area } from './src/core/series/area/factory'
            export { new_rect } from './src/core/series/rect/factory'
            export { scaleLinear, scaleTime, scaleUtc } from 'd3-scale'
        `,
        resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    },
    bundle: true, platform: 'node', format: 'esm',
    outfile: fileURLToPath(new URL('../.build/axes-test.mjs', import.meta.url)),
})
const { continuous_axis_layout, new_scatter, new_line, new_bar, new_area, new_rect, scaleLinear, scaleTime, scaleUtc } = await import('../.build/axes-test.mjs')

test('scatter default x preserves values, categories, and field metadata', () => {
    for (const [data, values, categories] of [
        [[], [], undefined],
        [[{ x: 2, y: 1 }, { x: 4, y: 2 }], [2, 4], undefined],
        [[{ x: 'b', y: 1 }, { x: 'a', y: 2 }, { x: 'b', y: 3 }], [0, 1, 0], ['b', 'a']],
        [[Object.assign(Object.create({ x: 5 }), { y: 1 })], [5], undefined],
    ]) {
        const series = new_scatter({ data })
        assert.deepEqual([...series.x], values)
        assert.deepEqual(series.x_categories, categories)
        assert.equal(series.x_field, 'x')
        assert.equal(series.rows, data)
    }
    const data = [{ duration: 7, y: 1 }]
    const named = new_scatter({ data, x: 'duration' })
    assert.deepEqual([...named.x], [7])
    assert.equal(named.x_field, 'duration')
    const accessor = new_scatter({ data, x: row => row.duration * 2 })
    assert.deepEqual([...accessor.x], [14])
    assert.equal(accessor.x_field, undefined)
})

test('scatter default x retains missing-field and invalid-value diagnostics', () => {
    assert.throws(() => new_scatter({ data: [{ duration: 7, y: 1 }] }), {
        message: "plot.scatter: x defaulted to 'x' (no x arg passed) but row 0 has no 'x' field. Available numeric/string fields: 'duration', 'y'.",
    })
    for (const x of [undefined, null, false, {}, NaN, Infinity]) {
        assert.throws(() => new_scatter({ data: [{ x, y: 1 }] }), /row 0 field 'x' is not a finite number or a string/)
    }
    assert.throws(() => new_scatter({ data: [{ x: 1, y: 1 }, { y: 2 }] }), /row 1 field 'x' is not a finite number or a string/)
    assert.throws(() => new_scatter({ data: [{ x: 1, y: 1 }, { x: 'a', y: 2 }] }), /row 1 field 'x' is a string but earlier rows were numeric/)
})

test('shared x/y defaults preserve columns and labels across factories', () => {
    for (const factory of [new_scatter, new_line, new_area, new_rect]) {
        const data = [{ x: 2, y: 3 }, { x: 4, y: 5 }]
        const series = factory({ data, size: 10 })
        const explicit = factory({ data, size: 10, x: row => row.x, y: row => row.y })
        assert.deepEqual([...series.x], [2, 4])
        assert.deepEqual([...series.y], [3, 5])
        assert.deepEqual(series.x, explicit.x)
        assert.deepEqual(series.y, explicit.y)
        assert.equal(series.x_field, 'x')
        assert.equal(series.y_field, 'y')
        assert.equal(factory({ data: [] }).x.length, 0)
        assert.throws(() => factory({ data: [{ x: 2 }], size: 10 }), /y defaulted to 'y'.*row 0 has no 'y' field/)
        assert.throws(() => factory({ data: [{ x: 2, y: null }], size: 10 }), /field 'y' is not a finite number or a string/)
    }
    const categorical = new_scatter({ data: [{ x: 'a', y: 'b' }, { x: 'c', y: 'd' }] })
    assert.deepEqual(categorical.x_categories, ['a', 'c'])
    assert.deepEqual(categorical.y_categories, ['b', 'd'])
})

test('bar defaults preserve plain and stacked bands in both orientations', () => {
    for (const band of ['x', 'y']) {
        const value = band === 'x' ? 'y' : 'x'
        const plain = new_bar({ data: [{ [band]: 'a', [value]: 5 }] })
        assert.deepEqual([...plain[band]], [0])
        assert.deepEqual([...plain[value]], [5])
        assert.equal(plain[band + '_field'], band)
        assert.equal(plain[value + '_field'], value)
        const stacked = new_bar({ data: [{ [band]: 'a', first: 2, second: 3 }], [value]: ['first', 'second'] })
        assert.deepEqual([...stacked[band]], [0, 0])
        assert.deepEqual([...stacked[value]], [2, 3])
        assert.deepEqual([...stacked.stack_base], [0, 2])
        assert.equal(stacked[band + '_field'], band)
        assert.deepEqual(stacked[band + '_categories'], ['a'])
    }
})

test('area and rectangle defaults discover optional corners and preserve spans', () => {
    for (const corner of ['x2', 'y2']) {
        const area = new_area({ data: [{ x: 2, y: 3, [corner]: 6 }] })
        assert.deepEqual([...area[corner]], [6])
    }
    const rect = new_rect({ data: [{ x: 2, y: 3, x2: 4, y2: 5 }] })
    assert.deepEqual([...rect.x2], [4])
    assert.deepEqual([...rect.y2], [5])
    const inherited = new_rect({ data: [Object.assign(Object.create({ x2: 4, y2: 5 }), { x: 2, y: 3 })] })
    assert.deepEqual(inherited.x2, rect.x2)
    assert.deepEqual(inherited.y2, rect.y2)
    const spanned = new_rect({ data: [{ y: 3, y2: 5 }], span: 'x' })
    assert.ok(Number.isNaN(spanned.x[0]))
    assert.equal(spanned.x_field, undefined)
    assert.deepEqual([...spanned.y], [3])
    assert.throws(() => new_rect({ data: [{ x: 2, y: 3 }, { x: 3, y: 4, x2: 5, y2: 6 }] }), /x2: 'x2' but row 0 has no 'x2' field/)
})

test('optional row colors override normal colors without affecting highlight colors', () => {
    const pair = { light: 'red', dark: 'pink' }
    const data = [
        { x: 1, y: 1, color: pair },
        { x: 2, y: 2, color: '' },
        { x: 3, y: 3 },
        Object.assign(Object.create({ color: 'green' }), { x: 4, y: 4 }),
        { x: 5, y: 5, color: { light: 'red' } },
    ]
    const calls = []
    const series = new_scatter({ data, color: (row, index) => { calls.push(index); return 'blue' }, highlight_color: 'gold' })
    assert.deepEqual(series.colors, [pair, 'blue', 'blue', 'green', 'blue'])
    assert.deepEqual(calls, [1, 2, 4])
    assert.equal(series.highlight_color, 'gold')
    assert.equal(series.highlight_colors, undefined)
    assert.deepEqual(new_scatter({ data, color: 'blue' }).colors, series.colors)
    assert.equal(new_scatter({ data: [{ x: 1, y: 1, color: false }], color: 'blue' }).colors, undefined)
})

test('stacked row colors override segment colors and retain segment accessor indices', () => {
    const data = [{ x: 'a', first: 1, second: 2, color: 'red' }, { x: 'b', first: 3, second: 4 }]
    const args = { data, y: ['first', 'second'] }
    assert.deepEqual(new_bar({ ...args, color: ['blue', 'green'] }).colors, ['red', 'red', 'blue', 'green'])
    assert.deepEqual(new_bar({ ...args, color: 'blue' }).colors, ['red', 'red', 'blue', 'blue'])
    const calls = []
    const series = new_bar({ ...args, color: (row, segment) => {
        calls.push([row.x, segment])
        return segment === 0 ? 'blue' : 'green'
    } })
    assert.deepEqual(series.colors, ['red', 'red', 'blue', 'green'])
    assert.deepEqual(calls, [['b', 0], ['b', 1]])
})

test('optional row sizes retain fallbacks, deferred accessors, and numeric validation', () => {
    const data = [
        { x: 1, y: 1, size: 0 },
        { x: 2, y: 2, size: 'large' },
        { x: 3, y: 3 },
        Object.assign(Object.create({ size: 8 }), { x: 4, y: 4 }),
    ]
    assert.deepEqual(new_scatter({ data, size: 6 }).sizes, [0, 6, 6, 8])
    assert.deepEqual(new_scatter({ data }).sizes, [0, null, null, 8])
    assert.equal(new_scatter({ data: [{ x: 1, y: 1, size: 'large' }], size: 6 }).sizes, undefined)
    let calls = 0
    const accessor = () => { calls++; return 6 }
    const series = new_scatter({ data, size: accessor })
    assert.equal(series.size_accessor, accessor)
    assert.equal(calls, 0)
    assert.deepEqual(series.sizes, [0, null, null, 8])
    for (const size of [-1, NaN, Infinity, -Infinity]) {
        assert.throws(() => new_scatter({ data: [{ x: 1, y: 1, size }], size: 6 }), /row 0 field 'size' must be a non-negative finite number/)
    }
})

const ctx = { save() {}, restore() {}, measureText: () => ({ width: 1 }) }
const font = { family: 'monospace', size: 10, weight: 400, color: '#777',
    italic: false, condensed: false, caps: 'normal', letter_spacing: 0, word_spacing: 0 }
const inner = { left: 0, right: 420, top: 0, bottom: 300 }
function ticks(scale, axis) {
    return continuous_axis_layout(ctx, 'x', scale.range([0, 420]), inner, axis, font)
}

for (const kind of ['utc', 'time']) {
    test(`${kind} two-day ticks keep calendar cadence across months and DST`, () => {
        // Local calendar arithmetic also covers a daylight-saving transition.
        const previousTZ = process.env.TZ
        process.env.TZ = 'America/New_York'
        try {
            for (const [month, day] of [[0, 25], [1, 25], [2, 5]]) {
                const date = offset => kind === 'utc'
                    ? new Date(Date.UTC(2024, month, day + offset))
                    : new Date(2024, month, day + offset)
                const scale = (kind === 'utc' ? scaleUtc() : scaleTime()).domain([date(0), date(14)])
                const values = []
                ticks(scale, { scale: kind, tick_label_format: value => { values.push(new Date(value)); return '' } })
                assert.ok(values.length >= 6)
                const calendarDay = value => kind === 'utc'
                    ? Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
                    : Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())
                for (let i = 1; i < values.length; i++) {
                    assert.equal((calendarDay(values[i]) - calendarDay(values[i - 1])) / 86_400_000, 2)
                }
            }
        } finally {
            if (previousTZ === undefined) delete process.env.TZ
            else process.env.TZ = previousTZ
        }
    })
}

test('daily and hourly time intervals retain the automatically selected ticks', () => {
    for (const span of [86_400_000, 7 * 86_400_000]) {
        const scale = scaleUtc().domain([new Date('2024-01-29'), new Date(Date.parse('2024-01-29') + span)])
        const values = []
        ticks(scale, { scale: 'utc', tick_label_format: value => { values.push(value); return '' } })
        assert.deepEqual(values, scale.ticks(7).map(Number))
    }
})

test('SI labels begin at positive and negative 10,000 and preserve zero', () => {
    for (const end of [10_000, -10_000]) {
        const labels = ticks(scaleLinear().domain([0, end]), {}).map(tick => tick.label)
        assert.equal(labels[0], '0')
        assert.equal(labels.at(-1), end < 0 ? '−10k' : '10k')
    }
    assert.equal(ticks(scaleLinear().domain([0, 9000]), {}).at(-1).label, '9,000')
})

test('custom formatting overrides SI labels', () => {
    const labels = ticks(scaleLinear().domain([0, 10_000]), { tick_label_format: value => `value=${value}` })
    assert.equal(labels.at(-1).label, 'value=10000')
})

test('zero retains decimal precision on fractional axes', () => {
    for (const [domain, zero] of [[[-1, 1], '0.0'], [[0, 1], '0.0'], [[0, 0.001], '0.0000']]) {
        const labels = ticks(scaleLinear().domain(domain), {}).map(tick => tick.label)
        assert.ok(labels.includes(zero), `${domain}: ${labels}`)
        assert.equal(labels.includes('0'), false)
    }
})
