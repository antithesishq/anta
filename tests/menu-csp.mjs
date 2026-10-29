import assert from 'node:assert/strict'
import { before, after } from 'node:test'
import { componentTest as test, componentEngines } from './component-tier.mjs'
import { createServer } from 'node:http'
import { createRequire, Module } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const requirePlot = createRequire(new URL('../plot/package.json', import.meta.url))
const requireRenderer = createRequire(requireSite.resolve('@astrojs/preact'))
const { chromium, firefox, webkit } = requireSite('playwright')
const engines = componentEngines([chromium, firefox, webkit])
const consumer = process.env.ANTA_MENU_CONSUMER_ROOT ? resolve(process.env.ANTA_MENU_CONSUMER_ROOT) : undefined
const source = resolve('src'), resolveDir = consumer ?? process.cwd(), base = consumer ? '@antadesign/anta' : source
const nodePaths = [resolve(consumer ?? '.', 'node_modules'), resolve('site/node_modules')]
const compat = consumer ? 'preact/compat' : requireSite.resolve('preact/compat')
const jsxAlias = consumer ? {} : { '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime') }
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'"
const assets = new Map(), browsers = new Map(), renderers = new Map()
const entries = ['menu', 'menu-item', 'menu-group', 'menu-separator', 'input', 'input-time', 'button', 'icon', 'tooltip', 'copy', 'calendar', 'select', 'select-faceted', 'input-date', 'breadcrumbs']
const imports = `import React from 'react'; import { Menu, MenuItem, MenuItemCopy, Button, Input, InputDate, InputAutocomplete, Select, SelectFaceted, Breadcrumbs, configure } from '${consumer ? base : `${base}/index`}';`
const factory = `const h=React.createElement; const app=(props={})=>h(React.Fragment,null,h(Button,{id:'trigger',label:'Actions'}),h(Menu,{id:'menu','aria-label':'Actions menu',...props},h(MenuItem,{id:'alpha',label:'Alpha',onSelect:()=>window.reports.push(['select'])}),h(MenuItem,{id:'disabled',label:'Disabled',disabled:true}),h(MenuItem,{id:'beta',label:'Beta'})));`
let server, origin
async function compile(options) {
  const result = await build({absWorkingDir:resolveDir,bundle:true,write:false,metafile:true,nodePaths,target:'es2022',...options})
  if(consumer){const inputs=Object.keys(result.metafile.inputs).map(p=>resolve(resolveDir,p));assert.ok(inputs.some(p=>p.startsWith(resolve(consumer,'node_modules/@antadesign/anta/dist')+'/')));assert.ok(!inputs.some(p=>p.startsWith(source+'/')))}
  return result
}
function save(result,name){for(const file of result.outputFiles)assets.set(`/${name}.${file.path.endsWith('.css')?'css':'js'}`,file.text)}
before(async()=>{
  for(const mode of ['granular','bundle']){
    const contents=mode==='bundle'?`import '${base}/bundle';${consumer?`import '${base}/bundle.css';`:''}`:`import '${base}/tokens.css';import '${base}/reset.css';${entries.map(e=>`import '${base}/elements/a-${e}';`).join('\n')}`
    save(await compile({stdin:{contents,resolveDir},outfile:`${mode}.js`,format:'esm',alias:{react:compat}}),mode)
  }
  // Independent builds deliberately evaluate different copies of helpers/classes.
  save(await compile({stdin:{contents:`import '${base}/elements/a-menu-item';`,resolveDir},outfile:'item.js',format:'esm'}),'item')
  for(const framework of ['React','Preact']){
    const react=framework==='React', alias={...jsxAlias,...(react?consumer?{}:{react:resolve('node_modules/react')}:{react:compat})}
    const result=await compile({stdin:{contents:`${imports}${factory}${react?"import {renderToString} from 'react-dom/server'":"import renderToString from 'preact-render-to-string'"};export const render=props=>renderToString(app(props));`,resolveDir},platform:'node',format:'cjs',jsx:'automatic',jsxImportSource:'@antadesign/anta',alias:{...alias,...(consumer?{}:react?{'react-dom/server':requirePlot.resolve('react-dom/server')}:{'preact-render-to-string':requireRenderer.resolve('preact-render-to-string')})}})
    const compiled=new Module(resolve(`tests/menu-${framework}-server.cjs`));compiled._compile(result.outputFiles[0].text,compiled.id);renderers.set(framework,compiled.exports.render)
    save(await compile({stdin:{contents:`${imports}${factory}
      ${react?"import {createRoot,hydrateRoot} from 'react-dom/client'":"import {render,hydrate} from 'preact'"};
      let root;window.reports=[];window.recoverableErrors=[];
      const handlers=version=>({onStateChange:(e,d)=>{reports.push([version,d.next,d.prev]);if(window.accept)window.renderMenu({open:d.next},version)},onactivedescendant:()=>reports.push(['active'])});
      const commit=node=>{${react?"root??=createRoot(document.querySelector('#mount'));root.render(node)":"render(node,document.querySelector('#mount'))"}};
      window.hydrateMenu=()=>{configure(React.createElement,React.Fragment,React,{hydratingEvents:true});${react?"root=hydrateRoot(document.querySelector('#mount'),app({open:false,...handlers('first')}),{onRecoverableError:e=>recoverableErrors.push(e.message)})":"hydrate(app({open:false,...handlers('first')}),document.querySelector('#mount'))"}};
      window.renderMenu=(props={},version='second')=>commit(app({...handlers(version),...props}));
      window.noHandlers=()=>commit(app({}));window.unmountMenu=()=>commit(null);
      const EmptyTrigger=props=>h(Button,{...props,label:'Assign'});
      const SelectedTrigger=props=>h(Button,{...props,label:'Alice'});
      window.renderTriggerDemo=(kind,compact=true)=>{
        configure(React.createElement,React.Fragment,React);
        const renderTrigger=kind==='responsive'&&!compact?undefined:({selected,open})=>{
          const props={id:'trigger','data-trigger-case':kind,'aria-haspopup':'menu','aria-expanded':String(open)};
          if(kind==='types')return h(selected.length?SelectedTrigger:EmptyTrigger,props);
          return h(Button,{...props,label:selected[0]?.label??'Assign',key:kind==='keyed'?(selected[0]?.value??'empty'):undefined});
        };
        commit(h(Select,{key:kind,id:'trigger','data-trigger-case':kind,placeholder:'Assign',options:['Alice'],renderTrigger,onValueChange:v=>reports.push(['chosen',v])}));
      };

      window.compose=kind=>{configure(React.createElement,React.Fragment,React);const common={label:'Choose'};const choices=['Alpha','Beta'];let node;
        if(kind==='autocomplete')node=h(InputAutocomplete,{...common,suggestions:choices,onSelect:o=>reports.push(['chosen',o.value])});
        if(kind==='date')node=h(InputDate,{...common,defaultValue:'2026-10-15',clearable:true});
        if(kind==='select')node=h(Select,{...common,options:choices,filter:true,onValueChange:v=>reports.push(['chosen',v])});
        if(kind==='faceted')node=h(SelectFaceted,{...common,facets:[{key:'team',label:'Team',kind:'single',options:choices}]});
        if(kind==='breadcrumbs')node=h(Breadcrumbs,{maxItems:1,items:[{label:'Home',href:'#home'},{label:'Copy path',copy:'Path',iconPlacement:'none'},{label:'Current',current:true}]});
        if(kind==='copy')node=h(React.Fragment,null,h(Button,{label:'Choose'}),h(Menu,{id:'menu'},h(MenuItemCopy,{copy:'Copied value',label:'Copy row',iconPlacement:'none'})));
        commit(node);
      };
    `,resolveDir},outfile:`${framework}.js`,format:'esm',jsx:'automatic',jsxImportSource:'@antadesign/anta',define:{'process.env.NODE_ENV':'"production"'},alias:{...alias,...(react&&!consumer?{'react-dom/client':requirePlot.resolve('react-dom/client')}:{})}}),framework)
  }
  assets.set('/boot.js',`window.violations=[];window.reports=[];window.copied=[];
    document.addEventListener('securitypolicyviolation',e=>violations.push({directive:e.effectiveDirective,source:e.sourceFile}));
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>copied.push(value)}});
    window.framesPending=new Set();const raf=requestAnimationFrame.bind(window),caf=cancelAnimationFrame.bind(window);
    window.requestAnimationFrame=fn=>{const id=raf(t=>{framesPending.delete(id);fn(t)});framesPending.add(id);return id};window.cancelAnimationFrame=id=>{framesPending.delete(id);caf(id)};`)
  assets.set('/review.css',`
    @layer base { .layer-base::part(menu) { background: rgb(1, 2, 3); } }
    @layer anta.components {
      :where(.layer-same) > :is(a-menu-header, a-menu-footer) { padding: 13px; }
    }
    @layer anta.theme { .layer-theme::part(menu) { background: rgb(4, 5, 6); } }
    @layer components { .layer-components::part(menu) { background: rgb(7, 8, 9); } }
    @layer utilities { .layer-utilities::part(menu) { background: rgb(10, 11, 12); } }
    .layer-unlayered::part(menu) { background: rgb(13, 14, 15); }
    .scroll-inset { --menu-padding: 8px; }
    .scroll-padding::part(scroll) { scroll-padding-block: 12px 20px; }
    .scroll-percent::part(scroll) { scroll-padding-block: 5% 10%; }
  `)
  assets.set('/fixture.css',`body{margin:0;font:14px/20px system-ui}#mount{position:absolute;left:100px;top:150px}#trigger{width:160px}#outside{position:fixed;left:4px;top:4px}a-menu-item{min-height:28px}.clip{overflow:hidden;contain:paint;height:40px;width:200px}.override::part(menu){background:rgb(20,40,60);border-radius:12px;min-width:210px}.override::part(scroll){padding:8px}.override::part(header){color:rgb(60,80,100)}.tall{height:900px}iframe{width:600px;height:400px;border:0}dialog{margin:80px;padding:20px}.outside-tooltip{position:fixed;left:500px;top:80px}`)
  if(!consumer&&process.env.ANTA_MENU_COMPARE_ORIGINAL==='1'){
    const original=new Map(['a-menu.ts','a-menu.css'].map(name=>[name,execFileSync('git',['show',`aeea7c08:src/elements/${name}`],{encoding:'utf8'})]))
    save(await compile({stdin:{contents:`import '${base}/tokens.css';import '${base}/reset.css';${entries.map(e=>`import '${base}/elements/a-${e}';`).join('\n')}`,resolveDir},outfile:'original.js',format:'esm',alias:{react:compat},plugins:[{name:'original-menu',setup(build){build.onLoad({filter:/[/\\]a-menu\.(ts|css)$/},args=>{const name=args.path.split(/[\\/]/).pop();return {contents:original.get(name),loader:name.endsWith('.css')?'css':'ts'}})}}]}),'original')
  }
  server=createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost'),mode=url.searchParams.get('mode')??'granular',original=url.searchParams.has('original')
    res.setHeader('Content-Security-Policy',original?policy.replace("style-src 'self'","style-src 'self' 'unsafe-inline'"):policy)
    res.setHeader('Content-Type',`${url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html'}; charset=utf-8`)
    res.end(assets.get(url.pathname)??`<!doctype html>${url.searchParams.has('nocss')?'':`<link rel="stylesheet" href="/${mode}.css">`}<link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><button id="outside">Outside</button><main id="mount">${url.searchParams.has('ssr')?renderers.get(url.searchParams.get('framework')??'React')({open:false}):''}</main>`)
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`
  for(const engine of engines)browsers.set(engine,await engine.launch({headless:true,...(engine===chromium?(process.env.ANTA_MENU_CHROMIUM_EXECUTABLE?{executablePath:process.env.ANTA_MENU_CHROMIUM_EXECUTABLE}:{channel:process.env.CAPTURE_TEST_BROWSER_CHANNEL||undefined}):{})}))
  console.log('Menu browser coverage:',JSON.stringify([...browsers].map(([e,b])=>({engine:e.name(),version:b.version()}))))
})
after(async()=>{await Promise.all([...browsers.values()].map(b=>b.close()));if(server)await new Promise(r=>server.close(r))})
async function pageFor(t,engine,mode,query='',options={}){
  const page=await browsers.get(engine).newPage({viewport:{width:800,height:600},...options});page.setDefaultTimeout(7000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message));const response=await page.goto(`${origin}/?mode=${mode}${query}`);assert.equal(response.headers()['content-security-policy'],policy)
  t.after(async()=>{try{assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>violations),[])}finally{await page.close()}});return page
}
const row=(id,label=id,attrs='',role='menuitem')=>`<a-menu-item id="${id}" role="${role}" tabindex="0" ${attrs}><a-menu-item-label>${label}</a-menu-item-label></a-menu-item>`
const raw=(attrs='',content=row('alpha','Alpha')+row('disabled','Disabled','disabled')+row('beta','Beta'))=>`<button id="trigger">Actions</button><a-menu id="menu" role="menu" aria-label="Actions menu" ${attrs}>${content}</a-menu>`
const mount=(page,html=raw())=>page.locator('#mount').evaluate((n,html)=>{n.innerHTML=html},html)
async function register(page,mode){await page.evaluate(mode=>import(`/${mode}.js`),mode);await page.waitForFunction(()=>!document.querySelector('a-menu')||document.querySelector('a-menu').listening)}
const surface=(page,selector='#menu')=>page.locator(`${selector} [part=menu]`)
const shown=(page,expected=true,selector='#menu')=>page.waitForFunction(({selector,expected})=>document.querySelector(selector)?.isOpen===expected,{selector,expected})
const settled=page=>page.evaluate(async()=>{
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))
  const effects=[...document.querySelectorAll('a-menu')].flatMap(el=>el.surface?.getAnimations()??[])
  await Promise.all(effects.filter(a=>a.playState!=='paused').map(a=>a.finished.catch(()=>{})))
})
const metrics=(page,selector='#menu')=>page.locator(selector).evaluate(el=>{const s=el.shadowRoot.querySelector('[part=menu]'),c=getComputedStyle(s),r=s.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,opacity:+c.opacity,display:c.display,translate:c.translate,transform:c.transform,maxHeight:c.maxHeight,border:c.border,background:c.backgroundColor,radius:c.borderRadius,shadow:c.boxShadow,transition:c.transition,scroll:getComputedStyle(el.shadowRoot.querySelector('[part=scroll]')).padding}})

test.fast('Menu SSR retains authored roles, slots, state, and content without layout styles',()=>{for(const render of renderers.values()){const html=render({open:false});assert.match(html,/state="closed"/);assert.match(html,/aria-label="Actions menu"/);assert.doesNotMatch(html,/style=|part=|popover=/)}})
for(const engine of engines)for(const mode of ['granular','bundle']){
  const name=`${engine.name()} ${mode}`
  test.fast(`${name}: external defaults preserve raw ownership, selection, dismissal, and focus`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page);assert.equal(await page.locator('#menu').isVisible(),false);await register(page,mode)
    const before=await page.locator('#mount').innerHTML();await page.evaluate(()=>{window.mutations=[];new MutationObserver(rs=>mutations.push(...rs.map(r=>r.type))).observe(document.querySelector('#mount'),{attributes:true,subtree:true,childList:true,characterData:true});menu.addEventListener('statechange',e=>reports.push(e.detail.next));alpha.addEventListener('menuselect',()=>reports.push('select'))})
    await page.locator('#trigger').focus();await page.keyboard.press('ArrowDown');await shown(page);await settled(page);assert.equal(await page.evaluate(()=>document.activeElement.id),'alpha')
    const m=await metrics(page);assert.equal(m.display,'flex');assert.equal(m.opacity,1);assert.ok(m.width>=160);assert.ok(m.y>=170);assert.ok(m.height>50)
    assert.deepEqual(await page.locator('#menu').evaluate(el=>({roots:el.shadowRoot.children.length,sheets:el.shadowRoot.querySelectorAll('style,link').length,children:[...el.surface.children].map(n=>[n.localName,n.getAttribute('part'),n.getAttribute('name')]),popover:el.surface.popover})),{roots:1,sheets:0,children:[['slot','header','header'],['div','scroll',null],['slot','footer','footer']],popover:'manual'})
    await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.id),'beta');await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement.id),'alpha');await page.keyboard.press('Enter');await shown(page,false);await settled(page)
    assert.equal((await metrics(page)).display,'none');assert.deepEqual(await page.evaluate(()=>reports),['open','select','closed']);assert.equal(await page.locator('#mount').innerHTML(),before);assert.deepEqual(await page.evaluate(()=>mutations),[])
    await page.locator('#trigger').click();await shown(page);await page.keyboard.press('Escape');await shown(page,false);assert.equal(await page.evaluate(()=>document.activeElement.id),'trigger')
    await page.locator('#trigger').click();await shown(page);await page.locator('#outside').click();await shown(page,false)
  })
  test.fast(`${name}: native propagation stopping reconciles types and releases on disconnect`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page,raw('stop-propagation="click wheel"'));await register(page,mode)
    assert.deepEqual(await page.locator('#menu').evaluate(menu=>{
      const root=document.querySelector('#mount'),surface=menu.surface,types=['click','wheel','pointerdown']
      const results=[],cancelled=[]
      for(const type of types)root.addEventListener(type,()=>results.push(type))
      const dispatch=()=>{for(const type of types){const event=new Event(type,{bubbles:true,composed:true,cancelable:true});surface.dispatchEvent(event);if(event.defaultPrevented)cancelled.push(type)}}
      dispatch()
      menu.setAttribute('stop-propagation','pointerdown');dispatch()
      menu.setAttribute('stop-propagation','');dispatch()
      menu.removeAttribute('stop-propagation');dispatch()
      menu.setAttribute('stop-propagation','wheel')
      root.remove();dispatch()
      document.body.append(root);dispatch()
      return {results,cancelled}
    }),{results:['pointerdown','click','wheel','wheel','pointerdown','click','wheel','pointerdown','click','wheel','pointerdown','click','pointerdown'],cancelled:[]})
  })
  test.fast(`${name}: preserve initially offscreen open requests`,async t=>{
    for(const controlled of [false,true]){
      const page=await pageFor(t,engine,mode);await register(page,mode)
      await page.evaluate(()=>{const Observer=IntersectionObserver;window.intersections=0;window.IntersectionObserver=class extends Observer{constructor(callback,options){super((entries,observer)=>{window.intersections+=entries.length;callback(entries,observer)},options)}};document.querySelector('#mount').style.top='1500px'})
      await mount(page,raw(controlled?'state="open"':''));await page.locator('#menu').evaluate((el,controlled)=>{el.addEventListener('statechange',e=>reports.push(e.detail.next));if(!controlled)el.open()},controlled)
      await page.waitForFunction(()=>intersections>0);await settled(page)
      assert.equal(await page.locator('#menu').evaluate(el=>el.isOpen),true)
      assert.deepEqual(await page.evaluate(()=>reports),controlled?[]:['open'])
      assert.equal(await page.locator('#menu').evaluate(el=>el.listening),false)
      await page.locator('#mount').evaluate(el=>el.style.top='150px');await page.waitForFunction(()=>menu.listening)
      await page.locator('#mount').evaluate(el=>el.style.top='1500px');await page.waitForFunction(()=>reports.at(-1)==='closed')
    }
  })
  test.fast(`${name}: transfer overlapping trigger ownership`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page,raw());await register(page,mode)
    await page.locator('#menu').evaluate(el=>{const replacement=el.cloneNode(true);replacement.id='replacement';el.before(replacement)})
    await page.waitForFunction(()=>document.querySelector('#replacement').listening)
    assert.equal(await page.locator('#menu').evaluate(el=>el.listening),false)
    await page.locator('#trigger').click();await shown(page,true,'#replacement');await shown(page,false)
    await page.locator('#menu').evaluate(el=>el.remove());await page.locator('#replacement').evaluate(el=>el.close());await page.locator('#trigger').click();await shown(page,true,'#replacement')
    // Replace twice before the new observation's pending work can run.
    await page.locator('#replacement').evaluate(el=>{el.close();const next=el.cloneNode(true);next.id='next';el.before(next);const last=next.cloneNode(true);last.id='last';next.before(last);el.remove();next.remove()})
    await page.waitForFunction(()=>document.querySelector('#last').listening);await page.locator('#trigger').click();await shown(page,true,'#last')
  })
  test.fast(`${name}: hide safely without optional ancestor capabilities`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page,raw('',`<a-menu-item id="parent" submenu tabindex="0">More<a-menu id="child">${row('leaf','Leaf')}</a-menu></a-menu-item>`));await register(page,mode)
    await page.locator('#menu').evaluate(el=>{el.open();el.holdHoverClose=undefined;document.querySelector('#child').open()});await settled(page)
    await page.locator('#leaf').hover();await page.locator('#child').evaluate(el=>el.close());await shown(page,false,'#child')
    assert.equal(await page.locator('#child').evaluate(el=>el.surface.matches(':popover-open')),false)
  })
  test.fast(`${name}: notify only when hiding a nonempty active cursor`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page,raw('',`<a-menu-item id="parent" submenu tabindex="0">More<a-menu id="child">${row('leaf','Leaf')}</a-menu></a-menu-item>`));await register(page,mode)
    await page.evaluate(()=>{for(const el of document.querySelectorAll('a-menu'))el.addEventListener('activedescendant',e=>reports.push([el.id,e.detail.id]));menu.open();child.open();menu.close()})
    assert.deepEqual(await page.evaluate(()=>reports),[])
    await mount(page,raw('',`<a-menu-header slot="header"><a-input id="search" data-menu-search></a-input></a-menu-header>${row('alpha','Alpha')}`));await page.waitForFunction(()=>menu.listening)
    await page.locator('#menu').evaluate(el=>el.open());await page.keyboard.press('ArrowDown')
    await page.evaluate(()=>{window.reports=[];window.ownedSearch=document.querySelector('#search');menu.addEventListener('activedescendant',e=>reports.push(e.detail.id));menu.close();menu.remove()})
    assert.deepEqual(await page.evaluate(()=>reports),[null])
    assert.equal(await page.evaluate(()=>ownedSearch.shadowRoot.querySelector('input').ariaActiveDescendantElement),null)
    await mount(page,raw('',`<a-menu-item id="parent" submenu tabindex="0">More<a-menu id="child"><a-menu-header slot="header"><a-input id="search" data-menu-search></a-input></a-menu-header>${row('leaf','Leaf')}</a-menu></a-menu-item>`)+`<button>Other</button><a-menu id="other">${row('otherItem')}</a-menu>`);await page.waitForFunction(()=>menu.listening)
    await page.evaluate(()=>{menu.open();child.open()});await page.keyboard.press('ArrowDown')
    await page.evaluate(()=>{window.reports=[];window.ownedSearch=document.querySelector('#search');child.addEventListener('activedescendant',e=>reports.push(e.detail.id));other.open();menu.remove()})
    assert.deepEqual(await page.evaluate(()=>reports),[null])
    assert.equal(await page.evaluate(()=>ownedSearch.shadowRoot.querySelector('input').ariaActiveDescendantElement),null)
  })
  test.fast(`${name}: retain low-specificity regions and document layer precedence`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page,raw('class="layer-same"','<a-menu-header id="header" slot="header">Header</a-menu-header>'+row('alpha')+'<a-menu-footer id="footer" slot="footer">Footer</a-menu-footer>'));await register(page,mode)
    await page.evaluate(()=>new Promise(r=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/review.css';link.onload=r;document.head.append(link)}));await page.locator('#menu').evaluate(el=>el.open());await settled(page)
    assert.equal(await page.locator('#header').evaluate(el=>getComputedStyle(el).padding),'13px');assert.equal(await page.locator('#footer').evaluate(el=>getComputedStyle(el).padding),'13px')
    for(const [layer,color] of [['base',null],['theme','rgb(4, 5, 6)'],['components','rgb(7, 8, 9)'],['utilities','rgb(10, 11, 12)'],['unlayered','rgb(13, 14, 15)']]){
      await page.locator('#menu').evaluate((el,layer)=>el.className=`layer-${layer}`,layer)
      const actual=(await metrics(page)).background
      if(color)assert.equal(actual,color);else assert.notEqual(actual,'rgb(1, 2, 3)')
    }
  })
  test.fast(`${name}: keep active rows within owned scroll padding`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page,raw('class="scroll-padding"',`<a-menu-header slot="header"><input id="search" data-menu-search></a-menu-header>${Array.from({length:40},(_,i)=>row(`item${i}`)).join('')}`));await register(page,mode)
    await page.evaluate(()=>new Promise(r=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/review.css';link.onload=r;document.head.append(link)}));await page.locator('#menu').evaluate(el=>el.open());await settled(page)
    for(const variant of ['scroll-inset','scroll-padding','scroll-percent']){
      await page.locator('#menu').evaluate((el,variant)=>{el.close();el.className=variant;el.open()},variant);await settled(page)
      await page.locator('#search').focus();for(let i=0;i<20;i++)await page.keyboard.press('ArrowDown')
      const bottom=await page.locator('#menu').evaluate(el=>{const c=el.scrollEl,r=c.getBoundingClientRect(),item=el.querySelector('a-menu-item:state(active)').getBoundingClientRect();return {gap:r.top+c.clientTop+c.clientHeight-item.bottom,height:c.clientHeight,outer:window.scrollY}})
      assert.ok(bottom.gap>=(variant==='scroll-inset'?8:variant==='scroll-padding'?20:bottom.height*.1)-1,JSON.stringify(bottom));assert.equal(bottom.outer,0)
      for(let i=0;i<10;i++)await page.keyboard.press('ArrowUp')
      const top=await page.locator('#menu').evaluate(el=>{const c=el.scrollEl,r=c.getBoundingClientRect(),item=el.querySelector('a-menu-item:state(active)').getBoundingClientRect();return {gap:item.top-r.top-c.clientTop,height:c.clientHeight,outer:window.scrollY}})
      assert.ok(top.gap>=(variant==='scroll-inset'?8:variant==='scroll-padding'?12:top.height*.05)-1,JSON.stringify(top));assert.equal(top.outer,0)
    }
  })
  test.fast(`${name}: trigger rebinding releases a moved anchor and wires its replacement`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page);await register(page,mode)
    await page.locator('#trigger').evaluate(el=>{const replacement=el.cloneNode(true);el.replaceWith(replacement);el.id='oldTrigger';el.style.position='fixed';el.style.left='500px';el.style.top='40px';document.body.append(el)})
    await settled(page);await page.locator('#oldTrigger').click();assert.equal(await page.locator('#menu').evaluate(el=>el.isOpen),false)
    await page.locator('#trigger').focus();await page.keyboard.press('ArrowDown');await shown(page);assert.equal(await page.evaluate(()=>document.activeElement.id),'alpha');await page.keyboard.press('Escape');await shown(page,false)
    await page.locator('#trigger').click();await shown(page);await page.locator('#alpha').click();await shown(page,false)
    await page.locator('#menu').evaluate(el=>{el.setAttribute('coord','');el.open({coord:[350,320]})});await settled(page);const before=await metrics(page)
    await page.locator('#trigger').evaluate(el=>el.replaceWith(el.cloneNode(true)));await settled(page);const after=await metrics(page)
    assert.equal(after.x,before.x);assert.equal(after.y,before.y);await shown(page)
  })
  test.fast(`${name}: trigger rebinding discovers late siblings and preserves open geometry and Input relations`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,`<a-menu id="menu" role="listbox" state="open">${row('alpha','Alpha','','option')}${row('beta','Beta','','option')}</a-menu>`);await shown(page)
    await page.locator('#menu').evaluate(el=>el.insertAdjacentHTML('beforebegin','<a-input id="trigger" data-menu-search role="combobox"></a-input>'));await page.waitForFunction(()=>menu.listening);await settled(page)
    await page.locator('#trigger').evaluate(el=>el.focus());await page.keyboard.press('ArrowDown');assert.equal(await page.locator('#alpha').evaluate(el=>el.active),true)
    await page.locator('#trigger').evaluate(el=>{window.originalField=el;const next=el.cloneNode(true);el.replaceWith(next);document.querySelector('#mount').style.left='240px'})
    await page.waitForFunction(()=>menu.listening&&document.querySelector('#trigger').shadowRoot.querySelector('input').ariaActiveDescendantElement===document.querySelector('#alpha'));await settled(page)
    assert.equal(await page.evaluate(()=>originalField.shadowRoot.querySelector('input').ariaActiveDescendantElement),null)
    assert.equal(await page.locator('#menu').evaluate(el=>el.isOpen),true);assert.ok(Math.abs((await metrics(page)).x-240)<=1)
    await page.locator('#trigger').evaluate(el=>el.focus());await page.keyboard.press('ArrowDown');assert.equal(await page.locator('#beta').evaluate(el=>el.active),true)
    await page.locator('#trigger').evaluate(el=>el.remove());await settled(page);await page.locator('#menu').evaluate(el=>el.insertAdjacentHTML('beforebegin','<button id="trigger">New trigger</button>'));await page.waitForFunction(()=>menu.listening);await settled(page)
    assert.equal(await page.locator('#beta').evaluate(el=>el.active),false);assert.equal(await page.locator('#menu').evaluate(el=>el.isOpen),true)
  })
  test.fast(`${name}: trigger rebinding shares parent observation and releases it after the last menu`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    await page.evaluate(()=>{window.parentWatches=0;window.parentWatchStarts=0;const Observer=MutationObserver;window.MutationObserver=class extends Observer{observingParent=false;observe(target,options){if(target===document.querySelector('#mount')&&options.childList&&!options.subtree&&!this.observingParent){this.observingParent=true;parentWatches++;parentWatchStarts++}super.observe(target,options)}disconnect(){if(this.observingParent){this.observingParent=false;parentWatches--}super.disconnect()}}})
    await mount(page,raw()+`<button id="secondTrigger">Second</button><a-menu id="secondMenu">${row('secondItem')}</a-menu>`);await page.waitForFunction(()=>menu.listening&&secondMenu.listening)
    assert.equal(await page.evaluate(()=>parentWatches),1);assert.equal(await page.evaluate(()=>parentWatchStarts),1)
    await page.locator('#menu').evaluate(el=>el.remove());await settled(page);assert.equal(await page.evaluate(()=>parentWatches),1)
    await page.locator('#secondMenu').evaluate(el=>el.remove());await settled(page);assert.equal(await page.evaluate(()=>parentWatches),0);assert.equal(await page.evaluate(()=>framesPending.size),0)
  })
  for(const framework of ['React','Preact'])test(`${name}: ${framework} trigger rebinding survives selection and responsive rendering`,{tier:mode==='granular'?'fast':'slow'},async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await page.evaluate(framework=>import(`/${framework}.js`),framework)
    for(const kind of ['stable','types','keyed','responsive']){
      await page.evaluate(kind=>{window.reports=[];renderTriggerDemo(kind,kind!=='responsive')},kind);await page.waitForFunction(kind=>document.querySelector('#trigger')?.getAttribute('data-trigger-case')===kind&&document.querySelector('a-menu')?.listening,kind)
      await page.evaluate(()=>{window.originalMenu=document.querySelector('a-menu');window.originalTrigger=document.querySelector('#trigger')})
      await page.locator('#trigger').click();await page.waitForFunction(()=>document.querySelector('a-menu').isOpen);await page.locator('a-menu-item').filter({hasText:'Alice'}).click();await page.waitForFunction(()=>reports.some(r=>r[0]==='chosen')&&!document.querySelector('a-menu').isOpen)
      if(kind==='responsive'){await page.evaluate(()=>renderTriggerDemo('responsive',true));await page.waitForFunction(()=>document.querySelector('#trigger')?.localName==='a-button')}
      await settled(page);assert.equal(await page.evaluate(()=>document.querySelector('a-menu')===originalMenu),true)
      assert.equal(await page.evaluate(()=>document.querySelector('#trigger')===originalTrigger),kind==='stable')
      await page.locator('#trigger').click();await page.waitForFunction(()=>document.querySelector('a-menu').isOpen);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('a-menu').isOpen)
    }
  })
  test.fast(`${name}: controlled updates and cancelable requests never apply optimistically`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page,raw('state="closed"'));await register(page,mode)
    await page.evaluate(()=>menu.addEventListener('statechange',e=>reports.push({next:e.detail.next,prev:e.detail.prev,bubbles:e.bubbles,composed:e.composed,cancelable:e.cancelable})))
    await page.locator('#trigger').click();assert.equal(await page.locator('#menu').evaluate(el=>el.isOpen),false)
    await page.locator('#menu').evaluate(el=>el.setAttribute('state','open'));await shown(page);await page.keyboard.press('Escape');assert.equal(await page.locator('#menu').evaluate(el=>el.isOpen),true)
    await page.locator('#menu').evaluate(el=>el.setAttribute('state','closed'));await shown(page,false)
    assert.deepEqual(await page.evaluate(()=>reports),[{next:'open',prev:'closed',bubbles:false,composed:false,cancelable:true},{next:'closed',prev:'open',bubbles:false,composed:false,cancelable:true}])
    await page.locator('#menu').evaluate(el=>{el.removeAttribute('state');el.addEventListener('statechange',e=>e.preventDefault())});await page.locator('#trigger').click();assert.equal(await page.locator('#menu').evaluate(el=>el.isOpen),false)
  })
  for(const framework of ['React','Preact'])test(`${name}: ${framework} SSR/hydration retains nodes and refreshes callbacks`,{tier:mode==='granular'?'fast':'slow'},async t=>{
    const page=await pageFor(t,engine,mode,`&ssr&framework=${framework}`);await register(page,mode)
    await page.evaluate(framework=>import(`/${framework}.js`),framework);await page.evaluate(()=>{window.originalMenu=document.querySelector('#menu');window.originalItem=document.querySelector('#alpha');hydrateMenu()});await page.evaluate(()=>new Promise(r=>setTimeout(r,50)))
    await page.locator('#trigger').click();await page.waitForFunction(()=>reports.some(r=>r[0]==='first'&&r[1]===true));assert.equal(await page.locator('#menu').evaluate(el=>el.isOpen),false)
    await page.evaluate(()=>{window.accept=true;renderMenu({open:false})});await page.evaluate(()=>new Promise(r=>setTimeout(r,20)));await page.locator('#trigger').click();await shown(page)
    await page.keyboard.press('Escape');await shown(page,false);assert.ok((await page.evaluate(()=>reports)).some(r=>r[0]==='second'&&r[1]===false))
    await page.evaluate(()=>noHandlers());await page.evaluate(()=>new Promise(r=>setTimeout(r,20)));await page.locator('#trigger').click();await shown(page);assert.equal(await page.evaluate(()=>document.querySelector('#menu')===originalMenu&&document.querySelector('#alpha')===originalItem),true);assert.deepEqual(await page.evaluate(()=>recoverableErrors),[])
  })
  test(`${name}: keyboard typeahead, native descendants, nested ownership and interrupted Enter`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page,raw('',row('alpha','Alpha')+row('native','Native','data-menu-open')+`<a-menu-item id="parent" role="menuitem" tabindex="0" submenu><a-menu-item-label>More</a-menu-item-label><a-menu id="child" role="menu">${row('leaf','Leaf')}</a-menu></a-menu-item>`));await page.locator('#native').evaluate(el=>el.insertAdjacentHTML('beforeend','<input id="editor" value="Original"><button id="nested">Nested</button>'));await register(page,mode)
    await page.locator('#trigger').focus();await page.keyboard.press('ArrowDown');await shown(page);await page.keyboard.press('m');assert.equal(await page.evaluate(()=>document.activeElement.id),'parent');await page.keyboard.press('ArrowRight');await shown(page,true,'#child');assert.equal(await page.evaluate(()=>document.activeElement.id),'leaf')
    await page.keyboard.press('ArrowLeft');await shown(page,false,'#child');assert.equal(await page.evaluate(()=>document.activeElement.id),'parent');await page.keyboard.press('Home');await page.keyboard.press('Control+ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.id),'alpha')
    await page.locator('#editor').focus();await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.id),'editor');await page.keyboard.type(' text');assert.match(await page.locator('#editor').inputValue(),/text/)
    await page.locator('#nested').click();await shown(page);await page.keyboard.press('Tab');assert.ok(await page.locator('#menu').evaluate(el=>el.contains(document.activeElement)))
  })
  test(`${name}: pinned regions, runtime height and fade values survive external part cascade`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page,raw('',`<a-menu-header id="header" slot="header">Pinned header</a-menu-header>${Array.from({length:30},(_,i)=>row(`item${i}`,`Item ${i}`)).join('')}<a-menu-footer id="footer" slot="footer">Pinned footer</a-menu-footer>`));await register(page,mode);await page.locator('#trigger').click();await shown(page);await settled(page)
    const initial=await page.locator('#menu').evaluate(el=>{const s=el.shadowRoot.querySelector('[part=scroll]');return {height:el.surface.getBoundingClientRect().height,cap:parseFloat(getComputedStyle(el.surface).maxHeight),scroll:s.scrollHeight>s.clientHeight,header:el.querySelector('#header').getBoundingClientRect().y,footer:el.querySelector('#footer').getBoundingClientRect().y,padding:getComputedStyle(el.querySelector('#header')).padding,mask:getComputedStyle(s).maskImage}})
    assert.ok(initial.height<=initial.cap+.1);assert.equal(initial.scroll,true);assert.equal(initial.padding,'4px');assert.match(initial.mask,/14px/)
    await page.locator('#menu [part=scroll]').evaluate(el=>el.scrollTop=100);await page.waitForFunction(()=>getComputedStyle(menu.shadowRoot.querySelector('[part=scroll]')).maskImage.includes('16px'))
    assert.equal(await page.locator('#header').evaluate(el=>el.getBoundingClientRect().y),initial.header);assert.equal(await page.locator('#footer').evaluate(el=>el.getBoundingClientRect().y),initial.footer)
  })
  test(`${name}: all placements, RTL, edge flipping, coordinates and vertical anchor tracking`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page);await register(page,mode)
    for(const direction of ['ltr','rtl'])for(const placement of ['bottom-start','bottom-end','top-start','top-end','bottom','top','right-start','right-end','left-start','left-end','right','left']){
      await page.locator('#menu').evaluate((el,{placement,direction})=>{document.documentElement.dir=direction;el.setAttribute('placement',placement);el.open()},{placement,direction});await shown(page);await settled(page);const m=await metrics(page);assert.ok(m.x>=3&&m.y>=3&&m.x+m.width<=797&&m.y+m.height<=597,`${direction} ${placement}: ${JSON.stringify(m)}`);await page.locator('#menu').evaluate(el=>el.close())
    }
    await page.locator('#mount').evaluate(el=>{el.style.left='700px';el.style.top='560px'});await page.locator('#menu').evaluate(el=>el.open());await settled(page);let m=await metrics(page);assert.ok(m.y<560&&m.x+m.width<=797)
    await page.locator('#menu').evaluate(el=>{el.close();el.setAttribute('coord','');el.open({coord:[790,590]})});await settled(page);m=await metrics(page);assert.ok(m.x+m.width<=797&&m.y+m.height<=597)
    await page.locator('#menu').evaluate(el=>{el.close();el.removeAttribute('coord');el.setAttribute('placement','bottom-start');document.querySelector('#mount').style.top='150px';el.open()});await settled(page);const before=await metrics(page);await page.locator('#mount').evaluate(el=>el.style.transform='translateY(25px)');await page.waitForFunction(y=>Math.abs(menu.surface.getBoundingClientRect().y-y)<1,before.y+25)
  })
  test(`${name}: Input combobox references, filtering, native keys and pending activation cleanup`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page,`<a-input id="trigger" data-menu-search label="Search" role="combobox" aria-label="Search options"></a-input><a-menu id="menu" role="listbox">${row('alpha','Alpha','','option')}${row('beta','Beta','','option')}</a-menu>`);await register(page,mode)
    await page.locator('#menu').evaluate(el=>{el.open();el.addEventListener('activedescendant',e=>reports.push(e.detail.id))});await shown(page);await page.keyboard.press('ArrowDown')
    assert.deepEqual(await page.locator('#trigger').evaluate(el=>{const c=el.shadowRoot.querySelector('input');return {name:c.getAttribute('aria-label'),controls:c.ariaControlsElements?.[0]===document.querySelector('#menu'),active:c.ariaActiveDescendantElement===document.querySelector('#alpha')}}),{name:'Search options',controls:true,active:true})
    await page.keyboard.down('Enter');await page.locator('#menu').evaluate(el=>el.close());await page.keyboard.up('Enter');assert.equal(await page.locator('#menu').evaluate(el=>el.isOpen),false);assert.equal(await page.locator('#alpha').evaluate(el=>el.active),false)
    await page.locator('#menu').evaluate(el=>el.open());await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');await shown(page,false)
  })
  test(`${name}: pointer hover and touch taps retain supported submenu behavior`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page,raw('',`<a-menu-item id="parent" tabindex="0" role="menuitem" submenu><a-menu-item-label>More</a-menu-item-label><a-menu id="child" role="menu">${row('leaf','Leaf')}</a-menu></a-menu-item>`));await register(page,mode);await page.locator('#trigger').click();await shown(page);await page.waitForFunction(()=>document.querySelector('#child').listening);await page.locator('#parent').hover();await shown(page,true,'#child');await page.keyboard.press('Escape');await shown(page,false,'#child')
    await page.locator('#parent').dispatchEvent('pointerenter',{pointerType:'touch'});await page.locator('#parent').click();await shown(page,true,'#child');await page.locator('#parent').dispatchEvent('pointerleave',{pointerType:'touch'});await settled(page);await shown(page,true,'#child');await page.locator('#leaf').click();await shown(page,false)
  })
  test(`${name}: clipping escape, native dialog top layer and external overrides`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page,`<dialog open><div class="clip">${raw('class="override"')}</div></dialog>`);await page.locator('dialog').evaluate(el=>{el.close();el.showModal()});await register(page,mode);await page.locator('#trigger').click();await shown(page);await settled(page)
    const m=await metrics(page);assert.equal(m.background,'rgb(20, 40, 60)');assert.equal(m.radius,'12px');assert.ok(m.width>=210);assert.equal(m.scroll,'8px');assert.ok(await page.locator('#beta').isVisible());await page.locator('#beta').click();await shown(page,false);assert.equal(await page.locator('dialog').evaluate(el=>el.open),true)
  })
  test(`${name}: interrupted transitions and missing/delayed stylesheet never leave a stuck popover`,async t=>{
    const page=await pageFor(t,engine,mode,'&nocss');await mount(page);await register(page,mode)
    await page.locator('#menu').evaluate(el=>{el.open();el.close()});assert.equal(await page.locator('#menu').evaluate(el=>el.surface.matches(':popover-open')),false)
    await page.evaluate(mode=>new Promise(r=>{const l=document.createElement('link');l.rel='stylesheet';l.href=`/${mode}.css`;l.onload=r;document.head.append(l)}),mode)
    await page.locator('#menu').evaluate(el=>el.open());await shown(page);await settled(page);assert.equal((await metrics(page)).opacity,1)
    await page.locator('#menu').evaluate(el=>{el.close();el.open()});await shown(page);await settled(page);assert.equal((await metrics(page)).opacity,1)
    await page.locator('#menu').evaluate(el=>el.close());await settled(page);assert.equal((await metrics(page)).display,'none')
    await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#menu').evaluate(el=>el.open());await settled(page);assert.equal((await metrics(page)).opacity,1);assert.equal(await page.locator('#menu').evaluate(el=>getComputedStyle(el).getPropertyValue('--menu-width-duration').trim()),'0')
  })
  test(`${name}: entry and exit transitions have one effect per property and settle after interruption`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page);await register(page,mode)
    await page.locator('#menu').evaluate(el=>{el.open();getComputedStyle(el.surface).opacity})
    const opening=await surface(page).evaluate(el=>{const animations=el.getAnimations().filter(a=>a.transitionProperty==='opacity');for(const a of animations){a.pause();a.currentTime=50}return {count:animations.length,opacity:+getComputedStyle(el).opacity}})
    if(opening.count){assert.equal(opening.count,1);assert.ok(opening.opacity>0&&opening.opacity<1)}
    await surface(page).evaluate(el=>el.getAnimations().forEach(a=>a.finish()))
    await page.locator('#menu').evaluate(el=>{el.close();getComputedStyle(el.surface).opacity})
    const closing=await surface(page).evaluate(el=>{const animations=el.getAnimations().filter(a=>a.transitionProperty==='opacity');for(const a of animations){a.pause();a.currentTime=70}return {count:animations.length,opacity:+getComputedStyle(el).opacity}})
    if(closing.count){assert.equal(closing.count,1);assert.ok(closing.opacity>0&&closing.opacity<1)}
    await page.locator('#menu').evaluate(el=>el.open());await surface(page).evaluate(el=>el.getAnimations().forEach(a=>a.finish()));assert.equal((await metrics(page)).opacity,1)
    await page.locator('#menu').evaluate(el=>el.close());await settled(page);assert.equal((await metrics(page)).display,'none')
  })
  test.fast(`${name}: separate documents keep independent stacks and release adopted ownership`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page,`<section id="first">${raw()}</section><section id="second"><button id="secondTrigger">Second</button><a-menu id="secondMenu" role="menu">${row('secondItem','Second item')}</a-menu></section>`);await register(page,mode)
    await page.evaluate(async url=>{const frame=document.createElement('iframe');frame.src=url;frame.style.position='fixed';frame.style.left='400px';frame.style.top='0';document.body.append(frame);await new Promise(r=>frame.onload=r);frame.contentDocument.querySelector('#mount').append(document.querySelector('#second'))},`${origin}/?mode=${mode}`)
    await page.locator('#menu').evaluate(el=>el.open());await page.frameLocator('iframe').locator('#secondMenu').evaluate(el=>el.open());await shown(page)
    assert.equal(await page.frameLocator('iframe').locator('#secondMenu').evaluate(el=>el.isOpen),true)
    await page.frameLocator('iframe').locator('#secondItem').click();await shown(page);assert.equal(await page.frameLocator('iframe').locator('#secondMenu').evaluate(el=>el.isOpen),false)
    await page.evaluate(()=>document.querySelector('iframe').remove());await page.locator('#menu').evaluate(el=>el.close());await shown(page,false)
  })
  test(`${name}: independently compiled adopted menus can close inside a foreign submenu`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page,raw('',`<a-menu-item id="parent" tabindex="0" role="menuitem" submenu><a-menu-item-label>More</a-menu-item-label><a-menu id="flyout" role="menu">${row('leaf','Leaf')}</a-menu></a-menu-item>`));await register(page,mode)
    await page.evaluate(async url=>{const frame=document.createElement('iframe');frame.src=url;document.body.append(frame);await new Promise(r=>frame.onload=r)},`${origin}/?mode=${mode}`)
    await page.frames()[1].evaluate(async mode=>{await import(`/${mode}.js`);document.querySelector('#mount').innerHTML='<div id="foreignBox"><button>Nested</button><a-menu id="foreignMenu" role="menu"><a-menu-item role="menuitem" tabindex="0">Foreign choice</a-menu-item></a-menu></div>'},mode==='bundle'?'granular':'bundle')
    await page.evaluate(()=>{document.querySelector('#flyout').append(document.querySelector('iframe').contentDocument.querySelector('#foreignBox'));menu.open();document.querySelector('#flyout').open();document.querySelector('#foreignMenu').open()});await settled(page)
    const rect=await surface(page,'#foreignMenu').boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2)
    await page.locator('#foreignMenu').evaluate(el=>el.close());await shown(page,true,'#flyout');await shown(page);await page.keyboard.press('Escape');await shown(page,false,'#flyout')
  })
  test(`${name}: disconnect releases tracking and forced replacement clears combobox ownership`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page);await register(page,mode);await page.evaluate(()=>{window.listeners=new Set();const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);document.addEventListener=(type,fn,opts)=>{if(['pointerdown','pointermove','pointerleave','keydown','keyup','contextmenu'].includes(type))listeners.add(fn);return add(type,fn,opts)};document.removeEventListener=(type,fn,opts)=>{listeners.delete(fn);return remove(type,fn,opts)}});await page.locator('#trigger').click();await shown(page)
    await page.evaluate(()=>{window.saved=document.querySelector('#mount').firstElementChild;window.savedMenu=menu;menu.remove();saved.remove()});await settled(page);assert.equal(await page.evaluate(()=>framesPending.size),0);assert.equal(await page.evaluate(()=>listeners.size),0)
    await page.evaluate(()=>{document.querySelector('#mount').append(saved,savedMenu)});await page.waitForFunction(()=>savedMenu.listening);await page.locator('#trigger').click();await shown(page);await page.setViewportSize({width:810,height:610});await shown(page,false)
  })
  for(const framework of ['React','Preact'])test(`${name}: ${framework} Menu compositions retain their popup contracts`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await page.evaluate(f=>import(`/${f}.js`),framework)
    for(const kind of ['autocomplete','date','select','faceted','breadcrumbs','copy']){
      await page.evaluate(kind=>compose(kind),kind);await page.waitForFunction(()=>document.querySelector('a-menu')?.listening)
      if(kind==='autocomplete'){await page.locator('a-input input').fill('Al');await page.waitForFunction(()=>document.querySelector('a-menu').isOpen);await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.waitForFunction(()=>reports.some(r=>r[0]==='chosen'&&r[1]==='Alpha'))}
      else if(kind==='date'){await page.locator('a-input [part=field]').click();await page.waitForFunction(()=>document.querySelector('a-menu').isOpen);assert.ok(await page.locator('a-calendar').isVisible());await page.keyboard.press('Escape')}
      else if(kind==='select'){await page.locator('a-input[button] [part=field]').click();await page.waitForFunction(()=>document.querySelector('a-menu').isOpen);await page.locator('a-input[data-menu-search] input').fill('Bet');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.waitForFunction(()=>reports.some(r=>r[0]==='chosen'&&r[1]==='Beta'))}
      else if(kind==='faceted'){await page.getByText('Choose',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('a-menu').isOpen);await page.locator('a-menu-item[submenu]').first().click();await page.waitForFunction(()=>[...document.querySelectorAll('a-menu')].filter(m=>m.isOpen).length===2);await page.getByText('Alpha',{exact:true}).click();await page.keyboard.press('Escape')}
      else if(kind==='breadcrumbs'){await page.locator('a-breadcrumbs > a-button[aria-haspopup=menu]').click();await page.waitForFunction(()=>document.querySelector('a-menu').isOpen);await page.getByText('Copy path',{exact:true}).click();await page.waitForFunction(()=>copied.includes('Path'))}
      else{await page.getByText('Choose',{exact:true}).click();await page.getByText('Copy row',{exact:true}).click();await page.waitForFunction(()=>copied.includes('Copied value'));assert.ok(await page.locator('a-copy [part=feedback]').isVisible());assert.equal(await page.locator('a-menu').evaluate(el=>el.isOpen),true);await page.keyboard.press('Escape')}
    }
  })
  test(`${name}: Tooltip suppression survives mixed imports and document adoption`,async t=>{
    const page=await pageFor(t,engine,mode);await page.evaluate(()=>import('/item.js'));await mount(page,`<div id="region">${raw('',row('alpha','Alpha')+`<a-menu-item id="tiprow" tabindex="0" role="menuitem">Hint<a-tooltip delay="0">Inside hint</a-tooltip></a-menu-item>`)}</div><button id="other" class="outside-tooltip">Other<a-tooltip delay="0">Outside hint</a-tooltip></button>`);await register(page,mode);await page.evaluate(other=>import(`/${other}.js`),mode==='bundle'?'granular':'bundle')
    await page.locator('#trigger').click();await shown(page);await page.locator('#other').hover();await settled(page);assert.equal(await page.locator('#other a-tooltip').evaluate(el=>el.shadowRoot.querySelector('[popover]').matches(':popover-open')),false)
    await page.locator('#tiprow').hover();await page.waitForFunction(()=>document.querySelector('#tiprow a-tooltip').shadowRoot.querySelector('[popover]').matches(':popover-open'))
    await page.keyboard.press('Escape');await shown(page,false);await page.locator('#menu').evaluate(el=>el.close())
    await page.evaluate(async origin=>{const frame=document.createElement('iframe');frame.src=origin;document.body.append(frame);await new Promise(r=>frame.onload=r);window.frame=frame;frame.contentDocument.querySelector('#mount').append(document.querySelector('#region'))},`${origin}/?mode=${mode}`)
    const frame=page.frameLocator('iframe');await page.waitForFunction(()=>document.querySelector('iframe').contentDocument.querySelector('#menu').listening);await frame.locator('#trigger').click();await frame.locator('#menu').evaluate(el=>{if(!el.isOpen)throw Error('Adopted menu did not open')});await frame.locator('#alpha').click();assert.equal(await frame.locator('#menu').evaluate(el=>el.isOpen),false)
  })
  if(engine===chromium)test(`${name}: trusted touch opens and selects without hover dismissal`,async t=>{
    const page=await pageFor(t,engine,mode,'',{hasTouch:true});await mount(page);await register(page,mode);await page.locator('#trigger').tap();await shown(page);await page.locator('#beta').tap();await shown(page,false)
  })
  if(!consumer&&process.env.ANTA_MENU_COMPARE_ORIGINAL==='1')test(`${name}: original geometry, appearance and transition samples`,async t=>{
    const output=resolve('tests/.test-output/menu',mode,engine.name());await mkdir(output,{recursive:true});const results=[]
    for(const variant of ['plain','round','rtl','pinned','override','edge','dark']){
      const samples=[],motion=[]
      for(const original of [true,false]){
        const page=await browsers.get(engine).newPage({viewport:{width:800,height:600}});try{
          await page.goto(`${origin}/?mode=${original?'original':mode}${original?'&original':''}`);await mount(page,raw(variant==='round'?'round':variant==='override'?'class="override"':'',variant==='pinned'?`<a-menu-header slot="header">Header</a-menu-header>${row('alpha','Alpha')}${row('beta','Beta')}<a-menu-footer slot="footer">Footer</a-menu-footer>`:undefined))
          await register(page,original?'original':mode);await page.evaluate(variant=>{if(variant==='rtl')document.documentElement.dir='rtl';if(variant==='dark')document.documentElement.classList.add('dark');if(variant==='edge'){document.querySelector('#mount').style.left='720px';document.querySelector('#mount').style.top='560px'}},variant);await page.locator('#menu').evaluate(el=>el.open());await settled(page);samples.push(await metrics(page));await page.screenshot({timeout:5000,path:resolve(output,`${variant}-${original?'original':'current'}.png`)});
          motion.push(await surface(page).evaluate(el=>{el.getRootNode().host.close();getComputedStyle(el).opacity;const effects=el.getAnimations().filter(a=>['opacity','translate'].includes(a.transitionProperty));for(const a of effects){a.pause();a.currentTime=70}const cs=getComputedStyle(el);return {opacity:cs.opacity,translate:cs.translate,effects:effects.length}}))
        }finally{await page.close()}
      }
      if(variant==='rtl'){const {x:oldX,...old}=samples[0],{x:newX,...current}=samples[1];assert.deepEqual(current,old);assert.equal(newX,100);assert.ok(oldX+samples[0].width>800,'Original RTL inset bug is recorded')}else assert.deepEqual(samples[1],samples[0],`${variant}: original/current computed values`);assert.deepEqual(motion[1],motion[0],`${variant}: halfway through exit`);results.push({variant,original:samples[0],current:samples[1],motion})
    }
    await writeFile(resolve(output,'metrics.json'),JSON.stringify(results,null,2))
  })
}
