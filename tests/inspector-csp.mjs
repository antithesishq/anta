import assert from 'node:assert/strict'
import { after, before } from 'node:test'
import { componentTest as test, componentEngines } from './component-tier.mjs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const require = createRequire(import.meta.url)
const { chromium, firefox, webkit } = requireSite('playwright')
const engines = componentEngines([chromium, firefox, webkit])
const source = resolve('src')
const fixtures = resolve('fixtures')
// The chevron is a data: SVG mask, as Expander's is, so images allow data:.
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'"
const browsers = new Map()
let server, origin

// The sample, as path keys, with expandDepth 1:
// r {…} > r/.name, r/.results, r/.log, r/.byKey, r/.list, r/.self (a cycle).
const app = `
  import React, { useState } from 'react'
  import { render } from 'preact'
  import { Inspector } from '${source}/components/Inspector'
  import { Tree } from '${source}/components/Tree'
  import { describe, visibleTree, openIds, deepOpen, inspectorExpandToPath } from '${source}/inspector-core'
  import { inspectorKinds, rootPrimitives } from '${fixtures}/inspector/kinds'

  function sample() {
    const value = {
      name: 'run',
      results: [{ id: 't1', ok: true }, { id: 't2', ok: false }],
      log: 'line one\\nline two',
      byKey: new Map([['k', 1]]),
      list: Array.from({ length: 7 }, (_, i) => i),
      self: null,
    }
    value.self = value
    return value
  }
  const mount = () => document.querySelector('#mount')
  // A 100,000-item array, revealed at one index: its ranges opened by
  // inspectorExpandToPath, the row marked current.
  window.revealBig = index => {
    const value = { big: Array.from({ length: 100000 }, (_, i) => i) }
    const path = [{ type: 'property', key: 'big' }, { type: 'index', index }]
    render(React.createElement(Inspector, { value, 'aria-label': 'Big', open: inspectorExpandToPath(value, [], path), current: path }), mount())
  }
  // Search over a controlled Inspector: each request's scope is logged, then applied.
  window.scopes = []
  function ControlledSearch({ value }) {
    const [open, setOpen] = useState(['r'])
    const onStateChange = (_event, { next, scope }) => { window.scopes.push(scope); setOpen(next) }
    return React.createElement(Inspector, { value, open, onStateChange, searchable: true, 'aria-label': 'Run' })
  }
  window.renderControlledSearch = () => render(React.createElement(ControlledSearch, { value: { a: { deep: 'needle' } } }), mount())
  window.renderClassSearch = () => {
    class Box { constructor() { this.box = 1 } }
    render(React.createElement(Inspector, { value: { x: new Box() }, searchable: true, 'aria-label': 'Run' }), mount())
  }
  window.renderBigSearch = () => {
    const value = { big: Array.from({ length: 100000 }, (_, i) => (i === 900 || i === 50000 ? 'needle' : i)) }
    render(React.createElement(Inspector, { value, searchable: true, 'aria-label': 'Big' }), mount())
  }
  // The docs walkthrough's values, by name, or a root primitive by label.
  window.kindNames = [...Object.keys(inspectorKinds), ...rootPrimitives().map(({ label }) => 'root ' + label)]
  window.renderKind = name => {
    const value = name.startsWith('root ')
      ? rootPrimitives().find(({ label }) => label === name.slice(5)).value
      : inspectorKinds[name].values()
    render(React.createElement(Inspector, { value, expandDepth: 0, chunkSize: 100, 'aria-label': name }), mount())
  }
  window.renderInspector = props => render(React.createElement(Inspector, { value: sample(), chunkSize: 6, 'aria-label': 'Run', ...props }), mount())

  // A stand-in for a worker renderer: it renders a Tree from the core itself,
  // keeping an open set as the Inspector does, and answers each request after a
  // delay. It sets the requested state rather than flipping it, so a request
  // repeated before the answer lands changes nothing.
  function Delayed({ delay }) {
    const [root] = useState(() => describe(sample()))
    const [open, setOpen] = useState(() => new Set(openIds(root, { style: 'tree', expandDepth: 1 })))
    const state = { style: 'tree', open }
    const apply = (id, opening, scope) => setOpen(current => {
      if (scope === 'subtree') return deepOpen(root, { style: 'tree', open: current }, id, opening)
      const result = new Set(current)
      if (opening) result.add(id)
      else result.delete(id)
      return result
    })
    window.closeRow = id => apply(id, false)
    const toItem = row => ({
      id: row.id,
      label: [...(row.key ?? []), ...(row.tokens ?? [])].map(token => token.text).join(''),
      children: row.children?.map(toItem),
    })
    const onStateChange = (event, { next, prev, scope }) => {
      // The request's own row is the shallowest one that changed.
      const changed = [...next.filter(id => !prev.includes(id)), ...prev.filter(id => !next.includes(id))]
      const id = changed.sort((a, b) => a.split('/').length - b.split('/').length)[0]
      window.requests.push(id)
      setTimeout(() => apply(id, next.includes(id), scope), delay)
    }
    return React.createElement(Tree, { 'aria-label': 'Delayed', items: visibleTree(root, state).map(toItem), open: [...open], onStateChange })
  }
  window.requests = []

  // Holds back each itemmenu for 'delay' ms, as a worker renderer's round trip
  // would, then sends a fresh copy. The real wrapper sees the gap; Menu still
  // opens at once. Capture on window runs before any listener on the element.
  window.itemmenuArrivals = 0
  window.delayRowMenu = delay => window.addEventListener('itemmenu', event => {
    if (event.replayed) { window.itemmenuArrivals++; return }
    event.stopImmediatePropagation()
    const target = event.target
    setTimeout(() => {
      const replay = new CustomEvent('itemmenu', { detail: event.detail })
      replay.replayed = true
      target.dispatchEvent(replay)
    }, delay)
  }, true)
  window.renderDelayed = delay => render(React.createElement(Delayed, { delay }), mount())
`

before(async () => {
  const assets = new Map()
  for (const mode of ['granular', 'bundle']) {
    const contents = mode === 'bundle'
      ? `import '${source}/bundle';`
      : ['tokens.css', 'reset.css', 'elements/a-inspector', 'elements/a-tree', 'elements/a-menu', 'elements/a-menu-item', 'elements/a-copy', 'elements/a-icon', 'elements/a-button', 'elements/a-tooltip', 'elements/a-input']
        .map(path => `import '${source}/${path}';`).join(' ')
    const result = await build({
      stdin: { contents, resolveDir: process.cwd() }, bundle: true, write: false,
      outfile: `${mode}.js`, format: 'esm', target: 'es2022',
      alias: { react: requireSite.resolve('preact/compat') },
      nodePaths: [resolve('node_modules')],
    })
    for (const file of result.outputFiles) assets.set(`/${mode}.${file.path.endsWith('.css') ? 'css' : 'js'}`, file.text)
    assert.ok(assets.has(`/${mode}.css`), `${mode} must load its paired stylesheet`)
  }
  const result = await build({
    stdin: { contents: app, resolveDir: process.cwd() }, bundle: true, write: false,
    outfile: 'app.js', format: 'esm', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    define: { 'process.env.NODE_ENV': '"production"' },
    nodePaths: [resolve('node_modules'), resolve('site/node_modules')],
    alias: { '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime'), react: requireSite.resolve('preact/compat') },
  })
  for (const file of result.outputFiles) if (file.path.endsWith('.js')) assets.set('/app.js', file.text)
  assets.set('/axe.js', await readFile(require.resolve('axe-core/axe.min.js'), 'utf8'))
  assets.set('/boot.js', `window.cspViolations=[]; document.addEventListener('securitypolicyviolation', e=>window.cspViolations.push(e.effectiveDirective));`)
  server = createServer((req, res) => {
    res.setHeader('Content-Security-Policy', policy)
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html')
    const mode = new URL(req.url, 'http://localhost').searchParams.get('mode') || 'granular'
    // Inputs, not buttons: WebKit's Tab skips buttons by default.
    res.end(assets.get(req.url) ?? `<!doctype html><link rel="stylesheet" href="/${mode}.css"><script src="/boot.js"></script><input id="before" aria-label="Before"><p>Result: <span id="mount"></span> done.</p><input id="after" aria-label="After">`)
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
  const context = await browsers.get(engine).newContext({
    reducedMotion: 'reduce',
    ...(engine === chromium ? { permissions: ['clipboard-read', 'clipboard-write'] } : {}),
  })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const response = await page.goto(`${origin}/?mode=${mode}`)
  assert.equal(response.headers()['content-security-policy'], policy)
  await page.evaluate(async mode => { await import(`/${mode}.js`); await import('/app.js') }, mode)
  t.after(async () => {
    try {
      assert.deepEqual(errors, [])
      assert.deepEqual(await page.evaluate(() => window.cspViolations), [])
    } finally { await context.close() }
  })
  return page
}

const renderInspector = (page, props = {}) => page.evaluate(props => window.renderInspector(props), props)
// Rows are Tree items; the wrapper renders only the items shown.
const row = id => `a-tree-item[item-id="${id}"] > a-tree-row`
// A row's text, which clicks target: the row's center can fall on its ⋯ button.
const rowText = id => `${row(id)} > a-tree-value`
const ids = page => page.$$eval('a-tree-item', items => items.map(item => item.getAttribute('item-id')))
const active = page => page.evaluate(() => document.querySelector('a-tree-item:state(active)')?.getAttribute('item-id') ?? null)
const isOpen = (page, id) => page.locator(`a-tree-item[item-id="${id}"]`).evaluate(item => item.matches(':state(open)'))
// Focus is on an item, as the Tab stop moves with the cursor.
const onTreeAt = page => page.evaluate(() => document.activeElement?.localName === 'a-tree-item')
async function until(page, check, message) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return
    await page.waitForTimeout(20)
  }
  assert.fail(message)
}
// The copy items in menu order: value, JSON, path.
const copyItems = page => page.$$eval('a-menu-item', items => items.map(item => {
  const copy = item.querySelector('a-copy')
  return {
    label: item.querySelector('a-menu-item-label')?.textContent.trim() ?? item.textContent.trim(),
    disabled: item.hasAttribute('disabled'),
    copy: copy?.getAttribute('copy') ?? copy?.copy ?? null,
    hint: item.querySelector('a-menu-item-hint')?.textContent.trim() ?? null,
  }
}))
// The row whose ⋯ button has focus, if one does.
const focusedButtonRow = page => page.evaluate(() => document.activeElement?.closest('a-tree-actions')
  ? document.activeElement.closest('a-tree-item').getAttribute('item-id') : null)
const buttonOpacity = (page, id) => page.locator(`${row(id)} > a-tree-actions`).evaluate(actions => getComputedStyle(actions).opacity)
// Menu binds its trigger once its anchor is seen on screen, a frame or two
// after the first render; a person can't act sooner than that.
const settle = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))))
async function focusTree(page) {
  await page.locator('#before').focus()
  await page.keyboard.press('Tab')
  assert.ok(await onTreeAt(page), 'Tab did not reach the tree')
}

for (const engine of engines) {
  const name = engine.name()

  for (const mode of ['granular', 'bundle']) {
    test.fast(`${name} ${mode}: rows render under a strict CSP, indented by level, with no inline styles`, async t => {
      const page = await pageFor(t, engine, mode)
      await renderInspector(page)
      assert.deepEqual(await ids(page), ['r', 'r/.name', 'r/.results', 'r/.log', 'r/.byKey', 'r/.list', 'r/.self'])
      const indent = id => page.locator(`${row(id)} > a-tree-value`).evaluate(value => value.getBoundingClientRect().left)
      assert.ok(await indent('r/.name') > await indent('r'), 'a child is indented past its parent')
      assert.match(await page.locator('a-inspector').evaluate(host => getComputedStyle(host).fontFamily), /mono|Menlo|Consolas/i)
      assert.equal(await page.locator('a-inspector [style]').count(), 0)
      // Rows are Tree items, nested under their parent.
      assert.equal(await page.locator('a-tree-item[item-id="r"] > a-tree-group > a-tree-item[item-id="r/.name"]').count(), 1)
    })
  }

  test.fast(`${name}: clicks open and close rows, and a long list opens into ranges`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await page.locator(rowText('r/.results')).click()
    await until(page, async () => (await ids(page)).includes('r/.results/0'), 'results did not open')
    // 7 items with chunkSize 6: two ranges, which read their items only when open.
    await page.locator(rowText('r/.list')).click()
    await until(page, async () => (await ids(page)).includes('r/.list~g1~6-6'), 'list did not show its ranges')
    assert.deepEqual((await ids(page)).filter(id => id.startsWith('r/.list')), ['r/.list', 'r/.list~g1~0-5', 'r/.list~g1~6-6'])
    assert.equal(await page.locator(row('r/.list~g1~0-5')).textContent(), '[0…5]')
    await page.locator(rowText('r/.list~g1~0-5')).click()
    await until(page, async () => (await ids(page)).filter(id => id.startsWith('r/.list/')).length === 6, 'the first range did not open')
    await page.locator(rowText('r/.list~g1~6-6')).click()
    await until(page, async () => (await ids(page)).filter(id => id.startsWith('r/.list/')).length === 7, 'the second range did not open')
    await page.locator(rowText('r/.results')).click()
    await until(page, async () => !(await ids(page)).includes('r/.results/0'), 'results did not close')
  })

  // The ⋯ buttons have tabindex -1, so however many rows, Tab passes the tree once.
  test.fast(`${name}: the tree is one Tab stop`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await focusTree(page)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    assert.equal(await active(page), 'r/.results')
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'after')
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('item-id')), 'r/.results')
    assert.equal(await active(page), 'r/.results')
  })

  test.fast(`${name}: Right reaches ⋯ on a row that can't open or is open, and Left returns`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await focusTree(page)
    const onTree = () => onTreeAt(page)
    // name is a string, so Right goes straight to its button.
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    assert.equal(await focusedButtonRow(page), 'r/.name')
    assert.equal(await buttonOpacity(page, 'r/.name'), '1', 'the focused button is hidden')
    await page.keyboard.press('ArrowLeft')
    assert.ok(await onTree(), 'Left did not return to the tree')
    assert.equal(await active(page), 'r/.name')
    // results is closed: Right opens it, and a second Right reaches its button.
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    await until(page, () => isOpen(page, 'r/.results'), 'Right did not open results')
    assert.ok(await onTree(), 'opening moved focus off the tree')
    await page.keyboard.press('ArrowRight')
    assert.equal(await focusedButtonRow(page), 'r/.results')
    // Down on the button returns to the tree and moves; Escape returns too.
    await page.keyboard.press('ArrowDown')
    assert.ok(await onTree(), 'Down did not return to the tree')
    assert.equal(await active(page), 'r/.results/0')
    await page.keyboard.press('ArrowRight')
    await until(page, () => isOpen(page, 'r/.results/0'), 'Right did not open the first result')
    await page.keyboard.press('ArrowRight')
    assert.equal(await focusedButtonRow(page), 'r/.results/0')
    await page.keyboard.press('Escape')
    assert.ok(await onTree(), 'Escape did not return to the tree')
    assert.equal(await active(page), 'r/.results/0')
    // A range has no button: Right opens it, and a second Right moves to its first child.
    await page.locator(rowText('r/.list')).click()
    await until(page, async () => (await ids(page)).includes('r/.list~g1~0-5'), 'list did not open')
    await page.locator(rowText('r/.list~g1~0-5')).click()
    await until(page, () => isOpen(page, 'r/.list~g1~0-5'), 'the range did not open')
    await page.keyboard.press('ArrowLeft')
    await until(page, async () => !(await isOpen(page, 'r/.list~g1~0-5')), 'Left did not close the range')
    await page.keyboard.press('ArrowRight')
    await until(page, () => isOpen(page, 'r/.list~g1~0-5'), 'Right did not open the range')
    await page.keyboard.press('ArrowRight')
    assert.ok(await onTree(), 'Right left the tree on a range')
    assert.equal(await active(page), 'r/.list/0')
  })

  test.fast(`${name}: arrow keys, Home, End, Enter, and Space follow the tree pattern`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await focusTree(page)
    assert.equal(await active(page), 'r')
    const press = async (key, expected) => {
      await page.keyboard.press(key)
      await until(page, async () => await active(page) === expected, `${key} should make ${expected} active, not ${await active(page)}`)
    }
    await press('ArrowDown', 'r/.name')
    await press('ArrowDown', 'r/.results')
    await page.keyboard.press('ArrowRight')
    await until(page, () => isOpen(page, 'r/.results'), 'Right did not open results')
    assert.equal(await active(page), 'r/.results', 'opening keeps the row active')
    // Right on an open row reaches its ⋯; Down from there moves to the first child.
    await page.keyboard.press('ArrowRight')
    assert.equal(await focusedButtonRow(page), 'r/.results')
    await press('ArrowDown', 'r/.results/0')
    await page.keyboard.press('ArrowRight')
    await until(page, () => isOpen(page, 'r/.results/0'), 'Right did not open the first result')
    await page.keyboard.press('ArrowLeft')
    await until(page, async () => !(await isOpen(page, 'r/.results/0')), 'Left did not close the first result')
    await press('ArrowLeft', 'r/.results')
    await page.keyboard.press('ArrowLeft')
    await until(page, async () => !(await isOpen(page, 'r/.results')), 'Left did not close results')
    await press('End', 'r/.self')
    await press('Home', 'r')
    await press('PageDown', 'r/.self')
    // Enter on a cycle reveals its ancestor, makes it the active row, and
    // highlights it briefly.
    await press('Enter', 'r')
    assert.equal(await page.locator('a-tree-item[item-id="r"][data-revealed]').count(), 1, 'the revealed row is not highlighted')
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('item-id')), 'r', 'the reveal did not move focus')
    await until(page, async () => await page.locator('a-tree-item[data-revealed]').count() === 0, 'the highlight never faded')
    await page.keyboard.press(' ')
    await until(page, async () => (await ids(page)).length === 1, 'Space did not close the root')
    await press('ArrowUp', 'r')
  })

  test.fast(`${name}: Shift+F10 opens the copy menu for the active row`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await focusTree(page)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    assert.equal(await active(page), 'r/.results')
    // Menu binds its trigger once its anchor is seen on screen, a frame or two
    // after the first render; a person can't press keys sooner than that.
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))))
    await page.keyboard.press('Shift+F10')
    const item = label => page.locator('a-menu-item', { hasText: label }).first()
    await until(page, () => item('Copy path').isVisible(), 'the copy menu did not open')
    assert.ok(await item('Copy object').isVisible())
    if (engine === chromium) {
      await item('Copy path').click()
      await until(page, async () => await page.evaluate(() => navigator.clipboard.readText()) === 'results', 'Copy path did not copy "results"')
    }
  })

  test.fast(`${name}: ⋯ shows on hover and opens the copy menu at itself, without toggling the row`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await settle(page)
    const button = page.locator(`${row('r/.results')} > a-tree-actions > a-button`)
    const shown = () => page.$$eval('a-tree-actions', list => list
      .filter(actions => getComputedStyle(actions).visibility === 'visible' && getComputedStyle(actions).opacity === '1')
      .map(actions => actions.closest('a-tree-item').getAttribute('item-id')))
    assert.deepEqual(await shown(), [])
    await page.locator(`${row('r/.results')} a-inspector-key`).hover()
    assert.deepEqual(await shown(), ['r/.results'])
    await button.click()
    await until(page, async () => (await copyItems(page))[2]?.copy === 'results', 'the menu did not fill in for results')
    assert.equal(await isOpen(page, 'r/.results'), false, 'the row toggled')
    assert.equal(await active(page), 'r/.results')
    const corners = () => page.evaluate(() => [
      document.querySelector('a-tree-item[item-id="r/.results"] > a-tree-row > a-tree-actions > a-button').getBoundingClientRect(),
      document.querySelector('a-menu').shadowRoot.querySelector('[part~="menu"]').getBoundingClientRect(),
    ].map(({ left, top, bottom }) => ({ left, top, bottom })))
    await until(page, async () => (await corners())[1].left > 0, 'the menu was never placed')
    const [at, menu] = await corners()
    assert.ok(Math.abs(menu.left - at.left) < 12 && Math.abs(menu.top - at.bottom) < 12,
      `the menu opened at ${menu.left},${menu.top}, not the button's corner ${at.left},${at.bottom}`)
  })

  test.fast(`${name}: Enter and Space on ⋯ open the menu, and Escape returns to the tree`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await settle(page)
    await focusTree(page)
    await page.keyboard.press('ArrowDown')
    for (const key of ['Enter', ' ']) {
      await page.keyboard.press('ArrowRight')
      assert.equal(await focusedButtonRow(page), 'r/.name')
      const scroll = await page.evaluate(() => scrollY)
      await page.keyboard.press(key)
      await until(page, async () => (await copyItems(page))[2]?.copy === 'name', `${key} did not open the menu for name`)
      assert.equal(await page.evaluate(() => scrollY), scroll, `${key} scrolled the page`)
      await page.keyboard.press('Escape')
      await until(page, () => onTreeAt(page), 'Escape did not return focus to the tree')
      assert.equal(await active(page), 'r/.name')
    }
  })

  // A synthetic contextmenu can't open the browser's menu, so with text
  // selected, a menu the element opens itself must still be Anta's.
  test.fast(`${name}: with text selected, ⋯ and Shift+F10 still open the copy menu`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await settle(page)
    const selectName = () => page.evaluate(() => {
      const range = document.createRange()
      range.selectNodeContents(document.querySelector('a-tree-item[item-id="r/.name"] a-inspector-value'))
      getSelection().removeAllRanges()
      getSelection().addRange(range)
    })
    const opened = async () => (await copyItems(page)).some(item => !item.disabled) && await page.locator('a-menu-item', { hasText: 'Copy path' }).first().isVisible()
    await focusTree(page)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await selectName()
    await page.keyboard.press('Shift+F10')
    await until(page, opened, 'Shift+F10 opened no menu with text selected')
    await page.keyboard.press('Escape')
    await until(page, async () => !(await opened()), 'the menu did not close')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowRight')
    assert.equal(await focusedButtonRow(page), 'r/.name')
    await selectName()
    await page.keyboard.press('Enter')
    await until(page, opened, '⋯ opened no menu with text selected')
  })

  test.fast(`${name}: right-click copies a string's raw text`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await page.locator(rowText('r/.log')).click({ button: 'right' })
    const item = page.locator('a-menu-item', { hasText: 'Copy string' }).first()
    await until(page, () => item.isVisible(), 'the menu did not offer Copy string')
    if (engine === chromium) {
      await item.click()
      await until(page, async () => await page.evaluate(() => navigator.clipboard.readText()) === 'line one\nline two', 'Copy string did not copy the raw text')
    }
  })

  test.fast(`${name}: only the copy item just used shows its feedback, and closing clears it`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    const item = label => page.locator('a-menu-item', { hasText: label }).first()
    const green = () => page.$$eval('a-menu-item[tone="success"]', items => items.map(item => item.textContent.trim()))
    const openMenu = async id => {
      await page.locator(rowText(id)).click({ button: 'right' })
      await until(page, () => item('Copy path').isVisible(), `the menu did not open on ${id}`)
    }
    await openMenu('r/.name')
    await item('Copy path').click()
    await until(page, async () => JSON.stringify(await green()) === '["Copy path"]', `expected only Copy path to be green, got ${JSON.stringify(await green())}`)
    await item('Copy string').click()
    await until(page, async () => JSON.stringify(await green()) === '["Copy string"]', `expected only Copy string to be green, got ${JSON.stringify(await green())}`)
    // Closing clears it, so the next menu opens clean.
    await page.keyboard.press('Escape')
    await openMenu('r/.results')
    assert.deepEqual(await green(), [], 'feedback carried into the next menu')
    // Opening on another row while the menu is still open also starts clean.
    await item('Copy path').click()
    await until(page, async () => (await green()).length === 1, 'Copy path did not show feedback')
    // The open menu sits below r/.results, so right-click a row above it.
    await openMenu('r/.name')
    assert.deepEqual(await green(), [], 'feedback carried into the menu for another row')
  })

  test.fast(`${name}: Alt+click and Alt+Enter open and close a whole subtree`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await page.locator(rowText('r/.results')).click({ modifiers: ['Alt'] })
    await until(page, async () => (await ids(page)).includes('r/.results/1/.id'), 'Alt+click did not open the subtree')
    assert.ok(await isOpen(page, 'r/.results/0') && await isOpen(page, 'r/.results/1'))
    assert.equal(await active(page), 'r/.results')
    await page.locator('a-tree-item[item-id="r/.results"]').focus()
    await page.keyboard.press('Alt+Enter')
    await until(page, async () => !(await ids(page)).some(id => id.startsWith('r/.results/')), 'Alt+Enter did not close the subtree')
    await page.keyboard.press('ArrowRight')
    await until(page, () => isOpen(page, 'r/.results'), 'Right did not reopen results')
    assert.equal(await isOpen(page, 'r/.results/0'), false, 'a deep close leaves children closed')
  })

  test.fast(`${name}: the inline layout flows in text and becomes a block when opened`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page, { layout: 'inline' })
    const display = () => page.locator('a-inspector').evaluate(host => getComputedStyle(host).display)
    assert.equal(await display(), 'inline')
    assert.deepEqual(await ids(page), ['r'])
    await page.locator(rowText('r')).click()
    await until(page, async () => await display() === 'block', 'the inline Inspector did not become a block')
  })

  test.fast(`${name}: axe finds no WCAG A violations in an open tree`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page, { expandDepth: 2 })
    await page.addScriptTag({ url: '/axe.js' })
    const violations = await page.evaluate(async () => {
      const result = await window.axe.run(document.querySelector('#mount'), { runOnly: { type: 'tag', values: ['wcag2a'] } })
      return result.violations.map(violation => `${violation.id}: ${violation.nodes.length}`)
    })
    assert.deepEqual(violations, [])
    // Again with a ⋯ button focused.
    await focusTree(page)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    assert.ok(await focusedButtonRow(page))
    const focused = await page.evaluate(async () => {
      const result = await window.axe.run(document.querySelector('#mount'), { runOnly: { type: 'tag', values: ['wcag2a'] } })
      return result.violations.map(violation => `${violation.id}: ${violation.nodes.length}`)
    })
    assert.deepEqual(focused, [])
  })

  test.fast(`${name}: Copy JSON copies plain data and explains anything else`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    const openMenu = async id => {
      await page.locator(rowText(id)).click({ button: 'right' })
      await until(page, async () => (await copyItems(page))[2]?.copy !== null && !(await copyItems(page))[2]?.disabled, `the menu did not open on ${id}`)
    }
    await openMenu('r/.results')
    const json = (await copyItems(page))[1]
    assert.deepEqual(json, { label: 'Copy JSON', disabled: false, copy: '[{"id":"t1","ok":true},{"id":"t2","ok":false}]', hint: null })
    if (engine === chromium) {
      await page.locator('a-menu-item', { hasText: 'Copy JSON' }).first().click()
      await until(page, async () => await page.evaluate(() => navigator.clipboard.readText()) === json.copy, 'Copy JSON did not copy the JSON')
    }
    await page.keyboard.press('Escape')
    await openMenu('r/.byKey')
    assert.deepEqual((await copyItems(page))[1], { label: 'Copy JSON', disabled: true, copy: '', hint: 'Not JSON: a Map' })
  })

  test.fast(`${name}: with itemmenu delayed, the copy items wait for their row`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await page.evaluate(() => window.delayRowMenu(150))
    const arrivals = () => page.evaluate(() => window.itemmenuArrivals)
    // A first opening: every item stays disabled until its row's answer.
    await page.locator(rowText('r/.results')).click({ button: 'right' })
    await until(page, async () => (await copyItems(page)).length === 3, 'the menu did not open')
    assert.equal(await arrivals(), 0, 'the delay was too short to check before the answer')
    assert.deepEqual((await copyItems(page)).map(item => item.disabled), [true, true, true])
    await until(page, async () => (await copyItems(page)).every(item => !item.disabled), 'the items never became available')
    assert.deepEqual((await copyItems(page)).map(item => item.copy).slice(1), ['[{"id":"t1","ok":true},{"id":"t2","ok":false}]', 'results'])
    // Closed, then opened on another row: waiting again, never showing r/.results's text.
    await page.keyboard.press('Escape')
    await page.locator(rowText('r/.name')).click({ button: 'right' })
    assert.equal(await arrivals(), 1)
    assert.deepEqual((await copyItems(page)).map(item => item.disabled), [true, true, true])
    await until(page, async () => (await copyItems(page))[2].copy === 'name' && !(await copyItems(page))[2].disabled, 'the items never showed r/.name')
    assert.deepEqual((await copyItems(page)).map(item => item.copy), ['run', '"run"', 'name'])
  })

  // Tripwire for the known gap in the comment on `onItemMenu` in Inspector.tsx:
  // Menu moves an open menu to another row without closing, so until itemmenu
  // lands, the items still hold the previous row's text. If this fails, the gap
  // was closed; update that comment and this test.
  test.fast(`${name}: re-targeting an open menu keeps the previous row's text until itemmenu arrives (known gap)`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await page.evaluate(() => window.delayRowMenu(150))
    await page.locator(rowText('r/.results')).click({ button: 'right' })
    await until(page, async () => (await copyItems(page))[2]?.copy === 'results' && !(await copyItems(page))[2].disabled, 'the menu never showed r/.results')
    // The open menu sits below r/.results, so right-click a row above it.
    await page.locator(rowText('r/.name')).click({ button: 'right' })
    const before = await copyItems(page)
    assert.equal(await page.evaluate(() => window.itemmenuArrivals), 1, 'the delay was too short to check before the answer')
    assert.deepEqual(before.map(item => [item.disabled, item.copy]).slice(2), [[false, 'results']])
    await until(page, async () => (await copyItems(page))[2].copy === 'name', 'the menu never moved to r/.name')
  })

  test.fast(`${name}: block rows cut every value at the same edge, keys whole`, async t => {
    const page = await pageFor(t, engine)
    await page.setViewportSize({ width: 480, height: 600 })
    const numbers = Array.from({ length: 200 }, (_, i) => i * 37)
    await renderInspector(page, { value: { n: numbers, a_much_longer_key: numbers.map(String) } })
    const rows = await page.$$eval('a-tree-item[item-id="r"] > a-tree-group > a-tree-item > a-tree-row', rows => rows.map(row => {
      const key = row.querySelector('a-inspector-key')
      const value = row.querySelector('a-inspector-value')
      return {
        display: getComputedStyle(row).display,
        keyClipped: key.scrollWidth > key.clientWidth,
        valueClipped: value.scrollWidth > value.clientWidth,
        overflow: getComputedStyle(value).textOverflow,
        right: Math.round(value.getBoundingClientRect().right),
      }
    }))
    assert.equal(rows.length, 2)
    for (const row of rows) assert.deepEqual({ ...row, right: 0 }, { display: 'flex', keyClipped: false, valueClipped: true, overflow: 'ellipsis', right: 0 })
    assert.equal(rows[0].right, rows[1].right, 'the values end at different places')
  })

  // A centered flex column sizes its children to their content, as the docs
  // preview does. The Inspector must still stay inside it.
  test.fast(`${name}: in a container that sizes it to its content, rows still cut at the container's edge`, async t => {
    const page = await pageFor(t, engine)
    await page.setViewportSize({ width: 480, height: 600 })
    await page.evaluate(() => { document.querySelector('#mount').style.cssText = 'display: flex; flex-direction: column; align-items: center; width: 400px' })
    await renderInspector(page, { value: { n: Array.from({ length: 200 }, (_, i) => i * 37) } })
    const sizes = await page.evaluate(() => ({
      mount: document.querySelector('#mount').getBoundingClientRect().width,
      inspector: document.querySelector('a-inspector').getBoundingClientRect().width,
      clipped: (value => value.scrollWidth > value.clientWidth)(document.querySelector('a-tree-item[item-id="r/.n"] a-inspector-value')),
    }))
    // It fills the container: not wider, and not collapsed to its content or to nothing.
    assert.ok(Math.abs(sizes.inspector - sizes.mount) < 1, `the Inspector is ${sizes.inspector}px in a ${sizes.mount}px container`)
    assert.ok(sizes.clipped, 'the value was not clipped')
  })

  // In a narrow box, the indent would leave deep rows no room: each keeps its
  // key and some of its value, and the tree scrolls sideways instead.
  test.fast(`${name}: in a narrow container, deep rows keep their key and value text and the tree scrolls sideways`, async t => {
    const page = await pageFor(t, engine)
    await page.setViewportSize({ width: 600, height: 800 })
    await page.evaluate(() => { document.querySelector('#mount').style.cssText = 'display: block; width: 220px' })
    let value = { leaf: 'a long string value that cannot fit in the box' }
    for (let i = 0; i < 12; i++) value = { [`level_${i}_key_name`]: value }
    await renderInspector(page, { value, expandDepth: 20 })
    const sizes = await page.evaluate(() => {
      const tree = document.querySelector('a-inspector > a-tree')
      const probe = document.createElement('span')
      probe.style.font = getComputedStyle(tree).font
      probe.style.whiteSpace = 'pre'
      probe.textContent = '0'.repeat(24)
      document.body.append(probe)
      const floor = probe.getBoundingClientRect().width
      probe.remove()
      // A row's text: its key and value, which keep at least 24ch together.
      const values = [...tree.querySelectorAll('a-tree-item[data-type="node"] > a-tree-row > a-tree-value')].map(text => ({
        width: text.getBoundingClientRect().width,
        natural: text.scrollWidth,
      }))
      return { floor, values, scroll: tree.scrollWidth, client: tree.clientWidth, overflow: getComputedStyle(tree).overflowX }
    })
    assert.equal(sizes.overflow, 'auto')
    assert.ok(sizes.scroll > sizes.client, 'the tree does not scroll sideways')
    for (const { width, natural } of sizes.values) {
      assert.ok(width + 1 >= Math.min(natural, sizes.floor), `a row's text is ${width}px wide, under its ${Math.min(natural, sizes.floor)}px floor`)
    }
  })

  test.fast(`${name}: previewBudget ends a block row's summary at that many characters`, async t => {
    const page = await pageFor(t, engine)
    await page.setViewportSize({ width: 1400, height: 600 })
    const value = { list: Array.from({ length: 60 }, (_, i) => i * 37) }
    await renderInspector(page, { value, previewBudget: 20 })
    const summary = await page.locator('a-tree-item[item-id="r/.list"] a-inspector-value').textContent()
    assert.ok(summary.endsWith('…'), `the summary ${JSON.stringify(summary)} was not cut`)
    // Spacing is CSS, so the text is shorter than the drawn count.
    assert.ok(summary.length <= 20, `the summary has ${summary.length} characters`)
    await renderInspector(page, { value })
    const full = await page.locator('a-tree-item[item-id="r/.list"] a-inspector-value').textContent()
    assert.ok(full.length > 100, 'without previewBudget, block rows render to the edge')
  })

  test.fast(`${name}: on a wide screen, rows end 120 characters from the Inspector's start`, async t => {
    const page = await pageFor(t, engine)
    await page.setViewportSize({ width: 1600, height: 600 })
    const numbers = Array.from({ length: 200 }, (_, i) => i * 37)
    await renderInspector(page, { value: { n: numbers, a_much_longer_key: numbers.map(String), nested: { deeper: numbers } } })
    const sizes = await page.evaluate(() => {
      const inspector = document.querySelector('a-inspector')
      const probe = document.createElement('span')
      probe.style.font = getComputedStyle(inspector).font
      probe.style.whiteSpace = 'pre'
      probe.textContent = '0'.repeat(120)
      document.body.append(probe)
      const width = probe.getBoundingClientRect().width
      probe.remove()
      const box = inspector.getBoundingClientRect()
      return {
        limit: box.left + width,
        inspector: { left: box.left, right: box.right },
        rows: [...inspector.querySelectorAll('a-tree-item[data-type="node"] > a-tree-row')].map(row => ({
          id: row.parentElement.getAttribute('item-id'),
          right: row.getBoundingClientRect().right,
          end: row.querySelector('a-tree-actions').getBoundingClientRect().right,
          clipped: (value => value.scrollWidth > value.clientWidth)(row.querySelector('a-inspector-value')),
        })),
      }
    })
    assert.ok(sizes.inspector.right - sizes.limit > 200, 'the window is too narrow to show the limit')
    const clipped = sizes.rows.filter(row => row.clipped)
    assert.deepEqual(clipped.map(row => row.id), ['r/.n', 'r/.a_much_longer_key', 'r/.nested'])
    for (const row of clipped) assert.ok(Math.abs(row.end - sizes.limit) < 1.5, `${row.id} ends at ${row.end}, not ${sizes.limit}`)
    for (const row of sizes.rows) assert.equal(Math.round(row.right), Math.round(sizes.inspector.right), `${row.id} is narrower than the Inspector`)
  })

  test.fast(`${name}: ⋯ sits 12px after the value, square in the row, and --tree-actions-align: end pins it to the row's end`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    const measure = () => page.evaluate(() => {
      const line = document.querySelector('a-tree-item[item-id="r/.name"] > a-tree-row')
      const button = line.querySelector('a-tree-actions > a-button').getBoundingClientRect()
      const value = line.querySelector('a-inspector-value').getBoundingClientRect()
      const box = line.getBoundingClientRect()
      return { gap: button.left - value.right, width: button.width, height: button.height, toEnd: box.right - parseFloat(getComputedStyle(line).paddingInlineEnd) - button.right }
    })
    const start = await measure()
    assert.ok(Math.abs(start.gap - 12) < 1, `⋯ starts ${start.gap}px after the value`)
    assert.deepEqual([start.width, start.height], [18, 18])
    // ⋯ has no tooltip, but keeps its accessible name.
    const button = page.locator('a-tree-item[item-id="r/.name"] > a-tree-row > a-tree-actions > a-button')
    assert.equal(await button.locator('a-tooltip').count(), 0, '⋯ has a tooltip')
    assert.equal(await button.getAttribute('aria-label'), 'More actions')
    await page.evaluate(() => document.querySelector('a-inspector').style.setProperty('--tree-actions-align', 'end'))
    const end = await measure()
    assert.ok(Math.abs(end.toEnd) < 1, `⋯ ends ${end.toEnd}px before the row's end`)
  })

  test.fast(`${name}: controlled open takes path keys; keys that name no row are ignored`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page, { open: ['r', 'r/.results', 'r/.results/1', 'r/.gone'] })
    assert.deepEqual((await ids(page)).filter(id => id.startsWith('r/.results')), ['r/.results', 'r/.results/0', 'r/.results/1', 'r/.results/1/.id', 'r/.results/1/.ok'])
    // Controlled with no handler: a click requests, and nothing changes.
    await page.locator(rowText('r/.results')).click()
    await page.waitForTimeout(50)
    assert.ok((await ids(page)).includes('r/.results/0'))
  })

  test.fast(`${name}: every walkthrough value: each row with an arrow opens to children`, async t => {
    const page = await pageFor(t, engine)
    for (const kind of await page.evaluate(() => window.kindNames)) {
      await page.evaluate(name => window.renderKind(name), kind)
      // Open closed rows one at a time, as a reader would, up to 40 per value.
      for (let i = 0; i < 40; i++) {
        const id = await page.evaluate(() => document.querySelector('a-tree-item:state(closed)')?.getAttribute('item-id') ?? null)
        if (id === null) break
        await page.locator(rowText(id)).click()
        await until(page, async () => await isOpen(page, id), `${kind}: ${id} did not open`)
        const children = await page.locator(`a-tree-item[item-id="${id}"] > a-tree-group > a-tree-item`).count()
        assert.ok(children > 0, `${kind}: ${id} showed an arrow but opened to nothing`)
      }
      // Rows without an arrow have no open or closed state.
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('a-tree-item')]
        .filter(item => !item.matches(':state(open), :state(closed)'))
        .some(item => item.querySelector(':scope > a-tree-group'))), false, `${kind}: a row without an arrow has children`)
    }
  })

  test.fast(`${name}: closing a row that expandDepth opened sticks, even after the value changes`, async t => {
    const page = await pageFor(t, engine)
    // expandDepth 2 opens the root and its containers, including b.
    await renderInspector(page, { value: { a: { x: 1 }, b: { y: 2 } }, expandDepth: 2 })
    await until(page, async () => (await ids(page)).includes('r/.b/.y'), 'b did not start open')
    await page.locator(rowText('r/.b')).click()
    await until(page, async () => !(await ids(page)).includes('r/.b/.y'), 'b did not close')
    await page.waitForTimeout(200)
    assert.equal(await isOpen(page, 'r/.b'), false, 'b reopened on its own')
    // A new value with the same paths: b stays closed, and a stays open.
    await renderInspector(page, { value: { a: { x: 9 }, b: { y: 8 } }, expandDepth: 2 })
    await page.waitForTimeout(200)
    assert.equal(await isOpen(page, 'r/.b'), false, 'b reopened after the value changed')
    assert.equal(await isOpen(page, 'r/.a'), true, 'a closed after the value changed')
  })

  test.fast(`${name}: replacing the value keeps open the rows whose paths still exist`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page, { value: { a: { x: 1 }, b: { y: 2 }, c: [1, 2] } })
    await page.locator(rowText('r/.b')).click()
    await page.locator(rowText('r/.c')).click()
    await until(page, async () => (await ids(page)).includes('r/.c/1'), 'c did not open')
    // Reordered keys, and no `c`: `b` stays open by its key, `c` is ignored.
    await renderInspector(page, { value: { b: { y: 3 }, a: { x: 1 } } })
    await until(page, async () => JSON.stringify(await ids(page)) === JSON.stringify(['r', 'r/.b', 'r/.b/.y', 'r/.a']), `rows are ${await ids(page)}`)
  })

  test.fast(`${name}: current reveals a row by path without moving focus`, async t => {
    const page = await pageFor(t, engine)
    await page.setViewportSize({ width: 800, height: 200 })
    const value = { list: Array.from({ length: 60 }, (_, i) => i) }
    await renderInspector(page, { value, expandDepth: 2, chunkSize: 100 })
    await page.locator('#before').focus()
    // Firefox scrolls a newly focused element into view on the next frame, which would undo a reveal in this one.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await renderInspector(page, { value, expandDepth: 2, chunkSize: 100, current: [{ type: 'property', key: 'list' }, { type: 'index', index: 50 }] })
    await until(page, async () => await page.evaluate(() => {
      const item = document.querySelector('a-tree-item[data-current]')
      const box = item?.querySelector(':scope > a-tree-row').getBoundingClientRect()
      return item?.getAttribute('item-id') === 'r/.list/50' && box.top >= -1 && box.bottom <= innerHeight + 1
    }), 'the row was not revealed')
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'before', 'focus moved')
  })

  test.fast(`${name}: revealing index 50,000 of 100,000 renders no item before it`, async t => {
    const page = await pageFor(t, engine)
    await page.evaluate(() => window.revealBig(50000))
    await page.waitForFunction(() => document.querySelector('a-tree-item[data-current]')?.getAttribute('item-id') === 'r/.big/50000')
    const items = (await ids(page)).filter(id => /^r\/\.big\/\d+$/.test(id)).map(id => Number(id.split('/').at(-1)))
    assert.equal(items.length, 100, 'only the innermost range of 100 is rendered')
    assert.ok(items.every(index => index >= 50000), `rendered ${Math.min(...items)}`)
    assert.ok((await ids(page)).length < 150)
  })

  // Search: the field, its count, and the keys that step through matches.
  const searchField = page => page.getByRole('searchbox', { name: /^Search/ })
  const countText = page => page.locator('a-tree-toolbar [aria-live]').textContent()
  const currentId = page => page.evaluate(() => document.querySelector('a-tree-item[data-current]')?.getAttribute('item-id') ?? null)
  const marks = (page, id) => page.locator(`a-tree-item[item-id="${id}"] > a-tree-row mark`).allTextContents()

  test.fast(`${name}: search counts matches, steps with Enter and Shift+Enter, and Escape clears`, async t => {
    const page = await pageFor(t, engine)
    const value = { countries: ['Peru'], nested: { countries: ['France'], note: 'two countries' } }
    await renderInspector(page, { value, searchable: true })
    // The field sits before the tree, outside role="tree".
    assert.ok(await page.evaluate(() => {
      const toolbar = document.querySelector('a-tree-toolbar')
      return !!toolbar && !toolbar.closest('[role="tree"]') && toolbar.nextElementSibling?.localName === 'a-tree'
    }))
    await searchField(page).fill('Countries')
    await until(page, async () => await countText(page) === '3 matches', `count is ${await countText(page)}`)
    assert.equal(await currentId(page), null, 'nothing is current before the first step')
    assert.deepEqual(await marks(page, 'r/.countries'), ['countries'])
    // A closed row's preview holds two matches, but only its own rows match.
    assert.deepEqual(await marks(page, 'r/.nested'), [])
    await page.addScriptTag({ url: '/axe.js' })
    assert.deepEqual(await page.evaluate(async () => {
      const result = await window.axe.run(document.querySelector('#mount'), { runOnly: { type: 'tag', values: ['wcag2a'] } })
      return result.violations.map(violation => `${violation.id}: ${violation.nodes.length}`)
    }), [])

    await searchField(page).press('Enter')
    await until(page, async () => await countText(page) === '1 of 3', `count is ${await countText(page)}`)
    assert.equal(await currentId(page), 'r/.countries')
    // The next match is inside a closed row, which opens.
    await searchField(page).press('Enter')
    await until(page, async () => await currentId(page) === 'r/.nested/.countries', 'the second match is not current')
    assert.equal(await countText(page), '2 of 3')
    assert.deepEqual(await marks(page, 'r/.nested/.note'), ['countries'])
    await searchField(page).press('Shift+Enter')
    await searchField(page).press('Shift+Enter')
    await until(page, async () => await countText(page) === '3 of 3', 'Shift+Enter does not wrap to the last match')
    assert.equal(await currentId(page), 'r/.nested/.note')
    assert.ok(await page.evaluate(() => !!document.activeElement?.closest('a-tree-toolbar')), 'focus left the field')

    await searchField(page).press('Escape')
    await until(page, async () => await searchField(page).inputValue() === '', 'Escape did not clear the field')
    assert.equal(await countText(page), '')
    assert.equal(await currentId(page), null)
    assert.equal(await page.locator('a-inspector mark').count(), 0)
  })

  test.fast(`${name}: the previous and next buttons step through matches`, async t => {
    const page = await pageFor(t, engine)
    const value = { countries: ['Peru'], nested: { countries: ['France'], note: 'two countries' } }
    await renderInspector(page, { value, searchable: true })
    const previous = page.getByRole('button', { name: 'Previous match' })
    const next = page.getByRole('button', { name: 'Next match' })
    assert.ok(await next.isDisabled() && await previous.isDisabled(), 'the buttons are enabled with no matches')
    await searchField(page).fill('countries')
    await until(page, async () => await next.isEnabled(), 'the next button stayed disabled')
    await next.click()
    await until(page, async () => await countText(page) === '1 of 3', `count is ${await countText(page)}`)
    await next.click()
    await until(page, async () => await currentId(page) === 'r/.nested/.countries', 'next did not reveal the second match')
    await previous.click()
    await previous.click()
    await until(page, async () => await countText(page) === '3 of 3', 'previous does not wrap to the last match')
    assert.equal(await currentId(page), 'r/.nested/.note')
  })

  test.fast(`${name}: a closed row that matches on its type marks only its type, not its preview`, async t => {
    const page = await pageFor(t, engine)
    await page.evaluate(() => window.renderClassSearch())
    await searchField(page).fill('box')
    await until(page, async () => await countText(page) === '2 matches', `count is ${await countText(page)}`)
    // The closed row reads `Box {box: 1}`: its type matched, and `box` inside is its child's own match.
    assert.deepEqual(await marks(page, 'r/.x'), ['Box'])
  })

  test.fast(`${name}: search reveals matches deep in a 100,000-item list`, async t => {
    const page = await pageFor(t, engine)
    await page.setViewportSize({ width: 800, height: 300 })
    await page.evaluate(() => window.renderBigSearch())
    await searchField(page).fill('needle')
    await until(page, async () => await countText(page) === '2 matches', `count is ${await countText(page)}`)
    await searchField(page).press('Enter')
    await until(page, async () => await currentId(page) === 'r/.big/900', 'index 900 is not current')
    await searchField(page).press('Enter')
    await until(page, async () => await page.evaluate(() => {
      const item = document.querySelector('a-tree-item[data-current]')
      const box = item?.querySelector(':scope > a-tree-row').getBoundingClientRect()
      return item?.getAttribute('item-id') === 'r/.big/50000' && box.top >= -1 && box.bottom <= innerHeight + 1
    }), 'index 50,000 was not revealed')
    // Two ranges of 100 are open, around each match.
    assert.equal((await ids(page)).filter(id => /^r\/\.big\/\d+$/.test(id)).length, 200)
  })

  test.fast(`${name}: a search step asks a controlled Inspector to open the match's rows`, async t => {
    const page = await pageFor(t, engine)
    await page.evaluate(() => window.renderControlledSearch())
    await searchField(page).fill('needle')
    await searchField(page).press('Enter')
    await until(page, async () => await currentId(page) === 'r/.a/.deep', 'the match was not revealed')
    assert.deepEqual(await page.evaluate(() => window.scopes), ['reveal'])
    assert.deepEqual(await marks(page, 'r/.a/.deep'), ['needle'])
  })

  test.fast(`${name}: a closed inline summary counts its spacing and stays inline`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page, { layout: 'inline', value: Array.from({ length: 100 }, (_, i) => i) })
    const line = page.locator(row('r'))
    assert.equal(await line.evaluate(line => getComputedStyle(line).display), 'inline')
    const tokens = await line.locator('a-inspector-token').evaluateAll(tokens => tokens.map(token => [token.getAttribute('type'), token.textContent]))
    assert.equal(await line.locator('a-tree-actions').evaluate(actions => getComputedStyle(actions).display), 'none')
    assert.deepEqual(tokens.at(-1), ['ellipsis', '…'])
    assert.ok(tokens.every(([, text]) => text !== ''), 'an empty token keeps its spacing')
    assert.notEqual(tokens.at(-2)[0], 'comma')
    const commas = tokens.filter(([type]) => type === 'comma').reduce((count, [, text]) => count + text.length, 0)
    const width = tokens.reduce((sum, [, text]) => sum + text.length, 0) + commas
    assert.ok(width <= 80, `drawn width ${width} > 80`)
  })

  test.fast(`${name}: with a delayed renderer, keys stay consistent and requests repeat harmlessly`, async t => {
    const page = await pageFor(t, engine)
    await page.evaluate(() => window.renderDelayed(150))
    await focusTree(page)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    assert.equal(await active(page), 'r/.results')
    // Two Rights before the first answer arrives request the same state twice.
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowDown')
    assert.equal(await active(page), 'r/.log', 'Down moves among the rows already shown')
    await until(page, async () => (await ids(page)).includes('r/.results/0'), 'the delayed open never arrived')
    await page.waitForTimeout(250)
    assert.equal(await isOpen(page, 'r/.results'), true, 'a repeated request closed the row')
    assert.deepEqual(await page.evaluate(() => window.requests), ['r/.results', 'r/.results'])
    assert.equal(await active(page), 'r/.log', 'the active row survives the re-render')
    // When an ancestor of the active row closes, the ancestor becomes active.
    await page.keyboard.press('ArrowUp')
    assert.equal(await active(page), 'r/.results/1')
    await page.evaluate(() => window.closeRow('r/.results'))
    await until(page, async () => await active(page) === 'r/.results', 'the active row did not move to its closed ancestor')
  })
}
