import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { componentEngines } from './component-tier.mjs'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium, firefox, webkit } = requireSite('playwright')

export const engines = componentEngines([chromium, firefox, webkit])
const browsers = new Map()
let script, css

export async function startForm() {
  const result = await build({
    entryPoints: ['tests/form.fixture.tsx'], bundle: true, write: false,
    outfile: 'form.js', format: 'iife', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('site/node_modules')],
    alias: {
      '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
      react: requireSite.resolve('preact/compat'),
    },
  })
  script = result.outputFiles.find(file => file.path.endsWith('.js')).text
  css = result.outputFiles.find(file => file.path.endsWith('.css')).text
  for (const engine of engines) {
    browsers.set(engine, await engine.launch({
      headless: true,
      ...(engine === chromium ? { channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined } : {}),
    }))
  }
}

export const stopForm = () => Promise.all([...browsers.values()].map(browser => browser.close()))

/** A page with the markup, Anta's styles, and then the elements. `upgrade:
 *  false` leaves the elements undefined, as before their script loads. */
export async function formPage(t, engine, html, { upgrade = true } = {}) {
  const page = await browsers.get(engine).newPage({ viewport: { width: 1200, height: 900 } })
  t.after(() => page.close())
  page.setDefaultTimeout(20_000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  // A doctype: in quirks mode a form gets a 1em bottom margin.
  await page.setContent(`<!doctype html><body style="margin:0">${html}<div id="mount"></div></body>`)
  await page.addStyleTag({ content: css })
  if (upgrade) {
    await page.addScriptTag({ content: script })
    await page.waitForFunction(() => [...document.querySelectorAll('a-input')].every(el => el.shadowRoot))
    // Input fades in as it upgrades when a frame was painted first. End that
    // transition so a test that counts animations counts only Form's glide.
    await page.evaluate(() => document.getAnimations()
      .filter(animation => animation instanceof CSSTransition && animation.effect?.target?.localName === 'a-input')
      .forEach(animation => animation.finish()))
  }
  return { page, errors }
}

export const input = (name, label, { hint = '', attrs = '' } = {}) =>
  `<a-input name="${name}" ${attrs}>${label ? `<span slot="label">${label}</span>` : ''}${hint ? `<span slot="hint">${hint}</span>` : ''}</a-input>`

export const submit = (id, attrs = '') =>
  `<a-button id="${id}" role="button" tabindex="0" type="submit" ${attrs}><a-button-label>Save</a-button-label></a-button>`

export const frames = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))))
