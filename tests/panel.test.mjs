import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium, firefox, webkit } = requireSite('playwright')
let browser, server, origin

before(async () => {
  const result = await build({
    entryPoints: ['tests/panel.fixture.tsx'], bundle: true, write: false,
    outfile: 'panel.js', format: 'esm', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('site/node_modules')],
    alias: {
      '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
      react: requireSite.resolve('preact/compat'),
    },
  })
  const assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/panel.css' : '/panel.js', file.text]))
  server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(assets.get(req.url) ?? `<!doctype html>
      <link rel="stylesheet" href="/panel.css">
      <style>body{margin:32px}.workspace{width:360px;transform:translateX(10px);overflow:hidden}
      #content{height:180px;overflow:auto;background:var(--test-color)}
      #content>div{height:800px}#panel{--test-color:rgb(20, 30, 40)}
      a-panel:state(maximized)>#content{height:100%}</style>
      <div class="workspace"><a-panel id="panel"><a-box id="content"><a-capture id="capture">
      <input id="note" value="Draft"><a-button role="button" tabindex="0" id="toggle" data-custom-event="paneltoggle">Toggle panel</a-button>
      </a-capture><div>Scrollable content</div></a-box></a-panel><p id="neighbor">Next pane</p></div>
      <button id="outside">Outside</button><div id="mount"></div>
      <script type="module" src="/panel.js"></script>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  const engine = process.env.PANEL_TEST_BROWSER || 'chromium'
  browser = await ({ chromium, firefox, webkit })[engine].launch({
    headless: true,
    ...(engine === 'chromium' ? { channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined } : {}),
  })
})

after(async () => {
  await browser?.close()
  if (server) await new Promise(resolve => server.close(resolve))
})

async function pageFor(t) {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } })
  t.after(() => context.close())
  const page = await context.newPage()
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.renderPanel === 'function')
  return page
}

test('Panel lifts its existing content out of clipping and restores normal layout', async t => {
  const page = await pageFor(t)
  const result = await page.evaluate(() => {
    const panel = document.querySelector('#panel')
    const content = document.querySelector('#content')
    const note = document.querySelector('#note')
    const surface = panel.shadowRoot.querySelector('[part="content"]')
    const normal = panel.getBoundingClientRect().toJSON()
    const neighborY = document.querySelector('#neighbor').getBoundingClientRect().y
    note.value = 'Unsaved draft'
    note.focus()
    note.setSelectionRange(2, 7)
    const mutations = []
    const observer = new MutationObserver(records => mutations.push(...records))
    observer.observe(panel, { attributes: true, childList: true, subtree: true })
    panel.requestMaximize()
    const max = {
      rect: surface.getBoundingClientRect().toJSON(),
      host: panel.getBoundingClientRect().toJSON(),
      parent: content.parentElement === panel,
      focus: document.activeElement === note,
      selection: [note.selectionStart, note.selectionEnd],
      color: getComputedStyle(content).backgroundColor,
      popover: surface.getAttribute('popover'),
      role: panel.getAttribute('role'),
    }
    panel.requestRestore()
    mutations.push(...observer.takeRecords())
    observer.disconnect()
    return { normal, max, restored: panel.getBoundingClientRect().toJSON(),
      stableNeighbor: neighborY === document.querySelector('#neighbor').getBoundingClientRect().y,
      sameInput: note === document.querySelector('#note'), value: note.value,
      focus: document.activeElement === note, selection: [note.selectionStart, note.selectionEnd],
      mutations: mutations.length, popover: surface.hasAttribute('popover') }
  })
  assert.deepEqual([result.max.rect.x, result.max.rect.y, result.max.rect.width, result.max.rect.height], [0, 0, 800, 600])
  assert.deepEqual(result.max.host, result.normal)
  assert.deepEqual(result.restored, result.normal)
  assert.equal(result.max.parent, true)
  assert.equal(result.max.focus, true)
  assert.equal(result.max.color, 'rgb(20, 30, 40)')
  assert.equal(result.max.popover, 'manual')
  assert.equal(result.max.role, null)
  assert.equal(result.stableNeighbor, true)
  assert.equal(result.sameInput, true)
  assert.equal(result.value, 'Unsaved draft')
  assert.equal(result.focus, true)
  assert.deepEqual(result.selection, [2, 7])
  assert.equal(result.mutations, 0)
  assert.equal(result.popover, false)
})

test('Panel requests are vetoable, controlled, isolated, and silent on attribute updates', async t => {
  const page = await pageFor(t)
  assert.deepEqual(await page.evaluate(() => {
    const panel = document.querySelector('#panel')
    const requests = []
    let bubbled = 0
    document.addEventListener('statechange', () => bubbled++)
    panel.addEventListener('statechange', event => requests.push(event.detail))
    panel.addEventListener('statechange', event => event.preventDefault(), { once: true })
    panel.requestMaximize()
    const vetoed = !panel.matches(':state(maximized)')
    panel.setAttribute('state', 'normal')
    panel.requestMaximize()
    const controlled = !panel.matches(':state(maximized)')
    panel.setAttribute('state', 'maximized')
    const applied = panel.matches(':state(maximized)')
    panel.removeAttribute('state')
    panel.requestRestore()
    return { vetoed, controlled, applied, restored: !panel.matches(':state(maximized)'), requests, bubbled }
  }), {
    vetoed: true, controlled: true, applied: true, restored: true, bubbled: 0,
    requests: [{ next: 'maximized', prev: 'normal' }, { next: 'maximized', prev: 'normal' }, { next: 'normal', prev: 'maximized' }],
  })
})

test('Panel buttons work with the keyboard and manual popovers remain open on Escape', async t => {
  const page = await pageFor(t)
  await page.locator('#toggle').focus()
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('#panel').evaluate(panel => panel.matches(':state(maximized)')), true)
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('#panel').evaluate(panel => panel.matches(':state(maximized)')), true)
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('#panel').evaluate(panel => panel.matches(':state(maximized)')), false)
})

test('Panel preserves scroll and Capture event ancestry while maximizing', async t => {
  const page = await pageFor(t)
  assert.deepEqual(await page.evaluate(() => {
    const panel = document.querySelector('#panel')
    const content = document.querySelector('#content')
    const capture = document.querySelector('#capture')
    let events = 0
    panel.addEventListener('wheel', () => events++)
    content.scrollTop = 60
    panel.requestMaximize()
    const during = content.scrollTop
    capture.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 10 }))
    panel.requestRestore()
    return { during, after: content.scrollTop, events }
  }), { during: 60, after: 60, events: 1 })
})

test('Panel restores its intent on reconnect without reseeding default-state', async t => {
  const page = await pageFor(t)
  await page.evaluate(async () => {
    const p = document.querySelector('#panel')
    p.setAttribute('default-state', 'maximized')
    p.requestMaximize()
    p.remove()
    document.body.append(p)
  })
  assert.equal(await page.locator('#panel').evaluate(p => p.matches(':state(maximized)')), true)
  await page.evaluate(() => {
    const p = document.querySelector('#panel')
    p.requestRestore()
    p.remove()
    document.body.append(p)
  })
  assert.equal(await page.locator('#panel').evaluate(p => p.matches(':state(maximized)')), false)
})

test('Only the nearest nested Panel handles a control request', async t => {
  const page = await pageFor(t)
  await page.evaluate(() => {
    const nested = document.createElement('a-panel')
    nested.id = 'nested'
    nested.innerHTML = '<a-button data-custom-event="paneltoggle">Nested toggle</a-button>'
    document.querySelector('#content').prepend(nested)
  })
  await page.getByText('Nested toggle').click()
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('a-panel')].map(p => p.matches(':state(maximized)'))), [false, true])
})

test('Controlled JSX Panel normalizes requests and retains its child across renders', async t => {
  const page = await pageFor(t)
  await page.evaluate(() => {
    window.requests = []
    renderPanel({ maximized: false, onStateChange: (_, detail) => requests.push(detail) })
    window.originalInput = document.querySelector('#mount input')
    document.querySelector('#mount a-panel').requestMaximize()
  })
  assert.deepEqual(await page.evaluate(() => requests), [{ next: true, prev: false }])
  await page.evaluate(() => renderPanel({ maximized: true }))
  assert.deepEqual(await page.evaluate(() => ({
    maximized: document.querySelector('#mount a-panel').matches(':state(maximized)'),
    sameInput: originalInput === document.querySelector('#mount input'),
  })), { maximized: true, sameInput: true })
})

test('Rapid native hide and controlled restore never leave the content hidden', async t => {
  const page = await pageFor(t)
  await page.evaluate(() => {
    const p = document.querySelector('#panel')
    p.setAttribute('state', 'maximized')
    p.shadowRoot.querySelector('slot').hidePopover()
    p.setAttribute('state', 'normal')
  })
  assert.equal(await page.locator('#note').isVisible(), true)
  assert.equal(await page.locator('#panel').evaluate(p => p.shadowRoot.querySelector('slot').hasAttribute('popover')), false)
})

test('A default-maximized Panel follows viewport resizing and restores its flex layout', async t => {
  const page = await pageFor(t)
  await page.evaluate(() => {
    const p = document.createElement('a-panel')
    p.id = 'initial'
    p.style.cssText = 'display:flex;gap:10px;width:300px'
    p.setAttribute('default-state', 'maximized')
    p.innerHTML = '<div style="width:40px;height:30px">A</div><div style="width:60px;height:30px">B</div>'
    document.body.append(p)
  })
  assert.equal(await page.locator('#initial').evaluate(p => p.matches(':state(maximized)')), true)
  await page.setViewportSize({ width: 480, height: 720 })
  assert.deepEqual(await page.locator('#initial').evaluate(p => {
    const r = p.shadowRoot.querySelector('slot').getBoundingClientRect()
    p.requestRestore()
    const [a, b] = [...p.children].map(child => child.getBoundingClientRect())
    return { viewport: [r.width, r.height], gap: b.x - a.right, sameRow: a.y === b.y }
  }), { viewport: [480, 720], gap: 10, sameRow: true })
})

test('Panel keeps its content visible when the Popover API is unavailable', async t => {
  const page = await pageFor(t)
  await page.evaluate(() => {
    const p = document.querySelector('#panel')
    p.shadowRoot.querySelector('slot').showPopover = undefined
    p.requestMaximize()
  })
  assert.equal(await page.locator('#note').isVisible(), true)
  assert.equal(await page.locator('#panel').evaluate(p => p.matches(':state(maximized)')), false)
})

async function focusedId(page) {
  return page.evaluate(() => {
    let node = document.activeElement
    while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement
    return node?.id || node?.getAttribute('part')
  })
}

test('Maximized Panel wraps Tab in both directions and releases focus on restore', async t => {
  const page = await pageFor(t)
  await page.locator('#outside').focus()
  await page.locator('#panel').evaluate(p => p.requestMaximize())
  assert.equal(await focusedId(page), 'note')
  await page.keyboard.press('Shift+Tab')
  assert.equal(await focusedId(page), 'toggle')
  await page.keyboard.press('Tab')
  assert.equal(await focusedId(page), 'note')
  await page.keyboard.press('Tab')
  assert.equal(await focusedId(page), 'toggle')
  await page.locator('#outside').focus()
  assert.equal(await focusedId(page), 'toggle', 'Programmatic focus outside is redirected')
  await page.locator('#panel').evaluate(p => p.requestRestore())
  assert.equal(await focusedId(page), 'outside', 'The external opener receives focus')
  await page.locator('#toggle').focus()
  await page.keyboard.press('Tab')
  assert.equal(await focusedId(page), 'outside', 'Normal Panel leaves tab navigation native')
})

test('Panel follows shadow and slot tab order while excluding unavailable controls', async t => {
  const page = await pageFor(t)
  await page.evaluate(() => {
    document.querySelector('#content').innerHTML = `
      <button id="hidden" hidden>Hidden</button><button disabled>Disabled</button>
      <div inert><input id="inert"></div><fieldset disabled><input id="fieldset"></fieldset>
      <button id="late" tabindex="2">Second</button><button id="early" tabindex="1">First</button>
      <input type="radio" name="choice" id="unchecked"><input type="radio" name="choice" id="checked" checked>
      <a-input id="shadow-input" aria-label="Shadow input"></a-input>
      <button id="last">Last</button>`
    document.querySelector('#panel').requestMaximize()
  })
  assert.equal(await focusedId(page), 'early')
  for (const expected of ['late', 'checked', 'input', 'last', 'early']) {
    await page.keyboard.press('Tab')
    assert.equal(await focusedId(page), expected)
  }
  await page.keyboard.press('Shift+Tab')
  assert.equal(await focusedId(page), 'last')
  await page.keyboard.press('Shift+Tab')
  assert.equal(await focusedId(page), 'input')
})

test('Empty Panels focus their content and recompute the tab order after mutations', async t => {
  const page = await pageFor(t)
  await page.evaluate(() => {
    document.querySelector('#content').replaceChildren()
    document.querySelector('#panel').requestMaximize()
  })
  assert.equal(await focusedId(page), 'content')
  await page.keyboard.press('Tab')
  assert.equal(await focusedId(page), 'content')
  await page.keyboard.press('Shift+Tab')
  assert.equal(await focusedId(page), 'content')
  await page.evaluate(() => {
    document.querySelector('#content').innerHTML = '<input id="added">'
  })
  await page.keyboard.press('Tab')
  assert.equal(await focusedId(page), 'added')
  await page.evaluate(() => document.querySelector('#added').remove())
  await page.keyboard.press('Tab')
  assert.equal(await focusedId(page), 'content')
})

test('Nested and sibling maximized Panels suspend and resume earlier traps', async t => {
  const page = await pageFor(t)
  await page.locator('#panel').evaluate(p => p.requestMaximize())
  await page.evaluate(() => {
    const nested = document.createElement('a-panel')
    nested.id = 'nested'
    nested.innerHTML = '<input id="nested-first"><button id="nested-last">Last</button>'
    document.querySelector('#content').append(nested)
  })
  await page.locator('#toggle').focus()
  await page.locator('#nested').evaluate(p => p.requestMaximize())
  assert.equal(await focusedId(page), 'nested-first')
  await page.keyboard.press('Shift+Tab')
  assert.equal(await focusedId(page), 'nested-last')
  await page.locator('#note').focus()
  assert.equal(await focusedId(page), 'nested-last')
  await page.locator('#nested').evaluate(p => p.requestRestore())
  assert.equal(await focusedId(page), 'toggle')
  await page.keyboard.press('Tab')
  assert.equal(await focusedId(page), 'nested-first')
  await page.evaluate(() => renderPanel({ maximized: true, id: 'sibling' }))
  assert.equal(await page.locator('#sibling').evaluate(p => p.contains(document.activeElement)), true)
  await page.locator('#note').focus()
  assert.equal(await page.locator('#sibling').evaluate(p => p.contains(document.activeElement)), true)
  await page.locator('#sibling').evaluate(p => p.setAttribute('state', 'normal'))
  assert.equal(await focusedId(page), 'nested-first')
})

test('Panel preserves focus in nested manual popovers and lets menus handle their keys', async t => {
  const page = await pageFor(t)
  await page.evaluate(() => {
    document.querySelector('#content').insertAdjacentHTML('beforeend', `
      <div popover="manual" id="popover"><input id="popover-input"></div>
      <a-menu id="menu"><a-menu-item tabindex="0" id="menu-first">First</a-menu-item>
      <a-menu-item tabindex="0" id="menu-last">Last</a-menu-item></a-menu>`)
    document.querySelector('#panel').requestMaximize()
    document.querySelector('#popover').showPopover()
    document.querySelector('#popover-input').focus()
  })
  assert.equal(await focusedId(page), 'popover-input')
  await page.keyboard.press('Tab')
  assert.equal(await focusedId(page), 'note')
  await page.evaluate(() => {
    document.querySelector('#popover').hidePopover()
    document.querySelector('#menu').setAttribute('state', 'open')
    document.querySelector('#menu-first').focus()
  })
  await page.keyboard.press('Shift+Tab')
  assert.equal(await focusedId(page), 'menu-last')
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('#panel').evaluate(p => p.matches(':state(maximized)')), true)
})

test('Panel yields to a nested modal dialog and resumes after it closes', async t => {
  const page = await pageFor(t)
  await page.evaluate(() => {
    document.querySelector('#content').insertAdjacentHTML('beforeend', '<a-dialog id="dialog"><input id="dialog-input"></a-dialog>')
    document.querySelector('#panel').requestMaximize()
  })
  await page.locator('#toggle').focus()
  await page.evaluate(() => {
    document.querySelector('#dialog').setAttribute('state', 'open')
    document.querySelector('#dialog-input').focus()
  })
  assert.equal(await focusedId(page), 'dialog-input')
  await page.keyboard.press('Tab')
  assert.equal(await page.locator('#dialog').evaluate(d => d.shadowRoot.querySelector('dialog').open), true)
  await page.evaluate(() => document.querySelector('#dialog').setAttribute('state', 'closed'))
  await page.locator('#dialog').locator('dialog').waitFor({ state: 'hidden' })
  await page.locator('#toggle').focus()
  await page.keyboard.press('Tab')
  assert.equal(await focusedId(page), 'note')
})

test('Rejected maximization never traps focus and disconnect removes the active trap', async t => {
  const page = await pageFor(t)
  await page.locator('#panel').evaluate(p => {
    p.addEventListener('statechange', event => event.preventDefault(), { once: true })
    p.requestMaximize()
  })
  await page.locator('#toggle').focus()
  await page.keyboard.press('Tab')
  assert.equal(await focusedId(page), 'outside')
  await page.locator('#panel').evaluate(p => { p.requestMaximize(); p.remove() })
  await page.locator('#outside').focus()
  assert.equal(await focusedId(page), 'outside')
})

test('Restoring keeps focus inside when the external opener has been removed', async t => {
  const page = await pageFor(t)
  await page.locator('#outside').focus()
  await page.locator('#panel').evaluate(p => p.requestMaximize())
  await page.locator('#toggle').focus()
  await page.evaluate(() => document.querySelector('#outside').remove())
  await page.locator('#panel').evaluate(p => p.requestRestore())
  assert.equal(await focusedId(page), 'toggle')
})
