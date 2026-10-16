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
const consumerRoot = process.env.ANTA_COPY_CONSUMER_ROOT ? resolve(process.env.ANTA_COPY_CONSUMER_ROOT) : undefined
const source = resolve('src'), resolveDir = consumerRoot ?? process.cwd()
const base = consumerRoot ? '@antadesign/anta' : source
const nodePaths = [resolve(consumerRoot ?? '.', 'node_modules'), resolve('site/node_modules')]
const compat = consumerRoot ? 'preact/compat' : requireSite.resolve('preact/compat')
const jsxAlias = consumerRoot ? {} : { '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime') }
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'"
const assets = new Map(), browsers = new Map(), renderers = new Map()
let server, origin
const entries = ['a-copy', 'a-button', 'a-menu', 'a-menu-item', 'a-icon']
const imports = `import React from 'react'; import { ButtonCopy, MenuItemCopy, Menu, Button, configure } from '${consumerRoot ? '@antadesign/anta' : `${source}/index`}';`
const factory = `const app = (props = {}) => React.createElement(ButtonCopy, {
  copy:'Initial', label:'Copy', iconPlacement:'none', ...props });`
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
  for (const mode of ['granular', 'bundle']) {
    const contents = mode === 'bundle' ? `import '${base}/bundle'; ${consumerRoot ? `import '${base}/bundle.css';` : ''}` :
      `import '${base}/tokens.css'; import '${base}/reset.css'; ${entries.map(e => `import '${base}/elements/${e}';`).join('\n')}`
    save(await compile({stdin:{contents, resolveDir}, outfile:`${mode}.js`, format:'esm', alias:{react:compat}}), mode)
  }
  for (const framework of ['React', 'Preact']) {
    const react = framework === 'React'
    const alias = {...jsxAlias, ...(react ? consumerRoot ? {} : {react:resolve('node_modules/react')} : {react:compat})}
    const result = await compile({stdin:{contents:`${imports} ${factory}
      ${react ? "import {renderToString} from 'react-dom/server'" : "import renderToString from 'preact-render-to-string'"};
      export const render = props => renderToString(app(props));`, resolveDir}, platform:'node', format:'cjs',
      jsx:'automatic', jsxImportSource:'@antadesign/anta', alias:{...alias, ...(consumerRoot ? {} : react ? {'react-dom/server':requirePlot.resolve('react-dom/server')} : {'preact-render-to-string':requireRenderer.resolve('preact-render-to-string')})}})
    const compiled = new Module(resolve(`tests/copy-${framework}-server.cjs`))
    compiled._compile(result.outputFiles[0].text, compiled.id)
    renderers.set(framework, compiled.exports.render)
    save(await compile({stdin:{contents:`${imports}
      ${react ? "import {createRoot, hydrateRoot} from 'react-dom/client'" : "import {render, hydrate} from 'preact'"};
      ${factory} let root; window.recoverableErrors=[]; window.reports=[];
      const handlers = version => ({ onCopied:ok=>reports.push([version,ok]), onCopyRequest:()=>reports.push([version,'request']) });
      const commit = node => { ${react ? "root ??= createRoot(document.querySelector('#mount')); root.render(node)" : "render(node,document.querySelector('#mount'))"} };
      window.hydrateCopy = () => {
        configure(React.createElement, React.Fragment, React, {hydratingEvents:true});
        ${react ? "root=hydrateRoot(document.querySelector('#mount'),app(handlers('first')),{onRecoverableError:e=>recoverableErrors.push(e.message)})" : "hydrate(app(handlers('first')),document.querySelector('#mount'))"}
      };
      window.renderCopy = (props={}, version='second') => commit(app({...handlers(version),...props}));
      window.clearCopy = () => commit(null);
      function DynamicCopy() {
        const [value,setValue]=React.useState('');
        return React.createElement(ButtonCopy,{copy:value,label:'Dynamic copy',iconPlacement:'none',onCopyRequest:()=>setValue('Dynamic '+(++window.dynamicRequests))});
      }
      window.renderDynamicCopy = () => {window.dynamicRequests=0;commit(React.createElement(DynamicCopy))};
      window.renderMenu = () => commit(React.createElement(React.Fragment,null,
        React.createElement(Button,{label:'Actions'}), React.createElement(Menu,null,
          React.createElement(MenuItemCopy,{copy:'Menu value',label:'Copy row',iconPlacement:'none',...handlers('menu')}))));
    `, resolveDir},outfile:`${framework}.js`,format:'esm',jsx:'automatic',jsxImportSource:'@antadesign/anta',
      define:{'process.env.NODE_ENV':'"production"'},alias:{...alias,...(react&&!consumerRoot?{'react-dom/client':requirePlot.resolve('react-dom/client')}: {})}}),framework)
  }
  assets.set('/boot.js', `window.violations=[];window.writes=[];window.outcomes=[];window.fail=false;
    window.copyTimers=new Set();const schedule=window.setTimeout.bind(window),clear=window.clearTimeout.bind(window);
    window.setTimeout=(fn,ms,...args)=>{const id=schedule(()=>{copyTimers.delete(id);fn(...args)},ms);if(ms===2000)copyTimers.add(id);return id};
    window.clearTimeout=id=>{copyTimers.delete(id);clear(id)};
    document.addEventListener('pointerdown',e=>{window.lastPointer={x:e.clientX,y:e.clientY};(window.pointerSamples??=[]).push(lastPointer)},true);
    document.addEventListener('securitypolicyviolation',e=>violations.push({directive:e.effectiveDirective,source:e.sourceFile}));
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
      writeText: async text => {writes.push(text); if(window.defer) await new Promise(r=>(window.pending??=[]).push(r)); if(window.fail) throw Error('denied')},
      write: async items => {window.rich=await Promise.all(items.map(async item=>Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await(await item.getType(type)).text()])))));}
    }});
    document.addEventListener('copydone',e=>outcomes.push({id:e.target.id,ok:e.detail.ok}),true);`)
  assets.set('/fixture.css', `body{margin:0;font-family:system-ui} #mount{position:absolute;left:60px;top:180px}
    .clip{overflow:hidden;height:36px;width:200px;contain:paint} .override::part(feedback){color:rgb(20,40,60);font-size:19px;padding:3px;gap:9px}
    iframe{width:800px;height:450px;border:0} #mount.edge{position:fixed;top:0;left:0}`)
  if (!consumerRoot && process.env.ANTA_COPY_COMPARE_ORIGINAL === '1') {
    const old = execFileSync('git',['show','2d2ba6e6:src/elements/a-copy.ts'],{encoding:'utf8'})
    save(await build({stdin:{contents:old,resolveDir:resolve('src/elements'),loader:'ts'},bundle:true,write:false,outfile:'original.js',format:'esm',target:'es2022',nodePaths,alias:{...jsxAlias}}),'original')
  }
  server = createServer((req,res) => {
    const url = new URL(req.url,'http://localhost'), mode = url.searchParams.get('mode') ?? 'granular'
    const comparison = url.searchParams.has('original')
    res.setHeader('Content-Security-Policy',comparison ? policy.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'") : policy)
    res.setHeader('Content-Type',`${url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html'}; charset=utf-8`)
    res.end(assets.get(url.pathname) ?? `<!doctype html><link rel="stylesheet" href="/${mode}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><main id="mount">${url.searchParams.has('ssr') ? renderers.get(url.searchParams.get('framework')??'React')({}) : ''}</main>`)
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`
  for(const engine of engines) browsers.set(engine,await engine.launch({headless:true,...(engine===chromium?{
    ...(process.env.ANTA_COPY_CHROMIUM_EXECUTABLE?{executablePath:process.env.ANTA_COPY_CHROMIUM_EXECUTABLE}:{channel:process.env.CAPTURE_TEST_BROWSER_CHANNEL||undefined})}: {})}))
  console.log('Copy browser coverage:',JSON.stringify([...browsers].map(([e,b])=>({engine:e.name(),version:b.version()}))))
})
after(async()=>{await Promise.all([...browsers.values()].map(b=>b.close()));if(server)await new Promise(r=>server.close(r))})
async function pageFor(t,engine,mode,query='',knownMenu=false) {
  const page=await browsers.get(engine).newPage({viewport:{width:800,height:500}});page.setDefaultTimeout(8000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const response=await page.goto(`${origin}/?mode=${mode}${query}`)
  assert.equal(response.headers()['content-security-policy'],policy)
  t.after(async()=>{try{assert.deepEqual(errors,[]);const violations=await page.evaluate(()=>window.violations);if(!knownMenu)assert.deepEqual(violations,[]);else assert.ok(violations.every(v=>v.directive==='style-src-elem'),JSON.stringify(violations))}finally{await page.close()}})
  return page
}
const register=(page,mode)=>page.evaluate(mode=>import(`/${mode}.js`),mode)
const mount=(page,html='<button id="control">Copy<a-copy id="copy" copy="Value" toast></a-copy></button>')=>page.locator('#mount').evaluate((n,html)=>{n.innerHTML=html},html)
const feedback=(page,selector='a-copy')=>page.locator(`${selector} [part=feedback]`)
async function shown(page,expected=true,selector='a-copy') {
  await page.waitForFunction(({expected,selector})=>!!document.querySelector(selector)?.shadowRoot?.querySelector('[popover]')?.matches(':popover-open')===expected,{expected,selector})
}
const sample=(page,selector='a-copy')=>page.locator(selector).evaluate(el=>{
  const f=el.shadowRoot.querySelector('[part=feedback]'),s=getComputedStyle(f),r=f.getBoundingClientRect();return {
    x:r.x,y:r.y,width:r.width,height:r.height,left:s.left,top:s.top,opacity:+s.opacity,transform:s.transform,translate:s.translate,
    display:s.display,pointer:s.pointerEvents,color:s.color,fontSize:s.fontSize,label:f.textContent,effects:f.getAnimations().length,
  }
})
const seek=(page,time)=>feedback(page).evaluate((el,time)=>{const [a]=el.getAnimations();a.pause();a.currentTime=time},time)

test.fast('Copy SSR keeps light DOM authored and emits no feedback or layout styles',()=>{
  for(const render of renderers.values()){const html=render({copiedLabel:'Saved'});assert.match(html,/<a-copy[^>]*copied-label="Saved"/);assert.doesNotMatch(html,/style=|part=|popover=/)}
})
for(const engine of engines)for(const mode of ['granular','bundle']){
  const name=`${engine.name()} ${mode}`
  test.fast(`${name}: raw pointer activation preserves feedback structure, lifetime, failure, and authored DOM`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page)
    const initial=await page.locator('#mount').innerHTML()
    await page.evaluate(()=>{window.authored=[];new MutationObserver(rs=>authored.push(...rs.map(r=>r.type))).observe(document.querySelector('#mount'),{subtree:true,attributes:true,childList:true,characterData:true})})
    await page.locator('#control').click({position:{x:10,y:10}});await shown(page);await seek(page,0)
    const s=await sample(page);const pointer=await page.evaluate(()=>lastPointer);assert.equal(s.left,`${pointer.x}px`);assert.equal(s.top,`${pointer.y}px`);assert.equal(s.opacity,1);assert.equal(s.effects,1);assert.equal(s.pointer,'none');assert.equal(s.label,'✓Copied');assert.ok(s.y<190)
    assert.deepEqual(await page.locator('a-copy').evaluate(el=>({children:el.shadowRoot.children.length,style:el.shadowRoot.querySelectorAll('style,link').length,popover:el.shadowRoot.firstElementChild.popover,role:el.shadowRoot.firstElementChild.getAttribute('role'),spans:el.shadowRoot.firstElementChild.children.length})),{children:1,style:0,popover:'manual',role:'status',spans:2})
    assert.deepEqual(await page.evaluate(()=>writes),['Value']);assert.deepEqual(await page.evaluate(()=>outcomes.map(x=>x.ok)),[true])
    assert.equal(await page.locator('#mount').innerHTML(),initial);assert.deepEqual(await page.evaluate(()=>authored),[])
    await shown(page,false);assert.equal((await sample(page)).display,'none')
    await page.evaluate(()=>window.fail=true);await page.locator('#control').click();await page.waitForFunction(()=>outcomes.length===2);assert.equal(await feedback(page).evaluate(el=>el.matches(':popover-open')),false);assert.deepEqual(await page.evaluate(()=>outcomes.map(x=>x.ok)),[true,false])
  })
  test.fast(`${name}: repeated activation reuses one effect without endpoint probes and retains pointer pass-through`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page)
    await page.locator('#control').click();await shown(page);await seek(page,450);const mid=await sample(page);assert.ok(mid.opacity>0&&mid.opacity<1)
    await page.evaluate(()=>{window.effect=document.querySelector('a-copy').shadowRoot.querySelector('[popover]').getAnimations()[0];window.styleReads=0;const old=window.getComputedStyle;window.getComputedStyle=(el,...rest)=>{if(el.part?.contains('feedback'))styleReads++;return old.call(window,el,...rest)}})
    await page.waitForTimeout(500);await page.locator('#control').click();await shown(page);await seek(page,0)
    assert.equal(await feedback(page).evaluate(el=>el.getAnimations()[0]===window.effect),true);assert.equal((await sample(page)).effects,1);assert.equal(await page.evaluate(()=>styleReads),1,'Only the test sample reads styles after activation')
    const point=await feedback(page).evaluate(el=>{const r=el.getBoundingClientRect();const under=document.createElement('button');under.textContent='Under feedback';Object.assign(under.style,{position:'fixed',left:`${r.x}px`,top:`${r.y}px`,width:`${r.width}px`,height:`${r.height}px`,margin:'0',padding:'0'});under.addEventListener('click',()=>window.underClicks=(window.underClicks??0)+1);document.body.append(under);return {x:r.x+r.width/2,y:r.y+r.height/2}})
    await page.mouse.click(point.x,point.y);assert.equal(await page.evaluate(()=>underClicks),1);assert.equal(await page.evaluate(()=>writes.length),2)
    await page.waitForTimeout(450);assert.equal(await feedback(page).evaluate(el=>el.matches(':popover-open')),true);await shown(page,false)
  })
  for(const framework of ['React','Preact'])test.fast(`${name} ${framework}: real SSR hydrates without replacement; callbacks, controlled refresh, and icon feedback update`,async t=>{
    const page=await pageFor(t,engine,mode,`&ssr&framework=${framework}`);await register(page,mode)
    await page.evaluate(()=>{window.originalCopy=document.querySelector('a-copy');window.originalControl=document.querySelector('a-button')})
    await page.evaluate(framework=>import(`/${framework}.js`),framework);await page.evaluate(()=>hydrateCopy());await page.waitForTimeout(80)
    await page.locator('a-button').click();await shown(page);await page.waitForFunction(()=>reports.some(r=>r[0]==='first'&&r[1]===true))
    await page.evaluate(()=>renderCopy({copy:'Refreshed',copiedLabel:'Saved'}));await page.waitForFunction(()=>document.querySelector('a-copy').getAttribute('copy')==='Refreshed')
    await page.locator('a-button').focus();await page.keyboard.press('Enter');await shown(page)
    await page.waitForFunction(()=>reports.some(r=>r[0]==='second'&&r[1]===true));assert.deepEqual(await page.evaluate(()=>writes),['Initial','Refreshed'])
    assert.equal((await sample(page)).label,'✓Saved');assert.deepEqual(await page.evaluate(()=>recoverableErrors),[])
    assert.equal(await page.evaluate(()=>originalCopy===document.querySelector('a-copy')&&originalControl===document.querySelector('a-button')),true)
    await page.evaluate(()=>renderCopy({iconPlacement:'leading'}));await page.waitForFunction(()=>document.querySelector('a-icon'))
    await page.locator('a-button').click();await page.waitForFunction(()=>document.querySelector('a-icon').getAttribute('shape')==='check')
    await page.evaluate(()=>window.fail=true);await page.locator('a-button').click();await page.waitForFunction(()=>document.querySelector('a-icon').getAttribute('shape')==='x')
    await page.waitForFunction(()=>document.querySelector('a-icon').getAttribute('shape')==='copy')
    await page.evaluate(()=>renderCopy({onCopied:undefined,onCopyRequest:undefined}));await page.waitForTimeout(40);const count=await page.evaluate(()=>reports.length)
    await page.locator('a-button').click();await page.waitForTimeout(40);assert.equal(await page.evaluate(()=>reports.length),count)
    await page.evaluate(()=>{window.fail=false;renderDynamicCopy()});await page.waitForTimeout(80)
    await page.locator('a-button').hover();await page.mouse.down();await page.waitForFunction(()=>document.querySelector('a-copy').getAttribute('copy')==='Dynamic 1');await page.mouse.up()
    await page.waitForFunction(()=>writes.at(-1)==='Dynamic 1');await page.locator('a-button').focus();await page.keyboard.down('Enter');await page.waitForFunction(()=>document.querySelector('a-copy').getAttribute('copy')==='Dynamic 2');await page.keyboard.up('Enter');await page.waitForFunction(()=>writes.at(-1)==='Dynamic 2')
  })
  test.fast(`${name}: copyrequest refreshes value before pointer and keyboard activation; blocked controls do not copy`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page)
    await page.locator('a-copy').evaluate(el=>el.addEventListener('copyrequest',()=>el.setAttribute('copy','Fresh')))
    await page.locator('#control').click();await shown(page);await page.locator('#control').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>writes.length===2);assert.deepEqual(await page.evaluate(()=>writes),['Fresh','Fresh'])
    for(const attr of ['disabled','loading','aria-disabled']){
      await page.locator('#control').evaluate((el,attr)=>el.setAttribute(attr,attr==='aria-disabled'?'true':''),attr)
      await page.locator('#control').evaluate(el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true})))
      assert.equal(await page.evaluate(()=>writes.length),2);await page.locator('#control').evaluate((el,attr)=>el.removeAttribute(attr),attr)
    }
  })
  for(const framework of ['React','Preact'])test(`${name} ${framework}: unmount clears the wrapper feedback timer`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await page.evaluate(framework=>import(`/${framework}.js`),framework)
    await page.evaluate(()=>renderCopy({iconPlacement:'leading'}));await page.locator('a-button').click();await page.waitForFunction(()=>copyTimers.size===1)
    await page.evaluate(()=>clearCopy());await page.waitForFunction(()=>!document.querySelector('a-copy'));assert.equal(await page.evaluate(()=>copyTimers.size),0)
  })
  test(`${name}: custom part styling, RTL keyboard origin, top edges, clipping escape, and reduced motion retain geometry`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,'<div class="clip" dir="rtl"><button id="control">Copy<a-copy class="override" copied-label="Saved with a longer label" copy="Value" toast></a-copy></button></div>')
    await page.locator('#control').focus();await page.keyboard.press('Enter');await shown(page);await seek(page,0);let s=await sample(page)
    const rect=await page.locator('#control').boundingBox();assert.equal(s.left,`${rect.x+rect.width-12}px`);assert.ok(Math.abs(s.x+s.width-(rect.x+rect.width-12))<1);assert.equal(s.color,'rgb(20, 40, 60)');assert.equal(s.fontSize,'19px');assert.ok(s.y<180)
    await page.locator('#mount').evaluate(el=>el.classList.add('edge'));await page.locator('#control').click();await shown(page);await seek(page,0);s=await sample(page);assert.ok(s.y>=0)
    await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#control').click();await shown(page);await seek(page,450);s=await sample(page);assert.ok(s.opacity>0&&s.opacity<1,'Original rise/fade also runs under reduced motion');await shown(page,false)
  })
  test(`${name}: disconnect/reconnect suppresses stale visuals while preserving async copydone; listeners release`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page)
    await page.evaluate(()=>window.defer=true);await page.locator('#control').click();await page.waitForFunction(()=>pending?.length===1)
    await page.locator('a-copy').evaluate(el=>{window.copy=el;el.remove();document.querySelector('#control').append(el)})
    await page.evaluate(()=>pending.shift()());await page.waitForFunction(()=>outcomes.length===1);assert.equal(await page.locator('a-copy').evaluate(el=>!!el.shadowRoot?.querySelector('[popover]')?.matches(':popover-open')),false)
    await page.evaluate(()=>window.defer=false);await page.locator('#control').click();await shown(page)
    await page.locator('a-copy').evaluate(el=>{el.remove();document.querySelector('#control').append(el)})
    assert.equal((await sample(page)).effects,0);assert.equal(await feedback(page).evaluate(el=>el.matches(':popover-open')),false)
    await page.locator('#control').click();await shown(page);assert.equal((await sample(page)).effects,1)
    await page.locator('a-copy').evaluate(el=>el.remove());assert.equal(await page.evaluate(()=>!!document[Symbol.for('anta.copy-delegation')]),false)
    await page.evaluate(()=>document.querySelector('#control').append(window.copy));await page.locator('#control').click();await shown(page)
  })
  test(`${name}: overlapping clipboard completions retain each activation origin and lifetime`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page);await page.evaluate(()=>window.defer=true)
    await page.locator('#control').click({position:{x:5,y:5}});await page.locator('#control').click({position:{x:20,y:10}});await page.waitForFunction(()=>pending.length===2)
    await page.evaluate(()=>pending.pop()());await shown(page);assert.equal((await sample(page)).left,`${await page.evaluate(()=>pointerSamples[1].x)}px`)
    await page.evaluate(()=>pending.pop()());await page.waitForFunction(()=>outcomes.length===2);assert.equal((await sample(page)).left,`${await page.evaluate(()=>pointerSamples[0].x)}px`);assert.equal((await sample(page)).effects,1)
  })
  test.fast(`${name}: clipboard completion does not consume a pending menu pointer request`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,'<div role="menuitem" id="control">Copy<a-copy copy="Value" toast></a-copy></div>')
    await page.evaluate(()=>{
      window.defer=true;
      const host=document.querySelector('#control');
      host.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:100,clientY:180}));
      host.dispatchEvent(new CustomEvent('menuselect'));
      host.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:150,clientY:190}));
      pending.shift()();
    });await shown(page)
    await page.evaluate(()=>{window.defer=false;document.querySelector('#control').dispatchEvent(new CustomEvent('menuselect'))})
    await page.waitForFunction(()=>outcomes.length===2);assert.equal((await sample(page)).left,'150px');assert.equal((await sample(page)).top,'190px')
  })
  test(`${name}: adopted controls use the owning document, clipboard, URL, animation, and delegation`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page)
    await page.evaluate(async()=>{const frame=document.createElement('iframe');frame.src='/?frame=1';document.body.append(frame);await new Promise(r=>frame.onload=r);const doc=frame.contentDocument;const control=document.querySelector('#control');control.querySelector('a-copy').setAttribute('copy-url','');doc.querySelector('#mount').append(doc.adoptNode(control));window.frame=frame})
    const child=page.frames().find(f=>f!==page.mainFrame());await child.locator('#control').click();await child.waitForFunction(()=>outcomes.length===1)
    assert.deepEqual(await child.evaluate(()=>writes),[`${origin}/?frame=1`]);assert.deepEqual(await page.evaluate(()=>writes),[])
    assert.equal(await child.locator('a-copy').evaluate(el=>el.shadowRoot.querySelector('[popover]').matches(':popover-open')),true)
    assert.equal(await page.evaluate(()=>!!document[Symbol.for('anta.copy-delegation')]),false)
    assert.deepEqual(await child.evaluate(()=>violations),[])
  })
  test(`${name}: nested activation and forged descendant events cannot activate ancestor copies`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    await mount(page,'<div role="button" id="outer">Outer<a-copy id="outercopy" copy="Outer" toast></a-copy><div role="menuitem" id="inner">Inner<a-copy id="innercopy" copy="Inner" toast></a-copy></div><button id="plain">Plain</button></div>')
    await page.locator('#plain').click();await page.locator('#inner').click();assert.deepEqual(await page.evaluate(()=>writes),[])
    await page.locator('#inner').evaluate(el=>el.dispatchEvent(new CustomEvent('menuselect')));await shown(page,true,'#innercopy');assert.deepEqual(await page.evaluate(()=>writes),['Inner'])
    await page.locator('#outercopy').evaluate(el=>{const child=document.createElement('span');el.append(child);child.dispatchEvent(new CustomEvent('copydone',{bubbles:true,detail:{ok:true}}))})
    assert.equal(await page.locator('#outercopy').evaluate(el=>!!el.shadowRoot),false)
  })
  test(`${name}: existing clipboard modes retain text, URL prefix, node sources, and rich formats`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page,'<section data-copy-source><p>Content</p><button id="control" data-copy-node-button>Copy<a-copy copy="Text"></a-copy></button></section>')
    await page.locator('#control').click();await page.waitForFunction(()=>writes.length===1)
    await page.locator('a-copy').evaluate(el=>el.setAttribute('copy-with-url',''));await page.locator('#control').click();await page.waitForFunction(()=>writes.length===2)
    assert.deepEqual(await page.evaluate(()=>writes),['Text',`// URL: ${page.url()}\nText`])
    for(const source of ['', 'section']){await page.locator('a-copy').evaluate((el,source)=>el.setAttribute('copy-node',source),source);await page.locator('#control').click();await page.waitForFunction(()=>!!window.rich);const [item]=await page.evaluate(()=>rich);assert.equal(item['text/plain'],'Content');assert.match(item['text/html'],/<p>Content<\/p>/);assert.doesNotMatch(item['text/html'],/<(?:a-copy|button)\b/);await page.evaluate(()=>delete window.rich)}
  })
  test(`${name}: MenuItemCopy remains usable in a menu; Copy adds no CSP violations`,async t=>{
    const page=await pageFor(t,engine,mode,'',true);await register(page,mode);await page.evaluate(()=>import('/Preact.js'));await page.evaluate(()=>renderMenu());await page.locator('a-button').click();await page.waitForTimeout(80)
    const baseline=await page.evaluate(()=>violations.length);await page.locator('a-menu-item').click();await shown(page);assert.deepEqual(await page.evaluate(()=>writes),['Menu value']);assert.equal(await page.evaluate(()=>violations.length),baseline)
    await page.locator('a-menu-item').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>writes.length===2);assert.equal(await feedback(page).evaluate(el=>el.matches(':popover-open')),true)
  })
  test(`${name}: independent bundle/granular load orders share one delegation and one activation`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await register(page,mode==='bundle'?'granular':'bundle');await mount(page)
    await page.locator('#control').click();await shown(page);assert.deepEqual(await page.evaluate(()=>writes),['Value']);assert.equal((await sample(page)).effects,1)
    assert.equal(await page.evaluate(()=>document[Symbol.for('anta.copy-delegation')].readers.size),1)
    await page.locator('a-copy').evaluate(el=>el.remove());assert.equal(await page.evaluate(()=>!!document[Symbol.for('anta.copy-delegation')]),false)
  })
  test(`${name}: visual matrix preserves original geometry and animation samples`,async t=>{
    const directory=resolve('tests/.test-output/copy',consumerRoot?'installed':'source',engine.name(),mode);await mkdir(directory,{recursive:true})
    for(const variant of ['pointer','keyboard','rtl','edge','edge-keyboard','bottom','custom']){
      const query=variant==='edge'?'&edge':'';const page=await pageFor(t,engine,mode,query);await register(page,mode)
      const html=`<button id="control" ${variant==='rtl'?'dir="rtl"':''}>Copy<a-copy copy="Text" toast ${variant==='custom'?'class="override" copied-label="Saved a longer label"':''}></a-copy></button>`
      await mount(page,html)
      const position=async p=>p.locator('#mount').evaluate((el,variant)=>{if(variant.startsWith('edge'))el.style.top='0px';if(variant==='bottom'){el.style.left='740px';el.style.top='460px'}},variant)
      await position(page)
      const activate=async p=>{if(['keyboard','rtl','edge-keyboard'].includes(variant)){await p.locator('#control').focus();await p.keyboard.press('Enter')}else await p.locator('#control').click({position:{x:10,y:10}});await shown(p)}
      await activate(page);await seek(page,0);const first=await sample(page);await seek(page,450);const middle=await sample(page);assert.ok(middle.opacity>0&&middle.opacity<1)
      const metrics={first,middle};
      if(assets.has('/original.js')){
        const old=await browsers.get(engine).newPage({viewport:{width:800,height:500}})
        try{await old.goto(`${origin}/?mode=${mode}&original`);await old.evaluate(()=>import('/original.js'));await mount(old,html);await position(old)
          await activate(old);await seek(old,0);const before=await sample(old);await seek(old,450);const during=await sample(old);metrics.original={first:before,middle:during}
          for(const [a,b]of [[first,before],[middle,during]])for(const key of ['x','y','width','height','opacity'])assert.ok(Math.abs(a[key]-b[key])<0.1,`${variant} ${key}: ${a[key]} vs ${b[key]}`);for(const key of ['color','fontSize','label','pointer'])assert.equal(first[key],before[key])
        }finally{await old.close()}
      }
      // Playwright's WebKit screenshot helper injects a synchronization stylesheet.
      // Pixels use an explicitly permissive capture page; behavior above retains CSP.
      const capture=await browsers.get(engine).newPage({viewport:{width:800,height:500}})
      try{await capture.goto(`${origin}/?mode=${mode}&original`);await register(capture,mode);await mount(capture,html);await position(capture);await activate(capture);await seek(capture,0);await capture.screenshot({path:resolve(directory,`${variant}.png`)})}finally{await capture.close()}
      await writeFile(resolve(directory,`${variant}.json`),JSON.stringify(metrics,null,2))
    }
  })
}
