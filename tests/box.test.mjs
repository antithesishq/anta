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
    entryPoints: ['tests/box.fixture.tsx'], bundle: true, write: false,
    outfile: 'box.js', format: 'esm', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('site/node_modules')],
    alias: {
      '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
      react: requireSite.resolve('preact/compat'),
    },
  })
  const assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/box.css' : '/box.js', file.text]))
  server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(assets.get(req.url) ?? `<!doctype html><link rel="stylesheet" href="/box.css">
      <style>body{margin:20px}a-box{width:200px;height:100px;overflow:auto}</style>
      <div id="mount"></div><script type="module" src="/box.js"></script>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  const engine = process.env.BOX_TEST_BROWSER || 'chromium'
  browser = await ({ chromium, firefox, webkit })[engine].launch({
    headless: true,
    ...(engine === 'chromium' ? { channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined } : {}),
  })
})

after(async () => {
  await browser?.close()
  if (server) await new Promise(resolve => server.close(resolve))
})

async function pageFor(t, attributes = { observe: 'size' }) {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } })
  t.after(() => context.close())
  const page = await context.newPage()
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.renderBox === 'function')
  await page.evaluate(attributes => {
    window.events = []
    window.box = document.createElement('a-box')
    for (const [name, value] of Object.entries(attributes)) box.setAttribute(name, value)
    box.innerHTML = '<div style="width:600px;height:600px">Content</div>'
    box.addEventListener('measurechange', event => events.push({ ...event.detail, time: performance.now() }))
    document.querySelector('#mount').append(box)
    window.frames = async (count = 3) => {
      for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame)
    }
  }, attributes)
  if ('observe' in attributes) await page.waitForFunction(() => events.length === 1)
  await page.evaluate(() => frames())
  return page
}

test('Box defaults to border-box dimensions while scroll states and snapshots stay current', async t => {
  const page = await pageFor(t, { observe: 'size', fade: '' })
  assert.deepEqual(await page.evaluate(async () => {
    box.scrollTop = 50
    box.scrollLeft = 30
    await frames()
    box.firstElementChild.style.height = '700px'
    await frames()
    return { count: events.length, scrollTop: box.measurement.scrollTop,
      hidden: box.matches(':state(hidden-start-y)'), truncated: box.isTruncated }
  }), { count: 1, scrollTop: 50, hidden: true, truncated: true })
  await page.evaluate(() => { box.style.width = '240px' })
  await page.waitForFunction(() => events.length === 2)
  const event = await page.evaluate(() => events.at(-1))
  assert.equal(event.current.width, 240)
  assert.equal(event.changed.width, 240)
  assert.equal(event.changed.scrollTop, 50, 'Delta compares against the last event, including ignored fields')
  assert.equal(event.changed.scrollHeight, 700)
  await page.evaluate(() => { box.style.border = '5px solid black' })
  await page.waitForFunction(() => events.at(-1).current.width === 250)
})

test('Observe selects edge changes, all measurements, or disables observation', async t => {
  const page = await pageFor(t, { observe: 'edges' })
  await page.evaluate(() => { box.scrollTop = 20 })
  await page.waitForFunction(() => events.length === 2)
  await page.evaluate(async () => { box.scrollTop = 40; await frames() })
  assert.equal(await page.evaluate(() => events.length), 2)
  await page.evaluate(() => box.setAttribute('observe', 'all'))
  await page.waitForFunction(() => events.length === 3)
  await page.evaluate(() => { box.scrollTop = 60 })
  await page.waitForFunction(() => events.length === 4)
  assert.equal(await page.evaluate(() => events.at(-1).changed.scrollTop), 60)
  await page.evaluate(() => box.removeAttribute('observe'))
  await page.evaluate(async () => { box.style.width = '250px'; box.scrollTop = 80; await frames() })
  assert.equal(await page.evaluate(() => events.length), 4)
})

test('Throttling delivers the latest trailing snapshot without delaying CSS states', async t => {
  const page = await pageFor(t, { observe: 'all', fade: '', throttle: '250' })
  await page.evaluate(async () => {
    for (let i = 1; i <= 6; i++) {
      box.scrollTop = i * 10
      box.style.width = `${200 + i}px`
      await frames(1)
    }
  })
  assert.deepEqual(await page.evaluate(() => ({ count: events.length, hidden: box.matches(':state(hidden-start-y)') })),
    { count: 1, hidden: true })
  await page.waitForFunction(() => events.length === 2)
  const event = await page.evaluate(() => ({ last: events[1], interval: events[1].time - events[0].time }))
  assert.equal(event.last.current.width, 206)
  assert.equal(event.last.changed.scrollTop, 60)
  assert.ok(event.interval >= 240, `Unexpected interval: ${event.interval}`)
  await page.waitForTimeout(300)
  assert.equal(await page.evaluate(() => events.length), 2)
})

test('A throttled change that returns to the reported value emits no duplicate', async t => {
  const page = await pageFor(t, { observe: 'size', throttle: '250' })
  await page.evaluate(async () => {
    box.style.width = '240px'
    await frames()
    box.style.width = '200px'
    await frames()
  })
  await page.waitForTimeout(350)
  assert.equal(await page.evaluate(() => events.length), 1)
})

test('Pending reports are cancelled on disconnect, observation stop, and viewport exit', async t => {
  for (const stop of ['disconnect', 'observe', 'viewport']) {
    const page = await pageFor(t, { observe: 'size', throttle: '250' })
    await page.evaluate(async stop => {
      box.style.width = '240px'
      await frames()
      if (stop === 'disconnect') box.remove()
      if (stop === 'observe') box.removeAttribute('observe')
      if (stop === 'viewport') box.style.marginTop = '2000px'
      await frames()
    }, stop)
    await page.waitForTimeout(350)
    assert.equal(await page.evaluate(() => events.length), 1, stop)
    await page.evaluate(stop => {
      if (stop === 'disconnect') document.querySelector('#mount').append(box)
      if (stop === 'observe') box.setAttribute('observe', 'size')
      if (stop === 'viewport') box.style.marginTop = '0'
    }, stop)
    await page.waitForFunction(() => events.length === 2)
    assert.equal(await page.evaluate(() => events[1].current.width), 240)
    await page.close()
  }
})

test('Changing throttle preserves a pending change and invalid intervals stay frame-based', async t => {
  const page = await pageFor(t, { observe: 'size', throttle: '1000' })
  await page.evaluate(async () => {
    box.style.width = '240px'
    await frames()
    box.setAttribute('throttle', '0')
  })
  await page.waitForFunction(() => events.length === 2)
  assert.equal(await page.evaluate(() => events[1].changed.width), 240)
  for (const interval of ['-10', 'NaN', 'Infinity', 'nonsense']) {
    await page.evaluate(async interval => {
      box.setAttribute('throttle', interval)
      box.style.width = `${box.measurement.width + 1}px`
      await frames()
    }, interval)
  }
  assert.equal(await page.evaluate(() => events.length), 6)
  await page.waitForTimeout(1100)
  assert.equal(await page.evaluate(() => events.length), 6)
})

test('Truncation tooltips read unobserved Boxes on demand', async t => {
  const page = await pageFor(t, {})
  assert.deepEqual(await page.evaluate(async () => {
    let reads = 0
    const read = box.getBoundingClientRect.bind(box)
    box.getBoundingClientRect = () => { reads++; return read() }
    const tooltip = document.createElement('a-tooltip')
    tooltip.setAttribute('truncated-only', '')
    tooltip.textContent = 'Clipped content'
    box.append(tooltip)
    await frames()
    const idleReads = reads
    tooltip.show()
    const shown = tooltip.shadowRoot.querySelector('[popover]').matches(':popover-open')
    tooltip.remove()
    box.firstElementChild.style.cssText = 'width:40px;height:40px'
    box.append(tooltip)
    tooltip.show()
    const hidden = !tooltip.shadowRoot.querySelector('[popover]').matches(':popover-open')
    const truncated = box.isTruncated
    const afterRead = reads
    box.firstElementChild.style.height = '800px'
    await frames()
    return { idleReads, shown, hidden, truncated, idleAfterRead: reads === afterRead, events: events.length }
  }), { idleReads: 0, shown: true, hidden: true, truncated: false, idleAfterRead: true, events: 0 })
})

test('JSX Box serializes field selection and throttle and unwraps measurement events', async t => {
  const page = await pageFor(t, {})
  await page.evaluate(() => {
    box.remove()
    window.details = []
    renderBox({ observe: 'scroll', throttle: 100,
      onMeasureChange: (_, detail) => details.push(detail) })
    window.box = document.querySelector('a-box')
  })
  await page.waitForFunction(() => details.length === 1)
  assert.deepEqual(await page.evaluate(() => ['observe', 'throttle'].map(name => box.getAttribute(name))),
    ['scroll', '100'])
  await page.evaluate(() => { box.scrollTop = 40 })
  await page.waitForFunction(() => details.length === 2)
  assert.equal(await page.evaluate(() => details[1].changed.scrollTop), 40)
})

test('Width and height observation report only the selected dimension', async t => {
  for (const dimension of ['width', 'height']) {
    const page = await pageFor(t, { observe: dimension })
    await page.evaluate(async dimension => {
      box.style[dimension === 'width' ? 'height' : 'width'] = '250px'
      box.scrollTop = 30
      await frames()
    }, dimension)
    assert.equal(await page.evaluate(() => events.length), 1, dimension)
    await page.evaluate(dimension => { box.style[dimension] = '300px' }, dimension)
    await page.waitForFunction(() => events.length === 2)
    assert.equal(await page.evaluate(dimension => events[1].changed[dimension], dimension), 300)
    await page.close()
  }
})

test('Scroll, hidden edges, and overflow select independent triggers and combine with size', async t => {
  const page = await pageFor(t, { observe: 'scroll' })
  await page.evaluate(async () => { box.style.width = '220px'; await frames() })
  assert.equal(await page.evaluate(() => events.length), 1)
  await page.evaluate(() => { box.scrollTop = 20 })
  await page.waitForFunction(() => events.length === 2)
  await page.evaluate(() => box.setAttribute('observe', 'overflow'))
  await page.waitForFunction(() => events.length === 3)
  await page.evaluate(async () => { box.scrollTop = 40; await frames() })
  assert.equal(await page.evaluate(() => events.length), 3, 'Mid-scroll offsets are excluded from overflow')
  await page.evaluate(async () => { box.scrollTop = 500; await frames() })
  assert.equal(await page.evaluate(() => events.length), 3, 'Overflow does not report hidden-edge changes')
  await page.evaluate(() => box.setAttribute('observe', 'edges'))
  await page.waitForFunction(() => events.length === 4)
  await page.evaluate(() => { box.scrollTop = 480 })
  await page.waitForFunction(() => events.length === 5)
  assert.equal(await page.evaluate(() => events.at(-1).changed.hiddenEndY), true)
  await page.evaluate(async () => { box.scrollTop = 460; await frames() })
  assert.equal(await page.evaluate(() => events.length), 5, 'Hidden edges do not report each offset')
  await page.evaluate(() => box.setAttribute('observe', 'overflow'))
  await page.waitForFunction(() => events.length === 6)
  await page.evaluate(() => { box.firstElementChild.style.height = '700px' })
  await page.waitForFunction(() => events.length === 7)
  assert.equal(await page.evaluate(() => events.at(-1).changed.scrollHeight), 700)
  await page.evaluate(() => box.setAttribute('observe', 'size scroll'))
  await page.waitForFunction(() => events.length === 8)
  await page.evaluate(() => { box.style.width = '240px' })
  await page.waitForFunction(() => events.length === 9)
  await page.evaluate(() => { box.scrollTop = 60 })
  await page.waitForFunction(() => events.length === 10)
})

test('JSX context handlers preserve selected fields and default both handlers to size plus context', async t => {
  const page = await pageFor(t, {})
  await page.evaluate(() => {
    box.remove()
    window.details = []
    window.contexts = []
    window.handlers = { onMeasureChange: (_, detail) => details.push(detail),
      onContextChange: (_, detail) => contexts.push(detail) }
    renderBox({ ...handlers, observe: 'width' })
    window.box = document.querySelector('a-box')
  })
  await page.waitForFunction(() => details.length === 1 && contexts.length === 1)
  assert.equal(await page.evaluate(() => box.getAttribute('observe')), 'width context')
  await page.evaluate(async () => {
    box.style.height = '140px'
    box.scrollTop = 20
    await frames()
    box.tabIndex = 0
    box.focus()
  })
  await page.waitForFunction(() => contexts.at(-1).current.focusWithin)
  assert.equal(await page.evaluate(() => details.length), 1)
  await page.evaluate(() => { box.style.width = '240px' })
  await page.waitForFunction(() => details.length === 2)
  await page.evaluate(() => renderBox(handlers))
  await page.waitForFunction(() => details.length === 3)
  assert.equal(await page.evaluate(() => box.getAttribute('observe')), 'size context')
  await page.evaluate(async () => { box.scrollTop = 40; await frames() })
  assert.equal(await page.evaluate(() => details.length), 3)
  await page.evaluate(() => { box.style.height = '160px' })
  await page.waitForFunction(() => details.length === 4)
})

test('Fade alone updates CSS states without selecting measurement events', async t => {
  const page = await pageFor(t, { fade: '' })
  await page.evaluate(async () => { box.scrollTop = 30; await frames() })
  assert.equal(await page.evaluate(() => box.matches(':state(hidden-start-y)')), true)
  assert.equal(await page.evaluate(() => events.length), 0)
  await page.evaluate(() => box.setAttribute('observe', ''))
  await page.waitForFunction(() => events.length === 1)
  await page.evaluate(() => { box.scrollTop = 60 })
  await page.waitForFunction(() => events.length === 2)
})

test('Typed JSX observation arrays accept any order and duplicates', async t => {
  const page = await pageFor(t, {})
  await page.evaluate(() => {
    box.remove()
    window.details = []
    window.handler = (_, detail) => details.push(detail)
    renderBox({ observe: ['edges', 'size', 'edges'], onMeasureChange: handler })
    window.box = document.querySelector('a-box')
  })
  await page.waitForFunction(() => details.length === 1)
  assert.equal(await page.evaluate(() => box.getAttribute('observe')), 'edges size')
  await page.evaluate(async () => {
    renderBox({ observe: ['size', 'edges'], onMeasureChange: handler })
    await frames()
  })
  assert.equal(await page.evaluate(() => details.length), 1, 'Reordering does not reinitialize the selection')
  await page.evaluate(() => { box.scrollTop = 20 })
  await page.waitForFunction(() => details.length === 2)
  await page.evaluate(async () => { box.scrollTop = 40; await frames() })
  assert.equal(await page.evaluate(() => details.length), 2)
  await page.evaluate(() => { box.style.width = '240px' })
  await page.waitForFunction(() => details.length === 3)
})

test('Size skips content reads and overflow skips scroll reads; live changes release the listeners', async t => {
  const page = await pageFor(t, { observe: 'size' })
  await page.evaluate(() => {
    window.reads = 0
    const read = box.getBoundingClientRect.bind(box)
    box.getBoundingClientRect = () => { reads++; return read() }
  })
  assert.equal(await page.evaluate(async () => {
    box.scrollTop = 20
    box.firstElementChild.style.height = '700px'
    box.firstElementChild.textContent = 'Changed content'
    await frames()
    return reads
  }), 0)
  await page.evaluate(() => box.setAttribute('observe', 'overflow'))
  await page.waitForFunction(() => events.length === 2)
  await page.evaluate(async () => { await frames(); reads = 0; box.scrollTop = 40; await frames() })
  assert.equal(await page.evaluate(() => reads), 0)
  await page.evaluate(() => { box.firstElementChild.style.height = '800px' })
  await page.waitForFunction(() => events.length === 3)
  assert.ok(await page.evaluate(() => reads > 0))
  await page.evaluate(() => box.setAttribute('observe', 'edges'))
  await page.waitForFunction(() => events.length === 4)
  await page.evaluate(async () => { await frames(); reads = 0; box.scrollTop = 60; await frames() })
  assert.ok(await page.evaluate(() => reads > 0), 'Hidden edges still need scroll measurements')
  assert.equal(await page.evaluate(() => events.length), 4, 'Mid-scroll measurements produce no edge events')
  await page.evaluate(() => box.setAttribute('observe', 'size'))
  await page.waitForFunction(() => events.length === 5)
  await page.evaluate(async () => {
    await frames()
    reads = 0
    box.scrollTop = 80
    box.firstElementChild.style.height = '900px'
    box.firstElementChild.textContent = 'Changed again'
    await frames()
  })
  assert.equal(await page.evaluate(() => reads), 0, 'Returning to size stops both content and scroll observation')
})

test('Reordering equivalent observation tokens preserves the throttle window', async t => {
  const page = await pageFor(t, { observe: 'width height', throttle: '300' })
  await page.evaluate(async () => {
    box.style.width = '240px'
    await frames()
    box.setAttribute('observe', 'height width height')
    await frames()
  })
  assert.equal(await page.evaluate(() => events.length), 1)
  await page.waitForFunction(() => events.length === 2)
  assert.ok(await page.evaluate(() => events[1].time - events[0].time >= 290))
  assert.equal(await page.evaluate(() => events[1].changed.width), 240)
})
