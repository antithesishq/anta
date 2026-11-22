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

// A hand-built tree, as an author would write it with no script of their own:
//   src (open)            actions: New file, More (opens the menu)
//     src/a.ts            leaf
//     src/lib (closed)
//       src/lib/b.ts      leaf
//     src/old (disabled, closed)
//       src/old/c.ts
//   readme                leaf
const item = (id, label, { state, actions = '', children = '', after = '', disabled = false } = {}) => `
  <a-tree-item role="treeitem" item-id="${id}" ${state ? `default-state="${state}"` : ''} ${disabled ? 'disabled aria-disabled="true"' : ''} aria-labelledby="v-${id.replaceAll('/', '-')}" TABINDEX>
    <a-tree-row><a-tree-indicator shape="chevron" aria-hidden="true"></a-tree-indicator><a-tree-value id="v-${id.replaceAll('/', '-')}">${label}</a-tree-value>${children ? '<a-tree-before>{</a-tree-before>' : ''}${actions}</a-tree-row>
    ${children ? `<a-tree-group role="group">${children}</a-tree-group>` : ''}${after}
  </a-tree-item>`
const actions = '<a-tree-actions><button type="button" tabindex="-1" id="new" aria-label="New file">+</button><button type="button" tabindex="-1" id="more" aria-label="More actions" aria-haspopup="menu">…</button></a-tree-actions>'
const tree = item('src', 'src', {
  state: 'open', actions, after: '<a-tree-after>}</a-tree-after>',
  children: item('src/a.ts', 'a.ts') +
    item('src/lib', 'lib', { state: 'closed', children: item('src/lib/b.ts', 'b.ts') }) +
    item('src/old', 'old', { state: 'closed', disabled: true, children: item('src/old/c.ts', 'c.ts') }),
}) + item('readme', 'readme')
const rawTree = `<a-tree role="tree" tabindex="0" aria-label="Files">${tree.replaceAll('TABINDEX', '')}</a-tree><a-menu context><a-menu-item>Rename</a-menu-item></a-menu>`
// Under the wrapper, items carry a roving tabindex. The app script below plays
// the wrapper: it moves tabindex on `navigate`.
const rovingTree = `<a-tree role="tree" aria-label="Files">${tree.replaceAll('TABINDEX', 'tabindex="-1"').replace('tabindex="-1"', 'tabindex="0"')}</a-tree>`

const app = `
  window.events = []
  const record = event => window.events.push({ type: event.type, id: event.detail?.id ?? event.target.getAttribute?.('item-id') ?? null, detail: event.detail ?? null })
  window.mountTree = kind => {
    document.querySelector('#mount').innerHTML = kind === 'roving' ? ${JSON.stringify(rovingTree)} : ${JSON.stringify(rawTree)}
    const host = document.querySelector('a-tree')
    host.addEventListener('navigate', event => {
      record(event)
      if (kind !== 'roving') return
      for (const item of host.querySelectorAll('a-tree-item')) item.setAttribute('tabindex', item.getAttribute('item-id') === event.detail.id ? '0' : '-1')
    })
    host.addEventListener('itemmenu', record)
    document.addEventListener('contextmenu', record)
    for (const item of host.querySelectorAll('a-tree-item')) {
      item.addEventListener('statechange', event => {
        record(event)
        if (window.veto) event.preventDefault()
      })
      item.addEventListener('activate', record)
    }
    if (kind === 'roving') return
    // Interaction must never write the DOM.
    window.writes = []
    new MutationObserver(records => window.writes?.push(...records.map(r => r.type + ':' + (r.attributeName ?? '')))).observe(host, { attributes: true, childList: true, subtree: true, characterData: true })
  }
  // Controlled: the item has 'state', and the app answers each request.
  window.controlItem = id => {
    const item = document.querySelector('a-tree-item[item-id="' + id + '"]')
    item.setAttribute('state', item.getAttribute('default-state'))
    item.addEventListener('statechange', event => { if (window.accept) item.setAttribute('state', event.detail.next) })
    queueMicrotask(() => { window.writes = [] })
  }
`

// The folder tree from the Tree docs, built from the public API alone.
const jsxApp = `
  import React, { useState } from 'react'
  import { render } from 'preact'
  import { Tree } from '${source}/components/Tree'
  import { Icon } from '${source}/components/Icon'
  import { Menu } from '${source}/components/Menu'
  import { MenuItem } from '${source}/components/MenuItem'

  const files = [
    { path: 'src', name: 'src', entries: [
      { path: 'src/index.ts', name: 'index.ts' },
      { path: 'src/lib', name: 'lib', entries: [{ path: 'src/lib/util.ts', name: 'util.ts' }] },
      { path: 'src/empty', name: 'empty', entries: [] },
    ] },
    { path: 'README.md', name: 'README.md' },
  ]
  window.log = []
  const toItems = entries => entries.map(entry => ({
    id: entry.path,
    label: entry.name,
    children: entry.entries && toItems(entry.entries),
    indicator: entry.entries ? undefined : React.createElement(Icon, { shape: 'file' }),
    actions: entry.entries ? [
      { icon: 'file', label: 'New file', tooltip: 'New file', onClick: () => window.log.push('new:' + entry.path) },
      { icon: 'more', label: 'More actions', opensMenu: true },
    ] : undefined,
    onClick: entry.entries ? undefined : () => window.log.push('open:' + entry.path),
    'data-kind': entry.entries ? 'folder' : 'file',
  }))

  function App(props) {
    const [open, setOpen] = useState(props.open)
    const [menuItem, setMenuItem] = useState(null)
    const [focus, setFocus] = useState(props.initialFocus)
    window.requestFocus = (id, n) => setFocus({ id, n })
    const [current, setCurrent] = useState(undefined)
    window.setCurrent = setCurrent
    const state = props.controlled
      ? { open, onStateChange: (event, detail) => { window.log.push(detail); if (window.accept) setOpen(detail.next) } }
      : { defaultOpen: ['src'], onStateChange: (event, detail) => { window.log.push(detail); if (window.veto) event.preventDefault() } }
    const tree = React.createElement(Tree, {
      'aria-label': 'Files',
      items: toItems(files),
      indicator: { closed: React.createElement(Icon, { shape: 'folder-close' }), open: React.createElement(Icon, { shape: 'folder-open' }) },
      ...state,
      onItemMenu: (event, { id }) => setMenuItem(id),
      focusRequest: focus,
      current,
      toolbar: props.toolbar ? React.createElement('input', { id: 'find', 'aria-label': 'Find' }) : undefined,
      ...(props.custom ? {
        indicator: 'chevron',
        indicatorPlacement: 'end',
        renderLabel: (item, s) => item.label + (s.open ? ' (open)' : '') + ' @' + s.depth,
      } : {}),
    })
    return React.createElement(React.Fragment, null, tree,
      React.createElement(Menu, { context: true }, React.createElement(MenuItem, { label: 'Rename ' + (menuItem ?? '…') })))
  }
  window.renderTree = props => render(React.createElement(App, props), document.querySelector('#mount'))
`

before(async () => {
  const assets = new Map()
  for (const mode of ['granular', 'bundle']) {
    const contents = mode === 'bundle'
      ? `import '${source}/bundle';`
      : ['tokens.css', 'reset.css', 'elements/a-tree', 'elements/a-menu', 'elements/a-menu-item', 'elements/a-button', 'elements/a-icon', 'elements/a-tooltip']
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
  assets.set('/app.js', app)
  const jsx = await build({
    stdin: { contents: jsxApp, resolveDir: process.cwd() }, bundle: true, write: false,
    outfile: 'jsx.js', format: 'esm', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    define: { 'process.env.NODE_ENV': '"production"' },
    nodePaths: [resolve('node_modules'), resolve('site/node_modules')],
    alias: { '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime'), react: requireSite.resolve('preact/compat') },
  })
  for (const file of jsx.outputFiles) if (file.path.endsWith('.js')) assets.set('/jsx.js', file.text)
  assets.set('/axe.js', await readFile(require.resolve('axe-core/axe.min.js'), 'utf8'))
  assets.set('/antithesis.css', await readFile(resolve(source, 'theme-antithesis.css'), 'utf8'))
  assets.set('/boot.js', `window.cspViolations=[]; document.addEventListener('securitypolicyviolation', e=>window.cspViolations.push(e.effectiveDirective));`)
  server = createServer((req, res) => {
    res.setHeader('Content-Security-Policy', policy)
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html')
    const mode = new URL(req.url, 'http://localhost').searchParams.get('mode') || 'granular'
    // Inputs, not buttons: WebKit's Tab skips buttons by default.
    res.end(assets.get(req.url) ?? `<!doctype html><link rel="stylesheet" href="/${mode}.css"><script src="/boot.js"></script><input id="before" aria-label="Before"><div id="mount"></div><input id="after" aria-label="After">`)
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

async function pageFor(t, engine, { mode = 'granular', kind = 'raw', props = {}, touch = false } = {}) {
  const context = await browsers.get(engine).newContext({ reducedMotion: 'reduce', ...(touch ? { hasTouch: true, isMobile: true } : {}) })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const response = await page.goto(`${origin}/?mode=${mode}`)
  assert.equal(response.headers()['content-security-policy'], policy)
  await page.evaluate(async mode => { await import(`/${mode}.js`); await import('/app.js'); await import('/jsx.js') }, mode)
  if (kind === 'jsx') await page.evaluate(props => window.renderTree(props), props)
  else await page.evaluate(kind => window.mountTree(kind), kind)
  t.after(async () => {
    try {
      assert.deepEqual(errors, [])
      assert.deepEqual(await page.evaluate(() => window.cspViolations), [])
      if (kind === 'raw') assert.deepEqual(await page.evaluate(() => window.writes), [], 'interaction wrote the DOM')
    } finally { await context.close() }
  })
  return page
}

// Ids of the items shown now, in order.
const shown = page => page.$$eval('a-tree-item', items => items
  .filter(item => item.querySelector(':scope > a-tree-row').getClientRects().length > 0)
  .map(item => item.getAttribute('item-id')))
const active = page => page.evaluate(() => document.querySelector('a-tree-item:state(active)')?.getAttribute('item-id') ?? null)
const focused = page => page.evaluate(() => {
  const element = document.activeElement
  return element?.id || element?.getAttribute('item-id') || element?.localName || null
})
const events = (page, type) => page.evaluate(type => window.events.filter(event => event.type === type), type)
// Menu binds its trigger once its anchor is seen on screen, a frame or two
// after the first render; a person can't act sooner than that.
const settle = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))))
const row = (page, id) => page.locator(`a-tree-item[item-id="${id}"] > a-tree-row`)
// A row's text, which clicks target: the row's center can fall on an action.
const rowText = (page, id) => row(page, id).locator('a-tree-value')
async function focusTree(page) {
  await page.locator('#before').focus()
  await page.keyboard.press('Tab')
}

for (const engine of engines) {
  const name = engine.name()

  for (const mode of ['granular', 'bundle']) {
    test.fast(`${name} ${mode}: a hand-built tree renders under a strict CSP, nested and indented`, async t => {
      const page = await pageFor(t, engine, { mode })
      assert.deepEqual(await shown(page), ['src', 'src/a.ts', 'src/lib', 'src/old', 'readme'])
      const start = id => row(page, id).locator('a-tree-value').evaluate(value => value.getBoundingClientRect().left)
      assert.ok(await start('src/a.ts') > await start('src'), 'a child is indented past its parent')
      assert.equal(await page.locator('a-tree [style]').count(), 0)
      // The open/closed state is off-DOM, in the item's custom states.
      assert.ok(await page.locator('a-tree-item[item-id="src"]').evaluate(item => item.matches(':state(open)')))
      assert.ok(await page.locator('a-tree-item[item-id="src/lib"]').evaluate(item => item.matches(':state(closed)')))
      assert.ok(await page.locator('a-tree-item[item-id="readme"]').evaluate(item => !item.matches(':state(open), :state(closed)')))
    })
  }

  test.fast(`${name}: clicks on a row open and close it, with no script of the author's own`, async t => {
    const page = await pageFor(t, engine)
    await row(page, 'src/lib').locator('a-tree-value').click()
    assert.deepEqual(await shown(page), ['src', 'src/a.ts', 'src/lib', 'src/lib/b.ts', 'src/old', 'readme'])
    assert.deepEqual((await events(page, 'statechange')).map(event => event.detail), [{ next: 'open', prev: 'closed', scope: 'item' }])
    // The whole row is clickable, not just its label.
    const box = await row(page, 'src/lib').boundingBox()
    await page.mouse.click(box.x + box.width - 4, box.y + box.height / 2)
    assert.ok(!(await shown(page)).includes('src/lib/b.ts'), 'a click at the row end did not close it')
    // Closing src hides its children and its closing line.
    await row(page, 'src').locator('a-tree-value').click()
    assert.deepEqual(await shown(page), ['src', 'readme'])
    assert.equal(await page.locator('a-tree-item[item-id="src"] > a-tree-after').evaluate(line => line.getClientRects().length), 0)
    assert.equal(await page.locator('a-tree-item[item-id="src"] > a-tree-row > a-tree-before').evaluate(part => part.getClientRects().length), 0)
  })

  test.fast(`${name}: Alt+click opens or closes a whole subtree; a leaf sends activate`, async t => {
    const page = await pageFor(t, engine)
    await row(page, 'src').locator('a-tree-value').click()
    await row(page, 'src').locator('a-tree-value').click({ modifiers: ['Alt'] })
    assert.deepEqual((await events(page, 'statechange')).at(-1).detail, { next: 'open', prev: 'closed', scope: 'subtree' })
    // Disabled src/old stays closed: it can't open.
    assert.deepEqual(await shown(page), ['src', 'src/a.ts', 'src/lib', 'src/lib/b.ts', 'src/old', 'readme'])
    await rowText(page, 'readme').click()
    assert.deepEqual((await events(page, 'activate')).map(event => event.id), ['readme'])
    // A disabled item neither opens nor activates.
    await rowText(page, 'src/old').click()
    assert.ok(!(await shown(page)).includes('src/old/c.ts'))
  })

  test.fast(`${name}: a vetoed request changes nothing; a controlled item waits for its caller`, async t => {
    const page = await pageFor(t, engine)
    await page.evaluate(() => { window.veto = true })
    await rowText(page, 'src/lib').click()
    assert.ok(!(await shown(page)).includes('src/lib/b.ts'), 'the veto did not hold')
    await page.evaluate(() => { window.veto = false; window.controlItem('src/lib') })
    await rowText(page, 'src/lib').click()
    assert.ok(!(await shown(page)).includes('src/lib/b.ts'), 'a controlled item opened itself')
    await page.evaluate(() => { window.accept = true; window.writes = null })
    await rowText(page, 'src/lib').click()
    assert.ok((await shown(page)).includes('src/lib/b.ts'), 'the accepted request did not apply')
    await page.evaluate(() => { window.writes = [] })
  })

  test.fast(`${name}: hand-built, the host is the one Tab stop and the arrow keys follow the tree pattern`, async t => {
    const page = await pageFor(t, engine)
    await focusTree(page)
    assert.equal(await focused(page), 'a-tree')
    assert.equal(await active(page), 'src')
    await page.keyboard.press('ArrowDown')
    assert.equal(await active(page), 'src/a.ts')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    assert.ok((await shown(page)).includes('src/lib/b.ts'), 'Right did not open lib')
    assert.equal(await active(page), 'src/lib', 'opening moved the cursor')
    await page.keyboard.press('ArrowDown')
    assert.equal(await active(page), 'src/lib/b.ts')
    await page.keyboard.press('ArrowLeft')
    assert.equal(await active(page), 'src/lib', 'Left on a leaf did not go to its parent')
    await page.keyboard.press('ArrowLeft')
    assert.ok(!(await shown(page)).includes('src/lib/b.ts'), 'Left did not close lib')
    await page.keyboard.press('End')
    assert.equal(await active(page), 'readme')
    await page.keyboard.press('Home')
    assert.equal(await active(page), 'src')
    await page.keyboard.press('Space')
    assert.deepEqual(await shown(page), ['src', 'readme'])
    await page.keyboard.press('Enter')
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    assert.deepEqual((await events(page, 'activate')).map(event => event.id), ['readme'])
    assert.deepEqual((await events(page, 'navigate')).map(event => event.id).slice(0, 3), ['src', 'src/a.ts', 'src/lib'])
    // Tab leaves the tree in one step.
    await page.keyboard.press('Tab')
    assert.equal(await focused(page), 'after')
  })

  test.fast(`${name}: Right reaches a row's actions, which Left, Right, Escape and Down move between and out of`, async t => {
    const page = await pageFor(t, engine)
    await focusTree(page)
    // src is open, so Right goes to its first action.
    await page.keyboard.press('ArrowRight')
    assert.equal(await focused(page), 'new')
    assert.equal(await page.locator('#new').evaluate(button => getComputedStyle(button.parentElement).opacity), '1', 'focused actions are hidden')
    await page.keyboard.press('ArrowRight')
    assert.equal(await focused(page), 'more')
    await page.keyboard.press('ArrowRight')
    assert.equal(await focused(page), 'more', 'Right past the last action moved')
    await page.keyboard.press('ArrowLeft')
    assert.equal(await focused(page), 'new')
    await page.keyboard.press('ArrowLeft')
    assert.equal(await focused(page), 'a-tree', 'Left on the first action did not return')
    assert.equal(await active(page), 'src')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Escape')
    assert.equal(await focused(page), 'a-tree', 'Escape did not return')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowDown')
    assert.equal(await focused(page), 'a-tree', 'Down did not return')
    assert.equal(await active(page), 'src/a.ts')
    // A leaf with no actions: Right does nothing.
    await page.keyboard.press('ArrowRight')
    assert.equal(await focused(page), 'a-tree')
    assert.equal(await active(page), 'src/a.ts')
  })

  test.fast(`${name}: under the wrapper, real focus moves between items with a roving tabindex`, async t => {
    const page = await pageFor(t, engine, { kind: 'roving' })
    await focusTree(page)
    assert.equal(await focused(page), 'src')
    await page.keyboard.press('ArrowDown')
    assert.equal(await focused(page), 'src/a.ts')
    await page.keyboard.press('Tab')
    assert.equal(await focused(page), 'after', 'Tab stopped inside the tree')
    await page.keyboard.press('Shift+Tab')
    assert.equal(await focused(page), 'src/a.ts', 'Shift+Tab did not return to the last item')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowRight')
    assert.equal(await focused(page), 'new')
    await page.keyboard.press('Escape')
    assert.equal(await focused(page), 'src', 'Escape did not return to the item')
    // The focus ring goes on the row, not around the item and its children.
    assert.equal(await page.locator('a-tree-item[item-id="src"]').evaluate(item => getComputedStyle(item).outlineStyle), 'none')
  })

  test.fast(`${name}: Shift+F10, the More action and a right-click send itemmenu, then open a following menu`, async t => {
    const page = await pageFor(t, engine)
    await settle(page)
    await focusTree(page)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Shift+F10')
    const sequence = await page.evaluate(() => window.events.filter(event => event.type === 'itemmenu' || event.type === 'contextmenu').map(event => event.type + ':' + (event.type === 'itemmenu' ? event.id : '')))
    assert.deepEqual(sequence, ['itemmenu:src/a.ts', 'contextmenu:'])
    await page.waitForFunction(() => document.querySelector('a-menu').isOpen)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('a-menu').isOpen)
    await row(page, 'src').hover()
    await page.locator('#more').click()
    await page.waitForFunction(() => document.querySelector('a-menu').isOpen)
    assert.equal((await events(page, 'itemmenu')).at(-1).id, 'src')
    await page.keyboard.press('Escape')
    await rowText(page, 'readme').click({ button: 'right' })
    assert.equal((await events(page, 'itemmenu')).at(-1).id, 'readme')
    assert.equal(await active(page), 'readme')
    // The New file action is not a menu action.
    const before = (await events(page, 'itemmenu')).length
    await page.keyboard.press('Escape')
    await row(page, 'src').hover()
    await page.locator('#new').click()
    assert.equal((await events(page, 'itemmenu')).length, before)
  })

  // WebKit selects the word under a right-click before `contextmenu` fires.
  // That selection is the browser's, not the reader's, so the menu still opens.
  test.fast(`${name}: a right-click on a row's text opens the following menu, even where the browser selects the word`, async t => {
    const page = await pageFor(t, engine)
    await settle(page)
    await rowText(page, 'readme').click({ button: 'right' })
    await page.waitForFunction(() => document.querySelector('a-menu').isOpen)
    assert.equal((await events(page, 'itemmenu')).at(-1)?.id, 'readme')
  })

  test.fast(`${name}: a right-click inside text the reader selected leaves the browser's own menu`, async t => {
    const page = await pageFor(t, engine)
    await settle(page)
    // Select the row's text, as a reader would before copying it.
    await page.evaluate(() => {
      const range = document.createRange()
      range.selectNodeContents(document.querySelector('a-tree-item[item-id="readme"] > a-tree-row > a-tree-value'))
      getSelection().removeAllRanges()
      getSelection().addRange(range)
      // Whether anything canceled the browser's menu, read once the event has finished.
      window.contextmenuPrevented = []
      window.addEventListener('contextmenu', event => setTimeout(() => window.contextmenuPrevented.push(event.defaultPrevented)), true)
    })
    const before = (await events(page, 'itemmenu')).length
    await rowText(page, 'readme').click({ button: 'right' })
    await page.waitForFunction(() => window.contextmenuPrevented.length > 0)
    assert.deepEqual(await page.evaluate(() => window.contextmenuPrevented), [false], 'the browser menu was canceled')
    assert.equal((await events(page, 'itemmenu')).length, before, 'itemmenu was sent')
    assert.equal(await page.evaluate(() => document.querySelector('a-menu').isOpen), false)
  })

  test.fast(`${name}: data-focus focuses and reveals an item, and a new count repeats it`, async t => {
    const page = await pageFor(t, engine, { kind: 'roving' })
    await page.evaluate(() => document.querySelector('a-tree').setAttribute('data-focus', 'readme#1'))
    await page.waitForFunction(() => document.activeElement?.getAttribute('item-id') === 'readme')
    await page.keyboard.press('Home')
    assert.equal(await focused(page), 'src')
    await page.evaluate(() => document.querySelector('a-tree').setAttribute('data-focus', 'readme#2'))
    await page.waitForFunction(() => document.activeElement?.getAttribute('item-id') === 'readme')
    // A hidden item is not focused.
    await page.evaluate(() => document.querySelector('a-tree').setAttribute('data-focus', 'src/lib/b.ts#3'))
    await page.waitForTimeout(50)
    assert.equal(await focused(page), 'readme')
  })

  test.fast(`${name}: closing the active item's parent moves the cursor to the parent`, async t => {
    const page = await pageFor(t, engine)
    await focusTree(page)
    await page.keyboard.press('ArrowDown')
    assert.equal(await active(page), 'src/a.ts')
    await row(page, 'src').locator('a-tree-value').click()
    await page.keyboard.press('ArrowDown')
    assert.equal(await active(page), 'readme')
  })

  test(`${name}: axe finds no violations`, async t => {
    const page = await pageFor(t, engine)
    await page.evaluate(async () => { await import('/axe.js') })
    await focusTree(page)
    await page.keyboard.press('ArrowRight')
    const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('a-tree'))).violations.map(v => v.id + ': ' + v.nodes.map(n => n.target).join(' ')))
    assert.deepEqual(violations, [])
  })

  // ─── The Tree wrapper ─────────────────────────────────────────────────────

  const tabStops = page => page.$$eval('a-tree-item[tabindex="0"]', items => items.map(item => item.getAttribute('item-id')))
  const shownIcon = (page, id) => page.locator(`a-tree-item[item-id="${id}"] > a-tree-row > a-tree-indicator`).evaluateAll(marks =>
    marks.filter(mark => mark.getClientRects().length > 0).map(mark => mark.querySelector('a-icon')?.getAttribute('shape') ?? null))
  const log = page => page.evaluate(() => window.log)

  for (const mode of ['granular', 'bundle']) {
    test.fast(`${name} ${mode}: a folder tree renders from items alone, with one Tab stop and folder icons`, async t => {
      const page = await pageFor(t, engine, { mode, kind: 'jsx' })
      assert.deepEqual(await shown(page), ['src', 'src/index.ts', 'src/lib', 'src/empty', 'README.md'])
      assert.deepEqual(await tabStops(page), ['src'])
      assert.deepEqual(await shownIcon(page, 'src'), ['folder-open'])
      assert.deepEqual(await shownIcon(page, 'src/lib'), ['folder-close'])
      assert.deepEqual(await shownIcon(page, 'src/index.ts'), ['file'])
      // `children: []` can still open.
      assert.ok(await page.locator('a-tree-item[item-id="src/empty"]').evaluate(item => item.matches(':state(closed)')))
      assert.equal(await page.locator('a-tree-item[item-id="src"]').getAttribute('data-kind'), 'folder')
      // Each item is named by its label alone, not its children or actions.
      const name = await page.locator('a-tree-item[item-id="src"]').evaluate(item => document.getElementById(item.getAttribute('aria-labelledby')).textContent)
      assert.equal(name, 'src')
    })
  }

  test.fast(`${name}: uncontrolled, clicks open and close items; a veto holds; Alt+click opens a subtree`, async t => {
    const page = await pageFor(t, engine, { kind: 'jsx' })
    await row(page, 'src/lib').locator('a-tree-value').click()
    await page.waitForFunction(() => document.querySelector('a-tree-item[item-id="src/lib/util.ts"]'))
    assert.deepEqual((await log(page)).at(-1), { next: ['src', 'src/lib'], prev: ['src'], scope: 'item' })
    await page.evaluate(() => { window.veto = true })
    await row(page, 'src').locator('a-tree-value').click()
    assert.ok((await shown(page)).includes('src/index.ts'), 'the veto did not hold')
    await page.evaluate(() => { window.veto = false })
    await row(page, 'src').locator('a-tree-value').click()
    await page.waitForFunction(() => !document.querySelector('a-tree-item[item-id="src/index.ts"]'))
    await row(page, 'src').locator('a-tree-value').click({ modifiers: ['Alt'] })
    assert.deepEqual((await log(page)).at(-1), { next: ['src/lib', 'src', 'src/empty'], prev: ['src/lib'], scope: 'subtree' })
    await page.waitForFunction(() => document.querySelector('a-tree-item[item-id="src/lib/util.ts"]'))
  })

  test.fast(`${name}: controlled, a request waits for its caller; [] stays controlled`, async t => {
    const page = await pageFor(t, engine, { kind: 'jsx', props: { controlled: true, open: [] } })
    assert.deepEqual(await shown(page), ['src', 'README.md'])
    await row(page, 'src').locator('a-tree-value').click()
    assert.deepEqual((await log(page)).at(-1), { next: ['src'], prev: [], scope: 'item' })
    await page.waitForTimeout(50)
    assert.deepEqual(await shown(page), ['src', 'README.md'], 'a controlled tree opened itself')
    await page.evaluate(() => { window.accept = true })
    await row(page, 'src').locator('a-tree-value').click()
    await page.waitForFunction(() => document.querySelector('a-tree-item[item-id="src/index.ts"]'))
  })

  test.fast(`${name}: the Tab stop follows the cursor, and falls back when its item hides`, async t => {
    const page = await pageFor(t, engine, { kind: 'jsx' })
    await focusTree(page)
    assert.equal(await focused(page), 'src')
    await page.keyboard.press('ArrowDown')
    assert.equal(await focused(page), 'src/index.ts')
    await page.waitForFunction(() => document.querySelector('a-tree-item[tabindex="0"]')?.getAttribute('item-id') === 'src/index.ts')
    assert.deepEqual(await tabStops(page), ['src/index.ts'])
    await page.keyboard.press('Tab')
    assert.equal(await focused(page), 'after')
    await page.keyboard.press('Shift+Tab')
    assert.equal(await focused(page), 'src/index.ts')
    await row(page, 'src').locator('a-tree-value').click()
    await page.waitForFunction(() => !document.querySelector('a-tree-item[item-id="src/index.ts"]'))
    assert.deepEqual(await tabStops(page), ['src'])
  })

  test.fast(`${name}: actions are Buttons out of the Tab order; Right reaches them; More opens the menu for its item`, async t => {
    const page = await pageFor(t, engine, { kind: 'jsx' })
    await settle(page)
    const buttons = page.locator('a-tree-item[item-id="src"] > a-tree-row > a-tree-actions > a-button')
    assert.equal(await buttons.count(), 2)
    assert.deepEqual(await buttons.evaluateAll(list => list.map(button => button.getAttribute('tabindex'))), ['-1', '-1'])
    assert.equal(await buttons.nth(1).getAttribute('aria-haspopup'), 'menu')
    // An action shows the tooltip it's given, and none without one.
    assert.deepEqual(await buttons.evaluateAll(list => list.map(button => button.querySelector('a-tooltip')?.textContent ?? null)), ['New file', null])
    await focusTree(page)
    await page.keyboard.press('ArrowRight')
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'New file')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => window.log.includes('new:src'))
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.querySelector('a-menu').isOpen)
    await page.waitForFunction(() => document.querySelector('a-menu-item')?.textContent.includes('Rename src'))
    await page.keyboard.press('Escape')
    // Closing the menu returns focus to the item, not a hidden button elsewhere.
    await page.waitForFunction(() => !document.querySelector('a-menu').isOpen)
    assert.equal(await focused(page), 'src')
    await rowText(page, 'README.md').click()
    await page.keyboard.press('Enter')
    assert.deepEqual((await log(page)).filter(entry => typeof entry === 'string' && entry.startsWith('open:')), ['open:README.md', 'open:README.md'])
  })

  // Found by Bombadil: with the pointer over another row, its actions show, and
  // a closing menu handed focus to them instead of the row it opened on.
  test.fast(`${name}: closing a menu returns focus to its row, even with another row's actions showing`, async t => {
    const page = await pageFor(t, engine, { kind: 'jsx' })
    await settle(page)
    await focusTree(page)
    await page.keyboard.press('End')
    assert.equal(await focused(page), 'README.md')
    await row(page, 'src').hover()
    await page.keyboard.press('Shift+F10')
    await page.waitForFunction(() => document.querySelector('a-menu').isOpen)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('a-menu').isOpen)
    assert.equal(await focused(page), 'README.md')
    // A click on another row's action still focuses that action.
    await page.locator('a-tree-item[item-id="src"] > a-tree-row > a-tree-actions > a-button').first().click()
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'New file')
  })

  test.fast(`${name}: current marks an item and scrolls it into view without moving focus`, async t => {
    const page = await pageFor(t, engine, { kind: 'jsx', props: { toolbar: true } })
    await page.setViewportSize({ width: 600, height: 120 })
    await page.locator('#find').focus()
    // Firefox scrolls a newly focused element into view on the next frame, which would undo a reveal in this one.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await page.evaluate(() => window.setCurrent('README.md'))
    await page.waitForFunction(() => document.querySelector('a-tree-item[data-current]')?.getAttribute('item-id') === 'README.md')
    await page.waitForFunction(() => {
      const box = document.querySelector('a-tree-item[item-id="README.md"] > a-tree-row').getBoundingClientRect()
      // Within a pixel: scrolling lands on fractional positions.
      return box.top >= -1 && box.bottom <= innerHeight + 1
    })
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'find', 'focus moved')
    assert.equal(await page.locator('a-tree-item[data-current]').count(), 1)
    // The toolbar comes before the tree, outside role="tree".
    assert.equal(await page.evaluate(() => document.querySelector('#find').closest('[role="tree"]')), null)
    assert.equal(await page.evaluate(() => document.querySelector('a-tree-toolbar').nextElementSibling.localName), 'a-tree')
  })

  // ─── Actions ──────────────────────────────────────────────────────────────

  const actionsOf = id => `a-tree-item[item-id="${id}"] > a-tree-row > a-tree-actions`
  const opacity = (page, id) => page.locator(actionsOf(id)).evaluate(actions => getComputedStyle(actions).opacity)

  test.fast(`${name}: a click on the empty part of the actions toggles the row; a click on a button doesn't`, async t => {
    const page = await pageFor(t, engine, { kind: 'jsx' })
    await row(page, 'src/lib').hover()
    const box = await page.locator(actionsOf('src/lib')).boundingBox()
    const first = await page.locator(`${actionsOf('src/lib')} > a-button`).first().boundingBox()
    assert.ok(first.x - box.x > 20, 'the actions are not pinned to the row end')
    await page.mouse.click(box.x + 4, box.y + box.height / 2)
    await page.waitForFunction(() => document.querySelector('a-tree-item[item-id="src/lib/util.ts"]'))
    await page.locator(`${actionsOf('src/lib')} > a-button`).first().click()
    await page.waitForFunction(() => window.log.includes('new:src/lib'))
    assert.ok((await shown(page)).includes('src/lib/util.ts'), 'a button click toggled the row')
  })

  test.fast(`${name}: keyboard focus on a row shows its actions; a mouse click doesn't`, async t => {
    const page = await pageFor(t, engine, { kind: 'jsx' })
    await focusTree(page)
    assert.equal(await focused(page), 'src')
    assert.equal(await opacity(page, 'src'), '1', 'keyboard focus left the actions hidden')
    await row(page, 'src/lib').locator('a-tree-value').click()
    await page.mouse.move(0, 0)
    assert.equal(await focused(page), 'src/lib')
    assert.equal(await opacity(page, 'src/lib'), '0', 'a mouse click showed the actions')
    assert.equal(await opacity(page, 'src'), '0')
  })

  for (const theme of ['antune', 'antithesis']) {
    test.fast(`${name} ${theme}: action buttons are square and fill the row's line, so rows keep one height`, async t => {
      const page = await pageFor(t, engine, { kind: 'jsx' })
      if (theme === 'antithesis') {
        await page.evaluate(() => new Promise(done => {
          const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '/antithesis.css', onload: done })
          document.head.append(link)
        }))
      }
      const sizes = await page.evaluate(() => {
        const button = document.querySelector('a-tree-item[item-id="src"] > a-tree-row > a-tree-actions > a-button')
        const rect = button.getBoundingClientRect()
        const line = parseFloat(getComputedStyle(document.querySelector('a-tree-item[item-id="src"] > a-tree-row')).lineHeight)
        const height = id => document.querySelector(`a-tree-item[item-id="${id}"] > a-tree-row`).getBoundingClientRect().height
        return { width: rect.width, height: rect.height, line, radius: parseFloat(getComputedStyle(button).borderTopLeftRadius), withActions: height('src'), without: height('src/index.ts') }
      })
      assert.ok(Math.abs(sizes.width - sizes.height) < 0.5, `the button is ${sizes.width}x${sizes.height}, not square`)
      assert.ok(Math.abs(sizes.height - sizes.line) < 0.5, `the button is ${sizes.height}px in a ${sizes.line}px line`)
      assert.ok(Math.abs(sizes.withActions - sizes.without) < 0.5, `rows are ${sizes.withActions}px with actions and ${sizes.without}px without`)
      // The theme's own radius: a circle in Antithesis, Anta's 4px elsewhere.
      if (theme === 'antithesis') assert.ok(sizes.radius >= sizes.width / 2, `the radius ${sizes.radius}px doesn't make a circle`)
      else assert.equal(sizes.radius, 4)
    })
  }

  // Only Chromium emulates a mobile device's pointer and hover media features.
  if (engine === chromium) test.fast(`${name}: on a touch screen, actions always show and are at least 24px`, async t => {
    const page = await pageFor(t, engine, { kind: 'jsx', touch: true })
    assert.ok(await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches), 'the emulated device is not a touch screen')
    const size = await page.locator(`${actionsOf('src')} > a-button`).first().evaluate(button => button.getBoundingClientRect().height)
    assert.ok(size >= 24, `the button is ${size}px`)
    assert.equal(await opacity(page, 'src/lib'), '1')
  })

  if (engine === chromium) test.fast(`${name}: on a touch screen, a tap on an action runs it and doesn't toggle the row`, async t => {
    const page = await pageFor(t, engine, { kind: 'jsx', touch: true })
    const open = await page.locator('a-tree-item[item-id="src"]').evaluate(item => item.matches(':state(open)'))
    await page.locator(`${actionsOf('src')} > a-button[aria-label="New file"]`).tap()
    await page.waitForFunction(() => window.log.includes('new:src'))
    assert.equal(await page.locator('a-tree-item[item-id="src"]').evaluate(item => item.matches(':state(open)')), open, 'the tap toggled the row')
    // A tap on the row's label still toggles it.
    await page.locator('a-tree-item[item-id="src"] > a-tree-row > a-tree-value').tap()
    await page.waitForFunction(was => document.querySelector('a-tree-item[item-id="src"]').matches(':state(open)') !== was, open)
  })

  test.fast(`${name}: --tree-actions-align: start puts the actions right after the label`, async t => {
    const page = await pageFor(t, engine, { kind: 'jsx' })
    await page.evaluate(() => document.querySelector('a-tree').style.setProperty('--tree-actions-align', 'start'))
    const gap = await page.evaluate(() => {
      const line = document.querySelector('a-tree-item[item-id="src"] > a-tree-row')
      return line.querySelector('a-tree-actions > a-button').getBoundingClientRect().left - line.querySelector('a-tree-value').getBoundingClientRect().right
    })
    assert.ok(gap >= 0 && gap < 12, `the actions start ${gap}px after the label`)
  })

  test.fast(`${name}: renderLabel and an end indicator replace the defaults`, async t => {
    const page = await pageFor(t, engine, { kind: 'jsx', props: { custom: true } })
    assert.equal(await row(page, 'src').locator('a-tree-value').textContent(), 'src (open) @0')
    assert.equal(await row(page, 'src/lib').locator('a-tree-value').textContent(), 'lib @1')
    const order = await row(page, 'src').evaluate(line => [...line.children].map(child => child.localName))
    assert.deepEqual(order.slice(0, 2), ['a-tree-value', 'a-tree-indicator'])
    assert.equal(await row(page, 'src').locator('a-tree-indicator').getAttribute('shape'), 'chevron')
  })

  test.fast(`${name}: focusRequest focuses an item; the first render doesn't, and a new n repeats it`, async t => {
    const page = await pageFor(t, engine, { kind: 'jsx', props: { initialFocus: { id: 'README.md', n: 0 } } })
    await page.waitForTimeout(50)
    assert.ok(await page.evaluate(() => document.activeElement === document.body), 'the first render took focus')
    await page.evaluate(() => window.requestFocus('README.md', 1))
    await page.waitForFunction(() => document.activeElement?.getAttribute('item-id') === 'README.md')
    await page.keyboard.press('Home')
    await page.evaluate(() => window.requestFocus('README.md', 2))
    await page.waitForFunction(() => document.activeElement?.getAttribute('item-id') === 'README.md')
  })

  test(`${name}: axe finds no violations in the folder tree`, async t => {
    const page = await pageFor(t, engine, { kind: 'jsx' })
    await page.evaluate(async () => { await import('/axe.js') })
    await focusTree(page)
    await page.keyboard.press('ArrowRight')
    const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('a-tree'))).violations.map(v => v.id + ': ' + v.nodes.map(n => n.target).join(' ')))
    assert.deepEqual(violations, [])
  })
}
