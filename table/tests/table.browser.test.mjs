import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { serve } from './demo.mjs'

// TABLE_PLAYWRIGHT, TABLE_BROWSER_PATH, and TABLE_BROWSER_ARGS let the suite run outside a pnpm
// install, e.g. in a Nix sandbox.
const requireSite = createRequire(new URL('../../site/package.json', import.meta.url))
const { chromium } = requireSite(process.env.TABLE_PLAYWRIGHT ?? 'playwright')
let browser, server, origin

before(async () => {
  server = await serve(0)
  origin = `http://127.0.0.1:${server.address().port}/?blank`
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.TABLE_BROWSER_PATH || undefined,
    channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined,
    args: process.env.TABLE_BROWSER_ARGS?.split(' ').filter(Boolean),
  })
})

after(async () => {
  await browser?.close()
  if (server) await new Promise(resolve => server.close(resolve))
})

async function pageFor(t, options) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } })
  t.after(() => page.close())
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, []))
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.mountTable === 'function')
  await page.evaluate(options => window.mountTable(options), options)
  await page.waitForTimeout(300)
  return page
}

const frameHeight = page => page.evaluate(() => Math.round(document.querySelector('a-table-frame').getBoundingClientRect().height))

function cellRect(page, column, header = false) {
  return page.evaluate(({ column, header }) => {
    const selector = header ? `a-table-header-cell[column="${column}"]` : `a-table-row a-table-cell[column="${column}"]`
    const { left, right } = document.querySelector(selector).getBoundingClientRect()
    return { left, right }
  }, { column, header })
}

const frameRect = page => page.evaluate(() => {
  const { left, right } = document.querySelector('a-table-frame').getBoundingClientRect()
  return { left, right }
})

async function scrollSideways(page, dx) {
  await page.mouse.move(500, 250)
  await page.mouse.wheel(dx, 0)
  await page.waitForTimeout(300)
}

for (const mode of ['virtual', 'plain']) {
  test(`${mode}: pinned columns stay at their edges while the rows scroll sideways`, async t => {
    const page = await pageFor(t, { mode, count: mode === 'virtual' ? 10_000 : 200, pins: true, wide: true, props: { height: 400 } })
    // Outside macOS the virtual list scrolls a third of a pixel wheel delta.
    await scrollSideways(page, 1200)
    const frame = await frameRect(page)
    assert.ok(Math.abs((await cellRect(page, 'id')).left - (frame.left + 1)) <= 1, 'left pin at the left edge')
    assert.ok((await cellRect(page, 'ok')).right <= frame.right, 'right pin inside the frame')
    assert.ok(frame.right - (await cellRect(page, 'ok')).right <= 20, 'right pin at the right edge, before the scrollbar')
    assert.ok(Math.abs((await cellRect(page, 'ok', true)).right - (await cellRect(page, 'ok')).right) <= 1, 'header follows its column')
    assert.ok((await cellRect(page, 'group')).left < frame.left, 'unpinned columns scrolled')
  })

  test(`${mode}: search reveals and steps through matches`, async t => {
    const page = await pageFor(t, { mode, count: mode === 'virtual' ? 10_000 : 300, props: { height: 300 }, container: { marginTop: '600px' } })
    await page.locator('a-input[data-table-search]').click()
    await page.keyboard.type('owner-12')
    await page.waitForTimeout(300)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    const result = await page.evaluate(() => {
      const mark = document.querySelector('mark[data-search-active]')
      const frame = document.querySelector('a-table-frame').getBoundingClientRect()
      const box = mark?.getBoundingClientRect()
      return {
        count: document.querySelector('a-table-search output')?.textContent,
        row: mark?.closest('a-table-row')?.querySelector('a-table-cell')?.textContent,
        inView: !!box && box.top >= frame.top && box.bottom <= frame.bottom,
        pageScroll: window.scrollY,
      }
    })
    assert.match(result.count ?? '', /^3\//)
    assert.equal(result.row, 'row-00038')
    assert.ok(result.inView)
    assert.equal(result.pageScroll, 0, 'only the table scrolled')
  })

  test(`${mode}: an initial search reveals its first match on mount`, async t => {
    const page = await pageFor(t, { mode, count: mode === 'virtual' ? 10_000 : 300, props: { height: 300, defaultSearch: 'owner-12' } })
    await page.waitForTimeout(400)
    const inView = await page.evaluate(() => {
      const mark = document.querySelector('mark[data-search-active]')
      const frame = document.querySelector('a-table-frame').getBoundingClientRect()
      const box = mark?.getBoundingClientRect()
      return !!box && box.top >= frame.top + 34 && box.bottom <= frame.bottom
    })
    assert.ok(inView)
  })

  test(`${mode}: few rows fit their measured height, and searching does not resize the frame`, async t => {
    const few = await pageFor(t, { mode, count: 3 })
    const fit = await few.evaluate(() => {
      const rows = [...document.querySelectorAll('a-table-row')]
      const frame = document.querySelector('a-table-frame').getBoundingClientRect()
      return rows.length === 3 && rows.at(-1).getBoundingClientRect().bottom <= frame.bottom + 0.5
    })
    assert.ok(fit, 'every row is in view')

    const page = await pageFor(t, { mode, count: 1000 })
    const before = await frameHeight(page)
    await page.locator('a-input[data-table-search]').click()
    await page.keyboard.type('row-00')
    await page.waitForTimeout(400)
    assert.equal(await frameHeight(page), before)
  })

  test(`${mode}: the frame fills a container with a definite height`, async t => {
    const page = await pageFor(t, { mode, count: 1000, container: { display: 'flex', flexDirection: 'column', height: '700px' } })
    await page.waitForFunction(() => document.querySelector('a-table-frame').getBoundingClientRect().height > 550, null, { timeout: 3000 }).catch(() => {})
    const { surface, frame } = await page.evaluate(() => ({
      surface: document.querySelector('a-table').getBoundingClientRect().height,
      frame: document.querySelector('a-table-frame').getBoundingClientRect().height,
    }))
    assert.equal(Math.round(surface), 700)
    assert.ok(frame > 550, `frame ${frame}`)
  })

  test(`${mode}: the frame stops at its rows in a taller container`, async t => {
    const page = await pageFor(t, { mode, count: 12, container: { display: 'flex', flexDirection: 'column', height: '1200px' } })
    await page.waitForTimeout(300)
    const gap = await page.evaluate(() => {
      const frame = document.querySelector('a-table-frame').getBoundingClientRect()
      // A virtualizer's rows are not in display order in the DOM.
      return frame.bottom - Math.max(...[...document.querySelectorAll('a-table-row')].map(row => row.getBoundingClientRect().bottom))
    })
    assert.ok(gap >= 0 && gap <= 20, `gap ${gap}`)
  })

  test(`${mode}: columns share the frame's width and follow it when it resizes`, async t => {
    const page = await pageFor(t, { mode, count: 50, props: { height: 300, columns: { id: { width: 120 }, group: {}, note: { minWidth: 200 } } } })
    const columns = () => page.evaluate(() => {
      const frame = document.querySelector('a-table-frame').getBoundingClientRect()
      const heads = [...document.querySelectorAll('a-table-header-cell')].map(cell => cell.getBoundingClientRect())
      const cells = [...document.querySelector('a-table-row').children].map(cell => cell.getBoundingClientRect())
      return {
        aligned: heads.every((head, i) => Math.abs(head.left - cells[i].left) <= 0.5 && Math.abs(head.width - cells[i].width) <= 0.5),
        id: Math.round(cells[0].width),
        // Room left of the vertical scrollbar after the last column.
        slack: frame.right - cells.at(-1).right,
      }
    })
    const wide = await columns()
    await page.setViewportSize({ width: 800, height: 800 })
    await page.waitForTimeout(300)
    const narrow = await columns()
    for (const layout of [wide, narrow]) {
      assert.ok(layout.aligned, 'header cells line up with row cells')
      assert.equal(layout.id, 120, 'a fixed column keeps its width')
      assert.ok(layout.slack >= 0 && layout.slack <= 20, `slack ${layout.slack}`)
    }
  })

  test(`${mode}: follow keeps the newest row in view until the reader scrolls up`, async t => {
    const page = await pageFor(t, { mode, count: 100, stream: true, props: { follow: true, height: 300 } })
    const lastVisible = () => page.evaluate(() => {
      const frame = document.querySelector('a-table-frame').getBoundingClientRect()
      const visible = [...document.querySelectorAll('a-table-row')].filter(row => {
        const box = row.getBoundingClientRect()
        return box.bottom > frame.top + 36 && box.top < frame.bottom
      })
      return {
        last: Number(visible.at(-1)?.querySelector('a-table-cell')?.textContent.slice(4)),
        count: Number(document.querySelector('a-table-footer').textContent.replace(/\D/g, '')),
      }
    })
    const following = await lastVisible()
    assert.ok(following.count - following.last <= 2, JSON.stringify(following))
    await page.mouse.move(500, 250)
    await page.mouse.wheel(0, -200)
    await page.waitForTimeout(200)
    const held = (await lastVisible()).last
    await page.waitForTimeout(500)
    const later = await lastVisible()
    assert.ok(later.count > following.count + 5, 'rows kept arriving')
    assert.equal(later.last, held, 'the view held still')
  })
}

test('sorting cycles a column and Shift + click selects a range of displayed rows', async t => {
  const page = await pageFor(t, { mode: 'virtual', count: 1000, selectable: true })
  const sortButton = page.locator('a-table-header-cell[column="score"] a-button')
  await sortButton.click()
  await sortButton.click()
  await page.waitForTimeout(200)
  assert.equal(await page.locator('a-table-header-cell[column="score"]').getAttribute('aria-sort'), 'descending')
  const scores = await page.evaluate(() => [...document.querySelectorAll('a-table-row a-table-cell[column="score"]')].slice(0, 3).map(cell => Number(cell.textContent)))
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a))
  await page.locator('a-table-row').nth(0).click()
  await page.locator('a-table-row').nth(2).click({ modifiers: ['Shift'] })
  await page.waitForTimeout(200)
  const selected = await page.evaluate(() => window.selected())
  assert.equal(selected.length, 3)
  assert.equal(await page.locator('a-table-row[selected]').count(), 3)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  assert.deepEqual(await page.evaluate(() => window.selected()), [])
})

test('Mod + F in the rows focuses the search field', async t => {
  const page = await pageFor(t, { mode: 'virtual', count: 300, props: { height: 300 } })
  await page.mouse.click(300, 250)
  await page.keyboard.press('Control+f')
  await page.waitForTimeout(200)
  assert.ok(await page.evaluate(() => document.querySelector('[data-table-search]').matches(':focus-within')))
})

test('a narrow table folds the search field into the actions menu, and Mod + F opens it there', async t => {
  const page = await pageFor(t, { mode: 'virtual', count: 300, props: { height: 300 }, container: { width: '400px' } })
  const place = () => page.evaluate(() => {
    const search = document.querySelector('[data-table-search]')
    const toolbar = document.querySelector('a-table-toolbar')
    return {
      inMenu: !!search?.closest('a-menu'),
      focused: !!search?.matches(':focus-within'),
      overflow: toolbar.scrollWidth - toolbar.clientWidth,
    }
  })
  await page.waitForFunction(() => !!document.querySelector('[data-table-search]')?.closest('a-menu'))
  assert.equal((await place()).overflow, 0, 'the toolbar fits')
  await page.mouse.click(200, 250)
  await page.keyboard.press('Control+f')
  await page.waitForTimeout(300)
  assert.deepEqual(await place(), { inMenu: true, focused: true, overflow: 0 })
  await page.keyboard.type('owner-12')
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  assert.match(await page.locator('a-table-search output').textContent(), /^3\//, 'Enter steps matches with the menu open')
  assert.ok((await place()).focused, 'the menu stayed open')
})

test('the text filter narrows the rows and the row count', async t => {
  const page = await pageFor(t, { mode: 'plain', count: 200, props: { height: 300 } })
  await page.locator('a-input[data-table-filter]').click()
  await page.keyboard.type('row-0000')
  await page.waitForTimeout(300)
  assert.equal(await page.locator('a-table-footer').textContent(), '10 rows')
})
