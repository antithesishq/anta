import assert from 'node:assert/strict'
import { before, after } from 'node:test'
import { createServer } from 'node:http'
import { createRequire, Module } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname, relative, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { build } from 'esbuild'
import { componentTest as test, componentEngines, componentTier } from '../../tests/component-tier.mjs'

const repo = fileURLToPath(new URL('../..', import.meta.url))
const requireSite = createRequire(new URL('../../site/package.json', import.meta.url))
const requirePlot = createRequire(new URL('../package.json', import.meta.url))
const { chromium, firefox, webkit } = requireSite('playwright')
const engines = componentEngines([chromium, firefox, webkit])
const consumer = process.env.PLOT_CONSUMER_ROOT
const resolveDir = consumer ?? resolve(repo, 'plot')
const requireConsumer = createRequire(join(resolveDir, 'package.json'))
const compareRef = process.env.ANTA_PLOT_COMPARE_REF
const output = resolve(repo, 'tests/.test-output/plot')
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-elem 'self'; style-src-attr 'none'; worker-src 'self'; object-src 'none'"
// Playwright's WebKit screenshot path briefly inserts exactly `body {}` to sync animations.
const screenshotPolicy = policy.replace("style-src-elem 'self'", `style-src-elem 'self' 'sha256-${createHash('sha256').update('body {}').digest('base64')}'`)
const assets = new Map(), browsers = new Map(), markup = new Map()
let server, origin
const registrations = {
    surface: "import '@antadesign/plot/elements/a-plot-surface'; import '@antadesign/anta/elements/a-tooltip'",
    granular: "import '@antadesign/plot/elements/a-plot'",
    elements: "import '@antadesign/plot/elements'",
    auto: "import {plotElementReady} from '@antadesign/plot/auto'; await plotElementReady",
    browser: "import {definePlotElement} from '@antadesign/plot/browser'; await definePlotElement()",
}
const fixture = await readFile(new URL('./csp.fixture.jsx', import.meta.url), 'utf8')
const style = `body{margin:0;font:14px/20px serif}#app{width:600px;height:300px}body.dark{background:#222;color:#eee}#app.resized{width:480px;height:240px}#app.pinned{width:420px;height:260px}#app.font{font-family:monospace;font-variation-settings:'wght' 510}.probe{width:19px}.plot-tooltip-divider{color:inherit}`
function aliasFor(renderer) {
    return renderer === 'react' ? {
        react: dirname(requireConsumer.resolve('react/package.json')),
        'react-dom': dirname((consumer ? requireConsumer : requirePlot).resolve('react-dom/package.json')),
    } : {
        'react/jsx-runtime': consumer ? requireConsumer.resolve('preact/jsx-runtime') : requireSite.resolve('preact/jsx-runtime'),
        react: consumer ? requireConsumer.resolve('preact/compat') : requireSite.resolve('preact/compat'),
        'react-dom/client': consumer ? requireConsumer.resolve('preact/compat/client') : requireSite.resolve('preact/compat/client'),
        'react-dom/server': consumer ? requireConsumer.resolve('preact/compat/server') : requireSite.resolve('preact/compat/server'),
    }
}
async function compile(contents, name, renderer = 'react', baseline = false, platform = 'browser') {
    const result = await build({
        absWorkingDir: resolveDir, stdin: { contents, resolveDir, loader: 'tsx' },
        bundle: true, write: false, metafile: true, format: platform === 'node' ? 'cjs' : 'esm', platform,
        outfile: `${name}.js`, target: 'es2022', jsx: 'automatic', jsxImportSource: 'react',
        define: { 'process.env.NODE_ENV': '"production"' },
        alias: aliasFor(renderer),
        plugins: baseline ? [{ name: 'baseline', setup(b) {
            b.onResolve({ filter: /^@antadesign\/plot(?:\/|$)/ }, ({ path }) => {
                if (path.endsWith('.css')) return { path, namespace: 'baseline-css' }
                const entry = path === '@antadesign/plot' ? 'index' : path.slice('@antadesign/plot/'.length)
                return { path: resolve(repo, `plot/src/entries/${entry}.ts`) }
            })
            b.onLoad({ filter: /.*/, namespace: 'baseline-css' }, () => ({ contents: '', loader: 'css' }))
            b.onLoad({ filter: /\/plot\/src\/.*\.(ts|tsx|css)$/ }, ({ path }) => ({
                contents: execFileSync('git', ['show', `${compareRef}:${relative(repo, path)}`], { cwd: repo, encoding: 'utf8' }),
                loader: path.endsWith('.css') ? 'css' : path.endsWith('.tsx') ? 'tsx' : 'ts',
            }))
        } }] : [],
    })
    if (consumer) {
        const inputs = Object.keys(result.metafile.inputs).map(p => resolve(resolveDir, p))
        assert.ok(inputs.some(p => p.startsWith(resolve(consumer, 'node_modules/@antadesign/plot/dist') + '/')))
        assert.ok(!inputs.some(p => p.startsWith(resolve(repo, 'plot/src') + '/')))
        assert.ok(inputs.filter(p => p.includes('node_modules/@antadesign/anta/')).every(p => p.startsWith(resolve(consumer, 'node_modules'))))
    }
    for (const file of result.outputFiles) assets.set(`/${name}.${file.path.endsWith('.css') ? 'css' : 'js'}`, file.text)
    return result
}
before(async () => {
    const documentation = await readFile(consumer
        ? resolve(consumer, 'node_modules/@antadesign/anta/docs/packages/plot.md')
        : resolve(repo, 'docs/packages/plot.md'), 'utf8')
    const snippets = [...documentation.matchAll(/^```(?:ts|tsx)[^\n]*\n([\s\S]*?)^```/gm)].map(match => match[1])
    const registered = snippets.filter(code => /import ['"]@antadesign\/plot\/elements/.test(code))
    assert.ok(registered.length > 20, 'check all copyable standalone examples')
    for (const code of registered) assert.match(code, /import ['"]@antadesign\/plot\/plot.css['"]/, 'registration examples load Plot CSS')
    const jsxExample = snippets.find(code => code.includes('export function Chart()'))
    const surfaceExample = snippets.find(code => code.includes('export function Surface()'))
    const browserExample = snippets.find(code => code.includes("import { scatter, type APlotElement } from '@antadesign/plot/browser'") && code.includes('document.body.append(plot)'))
    const overviewExample = snippets.find(code => code.includes('function overviewExample()'))
    const surfaceCSS = documentation.match(/```css\n(\.custom-surface[\s\S]*?)```/)[1]
    assert.ok(jsxExample && surfaceExample && browserExample && overviewExample)
    for (const renderer of ['react', 'preact']) {
        const entries = componentTier === 'fast'
            ? renderer === 'react' ? ['surface', 'granular'] : ['surface']
            : Object.keys(registrations)
        for (const entry of entries) {
            const registration = registrations[entry]
            await compile(`${registration}; import '@antadesign/plot/plot.css'; import '@antadesign/anta/tokens.css'; ${fixture}`, `${renderer}-${entry}`, renderer)
        }
        await compile(`${registrations.surface}; import '@antadesign/plot/plot.css'; ${fixture}`, `${renderer}-tokenless`, renderer)
        const ssr = await compile(`import React from 'react';import {renderToString} from 'react-dom/server';import {Plot} from '@antadesign/plot';export const render=props=>renderToString(React.createElement(Plot,{plotArgs:{series:[]},...props}));`, `ssr-${renderer}`, renderer, false, 'node')
        const module = new Module(resolve(repo, `plot/tests/ssr-${renderer}.cjs`))
        module._compile(ssr.outputFiles[0].text, module.id)
        markup.set(renderer, module.exports.render())
        markup.set(`${renderer}-pins`, module.exports.render({ plotArgs: { series: [], width: 420, height: 260 } }))
        markup.set(`${renderer}-style`, module.exports.render({ style: { width: 420, height: 260, backgroundColor: 'rgb(1, 2, 3)' } }))
        assert.doesNotMatch(markup.get(renderer), /style=/, 'default SSR emits no style attributes')
        assert.doesNotMatch(markup.get(`${renderer}-pins`), /style=/, 'SSR pins wait for commit')
        assert.doesNotMatch(markup.get(`${renderer}-style`), /style=/, 'consumer styles wait for commit')
        if (componentTier === 'slow') {
            for (const [kind, code, component] of [['jsx', jsxExample, 'Chart'], ['surface', surfaceExample, 'Surface']]) {
                const name = `${renderer}-docs-${kind}`
                await compile(`import React from 'react'; import {createRoot} from 'react-dom/client'; ${code}; createRoot(document.querySelector('#app')).render(React.createElement(${component}));`, name, renderer)
                if (kind === 'surface') assets.set(`/${name}.css`, assets.get(`/${name}.css`) + surfaceCSS)
            }
            if (renderer === 'react') for (const [kind, code] of [['browser', browserExample], ['overview', overviewExample]]) {
                await compile(code, `${renderer}-docs-${kind}`, renderer)
            }
        }
        if (compareRef && !consumer) await compile(`${registrations.granular}; import '@antadesign/anta/tokens.css'; ${fixture}`, `${renderer}-original`, renderer, true)
    }
    await compile(`${registrations.surface}; ${fixture}`, 'react-unstyled')
    await compile(`${registrations.granular}; import '@antadesign/plot/plot.css'; ${fixture}`, 'react-tokenless-browser')
    assets.set('/site.css', await readFile(resolve(repo, 'site/src/styles/base.css'), 'utf8'))
    assets.set('/boot.js', `window.violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));`)
    assets.set('/fixture.css', style)
    assets.set('/worker.js', `let canvases;onmessage=({data})=>{if(data.canvas){canvases=data;const ctx=data.canvas.getContext('2d');const hi=data.highlight.getContext('2d');data.canvas.width=900;data.highlight.width=900;ctx.fillRect(0,0,20,20);hi.fillRect(0,0,10,10)}postMessage([canvases.canvas.width,canvases.highlight.width]);}`)
    server = createServer((req, res) => {
        const url = new URL(req.url, 'http://local')
        if (!url.pathname.includes('original')) res.setHeader('Content-Security-Policy', url.searchParams.has('screenshot') ? screenshotPolicy : policy)
        res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.png') ? 'image/png' : 'text/html')
        if (assets.has(url.pathname)) return res.end(assets.get(url.pathname))
        const name = url.pathname.slice(1) || 'react-surface'
        const renderer = name.split('-')[0]
        res.end(`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css">${url.searchParams.has('site') ? '<link rel="stylesheet" href="/site.css">' : ''}<link rel="stylesheet" href="/${name}.css"><script src="/boot.js"></script><div id="app">${url.searchParams.has('ssr') ? markup.get(`${renderer}-${url.searchParams.get('ssr')}`) : url.searchParams.get('kind') === 'hydrate' ? markup.get(renderer) : ''}</div><script type="module" src="/${name}.js"></script>`)
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    origin = `http://127.0.0.1:${server.address().port}`
    for (const engine of engines) browsers.set(engine.name(), await engine.launch({ headless: true, ...(engine === chromium ? { channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined } : {}) }))
    console.log('Plot CSP browsers:', Object.fromEntries([...browsers].map(([name, browser]) => [name, browser.version()])))
})
after(async () => {
    await Promise.all([...browsers.values()].map(browser => browser.close()))
    if (server) await new Promise(resolve => server.close(resolve))
})
async function pageFor(t, engine, renderer = 'react', entry = 'surface', kind = 'jsx', { baseline = false, audit = true, screenshot = false, site = false } = {}) {
    const context = await browsers.get(engine.name()).newContext({ viewport: { width: 900, height: 700 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    t.after(async () => { try { assert.deepEqual(errors, []); if (audit && !page.isClosed()) assert.deepEqual(await page.evaluate(() => violations), []) } finally { await context.close() } })
    const response = await page.goto(`${origin}/${renderer}-${baseline ? 'original' : entry}?kind=${kind}${screenshot ? '&screenshot' : ''}${site ? '&site' : ''}`)
    if (!baseline) assert.equal(response.headers()['content-security-policy'], screenshot ? screenshotPolicy : policy)
    await page.waitForFunction(() => typeof mount === 'function')
    await page.evaluate(() => mount())
    await page.waitForFunction(kind => {
        const surface = document.querySelector('a-plot-surface')
        return kind === 'surface' ? surface?.canvas.isConnected : surface?.canvas.getBoundingClientRect().width === 600 && surface.capture.style.display !== 'none'
    }, kind)
    await page.waitForTimeout(100)
    return page
}
async function geometry(page) {
    return page.evaluate(() => {
        const surface = document.querySelector('a-plot-surface')
        const box = node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] }
        const css = node => { const s = getComputedStyle(node); return [s.position, s.display, s.pointerEvents, s.fontFamily, s.fontVariationSettings] }
        return { surface: box(surface), canvas: box(surface.canvas), highlight: box(surface.highlight), capture: box(surface.capture), canvasCSS: css(surface.canvas), anchor: box(surface.querySelector('[role=group]')), font: getComputedStyle(surface).fontFamily }
    })
}
async function center(page) {
    const rect = await page.locator('.plot-canvas').boundingBox()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}
async function hover(page) {
    const point = await center(page)
    await page.mouse.move(point.x, point.y)
    await page.waitForFunction(() => document.querySelector('a-tooltip')?.textContent.includes('Custom point'))
    await page.mouse.move(point.x + 1, point.y + 1)
    await page.waitForFunction(() => document.querySelector('a-tooltip')?.shadowRoot.querySelector(':popover-open'))
    return point
}
for (const engine of engines) {
    const name = engine.name()
    test.fast(`${name}: optional Anta tokens preserve selection, tooltip, and keyboard menu colors`, async t => {
        for (const [renderer, entry, kind] of [['react', 'tokenless', 'jsx'], ['preact', 'tokenless', 'jsx'], ['react', 'tokenless-browser', 'standalone']]) {
            const page = await pageFor(t, engine, renderer, entry, kind)
            for (const scheme of ['light', 'dark']) {
                await page.evaluate(scheme => {
                    document.body.style.colorScheme = scheme
                    document.body.style.backgroundColor = 'Canvas'
                    document.body.style.color = 'CanvasText'
                }, scheme)
                assert.equal(await page.locator('a-plot-surface').evaluate(el => getComputedStyle(el).getPropertyValue('--text-1-brand')), '')
                assert.deepEqual(await page.locator('.plot-zoom-rectangle').evaluate(el => {
                    const css = getComputedStyle(el)
                    const probe = document.createElement('div')
                    probe.style.backgroundColor = 'color-mix(in oklch, #7460d7 12%, transparent)'
                    document.body.append(probe)
                    const fill = getComputedStyle(probe).backgroundColor
                    probe.remove()
                    return [css.borderColor, css.borderWidth, css.backgroundColor === fill]
                }), ['rgb(116, 96, 215)', '1px', true])
                await hover(page)
                assert.equal(await page.locator('a-tooltip').evaluate(el => {
                    const css = getComputedStyle(el.shadowRoot.querySelector('[part=bubble]'))
                    return css.backgroundColor !== 'rgba(0, 0, 0, 0)' && css.color !== css.backgroundColor && css.boxShadow !== 'none'
                }), true, 'tooltip has a contrasting background, text, and shadow without tokens')
                await page.mouse.move(850, 650)
                await page.locator('[role=group]').focus()
                await page.keyboard.press('Shift+F10')
                await page.waitForFunction(() => document.querySelector('a-menu')?.isOpen)
                assert.deepEqual(await page.evaluate(() => {
                    const menu = document.querySelector('a-menu')
                    const css = getComputedStyle(menu.shadowRoot.querySelector('[part=menu]'))
                    const focused = getComputedStyle(document.activeElement)
                    return [css.backgroundColor !== 'rgba(0, 0, 0, 0)' && css.color !== css.backgroundColor, focused.outlineStyle, focused.outlineWidth, focused.outlineColor]
                }), [true, 'solid', '1px', 'rgb(116, 96, 215)'])
                await page.keyboard.press('Escape')
            }
            // Ancestor tokens still take precedence over the fixed fallback values.
            await page.locator('#app').evaluate(el => {
                el.style.setProperty('--border-3-brand', 'rgb(10, 20, 30)')
                el.style.setProperty('--text-1-brand', 'rgb(40, 50, 60)')
                el.style.setProperty('--focus-ring', 'rgb(70, 80, 90)')
            })
            assert.equal(await page.locator('.plot-zoom-rectangle').evaluate(el => getComputedStyle(el).borderColor), 'rgb(10, 20, 30)')
            assert.equal(await page.locator('.plot-zoom-rectangle').evaluate(el => {
                const css = getComputedStyle(el)
                const probe = document.createElement('div')
                probe.style.backgroundColor = 'color-mix(in oklch, rgb(40, 50, 60) 12%, transparent)'
                document.body.append(probe)
                const fill = getComputedStyle(probe).backgroundColor
                probe.remove()
                return css.backgroundColor === fill
            }), true)
            await page.locator('[role=group]').focus()
            await page.keyboard.press('Shift+F10')
            await page.waitForFunction(() => document.querySelector('a-menu')?.isOpen)
            assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineColor), 'rgb(70, 80, 90)')
            await page.keyboard.press('Escape')
        }
    })
    test.fast(`${name}: HTTP CSP rejects parsed attributes and style elements, permits direct CSSOM geometry`, async t => {
        const page = await pageFor(t, engine, 'react', 'surface', 'surface', { audit: false })
        assert.deepEqual(await page.evaluate(() => {
            const parsed = document.createElement('div'); parsed.className = 'probe'; parsed.setAttribute('style', 'width:77px'); document.body.append(parsed)
            const inline = document.createElement('style'); inline.textContent = '.probe{width:88px}'; document.head.append(inline)
            const blockedWidth = getComputedStyle(parsed).width
            parsed.style.width = '31px'; const direct = getComputedStyle(parsed).width
            parsed.style.setProperty('width', '42px')
            return [blockedWidth, direct, getComputedStyle(parsed).width]
        }), ['19px', '31px', '42px'])
        await page.waitForFunction(() => violations.length === 2)
        assert.deepEqual(await page.evaluate(() => violations.map(e => e.directive).sort()), ['style-src-attr', 'style-src-elem'])
    })
    test.fast(`${name}: site prose styles preserve tooltip dividers and empty tooltip visibility`, async t => {
        for (const [entry, kind] of [['surface', 'jsx'], ['granular', 'standalone']]) {
            const page = await pageFor(t, engine, 'react', entry, kind, {site: true})
            if (kind === 'jsx') assert.equal(await page.locator('a-tooltip').evaluate(el => getComputedStyle(el).display), 'none')
            await hover(page)
            assert.deepEqual(await page.locator('a-tooltip hr').evaluate(el => {
                const css = getComputedStyle(el); return [css.marginTop, css.marginBottom, css.borderTopWidth]
            }), ['5px', '4px', '1px'])
            assert.equal(await page.evaluate(() => {
                const hr = document.createElement('hr'); document.body.append(hr)
                return getComputedStyle(hr).marginBottom === `${parseFloat(getComputedStyle(hr).fontSize) * 1.5}px`
            }), true)
            await page.mouse.move(850, 650)
            if (kind === 'jsx') await page.waitForFunction(() => getComputedStyle(document.querySelector('a-tooltip')).display === 'none')
        }
    })
    test.fast(`${name}: capture stays hidden before presentation without the Plot stylesheet`, async t => {
        const page = await pageFor(t, engine, 'react', 'unstyled', 'surface')
        assert.equal(await page.locator('a-capture').evaluate(el => getComputedStyle(el).display), 'none')
        assert.deepEqual(await page.evaluate(() => {
            const s = document.querySelector('a-plot-surface')
            s.setAttribute('presentation', JSON.stringify({width:600,height:300,inner:{left:40,top:40,right:560,bottom:260},menu:{enabled:false,zoom_in:false,zoom_out:false,reset:false}}))
            const shown = getComputedStyle(s.capture).display
            s.removeAttribute('presentation')
            const hidden = getComputedStyle(s.capture).display
            let moves = 0; s.addEventListener('plotmove', () => moves++)
            s.capture.dispatchEvent(new MouseEvent('mousemove', {bubbles:true,clientX:100,clientY:100}))
            return [shown, hidden, moves]
        }), ['block', 'none', 0])
    })
    for (const [renderer, kind] of [['react', 'jsx'], ['preact', 'jsx'], ['react', 'surface'], ['preact', 'surface'], ['react', 'browser'], ['react', 'overview']]) {
        test(`${name} ${renderer} ${kind}: copy the packaged Plot documentation without repairing imports`, async t => {
            const context = await browsers.get(name).newContext()
            t.after(() => context.close())
            const page = await context.newPage()
            const errors = []; page.on('pageerror', e => errors.push(e.message))
            await page.goto(`${origin}/${renderer}-docs-${kind}`)
            await page.waitForFunction(kind => {
                const surface = document.querySelector('a-plot-surface')
                return kind === 'surface' ? surface?.measurement.height === 300 : surface?.canvas.width > 0 && surface.capture.style.display !== 'none'
            }, kind)
            assert.equal(await page.locator('a-plot-surface > canvas').first().evaluate(el => getComputedStyle(el).position), 'absolute')
            assert.equal(await page.locator('a-plot-surface').first().evaluate(el => el.getBoundingClientRect().height > 0), true)
            assert.deepEqual(await page.evaluate(() => violations), [])
            assert.deepEqual(errors, [])
        })
    }
    test.fast(`${name}: hydrates pinned and consumer dimensions without parsed style attributes`, async t => {
        for (const renderer of ['react', 'preact']) for (const ssr of ['pins', 'style']) {
            const context = await browsers.get(name).newContext()
            t.after(() => context.close())
            const page = await context.newPage()
            const errors = []; page.on('pageerror', e => errors.push(e.message))
            await page.goto(`${origin}/${renderer}-surface?kind=hydrate&ssr=${ssr}`)
            await page.waitForFunction(() => typeof mount === 'function')
            assert.equal(await page.locator('#app > div').getAttribute('style'), null, 'SSR relies on external CSS')
            await page.evaluate(() => mount())
            await page.waitForFunction(() => document.querySelector('canvas')?.width === 420 && document.querySelector('canvas')?.height === 260)
            assert.deepEqual(await page.locator('#app > div').evaluate(el => [el.getBoundingClientRect().width, el.getBoundingClientRect().height]), [420, 260])
            if (ssr === 'style') assert.equal(await page.locator('#app > div').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(1, 2, 3)')
            assert.deepEqual(await page.evaluate(() => violations), [])
            assert.deepEqual(await page.evaluate(() => stats.errors), [])
            assert.deepEqual(errors, [])
        }
    })
    for (const renderer of ['react', 'preact']) {
        test.fast(`${name} ${renderer}: external layout, hydration, tooltips, highlight, selection, zoom/pan, menus, resizing, cleanup`, async t => {
            const page = await pageFor(t, engine, renderer, 'surface', 'hydrate')
            assert.equal(await page.locator('style').count(), 0)
            const initial = await geometry(page)
            assert.deepEqual(initial.canvas, [0, 0, 600, 300])
            assert.deepEqual(initial.highlight, initial.canvas)
            assert.equal(initial.canvasCSS[0], 'absolute')
            assert.deepEqual(initial.anchor, [0, 0, 600, 300])
            assert.equal(await page.evaluate(() => stats.transfers), 2)
            const point = await hover(page)
            assert.equal(await page.locator('a-tooltip hr').evaluate(el => getComputedStyle(el).borderTopWidth), '1px')
            assert.equal(await page.evaluate(() => document.querySelector('.plot-highlight').width), 600)
            // Highlights render in an OffscreenCanvas; visible pixels verify the transferred overlay.
            await page.waitForFunction(() => {
                const source = document.querySelector('.plot-highlight')
                const probe = document.createElement('canvas'); probe.width = source.width; probe.height = source.height
                const ctx = probe.getContext('2d'); ctx.drawImage(source, 0, 0)
                return ctx.getImageData(0, 0, probe.width, probe.height).data.some((v, i) => i % 4 === 3 && v > 0)
            })
            await page.mouse.click(point.x, point.y)
            assert.equal(await page.evaluate(() => stats.selected), 1)
            await page.keyboard.down('Control')
            await page.mouse.move(point.x - 80, point.y - 50)
            await page.mouse.down()
            await page.mouse.move(point.x + 80, point.y + 50, { steps: 5 })
            assert.deepEqual(await page.locator('.plot-zoom-rectangle').evaluate(el => {
                const s = getComputedStyle(el); return [el.hidden, s.position, s.pointerEvents, s.boxSizing, Math.round(el.getBoundingClientRect().width)]
            }), [false, 'absolute', 'none', 'border-box', 160])
            await page.mouse.up(); await page.keyboard.up('Control')
            await page.waitForFunction(() => stats.reports.length > 0)
            assert.equal(await page.locator('.plot-zoom-rectangle').evaluate(el => el.hidden), true)
            const reports = await page.evaluate(() => stats.reports.length)
            await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(point.x + 25, point.y + 15, { steps: 4 }); await page.mouse.up()
            await page.waitForFunction(n => stats.reports.length > n, reports)
            await page.locator('[role=group]').focus(); await page.keyboard.press('Shift+F10')
            await page.waitForFunction(() => document.querySelector('a-menu').isOpen)
            await page.keyboard.press('Escape')
            assert.equal(await page.locator('[role=group]').evaluate(el => el === document.activeElement), true)
            await page.mouse.click(point.x, point.y, { button: 'right' })
            await page.locator('[data-zoom-action=reset]').click()
            await page.waitForFunction(() => document.querySelector('[data-zoom-action=reset]').hasAttribute('disabled'))
            await page.mouse.move(point.x, point.y); await page.mouse.wheel(0, -100)
            await page.waitForFunction(() => !document.querySelector('[data-zoom-action=reset]').hasAttribute('disabled'))
            await page.evaluate(() => document.querySelector('#app').className = 'resized font')
            await page.waitForFunction(() => document.querySelector('.plot-canvas').getBoundingClientRect().width === 480)
            await page.evaluate(() => { document.body.classList.add('dark'); update({ width: 420, height: 260 }) })
            await page.waitForFunction(() => document.querySelector('.plot-canvas').getBoundingClientRect().width === 420 && document.querySelector('.plot-canvas').style.filter.includes('invert'))
            assert.equal(await page.locator('a-plot-surface').evaluate(el => getComputedStyle(el).fontFamily), 'monospace')
            await page.evaluate(() => update({ width: undefined, height: undefined }))
            await page.waitForFunction(() => document.querySelector('.plot-canvas').getBoundingClientRect().width === 480)
            assert.equal(await page.locator('style').count(), 0)
            assert.deepEqual(await page.evaluate(() => stats.errors), [])
            await page.evaluate(() => unmount())
            await page.setViewportSize({ width: 800, height: 600 })
            assert.equal(await page.locator('a-plot-surface').count(), 0)
        })
    }
    for (const entry of ['browser', 'auto', 'elements', 'granular']) test(`${name} ${entry}: standalone public entry layout and tooltip CSS`, { tier: entry === 'granular' ? 'fast' : 'slow' }, async t => {
        const page = await pageFor(t, engine, 'react', entry, 'standalone')
        assert.deepEqual((await geometry(page)).canvas, [0, 0, 600, 300])
        await hover(page)
        assert.equal(await page.locator('a-tooltip hr').evaluate(el => getComputedStyle(el).borderTopWidth), '1px')
        assert.equal(await page.locator('style').count(), 0)
        await page.evaluate(() => update({ width: 420, height: 260 }))
        await page.waitForFunction(() => document.querySelector('a-plot').getBoundingClientRect().height === 260)
        await page.evaluate(() => update({ width: undefined, height: undefined }))
        await page.waitForFunction(() => document.querySelector('a-plot').getBoundingClientRect().height === 300)
    })
    test.fast(`${name}: canvas ownership rejects retries and main drawing preserves DPR`, async t => {
        const page = await pageFor(t, engine, 'react', 'surface', 'surface')
        assert.deepEqual(await page.evaluate(() => {
            const rejects = fn => { try { fn(); return false } catch { return true } }
            const main = document.createElement('a-plot-surface')
            main.prepareCanvas(200, 100, 2)
            const partial = document.createElement('a-plot-surface')
            partial.highlight.getContext('2d')
            const worker = document.createElement('a-plot-surface')
            worker.transferCanvases()
            return {
                backing: [main.canvas.width, main.canvas.height], css: [main.canvas.style.width, main.canvas.style.height],
                mainTransfer: rejects(() => main.transferCanvases()),
                partial: rejects(() => partial.transferCanvases()), partialRetry: rejects(() => partial.transferCanvases()),
                secondTransfer: rejects(() => worker.transferCanvases()), mainAfterTransfer: rejects(() => worker.prepareCanvas(200, 100, 1)),
            }
        }), {backing:[400,200],css:['200px','100px'],mainTransfer:true,partial:true,partialRetry:true,secondTransfer:true,mainAfterTransfer:true})
    })
    test.fast(`${name}: PlotSurface geometry, canvas ownership, real worker, reconnect and document adoption`, async t => {
        const page = await pageFor(t, engine, 'react', 'surface', 'surface')
        const result = await page.evaluate(async () => {
            const surface = document.querySelector('a-plot-surface')
            const presentation = { width: 600, height: 300, inner: { left: 50, top: 20, right: 560, bottom: 250 }, menu: { enabled: true, zoom_in: true, zoom_out: true, reset: true } }
            surface.present(presentation)
            const r = surface.capture.getBoundingClientRect()
            const canvas = surface.canvas, highlight = surface.highlight
            const transfer = surface.transferCanvases()
            const worker = new Worker('/worker.js')
            let sizes, backing
            try {
                sizes = await new Promise((resolve, reject) => { worker.onmessage = e => resolve(e.data); worker.onerror = reject; worker.postMessage(transfer, [transfer.canvas, transfer.highlight]) })
                surface.present(presentation)
                backing = await new Promise((resolve, reject) => { worker.onmessage = e => resolve(e.data); worker.onerror = reject; worker.postMessage({}) })
            } finally { worker.terminate() }
            let ownershipRetained = false
            try { surface.prepareCanvas(600, 300, 1) } catch { ownershipRetained = true }
            surface.remove(); document.querySelector('#app').append(surface)
            return { capture: [r.x, r.y, r.width, r.height], sizes, backing, same: surface.canvas === canvas && surface.highlight === highlight, ownershipRetained }
        })
        assert.deepEqual(result, { capture: [50, 20, 510, 230], sizes: [900, 900], backing: [900, 900], same: true, ownershipRetained: true })
        const attached = page.waitForEvent('frameattached')
        await page.evaluate(() => {
            window.oldSurface = document.querySelector('a-plot-surface')
            window.oldCanvas = oldSurface.canvas
            window.adoptedMeasures = 0
            oldSurface.addEventListener('measurechange', () => adoptedMeasures++)
            const frame = document.createElement('iframe'); frame.src = '/react-surface?kind=empty'; document.body.append(frame)
        })
        const frame = await attached
        await frame.waitForFunction(() => typeof mount === 'function')
        await page.evaluate(() => {
            const doc = document.querySelector('iframe').contentDocument
            doc.querySelector('#app').className = 'resized'
            doc.querySelector('#app').append(doc.adoptNode(oldSurface))
        })
        await page.waitForFunction(() => adoptedMeasures > 0)
        assert.deepEqual(await frame.locator('a-plot-surface').evaluate(el => [getComputedStyle(el.canvas).position, el.measurement.width, el.querySelectorAll('style').length]), ['absolute', 480, 0])
        assert.equal(await page.evaluate(() => oldSurface.canvas === oldCanvas), true)
        assert.deepEqual(await frame.evaluate(() => violations), [])
        await page.evaluate(() => document.querySelector('iframe').remove())
    })
    if (compareRef && !consumer) for (const renderer of ['react', 'preact']) for (const kind of ['jsx', 'standalone']) for (const theme of ['light', 'dark']) test(`${name} ${renderer} ${kind} ${theme}: compare starting appearance and interaction`, async t => {
        await mkdir(output, { recursive: true })
        const metrics = [], screenshots = []
        for (const baseline of [true, false]) {
            const page = await pageFor(t, engine, renderer, 'granular', kind, { baseline, audit: !baseline, screenshot: true })
            if (theme === 'dark') {
                await page.evaluate(() => document.body.classList.add('dark'))
                await page.waitForFunction(() => document.querySelector('.plot-canvas').style.filter.includes('invert'))
            }
            metrics.push(await geometry(page))
            const point = await hover(page)
            await page.mouse.click(point.x, point.y)
            assert.equal(await page.evaluate(() => stats.selected), 1)
            await page.waitForTimeout(100) // Settle cursor-follow positioning after the click's mouse move.
            const name = `${engine.name()}-${renderer}-${kind}-${theme}-${baseline ? 'original' : 'current'}`
            screenshots.push(await page.screenshot({ path: join(output, `${name}.png`) }))
            await page.keyboard.down('Control'); await page.mouse.wheel(0, -120); await page.keyboard.up('Control')
            await page.waitForFunction(() => stats.reports.length > 0)
            metrics.at(-1).zoom = await page.evaluate(() => stats.reports.at(-1))
            if (!baseline) {
                for (const [index, buffer] of screenshots.entries()) assets.set(`/comparison-${index}.png`, buffer)
                const pixels = await page.evaluate(async () => {
                    const images = await Promise.all([0, 1].map(index => new Promise((resolve, reject) => {
                        const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = `/comparison-${index}.png`
                    })))
                    const canvas = document.createElement('canvas'); canvas.width = images[0].width; canvas.height = images[0].height
                    const ctx = canvas.getContext('2d')
                    const data = images.map(image => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0); return ctx.getImageData(0, 0, canvas.width, canvas.height).data })
                    let changed = 0
                    for (let i = 0; i < data[0].length; i += 4) if ([0, 1, 2, 3].some(k => Math.abs(data[0][i + k] - data[1][i + k]) > 2)) changed++
                    return { changed, total: canvas.width * canvas.height }
                })
                await writeFile(join(output, `${engine.name()}-${renderer}-${kind}-${theme}-pixels.json`), JSON.stringify(pixels))
                assert.ok(pixels.changed / pixels.total < 0.002, JSON.stringify(pixels))
            }
            if (!baseline) assert.deepEqual(await page.evaluate(() => violations), [])
            await page.close()
        }
        assert.deepEqual(metrics[1], metrics[0])
        await writeFile(join(output, `${name}-${renderer}-${kind}-${theme}.json`), JSON.stringify(metrics, null, 2))
        assert.ok(screenshots.every(buffer => buffer.length > 1000))
    })
}
