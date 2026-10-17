import assert from 'node:assert/strict'
import { before, after } from 'node:test'
import { componentTest as test, componentEngines, componentTier } from './component-tier.mjs'
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
const consumerRoot = process.env.ANTA_DIALOG_CONSUMER_ROOT ? resolve(process.env.ANTA_DIALOG_CONSUMER_ROOT) : undefined
const source = resolve('src'), resolveDir = consumerRoot ?? process.cwd()
const base = consumerRoot ? '@antadesign/anta' : source
const nodePaths = [resolve(consumerRoot ?? '.', 'node_modules'), resolve('site/node_modules')]
const compat = consumerRoot ? 'preact/compat' : requireSite.resolve('preact/compat')
const jsxAlias = consumerRoot ? {} : { '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime') }
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'"
const assets = new Map(), browsers = new Map(), renderers = new Map()
let server, origin
const imports = `import React from 'react'; import { Dialog, Button, configure } from '${consumerRoot ? '@antadesign/anta' : `${source}/index`}';`
const factory = `const app = (props = {}) => React.createElement(Dialog, {
  header:'Edit project', footer:React.createElement(Button,{label:'Save'}), ...props
}, React.createElement('input',{id:'draft',defaultValue:'Original'}));`
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
  console.log('Dialog imports:', consumerRoot ? `installed package at ${consumerRoot}` : 'workspace source')
  for (const mode of ['granular', 'bundle']) {
    const contents = mode === 'bundle' ? `import '${base}/bundle'; ${consumerRoot ? `import '${base}/bundle.css';` : ''}` :
      `import '${base}/tokens.css'; import '${base}/reset.css'; ${['a-dialog','a-button','a-icon','a-input'].map(e => `import '${base}/elements/${e}';`).join('\n')}`
    save(await compile({stdin:{contents, resolveDir}, outfile:`${mode}.js`, format:'esm', alias:{react:compat}}), mode)
    // Reject the actual selectors in served CSS, including their feature queries.
    // Stubbing JS CSS.supports would not change how the stylesheet is evaluated.
    for (const feature of ['open', 'modal', 'backdrop']) {
      const selector = `a-dialog::part(dialog):${feature === 'open' ? 'open' : 'modal'}${feature === 'backdrop' ? '::backdrop' : ''}`
      const css = assets.get(`/${mode}.css`)
      assert.ok(css.includes(selector))
      assets.set(`/${mode}-${feature}-unsupported.css`, css.replaceAll(selector, selector.replace(feature === 'open' ? ':open' : ':modal', ':anta-unsupported-state')))
    }
  }
  for (const framework of ['React', 'Preact']) {
    const react = framework === 'React'
    const alias = {...jsxAlias, ...(react ? consumerRoot ? {} : {react:resolve('node_modules/react')} : {react:compat})}
    const result = await compile({stdin:{contents:`${imports} ${factory}
      ${react ? "import {renderToString} from 'react-dom/server'" : "import renderToString from 'preact-render-to-string'"};
      export const render = props => renderToString(app(props));`, resolveDir}, platform:'node', format:'cjs',
      jsx:'automatic', jsxImportSource:'@antadesign/anta', alias:{...alias, ...(consumerRoot ? {} : react ? {'react-dom/server':requirePlot.resolve('react-dom/server')} : {'preact-render-to-string':requireRenderer.resolve('preact-render-to-string')})}})
    const compiled = new Module(resolve(`tests/dialog-${framework}-server.cjs`))
    compiled._compile(result.outputFiles[0].text, compiled.id)
    renderers.set(framework, compiled.exports.render)
    save(await compile({stdin:{contents:`${imports}
      ${react ? "import {createRoot, hydrateRoot} from 'react-dom/client'" : "import {render, hydrate} from 'preact'"};
      ${factory} let root; window.recoverableErrors=[]; window.reports=[];
      const handlers = version => ({onStateChange:(e,d)=>{reports.push([version,d]);if(window.veto)e.preventDefault()}});
      const commit = node => { ${react ? "root ??= createRoot(document.querySelector('#mount')); root.render(node)" : "render(node,document.querySelector('#mount'))"} };
      window.hydrateDialog = () => {
        configure(React.createElement, React.Fragment, React, {hydratingEvents:true});
        ${react ? "root=hydrateRoot(document.querySelector('#mount'),app({...handlers('first'),defaultOpen:document.querySelector('a-dialog').hasAttribute('default-state')}),{onRecoverableError:e=>recoverableErrors.push(e.message)})" : "hydrate(app({...handlers('first'),defaultOpen:document.querySelector('a-dialog').hasAttribute('default-state')}),document.querySelector('#mount'))"}
      };
      window.renderDialog = (props={}, version='second') => commit(app({...handlers(version),...props}));
      window.clearDialog = () => commit(null);
      window.renderDirectDialog = () => {configure(React.createElement,React.Fragment,React);renderDialog()};
    `, resolveDir},outfile:`${framework}.js`,format:'esm',jsx:'automatic',jsxImportSource:'@antadesign/anta',
      define:{'process.env.NODE_ENV':'"production"'},alias:{...alias,...(react&&!consumerRoot?{'react-dom/client':requirePlot.resolve('react-dom/client')}: {})}}),framework)
  }
  assets.set('/boot.js', `window.violations=[];window.requests=[];window.nativeEvents=[];window.clickListeners=new Set();
    const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);
    document.addEventListener=(type,fn,...args)=>{if(type==='click')clickListeners.add(fn);return add(type,fn,...args)};
    document.removeEventListener=(type,fn,...args)=>{if(type==='click')clickListeners.delete(fn);return remove(type,fn,...args)};
    document.addEventListener('securitypolicyviolation',e=>violations.push({directive:e.effectiveDirective,source:e.sourceFile}));
    document.addEventListener('statechange',e=>requests.push({id:e.target.id,...e.detail}),true);
    window.watchNative=host=>{const d=host.shadowRoot.querySelector('dialog');for(const type of ['close','cancel'])d.addEventListener(type,e=>nativeEvents.push({type,canceled:e.defaultPrevented}));};`)
  assets.set('/fixture.css', `body{margin:0;font-family:system-ui} #mount{padding:24px}
    .clip{overflow:hidden;contain:paint;transform:translate(20px,10px);width:120px;height:40px}
    .override::part(dialog){width:600px;border-radius:24px;background:rgb(230,240,250)}
    .override::part(header){padding:24px;font-size:20px}
    .override::part(body){padding:12px 24px}
    .override::part(footer){justify-content:space-between}
    .override::part(dialog)::backdrop{background:rgb(0 0 0 / .6)}
    .motion-override::part(dialog){transition-duration:400ms}
    .motion-override::part(dialog):modal{opacity:.8}
    iframe{width:700px;height:450px;border:0} .long{height:1500px} .generic span{display:block;padding:13px}`)
  assets.set('/layer-overrides.css', `@layer base, anta, components, utilities;
    @layer base {
      .base-override::part(dialog){width:640px}
      .base-override::part(body){padding:0}
    }
    @layer components {
      .layer-override::part(dialog){width:640px}
      .layer-override::part(body){padding:0}
      .layer-override:state(has-close)::part(header){padding-inline-end:64px}
    }`)
  if (!consumerRoot && process.env.ANTA_DIALOG_COMPARE_ORIGINAL === '1') {
    save(await build({stdin:{contents:`import '${source}/tokens.css';import '${source}/reset.css';import '${source}/elements/a-dialog';`,resolveDir},bundle:true,write:false,outfile:'original.js',format:'esm',target:'es2022',nodePaths,alias:{...jsxAlias,react:compat},plugins:[{
      name:'original-dialog',setup(build){for(const ext of ['ts','css']) build.onLoad({filter:new RegExp('/a-dialog\\.'+ext+'$')},()=>({contents:execFileSync('git',['show',`aeea7c08:src/elements/a-dialog.${ext}`],{encoding:'utf8'}),loader:ext}))},
    }]}),'original')
  }
  server = createServer((req,res) => {
    const url = new URL(req.url,'http://localhost'), mode = url.searchParams.get('mode') ?? 'granular'
    const comparison = url.searchParams.has('original')
    res.setHeader('Content-Security-Policy',(comparison || url.searchParams.has('capture')) ? policy.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'") : policy)
    res.setHeader('Content-Type',`${url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html'}; charset=utf-8`)
    const props = url.searchParams.has('initial-open') ? {defaultOpen:true} : {}
    const sheet = comparison ? 'original' : `${mode}${url.searchParams.has('unsupported') ? `-${url.searchParams.get('unsupported')}-unsupported` : ''}`
    res.end(assets.get(url.pathname) ?? `<!doctype html><link rel="stylesheet" href="/${sheet}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><main id="mount">${url.searchParams.has('ssr') ? renderers.get(url.searchParams.get('framework')??'React')(props) : ''}</main>`)
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`
  for(const engine of engines) browsers.set(engine,await engine.launch({headless:true,...(engine===chromium?{
    ...(process.env.ANTA_DIALOG_CHROMIUM_EXECUTABLE?{executablePath:process.env.ANTA_DIALOG_CHROMIUM_EXECUTABLE}:{channel:process.env.CAPTURE_TEST_BROWSER_CHANNEL||undefined})}: {})}))
  console.log('Dialog browser coverage:',JSON.stringify([...browsers].map(([e,b])=>({engine:e.name(),version:b.version()}))))
})
after(async()=>{await Promise.all([...browsers.values()].map(b=>b.close()));if(server)await new Promise(r=>server.close(r))})
async function pageFor(t,engine,mode,query='') {
  const page=await browsers.get(engine).newPage({viewport:{width:800,height:500},reducedMotion:componentTier==='fast'?'reduce':'no-preference'});page.setDefaultTimeout(8000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const response=await page.goto(`${origin}/?mode=${mode}${query}`)
  assert.equal(response.headers()['content-security-policy'],policy)
  t.after(async()=>{try{assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.violations),[])}finally{await page.close()}})
  return page
}
const register=(page,mode)=>page.evaluate(mode=>import(`/${mode}.js`),mode)
const raw=(attributes='',content='<h2 slot="header">Edit project</h2><input id="field"><button id="last" slot="footer">Save</button><button slot="close" data-dialog-close="example">Close</button>')=>`<button id="opener" data-dialog-open="example">Open</button><a-dialog id="dialog" name="example" ${attributes}>${content}</a-dialog>`
const mount=(page,html=raw())=>page.locator('#mount').evaluate((n,html)=>{n.innerHTML=html},html)
const native=(page,selector='#dialog')=>page.locator(selector).locator('dialog').first()
const applied=(page,selector='#dialog')=>page.locator(selector).evaluate(el=>el.open)
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
async function settled(page,selector='#dialog') {
  await page.waitForFunction(selector=>{const d=document.querySelector(selector)?.shadowRoot?.querySelector('dialog');return d&&+getComputedStyle(d).opacity===1&&d.getAnimations().every(a=>a.playState==='finished')},selector)
}
async function closed(page,selector='#dialog') {
  await page.waitForFunction(selector=>{const d=document.querySelector(selector)?.shadowRoot?.querySelector('dialog');return d&&!d.open&&getComputedStyle(d).display==='none'},selector)
}
const metrics=(page,selector='#dialog')=>page.locator(selector).evaluate(el=>{
  const nodes=[el.shadowRoot.querySelector('dialog'),...el.shadowRoot.querySelectorAll('slot')];
  return nodes.map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {tag:n.localName,slot:n.name??'',x:r.x,y:r.y,width:r.width,height:r.height,display:s.display,padding:s.padding,borderRadius:s.borderRadius,background:s.backgroundColor,color:s.color,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,overflow:s.overflow,flexDirection:s.flexDirection}})
})

test.fast('Dialog SSR retains native slots and emits no fixed style attributes',()=>{
  for(const render of renderers.values()){
    const html=render({defaultOpen:true});assert.match(html,/<a-dialog[^>]*default-state="open"/)
    assert.match(html,/<a-dialog-close slot="close">/);assert.match(html,/<a-dialog-footer slot="footer">/)
    assert.doesNotMatch(html,/style=|<dialog[ >]|part=/)
  }
})
for(const engine of engines)for(const mode of ['granular','bundle']) {
  const name=`${engine.name()} ${mode}`
  test.fast(`${name}: raw modal retains structure, authored DOM, focus entry, keyboard close and restoration`,async t=>{
    const page=await pageFor(t,engine,mode);await mount(page)
    assert.equal(await page.locator('#dialog').evaluate(el=>getComputedStyle(el).display),'none')
    await register(page,mode);const initial=await page.locator('#mount').innerHTML()
    await page.evaluate(()=>{window.authored=[];new MutationObserver(rs=>authored.push(...rs.map(r=>r.type))).observe(document.querySelector('#mount'),{subtree:true,attributes:true,childList:true,characterData:true});watchNative(document.querySelector('#dialog'))})
    await page.locator('#opener').focus();await page.keyboard.press('Enter');await settled(page)
    assert.equal(await native(page).evaluate(d=>d.matches(':modal')&&d.getRootNode().activeElement===d),true)
    assert.deepEqual(await page.locator('#dialog').evaluate(el=>({children:el.shadowRoot.children.length,sheets:el.shadowRoot.querySelectorAll('style,link').length,slots:[...el.shadowRoot.querySelectorAll('slot')].map(s=>s.name)})),{children:1,sheets:0,slots:['header','','footer','close']})
    assert.deepEqual(await page.locator('#dialog').evaluate(el=>[...el.shadowRoot.querySelectorAll('slot')].map(s=>[...s.part].sort())),[
      ['header'],['body'],['footer'],['close'],
    ])
    assert.equal(await native(page).getAttribute('aria-label'),'Edit project')
    await page.keyboard.press('Tab');assert.equal(await page.locator('#field').evaluate(el=>el===document.activeElement),true)
    await page.keyboard.press('Escape');await closed(page)
    assert.equal(await page.locator('#opener').evaluate(el=>el===document.activeElement),true)
    assert.deepEqual(await page.evaluate(()=>requests.map(r=>r.next)),['open','closed'])
    await page.waitForFunction(()=>nativeEvents.some(e=>e.type==='close'))
    assert.deepEqual(await page.evaluate(()=>nativeEvents.map(e=>e.type)),['cancel','close'])
    assert.equal(await page.locator('#mount').innerHTML(),initial);assert.deepEqual(await page.evaluate(()=>authored),[])
  })
  test.fast(`${name}: controlled rejection, acceptance, veto, native close reconciliation, and persistent dismissal`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,raw('state="open"'));await settled(page)
    await page.keyboard.press('Escape');assert.equal(await applied(page),true)
    await page.locator('#dialog').evaluate(el=>el.addEventListener('statechange',e=>el.setAttribute('state',e.detail.next)))
    await page.keyboard.press('Escape');await closed(page)
    await page.locator('#dialog').evaluate(el=>{el.setAttribute('state','open');window.count=requests.length;el.shadowRoot.querySelector('dialog').close()})
    await page.waitForFunction(()=>document.querySelector('#dialog').open);assert.equal(await page.evaluate(()=>requests.length===count),true)
    await page.locator('#dialog').evaluate(el=>el.setAttribute('state','closed'));await closed(page)
    await mount(page,raw('persistent default-state="open"'));await settled(page);await page.keyboard.press('Escape');assert.equal(await applied(page),true)
    await page.mouse.click(2,2);assert.equal(await applied(page),true)
    await page.locator('#dialog').evaluate(el=>el.addEventListener('statechange',e=>e.preventDefault(),{once:true}))
    await page.locator('#dialog').evaluate(el=>el.close());assert.equal(await applied(page),true)
    await page.locator('#dialog').evaluate(el=>el.close());await closed(page)
  })
  test.fast(`${name}: accessible name follows header edits, reassignment, and reconnects without observing detached content`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,raw('default-state="open"'));await settled(page)
    const label=()=>native(page).getAttribute('aria-label')
    await page.locator('[slot=header]').evaluate(el=>el.firstChild.nodeValue='Renamed project')
    await page.waitForFunction(()=>document.querySelector('#dialog').shadowRoot.querySelector('dialog').getAttribute('aria-label')==='Renamed project')
    await page.locator('[slot=header]').evaluate(el=>{el.innerHTML='<span>Nested title</span>'})
    await page.locator('[slot=header] span').evaluate(el=>el.firstChild.nodeValue='Updated nested title')
    await frames(page);assert.equal(await label(),'Updated nested title')
    await page.evaluate(()=>{window.oldHeader=document.querySelector('[slot=header]');oldHeader.remove();const h=document.createElement('h2');h.slot='header';h.textContent='Replacement';document.querySelector('#dialog').prepend(h)})
    await frames(page);assert.equal(await label(),'Replacement')
    await page.evaluate(()=>oldHeader.textContent='Stale title');await frames(page);assert.equal(await label(),'Replacement')
    await page.evaluate(()=>{window.detachedDialog=document.querySelector('#dialog');detachedDialog.remove()});await frames(page)
    await page.evaluate(()=>detachedDialog.querySelector('[slot=header]').textContent='Detached edit');await frames(page)
    assert.equal(await page.evaluate(()=>detachedDialog.shadowRoot.querySelector('dialog').getAttribute('aria-label')),'Replacement')
    await page.evaluate(()=>document.querySelector('#mount').append(detachedDialog));await settled(page)
    assert.equal(await label(),'Detached edit')
    await page.locator('[slot=header]').evaluate(el=>el.textContent='');await frames(page);assert.equal(await label(),null)
    await page.locator('[slot=header]').evaluate(el=>el.remove());await frames(page);assert.equal(await label(),null)
    assert.equal((await metrics(page))[1].display,'none')
  })
  for(const framework of ['React','Preact'])test.fast(`${name} ${framework}: real SSR hydration preserves nodes and supports controlled updates and callback replacement`,async t=>{
    const page=await pageFor(t,engine,mode,`&ssr&framework=${framework}`);await register(page,mode)
    await page.evaluate(()=>{window.originalHost=document.querySelector('a-dialog');window.originalField=document.querySelector('#draft')})
    await page.evaluate(framework=>import(`/${framework}.js`),framework);await page.evaluate(()=>hydrateDialog());await frames(page)
    await page.evaluate(()=>{window.originalHeader=document.querySelector('[slot=header]');window.originalTitle=originalHeader.firstChild;renderDialog({header:'Updated project'})})
    await page.waitForFunction(()=>document.querySelector('a-dialog').shadowRoot.querySelector('dialog').getAttribute('aria-label')==='Updated project')
    assert.equal(await page.evaluate(()=>originalHeader===document.querySelector('[slot=header]')&&originalTitle===originalHeader.firstChild),true)
    await page.evaluate(()=>renderDialog({open:true}));await settled(page,'a-dialog')
    assert.equal(await native(page,'a-dialog').getAttribute('aria-label'),'Edit project')
    await page.keyboard.press('Escape');await page.waitForFunction(()=>reports.length>0);assert.equal(await applied(page,'a-dialog'),true)
    assert.deepEqual(await page.evaluate(()=>reports.at(-1)),['second',{next:false,prev:true}])
    await page.locator('#draft').fill('Edited');await page.evaluate(()=>renderDialog({open:false}));await closed(page,'a-dialog')
    await page.evaluate(()=>renderDialog({open:true,onStateChange:undefined}));await settled(page,'a-dialog');const count=await page.evaluate(()=>reports.length)
    await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>reports.length),count)
    await page.evaluate(()=>renderDialog({open:true},'third'));await frames(page);await page.keyboard.press('Escape');await page.waitForFunction(()=>reports.at(-1)?.[0]==='third')
    assert.equal(await page.locator('#draft').inputValue(),'Edited');assert.deepEqual(await page.evaluate(()=>recoverableErrors),[])
    assert.equal(await page.evaluate(()=>originalHost===document.querySelector('a-dialog')&&originalField===document.querySelector('#draft')),true)
    assert.deepEqual(await page.locator('a-dialog-close,a-dialog-footer').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).display)),['contents','contents'])
  })
  test.fast(`${name}: missing or late CSS cannot strand a modal or delay native closing`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await page.locator(`link[href="/${mode}.css"]`).evaluate(el=>el.disabled=true);await mount(page)
    await page.locator('#opener').click();assert.equal(await native(page).evaluate(el=>el.open&&+getComputedStyle(el).opacity===1),true)
    await page.keyboard.press('Escape');await closed(page)
    await page.locator(`link[href="/${mode}.css"]`).evaluate(el=>el.disabled=false);await page.locator('#opener').click();await settled(page)
    await page.locator('#dialog').evaluate(el=>el.close());await closed(page)
    await page.locator(`link[href="/${mode}.css"]`).evaluate(el=>el.disabled=true);await page.locator('#opener').click()
    await page.locator(`link[href="/${mode}.css"]`).evaluate(el=>el.disabled=false);await settled(page);await page.keyboard.press('Escape');await closed(page)
  })
  for (const feature of ['open','modal','backdrop']) test.fast(`${name}: unsupported ${feature} selectors keep the native modal visible and usable`,async t=>{
    const page=await pageFor(t,engine,mode,`&unsupported=${feature}`)
    await page.emulateMedia({reducedMotion:'no-preference'});await register(page,mode);await mount(page)
    await page.locator('#opener').focus();await page.keyboard.press('Enter');await settled(page)
    assert.equal(await native(page).evaluate(el=>{
      const rect=el.getBoundingClientRect(),style=getComputedStyle(el)
      return el.matches(':modal')&&style.opacity==='1'&&style.transform==='none'&&rect.width>0&&rect.height>0
    }),true)
    await page.waitForFunction(()=>{
      const el=document.querySelector('#dialog').shadowRoot.querySelector('dialog')
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d')
      ctx.fillStyle=getComputedStyle(el,'::backdrop').backgroundColor;ctx.fillRect(0,0,1,1)
      return ctx.getImageData(0,0,1,1).data[3]>0
    })
    await page.locator('#field').fill('Editable fallback');assert.equal(await page.locator('#field').inputValue(),'Editable fallback')
    await page.keyboard.press('Escape');await closed(page)
    assert.equal(await page.locator('#opener').evaluate(el=>document.activeElement===el),true)
    await page.keyboard.press('Enter');await settled(page)
    await page.locator('[slot=close]').click();await closed(page)
  })
  for (const query of ['', '&unsupported=open']) test.fast(`${name}: native non-modal opening stays visible${query ? ' without :open support' : ''}`,async t=>{
    const page=await pageFor(t,engine,mode,query);await page.emulateMedia({reducedMotion:'no-preference'});await register(page,mode);await mount(page)
    await native(page).evaluate(el=>el.show());await settled(page)
    assert.equal(await native(page).evaluate(el=>{
      const rect=el.getBoundingClientRect(),style=getComputedStyle(el)
      return el.open&&!el.matches(':modal')&&style.opacity==='1'&&style.transform==='none'&&rect.width>0&&rect.height>0
    }),true)
    await page.locator('#field').fill('Non-modal edit');assert.equal(await page.locator('#field').inputValue(),'Non-modal edit')
    await native(page).evaluate(el=>el.close());await closed(page)
    assert.equal(await applied(page),false)
    await page.waitForFunction(()=>!document.querySelector('#dialog').open)
    await page.locator('#opener').click();await settled(page)
    assert.equal(await native(page).evaluate(el=>el.matches(':modal')),true,'The public API still opens modally')
    await page.keyboard.press('Escape');await closed(page)
  })
  test.fast(`${name}: document trigger listeners stay connected and release from their originating document on adoption`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    const before=await page.evaluate(()=>clickListeners.size)
    await page.evaluate(()=>{window.detached=document.createElement('a-dialog');detached.setAttribute('name','adopted');detached.setAttribute('state','closed');detached.removeAttribute('state')})
    assert.equal(await page.evaluate(()=>clickListeners.size),before)
    await mount(page,raw());assert.equal(await page.evaluate(()=>clickListeners.size),before+1)
    await page.locator('#opener').click();await settled(page)
    await page.locator('#mount').evaluate((node,url)=>{const iframe=document.createElement('iframe');iframe.src=url;node.append(iframe)},`${origin}/?mode=${mode}`)
    const frame=page.frames().find(f=>f!==page.mainFrame());await frame.waitForLoadState()
    await page.evaluate(()=>{const doc=document.querySelector('iframe').contentDocument;doc.querySelector('#mount').append(document.querySelector('#dialog'));const b=doc.createElement('button');b.id='adopt-close';b.setAttribute('data-dialog-close','example');b.textContent='Close adopted';doc.querySelector('#dialog').append(b)})
    assert.equal(await page.evaluate(()=>clickListeners.size),before)
    await frame.locator('#adopt-close').click();await closed(frame)
    await frame.locator('#dialog').evaluate(el=>{el.show();el.querySelector('[slot=close]').dispatchEvent(new CustomEvent('closerequest',{bubbles:true}))});await closed(frame)
    await frame.locator('#dialog').evaluate(el=>{el.show();el.shadowRoot.querySelector('dialog').close()});await closed(frame);await frames(frame)
    await frame.locator('#dialog').evaluate(el=>{el.remove();document.querySelector('#mount').append(el)});assert.equal(await applied(frame),false)
    const frameBefore=await frame.evaluate(()=>clickListeners.size);await frame.locator('#dialog').evaluate(el=>el.remove());assert.equal(await frame.evaluate(()=>clickListeners.size),frameBefore-1)
    assert.deepEqual(await frame.evaluate(()=>violations),[])
  })
  test.fast(`${name}: a queued close cannot clear a new backdrop press after reopening`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,raw('default-state="open"'));await settled(page)
    await page.locator('#dialog').evaluate(async host=>{
      const d=host.shadowRoot.querySelector('dialog')
      const closed=new Promise(resolve=>d.addEventListener('close',resolve,{once:true}))
      host.close();host.show()
      d.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))
      await closed
      d.dispatchEvent(new MouseEvent('click',{bubbles:true}))
    })
    assert.equal(await applied(page),false)
    await closed(page)
  })
  test(`${name}: adoption survives destruction of the old document and later native closing`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page)
    await page.locator('#mount').evaluate((node,url)=>{const iframe=document.createElement('iframe');iframe.src=url;node.append(iframe)},`${origin}/?mode=${mode}`)
    const frame=page.frames().find(f=>f!==page.mainFrame());await frame.waitForLoadState()
    await page.evaluate(()=>document.querySelector('iframe').contentDocument.querySelector('#mount').append(document.querySelector('#dialog')))
    await frame.locator('#dialog').evaluate(el=>el.show());await settled(frame);assert.deepEqual(await frame.evaluate(()=>violations),[])
    await frame.locator('[slot=header]').evaluate(el=>el.firstChild.nodeValue='Adopted title');await frames(frame)
    assert.equal(await native(frame).getAttribute('aria-label'),'Adopted title')
    await page.evaluate(()=>{const iframe=document.querySelector('iframe');document.querySelector('#mount').append(iframe.contentDocument.querySelector('#dialog'));iframe.remove()});await settled(page)
    await page.locator('[slot=header]').evaluate(el=>el.firstChild.nodeValue='Returned title');await frames(page)
    assert.equal(await native(page).getAttribute('aria-label'),'Returned title')
    await native(page).evaluate(el=>el.close());await closed(page);await frames(page)
    await page.locator('#dialog').evaluate(el=>{el.remove();document.querySelector('#mount').append(el)})
    assert.equal(await applied(page),false,'A dropped old-document close task must not consume the later native close')
  })
  test(`${name}: pointer backdrop requires an uncanceled press, content drag and overflow popovers stay open`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page);await page.locator('#opener').click();await settled(page)
    await page.locator('#field').click();await page.mouse.down();await page.mouse.move(2,2);await page.mouse.up();assert.equal(await applied(page),true)
    await native(page).evaluate(d=>{d.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));d.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true}));d.dispatchEvent(new MouseEvent('click',{bubbles:true}))});assert.equal(await applied(page),true)
    await page.locator('#dialog').evaluate(el=>{const p=document.createElement('div');p.popover='manual';p.id='popup';p.textContent='Overflow popup';el.append(p);p.showPopover()})
    await page.locator('#popup').click();assert.equal(await applied(page),true)
    await page.locator('#popup').evaluate(el=>el.hidePopover());await page.mouse.click(2,2);await closed(page)
  })
  test(`${name}: focus containment, explicit autofocus, nested ownership, and restore remain native`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,raw('', '<input id="field"><button id="last" slot="footer">Save</button><a-dialog id="inner"><input id="inner-field" autofocus></a-dialog>'))
    await page.locator('#opener').focus();await page.keyboard.press('Enter');await settled(page)
    assert.equal(await native(page).evaluate(d=>d.getRootNode().activeElement===d),true,'A closed nested autofocus must not take outer focus')
    await page.locator('#opener').evaluate(el=>el.focus());assert.equal(await page.locator('#opener').evaluate(el=>el===document.activeElement),false)
    await page.locator('#last').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('#opener').evaluate(el=>el===document.activeElement),false)
    await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#opener').evaluate(el=>el===document.activeElement),false)
    await page.locator('#inner').evaluate(el=>el.show());await settled(page,'#inner');assert.equal(await page.locator('#inner-field').evaluate(el=>el===document.activeElement),true)
    await page.keyboard.press('Escape');await closed(page,'#inner');assert.equal(await applied(page),true)
    await page.locator('#inner').evaluate(el=>{el.show();el.querySelector('input').dispatchEvent(new CustomEvent('closerequest',{bubbles:true}))});await closed(page,'#inner');assert.equal(await applied(page),true)
    await page.keyboard.press('Escape');await closed(page);assert.equal(await page.locator('#opener').evaluate(el=>el===document.activeElement),true)
    await mount(page,raw('', '<a-input id="auto" autofocus label="Name"></a-input>'));await page.locator('#opener').click();await settled(page)
    assert.equal(await page.locator('#auto').evaluate(el=>el.shadowRoot.activeElement?.localName==='input'),true)
  })
  test(`${name}: native close events, interrupted transitions, repeated moves, and state intent survive reconnect`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,raw('default-state="open"'));await settled(page)
    await page.evaluate(()=>{watchNative(document.querySelector('#dialog'));window.node=document.querySelector('#dialog');window.owned=node.shadowRoot.firstElementChild;for(let i=0;i<4;i++){node.remove();document.querySelector('#mount').append(node)}})
    await settled(page);assert.equal(await page.evaluate(()=>owned===node.shadowRoot.firstElementChild),true)
    await page.locator('#dialog').evaluate(el=>{el.close();el.show();el.close();el.show()});await settled(page)
    await page.locator('#dialog').evaluate(el=>el.shadowRoot.querySelector('dialog').close());await closed(page)
    await page.locator('#dialog').evaluate(el=>{el.remove();document.querySelector('#mount').append(el)});assert.equal(await applied(page),false,'Dismissed default-open dialog stays closed')
    await page.locator('#dialog').evaluate(el=>{el.show();el.remove();window.saved=el});assert.equal(await page.evaluate(()=>saved.open),false)
    assert.equal(await page.evaluate(()=>saved.shadowRoot.querySelector('dialog').getAnimations().length),0)
    await page.evaluate(()=>document.querySelector('#mount').append(saved));await settled(page)
    await page.locator('#dialog').evaluate(el=>el.close());await closed(page)
    assert.equal(await native(page).evaluate(el=>el.getAnimations().length),0)
  })
  test.fast(`${name}: optional regions and close clearance update without changing authored nodes`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,raw('default-state="open"','<p>Only body</p>'));await settled(page)
    assert.deepEqual((await metrics(page)).map(m=>m.display),['flex','none','block','none','none'])
    await page.locator('#dialog').evaluate(el=>{const c=document.createElement('button');c.slot='close';c.textContent='Close';el.append(c)})
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#dialog').shadowRoot.querySelector('[part=body]')).paddingInlineEnd==='52px')
    assert.equal((await metrics(page))[2].padding,'8px 52px 12px 20px')
    await page.locator('#dialog').evaluate(el=>{const h=document.createElement('h2');h.slot='header';h.textContent='Added title';el.prepend(h)})
    await page.waitForFunction(()=>document.querySelector('#dialog').shadowRoot.querySelector('dialog').getAttribute('aria-label')==='Added title')
    const m=await metrics(page);assert.equal(m[1].padding,'18px 52px 8px 20px');assert.equal(m[2].padding,'8px 20px 12px')
    await page.locator('#dialog > [slot=close]').evaluate(el=>el.remove());await frames(page);assert.equal((await metrics(page))[1].padding,'18px 20px 8px')
    await page.locator('#dialog > [slot=header]').evaluate(el=>el.slot='footer');await frames(page)
    assert.deepEqual((await metrics(page)).map(m=>m.display),['flex','none','block','flex','none'])
    await page.locator('#dialog > [slot=footer]').evaluate(el=>el.remove());await frames(page)
    // Nested slot attributes are not assigned to this Dialog's optional regions.
    await page.locator('#dialog > p').evaluate(el=>el.innerHTML='<span slot="header">Nested header</span><span slot="footer">Nested footer</span><span slot="close">Nested close</span>');await frames(page)
    assert.deepEqual((await metrics(page)).map(m=>m.display),['flex','none','block','none','none'])
    assert.equal((await metrics(page))[2].padding,'8px 20px 12px')
    assert.deepEqual(await page.locator('#dialog').evaluate(el=>[...el.shadowRoot.querySelectorAll('slot')].map(s=>s.getAttribute('part'))),['header','body','footer','close'])
  })
  test(`${name}: body scrolling and top-layer geometry escape clipping ancestors`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,`<div class="clip">${raw('', '<h2 slot="header">Long dialog</h2><div class="long">Long body</div><button slot="footer">Footer</button>')}</div>`)
    await page.locator('#opener').click();await settled(page);const m=await metrics(page)
    assert.equal(m[0].width,480);assert.equal(m[0].height,436);assert.equal(m[0].x,160);assert.equal(m[0].y,32)
    assert.equal(await page.locator('#dialog').evaluate(el=>{const s=el.shadowRoot.querySelector('[part~=body]');s.scrollTop=100;return s.scrollTop}),100)
    assert.equal(await page.locator('#dialog').evaluate(el=>el.shadowRoot.querySelector('[part~=header]').getBoundingClientRect().y),m[1].y)
  })
  test(`${name}: reduced motion and consumer overrides retain native visibility and state`,async t=>{
    const page=await pageFor(t,engine,mode);await page.emulateMedia({reducedMotion:'reduce'});await register(page,mode);await mount(page,raw('class="override"'));await page.locator('#opener').click();await settled(page)
    const m=await metrics(page);assert.equal(m[0].width,600);assert.equal(m[0].borderRadius,'24px');assert.equal(m[1].padding,'24px')
    assert.equal(await native(page).evaluate(el=>el.getAnimations().length),0)
    await page.keyboard.press('Escape');await closed(page)
    await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#dialog').evaluate(el=>el.className='motion-override');await page.locator('#opener').click()
    await page.waitForFunction(()=>+getComputedStyle(document.querySelector('#dialog').shadowRoot.querySelector('dialog')).opacity===.8)
    assert.equal(await native(page).evaluate(el=>getComputedStyle(el).transitionDuration.split(',')[0]),'0.4s')
    await page.keyboard.press('Escape');await closed(page);assert.equal(await applied(page),false)
  })
  test(`${name}: external CSS can style a Dialog inside a consumer shadow root`,async t=>{
    const page=await pageFor(t,engine,mode);await page.emulateMedia({reducedMotion:'reduce'});await register(page,mode)
    await page.locator('#mount').evaluate((mount,html)=>{
      const scope=document.createElement('div');scope.id='scope';mount.append(scope)
      const root=scope.attachShadow({mode:'open'});root.innerHTML=html
      root.querySelector('#opener').addEventListener('click',()=>root.querySelector('a-dialog').show())
    },raw('', '<h2 slot="header">Scoped dialog</h2><p>Body</p><a-dialog-footer slot="footer"><button>Save</button></a-dialog-footer><a-dialog-close slot="close"><button>Close</button></a-dialog-close>'))
    await page.locator('#scope').evaluate(async (scope,mode)=>{
      const css=document.createElement('link');css.rel='stylesheet';css.href=`/${mode}.css`
      const loaded=new Promise((resolve,reject)=>{css.onload=resolve;css.onerror=reject});scope.shadowRoot.prepend(css);await loaded
    },mode)
    const host=page.locator('#scope').locator('a-dialog'),dialog=host.locator('dialog')
    await page.locator('#scope').locator('#opener').focus();await page.keyboard.press('Enter')
    assert.deepEqual(await dialog.evaluate(el=>({modal:el.matches(':modal'),width:el.getBoundingClientRect().width,direction:getComputedStyle(el).flexDirection})),{modal:true,width:480,direction:'column'})
    assert.deepEqual(await host.locator('a-dialog-close,a-dialog-footer').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).display)),['contents','contents'])
    assert.deepEqual(await host.locator('slot').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).display)),['block','block','flex','block'])
    assert.equal(await dialog.getAttribute('aria-label'),'Scoped dialog')
    await host.locator('[slot=header]').evaluate(el=>el.firstChild.nodeValue='Updated scoped title');await frames(page)
    assert.equal(await dialog.getAttribute('aria-label'),'Updated scoped title')
    await page.keyboard.press('Escape');assert.equal(await host.evaluate(el=>el.open),false)
    assert.equal(await page.locator('#scope').locator('#opener').evaluate(el=>el.getRootNode().activeElement===el),true)
  })
  test(`${name}: later-layer consumer part overrides preserve modal state`,async t=>{
    const page=await pageFor(t,engine,mode);await page.emulateMedia({reducedMotion:'reduce'});await register(page,mode)
    await page.evaluate(async()=>{
      const css=document.createElement('link');css.rel='stylesheet';css.href='/layer-overrides.css'
      const loaded=new Promise((resolve,reject)=>{css.onload=resolve;css.onerror=reject});document.head.append(css);await loaded
    })
    await mount(page,raw('class="base-override"'));await page.locator('#opener').click();await settled(page)
    const base=await metrics(page);assert.equal(base[0].width,480);assert.equal(base[2].padding,'8px 20px 12px')
    await page.locator('#dialog').evaluate(el=>el.className='layer-override')
    const m=await metrics(page);assert.equal(m[0].width,640);assert.equal(m[2].padding,'0px');assert.equal(m[1].padding,'18px 64px 8px 20px')
    assert.equal(await native(page).evaluate(el=>el.matches(':modal')),true)
    await page.keyboard.press('Escape');await closed(page)
  })
  for(const framework of ['React','Preact'])test(`${name} ${framework}: initially open SSR and direct rendering keep boxless groups and uncontrolled veto`,async t=>{
    const page=await pageFor(t,engine,mode,`&ssr&initial-open&framework=${framework}`);await register(page,mode);await settled(page,'a-dialog')
    await page.evaluate(framework=>import(`/${framework}.js`),framework)
    // Match the server's default-open input for this hydration.
    await page.evaluate(()=>{window.original=document.querySelector('a-dialog');hydrateDialog()});await frames(page)
    assert.equal(await applied(page,'a-dialog'),true)
    await page.evaluate(()=>{veto=true;renderDialog({defaultOpen:true})});await frames(page);await page.keyboard.press('Escape');assert.equal(await applied(page,'a-dialog'),true)
    await page.evaluate(()=>{veto=false});await page.keyboard.press('Escape');await closed(page,'a-dialog')
    await page.evaluate(()=>{document.querySelector('#mount').classList.add('generic');renderDialog({defaultOpen:true,header:undefined,footer:undefined})});await frames(page)
    assert.equal(await applied(page,'a-dialog'),false,'Changing the seed never reopens a dismissed instance')
    assert.equal(await page.evaluate(()=>original===document.querySelector('a-dialog')),true)
    await page.evaluate(()=>clearDialog());await page.waitForFunction(()=>!document.querySelector('a-dialog'))
    await page.evaluate(()=>renderDirectDialog());await page.waitForFunction(()=>document.querySelector('a-dialog'))
    await page.locator('a-dialog').evaluate(el=>el.show());await settled(page,'a-dialog')
    await page.waitForFunction(()=>reports.at(-1)?.[1].next===true)
    await page.locator('a-dialog').getByRole('button',{name:'Close',exact:true}).click();await closed(page,'a-dialog')
  })
  test(`${name}: independent full and granular load orders share one registered native-dialog implementation`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await page.evaluate(()=>window.registered=customElements.get('a-dialog'))
    await register(page,mode==='bundle'?'granular':'bundle');await mount(page);await page.locator('#opener').click();await settled(page)
    assert.equal(await page.evaluate(()=>registered===customElements.get('a-dialog')),true)
    await page.keyboard.press('Escape');await closed(page)
  })
  test(`${name}: visual variants and original animation samples`,async t=>{
    const page=await pageFor(t,engine,mode)
    await register(page,mode)
    const output=resolve('tests/.test-output/dialog',consumerRoot?'package':'source',`${engine.name()}-${browsers.get(engine).version()}`,mode);await mkdir(output,{recursive:true})
    const variants=['center','left','right','top','bottom','fullscreen','round','no-header','dark','rtl','override']
    const report=[]
    for(const variant of variants){
      const attrs=['left','right','top','bottom','fullscreen'].includes(variant)?`position="${variant}"`:variant==='round'?'position="bottom" round="top"':variant==='override'?'class="override"':''
      const content=variant==='no-header'?'<p>Only content</p><button slot="close">Close</button>':undefined
      await page.locator('html').evaluate((el,v)=>{el.className=v==='dark'?'dark':'';el.dir=v==='rtl'?'rtl':'ltr'},variant)
      await mount(page,raw(attrs,content));await page.locator('#opener').click();await settled(page)
      const current=await metrics(page)
      const motionFor=p=>native(p).evaluate(d=>{
        const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.fillStyle=getComputedStyle(d,'::backdrop').backgroundColor;ctx.fillRect(0,0,1,1)
        return {transition:getComputedStyle(d).transition,backdrop:[...ctx.getImageData(0,0,1,1).data]}
      })
      const motion=await motionFor(page)
      const comparison=assets.has('/original.js')?await browsers.get(engine).newPage({viewport:{width:800,height:500}}):undefined
      try {
        if(comparison){
          await comparison.goto(`${origin}/?original&mode=${mode}`);await register(comparison,'original')
          await comparison.locator('html').evaluate((el,v)=>{el.className=v==='dark'?'dark':'';el.dir=v==='rtl'?'rtl':'ltr'},variant)
          await mount(comparison,raw(attrs,content));await comparison.locator('#opener').click();await settled(comparison)
          assert.deepEqual(current,await metrics(comparison),`${variant} geometry and appearance`)
          assert.deepEqual(motion,await motionFor(comparison),`${variant} transition and backdrop`)
          await comparison.screenshot({path:resolve(output,`original-${variant}.png`)})
          for(const p of [page,comparison]){await native(p).evaluate(d=>d.close());await closed(p);await native(p).evaluate(d=>d.showModal());await frames(p);await native(p).evaluate(d=>{window.dialogMotion=d.getAnimations();for(const a of dialogMotion)a.pause()})}
          const sample=p=>native(p).evaluate(d=>({opacity:getComputedStyle(d).opacity,transform:getComputedStyle(d).transform,display:getComputedStyle(d).display}))
          for(const time of [0,100,199]){
            for(const p of [page,comparison]) await native(p).evaluate((d,time)=>{for(const a of dialogMotion)a.currentTime=time},time)
            assert.deepEqual(await sample(page),await sample(comparison),`${variant} entry ${time}ms`)
          }
          for(const p of [page,comparison]){await native(p).evaluate(d=>{for(const a of dialogMotion)a.finish();getComputedStyle(d).opacity;d.close()});await frames(p);await native(p).evaluate(d=>{window.dialogMotion=d.getAnimations();for(const a of dialogMotion)a.pause()})}
          for(const time of [0,100,199]){
            for(const p of [page,comparison]) await native(p).evaluate((d,time)=>{for(const a of dialogMotion)a.currentTime=time},time)
            assert.deepEqual(await sample(page),await sample(comparison),`${variant} exit ${time}ms`)
          }
          for(const p of [page,comparison]){await native(p).evaluate(d=>{for(const a of dialogMotion)a.finish()});await closed(p)}
        }
        report.push({variant,metrics:current,...motion})
        // WebKit's screenshot synchronizer injects styles; capture in a separate permissive page.
        const capture=await browsers.get(engine).newPage({viewport:{width:800,height:500}})
        try{await capture.goto(`${origin}/?capture&mode=${mode}`);await capture.locator('html').evaluate((el,v)=>{el.className=v==='dark'?'dark':'';el.dir=v==='rtl'?'rtl':'ltr'},variant);await register(capture,mode);await mount(capture,raw(attrs,content));await capture.locator('#opener').click();await settled(capture);await capture.screenshot({path:resolve(output,`${variant}.png`)})}finally{await capture.close()}
      }finally{await comparison?.close()}
    }
    await writeFile(resolve(output,'metrics.json'),JSON.stringify(report,null,2))
  })
}
