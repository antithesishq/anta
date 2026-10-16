import assert from 'node:assert/strict'
import { before, after } from 'node:test'
import { componentTest as test, componentEngines } from './component-tier.mjs'
import { createServer } from 'node:http'
import { createRequire, Module } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const requirePlot = createRequire(new URL('../plot/package.json', import.meta.url))
const requireRenderer = createRequire(requireSite.resolve('@astrojs/preact'))
const { chromium, firefox, webkit } = requireSite('playwright')
const engines = componentEngines([chromium, firefox, webkit])
const consumerRoot = process.env.ANTA_TOASTER_CONSUMER_ROOT ? resolve(process.env.ANTA_TOASTER_CONSUMER_ROOT) : undefined
const source = process.env.ANTA_TOASTER_PACKAGE_ROOT ? resolve(process.env.ANTA_TOASTER_PACKAGE_ROOT, 'dist') : resolve('src')
const resolveDir = consumerRoot ?? process.cwd()
const nodePaths = consumerRoot ? [resolve(consumerRoot, 'node_modules')] : [resolve('node_modules'), resolve('site/node_modules')]
const base = consumerRoot ? '@antadesign/anta' : source
const jsxAlias = consumerRoot ? {} : { '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime') }
const preactCompat = consumerRoot ? 'preact/compat' : requireSite.resolve('preact/compat')
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'"
const browsers = new Map(), assets = new Map(), renderers = new Map()
const imports = `import {Toaster, createToaster, Banner, Card, Button, Input, configure} from '${consumerRoot ? base : source+'/index'}'`
const factory = `
  let store = createToaster(); const e = React.createElement;
  const app = (useDefault=false) => e(React.Fragment, {},
    e(Toaster, {id:'toaster', ...(useDefault?{}:{toaster:store})}),
    e('a-toast', {id:'ssr-toast',duration:'Infinity'}, e('a', {id:'ssr-link',href:'#details'}, 'Authored content')));
`
let server, origin
async function compile(options) {
  const result = await build({absWorkingDir:resolveDir,bundle:true,write:false,metafile:true,nodePaths,target:'es2022',...options})
  if (consumerRoot) {
    const inputs = Object.keys(result.metafile.inputs).map(path => resolve(resolveDir,path))
    assert.ok(inputs.some(path=>path.startsWith(resolve(consumerRoot,'node_modules/@antadesign/anta/dist')+'/')))
    assert.ok(!inputs.some(path=>path.startsWith(resolve('src')+'/')), 'Installed consumer has no source aliases')
  }
  return result
}
const save = (name,result) => {
  for (const file of result.outputFiles) assets.set(`/${name}.${file.path.endsWith('.css')?'css':'js'}`,file.text)
}
before(async () => {
  for (const mode of ['granular','bundle']) {
    const contents = mode==='bundle'
      ? `import '${base}/bundle'; ${consumerRoot || process.env.ANTA_TOASTER_PACKAGE_ROOT ? `import '${base}/bundle.css';` : ''}`
      : `import '${base}/tokens.css';import '${base}/reset.css';${['a-toaster','a-toast','a-banner','a-card','a-button','a-icon','a-input','a-title','a-text','a-tooltip'].map(entry=>`import '${base}/elements/${entry}';`).join('')}`
    save(mode, await compile({stdin:{contents,resolveDir},outfile:`${mode}.js`,format:'esm',alias:{react:preactCompat}}))
  }
  for (const entry of ['granular','bundle']) {
    save(`${entry}-api`,await compile({stdin:{contents:`export {createToaster,Toaster,configure} from '${entry==='bundle'?base+'/bundle':consumerRoot?base:source+'/index'}';${entry==='bundle'&&(consumerRoot||process.env.ANTA_TOASTER_PACKAGE_ROOT)?`import '${base}/bundle.css';`:''}`,resolveDir},outfile:`${entry}-api.js`,format:'esm',alias:{...jsxAlias,react:preactCompat}}))
  }
  if (process.env.ANTA_TOASTER_COMPARE_ORIGINAL === '1' && !consumerRoot && !process.env.ANTA_TOASTER_PACKAGE_ROOT) {
    const result = await build({stdin:{contents:`import './src/tokens.css';import './src/reset.css';${['a-toaster','a-toast','a-banner','a-card','a-button','a-icon','a-input','a-title','a-text','a-tooltip'].map(entry=>`import './src/elements/${entry}';`).join('')}`,resolveDir:process.cwd()},
      bundle:true,write:false,outfile:'original.js',format:'esm',target:'es2022',alias:{react:preactCompat},plugins:[{name:'original-toaster',setup(api){
        api.onLoad({filter:/[/\\]a-(toast|toaster)\.(ts|css)$/},args=>({contents:execFileSync('git',['show',`2d2ba6e6:${args.path.slice(process.cwd().length+1)}`],{encoding:'utf8'}),loader:args.path.endsWith('.css')?'css':'ts'}))
      }}]})
    save('original',result)
  }
  for (const framework of ['React','Preact']) {
    const react=framework==='React'
    const alias={...jsxAlias,...(react?consumerRoot?{}:{react:resolve('node_modules/react')}:{react:preactCompat})}
    const result=await compile({stdin:{contents:`import React from 'react';${imports};${factory};
      ${react?"import {renderToString} from 'react-dom/server'":"import renderToString from 'preact-render-to-string'"};
      export const render=()=>renderToString(app());`,resolveDir},platform:'node',format:'cjs',jsx:'automatic',jsxImportSource:'@antadesign/anta',
      alias:{...alias,...(consumerRoot?{}:react?{'react-dom/server':requirePlot.resolve('react-dom/server')}:{'preact-render-to-string':requireRenderer.resolve('preact-render-to-string')})}})
    const compiled=new Module(resolve(`tests/toaster-${framework}-server.cjs`));compiled._compile(result.outputFiles[0].text,compiled.id);renderers.set(framework,compiled.exports.render)
    save(framework,await compile({stdin:{contents:`import React from 'react';${imports};${factory};
      ${react?"import {createRoot,hydrateRoot} from 'react-dom/client'":"import {render,hydrate} from 'preact'"};
      let root;window.recoverableErrors=[];window.store=store;window.manager=Toaster.manager;window.clicks=0;window.subscriptionCount=0;
      for(const manager of [store,Toaster.manager]){const subscribe=manager.subscribe;manager.subscribe=callback=>{window.subscriptionCount++;const unsubscribe=subscribe(callback);return()=>{window.subscriptionCount--;unsubscribe()}}};
      window.mount=(hydration=false,useDefault=false)=>{
        configure(React.createElement,React.Fragment,React,{hydratingEvents:hydration});
        ${react?"if(hydration)root=hydrateRoot(document.querySelector('#mount'),app(useDefault),{onRecoverableError:e=>window.recoverableErrors.push(e.message)});else{root??=createRoot(document.querySelector('#mount'));root.render(app(useDefault))}":"(hydration?hydrate:render)(app(useDefault),document.querySelector('#mount'))"}
      };
      window.mountWithStore=external=>{store=external;window.store=store;window.mount()};
      window.unmount=()=>{${react?"root.unmount();root=undefined":"render(null,document.querySelector('#mount'))"}};
      window.add=(kind='text',opts={},useDefault=false)=>{
        const manager=useDefault?Toaster.manager:store;
        const render=id=>kind==='text'?'Saved':kind==='banner'?e(Banner,{message:'Saved',round:true,dismissed:false,onDismiss:()=>manager.dismiss(id)}):
          kind==='card'?e(Card,{header:'Ready'},e('a',{href:'#details'},'Details'),e(Button,{label:'Dismiss','data-toast-dismiss':''})):
          kind==='interactive'?e(Card,{header:'Edit'},e(Input,{label:'Name',defaultValue:'Keep me'}),e(Button,{label:'Keep',onClick:()=>window.clicks++}),e(Button,{label:'Dismiss','data-toast-dismiss':''})):
          kind==='lookalike'?{...e('strong',{},'JSX lookalike'),nodeType:1,cloneNode(){}}:kind==='node'?window.contentNode:kind==='nested'?e('a-toast',{id:'nested',duration:'Infinity'},e(Button,{label:'Nested dismiss','data-toast-dismiss':''})):e('strong',{},kind);
        return manager.add(render,opts);
      };
      window.update=(id,kind)=>store.update(id,()=>kind==='node'?window.contentNode:e('strong',{},kind));
      window.projectEvents=()=>{
        configure(React.createElement,React.Fragment,{useMemo:f=>f(),useSyncExternalStore:(_s,get)=>get(),useState:()=>{throw Error('Unexpected event hook')},useLayoutEffect:()=>{throw Error('Unexpected event hook')}});
        try { const tree=Toaster({toaster:store});const item=tree.props.children[0];const toast=item.type(item.props);return typeof toast.props.ondismiss }
        finally {configure(React.createElement,React.Fragment,React)}
      };`,resolveDir},outfile:`${framework}.js`,format:'esm',jsx:'automatic',jsxImportSource:'@antadesign/anta',define:{'process.env.NODE_ENV':'"production"'},
      alias:{...alias,...(react&&!consumerRoot?{'react-dom/client':requirePlot.resolve('react-dom/client')}:{})}}))
  }
  assets.set('/consumer-countdown.css','@keyframes toast-remaining {from{--toast-remaining:0.4}to{--toast-remaining:0.4}}');
  assets.set('/boot.js',`window.violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push(e.effectiveDirective));`)
  assets.set('/fixture.css',`body{margin:0;font-family:system-ui}.later{inset:0;margin:0;padding:0;border:0;width:100vw;height:100vh;background:wheat}.surface{height:70px;padding:10px;background:lightblue}#under{position:fixed;left:50%;top:50%}.clipped{transform:translate(20px,20px);overflow:hidden;width:100px;height:100px}.override{--toaster-width:310px;--toaster-gap:19px;--toaster-inset:23px}.override::part(zone){border-radius:7px}.override-toast{--toast-dur:80ms}.motion-toast{--toast-dur:1s}.override-toast::part(content){padding:3px}.dark{color-scheme:dark;background:#111}.progress{height:3px;transform:scaleX(var(--toast-remaining));transform-origin:left;background:blue}`)
  server=createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost'),mode=url.searchParams.get('mode')??'granular'
    const original=mode==='original'
    const screenshot=url.searchParams.has('capture')
    res.setHeader('Content-Security-Policy', original||screenshot?policy.replace("style-src 'self'","style-src 'self' 'unsafe-inline'"):policy)
    res.setHeader('Content-Type',`${url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html'}; charset=utf-8`)
    res.end(assets.get(url.pathname)??`<!doctype html><link rel="stylesheet" href="/${mode}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><button id="under">Underlying action</button><main id="mount">${url.searchParams.has('ssr')?renderers.get(url.searchParams.get('framework')??'React')():''}</main><a href="#after" id="after">After</a>`)
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`
  for(const engine of engines){
    const options=process.env.ANTA_TOASTER_CHROMIUM_EXECUTABLE?{executablePath:process.env.ANTA_TOASTER_CHROMIUM_EXECUTABLE}:{channel:process.env.CAPTURE_TEST_BROWSER_CHANNEL||undefined}
    const browser=await engine.launch({headless:true,...(engine===chromium?options:{})});browsers.set(engine,browser);console.log(`${engine.name()}: ${browser.version()}`)
  }
})
after(async()=>{await Promise.all([...browsers.values()].map(b=>b.close()));if(server)await new Promise(r=>server.close(r))})
async function pageFor(t,engine,mode='granular',query='',options={}){
  const page=await browsers.get(engine).newPage({viewport:{width:1280,height:900},reducedMotion:'reduce',...options});page.setDefaultTimeout(8000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const response=await page.goto(`${origin}/?mode=${mode}${query}`);assert.equal(response.headers()['content-security-policy'],policy)
  t.after(async()=>{try{assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.violations),[])}finally{await page.close()}})
  return page
}
const register=(page,mode='granular')=>page.evaluate(mode=>import(`/${mode}.js`),mode)
const placements=['top-left','top-center','top-right','bottom-left','bottom-center','bottom-right']
async function raw(page,{duration='Infinity',placement='bottom-right',count=1,content='<div class="surface">Saved <a-button role="button" tabindex="0" data-toast-dismiss><a-button-label>Dismiss</a-button-label></a-button><a href="#details">Details</a></div>',attributes=''}={}){
  await page.locator('#mount').evaluate((mount,{duration,placement,count,content,attributes})=>{
    mount.innerHTML=`<a-toaster id="toaster" role="region" aria-label="Notifications">${Array.from({length:count},(_,i)=>`<a-toast id="toast-${i}" slot="${placement}" duration="${duration}" ${attributes}>${content}</a-toast>`).join('')}</a-toaster>`
    mount.addEventListener('dismiss',e=>{if(e.target.localName==='a-toast')e.target.remove()})
  },{duration,placement,count,content,attributes})
}
const progress=page=>page.locator('a-toast').first().evaluate(toast=>Number(getComputedStyle(toast.firstElementChild).getPropertyValue('--toast-remaining')))

for(const engine of engines) for(const mode of ['granular','bundle']){
  const prefix=`${engine.name()} ${mode}`
  test.fast(`${prefix}: external countdown resolves, pauses, restarts, and becomes sticky under CSP`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await raw(page,{duration:'1500'})
    await page.waitForTimeout(180);const started=await progress(page);assert.ok(started<0.99&&started>0.5,`progress ${started}`)
    await page.locator('a-toast').evaluate(t=>t.dispatchEvent(new PointerEvent('pointerenter')))
    const paused=await progress(page);await page.waitForTimeout(180);assert.ok(Math.abs(await progress(page)-paused)<0.02)
    await page.locator('a-toast').evaluate(t=>t.restart());assert.ok(await progress(page)>0.98)
    await page.waitForTimeout(140);assert.ok(await progress(page)>0.98)
    await page.locator('a-toast').evaluate(t=>t.dispatchEvent(new PointerEvent('pointerleave')));await page.waitForTimeout(120);assert.ok(await progress(page)<0.99)
    await page.locator('a-toast').evaluate(t=>{t.setAttribute('duration','Infinity');t.restart()});assert.equal(await progress(page),1)
    assert.equal(await page.locator('a-toast').evaluate(t=>t.shadowRoot.querySelector('slot').getAnimations().length),0)
  })
  test.fast(`${prefix}: one countdown survives hidden insertion, consumer keyframes, and repeated restarts`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    await page.evaluate(()=>{document.querySelector('#mount').hidden=true;const css=document.createElement('link');css.rel='stylesheet';css.href='/consumer-countdown.css';document.head.append(css)})
    await page.waitForFunction(()=>[...document.styleSheets].some(s=>s.href?.endsWith('/consumer-countdown.css')))
    await raw(page,{duration:'1800'});await page.waitForTimeout(100)
    await page.locator('#mount').evaluate(m=>m.hidden=false);await page.waitForTimeout(60)
    assert.equal(await page.locator('a-toast').evaluate(t=>t.shadowRoot.querySelector('slot').getAnimations().length),1)
    const value=await progress(page);assert.ok(value>0.65&&value<1,`progress ${value}`)
    const counts=await page.locator('a-toast').evaluate(t=>{
      const slot=t.shadowRoot.querySelector('slot'),styles=window.getComputedStyle,animations=Element.prototype.getAnimations;let reads=0,scans=0
      window.getComputedStyle=(el,...args)=>{if(el===slot)reads++;return styles.call(window,el,...args)}
      Element.prototype.getAnimations=function(...args){if(this===slot)scans++;return animations.apply(this,args)}
      try {t.restart();t.restart();t.restart();return {reads,scans}}
      finally {window.getComputedStyle=styles;Element.prototype.getAnimations=animations}
    });assert.deepEqual(counts,{reads:0,scans:0})
  })
  test.fast(`${prefix}: countdown remains independent of ElementInternals`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    await page.evaluate(()=>{HTMLElement.prototype.attachInternals=undefined})
    await raw(page,{duration:'1400',content:'<span>Countdown</span>'});await page.waitForTimeout(120)
    assert.ok(await progress(page)<0.99);assert.equal(await page.locator('a-toast').evaluate(t=>t.shadowRoot.querySelector('slot').getAnimations().length),1)
  })
  test.fast(`${prefix}: trusted Tab keeps an exhausted timer paused between descendants`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    await raw(page,{duration:'10000',content:'<button id="first">First</button><button id="second">Second</button>'})
    await page.evaluate(()=>{const now=Date.now;Date.now=()=>now()+20000;try{document.querySelector('#first').focus()}finally{Date.now=now}})
    await page.keyboard.press('Tab');assert.equal(await page.locator('#second').evaluate(el=>el===document.activeElement),true)
    assert.equal(await page.locator('a-toast').evaluate(t=>t.matches(':state(leaving)')),false)
    await page.locator('#after').focus();await page.waitForFunction(()=>!document.querySelector('a-toast'))
  })
  test.fast(`${prefix}: named slots retain placement, stacking, viewport width, and pointer pass-through`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    for(const placement of placements){
      await raw(page,{placement,count:2});await page.waitForTimeout(30)
      const layout=await page.locator('#toaster').evaluate(t=>{
        const region=t.shadowRoot.querySelector('[part="region"]'),zone=region.querySelector(`[name="${t.firstElementChild.slot}"]`)
        const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}}
        return {region:rect(region),zone:rect(zone),toasts:[...t.children].map(rect),open:region.matches(':popover-open'),slotCount:region.children.length,styles:t.shadowRoot.querySelectorAll('style').length}
      })
      assert.equal(layout.styles,0);assert.equal(layout.slotCount,6);assert.equal(layout.open,true)
      assert.equal(layout.region.width,1280);assert.equal(layout.region.height,900);assert.equal(layout.zone.width,380)
      if(placement.endsWith('left'))assert.equal(layout.zone.x,16)
      if(placement.endsWith('right'))assert.equal(layout.zone.right,1264)
      if(placement.endsWith('center'))assert.equal(layout.zone.x,450)
      if(placement.startsWith('top')){assert.equal(layout.toasts[1].y,16);assert.ok(layout.toasts[0].y>layout.toasts[1].y)}
      else {assert.equal(layout.toasts[1].bottom,884);assert.ok(layout.toasts[0].y<layout.toasts[1].y)}
    }
    await page.locator('#under').evaluate(el=>el.addEventListener('click',()=>window.underClicks=(window.underClicks??0)+1))
    await page.locator('#under').click();assert.equal(await page.evaluate(()=>window.underClicks),1)
    await page.setViewportSize({width:320,height:600});await page.waitForTimeout(30)
    assert.equal(await page.locator('a-toast').first().evaluate(t=>t.getBoundingClientRect().width),288)
    await page.locator('a-toast').first().locator('a-button').click();await page.waitForFunction(()=>document.querySelectorAll('a-toast').length===1)
    await page.locator('a-toast').locator('a-button').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('a-toast'))
    assert.equal(await page.locator('#toaster').evaluate(t=>t.shadowRoot.querySelector('[popover]').matches(':popover-open')),false)
  })
  test(`${prefix}: top layer escapes clipping and preserves ordering after a later popover`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await raw(page)
    await page.locator('#mount').evaluate(m=>m.className='clipped')
    const toast=await page.locator('a-toast').boundingBox();assert.equal(toast.x,884);assert.equal(toast.y,814)
    await page.locator('a-toast a-button').click();await page.waitForFunction(()=>!document.querySelector('a-toast'))
    await raw(page);await page.evaluate(()=>{const pop=document.createElement('div');pop.id='later';pop.className='later';pop.popover='manual';pop.innerHTML='<button>Later layer</button>';document.body.append(pop);pop.showPopover()})
    assert.equal(await page.locator('#later').evaluate(el=>el.matches(':popover-open')),true)
    assert.equal(await page.locator('#toaster').evaluate(el=>el.shadowRoot.querySelector('[popover]').matches(':popover-open')),true)
    assert.equal(await page.evaluate(()=>document.elementFromPoint(1000,850).id),'later')
    await page.locator('#later button').click()
  })
  test(`${prefix}: hover and focus holds combine, descendant focus transfers keep time paused`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await raw(page,{duration:'900'})
    await page.locator('a-toast a-button').hover();await page.locator('a-toast a-button').focus()
    const value=await progress(page);await page.mouse.move(1,1);await page.waitForTimeout(180)
    assert.ok(Math.abs(await progress(page)-value)<0.03)
    await page.locator('a-toast a').focus();await page.waitForTimeout(200);assert.ok(Math.abs(await progress(page)-value)<0.03)
    await page.locator('#after').focus();await page.waitForTimeout(120);assert.ok(await progress(page)<value-0.05)
    await page.waitForFunction(()=>!document.querySelector('a-toast'))
  })
  test.fast(`${prefix}: exit reconnects, paused removal releases holds, and revival cancels dismissal`,async t=>{
    const page=await pageFor(t,engine,mode,'',{reducedMotion:'no-preference'});await register(page,mode);await raw(page,{duration:'10000',attributes:'class="override-toast"'})
    await page.waitForTimeout(100)
    const remaining=await page.locator('a-toast').evaluate(t=>{window.savedToast=t;t.shadowRoot.querySelector('slot').getAnimations()[0].currentTime=4000;t.dismiss();const remaining=Number(getComputedStyle(t.firstElementChild).getPropertyValue('--toast-remaining'));t.remove();return remaining})
    await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>savedToast.isConnected),false)
    const restored=await page.locator('#toaster').evaluate(async t=>{t.append(window.savedToast);await new Promise(requestAnimationFrame);return Number(getComputedStyle(savedToast.firstElementChild).getPropertyValue('--toast-remaining'))})
    assert.ok(remaining>0.5&&remaining<0.7);assert.ok(Math.abs(restored-remaining)<0.01,`Countdown changed from ${remaining} to ${restored} on reconnect`)
    await page.waitForFunction(()=>!document.querySelector('a-toast'))
    await raw(page,{duration:'450'});await page.locator('a-toast').evaluate(t=>{t.dispatchEvent(new PointerEvent('pointerenter'));window.savedToast=t;t.remove()})
    await page.locator('#toaster').evaluate(t=>t.append(window.savedToast));await page.waitForFunction(()=>!document.querySelector('a-toast'))
    await raw(page,{attributes:'class="override-toast"'})
    await page.locator('a-toast').evaluate(t=>{t.setAttribute('leaving','');t.removeAttribute('leaving');t.setAttribute('rev','1')})
    await page.waitForTimeout(120);assert.equal(await page.locator('a-toast').count(),1);assert.equal(await page.locator('a-toast').evaluate(t=>t.matches(':state(leaving)')),false)
  })
  test.fast(`${prefix}: completed exits notify each new connected owner once`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await raw(page)
    await page.locator('a-toast').evaluate(toast=>{window.savedToast=toast;window.dismissals=0;toast.addEventListener('dismiss',()=>window.dismissals++);toast.dismiss();toast.dismiss()})
    await page.waitForFunction(()=>dismissals===1&&!savedToast.isConnected)
    await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>dismissals),1)
    await page.locator('#toaster').evaluate(region=>{region.append(savedToast);savedToast.dismiss();savedToast.dismiss()})
    await page.waitForFunction(()=>dismissals===2&&!savedToast.isConnected)
    await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>dismissals),2)
  })
  test(`${prefix}: timers and listeners are released on disconnection and document adoption`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await raw(page,{duration:'300'})
    await page.evaluate(()=>{
      window.liveTimers=new Set();const set=window.setTimeout,clear=window.clearTimeout;
      window.setTimeout=(fn,ms,...args)=>{let id;id=set(()=>{liveTimers.delete(id);fn(...args)},ms);liveTimers.add(id);return id};
      window.clearTimeout=id=>{liveTimers.delete(id);return clear(id)};
      const toast=document.querySelector('a-toast');toast.restart();window.savedToast=toast;toast.remove();
    })
    assert.equal(await page.evaluate(()=>liveTimers.size),0)
    await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>savedToast.matches(':state(leaving)')),false)
    await page.evaluate(()=>{const iframe=document.createElement('iframe');iframe.src='/';document.body.append(iframe);window.frame=iframe})
    await page.waitForFunction(()=>frame.contentDocument?.querySelector('#mount'))
    await page.evaluate(()=>frame.contentDocument.querySelector('#mount').append(savedToast))
    await page.waitForFunction(()=>savedToast.matches(':state(leaving)'))
    await page.evaluate(()=>{savedToast.setAttribute('leaving','');savedToast.removeAttribute('leaving');savedToast.setAttribute('duration','Infinity');savedToast.restart()})
    await page.evaluate(()=>{savedToast.innerHTML='<button data-toast-dismiss>Adopted dismiss</button>';savedToast.firstElementChild.click()})
    await page.waitForFunction(()=>savedToast.matches(':state(leaving)'))
    assert.equal(await page.evaluate(()=>liveTimers.size),0)
    assert.deepEqual(await page.evaluate(()=>frame.contentWindow.violations),[])
  })
  test(`${prefix}: owned content preserves identity, fragments, replacement, and authored siblings`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await raw(page,{content:'<span id="authored">Authored</span>'})
    const result=await page.locator('a-toast').evaluate(toast=>{
      const attributes=toast.outerHTML,node=document.createElement('button');let clicks=0;node.addEventListener('click',()=>clicks++);node.textContent='Widget';
      toast.content=node;node.click();const first=toast.lastChild===node;toast.content=node;const same=toast.lastChild===node;
      const fragment=document.createDocumentFragment(),one=document.createElement('span'),two=document.createElement('span');fragment.append(one,two);toast.content=fragment;
      const fragmentIdentity=toast.contains(one)&&toast.contains(two);const replacement=document.createElement('em');fragment.append(replacement);toast.content=fragment;const refilled=toast.contains(replacement)&&!toast.contains(one)&&!toast.contains(two);toast.content='';const cleared=toast.content===null&&!toast.contains(replacement);
      return {first,same,clicks,fragmentIdentity,refilled,cleared,removed:!toast.contains(one)&&!toast.contains(two)&&!toast.contains(node),unchanged:toast.outerHTML===attributes}
    });assert.deepEqual(result,{first:true,same:true,clicks:1,fragmentIdentity:true,refilled:true,cleared:true,removed:true,unchanged:true})
  })
  test(`${prefix}: nested toast dismissal does not remove or dismiss the outer toast`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await page.evaluate(()=>import('/React.js'));await page.evaluate(()=>mount());await page.waitForSelector('#toaster',{state:'attached'})
    await page.evaluate(()=>add('nested',{duration:Infinity}));await page.waitForSelector('#nested');await page.locator('#nested a-button').click();await page.waitForFunction(()=>document.querySelector('#nested').matches(':state(leaving)'))
    assert.equal(await page.locator('#toaster > a-toast').count(),1);assert.equal(await page.locator('#toaster > a-toast').evaluate(t=>t.matches(':state(leaving)')),false)
    assert.equal(await page.evaluate(()=>store.getSnapshot().length),1)
  })
  test(`${prefix}: consumer overrides retain runtime duration, placement sizing, and reduced motion`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await raw(page,{duration:'1200',attributes:'class="override-toast"'})
    await page.locator('#toaster').evaluate(t=>t.className='override')
    assert.equal(await page.locator('a-toast').evaluate(t=>t.getBoundingClientRect().width),310)
    assert.equal(await page.locator('a-toast').evaluate(t=>t.shadowRoot.querySelector('slot').getAnimations()[0].effect.getTiming().duration),1200)
    assert.equal(await page.locator('a-toast').evaluate(t=>getComputedStyle(t).transitionDuration),'0s')
    await page.waitForTimeout(120);assert.ok(await progress(page)<0.99)
    const start=Date.now();await page.locator('a-toast a-button').click();await page.waitForFunction(()=>!document.querySelector('a-toast'));assert.ok(Date.now()-start<700)
  })
  test(`${prefix}: entry and exit animations retain duration and intermediate opacity`,async t=>{
    const page=await pageFor(t,engine,mode,'',{reducedMotion:'no-preference'});await register(page,mode);await raw(page,{attributes:'class="motion-toast"'})
    const entry=await page.locator('a-toast').evaluate(async t=>{
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const transitions=t.getAnimations().filter(a=>a.transitionProperty==='opacity');
      for(const a of transitions){a.pause();a.currentTime=500}
      return {count:transitions.length,opacity:Number(getComputedStyle(t).opacity),duration:getComputedStyle(t).transitionDuration}
    });assert.equal(entry.count,1);assert.ok(entry.opacity>0&&entry.opacity<1);assert.equal(entry.duration,'1s, 1s')
    await page.locator('a-toast').evaluate(t=>{for(const a of t.getAnimations())a.finish()});await page.waitForTimeout(30)
    const exit=await page.locator('a-toast').evaluate(t=>{
      getComputedStyle(t).opacity;t.dismiss();const transitions=t.getAnimations().filter(a=>a.transitionProperty==='opacity');for(const a of transitions){a.pause();a.currentTime=500}
      return {count:transitions.length,opacity:Number(getComputedStyle(t).opacity)}
    });assert.equal(exit.count,1);assert.ok(exit.opacity>0&&exit.opacity<1)
    await page.waitForFunction(()=>!document.querySelector('a-toast'))
  })
  for(const framework of ['React','Preact']){
    test.fast(`${prefix} ${framework}: SSR hydration preserves nodes and store updates, dismissal, and default manager work`,async t=>{
      const page=await pageFor(t,engine,mode,`&ssr&framework=${framework}`)
      assert.equal(await page.locator('#toaster').textContent(),'');assert.equal(await page.locator('#ssr-link').textContent(),'Authored content')
      await page.evaluate(()=>{window.ssrToaster=document.querySelector('#toaster');window.ssrLink=document.querySelector('#ssr-link')})
      await register(page,mode);await page.evaluate(framework=>import(`/${framework}.js`),framework);await page.evaluate(()=>mount(true))
      await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>ssrToaster===document.querySelector('#toaster')&&ssrLink===document.querySelector('#ssr-link')),true)
      assert.deepEqual(await page.evaluate(()=>recoverableErrors),[])
      await page.evaluate(()=>add('text',{id:'update',duration:Infinity}));await page.waitForSelector('#toaster a-banner')
      await page.evaluate(()=>{window.toastIdentity=document.querySelector('#toaster a-toast');add('card',{id:'update'})});await page.waitForSelector('#toaster a-card')
      assert.equal(await page.evaluate(()=>toastIdentity===document.querySelector('#toaster a-toast')),true)
      await page.locator('#toaster a-button').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>!document.querySelector('#toaster a-toast'))
      await page.evaluate(()=>{unmount();mount(false,true)});await page.waitForSelector('#toaster',{state:'attached'})
      await page.evaluate(()=>add('banner',{duration:Infinity},true));await page.waitForSelector('#toaster a-banner')
      await page.locator('#toaster a-banner-close a-button').click();await page.waitForFunction(()=>!document.querySelector('#toaster a-toast'))
      await page.evaluate(()=>unmount());assert.equal(await page.evaluate(()=>subscriptionCount),0);await page.evaluate(()=>store.add(()=> 'Unmounted',{duration:Infinity}));assert.equal(await page.locator('#toaster').count(),0)
    })
    test(`${prefix} ${framework}: node-to-JSX updates preserve widget behavior and authored attributes`,async t=>{
      const page=await pageFor(t,engine,mode);await register(page,mode);await page.evaluate(framework=>import(`/${framework}.js`),framework);await page.evaluate(()=>mount());await page.waitForSelector('#toaster',{state:'attached'})
      await page.evaluate(()=>{const frame=document.createElement('iframe');document.body.append(frame);const node=frame.contentDocument.createElement('button');node.textContent='Widget';node.addEventListener('click',()=>window.clicks++);window.contentNode=node;add('node',{id:'widget',duration:Infinity})})
      await page.waitForSelector('#toaster button');await page.locator('#toaster button').click();assert.equal(await page.evaluate(()=>clicks),1)
      assert.equal(await page.evaluate(()=>document.querySelector('#toaster a-toast').firstChild===contentNode),true)
      await page.evaluate(()=>update('widget','Updated JSX'));await page.waitForSelector('#toaster strong');assert.equal(await page.locator('#toaster button').count(),0);assert.equal(await page.locator('#toaster a-toast').evaluate(t=>t.content),null)
      await page.evaluate(()=>update('widget','node'));await page.waitForSelector('#toaster button');assert.equal(await page.evaluate(()=>document.querySelector('#toaster button')===contentNode),true)
      await page.locator('#toaster button').click();assert.equal(await page.evaluate(()=>clicks),2)
      await page.evaluate(()=>store.clear());await page.waitForFunction(()=>!document.querySelector('#toaster a-toast'));await page.evaluate(()=>add('lookalike',{duration:Infinity}));await page.waitForSelector('#toaster strong');assert.equal(await page.locator('#toaster strong').textContent(),'JSX lookalike')
    })
    test(`${prefix} ${framework}: interactive Card content retains focus and values across store updates`,async t=>{
      const page=await pageFor(t,engine,mode);await register(page,mode);await page.evaluate(framework=>import(`/${framework}.js`),framework);await page.evaluate(()=>mount());await page.waitForSelector('#toaster',{state:'attached'})
      await page.evaluate(()=>add('interactive',{id:'edit',duration:1000}));await page.waitForSelector('#toaster a-input')
      await page.locator('#toaster input').fill('Edited');await page.waitForTimeout(1100);assert.equal(await page.locator('#toaster a-toast').count(),1)
      await page.evaluate(()=>add('interactive',{id:'edit'}));assert.equal(await page.locator('#toaster input').inputValue(),'Edited')
      await page.locator('#toaster a-button').filter({hasText:'Keep'}).click();assert.equal(await page.evaluate(()=>clicks),1)
      await page.locator('#toaster a-button').filter({hasText:'Dismiss'}).click();await page.waitForFunction(()=>!document.querySelector('#toaster a-toast'))
    })
  }

  test.fast(`${prefix}: pre-upgrade hiding and empty regions preserve authored markup`,async t=>{
    const page=await pageFor(t,engine,mode);await raw(page)
    assert.equal(await page.locator('#toaster').evaluate(t=>getComputedStyle(t).display),'none')
    await page.evaluate(()=>{window.originalMarkup=document.querySelector('#toaster').outerHTML;window.originalChild=document.querySelector('a-toast').firstChild})
    await register(page,mode)
    assert.equal(await page.evaluate(()=>originalMarkup===document.querySelector('#toaster').outerHTML&&originalChild===document.querySelector('a-toast').firstChild),true)
    await page.locator('#toaster').evaluate(t=>{t.replaceChildren();const unused=document.createElement('span');unused.slot='unknown';t.append(unused)})
    await page.waitForFunction(()=>!document.querySelector('#toaster').shadowRoot.querySelector('[popover]').matches(':popover-open'))
    await page.locator('#toaster').evaluate(t=>{window.savedToaster=t;t.remove();document.querySelector('#mount').append(t)})
    assert.equal(await page.locator('#toaster').evaluate(t=>t.shadowRoot.querySelector('[popover]').matches(':popover-open')),false)
    await raw(page);await page.locator('#toaster').evaluate(t=>{window.savedToaster=t;t.remove();document.querySelector('#mount').append(t)})
    await page.waitForFunction(()=>savedToaster.shadowRoot.querySelector('[popover]').matches(':popover-open'))
    assert.equal(await page.locator('#toaster').evaluate(t=>t.shadowRoot.querySelectorAll('style,link').length),0)
    assert.equal(await page.locator('a-toast').evaluate(t=>t.shadowRoot.querySelectorAll('style,link').length),0)
  })
  for(const framework of ['React','Preact']) test.fast(`${prefix} ${framework}: ordinary event projection forwards without hydration hooks`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await page.evaluate(framework=>import(`/${framework}.js`),framework)
    assert.equal(await page.evaluate(()=>{store.add(()=> 'Worker projection');return projectEvents()}),'function')
  })
  test(`${prefix}: nested sticky countdowns remain independent and invalid durations retain defaults`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    await raw(page,{duration:'1500',content:'<a-toast duration="Infinity"><span>Sticky nested content</span></a-toast>'})
    await page.waitForTimeout(120)
    assert.ok(await page.locator('#toaster > a-toast').evaluate(t=>Number(getComputedStyle(t.shadowRoot.querySelector('slot')).getPropertyValue('--toast-remaining')))<0.99)
    assert.equal(await page.locator('a-toast a-toast span').evaluate(el=>Number(getComputedStyle(el).getPropertyValue('--toast-remaining'))),1)
    for(const duration of ['', '0','-5','junk']){
      await raw(page,{duration})
      assert.equal(await page.locator('a-toast').evaluate(t=>t.shadowRoot.querySelector('slot').getAnimations()[0].effect.getTiming().duration),5000)
    }
  })

}
for(const engine of engines) for(const order of [['granular','bundle'],['bundle','granular']]) test(`${engine.name()}: independent ${order.join(' then ')} imports preserve registration and explicit store coordination`,async t=>{
  const page=await pageFor(t,engine,order[0]);await register(page,order[0]);await page.evaluate(()=>window.originalConstructor=customElements.get('a-toast'))
  await register(page,order[1]);assert.equal(await page.evaluate(()=>originalConstructor===customElements.get('a-toast')),true)
  await page.evaluate(async order=>{window.firstAPI=await import(`/${order[0]}-api.js`);window.secondAPI=await import(`/${order[1]}-api.js`);window.sharedStore=firstAPI.createToaster()},order)
  // Default managers retain their existing per-entry identity; explicit stores bridge builds.
  assert.equal(await page.evaluate(()=>firstAPI.Toaster.manager===secondAPI.Toaster.manager),false)
  await page.evaluate(()=>import('/React.js'));await page.evaluate(()=>mountWithStore(sharedStore));await page.waitForSelector('#toaster',{state:'attached'})
  await page.evaluate(()=>sharedStore.add(()=> 'Shared across builds',{duration:Infinity}));await page.waitForSelector('#toaster a-banner')
  await page.locator('#toaster a-banner-close a-button').click();await page.waitForFunction(()=>sharedStore.getSnapshot().length===0)
})

for(const engine of engines) for(const mode of ['granular','bundle']) test(`${engine.name()} ${mode}: visual and original geometry matrix`,async()=>{
  const directory=resolve('tests/.test-output/toaster',consumerRoot?'installed':'source');await mkdir(directory,{recursive:true})
  const variants=[...placements.map(placement=>({name:placement,placement})),
    {name:'stacked',placement:'bottom-right',count:3},
    {name:'narrow',placement:'top-center',viewport:{width:320,height:600}},
    {name:'overrides',placement:'bottom-left',override:true},
    {name:'banner',placement:'top-right',content:'<a-banner tone="info" round><a-banner-message>Saved successfully</a-banner-message><a-banner-actions><a-button role="button" tabindex="0" data-toast-dismiss><a-button-label>Done</a-button-label></a-button></a-banner-actions></a-banner>'},
    {name:'card',placement:'bottom-center',content:'<a-card><a-card-content><a-card-header><a-card-title>Ready</a-card-title></a-card-header><a-card-body><a href="#details">Details</a><a-button role="button" tabindex="0" data-toast-dismiss><a-button-label>Dismiss</a-button-label></a-button></a-card-body></a-card-content></a-card>'},
    {name:'rtl-dark',placement:'bottom-right',rtl:true}]
  for(const variant of variants){
    const metrics=[]
    for(const entry of assets.has('/original.js')?['original',mode]:[mode]){
      const page=await browsers.get(engine).newPage({viewport:variant.viewport??{width:1280,height:900},reducedMotion:'reduce'})
      try{
        await page.goto(`${origin}/?mode=${entry}&capture`);await register(page,entry);await raw(page,variant)
        if(variant.override)await page.locator('#toaster').evaluate(t=>t.className='override')
        if(variant.rtl)await page.evaluate(()=>{document.documentElement.dir='rtl';document.body.className='dark'})
        await page.evaluate(()=>{for(const animation of document.getAnimations()){if(animation.effect?.getComputedTiming().endTime!==Infinity)animation.finish()}})
        await page.waitForTimeout(30)
        metrics.push(await page.locator('#toaster').evaluate(t=>[t.shadowRoot.querySelector('[popover]'),...t.shadowRoot.querySelectorAll('slot'),...t.querySelectorAll('a-toast,.surface,a-banner,a-card,a-button')].map(el=>{
          const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {tag:el.localName,x:Math.round(r.x*100)/100,y:Math.round(r.y*100)/100,width:Math.round(r.width*100)/100,height:Math.round(r.height*100)/100,font:s.font,color:s.color,background:s.backgroundColor,display:s.display,opacity:s.opacity,translate:s.translate,transition:s.transition}
        })))
        await page.screenshot({path:resolve(directory,`${engine.name()}-${mode}-${variant.name}-${entry}.png`),animations:'allow'})
      }finally{await page.close()}
    }
    const {writeFile}=await import('node:fs/promises');await writeFile(resolve(directory,`${engine.name()}-${mode}-${variant.name}.json`),JSON.stringify(metrics,null,2))
    if(metrics.length===2)assert.deepEqual(metrics[1],metrics[0],`${engine.name()} ${mode} ${variant.name} matches original`)
  }
})
