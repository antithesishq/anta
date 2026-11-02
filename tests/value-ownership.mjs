import assert from 'node:assert/strict'
import { before, after } from 'node:test'
import { createRequire, Module } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { componentTest as test, componentEngines } from './component-tier.mjs'

const requireSite=createRequire(new URL('../site/package.json',import.meta.url))
const requirePlot=createRequire(new URL('../plot/package.json',import.meta.url))
const requireRenderer=createRequire(requireSite.resolve('@astrojs/preact'))
const {chromium,firefox,webkit}=requireSite('playwright')
const consumer=process.env.ANTA_OWNERSHIP_CONSUMER_ROOT
const resolveDir=consumer?resolve(consumer):process.cwd(),base=consumer?'@antadesign/anta':resolve('src')
async function compile(options){
  const result=await build({absWorkingDir:resolveDir,nodePaths:[resolve(resolveDir,'node_modules'),resolve('site/node_modules')],metafile:true,...options})
  if(consumer){
    const inputs=Object.keys(result.metafile.inputs).map(path=>resolve(resolveDir,path))
    assert.ok(inputs.some(path=>path.startsWith(resolve(consumer,'node_modules/@antadesign/anta/dist')+'/')))
    assert.ok(!inputs.some(path=>path.startsWith(resolve('src')+'/')))
  }
  return result
}
const engines=componentEngines([chromium,firefox,webkit]),browsers=new Map(),clients=new Map(),renderers=new Map()
let elements
const fixture=`
  import React from 'react';
  import {Input,InputTime,InputDate,InputAutocomplete,Select,SelectFaceted,Checkbox,Switch,Button,configure} from '${consumer?base:base+'/index'}';
  const h=React.createElement;
  const app=(kind,props={})=>{
    const common={name:'choice',locale:'en-US',...props};
    const probe=ctx=>h(Button,{id:'probe',label:JSON.stringify(ctx.value)});
    let field;
    if(kind==='Select'||kind==='SelectMultiple')field=h(Select,{selection:kind==='SelectMultiple'?'multiple':'single',options:['a','b','c',''],renderTrigger:probe,...props});
    else if(kind==='SelectFaceted')field=h(SelectFaceted,{facets:[{key:'owner',kind:'single',label:'Owner',options:['a','b','c']}],renderTrigger:probe,...props});
    else if(kind==='InputAutocomplete')field=h(InputAutocomplete,{suggestions:['a','b','c'],...common});
    else if(kind==='Checkbox'||kind==='Switch')field=h(kind==='Checkbox'?Checkbox:Switch,{label:kind,...common});
    else if(kind==='InputDateTime')field=h(InputDate,{...common,time:true});
    else field=h({Input,InputTime,InputDate}[kind],common);
    return h('form',{id:'form'},field);
  };
`
before(async()=>{
  elements=await compile({stdin:{contents:`import '${base}/elements${consumer?'':'/index'}'`,resolveDir},bundle:true,write:false,outfile:'elements.js',format:'iife',target:'es2022',alias:{react:consumer?'preact/compat':requireSite.resolve('preact/compat')}})
  for(const framework of ['React','Preact']){
    const react=framework==='React'
    const alias={...(consumer?{}:{'@antadesign/anta/jsx-runtime':resolve('src/jsx-runtime')}),...(react?consumer?{}:{react:resolve('node_modules/react'),'react-dom/client':requirePlot.resolve('react-dom/client'),'react-dom/server':requirePlot.resolve('react-dom/server')}:{react:consumer?'preact/compat':requireSite.resolve('preact/compat'),...(consumer?{}:{'preact-render-to-string':requireRenderer.resolve('preact-render-to-string')})})}
    const options={bundle:true,write:false,target:'es2022',nodePaths:[resolve('site/node_modules')],alias,jsx:'automatic',jsxImportSource:'@antadesign/anta'}
    const server=await compile({...options,stdin:{contents:`${fixture}${react?"import {renderToString} from 'react-dom/server'":"import renderToString from 'preact-render-to-string'"};export const render=(kind,props)=>renderToString(app(kind,props));`,resolveDir},format:'cjs',platform:'node'})
    const mod=new Module(resolve(`tests/ownership-${framework}.cjs`));mod._compile(server.outputFiles[0].text,mod.id);renderers.set(framework,mod.exports.render)
    const client=await compile({...options,stdin:{contents:`${fixture}
      ${react?"import {createRoot,hydrateRoot} from 'react-dom/client'":"import {render,hydrate} from 'preact'"};
      let root,kind,props;window.reports=[];window.recoveries=[];
      const handlers={onValueChange:(...args)=>reports.push(args.map(arg=>arg&&typeof arg==='object'&&'type' in arg?arg.type:arg))};
      window.mount=(k,p,ssr=false)=>{kind=k;props=p;configure(h,React.Fragment,React,{hydratingEvents:true});const node=app(kind,{...handlers,...props});
        ${react?"root=ssr?hydrateRoot(document.querySelector('#mount'),node,{onRecoverableError:e=>recoveries.push(e.message)}):createRoot(document.querySelector('#mount'));if(!ssr)root.render(node)":"(ssr?hydrate:render)(node,document.querySelector('#mount'))"}};
      window.update=updates=>{props={...props,...updates};const node=app(kind,{...handlers,...props});${react?"root.render(node)":"render(node,document.querySelector('#mount'))"}};
    `,resolveDir},format:'iife',define:{'process.env.NODE_ENV':'"production"'}})
    clients.set(framework,client.outputFiles[0].text)
  }
  for(const engine of engines)browsers.set(engine,await engine.launch({headless:true,...(engine===chromium?{channel:process.env.CAPTURE_TEST_BROWSER_CHANNEL||undefined}:{})}))
})
after(async()=>Promise.all([...browsers.values()].map(browser=>browser.close())))
const settled=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
async function pageFor(t,engine,framework,kind,props,ssr=false){
  const page=await browsers.get(engine).newPage();page.setDefaultTimeout(7000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  t.after(async()=>{try{assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.recoveries??[]),[])}finally{await page.close()}})
  await page.setContent(`<main id="mount">${ssr?renderers.get(framework)(kind,props):''}</main>`)
  await page.addStyleTag({content:elements.outputFiles.find(file=>file.path.endsWith('.css')).text})
  await page.addScriptTag({content:elements.outputFiles.find(file=>file.path.endsWith('.js')).text})
  if(framework){await page.addScriptTag({content:clients.get(framework)});await page.evaluate(({kind,props,ssr})=>mount(kind,props,ssr),{kind,props,ssr})}
  await settled(page)
  return page
}
async function update(page,props){await page.evaluate(props=>window.update(props),props);await settled(page)}
const formValue=page=>page.evaluate(()=>new FormData(document.querySelector('form')).get('choice'))

for(const engine of engines)for(const framework of ['React','Preact']){
  const name=`${engine.name()} ${framework}`
  for(const kind of ['Select','SelectMultiple','SelectFaceted'])test.fast(`${name} ${kind}: release retains the latest controlled selection and resumes picks`,async t=>{
    const facets=kind==='SelectFaceted',multiple=kind==='SelectMultiple',value=entry=>facets?{owner:entry}:multiple?[entry]:entry
    const page=await pageFor(t,engine,framework,kind,{value:value('a'),defaultValue:value('c')})
    await update(page,{value:value('b')});await update(page,{value:undefined})
    assert.equal(await page.locator('#probe').textContent(),JSON.stringify(value('b')))
    assert.deepEqual(await page.evaluate(()=>reports),[])
    await page.locator('#probe').click()
    if(facets){await page.getByRole('menuitem',{name:/^Owner/}).focus();await page.keyboard.press('ArrowRight')}
    await page.getByText('a',{exact:true}).click();await settled(page)
    assert.equal(await page.locator('#probe').textContent(),JSON.stringify(multiple?['b','a']:value('a')))
    const empty=facets?{}:multiple?[]:null
    await update(page,{value:empty});await update(page,{value:undefined})
    assert.equal(await page.locator('#probe').textContent(),JSON.stringify(empty))
  })
  for(const kind of ['Input','InputTime','InputAutocomplete','InputDate','InputDateTime'])for(const ssr of kind.startsWith('InputDate')?[false]:[false,true])test(`${name} ${kind}: ${ssr?'hydrated':'client'} reset and restoration follow ownership`,{tier:'fast'},async t=>{
    const date=kind.startsWith('InputDate'),time=kind==='InputTime',dateTime=kind==='InputDateTime'
    const initial=date?'2026-10-08'+(dateTime?'T09:30':''):time?'09:30':'a',next=date?'2026-10-07'+(dateTime?'T10:45':''):time?'10:45':'b',baseline=date?'2026-10-06'+(dateTime?'T08:00':''):time?'08:00':'c'
    const page=await pageFor(t,engine,framework,kind,{value:initial,defaultValue:baseline},ssr)
    const host=page.locator(time?'a-input-time':'a-input').first()
    await update(page,{value:next})
    const controlled=await host.evaluate(el=>el.value)
    await page.evaluate(()=>document.querySelector('form').reset());await settled(page)
    assert.equal(await host.evaluate(el=>el.value),controlled)
    assert.equal(await formValue(page),next)
    await host.evaluate((el,baseline)=>el.formStateRestoreCallback(baseline),baseline);await settled(page)
    assert.equal(await host.evaluate(el=>el.value),controlled)
    assert.equal(await formValue(page),next)
    assert.deepEqual(await page.evaluate(()=>reports),[])
    await update(page,{value:undefined})
    assert.equal(await host.evaluate(el=>el.value),controlled)
    assert.equal(await formValue(page),next)
    await page.evaluate(()=>document.querySelector('form').reset());await settled(page)
    assert.equal(await formValue(page),baseline)
    if(dateTime)assert.equal(await page.locator('a-input-time').evaluate(el=>el.value),baseline.slice(11))
    const restored=date?'2026-10-09'+(dateTime?'T11:15':''):time?'11:15':'restored'
    await host.evaluate((el,state)=>el.formStateRestoreCallback(state),dateTime?'10/09/2026 11:15 AM':restored);await settled(page)
    assert.equal(await formValue(page),restored)
    if(dateTime)assert.equal(await page.locator('a-input-time').evaluate(el=>el.value),restored.slice(11))
    await update(page,{value:''});await update(page,{value:undefined})
    assert.equal(await formValue(page),'')
    if(time){
      await host.locator('[part~=hour]').fill('1')
      await host.evaluate(el=>el.formStateRestoreCallback(''));await settled(page)
      assert.equal(await host.locator('[part~=hour]').inputValue(),'')
      assert.equal(await host.locator('[part~=minute]').inputValue(),'')
    }
  })
  for(const kind of ['Checkbox','Switch'])test.fast(`${name} ${kind}: checked ownership survives release, reset, and restore`,async t=>{
    const page=await pageFor(t,engine,framework,kind,{checked:true,defaultChecked:false})
    const host=page.locator(kind==='Checkbox'?'a-checkbox':'a-switch')
    await page.evaluate(()=>document.querySelector('form').reset());await host.evaluate(el=>el.formStateRestoreCallback('unchecked'))
    assert.equal(await host.evaluate(el=>el.checked),true)
    await update(page,{checked:undefined})
    assert.equal(await host.evaluate(el=>el.checked),true)
    await host.click();assert.equal(await host.evaluate(el=>el.checked),false)
    await page.evaluate(()=>document.querySelector('form').reset())
    await update(page,{defaultChecked:true})
    assert.equal(await host.evaluate(el=>el.checked),true,'Reset restores pristine default handling')
    await host.evaluate(el=>el.formStateRestoreCallback('unchecked'))
    assert.equal(await host.evaluate(el=>el.checked),false)
    await update(page,{defaultChecked:false});await update(page,{defaultChecked:true})
    assert.equal(await host.evaluate(el=>el.checked),false,'Restoration retains ownership of the applied state until reset')
    if(kind==='Checkbox'){
      await update(page,{checked:'indeterminate'})
      await page.evaluate(()=>document.querySelector('form').reset());await host.evaluate(el=>el.formStateRestoreCallback('unchecked'))
      await update(page,{checked:undefined})
      assert.equal(await host.evaluate(el=>el.indeterminate),true)
    }
  })
}
for(const engine of engines)test.fast(`${engine.name()}: raw text controls retain authored controlled values through form callbacks`,async t=>{
  const page=await pageFor(t,engine,undefined)
  await page.setContent('<form><a-input name="text" value="owned" defaultvalue="reset"></a-input><a-input-time name="time" locale="en-US" value="09:30" defaultvalue="08:00"></a-input-time></form>')
  const result=await page.evaluate(()=>{
    const fields=[...document.querySelectorAll('a-input,a-input-time')]
    const before=fields.map(el=>el.outerHTML)
    document.querySelector('form').reset();fields.forEach(el=>el.formStateRestoreCallback(''))
    return {values:fields.map(el=>el.value),authored:fields.map(el=>el.outerHTML),before}
  })
  assert.deepEqual(result.values,['owned','09:30']);assert.deepEqual(result.authored,result.before)
})
