import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { after, before, test } from 'node:test'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
const pages = await Promise.all(['box', 'capture'].map(name => readFile(new URL(`../site/src/pages/${name}.mdx`, import.meta.url), 'utf8')))
let browser, assets

test('Box and Capture previews have adjacent folded code with no detached recipes', () => {
  for (const source of pages) {
    for (const preview of source.matchAll(/<Preview\b[\s\S]*?<\/Preview>/g)) {
      assert.match(source.slice(preview.index + preview[0].length), /^\s*```\w+ folded\b/)
    }
    for (const block of source.matchAll(/^```\w+[^\n]*\n[\s\S]*?^```/gm)) {
      assert.match(block[0], /^```\w+ folded\b/)
      assert.match(source.slice(0, block.index).trimEnd(), /(?:<\/Preview>|```)$/)
    }
  }
})

before(async () => {
  const result = await build({
    stdin: {
      contents: `import { render } from 'preact'
        import './src/tokens.css'
        import './src/reset.css'
        import { BoxContextProbe } from './site/src/components/BoxContextProbe'
        import { BoxCanvasPreview } from './site/src/components/BoxCanvasPreview'
        import { CapturePointerPreview, CapturePanPreview } from './site/src/components/CaptureGesturePreview'
        render(<><BoxContextProbe /><BoxCanvasPreview /><CapturePointerPreview /><CapturePanPreview /></>, document.body)`,
      resolveDir: resolve('.'), loader: 'tsx', sourcefile: 'docs-previews.fixture.tsx',
    },
    bundle: true, write: false, outfile: 'fixture.js', format: 'esm', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('site/node_modules')],
    alias: { react: requireSite.resolve('preact/compat') },
  })
  assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/fixture.css' : '/fixture.js', file.text]))
  const styles = pages.flatMap(source => [...source.matchAll(/<style is:inline>\{`([\s\S]*?)`\}<\/style>/g)].map(match => match[1])).join('\n')
  assets.set('/fixture.css', assets.get('/fixture.css') + styles)
  browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
})

after(async () => { await browser?.close() })

async function pageFor(t, options = {}) {
  const context = await browser.newContext({ viewport: { width: 800, height: 1000 }, ...options })
  t.after(() => context.close())
  const page = await context.newPage()
  await page.route('http://docs.test/**', route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({
      contentType: path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : 'text/html',
      body: assets.get(path) ?? '<!doctype html><link rel="stylesheet" href="/fixture.css"><style>body{padding:24px;background:var(--bg-1);color:var(--text-1)}</style><script type="module" src="/fixture.js"></script>',
    })
  })
  await page.goto('http://docs.test/')
  await page.waitForFunction(() => document.querySelector('.context-probe a-tag')?.textContent.includes('light'))
  return page
}

test('the light-scoped context readout stays legible on light and dark pages', async t => {
  const page = await pageFor(t)
  for (const mode of ['light', 'dark']) {
    await page.evaluate(mode => document.documentElement.classList.toggle('dark', mode === 'dark'), mode)
    await page.waitForFunction(mode => document.querySelector('.light a-tag:last-child')?.textContent.includes(mode), mode)
    const result = await page.locator('.light .context-probe-box').evaluate(box => {
      const ctx = document.createElement('canvas').getContext('2d')
      function color(value) {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = value
        ctx.fillRect(0, 0, 1, 1)
        return [...ctx.getImageData(0, 0, 1, 1).data]
      }
      function luminance(rgb) {
        const linear = rgb.slice(0, 3).map(value => {
          const c = value / 255
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        })
        return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
      }
      const background = color(getComputedStyle(box).backgroundColor)
      const composite = (front, back) => front.slice(0, 3).map((value, index) => value * front[3] / 255 + back[index] * (1 - front[3] / 255))
      const contrasts = [...box.querySelectorAll('a-text, a-tag-label, a-tag-value')].map(node => {
        const tag = node.closest('a-tag')
        const surface = tag ? composite(color(getComputedStyle(tag).backgroundColor), background) : background
        const bg = luminance(surface)
        const fg = luminance(composite(color(getComputedStyle(node).color), surface))
        return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
      })
      return { background, contrasts }
    })
    assert.equal(result.background[3], 255, 'The local light scope paints its own background')
    assert.ok(result.contrasts.every(ratio => ratio >= 4.5), `${mode}: ${result.contrasts}`)
  }
})

test('canvas text is drawn at device resolution and follows context color changes', async t => {
  const page = await pageFor(t, { deviceScaleFactor: 2 })
  await page.waitForFunction(() => document.querySelector('canvas[aria-label]')?.width > 0)
  const sample = () => page.locator('.canvas-probe canvas').evaluate(canvas => ({
    width: canvas.width, expected: canvas.clientWidth * devicePixelRatio,
    color: canvas.getContext('2d').fillStyle,
    painted: canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0),
  }))
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.canvas-probe canvas')
    return canvas.width === canvas.clientWidth * devicePixelRatio
  })
  const light = await sample()
  assert.equal(light.width, light.expected)
  assert.equal(light.painted, true)
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForFunction(color => document.querySelector('.canvas-probe canvas').getContext('2d').fillStyle !== color, light.color)
  assert.equal((await sample()).painted, true)
})

test('pointer and pan previews perform their advertised actions', async t => {
  const page = await pageFor(t)
  const surface = await page.locator('.pointer-probe-surface').boundingBox()
  await page.mouse.move(surface.x + 24, surface.y + 24)
  await page.mouse.down()
  await page.mouse.move(surface.x + 124, surface.y + 88)
  await page.mouse.up()
  await page.waitForFunction(() => document.querySelector('.pointer-probe-selection')?.style.width === '100px')
  assert.equal(await page.locator('.pointer-probe-selection').evaluate(node => node.style.height), '64px')
  await page.getByRole('button', { name: 'Clear selection' }).click()
  assert.equal(await page.locator('.pointer-probe-selection').count(), 0)
  await page.getByRole('button', { name: 'Select sample area' }).focus()
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('.pointer-probe-selection').count(), 1)

  await page.getByRole('checkbox', { name: 'Pan with mouse' }).click()
  await page.getByRole('checkbox', { name: 'Inertia', exact: true }).click()
  const pan = page.locator('.pan-probe-surface')
  await pan.scrollIntoViewIfNeeded()
  const bounds = await pan.boundingBox()
  await page.mouse.move(bounds.x + 100, bounds.y + 120)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 100, bounds.y + 40, { steps: 4 })
  await page.mouse.up()
  await page.waitForFunction(() => document.querySelector('.pan-probe-surface > div').style.transform !== 'translateY(0px)')
  await pan.focus()
  const before = await pan.locator(':scope > div').getAttribute('style')
  await page.keyboard.press('ArrowDown')
  assert.notEqual(await pan.locator(':scope > div').getAttribute('style'), before)
})

test('the pan preview handles touch without enabling mouse panning', async t => {
  const page = await pageFor(t, { hasTouch: true })
  const surface = page.locator('.pan-probe-surface')
  await surface.scrollIntoViewIfNeeded()
  const bounds = await surface.boundingBox()
  const client = await page.context().newCDPSession(page)
  const x = bounds.x + 100, y = bounds.y + 120
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 60 }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForFunction(() => document.querySelector('.pan-probe-surface > div').style.transform !== 'translateY(0px)')
  assert.equal(await surface.getAttribute('pan-pointer-types'), 'touch')
})
