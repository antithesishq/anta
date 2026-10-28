import assert from 'node:assert/strict'
import { after, before } from 'node:test'
import { componentTest as test, componentEngines } from './component-tier.mjs'
import { createServer } from 'node:http'
import { createRequire, Module } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const requirePlot = createRequire(new URL('../plot/package.json', import.meta.url))
const { chromium, firefox, webkit } = requireSite('playwright')
const { PNG } = requireSite('pngjs')
const engines = componentEngines([chromium, firefox, webkit])
const source = process.env.ANTA_PROGRESS_PACKAGE_ROOT ? resolve(process.env.ANTA_PROGRESS_PACKAGE_ROOT, 'dist') : resolve('src')
const strictPolicy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; object-src 'none'"
const jsxPolicy = strictPolicy.replace("style-src-attr 'none'", "style-src-attr 'unsafe-inline'")
const browsers = new Map()
const initialProps = { value: 42, label: 'Upload', hint: '3 of 7', 'data-owner': 'app' }
const factory = `const node = props => React.createElement(Progress, props)`
let server, origin, renderServer

before(async () => {
  const assets = new Map()
  for (const mode of ['granular', 'bundle', 'native']) {
    const contents = mode === 'bundle'
      ? `import '${source}/bundle'; ${process.env.ANTA_PROGRESS_PACKAGE_ROOT ? `import '${source}/bundle.css';` : ''}`
      : `import '${source}/tokens.css'; import '${source}/reset.css'; import '${source}/elements/a-progress';`
    const result = await build({ stdin: { contents, resolveDir: process.cwd() }, bundle: true, write: false,
      outfile: `${mode}.js`, format: 'esm', target: 'es2022', minify: true,
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
  assert.doesNotMatch(renderServer(initialProps), /slot=|<svg[ >]|<progress[ >]|<a-progress-indicator/)
  assert.match(renderServer(initialProps), /style="--progress-value:42;--progress-max:100"/)
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
    res.setHeader('Content-Security-Policy', mode === 'native' || url.searchParams.has('raw') || url.searchParams.has('strict') ? strictPolicy : jsxPolicy)
    res.setHeader('Content-Type', `${req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html'}; charset=utf-8`)
    const props = { ...initialProps, ...(url.searchParams.has('loading') ? { value: false } : {}) }
    const html = url.searchParams.has('raw') ? renderServer(props).replace(/ style="[^"]*"/g, '') : renderServer(props)
    res.end(assets.get(req.url) ?? `<!doctype html><link rel="stylesheet" href="/${mode}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><main id="mount">${mode === 'native' ? '<progress data-anta value="42" max="100" aria-label="Native upload"></progress>' : html}</main><div id="following">Following content</div>`)
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
async function pageFor(t, engine, mode = 'granular', query = '', javaScriptEnabled = true, expectedViolations = []) {
  const page = await browsers.get(engine).newPage({ reducedMotion: 'reduce', javaScriptEnabled })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const response = await page.goto(`${origin}/?mode=${mode}${query}`)
  assert.equal(response.headers()['content-security-policy'], mode === 'native' || /&(raw|strict)=/.test(query) ? strictPolicy : jsxPolicy)
  t.after(async () => {
    try {
      assert.deepEqual(errors, [])
      assert.deepEqual(await page.evaluate(() => window.cspViolations ?? []), expectedViolations)
    } finally { await page.close() }
  })
  return page
}
const loadEntry = (page, mode) => page.evaluate(mode => import(`/${mode}.js`), mode)
async function geometry(page) {
  return page.locator('#mount > a-progress').evaluate(host => [host, host.querySelector('a-progress-label'), document.querySelector('#following')].map(n => {
    const r = n.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]
  }).flat())
}
const indicator = page => page.locator('#mount > a-progress').evaluate(host => {
  const style = getComputedStyle(host, '::before')
  return { width: parseFloat(style.width), background: style.backgroundColor,
    image: style.backgroundImage, animations: host.getAnimations({subtree: true}).filter(a => a.effect?.pseudoElement === '::before').length,
    fraction: parseFloat(style.width) / host.clientWidth,
  }
})
async function waitForFraction(page, fraction) {
  // Page timers do not run with JavaScript disabled; poll from the test runner.
  let actual
  for (let attempt = 0; attempt < 80; attempt++) {
    actual = (await indicator(page)).fraction
    if (Math.abs(actual - fraction) < 0.001) return
    await page.waitForTimeout(25)
  }
  assert.fail(`expected fill ${fraction}, received ${actual}`)
}
async function assertPaintedFill(page, selector) {
  await page.locator(selector).evaluate(n => n.classList.add('pixel'))
  const pixels = PNG.sync.read(await page.locator(selector).screenshot())
  const pixel = x => [...pixels.data.subarray((4 * pixels.width + x) * 4, (4 * pixels.width + x) * 4 + 3)]
  assert.deepEqual(pixel(30), [204, 0, 0])
  assert.deepEqual(pixel(200), [255, 255, 255])
}
for (const engine of engines) {
  test.fast(`${engine.name()}: SSR paints one declarative indicator with JavaScript disabled`, async t => {
    const page = await pageFor(t, engine, 'granular', '', false)
    assert.equal(await page.locator('a-progress').getAttribute('aria-valuenow'), '42')
    assert.equal((await page.locator('a-progress-label').innerText()).replace(/\s+/g, ' '), '42% Upload 3 of 7')
    assert.equal(await page.locator('progress').count(), 0)
    assert.equal(await page.locator('a-progress-indicator').count(), 0)
    assert.equal(await page.locator('a-progress').evaluate(n => n.shadowRoot), null)
    await assertPaintedFill(page, 'a-progress')
  })
  test.fast(`${engine.name()}: raw attributes paint under strict CSP without JavaScript`, async t => {
    const page = await pageFor(t, engine, 'granular', '&raw=1', false)
    await assertPaintedFill(page, 'a-progress')
  })
  test(`${engine.name()}: external variables override attributes and work without numeric attr support`, async t => {
    const page = await pageFor(t, engine, 'granular', '&raw=1')
    await page.locator('a-progress').evaluate(n => n.classList.add('variable-override'))
    await waitForFraction(page, 0.25)
    await page.locator('a-progress').evaluate(n => n.setAttribute('value','75'))
    assert.ok(Math.abs((await indicator(page)).fraction - 0.25) < 0.001)
    await page.locator('a-progress').evaluate(n => n.classList.add('without-attr'))
    assert.ok(Math.abs((await indicator(page)).fraction - 0.25) < 0.001)
    await page.locator('a-progress').evaluate(n => {
      n.innerHTML += '<a-progress value="60" max="100"></a-progress>'
    })
    assert.ok(Math.abs(await page.locator('a-progress a-progress').evaluate(n => parseFloat(getComputedStyle(n, '::before').width) / n.clientWidth) - 0.6) < 0.001)
    await page.locator('#mount > a-progress').evaluate(n => n.classList.remove('variable-override','without-attr'))
    await waitForFraction(page, 0.75)
    for (const [className, fraction] of [['value-only',0.2], ['max-only',0.375], ['zero-variable',0]]) {
      await page.locator('#mount > a-progress').evaluate((n, className) => {
        n.classList.remove('value-only','max-only','zero-variable')
        n.classList.add(className)
      }, className)
      await waitForFraction(page, fraction)
    }
    await page.locator('#mount > a-progress').evaluate(n => {
      n.classList.remove('zero-variable')
      n.removeAttribute('max')
      n.setAttribute('value','25')
    })
    await waitForFraction(page, 0.25)
  })
  test.fast(`${engine.name()}: strict CSP blocks serialized JSX variables while CSS reads the attributes`, async t => {
    const page = await pageFor(t, engine, 'granular', '&strict=1', true, ['style-src-attr'])
    assert.equal(await page.locator('a-progress').evaluate(n => n.style.getPropertyValue('--progress-value')), '')
    assert.ok(Math.abs((await indicator(page)).fraction - 0.42) < 0.001)
  })
  test(`${engine.name()}: raw loading paints through CSS without an indicator child`, async t => {
    const page = await pageFor(t, engine, 'granular', '&loading=1&raw=1', false)
    assert.match((await indicator(page)).image, /repeating-linear-gradient/)
    assert.equal(await page.locator('a-progress').getAttribute('aria-valuenow'), null)
    await page.emulateMedia({reducedMotion: 'no-preference'})
    assert.equal((await indicator(page)).animations, 1)
  })
  test.fast(`${engine.name()}: native progress paints independently through the shared entry without JavaScript`, async t => {
    const page = await pageFor(t, engine, 'native', '', false)
    assert.equal(await page.locator('a-progress, a-progress-indicator').count(), 0)
    assert.equal(await page.locator('progress').evaluate(n => n.position), 0.42)
    assert.match(await page.locator('body').ariaSnapshot(), /progressbar "Native upload"/)
    await assertPaintedFill(page, 'progress')
  })
  test(`${engine.name()}: rich and native forms share tone, sizing, and rounding rules`, async t => {
    const page = await pageFor(t, engine)
    const pairs = await page.locator('a-progress').evaluate(host => {
      const native = document.createElement('progress')
      native.setAttribute('data-anta','')
      native.value = 42
      native.max = 100
      host.after(native)
      const pairs = []
      for (const [size,height] of [['small',12],['medium',16],['large',20]]) {
        for (const tone of ['neutral','brand','info','success','warning','critical']) {
          for (const n of [host,native]) {
            n.setAttribute('size',size); n.setAttribute('tone',tone); n.setAttribute('round','')
          }
          const styles = [host,native].map(n => {
            const css=getComputedStyle(n)
            return {background:css.backgroundColor,radius:css.borderRadius,padding:css.getPropertyValue('--progress-padding-block'),fill:css.getPropertyValue('--progress-indicator-bg')}
          })
          pairs.push({styles,nativeHeight:native.getBoundingClientRect().height,height,position:native.position})
        }
      }
      return pairs
    })
    for (const {styles,nativeHeight,height,position} of pairs) {
      assert.deepEqual(styles[0],styles[1])
      assert.equal(styles[0].radius,'999px')
      assert.equal(nativeHeight,height)
      assert.equal(position,0.42)
    }
    if (engine === chromium) {
      await page.emulateMedia({forcedColors:'active'})
      await page.locator('a-progress').evaluate(n => { n.style.removeProperty('--progress-value'); n.style.removeProperty('--progress-max') })
      for (const [value,fraction] of [[25,0.25],[0,0],[100,1]]) {
        await page.locator('a-progress').evaluate((n,value) => n.setAttribute('value',value),value)
        await waitForFraction(page,fraction)
        assert.match(await page.locator('a-progress').evaluate(n => getComputedStyle(n,'::before').boxShadow), /inset/)
      }
      assert.equal(await page.locator('progress').evaluate(n => getComputedStyle(n).borderStyle),'dotted')
    }
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
    await loadEntry(page,'granular')
    assert.deepEqual(await metrics(),before)
    assert.equal(before[1].height,18)
    assert.equal(before[7].height,24)
    assert.equal(before[13].height,32)
    assert.equal(before[1].radius,'999px')
    assert.notEqual(before[1].tone,before[2].tone)
  })
  for (const mode of ['granular', 'bundle']) {
    test.fast(`${engine.name()}: ${mode} imports keep geometry, ARIA, and authored DOM unchanged under CSP`, async t => {
      const page = await pageFor(t, engine, mode, '&raw=1')
      const before = await geometry(page)
      const html = await page.locator('a-progress').evaluate(n => n.outerHTML)
      await page.locator('a-progress').evaluate(host => {
        window.ownerMutations = []
        new MutationObserver(records => window.ownerMutations.push(...records.map(r => r.type))).observe(host, {subtree: true, attributes: true, childList: true, characterData: true})
      })
      await loadEntry(page, mode)
      assert.deepEqual(await geometry(page), before)
      assert.equal(await page.locator('a-progress').evaluate(n => n.outerHTML), html)
      assert.deepEqual(await page.evaluate(() => window.ownerMutations), [])
      assert.equal(await page.locator('a-progress').evaluate(n => n.shadowRoot), null)
      assert.equal(await page.evaluate(() => customElements.get('a-progress')), undefined)
      assert.equal(await page.locator('progress').count(), 0)
      assert.equal(await page.locator('a-progress-indicator').count(), 0)
      assert.ok(Math.abs((await indicator(page)).fraction - 0.42) < 0.001)
      const midway = await page.locator('a-progress').evaluate(host => {
        getComputedStyle(host, '::before').width
        host.setAttribute('value', '80')
        getComputedStyle(host, '::before').width
        const transition = host.getAnimations({subtree: true}).find(a => a.transitionProperty === 'width')
        if (!transition) return null
        transition.pause()
        transition.currentTime = 100
        return parseFloat(getComputedStyle(host, '::before').width) / host.clientWidth
      })
      assert.ok(midway > 0.42 && midway < 0.8, `width transition: ${midway}`)
      await page.locator('a-progress').evaluate(host => { host.getAnimations({subtree: true}).forEach(a => a.finish()); host.setAttribute('value','42') })
      assert.match(await page.locator('body').ariaSnapshot(), /progressbar "Upload · 42% · 3 of 7"/)
      assert.equal((await page.locator('body').ariaSnapshot()).match(/progressbar/g).length, 1)
      for (const [value, max, fraction] of [[-10,100,0], [200,100,1], [25,50,0.5], ['oops',100,0], [42,0,0], [42,'Infinity',0]]) {
        await page.locator('a-progress').evaluate((n, [value,max,fraction]) => {
          n.setAttribute('value',value); n.setAttribute('max',max)
          n.setAttribute('aria-valuenow', String(fraction * (Number(max) > 0 && Number.isFinite(Number(max)) ? Number(max) : 100)))
        }, [value,max,fraction])
        await waitForFraction(page, fraction)
      }
    })
    test(`${engine.name()}: ${mode} loading animates externally, respects reduced motion, and keeps nested values independent`, {tier: mode === 'granular' ? 'fast' : 'slow'}, async t => {
      const page = await pageFor(t, engine, mode, '&loading=1')
      await loadEntry(page, mode)
      assert.match((await indicator(page)).image, /repeating-linear-gradient/)
      assert.equal((await indicator(page)).animations, 0)
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      assert.equal((await indicator(page)).animations, 1)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      assert.equal((await indicator(page)).animations, 0)
      await page.locator('a-progress').evaluate(host => {
        host.innerHTML += '<a-progress value="75" max="100" role="progressbar" aria-label="Nested"><a-progress-label>Nested label</a-progress-label></a-progress>'
      })
      assert.equal(await page.locator('a-progress a-progress').evaluate(n => n.getAnimations({subtree: true}).length), 0)
      assert.ok(Math.abs(await page.locator('a-progress a-progress').evaluate(n => parseFloat(getComputedStyle(n, '::before').width) / n.clientWidth) - 0.75) < 0.001)
      if (engine === chromium) {
        await page.emulateMedia({ forcedColors: 'active' })
        assert.equal(await page.locator('#mount > a-progress').evaluate(n => getComputedStyle(n).borderStyle), 'dotted')
        assert.equal((await indicator(page)).animations, 0)
      }
    })
  }
  test(`${engine.name()}: light-DOM overrides win and both mixed import orders remain usable`, async t => {
    for (const first of ['granular', 'bundle']) {
      const page = await pageFor(t, engine, first)
      await page.locator('a-progress').evaluate(n => n.classList.add('override'))
      await loadEntry(page, first)
      const constructor = await page.locator('a-progress').evaluate(n => { window.firstConstructor=n.constructor; return n.constructor.name })
      await loadEntry(page, first === 'granular' ? 'bundle' : 'granular')
      assert.equal(await page.locator('a-progress').evaluate(n => n.constructor === window.firstConstructor), true, constructor)
      assert.equal((await indicator(page)).background, 'rgb(18, 52, 86)')
      assert.equal((await indicator(page)).image, 'none')
      assert.equal(await page.locator('a-progress').evaluate(n => getComputedStyle(n.querySelector('a-progress-label')).letterSpacing), '1px')
    }
  })
  for (const framework of ['React','Preact']) {
    test.fast(`${engine.name()}: ${framework} hydration and updates preserve ownership and accessibility`, async t => {
      for (const loadFirst of [false,true]) {
        const page = await pageFor(t, engine)
        const before = await geometry(page)
        const html = await page.locator('a-progress').evaluate(n => n.outerHTML)
        if (loadFirst) await loadEntry(page,'granular')
        await page.evaluate(framework => import(`/${framework}.js`),framework)
        await page.evaluate(props => window.hydrateProgress(props),initialProps)
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
        if (!loadFirst) await loadEntry(page,'granular')
        assert.deepEqual(await geometry(page), before)
        assert.equal(await page.locator('a-progress').evaluate(n => n.outerHTML), html)
        await page.locator('a-progress').evaluate(n => n.classList.add('without-attr'))
        for (const props of [{value:150,max:200},{value:false},{value:NaN},{value:Infinity},{value:42,max:0},{value:33.3,max:100}]) {
          await page.evaluate(props => window.renderProgress({...props,label:'Updated'}),props)
          await page.waitForFunction(() => document.querySelector('a-progress').getAttribute('aria-label')?.startsWith('Updated'))
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)))
          await page.locator('a-progress').evaluate(n => n.classList.add('without-attr'))
          const state=await page.locator('a-progress').evaluate(n => ({value:n.getAttribute('value'),now:n.getAttribute('aria-valuenow'),max:n.getAttribute('aria-valuemax'),label:n.getAttribute('aria-label')}))
          if (props.value === false) {
            assert.equal(state.value,null); assert.equal(state.now,null); assert.equal(state.max,null)
          } else {
            assert.doesNotMatch(`${state.now} ${state.max} ${state.label}`,/NaN|Infinity/)
            await waitForFraction(page, Number(state.now)/Number(state.max))
          }
        }
        await page.evaluate(() => window.renderLinked())
        await page.locator('a-progress > a').waitFor()
        await page.locator('a-progress > a').click()
        assert.equal(new URL(page.url()).hash,'#linked')
        await page.evaluate(() => history.replaceState(null,'',location.pathname))
        await page.locator('a-progress > a').focus()
        await page.keyboard.press('Enter')
        await page.waitForURL(url=>url.hash==='#linked')
      }
    })
  }
}
