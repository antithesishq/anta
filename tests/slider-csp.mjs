import assert from 'node:assert/strict'
import { before, after } from 'node:test'
import { createServer } from 'node:http'
import { createRequire, Module } from 'node:module'
import { resolve, relative, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { componentTest as test, componentEngines } from './component-tier.mjs'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const requirePlot = createRequire(new URL('../plot/package.json', import.meta.url))
const requireRenderer = createRequire(requireSite.resolve('@astrojs/preact'))
const {chromium, firefox, webkit} = requireSite('playwright')
const engines = componentEngines([chromium, firefox, webkit])
const consumer = process.env.ANTA_SLIDER_CONSUMER_ROOT ? resolve(process.env.ANTA_SLIDER_CONSUMER_ROOT) : undefined
const resolveDir = consumer ?? process.cwd(), base = consumer ? '@antadesign/anta' : resolve('src')
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'"
const assets = new Map(), renderers = new Map(), browsers = new Map()
const compareRef=process.env.ANTA_SLIDER_COMPARE_REF
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
const fixture = `
  import React from 'react';
  import {Slider,configure} from '${consumer ? base : `${base}/index`}';
  const h=React.createElement;
  const app=(props={})=>h(Slider,{id:'slider',label:h('strong',null,'Volume'),name:'volume',...props});
`
before(async () => {
  for (const mode of ['granular','bundle']) {
    const contents = mode === 'bundle' ? `import '${base}/bundle';${consumer?`import '${base}/bundle.css'`:''}` : `import '${base}/tokens.css';import '${base}/reset.css';import '${base}/elements/a-slider'`
    save(await compile({stdin:{contents,resolveDir},outfile:`${mode}.js`,format:'esm',alias:{react:consumer?'preact/compat':requireSite.resolve('preact/compat')}}),mode)
  }
  if(compareRef && !consumer) {
    const original=await compile({stdin:{contents:`import '${base}/tokens.css';import '${base}/reset.css';import '${base}/elements/a-slider'`,resolveDir},outfile:'original.js',format:'esm',alias:{react:requireSite.resolve('preact/compat')},plugins:[{name:'original',setup(b){b.onLoad({filter:/\/src\/.*\.(ts|tsx|css)$/},({path})=>({contents:execFileSync('git',['show',`${compareRef}:${relative(process.cwd(),path)}`],{encoding:'utf8'}),loader:path.endsWith('.css')?'css':path.endsWith('.tsx')?'tsx':'ts'}))}}]})
    save(original,'original')
  }
  for (const framework of ['React','Preact']) {
    const react=framework==='React'
    const alias={...(consumer?{}:{'@antadesign/anta/jsx-runtime':resolve('src/jsx-runtime')}),...(react?consumer?{}:{react:resolve('node_modules/react'),'react-dom/server':requirePlot.resolve('react-dom/server'),'react-dom/client':requirePlot.resolve('react-dom/client')}:{react:consumer?'preact/compat':requireSite.resolve('preact/compat'),...(consumer?{}:{'preact-render-to-string':requireRenderer.resolve('preact-render-to-string')})})}
    const result=await compile({stdin:{contents:`${fixture}${react?"import {renderToString} from 'react-dom/server'":"import renderToString from 'preact-render-to-string'"};export const render=props=>renderToString(app(props));`,resolveDir},platform:'node',format:'cjs',jsx:'automatic',jsxImportSource:'@antadesign/anta',alias})
    const compiled=new Module(resolve(`tests/slider-${framework}-server.cjs`));compiled._compile(result.outputFiles[0].text,compiled.id);renderers.set(framework,compiled.exports.render)
    save(await compile({stdin:{contents:`${fixture}
      ${react?"import {createRoot,hydrateRoot} from 'react-dom/client'":"import {render,hydrate} from 'preact'"};
      let root,props={},version=1;window.accept=false;window.cancelKey=false;window.cancelPointer=false;window.reports=[];window.recoverableErrors=[];
      const handlers=()=>{const v=version;return {
        onInput:e=>reports.push({kind:'input',version:v}),onChange:e=>reports.push({kind:'change',version:v}),
        onValueChange:(e,attrs)=>{reports.push({kind:'value',...attrs});if(accept&&props.value!==undefined)updateSlider({value:attrs.value})},
        onValueCommit:(e,attrs)=>reports.push({kind:'commit',...attrs}),
        onKeyDown:e=>{if(cancelKey)e.preventDefault()},onPointerDown:e=>{if(cancelPointer)e.preventDefault()},
      }};
      const commit=node=>{${react?"root??=createRoot(document.querySelector('#mount'));root.render(node)":"render(node,document.querySelector('#mount'))"}};
      window.hydrateSlider=initial=>{props=initial;configure(h,React.Fragment,React,{hydratingEvents:true});${react?"root=hydrateRoot(document.querySelector('#mount'),app({...handlers(),...props}),{onRecoverableError:e=>recoverableErrors.push(e.message)})":"hydrate(app({...handlers(),...props}),document.querySelector('#mount'))"}};
      window.updateSlider=updates=>{props={...props,...updates};commit(app({...handlers(),...props}))};
      window.refreshCallbacks=()=>{version++;updateSlider({})};
    `,resolveDir},outfile:`${framework}.js`,format:'esm',jsx:'automatic',jsxImportSource:'@antadesign/anta',alias,define:{'process.env.NODE_ENV':'"production"'}}),framework)
  }
  assets.set('/boot.js',`window.violations=[];window.recoverableErrors=[];document.addEventListener('securitypolicyviolation',e=>violations.push(e.effectiveDirective));`)
  assets.set('/fixture.css',`body{margin:40px;font:14px/20px system-ui}a-slider{width:260px}.consumer::part(thumb){border-radius:3px}.consumer::part(fill){background:rgb(1,2,3)}.marker{--slider-marker-position:50%}`)
  server=createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost'),mode=url.searchParams.get('mode')??'granular',framework=url.searchParams.get('framework')??'React'
    const props=url.searchParams.has('controlled')?{value:0,defaultValue:70}:{defaultValue:35}
    res.setHeader('Content-Security-Policy',url.searchParams.has('compare')?policy.replace("style-src 'self'","style-src 'self' 'unsafe-inline'"):policy)
    res.setHeader('Content-Type',`${url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html'}; charset=utf-8`)
    res.end(assets.get(url.pathname)??`<!doctype html><link rel="stylesheet" href="/${mode}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><form id="form"><input id="before" aria-label="Before"><main id="mount">${url.searchParams.has('raw')?'<a-slider id="slider" defaultvalue="35" tabindex="0" aria-label="Volume" name="volume"><span slot="label">Volume</span></a-slider>':renderers.get(framework)(props)}</main><input id="after" aria-label="After"></form>`)
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`
  for (const engine of engines) browsers.set(engine,await engine.launch({headless:true,...(engine===chromium?{channel:process.env.ANTA_SLIDER_CHROMIUM_EXECUTABLE?undefined:process.env.CAPTURE_TEST_BROWSER_CHANNEL||undefined,executablePath:process.env.ANTA_SLIDER_CHROMIUM_EXECUTABLE||undefined}:{})}))
  console.log('Slider browser coverage:',JSON.stringify([...browsers].map(([engine,browser])=>({engine:engine.name(),version:browser.version()}))),consumer?'installed package':'source')
})
after(async()=>{await Promise.all([...browsers.values()].map(b=>b.close()));if(server)await new Promise(r=>server.close(r))})
const settled=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
const value=page=>page.locator('#slider').evaluate(s=>s.value)
async function pageFor(t,engine,mode,framework,controlled=false) {
  const page=await browsers.get(engine).newPage();page.setDefaultTimeout(7000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const response=await page.goto(`${origin}/?mode=${mode}&framework=${framework??'React'}${controlled?'&controlled':''}${framework?'':'&raw'}`)
  assert.equal(response.headers()['content-security-policy'],policy)
  t.after(async()=>{try{assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>recoverableErrors),[]);assert.deepEqual(await page.evaluate(()=>violations),[])}finally{await page.close()}})
  await page.evaluate(async({mode,framework,controlled})=>{
    window.originalSlider=document.querySelector('#slider');window.originalLabel=originalSlider.firstElementChild;
    await import(`/${mode}.js`)
    if(framework){await import(`/${framework}.js`);hydrateSlider(controlled?{value:0,defaultValue:70}:{defaultValue:35})}
  },{mode,framework,controlled})
  await settled(page)
  assert.equal(await page.evaluate(()=>originalSlider===document.querySelector('#slider')&&originalLabel===originalSlider.firstElementChild),true)
  return page
}
async function update(page,props){await page.evaluate(props=>updateSlider(props),props);await settled(page)}
for(const engine of engines) for(const mode of ['granular','bundle']) {
  const name=`${engine.name()} ${mode}`
  test.fast(`${name}: external defaults, slots, parts, numeric constraints, and form serialization`,async t=>{
    const page=await pageFor(t,engine,mode)
    const initial=await page.locator('#slider').evaluate(s=>({styles:s.shadowRoot.querySelectorAll('style,link').length,control:getComputedStyle(s.shadowRoot.querySelector('[part=control]')).position,height:s.shadowRoot.querySelector('[part=control]').getBoundingClientRect().height}))
    assert.deepEqual(initial,{styles:0,control:'relative',height:28})
    const result=await page.evaluate(()=>{
      const s=document.querySelector('#slider'),form=document.querySelector('form')
      s.setAttribute('defaultvalue','70 20');s.setAttribute('value-prefix','$');s.setAttribute('value-suffix','%');s.setAttribute('value-display','thumb');s.className='consumer'
      const m=document.createElement('span');m.slot='markers';m.className='marker';m.textContent='Middle';s.append(m)
      return {value:s.value,submission:new FormData(form).getAll('volume'),text:s.shadowRoot.querySelector('[part~=end-value]').textContent,thumb:getComputedStyle(s.shadowRoot.querySelector('[part~=thumb]')).borderRadius}
    })
    assert.deepEqual(result,{value:[20,70],submission:['20','70'],text:'$20%–$70%',thumb:'3px'})
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#slider').shadowRoot.querySelector('[part~=fill-start]')).backgroundColor==='rgb(1, 2, 3)')
    await settled(page)
    assert.equal(await page.locator('#slider').evaluate(s=>s.matches(':state(has-markers)')),true)
    assert.equal(await page.getByRole('slider').count(),2)
    await page.getByRole('slider').first().focus();await page.keyboard.press('End')
    assert.deepEqual(await value(page),[70,100])
    assert.match(await page.getByRole('slider').first().getAttribute('part'),/thumb-1/)
    const numeric=await page.evaluate(()=>{
      const s=document.querySelector('#slider');s.setAttribute('min','0.00000000000015');s.setAttribute('max','0.00000000000025');s.setAttribute('step','0.00000000000001');s.setAttribute('value','0.0000000000002');const small=s.value
      s.setAttribute('min','20');s.setAttribute('max','10');s.setAttribute('step','-5');s.setAttribute('value','NaN');return {small,reversed:s.value}
    })
    assert.deepEqual(numeric,{small:2e-13,reversed:20})
  })
  for(const framework of ['React','Preact']) test(`${name} ${framework}: hydrates, rejects and accepts numeric requests, and composes callbacks`,{tier:mode==='granular'?'fast':'slow'},async t=>{
    const page=await pageFor(t,engine,mode,framework,true)
    assert.equal(await value(page),0)
    await page.locator('#slider').focus();await page.keyboard.press('ArrowRight');await settled(page)
    assert.equal(await value(page),0)
    assert.deepEqual(await page.evaluate(()=>reports.map(r=>r.kind)),['input','value','change','commit'])
    assert.equal(await page.evaluate(()=>reports[1].value),1)
    await update(page,{value:45,min:20,max:80,step:5})
    await page.evaluate(()=>{reports=[];cancelKey=true});await page.keyboard.press('ArrowRight');await settled(page)
    assert.equal(await value(page),45);assert.deepEqual(await page.evaluate(()=>reports),[])
    await page.evaluate(()=>{cancelKey=false;accept=true;refreshCallbacks()});await settled(page)
    await page.keyboard.press('ArrowRight');await settled(page)
    assert.equal(await value(page),50)
    assert.deepEqual(await page.evaluate(()=>reports[1]),{kind:'value',value:50,min:20,max:80,step:5,name:'volume'})
    assert.equal(await page.evaluate(()=>reports[0].version),2)
    await page.evaluate(()=>{reports=[];document.querySelector('form').reset()});await settled(page)
    assert.equal(await value(page),50);assert.deepEqual(await page.evaluate(()=>reports),[])
    await update(page,{value:0,min:0,max:100,step:1});assert.equal(await value(page),0)
    assert.deepEqual(await page.evaluate(()=>reports),[])
    assert.equal(await page.locator('#slider').getAttribute('value'),'0')
    await update(page,{value:undefined,defaultValue:70})
    assert.equal(await page.locator('#slider').getAttribute('value'),null)
    assert.equal(await value(page),0)
    await page.keyboard.press('ArrowRight');await settled(page)
    assert.equal(await value(page),1)
    assert.equal(await page.locator('#slider').getAttribute('value'),null)
    await update(page,{defaultValue:80});assert.equal(await value(page),1)
    await page.evaluate(()=>{reports=[];document.querySelector('form').reset()});await settled(page)
    assert.equal(await value(page),80)
    assert.deepEqual(await page.evaluate(()=>reports.map(r=>r.kind)),['input','value','change','commit'])
    await update(page,{value:80})
    assert.equal(await value(page),80)
    assert.equal(await page.locator('#slider').getAttribute('value'),'80')
    await update(page,{value:0})
    assert.equal(await value(page),0)
    assert.equal(await page.locator('#slider').getAttribute('value'),'0')
    await page.evaluate(()=>{reports=[];accept=false})
    await update(page,{onInput:undefined,onValueChange:undefined,onChange:undefined,onValueCommit:undefined})
    await page.keyboard.press('ArrowRight');await settled(page)
    assert.deepEqual(await page.evaluate(()=>reports),[]);assert.equal(await value(page),0)
  })
  test.fast(`${name}: authored inputs own control and uncontrolled operations never rewrite attributes`,async t=>{
    const page=await pageFor(t,engine,mode)
    const result=await page.evaluate(()=>{
      const s=document.querySelector('#slider'),form=document.querySelector('form'),events=[]
      for(const type of ['input','change'])s.addEventListener(type,e=>events.push([type,e.detail.value]))
      const observer=new MutationObserver(()=>{});observer.observe(s,{attributes:true})
      const key=()=>s.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}))
      key();const interactive=s.value
      s.formStateRestoreCallback('50');const restored=s.value
      form.reset();const reset=s.value
      const mutations=observer.takeRecords().map(r=>r.attributeName)
      s.formStateRestoreCallback('50');s.defaultValue=20;const dirty=s.value
      form.reset();const newDefault=s.value
      s.value=40;key();const rejected=s.value
      s.value=65;const assigned={value:s.value,attribute:s.getAttribute('value')}
      s.value=undefined;const released=s.value
      s.defaultValue=30;const retained=s.value
      observer.takeRecords();key();const resumed={value:s.value,submission:new FormData(form).get('volume'),attribute:s.getAttribute('value')}
      form.reset();const finalReset=s.value
      const resumedMutations=observer.takeRecords().map(r=>r.attributeName)
      s.value=0;key();const zero=s.value
      s.value=null;const nullRelease=s.value
      observer.disconnect()
      return {interactive,restored,reset,mutations,dirty,newDefault,rejected,assigned,released,retained,resumed,finalReset,resumedMutations,zero,nullRelease,defaultAttribute:s.getAttribute('defaultvalue'),events}
    })
    assert.deepEqual(result,{interactive:36,restored:50,reset:35,mutations:[],dirty:50,newDefault:20,rejected:40,assigned:{value:65,attribute:'65'},released:65,retained:65,resumed:{value:66,submission:'66',attribute:null},finalReset:30,resumedMutations:[],zero:0,nullRelease:0,defaultAttribute:'30',events:[['input',36],['change',36],['input',35],['change',35],['input',20],['change',20],['input',41],['change',41],['input',66],['change',66],['input',30],['change',30],['input',1],['change',1]]})
  })
  test.fast(`${name}: consumer cancellation and disabled, external-update, and disconnect drag cleanup`,async t=>{
    const page=await pageFor(t,engine,mode)
    const s=page.locator('#slider'),control=s.locator('[part=control]'),box=await control.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2
    await s.evaluate(s=>s.addEventListener('pointerdown',e=>e.preventDefault(),{once:true}))
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+25,y);await page.mouse.up()
    assert.equal(await value(page),35)
    const authored=await s.evaluate(s=>s.getAttributeNames().map(name=>[name,s.getAttribute(name)]))
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+25,y)
    assert.ok((await value(page))>35)
    assert.deepEqual(await s.evaluate(s=>s.getAttributeNames().map(name=>[name,s.getAttribute(name)])),authored)
    await s.evaluate(s=>s.setAttribute('disabled',''));const disabled=await value(page)
    await page.mouse.move(x+50,y);await page.mouse.up();assert.equal(await value(page),disabled)
    assert.equal(await s.evaluate(s=>s.matches(':state(dragging)')),false)
    assert.equal(await s.evaluate(s=>s.internals.ariaDisabled),'true')
    await s.evaluate(s=>s.removeAttribute('disabled'))
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+20,y)
    await s.evaluate(s=>{s.setAttribute('value','80');s.addEventListener('input',e=>s.setAttribute('value',String(e.detail.value)))})
    await page.mouse.move(x+25,y);assert.ok((await value(page))>=80)
    await s.evaluate(s=>{const parent=s.parentNode;s.remove();parent.append(s)})
    const detached=await value(page);await page.mouse.move(x-50,y);await page.mouse.up()
    assert.equal(await value(page),detached);assert.equal(await s.evaluate(s=>s.matches(':state(dragging)')),false)
  })
  test(`${name}: independent import orders preserve nodes and fieldset disablement`,async t=>{
    const page=await pageFor(t,engine,mode)
    const result=await page.evaluate(async mode=>{
      const s=document.querySelector('#slider'),shadow=s.shadowRoot,ctor=customElements.get('a-slider')
      const css=document.createElement('link');css.rel='stylesheet';css.href=`/${mode==='bundle'?'granular':'bundle'}.css`;document.head.append(css)
      await import(`/${mode==='bundle'?'granular':'bundle'}.js`)
      const fieldset=document.createElement('fieldset');s.before(fieldset);fieldset.append(s);fieldset.disabled=true
      s.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}))
      return {value:s.value,same:shadow===s.shadowRoot&&ctor===customElements.get('a-slider'),form:new FormData(document.querySelector('form')).getAll('volume'),disabled:s.internals.ariaDisabled}
    },mode)
    assert.deepEqual(result,{value:35,same:true,form:[],disabled:'true'})
    await page.locator('#before').focus();await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(()=>document.activeElement.id),'after')
  })
  test(`${name}: constraint updates and a second pointer retain the first gesture`,async t=>{
    const page=await pageFor(t,engine,mode)
    const result=await page.locator('#slider').evaluate(s=>{
      const c=s.shadowRoot.querySelector('[part=control]');c.setPointerCapture=()=>{};c.hasPointerCapture=()=>false
      const pointer=(type,id,x,buttons=1)=>c.dispatchEvent(new PointerEvent(type,{pointerId:id,button:0,buttons,clientX:x,bubbles:true,composed:true,cancelable:true}))
      pointer('pointerdown',1,100);pointer('pointerdown',2,200);pointer('pointermove',2,250)
      const second=s.value
      pointer('pointermove',1,110);s.setAttribute('max','50');s.setAttribute('step','5');pointer('pointermove',1,115);pointer('pointerup',1,115,0)
      return {second,value:s.value,dragging:s.matches(':state(dragging)')}
    })
    assert.equal(result.second,35);assert.ok(result.value>=35&&result.value<=50);assert.equal(result.value%5,0);assert.equal(result.dragging,false)
  })
  test(`${name}: inherited RTL matches pointer geometry and keyboard direction`,async t=>{
    const page=await pageFor(t,engine,mode)
    await page.locator('#slider').evaluate(s=>{s.dir='rtl';s.setAttribute('track-click','jump')})
    const rail=await page.locator('#slider [part=rail-area]').boundingBox()
    await page.mouse.click(rail.x+rail.width*0.75,rail.y+rail.height/2)
    assert.ok(Math.abs((await value(page))-25)<=1)
    const thumb=await page.locator('#slider [part~=thumb-1]').boundingBox()
    assert.ok(Math.abs(thumb.x+thumb.width/2-(rail.x+rail.width*0.75))<3)
    await page.locator('#slider').focus();await page.keyboard.press('ArrowRight')
    assert.ok((await value(page))<25)
  })
  test(`${name}: names follow live labels and crossing retains focus and physical identity`,async t=>{
    const page=await pageFor(t,engine,mode)
    await page.locator('#slider').evaluate(s=>{s.removeAttribute('aria-label');s.setAttribute('defaultvalue','20 70')})
    const thumb=page.locator('#slider [part~=thumb-1]')
    const name=()=>thumb.evaluate(el=>el.ariaLabelledByElements.map(label=>label.textContent).join(' '))
    assert.equal(await name(),'Volume minimum')
    await page.locator('#slider [slot=label]').evaluate(label=>label.textContent='Price')
    assert.equal(await name(),'Price minimum')
    if(engine===chromium){
      const session=await page.context().newCDPSession(page)
      const {nodes}=await session.send('Accessibility.getFullAXTree')
      assert.ok(nodes.some(node=>node.role?.value==='slider'&&node.name?.value==='Price minimum'))
      await session.detach()
    }
    await thumb.focus();await page.keyboard.press('End')
    assert.deepEqual(await value(page),[70,100])
    assert.equal(await name(),'Price maximum')
    assert.equal(await thumb.evaluate(el=>el===el.getRootNode().activeElement),true)
    await page.locator('#slider').evaluate(s=>{
      const label=document.createElement('span');label.id='price-label';label.textContent='Budget';s.before(label)
      s.setAttribute('aria-label','Fallback');s.setAttribute('aria-labelledby','price-label')
    })
    assert.equal(await name(),'Budget maximum')
    await page.locator('#price-label').evaluate(label=>label.textContent='Limit')
    assert.equal(await name(),'Limit maximum')
  })
  test(`${name}: late CSS, reconnect, adoption, and author-owned shadow roots`,async t=>{
    const page=await pageFor(t,engine,mode)
    await page.evaluate(()=>{document.querySelector('link').disabled=true})
    await page.locator('#slider').focus();await page.keyboard.press('ArrowRight');assert.equal(await value(page),36)
    await page.evaluate(()=>{document.querySelector('link').disabled=false});await settled(page)
    assert.equal(await page.locator('#slider [part=control]').evaluate(el=>getComputedStyle(el).position),'relative')
    const moved=await page.evaluate(async()=>{
      const iframe=document.createElement('iframe');document.body.append(iframe)
      const doc=iframe.contentDocument;doc.head.innerHTML=document.head.innerHTML
      const s=document.querySelector('#slider');doc.body.append(doc.adoptNode(s))
      s.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));const adopted=s.value
      const host=doc.createElement('div');doc.body.append(host);const root=host.attachShadow({mode:'closed'})
      const css=doc.createElement('link');css.rel='stylesheet';css.href=document.querySelector('link').href;root.append(css,s)
      s.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,composed:true,cancelable:true}));const shadow=s.value
      await new Promise(resolve=>{css.onload=resolve;css.onerror=resolve;if(css.sheet)resolve()})
      return {adopted,shadow,position:doc.defaultView.getComputedStyle(s.shadowRoot.querySelector('[part=control]')).position}
    })
    assert.deepEqual(moved,{adopted:37,shadow:38,position:'relative'})
  })
}

if(compareRef && !consumer) for(const engine of engines) for(const mode of ['granular','bundle']) test(`${engine.name()} ${mode}: original appearance and geometry`,async t=>{
  const pages=[]
  try {
    for(const entry of ['original',mode]) {
      const page=await browsers.get(engine).newPage({viewport:{width:700,height:650}});pages.push(page)
      await page.goto(`${origin}/?raw&compare&mode=${entry}`)
      await page.evaluate(entry=>import(`/${entry}.js`),entry)
    }
    const directory=resolve('tests/.test-output/slider',`${engine.name()}-${browsers.get(engine).version()}`,mode)
    await mkdir(directory,{recursive:true})
    const metrics=[]
    for(const [name,attrs] of Object.entries({scalar:{},small:{size:'small',tone:'info'},large:{size:'large',round:'4px'},range:{defaultvalue:'20 70'},inverted:{defaultvalue:'20 70',inverted:''},inline:{'value-display':'inline','value-prefix':'$','value-suffix':'%'},bubbles:{defaultvalue:'20 70','value-display':'thumb','thumb-fill':''}})) {
      const pair=[]
      for(const [index,page] of pages.entries()) {
        await page.evaluate(attrs=>{
          document.querySelector('#mount').innerHTML='<a-slider id="slider" defaultvalue="35" tabindex="0"><span slot="label">Volume</span></a-slider>'
          const s=document.querySelector('#slider');for(const [key,value] of Object.entries(attrs))s.setAttribute(key,value)
        },attrs)
        await page.waitForTimeout(350)
        pair.push(await page.locator('#slider').evaluate(s=>[s,...s.shadowRoot.querySelectorAll('[part]')].filter(el=>getComputedStyle(el).display!=='none').map(el=>{
          const b=el.getBoundingClientRect(),cs=getComputedStyle(el)
          return {tag:el.tagName,x:b.x,y:b.y,width:b.width,height:b.height,font:cs.font,color:cs.color,background:cs.backgroundColor,border:cs.border,radius:cs.borderRadius}
        })))
        await page.screenshot({path:join(directory,`${name}-${index?'current':'original'}.png`)})
      }
      // New styling parts expose existing nodes, so compare the original visual regions.
      const regions=data=>data.filter(row=>row.width>0||row.height>0)
      const original=regions(pair[0]),current=regions(pair[1])
      // Additional part-only rail/affix nodes are validated by their containing regions.
      const find=(rows,row)=>rows.find(other=>other.tag===row.tag&&Math.abs(other.x-row.x)<0.01&&Math.abs(other.y-row.y)<0.01&&Math.abs(other.width-row.width)<0.01&&Math.abs(other.height-row.height)<0.01&&other.font===row.font&&other.color===row.color&&other.background===row.background&&other.border===row.border&&other.radius===row.radius)
      assert.ok(original.every(row=>find(current,row)),`${name}: ${JSON.stringify({original,current})}`)
      metrics.push({name,original,current})
    }
    await writeFile(join(directory,'metrics.json'),JSON.stringify(metrics,null,2))
  } finally {await Promise.all(pages.map(page=>page.close()))}
})
