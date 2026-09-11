import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import React from 'react'
import { Plot } from '../dist/react.js'
import { scatter } from '../dist/index.js'

const directory = dirname(fileURLToPath(import.meta.url))
const requirePlot = createRequire(new URL('../package.json', import.meta.url))
const requireSite = createRequire(new URL('../../site/package.json', import.meta.url))
const { renderToString } = requirePlot('react-dom/server')
const { chromium } = requireSite('playwright')
let browser, server, origin
const series = [scatter({ data: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }], tooltip: true })]
const ssr = renderToString(React.createElement(React.StrictMode, null,
    React.createElement(Plot, { plotArgs: { series }, 'data-plot': true })))

before(async () => {
    const result = await build({
        entryPoints: [resolve(directory, 'react.fixture.jsx')], bundle: true, write: false,
        outfile: 'fixture.js', format: 'esm', target: 'es2022',
        jsx: 'automatic', jsxImportSource: 'react',
        tsconfigRaw: { compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'react' } },
        alias: {
            react: dirname(requirePlot.resolve('react/package.json')),
            'react-dom': dirname(requirePlot.resolve('react-dom/package.json')),
        },
    })
    const assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/fixture.css' : '/fixture.js', file.text]))
    // Catch missing package layout CSS before any browser assertions.
    assert.match(assets.get('/fixture.css'), /a-plot-surface\s*>\s*canvas\s*\{[^}]*position:\s*absolute/s)
    server = createServer((req, res) => {
        res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript'
            : req.url.endsWith('.css') ? 'text/css' : 'text/html')
        res.end(assets.get(req.url) ?? `<!doctype html><link rel="stylesheet" href="/fixture.css">
            <style>body{margin:0}#app{width:600px}</style>
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
            bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2, ...options,
        }
        const event = type === 'wheel' ? new WheelEvent(type, eventOptions) : new MouseEvent(type, eventOptions)
        document.querySelector(selector).dispatchEvent(event)
        return event.defaultPrevented
    }, { type, options, selector })
}

test('SSR does not initialize a controller or evaluate plot callbacks', () => {
    let calls = 0
    const markup = renderToString(React.createElement(Plot, {
        plotArgs: { series, axis: { x: { tick_label: { format: () => { calls++; return 'x' } } } } },
    }))
    assert.match(markup, /a-plot/)
    assert.doesNotMatch(markup, /<canvas/)
    assert.equal(calls, 0)
    assert.equal(typeof globalThis.customElements, 'undefined')
})

test('StrictMode: overlap, default/explicit sizing, pin removal, theme, DPR and remount', async t => {
    const page = await pageFor(t)
    assert.deepEqual(await page.evaluate(() => {
        const main = document.querySelector('.plot-canvas'), overlay = document.querySelector('.plot-highlight')
        const a = main.getBoundingClientRect(), b = overlay.getBoundingClientRect()
        return {
            main: [a.x, a.y, a.width, a.height], overlay: [b.x, b.y, b.width, b.height],
            height: document.querySelector('[data-plot]').getBoundingClientRect().height,
            standalone: Boolean(customElements.get('a-plot')),
        }
    }), { main: [0, 0, 600, 300], overlay: [0, 0, 600, 300], height: 300, standalone: true })

    await page.evaluate(() => renderPlot({ args: { width: 420, height: 260 } }))
    await page.waitForFunction(() => document.querySelector('canvas').width === 420)
    await page.evaluate(() => {
        document.querySelector('#app').style.width = '500px'
        renderPlot()
    })
    await page.waitForFunction(() => document.querySelector('canvas').width === 500
        && document.querySelector('canvas').height === 300)

    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForFunction(() => document.querySelector('canvas').style.filter.includes('invert'))
    assert.equal(await page.locator('a-capture').evaluate(el => el.style.filter), '')

    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 800, deviceScaleFactor: 2, mobile: false })
    await page.waitForFunction(() => document.querySelector('canvas').width === 1000
        && document.querySelector('.plot-highlight').width === 1000)
    await page.evaluate(() => document.querySelector('#app').style.display = 'none')
    await page.evaluate(() => document.querySelector('#app').style.display = '')
    await page.waitForFunction(() => document.querySelector('canvas').getBoundingClientRect().width === 500)

    await page.evaluate(() => { window.oldSurface = document.querySelector('a-plot-surface'); unmountPlot(); renderPlot() })
    await page.waitForFunction(() => document.querySelector('canvas')?.width === 1000)
    assert.equal(await page.evaluate(() => oldSurface !== document.querySelector('a-plot-surface')), true)
    assert.deepEqual(await page.evaluate(() => stats.errors), [])
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

test('hydrates the server-rendered standalone host', async t => {
    const page = await pageFor(t, true)
    assert.equal(await page.locator('a-plot-surface').count(), 1)
    assert.deepEqual(await page.evaluate(() => stats.errors), [])
})

test('invalid initial configuration can recover on a later committed update', async t => {
    const page = await pageFor(t)
    await page.evaluate(() => { unmountPlot(); renderPlot({ args: { series: null } }) })
    await page.waitForFunction(() => stats.errors.includes('template'))
    await page.evaluate(() => renderPlot({ label: 'recovered' }))
    await page.waitForFunction(() => stats.formatted.recovered > 0)
    assert.equal(await page.locator('canvas').first().evaluate(el => el.width), 600)
})
