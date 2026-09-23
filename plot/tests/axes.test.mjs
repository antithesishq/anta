import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

await build({
    stdin: {
        contents: `
            export { continuous_axis_layout } from './src/core/render/axes'
            export { scaleLinear, scaleTime, scaleUtc } from 'd3-scale'
        `,
        resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    },
    bundle: true, platform: 'node', format: 'esm',
    outfile: fileURLToPath(new URL('../.build/axes-test.mjs', import.meta.url)),
})
const { continuous_axis_layout, scaleLinear, scaleTime, scaleUtc } = await import('../.build/axes-test.mjs')
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
