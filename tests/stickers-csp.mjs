import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { before, after } from 'node:test'
import { componentTest as test, componentEngines } from './component-tier.mjs'
import { createServer } from 'node:http'
import { createRequire, Module } from 'node:module'
import { readFile, readdir, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const requirePlot = createRequire(new URL('../plot/package.json', import.meta.url))
const requireRenderer = createRequire(requireSite.resolve('@astrojs/preact'))
const { chromium, firefox, webkit } = requireSite('playwright')
const engines = componentEngines([chromium, firefox, webkit])
const consumer = process.env.ANTA_STICKERS_CONSUMER_ROOT
const resolveDir = consumer ?? process.cwd()
const nodePaths = [resolve(resolveDir, 'node_modules'), ...(consumer ? [] : [resolve('site/node_modules')])]
const preact = consumer ? 'preact/compat' : requireSite.resolve('preact/compat')
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'; base-uri 'none'"
const assets = new Map(), browsers = new Map(), renderers = new Map()
const compareRef = process.env.ANTA_STICKERS_COMPARE_REF
const output = resolve('tests/.test-output/stickers')
let server, origin
const granularImports = `import {StickerWait} from '@antadesign/stickers/wait'; import {StickerClapAnimated} from '@antadesign/stickers/clap-animated';`
const factory = `const app = props => React.createElement(React.Fragment,null,
  React.createElement(StickerWait,{id:'still',label:'Waiting',...props}),
  React.createElement(StickerClapAnimated,{id:'movie',playOnce:true,replayOnClick:true,label:'Replay applause',...props}),
  React.createElement(StickerWait,{id:'decorative'}));`
async function bundle(contents, name, alias = {}, platform = 'browser') {
  const result = await build({absWorkingDir:resolveDir, stdin:{contents,resolveDir}, bundle:true,write:false,metafile:true,
    outfile:`${name}.js`,format:platform === 'node' ? 'cjs' : 'esm',platform,target:'es2022',nodePaths,alias,
    define:{'process.env.NODE_ENV':'"production"'}})
  const inputs = Object.keys(result.metafile.inputs).map(p => resolve(resolveDir,p))
  if (consumer) {
    assert.ok(inputs.some(p => p.startsWith(resolve(consumer,'node_modules/@antadesign/stickers/dist')+'/')))
    assert.ok(!inputs.some(p => p.startsWith(resolve('stickers/src')+'/') || p.startsWith(resolve('src')+'/')))
  }
  for (const file of result.outputFiles) assets.set(`/${name}.${file.path.endsWith('.css') ? 'css':'js'}`,file.text)
  return result
}
before(async () => {
  await mkdir(output,{recursive:true})
  for (const mode of ['full','granular','static']) {
    const entries = mode === 'full' ? `import '@antadesign/stickers/elements';` :
      `import '@antadesign/stickers/elements/a-sticker'; ${mode === 'static' ? '' : "import '@antadesign/stickers/elements/a-sticker-animated';"}`
    const result = await bundle(entries,mode,{react:preact})
    if (mode === 'static') assert.ok(!Object.keys(result.metafile.inputs).some(p => p.includes('lottie-web')), 'Static entry excludes Lottie')
  }
  // Exercise the export map for separately linked CSS as well as the JS entries.
  await bundle(`import '@antadesign/stickers/elements/a-sticker.css'; import '@antadesign/stickers/elements/a-sticker-animated.css'`, 'css-only')
  const names = (await readdir('stickers/src/assets')).sort()
  await bundle(names.map(name => `import {svg as s${name.replaceAll('-','_')}} from '@antadesign/stickers/${name}'; import {animationJson as a_${name.replaceAll('-','_')}} from '@antadesign/stickers/${name}-animated';`).join('\n')+
    `window.artwork = {${names.map(n=>`'${n}': {svg:s${n.replaceAll('-','_')},animation:a_${n.replaceAll('-','_')}}`).join(',')}}`, 'artwork',{react:preact})
  if (compareRef) {
    const referenceDir = await mkdtemp(resolve(tmpdir(), 'anta-stickers-reference-'))
    try {
      for (const name of ['a-sticker', 'a-sticker-animated']) for (const ext of ['ts', 'css']) {
        const file = `${name}.${ext}`
        await writeFile(resolve(referenceDir, file), execFileSync('git', ['show', `${compareRef}:stickers/src/elements/${file}`]))
      }
      await bundle(`import '${referenceDir}/a-sticker.ts'; import '${referenceDir}/a-sticker-animated.ts'`, 'reference',
        {react:preact,'lottie-web':resolve('stickers/node_modules/lottie-web')})
      assets.set('/reference-artwork.js', ['wait','clap'].map(name => {
        const svg = execFileSync('git', ['show', `${compareRef}:stickers/src/assets/${name}/${name}.svg`], {encoding:'utf8'})
        return `window.artwork['${name}'].svg = ${JSON.stringify(svg)};`
      }).join('\n'))
    } finally { await rm(referenceDir,{recursive:true}) }
  }
  for (const framework of ['React','Preact']) for (const mode of ['full','granular']) {
    const imports = mode === 'full' ? `import {StickerWait,StickerClapAnimated} from '@antadesign/stickers';` : granularImports
    const react = framework === 'React'
    const alias = react ? consumer ? {} : {react:resolve('node_modules/react'),'react-dom/client':requirePlot.resolve('react-dom/client'),'react-dom/server':requirePlot.resolve('react-dom/server')} :
      {react:preact,...(consumer ? {} : {'preact-render-to-string':requireRenderer.resolve('preact-render-to-string')})}
    await bundle(`import React from 'react'; ${imports} ${factory}
      ${react ? "import {createRoot,hydrateRoot} from 'react-dom/client'; let root;" : "import {render,hydrate} from 'preact';"}
      window.hydrationErrors=[];
      window.mount = (props={},hydrating=false) => {const target=document.querySelector('main');
        ${react ? "if(hydrating) root=hydrateRoot(target,app(props),{onRecoverableError:e=>window.hydrationErrors.push(e.message)}); else {root??=createRoot(target);root.render(app(props))}" : 'if(hydrating) hydrate(app(props),target); else render(app(props),target)'}
      };`,`${framework}-${mode}`,alias)
    const result = await bundle(`import React from 'react'; ${imports} ${factory} ${react ? "import {renderToString} from 'react-dom/server'" : "import renderToString from 'preact-render-to-string'"}; exports.render = props=>renderToString(app(props));`,`${framework}-${mode}-ssr`,alias,'node')
    const compiled = new Module(resolve(`tests/stickers-${framework}.cjs`))
    compiled._compile(result.outputFiles[0].text,compiled.id)
    renderers.set(`${framework}-${mode}`,compiled.exports.render)
  }
  assets.set('/boot.js',`window.violations=[];window.violationDetails=[];document.addEventListener('securitypolicyviolation',e=>{window.violations.push(e.effectiveDirective);window.violationDetails.push({directive:e.effectiveDirective,source:e.sourceFile,line:e.lineNumber,sample:e.sample,blocked:e.blockedURI})});`)
  assets.set('/fixture.css',`:root{--focus-ring:#345}body{margin:16px;font:16px sans-serif}main{display:flex;flex-wrap:wrap;gap:12px} .custom{--sticker-size:96px} .host{width:320px;height:280px} .small{--sticker-size:64px} a-sticker::part(artwork){color:rgb(255,0,0)} svg,path{fill:lime!important} .parts::part(container){width:80px;height:80px} .parts::part(artwork){transform:rotate(10deg)}`)
  server=createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost')
    if (!url.searchParams.has('reference')) res.setHeader('Content-Security-Policy',policy)
    res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':req.url.endsWith('.css')?'text/css':'text/html')
    const ssr=url.searchParams.get('ssr'), size=url.searchParams.has('size')?{size:96}: {className:'custom'}
    res.end(assets.get(url.pathname)??`<!doctype html><link rel="stylesheet" href="/${url.searchParams.get('mode')??'granular'}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><main>${ssr?renderers.get(`${ssr}-${url.searchParams.get('mode')??'granular'}`)(size):''}</main>`)
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`
  for(const engine of engines) browsers.set(engine,await engine.launch({headless:true,...(engine===chromium?{channel:process.env.CAPTURE_TEST_BROWSER_CHANNEL??undefined}:{})}))
  await writeFile(`${output}/browsers.json`,JSON.stringify({node:process.version,engines:Object.fromEntries([...browsers].map(([engine,browser])=>[engine.name(),browser.version()]))},null,2))
})
after(async()=>{await Promise.all([...browsers.values()].map(b=>b.close()));if(server) await new Promise(r=>server.close(r))})
async function pageFor(t,engine,mode='granular',query='',expected=[]) {
  const page=await browsers.get(engine).newPage({viewport:{width:1200,height:800}})
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const response=await page.goto(`${origin}/?mode=${mode}${query}`)
  assert.equal(response.headers()['content-security-policy'],policy)
  await page.evaluate(async mode=>{await import('/artwork.js');await import(`/${mode}.js`)},mode)
  t.after(async()=>{try{assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.violations),expected,JSON.stringify(await page.evaluate(()=>window.violationDetails)))}finally{await page.close()}})
  return page
}
async function screenshot(page, options) {
  assert.deepEqual(await page.evaluate(()=>window.violations??[]), [], 'No component CSP violations before capture')
  await page.evaluate(()=>{
    window.screenshotProbes=0
    window.screenshotObserver=new MutationObserver(records=>{
      for(const record of records) for(const node of record.addedNodes) {
        if(node.nodeName==='STYLE'&&node.textContent==='body {}') window.screenshotProbes++
      }
    })
    window.screenshotObserver.observe(document.head,{childList:true})
  })
  const pixels=await page.screenshot({caret:'initial',...options})
  const probe=await page.evaluate(()=>{
    window.screenshotObserver.disconnect()
    const details=window.violationDetails?.splice(0)??[]
    window.violations?.splice(0)
    return {count:window.screenshotProbes,details}
  })
  // WebKit's Playwright animation-sync probe injects exactly `body {}`.
  const expected=page.context().browser().browserType().name()==='webkit'?probe.count:0
  assert.equal(probe.details.length,expected,JSON.stringify(probe.details))
  for(const event of probe.details){
    assert.equal(event.directive,'style-src-elem')
    assert.equal(event.blocked,'inline')
    assert.equal(event.source,'')
  }
  return pixels
}
async function raw(page,name='wait',animated=false,attrs={}) {
  await page.evaluate(({name,animated,attrs})=>{
    const el=document.createElement(animated?'a-sticker-animated':'a-sticker');el.id='subject'
    for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value)
    el.setAttribute(animated?'animation':'svg',window.artwork[name][animated?'animation':'svg'])
    document.querySelector('main').replaceChildren(el)
  },{name,animated,attrs})
  if(animated) await page.waitForFunction(()=>document.querySelector('#subject').player?.isLoaded)
}
const metrics = page=>page.locator('#subject').evaluate(el=>{
  const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}
  const svg=el.shadowRoot.querySelector('svg')
  return {host:rect(el),container:rect(el.container),svg:rect(svg),display:getComputedStyle(svg).display,styles:el.shadowRoot.querySelectorAll('style,link').length,part:svg.getAttribute('part')}
})
test.fast('Bundled SVG assets use presentation attributes without stylesheets or style attributes',async()=>{
  for(const name of await readdir('stickers/src/assets')) {
    const svg=await readFile(`stickers/src/assets/${name}/${name}.svg`,'utf8')
    assert.doesNotMatch(svg,/<style\b|\sstyle\s*=/i,name)
    if(['wait','clap'].includes(name))assert.match(svg,/mask-type="luminance"/)
  }
  for(const render of renderers.values()){
    assert.ok(/style="--sticker-size:96px;?"/.test(render({size:96})))
    assert.doesNotMatch(render({className:'custom'}),/\sstyle=/)
  }
})
for(const engine of engines){
  for(const mode of ['granular','full']){
    test(`${engine.name()}: ${mode} sizing, parts, isolation, and SVG replacement under CSP`,{tier:mode==='granular'?'fast':'slow'},async t=>{
      const page=await pageFor(t,engine,mode)
      for(const animated of [false,true])for(const [attrs,size,host]of [[{},256,[256,256]],[{class:'custom'},96,[96,96]],[{class:'host'},256,[320,280]],[{class:'host small'},64,[320,280]]]){
        await raw(page,'clap',animated,{...attrs,...(animated?{paused:'0.5'}:{})})
        const m=await metrics(page)
        assert.equal(m.styles,0);assert.equal(m.part,'artwork');assert.equal(m.display,'block')
        assert.deepEqual([m.host.width,m.host.height],host)
        for(const box of [m.container,m.svg]){assert.equal(box.width,size);assert.equal(box.height,size);assert.ok(Math.abs(box.x-(m.host.x+(m.host.width-size)/2))<.1);assert.ok(Math.abs(box.y-(m.host.y+(m.host.height-size)/2))<.1)}
      }
      await raw(page,'wait',false,{class:'parts'})
      assert.equal((await metrics(page)).container.width,80)
      await page.locator('#subject').evaluate(el=>el.setAttribute('svg','<svg viewBox="0 0 10 10"><path fill="red" d="M0 0h10v10H0z"/></svg>'))
      assert.equal(await page.locator('a-sticker').evaluate(el=>getComputedStyle(el.shadowRoot.querySelector('path')).fill),'rgb(255, 0, 0)')
      assert.equal((await metrics(page)).part,'artwork')
    })
  }
  test.fast(`${engine.name()}: playback, seek, delay, completion, replay, disconnect, and reconnect`,async t=>{
    const page=await pageFor(t,engine)
    await raw(page,'clap',true)
    await page.waitForFunction(()=>document.querySelector('#subject').player.currentFrame>2)
    await page.locator('#subject').evaluate(el=>el.setAttribute('paused',''))
    const frame=await page.locator('#subject').evaluate(el=>el.player.currentFrame)
    await page.waitForTimeout(100)
    assert.equal(await page.locator('#subject').evaluate(el=>el.player.currentFrame),frame)
    await page.locator('#subject').evaluate(el=>el.setAttribute('paused','0.5'))
    assert.equal(await page.locator('#subject').evaluate(el=>el.player.currentFrame),await page.locator('#subject').evaluate(el=>.5*el.player.frameRate))
    await page.locator('#subject').evaluate(el=>el.setAttribute('paused','9999'))
    assert.equal(await page.locator('#subject').evaluate(el=>el.player.currentFrame),await page.locator('#subject').evaluate(el=>el.player.totalFrames-1))
    const delayedFrame = await page.locator('#subject').evaluate(async el=>{
      el.setAttribute('delay','0.3');el.removeAttribute('paused')
      await new Promise(resolve=>setTimeout(resolve,100))
      return el.player.currentFrame
    })
    assert.equal(delayedFrame,0)
    await page.waitForFunction(()=>document.querySelector('#subject').player.currentFrame>1)
    await page.locator('#subject').evaluate(el=>{el.removeAttribute('delay');el.setAttribute('play-once','');el.setAttribute('replay-on-click','');el.setAttribute('role','button');el.setAttribute('aria-label','Replay');el.setAttribute('tabindex','0');el.player.setSpeed(30)})
    await page.waitForFunction(()=>{const p=document.querySelector('#subject').player;return p.isPaused&&p.currentFrame===p.totalFrames-1})
    for(const action of ['click','Enter','Space']){
      await page.locator('#subject').evaluate(el=>el.player.setSpeed(1))
      if(action==='click') await page.getByRole('button',{name:'Replay'}).click()
      else {
        await page.evaluate(()=>{
          let start=document.querySelector('#keyboard-start')
          if(!start){start=document.createElement('a');start.id='keyboard-start';start.href='#start';start.textContent='Start';document.body.prepend(start)}
          start.focus()
        })
        await page.keyboard.press('Tab')
        await page.keyboard.press(action)
      }
      assert.ok(await page.locator('#subject').evaluate(el=>!el.player.isPaused&&el.player.currentFrame<el.player.totalFrames-1))
      if(action!=='click') assert.equal(await page.locator('#subject').evaluate(el=>getComputedStyle(el).outlineStyle),'solid')
      await page.locator('#subject').evaluate(el=>el.player.goToAndStop(el.player.totalFrames-1,true))
    }
    await page.locator('#subject').evaluate(el=>{el.setAttribute('delay','0.3');window.detached=el;window.oldPlayer=el.player;el.remove()})
    assert.equal(await page.evaluate(()=>window.detached.player),null)
    await page.waitForTimeout(350)
    assert.equal(await page.evaluate(()=>window.detached.container.childElementCount),0)
    await page.evaluate(()=>document.querySelector('main').append(window.detached))
    await page.waitForFunction(()=>document.querySelector('#subject').player?.isLoaded)
    assert.equal(await page.evaluate(()=>window.detached.player===window.oldPlayer),false)
    assert.equal((await metrics(page)).part,'artwork')
    assert.equal(await page.locator('#subject').evaluate(el=>{
      let replays=0
      const play=el.player.goToAndPlay.bind(el.player)
      el.player.goToAndPlay=(...args)=>{replays++;return play(...args)}
      el.click()
      return replays
    }),1,'Reconnect installs one replay listener')
    await page.locator('#subject').evaluate(el=>el.removeAttribute('animation'))
    assert.equal(await page.locator('#subject').evaluate(el=>el.player),null)
    assert.equal(await page.locator('#subject').evaluate(el=>el.container.childElementCount),0)
  })
  for(const framework of ['React','Preact'])for(const mode of ['granular','full']){
    test(`${engine.name()}: ${framework} ${mode} SSR with external sizing hydrates and updates`,{tier:mode==='granular'?'fast':'slow'},async t=>{
      const page=await pageFor(t,engine,mode,`&ssr=${framework}`)
      await page.evaluate(async ({framework,mode})=>{await import(`/${framework}-${mode}.js`);window.serverNode=document.querySelector('#still');window.mount({className:'custom'},true)},{framework,mode})
      await page.waitForFunction(()=>document.querySelector('#movie').player?.isLoaded)
      assert.deepEqual(await page.evaluate(()=>window.hydrationErrors),[])
      assert.equal(await page.evaluate(()=>window.serverNode===document.querySelector('#still')),true)
      assert.equal(await page.getByRole('img',{name:'Waiting'}).count(),1)
      assert.equal(await page.getByRole('button',{name:'Replay applause'}).count(),1)
      assert.equal(await page.locator('#decorative').getAttribute('aria-hidden'),'true')
      assert.equal(await page.locator('#still').evaluate(el=>el.container.getBoundingClientRect().width),96)
      await page.evaluate(()=>window.mount({size:80,paused:0.5}))
      await page.waitForFunction(()=>document.querySelector('#still').container.getBoundingClientRect().width===80)
      assert.equal(await page.locator('#movie').evaluate(el=>el.player.currentFrame),await page.locator('#movie').evaluate(el=>.5*el.player.frameRate))
      await screenshot(page,{path:`${output}/${engine.name()}-${framework}-${mode}.png`})
    })
    test(`${engine.name()}: ${framework} ${mode} SSR size prop documents blocked inline styles`,async t=>{
      const page=await pageFor(t,engine,mode,`&ssr=${framework}&size=1`,['style-src-attr','style-src-attr'])
      assert.equal(await page.locator('#still').evaluate(el=>el.container.getBoundingClientRect().width),256)
    })
  }
  if (compareRef) test(`${engine.name()}: artwork pixels match ${compareRef} without CSP`, async t => {
    const current = await pageFor(t, engine, 'full')
    const reference = await browsers.get(engine).newPage({viewport:{width:1200,height:800}})
    t.after(()=>reference.close())
    await reference.goto(`${origin}/?mode=reference&reference=1`)
    await reference.evaluate(async()=>{await import('/artwork.js');await import('/reference-artwork.js');await import('/reference.js')})
    for (const animated of [false,true]) {
      for (const page of [current,reference]) {
        await page.evaluate(animated=>{
          document.querySelector('main').replaceChildren(...Object.entries(window.artwork).map(([name,data])=>{
            const el=document.createElement(animated?'a-sticker-animated':'a-sticker')
            el.className='custom'
            if(animated) el.setAttribute('paused','0.5')
            el.setAttribute(animated?'animation':'svg',data[animated?'animation':'svg'])
            return el
          }))
        },animated)
        await page.waitForFunction(()=>[...document.querySelector('main').children].every(el=>el.shadowRoot.querySelector('svg path')&&(!el.player||el.player.isLoaded)))
      }
      const mode = animated ? 'animated' : 'static'
      const before = await reference.screenshot({caret:'initial',path:`${output}/${engine.name()}-${mode}-before.png`,fullPage:true})
      const after = await screenshot(current,{path:`${output}/${engine.name()}-${mode}-after.png`,fullPage:true})
      assert.ok(before.equals(after), `${mode} gallery pixels match before and after`)
    }
  })
  test(`${engine.name()}: all bundled static and animated artwork renders under strict CSP`,async t=>{
    const page=await pageFor(t,engine,'full')
    for(const animated of [false,true]){
      await page.evaluate(animated=>{
        document.querySelector('main').replaceChildren(...Object.entries(window.artwork).map(([name,data])=>{
          const el=document.createElement(animated?'a-sticker-animated':'a-sticker');el.className='custom';el.setAttribute('aria-label',name);if(animated)el.setAttribute('paused','0.5');el.setAttribute(animated?'animation':'svg',data[animated?'animation':'svg']);return el
        }))
      },animated)
      await page.waitForFunction(()=>[...document.querySelector('main').children].every(el=>el.shadowRoot.querySelectorAll('svg path').length>0&&(!el.player||el.player.isLoaded)))
      assert.equal(await page.evaluate(()=>[...document.querySelector('main').children].every(el=>el.shadowRoot.querySelectorAll('style,link').length===0)),true)
      assert.equal(await page.evaluate(()=>[...document.querySelector('main').children].every(el=>[...el.shadowRoot.querySelectorAll('[style]')].every(node=>!node.style.display||getComputedStyle(node).display===node.style.display))),true,'Lottie CSSOM visibility applies under CSP')
      const inventory=await page.evaluate(()=>[...document.querySelector('main').children].map(el=>({name:el.getAttribute('aria-label'),styles:[...el.shadowRoot.querySelectorAll('[style]')].map(n=>({tag:n.tagName,style:n.getAttribute('style')}))})))
      await writeFile(`${output}/${engine.name()}-${animated?'animated':'static'}-styles.json`,JSON.stringify(inventory,null,2))
      await screenshot(page,{path:`${output}/${engine.name()}-${animated?'animated':'static'}-gallery.png`,fullPage:true})
    }
  })
}
