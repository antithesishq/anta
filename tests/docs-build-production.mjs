import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
const dist = new URL('../site/dist/', import.meta.url)

async function productionPage(t) {
  const browser = await chromium.launch({
    headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined,
  })
  t.after(() => browser.close())
  const page = await browser.newPage()
  page.setDefaultTimeout(20_000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://anta.test/**', async route => {
    const path = new URL(route.request().url()).pathname
    const file = new URL(`.${path}${path.endsWith('/') ? 'index.html' : ''}`, dist)
    if (!file.href.startsWith(dist.href)) return route.abort()
    await route.fulfill({ path: fileURLToPath(file) })
  })
  return { page, errors }
}

test('native MDX preserves table alignment and the compiled playground after navigation', async t => {
  const { page, errors } = await productionPage(t)
  await page.goto('https://anta.test/title/')
  // Native Markdown emits alignment styles that must survive optimization
  // and override the table defaults in Anta's reset CSS.
  const cells = page.locator('main :is(th, td)[style*="text-align"]')
  assert.ok(await cells.count() > 0)
  for (const cell of await cells.all()) {
    assert.equal(await cell.evaluate(element => getComputedStyle(element).textAlign), 'right')
  }

  await page.evaluate(() => {
    window.buildNavigationSentinel = true
    const link = document.createElement('a')
    link.href = '/button/'
    document.body.append(link)
    link.click()
  })
  await page.waitForURL('https://anta.test/button/')
  assert.equal(await page.evaluate(() => window.buildNavigationSentinel), true)
  await page.locator('summary').filter({ hasText: 'Playground' }).first().click()
  await page.getByRole('tab', { name: 'Code', exact: true }).first().click()
  await page.locator('.monaco-editor .view-lines').first().click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(
    'import { Button } from "@antadesign/anta"\n' +
    'function Demo() { return <Button label="Updated production preview" /> }',
  )
  await page.frameLocator('iframe').first().getByRole('button', {
    name: 'Updated production preview', exact: true,
  }).waitFor()
  assert.deepEqual(errors, [])
})

test('native MDX preserves authored JSX tables, inline children, and contrast ratios', async t => {
  const { page, errors } = await productionPage(t)
  await page.goto('https://anta.test/table/')
  const tables = page.locator('main table')
  assert.equal(await tables.count(), 3)
  assert.equal(await page.locator('main table tr').count(), 12)
  assert.deepEqual(await page.locator('main table tbody tr > td:first-child').allTextContents(), [
    '--text-1', '--text-3', '--border-5',
    '--text-1', '--text-3', '--border-5',
    '--text-1-brand', '--text-3', '--text-1',
  ])
  assert.equal(await page.locator('main .table-wrap > table').count(), 0,
    'Authored JSX tables retain their existing layout without Markdown wrappers')
  assert.equal(await tables.nth(1).evaluate(table => getComputedStyle(table).borderCollapse), 'separate')
  assert.equal(await page.locator('main caption').textContent(), 'Color tokens used by the docs sidebar')

  await page.goto('https://anta.test/title/')
  const title = page.locator('a-title').filter({ hasText: 'Saved items' })
  assert.equal(await title.count(), 1)
  assert.equal(await title.locator('p').count(), 0)
  assert.match(await title.innerText(), /Saved items\s+\(3\)/)

  await page.goto('https://anta.test/accessibility/')
  const paragraph = page.locator('main p').filter({ hasText: 'Neutral text-4 meets' })
  assert.equal(await paragraph.count(), 1)
  assert.match(await paragraph.innerText(), /4\.5:1.*4\.41:1.*4\.25:1/)
  assert.deepEqual(errors, [])
})
