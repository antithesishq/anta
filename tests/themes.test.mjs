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
        import { Button, Checkbox, Input, MenuItem, Select, Switch, Tag } from './src/index'
        import './src/tokens.css'
        import './src/elements/a-button'
        import './src/elements/a-input'
        import './src/elements/a-checkbox'
        import './src/elements/a-radio'
        import './src/elements/a-radio-group'
        import './src/elements/a-switch'
        import './src/elements/a-tab.css'
        import './src/elements/a-tag'
        configure(h)
        render(<>
          <Button id="button">Button</Button>
          <em id="italic">Italic</em>
          <Button id="link" href="/">Link</Button>
          <Button id="custom-button" round={6}>Custom</Button>
          <Input id="input" value="Text" />
          <Input id="custom-input" round={8} value="Custom" />
          <Tag id="tag">Tag</Tag>
          <Checkbox id="checkbox-all" tone="brand" defaultChecked>All</Checkbox>
          <Checkbox id="checkbox-selected" tone="brand" toneScope="selected">Selected only</Checkbox>
          <Checkbox id="checkbox-selected-on" tone="brand" toneScope="selected" defaultChecked>Selected only on</Checkbox>
          <Checkbox id="checkbox-custom" tone="#c026d3" toneScope="selected">Custom</Checkbox>
          <Switch id="switch-all" tone="critical">All</Switch>
          <Switch id="switch-selected" tone="critical" toneScope="selected">Selected only</Switch>
          <Switch id="switch-default">Default brand</Switch>
          <Switch id="switch-brand" tone="brand">Explicit brand</Switch>
          <a-radio-group id="radio-scope" tone="success" tone-scope="selected" state="a">
            <a-radio id="radio-inherit" value="a"><a-radio-label>Inherited scope</a-radio-label></a-radio>
            <a-radio id="radio-all" value="b" tone-scope="all"><a-radio-label>All scope</a-radio-label></a-radio>
          </a-radio-group>
          <MenuItem id="menu-unselected" tone="info" toneScope="selected" label="Unselected" />
          <MenuItem id="menu-selected" tone="info" toneScope="selected" selected label="Selected" />
          <Select tone="brand" toneScope="selected" defaultValue="a" options={[
            { value: 'a', label: 'Selected option' },
            { value: 'b', label: 'Unselected option' },
          ]} />
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
    const settings = [...source.matchAll(/font-(?:feature|variation)-settings\s*:\s*([^;]+)/g)]
    if (settings.some(([, value]) => value.trim() !== 'inherit')) violations.push(file.pathname)
  }
  assert.deepEqual(violations, [])
})

test('reference font descriptors expose supported TT Interphases axes', async () => {
  for (const theme of ['antune', 'antithesis']) {
    const source = await readFile(new URL(`../src/theme-${theme}.css`, import.meta.url), 'utf8')
    const faces = [...source.matchAll(/@font-face \{[\s\S]*?\}/g)]
      .map(([face]) => face)
      .filter(face => face.includes('font-family: "TT Interphases Pro Variable"'))
    assert.equal(faces.length, 2)
    const normal = faces.find(face => /font-style: normal/.test(face)) ?? ''
    const italic = faces.find(face => /font-style: italic/.test(face)) ?? ''
    for (const face of faces) {
      assert.match(face, /font-weight: 100 900/)
      assert.match(face, /font-stretch: 75% 100%/)
      assert.match(face, /font-feature-settings: "ss02", "ss05", "tnum"/)
      assert.doesNotMatch(face, /font-optical-sizing|"ital"/)
    }
    assert.match(normal, /font-variation-settings: "slnt" 0/)
    assert.match(italic, /font-variation-settings: "slnt" 11/)
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
      italic: read(document.getElementById('italic')),
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
  assert.equal(withTheme.root.variations, '"slnt" 0')
  assert.equal(withTheme.italic.variations, '"slnt" 11')
  assert.equal(withTheme.button.stretch, '88%')
  assert.equal(withTheme.tab.stretch, '88%')
  assert.equal(withTheme.inputAdornmentStretch, '88%')
  for (const feature of ['"ss01"', '"ss04"', '"ss05"']) {
    assert.match(withTheme.tag.features, new RegExp(feature))
  }
})

test('tone scope changes resting chrome without changing the tone identity', async t => {
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
  await page.waitForFunction(() => customElements.get('a-radio-group'))

  for (const theme of ['none', 'antune']) {
    if (theme !== 'none') {
      await page.evaluate(theme => new Promise(resolve => {
        const link = document.getElementById('theme')
        link.onload = resolve
        link.href = `/${theme}.css`
      }), theme)
    }
    const colors = await page.evaluate(() => {
      const pseudo = (id, part, property) =>
        getComputedStyle(document.getElementById(id), part).getPropertyValue(property)
      return {
        checkboxAllBorder: pseudo('checkbox-all', '::before', 'border-top-color'),
        checkboxSelectedBorder: pseudo('checkbox-selected', '::before', 'border-top-color'),
        checkboxAllFill: pseudo('checkbox-all', '::before', 'background-color'),
        checkboxSelectedFill: pseudo('checkbox-selected-on', '::before', 'background-color'),
        switchAllBorder: pseudo('switch-all', '::before', 'border-top-color'),
        switchSelectedBorder: pseudo('switch-selected', '::before', 'border-top-color'),
        switchDefaultBorder: pseudo('switch-default', '::before', 'border-top-color'),
        switchBrandBorder: pseudo('switch-brand', '::before', 'border-top-color'),
        radioInheritedBorder: pseudo('radio-inherit', '::before', 'border-top-color'),
        radioAllBorder: pseudo('radio-all', '::before', 'border-top-color'),
      }
    })
    assert.notEqual(colors.checkboxAllBorder, colors.checkboxSelectedBorder)
    assert.equal(colors.checkboxAllFill, colors.checkboxSelectedFill)
    assert.notEqual(colors.switchAllBorder, colors.switchSelectedBorder)
    assert.equal(colors.switchDefaultBorder, colors.switchBrandBorder)
    assert.notEqual(colors.radioInheritedBorder, colors.radioAllBorder)
  }

  assert.equal(await page.locator('#checkbox-selected').getAttribute('tone-scope'), 'selected')
  assert.equal(await page.locator('#checkbox-all').getAttribute('tone-scope'), null)
  assert.equal(await page.locator('#checkbox-custom').evaluate(el => el.style.getPropertyValue('--checkbox-tone-source')), '#c026d3')
  assert.equal(await page.locator('#menu-unselected').getAttribute('tone'), null)
  assert.equal(await page.locator('#menu-selected').getAttribute('tone'), 'info')
  const selectTones = await page.locator('a-menu-item[role="menuitemradio"]').evaluateAll(items =>
    items.map(item => item.getAttribute('tone')))
  assert.deepEqual(selectTones, ['brand', null])
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
