import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
let browser, server, origin

before(async () => {
  const result = await build({
    entryPoints: ['src/elements/a-slider.ts'], bundle: true, write: false,
    outfile: 'slider.js', format: 'esm', target: 'es2022',
    alias: { react: requireSite.resolve('preact/compat') },
  })
  const assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/slider.css' : '/slider.js', file.text]))
  server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(assets.get(req.url) ?? '<!doctype html><link rel="stylesheet" href="/slider.css"><style>body{margin:40px}a-slider{display:block;width:240px}</style><a-slider id="slider" defaultvalue="35" tabindex="0" role="slider" aria-label="Volume"></a-slider><script type="module" src="/slider.js"></script>')
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
})

after(async () => {
  await browser?.close()
  if (server) await new Promise(resolve => server.close(resolve))
})

async function pageFor(t, mode = 'drag-only', options = {}) {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 }, ...options })
  t.after(() => context.close())
  const page = await context.newPage()
  await page.goto(origin)
  await page.evaluate(mode => {
    slider.setAttribute('track-click', mode)
    window.control = slider.shadowRoot.querySelector('[part="control"]')
    window.log = []
    control.addEventListener('pointerdown', event => { window.pointerId = event.pointerId })
    for (const type of ['input', 'change']) slider.addEventListener(type, () => log.push({ type, value: slider.value }))
  }, mode)
  const rect = await page.locator('[part="control"]').boundingBox()
  return { page, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

async function state(page) {
  return page.evaluate(() => ({ value: slider.value, dragging: control.hasAttribute('data-dragging'), commits: log.filter(e => e.type === 'change').length }))
}

test('Slider ends a normal captured drag released outside its bounds', async t => {
  for (const mode of ['drag-only', 'jump']) {
    const { page, x, y } = await pageFor(t, mode)
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 30, y + 100)
    assert.equal((await state(page)).dragging, true)
    await page.mouse.up()
    const released = await state(page)
    assert.equal(released.dragging, false)
    assert.equal(released.commits, 1)
    await page.mouse.move(x - 80, y)
    assert.deepEqual(await state(page), released)
  }
})

test('Slider recovers from a missed release before updating on a button-free reentry', async t => {
  for (const mode of ['drag-only', 'jump']) {
    const { page, x, y } = await pageFor(t, mode)
    // Simulate an outside-window release whose lifecycle events never reach the control.
    await page.evaluate(() => {
      for (const type of ['pointerup', 'lostpointercapture']) {
        document.addEventListener(type, event => event.stopImmediatePropagation(), { capture: true, once: true })
      }
    })
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 30, y + 100)
    await page.mouse.up()
    const missed = await state(page)
    assert.equal(missed.dragging, true)
    await page.mouse.move(x - 80, y)
    assert.deepEqual(await state(page), { value: missed.value, dragging: false, commits: 1 })
    await page.mouse.move(x + 60, y)
    assert.deepEqual(await state(page), { value: missed.value, dragging: false, commits: 1 })
    await page.mouse.down()
    await page.mouse.move(x + 90, y)
    await page.mouse.up()
    assert.equal((await state(page)).commits, 2, 'A fresh press starts a new drag')
  }
})

test('Slider ends the drag when another element takes pointer capture', async t => {
  const { page, x, y } = await pageFor(t)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 30, y)
  const value = (await state(page)).value
  await page.evaluate(() => document.body.setPointerCapture(pointerId))
  await page.mouse.move(x + 60, y + 100)
  assert.deepEqual(await state(page), { value, dragging: false, commits: 1 })
  await page.mouse.up()
  await page.mouse.move(x - 50, y)
  assert.deepEqual(await state(page), { value, dragging: false, commits: 1 })
})

test('Slider ends on primary-button release even when another button stays held', async t => {
  const { page, x, y } = await pageFor(t)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 30, y)
  const value = (await state(page)).value
  await page.mouse.down({ button: 'right' })
  await page.mouse.up({ button: 'left' })
  await page.mouse.move(x - 50, y)
  assert.deepEqual(await state(page), { value, dragging: false, commits: 1 })
  await page.mouse.up({ button: 'right' })
  assert.deepEqual(await state(page), { value, dragging: false, commits: 1 })
})

test('Slider cancels once and keeps the last value without tracking later movement', async t => {
  const { page, x, y } = await pageFor(t)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 30, y)
  const value = (await state(page)).value
  await page.evaluate(() => control.dispatchEvent(new PointerEvent('pointercancel', { pointerId })))
  await page.mouse.move(x - 50, y)
  await page.mouse.up()
  assert.deepEqual(await state(page), { value, dragging: false, commits: 1 })
})

test('Slider touch drags still move and commit once', async t => {
  const { page, x, y } = await pageFor(t, 'drag-only', { hasTouch: true })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 50, y, id: 0 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  const result = await state(page)
  assert.ok(result.value > 35)
  assert.equal(result.dragging, false)
  assert.equal(result.commits, 1)
})
