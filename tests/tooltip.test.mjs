import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))

async function tooltipBundle() {
  const result = await build({
    entryPoints: ['src/elements/a-tooltip.ts'],
    bundle: true,
    write: false,
    outfile: 'tooltip.js',
    format: 'iife',
    target: 'es2022',
  })
  return {
    script: result.outputFiles.find(file => file.path.endsWith('.js')).text,
    css: result.outputFiles.find(file => file.path.endsWith('.css')).text,
  }
}

test('only two follow tooltips skip the incoming delay', async t => {
  const { chromium } = requireSite('playwright')
  const browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
  t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } })
  const { script, css } = await tooltipBundle()
  await page.setContent(`<style>${css}
    .anchor { position: absolute; top: 100px; width: 70px; height: 36px; }
    #follow-a { left: 40px; }
    #follow-b { left: 120px; }
    #pinned-a { left: 200px; }
    #pinned-b { left: 280px; }
    #follow-c { left: 360px; }
  </style>
  <div class="anchor" id="follow-a">A<a-tooltip follow delay="30">A tip</a-tooltip></div>
  <div class="anchor" id="follow-b">B<a-tooltip follow delay="260">B tip</a-tooltip></div>
  <div class="anchor" id="pinned-a">C<a-tooltip delay="260">C tip</a-tooltip></div>
  <div class="anchor" id="pinned-b">D<a-tooltip delay="260">D tip</a-tooltip></div>
  <div class="anchor" id="follow-c">E<a-tooltip follow delay="260">E tip</a-tooltip></div>`)
  await page.addScriptTag({ content: script })

  const isOpen = id => page.locator(`#${id} a-tooltip`).evaluate(
    tooltip => tooltip.shadowRoot.querySelector('[popover]').matches(':popover-open'),
  )
  const expectFreshDelay = async id => {
    await page.locator(`#${id}`).hover()
    await page.waitForTimeout(100)
    assert.equal(await isOpen(id), false, `${id} opened during its reset delay`)
    await page.waitForFunction(
      selector => document.querySelector(selector).shadowRoot.querySelector('[popover]').matches(':popover-open'),
      `#${id} a-tooltip`,
    )
  }

  await page.locator('#follow-a').hover()
  await page.waitForFunction(() => document.querySelector('#follow-a a-tooltip').shadowRoot.querySelector('[popover]').matches(':popover-open'))

  // follow → follow inherits the warm state and opens without B's 260ms delay.
  await page.locator('#follow-b').hover()
  await page.waitForTimeout(100)
  assert.equal(await isOpen('follow-b'), true)

  await expectFreshDelay('pinned-a') // follow → non-follow
  await expectFreshDelay('pinned-b') // non-follow → non-follow
  await expectFreshDelay('follow-c') // non-follow → follow
})

test('left placement centers beside the anchor and flips at the viewport edge', async t => {
  const { chromium } = requireSite('playwright')
  const browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
  t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } })
  const { script, css } = await tooltipBundle()
  await page.setContent(`<style>${css}
    .anchor { position: absolute; width: 160px; height: 40px; }
    #center { left: 400px; top: 220px; }
    #edge { left: 2px; top: 320px; }
  </style>
  <div class="anchor" id="center">Center<a-tooltip placement="left">Center tip</a-tooltip></div>
  <div class="anchor" id="edge">Edge<a-tooltip placement="left">Edge tip</a-tooltip></div>`)
  await page.addScriptTag({ content: script })

  const geometry = async id => {
    await page.locator(`#${id} a-tooltip`).evaluate(tooltip => tooltip.show())
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    return page.locator(`#${id}`).evaluate(anchor => {
      const bubble = anchor.querySelector('a-tooltip').shadowRoot.querySelector('[popover]').getBoundingClientRect()
      const box = anchor.getBoundingClientRect()
      return {
        anchor: { left: box.left, right: box.right, centerY: box.top + box.height / 2 },
        bubble: { left: bubble.left, right: bubble.right, centerY: bubble.top + bubble.height / 2 },
      }
    })
  }

  const centered = await geometry('center')
  assert.ok(Math.abs(centered.bubble.right - (centered.anchor.left - 4)) <= 1)
  assert.ok(Math.abs(centered.bubble.centerY - centered.anchor.centerY) <= 1)

  const flipped = await geometry('edge')
  assert.ok(Math.abs(flipped.bubble.left - (flipped.anchor.right + 4)) <= 1)
  assert.ok(Math.abs(flipped.bubble.centerY - flipped.anchor.centerY) <= 1)
})
