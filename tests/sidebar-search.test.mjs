import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
let browser, script

before(async () => {
  const result = await build({
    stdin: {
      contents: `
        import { h, render } from 'preact'
        import { configure } from './src/jsx-runtime'
        import SidebarSearch from './site/src/components/SidebarSearch'
        import './src/elements/a-input'
        configure(h)
        render(h(SidebarSearch), document.body)
        window.initialShortcut = document.querySelector('[data-sidebar-search-shortcut]').textContent
      `,
      resolveDir: process.cwd(),
    },
    bundle: true, write: false, outfile: 'search.js', format: 'iife', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('site/node_modules')],
    alias: {
      '@antadesign/anta': resolve('src/index.ts'),
      '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
      react: requireSite.resolve('preact/compat'),
    },
  })
  script = result.outputFiles.find(file => file.path.endsWith('.js')).text
  browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
})

after(async () => browser?.close())

test('search shortcut uses the platform modifier and survives focus and value updates', async t => {
  for (const [platform, legacy, userAgent, expected] of [
    ['macOS', 'MacIntel', '', '⌘+K or /'],
    [null, 'MacIntel', '', '⌘+K or /'],
    ['Windows', 'Win32', '', 'Ctrl+K or /'],
    ['Linux', 'Linux x86_64', '', 'Ctrl+K or /'],
    [null, 'Linux x86_64', '', 'Ctrl+K or /'],
    [null, 'iPad', '', '⌘+K or /'],
    [null, '', 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', '⌘+K or /'],
  ]) {
    const context = await browser.newContext()
    t.after(() => context.close())
    const page = await context.newPage()
    await page.evaluate(({ platform, legacy, userAgent }) => {
      Object.defineProperties(navigator, {
        userAgentData: { value: platform ? { platform } : undefined },
        platform: { value: legacy },
        userAgent: { value: userAgent },
      })
    }, { platform, legacy, userAgent })
    await page.addScriptTag({ content: script })
    assert.equal(await page.evaluate(() => initialShortcut), '/', 'No guessed Ctrl label before platform detection')
    const hint = page.locator('[data-sidebar-search-shortcut]')
    await page.waitForFunction(expected => document.querySelector('[data-sidebar-search-shortcut]')?.textContent === expected, expected)
    await page.locator('a-input').evaluate(input => input.focus())
    await page.waitForFunction(() => !document.querySelector('[data-sidebar-search-shortcut]'))
    await page.evaluate(() => document.activeElement.blur())
    await hint.waitFor({ state: 'attached' })
    assert.equal(await hint.textContent(), expected)
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('anta-sidebar-search-value', { detail: 'query' })))
    await page.waitForFunction(() => !document.querySelector('[data-sidebar-search-shortcut]'))
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('anta-sidebar-search-value', { detail: '' })))
    await hint.waitFor({ state: 'attached' })
    assert.equal(await hint.textContent(), expected)
  }
})
