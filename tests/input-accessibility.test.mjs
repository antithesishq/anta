import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
let browser, script

before(async () => {
  const result = await build({
    stdin: {
      contents: `
        import { h, render } from 'preact'
        import { configure } from './src/jsx-runtime'
        import { InputAutocomplete, InputDate, InputTime, Select, SelectFaceted } from './src/index'
        import './src/elements/index'
        configure(h)
        render(h('main', {},
          h(InputAutocomplete, { label: 'Framework', suggestions: ['React', 'Preact'] }),
          h(InputDate, { label: 'Due date' }),
          h(Select, { label: 'Team', options: ['Design', 'Engineering'] }),
          h(Select, {
            label: 'Repository',
            options: ['Anta', 'Stickers'],
            filter: true,
            clearable: true,
            defaultValue: 'Anta',
          }),
          h(SelectFaceted, {
            label: 'Filter issues',
            searchable: true,
            facets: [
              { key: 'team', label: 'Team', kind: 'single', options: ['Design', 'Engineering'], filter: true },
              { key: 'title', label: 'Title', kind: 'text' },
            ],
          }),
          h(InputTime, { label: 'Start time', required: true, status: 'critical' }),
        ), document.body)
      `,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    outfile: 'input-accessibility.js',
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
  browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
})

after(async () => browser?.close())

async function pageFor(t) {
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error))
  await page.addScriptTag({ content: script })
  await page.waitForTimeout(20)
  if (errors.length) throw errors[0]
  return page
}

test('raw Input delegates standard ARIA and tracks later updates and removal', async t => {
  const page = await pageFor(t)
  const result = await page.evaluate(async () => {
    const list = document.createElement('div')
    list.id = 'raw-options'
    list.setAttribute('role', 'listbox')
    document.body.append(list)
    const host = document.createElement('a-input')
    host.setAttribute('role', 'combobox')
    host.setAttribute('aria-label', 'Raw choices')
    host.setAttribute('aria-haspopup', 'listbox')
    host.setAttribute('aria-expanded', 'false')
    host.setAttribute('aria-controls', list.id)
    document.body.append(host)
    await new Promise(resolve => queueMicrotask(resolve))
    const input = host.shadowRoot.querySelector('input')
    const initial = {
      hostRole: host.hasAttribute('role'),
      hostLabel: host.hasAttribute('aria-label'),
      role: input.getAttribute('role'),
      label: input.getAttribute('aria-label'),
      popup: input.getAttribute('aria-haspopup'),
      expanded: input.getAttribute('aria-expanded'),
      controls: input.ariaControlsElements?.[0] === list,
    }
    host.setAttribute('aria-expanded', 'true')
    const updated = input.getAttribute('aria-expanded')
    host.removeAttribute('aria-expanded')
    const removed = input.hasAttribute('aria-expanded')
    host.ariaExpanded = 'false'
    const propertyUpdated = input.getAttribute('aria-expanded')
    host.ariaExpanded = null
    host.ariaHasPopup = 'grid'
    const compoundPropertyUpdated = input.getAttribute('aria-haspopup')
    host.ariaHasPopup = null
    const form = document.createElement('form')
    const trigger = document.createElement('a-input')
    trigger.setAttribute('button', '')
    trigger.setAttribute('name', 'trigger')
    trigger.setAttribute('value', 'open')
    form.append(trigger)
    document.body.append(form)
    await new Promise(resolve => queueMicrotask(resolve))
    return {
      initial,
      updated,
      removed,
      propertyUpdated,
      propertyRemoved: input.hasAttribute('aria-expanded'),
      compoundPropertyUpdated,
      compoundPropertyRemoved: input.hasAttribute('aria-haspopup'),
      buttonSubmitted: new FormData(form).has('trigger'),
    }
  })

  assert.deepEqual(result, {
    initial: {
      hostRole: false,
      hostLabel: false,
      role: 'combobox',
      label: 'Raw choices',
      popup: 'listbox',
      expanded: 'false',
      controls: true,
    },
    updated: 'true',
    removed: false,
    propertyUpdated: 'false',
    propertyRemoved: false,
    compoundPropertyUpdated: 'grid',
    compoundPropertyRemoved: false,
    buttonSubmitted: false,
  })

  const client = await page.context().newCDPSession(page)
  const tree = await client.send('Accessibility.getFullAXTree')
  const namedControls = tree.nodes.filter(node =>
    !node.ignored && node.name?.value === 'Raw choices' && node.role?.value !== 'StaticText',
  )
  assert.equal(namedControls.length, 1)
  assert.equal(namedControls[0].role.value, 'combobox')
})

test('Input compositions put popup semantics on their focused controls', async t => {
  const page = await pageFor(t)
  const result = await page.evaluate(async () => {
    await new Promise(resolve => queueMicrotask(resolve))
    const hosts = [...document.querySelectorAll('a-input')]
    const autocomplete = hosts.find(host => host.shadowRoot.querySelector('input')?.getAttribute('aria-label') === 'Framework')
    const date = hosts.find(host => host.shadowRoot.querySelector('input')?.getAttribute('aria-label') === 'Due date')
    const select = hosts.find(host => host.shadowRoot.querySelector('button')?.getAttribute('aria-label') === 'Team')
    const filteredSelect = hosts.find(host => host.shadowRoot.querySelector('button')?.getAttribute('aria-label') === 'Repository')
    const autoControl = autocomplete.shadowRoot.querySelector('input')
    const dateControl = date.shadowRoot.querySelector('input')
    const selectControl = select.shadowRoot.querySelector('button')
    const filteredSelectControl = filteredSelect.shadowRoot.querySelector('button')
    return {
      autocomplete: {
        hostRole: autocomplete.hasAttribute('role'),
        role: autoControl.getAttribute('role'),
        popup: autoControl.getAttribute('aria-haspopup'),
        controlsRole: autoControl.ariaControlsElements?.[0]?.getAttribute('role'),
      },
      date: {
        hostRole: date.hasAttribute('role'),
        role: dateControl.getAttribute('role'),
        popup: dateControl.getAttribute('aria-haspopup'),
        controlsRole: dateControl.ariaControlsElements?.[0]?.getAttribute('role'),
      },
      select: {
        hostRole: select.hasAttribute('role'),
        tag: selectControl.localName,
        role: selectControl.getAttribute('role'),
        popup: selectControl.getAttribute('aria-haspopup'),
        controlsRole: selectControl.ariaControlsElements?.[0]?.getAttribute('role'),
      },
      filteredSelect: {
        popup: filteredSelectControl.getAttribute('aria-haspopup'),
        controlsRole: filteredSelectControl.ariaControlsElements?.[0]?.getAttribute('role'),
        bodyRole: filteredSelectControl.ariaControlsElements?.[0]?.shadowRoot
          .querySelector('[part="scroll"]')?.getAttribute('role'),
      },
    }
  })

  assert.deepEqual(result, {
    autocomplete: { hostRole: false, role: 'combobox', popup: 'listbox', controlsRole: 'listbox' },
    date: { hostRole: false, role: 'combobox', popup: 'dialog', controlsRole: 'dialog' },
    select: { hostRole: false, tag: 'button', role: null, popup: 'menu', controlsRole: 'menu' },
    filteredSelect: { popup: 'dialog', controlsRole: 'dialog', bodyRole: 'menu' },
  })
})

test('filtered Select exposes its textbox and option menu as dialog siblings', async t => {
  const page = await pageFor(t)
  const selectHost = page.locator('a-input').filter({ has: page.locator('button[aria-label="Repository"]') })
  await selectHost.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(20)

  const popup = page.locator('a-menu[role="dialog"][aria-label="Repository options"]')
  assert.equal(await popup.evaluate(menu => menu.isOpen), true)
  const snapshot = await popup.ariaSnapshot()
  assert.match(snapshot, /dialog "Repository options"/)
  assert.match(snapshot, /textbox "Filter options"/)
  assert.match(snapshot, /menu "Options"/)
  assert.match(snapshot, /menuitemradio "Anta"/)
  assert.match(snapshot, /button "Clear"/)

  const filter = popup.locator('a-input[data-menu-search] input')
  await filter.fill('missing')
  await page.waitForTimeout(20)
  assert.equal(
    await popup.evaluate(menu => menu.shadowRoot.querySelector('[part="scroll"]').getAttribute('role')),
    null,
  )
})

test('searchable and editable SelectFaceted popups expose dialog semantics', async t => {
  const page = await pageFor(t)
  const trigger = page.locator('a-button').filter({ hasText: 'Filter issues' })
  assert.equal(await trigger.getAttribute('aria-haspopup'), 'dialog')
  await trigger.click()
  await page.waitForTimeout(20)

  const root = page.locator('a-menu[role="dialog"][aria-label="Filter issues options"]')
  const rootSnapshot = await root.ariaSnapshot()
  assert.match(rootSnapshot, /dialog "Filter issues options"/)
  assert.match(rootSnapshot, /textbox "Filter all facets"/)
  assert.match(rootSnapshot, /menu "Options"/)

  const team = root.locator('a-menu-item').filter({ hasText: 'Team' }).first()
  assert.equal(await team.getAttribute('aria-haspopup'), 'dialog')
  await team.click()
  await page.waitForTimeout(20)
  const teamPopup = page.locator('a-menu[role="dialog"][aria-label="Team options"]')
  const teamSnapshot = await teamPopup.ariaSnapshot()
  assert.match(teamSnapshot, /dialog "Team options"/)
  assert.match(teamSnapshot, /textbox "Filter Team"/)
  assert.match(teamSnapshot, /menu "Options"/)

  await page.keyboard.press('Escape')
  const title = root.locator('a-menu-item').filter({ hasText: 'Title' }).first()
  assert.equal(await title.getAttribute('aria-haspopup'), 'dialog')
  await title.click()
  await page.waitForTimeout(20)
  const titleSnapshot = await page.locator('a-menu[role="dialog"][aria-label="Title editor"]').ariaSnapshot()
  assert.match(titleSnapshot, /dialog "Title editor"/)
  assert.match(titleSnapshot, /textbox "Title"/)
})

test('button-backed Select and editable InputDate retain their popup interactions', async t => {
  const page = await pageFor(t)
  const selectHost = page.locator('a-input').filter({ has: page.locator('button[aria-label="Team"]') })
  await selectHost.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(20)
  assert.equal(await selectHost.locator('button').getAttribute('aria-expanded'), 'true')
  assert.deepEqual(
    await selectHost.locator('button').evaluate(button => ({
      count: button.ariaControlsElements?.length ?? 0,
      role: button.ariaControlsElements?.[0]?.getAttribute('role') ?? null,
      open: button.ariaControlsElements?.[0]?.isOpen ?? false,
    })),
    { count: 1, role: 'menu', open: true },
  )

  await page.keyboard.press('Escape')
  const dateHost = page.locator('a-input').filter({ has: page.locator('input[aria-label="Due date"]') })
  await dateHost.locator('input').click()
  assert.equal(await dateHost.locator('input').getAttribute('aria-expanded'), 'true')
  assert.equal(await dateHost.locator('input').evaluate(input => input.ariaControlsElements?.[0]?.getAttribute('role')), 'dialog')
})

test('InputTime names its group and exposes required and invalid on every segment', async t => {
  const page = await pageFor(t)
  const result = await page.evaluate(async () => {
    await new Promise(resolve => queueMicrotask(resolve))
    const host = document.querySelector('a-input-time')
    const group = host.shadowRoot.querySelector('[role="group"]')
    const segments = [...host.shadowRoot.querySelectorAll('input')]
    return {
      hostInvalid: host.hasAttribute('aria-invalid'),
      label: group.getAttribute('aria-label'),
      required: segments.map(segment => segment.getAttribute('aria-required')),
      invalid: segments.map(segment => segment.getAttribute('aria-invalid')),
    }
  })

  assert.equal(result.hostInvalid, false)
  assert.equal(result.label, 'Start time')
  assert.ok(result.required.length >= 2)
  assert.deepEqual(new Set(result.required), new Set(['true']))
  assert.deepEqual(new Set(result.invalid), new Set(['true']))
})
