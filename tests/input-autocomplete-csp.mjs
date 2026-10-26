import assert from 'node:assert/strict'
import { before, after } from 'node:test'
import { createServer } from 'node:http'
import { createRequire, Module } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { componentTest as test, componentEngines } from './component-tier.mjs'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const requirePlot = createRequire(new URL('../plot/package.json', import.meta.url))
const requireRenderer = createRequire(requireSite.resolve('@astrojs/preact'))
const {chromium, firefox, webkit} = requireSite('playwright')
const engines = componentEngines([chromium, firefox, webkit])
const consumer = process.env.ANTA_AUTOCOMPLETE_CONSUMER_ROOT ? resolve(process.env.ANTA_AUTOCOMPLETE_CONSUMER_ROOT) : undefined
const resolveDir = consumer ?? process.cwd(), base = consumer ? '@antadesign/anta' : resolve('src')
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'"
const assets = new Map(), renderers = new Map(), browsers = new Map()
const fixture = `
  import React from 'react';
  import {InputAutocomplete,configure} from '${consumer ? base : `${base}/index`}';
  const h=React.createElement;
  const suggestions=[{value:'Alpha',label:'Alpha',hint:'Design',icon:'check','data-person':'alpha',className:'person'}, {value:'Locked',label:'Locked',disabled:true}, 'Beta'];
  const app=(props={})=>h(InputAutocomplete,{id:'field',name:'city',label:h('strong',null,'City'),hint:h('em',null,'Pick or type'),suggestions,clearable:true,...props});
`
let server, origin
async function compile(options) {
  const result = await build({absWorkingDir:resolveDir,bundle:true,write:false,metafile:true,nodePaths:[resolve(resolveDir,'node_modules'),resolve('site/node_modules')],target:'es2022',...options})
  if (consumer) {
    const inputs = Object.keys(result.metafile.inputs).map(p=>resolve(resolveDir,p))
    assert.ok(inputs.some(p=>p.startsWith(resolve(consumer,'node_modules/@antadesign/anta/dist')+'/')))
    assert.ok(!inputs.some(p=>p.startsWith(resolve('src')+'/')))
  }
  return result
}
function save(result, name) {
  for (const file of result.outputFiles) assets.set(`/${name}.${file.path.endsWith('.css')?'css':'js'}`,file.text)
}
before(async () => {
  for (const mode of ['granular','bundle']) {
    const contents = mode === 'bundle' ? `import '${base}/bundle';${consumer?`import '${base}/bundle.css'`:''}` : `import '${base}/tokens.css';import '${base}/reset.css';${['input','menu','menu-item','button','icon'].map(e=>`import '${base}/elements/a-${e}'`).join(';')}`
    save(await compile({stdin:{contents,resolveDir},outfile:`${mode}.js`,format:'esm',alias:{react:consumer?'preact/compat':requireSite.resolve('preact/compat')}}),mode)
  }
  for (const framework of ['React','Preact']) {
    const react = framework === 'React'
    const alias = {
      ...(consumer?{}:{'@antadesign/anta/jsx-runtime':resolve('src/jsx-runtime')}),
      ...(react?consumer?{}:{react:resolve('node_modules/react'),'react-dom/server':requirePlot.resolve('react-dom/server'),'react-dom/client':requirePlot.resolve('react-dom/client')}:{react:consumer?'preact/compat':requireSite.resolve('preact/compat'),...(consumer?{}:{'preact-render-to-string':requireRenderer.resolve('preact-render-to-string')})}),
    }
    const result = await compile({stdin:{contents:`${fixture}${react?"import {renderToString} from 'react-dom/server'":"import renderToString from 'preact-render-to-string'"};export const render=props=>renderToString(app(props));`,resolveDir},platform:'node',format:'cjs',jsx:'automatic',jsxImportSource:'@antadesign/anta',alias})
    const compiled = new Module(resolve(`tests/autocomplete-${framework}-server.cjs`))
    compiled._compile(result.outputFiles[0].text,compiled.id)
    renderers.set(framework,compiled.exports.render)
    save(await compile({stdin:{contents:`${fixture}
      ${react?"import {createRoot,hydrateRoot} from 'react-dom/client'":"import {render,hydrate} from 'preact'"};
      let root,props={},version='first';window.accept=false;window.cancelEnter=false;window.cancelInput=false;window.reports=[];window.recoverableErrors=[];
      const handlers=()=>{
        const current=version;
        return {
          onFocus:()=>reports.push({kind:'focus',version:current}),onBlur:()=>reports.push({kind:'blur',version:current}),
          onInput:e=>{reports.push({kind:'input',value:e.currentTarget.value,version:current});if(cancelInput)e.preventDefault()},
          onKeyDown:e=>{reports.push({kind:'key',key:e.key,prevented:e.defaultPrevented,version:current});if(cancelEnter&&e.key==='Enter')e.preventDefault()},
          onValueChange:value=>{reports.push({kind:'value',value});if(accept&&props.value!==undefined)updateAuto({value})},
          onSelect:option=>reports.push({kind:'pick',value:option.value}),
        };
      };
      const commit=node=>{${react?"root??=createRoot(document.querySelector('#mount'));root.render(node)":"render(node,document.querySelector('#mount'))"}};
      window.hydrateAuto=initial=>{props=initial;configure(h,React.Fragment,React,{hydratingEvents:true});${react?"root=hydrateRoot(document.querySelector('#mount'),app({...handlers(),...props}),{onRecoverableError:e=>recoverableErrors.push(e.message)})":"hydrate(app({...handlers(),...props}),document.querySelector('#mount'))"}};
      window.updateAuto=updates=>{props={...props,...updates};commit(app({...handlers(),...props}))};
      window.callbacksVersion=next=>{version=next;updateAuto({})};
    `,resolveDir},outfile:`${framework}.js`,format:'esm',jsx:'automatic',jsxImportSource:'@antadesign/anta',alias,define:{'process.env.NODE_ENV':'"production"'}}),framework)
  }
  assets.set('/boot.js',`window.violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push(e.effectiveDirective));`)
  assets.set('/fixture.css',`body{margin:24px;font:14px/20px system-ui}#field{width:260px}#outside{position:fixed;right:8px;top:8px}.person{font-weight:600}.consumer::part(field){border-radius:13px}.consumer + a-menu::part(menu){border-radius:11px}`)
  server = createServer((req,res) => {
    const url = new URL(req.url,'http://localhost'), mode = url.searchParams.get('mode')??'granular', framework = url.searchParams.get('framework')??'React'
    const initial = url.searchParams.has('controlled')?{value:'',defaultValue:'Seed',filter:false}:url.searchParams.has('seeded')?{defaultValue:'Seed'}:{}
    res.setHeader('Content-Security-Policy',policy)
    res.setHeader('Content-Type',`${url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html'}; charset=utf-8`)
    res.end(assets.get(url.pathname)??`<!doctype html><link rel="stylesheet" href="/${mode}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><form id="form"><input id="before" aria-label="Previous field"><main id="mount">${renderers.get(framework)(initial)}</main><input id="outside" aria-label="Next field"></form>`)
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`
  for (const engine of engines) browsers.set(engine,await engine.launch({headless:true,...(engine===chromium?{channel:process.env.CAPTURE_TEST_BROWSER_CHANNEL||undefined}:{})}))
  console.log('Autocomplete browser coverage:',JSON.stringify([...browsers].map(([engine,browser])=>({engine:engine.name(),version:browser.version()}))),consumer?'installed package':'source')
})
after(async()=>{await Promise.all([...browsers.values()].map(b=>b.close()));if(server)await new Promise(r=>server.close(r))})
const field = page => page.locator('#field input')
const settled = page => page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
const shown = (page,state=true) => page.waitForFunction(state=>document.querySelector('#field + a-menu').isOpen===state,state)
const active = page => field(page).evaluate(el=>el.ariaActiveDescendantElement?.textContent??null)
async function update(page,props) {await page.evaluate(props=>updateAuto(props),props);await settled(page)}
async function pageFor(t,engine,mode,framework,controlled=false,seeded=false,options={}) {
  const page = await browsers.get(engine).newPage(options);page.setDefaultTimeout(7000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const response=await page.goto(`${origin}/?mode=${mode}&framework=${framework}${controlled?'&controlled':''}${seeded?'&seeded':''}`)
  assert.equal(response.headers()['content-security-policy'],policy)
  t.after(async()=>{try{assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>recoverableErrors),[]);assert.deepEqual(await page.evaluate(()=>violations),[])}finally{await page.close()}})
  await page.evaluate(async({mode,framework,controlled,seeded})=>{
    window.originalField=document.querySelector('#field');window.originalMenu=originalField.nextElementSibling;
    await import(`/${mode}.js`);await import(`/${framework}.js`);hydrateAuto(controlled?{value:'',defaultValue:'Seed',filter:false}:seeded?{defaultValue:'Seed'}:{})
  },{mode,framework,controlled,seeded})
  await page.waitForFunction(()=>document.querySelector('#field + a-menu').listening)
  await settled(page)
  assert.equal(await page.evaluate(()=>originalField===document.querySelector('#field')&&originalMenu===originalField.nextElementSibling),true)
  return page
}
async function composing(page,key,extra={}) {
  return field(page).evaluate((el,{key,extra})=>{
    const event=new KeyboardEvent('keydown',{key,isComposing:true,bubbles:true,composed:true,cancelable:true,...extra})
    el.dispatchEvent(event)
    el.dispatchEvent(new KeyboardEvent('keyup',{key,isComposing:false,bubbles:true,composed:true,cancelable:true}))
    return event.defaultPrevented
  },{key,extra})
}

for (const engine of engines) for (const mode of ['granular','bundle']) {
  const name=`${engine.name()} ${mode}`
  for (const framework of ['React','Preact']) {
    const core={tier:mode==='granular'?'fast':'slow'}
    test(`${name} ${framework}: hydrates and composes fresh callbacks with native input and Enter cancellation`,core,async t=>{
      const page=await pageFor(t,engine,mode,framework)
      await field(page).focus();await shown(page)
      assert.equal(await composing(page,'Enter'),false);await shown(page)
      await page.evaluate(()=>{cancelInput=true;cancelEnter=true})
      await field(page).fill('Al');await settled(page)
      assert.equal(await field(page).inputValue(),'Al')
      const reports=await page.evaluate(()=>reports)
      assert.deepEqual(reports.filter(e=>e.kind!=='key').map(e=>e.kind),['focus','input','value'])
      assert.equal(reports.find(e=>e.kind==='value').value,'Al')
      await page.keyboard.press('Enter');await shown(page)
      await page.evaluate(()=>callbacksVersion('second'));await settled(page)
      await field(page).press('x');await settled(page)
      assert.equal(await page.evaluate(()=>reports.filter(e=>e.kind==='input').at(-1).version),'second')
      await page.evaluate(()=>{cancelEnter=false;cancelInput=false})
      await field(page).fill('Al');await page.keyboard.press('Enter');await shown(page,false)
      assert.equal(await page.evaluate(()=>reports.filter(e=>e.kind==='key'&&e.key==='Enter').at(-1).prevented),false)
      assert.equal(await page.evaluate(()=>reports.some(e=>e.kind==='pick')),false)
      await update(page,{onFocus:undefined,onBlur:undefined,onInput:undefined,onKeyDown:undefined})
      const count=await page.evaluate(()=>reports.filter(e=>['focus','blur','input','key'].includes(e.kind)).length)
      await page.locator('#outside').focus();await field(page).fill('Beta');await shown(page)
      assert.equal(await field(page).inputValue(),'Beta')
      assert.equal(await page.evaluate(()=>reports.filter(e=>['focus','blur','input','key'].includes(e.kind)).length),count)
    })
    test(`${name} ${framework}: controlled empty text survives parent resets and rejected picks`,core,async t=>{
      const page=await pageFor(t,engine,mode,framework,true)
      assert.equal(await field(page).inputValue(),'')
      await update(page,{value:'Beta'})
      assert.equal(await field(page).inputValue(),'Beta')
      await update(page,{value:''})
      assert.deepEqual(await page.evaluate(()=>reports),[])
      await field(page).focus();await shown(page);await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await shown(page,false)
      assert.equal(await field(page).inputValue(),'')
      assert.deepEqual(await page.evaluate(()=>reports.filter(e=>['value','pick'].includes(e.kind))),[{kind:'value',value:'Alpha'},{kind:'pick',value:'Alpha'}])
      await page.evaluate(()=>accept=true)
      await page.locator('#outside').focus();await field(page).focus();await shown(page)
      await page.locator('a-menu-item').filter({hasText:'Beta'}).click();await shown(page,false)
      assert.equal(await field(page).inputValue(),'Beta')
      await page.locator('#field [slot=clear] a-button').click();await settled(page)
      assert.equal(await field(page).inputValue(),'')
      assert.equal(await page.evaluate(()=>reports.filter(e=>e.kind==='value').at(-1).value),'')
      assert.equal(await page.evaluate(()=>reports.filter(e=>e.kind==='pick').length),2)
    })
    test(`${name} ${framework}: releasing control retains the latest text and resumes editing`,core,async t=>{
      const page=await pageFor(t,engine,mode,framework,true)
      await update(page,{value:'Beta'})
      await update(page,{value:undefined,defaultValue:'Changed'})
      assert.equal(await field(page).inputValue(),'Beta')
      assert.equal(await page.evaluate(()=>new FormData(document.querySelector('form')).get('city')),'Beta')
      assert.deepEqual(await page.evaluate(()=>reports),[])
      await field(page).fill('Free text');await settled(page)
      await update(page,{defaultValue:'Reset text'})
      assert.equal(await field(page).inputValue(),'Free text')
      assert.deepEqual(await page.evaluate(()=>reports.filter(e=>e.kind==='value')),[{kind:'value',value:'Free text'}])
      await update(page,{value:'Alpha'})
      await update(page,{value:undefined})
      assert.equal(await field(page).inputValue(),'Alpha')
      await update(page,{value:''})
      await update(page,{value:undefined})
      assert.equal(await field(page).inputValue(),'')
      assert.equal(await page.evaluate(()=>reports.filter(e=>e.kind==='value').length),1)
      await field(page).focus();await shown(page)
      await page.locator('a-menu-item').filter({hasText:'Beta'}).click();await shown(page,false)
      assert.equal(await field(page).inputValue(),'Beta')
      await page.locator('#outside').focus()
      await page.evaluate(()=>document.querySelector('form').reset());await settled(page)
      assert.equal(await field(page).inputValue(),'Reset text')
      assert.equal(await page.evaluate(()=>reports.filter(e=>e.kind==='value').at(-1).value),'Reset text')
      await shown(page,false)
    })
    test(`${name} ${framework}: blur dismisses pending remote results and form reset restores the default`,core,async t=>{
      const page=await pageFor(t,engine,mode,framework,false,true)
      assert.equal(await field(page).inputValue(),'Seed')
      await update(page,{suggestions:[],filter:false})
      await field(page).fill('remote query')
      await page.locator('#outside').focus();await settled(page)
      await update(page,{suggestions:['Remote result']});await shown(page,false)
      assert.equal(await page.evaluate(()=>document.activeElement.id),'outside')
      assert.equal(await field(page).inputValue(),'remote query')
      await field(page).focus();await shown(page)
      await update(page,{suggestions:['Newest result']})
      assert.equal(await page.locator('a-menu-item').textContent(),'Newest result')
      await page.keyboard.press('Escape');await shown(page,false)
      await update(page,{suggestions:['Later result']});await shown(page,false)
      await page.evaluate(()=>document.querySelector('form').reset());await settled(page)
      assert.equal(await field(page).inputValue(),'Seed')
      assert.equal(await page.evaluate(()=>reports.filter(e=>e.kind==='value').at(-1).value),'Seed')
    })
    test(`${name} ${framework}: resetting an unfocused field restores text without opening or moving focus`,core,async t=>{
      const page=await pageFor(t,engine,mode,framework)
      await page.evaluate(()=>{
        const reset=document.createElement('button');reset.type='reset';reset.id='reset';reset.textContent='Reset form'
        document.querySelector('form').prepend(reset)
      })
      for (const defaultValue of ['', 'Alpha']) {
        await update(page,{defaultValue})
        await field(page).fill('Beta');await shown(page)
        await page.locator('#reset').click();await settled(page)
        assert.equal(await field(page).inputValue(),defaultValue)
        assert.equal(await page.evaluate(()=>document.querySelector('a-menu').isOpen),false)
        // Some browsers leave focus on the body when a button is clicked.
        assert.notEqual(await page.evaluate(()=>document.activeElement.id),'field')
        assert.equal(await page.evaluate(()=>reports.filter(e=>e.kind==='value').at(-1).value),defaultValue)
      }
    })
    test(`${name} ${framework}: in-place result label and hint edits invalidate active and armed choices`,core,async t=>{
      const page=await pageFor(t,engine,mode,framework)
      await update(page,{filter:false,suggestions:[{value:'same',label:'Old label',hint:'Old hint'}]})
      await field(page).focus();await shown(page);await page.keyboard.press('ArrowDown')
      await page.evaluate(()=>window.keptRow=document.querySelector('a-menu-item'))
      await update(page,{suggestions:[{value:'same',label:'New label',hint:'Old hint'}]})
      assert.equal(await page.evaluate(()=>keptRow===document.querySelector('a-menu-item')),true)
      assert.equal(await active(page),null)
      await page.keyboard.press('ArrowDown');await page.keyboard.down('Enter')
      await update(page,{suggestions:[{value:'same',label:'New label',hint:'New hint'}]})
      assert.equal(await active(page),null)
      await page.keyboard.up('Enter');await settled(page)
      assert.equal(await page.locator('a-menu-item').textContent(),'New labelNew hint')
      assert.equal(await page.evaluate(()=>reports.some(e=>e.kind==='pick')),false)
      await shown(page)
    })
  }
  test.fast(`${name}: nested disabled controls and unchanged renders preserve an armed choice`,async t=>{
    const page=await pageFor(t,engine,mode,'Preact')
    await update(page,{filter:false});await field(page).focus();await shown(page)
    await page.evaluate(()=>{
      const button=document.createElement('button');button.textContent='Copy'
      document.querySelector('a-menu-item').append(button)
    })
    await settled(page);await page.keyboard.press('ArrowDown');await page.keyboard.down('Enter')
    await update(page,{})
    await page.evaluate(()=>document.querySelector('a-menu-item button').disabled=true);await settled(page)
    assert.match(await active(page),/Alpha/)
    await page.keyboard.up('Enter');await shown(page,false)
    assert.equal(await field(page).inputValue(),'Alpha')
    assert.equal(await page.evaluate(()=>reports.filter(e=>e.kind==='pick').length),1)
  })
  test.fast(`${name}: IME owns candidate keys and typing clears a retained remote cursor`,async t=>{
    const page=await pageFor(t,engine,mode,'Preact')
    await update(page,{filter:false});await field(page).focus();await shown(page)
    assert.equal(await composing(page,'ArrowDown'),false)
    assert.equal(await active(page),null)
    await page.keyboard.press('ArrowDown');assert.match(await active(page),/Alpha/)
    for(const [key,extra] of [['Enter',{}],['Enter',{isComposing:false,keyCode:229}],['Escape',{}],['ArrowDown',{}]]) {
      assert.equal(await composing(page,key,extra),false)
      await shown(page)
      assert.match(await active(page),/Alpha/)
      assert.equal(await page.evaluate(()=>reports.some(e=>e.kind==='pick')),false)
    }
    await field(page).press('x');await settled(page)
    assert.equal(await active(page),null)
    await page.keyboard.press('Enter');await shown(page,false)
    assert.equal(await field(page).inputValue(),'x')
    assert.equal(await page.evaluate(()=>reports.some(e=>e.kind==='pick')),false)
  })
  test.fast(`${name}: typing and later result updates report one cursor clear`,async t=>{
    const page=await pageFor(t,engine,mode,'Preact')
    await update(page,{filter:false});await field(page).focus();await shown(page)
    await page.keyboard.press('ArrowDown')
    await page.evaluate(()=>{
      window.cursorReports=[]
      document.querySelector('a-menu').addEventListener('activedescendant',e=>cursorReports.push(e.detail.id))
    })
    await field(page).press('x');await settled(page)
    assert.equal(await active(page),null)
    await update(page,{suggestions:['Remote result']})
    assert.deepEqual(await page.evaluate(()=>cursorReports),[null])
    assert.equal(await field(page).evaluate(el=>el.ariaControlsElements[0]===document.querySelector('a-menu')),true)
    await page.keyboard.press('Enter');await shown(page,false)
    assert.equal(await field(page).inputValue(),'x')
    assert.equal(await page.evaluate(()=>reports.some(e=>e.kind==='pick')),false)
  })
  test.fast(`${name}: result replacement invalidates active and armed rows, including newly disabled rows`,async t=>{
    const page=await pageFor(t,engine,mode,'Preact')
    await update(page,{filter:false});await field(page).focus();await shown(page)
    await page.keyboard.press('ArrowDown')
    await update(page,{suggestions:[{value:'Alpha',disabled:true},'Beta']})
    assert.equal(await active(page),null)
    await page.keyboard.press('ArrowDown');assert.equal(await active(page),'Beta')
    await page.keyboard.down('Enter')
    await update(page,{suggestions:[{value:'Alpha',disabled:true},{value:'Beta',disabled:true}]})
    await page.keyboard.up('Enter');await settled(page)
    assert.equal(await active(page),null)
    assert.equal(await page.evaluate(()=>reports.some(e=>e.kind==='pick')),false)
    await update(page,{suggestions:['Gamma']});await page.keyboard.press('ArrowDown')
    await page.keyboard.down('Enter');await update(page,{suggestions:['Replacement']});await page.keyboard.up('Enter');await settled(page)
    assert.equal(await page.evaluate(()=>reports.some(e=>e.kind==='pick')),false)
  })
  test.fast(`${name}: pointer selection retains focus, named roles, presentation, and modifier navigation`,async t=>{
    const page=await pageFor(t,engine,mode,'Preact')
    await update(page,{className:'consumer'});await field(page).fill('Al');await shown(page)
    assert.equal(await page.locator('a-menu-item.person[data-person=alpha] b').textContent(),'Al')
    assert.equal(await field(page).evaluate(el=>getComputedStyle(el.getRootNode().host.shadowRoot.querySelector('[part=field]')).borderRadius),'13px')
    assert.equal(await page.locator('a-menu').evaluate(el=>getComputedStyle(el.shadowRoot.querySelector('[part=menu]')).borderRadius),'11px')
    const surface=await page.locator('a-menu').evaluate(el=>{
      const r=el.shadowRoot.querySelector('[part=menu]').getBoundingClientRect()
      return {x:r.x+r.width/2,y:r.y+1}
    })
    await page.mouse.click(surface.x,surface.y);await settled(page)
    assert.equal(await page.evaluate(()=>document.querySelector('a-menu').isOpen),true)
    assert.equal(await field(page).evaluate(el=>el.getRootNode().activeElement===el),true)
    assert.deepEqual(await field(page).evaluate(el=>({role:el.getAttribute('role'),name:el.ariaLabelledByElements.map(n=>n.textContent).join(''),popup:el.ariaControlsElements[0].getAttribute('role'),expanded:el.getAttribute('aria-expanded'),hostRole:el.getRootNode().host.hasAttribute('role')})),{role:'combobox',name:'City',popup:'listbox',expanded:'true',hostRole:false})
    await page.keyboard.press('Control+ArrowDown');assert.equal(await active(page),null)
    await page.keyboard.press('ArrowDown');assert.match(await active(page),/Alpha/)
    if(engine===chromium){const cdp=await page.context().newCDPSession(page);const {nodes}=await cdp.send('Accessibility.getFullAXTree');const combo=nodes.find(n=>n.role?.value==='combobox'&&n.name?.value==='City');assert.equal(combo.properties.find(p=>p.name==='activedescendant').value.relatedNodes.length,1)}
    await page.locator('a-menu-item').filter({hasText:'Alpha'}).click();await shown(page,false)
    assert.equal(await field(page).inputValue(),'Alpha')
    assert.equal(await field(page).evaluate(el=>el.getRootNode().activeElement===el),true)
    assert.equal(await active(page),null)
    assert.deepEqual(await page.evaluate(()=>Object.fromEntries(new FormData(document.querySelector('form')))),{city:'Alpha'})
    await page.locator('#outside').focus();await field(page).fill('');await shown(page)
    await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');assert.equal(await active(page),'Beta')
    await page.keyboard.press('Tab');await shown(page,false)
    assert.equal(await page.evaluate(()=>document.activeElement.id),'outside')
    await field(page).focus();await shown(page);await page.keyboard.press('Shift+Tab');await shown(page,false)
    assert.equal(await page.evaluate(()=>document.activeElement.id),'before')
  })
  if (engine !== firefox) test(`${name}: touch selection survives blur dismissal and keeps the field focused`,async t=>{
    const page=await pageFor(t,engine,mode,'Preact',false,false,{hasTouch:true})
    await field(page).fill('Al');await shown(page)
    await page.getByRole('option',{name:/Alpha/}).tap();await shown(page,false)
    assert.equal(await field(page).inputValue(),'Alpha')
    assert.equal(await field(page).evaluate(el=>el.getRootNode().activeElement===el),true)
    assert.equal(await page.evaluate(()=>reports.filter(e=>e.kind==='pick').length),1)
  })
  test(`${name}: a long suggestion list stays scrollable without dismissing or blurring the field`,async t=>{
    const page=await pageFor(t,engine,mode,'Preact')
    await update(page,{filter:false,suggestions:Array.from({length:80},(_,i)=>`Result ${i}`)})
    await field(page).focus();await shown(page)
    const scroll=page.locator('a-menu').locator('[part=scroll]')
    const box=await scroll.boundingBox()
    assert.ok(box)
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2)
    await page.mouse.wheel(0,240)
    await page.waitForFunction(()=>document.querySelector('a-menu').shadowRoot.querySelector('[part=scroll]').scrollTop>0)
    assert.equal(await page.evaluate(()=>document.querySelector('a-menu').isOpen),true)
    assert.equal(await field(page).evaluate(el=>el.getRootNode().activeElement===el),true)
    await page.keyboard.press('Escape');await shown(page,false)
  })
}
