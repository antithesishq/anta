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
        import { Expander, Icon } from './src/index'
        import './src/elements/a-expander'
        import './src/elements/a-icon'
        import './src/tokens.css'
        configure(h)
        render(<>
          <Expander title="Default" id="default">Body</Expander>
          <Expander title="Flush" id="outdent" priority="tertiary" outdent>Body</Expander>
          <Expander title="End" id="end" indicatorPlacement="end"
            actions={<button id="action" type="button">Action</button>}>Body</Expander>
          <Expander title="End flush" id="end-outdent" indicatorPlacement="end"
            priority="tertiary" outdent>Body</Expander>
          <Expander title="Pair" id="pair" indicatorPlacement="end"
            indicator={{ closed: <Icon shape="plus" />, open: <Icon shape="minus" /> }}>Body</Expander>
          <Expander title="Triangle" id="triangle" indicator="triangle">Body</Expander>
          <Expander title="Plus" id="plus" indicator="plus">Body</Expander>
          <Expander title="Typo" id="typo" indicator="chevrom">Body</Expander>
          <Expander title="Zero" id="zero" indicator={0}>Body</Expander>
          <Expander title="Empty" id="empty" indicator="">Body</Expander>
          <Expander title="False" id="false" indicator={false}>Body</Expander>
          <Expander title="Custom" id="custom" indicator={<Icon shape="chevron-down" />}>Body</Expander>
        </>, document.body)
      `,
      resolveDir: process.cwd(),
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    outfile: 'expander-indicator.js',
    format: 'iife',
    target: 'es2022',
    jsx: 'automatic',
    jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('site/node_modules')],
    alias: {
      '@antadesign/anta': resolve('src/index.ts'),
      '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
      react: requireSite.resolve('preact/compat'),
    },
  })
  script = result.outputFiles.find(file => file.path.endsWith('.js')).text
  css = result.outputFiles.find(file => file.path.endsWith('.css')).text
  browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
})

after(async () => browser?.close())

async function pageFor(t) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } })
  t.after(() => page.close())
  await page.addStyleTag({ content: `${css}\nbody { margin: 40px; } a-expander { width: 360px; }` })
  await page.addScriptTag({ content: script })
  return page
}

test('default indicator keeps the previous title, chevron, and outdent geometry', async t => {
  const page = await pageFor(t)
  const geometry = await page.evaluate(() => {
    const measure = id => {
      const host = document.getElementById(id)
      const button = host.shadowRoot.querySelector('button[part="summary"]')
      const indicator = host.shadowRoot.querySelector('[part="indicator"]')
      const title = host.querySelector('[slot="title"]')
      const box = node => node.getBoundingClientRect()
      return {
        height: box(button).height,
        titleInset: box(title).x - box(button).x,
        indicatorInset: box(indicator).x - box(button).x,
        indicatorHidden: indicator.getAttribute('aria-hidden'),
        indicatorInert: indicator.inert,
      }
    }
    return { normal: measure('default'), outdent: measure('outdent') }
  })
  assert.deepEqual(geometry.normal, {
    height: 32,
    titleInset: 24,
    indicatorInset: 6,
    indicatorHidden: 'true',
    indicatorInert: true,
  })
  assert.equal(geometry.outdent.titleInset, 0)
  assert.equal(geometry.outdent.indicatorInset, -18)

  await page.locator('#default').evaluate(host => host.shadowRoot.querySelector('button').click())
  assert.equal(await page.locator('#default').evaluate(host => host.shadowRoot.querySelector('button').getAttribute('aria-expanded')), 'true')
})

test('the pre-upgrade placeholder follows placement and yields to a custom indicator', async t => {
  const page = await browser.newPage()
  t.after(() => page.close())
  await page.setContent(`
    <a-expander id="start"><a-expander-summary>Start</a-expander-summary></a-expander>
    <a-expander id="end-skeleton" indicator-placement="end"><a-expander-summary>End</a-expander-summary></a-expander>
    <a-expander id="custom-skeleton"><a-expander-summary>Custom</a-expander-summary><span slot="indicator">◆</span></a-expander>
  `)
  await page.addStyleTag({ content: css })
  const styles = await page.evaluate(() => Object.fromEntries(
    ['start', 'end-skeleton', 'custom-skeleton'].map(id => {
      const summary = document.querySelector(`#${id} a-expander-summary`)
      const pseudo = getComputedStyle(summary, '::before')
      return [id, { display: pseudo.display, edge: id === 'end-skeleton' ? pseudo.insetInlineEnd : pseudo.insetInlineStart }]
    }),
  ))
  assert.deepEqual(styles, {
    start: { display: 'block', edge: '6px' },
    'end-skeleton': { display: 'block', edge: '6px' },
    'custom-skeleton': { display: 'none', edge: '6px' },
  })
})

test('end indicator toggles the summary while the actions column stays independent', async t => {
  const page = await pageFor(t)
  const end = page.locator('#end')
  const indicator = await end.evaluate(host => {
    const box = host.shadowRoot.querySelector('[part="indicator"]').getBoundingClientRect()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  })
  await end.evaluate(host => host.addEventListener('statechange', () => window.expanderChanges = (window.expanderChanges ?? 0) + 1))
  await page.locator('#action').click()
  assert.equal(await end.evaluate(host => host.shadowRoot.querySelector('button').getAttribute('aria-expanded')), 'false')
  assert.equal(await page.evaluate(() => window.expanderChanges ?? 0), 0)
  await page.locator('#action').evaluate(button => { button.disabled = true })
  const action = await page.locator('#action').boundingBox()
  await page.mouse.click(action.x + action.width / 2, action.y + action.height / 2)
  assert.equal(await end.evaluate(host => host.shadowRoot.querySelector('button').getAttribute('aria-expanded')), 'false')
  await page.locator('#action').evaluate(button => { button.disabled = false })
  await page.mouse.click(indicator.x, indicator.y)
  assert.equal(await end.evaluate(host => host.shadowRoot.querySelector('button').getAttribute('aria-expanded')), 'true')
  assert.equal(await page.evaluate(() => window.expanderChanges), 1)

  await end.evaluate(host => host.shadowRoot.querySelector('button').focus())
  await page.keyboard.press('Tab')
  assert.equal(await page.evaluate(() => document.activeElement.id), 'action')

  const flushInsets = await page.locator('#end-outdent').evaluate(host => {
    const title = host.querySelector('[slot="title"]').getBoundingClientRect()
    const details = host.querySelector('a-expander-details')
    const contentX = details.getBoundingClientRect().x + parseFloat(getComputedStyle(details).paddingInlineStart)
    return [title.x - host.getBoundingClientRect().x, contentX - host.getBoundingClientRect().x]
  })
  assert.deepEqual(flushInsets, [0, 0])
})

test('paired custom indicators switch inside an inert decorative slot', async t => {
  const page = await pageFor(t)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const pair = page.locator('#pair')
  const states = () => pair.evaluate(host => {
    const indicator = host.shadowRoot.querySelector('[part="indicator"]')
    const nodes = indicator.querySelector('slot').assignedElements()
    return {
      hidden: indicator.getAttribute('aria-hidden'),
      inert: indicator.inert,
      customClass: indicator.classList.contains('has-custom'),
      pairClass: indicator.classList.contains('has-pair'),
      transform: getComputedStyle(indicator).transform,
      visible: nodes.map(node => getComputedStyle(node).display !== 'none'),
    }
  })
  assert.deepEqual(await states(), {
    hidden: 'true', inert: true, customClass: false, pairClass: true, transform: 'none', visible: [true, false],
  })
  assert.match(await page.locator('#pair button[part="summary"]').ariaSnapshot(), /button "Pair"/)
  await pair.evaluate(host => host.shadowRoot.querySelector('button').click())
  assert.deepEqual(await states(), {
    hidden: 'true', inert: true, customClass: false, pairClass: true, transform: 'none', visible: [false, true],
  })
})

test('unrecognized primitive indicators suppress the built-in mark without rendering text', async t => {
  const page = await pageFor(t)
  for (const id of ['typo', 'zero', 'empty', 'false']) {
    const state = await page.locator(`#${id}`).evaluate(host => {
      const slot = host.shadowRoot.querySelector('slot[name="indicator"]')
      return {
        preset: host.getAttribute('indicator'),
        assigned: slot.assignedElements().length,
        text: slot.assignedElements()[0]?.textContent,
      }
    })
    assert.deepEqual(state, { preset: null, assigned: 1, text: '' })
  }
  assert.equal(await page.locator('#custom').evaluate(host =>
    host.shadowRoot.querySelector('slot[name="indicator"]').assignedElements()[0]?.querySelector('a-icon') != null
  ), true)
})

test('built-in triangle and plus use the shared indicator dimensions', async t => {
  const page = await pageFor(t)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const triangleMask = await page.locator('#triangle').evaluate(host => {
    const glyph = host.shadowRoot.querySelector('.indicator .glyph')
    return getComputedStyle(glyph).maskImage
  })
  assert.match(triangleMask, /svg/)
  const plus = page.locator('#plus')
  const bars = () => plus.evaluate(host => {
    const glyph = host.shadowRoot.querySelector('.indicator .glyph')
    return {
      horizontal: getComputedStyle(glyph, '::before').width,
      vertical: getComputedStyle(glyph, '::after').height,
      verticalTransform: getComputedStyle(glyph, '::after').transform,
    }
  })
  assert.deepEqual(await bars(), { horizontal: '12px', vertical: '12px', verticalTransform: 'none' })
  await plus.evaluate(host => host.shadowRoot.querySelector('button').click())
  assert.equal((await bars()).verticalTransform, 'matrix(1, 0, 0, 0, 0, 0)')
})

test('a hand-authored single indicator remains decorative and clicks the summary', async t => {
  const page = await pageFor(t)
  await page.evaluate(() => {
    const host = document.createElement('a-expander')
    host.id = 'raw'
    host.setAttribute('indicator-placement', 'end')
    host.innerHTML = '<a-expander-summary slot="title">Raw</a-expander-summary><span slot="indicator" tabindex="0">◆</span><a-expander-details>Body</a-expander-details>'
    document.body.append(host)
  })
  const raw = page.locator('#raw')
  const indicator = await raw.evaluate(host => {
    const box = host.shadowRoot.querySelector('[part="indicator"]').getBoundingClientRect()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  })
  await raw.locator('[slot="indicator"]').evaluate(node => node.focus())
  assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'raw')
  assert.equal(await raw.evaluate(host => host.shadowRoot.activeElement?.getAttribute('part') ?? null), null)
  await page.mouse.click(indicator.x, indicator.y)
  assert.equal(await raw.evaluate(host => host.shadowRoot.querySelector('button').getAttribute('aria-expanded')), 'true')
})

test('forced colors keep the indicator visible and dim it with the summary', async t => {
  const page = await pageFor(t)
  await page.emulateMedia({ forcedColors: 'active' })
  const colorOf = () => page.locator('#default').evaluate(host => {
    const style = getComputedStyle(host.shadowRoot.querySelector('[part="indicator"]'))
    return { color: style.color, adjustment: style.forcedColorAdjust }
  })
  const enabled = await colorOf()
  assert.equal(enabled.adjustment, 'none')
  await page.locator('#default').evaluate(host => host.setAttribute('disabled', ''))
  const disabled = await colorOf()
  assert.equal(disabled.adjustment, 'none')
  assert.notEqual(disabled.color, enabled.color)
})
