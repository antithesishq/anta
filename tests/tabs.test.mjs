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
    entryPoints: ['tests/tabs.fixture.tsx'],
    bundle: true,
    write: false,
    outfile: 'fixture.js',
    format: 'esm',
    target: 'es2022',
    jsx: 'automatic',
    jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('site/node_modules')],
    alias: {
      '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
      react: requireSite.resolve('preact/compat'),
    },
  })
  const assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/fixture.css' : '/fixture.js', file.text]))
  server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(assets.get(req.url) ?? '<!doctype html><link rel="stylesheet" href="/fixture.css"><div id="mount"></div><script type="module" src="/fixture.js"></script>')
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

test('Tabs uses one tab stop and TabPanel forwards common props', async t => {
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  await page.goto(origin)
  await page.waitForSelector('a-tabpanel[data-panel="account"]')

  assert.deepEqual(await page.locator('a-tab').evaluateAll(tabs => tabs.map(tab => tab.tabIndex)), [0, -1, -1])
  assert.equal(await page.locator('a-tabpanel[data-panel="account"]').evaluate(panel => panel.tabIndex), 0)

  await page.locator('a-tab[value="account"]').focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForFunction(() => document.querySelector('a-tab[value="security"]')?.tabIndex === 0)

  assert.deepEqual(await page.locator('a-tab').evaluateAll(tabs => tabs.map(tab => tab.tabIndex)), [-1, 0, -1])
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('value')), 'security')
})
