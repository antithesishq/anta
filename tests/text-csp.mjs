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
const source = resolve(process.env.ANTA_TEXT_PACKAGE_ROOT ? `${process.env.ANTA_TEXT_PACKAGE_ROOT}/dist` : 'src')
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; object-src 'none'"
const longText = 'The quick brown fox jumps over the lazy dog repeatedly while the morning sun rises over a sleepy town that nobody has visited in years. Down by the river the old mill still turns, and the market stalls creak open one by one in the early light.'
const initialProps = { truncate: true, expandable: true, collapsible: true, children: longText, 'data-owner': 'app' }
const factory = `const node = props => React.createElement(Text, props, props.children ?? ${JSON.stringify(longText)})`
const browsers = new Map()
let server, origin, renderServer

before(async () => {
  const assets = new Map()
  for (const mode of ['granular', 'bundle', 'tooltip']) {
    const imports = mode === 'bundle'
      ? `import '${source}/bundle'; ${process.env.ANTA_TEXT_PACKAGE_ROOT ? `import '${source}/bundle.css';` : ''}`
      : `import '${source}/tokens.css'; import '${source}/reset.css'; import '${source}/elements/a-text'; import '${source}/elements/a-button'; ${mode === 'tooltip' ? `import '${source}/elements/a-tooltip';` : ''}`
    const result = await build({
      stdin: { contents: imports, resolveDir: process.cwd() }, bundle: true, write: false,
      outfile: `${mode}.js`, format: 'esm', target: 'es2022',
      alias: { react: requireSite.resolve('preact/compat') }, nodePaths: [resolve('node_modules')],
    })
    for (const file of result.outputFiles) assets.set(`/${mode}.${file.path.endsWith('.css') ? 'css' : 'js'}`, file.text)
  }
  const result = await build({
    stdin: { contents: `import React from 'react'; import {Text} from '${source}/components/Text'; import {renderToString} from 'react-dom/server'; ${factory}; export const render = props => renderToString(node(props));`, resolveDir: process.cwd() },
    bundle: true, write: false, platform: 'node', format: 'cjs', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta', nodePaths: [resolve('node_modules')],
    alias: { '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime'), 'react-dom/server': requirePlot.resolve('react-dom/server'), react: resolve('node_modules/react') },
  })
  const compiled = new Module(resolve('tests/text-server.cjs'))
  compiled._compile(result.outputFiles[0].text, compiled.id)
  renderServer = compiled.exports.render
  assert.doesNotMatch(renderServer(initialProps), /style=/)
  assert.doesNotMatch(renderServer({ children: 'Ordinary text' }), /a-text-content|a-button/)
  for (const framework of ['React', 'Preact']) {
    const react = framework === 'React'
    const result = await build({
      stdin: { contents: `
        import React from 'react'
        import {Text} from '${source}/components/Text'
        ${react ? "import {createRoot, hydrateRoot} from 'react-dom/client'" : "import {render, hydrate} from 'preact'"}
        ${factory}
        ${react ? 'let root' : ''}
        window.renderText = props => { ${react ? "root ??= createRoot(document.querySelector('#mount')); root.render(node(props))" : "render(node(props), document.querySelector('#mount'))"} }
        window.hydrateText = props => { ${react ? "root = hydrateRoot(document.querySelector('#mount'), node(props))" : "hydrate(node(props), document.querySelector('#mount'))"} }
      `, resolveDir: process.cwd() }, bundle: true, write: false, outfile: `${framework}.js`,
      format: 'esm', target: 'es2022', jsx: 'automatic', jsxImportSource: '@antadesign/anta',
      define: { 'process.env.NODE_ENV': '"production"' }, nodePaths: [resolve('node_modules'), resolve('site/node_modules')],
      alias: { '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime'),
        ...(react ? { 'react-dom/client': requirePlot.resolve('react-dom/client'), react: resolve('node_modules/react') } : { react: requireSite.resolve('preact/compat') }),
      },
    })
    assets.set(`/${framework}.js`, result.outputFiles.find(f => f.path.endsWith('.js')).text)
  }
  assets.set('/fixture.css', await readFile(new URL('./text-csp.fixture.css', import.meta.url), 'utf8'))
  assets.set('/boot.js', `
    window.cspViolations=[];
    document.addEventListener('securitypolicyviolation', e=>window.cspViolations.push(e.effectiveDirective));
    window.elementInternals=new WeakMap();
    const attach=HTMLElement.prototype.attachInternals;
    HTMLElement.prototype.attachInternals=function(){ const i=attach.call(this); window.elementInternals.set(this,i); return i; };
  `)
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const mode = url.searchParams.get('mode') || 'granular'
    // Tooltip has its own pending migration; this one interaction test allows
    // its current inline stylesheet without relaxing style attributes.
    res.setHeader('Content-Security-Policy', mode === 'tooltip' ? policy.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'") : policy)
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(assets.get(req.url) ?? `<!doctype html><link rel="stylesheet" href="/${mode}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><main id="mount">${url.searchParams.has('ssr') ? renderServer(initialProps) : ''}</main><div id="following">Following content</div>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  for (const engine of engines) browsers.set(engine, await engine.launch({ headless: true,
    ...(engine === chromium ? { channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined } : {}),
  }))
})

after(async () => {
  await Promise.all([...browsers.values()].map(browser => browser.close()))
  if (server) await new Promise(resolve => server.close(resolve))
})

async function pageFor(t, engine, mode = 'granular', ssr = false, javaScriptEnabled = true) {
  const page = await browsers.get(engine).newPage({ javaScriptEnabled, reducedMotion: 'reduce' })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${origin}/?mode=${mode}${ssr ? '&ssr=1' : ''}`)
  t.after(async () => {
    try { assert.deepEqual(errors, []); assert.deepEqual(await page.evaluate(() => window.cspViolations ?? []), []) }
    finally { await page.close() }
  })
  return page
}
const register = (page, mode = 'granular') => page.evaluate(mode => import(`/${mode}.js`), mode)
const raw = (lines = 1, collapsible = true) => `<a-text truncate="${lines}" expandable ${collapsible ? 'collapsible' : ''}><a-text-content>${longText}</a-text-content><a-button role="button" tabindex="0" priority="quaternary" paddingless></a-button></a-text>`
const mount = (page, html) => page.locator('#mount').evaluate((n, html) => n.innerHTML = html, html)
const geometry = page => page.locator('#mount').evaluate(n => [...n.querySelectorAll('a-text, a-text-content'), document.querySelector('#following')].map(n => { const r=n.getBoundingClientRect(); return [r.x,r.y,r.width,r.height] }))
const expanded = page => page.locator('#mount > a-text').evaluate(n => n.matches(':state(expanded)'))
const buttonState = page => page.locator('#mount > a-text > a-button').evaluate(n => ({ label: window.elementInternals.get(n).ariaLabel, expanded: window.elementInternals.get(n).ariaExpanded }))

for (const engine of engines) {
  test(`${engine.name()}: Text SSR clamps in light DOM with JavaScript disabled`, async t => {
    const page = await pageFor(t, engine, 'granular', true, false)
    assert.equal(await page.locator('a-text-content').evaluate(n => getComputedStyle(n).webkitLineClamp), '1')
    assert.equal(await page.locator('a-text-content').evaluate(n => n.clientHeight), 20)
    assert.equal(await page.locator('a-button').isVisible(), false)
  })
  for (const mode of ['granular', 'bundle']) {
    test(`${engine.name()}: ${mode} raw Text expands automatically without DOM mutation under CSP`, async t => {
      const page = await pageFor(t, engine, mode)
      await mount(page, raw())
      const before = await geometry(page)
      const html = await page.locator('a-text').evaluate(n => {
        window.authoredMutations=[];
        new MutationObserver(records=>window.authoredMutations.push(...records.map(r=>r.type))).observe(n,{childList:true,subtree:true,characterData:true,attributes:true});
        return n.outerHTML;
      })
      await register(page, mode)
      await page.locator('a-button').waitFor({ state: 'visible' })
      assert.deepEqual(await geometry(page), before)
      assert.deepEqual(await buttonState(page), { label: 'Show more', expanded: 'false' })
      await page.locator('a-button').click()
      assert.equal(await expanded(page), true)
      assert.deepEqual(await buttonState(page), { label: 'Show less', expanded: 'true' })
      assert.equal(await page.locator('a-text').evaluate(n => n.isTruncated), false)
      await page.locator('a-button').focus()
      await page.keyboard.press('Space')
      assert.equal(await expanded(page), false)
      await page.keyboard.press('Enter')
      assert.equal(await expanded(page), true)
      assert.equal(await page.locator('a-text').evaluate(n => n.outerHTML), html)
      assert.deepEqual(await page.evaluate(() => window.authoredMutations), [])
      assert.equal(await page.locator('a-text').evaluate(n => n.shadowRoot), null)
      assert.equal(await page.locator('a-button').evaluate(n => n.shadowRoot), null)
      if (engine === chromium) {
        const session = await page.context().newCDPSession(page)
        const tree = await session.send('Accessibility.getFullAXTree')
        assert.ok(tree.nodes.some(n => n.role?.value === 'button' && n.name?.value === 'Show less' && n.properties?.some(p => p.name === 'expanded' && p.value.value === true)))
        await session.detach()
      }
    })
  }
  test(`${engine.name()}: Text handles content, width, mode changes, and explicit ARIA`, async t => {
    const page = await pageFor(t, engine)
    await register(page)
    await mount(page, raw(3))
    const root = page.locator('#mount > a-text')
    const control = root.locator(':scope > a-button')
    await control.waitFor({ state: 'visible' })
    await root.evaluate(n => n.classList.add('override'))
    assert.equal(await root.locator('a-text-content').evaluate(n => getComputedStyle(n).color), 'rgb(255, 0, 0)')
    assert.equal(await control.evaluate(n => getComputedStyle(n, '::before').borderBottomWidth), '2px')
    assert.equal(await root.locator('a-text-content').evaluate(n => n.clientHeight), 60)
    await root.evaluate(n => n.classList.add('wide'))
    await control.waitFor({ state: 'hidden' })
    await root.evaluate(n => n.classList.remove('wide'))
    await control.waitFor({ state: 'visible' })
    await control.evaluate(n => n.setAttribute('aria-label', 'Read description'))
    if (engine === chromium) {
      const session = await page.context().newCDPSession(page)
      const tree = await session.send('Accessibility.getFullAXTree')
      assert.ok(tree.nodes.some(n => n.role?.value === 'button' && n.name?.value === 'Read description'))
      await session.detach()
    }
    await control.click()
    await root.evaluate(n => n.setAttribute('truncate', n.getAttribute('truncate')))
    assert.equal(await expanded(page), true)
    await root.locator('a-text-content').evaluate(n => n.textContent = 'Short text')
    await control.click()
    await control.waitFor({ state: 'hidden' })
    assert.equal(await expanded(page), false)
    await root.locator('a-text-content').evaluate((n,text) => n.textContent=text, longText)
    await control.waitFor({ state: 'visible' })
    await root.evaluate(n => n.removeAttribute('collapsible'))
    await control.click()
    await control.waitFor({ state: 'hidden' })
    assert.equal(await expanded(page), true)
    await root.evaluate(n => n.setAttribute('truncate', '1'))
    await control.waitFor({ state: 'visible' })
    assert.equal(await expanded(page), false)
    await root.evaluate(n => n.removeAttribute('expandable'))
    assert.equal(await root.evaluate(n => n.matches(':state(overflowing)')), false)
    await control.waitFor({ state: 'hidden' })
    assert.deepEqual(await buttonState(page), { label: null, expanded: null })
  })
  test(`${engine.name()}: plain Text has no wrapper; inline clamps and nested expansion stay independent`, async t => {
    const page = await pageFor(t, engine)
    await register(page)
    await mount(page, `<a-text inline truncate="1">${longText}</a-text>`)
    assert.equal(await page.locator('a-text').evaluate(n => n.clientHeight), 20)
    assert.equal(await page.locator('a-text').evaluate(n => n.isTruncated), true)
    await mount(page, raw().replace('<a-text ', '<a-text dir="rtl" '))
    await page.locator('a-button').waitFor({ state: 'visible' })
    assert.match(await page.locator('a-text-content').evaluate(n => getComputedStyle(n).maskImage), /to left/)
    assert.equal(await page.locator('a-button').evaluate(n => Math.round(n.getBoundingClientRect().left - n.parentElement.getBoundingClientRect().left)), 0)
    await mount(page, raw(3).replace(longText, `${longText}${raw()}`))
    const inner = page.locator('a-text-content > a-text')
    const innerControl = inner.locator(':scope > a-button')
    await innerControl.waitFor({ state: 'visible' })
    await innerControl.evaluate(n => n.click())
    assert.equal(await inner.evaluate(n => n.matches(':state(expanded)')), true)
    assert.equal(await expanded(page), false)
  })
  for (const framework of ['React', 'Preact']) {
    test(`${engine.name()}: ${framework} Text hydrates and preserves automatic expansion across reconciliation`, async t => {
      const page = await pageFor(t, engine, 'granular', true)
      const before = await geometry(page)
      const html = await page.locator('a-text').evaluate(n => n.outerHTML)
      await register(page)
      await page.evaluate(framework => import(`/${framework}.js`), framework)
      await page.evaluate(props => window.hydrateText(props), initialProps)
      await page.locator('a-button').waitFor({ state: 'visible' })
      assert.equal(await page.locator('a-text').evaluate(n => n.outerHTML), html)
      assert.deepEqual(await geometry(page), before)
      await page.locator('a-button').click()
      assert.equal(await expanded(page), true)
      await page.evaluate(props => window.renderText({ ...props, children: `${props.children} Updated.` }), initialProps)
      await page.waitForFunction(() => document.querySelector('a-text-content').textContent.endsWith('Updated.'))
      assert.equal(await expanded(page), true)
      assert.deepEqual(await buttonState(page), { label: 'Show less', expanded: 'true' })
      await page.evaluate(props => window.renderText({ ...props, truncate: 3 }), initialProps)
      await page.waitForFunction(() => document.querySelector('a-text').getAttribute('truncate') === '3')
      assert.equal(await expanded(page), false)
      await page.locator('a-button').click()
      await page.evaluate(() => window.renderText({ children: 'Plain replacement', 'aria-label': 'Authored label' }))
      await page.waitForFunction(() => !document.querySelector('a-text-content'))
      assert.equal(await page.locator('a-button').count(), 0)
      assert.equal(await page.locator('a-text').getAttribute('aria-label'), 'Authored label')
      assert.equal(await page.locator('a-text').evaluate(n => n.shadowRoot), null)
    })
  }
  test(`${engine.name()}: Text controls leave collapsed and expanded content links clickable`, async t => {
    const page = await pageFor(t, engine)
    await register(page)
    for (const direction of ['ltr', 'rtl']) {
      await mount(page, raw(3).replace('<a-text ', `<a-text dir="${direction}" `).replace(longText,
        `First line<br>Second line<br><a href="#collapsed-link">Visible link</a><br>${longText} <a href="#last-link">Guide</a>`))
      const root = page.locator('#mount > a-text')
      const control = root.locator(':scope > a-button')
      await control.waitFor({ state: 'visible' })
      assert.ok(await control.evaluate(n => n.getBoundingClientRect().width < n.parentElement.getBoundingClientRect().width / 4))
      const assertControlClear = async () => assert.ok(await root.evaluate(n => {
        const content = n.querySelector(':scope > a-text-content').getBoundingClientRect()
        const button = n.querySelector(':scope > a-button').getBoundingClientRect()
        if (n.matches(':state(expanded)')) {
          const root = n.getBoundingClientRect()
          return content.bottom <= button.top + 0.5 && Math.abs(content.width - root.width) <= 0.5
        }
        return getComputedStyle(n).direction === 'rtl'
          ? button.right <= content.left + 0.5
          : content.right <= button.left + 0.5
      }), `${direction}: control must stay clear of text and allow full-width expanded content`)
      await assertControlClear()
      await root.locator('a[href="#collapsed-link"]').click()
      await page.waitForURL(url => url.hash === '#collapsed-link')
      assert.equal(await expanded(page), false)
      await control.click()
      assert.equal(await expanded(page), true)
      await assertControlClear()
      await root.locator('a[href="#last-link"]').click()
      await page.waitForURL(url => url.hash === '#last-link')
      assert.equal(await expanded(page), true)
      await root.locator('a[href="#collapsed-link"]').focus()
      await page.keyboard.press('Enter')
      await page.waitForURL(url => url.hash === '#collapsed-link')
      assert.equal(await expanded(page), true)
      await control.click()
      assert.equal(await expanded(page), false)
    }
  })
  test(`${engine.name()}: Text handles a late Button upgrade and clears defaults when its control moves`, async t => {
    const page = await pageFor(t, engine)
    await page.evaluate(() => {
      const define = customElements.define.bind(customElements)
      customElements.define = (name, cls, options) => {
        if (name === 'a-button') window.releaseButton = () => define(name, cls, options)
        else define(name, cls, options)
      }
    })
    await mount(page, raw())
    await register(page)
    assert.equal(await page.locator('a-button').evaluate(n => window.elementInternals.has(n)), false)
    await page.evaluate(() => window.releaseButton())
    assert.deepEqual(await buttonState(page), { label: 'Show more', expanded: 'false' })
    await page.locator('a-button').click()
    assert.equal(await expanded(page), true)
    await page.locator('a-button').evaluate(n => document.body.append(n))
    assert.deepEqual(await page.locator('body > a-button').evaluate(n => ({ label: window.elementInternals.get(n).ariaLabel, expanded: window.elementInternals.get(n).ariaExpanded })), { label: null, expanded: null })
    await page.locator('body > a-button').evaluate(n => document.querySelector('a-text').append(n))
    assert.deepEqual(await buttonState(page), { label: 'Show less', expanded: 'true' })
  })
  test(`${engine.name()}: Text automatic tooltip still measures the light-DOM clamp`, async t => {
    const page = await pageFor(t, engine, 'tooltip')
    await register(page, 'tooltip')
    await page.evaluate(() => import('/Preact.js'))
    await page.evaluate(() => window.renderText({ truncate: true }))
    await page.locator('a-text > a-tooltip').waitFor({ state: 'attached' })
    await page.locator('a-tooltip').evaluate(n => n.show())
    assert.equal(await page.locator('a-tooltip').evaluate(n => n.shadowRoot.querySelector('[popover]').matches(':popover-open')), true)
    assert.equal(await page.locator('a-tooltip').evaluate(n => n.shadowRoot.querySelector('[popover]').textContent), longText)
    await page.evaluate(() => window.renderText({ truncate: true, children: 'Short' }))
    await page.waitForFunction(() => document.querySelector('a-text').textContent === 'Short')
    await page.locator('a-tooltip').evaluate(n => { n.hide(); n.show() })
    assert.equal(await page.locator('a-tooltip').evaluate(n => n.shadowRoot.querySelector('[popover]').matches(':popover-open')), false)
  })
}
