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

test('Slider exposes live ElementInternals range semantics to accessibility tooling', async t => {
  const { page } = await pageFor(t)
  const initial = await page.evaluate(() => ({
    exposed: slider.internals instanceof ElementInternals,
    min: slider.internals?.ariaValueMin,
    max: slider.internals?.ariaValueMax,
    now: slider.internals?.ariaValueNow,
    text: slider.internals?.ariaValueText,
  }))
  assert.deepEqual(initial, { exposed: true, min: '0', max: '100', now: '35', text: '35' })

  await page.evaluate(() => {
    slider.setAttribute('value-prefix', '$')
    slider.value = 45
  })
  assert.deepEqual(
    await page.evaluate(() => ({
      now: slider.internals?.ariaValueNow,
      text: slider.internals?.ariaValueText,
    })),
    { now: '45', text: '$45' },
  )
})

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

test('Slider parses a space-separated range and exposes a sorted array value', async t => {
  const { page } = await pageFor(t)
  const result = await page.evaluate(() => {
    slider.removeAttribute('role')
    slider.removeAttribute('tabindex')
    slider.defaultValue = [70, 20]
    const initial = { value: slider.value, attribute: slider.getAttribute('defaultvalue') }
    slider.value = [85, 15]
    return { initial, controlled: { value: slider.value, attribute: slider.getAttribute('value') } }
  })
  assert.deepEqual(result, {
    initial: { value: [20, 70], attribute: '70 20' },
    controlled: { value: [15, 85], attribute: '85 15' },
  })
})

test('Inverted fill covers the complement of single and range values', async t => {
  const { page } = await pageFor(t)
  const layouts = await page.evaluate(() => {
    const firstFill = slider.shadowRoot.querySelector('[part="fill"]')
    const secondFill = slider.shadowRoot.querySelector('[part~="fill-end"]')
    const thumbs = [...slider.shadowRoot.querySelectorAll('[part~="thumb"]')]
    const rect = element => {
      const box = element.getBoundingClientRect()
      return { left: box.left, right: box.right, center: (box.left + box.right) / 2 }
    }
    const measure = () => ({ first: rect(firstFill), second: rect(secondFill), thumbs: thumbs.map(rect), secondHidden: secondFill.hidden })
    slider.value = 40
    const single = measure()
    slider.setAttribute('inverted', '')
    const singleInverted = measure()
    slider.value = [20, 70]
    slider.removeAttribute('inverted')
    const range = measure()
    slider.setAttribute('inverted', '')
    const rangeInverted = measure()
    slider.value = [0, 100]
    const fullInvertedHidden = firstFill.hidden && secondFill.hidden
    slider.removeAttribute('inverted')
    const fullNormal = measure()
    slider.value = [50, 50]
    slider.setAttribute('value-display', 'thumb')
    const coincidentBubbles = [...slider.shadowRoot.querySelectorAll('[part~="thumb-value"]')]
      .filter(element => getComputedStyle(element).display !== 'none').length
    return { single, singleInverted, range, rangeInverted, fullInvertedHidden, fullNormal, coincidentBubbles }
  })
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1, `${a} should align with ${b}`)
  close(layouts.single.first.right, layouts.single.thumbs[0].center)
  close(layouts.singleInverted.first.left, layouts.singleInverted.thumbs[0].center)
  close(layouts.range.first.left, layouts.range.thumbs[0].center)
  close(layouts.range.first.right, layouts.range.thumbs[1].center)
  assert.equal(layouts.range.secondHidden, true)
  close(layouts.rangeInverted.first.right, layouts.rangeInverted.thumbs[0].center)
  close(layouts.rangeInverted.second.left, layouts.rangeInverted.thumbs[1].center)
  assert.equal(layouts.rangeInverted.secondHidden, false)
  assert.equal(layouts.fullInvertedHidden, true)
  assert.ok(layouts.fullNormal.first.left < layouts.fullNormal.thumbs[0].center)
  assert.ok(layouts.fullNormal.first.right > layouts.fullNormal.thumbs[1].center)
  assert.equal(layouts.coincidentBubbles, 1)
})

test('Range thumb crosses the other thumb while a controlled owner echoes changes', async t => {
  const { page } = await pageFor(t)
  await page.evaluate(() => {
    slider.removeAttribute('role')
    slider.removeAttribute('tabindex')
    slider.value = [20, 70]
    slider.addEventListener('input', () => { slider.value = slider.value })
  })
  const firstThumb = page.locator('a-slider [part~="thumb-1"]')
  const start = await firstThumb.boundingBox()
  const rail = await page.locator('a-slider .rail-area').boundingBox()
  const y = start.y + start.height / 2
  const firstX = start.x + start.width / 2
  await page.mouse.move(firstX, y)
  await page.mouse.down()
  await page.mouse.move(rail.x + rail.width * 0.9, y, { steps: 12 })
  const afterCrossing = await page.evaluate(() => ({
    value: slider.value,
    focusedThumb: slider.shadowRoot.activeElement?.getAttribute('part'),
  }))
  assert.equal(afterCrossing.value[0], 70)
  assert.ok(afterCrossing.value[1] >= 88)
  assert.match(afterCrossing.focusedThumb, /thumb-1/)

  await page.mouse.move(rail.x + rail.width * 0.1, y, { steps: 12 })
  await page.mouse.up()
  const final = await page.evaluate(() => ({ value: slider.value, changes: log.filter(e => e.type === 'change') }))
  assert.ok(final.value[0] <= 12)
  assert.equal(final.value[1], 70)
  assert.equal(final.changes.length, 1)
  assert.deepEqual(final.changes[0].value, final.value)
})

test('Range thumbs have separate keyboard focus and keep DOM order while crossing', async t => {
  const { page } = await pageFor(t)
  await page.evaluate(() => {
    slider.removeAttribute('role')
    slider.removeAttribute('tabindex')
    slider.setAttribute('aria-label', 'Price')
    slider.value = [20, 70]
  })
  const before = await page.evaluate(() => [...slider.shadowRoot.querySelectorAll('[part~="thumb"]')].map(thumb => ({
    part: thumb.getAttribute('part'), role: thumb.getAttribute('role'), tabIndex: thumb.tabIndex,
    now: thumb.getAttribute('aria-valuenow'), label: thumb.getAttribute('aria-label'),
  })))
  assert.equal(before.length, 2)
  assert.deepEqual(before.map(thumb => thumb.now), ['20', '70'])
  assert.ok(before.every(thumb => thumb.role === 'slider' && thumb.tabIndex === 0))
  assert.ok(before.every(thumb => thumb.label?.includes('Price')))
  assert.equal(await page.getByRole('slider').count(), 2)

  await page.locator('a-slider [part~="thumb-1"]').focus()
  await page.keyboard.press('End')
  const after = await page.evaluate(() => ({
    value: slider.value,
    focused: slider.shadowRoot.activeElement?.getAttribute('part'),
    order: [...slider.shadowRoot.querySelectorAll('[part~="thumb"]')].map(thumb => thumb.getAttribute('part')),
  }))
  assert.deepEqual(after.value, [70, 100])
  assert.match(after.focused, /thumb-1/)
  assert.deepEqual(after.order, before.map(thumb => thumb.part))
})

test('Range slider submits both values and resets to its default range', async t => {
  const { page } = await pageFor(t)
  const result = await page.evaluate(() => {
    slider.removeAttribute('role')
    slider.removeAttribute('tabindex')
    const form = document.createElement('form')
    slider.before(form)
    form.append(slider)
    slider.setAttribute('name', 'price')
    slider.defaultValue = [20, 70]
    slider.value = [35, 85]
    const submitted = new FormData(form).getAll('price')
    slider.removeAttribute('value')
    slider.value = [40, 90]
    form.reset()
    const reset = slider.value
    const resetSubmission = new FormData(form).getAll('price')
    slider.setAttribute('disabled', '')
    const disabledSubmission = new FormData(form).getAll('price')
    return { submitted, reset, resetSubmission, disabledSubmission }
  })
  assert.deepEqual(result, {
    submitted: ['35', '85'],
    reset: [20, 70],
    resetSubmission: ['20', '70'],
    disabledSubmission: [],
  })
})
