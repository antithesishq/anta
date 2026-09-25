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
            export { should_invert_color } from './src/core/template/color'
            export { PlotController } from './src/core/controller'
            export { apply_canvas_font } from './src/core/render/font'
        `,
        resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    },
    bundle: true, platform: 'node', format: 'esm',
    outfile: fileURLToPath(new URL('../.build/font-test.mjs', import.meta.url)),
})
const { validate_font, resolve_font, new_plot_template, compose_plot, should_invert_color, apply_canvas_font, PlotController } = await import('../.build/font-test.mjs')
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
    test(`rejects invalid caps at ${location}`, () => {
        for (const caps of ['smallcaps', '', 1, null]) {
            assert.throws(() => new_plot_template({ series: [], ...args({ caps }) }),
                error => error.message.startsWith(`plot: ${location}.caps must be`))
        }
    })
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


test('effective themed font colors disable automatic inversion only for rendered text', () => {
    const pair = { light: '#123', dark: '#def' }
    const axis = { rendered: true, axis: { label: 'Axis' } }
    const base = { series: [], x: axis }
    assert.equal(should_invert_color({ ...base, font: { color: pair } }), false)
    assert.equal(should_invert_color({ series: [], title: 'Title', title_font: { color: pair } }), false)
    for (const role of ['label_font', 'tick_label_font']) {
        assert.equal(should_invert_color({ ...base, x: { ...axis, axis: { label: 'Axis', [role]: { color: pair } } } }), false)
    }
    assert.equal(should_invert_color({ series: [], font: { color: pair } }), true)
    assert.equal(should_invert_color({ series: [], title_font: { color: pair } }), true)
    assert.equal(should_invert_color({ series: [], x: { rendered: false, axis: { tick_label_font: { color: pair } } } }), true)
    assert.equal(should_invert_color({ series: [], x: { rendered: true, axis: { label_font: { color: pair } } } }), true)
    assert.equal(should_invert_color({ ...base, font: { color: pair }, x: { ...axis, axis: {
        label: 'Axis', label_font: { color: '#123' }, tick_label_font: { color: '#456' },
    } } }), true, 'overridden theme pairs do not disable inversion')
    assert.equal(should_invert_color({ ...base, font: { color: pair }, theme_invert: true }), true)
    assert.equal(should_invert_color({ ...base, theme_invert: false }), false)
})

test('canvas font application tolerates contexts without optional text features', () => {
    const ctx = { font: '', fillStyle: '' }
    apply_canvas_font(ctx, resolve_font({ size: 16, italic: true, condensed: true }, {}, defaults, 'light'))
    assert.equal(ctx.font, 'italic 400 condensed 16px monospace, sans-serif')
    assert.equal(ctx.fillStyle, '#111')
    assert.deepEqual(Object.keys(ctx), ['font', 'fillStyle'])
})

test('family strings pass through unchanged and supported caps are accepted', () => {
    for (const family of ['16px Inter', 'Arial,', 'Arial', 'Comic Sans MS', 'Unknown Font', 'system-ui',
        '"Antithesis mono", monospace', "'16px Inter', serif", '"A,B", Arial',
        '游ゴシック', String.raw`\31 6px\ Inter, serif`, 'Arial /* fallback */, sans-serif']) {
        assert.equal(validate_font(family, 'font').family, family)
    }
    for (const caps of [true, false, 'normal', 'small-caps', 'all-small-caps',
        'petite-caps', 'all-petite-caps', 'unicase', 'titling-caps']) {
        assert.equal(validate_font({ caps }, 'font').caps, caps)
    }
})

test('invalid caps report template errors through the lifecycle callback', () => {
    for (const font of [{ caps: 'smallcaps' }, { caps: 1 }]) {
        const errors = []
        assert.throws(() => new PlotController({ series: [], font }, failure => errors.push(failure)))
        assert.equal(errors.length, 1)
        assert.equal(errors[0].phase, 'template')
        assert.ok(errors[0].error instanceof Error)
        assert.match(errors[0].error.message, /plot: font\.caps must be/)

        const controller = new PlotController({ series: [], font: 'Arial' }, failure => errors.push(failure))
        const template = controller.template
        controller.update_plot_args({ series: [], font })
        assert.equal(errors.length, 2)
        assert.equal(errors[1].phase, 'template')
        assert.equal(controller.template, template, 'invalid updates retain the previous template')
    }
})

test('empty families inherit without discarding other font fields', () => {
    for (const family of ['', '   ', '\t\n']) {
        const config = Object.freeze({ family, size: 24, weight: 600 })
        const root = validate_font(config, 'font')
        const inherited = resolve_font(undefined, root, { family: 'serif', size: 14, color: '#000' }, 'light')
        assert.equal(inherited.family, 'serif')
        assert.equal(inherited.size, 24)
        assert.equal(inherited.weight, 600)
        assert.equal(config.family, family)
        const local = validate_font(family, 'title.font')
        assert.equal(resolve_font(local, { family: 'Arial', size: 16 }, defaults, 'light').family, 'Arial')
        assert.equal(resolve_font(undefined, local, {size:14, color:'#000'}, 'light').family, 'sans-serif')
    }
})
