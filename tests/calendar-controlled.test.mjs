import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const requirePlot = createRequire(new URL('../plot/package.json', import.meta.url))
const { chromium, webkit } = requireSite('playwright')
const engines = process.env.ANTA_TEST_WEBKIT === '0' ? [chromium] : [chromium, webkit]
const browsers = new Map()
const fixtures = new Map()
let elements

before(async () => {
  elements = await build({
    entryPoints: ['src/elements/index.ts'], bundle: true, write: false,
    outfile: 'calendar-elements.js', format: 'iife', target: 'es2022',
    alias: { react: requireSite.resolve('preact/compat') },
  })
  for (const framework of ['React', 'Preact']) {
    const react = framework === 'React'
    const result = await build({
      stdin: {
        contents: `
          import React from 'react'
          import { Calendar, InputDate } from './src/index'
          ${react ? "import { createRoot } from 'react-dom/client'" : "import { render } from 'preact'"}
          window.mount = (options) => {
            window.log = { requests: [], changes: [] }
            function App() {
              const [value, setValue] = React.useState(options.value)
              window.setValue = setValue
              window.ownerValue = value
              const props = { value, defaultValue: options.defaultValue, name: 'date', locale: 'en-US' }
              const child = options.inputDate
                ? React.createElement(InputDate, { ...props, onValueChange: next => setValue(next) })
                : React.createElement(Calendar, {
                    ...props,
                    onStateChange: (event, detail) => {
                      window.log.requests.push(detail)
                      if (window.veto) event.preventDefault()
                      if (options.accept && value !== undefined) setValue(detail.next ?? '')
                    },
                    onValueChange: (_event, attrs) => window.log.changes.push(attrs.value),
                  })
              return React.createElement('form', { id: 'form' }, child)
            }
            const root = document.createElement('div')
            document.body.append(root)
            ${react ? 'createRoot(root).render(React.createElement(App))' : 'render(React.createElement(App), root)'}
          }
        `,
        resolveDir: process.cwd(),
      },
      bundle: true, write: false, outfile: 'calendar-fixture.js', format: 'iife', target: 'es2022',
      jsx: 'automatic', jsxImportSource: '@antadesign/anta',
      nodePaths: [resolve('site/node_modules')],
      alias: {
        '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
        '@antadesign/anta': resolve('src/index.ts'),
        ...(react ? { 'react-dom/client': requirePlot.resolve('react-dom/client') } : { react: requireSite.resolve('preact/compat') }),
      },
    })
    fixtures.set(framework, result.outputFiles.find(file => file.path.endsWith('.js')).text)
  }
  for (const engine of engines) {
    browsers.set(engine, await engine.launch({
      headless: true,
      ...(engine === chromium ? { channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined } : {}),
    }))
  }
})

after(async () => Promise.all([...browsers.values()].map(browser => browser.close())))

async function pageFor(t, engine, framework, options, delayed = false) {
  const page = await browsers.get(engine).newPage()
  t.after(() => page.close())
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, []))
  await page.addStyleTag({ content: elements.outputFiles.find(file => file.path.endsWith('.css')).text })
  const register = () => page.addScriptTag({ content: elements.outputFiles.find(file => file.path.endsWith('.js')).text })
  if (!delayed) await register()
  if (framework) {
    await page.addScriptTag({ content: fixtures.get(framework) })
    await page.evaluate(options => window.mount(options), options)
    await page.waitForSelector('a-calendar', { state: 'attached' })
  }
  if (delayed) await register()
  return page
}

const snapshot = page => page.evaluate(() => {
  const calendar = document.querySelector('a-calendar')
  return {
    value: calendar.value,
    state: calendar.getAttribute('state'),
    legacy: calendar.getAttribute('value'),
    form: new FormData(document.querySelector('form')).get('date'),
    selected: calendar.querySelector('[data-part="day-cell"][selected]')?.getAttribute('data-date') ?? null,
    filled: calendar.matches(':state(filled)'),
  }
})

async function pick(page, date) {
  await page.locator(`a-calendar [data-date="${date}"]`).evaluate(cell => cell.click())
}

async function expectDate(page, date) {
  await page.waitForFunction(date => document.querySelector('a-calendar [selected]')?.getAttribute('data-date') === date, date)
  const state = await snapshot(page)
  assert.equal(state.value, date)
  assert.equal(state.form, date)
  assert.equal(state.filled, true)
}

for (const engine of engines) {
  for (const framework of ['React', 'Preact']) {
    for (const delayed of [false, true]) {
      test(`${engine.name()}: ${framework} controlled Calendar round-trips ${delayed ? 'before' : 'after'} registration`, async t => {
        const page = await pageFor(t, engine, framework, { value: '2026-10-08', accept: true }, delayed)
        await expectDate(page, '2026-10-08')
        assert.deepEqual(await page.evaluate(() => window.log), { requests: [], changes: [] })
        for (const date of ['2026-10-07', '2026-10-08']) {
          await pick(page, date)
          await expectDate(page, date)
        }
        assert.deepEqual(await page.evaluate(() => window.log.changes), ['2026-10-07', '2026-10-08'])
        assert.equal((await snapshot(page)).legacy, null)
        await page.evaluate(() => window.setValue(''))
        await page.waitForFunction(() => document.querySelector('a-calendar').getAttribute('state') === '')
        assert.deepEqual(await snapshot(page), { value: '', state: '', legacy: null, form: null, selected: null, filled: false })
      })
    }

    test(`${engine.name()}: ${framework} controlled Calendar rejects repeated picks without changing its form value`, async t => {
      const page = await pageFor(t, engine, framework, { value: '2026-10-08', accept: false })
      await page.evaluate(() => {
        window.mutations = []
        new MutationObserver(records => window.mutations.push(...records.map(record => record.attributeName)))
          .observe(document.querySelector('a-calendar'), { attributes: true })
      })
      await pick(page, '2026-10-07')
      await pick(page, '2026-10-07')
      await expectDate(page, '2026-10-08')
      assert.deepEqual(await page.evaluate(() => ({ log: window.log, mutations: window.mutations })), {
        log: { requests: Array.from({ length: 2 }, () => ({ next: '2026-10-07', prev: '2026-10-08', reason: 'user' })), changes: [] },
        mutations: [],
      })
    })

    test(`${engine.name()}: ${framework} removing controlled Calendar state keeps the latest accepted selection`, async t => {
      const page = await pageFor(t, engine, framework, { value: '2026-10-08' })
      await page.evaluate(() => window.setValue('2026-10-07'))
      await expectDate(page, '2026-10-07')
      await page.evaluate(() => window.setValue(undefined))
      await page.waitForFunction(() => !document.querySelector('a-calendar').hasAttribute('state'))
      await expectDate(page, '2026-10-07')
      await pick(page, '2026-10-08')
      await expectDate(page, '2026-10-08')
      assert.deepEqual(await page.evaluate(() => window.log.changes), ['2026-10-07', '2026-10-08'])
    })

    test(`${engine.name()}: ${framework} uncontrolled Calendar supports veto, reset, and restore`, async t => {
      const page = await pageFor(t, engine, framework, { defaultValue: '2026-10-08' })
      await expectDate(page, '2026-10-08')
      await page.evaluate(() => window.veto = true)
      await pick(page, '2026-10-07')
      await expectDate(page, '2026-10-08')
      await page.evaluate(() => window.veto = false)
      await pick(page, '2026-10-07')
      await expectDate(page, '2026-10-07')
      await page.evaluate(() => document.querySelector('form').reset())
      await expectDate(page, '2026-10-08')
      await page.locator('a-calendar').evaluate(calendar => calendar.formStateRestoreCallback('2026-10-06'))
      await expectDate(page, '2026-10-06')
      assert.deepEqual(await page.evaluate(() => window.log.changes), ['2026-10-07', '2026-10-08', '2026-10-06'])
    })

    test(`${engine.name()}: ${framework} controlled InputDate can select a previous date again`, async t => {
      const page = await pageFor(t, engine, framework, { inputDate: true, value: '2026-10-08' })
      await expectDate(page, '2026-10-08')
      for (const date of ['2026-10-07', '2026-10-08']) {
        await pick(page, date)
        await expectDate(page, date)
      }
    })
  }

  for (const attribute of ['state', 'value']) {
    test(`${engine.name()}: raw Calendar preserves ${attribute} compatibility and selection after removal or reconnection`, async t => {
      const page = await pageFor(t, engine)
      await page.setContent(`<form><a-calendar name="date" ${attribute}="2026-10-08" ${attribute === 'state' ? 'default-state' : 'defaultvalue'}="2026-10-06"><button type="button" data-part="day-cell" data-date="2026-10-07">7</button></a-calendar></form>`)
      const result = await page.locator('a-calendar').evaluate((calendar, attribute) => {
        const form = calendar.closest('form')
        const read = () => ({ value: calendar.value, form: new FormData(form).get('date') })
        const initial = read()
        calendar.setAttribute(attribute, '2026-10-07')
        const updated = read()
        form.reset()
        const controlledReset = read()
        calendar.formStateRestoreCallback('2026-10-06')
        const controlledRestore = read()
        calendar.removeAttribute(attribute)
        const removed = read()
        calendar.remove()
        form.append(calendar)
        const reconnected = read()
        form.reset()
        const reset = read()
        calendar.formStateRestoreCallback('2026-10-08')
        const restored = read()
        const readonly = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(calendar), 'value').set === undefined
        const attributes = calendar.outerHTML
        calendar.querySelector('button').click()
        return { initial, updated, controlledReset, controlledRestore, removed, reconnected, reset, restored, readonly, unchanged: calendar.outerHTML === attributes, picked: read() }
      }, attribute)
      const date = value => ({ value, form: value })
      assert.deepEqual(result, {
        initial: date('2026-10-08'), updated: date('2026-10-07'), controlledReset: date('2026-10-07'), controlledRestore: date('2026-10-07'),
        removed: date('2026-10-07'), reconnected: date('2026-10-07'),
        reset: date('2026-10-06'), restored: date('2026-10-08'), readonly: true, unchanged: true, picked: date('2026-10-07'),
      })
    })
  }
}
