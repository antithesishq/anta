import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import React from 'react'
import { Plot } from './components.bundle.mjs'
import { scatter } from './components.bundle.mjs'

const directory = dirname(fileURLToPath(import.meta.url))
const requirePlot = createRequire(new URL('../package.json', import.meta.url))
const requireSite = createRequire(new URL('../../site/package.json', import.meta.url))
const { renderToString } = requirePlot('react-dom/server')
const { chromium } = requireSite('playwright')

let browser, server, origin

const series = [scatter({
    data: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }],
    tooltip: true,
})]

const ssr = renderToString(React.createElement(React.StrictMode, null,
    React.createElement(React.Suspense, { fallback: React.createElement('span', null, 'Pending') },
        React.createElement(Plot, { plotArgs: { series }, 'data-plot': true }))))

before(async () => {
    const result = await build({
        entryPoints: [resolve(directory, 'components.fixture.jsx')],
        bundle: true,
        write: false,
        outfile: 'fixture.js',
        format: 'esm',
        target: 'es2022',
        jsx: 'automatic',
        jsxImportSource: 'react',
        tsconfigRaw: { compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'react' } },
        alias: {
            preact: dirname(requireSite.resolve('preact/package.json')),
            react: dirname(requirePlot.resolve('react/package.json')),
            'react-dom': dirname(requirePlot.resolve('react-dom/package.json')),
        },
    })

    const assets = new Map(result.outputFiles.map(file => [
        file.path.endsWith('.css') ? '/fixture.css' : '/fixture.js',
        file.text,
    ]))

    // These checks exercise injected host styles without the compatibility stylesheet.
    assert.doesNotMatch(assets.get('/fixture.css') ?? '', /:where\(a-plot\)/)

    server = createServer((req, res) => {
        res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript'
            : req.url.endsWith('.css') ? 'text/css' : 'text/html')
        res.end(assets.get(req.url) ?? `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css">
            <style>body{margin:0}#app{width:600px;height:300px}</style>
            <div id="app">${req.url === '/hydrate' ? ssr : ''}</div>
            <script type="module" src="/fixture.js"></script>`)
    })

    await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve)
    })

    origin = `http://127.0.0.1:${server.address().port}`

    browser = await chromium.launch({
        headless: true,
        executablePath: process.env.PLOT_TEST_BROWSER_EXECUTABLE || undefined,
        channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined,
        args: ['--no-sandbox'],
    })
})

after(async () => {
    await browser?.close()
    if (server) await new Promise(resolve => server.close(resolve))
})

async function pageFor(t, hydrate = false) {
    const context = await browser.newContext({ viewport: { width: 1000, height: 800 } })
    t.after(() => context.close())
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    t.after(() => assert.deepEqual(errors, []))
    await page.goto(origin + (hydrate ? '/hydrate' : '/'))
    await page.waitForFunction(() => window.ready)
    await page.evaluate(hydrate => hydrate ? hydratePlot() : renderPlot(), hydrate)
    await page.waitForFunction(() => stats.formatted.committed > 0 && document.querySelector('canvas')?.width === 600)
    return page
}

async function center(page, type = 'mousemove', options = {}, selector = 'a-capture') {
    return page.evaluate(({ type, options, selector }) => {
        const capture = document.querySelector('a-capture')
        const rect = capture.getBoundingClientRect()
        const eventOptions = {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            ...options,
        }
        const event = type === 'wheel' ? new WheelEvent(type, eventOptions) : new MouseEvent(type, eventOptions)
        document.querySelector(selector).dispatchEvent(event)
        return event.defaultPrevented
    }, { type, options, selector })
}

test('SSR does not initialize a controller or evaluate plot callbacks', () => {
    let calls = 0
    const markup = renderToString(React.createElement(Plot, {
        plotArgs: {
            series,
            axis: {
                x: {
                    tick_label: {
                        format: () => {
                            calls++
                            return 'x'
                        },
                    },
                },
            },
        },
    }))
    assert.match(markup, /<div/)
    assert.doesNotMatch(markup, /<canvas/)
    assert.equal(calls, 0)
    assert.equal(typeof globalThis.customElements, 'undefined')
})

test('StrictMode: overlap, default/explicit sizing, pin removal, theme, DPR and remount', async t => {
    const page = await pageFor(t)

    assert.deepEqual(await page.evaluate(() => {
        const main = document.querySelector('.plot-canvas')
        const overlay = document.querySelector('.plot-highlight')
        const a = main.getBoundingClientRect()
        const b = overlay.getBoundingClientRect()

        return {
            main: [a.x, a.y, a.width, a.height],
            overlay: [b.x, b.y, b.width, b.height],
            height: document.querySelector('[data-plot]').getBoundingClientRect().height,
            standalone: Boolean(customElements.get('a-plot')),
        }
    }), { main: [0, 0, 600, 300], overlay: [0, 0, 600, 300], height: 300, standalone: false })

    await page.evaluate(() => renderPlot({ args: { width: 420, height: 260 } }))
    await page.waitForFunction(() => document.querySelector('canvas').width === 420)
    await page.evaluate(() => {
        document.querySelector('#app').style.width = '500px'
        renderPlot()
    })
    await page.waitForFunction(() => document.querySelector('canvas').width === 500
        && document.querySelector('canvas').height === 300)

    // Parent-relative height is the notebook dashboard contract.
    await page.evaluate(() => {
        document.querySelector('#app').style.height = '170px'
        renderPlot()
    })
    await page.waitForFunction(() => document.querySelector('canvas').height === 170)
    await page.evaluate(() => document.querySelector('#app').style.height = '246px')
    await page.waitForFunction(() => document.querySelector('canvas').height === 246)
    await page.evaluate(() => {
        document.querySelector('#app').style.height = '300px'
        renderPlot()
    })
    await page.waitForFunction(() => document.querySelector('canvas').height === 300)
    assert.equal(await page.evaluate(() => stats.transfers), 2)

    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForFunction(() => document.querySelector('canvas').style.filter.includes('invert'))
    assert.equal(await page.locator('a-capture').evaluate(el => el.style.filter), '')

    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 800, deviceScaleFactor: 2, mobile: false })
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))
    await page.waitForFunction(() => document.querySelector('canvas').width === 1000
        && document.querySelector('.plot-highlight').width === 1000)
    await page.evaluate(() => document.querySelector('#app').style.display = 'none')
    await page.evaluate(() => document.querySelector('#app').style.display = '')
    await page.waitForFunction(() => document.querySelector('canvas').getBoundingClientRect().width === 500)

    await page.evaluate(() => {
        window.oldSurface = document.querySelector('a-plot-surface')
        unmountPlot()
        renderPlot()
    })
    await page.waitForFunction(() => document.querySelector('canvas')?.width === 1000)
    assert.equal(await page.evaluate(() => oldSurface !== document.querySelector('a-plot-surface')), true)
    assert.deepEqual(await page.evaluate(() => stats.errors), [])
    assert.equal(await page.evaluate(() => stats.transfers), 4)
})

test('React-owned tooltips retain context, clear in margins, and unmount with the plot', async t => {
    const page = await pageFor(t)

    await center(page)
    await page.waitForFunction(() => document.querySelector('[data-tooltip]')?.textContent === 'provided:committed')
    assert.equal(await page.locator('a-tooltip hr').count(), 1)
    await center(page, 'mousemove', {}, '[data-tooltip]')
    await page.waitForFunction(() => document.querySelector('[data-tooltip]'))
    await center(page, 'click')
    assert.equal(await page.evaluate(() => stats.selected), 1)
    await page.evaluate(() => document.querySelector('a-capture').dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, clientX: 1, clientY: 1 })))
    await page.waitForFunction(() => !document.querySelector('[data-tooltip]'))
    await center(page)
    await page.waitForFunction(() => document.querySelector('[data-tooltip]'))
    await page.evaluate(() => unmountPlot())
    await page.waitForFunction(() => stats.mounted === stats.unmounted)
    assert.equal(await page.locator('a-plot-surface').count(), 0)
})

test('wheel ownership, reset, and keyed viewport updates retain shared controller behavior', async t => {
    const page = await pageFor(t)

    assert.equal(await center(page, 'wheel', { ctrlKey: true, deltaY: -120 }), true)
    await page.waitForFunction(() => !document.querySelector('.plot-reset').hidden && stats.reports.length > 0)
    await page.locator('.plot-reset').click()
    await page.waitForFunction(() => document.querySelector('.plot-reset').hidden)
    await page.evaluate(() => renderPlot({ args: { viewport: { key: 'request', x: [2, 8] } } }))
    await page.waitForFunction(() => !document.querySelector('.plot-reset').hidden)
    assert.deepEqual(await page.evaluate(() => stats.errors), [])
    // Empty area outside the plot must not acquire wheel ownership.
    assert.equal(await page.evaluate(() => {
        const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -120 })
        document.body.dispatchEvent(event)
        return event.defaultPrevented
    }), false)
})

test('a suspended update cannot change the active plot or its callbacks', async t => {
    const page = await pageFor(t)

    await page.evaluate(() => renderPlot({ label: 'discarded', suspend: true, args: { width: 700 } }))
    await page.waitForFunction(() => stats.renders.includes('discarded'))
    assert.equal(await page.locator('canvas').first().evaluate(el => el.width), 600)
    assert.equal(await page.evaluate(() => stats.formatted.discarded ?? 0), 0)
    await center(page, 'wheel', { ctrlKey: true, deltaY: -120 })
    await page.waitForFunction(() => stats.reports.length > 0)
    assert.deepEqual(await page.evaluate(() => [...new Set(stats.reports.map(item => item.label))]), ['committed'])
    await page.evaluate(() => renderPlot({ label: 'replacement', args: { width: 450 } }))
    await page.waitForFunction(() => stats.formatted.replacement > 0 && document.querySelector('canvas').width === 450)
    assert.equal(await page.evaluate(() => stats.formatted.discarded ?? 0), 0)
})

test('hydrates the server-rendered shared component', async t => {
    const page = await pageFor(t, true)
    assert.equal(await page.locator('a-plot-surface').count(), 1)
    assert.deepEqual(await page.evaluate(() => stats.errors), [])
})

test('invalid initial configuration can recover on a later committed update', async t => {
    const page = await pageFor(t)

    await page.evaluate(() => {
        unmountPlot()
        renderPlot({ args: { series: null } })
    })
    await page.waitForFunction(() => stats.errors.includes('template'))
    await page.evaluate(() => renderPlot({ label: 'recovered' }))
    await page.waitForFunction(() => stats.formatted.recovered > 0)
    assert.equal(await page.locator('canvas').first().evaluate(el => el.width), 600)
})

for (const renderer of ['react', 'preact']) {
    test(`Anta Plot forwards object updates and delegates cleanup (${renderer})`, async t => {
        const page = await pageFor(t)
        await page.evaluate(renderer => { unmountPlot(); renderAntaPlot(220, renderer) }, renderer)
        await page.waitForFunction(() => stats.formatted.anta > 0 && document.querySelector('canvas')?.height === 220)
        assert.equal(await page.evaluate(() => {
            window.originalAntaPlot = document.querySelector('.anta-plot')
            return originalAntaPlot.className === 'anta-plot'
        }), true)

        await page.evaluate(renderer => renderAntaPlot(260, renderer), renderer)
        await page.waitForFunction(() => document.querySelector('canvas')?.height === 260)
        assert.equal(await page.evaluate(() => originalAntaPlot === document.querySelector('.anta-plot')), true)

        await page.evaluate(() => unmountPlot())
        await page.waitForTimeout(150)
        const draws = await page.evaluate(() => stats.formatted.anta)
        await page.setViewportSize({ width: 900, height: 700 })
        await page.waitForTimeout(150)
        assert.equal(await page.evaluate(() => stats.formatted.anta), draws)
        assert.equal(await page.locator('.anta-plot').count(), 0)

        await page.evaluate(renderer => renderAntaPlot(220, renderer), renderer)
        await page.waitForFunction(() => document.querySelector('canvas')?.height === 220)
        assert.equal(await page.evaluate(() => originalAntaPlot !== document.querySelector('.anta-plot')), true)
    })
}

for (const renderer of ['react', 'preact']) {
    test(`Anta tooltip content stays declarative, follows, and clears (${renderer})`, async t => {
        const page = await pageFor(t)
        await page.mouse.move(900, 700)
        await page.evaluate(renderer => { unmountPlot(); renderAntaPlot(220, renderer, true) }, renderer)
        await page.waitForFunction(() => document.querySelector('.anta-plot canvas'))
        await page.waitForFunction(() => document.querySelector('canvas')?.height === 220)
        await page.waitForFunction(() => document.querySelector('.anta-plot > a-tooltip')?.listening)
        const capture = await page.locator('a-capture').boundingBox()
        await page.mouse.move(capture.x + capture.width / 2, capture.y + capture.height / 2)
        const tooltip = page.locator('.anta-plot > a-tooltip')
        await page.waitForFunction(() => document.querySelector('.anta-plot > a-tooltip')?.textContent.includes('point'))
        assert.equal(await tooltip.locator('hr').count(), 1)
        assert.match(await tooltip.textContent(), renderer === 'react' ? /provided:Anta point/ : /Custom point/)
        assert.equal(await page.locator('a-capture > a-tooltip').count(), 0)
        assert.equal(await tooltip.evaluate(tip => tip.hasAttribute('follow')), true)
        await page.waitForFunction(() => document.querySelector('.anta-plot > a-tooltip')?.shadowRoot?.querySelector(':popover-open'))

        const contentSelector = renderer === 'react' ? '[data-tooltip]' : '[data-anta-tooltip]'
        await center(page, 'mousemove', {}, contentSelector)
        await center(page, 'click', {}, contentSelector)
        assert.equal(await page.evaluate(() => stats.selected), 1)

        // Entering a margin clears renderer-owned content without moving its DOM nodes.
        await page.mouse.move(1, 1)
        await page.waitForFunction(() => document.querySelector('.anta-plot > a-tooltip')?.textContent === '')
        await page.mouse.move(capture.x + capture.width / 2, capture.y + capture.height / 2)
        await page.waitForFunction(() => document.querySelector('.anta-plot > a-tooltip')?.textContent.includes('point'))
        await page.evaluate(() => unmountPlot())
        assert.equal(await page.locator('a-tooltip').count(), 0)
        if (renderer === 'react') {
            assert.equal(await page.evaluate(() => stats.mounted === stats.unmounted), true)
        }
    })
}

test('rejected arguments retain wrapper dimensions and valid updates can remove pins', async t => {
    const page = await pageFor(t)
    await page.evaluate(() => renderPlot({ args: { width: 420, height: 260 } }))
    await page.waitForFunction(() => document.querySelector('canvas').width === 420)

    await page.evaluate(() => renderPlot({ args: { width: 200, height: 180, series: null } }))
    await page.waitForFunction(() => stats.errors.includes('template'))
    assert.deepEqual(await page.locator('[data-plot]').evaluate(el => [el.style.width, el.style.height]),
        ['420px', '260px'])
    assert.equal(await page.locator('canvas').first().evaluate(el => el.width), 420)

    await page.evaluate(() => renderPlot())
    await page.waitForFunction(() => document.querySelector('canvas').width === 600)
    assert.deepEqual(await page.locator('[data-plot]').evaluate(el => [el.style.width, el.style.height]),
        ['100%', '100%'])
})

for (const offscreen of [false, true]) {
    test(`font drawing and measurement share full canvas state (${offscreen ? 'offscreen' : 'DOM'})`, async t => {
        const page = await pageFor(t)
        const result = await page.evaluate(offscreen => {
            const { draw, new_plot_template, compose_plot } = window.fontRendering
            const canvas = offscreen ? new OffscreenCanvas(600, 300) : document.createElement('canvas')
            canvas.width = 600
            canvas.height = 300
            const ctx = canvas.getContext('2d')
            const keys = ['font', 'fillStyle', 'fontKerning', 'fontStretch', 'letterSpacing', 'wordSpacing', 'fontVariantCaps', 'textRendering']
            const snapshot = () => Object.fromEntries(keys.map(key => [key, ctx[key]]))
            ctx.font = '9px serif'
            ctx.letterSpacing = '1px'
            ctx.wordSpacing = '2px'
            const before = snapshot()
            const drawn = [], measured = []
            const fillText = ctx.fillText.bind(ctx), measureText = ctx.measureText.bind(ctx)
            ctx.fillText = (text, x, y) => { drawn.push({ text, x, y, width: measureText(text).width, ...snapshot() }); fillText(text, x, y) }
            ctx.measureText = text => { measured.push({ text, width: measureText(text).width, ...snapshot() }); return measureText(text) }
            const args = {
                series: [], title: { text: 'Title', font: { size: 22, italic: false, letter_spacing: 0 } },
                font: { family: 'serif', size: 16, weight: 600, italic: true, condensed: true,
                    caps: true, letter_spacing: 3, word_spacing: 5, color: { light: '#123456', dark: '#abcdef' } },
                axis: {
                    x: { categories: ['First label', 'Second label', 'Third label'],
                        label: { text: 'X name', font: { size: 18 } },
                        tick_label: { font: { family: 'monospace', word_spacing: 0 } } },
                    y: { min: 0, max: 100, label: { text: 'Y name', position: 'top', font: { condensed: false, caps: false } } },
                },
                grid: true,
            }
            const plot = compose_plot(new_plot_template(args), 600, 300, 'dark')
            draw(ctx, plot)
            const after = snapshot()
            // Chromium can return empty spacing strings after save/reapply while keeping the correct
            // spacing metrics. Compare actual widths for spacing, and the other font properties directly.
            const measuredKeys = keys.filter(key => key !== 'letterSpacing' && key !== 'wordSpacing')
            const textStateMismatches = measured.flatMap(m => drawn.filter(d => d.text === m.text).flatMap(d =>
                [...measuredKeys, 'width'].filter(key => d[key] !== m[key]).map(key => ({ text: m.text, key, measured: m[key], drawn: d[key] }))))
            // Repeated frames must not accumulate text spacing or transforms.
            drawn.length = 0
            draw(ctx, plot)
            const title = drawn.find(d => d.text === 'Title')
            const xTick = drawn.find(d => d.text === 'First label')
            const xLabel = drawn.find(d => d.text === 'X name')
            const yLabel = drawn.find(d => d.text === 'Y name')
            const secondFrameState = snapshot()
            const errorsRestore = []
            for (const failedText of ['Title', 'First label', 'Y name']) {
                ctx.fillText = (text, x, y) => {
                    if (text === failedText) throw new Error('intentional paint failure')
                    fillText(text, x, y)
                }
                let caught = false
                try { draw(ctx, plot) } catch { caught = true }
                errorsRestore.push(caught && JSON.stringify(snapshot()) === JSON.stringify(before))
            }
            ctx.fillText = fillText
            ctx.measureText = () => { throw new Error('intentional measurement failure') }
            let measureCaught = false
            try { draw(ctx, plot) } catch { measureCaught = true }
            const measurementRestored = measureCaught && JSON.stringify(snapshot()) === JSON.stringify(before)
            ctx.measureText = measureText
            const defaults = compose_plot(new_plot_template({ series: [], title: 'Default',
                axis: { x: { categories: ['Tick'], label: 'Axis' } } }), 600, 300, 'light')
            const defaultFonts = {}
            ctx.fillText = text => { defaultFonts[text] = ctx.font }
            draw(ctx, defaults)
            return { before, after, secondFrameState, errorsRestore, measurementRestored, textStateMismatches,
                title, xTick, xLabel, yLabel, defaultFonts, innerBottom: plot.inner.bottom }
        }, offscreen)
        assert.deepEqual(result.after, result.before)
        assert.deepEqual(result.secondFrameState, result.before)
        assert.deepEqual(result.errorsRestore, [true, true, true])
        assert.equal(result.measurementRestored, true)
        assert.deepEqual(result.textStateMismatches, [])
        assert.match(result.title.font, /22px serif/)
        assert.doesNotMatch(result.title.font, /italic/)
        assert.equal(result.title.letterSpacing, '0px')
        assert.equal(result.title.wordSpacing, '5px')
        assert.equal(result.title.fillStyle, '#abcdef')
        assert.ok(result.xTick.width > 0, 'the test browser must have working fonts')
        assert.match(result.xTick.font, /italic.*600.*16px monospace/)
        assert.equal(result.xTick.fontStretch, 'condensed')
        assert.equal(result.xTick.fontVariantCaps, 'all-small-caps')
        assert.equal(result.xTick.letterSpacing, '3px')
        assert.equal(result.xTick.wordSpacing, '0px')
        assert.equal(result.yLabel.fontStretch, 'normal')
        assert.equal(result.yLabel.fontVariantCaps, 'normal')
        assert.equal(result.xLabel.y, (result.innerBottom + 7 + 16 + 300) / 2)
        assert.match(result.defaultFonts.Tick, /10px monospace/)
        assert.match(result.defaultFonts.Axis, /12px sans-serif/)
        assert.match(result.defaultFonts.Default, /14px sans-serif/)
    })
}
