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
        import { InputAutocomplete, InputDate, InputTime, Select } from './src/index'
        import './src/elements/index'
        configure(h)
        render(h('main', {},
          h(InputAutocomplete, { label: 'Framework', suggestions: ['React', 'Preact'] }),
          h(InputDate, { label: 'Due date' }),
          h(Select, { label: 'Team', options: ['Design', 'Engineering'] }),
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
    const autoControl = autocomplete.shadowRoot.querySelector('input')
    const dateControl = date.shadowRoot.querySelector('input')
    const selectControl = select.shadowRoot.querySelector('button')
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
    }
  })

  assert.deepEqual(result, {
    autocomplete: { hostRole: false, role: 'combobox', popup: 'listbox', controlsRole: 'listbox' },
    date: { hostRole: false, role: 'combobox', popup: 'dialog', controlsRole: 'dialog' },
    select: { hostRole: false, tag: 'button', role: null, popup: 'menu', controlsRole: 'menu' },
  })
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
