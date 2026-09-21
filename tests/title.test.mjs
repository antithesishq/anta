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
    entryPoints: ['tests/title.fixture.tsx'], bundle: true, write: false,
    outfile: 'title.js', format: 'esm', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('site/node_modules')],
    alias: {
      '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
      react: requireSite.resolve('preact/compat'),
    },
  })
  const assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/title.css' : '/title.js', file.text]))
  server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(assets.get(req.url) ?? `<!doctype html><link rel="stylesheet" href="/title.css">
      <div id="mount"></div><script type="module" src="/title.js"></script>`)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({
    headless: true,
    channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined,
  })
})

after(async () => {
  await browser?.close()
  if (server) await new Promise(resolve => server.close(resolve))
})

async function pageFor(t) {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } })
  t.after(() => context.close())
  const page = await context.newPage()
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.renderTitle === 'function')
  return page
}

test('Title truncates to one or multiple lines and keeps heading semantics', async t => {
  const page = await pageFor(t)
  const longTitle = 'A long workspace heading that needs enough words to overflow its narrow layout across several lines'

  const single = await page.evaluate(([children]) => {
    window.renderTitle({ truncate: true, level: 3, style: { width: 150 } }, children)
    const title = document.querySelector('a-title')
    const style = getComputedStyle(title)
    return {
      truncate: title.getAttribute('truncate'),
      clamp: style.webkitLineClamp,
      clipped: title.scrollHeight > title.clientHeight + 1,
      role: title.getAttribute('role'),
      level: title.getAttribute('aria-level'),
      automaticTooltip: title.querySelector('a-tooltip')?.hasAttribute('data-anta-text-tooltip'),
    }
  }, [longTitle])
  assert.deepEqual(single, {
    truncate: '1', clamp: '1', clipped: true, role: 'heading', level: '3', automaticTooltip: true,
  })

  const tooltip = await page.evaluate(async () => {
    const tooltip = document.querySelector('a-tooltip')
    tooltip.show()
    await new Promise(resolve => requestAnimationFrame(resolve))
    const bubble = tooltip.shadowRoot.querySelector('[popover]')
    return { open: bubble.matches(':popover-open'), text: bubble.textContent }
  })
  assert.deepEqual(tooltip, { open: true, text: longTitle })

  const multiple = await page.evaluate(([children]) => {
    window.renderTitle({ truncate: 2, level: 3, style: { width: 150 } }, children)
    const title = document.querySelector('a-title')
    const style = getComputedStyle(title)
    return {
      truncate: title.getAttribute('truncate'),
      clamp: style.webkitLineClamp,
      height: title.clientHeight,
      lineHeight: parseFloat(style.lineHeight),
      clipped: title.scrollHeight > title.clientHeight + 1,
    }
  }, [longTitle])
  assert.equal(multiple.truncate, '2')
  assert.equal(multiple.clamp, '2')
  assert.ok(Math.abs(multiple.height - multiple.lineHeight * 2) <= 1)
  assert.equal(multiple.clipped, true)
})

test('Title omits truncation for non-positive values and gates its automatic tooltip on overflow', async t => {
  const page = await pageFor(t)

  const omitted = await page.evaluate(() => {
    window.renderTitle({ truncate: 0 }, 'A title')
    const title = document.querySelector('a-title')
    return {
      truncate: title.hasAttribute('truncate'),
      tooltip: title.querySelector('a-tooltip') !== null,
    }
  })
  assert.deepEqual(omitted, { truncate: false, tooltip: false })

  const open = await page.evaluate(async () => {
    window.renderTitle({ truncate: true, style: { width: 300 } }, 'Short title')
    const tooltip = document.querySelector('a-tooltip')
    tooltip.show()
    await new Promise(resolve => requestAnimationFrame(resolve))
    return tooltip.shadowRoot.querySelector('[popover]').matches(':popover-open')
  })
  assert.equal(open, false)
})
