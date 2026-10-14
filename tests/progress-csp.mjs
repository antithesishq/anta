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
const { PNG } = requireSite('pngjs')
const engines = process.env.ANTA_TEST_WEBKIT === '0' ? [chromium] : [chromium, firefox, webkit]
const source = process.env.ANTA_PROGRESS_PACKAGE_ROOT ? resolve(process.env.ANTA_PROGRESS_PACKAGE_ROOT, 'dist') : resolve('src')
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; object-src 'none'"
const browsers = new Map()
const initialProps = { value: 42, label: 'Upload', hint: '3 of 7', 'data-owner': 'app' }
const factory = `const node = props => React.createElement(Progress, props)`
let server, origin, renderServer

before(async () => {
  const assets = new Map()
  for (const mode of ['granular', 'bundle']) {
    const contents = mode === 'bundle'
      ? `import '${source}/bundle'; ${process.env.ANTA_PROGRESS_PACKAGE_ROOT ? `import '${source}/bundle.css';` : ''}`
      : `import '${source}/tokens.css'; import '${source}/reset.css'; import '${source}/elements/a-progress';`
    const result = await build({ stdin: { contents, resolveDir: process.cwd() }, bundle: true, write: false,
      outfile: `${mode}.js`, format: 'esm', target: 'es2022',
      alias: { react: requireSite.resolve('preact/compat') }, nodePaths: [resolve('node_modules')],
    })
    for (const file of result.outputFiles) assets.set(`/${mode}.${file.path.endsWith('.css') ? 'css' : 'js'}`, file.text)
    assert.ok(assets.has(`/${mode}.css`))
  }
  const result = await build({
    stdin: { contents: `import React from 'react'; import {Progress} from '${source}/components/Progress'; import {renderToString} from 'react-dom/server'; ${factory}; export const render = props => renderToString(node(props));`, resolveDir: process.cwd() },
    bundle: true, write: false, platform: 'node', format: 'cjs', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta', nodePaths: [resolve('node_modules')],
    alias: { '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime'), 'react-dom/server': requirePlot.resolve('react-dom/server'), react: resolve('node_modules/react') },
  })
  const compiled = new Module(resolve('tests/progress-server.cjs'))
  compiled._compile(result.outputFiles[0].text, compiled.id)
  renderServer = compiled.exports.render
  assert.doesNotMatch(renderServer(initialProps), /style=/)
  for (const framework of ['React', 'Preact']) {
    const react = framework === 'React'
    const result = await build({
      stdin: { contents: `
        import React from 'react'
        import {Progress} from '${source}/components/Progress'
        ${react ? "import {createRoot, hydrateRoot} from 'react-dom/client'" : "import {render, hydrate} from 'preact'"}
        ${factory}
        ${react ? 'let root' : ''}
        window.renderProgress = props => { ${react ? "root ??= createRoot(document.querySelector('#mount')); root.render(node(props))" : "render(node(props), document.querySelector('#mount'))"} }
        window.hydrateProgress = props => { ${react ? "root = hydrateRoot(document.querySelector('#mount'), node(props))" : "hydrate(node(props), document.querySelector('#mount'))"} }
        window.renderLinked = () => window.renderProgress({value: 60, label: 'Task', children: React.createElement('a', {href: '#linked'}, 'Task details')})
      `, resolveDir: process.cwd() }, bundle: true, write: false, outfile: `${framework}.js`, format: 'esm', target: 'es2022',
      jsx: 'automatic', jsxImportSource: '@antadesign/anta', define: { 'process.env.NODE_ENV': '"production"' },
      nodePaths: [resolve('node_modules'), resolve('site/node_modules')],
      alias: { '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime'),
        ...(react ? { 'react-dom/client': requirePlot.resolve('react-dom/client'), react: resolve('node_modules/react') } : { react: requireSite.resolve('preact/compat') }),
      },
    })
    assets.set(`/${framework}.js`, result.outputFiles.find(file => file.path.endsWith('.js')).text)
  }
  assets.set('/fixture.css', await readFile(new URL('./progress-csp.fixture.css', import.meta.url), 'utf8'))
  assets.set('/boot.js', `window.cspViolations=[]; document.addEventListener('securitypolicyviolation', e=>window.cspViolations.push(e.effectiveDirective));`)
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const mode = url.searchParams.get('mode') || 'granular'
    res.setHeader('Content-Security-Policy', policy)
    res.setHeader('Content-Type', `${req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html'}; charset=utf-8`)
    const props = { ...initialProps, ...(url.searchParams.has('pixel') ? { className: 'pixel' } : {}), ...(url.searchParams.has('loading') ? { value: false } : {}) }
    res.end(assets.get(req.url) ?? `<!doctype html><link rel="stylesheet" href="/${mode}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><main id="mount">${renderServer(props)}</main><div id="following">Following content</div>`)
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
const register = (page, mode) => page.evaluate(mode => import(`/${mode}.js`), mode)
async function geometry(page) {
  return page.locator('#mount > a-progress').evaluate(host => [host, host.querySelector('a-progress-label'), document.querySelector('#following')].map(n => {
    const r = n.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]
  }).flat())
}
const indicator = page => page.locator('#mount > a-progress').evaluate(host => {
  const fill = host.shadowRoot.querySelector('[part="indicator"]')
  const style = getComputedStyle(fill)
  return { width: parseFloat(style.width), background: style.backgroundColor, image: style.backgroundImage,
    edge: getComputedStyle(fill, '::after').backgroundImage, animations: fill.getAnimations().length,
    fraction: fill.getBoundingClientRect().width / host.clientWidth,
  }
})
for (const engine of engines) {
  test(`${engine.name()}: SSR paints a correctly sized native fallback without JavaScript`, async t => {
    const page = await pageFor(t, engine, 'granular', '&pixel=1', false)
    assert.equal(await page.locator('a-progress').getAttribute('aria-valuenow'), '42')
    assert.equal(await page.locator('progress').evaluate(n => n.position), 0.42)
    const png = PNG.sync.read(await page.locator('a-progress').screenshot())
    const pixel = x => [...png.data.subarray((2 * png.width + x) * 4, (2 * png.width + x) * 4 + 3)]
    assert.deepEqual(pixel(30), [204, 0, 0])
    assert.deepEqual(pixel(200), [255, 255, 255])
  })
  test(`${engine.name()}: initial loading stripes render without JavaScript and respect reduced motion`, async t => {
    const page = await pageFor(t, engine, 'granular', '&loading=1', false)
    const fallback = page.locator('progress')
    assert.equal(await fallback.evaluate(n => n.position), -1)
    const host = page.locator('a-progress')
    assert.match(await host.evaluate(n => getComputedStyle(n, '::before').backgroundImage), /repeating-linear-gradient/)
    assert.equal(await host.evaluate(n => getComputedStyle(n, '::before').animationName), 'none')
    const png = PNG.sync.read(await page.locator('a-progress').screenshot())
    const colors = new Set(Array.from({length: png.width}, (_, x) => [...png.data.subarray((2 * png.width + x) * 4, (2 * png.width + x) * 4 + 3)].join(',')))
    assert.ok(colors.size > 2, 'the loading stripes must paint across the initial track')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    assert.equal(await host.evaluate(n => getComputedStyle(n, '::before').animationName), 'progress-loading-slide')
  })
  test(`${engine.name()}: sizes, tones, rounding, and custom content retain their initial layout`, async t => {
    const page = await pageFor(t, engine)
    await page.locator('#mount').evaluate(mount => {
      const original = mount.firstElementChild
      for (const size of ['small','medium','large']) {
        for (const tone of ['neutral','brand','info','success','warning','critical']) {
          const host=original.cloneNode(true)
          host.setAttribute('size',size)
          host.setAttribute('tone',tone)
          host.setAttribute('round','')
          mount.append(host)
        }
      }
      const custom=original.cloneNode(true)
      custom.querySelector('a-progress-label').replaceWith(document.createTextNode('Custom text'))
      mount.append(custom)
    })
    const metrics = () => page.locator('a-progress').evaluateAll(nodes => nodes.map(host => {
      const r=host.getBoundingClientRect()
      return {width:r.width,height:r.height,radius:getComputedStyle(host).borderRadius,tone:getComputedStyle(host).backgroundColor}
    }))
    const before=await metrics()
    await register(page,'granular')
    assert.deepEqual(await metrics(),before)
    assert.equal(before[1].height,18)
    assert.equal(before[7].height,24)
    assert.equal(before[13].height,32)
    assert.equal(before[1].radius,'999px')
    assert.notEqual(before[1].tone,before[2].tone)
  })
  for (const mode of ['granular', 'bundle']) {
    test(`${engine.name()}: ${mode} upgrade keeps geometry, ARIA, and authored DOM unchanged under CSP`, async t => {
      const page = await pageFor(t, engine, mode)
      const before = await geometry(page)
      const html = await page.locator('a-progress').evaluate(n => n.outerHTML)
      await page.locator('a-progress').evaluate(host => {
        window.ownerMutations = []
        new MutationObserver(records => window.ownerMutations.push(...records.map(r => r.type))).observe(host, {subtree: true, attributes: true, childList: true, characterData: true})
      })
      await register(page, mode)
      assert.deepEqual(await geometry(page), before)
      assert.equal(await page.locator('a-progress').evaluate(n => n.outerHTML), html)
      assert.deepEqual(await page.evaluate(() => window.ownerMutations), [])
      assert.equal(await page.locator('a-progress').evaluate(n => n.shadowRoot.querySelectorAll('style').length), 0)
      assert.equal(await page.locator('progress').evaluate(n => n.getBoundingClientRect().width), 0)
      assert.ok(Math.abs((await indicator(page)).fraction - 0.42) < 0.001)
      assert.match(await page.locator('body').ariaSnapshot(), /progressbar "Upload · 42% · 3 of 7"/)
      assert.equal((await page.locator('body').ariaSnapshot()).match(/progressbar/g).length, 1)
      for (const [value, max, fraction] of [[-10,100,0], [200,100,1], [25,50,0.5], ['oops',100,0], [42,0,0], [42,'Infinity',0]]) {
        await page.locator('a-progress').evaluate((n, [value,max]) => { n.setAttribute('value',value); n.setAttribute('max',max) }, [value,max])
        await page.waitForTimeout(220)
        assert.ok(Math.abs((await indicator(page)).fraction - fraction) < 0.001)
      }
    })
    test(`${engine.name()}: ${mode} loading animates externally, respects reduced motion, and keeps nested values independent`, async t => {
      const page = await pageFor(t, engine, mode, '&loading=1')
      await register(page, mode)
      assert.match((await indicator(page)).image, /repeating-linear-gradient/)
      assert.equal((await indicator(page)).animations, 0)
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      assert.equal((await indicator(page)).animations, 1)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      assert.equal((await indicator(page)).animations, 0)
      await page.locator('a-progress').evaluate(host => {
        host.innerHTML += '<a-progress value="75" max="100" role="progressbar" aria-label="Nested"><a-progress-label>Nested label</a-progress-label></a-progress>'
      })
      assert.equal(await page.locator('a-progress a-progress').evaluate(n => n.shadowRoot.querySelector('[part="indicator"]').getAnimations().length), 0)
      if (engine === chromium) {
        await page.emulateMedia({ forcedColors: 'active' })
        assert.equal(await page.locator('#mount > a-progress').evaluate(n => getComputedStyle(n).borderStyle), 'dotted')
        assert.equal((await indicator(page)).animations, 0)
      }
    })
  }
  test(`${engine.name()}: existing part overrides win and both mixed import orders remain usable`, async t => {
    for (const first of ['granular', 'bundle']) {
      const page = await pageFor(t, engine, first)
      await page.locator('a-progress').evaluate(n => n.classList.add('override'))
      await register(page, first)
      const constructor = await page.locator('a-progress').evaluate(n => { window.firstConstructor=n.constructor; return n.constructor.name })
      await register(page, first === 'granular' ? 'bundle' : 'granular')
      assert.equal(await page.locator('a-progress').evaluate(n => n.constructor === window.firstConstructor), true, constructor)
      assert.equal((await indicator(page)).background, 'rgb(18, 52, 86)')
      assert.equal((await indicator(page)).edge, 'none')
      assert.equal(await page.locator('a-progress').evaluate(n => getComputedStyle(n.shadowRoot.querySelector('[part="content"]')).letterSpacing), '1px')
    }
  })
  for (const framework of ['React','Preact']) {
    test(`${engine.name()}: ${framework} hydration and updates preserve ownership and accessibility`, async t => {
      for (const upgradeFirst of [false,true]) {
        const page = await pageFor(t, engine)
        const before = await geometry(page)
        const html = await page.locator('a-progress').evaluate(n => n.outerHTML)
        if (upgradeFirst) await register(page,'granular')
        await page.evaluate(framework => import(`/${framework}.js`),framework)
        await page.evaluate(props => window.hydrateProgress(props),initialProps)
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
        if (!upgradeFirst) await register(page,'granular')
        assert.deepEqual(await geometry(page), before)
        assert.equal(await page.locator('a-progress').evaluate(n => n.outerHTML), html)
        for (const props of [{value:150,max:200},{value:false},{value:NaN},{value:Infinity},{value:42,max:0},{value:33.3,max:100}]) {
          await page.evaluate(props => window.renderProgress({...props,label:'Updated'}),props)
          await page.waitForFunction(() => document.querySelector('a-progress').getAttribute('aria-label')?.startsWith('Updated'))
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
          const state=await page.locator('a-progress').evaluate(n => ({value:n.getAttribute('value'),now:n.getAttribute('aria-valuenow'),max:n.getAttribute('aria-valuemax'),label:n.getAttribute('aria-label'),fallback:n.querySelector('progress').position}))
          if (props.value === false) {
            assert.equal(state.value,null); assert.equal(state.now,null); assert.equal(state.max,null); assert.equal(state.fallback,-1)
          } else {
            assert.doesNotMatch(`${state.now} ${state.max} ${state.label}`,/NaN|Infinity/)
            assert.equal(state.fallback, Number(state.now)/Number(state.max))
          }
        }
        await page.evaluate(() => window.renderLinked())
        await page.locator('a-progress > a').waitFor()
        await page.locator('a-progress > a').click()
        assert.equal(new URL(page.url()).hash,'#linked')
        await page.evaluate(() => history.replaceState(null,'',location.pathname))
        await page.locator('a-progress > a').focus()
        await page.keyboard.press('Enter')
        assert.equal(new URL(page.url()).hash,'#linked')
      }
    })
  }
}
