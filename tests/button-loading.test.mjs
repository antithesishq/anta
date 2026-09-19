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
      contents: `import './src/tokens.css'; import './src/elements/a-button'`,
      resolveDir: resolve('.'),
    },
    bundle: true,
    write: false,
    outfile: 'button-loading.js',
    format: 'esm',
    target: 'es2022',
  })
  assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/button-loading.css' : '/button-loading.js', file.text]))
  browser = await chromium.launch({
    headless: true,
    channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined,
  })
})

after(async () => browser?.close())

async function pageFor(t) {
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } })
  t.after(() => page.close())
  await page.route('http://button.test/**', route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({
      contentType: path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : 'text/html',
      body: assets.get(path) ?? `<!doctype html>
        <link rel="stylesheet" href="/button-loading.css">
        <style>
          body { padding: 40px; }
          a-button { margin: 12px; }
          #narrow { width: 96px; }
          #wide { width: 280px; }
        </style>
        <a-button id="narrow" loading round><a-button-label>Loading</a-button-label></a-button>
        <a-button id="wide" loading><a-button-label>Loading a wider action</a-button-label></a-button>
        <script type="module" src="/button-loading.js"></script>`,
    })
  })
  await page.goto('http://button.test/')
  await page.waitForFunction(() => customElements.get('a-button'))
  return page
}

test('Button loading waves translate one period inside a fixed local clip', async t => {
  const page = await pageFor(t)
  const result = await page.evaluate(async () => {
    const sample = async (button, time) => {
      const animation = button.getAnimations({ subtree: true }).find(item => item.animationName === 'btn-loading-slide')
      animation.pause()
      animation.currentTime = time
      await new Promise(requestAnimationFrame)
      const style = getComputedStyle(button, '::before')
      const transformX = style.transform === 'none' ? 0 : new DOMMatrix(style.transform).m41
      const inset = style.clipPath.match(/^inset\((.*?) round/)
      if (!inset) throw new Error(`unexpected clip-path: ${style.clipPath}`)
      const values = inset[1].trim().split(/\s+/).map(value => parseFloat(value))
      const sides = values.length === 1
        ? [values[0], values[0], values[0], values[0]]
        : values.length === 2
          ? [values[0], values[1], values[0], values[1]]
          : values.length === 3
            ? [values[0], values[1], values[2], values[1]]
            : values
      const rightInset = sides[1]
      const leftInset = sides[3]
      const left = parseFloat(style.left) + transformX + leftInset
      const right = parseFloat(style.left) + transformX + parseFloat(style.width) - rightInset
      return {
        left,
        right,
        transformX,
        leftInset,
        rightInset,
        delay: animation.effect.getTiming().delay,
      }
    }

    const buttons = [...document.querySelectorAll('a-button')]
    const samples = {}
    for (const button of buttons) {
      samples[button.id] = {
        overflow: getComputedStyle(button).overflow,
        start: await sample(button, 0),
        middle: await sample(button, 250),
        end: await sample(button, 499.9),
      }
    }
    return samples
  })

  for (const samples of Object.values(result)) {
    assert.equal(samples.overflow, 'visible')
    assert.equal(samples.start.delay, -9_999_000)
    assert.ok(Math.abs(samples.start.left - samples.middle.left) < 0.05)
    assert.ok(Math.abs(samples.start.left - samples.end.left) < 0.05)
    assert.ok(Math.abs(samples.start.right - samples.middle.right) < 0.05)
    assert.ok(Math.abs(samples.start.right - samples.end.right) < 0.05)
    assert.ok(Math.abs(samples.middle.transformX - samples.middle.leftInset) < 0.05)
    assert.ok(Math.abs(samples.middle.transformX - samples.middle.rightInset) < 0.05)
  }

  assert.ok(Math.abs(result.narrow.middle.transformX - result.wide.middle.transformX) < 0.05)
})
