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
// The chevron is a data: SVG mask, as Expander's is, so images allow data:.
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'"
const browsers = new Map()
let server, origin

// The sample, as ids in the tree style with expandDepth 1:
// r {…} > r:1.0 name, r:1.1 results, r:1.2 log, r:1.3 byKey, r:1.4 list, r:1.5 self (a cycle).
const app = `
  import React, { useState } from 'react'
  import { render } from 'preact'
  import { Inspector } from '${source}/components/Inspector'
  import { Tree } from '${source}/components/Tree'
  import { describe, visibleTree, openIds, setRowOpen } from '${source}/inspector-core'

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
  window.renderInspector = props => render(React.createElement(Inspector, { value: sample(), pageSize: 6, 'aria-label': 'Run', ...props }), mount())

  // A stand-in for a worker renderer: it renders a Tree from the core itself
  // and answers each request after a delay.
  function Delayed({ delay }) {
    const [root] = useState(() => describe(sample()))
    const [toggled, setToggled] = useState(() => new Set())
    const state = { style: 'tree', expandDepth: 1, toggled }
    const apply = (id, open) => setToggled(current => setRowOpen(root, { expandDepth: 1, toggled: current }, id, open))
    window.closeRow = id => apply(id, false)
    const toItem = row => ({
      id: row.id,
      label: [...(row.key ?? []), ...(row.tokens ?? [])].map(token => token.text).join(''),
      children: row.children?.map(toItem),
    })
    const onStateChange = (event, { next, prev }) => {
      const id = [...next.filter(id => !prev.includes(id)), ...prev.filter(id => !next.includes(id))][0]
      window.requests.push(id)
      setTimeout(() => apply(id, next.includes(id)), delay)
    }
    return React.createElement(Tree, { 'aria-label': 'Delayed', items: visibleTree(root, state).map(toItem), open: openIds(root, state), onStateChange })
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
      : ['tokens.css', 'reset.css', 'elements/a-inspector', 'elements/a-menu', 'elements/a-menu-item', 'elements/a-copy', 'elements/a-icon', 'elements/a-button', 'elements/a-tooltip']
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
      assert.deepEqual(await ids(page), ['r', 'r:1.0', 'r:1.1', 'r:1.2', 'r:1.3', 'r:1.4', 'r:1.5'])
      const indent = id => page.locator(`${row(id)} > a-tree-value`).evaluate(value => value.getBoundingClientRect().left)
      assert.ok(await indent('r:1.0') > await indent('r'), 'a child is indented past its parent')
      assert.match(await page.locator('a-inspector').evaluate(host => getComputedStyle(host).fontFamily), /mono|Menlo|Consolas/i)
      assert.equal(await page.locator('a-inspector [style]').count(), 0)
      // Rows are Tree items, nested under their parent.
      assert.equal(await page.locator('a-tree-item[item-id="r"] > a-tree-group > a-tree-item[item-id="r:1.0"]').count(), 1)
    })
  }

  test.fast(`${name}: clicks open and close rows and show more of a group`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await page.locator(row('r:1.1')).click()
    await until(page, async () => (await ids(page)).includes('r:1.1:1.0'), 'results did not open')
    await page.locator(row('r:1.4')).click()
    await until(page, async () => (await ids(page)).includes('r:1.4:1+'), 'list did not show a more row')
    assert.equal((await ids(page)).filter(id => id.startsWith('r:1.4:1.')).length, 6)
    await page.locator(row('r:1.4:1+')).click()
    await until(page, async () => (await ids(page)).filter(id => id.startsWith('r:1.4:1.')).length === 7, 'the next page did not show')
    await page.locator(row('r:1.1')).click()
    await until(page, async () => !(await ids(page)).includes('r:1.1:1.0'), 'results did not close')
  })

  // The ⋯ buttons have tabindex -1, so however many rows, Tab passes the tree once.
  test.fast(`${name}: the tree is one Tab stop`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await focusTree(page)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    assert.equal(await active(page), 'r:1.1')
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'after')
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('item-id')), 'r:1.1')
    assert.equal(await active(page), 'r:1.1')
  })

  test.fast(`${name}: Right reaches ⋯ on a row that can't open or is open, and Left returns`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page, { pageSize: 3 })
    await focusTree(page)
    const onTree = () => onTreeAt(page)
    // name is a string, so Right goes straight to its button.
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    assert.equal(await focusedButtonRow(page), 'r:1.0')
    assert.equal(await buttonOpacity(page, 'r:1.0'), '1', 'the focused button is hidden')
    await page.keyboard.press('ArrowLeft')
    assert.ok(await onTree(), 'Left did not return to the tree')
    assert.equal(await active(page), 'r:1.0')
    // results is closed: Right opens it, and a second Right reaches its button.
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    await until(page, () => isOpen(page, 'r:1.1'), 'Right did not open results')
    assert.ok(await onTree(), 'opening moved focus off the tree')
    await page.keyboard.press('ArrowRight')
    assert.equal(await focusedButtonRow(page), 'r:1.1')
    // Down on the button returns to the tree and moves; Escape returns too.
    await page.keyboard.press('ArrowDown')
    assert.ok(await onTree(), 'Down did not return to the tree')
    assert.equal(await active(page), 'r:1.1:1.0')
    await page.keyboard.press('ArrowRight')
    await until(page, () => isOpen(page, 'r:1.1:1.0'), 'Right did not open the first result')
    await page.keyboard.press('ArrowRight')
    assert.equal(await focusedButtonRow(page), 'r:1.1:1.0')
    await page.keyboard.press('Escape')
    assert.ok(await onTree(), 'Escape did not return to the tree')
    assert.equal(await active(page), 'r:1.1:1.0')
    // A Show more row has no button, so Right does nothing.
    await page.keyboard.press('End')
    await until(page, async () => (await active(page))?.endsWith('+'), 'End did not reach a Show more row')
    await page.keyboard.press('ArrowRight')
    assert.ok(await onTree(), 'Right left the tree on a Show more row')
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
    await press('ArrowDown', 'r:1.0')
    await press('ArrowDown', 'r:1.1')
    await page.keyboard.press('ArrowRight')
    await until(page, () => isOpen(page, 'r:1.1'), 'Right did not open results')
    assert.equal(await active(page), 'r:1.1', 'opening keeps the row active')
    // Right on an open row reaches its ⋯; Down from there moves to the first child.
    await page.keyboard.press('ArrowRight')
    assert.equal(await focusedButtonRow(page), 'r:1.1')
    await press('ArrowDown', 'r:1.1:1.0')
    await page.keyboard.press('ArrowRight')
    await until(page, () => isOpen(page, 'r:1.1:1.0'), 'Right did not open the first result')
    await page.keyboard.press('ArrowLeft')
    await until(page, async () => !(await isOpen(page, 'r:1.1:1.0')), 'Left did not close the first result')
    await press('ArrowLeft', 'r:1.1')
    await page.keyboard.press('ArrowLeft')
    await until(page, async () => !(await isOpen(page, 'r:1.1')), 'Left did not close results')
    await press('End', 'r:1.5')
    await press('Home', 'r')
    await press('PageDown', 'r:1.5')
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
    assert.equal(await active(page), 'r:1.1')
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
    const button = page.locator(`${row('r:1.1')} > a-tree-actions > a-button`)
    const shown = () => page.$$eval('a-tree-actions', list => list
      .filter(actions => getComputedStyle(actions).visibility === 'visible' && getComputedStyle(actions).opacity === '1')
      .map(actions => actions.closest('a-tree-item').getAttribute('item-id')))
    assert.deepEqual(await shown(), [])
    await page.locator(`${row('r:1.1')} a-inspector-key`).hover()
    assert.deepEqual(await shown(), ['r:1.1'])
    await button.click()
    await until(page, async () => (await copyItems(page))[2]?.copy === 'results', 'the menu did not fill in for results')
    assert.equal(await isOpen(page, 'r:1.1'), false, 'the row toggled')
    assert.equal(await active(page), 'r:1.1')
    const corners = () => page.evaluate(() => [
      document.querySelector('a-tree-item[item-id="r:1.1"] > a-tree-row > a-tree-actions > a-button').getBoundingClientRect(),
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
      assert.equal(await focusedButtonRow(page), 'r:1.0')
      const scroll = await page.evaluate(() => scrollY)
      await page.keyboard.press(key)
      await until(page, async () => (await copyItems(page))[2]?.copy === 'name', `${key} did not open the menu for name`)
      assert.equal(await page.evaluate(() => scrollY), scroll, `${key} scrolled the page`)
      await page.keyboard.press('Escape')
      await until(page, () => onTreeAt(page), 'Escape did not return focus to the tree')
      assert.equal(await active(page), 'r:1.0')
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
      range.selectNodeContents(document.querySelector('a-tree-item[item-id="r:1.0"] a-inspector-value'))
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
    assert.equal(await focusedButtonRow(page), 'r:1.0')
    await selectName()
    await page.keyboard.press('Enter')
    await until(page, opened, '⋯ opened no menu with text selected')
  })

  test.fast(`${name}: right-click copies a string's raw text`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await page.locator(row('r:1.2')).click({ button: 'right' })
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
      await page.locator(row(id)).click({ button: 'right' })
      await until(page, () => item('Copy path').isVisible(), `the menu did not open on ${id}`)
    }
    await openMenu('r:1.0')
    await item('Copy path').click()
    await until(page, async () => JSON.stringify(await green()) === '["Copy path"]', `expected only Copy path to be green, got ${JSON.stringify(await green())}`)
    await item('Copy string').click()
    await until(page, async () => JSON.stringify(await green()) === '["Copy string"]', `expected only Copy string to be green, got ${JSON.stringify(await green())}`)
    // Closing clears it, so the next menu opens clean.
    await page.keyboard.press('Escape')
    await openMenu('r:1.1')
    assert.deepEqual(await green(), [], 'feedback carried into the next menu')
    // Opening on another row while the menu is still open also starts clean.
    await item('Copy path').click()
    await until(page, async () => (await green()).length === 1, 'Copy path did not show feedback')
    // The open menu sits below r:1.1, so right-click a row above it.
    await openMenu('r:1.0')
    assert.deepEqual(await green(), [], 'feedback carried into the menu for another row')
  })

  test.fast(`${name}: Alt+click and Alt+Enter open and close a whole subtree`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await page.locator(row('r:1.1')).click({ modifiers: ['Alt'] })
    await until(page, async () => (await ids(page)).includes('r:1.1:1.1:1.0'), 'Alt+click did not open the subtree')
    assert.ok(await isOpen(page, 'r:1.1:1.0') && await isOpen(page, 'r:1.1:1.1'))
    assert.equal(await active(page), 'r:1.1')
    await page.locator('a-tree-item[item-id="r:1.1"]').focus()
    await page.keyboard.press('Alt+Enter')
    await until(page, async () => !(await ids(page)).some(id => id.startsWith('r:1.1:')), 'Alt+Enter did not close the subtree')
    await page.keyboard.press('ArrowRight')
    await until(page, () => isOpen(page, 'r:1.1'), 'Right did not reopen results')
    assert.equal(await isOpen(page, 'r:1.1:1.0'), false, 'a deep close leaves children closed')
  })

  test.fast(`${name}: the inline layout flows in text and becomes a block when opened`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page, { layout: 'inline' })
    const display = () => page.locator('a-inspector').evaluate(host => getComputedStyle(host).display)
    assert.equal(await display(), 'inline')
    assert.deepEqual(await ids(page), ['r'])
    await page.locator(row('r')).click()
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
      await page.locator(row(id)).click({ button: 'right' })
      await until(page, async () => (await copyItems(page))[2]?.copy !== null && !(await copyItems(page))[2]?.disabled, `the menu did not open on ${id}`)
    }
    await openMenu('r:1.1')
    const json = (await copyItems(page))[1]
    assert.deepEqual(json, { label: 'Copy JSON', disabled: false, copy: '[{"id":"t1","ok":true},{"id":"t2","ok":false}]', hint: null })
    if (engine === chromium) {
      await page.locator('a-menu-item', { hasText: 'Copy JSON' }).first().click()
      await until(page, async () => await page.evaluate(() => navigator.clipboard.readText()) === json.copy, 'Copy JSON did not copy the JSON')
    }
    await page.keyboard.press('Escape')
    await openMenu('r:1.3')
    assert.deepEqual((await copyItems(page))[1], { label: 'Copy JSON', disabled: true, copy: '', hint: 'Not JSON: a Map' })
  })

  test.fast(`${name}: with itemmenu delayed, the copy items wait for their row`, async t => {
    const page = await pageFor(t, engine)
    await renderInspector(page)
    await page.evaluate(() => window.delayRowMenu(150))
    const arrivals = () => page.evaluate(() => window.itemmenuArrivals)
    // A first opening: every item stays disabled until its row's answer.
    await page.locator(row('r:1.1')).click({ button: 'right' })
    await until(page, async () => (await copyItems(page)).length === 3, 'the menu did not open')
    assert.equal(await arrivals(), 0, 'the delay was too short to check before the answer')
    assert.deepEqual((await copyItems(page)).map(item => item.disabled), [true, true, true])
    await until(page, async () => (await copyItems(page)).every(item => !item.disabled), 'the items never became available')
    assert.deepEqual((await copyItems(page)).map(item => item.copy).slice(1), ['[{"id":"t1","ok":true},{"id":"t2","ok":false}]', 'results'])
    // Closed, then opened on another row: waiting again, never showing r:1.1's text.
    await page.keyboard.press('Escape')
    await page.locator(row('r:1.0')).click({ button: 'right' })
    assert.equal(await arrivals(), 1)
    assert.deepEqual((await copyItems(page)).map(item => item.disabled), [true, true, true])
    await until(page, async () => (await copyItems(page))[2].copy === 'name' && !(await copyItems(page))[2].disabled, 'the items never showed r:1.0')
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
    await page.locator(row('r:1.1')).click({ button: 'right' })
    await until(page, async () => (await copyItems(page))[2]?.copy === 'results' && !(await copyItems(page))[2].disabled, 'the menu never showed r:1.1')
    // The open menu sits below r:1.1, so right-click a row above it.
    await page.locator(row('r:1.0')).click({ button: 'right' })
    const before = await copyItems(page)
    assert.equal(await page.evaluate(() => window.itemmenuArrivals), 1, 'the delay was too short to check before the answer')
    assert.deepEqual(before.map(item => [item.disabled, item.copy]).slice(2), [[false, 'results']])
    await until(page, async () => (await copyItems(page))[2].copy === 'name', 'the menu never moved to r:1.0')
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
      clipped: (value => value.scrollWidth > value.clientWidth)(document.querySelector('a-tree-item[item-id="r:1.0"] a-inspector-value')),
    }))
    assert.ok(sizes.inspector <= sizes.mount, `the Inspector is ${sizes.inspector}px in a ${sizes.mount}px container`)
    assert.ok(sizes.clipped, 'the value was not clipped')
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
    assert.deepEqual(clipped.map(row => row.id), ['r:1.0', 'r:1.1', 'r:1.2'])
    for (const row of clipped) assert.ok(Math.abs(row.end - sizes.limit) < 1.5, `${row.id} ends at ${row.end}, not ${sizes.limit}`)
    for (const row of sizes.rows) assert.equal(Math.round(row.right), Math.round(sizes.inspector.right), `${row.id} is narrower than the Inspector`)
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
    assert.equal(await active(page), 'r:1.1')
    // Two Rights before the first answer arrives request the same state twice.
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowDown')
    assert.equal(await active(page), 'r:1.2', 'Down moves among the rows already shown')
    await until(page, async () => (await ids(page)).includes('r:1.1:1.0'), 'the delayed open never arrived')
    await page.waitForTimeout(250)
    assert.equal(await isOpen(page, 'r:1.1'), true, 'a repeated request closed the row')
    assert.deepEqual(await page.evaluate(() => window.requests), ['r:1.1', 'r:1.1'])
    assert.equal(await active(page), 'r:1.2', 'the active row survives the re-render')
    // When an ancestor of the active row closes, the ancestor becomes active.
    await page.keyboard.press('ArrowUp')
    assert.equal(await active(page), 'r:1.1:1.1')
    await page.evaluate(() => window.closeRow('r:1.1'))
    await until(page, async () => await active(page) === 'r:1.1', 'the active row did not move to its closed ancestor')
  })
}
