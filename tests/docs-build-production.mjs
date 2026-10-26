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
const { parse } = requireSite('parse5')
const engines = process.env.ANTA_TEST_WEBKIT === '0' ? [chromium] : [chromium, webkit]
const dist = new URL('../site/dist/', import.meta.url)

test('Plot pages retain working links, unique anchors, and one page title', async () => {
  const pages = (await readPageCatalog()).filter(page => page.package === 'plot')
  const documents = new Map()
  async function document(path) {
    if (documents.has(path)) return documents.get(path)
    const html = await readFile(new URL(`.${path}index.html`, dist), 'utf8')
    const nodes = []
    function visit(node) {
      nodes.push(node)
      for (const child of node.childNodes ?? []) visit(child)
    }
    visit(parse(html))
    const result = { nodes, ids: nodes.flatMap(node => node.attrs?.filter(attr => attr.name === 'id').map(attr => attr.value) ?? []) }
    documents.set(path, result)
    return result
  }
  for (const page of pages) {
    const { nodes, ids } = await document(page.path)
    assert.equal(nodes.filter(node => node.tagName === 'h1').length, 1, page.path)
    assert.equal(new Set(ids).size, ids.length, `${page.path} has duplicate anchors`)
    for (const node of nodes.filter(node => node.tagName === 'a')) {
      const href = node.attrs.find(attr => attr.name === 'href')?.value
      if (!href || !/^(?:#|\/plot\/)/.test(href)) continue
      const target = new URL(href, `https://anta.test${page.path}`)
      const destination = await document(target.pathname)
      if (target.hash) assert.ok(destination.ids.includes(decodeURIComponent(target.hash.slice(1))), `${page.path}: ${href}`)
    }
  }
})

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
    assert.equal(elementStyles.length, ['/box/', '/capture/'].includes(entry.path) || entry.package === 'plot' ? 1 : 0,
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

test('changelog feed preserves dated releases, HTML notes and working release links', async t => {
  const { page } = await productionPage(t)
  const [feed, html, changelog] = await Promise.all([
    readFile(new URL('changelog.rss', dist), 'utf8'),
    readFile(new URL('changelog/dev/index.html', dist), 'utf8'),
    readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8'),
  ])
  const result = await page.evaluate(({ feed, html }) => {
    const xml = new DOMParser().parseFromString(feed, 'application/xml')
    const releases = new DOMParser().parseFromString(html, 'text/html')
    const text = (element, selector) => element.querySelector(selector)?.textContent
    const channel = xml.querySelector('channel')
    return {
      parseError: xml.querySelector('parsererror')?.textContent ?? null,
      title: text(channel, 'title'),
      link: text(channel, 'link'),
      language: text(channel, 'language'),
      self: xml.getElementsByTagNameNS('http://www.w3.org/2005/Atom', 'link')[0]?.getAttribute('href'),
      buildDate: text(channel, 'lastBuildDate'),
      items: [...xml.querySelectorAll('item')].map(item => {
        const link = new URL(text(item, 'link'))
        return {
          title: text(item, 'title'),
          date: text(item, 'pubDate'),
          validLink: link.origin === 'https://anta.design' && link.pathname === '/changelog/dev/'
            && !!releases.getElementById(decodeURIComponent(link.hash.slice(1))),
          validGuid: text(item, 'guid') === link.href && item.querySelector('guid')?.getAttribute('isPermaLink') === 'true',
          hasNotes: !!new DOMParser().parseFromString(text(item, 'description'), 'text/html').querySelector('li'),
        }
      }),
    }
  }, { feed, html })
  assert.equal(result.parseError, null)
  assert.equal(result.title, 'Anta changelog')
  assert.equal(result.link, 'https://anta.design/changelog/')
  assert.equal(result.language, 'en')
  assert.equal(result.self, 'https://anta.design/changelog.rss')
  assert.equal(result.buildDate, result.items[0].date)
  const versions = [...changelog.matchAll(/^## (\S+) — [A-Z][a-z]+ \d{1,2}, \d{4}$/gm)].map(match => `Anta ${match[1]}`)
  assert.deepEqual(result.items.map(item => item.title), versions)
  for (const item of result.items) {
    assert.ok(Number.isFinite(Date.parse(item.date)), item.title)
    assert.ok(item.validLink && item.validGuid && item.hasNotes, item.title)
  }
})

for (const engine of engines) {
  test(`${engine.name()}: review stars render before scripts without moving the page title`, { timeout: 30_000 }, async t => {
    const { page, errors } = await productionPage(t, engine)
    let release
    const gate = new Promise(resolve => { release = resolve })
    t.after(() => release())
    await page.route('https://anta.test/**/*.js', async route => { await gate; await route.fallback() })
    await page.goto('https://anta.test/plot/rect/', { waitUntil: 'commit' })
    const heading = page.locator('main h1')
    const marker = heading.locator('.doc-review-marker')
    await marker.waitFor()
    await page.waitForFunction(() => [...document.querySelectorAll('link[rel=stylesheet]')].every(link => link.sheet))
    // WebKit's fonts.ready can wait for the scripts deliberately held by this test.
    await page.evaluate(() => Promise.all(['main h1', 'main > p'].map(selector => {
      const element = document.querySelector(selector)
      const style = getComputedStyle(element)
      return document.fonts.load(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, element.textContent)
    })))
    assert.equal(await marker.textContent(), '✦')
    assert.equal(await marker.evaluate(element => getComputedStyle(element).display), 'inline')
    assert.equal(await heading.locator(':scope > a-tooltip').count(), 1)
    assert.equal(await heading.getAttribute('aria-description'), 'Documentation has not yet been reviewed by a human.')
    const before = { heading: await heading.boundingBox(), paragraph: await page.locator('main > p').first().boundingBox() }
    release()
    await page.waitForFunction(() => Boolean(customElements.get('a-tooltip')))
    assert.deepEqual({ heading: await heading.boundingBox(), paragraph: await page.locator('main > p').first().boundingBox() }, before)
    await heading.hover({ position: { x: 4, y: 12 } })
    await page.waitForFunction(() => document.querySelector('h1 > a-tooltip')?.shadowRoot?.querySelector(':popover-open'))
    await page.keyboard.press('Escape')
    await heading.focus()
    await page.waitForFunction(() => document.querySelector('h1 > a-tooltip')?.shadowRoot?.querySelector(':popover-open'))
    await page.keyboard.press('Escape')
    await page.goto('https://anta.test/')
    assert.equal(await page.locator('main h1 .doc-review-marker').count(), 0)
    await page.locator('.sidebar a[href="/plot/"]').click()
    await page.waitForURL('https://anta.test/plot/')
    await page.locator('main h1 .doc-review-marker').waitFor()
    assert.equal(await page.locator('main h1 > a-tooltip').count(), 1)
    assert.deepEqual(errors, [])
  })

  test(`${engine.name()}: Plot navigation expands, persists, and follows page history`, async t => {
    const { page, errors } = await productionPage(t, engine)
    await page.goto('https://anta.test/button/')
    const sidebar = page.locator('.sidebar')
    const children = sidebar.getByRole('list', { name: 'Plot documentation', includeHidden: true })
    assert.equal(await children.isVisible(), false)
    await sidebar.evaluate(element => { element.dataset.testPersist = 'true' })
    await sidebar.getByRole('link', { name: 'Plot', exact: true }).click()
    await page.waitForURL('https://anta.test/plot/')
    await children.waitFor({ state: 'visible' })
    assert.equal(await children.isVisible(), true)
    assert.equal(await children.getByRole('link').count(), 7)
    for (const name of ['Scatter', 'Line', 'Bar', 'Area', 'Rect', 'Rule', 'Custom']) {
      await children.getByRole('link', { name, exact: true }).click()
      await page.waitForURL(`https://anta.test/plot/${name.toLowerCase()}/`)
      await page.getByRole('heading', { level: 1, name, exact: true }).waitFor()
      await children.locator(`a[href="/plot/${name.toLowerCase()}/"][aria-current="page"]`).waitFor()
      const breadcrumbs = page.getByRole('navigation', { name: 'Site breadcrumb' })
      assert.equal(await breadcrumbs.getByRole('button', { name: 'Plot', exact: true }).getAttribute('href'), '/plot/')
      assert.equal((await breadcrumbs.locator('[aria-current="page"]').textContent()).trim(), name)
      assert.equal((await children.locator('[aria-current="page"]').textContent()).trim(), name)
      assert.equal(await sidebar.locator('a[href="/plot/"]').getAttribute('data-active-parent'), '')
      await page.waitForFunction(() => [...document.querySelectorAll('main a-plot canvas')].some(canvas => canvas.width > 0))
      assert.equal(await sidebar.getAttribute('data-test-persist'), 'true')
    }
    await page.goBack()
    await page.waitForURL('https://anta.test/plot/rule/')
    await children.locator('a[href="/plot/rule/"][aria-current="page"]').waitFor()
    assert.equal((await children.locator('[aria-current="page"]').textContent()).trim(), 'Rule')
    await page.goForward()
    await page.waitForURL('https://anta.test/plot/custom/')
    await page.getByRole('navigation', { name: 'Site breadcrumb' }).getByRole('button', { name: 'Plot', exact: true }).click()
    await page.waitForURL('https://anta.test/plot/')
    await page.locator('main').getByRole('link', { name: 'Explore stacked bars series' }).click()
    await page.waitForURL('https://anta.test/plot/bar/#stacked-bars')
    await sidebar.getByRole('link', { name: 'Button', exact: true }).click()
    await page.waitForURL('https://anta.test/button/')
    await children.waitFor({ state: 'hidden' })
    assert.equal(await children.isVisible(), false)
    await page.goto('https://anta.test/plot/scatter/')
    assert.equal(await children.isVisible(), true)
    await page.setViewportSize({ width: 390, height: 844 })
    const breadcrumbs = page.getByRole('navigation', { name: 'Site breadcrumb' })
    assert.equal(await breadcrumbs.getByRole('button', { name: 'Plot', exact: true }).isVisible(), true)
    assert.equal(await breadcrumbs.locator('[aria-current="page"]').isVisible(), true)
    const currentLabel = breadcrumbs.locator('[aria-current="page"] a-button-label')
    assert.equal(await currentLabel.evaluate(element => element.scrollWidth <= element.clientWidth), true,
      'the current series name must fit in the mobile breadcrumb')
    await breadcrumbs.getByRole('button', { name: 'Anta', exact: true }).click()
    await page.waitForFunction(() => document.body.dataset.menuOpen === 'true')
    assert.equal(await children.isVisible(), true)
    await children.getByRole('link', { name: 'Line', exact: true }).click()
    await page.waitForURL('https://anta.test/plot/line/')
    await breadcrumbs.getByRole('button', { name: 'Plot', exact: true }).click()
    await page.waitForURL('https://anta.test/plot/')
    assert.notEqual(await page.locator('body').getAttribute('data-menu-open'), 'true')
    assert.deepEqual(errors, [])
  })

  test(`${engine.name()}: Panel preview retains hydrated requests, layout and input across maximization`, async t => {
    const {page,errors}=await productionPage(t,engine)
    await page.goto('https://anta.test/panel/')
    const island=page.locator('astro-island[component-url*="PanelControlledDemo"]')
    await page.waitForFunction(el=>!el.hasAttribute('ssr'),await island.elementHandle())
    const panel=island.locator('a-panel'),input=island.locator('a-input input')
    await input.fill('Retained production draft')
    const bounds=()=>panel.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}})
    const before=await bounds()
    await island.getByRole('button',{name:'Maximize panel',exact:true}).click()
    await page.waitForFunction(el=>el.matches(':state(maximized)'),await panel.elementHandle())
    const size=page.viewportSize()
    assert.deepEqual(await panel.evaluate(el=>{
      const surface=el.shadowRoot.querySelector('slot'),r=surface.getBoundingClientRect()
      return [r.x,r.y,r.width,r.height,getComputedStyle(surface).overflow]
    }),[0,0,size.width,size.height,'auto'])
    // A native request exercises the hydrated statechange listener, rather than
    // the demo button's separate click callback.
    await panel.evaluate(el=>el.requestRestore())
    await page.waitForFunction(el=>!el.matches(':state(maximized)'),await panel.elementHandle())
    assert.deepEqual(await bounds(),before)
    assert.equal(await input.inputValue(),'Retained production draft')
    assert.equal(await panel.evaluate(el=>el.shadowRoot.querySelectorAll('style,link').length),0)
    assert.deepEqual(errors,[])
  })
  test(`${engine.name()}: selection previews keep uncontrolled values off authored attributes`, async t => {
    const {page,errors}=await productionPage(t,engine)
    await page.goto('https://anta.test/input-date/')
    const calendar=page.locator('a-calendar[default-state="2026-06-28"]').first()
    await calendar.locator('[data-date="2026-06-27"]').click()
    await page.waitForFunction(el=>el.value==='2026-06-27',await calendar.elementHandle())
    assert.equal(await calendar.getAttribute('value'),null)
    assert.equal(await calendar.getAttribute('default-state'),'2026-06-28')
    await page.goto('https://anta.test/radio/')
    await page.locator('details.disclosure').filter({has:page.locator('#web-component')}).locator(':scope > summary').click()
    const radio=page.locator('a-radio-group[tabindex="0"][default-state="pro"]')
    await radio.locator('a-radio[value="starter"]').click()
    assert.equal(await radio.evaluate(el=>el.value),'starter')
    assert.equal(await radio.getAttribute('state'),null)
    assert.equal(await radio.getAttribute('default-state'),'pro')
    await page.goto('https://anta.test/tabs/')
    await page.locator('details.disclosure').filter({has:page.locator('#web-component')}).locator(':scope > summary').click()
    const tabs=page.locator('a-tabs[default-state="account"]').last()
    await tabs.locator('a-tab[value="security"]').click()
    assert.equal(await tabs.evaluate(el=>el.value),'security')
    assert.equal(await tabs.getAttribute('state'),null)
    assert.equal(await tabs.getAttribute('default-state'),'account')
    assert.equal(await tabs.locator('..').locator('a-tabpanel[value="security"]').evaluate(el=>el.matches(':state(active)')),true)
    assert.deepEqual(errors,[])
  })
  test(`${engine.name()}: Slider SSR reserves its label and rail before registration`, async t => {
    const {page, errors}=await productionPage(t,engine)
    let release
    const gate=new Promise(resolve=>{release=resolve})
    t.after(()=>release())
    await page.route('https://anta.test/**/*.js',async route=>{await gate;await route.fallback()})
    await page.goto('https://anta.test/slider/',{waitUntil:'commit'})
    const slider=page.locator('a-slider[default-value="35"]').first()
    await slider.waitFor()
    await page.waitForFunction(()=>[...document.querySelectorAll('link[rel=stylesheet]')].every(link=>link.sheet))
    const before=await slider.boundingBox()
    assert.equal(await slider.evaluate(s=>s.matches(':defined')),false)
    assert.match(await slider.evaluate(s=>getComputedStyle(s,'::after').content),/35/)
    release()
    await page.waitForFunction(s=>s.shadowRoot,await slider.elementHandle())
    const after=await slider.boundingBox()
    assert.equal(after.height,before.height)
    assert.equal(after.width,before.width)
    assert.equal(await slider.evaluate(s=>s.shadowRoot.querySelector('[part~=end-value]').textContent),'35')
    assert.deepEqual(errors,[])
  })
  test(`${engine.name()}: Slider previews accept or reject requests and reset the applied value`, async t => {
    const {page, errors}=await productionPage(t,engine)
    await page.goto('https://anta.test/slider/')
    const controlled=page.locator('.preview').filter({has:page.getByRole('checkbox',{name:'Accept changes',exact:true})})
    await page.waitForFunction(el=>!el.hasAttribute('ssr'),await controlled.locator('astro-island').elementHandle())
    const slider=controlled.locator('a-slider')
    await slider.focus();await page.keyboard.press('ArrowRight')
    await page.waitForFunction(el=>el.value===36,await slider.elementHandle())
    await controlled.getByRole('checkbox',{name:'Accept changes',exact:true}).click()
    await slider.focus();await page.keyboard.press('ArrowRight')
    await page.waitForFunction(el=>el.textContent.includes('Requested: 37%'),await controlled.elementHandle())
    assert.equal(await slider.evaluate(el=>el.value),36)
    await controlled.getByRole('button',{name:'Reset to 35%',exact:true}).click()
    await page.waitForFunction(el=>el.value===35,await slider.elementHandle())
    assert.ok((await controlled.locator('..').textContent()).includes('if (accept) setValue(next)'))
    const brightness=page.locator('a-slider[name=brightness]')
    await brightness.focus();await page.keyboard.press('ArrowRight')
    assert.equal(await brightness.evaluate(el=>el.value),61)
    await page.getByRole('button',{name:'Reset brightness',exact:true}).click()
    assert.equal(await brightness.evaluate(el=>el.value),60)
    const styling=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Styling'})}).last()
    await styling.locator('summary').click()
    assert.equal(await page.locator('.warm-slider').evaluate(s=>getComputedStyle(s.shadowRoot.querySelector('[part~=thumb]')).borderRadius),'4px')
    const reference=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Web Component'})}).last()
    await reference.locator('summary').click()
    assert.equal(await reference.locator('a-slider').first().evaluate(s=>s.value),50)
    assert.deepEqual(errors,[])
  })
  test(`${engine.name()}: InputAutocomplete previews preserve free text, controlled resets, and customization`, async t => {
    const {page, errors} = await productionPage(t, engine)
    await page.goto('https://anta.test/input-autocomplete/')
    const first = page.locator('.preview').filter({has:page.locator('a-input')}).first()
    await page.waitForFunction(el => !el.hasAttribute('ssr'), await first.locator('astro-island').elementHandle())
    const input = first.locator('a-input input')
    await input.fill('Re')
    await page.waitForFunction(() => document.querySelector('.preview a-menu')?.isOpen)
    await input.press('ArrowDown');await input.press('Enter')
    assert.equal(await input.inputValue(), 'React')
    await input.fill('My framework');await input.press('Enter')
    assert.equal(await input.inputValue(), 'My framework')
    assert.ok((await first.locator('..').textContent()).includes("value || '(empty)'"))
    const controlled = page.locator('.preview').filter({has:page.getByRole('button', {name:'Reset text',exact:true})})
    await controlled.scrollIntoViewIfNeeded()
    await page.waitForFunction(el => !el.hasAttribute('ssr'), await controlled.locator('astro-island').elementHandle())
    await controlled.getByRole('button', {name:'Reset text',exact:true}).click()
    await page.waitForFunction(el => el.value === '', await controlled.locator('a-input').elementHandle())
    const styling = page.locator('details').filter({has:page.locator('summary').filter({hasText:'Styling'})}).last()
    await styling.locator('summary').click()
    const styled = page.locator('.preview').filter({has:page.locator('.package-field')})
    await styled.scrollIntoViewIfNeeded()
    await page.waitForFunction(el => !el.hasAttribute('ssr'), await styled.locator('astro-island').elementHandle())
    const packageInput = styled.locator('a-input input')
    await packageInput.fill('Anta')
    assert.equal(await packageInput.evaluate(el => getComputedStyle(el.getRootNode().host.shadowRoot.querySelector('[part="field"]')).borderRadius), '12px')
    await styled.getByRole('option', {name:/Anta/}).click()
    assert.equal(await packageInput.inputValue(), '@antadesign/anta')
    const reference = page.locator('details').filter({has:page.locator('summary').filter({hasText:'Web Component'})}).last()
    await reference.locator('summary').click()
    assert.equal(await page.getByLabel('Person', {exact:true}).getAttribute('list'), 'people')
    assert.deepEqual(errors, [])
  })
  test(`${engine.name()}: Select retains its first preview and matching expandable recipe`, async t => {
    const {page, errors} = await productionPage(t, engine)
    await page.goto('https://anta.test/select/')
    const first = page.locator('.preview').filter({has:page.locator('a-input[button]')}).first()
    const field = first.locator('a-input[button]').first()
    await field.scrollIntoViewIfNeeded()
    await page.waitForFunction(el => el.nextElementSibling?.listening, await field.elementHandle())
    assert.ok((await first.locator('..').textContent()).includes('output_text'))
    await field.locator('button').click()
    await first.getByRole('menuitemradio', {name:/^stream/}).click()
    await page.waitForFunction(el => el.value === 'stream', await field.elementHandle())
    assert.equal(await first.locator('a-menu').first().evaluate(el => el.isOpen), false)
    const controlled = page.locator('.preview').filter({has: page.getByRole('button', {name:'Reset selection',exact:true})})
    const controlledField = controlled.locator('a-input[button]')
    await controlledField.scrollIntoViewIfNeeded()
    await page.waitForFunction(el => el.nextElementSibling?.listening, await controlledField.elementHandle())
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await controlled.getByRole('button', {name:'Reset selection',exact:true}).click()
    await page.waitForFunction(el => el.value === '', await controlledField.elementHandle())
    await controlledField.locator('button').click()
    await controlled.getByRole('menuitemradio', {name:'stream',exact:true}).click()
    await page.waitForFunction(el => el.value === 'stream', await controlledField.elementHandle())
    await controlled.getByRole('button', {name:'Reset selection',exact:true}).click()
    await page.waitForFunction(el => el.value === '', await controlledField.elementHandle())
    assert.ok((await controlled.locator('..').textContent()).includes('string | null'))
    assert.deepEqual(errors, [])
  })
  test(`${engine.name()}: Dialog keeps its first preview, boxless footer, keyboard close, and raw example`, async t => {
    const { page, errors } = await productionPage(t, engine)
    await page.goto('https://anta.test/dialog/')
    const opener = page.locator('[data-dialog-open="zones"]')
    await opener.focus()
    await page.keyboard.press('Enter')
    const dialog = page.locator('a-dialog[name="zones"]').locator('dialog')
    await dialog.waitFor({state:'visible'})
    assert.equal(await dialog.getAttribute('aria-label'), 'Enable telemetry?')
    assert.equal(await page.locator('a-dialog[name="zones"] > div[slot="header"] a-title').textContent(),'Enable telemetry?')
    assert.equal(await page.locator('a-dialog[name="zones"] > a-dialog-close').count(),1)
    assert.equal(await page.locator('a-dialog[name="zones"] > a-dialog-footer').evaluate(el=>getComputedStyle(el).display), 'contents')
    await page.locator('a-dialog[name="zones"] [data-dialog-close="zones"]').getByText('Enable',{exact:true}).click()
    await dialog.waitFor({state:'hidden'})
    assert.equal(await opener.evaluate(el=>el===document.activeElement),true)
    await opener.focus();await page.keyboard.press('Enter');await dialog.waitFor({state:'visible'})
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'})
    await opener.focus();await page.keyboard.press('Enter');await dialog.waitFor({state:'visible'})
    await page.locator('a-dialog[name="zones"] a-dialog-close a-button').click()
    await dialog.waitFor({state:'hidden'})
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

  test(`${engine.name()}: Menu previews retain the first dropdown, pinned regions, and raw example`, async t => {
    const { page, errors } = await productionPage(t, engine)
    await page.goto('https://anta.test/menu/')
    const first = page.locator('.preview').filter({has: page.locator('a-menu')}).first()
    const trigger = first.locator('a-button').first()
    await trigger.scrollIntoViewIfNeeded()
    await page.waitForFunction(() => [...document.querySelectorAll('.preview a-menu')].some(el => el.listening))
    await trigger.focus()
    await page.keyboard.press('ArrowDown')
    const menu = first.locator('a-menu').first()
    await page.waitForFunction(() => document.querySelector('.preview a-menu')?.isOpen)
    assert.equal(await menu.locator('[part=menu]').evaluate(el => getComputedStyle(el).display), 'flex')
    await first.locator('a-menu-item').filter({hasText: /^Edit/}).click()
    assert.equal(await menu.evaluate(el => el.isOpen), false)
    const pinned = page.locator('.preview').filter({has: page.locator('a-menu-header')}).first()
    await pinned.locator('a-button').first().scrollIntoViewIfNeeded()
    await page.waitForFunction(el => el.listening, await pinned.locator('a-menu').elementHandle())
    await pinned.locator('a-button').first().click()
    await pinned.locator('a-input input').fill('Design')
    assert.equal(await pinned.locator('a-menu-header').evaluate(el => getComputedStyle(el).padding), '8px')
    assert.equal(await pinned.locator('a-menu-footer').evaluate(el => getComputedStyle(el).padding), '8px')
    await page.keyboard.press('Escape')
    await page.locator('summary').filter({hasText: 'Web Component'}).click()
    const raw = page.locator('details').filter({has: page.locator('summary').filter({hasText:'Web Component'})}).last().locator('.preview')
    await raw.locator('a-button').scrollIntoViewIfNeeded()
    await page.waitForFunction(el => el.listening, await raw.locator('a-menu').elementHandle())
    await raw.locator('a-button').click()
    await raw.locator('a-menu-item').filter({hasText:'Settings'}).click()
    assert.equal(await raw.locator('a-menu').evaluate(el => el.isOpen), false)
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

  test(`${engine.name()}: SelectFaceted Styling preview applies its documented CSS without inline styles`, async t => {
    const { page, errors } = await productionPage(t, engine)
    await page.goto('https://anta.test/select-faceted/')
    await page.locator('summary').filter({hasText:'Styling'}).click()
    const styledTrigger = page.locator('.roomy-text-filter')
    await styledTrigger.scrollIntoViewIfNeeded()
    await styledTrigger.locator('xpath=ancestor::details[1]').evaluate(el => Promise.all(
      el.getAnimations({subtree:true}).map(animation => animation.finished.catch(() => {})),
    ))
    await page.waitForFunction(el => el.nextElementSibling?.listening, await styledTrigger.elementHandle())
    await styledTrigger.click()
    const styledMenu = styledTrigger.locator('xpath=following-sibling::a-menu[1]')
    await styledMenu.getByRole('menuitem',{name:/^Title contains/}).click()
    const editor = styledMenu.locator('a-select-faceted-text')
    await editor.locator('input').fill('Styled draft')
    assert.equal(await editor.evaluate(el => getComputedStyle(el).padding),'8px')
    assert.equal(await editor.getAttribute('style'),null)
    assert.ok((await page.locator('#styling').locator('xpath=ancestor::details[1]').textContent()).includes('padding: 8px'))
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
