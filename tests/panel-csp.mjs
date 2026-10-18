import assert from 'node:assert/strict'
import { before, after } from 'node:test'
import { componentTest as test, componentEngines, componentTier } from './component-tier.mjs'
import { createServer } from 'node:http'
import { createRequire, Module } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const requirePlot = createRequire(new URL('../plot/package.json', import.meta.url))
const requireRenderer = createRequire(requireSite.resolve('@astrojs/preact'))
const { chromium, firefox, webkit } = requireSite('playwright')
const { PNG } = requireSite('pngjs')
const engines = componentEngines([chromium, firefox, webkit])
const consumerRoot = process.env.ANTA_PANEL_CONSUMER_ROOT ? resolve(process.env.ANTA_PANEL_CONSUMER_ROOT) : undefined
const source = resolve('src'), resolveDir = consumerRoot ?? process.cwd()
const base = consumerRoot ? '@antadesign/anta' : source
const nodePaths = [resolve(consumerRoot ?? '.', 'node_modules'), resolve('site/node_modules')]
const compat = consumerRoot ? 'preact/compat' : requireSite.resolve('preact/compat')
const jsxAlias = consumerRoot ? {} : { '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime') }
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'"
const assets = new Map(), browsers = new Map(), renderers = new Map()
let server, origin
const imports = `import React from 'react'; import { Panel, configure } from '${consumerRoot ? '@antadesign/anta' : `${source}/index`}';`
const factory = `const app = (props = {}) => React.createElement(Panel, {id:'panel',...props},
  React.createElement('input',{id:'draft',defaultValue:'Original'}),React.createElement('button',{id:'last'},'Last'));`
async function compile(options) {
  const result = await build({ absWorkingDir:resolveDir, bundle:true, write:false, metafile:true, nodePaths, target:'es2022', ...options })
  if (consumerRoot) {
    const inputs = Object.keys(result.metafile.inputs).map(p => resolve(resolveDir, p))
    assert.ok(inputs.some(p => p.startsWith(resolve(consumerRoot, 'node_modules/@antadesign/anta/dist') + '/')))
    assert.ok(!inputs.some(p => p.startsWith(source + '/')), 'Installed package has no source aliases')
  }
  return result
}
function save(result, name) {
  for (const file of result.outputFiles) assets.set(`/${name}.${file.path.endsWith('.css') ? 'css' : 'js'}`, file.text)
}
before(async () => {
  console.log('Panel imports:', consumerRoot ? `installed package at ${consumerRoot}` : 'workspace source')
  for (const mode of ['granular', 'bundle']) {
    const contents = mode === 'bundle' ? `import '${base}/bundle'; ${consumerRoot ? `import '${base}/bundle.css';` : ''}` :
      `import '${base}/tokens.css'; import '${base}/reset.css'; ${['a-panel','a-button','a-icon','a-input','a-menu','a-dialog'].map(e => `import '${base}/elements/${e}';`).join('\n')}`
    save(await compile({stdin:{contents, resolveDir}, outfile:`${mode}.js`, format:'esm', alias:{react:compat}}), mode)
  }
  for (const framework of ['React', 'Preact']) {
    const react = framework === 'React'
    const alias = {...jsxAlias, ...(react ? consumerRoot ? {} : {react:resolve('node_modules/react')} : {react:compat})}
    const result = await compile({stdin:{contents:`${imports} ${factory}
      ${react ? "import {renderToString} from 'react-dom/server'" : "import renderToString from 'preact-render-to-string'"};
      export const render = props => renderToString(app(props));`, resolveDir}, platform:'node', format:'cjs',
      jsx:'automatic', jsxImportSource:'@antadesign/anta', alias:{...alias, ...(consumerRoot ? {} : react ? {'react-dom/server':requirePlot.resolve('react-dom/server')} : {'preact-render-to-string':requireRenderer.resolve('preact-render-to-string')})}})
    const compiled = new Module(resolve(`tests/panel-${framework}-server.cjs`))
    compiled._compile(result.outputFiles[0].text, compiled.id)
    renderers.set(framework, compiled.exports.render)
    save(await compile({stdin:{contents:`${imports}
      ${react ? "import {createRoot, hydrateRoot} from 'react-dom/client'" : "import {render, hydrate} from 'preact'"};
      ${factory} let root; window.recoverableErrors=[]; window.reports=[];
      const handlers = version => ({onStateChange:(e,d)=>{reports.push([version,d]);if(window.veto)e.preventDefault()}});
      const commit = node => { ${react ? "root ??= createRoot(document.querySelector('#mount')); root.render(node)" : "render(node,document.querySelector('#mount'))"} };
      window.hydratePanel = () => {
        configure(React.createElement, React.Fragment, React, {hydratingEvents:true});
        ${react ? "root=hydrateRoot(document.querySelector('#mount'),app({...handlers('first'),defaultMaximized:document.querySelector('a-panel').hasAttribute('default-state')}),{onRecoverableError:e=>recoverableErrors.push(e.message)})" : "hydrate(app({...handlers('first'),defaultMaximized:document.querySelector('a-panel').hasAttribute('default-state')}),document.querySelector('#mount'))"}
      };
      window.renderPanel = (props={}, version='second') => commit(app({...handlers(version),...props}));
      window.clearPanel = () => commit(null);
    `, resolveDir},outfile:`${framework}.js`,format:'esm',jsx:'automatic',jsxImportSource:'@antadesign/anta',
      define:{'process.env.NODE_ENV':'"production"'},alias:{...alias,...(react&&!consumerRoot?{'react-dom/client':requirePlot.resolve('react-dom/client')}: {})}}),framework)
  }
  assets.set('/boot.js', `window.violations=[];window.requests=[];
    document.addEventListener('securitypolicyviolation',e=>violations.push({directive:e.effectiveDirective,source:e.sourceFile}));
    document.addEventListener('statechange',e=>requests.push({id:e.target.id,...e.detail}),true);`)
  assets.set('/fixture.css', `body{margin:24px;font:16px/20px system-ui} .workspace{width:360px;transform:translateX(10px);overflow:hidden}
    a-panel{height:auto;background:rgb(220,230,240);color:rgb(20,30,40)} .content{height:180px;overflow:auto;padding:12px}
    .long{height:900px;width:1200px} body.max-scroll .content{overflow:visible} .bounded{width:320px;height:180px} .bounded>a-panel{height:100%;padding:8px;border:2px solid}
    .flex{display:flex}.grid{display:grid;grid-template-columns:1fr} .rtl{direction:rtl}
    .scrollbars{overflow:scroll} .scrollbars::-webkit-scrollbar{width:12px;height:12px}
    .override::part(content):popover-open{inset:16px;padding:24px;background:rgb(230,240,250);overflow:scroll}
    .override::part(content)::backdrop{background:rgb(10,20,30)}
    .override::part(placeholder){outline:3px solid rgb(10,20,30)}
    @layer base {.base-override::part(content):popover-open{padding:30px}}
    @layer components {.layer-override::part(content):popover-open{padding:32px}}
    .normal-override::part(content){display:block;padding:10px}`)
  if (!consumerRoot && componentTier === 'slow') {
    save(await build({stdin:{contents:`import '${source}/tokens.css';import '${source}/reset.css';import '${source}/elements/a-panel';`,resolveDir},bundle:true,write:false,outfile:'original.js',format:'esm',target:'es2022',nodePaths,alias:{...jsxAlias,react:compat},plugins:[{
      name:'original-panel',setup(build){for(const ext of ['ts','css']) build.onLoad({filter:new RegExp('/a-panel\\.'+ext+'$')},()=>({contents:execFileSync('git',['show',`aa014ae37fe99b91a422fa6827a9267d7f50ea3b:src/elements/a-panel.${ext}`],{encoding:'utf8'}),loader:ext}))},
    }]}),'original')
  }
  server = createServer((req,res) => {
    const url = new URL(req.url,'http://localhost'), mode = url.searchParams.get('mode') ?? 'granular'
    res.setHeader('Content-Security-Policy',url.searchParams.has('capture') || url.searchParams.has('original') ? policy.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'") : policy)
    res.setHeader('Content-Type',`${url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html'}; charset=utf-8`)
    const props = url.searchParams.has('initial-maximized') ? {defaultMaximized:true} : {}
    res.end(assets.get(url.pathname) ?? `<!doctype html><link rel="stylesheet" href="/${url.searchParams.has('original')?'original':mode}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><button id="opener">Outside</button><main id="mount">${url.searchParams.has('ssr') ? renderers.get(url.searchParams.get('framework')??'React')(props) : ''}</main>`)
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`
  for(const engine of engines) browsers.set(engine,await engine.launch({headless:true,...(engine===chromium?{
    ...(process.env.ANTA_PANEL_CHROMIUM_EXECUTABLE?{executablePath:process.env.ANTA_PANEL_CHROMIUM_EXECUTABLE}:{channel:process.env.CAPTURE_TEST_BROWSER_CHANNEL||undefined}),ignoreDefaultArgs:['--hide-scrollbars']}: {})}))
  console.log('Panel browser coverage:',JSON.stringify([...browsers].map(([e,b])=>({engine:e.name(),version:b.version()}))))
})
after(async()=>{await Promise.all([...browsers.values()].map(b=>b.close()));if(server)await new Promise(r=>server.close(r))})
async function pageFor(t,engine,mode,query='') {
  const page=await browsers.get(engine).newPage({viewport:{width:800,height:600}});page.setDefaultTimeout(8000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const response=await page.goto(`${origin}/?mode=${mode}${query}`)
  assert.equal(response.headers()['content-security-policy'],policy)
  t.after(async()=>{try{assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.violations),[])}finally{await page.close()}})
  return page
}
const register=(page,mode)=>page.evaluate(mode=>import(`/${mode}.js`),mode)
const raw=(attributes='')=>`<div class="workspace"><a-panel id="panel" ${attributes}><div class="content"><input id="draft" value="Original"><button id="last">Last</button><div class="long">Scrollable content</div></div></a-panel><p id="neighbor">Next pane</p></div>`
const mount=(page,html=raw())=>page.locator('#mount').evaluate((n,html)=>{n.innerHTML=html},html)
const maximized=(page,selector='#panel')=>page.locator(selector).evaluate(el=>el.matches(':state(maximized)'))
const request=(page,method='requestMaximize',selector='#panel')=>page.locator(selector).evaluate((el,m)=>el[m](),method)
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
const metrics=page=>page.evaluate(()=>{
  const panel=document.querySelector('#panel'), shadow=panel.shadowRoot
  return [panel,shadow.querySelector('[part="content"]'),shadow.querySelector('[part="placeholder"],.placeholder'),panel.firstElementChild,document.querySelector('#neighbor')].map(n=>{
    const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {x:r.x,y:r.y,width:r.width,height:r.height,display:s.display,position:s.position,overflow:s.overflow,padding:s.padding,background:s.backgroundColor,color:s.color,boxSizing:s.boxSizing,font:s.font}
  })
})

test.fast('Panel SSR contains authored content and state without fixed style attributes',()=>{
  for(const render of renderers.values()) {
    assert.doesNotMatch(render({defaultMaximized:true}),/style=|<slot|part=/)
    assert.match(render({defaultMaximized:true}),/default-state="maximized"/)
    assert.match(render({maximized:false}),/state="normal"/)
  }
})
for(const engine of engines)for(const mode of ['granular','bundle']) {
  const name=`${engine.name()} ${mode}`
  test.fast(`${name}: external defaults preserve top layer, layout, owned dimensions and focus`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page);await register(page,mode)
    const before=await metrics(page)
    assert.equal(before[1].display,'contents');assert.equal(before[2].display,'none')
    await page.evaluate(()=>{window.authored=document.querySelector('#panel').outerHTML;window.field=document.querySelector('#draft');window.surface=document.querySelector('#panel').shadowRoot.querySelector('slot')})
    await page.locator('#draft').fill('Retained');await page.locator('#opener').focus()
    await page.evaluate(()=>{window.focusSizes=[];document.addEventListener('focusin',()=>focusSizes.push(document.querySelector('#panel').getBoundingClientRect().height))})
    await request(page)
    assert.ok((await page.evaluate(()=>focusSizes)).every(height=>height===180), 'Native focus entry preserves the normal layout')
    const after=await metrics(page)
    assert.deepEqual(after[0],before[0]);assert.deepEqual(after[4],before[4])
    assert.deepEqual([after[1].x,after[1].y,after[1].width,after[1].height],[0,0,800,600])
    assert.equal(after[1].overflow,'auto');assert.equal(after[1].background,before[0].background)
    assert.equal(after[2].display,'block')
    assert.deepEqual(await page.locator('#panel').evaluate(el=>({parts:[...el.shadowRoot.children].map(n=>n.getAttribute('part')),sheets:el.shadowRoot.querySelectorAll('style,link').length,adopted:el.shadowRoot.adoptedStyleSheets.length,dimensions:el.shadowRoot.querySelector('[part="placeholder"]').style.width,backdrop:getComputedStyle(el.shadowRoot.querySelector('slot'),'::backdrop').pointerEvents})),{parts:['placeholder','content'],sheets:0,adopted:0,dimensions:'360px',backdrop:'none'})
    assert.equal(await page.locator('#draft').evaluate(el=>el===document.activeElement),true)
    await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#last').evaluate(el=>el===document.activeElement),true)
    await page.keyboard.press('Tab');assert.equal(await page.locator('#draft').evaluate(el=>el===document.activeElement),true)
    await page.keyboard.press('Escape');assert.equal(await maximized(page),true)
    await page.locator('#opener').focus();assert.equal(await page.locator('#draft').evaluate(el=>el===document.activeElement),true)
    assert.ok(await page.locator('#panel').evaluate(el=>{document.body.classList.add('max-scroll');const s=el.shadowRoot.querySelector('slot');s.scrollTop=100;s.scrollLeft=50;const scrolled=s.scrollTop===100&&s.scrollLeft===50;document.body.classList.remove('max-scroll');return scrolled}))
    await request(page,'requestRestore');assert.deepEqual(await metrics(page),before)
    assert.equal(await page.locator('#draft').inputValue(),'Retained')
    assert.equal(await page.evaluate(()=>field===document.querySelector('#draft')&&surface===document.querySelector('#panel').shadowRoot.querySelector('slot')&&authored===document.querySelector('#panel').outerHTML),true)
    assert.equal(await page.locator('#opener').evaluate(el=>el===document.activeElement),true)
  })
  test.fast(`${name}: controlled requests, vetoes, native toggles, nesting and reconnect retain state`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page,raw('state="normal"'));await register(page,mode)
    await request(page);assert.equal(await maximized(page),false)
    assert.deepEqual(await page.evaluate(()=>requests),[{id:'panel',next:'maximized',prev:'normal'}])
    await page.locator('#panel').evaluate(el=>el.setAttribute('state','maximized'));assert.equal(await maximized(page),true)
    await request(page,'requestRestore');assert.equal(await maximized(page),true)
    await page.locator('#panel').evaluate(el=>el.shadowRoot.querySelector('slot').hidePopover())
    await page.waitForFunction(()=>document.querySelector('#panel').shadowRoot.querySelector('slot').matches(':popover-open'))
    await page.locator('#panel').evaluate(el=>el.removeAttribute('state'))
    await page.evaluate(()=>{const n=document.createElement('a-panel');n.id='nested';n.innerHTML='<input id="nested-first"><button id="nested-last">Last</button>';document.querySelector('.content').append(n)})
    await request(page,'requestMaximize','#nested');assert.equal(await maximized(page),true)
    await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#nested-last').evaluate(el=>el===document.activeElement),true)
    await page.locator('#nested').evaluate(el=>el.dispatchEvent(new CustomEvent('paneltoggle',{bubbles:true,composed:true})))
    assert.equal(await maximized(page,'#nested'),false);assert.equal(await maximized(page),true)
    await request(page,'requestRestore');assert.equal(await maximized(page),false)
    await page.locator('#panel').evaluate(el=>el.addEventListener('statechange',e=>e.preventDefault(),{once:true}))
    await request(page);assert.equal(await maximized(page),false)
    await request(page)
    await page.evaluate(()=>{window.saved=document.querySelector('#panel');saved.remove()});await page.locator('#opener').focus()
    assert.equal(await page.locator('#opener').evaluate(el=>el===document.activeElement),true)
    await page.evaluate(()=>document.querySelector('.workspace').prepend(saved));await frames(page)
    assert.equal(await maximized(page),true)
    await request(page,'requestRestore');assert.equal(await maximized(page),false)
  })
  test.fast(`${name}: opening failures restore layout, content, and the previous focus scope`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page);await register(page,mode)
    const before=await metrics(page)
    await page.locator('#draft').fill('Retained after failure')
    await page.evaluate(()=>{window.authored=document.querySelector('#panel').outerHTML;window.field=document.querySelector('#draft')})
    const fail=selector=>page.locator(selector).evaluate(el=>{
      const slot=el.shadowRoot.querySelector('slot'),open=slot.showPopover
      const failure=new DOMException('Opening failed','InvalidStateError')
      slot.showPopover=()=>{throw failure}
      try {el.requestMaximize();return false}
      catch(error) {return error===failure}
      finally {slot.showPopover=open}
    })
    assert.equal(await fail('#panel'),true,'The original native error is preserved')
    assert.equal(await maximized(page),false)
    assert.deepEqual(await metrics(page),before)
    assert.equal(await page.locator('#panel').evaluate(el=>{const s=el.shadowRoot.querySelector('slot');return !s.hasAttribute('popover')&&!s.hasAttribute('tabindex')}),true)
    assert.equal(await page.evaluate(()=>authored===document.querySelector('#panel').outerHTML&&field===document.querySelector('#draft')),true)
    assert.equal(await page.locator('#draft').inputValue(),'Retained after failure')
    // Native beforetoggle cancellation also returns without opening the popover.
    await page.locator('#panel').evaluate(el=>el.shadowRoot.querySelector('slot').addEventListener('beforetoggle',e=>e.preventDefault(),{once:true}))
    await request(page);assert.equal(await maximized(page),false)
    assert.deepEqual(await metrics(page),before)
    await request(page);assert.equal(await maximized(page),true)
    await page.evaluate(()=>{
      const failed=document.createElement('a-panel');failed.id='failed'
      failed.innerHTML='<input id="failed-field">';document.querySelector('#mount').append(failed)
    })
    await page.locator('#draft').focus()
    assert.equal(await fail('#failed'),true)
    await page.locator('#opener').focus()
    assert.equal(await page.locator('#draft').evaluate(el=>el===document.activeElement),true,'An earlier Panel still owns focus')
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.locator('#last').evaluate(el=>el===document.activeElement),true)
    await request(page,'requestRestore');await page.locator('#failed').evaluate(el=>el.remove())
    await page.locator('#opener').focus()
    assert.equal(await page.locator('#opener').evaluate(el=>el===document.activeElement),true)
    assert.deepEqual(await metrics(page),before)
  })
  test(`${name}: external consumer overrides and layer precedence reach both parts and backdrop`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page);await register(page,mode)
    for(const [cls,padding] of [['base-override','0px'],['layer-override','32px'],['override','24px']]) {
      await page.locator('#panel').evaluate((el,cls)=>el.className=cls,cls);await request(page)
      assert.equal((await metrics(page))[1].padding,padding)
      if(cls==='override') {
        const m=await metrics(page);assert.deepEqual([m[1].x,m[1].y,m[1].width,m[1].height],[16,16,768,568])
        assert.equal(m[1].background,'rgb(230, 240, 250)')
        assert.deepEqual(await page.locator('#panel').evaluate(el=>{const s=getComputedStyle(el.shadowRoot.querySelector('slot'),'::backdrop');return [s.backgroundColor,s.pointerEvents]}),['rgb(10, 20, 30)','none'])
      }
      await request(page,'requestRestore')
    }
    await page.locator('#panel').evaluate(el=>el.className='normal-override')
    assert.equal((await metrics(page))[1].display,'block');assert.equal((await metrics(page))[1].padding,'10px')
  })
  test(`${name}: consumer shadow roots load their own external stylesheet`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    const result=await page.locator('#mount').evaluate(async (mount,mode)=>{
      const root=mount.attachShadow({mode:'open'})
      const link=document.createElement('link');link.rel='stylesheet';link.href=`/${mode}.css`
      await new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=reject;root.append(link)})
      const panel=document.createElement('a-panel');panel.innerHTML='<input value="Nested root">';root.append(panel)
      await new Promise(queueMicrotask);panel.requestMaximize()
      const slot=panel.shadowRoot.querySelector('slot'),r=slot.getBoundingClientRect()
      const maximized=[r.x,r.y,r.width,r.height,getComputedStyle(slot).overflow]
      panel.requestRestore()
      return {maximized,normal:getComputedStyle(slot).display,sheets:panel.shadowRoot.adoptedStyleSheets.length}
    },mode)
    assert.deepEqual(result,{maximized:[0,0,800,600,'auto'],normal:'contents',sheets:0})
  })
  test(`${name}: forced colors and independent import orders retain viewport layout`,async t=>{
    const page=await pageFor(t,engine,mode);await page.emulateMedia({forcedColors:'active'})
    await mount(page);await register(page,mode);await register(page,mode==='bundle'?'granular':'bundle');await request(page)
    const m=await metrics(page);assert.deepEqual([m[1].x,m[1].y,m[1].width,m[1].height],[0,0,800,600])
    await request(page,'requestRestore');assert.equal((await metrics(page))[1].display,'contents')
  })
  for(const layout of ['bounded','flex','grid','rtl','scrollbars']) test(`${name}: ${layout} placeholder preserves dimensions through repeated cycles`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page);await register(page,mode)
    await page.evaluate(layout=>{
      const p=document.querySelector('#panel');if(layout==='bounded')p.parentElement.classList.add(layout)
      else if(layout==='scrollbars')p.classList.add(layout);else p.parentElement.classList.add(layout)
    },layout)
    const before=await metrics(page)
    for(let i=0;i<3;i++) {await request(page);let m=await metrics(page);assert.deepEqual(m[0],before[0]);assert.deepEqual(m[4],before[4]);await request(page,'requestRestore');assert.deepEqual(await metrics(page),before)}
  })
  for(const framework of ['React','Preact'])for(const initial of [false,true]) test.fast(`${name}: ${framework} hydrates ${initial?'maximized':'normal'} SSR and retains callbacks and content`,async t=>{
    const page=await pageFor(t,engine,mode,`&ssr&framework=${framework}${initial?'&initial-maximized':''}`)
    const pre=await page.locator('#panel').boundingBox();await register(page,mode)
    await page.evaluate(()=>{window.host=document.querySelector('#panel');window.field=document.querySelector('#draft');field.value='Draft before hydration'})
    await page.evaluate(framework=>import(`/${framework}.js`),framework);await page.evaluate(()=>hydratePanel());await frames(page)
    assert.equal(await maximized(page),initial)
    if(!initial)assert.deepEqual(await page.locator('#panel').boundingBox(),pre)
    await request(page,initial?'requestRestore':'requestMaximize')
    assert.deepEqual(await page.evaluate(()=>reports),[['first',{next:!initial,prev:initial}]])
    await page.evaluate(()=>{window.veto=true;renderPanel({},'replacement')});await frames(page)
    await request(page,initial?'requestMaximize':'requestRestore')
    assert.deepEqual(await page.evaluate(()=>reports.at(-1)),['replacement',{next:initial,prev:!initial}])
    assert.equal(await maximized(page),!initial)
    assert.equal(await page.evaluate(()=>host===document.querySelector('#panel')&&field===document.querySelector('#draft')),true)
    assert.equal(await page.locator('#draft').inputValue(),'Draft before hydration')
    assert.deepEqual(await page.evaluate(()=>recoverableErrors),[])
    await page.evaluate(()=>{window.veto=false;renderPanel({maximized:false})});await frames(page);assert.equal(await maximized(page),false)
    await request(page);assert.equal(await maximized(page),false)
    await page.evaluate(()=>renderPanel({maximized:true}));await frames(page);assert.equal(await maximized(page),true)
    await page.evaluate(()=>clearPanel());await frames(page);await page.locator('#opener').focus()
    assert.equal(await page.locator('#opener').evaluate(el=>el===document.activeElement),true)
  })
  if(!consumerRoot) test(`${name}: appearance and layout match the starting implementation`,async t=>{
    const directory=resolve('tests/.test-output/panel',engine.name(),mode);await mkdir(directory,{recursive:true})
    const records=[]
    for(const layout of ['normal','bounded','flex','grid','rtl','scrollbars']) {
      const values=[],screenshots=[]
      for(const original of [true,false]) {
        const page=await browsers.get(engine).newPage({viewport:{width:800,height:600}})
        try {
          await page.goto(`${origin}/?mode=${mode}${original?'&original':''}${engine===webkit?'&capture':''}`)
          await mount(page);await register(page,original?'original':mode)
          await page.evaluate(layout=>{const p=document.querySelector('#panel');if(layout==='scrollbars')p.classList.add(layout);else if(layout!=='normal')p.parentElement.classList.add(layout)},layout)
          const states=[],images=[]
          for(const state of ['normal','maximized','restored']) {
            if(state==='maximized')await request(page)
            if(state==='restored')await request(page,'requestRestore')
            states.push(await metrics(page))
            await page.locator('#draft').evaluate(el=>el.setSelectionRange(0,0))
            images.push(await page.screenshot({path:join(directory,`${layout}-${state}-${original?'original':'current'}.png`)}))
          }
          values.push(states);screenshots.push(images)
        } finally {await page.close()}
      }
      records.push({layout,original:values[0],current:values[1]})
      for(let state=0;state<3;state++) assert.deepEqual(PNG.sync.read(screenshots[1][state]).data,PNG.sync.read(screenshots[0][state]).data,`${layout}/${state}: rendered pixels`)
      assert.deepEqual(values[1],values[0],layout)
    }
    await writeFile(join(directory,'metrics.json'),JSON.stringify(records,null,2))
  })
}
