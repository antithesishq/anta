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
const { chromium, firefox, webkit } = requireSite('playwright')
const engines = componentEngines([chromium, firefox, webkit])
const consumer = process.env.ANTA_SELECTION_CONSUMER_ROOT && resolve(process.env.ANTA_SELECTION_CONSUMER_ROOT)
const resolveDir = consumer || process.cwd(), base = consumer ? '@antadesign/anta' : resolve('src')
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'"
const assets = new Map(), renderers = new Map(), browsers = new Map()
const kinds = ['Calendar', 'RadioGroup', 'Tabs']
const tagOf = kind => ({Calendar:'a-calendar',RadioGroup:'a-radio-group',Tabs:'a-tabs'})[kind]
const inputOf=kind=>kind==='Calendar'?'value':'state'
const initialOf=kind=>kind==='Calendar'?'defaultvalue':'default-state'
const valuesOf = kind => kind === 'Calendar' ? ['2026-10-08','2026-10-07'] : ['a','b']
let server, origin
async function compile(options) {
  const result = await build({absWorkingDir:resolveDir,bundle:true,write:false,metafile:true,nodePaths:[resolve(resolveDir,'node_modules'),resolve('site/node_modules')],target:'es2022',...options})
  if (consumer) {
    const inputs = Object.keys(result.metafile.inputs).map(path=>resolve(resolveDir,path))
    assert.ok(inputs.some(path=>path.startsWith(resolve(consumer,'node_modules/@antadesign/anta/dist')+'/')))
    assert.ok(!inputs.some(path=>path.startsWith(resolve('src')+'/')))
  }
  return result
}
function save(result,name) {
  for (const file of result.outputFiles) assets.set(`/${name}.${file.path.endsWith('.css')?'css':'js'}`,file.text)
}
const fixture = `
  import React from 'react';
  import {Calendar,RadioGroup,Tabs,TabPanel,configure} from '${consumer ? base : `${base}/index`}';
  const h=React.createElement;
  const app=(kind,props)=>{
    const common={id:'subject',name:'choice',...props};
    if(kind==='Calendar')return h(Calendar,{locale:'en-US',...common});
    const options=[{value:'a',label:'A'},{value:'b',label:'B'},{value:'',label:'Empty'}];
    if(kind==='RadioGroup')return h(RadioGroup,{options,label:'Choice',...common});
    return h(Tabs,{options,label:'Choice',...common},...options.map(o=>h(TabPanel,{value:o.value,key:o.value},'Panel '+o.label)));
  };
`
before(async()=>{
  for(const mode of ['granular','bundle']) {
    const contents=mode==='bundle'?`import '${base}/bundle';${consumer?`import '${base}/bundle.css'`:''}`:`import '${base}/tokens.css';import '${base}/reset.css';import '${base}/elements${consumer?'':'/index'}'`
    save(await compile({stdin:{contents,resolveDir},outfile:`${mode}.js`,format:'esm',alias:{react:consumer?'preact/compat':requireSite.resolve('preact/compat')}}),mode)
  }
  for(const framework of ['React','Preact']) {
    const react=framework==='React'
    const alias={...(consumer?{}:{'@antadesign/anta/jsx-runtime':resolve('src/jsx-runtime')}),...(react?consumer?{}:{react:resolve('node_modules/react'),'react-dom/server':requirePlot.resolve('react-dom/server'),'react-dom/client':requirePlot.resolve('react-dom/client')}:{react:consumer?'preact/compat':requireSite.resolve('preact/compat'),...(consumer?{}:{'preact-render-to-string':requireRenderer.resolve('preact-render-to-string')})})}
    const result=await compile({stdin:{contents:`${fixture}${react?"import {renderToString} from 'react-dom/server'":"import renderToString from 'preact-render-to-string'"};export const render=(kind,props)=>renderToString(app(kind,props));`,resolveDir},platform:'node',format:'cjs',alias})
    const compiled=new Module(resolve(`tests/selection-${framework}.cjs`));compiled._compile(result.outputFiles[0].text,compiled.id);renderers.set(framework,compiled.exports.render)
    save(await compile({stdin:{contents:`${fixture}
      ${react?"import {hydrateRoot} from 'react-dom/client'":"import {render,hydrate} from 'preact'"};
      let root,kind,props;window.accept=false;window.reports=[];window.recoverableErrors=[];
      const handlers=()=>({onStateChange:(e,d)=>{reports.push({type:'request',...d});if(accept&&props.value!==undefined)updateSelection({value:d.next??''})},onValueChange:(e,d)=>reports.push({type:'change',value:d.value})});
      window.hydrateSelection=(k,p)=>{kind=k;props=p;configure(h,React.Fragment,React,{hydratingEvents:true});${react?"root=hydrateRoot(document.querySelector('#mount'),app(kind,{...handlers(),...props}),{onRecoverableError:e=>recoverableErrors.push(e.message)})":"hydrate(app(kind,{...handlers(),...props}),document.querySelector('#mount'))"}};
      window.updateSelection=updates=>{props={...props,...updates};const node=app(kind,{...handlers(),...props});${react?"root.render(node)":"render(node,document.querySelector('#mount'))"}};
    `,resolveDir},outfile:`${framework}.js`,format:'esm',alias,define:{'process.env.NODE_ENV':'"production"'}}),framework)
  }
  assets.set('/boot.js',`window.violations=[];window.recoverableErrors=[];document.addEventListener('securitypolicyviolation',e=>violations.push(e.effectiveDirective));`)
  server=createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost'),kind=url.searchParams.get('kind')||'Calendar',mode=url.searchParams.get('mode')||'granular',framework=url.searchParams.get('framework')||'React'
    res.setHeader('Content-Security-Policy',policy)
    res.setHeader('Content-Type',`${url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html'}; charset=utf-8`)
    const [a]=valuesOf(kind),tag=tagOf(kind)
    const children=kind==='Calendar'?['2026-10-08','2026-10-07'].map(v=>`<button type="button" data-part="day-cell" data-date="${v}">${v}</button>`).join(''):['a','b',''].map(v=>`<${kind==='Tabs'?'a-tab':'a-radio'} value="${v}" tabindex="0">${v||'Empty'}</${kind==='Tabs'?'a-tab':'a-radio'}>`).join('')
    const html=url.searchParams.has('raw')?`<${tag} id="subject" name="choice" ${initialOf(kind)}="${a}">${children}</${tag}>`:renderers.get(framework)(kind,{value:a})
    res.end(assets.get(url.pathname)??`<!doctype html><link rel="stylesheet" href="/${mode}.css"><script src="/boot.js"></script><form><main id="mount">${html}</main></form>`)
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`
  for(const engine of engines)browsers.set(engine,await engine.launch({headless:true,...(engine===chromium?{channel:process.env.CAPTURE_TEST_BROWSER_CHANNEL||undefined}:{})}))
  console.log('Selection coverage:',JSON.stringify([...browsers].map(([e,b])=>({engine:e.name(),version:b.version()}))),consumer?'installed package':'source')
})
after(async()=>{await Promise.all([...browsers.values()].map(b=>b.close()));if(server)await new Promise(r=>server.close(r))})
const settled=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
const current=page=>page.locator('a-calendar,a-radio-group,a-tabs').evaluate(el=>el.value)
async function pageFor(t,engine,mode,kind,framework,upgrade=true) {
  const page=await browsers.get(engine).newPage();page.setDefaultTimeout(7000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const response=await page.goto(`${origin}/?kind=${kind}&mode=${mode}${framework?`&framework=${framework}`:'&raw'}`)
  assert.equal(response.headers()['content-security-policy'],policy)
  t.after(async()=>{try{assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>recoverableErrors),[]);assert.deepEqual(await page.evaluate(()=>violations),[])}finally{await page.close()}})
  await page.evaluate(()=>{window.original=document.querySelector('a-calendar,a-radio-group,a-tabs')})
  if(upgrade)await page.evaluate(mode=>import(`/${mode}.js`),mode)
  if(framework){await page.evaluate(async({framework,kind,value})=>{await import(`/${framework}.js`);hydrateSelection(kind,{value})},{framework,kind,value:valuesOf(kind)[0]})}
  await settled(page)
  assert.equal(await page.evaluate(()=>original===document.querySelector('a-calendar,a-radio-group,a-tabs')),true)
  return page
}
async function pick(page,kind,value) {
  const tag=kind==='Calendar'?'[data-part=day-cell]':kind==='Tabs'?'a-tab':'a-radio'
  await page.locator(`#subject ${tag}`).evaluateAll((cells,{kind,value})=>cells.find(c=>c.getAttribute(kind==='Calendar'?'data-date':'value')===value).click(),{kind,value})
  await settled(page)
}
async function update(page,props){await page.evaluate(props=>updateSelection(props),props);await settled(page)}
async function inputs(page,kind,updates){
  await page.locator('a-calendar,a-radio-group,a-tabs').evaluate((el,{kind,updates})=>{
    for(const [name,value] of Object.entries(updates)){
      if(kind==='Calendar')el[name]=value
      else {const attr=name==='value'?'state':'default-state';if(value==null)el.removeAttribute(attr);else el.setAttribute(attr,value)}
    }
  },{kind,updates})
}
async function noAliases(page,kind){
  for(const attr of kind==='Calendar'?['state','default-state']:['value','defaultvalue'])assert.equal(await page.locator('a-calendar,a-radio-group,a-tabs').getAttribute(attr),null)
}
for(const engine of engines)for(const mode of ['granular','bundle'])for(const kind of kinds) {
  const name=`${engine.name()} ${mode} ${kind}`,[a,b]=valuesOf(kind),input=inputOf(kind),initial=initialOf(kind)
  test.fast(`${name}: authored inputs own control and uncontrolled picks keep authored attributes`,async t=>{
    const page=await pageFor(t,engine,mode,kind)
    const authored=await page.locator('a-calendar,a-radio-group,a-tabs').evaluate(el=>el.outerHTML)
    await pick(page,kind,b);assert.equal(await current(page),b)
    assert.equal(await page.locator('a-calendar,a-radio-group,a-tabs').evaluate(el=>el.outerHTML),authored)
    await inputs(page,kind,{value:a})
    assert.equal(await page.locator('a-calendar,a-radio-group,a-tabs').getAttribute(input),a)
    await pick(page,kind,b);assert.equal(await current(page),a)
    await page.locator('a-calendar,a-radio-group,a-tabs').evaluate((el,kind)=>el.addEventListener('statechange',e=>{if(!e.detail.reason||e.detail.reason==='user'){if(kind==='Calendar')el.value=e.detail.next;else if(e.detail.next==null)el.removeAttribute('state');else el.setAttribute('state',e.detail.next)}}),kind)
    await pick(page,kind,b);assert.equal(await current(page),b)
    await pick(page,kind,a);assert.equal(await current(page),a)
    await inputs(page,kind,{value:undefined,defaultValue:b})
    assert.equal(await current(page),a)
    // Replace the raw element to remove its accepting controller listener.
    await page.locator('a-calendar,a-radio-group,a-tabs').evaluate(el=>{const clone=el.cloneNode(true);el.replaceWith(clone)})
    await settled(page)
    assert.equal(await current(page),b)
    const before=await page.locator('a-calendar,a-radio-group,a-tabs').evaluate(el=>el.outerHTML)
    await pick(page,kind,a);assert.equal(await current(page),a)
    assert.equal(await page.locator('a-calendar,a-radio-group,a-tabs').evaluate(el=>el.outerHTML),before)
    if(kind!=='Tabs') {
      await page.evaluate(()=>document.querySelector('form').reset());await settled(page)
      assert.equal(await current(page),b)
      await page.locator('a-calendar,a-radio-group,a-tabs').evaluate((el,a)=>el.formStateRestoreCallback(a),a)
      assert.equal(await current(page),a)
      assert.equal(await page.locator('a-calendar,a-radio-group,a-tabs').evaluate(el=>el.outerHTML),before)
    }
    await inputs(page,kind,{value:'',defaultValue:null})
    assert.equal(await page.locator('a-calendar,a-radio-group,a-tabs').getAttribute(input),'')
    assert.equal(await current(page),kind==='Calendar'?null:'')
    assert.equal(await page.locator('a-calendar,a-radio-group,a-tabs').getAttribute(initial),null)
    await inputs(page,kind,{value:null})
    assert.equal(await page.locator('a-calendar,a-radio-group,a-tabs').getAttribute(input),null)
    assert.equal(await current(page),kind==='Calendar'?null:'')
    if(kind==='Calendar') {
      await page.locator('a-calendar').evaluate(el=>{el.value=el.value})
      assert.equal(await page.locator('a-calendar').getAttribute('value'),null)
      assert.equal(await current(page),null)
    }
    await pick(page,kind,b);assert.equal(await current(page),b)
    assert.equal(await page.locator('a-calendar,a-radio-group,a-tabs').getAttribute(input),null)
    await noAliases(page,kind)
  })
  test(`${name}: accepts authored inputs before registration`,async t=>{
    const page=await pageFor(t,engine,mode,kind,undefined,false)
    await inputs(page,kind,{value:b,defaultValue:a})
    await page.evaluate(mode=>import(`/${mode}.js`),mode);await settled(page)
    assert.equal(await current(page),b)
    assert.equal(await page.locator('a-calendar,a-radio-group,a-tabs').getAttribute(input),b)
    if(kind!=='Calendar')assert.deepEqual(await page.locator('a-radio-group,a-tabs').evaluate(el=>({readOnly:Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set===undefined,defaultProperty:'defaultValue' in el})),{readOnly:true,defaultProperty:false})
    await noAliases(page,kind)
    await inputs(page,kind,{value:a})
    assert.equal(await current(page),a)
  })
  for(const framework of ['React','Preact'])test(`${name} ${framework}: hydrates, round-trips, rejects, and releases value ownership`,{tier:mode==='granular'?'fast':'slow'},async t=>{
    const page=await pageFor(t,engine,mode,kind,framework)
    await pick(page,kind,b);assert.equal(await current(page),a)
    assert.equal(await page.evaluate(()=>reports.filter(r=>r.type==='request').length),1)
    await page.evaluate(()=>{accept=true})
    await pick(page,kind,b);assert.equal(await current(page),b)
    await pick(page,kind,a);assert.equal(await current(page),a)
    await page.evaluate(()=>{reports=[];accept=false})
    await update(page,{value:undefined,defaultValue:b})
    assert.equal(await current(page),a)
    assert.equal(await page.locator('a-calendar,a-radio-group,a-tabs').getAttribute(input),null)
    await pick(page,kind,b);assert.equal(await current(page),b)
    await update(page,{defaultValue:a});assert.equal(await current(page),b)
    assert.equal(await page.locator('a-calendar,a-radio-group,a-tabs').getAttribute(input),null)
    await update(page,{value:b})
    assert.equal(await page.locator('a-calendar,a-radio-group,a-tabs').getAttribute(input),b)
    await pick(page,kind,a);assert.equal(await current(page),b)
    if(kind!=='Tabs') {
      await page.evaluate(()=>document.querySelector('form').reset());await settled(page)
      assert.equal(await current(page),b)
      await page.locator('a-calendar,a-radio-group,a-tabs').evaluate((el,a)=>el.formStateRestoreCallback(a),a)
      assert.equal(await current(page),b)
    }
    await update(page,{value:undefined});assert.equal(await current(page),b)
    await update(page,{value:''})
    assert.equal(await current(page),kind==='Calendar'?null:'')
    assert.equal(await page.locator('a-calendar,a-radio-group,a-tabs').getAttribute(input),'')
    if(kind!=='Calendar')assert.equal(await page.locator(`#subject ${kind==='Tabs'?'a-tab':'a-radio'}:state(selected)`).getAttribute('value'),'')
    await update(page,{value:undefined});assert.equal(await current(page),kind==='Calendar'?null:'')
    await pick(page,kind,a);assert.equal(await current(page),a)
    assert.equal(await page.locator('a-calendar,a-radio-group,a-tabs').getAttribute(input),null)
    const focused=await page.locator(kind==='Calendar'?'#subject [data-date="2026-10-08"]':`#subject ${kind==='Tabs'?'a-tab':'a-radio'}[value="a"]`).getAttribute('tabindex')
    assert.equal(focused,'0')
    if(kind==='Tabs')assert.deepEqual(await page.locator('a-tabpanel:state(active)').allTextContents(),['Panel A'])
    await noAliases(page,kind)
  })
}
