import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
let browser, assets

before(async () => {
  const result = await build({
    stdin: {
      contents: `import { h, render } from 'preact'
        import { configure } from './src/jsx-runtime'
        import { Button, Input, Tag } from './src/index'
        import './src/tokens.css'
        import './src/elements/a-button'
        import './src/elements/a-input'
        import './src/elements/a-tag'
        configure(h)
        render(<>
          <Button id="button">Button</Button>
          <Button id="link" href="/">Link</Button>
          <Button id="custom-button" round={6}>Custom</Button>
          <Input id="input" value="Text" />
          <Input id="custom-input" round={8} value="Custom" />
          <Tag id="tag">Tag</Tag>
          <button data-anta id="native-button">Native</button>
          <input data-anta id="native-input" value="Native" />
          <textarea data-anta id="native-textarea">Native</textarea>
          <section className="light"><Button id="scoped-button">Scoped</Button></section>
        </>, document.body)`,
      resolveDir: resolve('.'), loader: 'tsx',
    },
    bundle: true, write: false, outfile: 'fixture.js', format: 'esm', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('site/node_modules')],
    alias: { react: requireSite.resolve('preact/compat') },
  })
  assets = new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/fixture.css' : '/fixture.js', file.text]))
  for (const theme of ['antune', 'antithesis']) {
    assets.set(`/${theme}.css`, await readFile(new URL(`../src/theme-${theme}.css`, import.meta.url), 'utf8'))
  }
  assets.set('/none.css', '')
  browser = await chromium.launch({ channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
})
after(async () => browser?.close())

test('Antithesis shapes and seeds follow the theme, preserving explicit rounding', async t => {
  const page = await browser.newPage()
  t.after(() => page.close())
  await page.route('http://themes.test/**', route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({
      contentType: path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : 'text/html',
      body: assets.get(path) ?? '<!doctype html><link rel="stylesheet" href="/fixture.css"><link id="theme" rel="stylesheet" href="/antithesis.css"><script type="module" src="/fixture.js"></script>',
    })
  })
  await page.goto('http://themes.test/')
  await page.waitForFunction(() => document.querySelector('#input')?.shadowRoot)
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark)
    const values = await page.evaluate(() => {
      const radius = id => {
        const el = document.getElementById(id)
        return getComputedStyle(el.shadowRoot?.querySelector('[part="field"]') ?? el).borderTopLeftRadius
      }
      return {
        radii: ['button', 'link', 'custom-button', 'input', 'custom-input', 'tag', 'native-button', 'native-input', 'native-textarea'].map(radius),
        seeds: ['button', 'scoped-button'].map(id => {
          const style = getComputedStyle(document.getElementById(id))
          return ['--anta-seed-brand', '--anta-seed-neutral'].map(key => style.getPropertyValue(key).trim())
        }),
      }
    })
    assert.deepEqual(values.radii, ['999px', '999px', '6px', '0px', '8px', '1px', '999px', '0px', '0px'])
    assert.deepEqual(values.seeds, [['#cc4636', '#65605b'], ['#cc4636', '#65605b']])
  }
  for (const theme of ['antune', 'none', 'antithesis']) {
    await page.evaluate(theme => new Promise(resolve => {
      const link = document.getElementById('theme')
      link.onload = resolve
      link.href = `/${theme}.css`
    }), theme)
    assert.equal(await page.locator('#button').evaluate(el => getComputedStyle(el).borderTopLeftRadius), theme === 'antithesis' ? '999px' : '4px')
    assert.equal(await page.locator('#tag').evaluate(el => getComputedStyle(el).borderTopLeftRadius), theme === 'antithesis' ? '1px' : '22px')
  }
})
