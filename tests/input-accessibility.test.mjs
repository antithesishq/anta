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
        import { Calendar, Checkbox, InputAutocomplete, InputDate, InputTime, RadioGroup, Select, SelectFaceted, Switch } from './src/index'
        import './src/elements/index'
        import './src/tokens.css'
        configure(h)
        const main = document.createElement('main')
        document.body.append(main)
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
          h(SelectFaceted, {
            label: 'Custom filters',
            searchable: true,
            defaultValue: { single: 1, multiple: [1] },
            onValueChange: value => { window.customFacetValue = value },
            facets: ['single', 'multiple'].map(kind => ({
              key: kind, label: kind, kind, filter: true,
              options: [
                { value: 1, label: 'Alice', hint: 'Design', icon: 'user', team: 'Studio' },
                { value: 2, label: 'Bob', disabled: true },
                { value: 3, label: 'Default row' },
              ],
              renderOption: (option, state) => option.value === 3 ? null : h('span', {
                'data-custom-option': kind + ':' + state.value,
                'data-selected': String(state.selected),
                'data-disabled': String(state.disabled),
              }, option.label + ' ' + (option.team || '')),
            })),
          }),
          h(Select, { label: h('strong', {}, 'Departments'), hint: h('em', {}, 'Choose departments'), selection: 'multiple', options: ['Engineering department with a very long name', 'Design'], defaultValue: ['Engineering department with a very long name'], style: { width: '180px' } }),
          h(Select, { label: 'Disabled select', options: ['One'], disabled: true }),
          h(InputTime, { label: 'Start time', required: true, status: 'critical' }),
          h(Checkbox, { id: 'described-checkbox', label: 'Email notifications', hint: h('strong', {}, 'Weekly digest, never marketing.') }),
          h(Switch, { id: 'described-switch', label: 'Automatic updates', hint: h('strong', {}, 'Downloads in the background.') }),
          h(RadioGroup, {
            label: 'Delivery method',
            options: [
              { value: 'email', label: 'Email', hint: 'A confirmation link goes to your inbox.' },
              { value: 'sms', label: 'SMS' },
            ],
          }),
        ), main)
        window.mountHoverRange = () => {
          const mount = document.createElement('div')
          mount.style.cssText = 'position:fixed;left:160px;top:80px'
          document.body.append(mount)
          render(h(SelectFaceted, {
            label: 'Range filter',
            defaultValue: { recency: { preset: 'last14' } },
            facets: [{
              key: 'recency', label: 'Recency', kind: 'custom',
              summary: value => 'preset' in value ? value.preset : 'Custom range',
              render: ({ value, onChange }) => {
                const mode = value == null ? '' : 'preset' in value ? value.preset : 'custom'
                const range = value && 'from' in value ? value : { from: '', to: '' }
                return h('div', { 'data-menu-open': '', style: { minWidth: '360px', padding: '8px' } },
                  h(RadioGroup, {
                    options: [{ value: 'last14', label: 'Last 14 days' }, { value: 'custom', label: 'Custom range' }],
                    value: mode,
                    onStateChange: (_event, { next }) => onChange(next === 'custom' ? range : { preset: next }),
                  }),
                  mode === 'custom' && h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' } },
                    h(InputDate, { label: 'From', value: range.from, onValueChange: from => onChange({ from, to: range.to }) }),
                    h(InputDate, { label: 'To', value: range.to, min: range.from || undefined, onValueChange: to => onChange({ from: range.from, to }) }),
                  ),
                )
              },
            }],
          }), mount)
        }
        for (let i = 0; i < 2; i++) {
          const root = document.createElement('div')
          document.body.append(root)
          render(h('div', {},
            h(Calendar, { defaultValue: '2026-06-15' }),
            h(InputDate, { label: 'Root date ' + i }),
            h(Select, { label: 'Root select ' + i, options: ['One', 'Two'] }),
            h(InputAutocomplete, { label: 'Root autocomplete ' + i, suggestions: ['One', 'Two'] }),
          ), root)
        }
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
  css = result.outputFiles.find(file => file.path.endsWith('.css')).text
  browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
})

after(async () => browser?.close())

async function pageFor(t) {
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error))
  await page.addStyleTag({ content: css })
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
    const adjacentMenu = document.createElement('a-menu')
    document.body.append(adjacentMenu)
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
    host.removeAttribute('aria-controls')
    const generatedRelationshipRestored = input.ariaControlsElements?.[0] === adjacentMenu
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
      generatedRelationshipRestored,
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
    generatedRelationshipRestored: true,
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
    const select = document.querySelector('a-button[aria-label="Team"]')
    const filteredSelect = document.querySelector('a-button[aria-label="Repository"]')
    const autoControl = autocomplete.shadowRoot.querySelector('input')
    const dateControl = date.shadowRoot.querySelector('input')
    const selectControl = select
    const filteredSelectControl = filteredSelect
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
        controlsRole: selectControl.internals.ariaControlsElements?.[0]?.getAttribute('role'),
      },
      filteredSelect: {
        popup: filteredSelectControl.getAttribute('aria-haspopup'),
        controlsRole: filteredSelectControl.internals.ariaControlsElements?.[0]?.getAttribute('role'),
        bodyRole: filteredSelectControl.internals.ariaControlsElements?.[0]?.shadowRoot
          .querySelector('[part="scroll"]')?.getAttribute('role'),
      },
    }
  })

  assert.deepEqual(result, {
    autocomplete: { hostRole: false, role: 'combobox', popup: 'listbox', controlsRole: 'listbox' },
    date: { hostRole: false, role: 'combobox', popup: 'dialog', controlsRole: 'dialog' },
    select: { hostRole: true, tag: 'a-button', role: 'button', popup: 'menu', controlsRole: 'menu' },
    filteredSelect: { popup: 'dialog', controlsRole: 'dialog', bodyRole: 'menu' },
  })
})

test('popup relationships stay instance-local across separate renderer roots without IDs', async t => {
  const page = await pageFor(t)
  const result = await page.evaluate(async () => {
    await new Promise(resolve => queueMicrotask(resolve))
    const labels = [
      'Root date 0', 'Root select 0', 'Root autocomplete 0',
      'Root date 1', 'Root select 1', 'Root autocomplete 1',
    ]
    return {
      relations: labels.map(label => {
        const host = [...document.querySelectorAll('a-input, a-select-field > a-button')].find(candidate =>
          (candidate.control ?? candidate).getAttribute('aria-label') === label,
        )
        const control = host?.control ?? host
        const relations = host?.control ?? host?.internals
        return {
          label,
          controlsOwnPopup: relations?.ariaControlsElements?.[0] === host?.nextElementSibling,
          serializedControls: control?.getAttribute('aria-controls') ?? '',
          popupId: host?.nextElementSibling?.getAttribute('id'),
        }
      }),
      generatedPopupIds: [...document.querySelectorAll('a-menu[id], a-menu-item[id]')].map(element => element.id),
    }
  })

  assert.deepEqual(result.relations, [
    'Root date 0', 'Root select 0', 'Root autocomplete 0',
    'Root date 1', 'Root select 1', 'Root autocomplete 1',
  ].map(label => ({ label, controlsOwnPopup: true, serializedControls: '', popupId: null })))
  assert.deepEqual(result.generatedPopupIds, [])

  await page.locator('input[aria-label="Root autocomplete 0"]').focus()
  await page.waitForTimeout(20)
  const cdp = await page.context().newCDPSession(page)
  const { nodes } = await cdp.send('Accessibility.getFullAXTree')
  const field = nodes.find(node => node.name?.value === 'Root autocomplete 0')
  const controls = field?.properties?.find(property => property.name === 'controls')
  assert.equal(controls?.value?.relatedNodes?.length, 1)
})

test('filtered Select exposes its textbox and option menu as dialog siblings', async t => {
  const page = await pageFor(t)
  const selectHost = page.locator('a-button[aria-label="Repository"]')
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
  await filter.press('ArrowDown')
  assert.deepEqual(
    await filter.evaluate(input => ({
      controlsPopup: input.ariaControlsElements?.[0] === input.getRootNode().host.closest('a-menu'),
      controlledPart: input.ariaControlsElements?.[0]?.getAttribute('part') ?? null,
      controlledRole: input.ariaControlsElements?.[0]?.getAttribute('role') ?? null,
      activeRole: input.ariaActiveDescendantElement?.getAttribute('role') ?? null,
    })),
    { controlsPopup: true, controlledPart: null, controlledRole: 'dialog', activeRole: 'menuitemradio' },
  )
  await filter.fill('missing')
  await page.waitForTimeout(20)
  assert.equal(
    await popup.evaluate(menu => menu.shadowRoot.querySelector('[part="scroll"]').getAttribute('role')),
    null,
  )
})

test('dialog menus expose body items without a search field and clear empty menu semantics', async t => {
  const page = await pageFor(t)
  await page.evaluate(() => {
    const menu = document.createElement('a-menu')
    menu.id = 'preset-dialog'
    menu.setAttribute('role', 'dialog')
    menu.setAttribute('aria-label', 'Recency presets')
    menu.setAttribute('state', 'open')
    menu.innerHTML = `
      <a-menu-item slot="header" role="button">Header action</a-menu-item>
      <div data-presets><a-menu-item role="menuitem" tabindex="0">Today</a-menu-item></div>
      <a-menu-item slot="footer" role="button">Clear</a-menu-item>
    `
    document.body.append(menu)
  })
  const popup = page.locator('#preset-dialog')
  const snapshot = await popup.ariaSnapshot()
  assert.match(snapshot, /dialog "Recency presets"/)
  assert.match(snapshot, /menu "Options":\n\s+- menuitem "Today"/)
  assert.equal(await popup.locator('[part="scroll"]').getAttribute('aria-orientation'), 'vertical')

  await popup.locator('[data-presets]').evaluate(body => {
    body.innerHTML = '<p>No presets</p><a-menu><a-menu-item role="menuitem">Nested item</a-menu-item></a-menu>'
  })
  const region = popup.locator('[part="scroll"]').first()
  for (const attribute of ['role', 'aria-label', 'aria-orientation']) {
    assert.equal(await region.getAttribute(attribute), null)
  }
})

test('Menu cycles rendered Tab stops through shadow controls and skips unavailable controls', async t => {
  const page = await pageFor(t)
  await page.evaluate(() => {
    const menu = document.createElement('a-menu')
    menu.id = 'mixed-menu'
    menu.setAttribute('role', 'dialog')
    menu.setAttribute('state', 'open')
    menu.innerHTML = `
      <button id="last-control" slot="footer">Last</button>
      <a-menu-item id="row" role="menuitem" tabindex="0">Preset</a-menu-item>
      <a-input id="shadow-field" aria-label="Note"></a-input>
      <a-input-time id="time-field" locale="en-GB" value="10:30"></a-input-time>
      <button disabled>Disabled</button><button hidden>Hidden</button>
      <a-menu-item disabled tabindex="0">Disabled row</a-menu-item>
      <div inert><button>Inert</button></div><button tabindex="-1">Programmatic only</button>
      <a-menu><button>Nested control</button></a-menu>
      <button id="first-control" slot="header">First</button>
    `
    document.body.append(menu)
  })
  const ids = await page.locator('#time-field input').evaluateAll(inputs => inputs.map((input, i) => {
    input.id = `time-segment-${i}`
    return input.id
  }))
  assert.ok(ids.length >= 2)
  const focused = () => page.evaluate(() => {
    let el = document.activeElement
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement
    return el?.getRootNode().host?.id === 'shadow-field' ? 'shadow-field' : el?.id
  })
  const order = ['first-control', 'row', 'shadow-field', ...ids, 'last-control']
  await page.locator('#first-control').focus()
  for (const expected of [...order.slice(1), order[0]]) {
    await page.keyboard.press('Tab')
    assert.equal(await focused(), expected)
  }
  for (const expected of [...order].reverse()) {
    await page.keyboard.press('Shift+Tab')
    assert.equal(await focused(), expected)
  }
})

test('autocomplete Tab closes the popup and moves to the next control', async t => {
  const page = await pageFor(t)
  const field = page.getByRole('combobox', { name: 'Framework', exact: true })
  await field.fill('Re')
  await field.press('ArrowDown')
  const popup = page.locator('a-menu').filter({ has: page.getByRole('option', { name: 'React', exact: true }) })
  assert.equal(await popup.evaluate(menu => menu.isOpen), true)
  await field.press('Tab')
  assert.equal(await popup.evaluate(menu => menu.isOpen), false)
  assert.equal(await field.evaluate(input => input.getRootNode().activeElement === input), false)
})

test('autocomplete cursor uses a direct active-option relationship', async t => {
  const page = await pageFor(t)
  const field = page.locator('a-input').filter({ has: page.locator('input[aria-label="Framework"]') })
  const input = field.locator('input')
  await input.focus()
  await input.press('ArrowDown')
  const result = await input.evaluate(control => ({
    role: control.ariaActiveDescendantElement?.getAttribute('role') ?? null,
    id: control.ariaActiveDescendantElement?.getAttribute('id') ?? null,
    selected: control.ariaActiveDescendantElement?.internals?.ariaSelected ?? null,
  }))
  assert.deepEqual(result, { role: 'option', id: null, selected: 'true' })

  const cdp = await page.context().newCDPSession(page)
  const { nodes } = await cdp.send('Accessibility.getFullAXTree')
  const combobox = nodes.find(node => node.name?.value === 'Framework')
  const activeDescendant = combobox?.properties?.find(property => property.name === 'activedescendant')
  assert.equal(activeDescendant?.value?.relatedNodes?.length, 1)
})

test('searchable and editable SelectFaceted popups expose dialog semantics', async t => {
  const page = await pageFor(t)
  const trigger = page.locator('a-button').filter({ hasText: 'Filter issues' })
  assert.equal(await trigger.getAttribute('aria-haspopup'), 'dialog')
  await trigger.click()
  await page.waitForTimeout(20)

  const root = page.locator('a-menu[role="dialog"][aria-label="Filter issues options"]')
  assert.equal(
    await trigger.evaluate(button => button.internals?.ariaControlsElements?.[0] === button.nextElementSibling),
    true,
  )
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

test('faceted custom options preserve selection, disabled rows, and search', async t => {
  const page = await pageFor(t)
  page.setDefaultTimeout(5000)
  await page.locator('a-button').filter({ hasText: 'Custom filters' }).click()
  await page.waitForTimeout(20)
  const root = page.locator('a-menu[aria-label="Custom filters options"]')
  for (const kind of ['single', 'multiple']) {
    await root.locator('a-menu-item[submenu]').filter({ has: page.locator('a-menu-item-label', { hasText: new RegExp(`^${kind}$`) }) }).click()
    await page.waitForTimeout(20)
    const popup = page.locator(`a-menu[aria-label="${kind} options"]`)
    const alice = popup.locator(`[data-custom-option="${kind}:1"]`)
    const row = popup.locator(`a-menu-item:has([data-custom-option="${kind}:1"])`)
    assert.equal(await alice.getAttribute('data-selected'), 'true')
    assert.equal(await alice.textContent(), 'Alice Studio')
    assert.equal(await row.locator('a-menu-item-label, a-menu-item-hint, a-icon[shape="user"]').count(), 0)
    assert.equal(await row.getAttribute('aria-checked'), 'true')
    assert.equal(await popup.locator(`[data-custom-option="${kind}:2"]`).getAttribute('data-disabled'), 'true')
    assert.equal(await popup.locator(`a-menu-item:has([data-custom-option="${kind}:2"])`).getAttribute('aria-disabled'), 'true')
    assert.equal(await popup.getByText('Default row', { exact: true }).count(), 1)
    await alice.click()
    await page.waitForFunction(kind => document.querySelector(`[data-custom-option="${kind}:1"]`)?.dataset.selected === 'false', kind)
    assert.equal(await row.getAttribute('aria-checked'), 'false')
    await popup.getByRole('textbox').fill('Design')
    assert.equal(await popup.locator('[data-custom-option]').count(), 1)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(20)
  }
  await root.getByRole('textbox', { name: 'Filter all facets' }).fill('Design')
  for (const kind of ['single', 'multiple']) {
    const alice = root.locator(`[data-custom-option="${kind}:1"]`)
    assert.equal(await alice.count(), 1)
    assert.equal(await alice.getAttribute('data-selected'), 'false')
    await root.locator(`a-menu-item:has([data-custom-option="${kind}:1"])`).focus()
    await page.keyboard.press('Enter')
    await page.waitForFunction(kind => document.querySelector(`[data-custom-option="${kind}:1"]`)?.dataset.selected === 'true', kind)
  }
  assert.deepEqual(await page.evaluate(() => window.customFacetValue), { single: 1, multiple: [1] })
})

test('button-backed Select and editable InputDate retain their popup interactions', async t => {
  const page = await pageFor(t)
  const selectHost = page.locator('a-button[aria-label="Team"]')
  await selectHost.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(20)
  assert.equal(await selectHost.getAttribute('aria-expanded'), 'true')
  assert.deepEqual(
    await selectHost.evaluate(button => ({
      count: button.internals.ariaControlsElements?.length ?? 0,
      role: button.internals.ariaControlsElements?.[0]?.getAttribute('role') ?? null,
      open: button.internals.ariaControlsElements?.[0]?.isOpen ?? false,
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

test('InputDate resets nested menu state when a date pick closes its controlled popup', async t => {
  const page = await pageFor(t)
  const result = await page.evaluate(async () => {
    const field = [...document.querySelectorAll('a-input')]
      .find(input => input.shadowRoot?.querySelector('input[aria-label="Due date"]'))
    const popup = field.nextElementSibling
    const heading = popup.querySelector('[data-part="heading"]')
    const jump = heading.nextElementSibling
    const settle = () => new Promise(resolve => setTimeout(resolve, 20))
    const closes = []
    jump.addEventListener('statechange', event => {
      if (event.detail.next === 'closed') closes.push(event.detail.next)
    })
    const snapshot = menu => ({
      state: menu.getAttribute('state'),
      shown: menu.isOpen,
      popover: !!menu.shadowRoot.querySelector(':popover-open'),
    })
    const results = []
    for (const mode of ['adjacent', 'current', 'close-request']) {
      popup.open()
      await settle()
      jump.open()
      await settle()
      const opened = snapshot(jump)
      const beforeCloses = closes.length
      if (mode === 'close-request') popup.close()
      else popup.querySelector(mode === 'adjacent'
        ? 'a-button[data-outside]:not([disabled])'
        : 'a-button[data-date]:not([data-outside], [disabled], [selected])').click()
      await settle()
      results.push({ mode, opened, closed: snapshot(jump), parentOpen: popup.isOpen, closes: closes.length - beforeCloses })
    }
    return results
  })

  for (const row of result) {
    assert.deepEqual(row.opened, { state: 'open', shown: true, popover: true }, row.mode)
    assert.deepEqual(row.closed, { state: 'closed', shown: false, popover: false }, row.mode)
    assert.equal(row.parentOpen, false, row.mode)
    assert.equal(row.closes, 1, row.mode)
  }
})

test('nested menu outside clicks close only the branch above the clicked parent', async t => {
  const page = await pageFor(t)
  const result = await page.evaluate(async () => {
    const field = [...document.querySelectorAll('a-input')]
      .find(input => input.shadowRoot?.querySelector('input[aria-label="Due date"]'))
    const popup = field.nextElementSibling
    const heading = popup.querySelector('[data-part="heading"]')
    const jump = heading.nextElementSibling
    const flyout = jump.querySelector('a-menu')
    const settle = () => new Promise(resolve => setTimeout(resolve, 20))
    const pointer = element => element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, button: 0 }))
    const state = () => [popup.isOpen, jump.isOpen, flyout.isOpen]
    const openBranch = async () => {
      jump.open()
      await settle()
      flyout.open()
      await settle()
    }
    popup.open()
    await settle()
    await openBranch()

    pointer(flyout.querySelector('a-menu-item'))
    await settle()
    const insideChild = state()

    pointer(jump.querySelector(':scope > a-menu-item:last-child'))
    await settle()
    const insideYearList = state()

    pointer(heading)
    await settle()
    const triggerPointer = state()
    heading.click()
    await settle()
    const triggerToggle = state()

    await openBranch()
    pointer(popup.querySelector('[data-part="weekday"]'))
    await settle()
    const insideCalendar = state()

    await openBranch()
    const nextMonth = popup.querySelector('[aria-label="Next month"]')
    const oldHeading = heading.textContent
    pointer(nextMonth)
    nextMonth.click()
    await settle()
    const navigation = { parentOpen: popup.isOpen, childOpen: jump.isOpen, monthChanged: heading.textContent !== oldHeading }

    jump.open()
    await settle()
    pointer(document.body)
    await settle()
    const outsideAll = [popup.isOpen, jump.isOpen]
    return { insideChild, insideYearList, triggerPointer, triggerToggle, insideCalendar, navigation, outsideAll }
  })

  assert.deepEqual(result, {
    insideChild: [true, true, true],
    insideYearList: [true, true, false],
    triggerPointer: [true, true, false],
    triggerToggle: [true, false, false],
    insideCalendar: [true, false, false],
    navigation: { parentOpen: true, childOpen: false, monthChanged: true },
    outsideAll: [false, false],
  })
})

test('closing a nested date popup outside its facet flyout keeps the flyout open', async t => {
  const page = await pageFor(t)
  page.setDefaultTimeout(5000)
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.evaluate(() => window.mountHoverRange())
  const trigger = page.locator('a-button').filter({ hasText: 'Range filter' })
  await trigger.scrollIntoViewIfNeeded()
  await page.waitForTimeout(100)
  await trigger.click()
  const root = trigger.locator('xpath=following-sibling::a-menu[1]')
  const facet = root.locator('a-menu-item[submenu]')
  await page.waitForFunction(() => document.querySelector('a-menu[aria-label="Recency editor"]')?.listening)
  await facet.click()
  const editor = facet.locator('a-menu[aria-label="Recency editor"]')
  await page.waitForFunction(() => document.querySelector('a-menu[aria-label="Recency editor"]')?.isOpen)
  await editor.locator('a-radio[value="custom"]').click()
  await editor.locator('a-input').nth(1).click()
  const calendar = editor.locator('a-input').nth(1).locator('xpath=following-sibling::a-menu[1]')
  await page.waitForFunction(() => [...document.querySelectorAll('a-input + a-menu')].some(menu => menu.isOpen && menu.querySelector('a-calendar')))
  const outsideDate = await editor.evaluate(menu => {
    const bounds = menu.shadowRoot.querySelector('[popover]').getBoundingClientRect()
    const dateMenu = menu.querySelectorAll('a-input + a-menu')[1]
    const day = [...dateMenu.querySelectorAll('a-button[data-date]:not([disabled])')].find(button => {
      const r = button.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = r.top + r.height / 2
      return x > bounds.right && x < innerWidth && y > 0 && y < innerHeight
    })
    return day?.getAttribute('data-date')
  })
  assert.ok(outsideDate, 'the date picker must extend beyond the facet flyout')
  await calendar.locator(`a-button[data-date="${outsideDate}"]`).click()
  await page.waitForTimeout(250)
  assert.equal(await calendar.evaluate(menu => menu.isOpen), false)
  assert.equal(await editor.evaluate(menu => menu.isOpen), true)
  assert.equal(await root.evaluate(menu => menu.isOpen), true)

  const bounds = await editor.evaluate(menu => menu.shadowRoot.querySelector('[popover]').getBoundingClientRect().toJSON())
  await page.mouse.move(bounds.left + 20, bounds.top + 20)
  await page.mouse.move(10, 10)
  await page.waitForTimeout(250)
  assert.equal(await editor.evaluate(menu => menu.isOpen), false)
  assert.equal(await root.evaluate(menu => menu.isOpen), true)
})

test('Calendars in separate renderer roots use direct names without duplicate IDs', async t => {
  const page = await pageFor(t)
  const result = await page.locator('a-calendar').evaluateAll(calendars => ({
    names: calendars.map(calendar => calendar.getAttribute('aria-label')),
    labelledBy: calendars.map(calendar => calendar.hasAttribute('aria-labelledby')),
    headingIds: calendars.map(calendar => calendar.previousElementSibling?.querySelector?.('[data-part="heading"]')?.id ?? ''),
  }))

  const juneIndexes = result.names.map((name, index) => name === 'June 2026' ? index : -1).filter(index => index >= 0).slice(-2)
  assert.equal(juneIndexes.length, 2)
  assert.deepEqual(juneIndexes.map(index => result.labelledBy[index]), [false, false])
  assert.deepEqual(juneIndexes.map(index => result.headingIds[index]), ['', ''])
})

test('Checkbox, Switch, and Radio expose their light-DOM hints as descriptions', async t => {
  const page = await pageFor(t)
  const result = await page.evaluate(async () => {
    await new Promise(resolve => queueMicrotask(resolve))
    const controls = [
      document.querySelector('#described-checkbox'),
      document.querySelector('#described-switch'),
      [...document.querySelectorAll('a-radio')].find(radio => radio.getAttribute('value') === 'email'),
    ]
    return controls.map(control => {
      const internals = control.internals
      return {
        hint: internals?.ariaDescribedByElements?.[0]?.textContent ?? null,
        hintHasId: internals?.ariaDescribedByElements?.[0]?.hasAttribute('id') ?? null,
      }
    })
  })

  assert.deepEqual(result, [
    { hint: 'Weekly digest, never marketing.', hintHasId: false },
    { hint: 'Downloads in the background.', hintHasId: false },
    { hint: 'A confirmation link goes to your inbox.', hintHasId: false },
  ])

  const cdp = await page.context().newCDPSession(page)
  const { nodes } = await cdp.send('Accessibility.getFullAXTree')
  const descriptionOf = (role, name) =>
    nodes.find(node => node.role?.value === role && node.name?.value === name)?.description?.value
  assert.equal(descriptionOf('checkbox', 'Email notifications'), 'Weekly digest, never marketing.')
  assert.equal(descriptionOf('switch', 'Automatic updates'), 'Downloads in the background.')
  assert.equal(descriptionOf('radio', 'Email'), 'A confirmation link goes to your inbox.')
})


test('Select buttons open once with arrows, Enter, and Space and retain focus-visible styling', async t => {
  const page = await pageFor(t)
  for (const name of ['Team', 'Repository', 'Departments']) {
    const trigger = name === 'Departments' ? page.locator('a-select-field').filter({ has: page.locator('a-select-label', { hasText: name }) }).locator(':scope > a-button') : page.getByRole('button', { name, exact: true })
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Space']) {
      await trigger.focus()
      await page.keyboard.press(key)
      assert.equal(await trigger.getAttribute('aria-expanded'), 'true', `${name}: ${key}`)
      await page.keyboard.press('Escape')
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false', `${name}: Escape`)
    }
  }
  const trigger = page.getByRole('button', { name: 'Team', exact: true })
  await page.mouse.click(1200, 700)
  await trigger.click()
  assert.equal(await trigger.evaluate(el => el.matches(':focus-visible')), false)
  assert.equal(await trigger.evaluate(el => getComputedStyle(el).outlineStyle), 'none')
  await page.keyboard.press('Escape')
  await trigger.focus()
  assert.equal(await trigger.evaluate(el => el.matches(':focus-visible')), true)
  assert.equal(await trigger.evaluate(el => getComputedStyle(el).outlineStyle), 'solid')
  const disabled = page.getByRole('button', { name: 'Disabled select' })
  assert.equal(await disabled.getAttribute('tabindex'), '-1')
  await disabled.dispatchEvent('keydown', { key: 'ArrowDown' })
  assert.equal(await disabled.getAttribute('aria-expanded'), 'false')
})

test('Select exposes its selection after choosing a value', async t => {
  const page = await pageFor(t)
  const trigger = page.getByRole('button', { name: 'Team', exact: true })
  const cdp = await page.context().newCDPSession(page)
  for (const value of ['Design', 'Engineering']) {
    await trigger.click()
    await page.getByRole('menuitemradio', { name: value, exact: true }).click()
    const { nodes } = await cdp.send('Accessibility.getFullAXTree')
    const node = nodes.find(node => node.role?.value === 'button' && node.name?.value === 'Team')
    assert.equal(node?.description?.value, value)
  }
})

test('Select preserves rich labels, hints, and long-value ellipsis on Anta Button', async t => {
  const page = await pageFor(t)
  const trigger = page.locator('a-select-field').filter({ has: page.locator('a-select-label', { hasText: 'Departments' }) }).locator(':scope > a-button')
  assert.equal(await trigger.evaluate(el => el.localName), 'a-button')
  const cdp = await page.context().newCDPSession(page)
  const { nodes } = await cdp.send('Accessibility.getFullAXTree')
  const node = nodes.find(node => node.role?.value === 'button' && node.name?.value === 'Departments')
  assert.equal(node?.description?.value, 'Engineering department with a very long name Choose departments')
  await trigger.evaluate(el => {
    el.setAttribute('aria-label', 'Override departments')
    el.parentElement.querySelector('a-select-hint').textContent = 'Updated hint'
  })
  const updated = (await cdp.send('Accessibility.getFullAXTree')).nodes.find(node =>
    node.role?.value === 'button' && node.name?.value === 'Override departments')
  assert.equal(updated?.description?.value, 'Engineering department with a very long name Updated hint')

  const label = trigger.locator('a-button-label')
  assert.deepEqual(await label.evaluate(el => ({
    overflow: getComputedStyle(el).textOverflow,
    clipped: el.scrollWidth > el.clientWidth,
  })), { overflow: 'ellipsis', clipped: true })
})
