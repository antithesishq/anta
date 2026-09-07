import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
const dist = new URL('../site/dist/', import.meta.url)

// Run after the site build to exercise CSS isolation and Astro's Code renderer.
test('theme tabs pair the package CSS with an isolated, responsive component canvas', async t => {
  const browser = await chromium.launch({ channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
  t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(10_000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://anta.test/**', async route => {
    const path = new URL(route.request().url()).pathname
    const file = new URL(`.${path}${path.endsWith('/') ? 'index.html' : ''}`, dist)
    if (!file.href.startsWith(dist.href)) return route.abort()
    await route.fulfill({ path: fileURLToPath(file) })
  })
  await page.goto('https://anta.test/theming/', { waitUntil: 'domcontentloaded' })
  const section = page.locator('details').filter({ has: page.locator('#themes') })
  assert.equal(await section.getAttribute('open'), null)
  await section.locator(':scope > summary').click()
  const gallery = page.locator('[data-themes]')
  await gallery.scrollIntoViewIfNeeded()
  const canvas = page.frameLocator('[data-theme-canvas]')
  await canvas.locator('astro-island:not([ssr])').waitFor({ state: 'attached' })
  const pageTheme = await page.locator('#palette-link').getAttribute('href')
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark)
    for (const theme of ['none', 'antune', 'antithesis']) {
      await gallery.locator(`[data-theme-tabs] a-tab[value="${theme}"]`).click()
      const href = `/themes/${theme === 'none' ? 'default' : theme}.css`
      await canvas.locator('body').evaluate(({ ownerDocument }, href) => new Promise(resolve => {
        const link = ownerDocument.querySelector('#preview-theme')
        const check = () => {
          if (link.getAttribute('href') === href && link.sheet) { clearInterval(timer); resolve() }
        }
        const timer = setInterval(check, 20)
        check()
      }), href)
      assert.equal(await canvas.locator('html').evaluate(el => el.classList.contains('dark')), dark)
      assert.equal(await page.locator('#palette-link').getAttribute('href'), pageTheme)
      const source = gallery.locator(`[data-theme-source="${theme}"]`)
      assert.equal(await source.isVisible(), true)
      assert.ok(await source.locator('code span[style]').count())
      if (theme !== 'none') {
        const css = await readFile(new URL(`../src/theme-${theme}.css`, import.meta.url), 'utf8')
        const rendered = await source.locator('.ec-line .code').evaluateAll(lines => lines.map(line => line.textContent.replace(/\n$/, '')).join('\n'))
        assert.equal(rendered.trim(), css.trim())
      }
      const appearance = await canvas.locator('body').evaluate(el => ({
        seed: getComputedStyle(el).getPropertyValue('--anta-seed-brand').trim(),
        button: getComputedStyle(el.querySelector('a-button[tone="brand"]')).borderRadius,
        input: getComputedStyle(el.querySelector('a-input').shadowRoot.querySelector('[part="field"]')).borderRadius,
        tag: getComputedStyle(el.querySelector('a-tag')).borderRadius,
      }))
      assert.deepEqual(appearance, theme === 'antithesis'
        ? { seed: '#cc4636', button: '999px', input: '0px', tag: '1px' }
        : { seed: '#5f4bc3', button: '4px', input: '4px', tag: '22px' })
    }
  }
  for (const width of [1280, 1024, 800, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.equal(await gallery.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.clientWidth <= 960), true)
    assert.equal(await canvas.locator('body').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await canvas.getByText('Open dialog', { exact: true }).click()
  await canvas.locator('a-dialog dialog[open]').waitFor({ state: 'visible' })
  await canvas.getByText('Let’s go', { exact: true }).click()
  await canvas.locator('a-dialog dialog[open]').waitFor({ state: 'hidden' })
  await canvas.getByText('Show toast', { exact: true }).click()
  await canvas.getByText('Your project was saved.', { exact: true }).waitFor({ state: 'visible' })

  // Search links must reveal a CSS source even when another tab was selected.
  const target = await gallery.locator('[data-theme-source="antithesis"] pre').evaluate(el => ({ id: el.dataset.searchId, anchor: el.id }))
  await page.goto(`https://anta.test/theming/?search=${target.id}&q=cc4636#${target.anchor}`, { waitUntil: 'domcontentloaded' })
  await gallery.locator('[data-theme-source="antithesis"] mark').first().waitFor({ state: 'visible' })
  assert.equal(await gallery.getAttribute('data-theme'), 'antithesis')
  assert.deepEqual(errors, [])
})
