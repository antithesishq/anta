import assert from 'node:assert/strict'
import { after, before } from 'node:test'
import { componentTest as test, componentEngines } from './component-tier.mjs'
import { createServer } from 'node:http'
import { createRequire, Module } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const requirePlot = createRequire(new URL('../plot/package.json', import.meta.url))
const requireRenderer = createRequire(requireSite.resolve('@astrojs/preact'))
const consumerRoot = process.env.ANTA_EXPANDER_CONSUMER_ROOT ? resolve(process.env.ANTA_EXPANDER_CONSUMER_ROOT) : undefined
const resolveDir = consumerRoot ?? process.cwd()
const nodePaths = consumerRoot ? [resolve(consumerRoot, 'node_modules')] : [resolve('node_modules'), resolve('site/node_modules')]
const { chromium, firefox, webkit } = requireSite('playwright')
// These engines do not substitute for minimum shipping-browser validation.
// The existing grid and indicator motion remain; clipping lasts through expansion.
const engines = componentEngines([chromium, firefox, webkit])
const source = process.env.ANTA_EXPANDER_PACKAGE_ROOT ? resolve(process.env.ANTA_EXPANDER_PACKAGE_ROOT, 'dist') : resolve('src')
const jsxAlias = consumerRoot ? {} : { '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime') }
const preactCompat = consumerRoot ? 'preact/compat' : requireSite.resolve('preact/compat')
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'"
const browsers = new Map()
const initialProps = { title: 'Release details.', level: 2, 'data-owner': 'app' }
const factory = `const node = props => React.createElement(Expander, {
  actions: React.createElement(Button, {size: 'small', label: 'Download'}), ...props,
}, 'children' in props ? props.children : React.createElement('a', {href: '#details'}, 'Details'))`
const componentImports = consumerRoot
  ? `import {Expander, Button} from '@antadesign/anta'`
  : `import {Expander} from '${source}/components/Expander'; import {Button} from '${source}/components/Button'`
const serverRenderers = new Map()
let server, origin

function checkInstalledInputs(result) {
  if (!consumerRoot) return
  const inputs = Object.keys(result.metafile.inputs).map(path => resolve(resolveDir, path))
  const installed = resolve(consumerRoot, 'node_modules/@antadesign/anta/dist')
  assert.ok(inputs.some(path => path.startsWith(installed + '/')), 'Build resolves the installed package')
  assert.ok(!inputs.some(path => path.startsWith(resolve('src') + '/')), 'No Anta source aliases or workspace links')
}

before(async () => {
  const assets = new Map()
  for (const mode of ['granular', 'bundle']) {
    const contents = consumerRoot
      ? mode === 'bundle'
        ? `import '@antadesign/anta/bundle'; import '@antadesign/anta/bundle.css';`
        : `import '@antadesign/anta/tokens.css'; import '@antadesign/anta/reset.css'; import '@antadesign/anta/elements/a-expander'; import '@antadesign/anta/elements/a-button'; import '@antadesign/anta/elements/a-icon';`
      : mode === 'bundle'
        ? `import '${source}/bundle'; ${process.env.ANTA_EXPANDER_PACKAGE_ROOT ? `import '${source}/bundle.css';` : ''}`
        : `import '${source}/tokens.css'; import '${source}/reset.css'; import '${source}/elements/a-expander'; import '${source}/elements/a-button'; import '${source}/elements/a-icon';`
    const result = await build({ absWorkingDir: resolveDir, stdin: { contents, resolveDir }, bundle: true, write: false, metafile: true,
      outfile: `${mode}.js`, format: 'esm', target: 'es2022',
      alias: { react: preactCompat }, nodePaths,
    })
    checkInstalledInputs(result)
    for (const file of result.outputFiles) assets.set(`/${mode}.${file.path.endsWith('.css') ? 'css' : 'js'}`, file.text)
    assert.ok(assets.has(`/${mode}.css`))
  }
  for (const framework of ['React', 'Preact']) {
    const react = framework === 'React'
    const result = await build({
      absWorkingDir: resolveDir,
      stdin: { contents: `import React from 'react'; ${componentImports}; ${react ? "import {renderToString} from 'react-dom/server'" : "import renderToString from 'preact-render-to-string'"}; ${factory}; export const render = props => renderToString(node(props));`, resolveDir },
      bundle: true, write: false, metafile: true, platform: 'node', format: 'cjs', target: 'es2022',
      jsx: 'automatic', jsxImportSource: '@antadesign/anta', nodePaths,
      alias: { ...jsxAlias, ...(react
        ? consumerRoot ? {} : { 'react-dom/server': requirePlot.resolve('react-dom/server'), react: resolve('node_modules/react') }
        : { react: preactCompat,
            ...(consumerRoot ? {} : { 'preact-render-to-string': requireRenderer.resolve('preact-render-to-string') }) }),
      },
    })
    checkInstalledInputs(result)
    const compiled = new Module(resolve(`tests/expander-${framework}-server.cjs`))
    compiled._compile(result.outputFiles[0].text, compiled.id)
    serverRenderers.set(framework, compiled.exports.render)
  }
  for (const framework of ['React', 'Preact']) {
    const react = framework === 'React'
    const result = await build({
      absWorkingDir: resolveDir,
      stdin: { contents: `
        import React from 'react'
        ${componentImports}
        ${react ? "import {createRoot, hydrateRoot} from 'react-dom/client'" : "import {render, hydrate} from 'preact'"}
        ${factory}
        ${react ? 'let root' : ''}
        window.requests = 0
        window.recoverableErrors = []
        const app = props => node({...props, onStateChange: (event, {next}) => {
          window.requests++; if (window.veto) event.preventDefault()
          if (window.acceptRequest) window.renderExpander({...window.expanderProps, open: next})
        }})
        window.renderExpander = props => {
          window.expanderProps = props
          ${react ? "root ??= createRoot(document.querySelector('#mount')); root.render(app(props))" : "render(app(props), document.querySelector('#mount'))"}
        }
        window.hydrateExpander = props => {
          window.expanderProps = props
          ${react ? "root = hydrateRoot(document.querySelector('#mount'), app(props), {onRecoverableError: error => window.recoverableErrors.push(error.message)})" : "hydrate(app(props), document.querySelector('#mount'))"}
        }
        window.renderNodeTitle = () => window.renderExpander({title: React.createElement('strong', null, 'Custom title'), actions: false, children: false})
      `, resolveDir }, bundle: true, write: false, metafile: true, outfile: `${framework}.js`, format: 'esm', target: 'es2022',
      jsx: 'automatic', jsxImportSource: '@antadesign/anta', define: { 'process.env.NODE_ENV': '"production"' },
      nodePaths,
      alias: { ...jsxAlias,
        ...(react ? consumerRoot ? {} : { 'react-dom/client': requirePlot.resolve('react-dom/client'), react: resolve('node_modules/react') } : { react: preactCompat }),
      },
    })
    checkInstalledInputs(result)
    assets.set(`/${framework}.js`, result.outputFiles.find(file => file.path.endsWith('.js')).text)
  }
  assets.set('/fixture.css', 'body {margin: 40px;} #mount {width: 360px;} a-expander-summary {box-sizing: border-box;} .wrapped > a-expander-summary {white-space: normal;} .tall-actions > a-expander-actions > button {height: 60px; width: 90px;} .fixed-round {--expander-round: 12px;} .custom-tone {--expander-tone-source: rebeccapurple;}')
  assets.set('/boot.js', `window.cspViolations=[]; document.addEventListener('securitypolicyviolation', e=>window.cspViolations.push(e.effectiveDirective));`)
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const mode = url.searchParams.get('mode') || 'granular'
    res.setHeader('Content-Security-Policy', policy)
    res.setHeader('Content-Type', `${req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html'}; charset=utf-8`)
    const props = { ...initialProps, ...(url.searchParams.has('open') ? {defaultOpen: true} : {}), ...(url.searchParams.has('controlled') ? { open: !url.searchParams.has('closed') } : url.searchParams.has('closed') ? { defaultOpen: false } : {}) }
    const render = serverRenderers.get(url.searchParams.get('ssr-framework') || 'React')
    res.end(assets.get(req.url) ?? `<!doctype html><link rel="stylesheet" href="/${mode}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><main id="mount">${url.searchParams.has('ssr') ? render(props) : ''}</main><div id="following">Following content</div>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  const chromiumOptions = process.env.ANTA_EXPANDER_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.ANTA_EXPANDER_CHROMIUM_EXECUTABLE }
    : { channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined }
  for (const engine of engines) {
    const browser = await engine.launch({ headless: true, ...(engine === chromium ? chromiumOptions : {}) })
    browsers.set(engine, browser)
    console.log(`${engine.name()}: ${browser.version()}`)
  }
})
after(async () => {
  await Promise.all([...browsers.values()].map(browser => browser.close()))
  if (server) await new Promise(resolve => server.close(resolve))
})

async function pageFor(t, engine, mode = 'granular', query = '', javaScriptEnabled = true, bypassCSP = false) {
  const page = await browsers.get(engine).newPage({ reducedMotion: 'reduce', javaScriptEnabled, bypassCSP })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const response = await page.goto(`${origin}/?mode=${mode}${query}`)
  assert.equal(response.headers()['content-security-policy'], policy)
  t.after(async () => {
    try {
      assert.deepEqual(errors, [])
      assert.deepEqual(await page.evaluate(() => window.cspViolations ?? []), [])
    } finally { await page.close() }
  })
  return page
}
const register = (page, mode = 'granular') => page.evaluate(mode => import(`/${mode}.js`), mode)
const action = '<a-button role="button" tabindex="0" size="small"><a-button-label>Download</a-button-label></a-button>'
const defaultArtwork = '<a-expander-indicator shape="chevron" aria-hidden="true" inert></a-expander-indicator>'
const markup = `${defaultArtwork}<a-expander-summary>Release details.</a-expander-summary><a-expander-actions>${action}</a-expander-actions><a-expander-details><a href="#details">Details</a></a-expander-details>`
function withIndicator(body = markup, placement = 'start', artwork = defaultArtwork) {
  const content = body.replace(defaultArtwork, '')
  return placement === 'end'
    ? content.replace('<a-expander-details', artwork + '<a-expander-details')
    : artwork + content
}
async function mount(page, content = markup, attrs = {}) {
  await page.evaluate(({content, attrs}) => {
    const expander = document.createElement('a-expander')
    for (const [name, value] of Object.entries(attrs)) expander.setAttribute(name, value)
    expander.innerHTML = content
    document.querySelector('#mount').replaceChildren(expander)
  }, {content, attrs})
}
async function geometry(page) {
  return page.locator('#mount > a-expander').evaluate(expander => {
    const rect = node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] }
    const title = expander.querySelector(':scope > a-expander-summary, :scope > a-expander-title')
    const range = document.createRange(); range.selectNodeContents(title.firstElementChild ?? title)
    const r = range.getBoundingClientRect()
    const open = expander.matches(':state(open)') || (!expander.shadowRoot &&
      (expander.getAttribute('state') === 'open' || (!expander.hasAttribute('state') && expander.getAttribute('default-state') === 'open')))
    return [rect(expander), rect(document.querySelector('#following')), [r.x,r.y,r.width,r.height],
      ...[...expander.querySelectorAll(':scope > a-expander-actions > *')].map(rect),
      ...(open ? [rect(expander.querySelector(':scope > a-expander-details'))] : [])].flat()
  })
}
const isClosed = (page, selector = '#mount > a-expander') => page.locator(selector).evaluate(n => !n.matches(':state(open)'))
async function hydrate(page, framework, props = initialProps) {
  await page.evaluate(framework => import(`/${framework}.js`), framework)
  await page.evaluate(props => {
    window.serverNodes = [...document.querySelector('#mount').querySelectorAll('*')]
    window.hydrateExpander(props)
  }, props)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  assert.deepEqual(await page.evaluate(() => window.recoverableErrors), [])
  assert.equal(await page.evaluate(() => {
    const current = [...document.querySelector('#mount').querySelectorAll('*')]
    return window.serverNodes.length === current.length && current.every((node, index) => node === window.serverNodes[index])
  }), true, 'Hydration retains the server-rendered nodes')
}
async function trackOwnership(page) {
  await page.locator('#mount > a-expander').evaluate(n => {
    window.ownerMutations = []
    new MutationObserver(records => window.ownerMutations.push(...records.map(r => r.type)))
      .observe(n, { attributes: true, childList: true, subtree: true, characterData: true })
  })
}


const button = (page, selector = '#mount > a-expander') => page.locator(`${selector} button[part="summary"]`)
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

test.fast('Expander SSR owns named regions and summary level without structural inline styles', () => {
  for (const render of serverRenderers.values()) {
    const html = render(initialProps)
    assert.match(html, /<a-expander-summary level="2"/)
    assert.match(html, /<a-expander-actions>/)
    assert.match(html, /<a-expander-details>/)
    assert.doesNotMatch(html, /style=|slot=|<a-expander level=|indicator-placement=/)
    assert.match(html, /<a-expander-indicator shape="chevron"[^>]*><\/a-expander-indicator><a-expander-summary/)
    const end = render({...initialProps, indicatorPlacement: 'end', indicator: 'plus'})
    assert.match(end, /<\/a-expander-actions><a-expander-indicator shape="plus"/)
    for (const value of [null, false, true, [], '', '   ']) assert.doesNotMatch(render({...initialProps, actions: value}), /<a-expander-actions/)
    assert.match(render({...initialProps, indicator: {closed: 'C', open: 'O'}}), /a-expander-indicator data-when="closed"/)
  }
})

for (const engine of engines) {
  for (const mode of ['granular', 'bundle']) {
    test.fast(`${engine.name()} ${mode}: content stays clipped until expansion finishes, including interrupted toggles`, async t => {
      const page = await pageFor(t, engine, mode)
      await page.emulateMedia({reducedMotion:'no-preference'})
      await mount(page)
      await register(page, mode)
      const samples = await page.locator('a-expander').evaluate(host => {
        const button = host.shadowRoot.querySelector('button')
        const region = host.shadowRoot.querySelector('[part="region"]')
        const content = host.shadowRoot.querySelector('[part="content"]')
        const animations = () => [...host.getAnimations(), ...host.shadowRoot.getAnimations()]
        const sample = () => ({height: region.getBoundingClientRect().height, overflow: getComputedStyle(content).overflow})
        const seek = time => {
          for (const animation of animations()) {
            animation.pause()
            animation.currentTime = time
          }
          return sample()
        }
        button.click()
        const start = seek(0), middle = seek(100), end = seek(200)
        for (const animation of animations()) animation.finish()
        button.click()
        const closing = seek(50)
        button.click()
        const reopening = seek(0)
        seek(250)
        const reopened = sample()
        for (const animation of animations()) animation.finish()
        button.click()
        const closed = seek(250)
        return {start, middle, end, closing, reopening, reopened, closed}
      })
      assert.equal(samples.start.overflow, 'clip')
      assert.equal(samples.start.height, 0)
      assert.equal(samples.middle.overflow, 'clip')
      assert.ok(samples.middle.height > 0 && samples.middle.height < samples.end.height)
      assert.equal(samples.end.overflow, 'visible')
      assert.equal(samples.closing.overflow, 'clip')
      assert.equal(samples.reopening.overflow, 'clip')
      assert.equal(samples.reopened.overflow, 'visible')
      assert.equal(samples.reopened.height, samples.end.height)
      assert.deepEqual(samples.closed, {height: 0, overflow: 'clip'})
      await page.emulateMedia({reducedMotion:'reduce'})
      await button(page).evaluate(n=>n.click())
      assert.equal(await page.locator('a-expander [part="content"]').evaluate(n=>getComputedStyle(n).overflow), 'visible')
      assert.equal(await page.locator('a-expander [part="region"]').evaluate(n=>n.getAnimations().length), 0)
      assert.equal(await page.locator('a-expander [part="content"]').evaluate(n=>n.getAnimations().length), 0)
      assert.equal(await page.locator('a-expander').evaluate(n=>n.getAnimations().some(a=>a.animationName==='anta-expander-unclip')), false)
    })
    test.fast(`${engine.name()} ${mode}: indicator DOM order changes placement without changing applied state or authored markup`, async t => {
      const page = await pageFor(t, engine, mode)
      await mount(page)
      await register(page, mode)
      await button(page).click()
      const move = async end => {
        const authored = await page.locator('a-expander').evaluate((host, end) => {
          const indicator = host.querySelector('a-expander-indicator')
          host.insertBefore(indicator, host.querySelector(end ? 'a-expander-details' : 'a-expander-summary'))
          return host.outerHTML
        }, end)
        await frames(page)
        assert.equal(await isClosed(page), false)
        assert.equal(await page.locator('a-expander').evaluate(n => n.outerHTML), authored)
        const positions = await page.locator('a-expander').evaluate(host => {
          const indicator = host.querySelector('a-expander-indicator').getBoundingClientRect()
          const title = host.querySelector('a-expander-summary').getBoundingClientRect()
          const actions = host.querySelector('a-expander-actions > *').getBoundingClientRect()
          return {start: indicator.right <= title.left, end: indicator.left >= actions.right}
        })
        assert.equal(end ? positions.end : positions.start, true)
        await page.locator('a-expander-actions a-button').click()
        assert.equal(await isClosed(page), false)
      }
      await move(true)
      await move(false)
      await button(page).click()
      assert.equal(await isClosed(page), true)
      assert.deepEqual(await page.locator('a-expander').evaluate(n => Object.keys(n.dataset)), [])
    })
    test.fast(`${engine.name()} ${mode}: tall actions preserve short, wrapped and rich title geometry through upgrade`, async t => {
      for (const placement of ['start', 'end']) {
        for (const title of [
          '<a-expander-summary>Short title</a-expander-summary>',
          '<a-expander-summary>A wrapped heading with enough text to use two lines.</a-expander-summary>',
          '<a-expander-title><strong>Rich title</strong></a-expander-title>',
        ]) {
          const page = await pageFor(t, engine, mode)
          await mount(page, withIndicator(`${title}<a-expander-actions><button>Download</button></a-expander-actions><a-expander-details>Details</a-expander-details>`, placement),
            {class: 'tall-actions wrapped'})
          const before = await geometry(page)
          await register(page, mode)
          assert.deepEqual(await geometry(page), before, `${placement}: ${title}`)
        }
      }
    })
    test.fast(`${engine.name()} ${mode}: initially open plus indicators show a horizontal minus at both placements`, async t => {
      for (const placement of ['start', 'end']) {
        for (const stateAttribute of ['state', 'default-state']) {
          const page = await pageFor(t, engine, mode)
          await mount(page, withIndicator(markup, placement, defaultArtwork.replace('chevron', 'plus')), {[stateAttribute]: 'open'})
          const artwork = () => page.locator('a-expander > a-expander-indicator').evaluate(node => {
            const horizontal = getComputedStyle(node, '::before')
            return {width: parseFloat(horizontal.width), height: parseFloat(horizontal.height), vertical: getComputedStyle(node, '::after').transform}
          })
          const initial = await artwork()
          assert.ok(initial.width > initial.height)
          assert.equal(initial.vertical, 'matrix(1, 0, 0, 0, 0, 0)')
          const rotation = node => {
            const value = getComputedStyle(node).transform
            const matrix = new DOMMatrixReadOnly(value === 'none' ? undefined : value)
            return [matrix.a, matrix.b, matrix.c, matrix.d]
          }
          assert.deepEqual(await page.locator('a-expander > a-expander-indicator').evaluate(rotation), [1, 0, 0, 1])
          const before = await geometry(page)
          await register(page, mode)
          assert.deepEqual(await geometry(page), before)
          assert.deepEqual(await artwork(), initial)
          assert.deepEqual(await page.locator('a-expander [part="indicator"]').evaluate(rotation), [1, 0, 0, 1])
        }
      }
    })
    test.fast(`${engine.name()} ${mode}: initial geometry, pointer and keyboard activation, actions, CSP and ownership`, async t => {
      const page = await pageFor(t, engine, mode)
      await mount(page)
      const before = await geometry(page)
      assert.equal(await page.locator('a-expander-details').isVisible(), false)
      await register(page, mode)
      assert.deepEqual(await geometry(page), before)
      assert.equal(await button(page).getAttribute('aria-expanded'), 'false')
      assert.match(await button(page).ariaSnapshot(), /button "Release details\."/)
      await trackOwnership(page)
      await page.locator('a-expander-actions a-button').click()
      assert.equal(await isClosed(page), true)
      await button(page).click()
      assert.equal(await isClosed(page), false)
      await button(page).focus()
      await page.keyboard.press('Space')
      assert.equal(await isClosed(page), true)
      await page.keyboard.press('Enter')
      assert.equal(await isClosed(page), false)
      assert.deepEqual(await page.evaluate(() => window.ownerMutations), [])
      assert.equal(await page.locator('a-expander').evaluate(n => n.shadowRoot.querySelectorAll('style').length), 0)
    })
  }
  test.fast(`${engine.name()}: cancellation, controlled rejection, restoration, handoff and reconnection`, async t => {
    const page = await pageFor(t, engine)
    await register(page)
    await mount(page)
    await page.locator('a-expander').evaluate(n => {
      n.addEventListener('statechange', e => {window.lastRequest = {next: e.detail.next, prev: e.detail.prev, bubbles: e.bubbles, composed: e.composed}; if (window.veto) e.preventDefault()})
      window.veto = true
    })
    await button(page).click()
    assert.equal(await isClosed(page), true)
    assert.deepEqual(await page.evaluate(() => window.lastRequest), {next:'open', prev:'closed', bubbles:false, composed:false})
    await page.evaluate(() => {window.veto = false})
    await button(page).click()
    await page.locator('a-expander').evaluate(n => {n.setAttribute('default-state', 'closed'); n.remove(); document.querySelector('#mount').append(n)})
    assert.equal(await isClosed(page), false)
    await page.locator('a-expander').evaluate(n => n.setAttribute('state','open'))
    await button(page).click()
    assert.equal(await isClosed(page), false)
    await page.locator('a-expander').evaluate(n => n.setAttribute('state','closed'))
    assert.equal(await isClosed(page), true)
    await page.locator('a-expander').evaluate(n => n.setAttribute('state','open'))
    assert.equal(await isClosed(page), false)
    await page.locator('a-expander').evaluate(n => n.removeAttribute('state'))
    await button(page).click()
    assert.equal(await isClosed(page), true)
    await page.locator('a-expander').evaluate(n => {n.setAttribute('state','closed'); n.addEventListener('statechange', () => n.removeAttribute('state'), {once:true})})
    await button(page).click()
    assert.equal(await isClosed(page), true, 'Controlled requests never self-apply when the listener removes state')
  })
  test.fast(`${engine.name()}: collapsed content leaves focus and accessibility; disabled header retains live actions`, async t => {
    const page = await pageFor(t, engine)
    await register(page)
    await mount(page)
    await button(page).focus()
    await page.keyboard.press('Tab')
    assert.equal(await page.locator('a-expander-actions a-button').evaluate(n => n === document.activeElement), true)
    await page.keyboard.press('Tab')
    assert.equal(await page.locator('a-expander-details a').evaluate(n => n === document.activeElement), false)
    if (engine === chromium) {
      const session = await page.context().newCDPSession(page)
      const tree = await session.send('Accessibility.getFullAXTree')
      assert.equal(tree.nodes.some(n => !n.ignored && n.role?.value === 'link' && n.name?.value === 'Details'), false)
      await session.detach()
    }
    await page.locator('a-expander').evaluate(n => {n.setAttribute('state','open'); n.setAttribute('disabled','')})
    assert.equal(await button(page).isDisabled(), true)
    assert.match(await page.locator('a-expander').ariaSnapshot(), /link "Details"/)
    await page.locator('a-expander-actions a-button').click()
    assert.equal(await isClosed(page), false)
    await page.locator('a-expander').evaluate(n => n.shadowRoot.querySelector('button').click())
    assert.equal(await isClosed(page), false)
  })
  for (const framework of ['React', 'Preact']) {
    test.fast(`${engine.name()} ${framework}: SSR/hydration retains nodes and controlled rejection/acceptance`, async t => {
      const props = {...initialProps, open: false}
      const page = await pageFor(t, engine, 'granular', `&ssr&controlled&closed&ssr-framework=${framework}`)
      const before = await geometry(page)
      await register(page)
      assert.deepEqual(await geometry(page), before)
      await hydrate(page, framework, props)
      await button(page).click()
      assert.equal(await isClosed(page), true)
      assert.equal(await page.evaluate(() => window.requests), 1)
      await page.evaluate(() => {window.acceptRequest = true})
      await button(page).click()
      await frames(page)
      assert.equal(await isClosed(page), false)
      await page.evaluate(() => window.renderExpander({...window.expanderProps, open:false}))
      await frames(page)
      assert.equal(await isClosed(page), true)
    })
  }
  test(`${engine.name()}: pre-upgrade layout covers open, rich, end, outdent and disabled regions`, async t => {
    const cases = [
      {attrs: {'default-state':'open'}, body:markup},
      {attrs: {'state':'open'}, body:withIndicator(markup, 'end')},
      {attrs: {'priority':'tertiary','outdent':'','default-state':'open'}, body:markup},
      {attrs: {'priority':'tertiary','outdent':'','default-state':'open'}, body:withIndicator(markup, 'end')},
      {attrs: {'state':'closed','default-state':'open','disabled':''}, body:markup},
      {attrs: {}, body:withIndicator(markup, 'end').replace('<a-expander-summary>Release details.</a-expander-summary>', '<a-expander-title><strong>Rich title</strong></a-expander-title>')},
      {attrs: {'state':'open'}, body:withIndicator(markup, 'end', '<a-expander-indicator data-when="closed">C</a-expander-indicator><a-expander-indicator data-when="open">O</a-expander-indicator>')},
    ]
    for (const item of cases) {
      const page = await pageFor(t,engine)
      await mount(page,item.body,item.attrs)
      const before = await geometry(page)
      await register(page)
      assert.deepEqual(await geometry(page), before, JSON.stringify(item.attrs))
    }
  })
  test(`${engine.name()}: empty regions and renderer replacements do not reserve action spacing`, async t => {
    const page = await pageFor(t, engine)
    await register(page)
    await mount(page, '<a-expander-summary>Empty</a-expander-summary><a-expander-actions></a-expander-actions><a-expander-details></a-expander-details>')
    assert.equal(await page.locator('a-expander').evaluate(n => getComputedStyle(n.shadowRoot.querySelector('[part="actions"]')).display), 'none')
    await page.locator('a-expander-actions').evaluate((n, action) => n.innerHTML = action, action)
    assert.equal(await page.locator('a-expander').evaluate(n => getComputedStyle(n.shadowRoot.querySelector('[part="actions"]')).display), 'flex')
    await page.locator('a-expander-summary').evaluate(n => {const replacement = document.createElement('a-expander-title'); replacement.innerHTML = '<strong>Replacement</strong>'; n.replaceWith(replacement)})
    await frames(page)
    assert.match(await button(page).ariaSnapshot(), /Replacement/)
    await page.locator('a-expander-actions').evaluate(n => n.remove())
    await frames(page)
    assert.equal(await page.locator('a-expander').evaluate(n => n.shadowRoot.querySelector('[part="actions"]').assignedElements().length), 0)
  })
  test.fast(`${engine.name()}: interactive title children, disabled controls, opt-out and selection do not misfire`, async t => {
    const page = await pageFor(t, engine)
    await register(page)
    await mount(page, '<a-expander-title><span id="words">Selectable title</span><a id="link" href="#">Link</a><input id="field"><a-button id="title-button" role="button" tabindex="0"><a-button-label>Action</a-button-label></a-button><span id="ignore" data-expander-ignore>Widget</span><a-button id="disabled" disabled>Disabled</a-button></a-expander-title><a-expander-details>Body</a-expander-details>')
    for (const selector of ['#link','#field','#title-button','#ignore']) {
      await page.locator(selector).click()
      assert.equal(await isClosed(page), true, selector)
    }
    await page.locator('#link').focus(); await page.keyboard.press('Enter')
    assert.equal(await isClosed(page), true)
    await page.locator('#field').focus();
    await page.keyboard.press('Space')
    assert.equal(await isClosed(page), true)
    await page.locator('#disabled').evaluate(n => n.click())
    assert.equal(await isClosed(page), false)
    await button(page).evaluate(n => n.click())
    await page.locator('#words').evaluate(n => {const range=document.createRange(); range.selectNodeContents(n); const s=document.getSelection(); s.removeAllRanges(); s.addRange(range)})
    await page.locator('#words').evaluate(n => n.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true,detail:1})))
    assert.equal(await isClosed(page), true)
    await button(page).focus(); await page.keyboard.press('Space')
    assert.equal(await isClosed(page), false, 'Keyboard activation works with a selection')
  })
  test(`${engine.name()}: nested disclosures isolate requests, typography and projection`, async t => {
    const page = await pageFor(t, engine)
    await register(page)
    await mount(page, defaultArtwork+'<a-expander-summary level="1">Outer</a-expander-summary><a-expander-details><a-expander id="inner"><a-expander-summary level="6">Inner</a-expander-summary><a-expander-actions>'+action+'</a-expander-actions><a-expander-indicator shape="plus" aria-hidden="true" inert></a-expander-indicator><a-expander-details>Nested body</a-expander-details></a-expander></a-expander-details>', {'default-state':'open'})
    await page.locator('#mount > a-expander').evaluate(n => {window.outerRequests=0; n.addEventListener('statechange',()=>window.outerRequests++)})
    assert.equal(await page.locator('#inner > a-expander-indicator').evaluate(n=>getComputedStyle(n,'::after').transform), 'matrix(1, 0, 0, 1, 0, 0)')
    await button(page, '#inner').click()
    assert.equal(await isClosed(page, '#inner'), false)
    assert.equal(await isClosed(page), false)
    assert.equal(await page.evaluate(() => window.outerRequests), 0)
    assert.equal(await page.locator('#inner > a-expander-indicator').evaluate(n=>getComputedStyle(n,'::after').transform), 'matrix(1, 0, 0, 0, 0, 0)')
    assert.equal(await page.locator('#inner > a-expander-summary').evaluate(n => getComputedStyle(n).fontSize), '13px')
  })
  test(`${engine.name()}: indicators, pairs, end placement and original geometry`, async t => {
    const page = await pageFor(t, engine)
    await register(page)
    await mount(page)
    const metrics = await page.locator('a-expander').evaluate(n => {
      const b=n.shadowRoot.querySelector('button').getBoundingClientRect(), i=n.shadowRoot.querySelector('[part="indicator"]').getBoundingClientRect(), title=n.querySelector('a-expander-summary').getBoundingClientRect()
      return [b.height,title.x-b.x,i.x-b.x,i.width,i.height]
    })
    assert.deepEqual(metrics,[32,24,6,16,16])
    await page.locator('a-expander').evaluate(n => {n.querySelector('a-expander-indicator').remove(); n.querySelector('a-expander-details').insertAdjacentHTML('beforebegin','<a-expander-indicator data-when="closed">C</a-expander-indicator><a-expander-indicator data-when="open">O</a-expander-indicator>')})
    await frames(page)
    assert.equal(await page.locator('[data-when="closed"]').isVisible(), true)
    assert.equal(await page.locator('[data-when="open"]').isVisible(), false)
    assert.equal(await page.locator('a-expander').evaluate(n => n.shadowRoot.querySelector('[part="indicator"]').inert), true)
    assert.match(await button(page).ariaSnapshot(), /button "Release details\."/)
    await page.locator('a-expander').evaluate(n => {const r=n.shadowRoot.querySelector('[part="indicator"]').getBoundingClientRect(); window.hit={x:r.x+r.width/2,y:r.y+r.height/2}})
    const hit=await page.evaluate(()=>window.hit); await page.mouse.click(hit.x,hit.y)
    assert.equal(await isClosed(page), false)
    assert.equal(await page.locator('[data-when="closed"]').isVisible(), false)
    assert.equal(await page.locator('[data-when="open"]').isVisible(), true)
    await page.locator('a-expander').evaluate(n => {n.querySelectorAll('a-expander-indicator').forEach(n=>n.remove()); n.querySelector('a-expander-details').insertAdjacentHTML('beforebegin','<a-expander-indicator shape="plus" aria-hidden="true" inert></a-expander-indicator>')})
    await frames(page)
    assert.equal(await page.locator('a-expander').evaluate(n=>getComputedStyle(n.querySelector('a-expander-indicator'),'::after').transform),'matrix(1, 0, 0, 0, 0, 0)')
    await page.locator('a-expander').evaluate(n=>{n.setAttribute('priority','tertiary'); n.setAttribute('outdent','')})
    const inset=await page.locator('a-expander').evaluate(n=>{const h=n.getBoundingClientRect(); const title=n.querySelector('a-expander-summary').getBoundingClientRect(); const body=n.querySelector('a-expander-details'); return [title.x-h.x,body.getBoundingClientRect().x+parseFloat(getComputedStyle(body).paddingInlineStart)-h.x]})
    assert.deepEqual(inset,[0,0])
  })
  test(`${engine.name()}: original animation and reduced motion use external rules`, async t => {
    const page = await pageFor(t, engine)
    await register(page)
    await mount(page)
    await page.emulateMedia({reducedMotion:'no-preference'})
    const duration=()=>page.locator('a-expander').evaluate(n=>getComputedStyle(n.shadowRoot.querySelector('[part="region"]')).transitionDuration)
    assert.equal(await duration(),'0.2s')
    assert.equal(await page.locator('a-expander [part="indicator"]').evaluate(n=>getComputedStyle(n).transitionDuration),'0.15s, 0.15s')
    await button(page).click()
    await page.waitForTimeout(250)
    assert.equal(await page.locator('a-expander').evaluate(n=>getComputedStyle(n.shadowRoot.querySelector('[part="content"]')).overflow),'visible')
    await button(page).evaluate(n => n.click())
    await page.waitForTimeout(250)
    assert.equal(await isClosed(page), true)
    assert.equal(await page.locator('a-expander').evaluate(n => n.shadowRoot.querySelector('[part="region"]').getBoundingClientRect().height), 0)
    await page.emulateMedia({reducedMotion:'reduce'})
    assert.equal(await duration(),'0s')
    assert.equal(await page.locator('a-expander [part="indicator"]').evaluate(n=>getComputedStyle(n).transitionDuration),'0s')
    await page.locator('a-expander > a-expander-indicator').evaluate(n=>n.setAttribute('shape','plus'))
    assert.equal(await page.locator('a-expander > a-expander-indicator').evaluate(n=>getComputedStyle(n,'::after').transitionDuration),'0s')
  })
  for (const framework of ['React','Preact']) for (const mode of ['granular','bundle']) {
    test(`${engine.name()} ${framework} ${mode}: open SSR/hydration, veto, node titles and empty indicator primitives`, async t => {
      const page=await pageFor(t,engine,mode,`&ssr&open&ssr-framework=${framework}`)
      const before=await geometry(page); await register(page,mode)
      assert.deepEqual(await geometry(page),before)
      await hydrate(page,framework,{...initialProps,defaultOpen:true})
      assert.equal(await isClosed(page),false)
      for (const indicator of ['chevron', {closed: 'C', open: 'O'}]) {
        await page.evaluate(indicator => window.renderExpander({...window.expanderProps, indicator}), indicator)
        await frames(page)
        await page.locator('a-expander').evaluate(host => {window.indicatorNodes = [...host.querySelectorAll(':scope > a-expander-indicator')]})
        for (const placement of ['end', 'start']) {
          await page.evaluate(indicatorPlacement => window.renderExpander({...window.expanderProps, indicatorPlacement}), placement)
          await frames(page)
          assert.equal(await page.locator('a-expander').evaluate(host => {
            const nodes = [...host.querySelectorAll(':scope > a-expander-indicator')]
            return nodes.length === window.indicatorNodes.length && nodes.every((node, i) => node === window.indicatorNodes[i])
          }), true, 'Changing JSX placement moves existing indicator nodes')
          assert.equal(await isClosed(page), false)
        }
      }
      await page.evaluate(()=>{window.veto=true}); await button(page).click()
      assert.equal(await isClosed(page),false)
      await page.evaluate(()=>{window.veto=false}); await button(page).click()
      assert.equal(await isClosed(page),true)
      await page.evaluate(()=>window.renderNodeTitle()); await frames(page)
      assert.equal(await page.locator('a-expander-title strong').textContent(),'Custom title')
      for (const indicator of ['typo',0,'',false]) {
        await page.evaluate(({props,indicator})=>window.renderExpander({...props,indicator}),{props:initialProps,indicator}); await frames(page)
        assert.equal(await page.locator('a-expander-indicator').textContent(),'')
        assert.equal(await page.locator('a-expander-indicator').evaluate(n=>getComputedStyle(n,'::before').content),'none')
      }
    })
  }
  for (const order of [['granular','bundle'],['bundle','granular']]) {
    test(`${engine.name()}: mixed ${order.join(' then ')} imports retain behavior and part overrides`, async t=>{
      const page=await pageFor(t,engine,order[0]); await register(page,order[0]); await register(page,order[1]); await mount(page)
      await button(page).click(); assert.equal(await isClosed(page),false)
      // Same-origin external CSS verifies the consumer cascade without inline styles.
      await page.route('**/override.css', route=>route.fulfill({contentType:'text/css',body:'a-expander::part(summary) { min-height: 48px; color: red; } a-expander::part(indicator) { color: blue; }'}))
      await page.evaluate(()=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/override.css';document.head.append(link)})
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('a-expander').shadowRoot.querySelector('button')).minHeight==='48px')
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('a-expander-summary')).color==='rgb(255, 0, 0)')
      assert.equal(await page.locator('a-expander-indicator').evaluate(n=>getComputedStyle(n).color),'rgb(0, 0, 255)')
      // The original public part still controls rotation of built-in artwork.
      await page.route('**/rotation.css', route=>route.fulfill({contentType:'text/css',body:'a-expander::part(indicator) { transform: none; }'}))
      await page.evaluate(()=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/rotation.css';document.head.append(link)})
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('a-expander').shadowRoot.querySelector('[part="indicator"]')).transform==='none')
    })
  }
  test(`${engine.name()}: slow visual matrix retains initial layout, variants, overrides and native details`, async () => {
    const folder = resolve('tests/.test-output/expander', consumerRoot ? 'installed' : 'source', browsers.get(engine).version(), engine.name())
    await mkdir(folder, {recursive:true})
    const variants = [
      ['start',{}], ['end',{},withIndicator(markup,'end')],
      ...[1,2,3,4,5,6].map(level=>['level-'+level,{},markup.replace('<a-expander-summary>','<a-expander-summary level="'+level+'">')]),
      ['round',{round:''}], ['fixed-round',{round:'12px',class:'fixed-round'}],
      ['outdent',{priority:'tertiary',outdent:''}], ['end-outdent',{priority:'tertiary',outdent:''},withIndicator(markup,'end')],
      ['plus',{},markup.replace('shape="chevron"','shape="plus"')], ['triangle',{},markup.replace('shape="chevron"','shape="triangle"')],
      ['rtl',{dir:'rtl'},withIndicator(markup,'end')], ['dark',{class:'dark',tone:'brand',priority:'primary'}],
      ['custom-tone',{class:'custom-tone',tone:'rebeccapurple'}],
      ['rich',{},markup.replace('<a-expander-summary>Release details.</a-expander-summary>','<a-expander-title><strong>Rich title</strong></a-expander-title>')],
      ['wrapped',{class:'wrapped'},markup.replace('Release details.','A longer section title that wraps across multiple lines')],
    ]
    for (const [name,attrs,body=markup] of variants) {
      let cleanup
      const page=await pageFor({after: callback=>cleanup=callback},engine)
      try {
        await mount(page,body,attrs)
        const before=await geometry(page)
        await register(page)
        const after = await geometry(page)
        assert.equal(after.length, before.length, name)
        assert.ok(after.every((value, index) => Math.abs(value - before[index]) < 0.02), name + ': ' + JSON.stringify({before,after}))
        let captureCleanup
        // WebKit's Playwright screenshot helper injects a body stylesheet to
        // synchronize animations. Keep CSP checks in the original page and
        // capture pixels in a separate context that permits that tool action.
        const capture = engine === webkit
          ? await pageFor({after:callback=>captureCleanup=callback},engine,'granular','',true,true) : page
        try {
          if (capture !== page) {await mount(capture,body,attrs);await register(capture)}
          await capture.locator('a-expander').screenshot({caret:'initial',path:resolve(folder,name+'-closed.png')})
          await page.locator('a-expander').evaluate(n=>n.setAttribute('state','open'))
          assert.equal(await isClosed(page),false)
          if (capture !== page) await capture.locator('a-expander').evaluate(n=>n.setAttribute('state','open'))
          await capture.locator('a-expander').screenshot({caret:'initial',path:resolve(folder,name+'-open.png')})
        } finally {await captureCleanup?.()}
        if (name==='fixed-round') assert.equal(await page.locator('a-expander').evaluate(n=>getComputedStyle(n).borderRadius),'12px')
        if (name==='level-1') assert.equal(await page.locator('a-expander-summary').evaluate(n=>getComputedStyle(n).fontSize),'28px')
      } finally {await cleanup()}
    }
    let cleanup
    const page=await pageFor({after: callback=>cleanup=callback},engine)
    try {
      await page.evaluate(()=>document.querySelector('#mount').innerHTML='<details data-anta round><summary>Native disclosure</summary><div>Native body</div></details>')
      await page.locator('summary').focus(); await page.keyboard.press('Enter')
      assert.equal(await page.locator('details').getAttribute('open'),'')
      assert.equal(await page.locator('details').evaluate(n=>getComputedStyle(n).borderRadius),await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize))
      if (engine !== webkit) await page.locator('details').screenshot({caret:'initial',path:resolve(folder,'native-open.png')})
    } finally {await cleanup()}
  })
  test(`${engine.name()}: adopted Expander keeps projection, cancellation and interaction in its document`,async t=>{
    const page=await pageFor(t,engine); await register(page); await mount(page)
    await page.evaluate(()=>{const iframe=document.createElement('iframe');iframe.src='/';document.body.append(iframe)})
    const frame=page.frames().find(f=>f!==page.mainFrame()); await frame.waitForLoadState()
    await page.evaluate(()=>{const frame=document.querySelector('iframe'); const n=document.querySelector('a-expander');frame.contentDocument.querySelector('#mount').append(frame.contentDocument.adoptNode(n))})
    await frame.evaluate(()=>import('/granular.js'))
    await button(frame).click(); assert.equal(await isClosed(frame),false)
    await frame.locator('a-expander').evaluate(n=>n.addEventListener('statechange',e=>e.preventDefault()))
    await button(frame).click(); assert.equal(await isClosed(frame),false)
    assert.deepEqual(await frame.evaluate(()=>window.cspViolations),[])
  })
}
