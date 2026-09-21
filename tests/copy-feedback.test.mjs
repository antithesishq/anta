import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
let browser, assets

before(async () => {
  const result = await build({
    stdin: {
      contents: `import './src/tokens.css'; import './src/elements/a-button'; import './src/elements/a-copy'`,
      resolveDir: resolve('.'),
    },
    bundle: true,
    write: false,
    outfile: 'copy-feedback.js',
    format: 'esm',
    target: 'es2022',
  })
  assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/copy-feedback.css' : '/copy-feedback.js', file.text]))
  browser = await chromium.launch({
    headless: true,
    channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined,
  })
})

after(async () => browser?.close())

async function pageFor(t) {
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } })
  t.after(() => page.close())
  await page.route('http://copy-feedback.test/**', route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({
      contentType: path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : 'text/html',
      body: assets.get(path) ?? `<!doctype html>
        <link rel="stylesheet" href="/copy-feedback.css">
        <style>
          body { margin: 0; }
          a-button { position: fixed; left: 40px; }
          #top { top: 0; }
          #middle { top: 180px; }
        </style>
        <a-button id="top"><a-button-label>Copy</a-button-label><a-copy toast></a-copy></a-button>
        <a-button id="middle"><a-button-label>Copy</a-button-label><a-copy toast></a-copy></a-button>
        <script type="module" src="/copy-feedback.js"></script>`,
    })
  })
  await page.goto('http://copy-feedback.test/')
  await page.waitForFunction(() => customElements.get('a-copy'))
  return page
}

test('Copy feedback flips below the pointer only when its upward path crosses the viewport', async t => {
  const page = await pageFor(t)
  const result = await page.evaluate(() => {
    const show = id => {
      const host = document.querySelector(`#${id}`)
      const hostRect = host.getBoundingClientRect()
      host.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: hostRect.left + 8,
        clientY: hostRect.top + 8,
      }))
      const copy = host.querySelector('a-copy')
      copy.dispatchEvent(new CustomEvent('copydone', { detail: { ok: true } }))
      const feedback = copy.shadowRoot.querySelector('.feedback')
      return {
        below: feedback.getAttribute('data-placement') === 'below',
        top: feedback.getBoundingClientRect().top,
      }
    }
    return { top: show('top'), middle: show('middle') }
  })

  assert.equal(result.top.below, true)
  assert.ok(result.top.top >= 0)
  assert.equal(result.middle.below, false)
  assert.ok(result.middle.top >= 0)
})
