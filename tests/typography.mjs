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
  <a-input size="${size}" value="Text"><span slot="label">Label</span><span slot="hint">Hint</span></a-input>
  <a-input size="${size}" rows="2" value="Text"><span slot="hint">Hint</span></a-input>
  <a-input-time size="${size}" locale="en-GB" value="13:05"><span slot="hint">Hint</span></a-input-time>
  <a-checkbox size="${size}"><a-checkbox-label>Checkbox</a-checkbox-label><a-checkbox-hint>Hint</a-checkbox-hint></a-checkbox>
  <a-switch size="${size}"><a-switch-label>Switch</a-switch-label><a-switch-hint>Hint</a-switch-hint></a-switch>
  <a-radio-group size="${size}"><a-radio-group-label>Group label</a-radio-group-label><a-radio-group-hint>Group hint</a-radio-group-hint><a-radio-list><a-radio><a-radio-label>Option</a-radio-label><a-radio-hint>Hint</a-radio-hint></a-radio><a-radio size="medium"><a-radio-label>Explicit medium</a-radio-label><a-radio-hint>Hint</a-radio-hint></a-radio></a-radio-list></a-radio-group>
  <a-text size="${size}">Text</a-text>
  <input data-anta data-anta-size="${size}" value="Native">
  <textarea data-anta data-anta-size="${size}">Native</textarea>
</section>`

before(async () => {
  for (const mode of ['reset', 'no-reset']) {
    const result = await build({
      stdin: {contents: `import './src/tokens.css'; import './src/elements'; ${mode === 'reset' ? "import './src/reset.css';" : ''}`, resolveDir: process.cwd()},
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
          ...choices.map(element => element.querySelector(`${element.localName}-label`)), section.querySelector('a-text'), section.querySelector('input[data-anta]'), section.querySelector('textarea[data-anta]')].map(pair),
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
