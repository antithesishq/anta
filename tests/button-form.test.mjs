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
    stdin: { contents: "import './src/elements/a-button'", resolveDir: resolve('.') },
    bundle: true,
    write: false,
    outfile: 'button-form.js',
    format: 'iife',
    target: 'es2022',
  })
  script = result.outputFiles.find(file => file.path.endsWith('.js')).text
  browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
})

after(async () => browser?.close())

test('Button uses only HTML forms for explicit and ancestor targets', async t => {
  const page = await browser.newPage()
  t.after(() => page.close())
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setContent(`
    <form id="valid">
      <input name="field" value="original">
      <a-button id="implicit" type="submit"></a-button>
      <a-button id="empty" type="submit" form=""></a-button>
    </form>
    <div id="wrong"></div>
    <a-button id="nonform" type="submit" form="wrong"></a-button>
    <a-button id="missing" type="submit" form="absent"></a-button>
    <a-button id="external" type="submit" form="valid"></a-button>
    <a-button id="reset" type="reset" form="valid"></a-button>
  `)
  await page.addScriptTag({ content: script })
  const result = await page.evaluate(() => {
    const form = document.getElementById('valid')
    const input = form.querySelector('input')
    let submits = 0
    form.addEventListener('submit', event => { event.preventDefault(); submits++ })
    const svgForm = document.createElementNS('http://www.w3.org/2000/svg', 'form')
    svgForm.id = 'svg-form'
    document.body.append(svgForm)
    const svgChild = document.createElement('a-button')
    svgChild.setAttribute('type', 'reset')
    svgForm.append(svgChild)
    const svgSubmit = document.createElement('a-button')
    svgSubmit.setAttribute('type', 'submit')
    svgSubmit.setAttribute('form', 'svg-form')
    document.body.append(svgSubmit)

    for (const id of ['nonform', 'missing', 'empty']) document.getElementById(id).click()
    svgChild.click()
    svgSubmit.click()
    const invalidSubmits = submits
    document.getElementById('external').click()
    document.getElementById('implicit').click()
    input.value = 'changed'
    document.getElementById('reset').click()
    return { invalidSubmits, submits, resetValue: input.value }
  })

  assert.deepEqual(errors, [])
  assert.deepEqual(result, { invalidSubmits: 0, submits: 2, resetValue: 'original' })
})
