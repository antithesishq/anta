import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
const { PNG } = requireSite('pngjs')
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'"
let browser, server, origin

before(async () => {
  const result = await build({
    entryPoints: ['tests/avatar-csp.fixture.tsx'], bundle: true, write: false,
    outfile: 'avatar.js', format: 'esm', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('site/node_modules')],
    alias: {
      '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
      react: requireSite.resolve('preact/compat'),
    },
  })
  const assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/avatar.css' : '/avatar.js', file.text]))
  assets.set('/portrait.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="460" height="460"><rect width="460" height="460" fill="#ff0000"/></svg>')
  server = createServer((req, res) => {
    res.setHeader('Content-Security-Policy', policy)
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : req.url.endsWith('.svg') ? 'image/svg+xml' : 'text/html')
    res.end(assets.get(req.url) ?? '<!doctype html><link rel="stylesheet" href="/avatar.css"><div id="mount"></div><script type="module" src="/avatar.js"></script>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
})

after(async () => {
  await browser?.close()
  if (server) await new Promise(resolve => server.close(resolve))
})

async function pageFor(t) {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const response = await page.goto(origin)
  assert.equal(response.headers()['content-security-policy'], policy)
  await page.waitForFunction(() => typeof window.renderAvatar === 'function')
  t.after(async () => {
    try {
      assert.deepEqual(errors, [])
      assert.deepEqual(await page.evaluate(() => window.cspViolations), [])
    } finally {
      await context.close()
    }
  })
  return page
}

async function renderAvatar(page, props) {
  await page.evaluate(async props => {
    window.renderAvatar(props)
    const image = document.querySelector('a-avatar').shadowRoot.querySelector('img')
    if (image) await image.decode()
    await new Promise(resolve => requestAnimationFrame(resolve))
  }, props)
}

test('image, generated, and initials avatars fit every size inside Button under a strict CSP', async t => {
  const page = await pageFor(t)
  const kinds = [
    { src: '/portrait.svg' },
    { seed: 'octocat' },
    { generator: { headRadiusTop: { mode: 'off' }, headRadiusBottom: { mode: 'off' }, bodyBorderRadius: { mode: 'off' } } },
  ]
  for (const props of kinds) {
    for (const [size, pixels] of [['small', 32], ['medium', 44], ['large', 64], [48, 48]]) {
      await renderAvatar(page, { ...props, size, round: true })
      const metrics = await page.evaluate(() => {
        const avatar = document.querySelector('a-avatar')
        const picture = avatar.shadowRoot.querySelector('[part~="frame"]')
        const host = avatar.getBoundingClientRect()
        const frame = picture.getBoundingClientRect()
        const button = avatar.closest('a-button').getBoundingClientRect()
        return {
          host: [host.width, host.height], frame: [frame.width, frame.height],
          radius: getComputedStyle(picture).borderRadius,
          insideButton: frame.left >= button.left && frame.right <= button.right && frame.top >= button.top && frame.bottom <= button.bottom,
          naturalWidth: picture instanceof HTMLImageElement ? picture.naturalWidth : null,
          fit: picture instanceof HTMLImageElement ? getComputedStyle(picture).objectFit : null,
        }
      })
      assert.deepEqual(metrics.host, [pixels, pixels])
      assert.deepEqual(metrics.frame, [pixels, pixels])
      assert.equal(metrics.radius, '50%')
      assert.equal(metrics.insideButton, true)
      if (props.src) {
        assert.equal(metrics.naturalWidth, 460)
        assert.equal(metrics.fit, 'cover')
      }
    }
    await renderAvatar(page, { ...props, size: 'small', round: true })
    const screenshot = PNG.sync.read(await page.locator('a-avatar').screenshot())
    const pixel = (x, y) => [...screenshot.data.subarray((y * screenshot.width + x) * 4, (y * screenshot.width + x) * 4 + 3)]
    assert.deepEqual(pixel(0, 0), [240, 243, 246], 'the circular picture must clip its corner')
    assert.notDeepEqual(pixel(16, 16), [240, 243, 246], 'the picture must remain visible inside the circle')
  }
})

test('Avatar round changes and image/generated swaps retain their styling under CSP', async t => {
  const page = await pageFor(t)
  for (const [props, radius] of [
    [{ src: '/portrait.svg', size: 'small' }, '22%'],
    [{ seed: 'octocat', size: 'small', round: true }, '50%'],
    [{ src: '/portrait.svg', size: 'small', round: 10 }, '10px'],
  ]) {
    await renderAvatar(page, props)
    assert.equal(await page.locator('a-avatar').evaluate(avatar => getComputedStyle(avatar.shadowRoot.querySelector('[part~="frame"]')).borderRadius), radius)
  }
})

test('Avatar badge visibility, placement, and cutout follow the badge attribute under CSP', async t => {
  const page = await pageFor(t)
  await renderAvatar(page, { seed: 'octocat', size: 'small', round: true })
  for (const value of [null, 'success', 'none', '', 'critical', null]) {
    const badge = await page.locator('a-avatar').evaluate((avatar, value) => {
      if (value === null) avatar.removeAttribute('badge')
      else avatar.setAttribute('badge', value)
      const node = avatar.shadowRoot.querySelector('[part="badge"]')
      const style = getComputedStyle(node)
      const host = avatar.getBoundingClientRect()
      const bounds = node.getBoundingClientRect()
      return {
        display: style.display, position: style.position,
        width: parseFloat(style.width), radius: style.borderRadius,
        withinHost: bounds.left >= host.left && bounds.top >= host.top && bounds.right <= host.right && bounds.bottom <= host.bottom,
        mask: getComputedStyle(avatar.shadowRoot.querySelector('[part~="frame"]')).maskImage,
      }
    }, value)
    if (value && value !== 'none') {
      assert.equal(badge.display, 'block')
      assert.equal(badge.position, 'absolute')
      assert.ok(Math.abs(badge.width - 7.68) < 0.1)
      assert.equal(badge.radius, '50%')
      assert.equal(badge.withinHost, true)
      assert.match(badge.mask, /radial-gradient/)
    } else {
      assert.equal(badge.display, 'none')
      assert.equal(badge.mask, 'none')
    }
  }
})

test('direct style.display assignments remain allowed under style-src self', async t => {
  const page = await pageFor(t)
  assert.equal(await page.evaluate(() => {
    const probe = document.createElement('span')
    document.body.append(probe)
    probe.style.display = 'none'
    const display = getComputedStyle(probe).display
    probe.remove()
    return display
  }), 'none')
})
