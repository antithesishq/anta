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

const row = size => `<section data-size="${size}">
  <a-button size="${size}"><a-button-label>Button</a-button-label></a-button>
  <a-tabs size="${size}"><a-tab value="one"><a-tab-label>Tab</a-tab-label></a-tab></a-tabs>
  <a-steps><a-tabs data-steps size="${size}"><a-tab value="one"><a-step-marker>1</a-step-marker><a-step-desc><a-tab-label>Step</a-tab-label><a-step-hint>Hint</a-step-hint></a-step-desc></a-tab></a-tabs></a-steps>
  <a-input size="${size}" value="Text"><span slot="label">Label</span><span slot="hint">Hint</span><a-button slot="trailing"><a-button-label>Go</a-button-label></a-button></a-input>
  <a-input size="${size}" rows="2" value="Text"><span slot="hint">Hint</span></a-input>
  <a-input-time size="${size}" locale="en-GB" value="13:05"><span slot="hint">Hint</span></a-input-time>
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
  for (const mode of ['reset', 'no-reset', 'native-select']) {
    const result = await build({
      stdin: {contents: `import './src/tokens.css'; ${mode === 'native-select' ? "import './src/elements/a-select.css';" : "import './src/elements';"} ${mode === 'reset' ? "import './src/reset.css';" : ''}`, resolveDir: process.cwd()},
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
      scope.style.setProperty(`--line-height-${family}${size}`, `${28 + index * 2}px`)
    }
  }, {family, sizes})
}

for (const engine of engines) {
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
          fixture.style.setProperty(`--line-height-hint-${size}`, '34px')
        }
      })
      assert.deepEqual(await measure(), before)
      await page.locator('#compact').evaluate(fixture => {
        for (const [index, size] of ['extra-small', 'small', 'medium'].entries()) {
          fixture.style.setProperty(`--font-size-${size}`, `${14 + index}px`)
          fixture.style.setProperty(`--line-height-${size}`, `${20 + index * 2}px`)
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
      for (const level of before.levels) for (const pair of level) assert.deepEqual(pair, level[0])
      assert.deepEqual(before.dialog, before.levels[3][0])
      await page.evaluate(() => {
        for (let level = 1; level <= 6; level++) {
          document.documentElement.style.setProperty(`--font-size-heading-${level}`, `${31 - level}px`)
          document.documentElement.style.setProperty(`--line-height-heading-${level}`, `${43 - level}px`)
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
      assert.deepEqual(await page.locator('#bodies details > a-text').evaluate(element => [getComputedStyle(element).fontSize, getComputedStyle(element).lineHeight]), ['13px', '18px'])
      assert.deepEqual(await page.locator('#bodies details > h3').evaluate(element => [getComputedStyle(element).fontSize, getComputedStyle(element).lineHeight]), ['20px', '26px'])
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--font-size-medium', '18px')
        document.documentElement.style.setProperty('--line-height-medium', '26px')
      })
      for (const pair of await measure()) assert.deepEqual(pair, ['18px', '26px'])
    } finally {await page.close()}
  })

  test.fast(`${engine.name()}: native options share Menu Item typography without registration`, async () => {
    const page = await browsers.get(engine).newPage()
    try {
      await page.goto(`${origin}/?mode=native-select`)
      const pairs = await page.evaluate(() => {
        const menu = document.createElement('a-menu-item')
        menu.innerHTML = '<a-menu-item-label>Label</a-menu-item-label><a-menu-item-hint>Hint</a-menu-item-hint>'
        const select = document.createElement('select')
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
      await page.addStyleTag({content: '@layer anta.theme { :root { --font-size-medium: 19px; --line-height-medium: 28px; } }'})
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
          for (const hint of current.hints) assert.deepEqual(hint, [`${18 + index}px`, `${28 + index * 2}px`])
          assert.deepEqual(current.markOffsets, baseline[index].markOffsets)
          assert.deepEqual(current.explicitHint, ['19px', '30px'])
        }
        await override(page, '')
        const labelsChanged = await metrics(page)
        for (const [index, current] of labelsChanged.entries()) {
          assert.deepEqual(current.hints, baseline[index].hints, `${mode}/${theme}: main overrides retain hints`)
          for (const label of current.labels) assert.deepEqual(label, [`${18 + index}px`, `${28 + index * 2}px`])
          assert.deepEqual(current.nativeSelect, [`${18 + index}px`, engine === firefox ? 'normal' : `${28 + index * 2}px`])
          assert.deepEqual(current.explicitRadio, ['19px', '30px'])
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
      for (const [index, offset] of after.markOffsets.entries()) assert.equal(offset - before[0].markOffsets[index], 5)
    } finally { await page.close() }
  })
}
