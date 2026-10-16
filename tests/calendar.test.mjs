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
    entryPoints: ['tests/calendar.fixture.tsx'], bundle: true, write: false,
    outfile: 'calendar.js', format: 'esm', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('site/node_modules')],
    alias: {
      '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
      react: requireSite.resolve('preact/compat'),
    },
  })
  const assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/calendar.css' : '/calendar.js', file.text]))
  server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(assets.get(req.url) ?? `<!doctype html><link rel="stylesheet" href="/calendar.css">
      <style>body{margin:20px}</style>
      <div id="mount"></div><script type="module" src="/calendar.js"></script>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
})

after(async () => {
  await browser?.close()
  if (server) await new Promise(resolve => server.close(resolve))
})

async function pageFor(t, props) {
  const page = await browser.newPage()
  t.after(() => page.close())
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.renderCalendar === 'function')
  await page.evaluate(props => window.renderCalendar(props), props)
  return page
}

const yearLabels = page => page.locator('.anta-calendar > [data-part="header"] > a-menu > a-menu-item').evaluateAll(nodes => nodes.map(node => node.querySelector('a-menu-item-label')?.textContent))
const years = center => Array.from({ length: 7 }, (_, i) => String(center - 3 + i))

test('defaultValue centers the year menu on distant past and future dates', async t => {
  for (const year of [1960, 2060]) {
    const page = await pageFor(t, { defaultValue: `${year}-02-12` })
    assert.deepEqual(await yearLabels(page), years(year))
    assert.equal(await page.locator(`a-menu-item:has(> a-menu-item-label:text-is("${year}"))`).getAttribute('selected'), '')
  }
})

test('controlled updates and navigation update menu years and highlights', async t => {
  const page = await pageFor(t, { value: '2060-12-12' })
  assert.deepEqual(await yearLabels(page), years(2060))
  await page.locator('[aria-label="Next month"]').click()
  assert.deepEqual(await yearLabels(page), years(2061))
  await page.evaluate(() => window.renderCalendar({ value: '2090-02-12' }))
  await page.waitForFunction(() => document.querySelector('[data-part="heading"]').textContent.includes('2090'))
  assert.deepEqual(await yearLabels(page), years(2090))
  assert.equal(await page.locator('a-menu-item:has(> a-menu-item-label:text-is("2090"))').getAttribute('selected'), '')
})

test('explicit bounds constrain year menus, including one-sided distant ranges', async t => {
  for (const [props, expected] of [
    [{ defaultValue: '2060-02-12', min: '2059-01-01', max: '2061-12-31' }, ['2059', '2060', '2061']],
    [{ min: '2060-01-01' }, ['2060', '2061', '2062', '2063']],
    [{ max: '1960-12-31' }, ['1957', '1958', '1959', '1960']],
  ]) {
    const page = await pageFor(t, props)
    assert.deepEqual(await yearLabels(page), expected)
  }
})
