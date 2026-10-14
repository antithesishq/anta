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
  for (const mode of ['granular', 'bundle', 'tooltip', 'text', 'button']) {
    const imports = mode === 'bundle'
      ? `import '${source}/bundle'; ${process.env.ANTA_TEXT_PACKAGE_ROOT ? `import '${source}/bundle.css';` : ''}`
      : `import '${source}/tokens.css'; import '${source}/reset.css'; ${mode !== 'button' ? `import '${source}/elements/a-text';` : ''} ${mode !== 'text' ? `import '${source}/elements/a-button';` : ''} ${mode === 'tooltip' ? `import '${source}/elements/a-tooltip';` : ''}`
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
        window.renderLinkedText = (props = {}) => window.renderText({
          truncate: 3, expandable: true, collapsible: true,
          children: [React.createElement('a', { href: '#content-link', key: 'link' }, 'Content link'), ${JSON.stringify(longText)}], ...props,
        })
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
    res.end(assets.get(req.url) ?? `<!doctype html><link rel="stylesheet" href="/${mode}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><main id="mount">${url.searchParams.has('ssr') ? renderServer({ ...initialProps, ...(url.searchParams.has('inert') ? { expandableInert: true } : {}) }) : ''}</main><div id="following">Following content</div>`)
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
  await page.goto(`${origin}/?mode=${mode}${ssr ? '&ssr=1' : ''}${ssr === 'inert' ? '&inert=1' : ''}`)
  t.after(async () => {
    try { assert.deepEqual(errors, []); assert.deepEqual(await page.evaluate(() => window.cspViolations ?? []), []) }
    finally { await page.close() }
  })
  return page
}
const register = (page, mode = 'granular') => page.evaluate(mode => import(`/${mode}.js`), mode)
const raw = (lines = 1, collapsible = true) => `<a-text truncate="${lines}" expandable ${collapsible ? 'collapsible' : ''}><a-button role="button" tabindex="0" priority="quaternary" paddingless></a-button><a-text-content>${longText}</a-text-content></a-text>`
const mount = (page, html) => page.locator('#mount').evaluate((n, html) => n.innerHTML = html, html)
const geometry = page => page.locator('#mount').evaluate(n => [...n.querySelectorAll('a-text, a-text-content'), document.querySelector('#following')].map(n => { const r=n.getBoundingClientRect(); return [r.x,r.y,r.width,r.height] }))
const expanded = page => page.locator('#mount > a-text').evaluate(n => n.matches(':state(expanded)'))
const buttonState = page => page.locator('#mount > a-text > a-button').evaluate(n => ({ label: window.elementInternals.get(n).ariaLabel, expanded: window.elementInternals.get(n).ariaExpanded }))

for (const engine of engines) {
  test(`${engine.name()}: expandableInert covers the preview and restores content interaction`, async t => {
    for (const framework of ['React', 'Preact']) {
      const page = await pageFor(t, engine)
      await register(page)
      await page.evaluate(framework => import(`/${framework}.js`), framework)
      await page.evaluate(() => window.renderLinkedText({ expandableInert: true }))
      const root = page.locator('#mount > a-text')
      const content = root.locator('a-text-content')
      const control = root.locator('a-button')
      await page.waitForFunction(() => document.querySelector('a-text-content')?.inert)
      assert.equal(await content.locator('a').evaluate(n => { n.focus(); return n === document.activeElement }), false)
      const tab = engine === webkit ? 'Alt+Tab' : 'Tab'
      await control.focus()
      await page.keyboard.press(tab)
      assert.equal(await content.locator('a').evaluate(n => n === document.activeElement), false)
      for (const truncate of [3, true]) {
        await page.evaluate(truncate => window.renderLinkedText({ truncate, expandableInert: true }), truncate)
        await page.waitForFunction(() => document.querySelector('a-text-content')?.inert)
        assert.deepEqual(await control.boundingBox(), await root.boundingBox(), `${framework} truncate=${truncate}`)
        await control.click({ position: { x: 5, y: 5 } })
        await page.waitForFunction(() => !document.querySelector('a-text-content').inert)
        assert.equal(await expanded(page), true)
        assert.equal((await control.boundingBox()).height, 16)
        await control.focus()
        await page.keyboard.press(tab)
        assert.equal(await content.locator('a').evaluate(n => n === document.activeElement), true)
        await control.click()
        await page.waitForFunction(() => document.querySelector('a-text-content').inert)
      }
      // Changing the prop does not replace the host or its expansion state.
      await root.evaluate(n => window.originalText = n)
      await page.evaluate(() => window.renderLinkedText({ expandableInert: false }))
      await page.waitForFunction(() => !document.querySelector('a-text-content').inert)
      assert.equal(await root.evaluate(n => n === window.originalText), true)
      await page.evaluate(() => window.renderLinkedText({ expandableInert: true, children: 'Fits' }))
      await control.waitFor({ state: 'hidden' })
      assert.equal(await content.evaluate(n => n.inert), false)
      await page.evaluate(() => window.renderLinkedText({ expandableInert: true }))
      await page.waitForFunction(() => document.querySelector('a-text-content').inert)
      await root.evaluate(n => n.classList.add('wide'))
      await page.waitForFunction(() => !document.querySelector('a-text-content').inert)
      await root.evaluate(n => n.classList.remove('wide'))
      await page.waitForFunction(() => document.querySelector('a-text-content').inert)
      await page.evaluate(() => window.renderLinkedText({ expandableInert: true, collapsible: false }))
      await control.click()
      await control.waitFor({ state: 'hidden' })
      await page.waitForFunction(() => !document.querySelector('a-text-content').inert)
    }
  })
  test(`${engine.name()}: expandableInert hydrates before or after Text upgrade`, async t => {
    for (const framework of ['React', 'Preact']) {
      for (const lateUpgrade of [true, false]) {
        const page = await pageFor(t, engine, 'granular', 'inert')
        assert.equal(await page.locator('a-text-content').evaluate(n => n.inert), false)
        if (!lateUpgrade) {
          await register(page)
          await page.locator('a-button').waitFor({ state: 'visible' })
          // Ensure the initial observer notifications have already been delivered.
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        }
        await page.evaluate(framework => import(`/${framework}.js`), framework)
        await page.evaluate(props => window.hydrateText(props), { ...initialProps, expandableInert: true })
        if (lateUpgrade) await register(page)
        await page.waitForFunction(() => document.querySelector('a-text-content').inert)
        await page.locator('a-button').click({ position: { x: 5, y: 5 } })
        await page.waitForFunction(() => !document.querySelector('a-text-content').inert)
        assert.equal(await expanded(page), true)
      }
    }
  })
  test(`${engine.name()}: raw expandable-inert reports presentation without owning inert`, async t => {
    const page = await pageFor(t, engine)
    await mount(page, raw().replace(' expandable ', ' expandable expandable-inert '))
    const html = await page.locator('a-text').evaluate(n => n.outerHTML)
    await register(page)
    await page.locator('a-button').waitFor({ state: 'visible' })
    await page.locator('a-text').evaluate(n => {
      window.presentations = []
      n.addEventListener('textpresentationchange', e => window.presentations.push(e.detail))
    })
    await page.waitForFunction(() => window.presentations.length > 0)
    assert.deepEqual(await page.evaluate(() => window.presentations.at(-1)), { expanded: false, overflowing: true })
    assert.equal(await page.locator('a-text-content').evaluate(n => n.inert), false)
    await page.locator('a-button').click()
    await page.waitForFunction(() => window.presentations.at(-1).expanded)
    assert.equal(await page.locator('a-text').evaluate(n => n.outerHTML), html)
  })
  test(`${engine.name()}: Text expansion control precedes content links in Tab order`, async t => {
    for (const framework of ['raw', 'React', 'Preact']) {
      const page = await pageFor(t, engine)
      await register(page)
      await page.evaluate(() => {
        const before = document.createElement('a')
        before.href = '#before'
        before.id = 'before-text'
        before.textContent = 'Before Text'
        document.querySelector('#mount').before(before)
      })
      if (framework === 'raw') {
        await mount(page, raw(3).replace(longText, `<a href="#content-link">Content link</a> ${longText}`))
      } else {
        await page.evaluate(framework => import(`/${framework}.js`), framework)
        await page.evaluate(() => window.renderLinkedText())
      }
      const control = page.locator('#mount > a-text > a-button')
      await control.waitFor({ state: 'visible' })
      await page.locator('#before-text').focus()
      const tab = engine === webkit ? 'Alt+Tab' : 'Tab'
      await page.keyboard.press(tab)
      assert.equal(await control.evaluate(n => n === document.activeElement), true, framework)
      await page.keyboard.press(engine === webkit ? 'Alt+Shift+Tab' : 'Shift+Tab')
      assert.equal(await page.locator('#before-text').evaluate(n => n === document.activeElement), true, framework)
      await page.keyboard.press(tab)
      await page.keyboard.press('Enter')
      assert.equal(await expanded(page), true)
      await page.keyboard.press(tab)
      assert.equal(await page.locator('a[href="#content-link"]').evaluate(n => n === document.activeElement), true, framework)
    }
  })
  test(`${engine.name()}: folded expandable Text cannot scroll to clipped links`, async t => {
    const page = await pageFor(t, engine)
    await register(page)
    await mount(page, raw(3).replace(longText, `${longText} <a href="#hidden-link">Hidden link</a>`))
    const content = page.locator('a-text-content')
    await page.locator('a-button').waitFor({ state: 'visible' })
    await content.locator('a').focus()
    assert.equal(await content.evaluate(n => n.scrollTop), 0)
    await content.evaluate(n => { n.scrollTop = 100 })
    assert.equal(await content.evaluate(n => n.scrollTop), 0)
    await page.locator('a-button').click()
    await content.locator('a').click()
    await page.waitForURL(url => url.hash === '#hidden-link')
  })
  test(`${engine.name()}: Text toggle accessibility survives mixed bundle and granular imports`, async t => {
    for (const entry of ['text', 'button']) {
      for (const order of [[entry, 'bundle'], ['bundle', entry]]) {
        const page = await pageFor(t, engine)
        await mount(page, raw())
        const html = await page.locator('a-text').evaluate(n => n.outerHTML)
        for (const mode of order) await register(page, mode)
        await page.locator('a-button').waitFor({ state: 'visible' })
        assert.deepEqual(await buttonState(page), { label: 'Show more', expanded: 'false' }, order.join(' → '))
        if (engine === chromium) {
          const session = await page.context().newCDPSession(page)
          const tree = await session.send('Accessibility.getFullAXTree')
          assert.ok(tree.nodes.some(n => n.role?.value === 'button' && n.name?.value === 'Show more'
            && n.properties?.some(p => p.name === 'expanded' && p.value.value === false)), order.join(' → '))
          await session.detach()
        }
        await page.locator('a-button').click()
        assert.equal(await expanded(page), true)
        assert.deepEqual(await buttonState(page), { label: 'Show less', expanded: 'true' }, order.join(' → '))
        assert.equal(await page.locator('a-text').evaluate(n => n.outerHTML), html)
      }
    }
  })
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
  test(`${engine.name()}: Text control hit areas match truncation and preserve expanded links`, async t => {
    const page = await pageFor(t, engine)
    await register(page)
    for (const direction of ['ltr', 'rtl']) {
      for (const lines of [1, 3]) {
        await mount(page, raw(lines).replace('<a-text ', `<a-text dir="${direction}" `).replace(longText,
          `<a href="#collapsed-link">Visible link</a><br>Second line<br>Third line<br>${longText} <a href="#last-link">Guide</a>`))
        const root = page.locator('#mount > a-text')
        const control = root.locator(':scope > a-button')
        await control.waitFor({ state: 'visible' })
        assert.ok(await control.evaluate((n, lines) => {
          const button = n.getBoundingClientRect(), root = n.parentElement.getBoundingClientRect()
          return lines === 1
            ? Math.abs(button.width - 3 * parseFloat(getComputedStyle(n).fontSize)) <= 0.5
            : Math.abs(button.width - root.width) <= 0.5
        }, lines))
        const assertControlClear = async () => assert.ok(await root.evaluate(n => {
          const content = n.querySelector(':scope > a-text-content').getBoundingClientRect()
          const button = n.querySelector(':scope > a-button').getBoundingClientRect()
          const root = n.getBoundingClientRect()
          const controlArea = n.matches(':state(expanded)')
            ? content.bottom <= button.top + 0.5 && button.bottom <= root.bottom + 0.5
              && Math.abs(button.height - 16) <= 0.5 && Math.abs(button.width - root.width) <= 0.5
            : Math.abs(content.height - root.height) <= 0.5
          return Math.abs(content.width - root.width) <= 0.5
            && controlArea
        }), `${direction}: expanded control must occupy padding without narrowing text`)
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
