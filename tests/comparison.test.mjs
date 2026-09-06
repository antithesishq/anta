import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { build } from 'esbuild'
import { SYSTEMS, COVERAGE, COVERAGE_URLS } from '../site/src/components/comparison-data.ts'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const cards = await read('../site/src/components/SystemCards.astro')
const page = await read('../site/src/pages/comparison.mdx')

test('comparison cards and matrices use the shared system order', async () => {
  for (const component of ['SystemCards', 'ComparisonMatrix', 'CoverageMatrix']) {
    const source = await read(`../site/src/components/${component}.astro`)
    assert.match(source, /\bCOVERAGE_SYSTEMS\.map\(/)
  }
})

test('comparison cards separate measured versions and link their factual claims', () => {
  for (const system of SYSTEMS) {
    assert.ok(system.bundleVersion, `${system.id}: measured version`)
    assert.match(system.bundleSize, /^~\d+ KiB$/)
    assert.ok(system.sources.length, `${system.id}: sources`)
    assert.match(system.browserSupport, /^~?\d{4}( \/ \d{4})?$/)
    if (system.browserSupport.startsWith('~')) {
      assert.match(system.browsers, /Estimated compatibility/)
      assert.match(system.browsers, /Chrome \/ Edge \d+\+/)
      assert.match(system.browsers, /Firefox \d+\+/)
      assert.match(system.browsers, /Safari \d/)
    }
  }
  assert.equal(COVERAGE.webawesome.toast, 'yes')
  assert.equal(COVERAGE.webawesome.table, 'paid')
  assert.match(COVERAGE_URLS.webawesome.table, /data-grid/)
})

test('comparison size and browser labels keep their details in header tooltips', () => {
  const header = cards.match(/<header class="card-head">[\s\S]*?<\/header>/)[0]
  assert.match(header, /Gzipped size <strong>\{s\.bundleSize\}<\/strong>/)
  assert.match(header, /Browser support <strong>\{s\.browserSupport\}<\/strong>/)
  assert.match(header, /<a-tooltip[^>]*>[\s\S]*?Measured: \{s\.bundleVersion\}\.[\s\S]*?\{s\.bundleIncludes\}[\s\S]*?<\/a-tooltip>/)
  assert.match(header, /<a-tooltip[^>]*>\{s\.browsers\}<\/a-tooltip>/)
  assert.match(page, /## Component coverage\s+<CoverageMatrix \/>/)
  const notes = page.match(/<Columns\b[^>]*>([\s\S]*?)<\/Columns>/)?.[1]
  assert.ok(notes)
  assert.equal([...notes.matchAll(/<small>/g)].length, 2)
})

test('card facts stay upright, wrap below the title, and show details on hover and focus', async t => {
  const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
  const { chromium } = requireSite('playwright')
  const browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
  t.after(() => browser.close())
  const tab = await browser.newPage({ viewport: { width: 1200, height: 700 } })
  const [reset, base] = await Promise.all([read('../src/reset.css'), read('../site/src/styles/base.css')])
  const css = cards.match(/<style>([\s\S]*?)<\/style>/)[1]
  const system = SYSTEMS.find(system => system.id === 'mui')
  const facts = cards.match(/<div class="card-facts">[\s\S]*?<\/div>/)[0]
    .replace(/\{`sys-\$\{s.id\}-(size|browsers)`\}/g, (_, kind) => `"sys-${system.id}-${kind}"`)
    .replace(/\{s\.(\w+)\}/g, (_, key) => system[key])
  const result = await build({
    entryPoints: ['src/elements/a-tooltip.ts'], bundle: true, write: false,
    outfile: 'tooltip.js', format: 'iife', target: 'es2022',
  })
  const script = result.outputFiles.find(file => file.path.endsWith('.js')).text
  const tooltipCss = result.outputFiles.find(file => file.path.endsWith('.css')).text
  await tab.setContent(`<style>${reset}\n${base}\n${tooltipCss}\n${css}
    main { container-type: inline-size; }
  </style><button id="before">Before card</button><main><section class="card">
    <header class="card-head"><div class="card-identity">
      <h3 class="card-name">${system.name}</h3><span class="card-ver">${system.version}</span>
    </div>${facts}</header>
  </section></main>`)
  await tab.addScriptTag({ content: script })
  const headings = await tab.locator('.card-fact').evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node)
    return { italic: style.fontStyle, axes: style.fontVariationSettings, value: node.querySelector('strong')?.textContent,
      described: node.getAttribute('aria-describedby') === node.querySelector('a-tooltip')?.id }
  }))
  assert.equal(headings.length, 2)
  for (const heading of headings) {
    assert.equal(heading.italic, 'normal')
    assert.match(heading.axes, /"slnt" 0/)
    assert.equal(heading.described, true)
  }
  assert.deepEqual(headings.map(heading => heading.value), [system.bundleSize, system.browserSupport])

  for (const width of [1200, 700, 390]) {
    await tab.setViewportSize({ width, height: 700 })
    const identity = await tab.locator('.card-identity').boundingBox()
    const factsBox = await tab.locator('.card-facts').boundingBox()
    if (width > 760) {
      assert.ok(factsBox.x > identity.x + identity.width)
      assert.ok(factsBox.y < identity.y + identity.height)
    } else {
      assert.ok(factsBox.y >= identity.y + identity.height)
      assert.equal(factsBox.x, identity.x)
    }
    assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  }

  const labels = tab.locator('.card-fact')
  const tooltips = tab.locator('.card-fact a-tooltip')
  for (let index = 0; index < 2; index++) {
    await labels.nth(index).hover()
    await tooltips.nth(index).locator('[popover]:popover-open').waitFor({ state: 'visible' })
    const content = await tooltips.nth(index).textContent()
    assert.ok(content.includes(index ? system.browsers : system.bundleIncludes))
    if (!index) {
      assert.ok(content.startsWith(`Measured: ${system.bundleVersion}.`))
      const leadingSpace = await tooltips.nth(index).evaluate(tooltip => {
        const bubble = tooltip.shadowRoot.querySelector('[part="bubble"]')
        return tooltip.querySelector('.size-version').getBoundingClientRect().top
          - bubble.getBoundingClientRect().top - parseFloat(getComputedStyle(bubble).paddingTop)
      })
      assert.ok(Math.abs(leadingSpace) < 1, `Unexpected ${leadingSpace}px before the measured version`)
    }
    await tab.keyboard.press('Escape')
    await tooltips.nth(index).locator('[popover]:popover-open').waitFor({ state: 'hidden' })
  }
  await tab.mouse.move(0, 0)
  await tab.locator('#before').focus()
  for (let index = 0; index < 2; index++) {
    await tab.keyboard.press('Tab')
    await tooltips.nth(index).locator('[popover]:popover-open').waitFor({ state: 'visible' })
    await tab.keyboard.press('Escape')
    await tooltips.nth(index).locator('[popover]:popover-open').waitFor({ state: 'hidden' })
  }
})
