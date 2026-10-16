import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { readPageCatalog } from '../site/lib/content/catalog.mjs'
import { inputByLabel } from './helpers/input-locator.mjs'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium, webkit } = requireSite('playwright')
const engines = process.env.ANTA_TEST_WEBKIT === '0' ? [chromium] : [chromium, webkit]
const dist = new URL('../site/dist/', import.meta.url)

test('collection reads keep island and script styles on the pages that use them', async () => {
  const catalog = await readPageCatalog()
  for (const entry of catalog) {
    const html = await readFile(new URL(`.${entry.path}index.html`, dist), 'utf8')
    const styles = [...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g)].map(match => match[1])
    const wheelStyles = styles.filter(path => path.includes('/WheelCapturePreview.'))
    assert.equal(wheelStyles.length, entry.path === '/capture/' ? 1 : 0,
      `${entry.path} must only load WheelCapturePreview CSS when rendering that demo`)
    // Plot's processed script and the browser-only Box/Capture demos own this
    // shared element chunk. Reading their metadata must not load it elsewhere.
    const elementStyles = styles.filter(path => path.includes('/a-tooltip.'))
    assert.equal(elementStyles.length, ['/box/', '/capture/', '/plot/'].includes(entry.path) ? 1 : 0,
      `${entry.path} must not inherit another collection entry's script CSS`)
  }
})

async function productionPage(t, engine = chromium) {
  const browser = await engine.launch({
    headless: true,
    ...(engine === chromium ? { channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined } : {}),
  })
  t.after(() => browser.close())
  const page = await browser.newPage()
  page.setDefaultTimeout(20_000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://anta.test/**', async route => {
    const path = new URL(route.request().url()).pathname
    const file = new URL(`.${path}${path.endsWith('/') ? 'index.html' : ''}`, dist)
    if (!file.href.startsWith(dist.href)) return route.abort()
    await route.fulfill({ path: fileURLToPath(file) })
  })
  return { page, errors }
}

for (const engine of engines) {
  test(`${engine.name()}: Dialog keeps its first preview, boxless footer, keyboard close, and raw example`, async t => {
    const { page, errors } = await productionPage(t, engine)
    await page.goto('https://anta.test/dialog/')
    const opener = page.locator('[data-dialog-open="zones"]')
    await opener.focus()
    await page.keyboard.press('Enter')
    const dialog = page.locator('a-dialog[name="zones"]').locator('dialog')
    await dialog.waitFor({state:'visible'})
    assert.equal(await dialog.getAttribute('aria-label'), 'Enable telemetry?')
    assert.equal(await page.locator('a-dialog[name="zones"] > a-dialog-footer').evaluate(el=>getComputedStyle(el).display), 'contents')
    await page.locator('a-dialog[name="zones"] [data-dialog-close="zones"]').getByText('Enable',{exact:true}).click()
    await dialog.waitFor({state:'hidden'})
    assert.equal(await opener.evaluate(el=>el===document.activeElement),true)
    await opener.focus();await page.keyboard.press('Enter');await dialog.waitFor({state:'visible'})
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'})
    await page.locator('details.disclosure').filter({has:page.locator('#web-component')}).locator(':scope > summary').click()
    await page.locator('[data-dialog-open="invite"]').click()
    const raw = page.locator('a-dialog[name="invite"]')
    await raw.locator('dialog').waitFor({state:'visible'})
    await raw.locator('[slot="close"]').click()
    await raw.locator('dialog').waitFor({state:'hidden'})
    await page.locator('details.disclosure').filter({has:page.locator('#styling')}).locator(':scope > summary').click()
    await page.locator('[data-dialog-open="styled"]').click()
    const styled = page.locator('a-dialog[name="styled"]')
    await styled.locator('dialog').waitFor({state:'visible'})
    assert.equal(await styled.locator('slot[name="header"]').evaluate(el=>getComputedStyle(el).paddingInlineEnd),'64px')
    await styled.locator('[slot="close"]').click()
    await styled.locator('dialog').waitFor({state:'hidden'})
    assert.deepEqual(errors, [])
  })

  test(`${engine.name()}: InputTime previews edit and cancel clearing after hydration`, async t => {
    const { page, errors } = await productionPage(t, engine)
    await page.goto('https://anta.test/input-time/')
    await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'))
    const island = page.locator('astro-island[component-url*="InputTimeInteractions"]')
    const time = island.locator('a-input-time')
    await time.locator('[part~="hour"]').fill('11')
    assert.equal(await time.evaluate(el => el.value), '11:30')
    await island.locator('a-checkbox').click()
    await time.locator('[slot="clear"] a-button').click()
    assert.equal(await time.evaluate(el => el.value), '11:30')
    await island.locator('a-checkbox').click()
    await time.locator('[slot="clear"] a-button').click()
    assert.equal(await time.evaluate(el => el.value), '')
    await island.locator('a-tag').getByText('Incomplete time', { exact: true }).waitFor()
    assert.deepEqual(errors, [])
  })

  test(`${engine.name()}: Toaster previews preserve dismissal, countdown, and raw markup examples`, async t => {
    const { page, errors } = await productionPage(t, engine)
    await page.goto('https://anta.test/toaster/')
    const textTrigger = page.locator('a-button').filter({ hasText: /^Toast text$/ })
    await textTrigger.scrollIntoViewIfNeeded()
    await page.waitForFunction(() => !document.querySelector('astro-island[component-url*="ToasterDemo"][ssr]'))
    await page.locator('.preview a-input input').first().fill('8000')
    await textTrigger.click()
    await page.locator('a-toaster a-banner-close a-button').click()
    await page.waitForFunction(() => !document.querySelector('a-toaster a-toast'))
    await page.locator('a-button').filter({ hasText: /^Toast a Card$/ }).click()
    const cardDismiss = page.locator('a-toaster a-card a-button')
    await cardDismiss.focus()
    await page.keyboard.press('Space')
    await page.waitForFunction(() => !document.querySelector('a-toaster a-toast'))
    await page.locator('a-button').filter({ hasText: /^Toast with countdown$/ }).click()
    const bar = page.locator('a-toaster [class*="countdownBar"]')
    await bar.waitFor()
    await page.waitForTimeout(180)
    const progress = () => bar.evaluate(el => Number(getComputedStyle(el).getPropertyValue('--toast-remaining')))
    assert.ok(await progress() < 1)
    await page.locator('a-toaster a-toast').hover()
    const paused = await progress()
    await page.waitForTimeout(180)
    assert.ok(Math.abs(await progress() - paused) < 0.02)
    await page.locator('a-toaster a-banner-close a-button').click()
    await page.waitForFunction(() => !document.querySelector('a-toaster a-toast'))
    await page.locator('summary').filter({ hasText: 'Web Component' }).click()
    await page.locator('[data-toast-add]').click()
    const rawDismiss = page.locator('a-toaster a-toast [data-toast-dismiss]')
    await rawDismiss.focus()
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => !document.querySelector('a-toaster a-toast'))
    assert.deepEqual(errors, [])
  })

  test(`${engine.name()}: Input islands deliver native events after hydration`, async t => {
    const { page, errors } = await productionPage(t, engine)
    await page.goto('https://anta.test/input/')
    await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'))
    const input = inputByLabel(page, 'Draft')
    await input.fill('Hydrated draft')
    await page.locator('a-input-hint').getByText('Draft updated.', { exact: true }).waitFor()
    assert.equal(await input.inputValue(), 'Hydrated draft')
    assert.deepEqual(errors, [])
  })

  test(`${engine.name()}: facet text chips keep a bounded width, truncate long values, and preserve focus when empty`, async t => {
    const { page, errors } = await productionPage(t, engine)
    await page.goto('https://anta.test/select-faceted/')
    const chip = page.locator('a-input.sf-chip').filter({ has: page.getByRole('textbox') }).first()
    const input = chip.locator('input')
    await input.waitFor()
    assert.equal(await input.inputValue(), 'crash')
    const initialWidth = await chip.evaluate(el => el.getBoundingClientRect().width)
    await input.fill('A long title filter with enough text to reach the width limit')
    assert.ok(Math.abs(initialWidth - 240) < 1)
    assert.equal(await chip.evaluate(el => el.getBoundingClientRect().width), initialWidth)
    await input.blur()
    assert.equal(await input.evaluate(el => getComputedStyle(el).textOverflow), 'ellipsis')
    assert.ok(await input.evaluate(el => el.scrollWidth > el.clientWidth))
    await input.focus()
    assert.equal(await input.evaluate(el => el.getRootNode().activeElement === el), true)
    await input.fill('x')
    assert.equal(await chip.evaluate(el => el.getBoundingClientRect().width), initialWidth)
    await input.fill('')
    assert.equal(await input.count(), 1)
    assert.equal(await input.evaluate(el => el.getRootNode().activeElement === el), true)
    await input.fill('Restored')
    assert.equal(await input.inputValue(), 'Restored')
    await input.fill('')
    await input.blur()
    await chip.waitFor({ state: 'detached' })
    assert.deepEqual(errors, [])
  })

  test(`${engine.name()}: collapsed Playground loads safely and preserves edits after reopening`, async t => {
    const { page, errors } = await productionPage(t, engine)
    await page.goto('https://anta.test/input/')
    const host = page.locator('[data-anta-playground]').first()
    assert.equal(await host.locator(':scope > *').count(), 0)
    assert.equal(await host.getAttribute('data-anta-playground-mounted'), null)

    const summary = page.locator('summary').filter({ hasText: 'Playground' }).first()
    await summary.click()
    await host.locator('iframe').waitFor()
    await host.getByRole('tab', { name: 'Code', exact: true }).click()
    await host.locator('.monaco-editor .view-lines').first().click()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.insertText(
      'import { Input } from "@antadesign/anta"\n' +
      'function Demo() { return <Input label="Preserved edit" /> }',
    )
    const previewInput = inputByLabel(page.frameLocator('iframe').first(), 'Preserved edit')
    await previewInput.waitFor()
    await summary.click()
    await page.waitForFunction(() => !document.querySelector('[data-anta-playground]')?.closest('details')?.open)
    await summary.click()
    await previewInput.waitFor()

    await page.evaluate(() => {
      window.playgroundNavigationSentinel = true
      document.querySelector('a[href="/button/"]').click()
    })
    await page.waitForURL('https://anta.test/button/')
    assert.equal(await page.evaluate(() => window.playgroundNavigationSentinel), true)
    assert.equal(await page.locator('[data-anta-playground] > *').count(), 0)
    await page.evaluate(async () => {
      const host = document.querySelector('[data-anta-playground]')
      const nested = document.createElement('details')
      nested.innerHTML = '<summary>Nested playground</summary>'
      host.before(nested)
      nested.append(host)
      const toggled = new Promise(resolve => nested.addEventListener('toggle', resolve, { once: true }))
      nested.open = true
      await toggled
    })
    assert.equal(await page.locator('[data-anta-playground] > *').count(), 0,
      'Opening an inner disclosure must not mount inside a closed outer disclosure')
    await page.locator('summary').filter({ hasText: 'Playground' }).first().click()
    await page.frameLocator('iframe').first().getByRole('button').first().waitFor()
    assert.deepEqual(errors, [])
  })
}

test('native MDX preserves table alignment and the compiled playground after navigation', async t => {
  const { page, errors } = await productionPage(t)
  await page.goto('https://anta.test/title/')
  // Native Markdown emits alignment styles that must survive optimization
  // and override the table defaults in Anta's reset CSS.
  const cells = page.locator('main :is(th, td)[style*="text-align"]')
  assert.ok(await cells.count() > 0)
  for (const cell of await cells.all()) {
    assert.equal(await cell.evaluate(element => getComputedStyle(element).textAlign), 'right')
  }

  await page.evaluate(() => {
    window.buildNavigationSentinel = true
    const link = document.createElement('a')
    link.href = '/button/'
    document.body.append(link)
    link.click()
  })
  await page.waitForURL('https://anta.test/button/')
  assert.equal(await page.evaluate(() => window.buildNavigationSentinel), true)
  await page.locator('summary').filter({ hasText: 'Playground' }).first().click()
  await page.getByRole('tab', { name: 'Code', exact: true }).first().click()
  await page.locator('.monaco-editor .view-lines').first().click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(
    'import { Button } from "@antadesign/anta"\n' +
    'function Demo() { return <Button label="Updated production preview" /> }',
  )
  await page.frameLocator('iframe').first().getByRole('button', {
    name: 'Updated production preview', exact: true,
  }).waitFor()
  const theme = page.locator('.theming-switcher')
  for (const palette of ['antithesis', 'none', 'antithesis']) {
    await theme.getByRole('button').click()
    await theme.getByRole('menuitemradio', {
      name: palette === 'none' ? 'None' : 'Antithesis', exact: true,
    }).click()
    const fontsHref = palette === 'none' ? '/themes/default.css' : `/themes/fonts-${palette}.css`
    await page.waitForFunction(href => document.getElementById('palette-fonts-link').getAttribute('href') === href, fontsHref)
    await page.waitForFunction(href => document.querySelector('iframe')?.contentDocument
      ?.getElementById('palette-fonts-link')?.getAttribute('href')?.endsWith(href), fontsHref)
  }
  await page.evaluate(() => {
    const link = document.createElement('a')
    link.href = '/title/'
    document.body.append(link)
    link.click()
  })
  await page.waitForURL('https://anta.test/title/')
  assert.equal(await page.locator('#palette-fonts-link').getAttribute('href'), '/themes/fonts-antithesis.css')
  assert.equal(await page.locator('#palette-fonts-link').count(), 1)
  assert.deepEqual(errors, [])
})

test('native MDX preserves authored JSX tables, inline children, and contrast ratios', async t => {
  const { page, errors } = await productionPage(t)
  await page.goto('https://anta.test/table/')
  const tables = page.locator('main table')
  assert.equal(await tables.count(), 3)
  assert.equal(await page.locator('main table tr').count(), 12)
  assert.deepEqual(await page.locator('main table tbody tr > td:first-child').allTextContents(), [
    '--text-1', '--text-3', '--border-5',
    '--text-1', '--text-3', '--border-5',
    '--text-1-brand', '--text-3', '--text-1',
  ])
  assert.equal(await page.locator('main .table-wrap > table').count(), 0,
    'Authored JSX tables retain their existing layout without Markdown wrappers')
  assert.equal(await tables.nth(1).evaluate(table => getComputedStyle(table).borderCollapse), 'separate')
  assert.equal(await page.locator('main caption').textContent(), 'Color tokens used by the docs sidebar')

  await page.goto('https://anta.test/title/')
  const title = page.locator('a-title').filter({ hasText: 'Saved items' })
  assert.equal(await title.count(), 1)
  assert.equal(await title.locator('p').count(), 0)
  assert.match(await title.innerText(), /Saved items\s+\(3\)/)

  await page.goto('https://anta.test/accessibility/')
  const paragraph = page.locator('main p').filter({ hasText: 'Neutral text-4 meets' })
  assert.equal(await paragraph.count(), 1)
  assert.match(await paragraph.innerText(), /4\.5:1.*4\.41:1.*4\.25:1/)
  assert.deepEqual(errors, [])
})

test('Capture mounts its wheel demo with one copy of each stylesheet', async t => {
  const { page, errors } = await productionPage(t)
  await page.goto('https://anta.test/capture/')
  const demo = page.locator('[data-wheel-capture-preview]')
  await demo.waitFor()

  const stylesheets = await page.locator('link[rel="stylesheet"]').evaluateAll(links => links.map(link => link.href))
  const contents = new Map()
  for (const href of stylesheets) {
    const path = new URL(href).pathname
    const css = await readFile(new URL(`.${path}`, dist))
    const hash = createHash('sha256').update(css).digest('hex')
    assert.equal(contents.has(hash), false, `${path} duplicates ${contents.get(hash)}`)
    contents.set(hash, path)
  }

  await demo.getByRole('checkbox', { name: 'Capture wheel', exact: true }).click()
  await demo.getByText('Capture enabled', { exact: true }).waitFor()
  const surface = demo.locator('[aria-label="Wheel capture surface"]')
  await surface.focus()
  await page.keyboard.press('ArrowDown')
  await demo.getByText('32 / 704px', { exact: true }).waitFor()
  await demo.getByRole('button', { name: 'Reset position', exact: true }).click()
  await demo.getByText('0 / 704px', { exact: true }).waitFor()
  assert.deepEqual(errors, [])
})
