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
        import { InputDate } from './src/components/InputDate'
        import './src/elements/index'
        import './src/tokens.css'
        configure(h)
        window.renderDate = () => render(h(InputDate, { label: 'Date', defaultValue: '2026-06-15' }), document.querySelector('#mount'))
      `,
      resolveDir: process.cwd(),
    },
    bundle: true, write: false, outfile: 'keyboard.js', format: 'iife', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('site/node_modules')],
    alias: {
      '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
      react: requireSite.resolve('preact/compat'),
    },
  })
  script = result.outputFiles.find(file => file.path.endsWith('.js')).text
  css = result.outputFiles.find(file => file.path.endsWith('.css')).text
  browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
})

after(async () => browser?.close())

async function pageFor(t, markup) {
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  await page.setContent(`<main id="mount">${markup}</main>`)
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  return page
}

const navigationKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Tab']

async function expectNativeShortcuts(page, locator, { calendar = false } = {}) {
  await locator.focus()
  const violations = await locator.evaluate(async (target, { keys, calendar }) => {
    const events = []
    const record = event => events.push(event.type)
    for (const type of ['statechange', 'navigate', 'activedescendant', 'input', 'change']) document.addEventListener(type, record, true)
    const snapshot = () => {
      const focus = []
      let active = document.activeElement
      while (active) {
        focus.push(active)
        active = active.shadowRoot?.activeElement
      }
      return { focus, value: target.value, start: target.selectionStart, end: target.selectionEnd }
    }
    const before = snapshot()
    const violations = []
    for (let mask = 1; mask < 16; mask++) {
      const modifiers = { altKey: !!(mask & 1), ctrlKey: !!(mask & 2), metaKey: !!(mask & 4), shiftKey: !!(mask & 8) }
      for (const key of keys) {
        if (mask === 8 && (key === 'Tab' || (calendar && ['PageUp', 'PageDown'].includes(key)))) continue
        let bubbled = false
        const observe = () => { bubbled = true }
        document.addEventListener('keydown', observe, { once: true })
        // Synthetic events verify pass-through without executing browser/OS shortcuts in the test runner.
        const event = new KeyboardEvent('keydown', { key, ...modifiers, bubbles: true, composed: true, cancelable: true })
        target.dispatchEvent(event)
        await new Promise(requestAnimationFrame)
        document.removeEventListener('keydown', observe)
        const after = snapshot()
        if (event.defaultPrevented || !bubbled || events.length || before.value !== after.value
          || before.start !== after.start || before.end !== after.end
          || before.focus.length !== after.focus.length || before.focus.some((node, index) => node !== after.focus[index])) {
          violations.push({ key, modifiers, canceled: event.defaultPrevented, bubbled, events: [...events] })
        }
      }
    }
    return violations
  }, { keys: navigationKeys, calendar })
  assert.deepEqual(violations, [])
}

for (const orientation of ['horizontal', 'vertical']) {
  test(`${orientation} Tabs preserve modified navigation and still handle plain arrows`, async t => {
    const page = await pageFor(t, `<a-tabs orientation="${orientation}" defaultvalue="one">
      <a-tab value="one" tabindex="0">One</a-tab><a-tab value="two" tabindex="-1">Two</a-tab>
    </a-tabs>`)
    await expectNativeShortcuts(page, page.locator('a-tab').first())
    await page.keyboard.press(orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown')
    assert.equal(await page.locator('a-tab:state(selected)').getAttribute('value'), 'two')
  })
}

test('RadioGroup and Slider preserve modified navigation and still respond to plain arrows', async t => {
  const page = await pageFor(t, `<a-radio-group defaultvalue="one">
    <a-radio value="one" tabindex="0">One</a-radio><a-radio value="two" tabindex="-1">Two</a-radio>
    </a-radio-group><a-slider defaultvalue="35" tabindex="0"></a-slider>`)
  await expectNativeShortcuts(page, page.locator('a-radio').first())
  await page.keyboard.press('ArrowRight')
  assert.equal(await page.locator('a-radio:state(selected)').getAttribute('value'), 'two')
  await expectNativeShortcuts(page, page.locator('a-slider'))
  await page.keyboard.press('ArrowRight')
  assert.equal(await page.locator('a-slider').evaluate(slider => slider.value), 36)
})

test('Calendar preserves shortcuts and retains Shift+PageDown year navigation', async t => {
  const page = await pageFor(t, `<a-calendar>
    <a-button data-part="day-cell" data-date="2026-06-15" tabindex="0">15</a-button>
    <a-button data-part="day-cell" data-date="2026-06-16" tabindex="-1">16</a-button>
  </a-calendar>`)
  await expectNativeShortcuts(page, page.locator('a-button').first(), { calendar: true })
  await page.keyboard.press('ArrowRight')
  assert.equal(await page.evaluate(() => document.activeElement.dataset.date), '2026-06-16')
  await page.evaluate(() => document.querySelector('a-calendar').addEventListener('navigate', e => { window.nextDate = e.detail.date }))
  await page.keyboard.press('Shift+PageDown')
  assert.equal(await page.evaluate(() => window.nextDate), '2027-06-16')
})

test('InputTime preserves modified editing arrows at segment boundaries', async t => {
  const page = await pageFor(t, '<a-input-time value="12:30" format="24"></a-input-time>')
  const segments = page.locator('a-input-time input')
  await segments.first().focus()
  await segments.first().evaluate(input => input.setSelectionRange(input.value.length, input.value.length))
  await expectNativeShortcuts(page, segments.first())
  await page.keyboard.press('ArrowRight')
  assert.equal(await segments.nth(1).evaluate(input => input === input.getRootNode().activeElement), true)
})

const menuMarkup = `<a-button id="trigger" tabindex="0">Open</a-button><a-menu>
  <a-menu-item id="first" tabindex="0">First<a-menu>
    <a-menu-item id="nested" tabindex="0">Nested</a-menu-item>
  </a-menu></a-menu-item>
  <a-menu-item id="last" tabindex="0">Last</a-menu-item>
</a-menu>`

test('Menu triggers, item navigation, and submenus preserve modified keys', async t => {
  const page = await pageFor(t, menuMarkup)
  await page.waitForFunction(() => document.querySelector('a-menu').listening)
  await expectNativeShortcuts(page, page.locator('#trigger'))
  await page.keyboard.press('ArrowDown')
  await page.waitForFunction(() => document.querySelector('a-menu').isOpen)
  await expectNativeShortcuts(page, page.locator('#first'))
  await page.keyboard.press('ArrowRight')
  await page.waitForFunction(() => document.querySelector('a-menu a-menu').isOpen)
  await expectNativeShortcuts(page, page.locator('#nested'))
  await page.keyboard.press('ArrowLeft')
  assert.equal(await page.locator('a-menu a-menu').evaluate(menu => menu.isOpen), false)
  await page.locator('#first').focus()
  await page.keyboard.press('Shift+Tab')
  assert.equal(await page.evaluate(() => document.activeElement.id), 'last')
})

test('Menu filter navigation preserves modified editing keys', async t => {
  const page = await pageFor(t, `<a-button tabindex="0">Open</a-button><a-menu>
    <a-input slot="header" data-menu-search value="query"></a-input>
    <a-menu-item tabindex="0">First</a-menu-item><a-menu-item tabindex="0">Last</a-menu-item>
  </a-menu>`)
  await page.waitForFunction(() => document.querySelector('a-menu').listening)
  await page.locator('a-button').press('ArrowDown')
  await page.waitForFunction(() => document.querySelector('a-menu').isOpen)
  await expectNativeShortcuts(page, page.locator('a-input input'))
  await page.keyboard.press('ArrowDown')
  assert.equal(await page.locator('a-menu-item:state(active)').count(), 1)
})

test('InputDate leaves modified arrows with the field instead of opening its calendar', async t => {
  const page = await pageFor(t, '')
  await page.evaluate(() => window.renderDate())
  await page.waitForFunction(() => document.querySelector('a-menu').listening)
  await expectNativeShortcuts(page, page.locator('a-input input'))
  assert.equal(await page.locator('a-menu').first().evaluate(menu => menu.isOpen), false)
  await page.keyboard.press('ArrowDown')
  await page.waitForFunction(() => document.querySelector('a-menu').isOpen)
})
