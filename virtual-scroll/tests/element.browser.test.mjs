import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { serve } from './demo.mjs'

// VIRTUAL_SCROLL_PLAYWRIGHT, VIRTUAL_SCROLL_BROWSER_PATH, and VIRTUAL_SCROLL_BROWSER_ARGS
// let the suite run outside a pnpm install, e.g. in a Nix sandbox. Set
// VIRTUAL_SCROLL_BROWSER_PER_TEST when the browser runs single-process and can hold one page.
const requireSite = createRequire(new URL('../../site/package.json', import.meta.url))
const { chromium } = requireSite(process.env.VIRTUAL_SCROLL_PLAYWRIGHT ?? 'playwright')
let browser, server, origin

const perTest = !!process.env.VIRTUAL_SCROLL_BROWSER_PER_TEST

function launch() {
  return chromium.launch({
    headless: true,
    executablePath: process.env.VIRTUAL_SCROLL_BROWSER_PATH || undefined,
    channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined,
    args: process.env.VIRTUAL_SCROLL_BROWSER_ARGS?.split(' ').filter(Boolean),
  })
}

before(async () => {
  server = await serve(0)
  origin = `http://127.0.0.1:${server.address().port}/?blank`
  if (!perTest) browser = await launch()
})

after(async () => {
  await browser?.close()
  if (server) await new Promise(resolve => server.close(resolve))
})

async function pageFor(t, options = {}) {
  const owner = perTest ? await launch() : browser
  const page = await owner.newPage({ viewport: { width: 1000, height: 800 } })
  t.after(() => perTest ? owner.close() : page.close())
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, []))
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.mountList === 'function')
  await page.evaluate(options => window.mountList(options), options)
  await settle(page)
  return page
}

// Rows arrive after the fixture's delay; wait it out plus a few frames.
async function settle(page, ms = 120) {
  await page.waitForTimeout(ms)
  await page.evaluate(() => window.frames(3))
}

function rowTop(page, index) {
  return page.evaluate(index => {
    const row = window.list.querySelector(`[data-index="${index}"]`)
    if (!row) return null
    return row.getBoundingClientRect().top - window.list.getBoundingClientRect().top
  }, index)
}

function topRow(page) {
  return page.evaluate(() => {
    const top = window.list.getBoundingClientRect().top
    for (const row of window.list.querySelectorAll('[data-index]')) {
      const rect = row.getBoundingClientRect()
      if (rect.bottom > top + 0.5) return { index: Number(row.dataset.index), offset: rect.top - top }
    }
    return null
  })
}

function shadow(page, selector, read) {
  return page.evaluate(([selector, read]) => {
    const el = window.list.shadowRoot.querySelector(selector)
    return new Function('el', `return ${read}`)(el)
  }, [selector, read])
}

test('mounts the window it asks for and fills the viewport', async t => {
  const page = await pageFor(t)
  const ranges = await page.evaluate(() => window.ranges)
  assert.deepEqual(ranges[0], { start: 0, end: 47 })
  assert.deepEqual(await page.evaluate(() => window.rendered().length), 47)
  assert.equal(await shadow(page, '.gap.shown', 'el'), null)
  assert.equal((await topRow(page)).index, 0)
})

test('wheel scrolling moves content in the same frame, before slow rows arrive', async t => {
  const page = await pageFor(t)
  await page.evaluate(() => window.setDelay(1500))
  await page.mouse.move(300, 300)
  const before = await topRow(page)
  await page.mouse.wheel(0, 600)
  await page.evaluate(() => window.frames(2))
  const after = await topRow(page)
  assert.ok(after.index > before.index, `top row moved from ${before.index} to ${after.index}`)
  // Far beyond the mounted window, the gap shows placeholders until rows arrive.
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 3000)
  await page.evaluate(() => window.frames(2))
  assert.notEqual(await shadow(page, '.gap.shown', 'el'), null)
  await page.evaluate(() => window.setDelay(0))
  await page.mouse.wheel(0, 30)
  await settle(page, 1700)
  assert.equal(await shadow(page, '.gap.shown', 'el'), null)
})

test('rows measured late above the anchor do not move the anchor row', async t => {
  const page = await pageFor(t, { delay: 400 })
  // A track press jumps to an index; nothing around it is mounted or measured yet.
  const box = await page.evaluate(() => {
    const bar = window.list.shadowRoot.querySelector('.bar.v').getBoundingClientRect()
    return { x: bar.left + bar.width / 2, y: bar.top + bar.height / 2 }
  })
  await page.mouse.click(box.x, box.y)
  await page.evaluate(() => window.frames(2))
  const anchor = await page.evaluate(() => window.ranges.at(-1))
  await settle(page, 600)
  const target = Math.round((anchor.start + anchor.end) / 2)
  const first = await topRow(page)
  assert.ok(Math.abs(first.index - target) <= 1, `jumped near ${target}, top row is ${first.index}`)
  assert.ok(Math.abs(first.offset) < 1, `anchor row sits at the top edge, offset ${first.offset}`)
  // Scrolling up mounts and measures taller-than-estimated rows above; the row on screen keeps its place.
  const top = await rowTop(page, first.index)
  await page.mouse.move(300, 300)
  await page.mouse.wheel(0, -90)
  await settle(page, 600)
  const moved = await rowTop(page, first.index)
  assert.ok(Math.abs(moved - top - 30) < 1.5, `row moved by ${moved - top}, wheel asked for 30`)
})

test('a following list sticks to the newest row and stops following when scrolled up', async t => {
  const page = await pageFor(t, { count: 2000, follow: true })
  const listBottom = () => page.evaluate(() => window.list.getBoundingClientRect().bottom)
  const lastBottom = () => page.evaluate(() => {
    const rows = window.list.querySelectorAll('[data-index]')
    const last = rows[rows.length - 1]
    return { index: Number(last.dataset.index), bottom: last.getBoundingClientRect().bottom }
  })
  let last = await lastBottom()
  assert.equal(last.index, 1999)
  assert.ok(Math.abs(last.bottom - await listBottom()) < 1.5)

  await page.evaluate(() => window.stream(true))
  await settle(page, 450)
  last = await lastBottom()
  assert.ok(last.index > 2003, `streamed to ${last.index}`)
  assert.ok(Math.abs(last.bottom - await listBottom()) < 1.5, 'still bottom-aligned')

  await page.mouse.move(300, 300)
  await page.mouse.wheel(0, -300)
  await settle(page)
  const held = await topRow(page)
  await settle(page, 400)
  assert.deepEqual(await topRow(page), held, 'new rows no longer pull the view down')

  // Scrolling back down to the end by hand, with no key press, follows again.
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 3000)
  await settle(page, 400)
  last = await lastBottom()
  assert.ok(Math.abs(last.bottom - await listBottom()) < 1.5, 'back on the newest row')
  assert.equal(await page.evaluate(() => window.positions.at(-1).stickToBottom), true)
  await page.evaluate(() => window.stream(false))
})

test('revealing a search match centers the match inside a tall row', async t => {
  const page = await pageFor(t, { delay: 50 })
  for (let i = 0; i < 40; i++) await page.evaluate(() => window.revealMatch(1))
  await settle(page, 300)
  const geometry = await page.evaluate(() => {
    const list = window.list.getBoundingClientRect()
    const mark = window.list.querySelector('mark.match.active').getBoundingClientRect()
    return { list: { top: list.top, height: list.height }, mark: { top: mark.top } }
  })
  const offset = geometry.mark.top - geometry.list.top
  assert.ok(Math.abs(offset - (geometry.list.height - 22) / 2) < 30, `match at ${offset}px of ${geometry.list.height}`)
})

test('the user scrolling away stops the reveal from snapping back', async t => {
  const page = await pageFor(t, { delay: 50 })
  await page.evaluate(() => window.revealMatch(1))
  await settle(page, 200)
  await page.mouse.move(300, 300)
  await page.mouse.wheel(0, 1500)
  await settle(page, 200)
  const away = await topRow(page)
  // A re-render with the same reveal key (a streaming re-search) must not pull the view back.
  await page.evaluate(() => window.list.setAttribute('marks', window.list.getAttribute('marks') + ' 99999'))
  await settle(page, 200)
  assert.deepEqual(await topRow(page), away)
})

test('horizontal scrolling keeps pinned cells in place and reveals a column clear of them', async t => {
  const page = await pageFor(t, { wide: true })
  const pinnedLeft = () => page.evaluate(() => window.list.querySelector('.pinned').getBoundingClientRect().left - window.list.getBoundingClientRect().left)
  assert.equal(await shadow(page, '.bar.h', 'el.hidden'), false)
  await page.mouse.move(300, 300)
  await page.keyboard.down('Shift')
  await page.mouse.wheel(0, 900)
  await page.keyboard.up('Shift')
  await settle(page)
  const x = await shadow(page, '.viewport', `parseFloat(el.style.getPropertyValue('--virtual-scroll-x'))`)
  assert.ok(x > 0, `scrolled ${x}px`)
  assert.ok(Math.abs(await pinnedLeft()) < 1, 'pinned column stays at the left edge')

  await page.evaluate(() => window.revealMatch(1))
  await settle(page, 200)
  const reveal = await page.evaluate(() => {
    const list = window.list.getBoundingClientRect()
    const mark = window.list.querySelector('mark.match.active').getBoundingClientRect()
    return { left: mark.left - list.left, right: mark.right - list.left, width: list.width }
  })
  assert.ok(reveal.left >= 120 && reveal.right <= reveal.width - 16, JSON.stringify(reveal))
})

test('Home and End jump to either end', async t => {
  const page = await pageFor(t, { count: 5000, delay: 0 })
  await page.locator('a-virtual-scroll').focus()
  await page.keyboard.press('End')
  await settle(page)
  const rows = await page.evaluate(() => window.rendered())
  assert.equal(rows.at(-1), 4999)
  const last = await page.evaluate(() => {
    const row = window.list.querySelector('[data-index="4999"]').getBoundingClientRect()
    return Math.abs(row.bottom - window.list.getBoundingClientRect().bottom)
  })
  assert.ok(last < 1.5, `last row bottom off by ${last}`)
  await page.keyboard.press('Home')
  await settle(page)
  assert.deepEqual(await topRow(page), { index: 0, offset: 0 })
})

test('dragging the thumb scrolls and keeps the thumb inside the track', async t => {
  const page = await pageFor(t, { delay: 0 })
  const thumb = await page.evaluate(() => {
    const rect = window.list.shadowRoot.querySelector('.bar.v .thumb').getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  })
  await page.mouse.move(thumb.x, thumb.y)
  await page.mouse.down()
  await page.mouse.move(thumb.x, thumb.y + 200, { steps: 10 })
  await page.mouse.up()
  await settle(page)
  const top = await topRow(page)
  assert.ok(top.index > 30_000 && top.index < 50_000, `thumb drag landed on ${top.index}`)
  const inside = await page.evaluate(() => {
    const bar = window.list.shadowRoot.querySelector('.bar.v').getBoundingClientRect()
    const thumb = window.list.shadowRoot.querySelector('.bar.v .thumb').getBoundingClientRect()
    return thumb.top >= bar.top - 1 && thumb.bottom <= bar.bottom + 1
  })
  assert.ok(inside)
})

test('a short list sizes to its rows and has nothing to scroll', async t => {
  const page = await pageFor(t, { count: 4, delay: 0 })
  const sizes = await page.evaluate(() => {
    const rows = [...window.list.querySelectorAll('[data-index]')].reduce((sum, row) => sum + row.getBoundingClientRect().height, 0)
    return { host: window.list.getBoundingClientRect().height, rows }
  })
  assert.ok(Math.abs(sizes.host - sizes.rows) < 1, JSON.stringify(sizes))
  assert.equal(await shadow(page, '.bar.v', 'el.hidden'), true)
})

test('an empty list shows its empty slot', async t => {
  const page = await pageFor(t, { count: 0 })
  const shown = await page.evaluate(() => window.list.querySelector('[slot="empty"]').getBoundingClientRect().height)
  assert.ok(shown > 0)
})

test('positionchange reports where scrolling settled, and initial-position restores it', async t => {
  const page = await pageFor(t, { delay: 0 })
  await page.mouse.move(300, 300)
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 900)
  await settle(page, 400)
  const position = await page.evaluate(() => window.positions.at(-1))
  assert.ok(position.anchorIndex > 0)
  const before = await topRow(page)
  // A new element, as after a remount into a portal.
  await page.evaluate(position => window.mountList({
    delay: 0,
    initialPosition: `${position.anchorIndex} ${position.deltaPixels} ${position.scrollX} 0`,
  }), position)
  await settle(page, 200)
  assert.deepEqual(await topRow(page), before)
})

test('the list takes only its own keys and wheel input; everything else reaches the browser', async t => {
  const page = await pageFor(t, { delay: 0, wide: true })
  await page.evaluate(() => {
    window.seen = []
    // Read defaultPrevented after dispatch finishes, so every listener has run.
    const record = event => setTimeout(() => window.seen.push({ type: event.type, key: event.key, prevented: event.defaultPrevented }))
    window.addEventListener('keydown', record, true)
    window.addEventListener('wheel', record, { capture: true, passive: true })
  })
  await page.locator('a-virtual-scroll').focus()
  const press = async key => {
    await page.evaluate(() => { window.seen = [] })
    await page.keyboard.press(key)
    await settle(page, 30)
    return page.evaluate(() => window.seen.at(-1)?.prevented)
  }
  const top = () => topRow(page)

  assert.equal(await press('ArrowUp'), false, 'nothing to scroll up to at the start')
  assert.equal(await press('Home'), false, 'already at the start')
  assert.equal(await press('ArrowDown'), true)
  assert.equal(await press('Control+ArrowDown'), true)
  assert.equal(await press('PageDown'), true)
  assert.equal(await press('ArrowRight'), true)
  const before = await top()
  for (const key of ['Shift+ArrowDown', 'Alt+ArrowLeft', 'Meta+ArrowDown', 'Control+PageDown', 'Control+Home', 'Shift+End', 'KeyA', 'Space', 'Tab']) {
    assert.equal(await press(key), false, `${key} passes through`)
  }
  await page.locator('a-virtual-scroll').focus()
  assert.deepEqual(await top(), before, 'passed-through keys did not move the list')

  await page.evaluate(() => window.list.setAttribute('intercept-keys', 'Mod+f Alt+r'))
  assert.equal(await press('Control+f'), true, 'intercepted for the application')
  assert.equal(await press('Alt+r'), true)
  assert.deepEqual(await top(), before, 'intercepted keys do not scroll')

  await page.mouse.move(300, 300)
  await page.evaluate(() => { window.seen = [] })
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, 200)
  await page.keyboard.up('Control')
  await settle(page, 30)
  assert.equal(await page.evaluate(() => window.seen.at(-1)?.prevented), false, 'Ctrl + wheel stays browser zoom')
  assert.deepEqual(await top(), before)
})

test('a row can claim navigation keys before the list scrolls with them', async t => {
  const page = await pageFor(t, { delay: 0 })
  await page.evaluate(() => {
    const row = window.list.querySelector('[data-index="0"]')
    row.tabIndex = 0
    row.addEventListener('keydown', event => {
      if (window.claim && event.key === 'ArrowDown') event.preventDefault()
    })
    window.claim = true
    row.focus()
  })
  const start = await topRow(page)
  await page.keyboard.press('ArrowDown')
  await settle(page, 30)
  assert.deepEqual(await topRow(page), start, 'a key the row prevented does not scroll')

  await page.evaluate(() => { window.claim = false })
  await page.keyboard.press('ArrowDown')
  await settle(page, 30)
  const moved = await topRow(page)
  assert.ok(moved.index > start.index || moved.offset < start.offset, 'an unclaimed key from inside a row still scrolls')
})

test('max-height caps the list, and a short list still shrinks to its rows', async t => {
  const page = await pageFor(t, { count: 4, delay: 0, maxHeight: 300 })
  const sizes = () => page.evaluate(() => {
    const rows = [...window.list.querySelectorAll('[data-index]')].reduce((sum, row) => sum + row.getBoundingClientRect().height, 0)
    return { host: window.list.getBoundingClientRect().height, rows }
  })
  const short = await sizes()
  assert.ok(short.rows < 300 && Math.abs(short.host - short.rows) < 1, JSON.stringify(short))
  await page.evaluate(() => window.mountList({ count: 40, delay: 0, maxHeight: 160 }))
  await settle(page)
  assert.ok(Math.abs((await sizes()).host - 160) < 1, 'a long list stops at max-height')
})

test('rows share one width: the list, the widest unbreakable row, or content-width', async t => {
  const page = await pageFor(t, { count: 40, delay: 0 })
  const widths = () => page.evaluate(() => {
    const rows = [...window.list.querySelectorAll('[data-index]')].map(row => Math.round(row.getBoundingClientRect().width))
    const list = Math.round(window.list.shadowRoot.querySelector('.rows').getBoundingClientRect().width)
    return { list, min: Math.min(...rows), max: Math.max(...rows) }
  })
  const narrow = await widths()
  assert.equal(narrow.min, narrow.list, 'wrapping rows fill the list')
  assert.equal(narrow.max, narrow.list, 'wrapping rows wrap at the list width')

  await page.evaluate(() => {
    for (const [index, repeat] of [[2, 40], [5, 80]]) {
      const row = window.list.querySelector(`[data-index="${index}"]`)
      row.style.whiteSpace = 'pre'
      row.textContent = 'unbreakable '.repeat(repeat)
    }
  })
  await settle(page)
  const wide = await widths()
  assert.ok(wide.max > wide.list, JSON.stringify(wide))
  assert.equal(wide.min, wide.max, 'every row takes the widest row width')

  await page.evaluate(() => window.mountList({ count: 40, delay: 0 }))
  await settle(page)
  await page.evaluate(() => window.list.setAttribute('content-width', '2000'))
  await settle(page)
  const fixed = await widths()
  assert.deepEqual([fixed.min, fixed.max], [2000, 2000])
})

test('secondary marks draw in their own muted layer under the primary marks', async t => {
  const page = await pageFor(t, { count: 400, delay: 0 })
  await page.evaluate(() => {
    window.list.setAttribute('marks', '10')
    window.list.setAttribute('secondary-marks', '10 200 390')
  })
  await settle(page)
  const layers = await page.evaluate(() => {
    const bar = window.list.shadowRoot.querySelector('.bar.v')
    const [secondary, primary] = [...bar.querySelectorAll('.marks')]
    const color = layer => getComputedStyle(layer.querySelector('.mark')).backgroundColor
    return {
      order: [secondary.classList.contains('secondary'), primary.classList.contains('secondary')],
      counts: [secondary.children.length, primary.children.length],
      colors: [color(secondary), color(primary)],
    }
  })
  assert.deepEqual(layers.order, [true, false], 'secondary layer comes first, so primary marks paint over it')
  assert.deepEqual(layers.counts, [3, 1])
  assert.notEqual(layers.colors[0], layers.colors[1])
})

test('fixed-height rows report their full height at once and are not observed', async t => {
  const page = await pageFor(t, { count: 1_000_000, delay: 0, fixedHeight: true, wide: true })
  // The first report, sent before any row was mounted, is already complete: 1,000,000 rows at
  // 22px plus the horizontal scrollbar the wide rows need.
  assert.equal(await page.evaluate(() => window.contentSizes[0].height), 1_000_000 * 22 + 16)

  await page.locator('a-virtual-scroll').focus()
  await page.keyboard.press('End')
  await settle(page)
  const last = await page.evaluate(() => {
    const row = window.list.querySelector('[data-index="999999"]').getBoundingClientRect()
    const rows = window.list.shadowRoot.querySelector('.rows').getBoundingClientRect()
    return Math.abs(row.bottom - rows.bottom)
  })
  assert.ok(last < 1, `last row bottom off by ${last}`)

  // In a list short enough to mount every row, a row that grows would change a measured total.
  // A fixed-height list does not measure it, so the reported height stays put.
  await page.evaluate(() => window.mountList({ count: 300, delay: 0, fixedHeight: true, wide: true }))
  await settle(page)
  const settled = await page.evaluate(() => window.contentSizes.at(-1).height)
  await page.evaluate(() => { window.list.querySelector('[data-index="3"]').style.height = '200px' })
  await settle(page)
  assert.equal(await page.evaluate(() => window.contentSizes.at(-1).height), settled)
})

test('content a fraction of a pixel wider than the rows shows no horizontal scrollbar', async t => {
  const page = await pageFor(t, { count: 100, delay: 0 })
  const rowsWidth = await page.evaluate(() => window.list.shadowRoot.querySelector('.rows').getBoundingClientRect().width)
  const hidden = async width => {
    await page.evaluate(width => window.list.setAttribute('content-width', String(width)), width)
    await settle(page)
    return shadow(page, '.bar.h', 'el.hidden')
  }
  assert.equal(await hidden(rowsWidth + 0.6), true)
  assert.equal(await hidden(rowsWidth + 30), false)
  assert.equal(await hidden(rowsWidth + 0.4), true)
})

test('the thumbs stay inside their scrollbars at both ends', async t => {
  // Edges of a thumb's visible fill relative to its bar; both must be inside the bar.
  const fillWithinBar = (page, axis) => page.evaluate(axis => {
    const bar = window.list.shadowRoot.querySelector(`.bar.${axis}`).getBoundingClientRect()
    const fill = window.list.shadowRoot.querySelector(`.bar.${axis} .thumb-fill`).getBoundingClientRect()
    return axis === 'v'
      ? { start: fill.top - bar.top, end: bar.bottom - fill.bottom }
      : { start: fill.left - bar.left, end: bar.right - fill.right }
  }, axis)
  const assertInside = (edges, label) => {
    assert.ok(edges.start >= 0 && edges.end >= 0, `${label}: fill overhangs its bar ${JSON.stringify(edges)}`)
  }

  for (const count of [100_000, 300]) {
    const page = await pageFor(t, { count, delay: 0, wide: true })
    assertInside(await fillWithinBar(page, 'v'), `${count} rows, vertical, start`)
    await page.locator('a-virtual-scroll').focus()
    await page.keyboard.press('End')
    await settle(page, 300)
    assertInside(await fillWithinBar(page, 'v'), `${count} rows, vertical, end`)

    assertInside(await fillWithinBar(page, 'h'), `${count} rows, horizontal, start`)
    for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight')
    await settle(page)
    assertInside(await fillWithinBar(page, 'h'), `${count} rows, horizontal, end`)
  }
})

test('the vertical scrollbar and its column appear only while there is something to scroll', async t => {
  const page = await pageFor(t, { count: 3, delay: 0, height: 300 })
  const layout = () => page.evaluate(() => {
    const host = window.list.getBoundingClientRect()
    const rows = window.list.shadowRoot.querySelector('.rows').getBoundingClientRect()
    const bar = window.list.shadowRoot.querySelector('.bar.v')
    return { barHidden: bar.hidden, rowsRight: rows.right, hostRight: host.right, barWidth: bar.getBoundingClientRect().width }
  })

  let now = await layout()
  assert.equal(now.barHidden, true, 'nothing to scroll: no vertical scrollbar')
  assert.ok(Math.abs(now.rowsRight - now.hostRight) < 1, `rows use the full width, ${JSON.stringify(now)}`)

  // Grow past the viewport: the bar returns and takes its column back.
  await page.evaluate(() => window.list.setAttribute('count', '200'))
  await settle(page)
  now = await layout()
  assert.equal(now.barHidden, false)
  assert.ok(Math.abs(now.hostRight - now.rowsRight - 16) < 1, `rows leave the scrollbar its column, ${JSON.stringify(now)}`)

  // Shrink again: the bar goes away.
  await page.evaluate(() => window.list.setAttribute('count', '3'))
  await settle(page)
  now = await layout()
  assert.equal(now.barHidden, true)
  assert.ok(Math.abs(now.rowsRight - now.hostRight) < 1)

  // A wide list with nothing to scroll vertically: the horizontal bar runs the full width.
  await page.evaluate(() => window.mountList({ count: 3, delay: 0, height: 300, wide: true }))
  await settle(page)
  const horizontal = await page.evaluate(() => ({
    hbar: window.list.shadowRoot.querySelector('.bar.h').getBoundingClientRect().right,
    host: window.list.getBoundingClientRect().right,
    vbarHidden: window.list.shadowRoot.querySelector('.bar.v').hidden,
  }))
  assert.equal(horizontal.vbarHidden, true)
  assert.ok(Math.abs(horizontal.hbar - horizontal.host) < 1, JSON.stringify(horizontal))
})
