import assert from 'node:assert/strict'
import {before, after} from 'node:test'
import {createRequire, Module} from 'node:module'
import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {build} from 'esbuild'
import {componentTest as test, componentEngines} from './component-tier.mjs'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const requirePlot = createRequire(new URL('../plot/package.json', import.meta.url))
const {chromium, firefox, webkit} = requireSite('playwright')
const engines = componentEngines([chromium, firefox, webkit])
const browsers = new Map(), assets = new Map()
let server, origin, renderServer

before(async () => {
  const alias = {'@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts')}
  for (const mode of ['granular', 'bundle']) {
    const result = await build({stdin: {contents: mode === 'bundle' ? "import './src/bundle'" : "import './src/tokens.css'; import './src/elements/a-tag'", resolveDir: process.cwd()},
      bundle: true, write: false, outfile: `${mode}.js`, format: 'esm', target: 'es2022', alias: {...alias, react: requireSite.resolve('preact/compat')},
    })
    for (const file of result.outputFiles) assets.set(`/${mode}.${file.path.endsWith('.css') ? 'css' : 'js'}`, file.text)
  }
  for (const theme of ['antune', 'antithesis']) assets.set(`/${theme}.css`, await readFile(resolve(`src/theme-${theme}.css`), 'utf8'))
  const result = await build({stdin: {contents: "import React from 'react'; import {renderToString} from 'react-dom/server'; import {Tag} from './src/components/Tag'; export const render = props => renderToString(React.createElement(Tag, props))", resolveDir: process.cwd()},
    bundle: true, write: false, platform: 'node', format: 'cjs', alias: {...alias, 'react-dom/server': requirePlot.resolve('react-dom/server')},
  })
  const compiled = new Module(resolve('tests/tag-server.cjs'))
  compiled._compile(result.outputFiles[0].text, compiled.id)
  renderServer = compiled.exports.render
  for (const framework of ['React', 'Preact']) {
    const react = framework === 'React'
    const result = await build({stdin: {contents: `
      import React from 'react'
      import {Tag} from './src/components/Tag'
      ${react ? "import {createRoot, hydrateRoot} from 'react-dom/client'; let root" : "import {render, hydrate} from 'preact'"}
      const mount = document.querySelector('#mount')
      const node = props => React.createElement(Tag, {label: 'Framework tag', tone: 'info', ...props})
      window.hydrateTag = props => { ${react ? 'root = hydrateRoot(mount, node(props))' : 'hydrate(node(props), mount)'} }
      window.renderTag = props => { ${react ? '(root ??= createRoot(mount)).render(node(props))' : 'render(node(props), mount)'} }
    `, resolveDir: process.cwd()}, bundle: true, write: false, outfile: `${framework}.js`, format: 'esm', target: 'es2022',
      define: {'process.env.NODE_ENV': '"production"'}, nodePaths: [resolve('site/node_modules')],
      alias: {...alias, ...(react ? {'react-dom/client': requirePlot.resolve('react-dom/client')} : {react: requireSite.resolve('preact/compat')})},
    })
    assets.set(`/${framework}.js`, result.outputFiles.find(file => file.path.endsWith('.js')).text)
  }
  assets.set('/fixture.css', 'body{padding:40px}a-tag{margin:12px}#outside{width:20px;height:20px}')
  assets.set('/boot.js', "window.violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push(e.effectiveDirective));")
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost'), mode = url.searchParams.get('mode') ?? 'granular', theme = url.searchParams.get('theme') ?? 'antune'
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; object-src 'none'")
    res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : url.pathname.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(assets.get(url.pathname) ?? `<!doctype html><link rel="stylesheet" href="/${mode}.css"><link rel="stylesheet" href="/fixture.css">${theme === 'none' ? '' : `<link rel="stylesheet" href="/${theme}.css">`}<script src="/boot.js"></script><div id="outside"></div><a-tag id="passive"><a-tag-value>Passive</a-tag-value></a-tag><a href="#destination"><a-tag id="interactive" interactive tone="info"><a-tag-value>Interactive</a-tag-value></a-tag></a><div id="mount">${renderServer({label: 'Framework tag', tone: 'info', interactive: true})}</div><span id="destination"></span><script type="module" src="/${mode}.js"></script>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  for (const engine of engines) browsers.set(engine, await engine.launch({headless: true, ...(engine === chromium && process.env.CAPTURE_TEST_BROWSER_CHANNEL ? {channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL} : {})}))
})
after(async () => {
  await Promise.all([...browsers.values()].map(browser => browser.close()))
  if (server) await new Promise(resolve => server.close(resolve))
})

const measure = locator => locator.evaluate(element => {
  const css = getComputedStyle(element), box = element.getBoundingClientRect()
  return {border: css.borderColor, background: css.backgroundColor, color: css.color, cursor: css.cursor, opacity: css.opacity, borderWidth: css.borderWidth, width: box.width, height: box.height}
})
const withoutBorder = ({border, ...rest}) => rest

test.fast('Tag SSR projects interactive as a removable presence attribute', () => {
  assert.match(renderServer({label: 'Tag', interactive: true}), / interactive=""/)
  assert.doesNotMatch(renderServer({label: 'Tag', interactive: false}), /interactive/)
  assert.doesNotMatch(renderServer({label: 'Tag'}), /interactive/)
})

for (const engine of engines) {
  test.fast(`${engine.name()}: Tag cursors and border-only hover/active states work across imports and themes`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      for (const mode of ['granular', 'bundle']) for (const theme of ['none', 'antune', 'antithesis']) {
        await page.goto(`${origin}/?mode=${mode}&theme=${theme}`)
        assert.equal(await page.evaluate(() => !!customElements.get('a-tag')), false)
        const passive = page.locator('#passive'), interactive = page.locator('#interactive')
        await page.locator('#outside').hover()
        const passiveRest = await measure(passive)
        assert.equal(passiveRest.cursor, 'default')
        await passive.hover()
        assert.deepEqual(await measure(passive), passiveRest)
        assert.equal(await passive.locator('a-tag-value').evaluate(element => getComputedStyle(element).cursor), 'default')
        for (const priority of ['primary', 'secondary', 'tertiary']) {
          await interactive.evaluate((element, priority) => element.setAttribute('priority', priority), priority)
          await page.locator('#outside').hover()
          const rest = await measure(interactive)
          assert.equal(rest.cursor, 'pointer')
          await interactive.hover()
          const hover = await measure(interactive)
          assert.notEqual(hover.border, rest.border, `${mode}/${theme}/${priority}`)
          assert.deepEqual(withoutBorder(hover), withoutBorder(rest))
          await page.mouse.down()
          await page.evaluate(() => new Promise(requestAnimationFrame))
          assert.deepEqual(await measure(interactive), rest)
          await page.mouse.up()
        }
        await interactive.evaluate(element => element.removeAttribute('interactive'))
        assert.equal((await measure(interactive)).cursor, 'default')
        assert.deepEqual(await page.evaluate(() => violations), [])
      }
    } finally {await page.close()}
  })
  for (const framework of ['React', 'Preact']) test.fast(`${engine.name()} ${framework}: hydration preserves Tag nodes and toggles the interactive attribute`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      await page.goto(origin)
      await page.locator('#mount a-tag').evaluate(element => {window.originalTag = element})
      await page.addScriptTag({type: 'module', url: `${origin}/${framework}.js`})
      await page.evaluate(() => hydrateTag({interactive: true}))
      await page.waitForFunction(() => document.querySelector('#mount a-tag')?.hasAttribute('interactive'))
      await page.evaluate(() => renderTag({interactive: false}))
      await page.waitForFunction(() => !document.querySelector('#mount a-tag')?.hasAttribute('interactive'))
      assert.equal(await page.locator('#mount a-tag').evaluate(element => element === window.originalTag), true)
      assert.equal((await measure(page.locator('#mount a-tag'))).cursor, 'default')
      await page.evaluate(() => renderTag({interactive: true}))
      await page.waitForFunction(() => document.querySelector('#mount a-tag')?.getAttribute('interactive') === '')
      assert.equal((await measure(page.locator('#mount a-tag'))).cursor, 'pointer')
      assert.deepEqual(await page.evaluate(() => violations), [])
    } finally {await page.close()}
  })
}

if (engines.includes(chromium)) {
  test.fast('Chromium touch: Tag has no sticky hover border', async () => {
    const context = await browsers.get(chromium).newContext({hasTouch: true})
    try {
      const page = await context.newPage()
      await page.goto(origin)
      const tag = page.locator('#interactive'), rest = await measure(tag)
      await tag.tap()
      assert.deepEqual(await measure(tag), rest)
    } finally {await context.close()}
  })
  test.fast('Chromium forced colors: interactive Tag uses system hover colors and restores its resting border', async () => {
    const page = await browsers.get(chromium).newPage({forcedColors: 'active'})
    try {
      await page.goto(origin)
      const tag = page.locator('#interactive'), rest = await measure(tag)
      await tag.hover()
      assert.notEqual((await measure(tag)).border, rest.border)
      await page.mouse.down()
      assert.deepEqual(await measure(tag), rest)
      await page.mouse.up()
    } finally {await page.close()}
  })
}
