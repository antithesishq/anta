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
  await page.getByRole('button', { name: 'Get answer from AI' }).waitFor()
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

test('production search reveals folded theme content and prioritizes the current page', async t => {
  const browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
  t.after(() => browser.close())
  const page = await browser.newPage()
  page.setDefaultTimeout(10_000)
  await page.route('https://anta.test/**', async route => {
    const path = new URL(route.request().url()).pathname
    const file = new URL(`.${path}${path.endsWith('/') ? 'index.html' : ''}`, dist)
    if (!file.href.startsWith(dist.href)) return route.abort()
    await route.fulfill({ path: fileURLToPath(file) })
  })
  await page.goto('https://anta.test/theming/', { waitUntil: 'domcontentloaded' })
  const section = id => page.locator('details').filter({ has: page.locator(`#${id}`) })
  assert.equal(await section('fonts-in-a-theme').getAttribute('open'), null)
  assert.equal(await section('theming-lab').getAttribute('open'), null)
  const targets = await page.evaluate(() => [
    document.querySelector('#fonts-in-a-theme').closest('details').querySelector('p'),
    document.querySelector('[data-theming-tone="brand"] pre'),
  ].map(element => ({
    id: element.dataset.searchId, anchor: element.id,
    query: element.tagName === 'PRE' ? 'oklch' : 'font',
  })))

  const assertRevealed = async target => {
    await page.locator(`[data-search-id="${target.id}"] mark.search-highlight`).first().waitFor({ state: 'visible' })
    assert.equal(await page.locator(`[data-search-id="${target.id}"]`).evaluate(element => {
      for (let parent = element; parent; parent = parent.parentElement) {
        if (parent.hidden || (parent.matches('details') && !parent.open)) return false
        if (parent.matches('a-expander') && parent.shadowRoot.querySelector('button[part="summary"]').getAttribute('aria-expanded') !== 'true') return false
      }
      return true
    }), true)
  }
  const href = target => `/theming/?search=${target.id}&q=${target.query}#${target.anchor}`
  for (const target of targets) {
    await page.goto(`https://anta.test${href(target)}`, { waitUntil: 'domcontentloaded' })
    await assertRevealed(target)
  }

  const search = async query => {
    await page.locator('astro-island:not([ssr]) a-dialog').waitFor({ state: 'attached' })
    // Preact's passive effects attach the dialog's open listener after hydration.
    await page.waitForTimeout(200)
    await page.evaluate(() => document.dispatchEvent(new Event('anta-search-open')))
    await page.locator('#docs-search-input input').fill(query)
    await page.locator('#docs-search-results a').first().waitFor()
  }
  await page.goto('https://anta.test/theming/', { waitUntil: 'domcontentloaded' })
  await search('font')
  assert.ok((await page.locator('#docs-search-results a').first().getAttribute('href')).startsWith('/theming/'))
  await page.locator('#docs-search-results a').filter({ hasText: 'Fonts in a theme' }).first().click()
  await page.locator('#fonts-in-a-theme mark').waitFor({ state: 'visible' })
  assert.notEqual(await section('fonts-in-a-theme').getAttribute('open'), null)

  // An ordinary link exercises ClientRouter and the persisted sidebar/dialog.
  const navigate = async href => {
    await page.evaluate(href => {
      window.searchNavigationSentinel = true
      const link = document.createElement('a')
      link.href = href
      document.body.append(link)
      link.click()
    }, href)
    await page.waitForURL(`https://anta.test${href}`)
    assert.equal(await page.evaluate(() => window.searchNavigationSentinel), true)
  }
  await navigate('/button/')
  await search('button')
  assert.ok((await page.locator('#docs-search-results a').first().getAttribute('href')).startsWith('/button/'))
  await page.keyboard.press('Escape')
  await navigate(href(targets[1]))
  await assertRevealed(targets[1])
})
