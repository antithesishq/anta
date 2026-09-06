import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { after, before, test } from 'node:test'
import { transform } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
let browser, script

before(async () => {
  const source = await readFile(new URL('../site/src/components/Disclosure.astro', import.meta.url), 'utf8')
  script = (await transform(source.match(/<script>([\s\S]*?)<\/script>/)[1], { loader: 'ts' })).code
  browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
})

after(async () => { await browser?.close() })

async function pageFor(t, hash = '') {
  const page = await browser.newPage()
  t.after(() => page.close())
  await page.route('http://docs.test/**', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html>
      <details id="outer" class="disclosure">
        <summary>Component props</summary>
        <details id="inner" class="disclosure">
          <summary><h3 id="payload"><a class="header-anchor" href="#payload">Payload</a></h3></summary>
          <p id="field">Geometry fields</p>
        </details>
      </details>
      <details id="sibling" class="disclosure"><summary>Other section</summary>Other fields</details>`,
  }))
  await page.goto(`http://docs.test/capture/${hash}`)
  await page.addScriptTag({ content: script })
  return page
}

async function assertExpanded(page) {
  assert.deepEqual(await page.locator('details').evaluateAll(nodes => nodes.map(node => node.open)), [true, true, false])
  await page.waitForFunction(() => !document.querySelector('.no-anim'))
}

test('initial deep links open every enclosing disclosure, including content targets', async t => {
  for (const hash of ['#payload', '#field']) {
    const page = await pageFor(t, hash)
    await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')))
    await assertExpanded(page)
  }
})

test('hash and TOC navigation reopen collapsed ancestors after a page swap', async t => {
  const page = await pageFor(t)
  await page.evaluate(() => { location.hash = 'payload' })
  await page.waitForFunction(() => document.querySelector('#outer').open)
  await assertExpanded(page)
  // ClientRouter replaces page content without rerunning the disclosure module.
  await page.evaluate(() => {
    document.body.innerHTML = document.body.innerHTML
    document.querySelectorAll('details').forEach(node => { node.open = false })
    document.dispatchEvent(new CustomEvent('anta-tocnavigate', { detail: { id: 'payload' } }))
  })
  await assertExpanded(page)
  await page.locator('#outer > summary').click()
  assert.equal(await page.locator('#outer').evaluate(node => node.open), false)
})

test('heading links expand the nested section without toggling it closed', async t => {
  const page = await pageFor(t)
  await page.locator('#outer > summary').click()
  await page.locator('a.header-anchor').click()
  await assertExpanded(page)
  assert.equal(new URL(page.url()).hash, '#payload')
  await page.locator('a.header-anchor').click()
  await assertExpanded(page)
})
