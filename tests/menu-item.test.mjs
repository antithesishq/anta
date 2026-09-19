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
        import { useState } from 'preact/hooks'
        import { configure } from './src/jsx-runtime'
        import { Button, Menu, MenuItem } from './src/index'
        import './src/elements/index'
        import './src/tokens.css'
        configure(h)

        function Demo() {
          const [checked, setChecked] = useState(false)
          return <>
            <Button id="trigger">Settings</Button>
            <Menu id="menu">
              <MenuItem
                id="switch-item"
                selectionIndicator="switch"
                label="Notifications"
                hint="Receive activity alerts"
                selected={checked}
                onSelect={() => {
                  window.switchSelections = (window.switchSelections || 0) + 1
                  setChecked(value => !value)
                }}
              />
              <MenuItem id="plain-item" label="Done" />
            </Menu>
          </>
        }

        render(<Demo />, document.body)
      `,
      resolveDir: process.cwd(),
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    outfile: 'menu-item.js',
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

test('switch menu items are one checkable control and keep their menu open', async t => {
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })

  const trigger = page.locator('#trigger')
  const menu = page.locator('#menu')
  const item = page.locator('#switch-item')
  const indicator = item.locator(':scope > a-switch[data-menu-item-switch]')

  await trigger.click()
  await page.waitForFunction(() => document.querySelector('#menu').isOpen)

  assert.equal(await item.getAttribute('role'), 'menuitemcheckbox')
  assert.equal(await item.getAttribute('aria-checked'), 'false')
  assert.equal(await item.getAttribute('data-menu-open'), '')
  assert.equal(await indicator.getAttribute('aria-hidden'), 'true')
  assert.equal(await indicator.getAttribute('state'), 'unchecked')
  assert.equal(await indicator.getAttribute('size'), 'small')
  assert.equal(await indicator.getAttribute('tabindex'), '-1')
  assert.equal(await indicator.evaluate(element => getComputedStyle(element).pointerEvents), 'none')
  assert.equal(await indicator.evaluate(element => element.getBoundingClientRect().width), 26)
  assert.equal(
    await item.evaluate(element => {
      const indicator = element.querySelector(':scope > a-switch[data-menu-item-switch]')
      return element.getBoundingClientRect().right - indicator.getBoundingClientRect().right
    }),
    8,
  )
  assert.equal(await item.locator('a-menu-item-hint').textContent(), 'Receive activity alerts')
  assert.equal(await page.getByRole('switch').count(), 0)

  await item.click()
  await page.waitForFunction(() => document.querySelector('#switch-item').getAttribute('aria-checked') === 'true')
  assert.equal(await indicator.getAttribute('state'), 'checked')
  assert.equal(await menu.evaluate(element => element.isOpen), true)
  assert.equal(await page.evaluate(() => window.switchSelections), 1)

  await item.focus()
  await page.keyboard.press('Space')
  await page.waitForFunction(() => document.querySelector('#switch-item').getAttribute('aria-checked') === 'false')
  assert.equal(await indicator.getAttribute('state'), 'unchecked')
  assert.equal(await menu.evaluate(element => element.isOpen), true)
  assert.equal(await page.evaluate(() => window.switchSelections), 2)

  await page.locator('#plain-item').click()
  await page.waitForFunction(() => !document.querySelector('#menu').isOpen)
})
