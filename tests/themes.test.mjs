import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { readFile, readdir } from 'node:fs/promises'
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
        import './src/elements/a-tab.css'
        import './src/elements/a-tag'
        configure(h)
        render(<>
          <Button id="button">Button</Button>
          <Button id="link" href="/">Link</Button>
          <Button id="custom-button" round={6}>Custom</Button>
          <Input id="input" value="Text" />
          <Input id="custom-input" round={8} value="Custom" />
          <Tag id="tag">Tag</Tag>
          <a-tab id="tab">Tab</a-tab>
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

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(async entry => {
    const url = new URL(entry.name, directory)
    return entry.isDirectory() ? sourceFiles(new URL(`${entry.name}/`, directory)) : [url]
  }))).flat()
}

test('font-specific features and variation axes stay out of core styles', async () => {
  const files = await sourceFiles(new URL('../src/', import.meta.url))
  const violations = []
  for (const file of files) {
    if (!/\.(?:css|ts|tsx)$/.test(file.pathname) || /\/theme-(?:antune|antithesis)\.css$/.test(file.pathname)) continue
    const source = await readFile(file, 'utf8')
    if (/font-(?:feature|variation)-settings\s*:/.test(source)) violations.push(file.pathname)
  }
  assert.deepEqual(violations, [])
})

test('reference font descriptors expose supported TT Interphases axes', async () => {
  for (const theme of ['antune', 'antithesis']) {
    const source = await readFile(new URL(`../src/theme-${theme}.css`, import.meta.url), 'utf8')
    const face = source.match(/@font-face \{[\s\S]*?\}/)?.[0] ?? ''
    assert.match(face, /font-style: oblique 0deg 11deg/)
    assert.match(face, /font-weight: 100 900/)
    assert.match(face, /font-stretch: 75% 100%/)
    assert.match(face, /font-feature-settings: "ss02", "ss05", "tnum"/)
    assert.doesNotMatch(face, /font-optical-sizing|font-variation-settings|"ital"/)
  }
})

test('theme-free typography stays neutral while reference themes restore their font treatment', async t => {
  const page = await browser.newPage()
  t.after(() => page.close())
  await page.route('http://themes.test/**', route => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({
      contentType: path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? 'text/javascript' : 'text/html',
      body: assets.get(path) ?? '<!doctype html><link rel="stylesheet" href="/fixture.css"><link id="theme" rel="stylesheet" href="/none.css"><script type="module" src="/fixture.js"></script>',
    })
  })
  await page.goto('http://themes.test/')
  await page.waitForFunction(() => document.querySelector('#input')?.shadowRoot)

  const typography = () => page.evaluate(() => {
    const read = element => {
      const style = getComputedStyle(element)
      return {
        features: style.fontFeatureSettings,
        variations: style.fontVariationSettings,
        stretch: style.fontStretch,
        numeric: style.fontVariantNumeric,
      }
    }
    return {
      root: read(document.documentElement),
      button: read(document.getElementById('button')),
      input: read(document.getElementById('input').shadowRoot.querySelector('input')),
      tab: read(document.getElementById('tab')),
      tag: read(document.getElementById('tag')),
      inputAdornmentStretch: getComputedStyle(document.getElementById('input'))
        .getPropertyValue('--_input-adornment-font-stretch').trim(),
    }
  })

  const withoutTheme = await typography()
  for (const value of Object.values(withoutTheme).filter(value => typeof value === 'object')) {
    assert.equal(value.features, 'normal')
    assert.equal(value.variations, 'normal')
  }
  assert.equal(withoutTheme.button.stretch, '100%')
  assert.equal(withoutTheme.input.stretch, '100%')
  assert.equal(withoutTheme.tab.stretch, '100%')
  assert.equal(withoutTheme.tag.numeric, 'lining-nums tabular-nums')
  assert.equal(withoutTheme.inputAdornmentStretch, '')

  await page.evaluate(() => new Promise(resolve => {
    const link = document.getElementById('theme')
    link.onload = resolve
    link.href = '/antune.css'
  }))
  const withTheme = await typography()
  assert.equal(withTheme.button.stretch, '88%')
  assert.equal(withTheme.tab.stretch, '88%')
  assert.equal(withTheme.inputAdornmentStretch, '88%')
  for (const feature of ['"ss01"', '"ss04"', '"ss05"']) {
    assert.match(withTheme.tag.features, new RegExp(feature))
  }
})

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
