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
      contents: `import './src/elements/a-button'`,
      resolveDir: resolve('.'),
    },
    bundle: true,
    write: false,
    outfile: 'button-form.js',
    format: 'esm',
    target: 'es2022',
  })
  script = result.outputFiles.find(file => file.path.endsWith('.js')).text
  browser = await chromium.launch({
    headless: true,
    channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined,
  })
})

after(async () => browser?.close())

async function pageFor(t) {
  const page = await browser.newPage()
  t.after(() => page.close())
  await page.route('http://button-form.test/**', route => {
    const pathname = new URL(route.request().url()).pathname
    return route.fulfill({
      contentType: pathname.endsWith('.js') ? 'text/javascript' : 'text/html',
      body: pathname.endsWith('.js') ? script : `<!doctype html>
        <div id="wrong-target"></div>
        <form id="valid-form"><input name="field" value="original"></form>
        <a-button id="wrong-submit" type="submit" form="wrong-target" tabindex="0">Submit</a-button>
        <a-button id="missing-submit" type="submit" form="missing-target" tabindex="0">Submit</a-button>
        <a-button id="wrong-reset" type="reset" form="wrong-target" tabindex="0">Reset</a-button>
        <a-button id="missing-reset" type="reset" form="missing-target" tabindex="0">Reset</a-button>
        <a-button id="valid-submit" type="submit" form="valid-form" tabindex="0">Submit</a-button>
        <a-button id="valid-reset" type="reset" form="valid-form" tabindex="0">Reset</a-button>
        <script type="module" src="/button-form.js"></script>`,
    })
  })
  await page.goto('http://button-form.test/')
  await page.waitForFunction(() => customElements.get('a-button'))
  return page
}

async function activateWithPointerAndKeyboard(page, selector) {
  const button = page.locator(selector)
  await button.click()
  await button.press('Enter')
  await button.press('Space')
}

test('Button ignores missing and non-form form references for every activation path', async t => {
  const page = await pageFor(t)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.evaluate(() => {
    window.clicks = {}
    for (const button of document.querySelectorAll('a-button')) {
      button.addEventListener('click', () => {
        window.clicks[button.id] = (window.clicks[button.id] ?? 0) + 1
      })
    }
  })

  for (const id of ['wrong-submit', 'missing-submit', 'wrong-reset', 'missing-reset']) {
    await activateWithPointerAndKeyboard(page, `#${id}`)
  }

  assert.deepEqual(errors, [])
  assert.deepEqual(await page.evaluate(() => window.clicks), {
    'wrong-submit': 3,
    'missing-submit': 3,
    'wrong-reset': 3,
    'missing-reset': 3,
  })
})

test('Button keeps valid external form submission and reset behavior', async t => {
  const page = await pageFor(t)
  await page.evaluate(() => {
    window.submits = 0
    window.detailedSubmits = 0
    const form = document.querySelector('#valid-form')
    form.addEventListener('submit', event => {
      event.preventDefault()
      window.submits++
    })
    form.addEventListener('submitdetailed', () => window.detailedSubmits++)
  })

  await activateWithPointerAndKeyboard(page, '#valid-submit')
  assert.deepEqual(await page.evaluate(() => ({
    submits: window.submits,
    detailedSubmits: window.detailedSubmits,
  })), { submits: 3, detailedSubmits: 3 })

  await page.locator('input').fill('changed')
  await page.locator('#valid-reset').click()
  assert.equal(await page.locator('input').inputValue(), 'original')
})
