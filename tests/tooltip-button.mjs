import assert from 'node:assert/strict'
import { componentTest as test } from './component-tier.mjs'
import { build } from 'esbuild'
import { Module, createRequire } from 'node:module'
import { resolve } from 'node:path'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')

test.fast('Tooltip children preserve Button classification across renderers', async () => {
  const result = await build({
    stdin: { contents: `export { Button, Tooltip, configure } from './src/index'; export { jsx, Fragment } from './src/jsx-runtime'`, resolveDir: resolve('.') },
    bundle: true, write: false, platform: 'node', format: 'cjs',
    alias: { '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime') },
  })
  const compiled = new Module(resolve('tests/button-tooltip.cjs'))
  compiled._compile(result.outputFiles[0].text, compiled.id)
  const runtime = compiled.exports
  const preact = requireSite('preact')
  for (const renderer of [null, preact, { h: (type, props, ...children) => ({ type, props: { ...props, children } }), Fragment: Symbol('fragment') }]) {
    if (renderer) runtime.configure(renderer.h, renderer.Fragment)
    const tooltip = runtime.jsx(runtime.Tooltip, { children: 'Use regular expression' })
    const fragment = children => runtime.jsx(runtime.Fragment, { children })
    for (const href of [undefined, '/docs']) {
      for (const children of [undefined, tooltip, runtime.jsx('a-tooltip', { children: 'Hint' }), fragment([false, null, [tooltip]]), [false, tooltip], false, [], ' ', NaN]) {
        for (const name of [undefined, 'Use regular expression']) {
          const props = { icon: 'regex', children, href, ...(name ? { 'aria-label': name } : {}) }
          const node = runtime.Button(props)
          assert.equal(node.props['data-anta-icon-only'], '')
          assert.equal(node.props['aria-label'], name ?? 'regex')
        }
      }
      for (const props of [
        { label: 'Search', children: tooltip },
        { children: [tooltip, 'Search'] },
        { children: fragment([tooltip, runtime.jsx('span', { children: 'Search' })]) },
        { children: 0 },
        { children: runtime.jsx(() => null, {}) },
        { children: tooltip, iconTrailing: 'search' },
      ]) {
        const node = runtime.Button({ icon: 'regex', href, ...props })
        assert.equal(node.props['data-anta-icon-only'], undefined)
        assert.equal(node.props['aria-label'], undefined)
      }
    }
    for (const state of ['disabled', 'loading']) {
      const node = runtime.Button({ icon: 'regex', children: tooltip, [state]: true, onClick: () => {} })
      assert.equal(node.props['data-anta-icon-only'], '')
      assert.equal(node.props.tabIndex, -1)
      assert.equal(node.props.onClick, undefined)
      assert.equal(node.props['aria-disabled'], 'true')
    }
  }
})

test.fast('Tooltip Button actions stay square in Input and InputTime at every size', async t => {
  const result = await build({
    stdin: {
      contents: `import React from 'react'; import {render} from 'preact';
        import {Button, Tooltip, Input, InputTime} from './src/index';
        import './src/tokens.css'; import './src/elements/a-button'; import './src/elements/a-tooltip';
        import './src/elements/a-input'; import './src/elements/a-input-time'; import './src/elements/a-icon';
        const h = React.createElement;
        render(h(React.Fragment, null,
          ...[Input, InputTime].flatMap((Field, index) => ['small','medium','large'].map(size =>
            h(Field, {size, key: index+size, trailing: h(Button, {id: 'action-'+index+'-'+size, icon:'regex', size,
              'aria-label':'Use regular expression', onClick: () => window.clicks++}, h(Tooltip, {delay:0}, 'Use regular expression'))})))), document.getElementById('root'));
        window.clicks = 0;`,
      resolveDir: resolve('.'),
    },
    bundle: true, write: false, outfile: 'fixture.js', format: 'esm',
    alias: { '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime'), react: requireSite.resolve('preact/compat'), 'preact/hooks': requireSite.resolve('preact/hooks'), preact: requireSite.resolve('preact') },
  })
  const assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/fixture.css' : '/fixture.js', file.text]))
  const browser = await chromium.launch({ channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
  t.after(() => browser.close())
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('http://button.test/**', route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ contentType: path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : 'text/html',
      body: assets.get(path) ?? '<!doctype html><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script>' })
  })
  await page.goto('http://button.test')
  await page.waitForFunction(() => document.querySelectorAll('a-button[data-anta-icon-only]').length === 6 && customElements.get('a-input-time'))
  for (const button of await page.locator('a-button').all()) {
    const box = await button.boundingBox()
    assert.ok(Math.abs(box.width - box.height) < 1, JSON.stringify(box))
    await button.click()
    await button.focus()
    await page.keyboard.press('Enter')
  }
  const first = page.locator('a-button').first()
  await first.hover()
  await page.waitForFunction(() => document.querySelector('a-tooltip').shadowRoot.querySelector(':popover-open'))
  await first.focus()
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('a-tooltip').shadowRoot.querySelector(':popover-open'))
  assert.equal(await page.evaluate(() => window.clicks), 12)
  assert.deepEqual(errors, [])
})
