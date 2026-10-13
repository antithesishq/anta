import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
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
let server, origin

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
  for (const framework of ['React', 'Preact']) {
    const react = framework === 'React'
    const result = await build({
      stdin: {
        contents: `
          import React from 'react'
          import { Card } from '${source}/components/Card'
          import '${source}/elements/a-title.css'
          ${react ? "import { createRoot } from 'react-dom/client'" : "import { render } from 'preact'"}
          ${react ? "const root = createRoot(document.querySelector('#mount'))" : ''}
          window.renderCard = props => {
            const node = React.createElement(Card, {
              header: 'Heading', footer: [React.createElement('button', {key: 1}, 'First'), React.createElement('button', {key: 2}, 'Second')],
              ...props,
            }, React.createElement('div', null, 'Body'))
            ${react ? 'root.render(node)' : "render(node, document.querySelector('#mount'))"}
          }
        `, resolveDir: process.cwd(),
      },
      bundle: true, write: false, outfile: `${framework}.js`, format: 'esm', target: 'es2022',
      jsx: 'automatic', jsxImportSource: '@antadesign/anta',
      define: { 'process.env.NODE_ENV': '"production"' },
      nodePaths: [resolve('node_modules'), resolve('site/node_modules')],
      alias: {
        '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime'),
        ...(react ? { 'react-dom/client': requirePlot.resolve('react-dom/client') } : { react: requireSite.resolve('preact/compat') }),
      },
    })
    for (const file of result.outputFiles) assets.set(`/${framework}.${file.path.endsWith('.css') ? 'css' : 'js'}`, file.text)
  }
  assets.set('/fixture.css', await readFile(new URL('./card-csp.fixture.css', import.meta.url), 'utf8'))
  assets.set('/boot.js', `window.cspViolations=[]; document.addEventListener('securitypolicyviolation', e=>window.cspViolations.push(e.effectiveDirective));`)
  server = createServer((req, res) => {
    res.setHeader('Content-Security-Policy', policy)
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html')
    const url = new URL(req.url, 'http://localhost')
    const mode = url.searchParams.get('mode') || 'granular'
    res.end(assets.get(req.url) ?? `<!doctype html><link rel="stylesheet" href="/${mode}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><main id="mount"></main><div id="following">Following content</div>`)
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

async function pageFor(t, engine, mode = 'granular') {
  const page = await browsers.get(engine).newPage({ reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const response = await page.goto(`${origin}/?mode=${mode}`)
  assert.equal(response.headers()['content-security-policy'], policy)
  t.after(async () => {
    try {
      assert.deepEqual(errors, [])
      assert.deepEqual(await page.evaluate(() => window.cspViolations), [])
    } finally { await page.close() }
  })
  return page
}
const register = (page, mode = 'granular') => page.evaluate(mode => import(`/${mode}.js`), mode)
const markup = '<div slot="media"></div><div slot="icon"></div><h2 slot="header">Heading</h2><span slot="header">Subtitle</span><div>Body</div><a-card-footer slot="footer"><button>First</button><button>Second</button></a-card-footer>'

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
      content: [...card.children].map(node => {
        if (node.slot === 'icon' || node.slot === 'media') return rect(node)
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
  test(`${engine.name()}: Card CSS preserves visible slot geometry before upgrade`, async t => {
    for (const position of ['top', 'bottom', 'left', 'right']) {
      for (const size of ['small', 'medium', 'large']) {
        const page = await pageFor(t, engine)
        await mount(page, markup, { 'media-position': position, size })
        assert.equal(await page.locator('a-card').evaluate(n => getComputedStyle(n).opacity), '1')
        const before = await geometry(page)
        await register(page)
        sameGeometry(before, await geometry(page))
        assert.equal(await page.locator('a-card').evaluate(n => n.shadowRoot.querySelectorAll('style').length), 0)
      }
    }
  })
  test(`${engine.name()}: Card fallback covers missing sections and constrained heights`, async t => {
    for (const variant of ['one-header', 'no-icon', 'icon-only', 'body-only', 'header-only', 'footer-only', 'tall-footer', 'narrow', 'tall', 'rtl', 'nested']) {
      const page = await pageFor(t, engine)
      await mount(page)
      await page.locator('a-card').evaluate((card, variant) => {
        if (variant === 'one-header') card.querySelector('span').remove()
        if (variant === 'no-icon') card.querySelector('[slot="icon"]').remove()
        if (variant === 'icon-only') card.querySelectorAll('[slot="header"]').forEach(n => n.remove())
        if (['body-only', 'header-only', 'footer-only'].includes(variant)) [...card.children].forEach(n => {
          if (variant === 'body-only' && n.slot || variant === 'header-only' && n.slot !== 'header' || variant === 'footer-only' && n.slot !== 'footer') n.remove()
        })
        if (variant === 'tall' || variant === 'narrow') card.className = variant
        if (variant === 'tall-footer') { [...card.children].forEach(n => { if(n.slot !== 'footer') n.remove() }); card.className = 'tall' }
        if (variant === 'nested') card.querySelector(':scope > :not([slot])').innerHTML = '<a-card><div>Nested body</div></a-card>'
        if (variant === 'rtl') card.dir = 'rtl'
      }, variant)
      const before = await geometry(page)
      await register(page)
      sameGeometry(before, await geometry(page))
    }
  })
  test(`${engine.name()}: native Card pointer and keyboard navigation stop while loading`, async t => {
    const page = await pageFor(t, engine)
    await mount(page, '<h2 slot="header">Read more</h2><div>Content</div>', { href: '#pointer' })
    await register(page)
    const link = page.locator('a-card').locator('[part="container"]')
    await link.click()
    await page.waitForURL(url => url.hash === '#pointer')
    await page.locator('a-card').evaluate(n => n.setAttribute('href', '#keyboard'))
    await page.keyboard.press(engine === webkit ? 'Alt+Tab' : 'Tab')
    await link.focus()
    await page.keyboard.press('Enter')
    await page.waitForURL(url => url.hash === '#keyboard')
    await page.locator('a-card').evaluate(n => { n.setAttribute('href', '#blocked'); n.setAttribute('loading', '') })
    const bounds = await page.locator('a-card').boundingBox()
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    assert.equal(new URL(page.url()).hash, '#keyboard')
    await page.locator('a-card').evaluate(n => n.removeAttribute('loading'))
    await link.click()
    await page.waitForURL(url => url.hash === '#blocked')
  })
  test(`${engine.name()}: unsupported flat compositions keep the hidden fallback without node rewrites`, async t => {
    const page = await pageFor(t, engine)
    await mount(page, '<div>First body</div><div>Second body</div>')
    assert.equal(await page.locator('a-card').evaluate(n => getComputedStyle(n).opacity), '0')
    const html = await page.locator('a-card').evaluate(n => n.outerHTML)
    await register(page)
    assert.equal(await page.locator('a-card').evaluate(n => n.outerHTML), html)
    assert.equal(await page.locator('a-card').evaluate(n => getComputedStyle(n).opacity), '1')
    assert.equal(await page.locator('a-card').evaluate(n => getComputedStyle(n.shadowRoot.querySelector('[part="body"]')).display), 'block')
  })
  for (const mode of ['granular', 'bundle']) {
    test(`${engine.name()}: ${mode} Card styles, overrides, animation, and owned link work under CSP`, async t => {
      const page = await pageFor(t, engine, mode)
      await mount(page, markup.replace('<a-card-footer slot="footer"><button>First</button><button>Second</button></a-card-footer>', '<span slot="footer">Footer</span>'), { href: '/destination', target: '_blank', rel: 'noopener', ping: '/ping', 'aria-label': 'Explicit name', role: 'article', selected: '' })
      const html = await page.locator('a-card').evaluate(n => n.outerHTML)
      await page.locator('a-card').evaluate(n => {
        window.ownerMutations = []
        new MutationObserver(records => window.ownerMutations.push(...records.map(r => r.type))).observe(n, { attributes: true, childList: true, subtree: true, characterData: true })
      })
      await register(page, mode)
      assert.equal(await page.locator('a-card').evaluate(n => n.outerHTML), html)
      assert.deepEqual(await page.evaluate(() => window.ownerMutations), [])
      const link = page.locator('a-card').locator('[part="container"]')
      assert.equal(await link.getAttribute('aria-label'), 'Explicit name')
      assert.equal(await link.getAttribute('target'), '_blank')
      assert.equal(await link.getAttribute('rel'), 'noopener')
      assert.equal(await link.getAttribute('ping'), '/ping')
      assert.match(await page.locator('body').ariaSnapshot(), /link "Explicit name"/)
      await page.keyboard.press(engine === webkit ? 'Alt+Tab' : 'Tab')
      assert.equal(await link.evaluate(n => n.matches(':focus-visible')), true)
      assert.notEqual(await link.evaluate(n => getComputedStyle(n).boxShadow), 'none')
      if (engine === chromium) {
        await page.emulateMedia({ forcedColors: 'active' })
        assert.equal(await link.evaluate(n => getComputedStyle(n).outlineStyle), 'solid')
        await page.emulateMedia({ forcedColors: 'none' })
      }
      await page.locator('a-card').evaluate(n => n.setAttribute('loading', ''))
      assert.equal(await link.getAttribute('href'), null)
      assert.equal(await link.getAttribute('aria-busy'), 'true')
      assert.equal(await link.evaluate(n => getComputedStyle(n).pointerEvents), 'none')
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      assert.equal(await page.locator('a-card').evaluate(n => n.shadowRoot.querySelector('[part="content"]').getAnimations().length), 1)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      assert.equal(await page.locator('a-card').evaluate(n => n.shadowRoot.querySelector('[part="content"]').getAnimations().length), 0)
      await page.locator('a-card').evaluate(n => { n.removeAttribute('loading'); n.removeAttribute('href'); n.className = 'override tall' })
      assert.equal(await link.getAttribute('aria-busy'), null)
      assert.equal(await link.getAttribute('aria-label'), null)
      assert.equal(await page.locator('a-card').evaluate(n => getComputedStyle(n.shadowRoot.querySelector('[part="header"]')).paddingBottom), '8px')
      assert.equal(await page.locator('a-card').evaluate(n => getComputedStyle(n.shadowRoot.querySelector('[part="body"]')).overflow), 'auto')
    })
  }
  for (const framework of ['React', 'Preact']) {
    test(`${engine.name()}: ${framework} Card footer layout uses external CSS and renderer-owned attributes`, async t => {
      const page = await pageFor(t, engine)
      await page.addStyleTag({ url: `${origin}/${framework}.css` })
      await page.evaluate(framework => import(`/${framework}.js`), framework)
      await page.evaluate(() => window.renderCard({ href: '/first', 'aria-label': 'First name', role: 'article', 'data-owner': 'app' }))
      await page.waitForSelector('a-card', { state: 'attached' })
      assert.equal(await page.locator('a-card-footer').getAttribute('style'), null)
      const before = await geometry(page)
      const html = await page.locator('a-card').evaluate(n => n.outerHTML)
      await register(page)
      sameGeometry(before, await geometry(page))
      assert.equal(await page.locator('a-card').evaluate(n => n.outerHTML), html)
      assert.equal(await page.locator('a-card-footer').evaluate(n => getComputedStyle(n).display), 'contents')
      await page.evaluate(() => window.renderCard({ href: '/second', 'aria-label': 'Second name', role: 'article', 'data-owner': 'app', loading: true }))
      await page.waitForFunction(() => document.querySelector('a-card').hasAttribute('loading'))
      const state = await page.locator('a-card').evaluate(n => ({
        href: n.getAttribute('href'), role: n.getAttribute('role'), label: n.getAttribute('aria-label'), owner: n.dataset.owner,
        linkHref: n.shadowRoot.querySelector('a').getAttribute('href'), busy: n.shadowRoot.querySelector('a').getAttribute('aria-busy'),
      }))
      assert.deepEqual(state, { href: '/second', role: 'article', label: 'Second name', owner: 'app', linkHref: null, busy: 'true' })
    })
  }
}
