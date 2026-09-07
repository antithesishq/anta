import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
const dist = new URL('../site/dist/', import.meta.url)

// Run after the site build: Astro's Expressive Code integration trims engines
// from the production bundle, which the isolated esbuild tests do not exercise.
test('production search answers use Expressive Code highlighting and working copy buttons', async t => {
  const browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
  t.after(() => browser.close())
  const page = await browser.newPage()
  page.setDefaultTimeout(10_000)
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error' && message.text().includes('[expressive-code]')) errors.push(message.text())
  })
  await page.route('https://anta.test/**', async route => {
    const path = new URL(route.request().url()).pathname
    const file = new URL(`.${path}${path.endsWith('/') ? 'index.html' : ''}`, dist)
    if (!file.href.startsWith(dist.href)) return route.abort()
    await route.fulfill({ path: fileURLToPath(file) })
  })
  const snippets = ['<Tag label="Design" />', '.label { color: var(--text-1); }', 'Plain code']
  const answer = snippets.map((code, index) => `\`\`\`${['tsx', 'css', ''][index]}\n${code}\n\`\`\``).join('\n\n')
  await page.route('**/api/search-answer/', route => route.fulfill({
    contentType: 'text/event-stream',
    body: `event: delta\ndata: ${JSON.stringify({ text: answer })}\n\nevent: done\ndata: {}\n\n`,
  }))
  await page.goto('https://anta.test/')
  await page.locator('astro-island[component-export="default"]:not([ssr]) a-dialog').waitFor({ state: 'attached' })
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', { value: async text => { window.copiedCode = text } })
    document.dispatchEvent(new Event('anta-search-open'))
  })
  const input = page.locator('#docs-search-input input')
  await input.fill('zxqvproductionhighlightcheck')
  await page.getByRole('button', { name: 'Try AI search' }).waitFor()
  await input.press('Enter')
  const region = page.getByRole('region', { name: 'AI answer' })
  await region.locator('.expressive-code .copy button').nth(2).waitFor()
  assert.deepEqual(errors, [])
  assert.equal(await page.locator('a-dialog').getAttribute('state'), 'open')
  const blocks = region.locator('.expressive-code')
  assert.equal(await blocks.count(), snippets.length)
  for (let index = 0; index < snippets.length; index++) {
    const block = blocks.nth(index)
    assert.equal(await block.locator('pre code').textContent(), snippets[index])
    if (index < 2) assert.ok(await block.locator('pre code span[style]').count())
    const copy = block.locator('.copy button')
    await copy.click()
    await page.waitForFunction(code => window.copiedCode === code, snippets[index])
    assert.equal(await copy.getAttribute('data-anta-copied'), 'true')
  }
  const token = blocks.first().locator('pre code span[style]').first()
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  const lightColor = await token.evaluate(element => getComputedStyle(element).color)
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  assert.notEqual(await token.evaluate(element => getComputedStyle(element).color), lightColor)
})
