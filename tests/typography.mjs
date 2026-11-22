import assert from 'node:assert/strict'
import { before, after } from 'node:test'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { componentTest as test, componentEngines } from './component-tier.mjs'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium, firefox, webkit } = requireSite('playwright')
const engines = componentEngines([chromium, firefox, webkit])
const sizes = ['small', 'medium', 'large']
const browsers = new Map(), assets = new Map()
let server, origin

// Unitless ratios can differ by one layout subpixel across browser engines.
const close = (actual, expected, message) => assert.ok(Math.abs(Number.parseFloat(actual) - expected) < 0.04, `${message ?? 'Measurement'}: ${actual}, expected ${expected}`)

function assertPair(actual, expected) {
  assert.equal(actual[0], expected[0])
  if (expected[1] === 'normal') assert.equal(actual[1], 'normal')
  else close(actual[1], Number.parseFloat(expected[1]))
}

const row = size => `<section data-size="${size}">
  <a-button size="${size}"><a-button-label>Button</a-button-label></a-button>
  <a-tabs size="${size}"><a-tab value="one"><a-tab-label>Tab</a-tab-label></a-tab></a-tabs>
  <a-steps><a-tabs data-steps size="${size}"><a-tab value="one"><a-step-marker>1</a-step-marker><a-step-desc><a-tab-label>Step</a-tab-label><a-step-hint>Hint</a-step-hint></a-step-desc></a-tab></a-tabs></a-steps>
  <a-input size="${size}" value="Text"><span slot="label">Label</span><span slot="hint">Hint</span><a-button slot="trailing"><a-button-label>Go</a-button-label></a-button></a-input>
  <a-input size="${size}" rows="2" value="Text"><span slot="hint">Hint</span></a-input>
  <a-input-time size="${size}" locale="en-GB" value="13:05"><span slot="hint">Hint</span><a-button slot="trailing"><a-button-label>Go</a-button-label></a-button></a-input-time>
  <a-checkbox size="${size}"><a-checkbox-label>Checkbox</a-checkbox-label><a-checkbox-hint>Hint</a-checkbox-hint></a-checkbox>
  <a-switch size="${size}"><a-switch-label>Switch</a-switch-label><a-switch-hint>Hint</a-switch-hint></a-switch>
  <a-radio-group size="${size}"><a-radio-group-label>Group label</a-radio-group-label><a-radio-group-hint>Group hint</a-radio-group-hint><a-radio-list><a-radio><a-radio-label>Option</a-radio-label><a-radio-hint>Hint</a-radio-hint></a-radio><a-radio size="medium"><a-radio-label>Explicit medium</a-radio-label><a-radio-hint>Hint</a-radio-hint></a-radio></a-radio-list></a-radio-group>
  <a-text size="${size}">Text</a-text>
  <input data-anta data-anta-size="${size}" value="Native">
  <textarea data-anta data-anta-size="${size}">Native</textarea>
  <select data-anta data-anta-size="${size}"><option>Native</option></select>
  <input type="file" data-anta data-anta-size="${size}">
</section>`

before(async () => {
  for (const mode of ['reset', 'no-reset', 'native-select', 'tooltip-only']) {
    const contents = mode === 'tooltip-only' ? "import './src/elements/a-tooltip';"
      : `import './src/tokens.css'; ${mode === 'native-select' ? "import './src/elements/a-select.css';" : "import './src/elements';"} ${mode === 'reset' ? "import './src/reset.css';" : ''}`
    const result = await build({
      stdin: {contents, resolveDir: process.cwd()},
      bundle: true, write: false, outfile: `${mode}.js`, format: 'esm', target: 'es2022',
      alias: {'@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'), react: requireSite.resolve('preact/compat')},
    })
    for (const file of result.outputFiles) assets.set(`/${mode}.${file.path.endsWith('.css') ? 'css' : 'js'}`, file.text)
  }
  for (const theme of ['antune', 'antithesis']) assets.set(`/${theme}.css`, await readFile(resolve(`src/theme-${theme}.css`), 'utf8'))
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost'), mode = url.searchParams.get('mode') ?? 'reset', theme = url.searchParams.get('theme') ?? 'none'
    res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : url.pathname.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(assets.get(url.pathname) ?? `<!doctype html><link rel="stylesheet" href="/${mode}.css">${theme === 'none' ? '' : `<link rel="stylesheet" href="/${theme}.css">`}<style>section{display:grid;grid-template-columns:repeat(4,240px);gap:12px;align-items:start;margin:20px}</style><main id="scope"><div class="light"><div class="dark">${sizes.map(row).join('')}</div></div></main><script type="module" src="/${mode}.js"></script>`)
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  origin = `http://127.0.0.1:${server.address().port}`
  for (const engine of engines) browsers.set(engine, await engine.launch({headless: true, ...(engine === chromium && process.env.CAPTURE_TEST_BROWSER_CHANNEL ? {channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL} : {})}))
})
after(async () => {
  await Promise.all([...browsers.values()].map(browser => browser.close()))
  if (server) await new Promise(r => server.close(r))
})

async function metrics(page) {
  return page.evaluate(() => {
    const pair = element => { const css = getComputedStyle(element); return [css.fontSize, css.lineHeight] }
    return [...document.querySelectorAll('section')].map(section => {
      const field = section.querySelector('a-input'), textarea = section.querySelector('a-input[rows]'), time = section.querySelector('a-input-time')
      const choices = ['a-checkbox', 'a-switch', 'a-radio'].map(tag => section.querySelector(tag))
      return {
        size: section.dataset.size,
        labels: [section.querySelector('a-button-label'), section.querySelector('a-tab-label'), section.querySelector('a-step-desc a-tab-label'),
          field.shadowRoot.querySelector('[part=input]'), field.shadowRoot.querySelector('[part=label]'), textarea.shadowRoot.querySelector('[part=input]'), time.shadowRoot.querySelector('[part=segments]'),
          ...choices.map(element => element.querySelector(`${element.localName}-label`)), section.querySelector('a-text'), section.querySelector('input[data-anta]'), section.querySelector('textarea[data-anta]'), section.querySelector('a-radio-group-label'), section.querySelector('input[type=file]')].map(pair),
        nativeSelect: pair(section.querySelector('select[data-anta]')),
        hints: [field.shadowRoot.querySelector('[part=hint]'), textarea.shadowRoot.querySelector('[part=hint]'), time.shadowRoot.querySelector('[part=hint]'),
          ...choices.map(element => element.querySelector(`${element.localName}-hint`)), section.querySelector('a-step-hint'), section.querySelector('a-radio-group-hint')].map(pair),
        explicitRadio: pair(section.querySelector('a-radio[size] a-radio-label')),
        explicitHint: pair(section.querySelector('a-radio[size] a-radio-hint')),
        markOffsets: choices.map(element => Number.parseFloat(getComputedStyle(element, '::before').marginBlockStart)),
      }
    })
  })
}

async function override(page, family) {
  await page.evaluate(({family, sizes}) => {
    const scope = document.querySelector('#scope')
    scope.removeAttribute('style')
    for (const [index, size] of sizes.entries()) {
      scope.style.setProperty(`--font-size-${family}${size}`, `${18 + index}px`)
      scope.style.setProperty(`--line-height-${family}${size}`, `calc(${28 + index * 2} / ${18 + index})`)
    }
  }, {family, sizes})
}

for (const engine of engines) {
  test.fast(`${engine.name()}: line-height ratios follow nested font sizes across text, controls, and headings`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      await page.goto(origin)
      await page.waitForFunction(() => customElements.get('a-input-time'))
      await page.evaluate(() => {
        const fixture = document.createElement('div')
        fixture.id = 'nested-leading'
        fixture.innerHTML = '<a-menu-item><a-menu-item-label>Label</a-menu-item-label><a-menu-item-hint>Hint</a-menu-item-hint></a-menu-item>'
          + ['small', 'medium', 'large'].map(size => `<a-tag size="${size}">Tag</a-tag><a-tag size="${size}" allcaps>Caps</a-tag>`).join('')
          + Array.from({length: 6}, (_, index) => `<a-title level="${index + 1}">Title</a-title>`).join('')
          + '<pre>Code block</pre>'
        document.body.append(fixture)
        const targets = document.querySelectorAll('a-input > [slot=label], a-input > [slot=hint], a-input-time > [slot=hint], a-button-label, a-tab-label, a-step-hint, a-checkbox-label, a-checkbox-hint, a-radio-group-label, a-radio-group-hint, a-switch-label, a-switch-hint, a-text, #nested-leading a-menu-item-label, #nested-leading a-menu-item-hint, #nested-leading a-tag, #nested-leading a-title, #nested-leading pre')
        for (const target of targets) {
          target.setAttribute('data-leading-parent', '')
          target.innerHTML = '<span class="light" style="font-size:2em"><span class="dark" style="font-size:0.5em">Nested text</span></span>'
        }
      })
      const measurements = await page.locator('[data-leading-parent]').evaluateAll(elements => elements.map(element => [element, element.firstElementChild, element.firstElementChild.firstElementChild].map(node => {
        const css = getComputedStyle(node)
        return [Number.parseFloat(css.fontSize), Number.parseFloat(css.lineHeight)]
      })))
      assert.ok(measurements.length > 50)
      for (const [parent, child, grandchild] of measurements) {
        close(child[0], parent[0] * 2)
        close(child[1], parent[1] * 2)
        close(grandchild[0], parent[0])
        close(grandchild[1], parent[1])
      }
    } finally {await page.close()}
  })

  test.fast(`${engine.name()}: menu and native group captions use compact globals across field sizes`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      await page.goto(`${origin}/?mode=native-select`)
      await page.evaluate(() => {
        const fixture = document.createElement('div')
        fixture.id = 'captions'
        fixture.innerHTML = ['small', 'medium', 'large'].map((size, index) => `<article style="font-size:${20 + index * 3}px"><a-menu-group><a-menu-group-label>Menu group</a-menu-group-label></a-menu-group><select data-anta data-anta-size="${size}"><optgroup label="Native group"><option>Option</option></optgroup></select></article>`).join('')
        document.body.append(fixture)
      })
      const measure = () => page.locator('#captions article').evaluateAll(articles => articles.map(article => [...article.querySelectorAll('a-menu-group-label, optgroup')].map(element => [getComputedStyle(element).fontSize, getComputedStyle(element).lineHeight])))
      for (const pairs of await measure()) for (const pair of pairs) assert.deepEqual(pair, ['12px', '16px'])
      assert.equal(await page.evaluate(() => !!customElements.get('a-menu-group')), false)
      await page.locator('#captions').evaluate(fixture => {
        fixture.style.setProperty('--font-size-tiny', '14px')
        fixture.style.setProperty('--line-height-tiny', 'calc(20 / 14)')
      })
      for (const pairs of await measure()) for (const pair of pairs) assert.deepEqual(pair, ['14px', '20px'])
    } finally {await page.close()}
  })

  test.fast(`${engine.name()}: inline code follows surrounding text while preformatted code inherits its block`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      await page.goto(origin)
      await page.evaluate(() => {
        const fixture = document.createElement('div')
        fixture.id = 'code'
        fixture.innerHTML = ['small', 'medium', 'large'].map(size => `<a-text size="${size}"><code>Inline</code><pre><code>Block</code></pre></a-text>`).join('') + '<div style="font-size:23px"><code>Custom parent</code><pre style="font-size:19px"><code>Custom block</code></pre></div>'
        document.body.append(fixture)
      })
      const sizes = await page.locator('#code > *').evaluateAll(parents => parents.map(parent => [...parent.querySelectorAll('code')].map(code => getComputedStyle(code).fontSize)))
      assert.deepEqual(sizes, [['12px', '13px'], ['14px', '13px'], ['16px', '13px'], ['22px', '19px']])
      await page.evaluate(() => document.documentElement.style.setProperty('--font-size-small', '17px'))
      assert.deepEqual(await page.locator('#code > *').evaluateAll(parents => parents.map(parent => [...parent.querySelectorAll('code')].map(code => getComputedStyle(code).fontSize))), [['16px', '13px'], ['14px', '13px'], ['16px', '13px'], ['22px', '19px']])
      const blocks = () => page.locator('#code pre').evaluateAll(elements => elements.map(element => [getComputedStyle(element).fontSize, getComputedStyle(element).lineHeight, getComputedStyle(element.querySelector('code')).fontSize, getComputedStyle(element.querySelector('code')).lineHeight]))
      await page.evaluate(() => document.documentElement.style.setProperty('--font-size-code-block-medium', '16px'))
      for (const [index, block] of (await blocks()).entries()) {
        const font = index < 3 ? 16 : 19
        assert.equal(block[0], `${font}px`)
        assert.equal(block[2], `${font}px`)
        close(block[1], font * 20 / 13)
        close(block[3], font * 20 / 13)
      }
      await page.evaluate(() => document.documentElement.style.setProperty('--line-height-code-block-medium', 'calc(24 / 16)'))
      assert.deepEqual(await blocks(), [...Array.from({length: 3}, () => ['16px', '24px', '16px', '24px']), ['19px', '28.5px', '19px', '28.5px']])
    } finally {await page.close()}
  })

  test.fast(`${engine.name()}: compact labels share main text sizes independently of hints`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      await page.goto(origin)
      await page.waitForFunction(() => customElements.get('a-slider'))
      await page.evaluate(() => {
        const fixture = document.createElement('div')
        fixture.id = 'compact'
        fixture.innerHTML = ['small', 'medium', 'large'].map(size => `<article><a-progress size="${size}" value="50"><a-progress-label>Progress</a-progress-label></a-progress><a-slider size="${size}" value="50"><span slot="markers">Marker</span></a-slider></article>`).join('')
        document.body.append(fixture)
      })
      const measure = () => page.locator('#compact article').evaluateAll(articles => articles.map(article => [...article.querySelectorAll('a-progress-label, [slot=markers]')].map(element => [getComputedStyle(element).fontSize, getComputedStyle(element).lineHeight])))
      const before = await measure()
      for (const [index, pairs] of before.entries()) for (const pair of pairs) assert.deepEqual(pair, [['12px', '16px'], ['13px', '18px'], ['15px', '22px']][index])
      await page.locator('#compact').evaluate(fixture => {
        for (const size of ['small', 'medium', 'large']) {
          fixture.style.setProperty(`--font-size-hint-${size}`, '23px')
          fixture.style.setProperty(`--line-height-hint-${size}`, 'calc(34 / 23)')
        }
      })
      assert.deepEqual(await measure(), before)
      await page.locator('#compact').evaluate(fixture => {
        for (const [index, size] of ['tiny', 'small', 'medium'].entries()) {
          fixture.style.setProperty(`--font-size-${size}`, `${14 + index}px`)
          fixture.style.setProperty(`--line-height-${size}`, `calc(${20 + index * 2} / ${14 + index})`)
        }
      })
      for (const [index, pairs] of (await measure()).entries()) for (const pair of pairs) assert.deepEqual(pair, [`${14 + index}px`, `${20 + index * 2}px`])
    } finally { await page.close() }
  })

  test.fast(`${engine.name()}: headings share all six levels and Dialog uses heading four`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      await page.goto(origin)
      await page.waitForFunction(() => customElements.get('a-dialog'))
      await page.evaluate(() => {
        const fixture = document.createElement('div')
        fixture.id = 'headings'
        fixture.innerHTML = Array.from({length: 6}, (_, index) => {
          const level = index + 1
          return `<article data-level="${level}"><h${level}>Heading</h${level}><a-title level="${level}">Title</a-title><a-expander-summary level="${level}">Summary</a-expander-summary><details data-anta level="${level}"><summary>Native summary</summary></details></article>`
        }).join('') + '<a-dialog><span slot="header">Dialog header</span></a-dialog>'
        document.body.append(fixture)
      })
      const measure = () => page.locator('#headings').evaluate(fixture => {
        const pair = element => {const css = getComputedStyle(element); return [css.fontSize, css.lineHeight]}
        return {levels: [...fixture.querySelectorAll('article')].map(article => [...article.querySelectorAll(':scope > :not(details), summary')].map(pair)), dialog: pair(fixture.querySelector('a-dialog').shadowRoot.querySelector('[part=header]'))}
      })
      const before = await measure()
      for (const [index, height] of (await page.locator('#headings summary').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height))).entries()) close(height, [44, 40, 36, 32, 32, 28][index])
      for (const level of before.levels) for (const pair of level) assert.deepEqual(pair, level[0])
      assert.deepEqual(before.dialog, before.levels[3][0])
      await page.evaluate(() => {
        for (let level = 1; level <= 6; level++) {
          document.documentElement.style.setProperty(`--font-size-heading-${level}`, `${31 - level}px`)
          document.documentElement.style.setProperty(`--line-height-heading-${level}`, `calc(${43 - level} / ${31 - level})`)
        }
      })
      const after = await measure()
      for (const [index, level] of after.levels.entries()) for (const pair of level) assert.deepEqual(pair, [`${30 - index}px`, `${42 - index}px`])
      assert.deepEqual(after.dialog, after.levels[3][0])
    } finally {await page.close()}
  })

  test.fast(`${engine.name()}: Card and disclosure bodies follow medium Text`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      await page.goto(origin)
      await page.waitForFunction(() => customElements.get('a-expander'))
      await page.evaluate(() => {
        const fixture = document.createElement('div')
        fixture.id = 'bodies'
        fixture.innerHTML = '<a-text>Text</a-text><a-card><a-card-content>Card</a-card-content></a-card><a-expander><a-expander-summary>Title</a-expander-summary><a-expander-details>Details</a-expander-details></a-expander><details data-anta><summary>Native title</summary><div>Native details</div><a-text size="small">Small text</a-text><h3>Heading</h3></details>'
        document.body.append(fixture)
      })
      const measure = () => page.locator('#bodies').evaluate(fixture => [...fixture.querySelectorAll(':scope > a-text, a-card-content, a-expander-details, details > div')].map(element => {const css = getComputedStyle(element); return [css.fontSize, css.lineHeight]}))
      const before = await measure()
      for (const pair of before) assert.deepEqual(pair, before[0])
      assert.deepEqual(await page.locator(':root, #scope .light').evaluateAll(elements => elements.map(element => getComputedStyle(element).fontSize)), ['15px', '15px'])
      assert.deepEqual(await page.locator('#bodies details > a-text').evaluate(element => [getComputedStyle(element).fontSize, getComputedStyle(element).lineHeight]), ['13px', '18px'])
      assert.deepEqual(await page.locator('#bodies details > h3').evaluate(element => [getComputedStyle(element).fontSize, getComputedStyle(element).lineHeight]), ['20px', '26px'])
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--font-size-medium', '18px')
        document.documentElement.style.setProperty('--line-height-medium', 'calc(26 / 18)')
      })
      for (const pair of await measure()) assert.deepEqual(pair, ['18px', '26px'])
      assert.deepEqual(await page.locator(':root, #scope .light').evaluateAll(elements => elements.map(element => getComputedStyle(element).fontSize)), ['18px', '18px'])
    } finally {await page.close()}
  })

  test.fast(`${engine.name()}: native options share Menu Item typography without registration`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      await page.goto(`${origin}/?mode=native-select`)
      const pairs = await page.evaluate(() => {
        const menu = document.createElement('a-menu-item')
        menu.id = 'menu-typography'
        menu.innerHTML = '<a-menu-item-label>Label</a-menu-item-label><a-menu-item-hint>Hint</a-menu-item-hint>'
        const select = document.createElement('select')
        select.id = 'native-option-typography'
        select.setAttribute('data-anta', '')
        const option = document.createElement('option')
        option.textContent = 'Option'
        const hint = document.createElement('a-menu-item-hint')
        hint.textContent = 'Hint'
        option.append(hint)
        select.append(option)
        document.body.append(menu, select)
        const pair = element => {const css = getComputedStyle(element); return [css.fontSize, css.lineHeight]}
        return {menu: pair(menu.querySelector('a-menu-item-label')), option: pair(option), menuHint: pair(menu.querySelector('a-menu-item-hint')), optionHint: pair(hint), registered: !!customElements.get('a-menu-item')}
      })
      assert.deepEqual(pairs.menu, pairs.option)
      assert.deepEqual(pairs.menuHint, pairs.optionHint)
      assert.equal(pairs.registered, false)
      const measure = () => page.locator('#menu-typography a-menu-item-label, #menu-typography a-menu-item-hint, #native-option-typography option, #native-option-typography a-menu-item-hint').evaluateAll(elements => elements.map(element => [getComputedStyle(element).fontSize, getComputedStyle(element).lineHeight]))
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--font-size-medium', '21px')
        document.documentElement.style.setProperty('--font-size-hint-small', '19px')
      })
      assert.deepEqual(await measure(), [['14px', '20px'], ['12px', '16px'], ['14px', '20px'], ['12px', '16px']])
      await page.evaluate(() => document.documentElement.style.setProperty('--font-size-menu-medium', '16px'))
      const check = (pairs, hintFont) => {
        for (const [index, pair] of pairs.entries()) {
          const hint = index % 2 === 1
          assert.equal(pair[0], `${hint ? hintFont : 16}px`)
          assert.ok(Math.abs(Number.parseFloat(pair[1]) - (hint ? hintFont * 16 / 12 : 16 * 20 / 14)) < 0.02)
        }
      }
      check(await measure(), 12)
      await page.evaluate(() => document.documentElement.style.setProperty('--font-size-menu-hint-medium', '13px'))
      check(await measure(), 13)
    } finally {await page.close()}
  })

  test.fast(`${engine.name()}: menu ratios preserve row heights and center first-line indicators across themes`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      for (const theme of ['none', 'antune', 'antithesis']) {
        await page.goto(`${origin}/?theme=${theme}`)
        await page.waitForFunction(() => customElements.get('a-menu-item'))
        await page.evaluate(() => {
          const fixture = document.createElement('div')
          fixture.id = 'menu-rows'
          fixture.style.width = '240px'
          const indicators = {plain: '', icon: '<a-icon></a-icon>', checkbox: '<a-checkbox state="checked"></a-checkbox>', radio: '<a-radio></a-radio>', switch: '<a-switch data-menu-item-switch size="small" state="checked"></a-switch>', custom: '<span data-indicator style="font-size:24px"><svg width="16" height="16"></svg></span>'}
          indicators.tag = '<a-tag size="small"><a-tag-value>12</a-tag-value></a-tag>'
          for (const size of ['small', 'large']) {
            indicators[`checkbox-${size}`] = `<a-checkbox size="${size}" state="checked"></a-checkbox>`
            indicators[`radio-${size}`] = `<a-radio size="${size}"></a-radio>`
            indicators[`switch-${size}`] = `<a-switch data-menu-item-switch size="${size}" state="checked"></a-switch>`
          }
          const rows = Object.entries(indicators).map(([kind, indicator]) => [false, true].map(hint => `<a-menu-item data-kind="${kind}" data-hint="${hint}">${indicator}${hint ? '<a-menu-item-text><a-menu-item-label>Label</a-menu-item-label><a-menu-item-hint>Hint</a-menu-item-hint></a-menu-item-text>' : '<a-menu-item-label>Label</a-menu-item-label>'}</a-menu-item>`).join('')).join('') + '<a-menu-item data-kind="bare">Bare text</a-menu-item>'
          fixture.innerHTML = ['light', 'dark'].map(scheme => `<div class="${scheme}">${rows}</div>`).join('')
          document.body.append(fixture)
          for (const radio of fixture.querySelectorAll('a-radio')) radio.selected = true
        })
        const rows = await page.locator('#menu-rows a-menu-item').evaluateAll(elements => elements.map(row => {
          const label = row.querySelector('a-menu-item-label'), hint = row.querySelector('a-menu-item-hint')
          const labelBox = label?.getBoundingClientRect(), center = labelBox ? (labelBox.top + labelBox.bottom) / 2 : null
          const indicator = row.querySelector(':scope > a-icon, :scope > a-checkbox, :scope > a-radio, :scope > a-switch, :scope > a-tag, [data-indicator] svg')
          const indicatorBox = indicator?.getBoundingClientRect(), control = indicator && ['a-checkbox', 'a-radio', 'a-switch'].includes(indicator.localName)
          const pseudoCenter = pseudo => {
            const css = getComputedStyle(indicator, pseudo)
            return indicatorBox.top + Number.parseFloat(css.marginBlockStart) + Number.parseFloat(css.blockSize) / 2
          }
          const indicatorCenter = indicator ? (control ? pseudoCenter('::before') : (indicatorBox.top + indicatorBox.bottom) / 2) : null
          return {kind: row.dataset.kind, hint: !!hint, height: row.getBoundingClientRect().height, line: label ? getComputedStyle(label).lineHeight : null,
            hintLine: hint ? getComputedStyle(hint).lineHeight : null, gap: hint ? getComputedStyle(hint).marginBlockStart : null,
            offset: indicator ? indicatorCenter - center : null, glyphOffset: control ? pseudoCenter('::after') - indicatorCenter : null}
        }))
        for (const row of rows) {
          close(row.height, row.hint ? 48 : 30, `${theme}: ${row.kind} height`)
          if (row.line) assert.equal(row.line, '20px')
          if (row.hint) {assert.equal(row.hintLine, '16px'); assert.equal(row.gap, '2px')}
          if (row.offset !== null) assert.ok(Math.abs(row.offset) < 0.02, `${theme}: ${row.kind} first-line alignment: ${row.offset}`)
          if (row.glyphOffset !== null) assert.ok(Math.abs(row.glyphOffset) < 0.02, `${theme}: ${row.kind} glyph centering: ${row.glyphOffset}`)
        }
      }
    } finally {await page.close()}
  })

  test.fast(`${engine.name()}: menu Tag alignment follows row font and line-height overrides`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      for (const theme of ['none', 'antune', 'antithesis']) {
        await page.goto(`${origin}/?theme=${theme}`)
        await page.waitForFunction(() => customElements.get('a-menu-item'))
        await page.evaluate(() => {
          const fixture = document.createElement('div')
          fixture.id = 'menu-tag-overrides'
          fixture.style.width = '300px'
          const content = '<a-tag size="small"><a-tag-value>12</a-tag-value></a-tag><a-menu-item-text><a-menu-item-label>Label</a-menu-item-label><a-menu-item-hint>Hint</a-menu-item-hint></a-menu-item-text>'
          fixture.innerHTML = ['font-size:16px', 'line-height:28px', 'font-size:16px;line-height:32px'].map(style =>
            `<a-menu-item style="${style}">${content}</a-menu-item><a data-anta-menu-item style="${style}">${content}</a>`).join('')
          if (CSS.supports('appearance', 'base-select')) {
            const select = document.createElement('select')
            select.setAttribute('data-anta', '')
            select.innerHTML = '<option>Choose an option</option>'
            for (const style of ['font-size:16px', 'line-height:28px', 'font-size:16px;line-height:32px']) {
              const option = document.createElement('option')
              option.style.cssText = style
              option.innerHTML = content
              select.append(option)
            }
            fixture.append(select)
          }
          document.body.append(fixture)
        })
        if (await page.locator('#menu-tag-overrides select').count()) await page.locator('#menu-tag-overrides select').click()
        const offsets = await page.locator('#menu-tag-overrides a-menu-item, #menu-tag-overrides a[data-anta-menu-item], #menu-tag-overrides option:has(a-tag)').evaluateAll(rows => rows.map(row => {
          const label = row.querySelector('a-menu-item-label').getBoundingClientRect()
          const tag = row.querySelector('a-tag').getBoundingClientRect()
          return (tag.top + tag.bottom - label.top - label.bottom) / 2
        }))
        for (const offset of offsets) assert.ok(Math.abs(offset) < 0.02, `${theme}: Tag center offset ${offset}px`)
      }
    } finally {await page.close()}
  })

  test.fast(`${engine.name()}: Tag ratios preserve default pill heights and scale with their fonts`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      await page.goto(origin)
      await page.evaluate(() => {
        const fixture = document.createElement('div')
        fixture.id = 'tags'
        fixture.innerHTML = ['small', 'medium', 'large'].map(size => `<article><a-tag size="${size}">Tag</a-tag><a-tag size="${size}" allcaps>Tag</a-tag></article>`).join('')
        document.body.append(fixture)
      })
      const measure = () => page.locator('#tags article').evaluateAll(articles => articles.map(article => [...article.querySelectorAll('a-tag')].map(tag => ({font: getComputedStyle(tag).fontSize, line: getComputedStyle(tag).lineHeight, height: tag.getBoundingClientRect().height}))))
      const before = await measure()
      assert.deepEqual(before.map(tags => tags.map(tag => tag.font)), [['11px', '10px'], ['12px', '11px'], ['13px', '12px']])
      assert.deepEqual(before.map(tags => tags.map(tag => tag.line)), [['15px', '15px'], ['18px', '18px'], ['22px', '22px']])
      await page.locator('#tags').evaluate(fixture => {
        for (const [index, size] of ['micro', 'tiny', 'small'].entries()) fixture.style.setProperty(`--font-size-${size}`, `${12 + index * 2}px`)
      })
      const after = await measure()
      assert.deepEqual(after.map(tags => tags.map(tag => tag.font)), [['12px', '11px'], ['14px', '13px'], ['16px', '15px']])
      const ratios = [[15 / 11, 15 / 10], [18 / 12, 18 / 11], [22 / 13, 22 / 12]]
      for (const [index, tags] of after.entries()) for (const [variant, tag] of tags.entries()) {
        const expected = Number.parseFloat(tag.font) * ratios[index][variant]
        close(tag.line, expected)
        close(tag.height, expected + [2, 3, 3][index])
      }
      await page.locator('#tags').evaluate(fixture => {
        fixture.style.setProperty('--line-height-micro', '2')
        fixture.style.setProperty('--line-height-small', '2')
        fixture.style.setProperty('--line-height-medium', '2')
      })
      const changed = await measure()
      const adjustedRatios = [[2, 2 * 11 / 10], [2 * 13 / 12, 2 * 13 / 11], [2 * 15 / 13, 2 * 15 / 12]]
      for (const [index, tags] of changed.entries()) for (const [variant, tag] of tags.entries()) {
        assert.equal(tag.font, after[index][variant].font)
        close(tag.line, Number.parseFloat(tag.font) * adjustedRatios[index][variant])
      }
    } finally {await page.close()}
  })

  test.fast(`${engine.name()}: field action labels share field leading without changing action heights`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      await page.goto(origin)
      await page.waitForFunction(() => customElements.get('a-input-time'))
      const measure = () => page.locator('section').evaluateAll(sections => sections.map(section => {
        const buttons = [...section.querySelectorAll(':scope > a-button, a-input > a-button, a-input-time > a-button')]
        return buttons.map(button => ({
          leading: getComputedStyle(button.querySelector('a-button-label')).lineHeight,
          height: button.getBoundingClientRect().height,
        }))
      }))
      const before = await measure()
      for (const [index, buttons] of before.entries()) {
        assert.deepEqual(buttons.map(button => button.leading), Array(3).fill(`${[18, 22, 26][index]}px`))
        assert.deepEqual(buttons.map(button => button.height), [24 + index * 4, 20 + index * 4, 20 + index * 4])
      }
      await page.evaluate(() => {
        for (const [index, size] of ['small', 'medium', 'large'].entries()) document.documentElement.style.setProperty(`--line-height-${size}`, `calc(30 / ${[13, 15, 17][index]})`)
      })
      for (const buttons of await measure()) for (const button of buttons) assert.equal(button.leading, '30px')
    } finally {await page.close()}
  })

  test.fast(`${engine.name()}: Tooltip retains its own typography without tokens`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      await page.goto(`${origin}/?mode=tooltip-only`)
      await page.waitForFunction(() => customElements.get('a-tooltip'))
      await page.evaluate(() => {
        const trigger = document.createElement('button')
        trigger.style.cssText = 'font-size:32px;line-height:40px'
        trigger.innerHTML = 'Trigger<a-tooltip>Tooltip content</a-tooltip>'
        document.body.append(trigger)
      })
      const measure = () => page.locator('a-tooltip').evaluate(tooltip => {
        const css = getComputedStyle(tooltip.shadowRoot.querySelector('[part=bubble]'))
        return [css.fontSize, css.lineHeight]
      })
      assert.deepEqual(await measure(), ['14px', '20px'])
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--font-size-hint-medium', '16px')
        document.documentElement.style.setProperty('--line-height-hint-medium', 'calc(24 / 16)')
      })
      assert.deepEqual(await measure(), ['16px', '24px'])
    } finally {await page.close()}
  })

  test.fast(`${engine.name()}: shared compensation retains heights and field actions opt out`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      await page.goto(origin)
      await page.waitForFunction(() => customElements.get('a-input'))
      const measure = () => page.locator('section').evaluateAll(sections => sections.map(section => {
        const button = section.querySelector(':scope > a-button'), tab = section.querySelector(':scope > a-tabs > a-tab'), action = section.querySelector('a-input > a-button')
        return {heights: [button.offsetHeight, tab.offsetHeight, action.offsetHeight], padding: [button, tab, action].map(element => getComputedStyle(element.querySelector('a-button-label, a-tab-label')).paddingBottom)}
      }))
      const before = await measure()
      await page.evaluate(() => {
        for (const size of ['small', 'medium', 'large']) document.documentElement.style.setProperty(`--text-compensation-${size}`, '3px')
      })
      const after = await measure()
      for (const [index, current] of after.entries()) {
        assert.deepEqual(current.heights, before[index].heights)
        assert.deepEqual(current.padding, ['3px', '3px', '0px'])
      }
    } finally {await page.close()}
  })

  test.fast(`${engine.name()}: theme-layer typography overrides foundation defaults`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      await page.goto(origin)
      await page.waitForFunction(() => customElements.get('a-input'))
      const baseline = await metrics(page)
      await page.addStyleTag({content: '@layer anta.theme { :root { --font-size-medium: 19px; --line-height-medium: calc(28 / 19); } }'})
      const [, medium] = await metrics(page)
      for (const label of medium.labels) assert.deepEqual(label, ['19px', '28px'])
      assert.deepEqual(medium.hints, baseline[1].hints)
      // Firefox keeps platform select leading at `normal` despite authored CSS.
      assert.deepEqual(medium.nativeSelect, ['19px', engine === firefox ? 'normal' : '28px'])
    } finally { await page.close() }
  })

  test.fast(`${engine.name()}: label and hint globals remain independent through themes and nested color scopes`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      for (const mode of ['reset', 'no-reset']) for (const theme of ['none', 'antune', 'antithesis']) {
        await page.goto(`${origin}/?mode=${mode}&theme=${theme}`)
        await page.waitForFunction(() => customElements.get('a-input-time'))
        const baseline = await metrics(page)
        await override(page, 'hint-')
        const hintsChanged = await metrics(page)
        for (const [index, current] of hintsChanged.entries()) {
          assert.deepEqual(current.labels, baseline[index].labels, `${mode}/${theme}: hint overrides retain main text`)
          for (const hint of current.hints) assertPair(hint, [`${18 + index}px`, `${28 + index * 2}px`])
          assert.deepEqual(current.markOffsets, baseline[index].markOffsets)
          assertPair(current.explicitHint, ['19px', '30px'])
        }
        await override(page, '')
        const labelsChanged = await metrics(page)
        for (const [index, current] of labelsChanged.entries()) {
          assert.deepEqual(current.hints, baseline[index].hints, `${mode}/${theme}: main overrides retain hints`)
          for (const label of current.labels) assertPair(label, [`${18 + index}px`, `${28 + index * 2}px`])
          assertPair(current.nativeSelect, [`${18 + index}px`, engine === firefox ? 'normal' : `${28 + index * 2}px`])
          assertPair(current.explicitRadio, ['19px', '30px'])
        }
      }
    } finally { await page.close() }
  })

  test.fast(`${engine.name()}: direct font overrides reach Input parts and choice-control geometry`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      await page.goto(origin)
      await page.waitForFunction(() => customElements.get('a-input'))
      const before = await metrics(page)
      await page.locator('section').first().evaluate(section => {
        for (const element of section.querySelectorAll('a-input, a-input-time, a-checkbox, a-switch, a-radio:not([size])')) {
          element.style.fontSize = '19px'
          element.style.lineHeight = '28px'
        }
      })
      const [after] = await metrics(page)
      for (const index of [3, 4, 5, 6, 7, 8, 9]) assert.deepEqual(after.labels[index], ['19px', '28px'])
      assert.deepEqual(after.hints, before[0].hints)
      for (const [index, offset] of after.markOffsets.entries()) close(offset - before[0].markOffsets[index], 5)
    } finally { await page.close() }
  })
}
