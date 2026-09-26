import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
let browser, script, css

before(async () => {
  const result = await build({
    stdin: {
      contents: `
        import { h, render } from 'preact'
        import { configure } from './src/jsx-runtime'
        import { Input } from './src/components/Input'
        import './src/elements/a-input'
        import './src/tokens.css'
        import './src/theme-antune.css'
        configure(h)
        render(h('main', {},
          h(Input, { label: 'Primary' }),
          h(Input, { label: 'Secondary', priority: 'secondary' }),
          h(Input, { label: 'Tertiary', priority: 'tertiary' }),
          h(Input, { label: 'Invalid tertiary', priority: 'tertiary', status: 'critical' }),
          h(Input, { label: 'Disabled secondary', priority: 'secondary', disabled: true }),
          h(Input, { label: 'Disabled tertiary', priority: 'tertiary', disabled: true }),
        ), document.body)
      `,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    outfile: 'input-priority.js',
    format: 'iife',
    target: 'es2022',
    nodePaths: [resolve('site/node_modules')],
    alias: {
      '@antadesign/anta': resolve('src/index.ts'),
      '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
      react: requireSite.resolve('preact/compat'),
    },
  })
  script = result.outputFiles.find(file => file.path.endsWith('.js')).text
  css = result.outputFiles.find(file => file.path.endsWith('.css')).text
  browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
})

after(async () => browser?.close())

test('Input priorities preserve focus and status borders', async (t) => {
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })

  const widths = () => page.locator('a-input').evaluateAll(hosts => hosts.map(host =>
    getComputedStyle(host.shadowRoot.querySelector('.field')).getPropertyValue('--_bw').trim()
  ))
  const backgrounds = () => page.locator('a-input').evaluateAll(hosts => hosts.map(host =>
    getComputedStyle(host.shadowRoot.querySelector('.field')).backgroundColor
  ))
  const borders = () => page.locator('a-input').evaluateAll(hosts => hosts.map(host =>
    getComputedStyle(host.shadowRoot.querySelector('.field')).getPropertyValue('--_bc').trim()
  ))

  assert.deepEqual(await widths(), ['0.5px', '0.5px', '0.5px', '1px', '0.5px', '0.5px'])
  const bg = await backgrounds()
  assert.notEqual(bg[0], bg[1])
  assert.equal(bg[1], 'rgba(0, 0, 0, 0)')
  assert.equal(bg[2], bg[1])
  assert.notEqual(bg[3], bg[1])
  assert.equal(bg[4], bg[1])
  assert.equal(bg[5], bg[1])
  assert.equal((await borders())[2], 'transparent')
  assert.equal((await borders())[5], 'transparent')

  const tertiary = page.locator('a-input[priority="tertiary"]:not([status]):not([disabled])')
  await tertiary.hover()
  assert.equal((await widths())[2], '1px')
  assert.equal((await borders())[2], (await borders())[1])
  assert.equal((await backgrounds())[2], (await backgrounds())[1])
  await page.mouse.move(0, 0)
  assert.equal((await borders())[2], 'transparent')

  await tertiary.locator('input').focus()
  assert.equal((await widths())[2], '1px')
  assert.equal((await borders())[2], (await borders())[1])
  assert.equal((await backgrounds())[2], (await backgrounds())[1])
  assert.equal(await tertiary.locator('.field').evaluate(field => getComputedStyle(field).outlineStyle), 'solid')
})

test('tertiary pre-upgrade field has a transparent resting border', async (t) => {
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  await page.setContent('<a-input priority="tertiary" placeholder="Search"></a-input>')
  await page.addStyleTag({ content: css })
  const field = page.locator('a-input')
  assert.equal(await field.evaluate(host => getComputedStyle(host).getPropertyValue('--input-rest-border').trim()), 'transparent')
  assert.match(await field.evaluate(host => getComputedStyle(host, '::after').boxShadow), /0px 0px 0px 0\.5px/)
  await field.hover()
  assert.equal(await field.evaluate(host => getComputedStyle(host, '::after').boxShadow.includes('0px 0px 0px 1px')), true)
})
