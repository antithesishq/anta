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

test('Selected tabs take Button fills and the track takes the strip tone, with and without Antune', async t => {
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  await page.goto(origin)
  await page.waitForSelector('a-tabpanel[data-panel="account"]')
  await page.addStyleTag({ content: await readFile('src/tokens.css', 'utf8') })
  await page.addStyleTag({ content: await readFile('src/elements/a-button.css', 'utf8') })
  await page.addStyleTag({ content: 'a-tab, a-button { transition: none; }' })
  const theme = await page.addStyleTag({ content: await readFile('src/theme-antune.css', 'utf8') })
  const results = await page.evaluate(theme => {
    const tabs = document.querySelector('#basic-tabs a-tabs')
    tabs.setAttribute('noslide', '')
    const selected = tabs.querySelector('a-tab:state(selected)')
    const button = document.createElement('a-button')
    button.setAttribute('priority', 'primary')
    button.textContent = 'Button'
    document.body.append(button)
    const fill = element => getComputedStyle(element).backgroundColor
    const results = []
    for (const themed of [false, true]) {
      theme.sheet.disabled = !themed
      for (const scheme of ['light', 'dark']) {
        document.documentElement.style.colorScheme = scheme
        for (const priority of ['primary', 'secondary']) {
          tabs.setAttribute('priority', priority)
          for (const perTab of [false, true]) {
            for (const tone of ['brand', 'info', 'success', 'warning', 'critical', '#e0457b']) {
              tabs.removeAttribute('tone')
              selected.removeAttribute('tone')
              const target = perTab ? selected : tabs
              target.setAttribute('tone', 'neutral')
              const neutralTrack = fill(tabs)
              target.setAttribute('tone', tone)
              button.setAttribute('tone', tone)
              results.push({
                themed, scheme, priority, perTab, tone,
                selected: fill(selected),
                button: fill(button),
                track: fill(tabs),
                neutralTrack,
              })
            }
          }
        }
      }
    }
    return results
  }, theme)
  for (const { selected, button, track, neutralTrack, ...variant } of results) {
    const description = JSON.stringify(variant)
    if (variant.priority === 'primary') {
      assert.equal(selected, button, `A selected primary tab should match the primary Button fill: ${description}`)
    } else {
      const surface = variant.scheme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)'
      assert.equal(selected, surface, `A selected secondary tab should be a plain surface: ${description}`)
    }
    if (variant.perTab) {
      assert.equal(track, neutralTrack, `A per-tab tone should leave the track alone: ${description}`)
    } else {
      assert.notEqual(track, neutralTrack, `The strip tone should tint the track: ${description}`)
    }
  }
})
