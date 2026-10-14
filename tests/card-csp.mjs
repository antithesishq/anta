import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'node:http'
import { createRequire, Module } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const requirePlot = createRequire(new URL('../plot/package.json', import.meta.url))
const { chromium, firefox, webkit } = requireSite('playwright')
const engines = process.env.ANTA_TEST_WEBKIT === '0' ? [chromium] : [chromium, firefox, webkit]
const source = process.env.ANTA_CARD_PACKAGE_ROOT ? resolve(process.env.ANTA_CARD_PACKAGE_ROOT, 'dist') : resolve('src')
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; object-src 'none'"
const browsers = new Map()
let server, origin, renderServer

const nodeFactory = `const node = props => React.createElement(Card, {
  header: 'Heading', footer: props.href != null ? 'Footer' : [React.createElement('button', {key: 1}, 'First'), React.createElement('button', {key: 2}, 'Second')],
  ...props,
}, 'children' in props ? props.children : React.createElement('div', null, 'Body'))`
const serverProps = { href: '#server', role: 'article', 'data-owner': 'app' }

before(async () => {
  const assets = new Map()
  for (const mode of ['granular', 'bundle']) {
    const contents = mode === 'bundle'
      ? `import '${source}/bundle'; ${process.env.ANTA_CARD_PACKAGE_ROOT ? `import '${source}/bundle.css';` : ''}`
      : `import '${source}/tokens.css'; import '${source}/reset.css'; import '${source}/elements/a-card';`
    const result = await build({
      stdin: { contents, resolveDir: process.cwd() }, bundle: true, write: false,
      outfile: `${mode}.js`, format: 'esm', target: 'es2022',
      alias: { react: requireSite.resolve('preact/compat') },
      nodePaths: [resolve('node_modules')],
    })
    for (const file of result.outputFiles) assets.set(`/${mode}.${file.path.endsWith('.css') ? 'css' : 'js'}`, file.text)
    assert.ok(assets.has(`/${mode}.css`), `${mode} must load its paired stylesheet`)
  }
  const serverResult = await build({
    stdin: { contents: `import React from 'react'; import {Card} from '${source}/components/Card'; import {renderToString} from 'react-dom/server'; ${nodeFactory}; export const render = props => renderToString(node(props));`, resolveDir: process.cwd() },
    bundle: true, write: false, platform: 'node', format: 'cjs', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('node_modules')],
    alias: { '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime'), 'react-dom/server': requirePlot.resolve('react-dom/server'), react: resolve('node_modules/react') },
  })
  const compiled = new Module(resolve('tests/card-server.cjs'))
  compiled._compile(serverResult.outputFiles[0].text, compiled.id)
  renderServer = compiled.exports.render
  for (const framework of ['React', 'Preact']) {
    const react = framework === 'React'
    const result = await build({
      stdin: {
        contents: `
          import React from 'react'
          import { Card } from '${source}/components/Card'
          import '${source}/elements/a-title.css'
          ${react ? "import { createRoot, hydrateRoot } from 'react-dom/client'" : "import { render, hydrate } from 'preact'"}
          ${nodeFactory}
          ${react ? 'let root' : ''}
          window.renderCard = props => {
            ${react ? "root ??= createRoot(document.querySelector('#mount')); root.render(node(props))" : "render(node(props), document.querySelector('#mount'))"}
          }
          window.hydrateCard = props => {
            ${react ? "root = hydrateRoot(document.querySelector('#mount'), node(props))" : "hydrate(node(props), document.querySelector('#mount'))"}
          }
        `, resolveDir: process.cwd(),
      },
      bundle: true, write: false, outfile: `${framework}.js`, format: 'esm', target: 'es2022',
      jsx: 'automatic', jsxImportSource: '@antadesign/anta',
      define: { 'process.env.NODE_ENV': '"production"' },
      nodePaths: [resolve('node_modules'), resolve('site/node_modules')],
      alias: {
        '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime'),
        ...(react ? { 'react-dom/client': requirePlot.resolve('react-dom/client'), react: resolve('node_modules/react') } : { react: requireSite.resolve('preact/compat') }),
      },
    })
    for (const file of result.outputFiles) assets.set(`/${framework}.${file.path.endsWith('.css') ? 'css' : 'js'}`, file.text)
  }
  assert.doesNotMatch(renderServer({ header: false, subtitle: false, icon: false, media: false, footer: false, children: false }), /<a-card-(header|title|body|icon|media|footer)>/)
  assets.set('/fixture.css', await readFile(new URL('./card-csp.fixture.css', import.meta.url), 'utf8'))
  assets.set('/boot.js', `window.cspViolations=[]; document.addEventListener('securitypolicyviolation', e=>window.cspViolations.push(e.effectiveDirective));`)
  server = createServer((req, res) => {
    res.setHeader('Content-Security-Policy', policy)
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html')
    const url = new URL(req.url, 'http://localhost')
    const mode = url.searchParams.get('mode') || 'granular'
    res.end(assets.get(req.url) ?? `<!doctype html><link rel="stylesheet" href="/${mode}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><link rel="stylesheet" href="/React.css"><main id="mount">${url.searchParams.has('ssr') ? renderServer(serverProps) : ''}</main><div id="following">Following content</div>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  for (const engine of engines) browsers.set(engine, await engine.launch({
    headless: true,
    ...(engine === chromium ? { channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined } : {}),
  }))
})

after(async () => {
  await Promise.all([...browsers.values()].map(browser => browser.close()))
  if (server) await new Promise(resolve => server.close(resolve))
})

async function pageFor(t, engine, mode = 'granular', ssr = false, javaScriptEnabled = true) {
  const page = await browsers.get(engine).newPage({ reducedMotion: 'reduce', javaScriptEnabled })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const response = await page.goto(`${origin}/?mode=${mode}${ssr ? '&ssr=1' : ''}`)
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
const markup = '<a-card-media><div>Media</div></a-card-media><a-card-content><a-card-header><a-card-icon><div>Icon</div></a-card-icon><a-card-title><h2>Heading</h2><span>Subtitle</span></a-card-title></a-card-header><a-card-body><div>Body</div><div>Second body</div></a-card-body><a-card-footer><button>First</button><button>Second</button></a-card-footer></a-card-content>'

async function mount(page, content = markup, attrs = {}) {
  await page.evaluate(({content, attrs}) => {
    const card = document.createElement('a-card')
    for (const [key, value] of Object.entries(attrs)) card.setAttribute(key, value)
    card.innerHTML = content
    document.querySelector('#mount').replaceChildren(card)
  }, {content, attrs})
}
async function geometry(page) {
  return page.locator('#mount > a-card').evaluate(card => {
    const rect = node => {
      const r = node.getBoundingClientRect()
      return [r.x, r.y, r.width, r.height]
    }
    return {
      host: rect(card), following: rect(document.querySelector('#following')),
      content: [...card.querySelectorAll('a-card-media > *, a-card-icon > *, a-card-title > *, a-card-body > *, a-card-footer > *')].map(node => {
        const range = document.createRange()
        range.selectNodeContents(node)
        return rect(range)
      }),
    }
  })
}
function sameGeometry(before, after) {
  const a = [before.host, before.following, ...before.content].flat()
  const b = [after.host, after.following, ...after.content].flat()
  assert.equal(a.length, b.length)
  a.forEach((value, i) => assert.ok(Math.abs(value - b[i]) <= 0.5, `metric ${i}: ${value} → ${b[i]}`))
}

for (const engine of engines) {
  test(`${engine.name()}: CSS-only Card SSR renders and navigates with JavaScript disabled`, async t => {
    const page = await pageFor(t, engine, 'granular', true, false)
    assert.equal(await page.locator('a-card').evaluate(n => getComputedStyle(n).opacity), '1')
    assert.equal(await page.locator('a-card-body').count(), 1)
    await page.locator('a-card > a').click()
    await page.waitForURL(url => url.hash === '#server')
  })
  test(`${engine.name()}: Card geometry does not depend on registration in any media position or size`, async t => {
    for (const position of ['top', 'bottom', 'left', 'right']) {
      for (const size of ['small', 'medium', 'large']) {
        const page = await pageFor(t, engine)
        await mount(page, markup, { 'media-position': position, size })
        assert.equal(await page.locator('a-card').evaluate(n => getComputedStyle(n).flexDirection), { top: 'column', bottom: 'column-reverse', left: 'row', right: 'row-reverse' }[position])
        const before = await geometry(page)
        await register(page)
        sameGeometry(before, await geometry(page))
        assert.equal(await page.locator('a-card').evaluate(n => n.shadowRoot), null)
        assert.equal(await page.evaluate(() => customElements.get('a-card') == null), true)
      }
    }
  })
  for (const mode of ['granular', 'bundle']) {
    test(`${engine.name()}: ${mode} Card regions, overrides, loading, and nested state work under CSP`, async t => {
      const page = await pageFor(t, engine, mode)
      await mount(page, markup, { selected: '', class: 'override tall' })
      await page.locator('a-card-body').evaluate(n => n.innerHTML += '<a-card><a-card-content><a-card-body>Nested text</a-card-body></a-card-content></a-card>')
      assert.match(await page.locator('#mount > a-card').evaluate(n => getComputedStyle(n).boxShadow), /2px inset/)
      const html = await page.locator('#mount > a-card').evaluate(n => n.outerHTML)
      await page.locator('#mount > a-card').evaluate(n => {
        window.ownerMutations = []
        new MutationObserver(records => window.ownerMutations.push(...records.map(r => r.type))).observe(n, { attributes: true, childList: true, subtree: true, characterData: true })
      })
      await register(page, mode)
      assert.equal(await page.locator('#mount > a-card').evaluate(n => n.outerHTML), html)
      assert.deepEqual(await page.evaluate(() => window.ownerMutations), [])
      await page.locator('a-card-title').evaluate(n => n.innerHTML = '<div><a-title level="4">Grouped heading</a-title></div>')
      assert.equal(await page.locator('a-card-title a-title').evaluate(n => getComputedStyle(n).marginTop), '0px')
      assert.equal(await page.locator('#mount > a-card a-card-header').evaluate(n => getComputedStyle(n).paddingBottom), '8px')
      assert.equal(await page.locator('#mount > a-card > a-card-content > a-card-body').evaluate(n => getComputedStyle(n).overflow), 'auto')
      assert.equal(await page.locator('a-card-body a-card').evaluate(n => getComputedStyle(n).getPropertyValue('--card-selection-shadow').trim()), 'inset 0 0 0 0 transparent')
      await page.locator('#mount > a-card').evaluate(n => n.setAttribute('loading', ''))
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      assert.equal(await page.locator('#mount > a-card > a-card-content').evaluate(n => n.getAnimations().length), 1)
      assert.equal(await page.locator('a-card-body a-card-content').evaluate(n => n.getAnimations().length), 0)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      assert.equal(await page.locator('#mount > a-card > a-card-content').evaluate(n => n.getAnimations().length), 0)
    })
  }
  for (const framework of ['React', 'Preact']) {
    test(`${engine.name()}: ${framework} hydrates Card without layout or ownership changes`, async t => {
      const page = await pageFor(t, engine, 'granular', true)
      const before = await geometry(page)
      const html = await page.locator('a-card').evaluate(n => n.outerHTML)
      await page.evaluate(framework => import(`/${framework}.js`), framework)
      await page.evaluate(props => window.hydrateCard(props), serverProps)
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
      sameGeometry(before, await geometry(page))
      assert.equal(await page.locator('a-card').evaluate(n => n.outerHTML), html)
      await page.evaluate(() => window.renderCard({ href: '#next', 'aria-label': 'Next name', loading: true, 'data-owner': 'app' }))
      await page.waitForFunction(() => document.querySelector('a-card').hasAttribute('loading'))
      const state = await page.locator('a-card').evaluate(n => ({
        label: n.getAttribute('aria-label'), owner: n.dataset.owner,
        linkHref: n.querySelector('a').getAttribute('href'), linkLabel: n.querySelector('a').getAttribute('aria-label'), busy: n.querySelector('a').getAttribute('aria-busy'),
      }))
      assert.deepEqual(state, { label: null, owner: 'app', linkHref: null, linkLabel: 'Next name', busy: 'true' })
      await page.evaluate(() => window.renderCard({ href: '#next', header: 'Updated header', 'data-owner': 'app' }))
      await page.waitForFunction(() => document.querySelector('a-card > a').getAttribute('href') === '#next')
      assert.equal(await page.locator('a-card > a').getAttribute('aria-label'), 'Updated header')
      await page.keyboard.press(engine === webkit ? 'Alt+Tab' : 'Tab')
      await page.locator('a-card > a').focus()
      assert.equal(await page.locator('a-card > a').evaluate(n => n.matches(':focus-visible')), true)
      assert.notEqual(await page.locator('a-card > a').evaluate(n => getComputedStyle(n).boxShadow), 'none')
      if (engine === chromium) {
        await page.emulateMedia({ forcedColors: 'active' })
        assert.equal(await page.locator('a-card > a').evaluate(n => getComputedStyle(n).outlineStyle), 'solid')
        await page.emulateMedia({ forcedColors: 'none' })
      }
      await page.keyboard.press('Enter')
      await page.waitForURL(url => url.hash === '#next')
      await page.evaluate(() => window.renderCard({ href: '#pointer', target: '_blank', rel: 'noopener', ping: '/ping' }))
      await page.waitForFunction(() => document.querySelector('a-card > a').getAttribute('href') === '#pointer')
      const anchor = page.locator('a-card > a')
      assert.equal(await anchor.getAttribute('target'), '_blank')
      assert.equal(await anchor.getAttribute('rel'), 'noopener')
      assert.equal(await anchor.getAttribute('ping'), '/ping')
      await page.evaluate(() => window.renderCard({ href: '#pointer' }))
      await page.waitForFunction(() => document.querySelector('a-card > a').target === '')
      assert.equal(await anchor.evaluate(n => n.rel), '')
      assert.equal(await anchor.evaluate(n => n.ping), '')
      await anchor.click()
      await page.waitForURL(url => url.hash === '#pointer')
      await page.evaluate(() => window.renderCard({ footer: null, header: null, children: 'Raw string', 'aria-busy': 'false', loading: true }))
      await page.waitForFunction(() => !document.querySelector('a-card > a'))
      assert.equal(await page.locator('a-card').getAttribute('aria-busy'), 'false')
      assert.equal(await page.locator('a-card-header').count(), 0)
      assert.equal(await page.locator('a-card-body').innerText(), 'Raw string')
      assert.equal(await page.locator('a-card').evaluate(n => n.shadowRoot), null)
    })
    test(`${engine.name()}: ${framework} Card ARIA references remain live on the native link`, async t => {
      const page = await pageFor(t, engine)
      await page.evaluate(framework => import(`/${framework}.js`), framework)
      await page.evaluate(() => {
        const label = document.createElement('h2')
        label.id = 'external-label'
        label.textContent = 'External title'
        document.body.append(label)
        window.renderCard({ href: '#named', 'aria-labelledby': label.id, 'aria-describedby': 'following', 'aria-current': 'page' })
      })
      await page.waitForSelector('a-card > a')
      assert.equal(await page.locator('a-card').getAttribute('aria-labelledby'), null)
      assert.match(await page.locator('body').ariaSnapshot(), /link "External title"/)
      await page.locator('#external-label').evaluate(n => n.textContent = 'Changed title')
      assert.match(await page.locator('body').ariaSnapshot(), /link "Changed title"/)
      await page.evaluate(() => window.renderCard({ href: '#named', 'aria-label': 'Explicit title' }))
      await page.waitForFunction(() => !document.querySelector('a-card > a').hasAttribute('aria-labelledby'))
      assert.match(await page.locator('body').ariaSnapshot(), /link "Explicit title"/)
    })
  }
}
