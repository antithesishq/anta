import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { SYSTEMS, COVERAGE, COVERAGE_URLS } from '../site/src/components/comparison-data.ts'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const cards = await read('../site/src/components/SystemCards.astro')
const page = await read('../site/src/pages/comparison.mdx')

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

test('comparison size and browser values belong to their headings', () => {
  assert.match(cards, /<dt>Gzipped size <strong>\{s\.bundleSize\}<\/strong><\/dt>/)
  assert.match(cards, /<dt>Browser support <strong>\{s\.browserSupport\}<\/strong><\/dt>/)
  assert.match(page, /## Component coverage\s+<CoverageMatrix \/>/)
  const notes = page.match(/<Columns\b[^>]*>([\s\S]*?)<\/Columns>/)?.[1]
  assert.ok(notes)
  assert.equal([...notes.matchAll(/<small>/g)].length, 2)
})

test('card fact headings override both italic styling and the site font slant', async t => {
  const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
  const { chromium } = requireSite('playwright')
  const browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
  t.after(() => browser.close())
  const tab = await browser.newPage()
  const [reset, base] = await Promise.all([read('../src/reset.css'), read('../site/src/styles/base.css')])
  const css = cards.match(/<style>([\s\S]*?)<\/style>/)[1]
  const system = SYSTEMS[0]
  const facts = cards.match(/<dl class="card-facts">[\s\S]*?<\/dl>/)[0]
    .replace(/\{s\.(\w+)\}/g, (_, key) => system[key])
  await tab.setContent(`<style>${reset}\n${base}\n${css}</style>${facts}`)
  const headings = await tab.locator('dt').evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node)
    return { italic: style.fontStyle, axes: style.fontVariationSettings, value: node.querySelector('strong')?.textContent }
  }))
  assert.equal(headings.length, 2)
  for (const heading of headings) {
    assert.equal(heading.italic, 'normal')
    assert.match(heading.axes, /"slnt" 0/)
  }
  assert.deepEqual(headings.map(heading => heading.value), [system.bundleSize, system.browserSupport])
})
