import assert from 'node:assert/strict'
import { before, after } from 'node:test'
import { createServer } from 'node:http'
import { createRequire, Module } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { componentTest as test, componentEngines } from './component-tier.mjs'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const requirePlot = createRequire(new URL('../plot/package.json', import.meta.url))
const requireRenderer = createRequire(requireSite.resolve('@astrojs/preact'))
const { chromium, firefox, webkit } = requireSite('playwright')
const engines = componentEngines([chromium, firefox, webkit])
const consumer = process.env.ANTA_SELECT_CONSUMER_ROOT ? resolve(process.env.ANTA_SELECT_CONSUMER_ROOT) : undefined
const resolveDir = consumer ?? process.cwd(), base = consumer ? '@antadesign/anta' : resolve('src')
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'"
const assets = new Map(), renderers = new Map(), browsers = new Map()
let server, origin
const fixture = `
  import React from 'react';
  import {Select, SelectFaceted, Icon, configure} from '${consumer ? base : `${base}/index`}';
  const h=React.createElement;
  // App-authored tooltips keep SSR text independent of the platform isolate hint.
  const options=[{value:1,label:'Alpha',hint:'Design',team:'Studio',tooltip:''}, {label:'People',options:[{value:false,label:'Beta',hint:'Engineering',tooltip:''}, {label:'More',submenu:[{value:'gamma',label:'Gamma',tooltip:''}, {value:'locked',label:'Locked',disabled:true}]}]}];
  const app=(props={})=>h(Select, {id:'trigger',label:h('strong',null,'Team'),hint:h('em',null,'Choose teams'),leading:'Team:',status:'critical',selection:'multiple',defaultValue:[1],options,filter:true,clearable:true,
    renderOption:(option,state)=>h('span',{'data-option':String(option.value),'data-selected':String(state.selected)},option.label,option.team?h('small',null,' '+option.team):null),...props});
`
async function compile(options) {
  const result = await build({absWorkingDir: resolveDir, bundle: true, write: false, metafile: true, nodePaths: [resolve(resolveDir, 'node_modules'), resolve('site/node_modules')], target: 'es2022', ...options})
  if (consumer) {
    const inputs = Object.keys(result.metafile.inputs).map(p => resolve(resolveDir, p))
    assert.ok(inputs.some(p => p.startsWith(resolve(consumer, 'node_modules/@antadesign/anta/dist') + '/')))
    assert.ok(!inputs.some(p => p.startsWith(resolve('src') + '/')))
  }
  return result
}
function save(result, name) {
  for (const file of result.outputFiles) assets.set(`/${name}.${file.path.endsWith('.css') ? 'css' : 'js'}`, file.text)
}
before(async () => {
  for (const mode of ['granular', 'bundle']) {
    const contents = mode === 'bundle' ? `import '${base}/bundle';${consumer ? `import '${base}/bundle.css'` : ''}` : `import '${base}/tokens.css';import '${base}/reset.css';${['select', 'select-faceted', 'input', 'menu', 'menu-item', 'menu-group', 'menu-separator', 'button', 'icon', 'checkbox', 'radio-group', 'tooltip', 'tag'].map(e => `import '${base}/elements/a-${e}'`).join(';')}`
    save(await compile({stdin: {contents, resolveDir}, outfile: `${mode}.js`, format: 'esm', alias: {react: consumer ? 'preact/compat' : requireSite.resolve('preact/compat')}}), mode)
  }
  for (const framework of ['React', 'Preact']) {
    const react = framework === 'React'
    const alias = {
      ...(consumer ? {} : {'@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime')}),
      ...(react ? consumer ? {} : {react: resolve('node_modules/react'), 'react-dom/server': requirePlot.resolve('react-dom/server'), 'react-dom/client': requirePlot.resolve('react-dom/client')} : {react: consumer ? 'preact/compat' : requireSite.resolve('preact/compat'), ...(consumer ? {} : {'preact-render-to-string': requireRenderer.resolve('preact-render-to-string')})}),
    }
    const serverOptions = {stdin: {contents: `${fixture} ${react ? "import {renderToString} from 'react-dom/server'" : "import renderToString from 'preact-render-to-string'"}; export const render=(props)=>renderToString(app(props));`, resolveDir}, platform: 'node', format: 'cjs', jsx: 'automatic', jsxImportSource: '@antadesign/anta', alias}
    const result = await compile(serverOptions)
    const compiled = new Module(resolve(`tests/select-${framework}-server.cjs`))
    compiled._compile(result.outputFiles[0].text, compiled.id)
    renderers.set(framework, compiled.exports.render)
    if (!consumer && process.env.ANTA_SELECT_COMPARE_ORIGINAL === '1') {
      const original = execFileSync('git', ['show', '308adf7c:src/components/Select.tsx'], {encoding: 'utf8'})
      const result = await compile({...serverOptions, plugins: [{name: 'original-select', setup(build) {
        build.onLoad({filter: /[/\\]Select\.tsx$/}, () => ({contents: original, loader: 'tsx', resolveDir: resolve('src/components')}))
      }}]})
      const compiled = new Module(resolve(`tests/select-${framework}-original.cjs`))
      compiled._compile(result.outputFiles[0].text, compiled.id)
      renderers.set(`${framework}-original`, compiled.exports.render)
    }
    save(await compile({stdin: {contents: `${fixture}
      ${react ? "import {createRoot,hydrateRoot} from 'react-dom/client'" : "import {render,hydrate} from 'preact'"};
      let root, props={}; window.reports=[];window.recoverableErrors=[];window.fatalErrors=[];
      const handlers={onValueChange:(value,attrs)=>reports.push({value,attrs})};
      const commit=node=>{${react ? "root??=createRoot(document.querySelector('#mount'));root.render(node)" : "render(node,document.querySelector('#mount'))"}};
      window.hydrateSelect=()=>{configure(h,React.Fragment,React,{hydratingEvents:true});${react ? "root=hydrateRoot(document.querySelector('#mount'),app(handlers),{onRecoverableError:e=>recoverableErrors.push(e.message),onUncaughtError:e=>fatalErrors.push(e.message)})" : "hydrate(app(handlers),document.querySelector('#mount'))"}};
      window.updateSelect=updates=>{props={...props,...updates};commit(app({...handlers,...props}))};
      window.customIndicator=()=>updateSelect({renderIndicator:state=>h(Icon,{shape:state.selected?'check':'minus'})});
      window.renderHooks=()=>{customIndicator();updateSelect({renderSummary:selected=>selected.map(o=>o.label).join(' / '),renderEmpty:({query})=>h('span',{'data-empty':''},'No '+query)})};
      window.faceted=()=>{configure(h,React.Fragment,React);commit(h(SelectFaceted,{label:'Filters',searchable:true,defaultValue:{owner:[false]},onValueChange:(value,attrs)=>reports.push({value,attrs}),facets:['owner','assignee'].map(key=>({key,label:key,kind:'multiple',filter:true,options,renderOption:(option,state)=>h('span',{'data-facet':key,'data-option':String(option.value),'data-selected':String(state.selected)},option.label)}))}))};
    `, resolveDir}, outfile: `${framework}.js`, format: 'esm', jsx: 'automatic', jsxImportSource: '@antadesign/anta', alias, define: {'process.env.NODE_ENV': '"production"'}}), framework)
  }
  for (const theme of ['antune', 'antithesis']) save(await compile({stdin: {contents:`import '${base}/theme-${theme}.css'`,resolveDir},outfile:`${theme}.js`,format:'esm'}),theme)
  assets.set('/boot.js', `window.violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push({directive:e.effectiveDirective,source:e.blockedURI}));`)
  assets.set('/fixture.css', 'body{margin:24px;font:14px/20px system-ui}#trigger{width:240px}#outside{position:fixed;right:8px;top:8px}small{color:var(--text-3)}a-input{--input-appear-duration:0ms} .consumer::part(field){border-radius:13px}.consumer::part(leading){color:rgb(4,5,6)}.consumer a-select-chevron{color:rgb(1,2,3)}')
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost'), mode = url.searchParams.get('mode') ?? 'granular', framework = url.searchParams.get('framework') ?? 'React'
    const original = url.searchParams.has('original')
    res.setHeader('Content-Security-Policy', original ? policy.replace("style-src 'self'; style-src-attr 'none'", "style-src 'self' 'unsafe-inline'") : policy)
    res.setHeader('Content-Type', `${url.pathname.endsWith('.js') ? 'text/javascript' : url.pathname.endsWith('.css') ? 'text/css' : 'text/html'}; charset=utf-8`)
    const props = url.searchParams.has('size') ? {size:url.searchParams.get('size'),status:url.searchParams.get('status'),round:url.searchParams.has('round')} : {}
    res.end(assets.get(url.pathname) ?? `<!doctype html><html class="${url.searchParams.has('dark') ? 'dark' : ''}"><link rel="stylesheet" href="/${mode}.css">${url.searchParams.has('theme') ? `<link rel="stylesheet" href="/${url.searchParams.get('theme')}.css">` : ''}<link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><main id="mount">${renderers.get(framework + (original ? '-original' : ''))(props)}</main><button id="outside">Outside</button>`)
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r)); origin = `http://127.0.0.1:${server.address().port}`
  for (const engine of engines) browsers.set(engine, await engine.launch({headless: true, ...(engine === chromium ? {channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined} : {})}))
  console.log('Select browser coverage:', JSON.stringify([...browsers].map(([engine, browser]) => ({engine: engine.name(), version: browser.version()}))))
})
after(async () => { await Promise.all([...browsers.values()].map(b => b.close())); if (server) await new Promise(r => server.close(r)) })
async function pageFor(t, engine, mode, framework) {
  const page = await browsers.get(engine).newPage()
  page.setDefaultTimeout(7000)
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  const response = await page.goto(`${origin}/?mode=${mode}&framework=${framework}`)
  assert.equal(response.headers()['content-security-policy'], policy)
  t.after(async () => { try { assert.deepEqual(errors, []); assert.deepEqual(await page.evaluate(() => window.fatalErrors ?? []), []); assert.deepEqual(await page.evaluate(() => violations), []) } finally { await page.close() } })
  return page
}
async function hydrate(page, mode, framework) {
  await page.evaluate(async ({mode, framework}) => {await import(`/${mode}.js`);await import(`/${framework}.js`);window.originalTrigger=document.querySelector('#trigger');window.originalMenu=originalTrigger.nextElementSibling;hydrateSelect()}, {mode, framework})
  await page.waitForFunction(() => document.querySelector('#trigger + a-menu')?.listening)
  // Wait for the hydration helper's event-prop commit in both renderers.
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
}
const menu = page => page.locator('#trigger + a-menu')
const search = page => menu(page).locator('[data-menu-search] input')
const opened = (page, state = true) => menu(page).evaluate((el, state) => el.isOpen === state, state)

for (const engine of engines) for (const mode of ['granular', 'bundle']) {
  const name = `${engine.name()} ${mode}`
  if (!consumer && process.env.ANTA_SELECT_COMPARE_ORIGINAL === '1') test(`${name}: trigger appearance matches the original across sizes, statuses, rounding, and themes`, async t => {
    const output = resolve('tests/.test-output/select', engine.name(), mode)
    await mkdir(output, {recursive:true})
    const variants = [
      {size:'small',status:'neutral'}, {size:'medium',status:'brand',theme:'antune'},
      {size:'large',status:'critical',theme:'antithesis',dark:''}, {size:'medium',status:'info',round:''},
      {size:'small',status:'success',round:'',theme:'antune',dark:''}, {size:'large',status:'warning'},
    ]
    for (const [index, variant] of variants.entries()) {
      const pair = []
      for (const original of [true,false]) {
        const page = await browsers.get(engine).newPage({viewport:{width:600,height:300},reducedMotion:'reduce'})
        try {
          const query = new URLSearchParams({mode,framework:'React',...variant,...(original?{original:''}:{})})
          await page.goto(`${origin}/?${query}`); await page.evaluate(mode => import(`/${mode}.js`),mode)
          await page.locator('#trigger button').waitFor(); await page.evaluate(() => document.fonts.ready)
          pair.push(await page.locator('#trigger').evaluate(host => {
            const measure = el => {const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {x:r.x,y:r.y,width:r.width,height:r.height,color:s.color,background:s.backgroundColor,border:s.border,shadow:s.boxShadow,radius:s.borderRadius,font:s.font,gap:s.gap,padding:s.padding}}
            return {host:measure(host),field:measure(host.shadowRoot.querySelector('[part=field]')),value:measure(host.shadowRoot.querySelector('button')),leading:measure(host.querySelector('a-input-leading')),chevron:measure(host.querySelector('a-select-chevron'))}
          }))
          if (!original) assert.deepEqual(await page.evaluate(() => violations),[])
          await page.screenshot({path:resolve(output,`${index}-${original?'original':'current'}.png`)})
        } finally {await page.close()}
      }
      await writeFile(resolve(output,`${index}.json`),JSON.stringify({variant,original:pair[0],current:pair[1]},null,2))
      assert.deepEqual(pair[1],pair[0],JSON.stringify(variant))
    }
  })
  test.fast(`${name}: server defaults have no fixed inline styles and retain leading and status styling under CSP`, async t => {
    for (const framework of ['React', 'Preact']) {
      const page = await pageFor(t, engine, mode, framework)
      assert.equal(await page.locator('#mount [style]').count(), 0)
      await page.evaluate(mode => import(`/${mode}.js`), mode)
      const metrics = await page.locator('#trigger').evaluate(host => ({
        leading: getComputedStyle(host.querySelector('a-select-leading')).display,
        chevron: getComputedStyle(host.querySelector('a-select-chevron')).color,
        critical: getComputedStyle(host).getPropertyValue('--text-2-critical').trim(),
        hidden: host.querySelector('a-select-leading').getAttribute('aria-hidden'),
        value: host.shadowRoot.querySelector('button').textContent.trim(),
        registered: !!customElements.get('a-select-leading') || !!customElements.get('a-select'),
      }))
      assert.equal(metrics.leading, 'contents'); assert.equal(metrics.hidden, 'true'); assert.equal(metrics.value, 'Alpha'); assert.equal(metrics.registered, false)
      assert.equal(metrics.chevron, await page.evaluate(color => {const node=document.createElement('span');node.style.color=color;document.body.append(node);const result=getComputedStyle(node).color;node.remove();return result}, metrics.critical))
      await page.locator('#trigger').evaluate(host => host.classList.add('consumer'))
      assert.equal(await page.locator('a-select-chevron').evaluate(el => getComputedStyle(el).color), 'rgb(1, 2, 3)')
      assert.equal(await page.locator('a-select-leading').evaluate(el => getComputedStyle(el).color), 'rgb(4, 5, 6)')
      assert.equal(await page.locator('#trigger').evaluate(el => getComputedStyle(el.shadowRoot.querySelector('[part=field]')).borderRadius), '13px')
    }
  })
  for (const framework of ['React', 'Preact']) {
    test(`${name} ${framework}: hydration, controlled updates, filtering, custom rows, and typed keyboard selection`, {tier: mode === 'granular' ? 'fast' : 'slow'}, async t => {
      const page = await pageFor(t, engine, mode, framework); await hydrate(page, mode, framework)
      await page.locator('#trigger button').focus(); await page.keyboard.press('ArrowDown')
      await search(page).waitFor(); await search(page).fill('Beta')
      await page.waitForFunction(() => document.querySelector('[data-option="false"]') && !document.querySelector('[data-option="1"]'))
      assert.equal(await search(page).evaluate(el => el.ariaActiveDescendantElement?.contains(document.querySelector('[data-option="false"]'))), true)
      await page.keyboard.press('Enter'); await page.waitForFunction(() => reports.length === 1)
      assert.deepEqual(await page.evaluate(() => reports[0].value), [1, false]); assert.equal(await opened(page), true)
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !originalMenu.isOpen)
      assert.equal(await page.locator('#trigger').evaluate(el => el.shadowRoot.activeElement === el.shadowRoot.querySelector('button')), true)
      await page.evaluate(() => updateSelect({value:[false]})); await page.waitForFunction(() => document.querySelector('#trigger').value === 'Beta')
      await page.locator('#trigger button').click(); await search(page).fill('Alpha'); await page.waitForFunction(() => document.querySelector('[data-option="1"]') && !document.querySelector('[data-option="false"]')); await page.keyboard.press('Enter')
      await page.waitForFunction(() => reports.length === 2)
      assert.deepEqual(await page.evaluate(() => reports[1].value), [false, 1])
      assert.equal(await page.locator('#trigger').evaluate(el => el.value), 'Beta')
      await page.evaluate(() => updateSelect({value:[1]})); await page.waitForFunction(() => document.querySelector('#trigger').value === 'Alpha')
      assert.deepEqual(await page.evaluate(() => ({trigger:document.querySelector('#trigger')===originalTrigger,menu:originalTrigger.nextElementSibling===originalMenu,errors:recoverableErrors})), {trigger:true,menu:true,errors:[]})
    })
    test(`${name} ${framework}: nested option branches keep disabled rows, selection, and focus restoration`, async t => {
      const page = await pageFor(t, engine, mode, framework); await hydrate(page, mode, framework)
      await page.evaluate(() => updateSelect({selection:'single',value:1,filter:false,renderOption:undefined}))
      await page.waitForFunction(() => document.querySelector('#trigger').shadowRoot.querySelector('button').getAttribute('aria-haspopup') === 'menu')
      await page.locator('#trigger button').focus(); await page.keyboard.press('ArrowDown')
      await menu(page).locator('a-menu-item[submenu]').focus(); await page.keyboard.press('ArrowRight')
      const child = menu(page).locator('a-menu')
      await page.waitForFunction(() => document.querySelector('#trigger + a-menu a-menu')?.isOpen)
      assert.equal(await child.locator('[disabled]').count(), 1)
      await page.keyboard.press('ArrowLeft')
      assert.equal(await menu(page).locator('a-menu-item[submenu]').evaluate(el => el === document.activeElement), true)
      await page.keyboard.press('ArrowRight')
      await page.waitForFunction(() => document.querySelector('#trigger + a-menu a-menu')?.isOpen)
      await page.keyboard.press('Enter'); await page.waitForFunction(() => reports.length === 1)
      assert.equal(await page.evaluate(() => reports[0].value), 'gamma')
      await page.waitForFunction(() => !originalMenu.isOpen)
    })
    test(`${name} ${framework}: render hooks, built-in highlighting, empty results, and clearing stay interactive`, async t => {
      const page = await pageFor(t, engine, mode, framework); await hydrate(page, mode, framework)
      await page.evaluate(() => renderHooks())
      await page.locator('#trigger button').click(); await search(page).fill('Beta')
      await menu(page).locator('[data-indicator]').waitFor(); await page.keyboard.press('Enter')
      await page.waitForFunction(() => document.querySelector('#trigger').value === 'Alpha / Beta')
      assert.equal(await menu(page).locator('[data-indicator] a-icon').first().getAttribute('shape'), 'check')
      await search(page).fill('Missing'); await menu(page).locator('[data-empty]').waitFor()
      assert.equal(await menu(page).locator('[data-empty]').textContent(), 'No Missing')
      await menu(page).getByRole('button', {name:'Clear',exact:true}).click()
      await page.waitForFunction(() => document.querySelector('#trigger').value === '')
      assert.deepEqual(await page.evaluate(() => reports.at(-1)), {value:[],attrs:{all:true,selected:false}})
      await page.evaluate(() => updateSelect({renderOption:undefined,renderIndicator:undefined}))
      await search(page).fill('Engineering'); await menu(page).locator('b').waitFor()
      assert.equal(await menu(page).locator('b').textContent(), 'Engineering')
      assert.equal(await menu(page).locator('a-menu-group-label').textContent(), 'People')
      await page.locator('#outside').click(); await page.waitForFunction(() => !originalMenu.isOpen)
    })
    test(`${name} ${framework}: SelectFaceted global and facet search keep typed values independent`, {tier: mode === 'granular' ? 'fast' : 'slow'}, async t => {
      const page = await pageFor(t, engine, mode, framework); await hydrate(page, mode, framework)
      await page.evaluate(() => faceted()); const trigger = page.locator('a-button').first(); await trigger.click()
      const rootSearch = page.locator('a-select-header input').first(); await rootSearch.fill('Beta')
      await page.locator('[data-facet="assignee"][data-option="false"]').click()
      await page.waitForFunction(() => reports.length === 1)
      assert.deepEqual(await page.evaluate(() => reports[0].value), {owner:[false],assignee:[false]})
      await rootSearch.fill(''); await page.getByRole('menuitem', {name:/^owner/}).click()
      const child = page.locator('a-menu a-menu').first(); await child.locator('input').fill('Gamma')
      await child.locator('[data-option="gamma"]').click(); await page.waitForFunction(() => reports.length === 2)
      assert.deepEqual(await page.evaluate(() => reports[1].value), {owner:[false,'gamma'],assignee:[false]})
    })
  }
}
