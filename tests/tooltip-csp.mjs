import assert from 'node:assert/strict'
import { before, after } from 'node:test'
import { componentTest as test, componentEngines } from './component-tier.mjs'
import { createServer } from 'node:http'
import { createRequire, Module } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const requirePlot = createRequire(new URL('../plot/package.json', import.meta.url))
const requireRenderer = createRequire(requireSite.resolve('@astrojs/preact'))
const { chromium, firefox, webkit } = requireSite('playwright')
const engines = componentEngines([chromium, firefox, webkit])
const consumerRoot = process.env.ANTA_TOOLTIP_CONSUMER_ROOT ? resolve(process.env.ANTA_TOOLTIP_CONSUMER_ROOT) : undefined
const source = process.env.ANTA_TOOLTIP_PACKAGE_ROOT ? resolve(process.env.ANTA_TOOLTIP_PACKAGE_ROOT, 'dist') : resolve('src')
const resolveDir = consumerRoot ?? process.cwd()
const nodePaths = consumerRoot ? [resolve(consumerRoot, 'node_modules')] : [resolve('node_modules'), resolve('site/node_modules')]
const jsxAlias = consumerRoot ? {} : { '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime') }
const preactCompat = consumerRoot ? 'preact/compat' : requireSite.resolve('preact/compat')
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'"
const browsers = new Map(), assets = new Map(), renderers = new Map()
let server, origin
const components = consumerRoot ? "import {Tooltip, Button, Text, Steps, Select, SelectFaceted} from '@antadesign/anta'" :
  `import {Tooltip, Button, Text, Steps, Select, SelectFaceted} from '${source}/index'`
const factory = `const app = (props = {}) => React.createElement(Button, {label: 'Save', 'aria-label': 'Save', 'aria-description': 'Saves your work'},
  React.createElement(Tooltip, {id:'hint', delay:30, ...props}, props.content ?? 'Saves your work'))`

function checkInstalled(result) {
  if (!consumerRoot) return
  const inputs = Object.keys(result.metafile.inputs).map(path => resolve(resolveDir, path))
  assert.ok(inputs.some(path => path.startsWith(resolve(consumerRoot, 'node_modules/@antadesign/anta/dist') + '/')))
  assert.ok(!inputs.some(path => path.startsWith(resolve('src') + '/')), 'No source aliases in the installed consumer')
}
async function compile(options) {
  const result = await build({absWorkingDir:resolveDir, bundle:true, write:false, metafile:true, nodePaths, target:'es2022', ...options})
  checkInstalled(result)
  return result
}
before(async () => {
  for (const mode of ['granular', 'bundle']) {
    const entries = ['a-tooltip', 'a-button', 'a-text', 'a-steps', 'a-tabs', 'a-tab', 'a-select', 'a-select-faceted', 'a-input', 'a-menu', 'a-menu-item', 'a-menu-group', 'a-menu-separator', 'a-icon', 'a-checkbox']
    const base = consumerRoot ? '@antadesign/anta' : source
    const contents = mode === 'bundle'
      ? `import '${base}/bundle'; ${consumerRoot || process.env.ANTA_TOOLTIP_PACKAGE_ROOT ? `import '${base}/bundle.css'` : ''}`
      : `import '${base}/tokens.css'; import '${base}/reset.css'; ${entries.map(entry => `import '${base}/elements/${entry}';`).join('\n')}`
    const result = await compile({stdin:{contents, resolveDir}, outfile:`${mode}.js`, format:'esm', alias:{react:preactCompat}})
    for (const file of result.outputFiles) assets.set(`/${mode}.${file.path.endsWith('.css') ? 'css' : 'js'}`, file.text)
  }
  {
    const base=consumerRoot?'@antadesign/anta':source
    const result=await compile({stdin:{contents:`import '${base}/tokens.css';import '${base}/reset.css';import '${base}/elements/a-input';import '${base}/elements/a-tooltip';`,resolveDir},outfile:'anchor.js',format:'esm',alias:{react:preactCompat}})
    for(const file of result.outputFiles) assets.set(`/anchor.${file.path.endsWith('.css')?'css':'js'}`,file.text)
  }
  for (const framework of ['React', 'Preact']) {
    const react = framework === 'React'
    const alias = {...jsxAlias, ...(react ? consumerRoot ? {} : {react:resolve('node_modules/react')} : {react:preactCompat})}
    const result = await compile({stdin:{contents:`import React from 'react'; ${components};
      ${react ? "import {renderToString} from 'react-dom/server'" : "import renderToString from 'preact-render-to-string'"};
      ${factory}; export const render = props => renderToString(app(props));`, resolveDir}, platform:'node', format:'cjs',
      jsx:'automatic', jsxImportSource:'@antadesign/anta', alias:{...alias, ...(consumerRoot ? {} : react ? {'react-dom/server':requirePlot.resolve('react-dom/server')} : {'preact-render-to-string':requireRenderer.resolve('preact-render-to-string')})}})
    const compiled = new Module(resolve(`tests/tooltip-${framework}-server.cjs`))
    compiled._compile(result.outputFiles[0].text, compiled.id)
    renderers.set(framework, compiled.exports.render)
    const client = await compile({stdin:{contents:`import React from 'react'; ${components};
      ${react ? "import {createRoot, hydrateRoot} from 'react-dom/client'" : "import {render, hydrate} from 'preact'"};
      ${factory}; let root; window.recoverableErrors=[];
      window.hydrateTooltip = props => { ${react ? "root = hydrateRoot(document.querySelector('#mount'), app(props), {onRecoverableError:e=>window.recoverableErrors.push(e.message)})" : "hydrate(app(props), document.querySelector('#mount'))"} };
      window.renderTooltip = props => { ${react ? "root ??= createRoot(document.querySelector('#mount')); root.render(app(props))" : "render(app(props), document.querySelector('#mount'))"} };
      window.renderComposition = name => {
        const e=React.createElement;
        const node = name === 'text' ? e(Text, {truncate:1, className:'clamp'}, 'A long text label '.repeat(12)) :
          name === 'steps' ? e(Steps, {className:'clamp', options:[{value:'a',label:'A long step label '.repeat(12),hint:'Long hint '.repeat(12),state:'complete'}]}) :
          name === 'select' ? e(Select, {options:[{value:'a',label:'Alpha',tooltip:'Alpha details'}],placeholder:'Choose'}) :
          e(SelectFaceted, {facets:[{key:'kind',label:'Kind',kind:'multiple',options:[{value:'a',label:'Alpha',tooltip:'Alpha details'}]}],placeholder:'Filter'});
        ${react ? "root ??= createRoot(document.querySelector('#mount')); root.render(node)" : "render(node, document.querySelector('#mount'))"}
      };`,resolveDir}, outfile:`${framework}.js`, format:'esm', jsx:'automatic', jsxImportSource:'@antadesign/anta',
      define:{'process.env.NODE_ENV':'"production"'}, alias:{...alias, ...(react && !consumerRoot ? {'react-dom/client':requirePlot.resolve('react-dom/client')} : {})}})
    assets.set(`/${framework}.js`, client.outputFiles.find(f=>f.path.endsWith('.js')).text)
  }
  assets.set('/boot.js', `window.violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push({directive:e.effectiveDirective,source:e.sourceFile}));`)
  assets.set('/fixture.css', `body{margin:40px;font-family:system-ui} iframe{width:900px;height:500px;border:0} #mount{width:500px} .anchor{position:absolute;left:300px;top:180px;width:140px;height:40px} .second{left:450px} .third{left:600px} .edge{left:2px;top:2px} .bottom{top:440px} .clip,.clamp{display:block;width:130px;max-width:130px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis} .override::part(bubble){background:rgb(30,40,50);color:white;padding:12px;border-radius:11px;box-shadow:none;backdrop-filter:none} .content{font-size:18px;font-weight:600} a-tooltip::part(container){z-index:1}`)
  server = createServer((req,res) => {
    const url = new URL(req.url,'http://localhost'), mode = url.searchParams.get('mode') ?? 'granular'
    res.setHeader('Content-Security-Policy', policy)
    res.setHeader('Content-Type', `${url.pathname.endsWith('.js') ? 'text/javascript' : url.pathname.endsWith('.css') ? 'text/css' : 'text/html'}; charset=utf-8`)
    res.end(assets.get(url.pathname) ?? `<!doctype html><link rel="stylesheet" href="/${mode}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><main id="mount">${url.searchParams.has('ssr') ? renderers.get(url.searchParams.get('framework') ?? 'React')({}) : ''}</main><a href="#after" id="after">After</a>`)
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r)); origin=`http://127.0.0.1:${server.address().port}`
  for (const engine of engines) {
    const options = process.env.ANTA_TOOLTIP_CHROMIUM_EXECUTABLE ? {executablePath:process.env.ANTA_TOOLTIP_CHROMIUM_EXECUTABLE} : {channel:process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined}
    const browser = await engine.launch({headless:true,...(engine === chromium ? options : {})})
    browsers.set(engine,browser); console.log(`${engine.name()}: ${browser.version()}`)
  }
})
after(async () => { await Promise.all([...browsers.values()].map(b=>b.close())); if(server) await new Promise(r=>server.close(r)) })
async function pageFor(t,engine,mode='granular',query='',options={}) {
  const {knownShadowStyles=false,...context} = options
  const page=await browsers.get(engine).newPage({viewport:{width:900,height:500},reducedMotion:'reduce',...context})
  page.setDefaultTimeout(8000)
  const errors=[]; page.on('pageerror',e=>errors.push(e.message))
  const response=await page.goto(`${origin}/?mode=${mode}${query}`)
  assert.equal(response.headers()['content-security-policy'],policy)
  t.after(async()=>{try {assert.deepEqual(errors,[]);if(!knownShadowStyles) assert.deepEqual(await page.evaluate(()=>window.violations),[])} finally {await page.close()} })
  return page
}
const register=(page,mode='granular')=>page.evaluate(mode=>import(`/${mode}.js`),mode)
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
async function mount(page,html='<button class="anchor" id="anchor" aria-label="Save">Save<a-tooltip delay="30">Saves your work</a-tooltip></button>') {
  await page.locator('#mount').evaluate((n,html)=>{n.innerHTML=html},html)
  await page.waitForFunction(()=>[...document.querySelectorAll('a-tooltip')].some(t=>t.listening))
}
const open=(page,selector='a-tooltip')=>page.locator(selector).evaluate(t=>t.shadowRoot.querySelector('[popover]').matches(':popover-open'))
const show=(page,selector='a-tooltip')=>page.locator(selector).evaluate(t=>t.show())
async function waitOpen(page,selector='a-tooltip',value=true) {
  await page.waitForFunction(({selector,value})=>document.querySelector(selector).shadowRoot.querySelector('[popover]').matches(':popover-open')===value,{selector,value})
}
const geometry=(page,selector='a-tooltip')=>page.locator(selector).evaluate(t=>{const b=t.shadowRoot.querySelector('[popover]').getBoundingClientRect(); const a=t.parentElement.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,left:a.left,right:a.right,top:a.top,bottom:a.bottom,anchorHeight:a.height}})

test.fast('React and Preact SSR keep Tooltip content authored without structural inline styles',()=>{
  for(const render of renderers.values()) {const html=render({});assert.match(html,/<a-tooltip/);assert.match(html,/aria-description="Saves your work"/);assert.doesNotMatch(html,/style=|part=|popover=/)}
})
for(const engine of engines) for(const mode of ['granular','bundle']) {
  const name=`${engine.name()} ${mode}`
  test.fast(`${name}: pre-upgrade content stays hidden; external parts render without authored mutations`,async t=>{
    const page=await pageFor(t,engine,mode,'&ssr')
    assert.equal(await page.locator('a-tooltip').evaluate(n=>getComputedStyle(n).display),'none')
    await register(page,mode)
    await page.locator('#mount').evaluate(n=>{window.mutations=[];new MutationObserver(rs=>mutations.push(...rs.map(r=>r.type))).observe(n,{subtree:true,childList:true,attributes:true,characterData:true})})
    await show(page); const box=await geometry(page)
    assert.ok(box.width>40 && box.y>=box.bottom)
    assert.deepEqual(await page.locator('a-tooltip').evaluate(n=>({styles:n.shadowRoot.querySelectorAll('style,link').length,children:n.shadowRoot.children.length,container:n.shadowRoot.firstElementChild.part.value,bubble:n.shadowRoot.querySelector('slot').part.value})),{styles:0,children:1,container:'container',bubble:'bubble'})
    assert.deepEqual(await page.evaluate(()=>mutations),[])
    assert.equal(await page.locator('a-tooltip').evaluate(n=>getComputedStyle(n).display),'contents')
  })
  test.fast(`${name}: pointer hover, keyboard focus, Escape, and scroll dismiss`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page)
    await page.locator('#anchor').hover();await waitOpen(page)
    await page.keyboard.press('Escape');assert.equal(await open(page),false)
    await page.mouse.move(10,10);await page.keyboard.press('Tab');await waitOpen(page)
    await page.evaluate(()=>window.dispatchEvent(new Event('scroll')));assert.equal(await open(page),false)
    await page.keyboard.press('Tab');await page.waitForTimeout(160);assert.equal(await open(page),false)
  })
  test.fast(`${name}: interactive bubble retains pointer and keyboard travel`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    await mount(page,'<div class="anchor" id="anchor" tabindex="0">Help<a-tooltip delay="30" interactive follow>Read <a id="guide" href="#guide">the guide</a></a-tooltip></div>')
    await page.locator('#anchor').hover();await waitOpen(page);await page.locator('#guide').hover();await page.waitForTimeout(180);assert.equal(await open(page),true)
    await page.mouse.move(10,10);await page.locator('#anchor').focus();await page.keyboard.press(engine===webkit?'Alt+Tab':'Tab');await page.waitForTimeout(180)
    assert.equal(await page.locator('#guide').evaluate(n=>n===document.activeElement),true);assert.equal(await open(page),true)
    await page.keyboard.press('Escape');assert.equal(await open(page),false)
  })
  test.fast(`${name}: empty updates, truncation, explicit precedence, and fallback remain declarative`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    await mount(page,'<div class="anchor clip" id="anchor">A long label '.repeat(1)+'with enough text to overflow<a-tooltip truncated-only data-anta-text-tooltip=""></a-tooltip><a-tooltip id="explicit"> </a-tooltip></div>')
    await page.locator('#anchor').hover();await page.waitForTimeout(340);assert.equal(await open(page,'#explicit'),false)
    await page.locator('#explicit').evaluate(n=>n.remove());await frames(page)
    await show(page);await waitOpen(page)
    assert.match(await page.locator('a-tooltip').evaluate(n=>n.shadowRoot.querySelector('slot').textContent),/long label/)
    await mount(page);await show(page);await page.locator('a-tooltip').evaluate(n=>n.textContent='');await waitOpen(page,'a-tooltip',false)
    await page.locator('a-tooltip').evaluate(n=>n.textContent='Changed content');await page.mouse.move(10,10);await page.locator('#anchor').hover();await waitOpen(page)
  })
  test.fast(`${name}: touch long-press, quick tap, drag, and scrolling cancellation`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page)
    const pointer=(type,x=320)=>page.locator('#anchor').evaluate((n,{type,x})=>n.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'touch',clientX:x,clientY:190})),{type,x})
    await pointer('pointerdown');await pointer('pointerup');await page.waitForTimeout(520);assert.equal(await open(page),false)
    await pointer('pointerdown');await pointer('pointermove',350);await page.waitForTimeout(520);assert.equal(await open(page),false);await pointer('pointerup')
    await pointer('pointerdown');await page.evaluate(()=>window.dispatchEvent(new Event('scroll')));await page.waitForTimeout(520);assert.equal(await open(page),false)
    await pointer('pointerdown');await waitOpen(page);const box=await geometry(page);assert.ok(box.y<box.top)
    await pointer('pointerup');await page.waitForTimeout(200);assert.equal(await open(page),true)
    await page.keyboard.press('Escape');assert.equal(await open(page),false)
  })
  for(const framework of ['React','Preact']) test(`${name} ${framework}: SSR hydration retains nodes and reactive content`,{tier:'fast'},async t=>{
    const page=await pageFor(t,engine,mode,`&ssr&framework=${framework}`);await register(page,mode)
    await page.evaluate(framework=>import(`/${framework}.js`),framework)
    await page.evaluate(()=>{window.serverNodes=[...document.querySelector('#mount').querySelectorAll('*')];hydrateTooltip({})});await frames(page)
    assert.deepEqual(await page.evaluate(()=>recoverableErrors),[])
    assert.equal(await page.evaluate(()=>serverNodes.every((n,i)=>n===[...document.querySelector('#mount').querySelectorAll('*')][i])),true)
    await page.locator('a-button').hover();await waitOpen(page)
    await page.evaluate(()=>renderTooltip({content:'Updated help',placement:'top'}));await frames(page)
    assert.equal(await page.locator('a-tooltip').textContent(),'Updated help');await waitOpen(page)
    const box=await geometry(page);assert.ok(box.y+box.height<=box.top)
    await page.evaluate(()=>renderTooltip({content:''}));await waitOpen(page,'a-tooltip',false)
  })
  test(`${name}: viewport flipping, left placement, content growth, and consumer overrides`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page)
    await page.locator('a-tooltip').evaluate(n=>n.setAttribute('placement','left'));await show(page)
    let box=await geometry(page);assert.ok(Math.abs(box.x+box.width-(box.left-4))<=1)
    await page.locator('#anchor').evaluate(n=>n.className='anchor edge');await show(page);box=await geometry(page);assert.ok(box.x>=box.right)
    await page.locator('a-tooltip').evaluate(n=>{n.removeAttribute('placement');n.className='override';n.innerHTML='<span class="content">Styled content</span>'});await frames(page)
    assert.deepEqual(await page.locator('a-tooltip').evaluate(n=>{const c=getComputedStyle(n.shadowRoot.querySelector('slot'));return [c.backgroundColor,c.borderRadius,c.paddingTop]}),['rgb(30, 40, 50)','11px','12px'])
    await page.locator('#anchor').evaluate(n=>n.className='anchor bottom');await show(page);box=await geometry(page);assert.ok(box.y+box.height<=box.top)
    await page.locator('a-tooltip').evaluate(n=>n.textContent='A much larger explanation '.repeat(30));await frames(page);box=await geometry(page);assert.ok(box.x>=4 && box.y>=4 && box.x+box.width<=900 && box.y+box.height<=500)
  })
  test(`${name}: nesting and follow handoff preserve delays and independent proximity`,async t=>{
    const page=await pageFor(t,engine,mode,'',{reducedMotion:'no-preference'});await register(page,mode)
    await mount(page,'<div class="anchor" id="a">A<a-tooltip id="ta" follow delay="30">A tip</a-tooltip></div><div class="anchor second" id="b">B<a-tooltip id="tb" follow delay="300">B tip</a-tooltip></div><div class="anchor third" id="c">C<a-tooltip id="tc" delay="300">C tip</a-tooltip></div>')
    await page.locator('#a').hover();await waitOpen(page,'#ta');await page.waitForTimeout(170)
    await page.locator('#b').hover();await page.waitForTimeout(70);assert.equal(await open(page,'#tb'),true)
    await page.locator('#c').hover();await page.waitForTimeout(70);assert.equal(await open(page,'#tc'),false);await waitOpen(page,'#tc')
    await mount(page,'<div class="anchor" id="outer">Outer<a-tooltip id="outer-tip" delay="30">Outer tip</a-tooltip><span id="inner" tabindex="0">Inner<a-tooltip id="inner-tip" delay="30">Inner tip</a-tooltip></span></div>')
    await page.locator('#inner').hover();await waitOpen(page,'#inner-tip');assert.equal(await open(page,'#outer-tip'),false)
  })
  test.fast(`${name}: lifecycle/proximity transitions remain separate and reduced motion removes both`,async t=>{
    const page=await pageFor(t,engine,mode,'',{reducedMotion:'no-preference'});await register(page,mode);await mount(page)
    await page.locator('a-tooltip').evaluate(n=>n.setAttribute('follow',''));await page.locator('#anchor').hover();await waitOpen(page)
    assert.deepEqual(await page.locator('a-tooltip').evaluate(n=>[getComputedStyle(n.shadowRoot.querySelector('[popover]')).transitionDuration,getComputedStyle(n.shadowRoot.querySelector('slot')).transitionDuration]),['0.15s, 0.15s, 0.15s','0.06s'])
    await page.waitForTimeout(180);await page.mouse.move(490,200);await page.waitForTimeout(70)
    const proximity=await page.locator('a-tooltip').evaluate(n=>Number(n.shadowRoot.querySelector('slot').style.opacity));assert.ok(proximity>0 && proximity<1)
    await page.mouse.move(850,450);assert.equal(await open(page),false)
    await page.emulateMedia({reducedMotion:'reduce'});await show(page)
    assert.deepEqual(await page.locator('a-tooltip').evaluate(n=>[getComputedStyle(n.shadowRoot.querySelector('[popover]')).transitionDuration,getComputedStyle(n.shadowRoot.querySelector('slot')).transitionDuration]),['0s','0s'])
  })
  test.fast(`${name}: opening and proximity fades interpolate independently`,async t=>{
    const page=await pageFor(t,engine,mode,'',{reducedMotion:'no-preference'});await register(page,mode);await mount(page)
    const sample=await page.locator('a-tooltip').evaluate(async n=>{
      const container=n.shadowRoot.querySelector('[popover]'),bubble=n.shadowRoot.querySelector('slot')
      getComputedStyle(container).opacity
      n.show()
      const opening=container.getAnimations().find(a=>a.transitionProperty==='opacity')
      if(!opening) return {opening:false}
      opening.pause();opening.currentTime=75
      const outer=Number(getComputedStyle(container).opacity)
      // Establish the bubble's first rendered frame before changing proximity.
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))
      bubble.style.opacity='0.5'
      getComputedStyle(bubble).opacity
      const proximity=bubble.getAnimations().find(a=>a.transitionProperty==='opacity')
      if(!proximity) return {opening:true,outer,proximity:false}
      proximity.pause();proximity.currentTime=30
      return {opening:true,outer,proximity:true,inner:Number(getComputedStyle(bubble).opacity),outerAfter:Number(getComputedStyle(container).opacity)}
    })
    assert.equal(sample.opening,true);assert.equal(sample.proximity,true)
    assert.ok(sample.outer>0 && sample.outer<1)
    assert.ok(Math.abs(sample.inner-0.75)<0.02)
    assert.equal(sample.outerAfter,sample.outer)
  })
  test.fast(`${name}: reconnecting and adopting an open tooltip cleans old document listeners`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await mount(page);await show(page)
    await page.locator('#anchor').evaluate(n=>{window.saved=n;n.remove();document.querySelector('#mount').append(n)});await frames(page);assert.equal(await open(page),false)
    await page.locator('#anchor').hover();await waitOpen(page)
    await page.evaluate(()=>{const frame=document.createElement('iframe');frame.src='/?mode=granular';document.body.append(frame)})
    const frame=page.frames().find(f=>f!==page.mainFrame());await frame.waitForLoadState()
    await frame.evaluate(()=>import('/granular.js'))
    await page.evaluate(()=>document.querySelector('iframe').contentDocument.querySelector('#mount').append(document.querySelector('#anchor')))
    await frame.waitForFunction(()=>document.querySelector('a-tooltip').listening)
    await frame.locator('#anchor').evaluate(n=>n.querySelector('a-tooltip').show())
    await page.locator('#mount').evaluate(n=>n.innerHTML='<button>Other document<a-tooltip>Independent tooltip</a-tooltip></button>')
    await show(page)
    assert.equal(await frame.locator('a-tooltip').evaluate(n=>n.shadowRoot.querySelector('[popover]').matches(':popover-open')),true,'Documents keep independent open slots')
    await page.keyboard.press('Escape');assert.equal(await open(page),false)
    assert.equal(await frame.locator('a-tooltip').evaluate(n=>n.shadowRoot.querySelector('[popover]').matches(':popover-open')),true)
    await frame.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})))
    assert.equal(await frame.locator('a-tooltip').evaluate(n=>n.shadowRoot.querySelector('[popover]').matches(':popover-open')),false)
    assert.deepEqual(await frame.evaluate(()=>violations),[])
  })
  test(`${name}: Text automatic tooltip and Steps clipping compose under CSP`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode);await page.evaluate(()=>import('/Preact.js'))
    for(const name of ['text','steps']) {
      await page.evaluate(name=>renderComposition(name),name);await frames(page);await show(page);await waitOpen(page)
      assert.equal(await page.locator('a-tooltip').evaluate(n=>n.shadowRoot.querySelectorAll('style').length),0)
    }
  })
  test(`${name}: visual matrix retains initial hiding, typography, and bubble variants`,async t=>{
    const page=await pageFor(t,engine,mode)
    const output=resolve('tests/.test-output/tooltip');await mkdir(output,{recursive:true})
    const variants=[['plain',''],['top','placement="top"'],['left','placement="left"'],['round','round'],['interactive','interactive'],['override','class="override"']]
    for(const [variant,attrs] of variants) {
      await page.locator('#mount').evaluate((n,html)=>n.innerHTML=html,`<button class="anchor" aria-label="Save">Save<a-tooltip ${attrs}><strong>Release status</strong><br>Checked two minutes ago</a-tooltip></button>`)
      if(variant==='plain') {
        assert.equal(await page.locator('a-tooltip').evaluate(n=>getComputedStyle(n).display),'none')
        await register(page,mode)
      }
      await show(page);await frames(page)
      const box=await geometry(page);assert.ok(box.width>100 && box.height>30 && box.x>=4 && box.y>=4)
      let capture=page
      if(engine===webkit) {
        // Playwright injects an animation-sync stylesheet during WebKit capture.
        // Geometry/behavior stays on the strict page; only this capture permits it.
        capture=await pageFor(t,engine,mode,'',{bypassCSP:true})
        await register(capture,mode);await mount(capture,await page.locator('#mount').innerHTML());await show(capture);await frames(capture)
      }
      await capture.screenshot({path:resolve(output,`${engine.name()}-${mode}-${variant}.png`)})
    }
  })
  if(engine===chromium) test(`${name}: trusted touch opens only after a hold and lingers after release`,async t=>{
    const page=await pageFor(t,engine,mode,'',{hasTouch:true,isMobile:true});await register(page,mode);await mount(page)
    const rect=await page.locator('#anchor').boundingBox(),x=rect.x+20,y=rect.y+20
    await page.touchscreen.tap(x,y);await page.waitForTimeout(550);assert.equal(await open(page),false)
    const session=await page.context().newCDPSession(page)
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]})
    await waitOpen(page)
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    await page.waitForTimeout(180);assert.equal(await open(page),true)
    await waitOpen(page,'a-tooltip',false)
  })
  if(engine===chromium) test(`${name}: authored descriptions remain accessible without changing the trigger`,async t=>{
    const page=await pageFor(t,engine,mode,'&ssr');await register(page,mode)
    const session=await page.context().newCDPSession(page)
    const closed=await session.send('Accessibility.getFullAXTree')
    assert.equal(closed.nodes.find(n=>n.role?.value==='button' && n.name?.value==='Save')?.description?.value,'Saves your work')
    await show(page)
    const {nodes}=await session.send('Accessibility.getFullAXTree')
    const button=nodes.find(n=>n.role?.value==='button' && n.name?.value==='Save')
    assert.ok(button);assert.equal(button.description?.value,'Saves your work')
    assert.ok(nodes.some(n=>n.role?.value==='tooltip'))
  })
}
for(const engine of engines) for(const order of [['granular','bundle'],['bundle','granular']]) {
  test.fast(`${engine.name()} ${order.join(' then ')}: Menu presence survives independent builds`,async t=>{
    const page=await pageFor(t,engine,order[0],'',{knownShadowStyles:true});await register(page,order[0]);await register(page,order[1])
    await mount(page,'<div class="anchor" id="trigger" tabindex="0">Menu<a-tooltip id="outside">Outside</a-tooltip><a-menu><a-menu-item role="menuitem" tabindex="0">Item<a-tooltip id="inside">Inside</a-tooltip></a-menu-item></a-menu></div>')
    await page.locator('a-menu').evaluate(n=>n.show());await frames(page)
    const baseline=await page.evaluate(()=>violations.length)
    await show(page,'#outside');assert.equal(await open(page,'#outside'),false)
    await show(page,'#inside');assert.equal(await open(page,'#inside'),true)
    await frames(page);assert.equal(await page.evaluate(()=>violations.length),baseline,'Tooltip adds no violations to the known Menu shadow stylesheet blocker')
  })
  test(`${engine.name()} ${order.join(' then ')}: Select and SelectFaceted hints keep Menu ownership`,async t=>{
    const page=await pageFor(t,engine,order[0],'',{knownShadowStyles:true});await register(page,order[0]);await register(page,order[1]);await page.evaluate(()=>import('/Preact.js'))
    for(const name of ['select','faceted']) {
      await page.evaluate(name=>renderComposition(name),name);await frames(page)
      await page.locator('a-menu').first().evaluate(n=>n.show());await frames(page)
      const tip=page.locator('a-tooltip').filter({hasText:'Alpha details'}).first()
      await tip.evaluate(n=>n.show());assert.equal(await tip.evaluate(n=>n.shadowRoot.querySelector('[popover]').matches(':popover-open')),true)
    }
  })
}

for(const engine of engines) for(const order of [['anchor','bundle'],['bundle','anchor']]) {
  test.fast(`${engine.name()} ${order.join(' then ')}: separately compiled Input and Menu retain native ARIA relations`,async t=>{
    const page=await pageFor(t,engine,'granular','',{knownShadowStyles:true})
    await register(page,order[0]);await register(page,order[1])
    await mount(page,'<a-input button aria-label="Choices"><span slot="input-label">Choose</span><a-tooltip id="outside">Trigger help</a-tooltip></a-input><a-menu><a-menu-item role="menuitem" tabindex="0">Alpha<a-tooltip id="inside">Alpha help</a-tooltip></a-menu-item></a-menu>')
    await page.locator('a-menu').evaluate(n=>n.show());await frames(page)
    assert.equal(await page.locator('a-input').evaluate(n=>{
      const control=n.shadowRoot.querySelector('button'),menu=n.nextElementSibling
      return control.ariaControlsElements?.[0]===menu && control.getAttribute('aria-label')==='Choices'
    }),true)
    await show(page,'#outside');assert.equal(await open(page,'#outside'),false)
    await show(page,'#inside');assert.equal(await open(page,'#inside'),true)
  })
}
