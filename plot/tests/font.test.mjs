import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

await build({
    stdin: {
        contents: `
            export { validate_font, resolve_font } from './src/core/template/font'
            export { new_plot_template } from './src/core/template/plot_template'
            export { compose_plot } from './src/core/compose/compose_plot'
        `,
        resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    },
    bundle: true, platform: 'node', format: 'esm',
    outfile: fileURLToPath(new URL('../.build/font-test.mjs', import.meta.url)),
})
const { validate_font, resolve_font, new_plot_template, compose_plot } = await import('../.build/font-test.mjs')
const defaults = { family: 'monospace', size: 10, color: { light: '#111', dark: '#eee' } }

test('font overrides resolve field by field, including false and zero', () => {
    const root = Object.freeze({ family: 'Root', size: 18, weight: 600, italic: true,
        condensed: true, letter_spacing: 2, word_spacing: 3, caps: true, color: '#123' })
    const local = Object.freeze({ size: 12, italic: false, condensed: false,
        letter_spacing: 0, word_spacing: 0, caps: false, color: { light: '#456', dark: '#789' } })
    assert.deepEqual(resolve_font(local, root, defaults, 'dark'), {
        family: 'Root', size: 12, weight: 600, italic: false, condensed: false,
        letter_spacing: 0, word_spacing: 0, caps: 'normal', color: '#789',
    })
    assert.equal(resolve_font({ family: 'Local' }, root, defaults, 'light').family, 'Local')
    assert.equal(resolve_font(undefined, root, defaults, 'light').caps, 'all-small-caps')
    assert.equal(resolve_font({ caps: 'petite-caps' }, root, defaults, 'light').caps, 'petite-caps')
    const fallback = resolve_font(undefined, {}, defaults, 'dark')
    assert.deepEqual(fallback, { family: 'monospace', size: 10, weight: 400, color: '#eee',
        italic: false, condensed: false, letter_spacing: 0, word_spacing: 0, caps: 'normal' })
    assert.equal(resolve_font(undefined, {}, { size: 12, color: '#000' }, 'light').family, 'sans-serif')
    assert.deepEqual(validate_font('Example, serif', 'font'), { family: 'Example, serif' })
})

const locations = [
    ['font', font => ({ font })],
    ['title.font', font => ({ title: { text: 'Title', font } })],
    ...['x', 'y'].flatMap(side => [
        [`axis.${side}.label.font`, font => ({ axis: { [side]: { label: { text: 'Axis', font } } } })],
        [`axis.${side}.tick_label.font`, font => ({ axis: { [side]: { tick_label: { font } } } })],
    ]),
]
for (const [location, args] of locations) {
    test(`validates numeric font fields at ${location}`, () => {
        for (const [field, values] of Object.entries({
            size: [0, -1, NaN, Infinity, -Infinity],
            weight: [0, 1001, NaN, Infinity, -Infinity],
            letter_spacing: [NaN, Infinity, -Infinity],
            word_spacing: [NaN, Infinity, -Infinity],
        })) {
            for (const value of values) {
                assert.throws(() => new_plot_template({ series: [], ...args({ [field]: value }) }),
                    error => error.message.startsWith(`plot: ${location}.${field} must be`))
            }
        }
        for (const weight of [1, 425.5, 1000]) {
            assert.doesNotThrow(() => new_plot_template({ series: [],
                ...args({ size: 0.5, weight, letter_spacing: -1.5, word_spacing: 0 }) }))
        }
    })
}

test('font configuration survives template normalization and composition', () => {
    const args = {
        series: [], font: 'Root',
        title: { text: 'Title', font: { size: 20, color: '#123', weight: 600 } },
        axis: {
            x: { label: { text: 'Time', position: 'right', font: 'Axis' }, tick_label: { font: { size: 11 } } },
            y: { label: 'Value', tick_label: { font: 'Ticks' } },
        },
    }
    const before = structuredClone(args)
    const template = new_plot_template(args)
    const plot = compose_plot(template, 600, 300, 'light')
    assert.deepEqual(args, before, 'normalization leaves caller data unchanged')
    assert.deepEqual(plot.font, { family: 'Root' })
    assert.deepEqual(plot.title_font, args.title.font)
    assert.deepEqual(plot.x_axis.label_font, { family: 'Axis' })
    assert.equal(plot.x_axis.label_position, 'right')
    assert.deepEqual(plot.x_axis.tick_label_font, { size: 11 })
    assert.equal(plot.y_axis.label, 'Value')
    assert.deepEqual(plot.y_axis.tick_label_font, { family: 'Ticks' })
    assert.equal(plot.y_axis.label_font, undefined)
    assert.deepEqual(new_plot_template({ series: [], title: 'Plain' }).font, {})
})
