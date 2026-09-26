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
        import { Button, InputDate, Menu, MenuItem, Select, SelectFaceted } from './src/index'
        import './src/elements/index'
        import './src/tokens.css'
        configure(h)

        render(h(SelectFaceted, {
          label: 'Filter',
          facets: [{
            key: 'duration', label: 'Min duration', kind: 'custom',
            summary: value => String(value),
            render: ({ value, onChange }) => h('div', { style: { width: '280px', padding: '8px' } },
              h(Select, { label: 'More', options: ['10 minutes', '30 minutes'], value, onValueChange: onChange }),
              h(InputDate, { label: 'From', clearable: true, defaultValue: '2026-09-30' }),
              h(Button, { label: 'Links' }),
              h(Menu, {},
                h(MenuItem, { label: 'Guide', href: '#guide' }),
              ),
              h(Button, { label: 'Done', 'data-menu-close': '' }),
            ),
          }, {
            key: 'other', label: 'Other', kind: 'single', options: ['One'],
          }],
        }), document.body)
      `,
      resolveDir: process.cwd(),
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    outfile: 'menu-nested-editor.js',
    format: 'iife',
    target: 'es2022',
    jsx: 'automatic',
    jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('site/node_modules')],
    alias: {
      '@antadesign/anta': resolve('src/index.ts'),
      '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
      react: requireSite.resolve('preact/compat'),
    },
  })
  script = result.outputFiles.find(file => file.path.endsWith('.js')).text
  css = result.outputFiles.find(file => file.path.endsWith('.css')).text
  browser = await chromium.launch({
    headless: true,
    channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined,
  })
})

after(async () => browser?.close())

test('a nested select or link choice closes only its popup inside a persistent facet editor', async t => {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } })
  t.after(() => context.close())
  const page = await context.newPage()
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })

  await page.getByText('Filter', { exact: true }).click()
  const root = page.locator('a-menu').first()
  const editor = page.locator('a-menu[aria-label="Min duration editor"]')
  await editor.evaluate(menu => menu.open())
  assert.equal(await editor.evaluate(menu => menu.isOpen), true)

  await editor.locator('a-button[aria-label="More"]').click()
  const selectMenu = editor.locator('a-menu').filter({ has: page.getByText('10 minutes', { exact: true }) })
  assert.equal(await selectMenu.evaluate(menu => menu.isOpen), true)
  await selectMenu.getByText('10 minutes', { exact: true }).click()
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('a-menu')].slice(0, 3).map(menu => menu.isOpen)), [true, true, false])
  assert.equal(await editor.locator('a-button[aria-label="More"] a-button-label').textContent(), '10 minutes')

  await editor.getByText('Links', { exact: true }).click()
  const linkMenu = editor.locator('a-menu').filter({ has: page.getByText('Guide', { exact: true }) })
  assert.equal(await linkMenu.evaluate(menu => menu.isOpen), true)
  await linkMenu.getByText('Guide', { exact: true }).click()
  assert.equal(await linkMenu.evaluate(menu => menu.isOpen), false)
  assert.equal(await editor.evaluate(menu => menu.isOpen), true)
  assert.equal(await root.evaluate(menu => menu.isOpen), true)

  await editor.getByText('Done', { exact: true }).click()
  assert.equal(await editor.evaluate(menu => menu.isOpen), false)
  assert.equal(await root.evaluate(menu => menu.isOpen), false)
})

test('clearing a date field does not toggle its menu; the next field click opens it', async t => {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } })
  t.after(() => context.close())
  const page = await context.newPage()
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })

  await page.getByText('Filter', { exact: true }).click()
  const root = page.locator('a-menu').first()
  const editor = page.locator('a-menu[aria-label="Min duration editor"]')
  await editor.evaluate(menu => menu.open())
  const field = editor.locator('a-input').first()
  const calendar = field.locator('xpath=following-sibling::a-menu[1]')

  await field.locator('a-button[aria-label="Clear"]').click()
  assert.equal(await field.evaluate(input => input.value), '')
  assert.equal(await calendar.evaluate(menu => menu.isOpen), false)
  assert.equal(await editor.evaluate(menu => menu.isOpen), true)
  assert.equal(await root.evaluate(menu => menu.isOpen), true)

  await field.locator('input').click()
  assert.equal(await calendar.evaluate(menu => menu.isOpen), true)
})

test('clearing a date field leaves its already open calendar open', async t => {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } })
  t.after(() => context.close())
  const page = await context.newPage()
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })

  await page.getByText('Filter', { exact: true }).click()
  const root = page.locator('a-menu').first()
  const editor = page.locator('a-menu[aria-label="Min duration editor"]')
  await editor.evaluate(menu => menu.open())
  const field = editor.locator('a-input').first()
  const calendar = field.locator('xpath=following-sibling::a-menu[1]')

  await field.locator('input').click()
  assert.equal(await calendar.evaluate(menu => menu.isOpen), true)
  await field.locator('a-button[aria-label="Clear"]').click()
  assert.equal(await field.evaluate(input => input.value), '')
  assert.equal(await calendar.evaluate(menu => menu.isOpen), true)
  assert.equal(await editor.evaluate(menu => menu.isOpen), true)
  assert.equal(await root.evaluate(menu => menu.isOpen), true)
})

test('switching facet submenus resets a cleared date calendar before reopening it', async t => {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } })
  t.after(() => context.close())
  const page = await context.newPage()
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })

  await page.getByText('Filter', { exact: true }).click()
  const root = page.locator('a-menu').first()
  const duration = root.locator('a-menu-item[submenu]').filter({ hasText: 'Min duration' })
  const other = root.locator('a-menu-item[submenu]').filter({ hasText: 'Other' })
  const editor = duration.locator('a-menu').first()
  await editor.evaluate(menu => menu.open())
  const field = editor.locator('a-input').first()
  const calendar = field.locator('xpath=following-sibling::a-menu[1]')

  await field.locator('input').click()
  await field.locator('a-button[aria-label="Clear"]').click()
  assert.equal(await field.evaluate(input => input.value), '')
  assert.equal(await calendar.evaluate(menu => menu.isOpen), true)

  await other.hover()
  await page.waitForFunction(() => {
    const item = [...document.querySelectorAll('a-menu-item[submenu]')].find(node => node.textContent.includes('Other'))
    return item?.querySelector(':scope > a-menu')?.isOpen
  })
  assert.equal(await editor.evaluate(menu => menu.isOpen), false)
  assert.deepEqual(await calendar.evaluate(menu => ({ state: menu.getAttribute('state'), shown: menu.isOpen })), {
    state: 'closed', shown: false,
  })

  await editor.evaluate(menu => menu.open())
  await field.locator('input').click()
  assert.equal(await calendar.evaluate(menu => menu.isOpen), true)
})
