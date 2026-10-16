import assert from 'node:assert/strict'
import { before, after } from 'node:test'
import { createRequire, Module } from 'node:module'
import { resolve } from 'node:path'
import { createServer } from 'node:http'
import { mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { build } from 'esbuild'
import { componentTest as test, componentEngines } from './component-tier.mjs'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const requirePlot = createRequire(new URL('../plot/package.json', import.meta.url))
const requireRenderer = createRequire(requireSite.resolve('@astrojs/preact'))
const { chromium, firefox, webkit } = requireSite('playwright')
const engines = componentEngines([chromium, firefox, webkit])
const consumer = process.env.ANTA_INPUT_TIME_CONSUMER_ROOT
const source = resolve('src'), resolveDir = consumer ? resolve(consumer) : process.cwd()
const base = consumer ? '@antadesign/anta' : source
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'"
const assets = new Map(), browsers = new Map(), renderers = new Map()
let server, origin
const factory = `const app = (props={}) => React.createElement(InputTime, {
  id:'field', label:React.createElement('strong',{},'Start'), hint:React.createElement('em',{},'Helpful hint'),
  defaultValue:'09:30',locale:'en-US',clearable:true,name:'start',...props,
  onValueChange:(e,attrs)=>{window.reports.push([e.type,attrs]); if(window.echo) window.show({...props,value:attrs.value})},
  onClearClick:e=>{if(window.veto)e.preventDefault()},onClearInput:()=>window.cleared++,
})`
async function compile(options) {
  const result = await build({absWorkingDir:resolveDir,bundle:true,write:false,metafile:true,target:'es2022',
    nodePaths:consumer?[resolve(consumer,'node_modules')]:[resolve('node_modules'),resolve('site/node_modules')],...options})
  if(consumer) {
    const inputs=Object.keys(result.metafile.inputs).map(p=>resolve(resolveDir,p))
    assert.ok(inputs.some(p=>p.startsWith(resolve(consumer,'node_modules/@antadesign/anta/dist')+'/')))
    assert.ok(!inputs.some(p=>p.startsWith(source+'/')),'Installed consumer must not resolve source')
  }
  return result
}
const save=(result,name)=>{for(const file of result.outputFiles)assets.set(`/${name}.${file.path.endsWith('.css')?'css':'js'}`,file.text)}
before(async()=>{
  for(const mode of ['granular','bundle']) {
    const entries=['a-input-time','a-input','a-button','a-icon','a-input-date','a-calendar','a-menu','a-menu-item','a-menu-group','a-menu-separator']
    const contents=mode==='bundle'?`import '${base}/bundle';${consumer?`import '${base}/bundle.css'`:''}`:
      `import '${base}/tokens.css';import '${base}/reset.css';${entries.map(e=>`import '${base}/elements/${e}';`).join('')}`
    save(await compile({stdin:{contents,resolveDir},outfile:`${mode}.js`,format:'esm',alias:{react:consumer?'preact/compat':requireSite.resolve('preact/compat')}}),mode)
  }
  if(process.env.ANTA_INPUT_TIME_COMPARE_ORIGINAL==='1'&&!consumer) {
    save(await compile({stdin:{contents:`import '${base}/tokens.css';import '${base}/reset.css';import '${base}/elements/a-input-time';import '${base}/elements/a-icon';`,resolveDir},outfile:'original.js',format:'esm',
      plugins:[{name:'original-time',setup(api){api.onLoad({filter:/[/\\]a-input-time\.(ts|css)$/},args=>({contents:execFileSync('git',['show',`2d2ba6e6:${args.path.slice(process.cwd().length+1)}`],{encoding:'utf8'}),loader:args.path.endsWith('.css')?'css':'ts'}))}}]}),'original')
  }
  for(const framework of ['React','Preact']) {
    const react=framework==='React'
    const aliases={...(consumer?{}:{'@antadesign/anta/jsx-runtime':resolve(source,'jsx-runtime')}),
      ...(react?consumer?{}:{react:resolve('node_modules/react')}:{react:consumer?'preact/compat':requireSite.resolve('preact/compat')})}
    const imports=`import React from 'react';import {InputTime,InputDate,Button,configure} from '${consumer?'@antadesign/anta':source+'/index'}';`
    const ssr=await compile({stdin:{contents:`${imports}${react?"import {renderToString} from 'react-dom/server'":"import renderToString from 'preact-render-to-string'"};${factory};export const render=props=>renderToString(app(props));`,resolveDir},platform:'node',format:'cjs',jsx:'automatic',jsxImportSource:'@antadesign/anta',alias:{...aliases,...(consumer?{}:react?{'react-dom/server':requirePlot.resolve('react-dom/server')}:{'preact-render-to-string':requireRenderer.resolve('preact-render-to-string')})}})
    const module=new Module(resolve(`tests/time-${framework}.cjs`));module._compile(ssr.outputFiles[0].text,module.id);renderers.set(framework,module.exports.render)
    save(await compile({stdin:{contents:`${imports}${react?"import {createRoot,hydrateRoot} from 'react-dom/client'":"import {render,hydrate} from 'preact'"};${factory};let root;window.reports=[];window.cleared=0;window.recoveries=[];
      window.show=props=>{${react?"root??=createRoot(document.querySelector('#mount'));root.render(app(props))":"render(app(props),document.querySelector('#mount'))"}};
      window.hydrateTime=props=>{configure(React.createElement,React.Fragment,React,{hydratingEvents:true});${react?"root=hydrateRoot(document.querySelector('#mount'),app(props),{onRecoverableError:e=>recoveries.push(e.message)})":"hydrate(app(props),document.querySelector('#mount'))"}};
      window.showBare=()=>{const node=React.createElement(InputTime,{id:'field',label:React.createElement('strong',{},'Start'),hint:React.createElement('em',{},'Helpful hint'),defaultValue:'09:30',locale:'en-US',clearable:true});${react?"root.render(node)":"render(node,document.querySelector('#mount'))"}};
      window.showActions=(props={})=>show({...props,trailing:React.createElement(React.Fragment,{},React.createElement(Button,{icon:'check','aria-label':'Confirm'}),React.createElement(Button,{},'Save'))});
      window.showDate=()=>{const node=React.createElement(InputDate,{label:'Meeting',time:true,locale:'en-US',defaultValue:'2026-10-15T09:30',name:'meeting'});${react?"root??=createRoot(document.querySelector('#mount'));root.render(node)":"render(node,document.querySelector('#mount'))"}};`,resolveDir},outfile:`${framework}.js`,format:'esm',jsx:'automatic',jsxImportSource:'@antadesign/anta',define:{'process.env.NODE_ENV':'"production"'},alias:{...aliases,...(react&&!consumer?{'react-dom/client':requirePlot.resolve('react-dom/client')}:{})}}),framework)
  }
  assets.set('/boot.js',`window.violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push({directive:e.effectiveDirective,source:e.sourceFile}));`)
  assets.set('/fixture.css',`body{margin:32px;font-family:system-ui}#mount{width:550px}.dark{color-scheme:dark}.rtl{direction:rtl}.override{width:300px}.override::part(field){min-height:45px;border-radius:13px;outline:3px solid blue}.override::part(segment){font-size:19px;width:70px;color:rgb(100,20,30)}.override::part(period){width:100px}.override::part(segment)::placeholder{color:rgb(10,90,20)}.override::part(literal){color:rgb(90,20,100)}.inset{--input-time-trailing-inset:9px}span{display:inline-block}`)
  server=createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost'),mode=url.searchParams.get('mode')??'granular'
    res.setHeader('Content-Security-Policy',mode==='original'?policy.replace("style-src 'self'","style-src 'self' 'unsafe-inline'"):policy)
    res.setHeader('Content-Type',`${url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html'}; charset=utf-8`)
    res.end(assets.get(url.pathname)??`<!doctype html><link rel="stylesheet" href="/${mode}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><main id="mount">${url.searchParams.has('ssr')?renderers.get(url.searchParams.get('framework')??'React')({}):''}</main><a href="#after" id="after">After</a>`)
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`
  for(const engine of engines){const browser=await engine.launch({headless:true,...(engine===chromium?process.env.ANTA_INPUT_TIME_CHROMIUM_EXECUTABLE?{executablePath:process.env.ANTA_INPUT_TIME_CHROMIUM_EXECUTABLE}:{channel:process.env.CAPTURE_TEST_BROWSER_CHANNEL||undefined}:{})});browsers.set(engine,browser);console.log(`${engine.name()}: ${browser.version()}`)}
})
after(async()=>{await Promise.all([...browsers.values()].map(b=>b.close()));if(server)await new Promise(r=>server.close(r))})
async function pageFor(t,engine,mode,query='',options={}){
  const {menu=false,...context}=options
  const page=await browsers.get(engine).newPage({viewport:{width:1000,height:800},reducedMotion:'reduce',...context});page.setDefaultTimeout(6000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const response=await page.goto(`${origin}/?mode=${mode}${query}`);assert.equal(response.headers()['content-security-policy'],policy)
  t.after(async()=>{try{assert.deepEqual(errors,[]);if(!menu)assert.deepEqual(await page.evaluate(()=>violations),[])}finally{await page.close()}})
  return page
}
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
const host=page=>page.locator('a-input-time').first()
const segment=(page,kind)=>host(page).locator(`[part~="${kind}"]`)
const value=page=>host(page).evaluate(el=>el.value)
async function register(page,mode){await page.evaluate(mode=>import(`/${mode}.js`),mode);await frames(page)}
async function mount(page,html){await page.locator('#mount').evaluate((el,html)=>el.innerHTML=html,html);await frames(page)}
async function client(page,framework){await page.evaluate(framework=>import(`/${framework}.js`),framework)}

for(const engine of engines)for(const mode of ['granular','bundle']){
  const name=`${engine.name()} ${mode}`
  test.fast(`${name}: external defaults, parts, sizing and initial skeleton under CSP`,async t=>{
    const page=await pageFor(t,engine,mode)
    await mount(page,'<a-input-time locale="en-GB" defaultvalue="09:30"><span slot="label">Start</span></a-input-time>')
    assert.equal(await host(page).evaluate(el=>getComputedStyle(el).display),'grid')
    await register(page,mode)
    assert.equal(await value(page),'09:30')
    const result=await host(page).evaluate(el=>({styles:el.shadowRoot.querySelectorAll('style,link').length,parts:[...el.shadowRoot.querySelectorAll('[part]')].flatMap(el=>[...el.part]),height:el.shadowRoot.querySelector('[part=field]').getBoundingClientRect().height,display:getComputedStyle(el.shadowRoot.querySelector('[part=segments]')).display}))
    assert.equal(result.styles,0);assert.equal(result.height,28);assert.equal(result.display,'flex')
    for(const part of ['field','label','hint','leading','trailing','clear','segments','segment','hour','minute','literal'])assert.ok(result.parts.includes(part),part)
    for(const [size,height]of [['small',24],['large',32]]){await host(page).evaluate((el,size)=>el.setAttribute('size',size),size);assert.equal(await host(page).locator('[part=field]').evaluate(el=>el.getBoundingClientRect().height),height)}
  })
  test.fast(`${name}: digit entry, auto-advance, wrapping, navigation, paste and incomplete values`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,'<a-input-time locale="en-GB"></a-input-time>')
    const hour=segment(page,'hour'),minute=segment(page,'minute')
    await hour.focus();await hour.press('9');assert.equal(await minute.evaluate(el=>el===el.getRootNode().activeElement),true)
    await minute.pressSequentially('30');assert.equal(await value(page),'09:30')
    await minute.press('End');await minute.press('ArrowUp');assert.equal(await value(page),'09:31')
    await minute.fill('59');await minute.press('ArrowUp');assert.equal(await value(page),'09:00');await minute.press('ArrowDown');assert.equal(await value(page),'09:59')
    await minute.press('PageDown');assert.equal(await value(page),'09:54')
    await minute.evaluate(el=>el.setSelectionRange(0,0));await minute.press('ArrowLeft');assert.equal(await hour.evaluate(el=>el===el.getRootNode().activeElement),true)
    await hour.fill('');assert.equal(await value(page),'');assert.equal(await minute.inputValue(),'54')
    await hour.evaluate(el=>{const data=new DataTransfer();data.setData('text/plain','18:45');const event=new ClipboardEvent('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{getData:()=>data.getData('text/plain')}});el.dispatchEvent(event)});assert.equal(await value(page),'18:45')
    await hour.focus();await hour.press('Control+ArrowRight');assert.equal(await hour.evaluate(el=>el===el.getRootNode().activeElement),true)
    await hour.evaluate(el=>el.setSelectionRange(el.value.length,el.value.length));await hour.press('ArrowRight');assert.equal(await minute.evaluate(el=>el===el.getRootNode().activeElement),true)
  })
  test.fast(`${name}: native caret, selection, partial typing and focus ring exclude actions`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,'<a-input-time locale="en-GB" value="10:30"><a-button slot="trailing" role="button" tabindex="0">Action</a-button></a-input-time>')
    const hour=segment(page,'hour');await hour.click();await hour.evaluate(el=>el.setSelectionRange(1,1));await hour.press('ArrowLeft')
    assert.equal(await hour.evaluate(el=>el.selectionStart),0)
    await hour.fill('1');assert.equal(await hour.inputValue(),'1');assert.equal(await hour.evaluate(el=>el.selectionStart),1)
    const ring=()=>host(page).locator('[part=field]').evaluate(el=>getComputedStyle(el).outlineStyle)
    assert.equal(await ring(),'solid');await host(page).locator('a-button').click();assert.equal(await ring(),'none')
    await host(page).evaluate(el=>el.setAttribute('readonly',''));await hour.click();await frames(page);assert.equal(await ring(),'none')
    await page.keyboard.press('Tab');await frames(page);assert.equal(await ring(),'solid')
    await host(page).evaluate(el=>el.removeAttribute('readonly'));await hour.focus()
    assert.equal(await host(page).evaluate(el=>el.ownerDocument[Symbol.for('anta.input-focus-modality')].active===undefined),true,'Editable typing does not schedule focus refresh')
  })
  test.fast(`${name}: forms, range, reset, restore, disabled, readonly and critical status`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,'<form><fieldset><a-input-time name="start" locale="en-GB" defaultvalue="09:30" min="09:00" max="17:00" required></a-input-time></fieldset></form>')
    assert.deepEqual(await page.evaluate(()=>[...new FormData(document.querySelector('form'))]),[['start','09:30']])
    await host(page).evaluate(el=>el.value='18:30');assert.equal(await host(page).evaluate(el=>el.validity.rangeOverflow),true)
    await segment(page,'hour').focus();await page.locator('#after').focus();assert.equal(await value(page),'17:00')
    await page.evaluate(()=>document.querySelector('form').reset());assert.equal(await value(page),'09:30')
    await host(page).evaluate(el=>el.formStateRestoreCallback('13:45'));assert.equal(await value(page),'13:45')
    await host(page).evaluate(el=>el.setAttribute('readonly',''));assert.equal(await segment(page,'hour').evaluate(el=>el.readOnly),true)
    await segment(page,'hour').press('ArrowUp');assert.equal(await value(page),'13:45')
    await segment(page,'hour').evaluate(el=>{const data=new DataTransfer();data.setData('text/plain','11:00');const event=new ClipboardEvent('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{getData:()=>data.getData('text/plain')}});el.dispatchEvent(event)});assert.equal(await value(page),'13:45')
    await page.locator('fieldset').evaluate(el=>el.disabled=true);assert.equal(await segment(page,'hour').isDisabled(),true);assert.deepEqual(await page.evaluate(()=>[...new FormData(document.querySelector('form'))]),[])
    await page.locator('fieldset').evaluate(el=>el.disabled=false);await host(page).evaluate(el=>{el.removeAttribute('readonly');el.setAttribute('status','critical')});assert.equal(await host(page).evaluate(el=>el.validity.customError),true)
    await host(page).evaluate(el=>{el.removeAttribute('status');el.value=''});assert.equal(await host(page).evaluate(el=>el.validity.valueMissing),true)
  })
  for(const framework of ['React','Preact'])test.fast(`${name} ${framework}: SSR hydration, authored markup, callbacks, controlled echo and clear veto`,async t=>{
    const page=await pageFor(t,engine,mode,`&ssr&framework=${framework}`)
    assert.equal(await host(page).locator('[style]').count(),0)
    await host(page).evaluate(el=>{window.originalHost=el;window.originalChildren=[...el.children]})
    await register(page,mode);await client(page,framework);await page.evaluate(()=>hydrateTime({}));await frames(page)
    assert.equal(await host(page).evaluate(el=>el===originalHost&&[...el.children].every((child,i)=>child===originalChildren[i])),true)
    assert.deepEqual(await page.evaluate(()=>recoveries),[])
    const labels=await host(page).evaluate(el=>{const group=el.shadowRoot.querySelector('[role=group]');return {label:group.ariaLabelledByElements?.map(el=>el.textContent),hint:group.ariaDescribedByElements?.map(el=>el.textContent)}})
    assert.deepEqual(labels,{label:['Start'],hint:['Helpful hint']})
    if(engine===chromium){const session=await page.context().newCDPSession(page),tree=await session.send('Accessibility.getFullAXTree');assert.ok(tree.nodes.some(node=>node.role?.value==='group'&&node.name?.value==='Start'&&node.description?.value==='Helpful hint'));await session.detach()}
    await host(page).locator('strong').evaluate(el=>el.textContent='Updated label');assert.deepEqual(await host(page).evaluate(el=>el.shadowRoot.querySelector('[role=group]').ariaLabelledByElements.map(el=>el.textContent)),['Updated label'])
    await page.evaluate(()=>{window.veto=true;window.events=[];for(const type of ['clearclick','input','change','clearinput'])originalHost.addEventListener(type,e=>events.push(e.type))})
    await host(page).locator('[slot=clear] a-button').click();assert.equal(await value(page),'09:30');assert.deepEqual(await page.evaluate(()=>events),['clearclick']);assert.equal(await page.evaluate(()=>cleared),0)
    await page.evaluate(()=>{window.veto=false;events=[]});await host(page).locator('[slot=clear] a-button').click();assert.equal(await value(page),'');assert.deepEqual((await page.evaluate(()=>events)).slice(0,4),['clearclick','input','change','clearinput'])
    await page.evaluate(()=>{window.echo=true;show({value:'',locale:'en-GB'})});await frames(page)
    await segment(page,'minute').fill('3');await segment(page,'hour').fill('1');assert.equal(await value(page),'01:03')
    await page.evaluate(()=>show({value:'14:20',name:'changed'}));await frames(page);assert.equal(await value(page),'14:20');assert.equal(await host(page).getAttribute('name'),'changed')
    await page.evaluate(()=>show({value:'14:20',name:undefined,readOnly:true}));await frames(page);assert.equal(await host(page).evaluate(el=>el.name),'');assert.equal(await segment(page,'hour').evaluate(el=>el.readOnly),true)
    await page.evaluate(()=>{window.echo=false;show({locale:'en-US'})});await frames(page)
    await segment(page,'hour').fill('14');await segment(page,'minute').fill('20')
    await page.evaluate(()=>{window.savedHour=originalHost.shadowRoot.querySelector('[part~=hour]');showBare()});await frames(page)
    const count=await page.evaluate(()=>reports.length);await segment(page,'minute').fill('22');assert.equal(await page.evaluate(()=>reports.length),count)
    await page.evaluate(()=>show({locale:'en-US'}));await frames(page);assert.equal(await value(page),'14:22')
    assert.equal(await segment(page,'hour').evaluate(el=>el===savedHour),true)
    await segment(page,'hour').fill('15');assert.equal((await page.evaluate(()=>reports)).at(-1)[1].value,'15:22')
  })
  test.fast(`${name}: nested clear requests stay with their nearest field and readonly blocks the action`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    await mount(page,'<a-input value="Outer"><a-input-time locale="en-GB" value="09:30"><a-button slot="clear" role="button" tabindex="0" data-custom-event="clearrequest">Clear</a-button></a-input-time></a-input>')
    await host(page).locator('a-button').click();assert.equal(await value(page),'');assert.equal(await page.locator('a-input').evaluate(el=>el.value),'Outer')
    await host(page).evaluate(el=>{el.value='10:00';el.setAttribute('readonly','')})
    await host(page).evaluate(el=>el.querySelector('a-button').dispatchEvent(new CustomEvent('clearrequest',{bubbles:true})));assert.equal(await value(page),'10:00')
    await host(page).evaluate(el=>{el.removeAttribute('readonly');el.setAttribute('disabled','')})
    await host(page).evaluate(el=>el.querySelector('a-button').dispatchEvent(new CustomEvent('clearrequest',{bubbles:true})));assert.equal(await value(page),'10:00')
  })
  test(`${name}: period editing, 24-hour digit conversion, selection and modified navigation`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,'<a-input-time locale="en-US"></a-input-time>')
    await segment(page,'hour').fill('18');await segment(page,'minute').fill('30');assert.equal(await value(page),'18:30');assert.equal(await segment(page,'hour').inputValue(),'06')
    await segment(page,'period').fill('a');assert.equal(await value(page),'06:30');await segment(page,'period').press('ArrowDown');assert.equal(await value(page),'18:30')
    await segment(page,'period').fill('');assert.equal(await value(page),'');assert.equal(await segment(page,'minute').inputValue(),'30')
    const result=await segment(page,'hour').evaluate(el=>{el.focus();el.setSelectionRange(1,1);const before=el.value;const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown','Home','End'];return keys.every(key=>{const event=new KeyboardEvent('keydown',{key,ctrlKey:true,bubbles:true,cancelable:true});el.dispatchEvent(event);return !event.defaultPrevented&&el.value===before&&el.selectionStart===1})});assert.equal(result,true)
    if(engine===chromium){await segment(page,'hour').focus();const session=await page.context().newCDPSession(page);const tree=await session.send('Accessibility.getFullAXTree');assert.ok(tree.nodes.some(node=>node.role?.value==='textbox'&&node.name?.value==='Hour'));await session.detach()}
  })
  test(`${name}: locale segment order, separators, periods, mode changes and stable native sizes`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    for(const locale of ['en-US','en-GB','fi-FI','ja-JP','zh-CN','ko-KR','ar-EG','es-MX'])for(const hour12 of [true,false]){
      await mount(page,`<a-input-time locale="${locale}" hour12="${hour12}" value="01:05"></a-input-time>`)
      const actual=await host(page).evaluate(el=>[...el.shadowRoot.querySelector('[part=segments]').children].map(child=>child.part.contains('segment')?child.part.contains('period')?'dayPeriod':child.part.contains('hour')?'hour':'minute':child.textContent))
      const expected=new Intl.DateTimeFormat(locale,{hour:'numeric',minute:'numeric',hour12}).formatToParts(new Date(2000,0,1,13,5)).filter(p=>p.type!=='literal'||p.value.trim()).map(p=>p.type==='literal'?p.value:p.type)
      assert.deepEqual(actual,expected,`${locale} ${hour12}`)
      if(hour12){const period=segment(page,'period');const width=await period.evaluate(el=>{const canvas=document.createElement('canvas'),context=canvas.getContext('2d');context.font=getComputedStyle(el).font; if(el.clientWidth<context.measureText(el.value).width)throw new Error('Locale period clipped');return el.getBoundingClientRect().width});await host(page).evaluate(el=>el.value='13:05');assert.equal(await period.evaluate(el=>el.getBoundingClientRect().width),width);assert.equal(await period.inputValue(),new Intl.DateTimeFormat(locale,{hour:'numeric',minute:'numeric',hour12:true}).formatToParts(new Date(2000,0,1,13,5)).find(p=>p.type==='dayPeriod').value)}
      await host(page).evaluate(el=>el.setAttribute('hour12',el.getAttribute('hour12')==='true'?'false':'true'));assert.equal(await value(page),hour12?'13:05':'01:05')
    }
  })
  test(`${name}: live ARIA precedence, removal and segment error references`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,'<strong id="external">External</strong><span id="error">Error</span><a-input-time locale="en-US" aria-labelledby="external" aria-errormessage="error" aria-invalid="true"><span slot="label">Slot</span><span slot="hint">Hint</span></a-input-time>')
    const result=await host(page).evaluate(el=>({host:el.hasAttribute('aria-labelledby'),label:el.shadowRoot.querySelector('[role=group]').ariaLabelledByElements?.[0]?.textContent,errors:[...el.shadowRoot.querySelectorAll('input')].map(input=>input.ariaErrorMessageElements?.[0]?.textContent)}))
    assert.deepEqual(result,{host:false,label:'External',errors:['Error','Error','Error']})
    await host(page).evaluate(el=>el.removeAttribute('aria-labelledby'));assert.equal(await host(page).evaluate(el=>el.shadowRoot.querySelector('[role=group]').ariaLabelledByElements[0].textContent),'Slot')
    await host(page).evaluate(el=>el.ariaLabel='Explicit');assert.deepEqual(await host(page).evaluate(el=>el.shadowRoot.querySelector('[role=group]').ariaLabelledByElements),[])
  })
  test(`${name}: consumer parts override defaults and native sizing across states`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,'<a-input-time class="override" locale="en-US"></a-input-time>')
    const computed=()=>host(page).evaluate(el=>{const field=getComputedStyle(el.shadowRoot.querySelector('[part=field]')),seg=getComputedStyle(el.shadowRoot.querySelector('input'));return [field.minHeight,field.borderRadius,field.outlineWidth,seg.width,seg.fontSize]})
    assert.deepEqual(await computed(),['45px','13px','3px','70px','19px']);await segment(page,'hour').focus();await segment(page,'hour').fill('9');assert.deepEqual(await computed(),['45px','13px','3px','70px','19px'])
    await host(page).evaluate(el=>{el.setAttribute('size','large');el.setAttribute('status','critical');el.setAttribute('hour12','false')});assert.deepEqual(await computed(),['45px','13px','3px','70px','19px'])
  })
  test(`${name}: reconnect/adoption retain incomplete inputs and release document coordination`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,'<a-input-time locale="en-GB"></a-input-time><iframe></iframe>')
    await segment(page,'hour').fill('1')
    const result=await host(page).evaluate(el=>{const input=el.shadowRoot.querySelector('input'),key=Symbol.for('anta.input-focus-modality');el.remove();const released=document[key]===undefined;document.querySelector('#mount').append(el);const retained=el.shadowRoot.querySelector('input')===input&&input.value==='1';const target=document.querySelector('iframe').contentDocument;target.body.append(target.adoptNode(el));input.focus();input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));const stepped=input.value==='02';el.remove();return {released,retained,stepped,cleaned:target[key]===undefined,oldCleaned:document[key]===undefined}})
    assert.deepEqual(result,{released:true,retained:true,stepped:true,cleaned:true,oldCleaned:true})
  })
  test(`${name}: actions preserve padding, icon-only sizing, dimming, insets and reduced motion`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await client(page,'Preact');await page.evaluate(()=>showActions({dimActions:true}));await frames(page)
    const buttons=host(page).locator('[slot=trailing] a-button')
    const metrics=await buttons.evaluateAll(nodes=>nodes.map(el=>{const s=getComputedStyle(el);return {width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,padding:s.paddingInlineStart}}))
    assert.equal(metrics[0].width,metrics[0].height);assert.ok(metrics[1].width>metrics[1].height);assert.ok(parseFloat(metrics[0].padding)>0);assert.ok(parseFloat(metrics[1].padding)>0)
    assert.equal(await host(page).locator('[part=trailing]').evaluate(el=>getComputedStyle(el).paddingInlineEnd),'2px')
    await host(page).evaluate(el=>el.classList.add('inset'));assert.equal(await host(page).locator('[part=trailing]').evaluate(el=>getComputedStyle(el).paddingInlineEnd),'9px')
    await page.mouse.move(950,750);assert.equal(await host(page).locator('[part=trailing]').evaluate(el=>getComputedStyle(el).opacity),'0.6')
    await segment(page,'hour').focus();assert.equal(await host(page).locator('[part=trailing]').evaluate(el=>getComputedStyle(el).opacity),'1')
    assert.equal(await host(page).locator('[part=field]').evaluate(el=>getComputedStyle(el).transitionDuration),'0s')
  })
  test(`${name}: InputDate time composition commits on blur with Menu CSP isolated`,async t=>{
    const page=await pageFor(t,engine,mode,'',{menu:true});await register(page,mode);await client(page,'Preact');await page.evaluate(()=>showDate());await frames(page)
    await page.locator('a-input').locator('[part=input]').click();await frames(page)
    await segment(page,'hour').fill('11');await page.locator('a-input').locator('[part=input]').click();await frames(page)
    assert.equal(await page.locator('input[type=hidden]').inputValue(),'2026-10-15T11:30')
    assert.equal(await host(page).evaluate(el=>el.shadowRoot.querySelectorAll('style').length),0)
    const violations=await page.evaluate(()=>window.violations);assert.ok(violations.length>0,'Menu still injects its existing stylesheet');assert.ok(violations.every(v=>v.directive==='style-src-elem'))
  })
  test(`${name}: touch places the caret and edits native segments`,async t=>{
    const page=await pageFor(t,engine,mode,'',{hasTouch:true});await register(page,mode);await mount(page,'<a-input-time locale="en-GB" value="10:30"></a-input-time>')
    await segment(page,'minute').tap();assert.equal(await segment(page,'minute').evaluate(el=>el===el.getRootNode().activeElement),true)
    await segment(page,'minute').fill('45');assert.equal(await value(page),'10:45')
  })
  test(`${name}: independent full/granular imports keep live semantics in either order`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await register(page,mode==='bundle'?'granular':'bundle');await mount(page,'<a-input-time locale="en-GB"><span slot="label">Mixed</span><span slot="hint">Live</span></a-input-time>')
    assert.equal(await host(page).evaluate(el=>el.shadowRoot.querySelector('[role=group]').ariaLabelledByElements[0].textContent),'Mixed')
    await segment(page,'hour').fill('12');await segment(page,'minute').fill('30');assert.equal(await value(page),'12:30')
  })
  test(`${name}: registered visual variants retain geometry, typography and appearance`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    const variants=['','size="small"','size="large"','round','disabled','status="critical"','class="dark"','class="rtl"','locale="ja-JP" hour12="true"','locale="fi-FI"','locale="ko-KR" hour12="true"']
    const markup=variants.map((attr,i)=>`<a-input-time id="v${i}" ${attr} ${attr.includes('locale=')?'':'locale="en-US"'} value="13:05"><span slot="label">Start</span><a-icon slot="leading" shape="clock"></a-icon><span slot="hint">Hint</span></a-input-time>`).join('')
    await mount(page,markup)
    const metrics=page=>page.locator('a-input-time').evaluateAll(nodes=>nodes.map(el=>{const field=el.shadowRoot.querySelector('[part=field]'),row=el.shadowRoot.querySelector('[part=segments]'),style=getComputedStyle(row),f=getComputedStyle(field);return {width:field.getBoundingClientRect().width,height:field.getBoundingClientRect().height,font:style.font,color:style.color,background:f.backgroundColor,radius:f.borderRadius}}))
    const current=await metrics(page)
    if(process.env.ANTA_INPUT_TIME_COMPARE_ORIGINAL==='1'&&!consumer){const original=await browsers.get(engine).newPage();try{await original.goto(`${origin}/?mode=original`);await register(original,'original');await mount(original,markup);assert.deepEqual(current,await metrics(original))}finally{await original.close()}}
    await mkdir('tests/.test-output/input-time',{recursive:true})
    // WebKit screenshot synchronization injects CSS; use a separate capture page.
    let capture=page
    if(engine===webkit){capture=await browsers.get(engine).newPage({viewport:{width:1000,height:800},reducedMotion:'reduce'});await capture.route('**/*',async route=>{const response=await route.fetch(),headers=response.headers();delete headers['content-security-policy'];await route.fulfill({response,headers})});await capture.goto(`${origin}/?mode=${mode}`);await register(capture,mode);await mount(capture,markup)}
    await capture.screenshot({path:`tests/.test-output/input-time/${engine.name()}-${mode}.png`,fullPage:true});if(capture!==page)await capture.close()
  })
}
