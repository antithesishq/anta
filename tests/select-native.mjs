import assert from 'node:assert/strict'
import { before, after } from 'node:test'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { componentTest as test, componentEngines } from './component-tier.mjs'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium, firefox, webkit } = requireSite('playwright')
const engines = componentEngines([chromium, firefox, webkit])
const browsers = new Map()
let server, origin
const assets = new Map()
const options = '<option value="stream">Stream</option><optgroup label="Metadata"><option value="container">Container</option><option value="archived" disabled>Archived</option><option value="file">File path</option></optgroup>'
const rich = '<button type="button"><selectedcontent></selectedcontent></button><option value="finance"><a-menu-item-text><a-menu-item-label>Alex Morgan</a-menu-item-label> <a-menu-item-hint>Accountant · Finance</a-menu-item-hint></a-menu-item-text></option><option value="design"><a-menu-item-text><a-menu-item-label>Alex Morgan</a-menu-item-label> <a-menu-item-hint>Designer · Product</a-menu-item-hint></a-menu-item-text></option>'

before(async () => {
  const result = await build({stdin:{contents:"@import './src/tokens.css'; @import './src/reset.css'; @import './src/elements/a-select.css';",loader:'css',resolveDir:process.cwd()},bundle:true,write:false,minify:true})
  assets.set('/select.css', result.outputFiles[0].text)
  assets.set('/theme.css', await readFile('src/theme-antithesis.css','utf8'))
  assets.set('/antune.css', await readFile('src/theme-antune.css','utf8'))
  assets.set('/fixture.css', 'body{padding:32px;background:var(--bg-1);color:var(--text-1)}form{display:grid;gap:12px;max-width:320px}label{display:grid;gap:4px}')
  server = createServer((req,res) => {
    if (assets.has(req.url)) {res.setHeader('Content-Type','text/css'); return res.end(assets.get(req.url))}
    const theme = req.url.includes('antithesis') ? '<link rel="stylesheet" href="/theme.css">' : req.url.includes('antune') ? '<link rel="stylesheet" href="/antune.css">' : ''
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'none'; style-src 'self'; style-src-attr 'none'; object-src 'none'")
    res.end(`<!doctype html><html class="${req.url.includes('dark')?'dark':'light'}"><meta charset="utf-8"><link rel="stylesheet" href="/select.css">${theme}<link rel="stylesheet" href="/fixture.css"><body><form>
      <label>Output<select data-anta name="output" id="plain">${options}</select></label>
      <label>Small<select data-anta data-anta-size="small" id="small">${options}</select></label>
      <label>Large<select data-anta data-anta-size="large" id="large">${options}</select></label>
      <label>Recipient<select data-anta name="recipient" id="rich">${rich}</select></label>
      <label>Authored trigger<select data-anta id="legacy"><button type="button"><selectedcontent></selectedcontent><a-icon shape="chevron-down" aria-hidden="true"></a-icon></button>${options}</select></label>
      <label>Disabled<select data-anta disabled id="disabled">${options}</select></label>
      <label>Required<select data-anta required name="required" id="required"><option value="">Choose an output</option>${options}</select></label>
      <label>Listbox<select data-anta size="4" id="listbox">${options}</select></label>
      <label>Multiple<select data-anta multiple name="multiple" id="multiple">${options}</select></label>
      <label>Unstyled<select id="unstyled">${options}</select></label>
    </form></body></html>`)
  })
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  for (const engine of engines) browsers.set(engine.name(),await engine.launch())
})
after(async () => {
  await Promise.all([...browsers.values()].map(browser=>browser.close()))
  await new Promise(resolve=>server?.close(resolve))
})

for (const engine of engines) {
  const name = engine.name()
  test.fast(`${name}: native selects preserve browser selection and form behavior`,async t=>{
    const page = await browsers.get(name).newPage()
    t.after(()=>page.close())
    await page.goto(origin)
    assert.equal(await page.locator('#required').evaluate(node=>node.validity.valueMissing),true)
    await page.locator('#plain').selectOption('container')
    await page.locator('#rich').selectOption('design')
    await page.locator('#required').selectOption('stream')
    await page.locator('#multiple').selectOption(['stream','file'])
    assert.deepEqual(await page.locator('form').evaluate(form=>[...new FormData(form)]),[
      ['output','container'],['recipient','design'],['required','stream'],['multiple','stream'],['multiple','file'],
    ])
    await page.locator('form').evaluate(form=>form.reset())
    assert.equal(await page.locator('#plain').inputValue(),'stream')
    assert.equal(await page.locator('#rich').inputValue(),'finance')
    for (const id of ['listbox','multiple','unstyled']) {
      assert.notEqual(await page.locator('#'+id).evaluate(node=>getComputedStyle(node).appearance),'base-select')
    }
    const enhanced = await page.evaluate(()=>CSS.supports('appearance','base-select'))
    if (!enhanced) {
      assert.notEqual(await page.locator('#plain').evaluate(node=>getComputedStyle(node).appearance),'base-select')
      return
    }
    await page.locator('#plain').click()
    assert.equal(await page.locator('#plain').evaluate(node=>node.matches(':open')),true)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    assert.equal(await page.locator('#plain').inputValue(),'container')
    assert.equal(await page.locator('#plain').evaluate(node=>node.matches(':open')),false)
    await page.locator('#plain').click()
    await page.locator('#plain').getByRole('option',{name:'File path',exact:true}).click()
    assert.equal(await page.locator('#plain').inputValue(),'file')
    await page.locator('#rich').click()
    await page.locator('#rich').getByRole('option',{name:'Alex Morgan Designer · Product'}).click()
    assert.match(await page.locator('#rich selectedcontent').innerText(),/Designer · Product/)
    assert.equal(await page.locator('#rich').inputValue(),'design')
    await page.locator('#plain').click()
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('#plain').evaluate(node=>node.matches(':open')),false)
  })

  test(`${name}: native trigger, picker, and rich rows across themes`,{tier:'fast'},async t=>{
    const page = await browsers.get(name).newPage({viewport:{width:800,height:1000}})
    t.after(()=>page.close())
    for (const theme of ['default','antithesis']) for (const mode of ['light','dark']) {
      await page.goto(`${origin}/${theme}-${mode}`)
      const enhanced = await page.evaluate(()=>CSS.supports('appearance','base-select'))
      if (!enhanced) continue
      for (const [id,height] of [['plain',28],['small',24],['large',32]]) {
        const box = await page.locator('#'+id).boundingBox()
        assert.equal(box.height,height,`${theme}/${mode} ${id} height`)
      }
      const closed = await page.locator('#plain').evaluate(node=>({
        display:getComputedStyle(node,'::picker(select)').display,
        icon:getComputedStyle(node,'::picker-icon').display,
        padding:getComputedStyle(node).paddingInlineStart,
      }))
      assert.equal(closed.display,'none','closed picker is hidden')
      assert.notEqual(closed.icon,'none','plain markup has a chevron')
      assert.equal(closed.padding,'7px')
      assert.equal(await page.locator('#disabled').evaluate(node=>getComputedStyle(node).cursor),'not-allowed')
      assert.equal(await page.locator('#legacy').evaluate(node=>getComputedStyle(node,'::picker-icon').display),'none','authored chevron suppresses the default icon')
      assert.equal((await page.locator('#legacy').boundingBox()).height,28,'authored trigger fits the field')
      assert.ok((await page.locator('#rich').boundingBox()).height>28,'rich trigger grows to hold its hint')
      await page.locator('#plain').click()
      assert.equal(await page.locator('#plain').evaluate(node=>getComputedStyle(node,'::picker(select)').display),'flex')
      const disabled = page.locator('#plain option:disabled')
      assert.equal(await disabled.evaluate(node=>getComputedStyle(node).cursor),'default')
      await disabled.hover()
      assert.equal(await disabled.evaluate(node=>getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)')
      if (theme==='antithesis') {
        assert.equal(await page.locator('#plain').evaluate(node=>getComputedStyle(node,'::picker(select)').borderRadius),'2px')
      }
      await page.keyboard.press('Escape')
      await page.locator('#rich').click()
      await mkdir('tests/.test-output/select',{recursive:true})
      await page.screenshot({animations:'disabled',path:resolve(`tests/.test-output/select/native-${name}-${theme}-${mode}.png`)})
      await page.keyboard.press('Escape')
    }
  })

  test.fast(`${name}: native select focus follows its theme and motion preference`,async t=>{
    const page = await browsers.get(name).newPage()
    t.after(()=>page.close())
    for (const theme of ['default','antune','antithesis']) for (const mode of ['light','dark']) {
      await page.goto(`${origin}/${theme}-${mode}`)
      await page.keyboard.press('Tab')
      const plain = page.locator('#plain')
      const focused = await plain.evaluate(node=>{
        node.getAnimations().forEach(animation=>animation.finish())
        const style=getComputedStyle(node)
        return {focused:node.matches(':focus'),width:style.outlineWidth,offset:style.outlineOffset,animation:style.animationName,shadow:style.boxShadow}
      })
      assert.equal(focused.focused,true)
      assert.equal(focused.width,theme==='antithesis'?'2px':'1px',`${theme}/${mode} field ring width`)
      assert.equal(focused.offset,theme==='antithesis'?'-1px':'1px',`${theme}/${mode} field ring offset`)
      assert.equal(focused.animation,theme==='antithesis'?'focus-field-pulse':'none')
      if (theme==='antithesis') assert.equal(focused.shadow.match(/inset/g)?.length,2,'field uses the shared inner and outer shadows')
      if (await page.evaluate(()=>CSS.supports('appearance','base-select'))) {
        await plain.press('Space')
        await page.keyboard.press('ArrowDown')
        const option=page.locator('#plain option[value="container"]')
        const ring=await option.evaluate(node=>{
          node.getAnimations().forEach(animation=>animation.finish())
          const style=getComputedStyle(node)
          return {focused:node.matches(':focus-visible'),width:style.outlineWidth,animation:style.animationName}
        })
        assert.equal(ring.focused,true)
        assert.equal(ring.width,theme==='antithesis'?'2px':'1px',`${theme}/${mode} option ring width`)
        assert.equal(ring.animation,theme==='antithesis'?'focus-ring-pulse':'none')
        await page.keyboard.press('Escape')
      }
    }
    await page.emulateMedia({reducedMotion:'reduce'})
    await page.goto(`${origin}/antithesis-light`)
    await page.keyboard.press('Tab')
    assert.equal(await page.locator('#plain').evaluate(node=>getComputedStyle(node).animationName),'none')
    assert.equal(await page.locator('#plain').evaluate(node=>getComputedStyle(node).outlineWidth),'2px')
    if(name==='chromium') {
      await page.emulateMedia({forcedColors:'active'})
      const outline=await page.locator('#plain').evaluate(node=>{const style=getComputedStyle(node);return {width:style.outlineWidth,color:style.outlineColor,style:style.outlineStyle}})
      assert.equal(outline.width,'2px')
      assert.equal(outline.style,'solid')
      assert.notEqual(outline.color,'rgba(0, 0, 0, 0)','forced colors retain a visible fallback outline')
    }
  })

}
