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
    stdin: { contents: "import './src/elements/a-button'; import './src/elements/a-input'", resolveDir: resolve('.') },
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

test('Button gathers repeated field names without losing values or special keys', async t => {
  const page = await browser.newPage()
  t.after(() => page.close())
  await page.setContent('<form><input name="single" value="one"><input name="many" value="first"><input name="many" value="second"><input name="many" value="third"><input name="__proto__" value="safe"><a-button type="submit"></a-button></form>')
  await page.addScriptTag({ content: script })
  const result = await page.evaluate(() => {
    const form = document.querySelector('form')
    let gathered
    form.addEventListener('submit', event => event.preventDefault())
    form.addEventListener('submitdetailed', event => gathered = event.detail.formData)
    form.querySelector('a-button').click()
    return JSON.stringify(gathered)
  })
  assert.deepEqual(JSON.parse(result), {single:'one',many:['first','second','third'],['__proto__']:'safe'})
})

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

test('Button retains array-valued field shapes with zero, one, and multiple entries',async t=>{
  const page=await browser.newPage();t.after(()=>page.close())
  await page.setContent(`<form id="values"><input name="single" value="one"><select multiple name="native"><option value="a" selected>A</option><option value="b">B</option></select><fieldset><a-input button name="custom" form-value='["first"]'></a-input></fieldset><a-button type="submit"></a-button></form><a-input form="values" name="external" form-value='[]'></a-input>`)
  await page.addScriptTag({content:script})
  const gather=()=>page.evaluate(()=>{
    const form=document.querySelector('form');let values
    const handler=event=>values=event.detail.formData
    form.addEventListener('submit',event=>event.preventDefault(),{once:true})
    form.addEventListener('submitdetailed',handler,{once:true})
    form.querySelector('a-button').click()
    return values
  })
  assert.deepEqual(await gather(),{single:'one',native:['a'],custom:['first'],external:[]})
  await page.evaluate(()=>{
    const select=document.querySelector('select');select.options[1].selected=true
    document.querySelector('[name="custom"]').formValue=['first','second']
  })
  assert.deepEqual(await gather(),{single:'one',native:['a','b'],custom:['first','second'],external:[]})
  await page.evaluate(()=>{
    const select=document.querySelector('select');select.selectedIndex=-1
    document.querySelector('[name="custom"]').formValue=[]
  })
  assert.deepEqual(await gather(),{single:'one',native:[],custom:[],external:[]})
  await page.evaluate(()=>{
    document.querySelector('fieldset').disabled=true
    document.querySelector('select').disabled=true
    document.querySelector('[name="external"]').setAttribute('disabled','')
  })
  assert.deepEqual(await gather(),{single:'one'})
})

test('Button blocks native and detailed submission for invalid fields and respects novalidate',async t=>{
  const page=await browser.newPage();t.after(()=>page.close())
  await page.setContent('<form><input name="value" required><a-button type="submit"></a-button></form>')
  await page.addScriptTag({content:script})
  const result=await page.evaluate(()=>{
    const form=document.querySelector('form'),button=form.querySelector('a-button')
    let submits=0,details=0
    form.addEventListener('submit',event=>{event.preventDefault();submits++})
    form.addEventListener('submitdetailed',()=>details++)
    const read=()=>({submits,details})
    button.click();const invalid=read()
    form.noValidate=true;button.click();const bypass=read()
    form.noValidate=false;form.querySelector('input').value='present';button.click()
    return {invalid,bypass,valid:read()}
  })
  assert.deepEqual(result,{invalid:{submits:0,details:0},bypass:{submits:1,details:1},valid:{submits:2,details:2}})
})
