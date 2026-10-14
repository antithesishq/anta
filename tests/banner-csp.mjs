import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'node:http'
import { createRequire, Module } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const requirePlot = createRequire(new URL('../plot/package.json', import.meta.url))
const requireRenderer = createRequire(requireSite.resolve('@astrojs/preact'))
const consumerRoot = process.env.ANTA_BANNER_CONSUMER_ROOT ? resolve(process.env.ANTA_BANNER_CONSUMER_ROOT) : undefined
const resolveDir = consumerRoot ?? process.cwd()
const nodePaths = consumerRoot ? [resolve(consumerRoot, 'node_modules')] : [resolve('node_modules'), resolve('site/node_modules')]
const { chromium, firefox, webkit } = requireSite('playwright')
// These engines do not substitute for minimum shipping-browser validation.
// Keep display and intrinsic-size transitions as the existing progressive enhancement.
const engines = process.env.ANTA_TEST_WEBKIT === '0' ? [chromium] : [chromium, firefox, webkit]
const source = process.env.ANTA_BANNER_PACKAGE_ROOT ? resolve(process.env.ANTA_BANNER_PACKAGE_ROOT, 'dist') : resolve('src')
const jsxAlias = consumerRoot ? {} : { '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime') }
const preactCompat = consumerRoot ? 'preact/compat' : requireSite.resolve('preact/compat')
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'"
const browsers = new Map()
const initialProps = { message: 'Release ready.', tone: 'info', 'data-owner': 'app' }
const factory = `const node = props => React.createElement(Banner, {
  actions: React.createElement(Button, {size: 'small', tone: 'info', label: 'Got it', 'data-banner-dismiss': ''}),
  ...props,
}, 'children' in props ? props.children : React.createElement('a', {href: '#details'}, 'Details'))`
const componentImports = consumerRoot
  ? `import {Banner, Button} from '@antadesign/anta'`
  : `import {Banner} from '${source}/components/Banner'; import {Button} from '${source}/components/Button'`
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
        : `import '@antadesign/anta/tokens.css'; import '@antadesign/anta/reset.css'; import '@antadesign/anta/elements/a-banner'; import '@antadesign/anta/elements/a-button'; import '@antadesign/anta/elements/a-icon';`
      : mode === 'bundle'
        ? `import '${source}/bundle'; ${process.env.ANTA_BANNER_PACKAGE_ROOT ? `import '${source}/bundle.css';` : ''}`
        : `import '${source}/tokens.css'; import '${source}/reset.css'; import '${source}/elements/a-banner'; import '${source}/elements/a-button'; import '${source}/elements/a-icon';`
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
    const compiled = new Module(resolve(`tests/banner-${framework}-server.cjs`))
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
        const app = props => node({...props, onDismiss: () => {
          window.requests++
          if (window.acceptDismissal) window.renderBanner({...window.bannerProps, dismissed: true})
        }})
        window.renderBanner = props => {
          window.bannerProps = props
          ${react ? "root ??= createRoot(document.querySelector('#mount')); root.render(app(props))" : "render(app(props), document.querySelector('#mount'))"}
        }
        window.hydrateBanner = props => {
          window.bannerProps = props
          ${react ? "root = hydrateRoot(document.querySelector('#mount'), app(props), {onRecoverableError: error => window.recoverableErrors.push(error.message)})" : "hydrate(app(props), document.querySelector('#mount'))"}
        }
        window.renderNodeMessage = () => window.renderBanner({message: React.createElement('strong', null, 'Custom message'), actions: false, children: false})
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
  assets.set('/fixture.css', await readFile(new URL('./banner-csp.fixture.css', import.meta.url), 'utf8'))
  assets.set('/boot.js', `window.cspViolations=[]; document.addEventListener('securitypolicyviolation', e=>window.cspViolations.push(e.effectiveDirective));`)
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const mode = url.searchParams.get('mode') || 'granular'
    res.setHeader('Content-Security-Policy', policy)
    res.setHeader('Content-Type', `${req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html'}; charset=utf-8`)
    const props = { ...initialProps, ...(url.searchParams.has('controlled') ? { dismissed: url.searchParams.has('closed') } : url.searchParams.has('closed') ? { defaultDismissed: true } : {}) }
    const render = serverRenderers.get(url.searchParams.get('ssr-framework') || 'React')
    res.end(assets.get(req.url) ?? `<!doctype html><link rel="stylesheet" href="/${mode}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><main id="mount">${url.searchParams.has('ssr') ? render(props) : ''}</main><div id="following">Following content</div>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  const chromiumOptions = process.env.ANTA_BANNER_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.ANTA_BANNER_CHROMIUM_EXECUTABLE }
    : { channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined }
  for (const engine of engines) browsers.set(engine, await engine.launch({ headless: true,
    ...(engine === chromium ? chromiumOptions : {}),
  }))
})
after(async () => {
  await Promise.all([...browsers.values()].map(browser => browser.close()))
  if (server) await new Promise(resolve => server.close(resolve))
})

async function pageFor(t, engine, mode = 'granular', query = '', javaScriptEnabled = true) {
  const page = await browsers.get(engine).newPage({ reducedMotion: 'reduce', javaScriptEnabled })
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
const action = '<a-button role="button" tabindex="0" size="small" data-banner-dismiss><a-button-label>Got it</a-button-label></a-button>'
const close = '<a-banner-close><a-button role="button" tabindex="0" priority="quaternary" aria-label="Dismiss" data-custom-event="dismissrequest"><a-icon shape="x" aria-hidden="true"></a-icon></a-button></a-banner-close>'
const markup = `<a-banner-message>Release ready.</a-banner-message><a-banner-content><a href="#details">Details</a></a-banner-content><a-banner-actions>${action}${action.replace('Got it', 'Later')}</a-banner-actions>${close}`
async function mount(page, content = markup, attrs = {}) {
  await page.evaluate(({content, attrs}) => {
    const banner = document.createElement('a-banner')
    for (const [name, value] of Object.entries(attrs)) banner.setAttribute(name, value)
    banner.innerHTML = content
    document.querySelector('#mount').replaceChildren(banner)
  }, {content, attrs})
}
async function geometry(page) {
  return page.locator('#mount > a-banner').evaluate(banner => {
    const rect = node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] }
    return [rect(banner), rect(document.querySelector('#following')), ...[...banner.querySelectorAll('a-banner-message, a-banner-content > *, a-banner-actions > *, a-banner-close > *')].map(rect)].flat()
  })
}
const isClosed = (page, selector = '#mount > a-banner') => page.locator(selector).evaluate(n => getComputedStyle(n).display === 'none')
async function hydrate(page, framework, props = initialProps) {
  await page.evaluate(framework => import(`/${framework}.js`), framework)
  await page.evaluate(props => {
    window.serverNodes = [...document.querySelector('#mount').querySelectorAll('*')]
    window.hydrateBanner(props)
  }, props)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  assert.deepEqual(await page.evaluate(() => window.recoverableErrors), [])
  assert.equal(await page.evaluate(() => {
    const current = [...document.querySelector('#mount').querySelectorAll('*')]
    return window.serverNodes.length === current.length && current.every((node, index) => node === window.serverNodes[index])
  }), true, 'Hydration retains the server-rendered nodes')
}
async function trackOwnership(page) {
  await page.locator('#mount > a-banner').evaluate(n => {
    window.ownerMutations = []
    new MutationObserver(records => window.ownerMutations.push(...records.map(r => r.type)))
      .observe(n, { attributes: true, childList: true, subtree: true, characterData: true })
  })
}

test('Banner SSR owns regions and emits no structural inline styles', () => {
  for (const render of serverRenderers.values()) {
    const html = render(initialProps)
    assert.match(html, /<a-banner-actions>/)
    assert.match(html, /<a-banner-content>/)
    assert.match(html, /<a-banner-close>/)
    assert.doesNotMatch(html, /style=|slot=|data-anta-banner-actions-wrapper/)
    assert.match(render({message: 0}), /<a-banner-message>0<\/a-banner-message>/)
    for (const value of [null, false, true, [], '', '   ']) {
      assert.doesNotMatch(render({message: value, actions: value, children: false, closable: false}), /<a-banner-(message|actions|close)/)
    }
  }
})

for (const engine of engines) {
  test(`${engine.name()}: SSR visible and initially dismissed Banner work without JavaScript`, async t => {
    for (const closed of [false, true]) {
      const page = await pageFor(t, engine, 'granular', `&ssr=1${closed ? '&closed=1' : ''}`, false)
      assert.equal(await isClosed(page), closed)
      assert.equal(await page.locator('a-banner').getAttribute('role'), 'status')
      assert.equal(await page.locator('a-banner').evaluate(n => getComputedStyle(n).opacity), closed ? '0' : '1')
      if (!closed) {
        await page.getByRole('link', {name: 'Details'}).click()
        await page.waitForURL(url => url.hash === '#details')
      }
    }
  })
  for (const mode of ['granular', 'bundle']) {
    test(`${engine.name()}: ${mode} Banner renders the same layout before and after registration`, async t => {
      for (const attrs of [{}, {align: 'center'}, {dir: 'rtl', round: ''}, {class: 'override'}]) {
        const page = await pageFor(t, engine, mode)
        await mount(page, markup, attrs)
        const before = await geometry(page)
        const html = await page.locator('a-banner').evaluate(n => n.outerHTML)
        await trackOwnership(page)
        await register(page, mode)
        const after = await geometry(page)
        before.forEach((value, i) => assert.ok(Math.abs(value - after[i]) < 0.5, `metric ${i}: ${value} → ${after[i]}`))
        assert.equal(await page.locator('a-banner').evaluate(n => n.shadowRoot), null)
        assert.equal(await page.locator('a-banner').evaluate(n => n.outerHTML), html)
        assert.deepEqual(await page.evaluate(() => window.ownerMutations), [])
      }
    })
    test(`${engine.name()}: ${mode} uncontrolled dismissal is cancelable and retains authored DOM`, async t => {
      const page = await pageFor(t, engine, mode)
      await mount(page)
      await register(page, mode)
      const html = await page.locator('a-banner').evaluate(n => n.outerHTML)
      await trackOwnership(page)
      await page.locator('a-banner').evaluate(n => {
        window.details = []
        n.addEventListener('statechange', e => { window.details.push(e.detail); e.preventDefault() }, {once: true})
      })
      await page.getByRole('button', {name: 'Dismiss', exact: true}).click()
      assert.equal(await isClosed(page), false)
      await page.getByRole('button', {name: 'Got it', exact: true}).focus()
      await page.keyboard.press('Enter')
      assert.equal(await isClosed(page), true)
      assert.equal(await page.locator('a-banner').evaluate(n => n.outerHTML), html)
      assert.deepEqual(await page.evaluate(() => window.ownerMutations), [])
      assert.deepEqual(await page.evaluate(() => window.details), [{next: 'closed', prev: 'open'}])
      await page.locator('a-banner').evaluate(n => { n.remove(); document.querySelector('#mount').append(n) })
      assert.equal(await isClosed(page), true)
    })
    test(`${engine.name()}: ${mode} controlled rejection, restoration, and mode changes keep visibility consistent`, async t => {
      const page = await pageFor(t, engine, mode)
      await mount(page, markup, {'default-state': 'closed', state: 'open'})
      await register(page, mode)
      assert.equal(await isClosed(page), false)
      await page.getByRole('button', {name: 'Dismiss', exact: true}).focus()
      await page.keyboard.press('Space')
      assert.equal(await isClosed(page), false)
      await page.locator('a-banner').evaluate(n => n.setAttribute('state', 'closed'))
      assert.equal(await isClosed(page), true)
      await page.locator('a-banner').evaluate(n => n.setAttribute('state', 'open'))
      assert.equal(await isClosed(page), false)
      await page.locator('a-banner').evaluate(n => {
        n.removeAttribute('state'); n.remove(); document.querySelector('#mount').append(n)
      })
      assert.equal(await isClosed(page), false)
      await page.getByRole('button', {name: 'Dismiss', exact: true}).click()
      assert.equal(await isClosed(page), true)
    })
    test(`${engine.name()}: ${mode} nested Banner styles and dismissal stay independent`, async t => {
      const page = await pageFor(t, engine, mode)
      await mount(page, `<a-banner-message>Outer</a-banner-message><a-banner-content><a-banner>${markup}</a-banner></a-banner-content>${close}`, {align: 'center'})
      await register(page, mode)
      assert.equal(await page.locator('a-banner a-banner > a-banner-message').evaluate(n => getComputedStyle(n).textAlign), 'start')
      await page.locator('#mount > a-banner').evaluate(n => {
        window.outerRequests = 0
        n.addEventListener('statechange', () => window.outerRequests++)
      })
      await page.locator('a-banner a-banner').getByRole('button', {name: 'Dismiss', exact: true}).click()
      assert.equal(await isClosed(page, 'a-banner a-banner'), true)
      assert.equal(await isClosed(page), false)
      assert.equal(await page.evaluate(() => window.outerRequests), 0)
      await page.locator('a-banner a-banner').evaluate(n => n.setAttribute('state', 'open'))
      await page.locator('a-banner a-banner').getByRole('button', {name: 'Got it', exact: true}).click()
      assert.equal(await isClosed(page), false)
    })
    test(`${engine.name()}: ${mode} adopted Banner handles close requests in a same-origin iframe`, async t => {
      const page = await pageFor(t, engine, mode)
      await mount(page)
      await register(page, mode)
      const result = await page.evaluate(async mode => {
        const inner = document.querySelector('#mount > a-banner')
        const html = inner.outerHTML
        const outer = document.createElement('a-banner')
        const content = document.createElement('a-banner-content')
        outer.append(content)
        content.append(inner)
        document.querySelector('#mount').append(outer)
        let innerRequests = 0, outerRequests = 0
        inner.addEventListener('statechange', () => innerRequests++)
        outer.addEventListener('statechange', () => outerRequests++)

        const iframe = document.createElement('iframe')
        iframe.src = `/?mode=${mode}`
        const loaded = new Promise(resolve => iframe.addEventListener('load', resolve, {once: true}))
        document.body.append(iframe)
        await loaded
        iframe.contentDocument.querySelector('#mount').append(outer)
        const frameView = iframe.contentWindow
        inner.querySelector('a-banner-close > a-button').dispatchEvent(new frameView.CustomEvent('dismissrequest', {
          bubbles: true, composed: true,
        }))
        return {
          ownerChanged: inner.ownerDocument === iframe.contentDocument,
          parentRealm: inner instanceof Element,
          ownerRealm: inner instanceof frameView.Element,
          innerRequests, outerRequests,
          innerClosed: inner.matches(':state(closed)'),
          innerHidden: frameView.getComputedStyle(inner).display === 'none',
          outerOpen: outer.matches(':state(open)'),
          outerVisible: frameView.getComputedStyle(outer).display !== 'none',
          unchanged: inner.outerHTML === html,
          cspViolations: frameView.cspViolations,
        }
      }, mode)
      assert.deepEqual(result, {
        ownerChanged: true, parentRealm: true, ownerRealm: false,
        innerRequests: 1, outerRequests: 0,
        innerClosed: true, innerHidden: true, outerOpen: true, outerVisible: true,
        unchanged: true, cspViolations: [],
      })
    })
  }
  test(`${engine.name()}: CSS hides empty actions after additions, removals, and replacement`, async t => {
    const page = await pageFor(t, engine)
    await mount(page, '<a-banner-message>Notice</a-banner-message><a-banner-actions></a-banner-actions>')
    assert.equal(await page.locator('a-banner-actions').evaluate(n => getComputedStyle(n).display), 'none')
    await register(page)
    await page.locator('a-banner-actions').evaluate((n, html) => n.innerHTML = html, action)
    assert.equal(await page.locator('a-banner-actions').evaluate(n => getComputedStyle(n).display), 'flex')
    await page.locator('a-banner-actions').evaluate(n => n.firstElementChild.remove())
    assert.equal(await page.locator('a-banner-actions').evaluate(n => getComputedStyle(n).display), 'none')
    await page.locator('a-banner-actions').evaluate((n, html) => {
      const replacement = document.createElement('a-banner-actions'); replacement.innerHTML = html; n.replaceWith(replacement)
    }, action)
    assert.equal(await page.locator('a-banner-actions').evaluate(n => getComputedStyle(n).display), 'flex')
    const html = await page.locator('a-banner').evaluate(n => n.outerHTML)
    await trackOwnership(page)
    await page.getByRole('button', {name: 'Got it', exact: true}).click()
    assert.equal(await page.locator('a-banner').evaluate(n => n.outerHTML), html)
    assert.deepEqual(await page.evaluate(() => window.ownerMutations), [])
  })
  for (const framework of ['React', 'Preact']) {
    test(`${engine.name()}: ${framework} hydration handles controlled rejection and restoration`, async t => {
      const page = await pageFor(t, engine, 'granular', `&ssr=1&ssr-framework=${framework}`)
      await register(page)
      const html = await page.locator('a-banner').evaluate(n => n.outerHTML)
      await hydrate(page, framework)
      assert.equal(await page.locator('a-banner').evaluate(n => n.outerHTML), html)
      await page.evaluate(() => window.renderBanner({...window.bannerProps, dismissed: false}))
      await page.waitForFunction(() => document.querySelector('a-banner').getAttribute('state') === 'open')
      await page.getByRole('button', {name: 'Dismiss', exact: true}).click()
      assert.equal(await page.evaluate(() => window.requests), 1)
      assert.equal(await isClosed(page), false)
      await page.evaluate(() => window.acceptDismissal = true)
      await page.getByRole('button', {name: 'Got it', exact: true}).focus()
      await page.keyboard.press('Space')
      await page.waitForFunction(() => document.querySelector('a-banner').getAttribute('state') === 'closed')
      assert.equal(await isClosed(page), true)
      await page.evaluate(() => window.renderBanner({...window.bannerProps, dismissed: false}))
      await page.waitForFunction(() => document.querySelector('a-banner').getAttribute('state') === 'open')
      assert.equal(await isClosed(page), false)
      await page.evaluate(() => window.renderNodeMessage())
      await page.waitForFunction(() => document.querySelector('a-banner-content strong'))
      assert.equal(await page.locator('a-banner-message').count(), 0)
      assert.equal(await page.locator('a-banner-actions').count(), 0)
      assert.equal(await page.locator('strong').evaluate(n => getComputedStyle(n).fontSize), '15px')
    })
    for (const mode of ['granular', 'bundle']) {
      test(`${engine.name()}: ${framework} ${mode} initially controlled-closed SSR hydrates and restores`, async t => {
        const props = { ...initialProps, dismissed: true }
        const page = await pageFor(t, engine, mode, `&ssr=1&controlled=1&closed=1&ssr-framework=${framework}`)
        assert.equal(await isClosed(page), true)
        await register(page, mode)
        await hydrate(page, framework, props)
        assert.equal(await isClosed(page), true)
        await page.evaluate(() => window.renderBanner({...window.bannerProps, dismissed: false}))
        await page.waitForFunction(() => document.querySelector('a-banner').getAttribute('state') === 'open')
        await page.getByRole('button', {name: 'Dismiss', exact: true}).press('Enter')
        assert.equal(await page.evaluate(() => window.requests), 1)
        assert.equal(await isClosed(page), false)
        await page.evaluate(() => window.acceptDismissal = true)
        await page.getByRole('button', {name: 'Got it', exact: true}).click()
        await page.waitForFunction(() => document.querySelector('a-banner').getAttribute('state') === 'closed')
        assert.equal(await isClosed(page), true)
      })
    }
    test(`${engine.name()}: ${framework} hydrated uncontrolled dismissal installs its notification listener`, async t => {
      const page = await pageFor(t, engine, 'granular', `&ssr=1&ssr-framework=${framework}`)
      await register(page)
      await hydrate(page, framework)
      await page.getByRole('button', {name: 'Dismiss', exact: true}).click()
      assert.equal(await page.evaluate(() => window.requests), 1)
      assert.equal(await isClosed(page), true)
    })
  }
  for (const first of ['granular', 'bundle']) {
    test(`${engine.name()}: mixed imports ${first} first retain Button activation and accessible names`, async t => {
      const second = first === 'granular' ? 'bundle' : 'granular'
      const page = await pageFor(t, engine, first, '&ssr=1')
      await register(page, first)
      await register(page, second)
      await page.getByRole('button', {name: 'Dismiss', exact: true}).focus()
      await page.keyboard.press('Enter')
      assert.equal(await isClosed(page), true)
    })
  }
  test(`${engine.name()}: wrapping, overrides, custom variables, and reduced motion preserve the layout`, async t => {
    const page = await pageFor(t, engine)
    const long = markup.replace('Release ready.', 'This is a long announcement that wraps into several lines in a narrow notice and keeps the close target centered.')
    await mount(page, long, {align: 'center', class: 'override custom', tone: '#c42b71', round: ''})
    await register(page)
    const metrics = await page.locator('a-banner').evaluate(n => {
      const host = n.getBoundingClientRect(), button = n.querySelector('a-banner-close > a-button').getBoundingClientRect()
      return {height: host.height, buttonHeight: button.height, width: button.width, radius: getComputedStyle(n).borderRadius,
        fontSize: getComputedStyle(n.querySelector('a-banner-message')).fontSize,
        gap: getComputedStyle(n.querySelector('a-banner-actions')).gap, transition: getComputedStyle(n).transitionDuration}
    })
    assert.ok(metrics.height > 56)
    assert.ok(Math.abs(metrics.buttonHeight - metrics.height) <= 1)
    assert.equal(metrics.width, 40)
    assert.equal(metrics.radius, '12px')
    assert.equal(metrics.fontSize, '18px')
    assert.equal(metrics.gap, '8px')
    assert.equal(metrics.transition, '0s')
    await page.getByRole('button', {name: 'Dismiss', exact: true}).click()
    assert.equal(await isClosed(page), true)
  })
  test(`${engine.name()}: dismissal retains the existing motion timings and eventually hides`, async t => {
    const page = await pageFor(t, engine)
    await page.emulateMedia({reducedMotion: 'no-preference'})
    await mount(page)
    await register(page)
    const timings = await page.locator('a-banner').evaluate(n => ({properties: getComputedStyle(n).transitionProperty, duration: getComputedStyle(n).transitionDuration}))
    assert.match(timings.properties, /opacity/)
    assert.match(timings.properties, /block-size/)
    assert.match(timings.duration, /0\.16s/)
    assert.match(timings.duration, /0\.2s/)
    await page.getByRole('button', {name: 'Dismiss', exact: true}).click()
    await page.waitForFunction(() => getComputedStyle(document.querySelector('a-banner')).display === 'none')
    assert.equal(await page.locator('a-banner-close').count(), 1)
  })
}
