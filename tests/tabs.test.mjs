import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
let browser, server, origin

before(async () => {
  const result = await build({
    entryPoints: ['tests/tabs.fixture.tsx'],
    bundle: true,
    write: false,
    outfile: 'fixture.js',
    format: 'esm',
    target: 'es2022',
    jsx: 'automatic',
    jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('site/node_modules')],
    alias: {
      '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
      react: requireSite.resolve('preact/compat'),
    },
  })
  const assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/fixture.css' : '/fixture.js', file.text]))
  server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(assets.get(req.url) ?? '<!doctype html><link rel="stylesheet" href="/fixture.css"><div id="mount"></div><script type="module" src="/fixture.js"></script>')
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
})

after(async () => {
  await browser?.close()
  if (server) await new Promise(resolve => server.close(resolve))
})

test('Tabs uses one tab stop and TabPanel forwards common props', async t => {
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  await page.goto(origin)
  await page.waitForSelector('a-tabpanel[data-panel="account"]')

  assert.deepEqual(await page.locator('#basic-tabs a-tab').evaluateAll(tabs => tabs.map(tab => tab.tabIndex)), [0, -1, -1])
  assert.equal(await page.locator('a-tabpanel[data-panel="account"]').evaluate(panel => panel.tabIndex), 0)

  await page.locator('a-tab[value="account"]').focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForFunction(() => document.querySelector('a-tab[value="security"]')?.tabIndex === 0)

  assert.deepEqual(await page.locator('#basic-tabs a-tab').evaluateAll(tabs => tabs.map(tab => tab.tabIndex)), [-1, 0, -1])
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('value')), 'security')
})

test('TabPanel follows its own strip across sibling and nested Tabs and Steps', async t => {
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  await page.goto(origin)

  const active = async selector => page.locator(selector).evaluateAll(panels =>
    panels.filter(panel => panel.matches(':state(active)')).map(panel => panel.textContent))

  assert.deepEqual(await active('#sibling-tabs a-tabpanel'), ['First panel', 'Second panel'])
  assert.deepEqual(await active('#nested-tabs a-tabpanel'), ['Inner panel', 'Outer panel'])
  assert.deepEqual(await active('#nested-steps a-tabpanel'), ['Inner step panel', 'Stage panel'])

  await page.locator('#sibling-tabs a-tabs').nth(1).locator('a-tab[value="later"]').click()
  assert.deepEqual(await active('#sibling-tabs a-tabpanel'), ['First panel', 'Later panel'])
  await page.locator('#nested-tabs a-tabs').first().locator('a-tab[value="other"]').click()
  assert.deepEqual(await active('#nested-tabs a-tabpanel'), ['Inner panel', 'Other panel'])
})

test('Antune preserves strip fills and selected per-tab fills', async t => {
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  await page.goto(origin)
  await page.waitForSelector('a-tabpanel[data-panel="account"]')
  await page.addStyleTag({ content: await readFile('src/tokens.css', 'utf8') })
  await page.addStyleTag({ content: 'a-tab { transition: none; }' })
  const theme = await page.addStyleTag({ content: await readFile('src/theme-antune.css', 'utf8') })
  const results = await page.evaluate(theme => {
    const tabs = document.querySelector('#basic-tabs a-tabs')
    tabs.setAttribute('noslide', '')
    const selected = tabs.querySelector('a-tab:state(selected)')
    const results = []
    for (const scheme of ['light', 'dark']) {
      document.documentElement.style.colorScheme = scheme
      document.documentElement.classList.toggle('dark', scheme === 'dark')
      for (const priority of ['primary', 'secondary']) {
        tabs.setAttribute('priority', priority)
        for (const perTab of [false, true]) {
          for (const tone of ['brand', 'info', 'success', 'warning', 'critical', '#e0457b']) {
            tabs.removeAttribute('tone')
            selected.removeAttribute('tone')
            const target = perTab ? selected : tabs
            target.setAttribute('tone', tone)
            const background = () => getComputedStyle(priority === 'primary' ? tabs : selected).backgroundColor
            theme.sheet.disabled = true
            const base = background()
            target.setAttribute('tone', 'neutral')
            const neutral = background()
            theme.sheet.disabled = false
            const themedNeutral = background()
            target.setAttribute('tone', tone)
            results.push({ scheme, priority, perTab, tone, base, neutral, themedNeutral, themed: background() })
          }
        }
      }
    }
    return results
  }, theme)
  for (const { base, neutral, themedNeutral, themed, ...variant } of results) {
    const description = JSON.stringify(variant)
    if (variant.priority === 'primary' && variant.perTab) {
      assert.equal(base, neutral, `Option tone should preserve the track: ${description}`)
      assert.equal(themed, themedNeutral, `Antune should preserve its neutral track: ${description}`)
    } else {
      assert.notEqual(base, neutral, `Tone should tint the fill: ${description}`)
      assert.equal(themed, base, `Antune should preserve the tone fill: ${description}`)
    }
  }
})

test('Per-tab tones preserve the track and match the named-tone indicator', async t => {
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  await page.goto(origin)
  await page.waitForSelector('a-tabpanel[data-panel="account"]')
  await page.addStyleTag({ content: await readFile('src/tokens.css', 'utf8') })
  await page.addStyleTag({ content: 'a-tab, a-tabs::before { transition: none !important; }' })
  for (const theme of [null, 'antune', 'antithesis']) {
    const stylesheet = theme && await page.addStyleTag({ content: await readFile(`src/theme-${theme}.css`, 'utf8') })
    const results = await page.evaluate(() => {
      const tabs = document.querySelector('#basic-tabs a-tabs')
      const selected = tabs.querySelector('a-tab:state(selected)')
      const sibling = tabs.querySelector('a-tab:not(:state(selected))')
      const paint = element => {
        const style = getComputedStyle(element)
        return { background: style.backgroundColor, shadow: style.boxShadow }
      }
      const indicator = () => {
        const style = tabs.hasAttribute('noslide') ? getComputedStyle(selected) : getComputedStyle(tabs, '::before')
        return { background: style.backgroundColor, shadow: style.boxShadow }
      }
      const results = []
      for (const scheme of ['light', 'dark']) {
        document.documentElement.style.colorScheme = scheme
        document.documentElement.classList.toggle('dark', scheme === 'dark')
        for (const priority of ['primary', 'secondary']) {
          tabs.setAttribute('priority', priority)
          for (const noslide of [false, true]) {
            if (!noslide && !CSS.supports('anchor-scope: all')) continue
            tabs.toggleAttribute('noslide', noslide)
            for (const stripTone of ['neutral', 'brand']) {
              selected.removeAttribute('tone')
              tabs.setAttribute('tone', stripTone)
              const track = paint(tabs)
              const siblingColor = getComputedStyle(sibling).color
              for (const tone of ['neutral', 'brand', 'info', 'success', 'warning', 'critical']) {
                selected.removeAttribute('tone')
                tabs.setAttribute('tone', tone)
                const expected = indicator()
                tabs.setAttribute('tone', stripTone)
                selected.setAttribute('tone', tone)
                results.push({ scheme, priority, noslide, stripTone, tone, track, actualTrack: paint(tabs), expected, actual: indicator(), siblingColor, actualSiblingColor: getComputedStyle(sibling).color })
              }
              selected.setAttribute('tone', '#e0457b')
              results.push({ scheme, priority, noslide, stripTone, tone: '#e0457b', track, actualTrack: paint(tabs), siblingColor, actualSiblingColor: getComputedStyle(sibling).color })
            }
          }
        }
      }
      return results
    })
    for (const { track, actualTrack, expected, actual, siblingColor, actualSiblingColor, ...variant } of results) {
      const description = JSON.stringify({ theme, ...variant })
      assert.deepEqual(actualTrack, track, `Option tone should preserve the track: ${description}`)
      assert.equal(actualSiblingColor, siblingColor, `Option tone should preserve sibling labels: ${description}`)
      if (expected) assert.deepEqual(actual, expected, `Indicator should use the option tone: ${description}`)
    }
    if (stylesheet) await stylesheet.evaluate(element => element.remove())
  }
})
