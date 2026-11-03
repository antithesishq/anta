import assert from 'node:assert/strict'
import { before, after } from 'node:test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { Database, test as hegel } from '@hegeldev/hegel'
import * as gs from '@hegeldev/hegel/generators'
import { componentTest as test, componentEngines } from './component-tier.mjs'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium, firefox, webkit } = requireSite('playwright')
const engines = componentEngines([chromium, firefox, webkit])
const browsers = new Map()
let wrapper, elements

before(async () => {
  const options = { bundle: true, write: false, format: 'iife', target: 'es2022', absWorkingDir: process.cwd(), nodePaths: [resolve('site/node_modules')], alias: { react: requireSite.resolve('preact/compat') } }
  wrapper = await build({ ...options, stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
    import React from 'react';
    import { render } from 'preact';
    import { Button, Checkbox, RadioGroup, Switch, Slider, Tabs, TabPanel, Input, Calendar, Select, Dialog, Expander, configure } from './src/index';
    configure(React.createElement, React.Fragment, React);
    const options = [{value:'a', label:'Apple'}, {value:'b', label:'Orange'}];
    window.mountFixtures = () => render(<>
      <Button label="Button" />
      <Checkbox label="Checkbox" defaultChecked={false} />
      <RadioGroup label="Radio" options={options} defaultValue="a" />
      <Switch label="Switch" defaultChecked={false} />
      <Slider label="Slider" min={0} max={100} step={5} defaultValue={50} />
      <Tabs label="Tabs" options={options} defaultValue="a"><TabPanel value="a">One</TabPanel><TabPanel value="b">Two</TabPanel></Tabs>
      <Input label="Input" defaultValue="text" clearable />
      <Calendar aria-label="Calendar" defaultValue="2026-07-04" locale="en-US" />
      <section id="select-fixture"><Select label="Select" options={options} defaultValue="a" /></section>
      <Dialog header="Dialog" open={false} closable><p>Dialog contents</p></Dialog>
      <Expander title="Expander"><p>Expander content</p></Expander>
    </>, document.querySelector('#fixtures'));
  ` }, outfile: 'wrapper.js' })
  elements = await build({ ...options, entryPoints: ['src/elements/index.ts'], outfile: 'elements.js' })
  for (const engine of engines) browsers.set(engine, await engine.launch({ headless: true }))
})
after(async () => Promise.all([...browsers.values()].map(browser => browser.close())))

for (const engine of engines) test.fast(`${engine.name()}: renderer-owned DOM survives component histories`, async t => {
  const page = await browsers.get(engine).newPage()
  t.after(() => page.close())
  page.setDefaultTimeout(2000)
  await page.setContent('<main id="fixtures"></main>')
  await page.addScriptTag({ content: wrapper.outputFiles[0].text })
  await page.evaluate(() => {
    window.mountFixtures()
    const original = document.querySelector('#fixtures')
    original.replaceWith(original.cloneNode(true))
    window.phase = 'upgrade'
    window.violations = []
    window.events = {}
    for (const type of ['click', 'keydown', 'input', 'change', 'statechange']) document.addEventListener(type, event => {
      const name = event.composedPath().find(node => node.localName?.startsWith('a-'))?.localName
      if (name) window.events[name + ':' + type] = (window.events[name + ':' + type] || 0) + 1
    }, true)
    window.collect = records => {
      for (const record of records) {
        // Shadow-hosted controls can consume renderer-provided ARIA declarations.
        if (record.type === 'attributes' && ['a-input', 'a-input-time'].includes(record.target.localName) &&
            (record.attributeName === 'role' || record.attributeName.startsWith('aria-')) &&
            !record.target.hasAttribute(record.attributeName)) continue
        window.violations.push({ type: record.type, target: record.target.nodeName, attribute: record.attributeName, oldValue: record.oldValue, phase: window.phase })
      }
    }
    window.observer = new MutationObserver(window.collect)
    const options = { subtree: true, childList: true, characterData: true, characterDataOldValue: true, attributes: true, attributeOldValue: true }
    window.observer.observe(document.querySelector('#fixtures'), options)
    // Keep observing component hosts even while they are detached.
    for (const el of document.querySelector('#fixtures').querySelectorAll('*')) {
      if (el.localName.startsWith('a-')) window.observer.observe(el, options)
    }
  })
  await page.addStyleTag({ content: elements.outputFiles.find(file => file.path.endsWith('.css')).text })
  await page.addScriptTag({ content: elements.outputFiles.find(file => file.path.endsWith('.js')).text })
  await page.waitForTimeout(150)
  const registration = await page.evaluate(() => { window.collect(window.observer.takeRecords()); return window.violations.splice(0) })
  assert.deepEqual(registration, [], 'upgrade and connection must preserve authored DOM')

  // Prove that even a transient forbidden write is detected.
  const fault = await page.evaluate(() => {
    const target = document.querySelector('a-checkbox')
    target.setAttribute('data-injected-fault', '1')
    target.removeAttribute('data-injected-fault')
    window.collect(window.observer.takeRecords())
    return window.violations.splice(0)
  })
  assert.equal(fault.length, 2)

  await page.locator('a-checkbox').click()
  const checkboxEvents = await page.evaluate(() => window.events['a-checkbox:statechange'] ?? 0)
  assert.ok(checkboxEvents > 0, 'checkbox interaction must reach the component')

  const selectors = ['a-button', 'a-checkbox', 'a-radio', 'a-switch', 'a-slider', 'a-tab', 'a-input:not(#select-fixture a-input)', 'a-calendar', '#select-fixture a-input', 'a-expander', 'a-dialog']
  const keys = ['Space', 'ArrowRight', 'ArrowDown', 'Enter', 'Escape']
  const seed = Number(process.env.ANTA_OWNERSHIP_SEED ?? 42)
  const steps = Number(process.env.ANTA_OWNERSHIP_STEPS ?? 30)
  let sequence
  hegel(tc => { sequence = Array.from({ length: steps }, () => ({
    selector: tc.draw(gs.sampledFrom(selectors)),
    key: tc.draw(gs.sampledFrom(keys)),
    click: tc.draw(gs.booleans()),
    update: tc.draw(gs.booleans()),
  })) }, { seed, testCases: 1, database: Database.disabled })
  const stats = { clicks: 0, missedClicks: 0, keys: 0, propUpdates: 0, remounts: 0 }
  for (const [index, step] of sequence.entries()) {
    await page.evaluate(label => { window.collect(window.observer.takeRecords()); window.phase = label }, `${seed}:${index} ${JSON.stringify(step)}`)
    const target = page.locator(step.selector).first()
    if (!await target.count()) continue
    if (index % 17 === 0) {
      await target.evaluate(el => {
        window.collect(window.observer.takeRecords())
        const parent = el.parentNode, next = el.nextSibling
        el.remove()
        parent.insertBefore(el, next)
        const records = window.observer.takeRecords()
        for (const direction of ['removedNodes', 'addedNodes']) {
          const authored = records.findIndex(record => record.type === 'childList' && record.target === parent && Array.from(record[direction]).includes(el))
          if (authored !== -1) records.splice(authored, 1)
        }
        window.collect(records)
      })
      stats.remounts++
    }
    if (step.update) {
      // Remove the one renderer-authored record, but retain any side effects
      // synchronously produced by attributeChangedCallback and later work.
      await target.evaluate(el => {
        window.collect(window.observer.takeRecords())
        const name = el.localName === 'a-dialog' ? 'state' : 'disabled'
        if (name === 'state') el.setAttribute(name, el.getAttribute(name) === 'open' ? 'closed' : 'open')
        else el.toggleAttribute(name)
        const records = window.observer.takeRecords()
        const authored = records.findIndex(record => record.target === el && record.attributeName === name)
        if (authored !== -1) records.splice(authored, 1)
        window.collect(records)
      })
      stats.propUpdates++
    }
    await target.evaluate(el => el.focus())
    await page.keyboard.press(step.key)
    stats.keys++
    if (step.click) {
      try { await target.click({ timeout: 200 }); stats.clicks++ }
      catch (error) {
        if (error.name !== 'TimeoutError') throw error
        stats.missedClicks++
      }
    }
  }
  await page.waitForTimeout(150)
  const { mutations, events } = await page.evaluate(() => {
    window.collect(window.observer.takeRecords())
    return { mutations: window.violations, events: window.events }
  })
  console.log(`ownership seed=${seed} steps=${steps}`, stats, events)
  assert.deepEqual(mutations, [], 'interactions must preserve authored DOM')
})
