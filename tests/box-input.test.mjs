import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
let browser, server, origin

before(async () => {
  const result = await build({
    entryPoints: ['tests/box-input.fixture.tsx'], bundle: true, write: false,
    outfile: 'fixture.js', format: 'esm', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('site/node_modules')],
    alias: {
      '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
      react: requireSite.resolve('preact/compat'),
    },
  })
  const assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/fixture.css' : '/fixture.js', file.text]))
  server = createServer((req, res) => {
    const asset = assets.get(req.url)
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(asset ?? '<!doctype html><link rel="stylesheet" href="/fixture.css"><style>body{margin:0}a-box{width:240px;height:180px}</style><script type="module" src="/fixture.js"></script>')
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true, channel: process.env.BOX_TEST_BROWSER_CHANNEL || undefined })
})

after(async () => {
  await browser?.close()
  if (server) await new Promise(resolve => server.close(resolve))
})

async function pageFor(t, options = {}) {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 }, ...options })
  t.after(() => context.close())
  const page = await context.newPage()
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.renderBox === 'function')
  return page
}

async function mount(page, attributes = {}) {
  await page.evaluate(attributes => {
    document.body.replaceChildren()
    const box = document.createElement('a-box')
    box.id = 'box'
    for (const [name, value] of Object.entries(attributes)) box.setAttribute(name, value)
    window.log = []
    for (const type of ['wheelinput', 'pointerinput', 'paninput']) {
      box.addEventListener(type, event => log.push({ type, detail: structuredClone(event.detail) }))
    }
    document.body.append(box)
  }, attributes)
}

async function wheel(page, options = {}, selector = '#box') {
  return page.evaluate(({ options, selector }) => {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 20, clientY: 20, deltaY: 12, ...options })
    document.querySelector(selector).dispatchEvent(event)
    return event.defaultPrevented
  }, { options, selector })
}

// Synthetic sessions test lifecycle and timing deterministically. Native capture
// is verified separately with trusted mouse and touch input.
async function syntheticCapture(page) {
  await page.evaluate(() => {
    const held = new Set()
    const box = document.querySelector('#box')
    box.setPointerCapture = id => held.add(id)
    box.hasPointerCapture = id => held.has(id)
    box.releasePointerCapture = id => held.delete(id)
    window.pointer = (type, options = {}, target = box) => {
      const { time, ...init } = options
      const event = new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse',
        isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
        clientX: 30, clientY: 40, ...init,
      })
      if (time !== undefined) Object.defineProperty(event, 'timeStamp', { value: time })
      target.dispatchEvent(event)
      return event.defaultPrevented
    }
  })
}

test('ordinary Boxes and handler-only JSX add no input listeners or touch ownership', async t => {
  const page = await pageFor(t)
  const result = await page.evaluate(() => {
    const additions = []
    const original = EventTarget.prototype.addEventListener
    EventTarget.prototype.addEventListener = function(type, ...args) {
      if (['wheel', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture'].includes(type)) additions.push(type)
      return original.call(this, type, ...args)
    }
    renderBox({ onWheelInput: () => {}, onPointerInput: () => {}, onPanInput: () => {} })
    for (let i = 0; i < 100; i++) document.body.append(document.createElement('a-box'))
    EventTarget.prototype.addEventListener = original
    return { additions, touch: getComputedStyle(document.querySelector('a-box')).touchAction }
  })
  assert.deepEqual(result, { additions: [], touch: 'auto' })
})

test('wheel is cancelled synchronously and sends cloneable original values and Box geometry', async t => {
  const page = await pageFor(t)
  await mount(page, { 'wheel-capture': '', 'wheel-activation': 'hover' })
  await page.evaluate(() => {
    box.style.margin = '10px'
    const child = document.createElement('span')
    child.id = 'child'
    box.append(child)
    document.body.addEventListener('wheel', () => log.push({ type: 'ancestor' }))
  })
  assert.equal(await wheel(page, { deltaX: -2, deltaY: 17, deltaZ: 3, deltaMode: 1, clientX: 50, clientY: 60 }, '#child'), true)
  const result = await page.evaluate(() => log)
  assert.equal(result.length, 1)
  const { detail } = result[0]
  assert.equal(detail.activationReason, 'immediate')
  assert.equal(detail.localX, 40)
  assert.equal(detail.localY, 50)
  assert.equal(detail.boxWidth, 240)
  assert.equal(detail.wheelEvent.deltaY, 17)
  assert.equal(detail.wheelEvent.deltaMode, 1)
  assert.equal(detail.wheelEvent.deltaZ, 3)
  assert.equal(detail.wheelEvent.defaultPrevented, true)
  assert.equal('target' in detail.wheelEvent, false)
  assert.equal(await wheel(page, { ctrlKey: true }), false)
  assert.equal(await wheel(page, { cancelable: false }), false)
  await page.evaluate(() => box.setAttribute('wheel-modifier', 'ctrl'))
  assert.equal(await wheel(page, { ctrlKey: true }), true)
})

test('nested wheel ownership and live bounds decline to the eligible ancestor', async t => {
  const page = await pageFor(t)
  await mount(page, { 'wheel-capture': '', 'wheel-activation': 'hover' })
  await page.evaluate(() => {
    const child = document.createElement('a-box')
    child.id = 'child'
    child.setAttribute('wheel-capture', 'down')
    child.setAttribute('wheel-activation', 'hover')
    child.addEventListener('wheelinput', () => log.push({ type: 'child' }))
    box.append(child)
  })
  assert.equal(await wheel(page, {}, '#child'), true)
  assert.deepEqual(await page.evaluate(() => log.map(e => e.type)), ['child'])
  assert.equal(await wheel(page, { deltaY: -12 }, '#child'), true)
  assert.deepEqual(await page.evaluate(() => log.map(e => e.type)), ['child', 'wheelinput'])
  await page.evaluate(() => { child.setAttribute('wheel-capture', 'none'); box.removeAttribute('wheel-capture') })
  assert.equal(await wheel(page, {}, '#child'), false)
})

test('wheel settling uses pointer dwell, reset policy, and region identity; focus never moves focus', async t => {
  const page = await pageFor(t)
  await mount(page, { 'wheel-capture': '', 'wheel-delay': '150' })
  await syntheticCapture(page)
  assert.equal(await wheel(page), false)
  await page.evaluate(() => pointer('pointermove', { buttons: 0, clientX: 20, clientY: 20, time: performance.now() - 200 }))
  assert.equal(await wheel(page), true)
  await page.evaluate(() => pointer('pointermove', { buttons: 0, clientX: 90, clientY: 50 }))
  assert.equal(await wheel(page), true)
  await page.evaluate(() => {
    box.setAttribute('wheel-reset-on-move', '')
    pointer('pointermove', { buttons: 0, time: performance.now() - 200 })
  })
  assert.equal(await wheel(page), true)
  await page.evaluate(() => pointer('pointermove', { buttons: 0, clientX: 90 }))
  assert.equal(await wheel(page), false)
  await page.evaluate(() => {
    box.setAttribute('wheel-activation', 'focus')
    box.tabIndex = 0
  })
  assert.equal(await wheel(page), false)
  assert.equal(await page.evaluate(() => document.activeElement === document.body), true)
  await page.locator('#box').focus()
  assert.equal(await wheel(page), true)
  assert.equal(await page.evaluate(() => log.at(-1).detail.activationReason), 'focus')
  await page.evaluate(() => {
    box.setAttribute('wheel-activation', 'settled')
    pointer('pointermove', { buttons: 0, time: performance.now() - 200 })
    document.body.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
  })
  assert.equal(await wheel(page), false)
})

test('settled wheel bounds retain dwell when all directions close and reopen', async t => {
  for (const activation of ['settled', 'settled-or-focus']) {
    const page = await pageFor(t)
    await page.evaluate(activation => {
      window.log = []
      window.setBounds = wheelCapture => renderBox({
        id: 'box', wheelCapture, wheelActivation: activation,
        onWheelInput: (_, detail) => log.push(detail),
      })
      setBounds({ up: false, down: true })
    }, activation)
    await syntheticCapture(page)
    await page.evaluate(() => pointer('pointermove', { buttons: 0, clientX: 20, clientY: 20, time: performance.now() - 200 }))
    assert.equal(await wheel(page), true)
    await page.evaluate(() => setBounds({ up: false, down: false }))
    assert.equal(await page.locator('#box').getAttribute('wheel-capture'), 'none')
    assert.equal(await wheel(page), false)
    await page.evaluate(() => setBounds({ down: true }))
    assert.equal(await wheel(page), true, activation)
    assert.deepEqual(await page.evaluate(() => log.map(detail => detail.activationReason)), ['settled', 'settled'])

    await page.evaluate(() => {
      setBounds({})
      pointer('pointermove', { buttons: 0 }, document.body)
      setBounds({ down: true })
    })
    assert.equal(await wheel(page), false, 'Leaving while bounds are closed must invalidate dwell')
  }
})

test('empty wheel bounds track dwell but explicit disabling clears it', async t => {
  const page = await pageFor(t)
  await mount(page, { 'wheel-capture': 'none' })
  await syntheticCapture(page)
  await page.evaluate(() => pointer('pointermove', { buttons: 0, clientX: 20, clientY: 20, time: performance.now() - 200 }))
  assert.equal(await wheel(page), false)
  await page.evaluate(() => box.setAttribute('wheel-capture', 'down'))
  assert.equal(await wheel(page), true)

  await page.evaluate(() => { box.removeAttribute('wheel-capture'); box.setAttribute('wheel-capture', 'down') })
  assert.equal(await wheel(page), false)
  await page.evaluate(() => pointer('pointermove', { buttons: 0, clientX: 20, clientY: 20, time: performance.now() - 200 }))
  assert.equal(await wheel(page), true)
  await page.evaluate(() => {
    box.setAttribute('wheel-capture', 'none')
    window.dispatchEvent(new Event('blur'))
    box.setAttribute('wheel-capture', 'down')
  })
  assert.equal(await wheel(page), false, 'Blur while bounds are closed must invalidate dwell')
})

test('a settled Box accepts the first native wheel after a captured drag', async t => {
  const page = await pageFor(t)
  await mount(page, { 'wheel-capture': '', 'pointer-capture': 'mouse', 'wheel-delay': '0' })
  await page.mouse.move(20, 20)
  assert.equal(await wheel(page), true)
  await page.mouse.down()
  await page.mouse.move(80, 50)
  await page.mouse.up()
  await page.evaluate(() => {
    window.wheelDelivered = false
    box.addEventListener('wheel', () => { window.wheelDelivered = true }, { once: true })
  })
  await page.mouse.wheel(0, 12)
  await page.waitForFunction(() => wheelDelivered)
  const captured = await page.evaluate(() => log.filter(e => e.type === 'wheelinput'))
  assert.equal(captured.length, 2)
  assert.equal(captured[1].detail.wheelEvent.isTrusted, true)
  assert.equal(captured[1].detail.activationReason, 'settled')

  await page.mouse.down()
  await page.mouse.move(360, 300)
  await page.mouse.move(80, 50)
  await page.mouse.up()
  assert.equal(await wheel(page, { clientX: 80, clientY: 50 }), false, 'Leaving during capture must invalidate dwell')
})

test('dragging does not establish dwell or bypass movement resets', async t => {
  const page = await pageFor(t)
  for (const mode of ['new', 'pending', 'reset']) {
    await mount(page, { 'wheel-capture': '', 'pointer-capture': 'mouse', 'wheel-delay': mode === 'pending' ? '10000' : '150' })
    await syntheticCapture(page)
    await page.evaluate(mode => {
      if (mode === 'reset') box.setAttribute('wheel-reset-on-move', '')
      if (mode !== 'new') pointer('pointermove', { buttons: 0, time: performance.now() - 200 })
      pointer('pointerdown')
      pointer('pointermove', { clientX: 80, clientY: 50 })
      pointer('pointerup', { clientX: 80, clientY: 50 })
    }, mode)
    assert.equal(await wheel(page, { clientX: 80, clientY: 50 }), false, mode)
    const afterSettling = await page.evaluate(() => {
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 80, clientY: 50, deltaY: 12 })
      Object.defineProperty(event, 'timeStamp', { value: performance.now() + 11000 })
      box.dispatchEvent(event)
      return event.defaultPrevented
    })
    assert.equal(afterSettling, mode !== 'new', `${mode}: existing dwell can settle after release without another move`)
  }
})

test('a hybrid-device touch tap does not clear settled mouse dwell', async t => {
  const page = await pageFor(t, { hasTouch: true })
  await mount(page, { 'wheel-capture': '', 'wheel-delay': '0' })
  await page.mouse.move(20, 20)
  assert.equal(await wheel(page), true)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 400, y: 300, id: 0 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  assert.equal(await wheel(page), true)
  await page.evaluate(() => {
    box.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: null }))
  })
  assert.equal(await wheel(page), false, 'Mouse exit still clears dwell')
})

test('trusted mouse capture continues outside, ends once, and does not emit an accidental click', async t => {
  const page = await pageFor(t)
  await mount(page, { 'pointer-capture': 'mouse', 'pointer-threshold': '3' })
  await page.evaluate(() => box.addEventListener('click', () => log.push({ type: 'click' })))
  await page.mouse.move(20, 20)
  await page.mouse.down()
  assert.deepEqual(await page.evaluate(() => log), [])
  await page.mouse.move(60, 50)
  await page.mouse.move(360, 300)
  await page.mouse.up()
  const result = await page.evaluate(() => log)
  assert.deepEqual(result.map(e => e.detail?.phase), ['start', 'move', 'move', 'end'])
  assert.equal(result[2].detail.inside, false)
  assert.equal(result[2].detail.movementX, 340)
  assert.equal(result[2].detail.deltaX, 300)
  assert.equal(result[0].detail.activationReason, 'drag-threshold')
  assert.equal(result[2].detail.pointerEvent.isTrusted, true)
})

test('nested interactive controls and explicit ignored subtrees keep their input', async t => {
  const page = await pageFor(t)
  await mount(page, { 'pointer-capture': '', pan: 'both', 'wheel-capture': '', 'wheel-activation': 'hover' })
  await page.evaluate(() => { box.innerHTML = '<button id="button">Control</button><span id="ignored" data-box-input-ignore>Ignored</span>' })
  await page.locator('#button').click()
  assert.deepEqual(await page.evaluate(() => log), [])
  assert.equal(await wheel(page, {}, '#ignored'), false)
  await page.evaluate(() => box.setAttribute('pointer-include-interactive', ''))
  await page.locator('#button').click()
  assert.deepEqual(await page.evaluate(() => log.map(e => e.detail.phase)), ['start', 'end'])
})

test('nested Anta Tabs switch without starting Box pointer or pan capture', async t => {
  for (const props of [
    { pointerCapture: true },
    { pan: { pointerTypes: ['mouse'], threshold: 0 } },
    { pointerCapture: true, pan: { pointerTypes: ['mouse'], threshold: 0 } },
  ]) {
    const page = await pageFor(t)
    await page.evaluate(props => {
      window.log = []
      renderTabsInBox({
        ...props,
        onPointerInput: (_, detail) => log.push(detail),
        onPanInput: (_, detail) => log.push(detail),
      })
    }, props)
    assert.equal(await page.locator('a-tabs').evaluate(tabs => tabs.value), 'first')
    await page.locator('a-tab[value="second"]').click()
    assert.deepEqual(await page.evaluate(() => log), [], JSON.stringify(props))
    assert.equal(await page.locator('a-tabs').evaluate(tabs => tabs.value), 'second')
  }
})

test('raw Anta tabs without explicit roles keep their clicks', async t => {
  const page = await pageFor(t)
  await mount(page, { 'pointer-capture': '' })
  await page.evaluate(() => {
    box.innerHTML = '<a-tabs default-state="first"><a-tab value="first">First</a-tab><a-tab value="second">Second</a-tab></a-tabs>'
  })
  await page.locator('a-tab[value="second"]').click()
  assert.deepEqual(await page.evaluate(() => log), [])
  assert.equal(await page.locator('a-tabs').evaluate(tabs => tabs.value), 'second')
})

test('nested ARIA controls keep descendant clicks under pointer and pan capture', async t => {
  const page = await pageFor(t)
  for (const attributes of [
    { 'pointer-capture': '' },
    { pan: 'both', 'pan-pointer-types': 'mouse', 'pan-threshold': '0' },
  ]) {
    for (const role of [
      'button', 'checkbox', 'combobox', 'link', 'menuitem', 'menuitemcheckbox',
      'menuitemradio', 'option', 'radio', 'scrollbar', 'searchbox', 'slider',
      'spinbutton', 'switch', 'tab', 'textbox', 'treeitem', 'unknown tab',
    ]) {
      await mount(page, attributes)
      await page.evaluate(role => {
        const control = document.createElement('div')
        control.id = 'control'
        control.setAttribute('role', role)
        control.tabIndex = 0
        control.innerHTML = '<span>Choose</span>'
        control.addEventListener('click', () => log.push({ type: 'control-click' }))
        box.append(control)
      }, role)
      await page.locator('#control span').click()
      assert.deepEqual(await page.evaluate(() => log), [{ type: 'control-click' }], `${role}: ${JSON.stringify(attributes)}`)
    }
  }
})

test('interactive capture remains explicit and focusable non-controls still capture', async t => {
  const page = await pageFor(t)
  await mount(page, { 'pointer-capture': '', 'pointer-include-interactive': '' })
  await page.evaluate(() => {
    box.innerHTML = '<div id="control" role="tab" tabindex="0"><span>Choose</span></div>'
    control.addEventListener('click', () => log.push({ type: 'control-click' }))
  })
  await page.locator('#control span').click()
  assert.deepEqual(await page.evaluate(() => log.map(e => e.detail?.phase)), ['start', 'end'])
  await page.evaluate(() => {
    log.length = 0
    control.setAttribute('data-box-input-ignore', '')
  })
  await page.locator('#control span').click()
  assert.deepEqual(await page.evaluate(() => log), [{ type: 'control-click' }])

  await mount(page, { 'pointer-capture': '' })
  await page.evaluate(() => { box.innerHTML = '<div id="surface" role="img" tabindex="0" aria-label="Plot">Plot</div>' })
  await page.locator('#surface').click()
  assert.deepEqual(await page.evaluate(() => log.map(e => e.detail?.phase)), ['start', 'end'])
})

test('click suppression does not swallow a new press on an excluded control', async t => {
  const page = await pageFor(t)
  await mount(page, { 'pointer-capture': 'mouse' })
  await page.evaluate(() => {
    box.innerHTML = '<button id="button">Control</button>'
    button.addEventListener('click', () => log.push({ type: 'button-click' }))
  })
  await page.mouse.move(100, 100)
  await page.mouse.down()
  await page.mouse.move(130, 100)
  await page.mouse.up()
  await page.locator('#button').click()
  assert.equal(await page.evaluate(() => log.at(-1).type), 'button-click')
})

test('pointer ids, immutable snapshots, and cancellation on disable/removal/lost capture', async t => {
  const page = await pageFor(t)
  for (const reason of ['disabled', 'disconnected', 'lost-capture', 'pointer-cancel', 'blur']) {
    await mount(page, { 'pointer-capture': 'mouse' })
    await syntheticCapture(page)
    await page.evaluate(reason => {
      box.addEventListener('pointerinput', e => {
        e.detail.start.pointerEvent.clientX = 999
        if (e.detail.pointerEvent) e.detail.pointerEvent.clientX = 999
      })
      pointer('pointerdown')
      pointer('pointermove', { pointerId: 55, clientX: 700 })
      pointer('pointerup', { pointerId: 55 })
      pointer('pointermove', { clientX: 50 })
      if (reason === 'disabled') box.removeAttribute('pointer-capture')
      if (reason === 'disconnected') box.remove()
      if (reason === 'lost-capture') pointer('lostpointercapture')
      if (reason === 'pointer-cancel') pointer('pointercancel')
      if (reason === 'blur') window.dispatchEvent(new Event('blur'))
      pointer('pointerup', {}, document)
    }, reason)
    const result = await page.evaluate(() => log)
    assert.deepEqual(result.map(e => e.detail.phase), ['start', 'move', 'cancel'], reason)
    assert.equal(result[1].detail.movementX, 20)
    assert.equal(result[2].detail.cancelReason, reason)
  }
})

test('touch ownership and text selection follow enabled devices, buttons, and axes', async t => {
  const page = await pageFor(t)
  for (const [props, touchAction, userSelect] of [
    [{ pan: { pointerTypes: ['mouse'] } }, 'auto', 'none'],
    [{ pan: { pointerTypes: [] } }, 'auto', 'auto'],
    [{ pointerCapture: { pointerTypes: [] } }, 'auto', 'auto'],
    [{ pointerCapture: { buttons: [] } }, 'auto', 'auto'],
    [{ pointerCapture: { pointerTypes: ['mouse', 'pen'] } }, 'auto', 'none'],
    [{ pan: { axis: 'x' } }, 'pan-y pinch-zoom', 'none'],
    [{ pan: { axis: 'y' } }, 'pan-x pinch-zoom', 'none'],
    [{ pan: true }, 'none', 'none'],
    [{ pointerCapture: true }, 'none', 'none'],
    [{ pan: { axis: 'x' }, pointerCapture: true }, 'none', 'none'],
    [{ pan: { axis: 'y' }, pointerCapture: { pointerTypes: ['touch'] } }, 'none', 'none'],
    [{ pan: { axis: 'x' }, pointerCapture: { pointerTypes: ['mouse'] } }, 'pan-y pinch-zoom', 'none'],
    [{ pan: { axis: 'y' }, pointerCapture: { buttons: [] } }, 'pan-x pinch-zoom', 'none'],
    [{ pan: { pointerTypes: [] }, pointerCapture: true }, 'none', 'none'],
    [{ pan: { pointerTypes: [] }, pointerCapture: { buttons: [] } }, 'auto', 'auto'],
    [{ pan: false, pointerCapture: false }, 'auto', 'auto'],
  ]) {
    await page.evaluate(props => renderBox(props), props)
    const styles = await page.locator('a-box').evaluate(box => {
      const { touchAction, userSelect } = getComputedStyle(box)
      return { touchAction, userSelect }
    })
    assert.deepEqual(styles, { touchAction, userSelect }, JSON.stringify(props))
  }
})

test('empty pointer devices and buttons attach no input listeners', async t => {
  const page = await pageFor(t)
  const result = await page.evaluate(() => {
    const additions = []
    const original = EventTarget.prototype.addEventListener
    EventTarget.prototype.addEventListener = function(type, ...args) {
      if (['wheel', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture'].includes(type)) additions.push(type)
      return original.call(this, type, ...args)
    }
    for (const attributes of [
      { pan: 'both', 'pan-pointer-types': 'none' },
      { 'pointer-capture': '', 'pointer-buttons': 'none' },
      { 'pointer-capture': 'none' },
    ]) {
      const box = document.createElement('a-box')
      for (const [name, value] of Object.entries(attributes)) box.setAttribute(name, value)
      document.body.append(box)
    }
    EventTarget.prototype.addEventListener = original
    return additions
  })
  assert.deepEqual(result, [])
})

test('touch pointer capture takes priority over single-axis pan', async t => {
  const page = await pageFor(t)
  for (const axis of ['x', 'y']) {
    for (const pointerTypes of ['', 'all', 'touch', 'mouse touch']) {
      await mount(page, { pan: axis, 'pointer-capture': pointerTypes })
      assert.equal(await page.locator('#box').evaluate(box => getComputedStyle(box).touchAction), 'none', `${axis}: ${pointerTypes}`)
    }
  }
})

test('touch pointer capture keeps a gesture in the axis not handled by pan', async t => {
  const page = await pageFor(t, { hasTouch: true })
  await mount(page, { pan: 'x', 'pointer-capture': 'touch' })
  await page.evaluate(() => { document.body.style.height = '2000px' })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 80, y: 120, id: 0 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 80, y: 80, id: 0 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 80, y: 40, id: 0 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  const result = await page.evaluate(() => log)
  assert.ok(result.every(e => e.type === 'pointerinput'))
  assert.equal(result[0].detail.phase, 'start')
  assert.equal(result.at(-1).detail.phase, 'end')
  assert.ok(result.some(e => e.detail.phase === 'move' && e.detail.pointerEvent?.isTrusted))
  assert.ok(!result.some(e => e.detail.phase === 'cancel'))
  assert.equal(await page.evaluate(() => window.scrollY), 0)
})

test('touch pan handles trusted touch on desktop without enabling raw pointer input or inertia', async t => {
  const page = await pageFor(t, { hasTouch: true })
  await mount(page, { pan: 'y' })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 80, y: 120, id: 0 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 80, y: 90, id: 0 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 80, y: 60, id: 0 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  const result = await page.evaluate(() => log)
  assert.ok(result.length >= 4)
  assert.ok(result.every(e => e.type === 'paninput'))
  assert.equal(result[0].detail.phase, 'start')
  assert.equal(result.at(-1).detail.phase, 'end')
  assert.ok(result.some(e => e.detail.deltaY > 0 && e.detail.pointerEvent?.isTrusted))
  assert.ok(!result.some(e => e.detail.phase === 'inertia'))
})

test('pan does not activate on movement solely in the browser-owned axis', async t => {
  const page = await pageFor(t)
  await mount(page, { pan: 'y', 'pan-pointer-types': 'mouse' })
  await syntheticCapture(page)
  await page.evaluate(() => { pointer('pointerdown'); pointer('pointermove', { clientX: 100 }); pointer('pointerup', { clientX: 100 }) })
  assert.deepEqual(await page.evaluate(() => log), [])
})

test('pan release applies its final delta; stale movement does not start inertia', async t => {
  const page = await pageFor(t)
  await mount(page, { pan: 'y', 'pan-pointer-types': 'mouse', 'pan-inertia': '' })
  await syntheticCapture(page)
  await page.evaluate(() => {
    pointer('pointerdown', { time: 0, clientY: 100 })
    pointer('pointermove', { time: 20, clientY: 70 })
    pointer('pointermove', { time: 40, clientY: 60 })
    pointer('pointerup', { time: 200, clientY: 60 })
  })
  let result = await page.evaluate(() => log)
  assert.deepEqual(result.map(e => e.detail.phase), ['start', 'move', 'move', 'release', 'end'])
  assert.equal(result.at(-2).detail.velocityY, 0)
  await page.evaluate(() => {
    log.length = 0
    box.removeAttribute('pan-inertia')
    pointer('pointerdown', { time: 220, clientY: 100 })
    pointer('pointermove', { time: 240, clientY: 70 })
    pointer('pointerup', { time: 260, clientY: 50 })
  })
  result = await page.evaluate(() => log)
  assert.equal(result.find(e => e.detail.phase === 'release').detail.deltaY, 20)
})

test('inertia is time based, has no native event, and stops when declarative bounds close', async t => {
  const page = await pageFor(t)
  await mount(page, { pan: 'y', 'pan-pointer-types': 'mouse', 'pan-inertia': '', 'pan-directions': 'down' })
  await syntheticCapture(page)
  await page.evaluate(() => {
    pointer('pointerdown', { time: 0, clientY: 100 })
    pointer('pointermove', { time: 20, clientY: 70 })
    pointer('pointerup', { time: 40, clientY: 50 })
  })
  await page.waitForFunction(() => log.some(e => e.detail.phase === 'inertia'))
  await page.evaluate(() => box.setAttribute('pan-directions', 'none'))
  const result = await page.evaluate(() => log)
  const motion = result.find(e => e.detail.phase === 'inertia').detail
  assert.equal(motion.pointerEvent, null)
  assert.ok(motion.deltaY > 0)
  assert.equal(result.at(-1).detail.phase, 'cancel')
  assert.equal(result.at(-1).detail.cancelReason, 'disabled')
})

test('enabled Boxes share document input listeners and release all of them on disconnect', async t => {
  const page = await pageFor(t)
  const result = await page.evaluate(() => {
    const balance = new Map()
    const add = EventTarget.prototype.addEventListener
    const remove = EventTarget.prototype.removeEventListener
    const tracked = new Set(['onDwellMove', 'onDwellOut', 'onDwellWheel', 'onSessionMove', 'onSessionUp', 'onSessionCancel', 'onWindowBlur', 'onVisibilityChange'])
    EventTarget.prototype.addEventListener = function(type, fn, options) {
      if (tracked.has(fn?.name)) balance.set(fn.name, (balance.get(fn.name) ?? 0) + 1)
      return add.call(this, type, fn, options)
    }
    EventTarget.prototype.removeEventListener = function(type, fn, options) {
      if (tracked.has(fn?.name)) balance.set(fn.name, (balance.get(fn.name) ?? 0) - 1)
      return remove.call(this, type, fn, options)
    }
    const boxes = Array.from({ length: 20 }, () => {
      const box = document.createElement('a-box')
      box.setAttribute('wheel-capture', '')
      document.body.append(box)
      return box
    })
    const live = Object.fromEntries(balance)
    boxes.forEach(box => box.setAttribute('wheel-capture', 'none'))
    const bounded = Object.fromEntries(balance)
    boxes.forEach(box => box.removeAttribute('wheel-capture'))
    const disabled = Object.fromEntries(balance)
    boxes.forEach(box => box.remove())
    return { live, bounded, disabled, remaining: Object.fromEntries(balance) }
  })
  assert.ok(Object.keys(result.live).length >= 5)
  assert.ok(Object.values(result.live).every(value => value === 1))
  assert.deepEqual(result.bounded, result.live)
  assert.ok(Object.values(result.disabled).every(value => value === 0))
  assert.ok(Object.values(result.remaining).every(value => value === 0))
})

test('inertia integrates the same distance at different frame rates and runs independently per Box', async t => {
  const page = await pageFor(t)
  await page.evaluate(() => {
    let now = 0, nextId = 0
    const frames = new Map()
    performance.now = () => now
    window.requestAnimationFrame = callback => { frames.set(++nextId, callback); return nextId }
    window.cancelAnimationFrame = id => frames.delete(id)
    window.advance = time => {
      now = time
      const callbacks = [...frames.values()]
      frames.clear()
      callbacks.forEach(callback => callback(time))
    }
  })
  const distances = []
  for (const step of [10, 25, 50]) {
    await mount(page, { pan: 'y', 'pan-pointer-types': 'mouse', 'pan-inertia': '' })
    await syntheticCapture(page)
    distances.push(await page.evaluate(step => {
      advance(0)
      pointer('pointerdown', { time: 0, clientY: 100 })
      pointer('pointermove', { time: 20, clientY: 70 })
      pointer('pointerup', { time: 40, clientY: 50 })
      for (let time = step; time <= 100; time += step) advance(time)
      return log.filter(e => e.detail.phase === 'inertia').reduce((sum, e) => sum + e.detail.deltaY, 0)
    }, step))
  }
  const expected = 1.25 * 325 * (1 - Math.exp(-100 / 325))
  distances.forEach(distance => assert.ok(Math.abs(distance - expected) < 1e-8))

  await mount(page, { pan: 'y', 'pan-pointer-types': 'mouse', 'pan-inertia': '' })
  await syntheticCapture(page)
  const result = await page.evaluate(() => {
    advance(0)
    const other = box.cloneNode()
    other.id = 'other'
    other.setPointerCapture = box.setPointerCapture
    other.releasePointerCapture = box.releasePointerCapture
    other.hasPointerCapture = box.hasPointerCapture
    other.addEventListener('paninput', e => log.push({ type: 'other', detail: e.detail }))
    document.body.append(other)
    for (const target of [box, other]) {
      pointer('pointerdown', { time: 0, clientY: 100 }, target)
      pointer('pointermove', { time: 20, clientY: 70 }, target)
      pointer('pointerup', { time: 40, clientY: 50 }, target)
    }
    advance(16)
    const moving = log.filter(e => e.detail.phase === 'inertia').map(e => e.type)
    box.remove()
    log.length = 0
    advance(32)
    return { moving, remaining: log.map(e => e.type) }
  })
  assert.deepEqual(result.moving, ['paninput', 'other'])
  assert.deepEqual(result.remaining, ['other'])
})

test('a consumer can disable a gesture during its start event without further delivery', async t => {
  const page = await pageFor(t)
  await mount(page, { 'pointer-capture': 'mouse', pan: 'both', 'pan-pointer-types': 'mouse', 'pan-threshold': '0' })
  await syntheticCapture(page)
  await page.evaluate(() => {
    box.addEventListener('pointerinput', event => {
      if (event.detail.phase === 'start') box.removeAttribute('pointer-capture')
    })
    pointer('pointerdown')
    pointer('pointermove', { clientX: 90 })
    pointer('pointerup')
  })
  const result = await page.evaluate(() => log)
  assert.deepEqual(result.map(e => [e.type, e.detail.phase]), [['pointerinput', 'start'], ['pointerinput', 'cancel']])
})
