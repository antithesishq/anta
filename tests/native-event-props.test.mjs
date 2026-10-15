import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { Module } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'

let runtime
before(async () => {
  const result = await build({
    stdin: {
      contents: `export * from './src/jsx-runtime';
        export { Input } from './src/components/Input';
        export { Banner } from './src/components/Banner';
        export { Expander } from './src/components/Expander';
        export { Text } from './src/components/Text';`,
      resolveDir: process.cwd(),
    },
    bundle: true, write: false, platform: 'node', format: 'cjs',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    alias: { '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts') },
  })
  const compiled = new Module(resolve('tests/native-event-props.fixture.cjs'))
  compiled._compile(result.outputFiles[0].text, compiled.id)
  runtime = compiled.exports
})

// A worker renderer keeps event functions in its projection for the UI bridge.
const h = (type, props, ...children) => {
  const attributes = { ...props, ...(children.length ? { children: children.length === 1 ? children[0] : children } : {}) }
  return typeof type === 'function' ? type(attributes) : { type, props: attributes }
}
const event = detail => ({ target: 'field', currentTarget: 'field', detail })

test('worker Input projection forwards edits and clear callbacks without lifecycle hooks', () => {
  runtime.configure(h, Symbol.for('fragment'), {})
  let value, canceled = false
  const field = runtime.Input({
    label: 'Draft',
    onValueChange: (_, attrs) => { value = attrs },
    onClearClick: e => e.preventDefault(),
  })
  assert.equal(field.type, 'a-input')
  field.props.oninput({ target: { value: 'Updated', name: 'draft', validity: { valid: true } } })
  assert.deepEqual(value, { value: 'Updated', name: 'draft', empty: false, valid: true, validationMessage: '' })
  field.props.onclearclick({ preventDefault: () => { canceled = true } })
  assert.equal(canceled, true)
})

test('worker Banner and Expander expose their callbacks in the first projection', () => {
  runtime.configure(h, Symbol.for('fragment'), {})
  let dismissed = 0, request
  const banner = runtime.Banner({ message: 'Saved', onDismiss: () => dismissed++ })
  banner.props.onstatechange(event({ next: 'closed', prev: 'open' }))
  assert.equal(dismissed, 1)
  banner.props.onstatechange({ target: 'child', currentTarget: 'field', detail: { next: 'closed' } })
  assert.equal(dismissed, 1)
  const expander = runtime.Expander({ title: 'Details', onStateChange: (e, detail) => { request = detail; e.preventDefault() } })
  let canceled = false
  expander.props.onstatechange({ ...event({ next: 'open', prev: 'closed' }), preventDefault: () => { canceled = true } })
  assert.deepEqual(request, { next: true, prev: false })
  assert.equal(canceled, true)
})

test('worker expandable Text can subscribe without running a layout effect', () => {
  let presentation
  runtime.configure(h, Symbol.for('fragment'), {
    useState: initial => [initial, next => { presentation = typeof next === 'function' ? next(initial) : next }],
    useMemo: factory => factory(),
  })
  const text = runtime.Text({ truncate: 2, expandable: true, expandableInert: true, children: 'Long content' })
  assert.equal(text.type, 'a-text')
  text.props.ontextpresentationchange(event({ expanded: true, overflowing: true }))
  assert.deepEqual(presentation, { expanded: true, overflowing: true })
})

test('configure replaces the hooks object and reports missing hooks without retaining previous ones', () => {
  runtime.configure(h, undefined, { useId: () => 'first', useState: initial => [initial, () => {}] })
  assert.equal(runtime.useId(), 'first')
  const hooks = { useState: initial => [initial, () => {}] }
  runtime.configure(h, undefined, hooks)
  assert.equal(runtime.useState('second')[0], 'second')
  assert.throws(() => runtime.useId(), /configured renderer is missing useId/)
  assert.throws(() => runtime.useLayoutEffect(() => {}), /configured renderer is missing useLayoutEffect/)
})

test('browser Input reports the missing configured effect instead of invoking React hooks', () => {
  runtime.configure(h, undefined, { useState: initial => [initial, () => {}] })
  globalThis.window = {}
  try {
    assert.throws(() => runtime.Input({ label: 'Name' }), /configured renderer is missing useLayoutEffect/)
  } finally {
    delete globalThis.window
  }
})

test('Preact without React aliases renders all shared listener consumers with a hooks namespace', async t => {
  const { createRequire } = await import('node:module')
  const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
  const { chromium } = requireSite('playwright')
  const result = await build({
    stdin: {
      contents: `
        import { h, Fragment, render } from 'preact'
        import * as hooks from 'preact/hooks'
        import { configure } from './src/jsx-runtime'
        import { Input } from './src/components/Input'
        import { Banner } from './src/components/Banner'
        import { Expander } from './src/components/Expander'
        import { Text } from './src/components/Text'
        import './src/tokens.css'
        import './src/reset.css'
        import './src/elements/a-input'
        import './src/elements/a-banner'
        import './src/elements/a-expander'
        import './src/elements/a-text'
        import './src/elements/a-button'
        import './src/elements/a-icon'
        configure(h, Fragment, hooks)
        window.reports = []
        window.show = version => render(<>
          <Input label="Draft" defaultValue="Original" clearable
            onValueChange={(_, attrs) => reports.push([version, attrs.value])} />
          <Banner message="Saved" onDismiss={() => reports.push(['dismiss'])} />
          <Expander title="Details" onStateChange={(_, attrs) => reports.push(['expand', attrs.next])}>Details content</Expander>
          <Text truncate={1} expandable expandableInert style={{width:'100px'}}>{'Long content '.repeat(30)}</Text>
        </>, document.getElementById('mount'))
        show('first')
      `,
      resolveDir: process.cwd(), loader: 'tsx',
    },
    bundle: true, write: false, outfile: 'fixture.js', format: 'esm',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    alias: { '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts') },
    nodePaths: [resolve('site/node_modules')],
  })
  const browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
  t.after(() => browser.close())
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/fixture.css' : '/fixture.js', file.text]))
  await page.route('http://native-events.test/**', route => {
    const path = new URL(route.request().url()).pathname
    route.fulfill({ contentType: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html',
      body: assets.get(path) ?? '<!doctype html><link rel="stylesheet" href="/fixture.css"><main id="mount"></main><script type="module" src="/fixture.js"></script>' })
  })
  await page.goto('http://native-events.test/')
  const input = page.locator('a-input').locator('[part="input"]')
  await input.fill('Edited')
  await page.waitForFunction(() => reports.some(entry => entry[0] === 'first' && entry[1] === 'Edited'))
  await page.locator('a-input').evaluate(el => { window.originalField = el })
  await page.evaluate(() => show('second'))
  assert.equal(await page.locator('a-input').evaluate(el => el === originalField), true)
  assert.equal(await input.inputValue(), 'Edited')
  await page.locator('a-input [slot="clear"] a-button').click()
  await page.waitForFunction(() => reports.some(entry => entry[0] === 'second' && entry[1] === ''))
  await page.locator('a-banner-close a-button').click()
  await page.waitForFunction(() => reports.some(entry => entry[0] === 'dismiss'))
  await page.locator('a-expander').getByRole('button', { name: 'Details', exact: true }).click()
  await page.waitForFunction(() => reports.some(entry => entry[0] === 'expand' && entry[1] === true))
  await page.waitForFunction(() => document.querySelector('a-text-content')?.inert)
  await page.locator('a-text > a-button').click()
  await page.waitForFunction(() => !document.querySelector('a-text-content').inert)
  assert.deepEqual(errors, [])
})
