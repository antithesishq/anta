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
const consumerRoot = process.env.ANTA_INPUT_CONSUMER_ROOT ? resolve(process.env.ANTA_INPUT_CONSUMER_ROOT) : undefined
const source = process.env.ANTA_INPUT_PACKAGE_ROOT ? resolve(process.env.ANTA_INPUT_PACKAGE_ROOT, 'dist') : resolve('src')
const resolveDir = consumerRoot ?? process.cwd()
const nodePaths = consumerRoot ? [resolve(consumerRoot, 'node_modules')] : [resolve('node_modules'), resolve('site/node_modules')]
const jsxAlias = consumerRoot ? {} : { '@antadesign/anta/jsx-runtime': resolve(source, 'jsx-runtime') }
const preactCompat = consumerRoot ? 'preact/compat' : requireSite.resolve('preact/compat')
const policy = "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'none'; img-src 'self' data:; object-src 'none'"
const browsers = new Map(), assets = new Map(), renderers = new Map(), staticRenderers = new Map(), pageErrors = new WeakMap()
let server, origin
const components = consumerRoot ? "import {Input, Button, Tooltip, InputDate, InputAutocomplete, Select, SelectFaceted} from '@antadesign/anta'" :
  `import {Input, Button, Tooltip, InputDate, InputAutocomplete, Select, SelectFaceted} from '${source}/index'`
const factory = `const app = (props = {}) => React.createElement(Input, {
  id:'field', label:React.createElement('strong', {}, 'Message'),
  hint:React.createElement('em', {}, 'Helpful hint'), defaultValue:'Hello', clearable:true,
  leading:React.createElement('span', {}, 'Prefix'),
  trailing:React.createElement(Button, {'aria-label':'Action', icon:'eye'}), ...props,
  onValueChange:(event, attrs)=>{window.valueReport=attrs},
})`


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
    const entries = ['a-input', 'a-button', 'a-tooltip', 'a-calendar', 'a-select', 'a-select-faceted', 'a-input-date', 'a-menu', 'a-menu-item', 'a-menu-group', 'a-menu-separator', 'a-icon', 'a-checkbox']
    const base = consumerRoot ? '@antadesign/anta' : source
    const contents = mode === 'bundle'
      ? `import '${base}/bundle'; ${consumerRoot || process.env.ANTA_INPUT_PACKAGE_ROOT ? `import '${base}/bundle.css'` : ''}`
      : `import '${base}/tokens.css'; import '${base}/reset.css'; ${entries.map(entry => `import '${base}/elements/${entry}';`).join('\n')}`
    const result = await compile({stdin:{contents, resolveDir}, outfile:`${mode}.js`, format:'esm', alias:{react:preactCompat}})
    for (const file of result.outputFiles) assets.set(`/${mode}.${file.path.endsWith('.css') ? 'css' : 'js'}`, file.text)
  }
  {
    const base=consumerRoot?'@antadesign/anta':source
    const result=await compile({stdin:{contents:`import '${base}/tokens.css';import '${base}/reset.css';import '${base}/elements/a-input';`,resolveDir},outfile:'anchor.js',format:'esm',alias:{react:preactCompat}})
    for(const file of result.outputFiles) assets.set(`/anchor.${file.path.endsWith('.css')?'css':'js'}`,file.text)
  }
  if (process.env.ANTA_INPUT_COMPARE_ORIGINAL === '1' && !consumerRoot && !process.env.ANTA_INPUT_PACKAGE_ROOT) {
    const original = await build({stdin:{contents:`import './src/tokens.css';import './src/reset.css';import './src/elements/a-input';import './src/elements/a-button';import './src/elements/a-icon';`,resolveDir:process.cwd()},
      bundle:true,write:false,outfile:'original.js',format:'esm',target:'es2022',alias:{react:preactCompat},plugins:[{name:'original-input',setup(api){
        api.onLoad({filter:/[/\\](a-input\.(ts|css)|Input\.tsx)$/},args=>({contents:execFileSync('git',['show',`56eafcdd:${args.path.slice(process.cwd().length+1)}`],{encoding:'utf8'}),loader:args.path.endsWith('.css')?'css':args.path.endsWith('.tsx')?'tsx':'ts'}))
      }}]})
    for (const file of original.outputFiles) assets.set(`/original.${file.path.endsWith('.css')?'css':'js'}`,file.text)
  }
  for (const framework of ['React', 'Preact']) {
    const react = framework === 'React'
    const alias = {...jsxAlias, ...(react ? consumerRoot ? {} : {react:resolve('node_modules/react')} : {react:preactCompat})}
    const result = await compile({stdin:{contents:`import React from 'react'; ${components};
      ${react ? "import {renderToString} from 'react-dom/server'" : "import renderToString from 'preact-render-to-string'"};
      ${factory}; export const render = props => renderToString(app(props));
      import {configure} from '${consumerRoot ? '@antadesign/anta' : source+'/index'}';
      export const renderStatic = () => {
        configure(React.createElement,React.Fragment,{useState:()=>{throw new Error('Static Input must not use hooks')},useLayoutEffect:()=>{throw new Error('Static Input must not use hooks')}});
        try { return renderToString(React.createElement(Input,{label:'Static field',name:'static'})) }
        finally {configure(React.createElement,React.Fragment,React)}
      };`, resolveDir}, platform:'node', format:'cjs',
      jsx:'automatic', jsxImportSource:'@antadesign/anta', alias:{...alias, ...(consumerRoot ? {} : react ? {'react-dom/server':requirePlot.resolve('react-dom/server')} : {'preact-render-to-string':requireRenderer.resolve('preact-render-to-string')})}})
    const compiled = new Module(resolve(`tests/input-${framework}-server.cjs`))
    compiled._compile(result.outputFiles[0].text, compiled.id)
    renderers.set(framework, compiled.exports.render)
    staticRenderers.set(framework,compiled.exports.renderStatic)
    const client = await compile({stdin:{contents:`import React from 'react'; ${components};
      ${react ? "import {createRoot, hydrateRoot} from 'react-dom/client'" : "import {render, hydrate} from 'preact'"};
      ${factory}; let root; window.recoverableErrors=[];
      window.hydrateInput = props => { ${react ? "root = hydrateRoot(document.querySelector('#mount'), app(props), {onRecoverableError:e=>window.recoverableErrors.push(e.message)})" : "hydrate(app(props), document.querySelector('#mount'))"} };
      window.renderInput = props => { ${react ? "root ??= createRoot(document.querySelector('#mount')); root.render(app(props))" : "render(app(props), document.querySelector('#mount'))"} };
      window.renderAdornments = () => window.renderInput({
        leading:React.createElement('a-icon',{shape:'search'}),
        trailing:React.createElement(React.Fragment,{},...['case-sensitive','regex'].map(icon=>React.createElement(Button,{key:icon,icon,'aria-label':icon}))),
      });
      window.renderWithoutEvents = () => { const node=React.createElement(Input,{id:'field',label:'Message',defaultValue:'Fresh'}); ${react ? "root ??= createRoot(document.querySelector('#mount')); root.render(node)" : "render(node, document.querySelector('#mount'))"} };
      window.renderComposition = name => {
        const e=React.createElement;
        const node = name === 'tooltip' ? e(Input,{label:'Key'},e(Tooltip,{delay:0},'Tooltip hint')) :
          name === 'date' ? e(InputDate,{label:'Date',defaultValue:'2026-10-14',clearable:true}) :
          name === 'autocomplete' ? e(InputAutocomplete,{label:'Framework',suggestions:['React','Preact']}) :
          name === 'select' ? e(Select,{label:'Team',options:['Design','Engineering'],filter:true,clearable:true}) :
          e(SelectFaceted,{label:'Filters',searchable:true,renderTrigger:state=>e(Input,{button:true,label:'Filters',value:'Choose filters','aria-haspopup':'dialog','aria-expanded':state.open?'true':'false'}),facets:[{key:'team',label:'Team',kind:'multiple',options:['Design','Engineering'],filter:true}]});
        ${react ? "root ??= createRoot(document.querySelector('#mount')); root.render(node)" : "render(node, document.querySelector('#mount'))"}
      }`,resolveDir}, outfile:`${framework}.js`, format:'esm', jsx:'automatic', jsxImportSource:'@antadesign/anta',
      define:{'process.env.NODE_ENV':'"production"'}, alias:{...alias, ...(react && !consumerRoot ? {'react-dom/client':requirePlot.resolve('react-dom/client')} : {})}})
    assets.set(`/${framework}.js`, client.outputFiles.find(f=>f.path.endsWith('.js')).text)
  }
  assets.set('/consumer-unlayered.css', 'span{display:inline-block} a-input::part(field){border-radius:13px}')
  assets.set('/consumer-utilities.css', '@layer utilities{span{display:block} a-input::part(field){border-radius:15px}}')
  assets.set('/boot.js', `window.violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push({directive:e.effectiveDirective,source:e.sourceFile}));`)
  assets.set('/fixture.css', `body{margin:40px;font-family:system-ui} iframe{width:900px;height:500px;border:0} #mount{width:500px} .override::part(field){background:rgb(30,40,50);border-radius:11px;box-shadow:none}.override::part(input){color:white;font-size:18px}.override::part(input)::placeholder{color:rgb(200,210,220)}.narrow{width:180px}.spacer{height:900px}.dark{color-scheme:dark;background:#111}.rtl{direction:rtl}`)

  server = createServer((req,res) => {
    const url = new URL(req.url,'http://localhost'), mode = url.searchParams.get('mode') ?? 'granular'
    res.setHeader('Content-Security-Policy', mode==='original' ? policy.replace("style-src 'self'","style-src 'self' 'unsafe-inline'") : policy)
    res.setHeader('Content-Type', `${url.pathname.endsWith('.js') ? 'text/javascript' : url.pathname.endsWith('.css') ? 'text/css' : 'text/html'}; charset=utf-8`)
    res.end(assets.get(url.pathname) ?? `<!doctype html><link rel="stylesheet" href="/${mode}.css"><link rel="stylesheet" href="/fixture.css"><script src="/boot.js"></script><main id="mount">${url.searchParams.has('ssr') ? renderers.get(url.searchParams.get('framework') ?? 'React')({name:'message'}) : ''}</main><a href="#after" id="after">After</a>`)
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r)); origin=`http://127.0.0.1:${server.address().port}`
  for (const engine of engines) {
    const options = process.env.ANTA_INPUT_CHROMIUM_EXECUTABLE ? {executablePath:process.env.ANTA_INPUT_CHROMIUM_EXECUTABLE} : {channel:process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined}
    const browser = await engine.launch({headless:true,...(engine === chromium ? options : {})})
    browsers.set(engine,browser); console.log(`${engine.name()}: ${browser.version()}`)
  }
})
after(async () => { await Promise.all([...browsers.values()].map(b=>b.close())); if(server) await new Promise(r=>server.close(r)) })
async function pageFor(t,engine,mode='granular',query='',options={}) {
  const {knownShadowStyles=false,...context} = options
  const page=await browsers.get(engine).newPage({viewport:{width:900,height:500},reducedMotion:'reduce',...context})
  page.setDefaultTimeout(8000)
  const errors=[]; pageErrors.set(page,errors); page.on('pageerror',e=>errors.push(e.message))
  const response=await page.goto(`${origin}/?mode=${mode}${query}`)
  assert.equal(response.headers()['content-security-policy'],policy)
  t.after(async()=>{if(page.isClosed())return;try {assert.deepEqual(errors,[]);if(!knownShadowStyles) assert.deepEqual(await page.evaluate(()=>window.violations),[])} finally {await page.close()} })
  return page
}
const register=(page,mode='granular')=>page.evaluate(mode=>import(`/${mode}.js`),mode)
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
async function mount(page, html) {
  await page.locator('#mount').evaluate((node, html) => { node.innerHTML = html }, html)
  await frames(page)
}
const control = page => page.locator('a-input').first().locator('[part="input"]')
const field = page => page.locator('a-input').first()
const snapshot = page => field(page).evaluate(host => {
  const field = host.shadowRoot.querySelector('[part="field"]')
  const control = host.shadowRoot.querySelector('[part="input"]')
  return { height:control.clientHeight, scroll:control.scrollHeight, field:field.clientHeight,
    sizing:getComputedStyle(control).getPropertyValue('field-sizing'), min:getComputedStyle(field).minHeight }
})

test.fast('React and Preact SSR keep rich regions without fixed inline styles', () => {
  for(const render of staticRenderers.values()) assert.match(render(),/Static field/)
  for (const render of renderers.values()) {
    const html = render({name:'message'})
    assert.match(html, /<a-input/)
    assert.match(html, /<strong>Message<\/strong>/)
    assert.match(html, /slot="clear"/)
    assert.doesNotMatch(html, /style=|<input|<textarea|part=/)
  }
})
for (const engine of engines) for (const mode of ['granular','bundle']) {
  const name = `${engine.name()} ${mode}`
  test.fast(`${name}: initial metrics, native modes, and authored ownership`, async t => {
    const page = await pageFor(t,engine,mode)
    await mount(page,'<a-input value="Hello"><span slot="label">Message</span><span slot="hint">Hint</span></a-input>')
    const before = await field(page).boundingBox()
    await register(page,mode)
    assert.equal(await field(page).evaluate(host=>host.shadowRoot.querySelectorAll('style,link').length),0)
    assert.equal((await control(page).boundingBox()).height,20)
    assert.equal((await field(page).evaluate(host=>host.shadowRoot.querySelector('[part="field"]').getBoundingClientRect())).height,28)
    assert.equal((await field(page).boundingBox()).width,before.width)
    await field(page).evaluate(host=>{
      window.beforeMarkup=host.outerHTML;window.mutations=[]
      new MutationObserver(records=>mutations.push(...records.map(r=>r.type))).observe(host,{attributes:true,subtree:true,childList:true,characterData:true})
      host.value='Changed'
      host.shadowRoot.querySelector('input').focus()
    })
    await control(page).press('x')
    await control(page).blur()
    assert.deepEqual(await page.evaluate(()=>mutations),[])
    await field(page).evaluate(host=>host.setAttribute('rows','3'))
    assert.equal(await control(page).evaluate(node=>node.localName),'textarea')
    assert.equal((await snapshot(page)).height,68)
    await field(page).evaluate(host=>{host.removeAttribute('rows');host.setAttribute('button','');host.value=''})
    assert.equal(await control(page).evaluate(node=>node.localName),'button')
    assert.equal(await control(page).evaluate(node=>node.type),'button')
  })
  test.fast(`${name}: action insets preserve field sizes and contain icon buttons`, async t => {
    const page=await pageFor(t,engine,mode);await register(page,mode)
    for(const [size,height] of [['small',24],['medium',28],['large',32]]) {
      for(const direct of [false,true]) for(const multiline of [false,true]) {
        const clear=`<a-button role="button" tabindex="0" size="${size}" data-custom-event="clearrequest" ${direct?'slot="clear"':''}><a-icon shape="x"></a-icon></a-button>`
        const trailing=`<a-button role="button" ${direct?`slot="trailing" size="${size}"`:''}><a-icon shape="regex"></a-icon></a-button>`
        await mount(page,`<a-input size="${size}" value="Draft" ${multiline?'multiline rows="3"':''}>
          <a-icon slot="leading" shape="search"></a-icon>
          ${direct?clear:`<span slot="clear" data-input-contents>${clear}</span>`}
          ${direct?trailing:`<span slot="trailing" data-input-contents>${trailing}</span>`}
        </a-input>`)
        const metrics=await field(page).evaluate(host=>{
          const field=host.shadowRoot.querySelector('[part="field"]').getBoundingClientRect()
          const clearSlot=host.shadowRoot.querySelector('[part="clear"]')
          const clear=host.querySelector('[data-custom-event="clearrequest"]').getBoundingClientRect()
          const trailing=host.shadowRoot.querySelector('[part="trailing"]')
          const action=host.querySelector('[slot="trailing"] a-button, a-button[slot="trailing"]').getBoundingClientRect()
          const leading=host.querySelector('[slot="leading"]').getBoundingClientRect()
          const input=host.shadowRoot.querySelector('[part="input"]'),style=getComputedStyle(input)
          const firstLine=input.getBoundingClientRect().top+parseFloat(style.paddingTop)+parseFloat(style.lineHeight)/2
          return {firstLine,leadingCenter:leading.top+leading.height/2,clearCenter:clear.top+clear.height/2,
            actionCenter:action.top+action.height/2,
            fieldHeight:field.height,clearSize:[clear.width,clear.height],top:clear.top-field.top,
            clearPadding:getComputedStyle(clearSlot).padding,trailingPadding:getComputedStyle(trailing).paddingInlineEnd,
            end:field.right-action.right,actionSize:[action.width,action.height],actionTop:action.top-field.top}
        })
        if(!multiline)assert.equal(metrics.fieldHeight,height,JSON.stringify({size,direct,multiline,metrics}))
        if(multiline) for(const center of ['leadingCenter','clearCenter','actionCenter']) {
          assert.ok(Math.abs(metrics[center]-metrics.firstLine)<0.1,JSON.stringify({size,direct,center,metrics}))
        }
        const actionSize=multiline&&size==='large'?26:height-4
        assert.deepEqual(metrics.clearSize,[actionSize,actionSize])
        assert.equal(metrics.clearPadding,'2px')
        assert.equal(metrics.top,2)
        assert.equal(metrics.trailingPadding,'2px')
        assert.equal(metrics.end,2)
        assert.deepEqual(metrics.actionSize,[actionSize,actionSize])
        assert.equal(metrics.actionTop,2)
        await page.locator('[data-custom-event="clearrequest"]').click()
        assert.equal(await field(page).evaluate(host=>host.value),'')
      }
    }
    await field(page).evaluate(host=>host.dir='rtl')
    assert.equal(await field(page).evaluate(host=>{
      const field=host.shadowRoot.querySelector('[part="field"]').getBoundingClientRect()
      const trailing=host.querySelector('[slot="trailing"]').getBoundingClientRect()
      return trailing.left-field.left
    }),2)
    await mount(page,'<a-input><span slot="trailing">each</span></a-input>')
    assert.deepEqual(await field(page).evaluate(host=>{
      const clear=host.shadowRoot.querySelector('[part="clear"]')
      const trailing=getComputedStyle(host.shadowRoot.querySelector('[part="trailing"]'))
      return [clear.getBoundingClientRect().width,trailing.marginInlineEnd,trailing.paddingInlineEnd]
    }),[0,'7px','0px'])
    await mount(page,'<a-input size="small"><a-button role="button" slot="trailing" size="large"><a-icon shape="search"></a-icon><a-button-label>Find matches</a-button-label></a-button></a-input>')
    const labeled=await page.locator('a-button').boundingBox()
    assert.equal(labeled.height,32)
    assert.ok(labeled.width>32)
  })
  test.fast(`${name}: values, input/change, composition, selection, and handoff`, async t => {
    const page=await pageFor(t,engine,mode);await register(page,mode)
    await mount(page,'<a-input defaultvalue="Seed"></a-input>')
    await field(page).evaluate(host=>{
      window.events=[]
      for(const name of ['input','change','compositionstart','compositionend']) host.addEventListener(name,e=>events.push({type:e.type,value:host.value,composing:e.isComposing??false}))
    })
    await control(page).fill('Editing')
    assert.deepEqual(await page.evaluate(()=>events.filter(e=>e.type==='input'||e.type==='change').map(e=>e.type)),['input'])
    await control(page).press('Tab')
    assert.deepEqual(await page.evaluate(()=>events.filter(e=>e.type==='input'||e.type==='change').map(e=>e.type)),['input','change'])
    const result=await field(page).evaluate(host=>{
      const input=host.shadowRoot.querySelector('input');input.focus();input.setSelectionRange(2,4,'backward')
      host.value=host.value
      const same=[input.selectionStart,input.selectionEnd,input.selectionDirection]
      input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,composed:true,data:''}))
      input.value='日本語';input.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,isComposing:true,data:'語',inputType:'insertCompositionText'}))
      input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,composed:true,data:'日本語'}))
      host.setAttribute('value','Controlled');host.removeAttribute('value')
      const handoff=host.value;host.setAttribute('multiline','')
      return {same,handoff,rebuilt:host.value,focus:host.shadowRoot.activeElement?.localName}
    })
    assert.deepEqual(result,{same:[2,4,'backward'],handoff:'Controlled',rebuilt:'Controlled',focus:'textarea'})
    assert.ok(await page.evaluate(()=>events.some(e=>e.type==='input'&&e.composing)))
  })
  test.fast(`${name}: native and fallback autogrow preserve computed sizing and scroll`, async t => {
    const page=await pageFor(t,engine,mode)
    await page.evaluate(()=>{const supports=CSS.supports.bind(CSS);CSS.supports=(...args)=>args[0]==='field-sizing'?false:supports(...args)})
    await register(page,mode);await mount(page,'<div class="spacer"></div><a-input multiline maxrows="3"></a-input>')
    await field(page).evaluate(host=>host.value='Line\n'.repeat(40))
    assert.equal((await snapshot(page)).height,68)
    await control(page).evaluate(ta=>{ta.focus();ta.setSelectionRange(12,12);ta.scrollTop=30;window.scrollTo(0,document.body.scrollHeight)})
    const scroll=await control(page).evaluate(ta=>[window.scrollY,ta.scrollTop])
    await control(page).press('x')
    assert.deepEqual(await control(page).evaluate(ta=>[window.scrollY,ta.scrollTop]),scroll)
    await field(page).evaluate(host=>{host.removeAttribute('maxrows');host.value='One\nTwo\nThree\nFour'})
    assert.equal((await snapshot(page)).height,88)
    await field(page).evaluate(host=>host.value='Short')
    assert.equal((await snapshot(page)).height,28)
    await field(page).evaluate(host=>{host.setAttribute('rows','2');host.value='Many\n'.repeat(30)})
    assert.equal((await snapshot(page)).height,48)
    await field(page).evaluate(host=>host.setAttribute('maxrows','1'))
    assert.equal((await snapshot(page)).height,48)
    await field(page).evaluate(host=>{const parent=host.parentElement;host.remove();host.removeAttribute('rows');host.removeAttribute('maxrows');host.value='One\nTwo\nThree';parent.append(host)})
    assert.equal((await snapshot(page)).height,68)
  })
  test.fast(`${name}: form names, constraints, reset, restoration, and button exclusion`, async t => {
    const page=await pageFor(t,engine,mode);await register(page,mode)
    await mount(page,'<form><fieldset><a-input name="email" required type="email" defaultvalue="seed@example.com"></a-input><a-input button required name="trigger" value="Open"></a-input></fieldset></form>')
    const result=await field(page).evaluate(host=>{
      const form=host.closest('form'),fieldset=host.closest('fieldset');const values=()=>[...new FormData(form)]
      host.value='bad';const invalid=!host.checkValidity();host.value='good@example.com';const valid=host.checkValidity()
      const initial=values();host.name='renamed';const property=values();const attribute=host.getAttribute('name')
      host.setAttribute('name','authored');const authored=values()
      const removed=['',null,undefined].map(name=>{
        host.name=name
        return {attribute:host.getAttribute('name'),name:host.name,entries:values(),lookup:form.elements.namedItem('authored')===null}
      })
      host.name='authored'
      host.setAttribute('status','critical');const critical=host.validity.customError
      host.removeAttribute('status');form.reset();const reset=host.value
      host.formStateRestoreCallback('restored@example.com');const restored=host.value
      fieldset.disabled=true;const disabled=values();fieldset.disabled=false
      return {invalid,valid,initial,property,attribute,authored,removed,critical,reset,restored,disabled,button:form.querySelector('[button]').checkValidity()}
    })
    assert.deepEqual(result,{invalid:true,valid:true,initial:[['email','good@example.com']],property:[['renamed','good@example.com']],attribute:'renamed',authored:[['authored','good@example.com']],removed:[{attribute:'',name:'',entries:[],lookup:true},{attribute:null,name:'',entries:[],lookup:true},{attribute:null,name:'',entries:[],lookup:true}],critical:true,reset:'seed@example.com',restored:'restored@example.com',disabled:[],button:true})
    await field(page).evaluate(host=>{host.setAttribute('type','number');host.setAttribute('min','2');host.setAttribute('max','8');host.setAttribute('step','2');host.value='3'})
    assert.equal(await field(page).evaluate(host=>host.validity.stepMismatch),true)
    await field(page).evaluate(host=>host.value='10')
    assert.equal(await field(page).evaluate(host=>host.validity.rangeOverflow),true)
    await field(page).evaluate(host=>{host.setAttribute('type','text');host.setAttribute('pattern','[A-Z]+');host.value='lower'})
    assert.equal(await field(page).evaluate(host=>host.validity.patternMismatch),true)
  })
  test.fast(`${name}: focus rings exclude actions and preserve read-only and button modality`, async t => {
    const page=await pageFor(t,engine,mode);await register(page,mode)
    await mount(page,'<a-input><span slot="trailing"><a-button role="button" tabindex="0" aria-label="Action">Action</a-button></span></a-input><a-input readonly value="Pick"></a-input><a-input button value="Open"></a-input>')
    const ring=host=>host.evaluate(node=>getComputedStyle(node.shadowRoot.querySelector('[part="field"]')).outlineStyle)
    await control(page).click();assert.equal(await ring(field(page)),'solid')
    await page.locator('a-button').click();assert.equal(await ring(field(page)),'none')
    const readonly=page.locator('a-input[readonly]');await readonly.locator('input').click();assert.equal(await ring(readonly),'none')
    await control(page).click();await page.keyboard.press('Tab');await page.keyboard.press('Tab')
    assert.equal(await ring(readonly),'solid')
    const button=page.locator('a-input[button]');await button.locator('button').click();assert.equal(await ring(button),'none')
    await page.keyboard.press('Tab');await button.locator('button').focus();await frames(page);assert.equal(await ring(button),await button.locator('button').evaluate(node=>node.matches(':focus-visible')?'solid':'none'))
    await field(page).evaluate(host=>{host.setAttribute('dim-actions','');host.shadowRoot.querySelector('input').focus()})
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('a-input').shadowRoot.querySelector('[part="trailing"]')).opacity==='1')
  })
  test.fast(`${name}: document modality refresh visits only the focused button Input`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    await mount(page,Array.from({length:200},(_,i)=>`<a-input id="focus-${i}" ${i===199?'button':''} value="Field"></a-input>`).join(''))
    await page.locator('#focus-0').locator('[part="input"]').click();await frames(page)
    await page.evaluate(()=>{
      window.focusReads=[]
      const read=Object.getOwnPropertyDescriptor(ShadowRoot.prototype,'activeElement').get
      for(const host of document.querySelectorAll('a-input')) Object.defineProperty(host.shadowRoot,'activeElement',{
        configurable:true,get(){focusReads.push(host.id);return read.call(this)},
      })
    })
    await page.keyboard.type('Typing');await frames(page)
    assert.deepEqual(await page.evaluate(()=>focusReads),[])
    const button=page.locator('#focus-199').locator('[part="input"]')
    await button.click();await button.focus();await frames(page)
    await page.evaluate(()=>{focusReads=[]})
    await page.keyboard.press('a');await frames(page)
    assert.deepEqual(await page.evaluate(()=>focusReads),['focus-199'])
    assert.equal(await page.locator('#focus-199').evaluate(host=>host.matches(':state(control-focus)')===host.shadowRoot.querySelector('button').matches(':focus-visible')),true)
    await page.evaluate(()=>{focusReads=[]})
    await button.click();await frames(page)
    // WebKit can blur the button on pointer activation, leaving no refresh target.
    const pointerReads=await page.evaluate(()=>focusReads)
    assert.ok(pointerReads.length<=1&&pointerReads.every(id=>id==='focus-199'))
    assert.equal(await page.locator('#focus-199').evaluate(host=>host.matches(':state(control-focus)')===host.shadowRoot.querySelector('button').matches(':focus-visible')),true)
    // The document's activeElement is an outer host when focus is in a closed root.
    await page.evaluate(()=>{
      window.nestedInput=document.querySelector('#focus-199')
      const outer=document.createElement('div');document.querySelector('#mount').append(outer)
      outer.attachShadow({mode:'closed'}).append(nestedInput)
      nestedInput.shadowRoot.querySelector('button').focus()
    });await frames(page)
    await page.evaluate(()=>{focusReads=[]})
    await page.keyboard.press('a');await frames(page)
    assert.deepEqual(await page.evaluate(()=>focusReads),['focus-199'])
    assert.equal(await page.evaluate(()=>nestedInput.matches(':state(control-focus)')===nestedInput.shadowRoot.querySelector('button').matches(':focus-visible')),true)
    await page.locator('#after').focus();await frames(page)
    await page.evaluate(()=>{focusReads=[]})
    await page.keyboard.press('a');await frames(page)
    assert.deepEqual(await page.evaluate(()=>focusReads),[])
  })
  for(const framework of ['React','Preact']) {
    test.fast(`${name} ${framework}: boxless wrappers withstand consumer display rules`,async t=>{
      const page=await pageFor(t,engine,mode,`&ssr&framework=${framework}`)
      const before=await page.addStyleTag({url:'/consumer-unlayered.css'})
      assert.equal(await page.locator('[slot="label"]').evaluate(node=>getComputedStyle(node).display),'block')
      assert.deepEqual(await field(page).evaluate(host=>[...host.querySelectorAll(':scope > [slot]:not([slot="label"])')].map(node=>getComputedStyle(node).display)),['none','none','none','none'])
      await before.evaluate(node=>node.remove())
      await register(page,mode)
      await page.addScriptTag({url:`/${framework}.js`,type:'module'})
      await page.evaluate(()=>hydrateInput({name:'message'}));await frames(page)
      await page.evaluate(()=>renderAdornments());await frames(page)
      await page.evaluate(()=>{const span=document.createElement('span');span.id='consumer-span';span.textContent='Consumer';document.body.append(span)})
      const layout=()=>field(page).evaluate(host=>{
        const field=host.shadowRoot.querySelector('[part="field"]').getBoundingClientRect()
        const buttons=[...host.querySelectorAll('[slot="trailing"] a-button')].map(node=>node.getBoundingClientRect())
        const clear=host.querySelector('[slot="clear"] a-button').getBoundingClientRect()
        return {display:[...host.querySelectorAll(':scope > [data-input-contents]')].map(node=>getComputedStyle(node).display),
          height:field.height,gap:buttons[1].left-buttons[0].right,right:field.right-buttons[1].right,
          top:buttons[0].top-field.top,clearTop:clear.top-field.top}
      })
      const expected={display:Array(5).fill('contents'),height:28,gap:2,right:2,top:2,clearTop:2}
      assert.deepEqual(await layout(),expected)
      for(const [style,display,radius] of [['unlayered','inline-block','13px'],['utilities','block','15px']]) {
        const sheet=await page.addStyleTag({url:`/consumer-${style}.css`});await frames(page)
        assert.deepEqual(await layout(),expected)
        assert.equal(await page.locator('#consumer-span').evaluate(node=>getComputedStyle(node).display),display)
        assert.equal(await field(page).evaluate(host=>getComputedStyle(host.shadowRoot.querySelector('[part="field"]')).borderRadius),radius)
        await sheet.evaluate(node=>node.remove())
      }
      assert.deepEqual(await page.evaluate(()=>recoverableErrors),[])
    })
    for (const registration of ['before render','after render']) {
      test.fast(`${name} ${framework}: client form names reflect with registration ${registration}`,async t=>{
        const page=await pageFor(t,engine,mode)
        await page.locator('#mount').evaluate(node=>{
          const form=document.createElement('form');node.before(form);form.append(node)
        })
        if(registration==='before render') await register(page,mode)
        await page.addScriptTag({url:`/${framework}.js`,type:'module'})
        await page.evaluate(()=>renderInput({name:'email'}));await frames(page)
        if(registration==='after render') await register(page,mode)
        const identity=()=>field(page).evaluate(host=>{
          const form=host.closest('form'),name=host.name
          return {name,attribute:host.getAttribute('name'),entries:[...new FormData(form)],
            property:form.elements[name]===host,named:form.elements.namedItem(name)===host,
            document:[...document.getElementsByName(name)].includes(host),
            selector:document.querySelector(`a-input[name="${name}"]`)===host,
            control:host.shadowRoot.querySelector('[part="input"]').getAttribute('name')}
        })
        for(const name of ['email','renamed']) {
          if(name==='renamed') {
            await field(page).evaluate(host=>{window.originalHost=host;host.value='Edited'})
            await page.evaluate(()=>renderInput({name:'renamed'}));await frames(page)
            assert.equal(await field(page).evaluate(host=>host===originalHost),true)
            assert.equal(await page.evaluate(()=>document.querySelector('form').elements.namedItem('email')),null)
          }
          assert.deepEqual(await identity(),{name,attribute:name,entries:[[name,name==='email'?'Hello':'Edited']],
            property:true,named:true,document:true,selector:true,control:name})
        }
        await control(page).fill('Snapshot')
        assert.equal(await page.evaluate(()=>valueReport.name),'renamed')
        for(const name of ['',null,undefined]) {
          await page.evaluate(name=>renderInput({name}),name);await frames(page)
          // Preact assigns an empty string when removing a property prop.
          const attribute=name==null&&framework==='React'?null:''
          assert.deepEqual(await field(page).evaluate(host=>({name:host.name,attribute:host.getAttribute('name'),
            entries:[...new FormData(host.closest('form'))],old:host.closest('form').elements.namedItem('renamed'),
            value:host.value,control:host.shadowRoot.querySelector('[part="input"]').getAttribute('name')})),
            {name:'',attribute,entries:[],old:null,value:'Snapshot',control:attribute})
        }
      })
    }
    test.fast(`${name} ${framework}: SSR hydration retains nodes, rich ARIA, and clear lifecycle`,async t=>{
      const page=await pageFor(t,engine,mode,`&ssr&framework=${framework}`)
      await field(page).evaluate(host=>{window.serverHost=host;window.serverChildren=[...host.children]})
      await register(page,mode)
      await page.addScriptTag({url:`/${framework}.js`,type:'module'})
      await page.evaluate(()=>window.hydrateInput({name:'message'}));await frames(page)
      assert.deepEqual(await page.evaluate(()=>recoverableErrors),[])
      assert.equal(await field(page).getAttribute('name'),'message')
      assert.equal(await field(page).evaluate(host=>host===serverHost&&serverChildren.every((node,i)=>host.children[i]===node)),true)
      const native=control(page)
      assert.equal(await native.evaluate(node=>node.ariaLabelledByElements[0].textContent),'Message')
      assert.equal(await native.evaluate(node=>node.ariaDescribedByElements[0].textContent),'Helpful hint')
      await field(page).evaluate(host=>{window.clearEvents=[];for(const type of ['clearclick','input','change','clearinput'])host.addEventListener(type,event=>clearEvents.push(event.type));window.cancel=e=>e.preventDefault();host.addEventListener('clearclick',cancel)})
      await page.locator('[slot="clear"] a-button').click()
      assert.equal(await field(page).evaluate(host=>host.value),'Hello')
      assert.deepEqual(await page.evaluate(()=>clearEvents),['clearclick'])
      await field(page).evaluate(host=>{host.removeEventListener('clearclick',cancel);clearEvents=[]})
      await page.locator('[slot="clear"] a-button').click()
      assert.deepEqual(await page.evaluate(()=>clearEvents),['clearclick','input','change','clearinput'])
      assert.equal(await page.evaluate(()=>valueReport.value),'')
      assert.equal(await page.evaluate(()=>valueReport.name),'message')
      assert.equal(await native.evaluate(node=>node.getRootNode().activeElement===node),true)
      await page.evaluate(()=>renderInput({button:true,value:'Chosen',role:'combobox','aria-label':'Explicit','aria-expanded':'true'}));await frames(page)
      assert.equal(await control(page).getAttribute('role'),'combobox')
      assert.equal(await control(page).getAttribute('aria-label'),'Explicit')
      await page.evaluate(()=>renderInput({button:true,value:'Chosen'}));await frames(page)
      assert.equal(await control(page).getAttribute('role'),null)
      assert.equal(await control(page).getAttribute('aria-label'),null)
      assert.equal(await control(page).evaluate(node=>node.ariaLabelledByElements[0].textContent),'Message')
      assert.equal(await control(page).evaluate(node=>node.ariaDescribedByElements.map(n=>n.textContent).join('|')),'Chosen|Helpful hint')
      await page.evaluate(()=>renderWithoutEvents());await frames(page)
      await field(page).evaluate(host=>{window.eventlessHost=host;host.value='Retained edit'})
      await page.evaluate(()=>renderInput({defaultValue:'Fresh'}));await frames(page)
      assert.equal(await field(page).evaluate(host=>host===eventlessHost&&host.value==='Retained edit'),true)
    })
  }
  test(`${name}: types, password skeleton, placeholder, truncation, and consumer overrides`,async t=>{
    const page=await pageFor(t,engine,mode)
    await mount(page,'<a-input type="password" value="Secret" placeholder="Password"></a-input>')
    assert.doesNotMatch(await field(page).evaluate(node=>getComputedStyle(node,'::after').content),/Secret/)
    await register(page,mode)
    for(const type of ['text','email','password','tel','url','number','search']) {
      await field(page).evaluate((host,type)=>host.setAttribute('type',type),type)
      assert.equal(await control(page).getAttribute('type'),type)
    }
    await field(page).evaluate(host=>{host.setAttribute('type','number');host.value='3'})
    let box=await control(page).boundingBox()
    await page.mouse.click(box.x+box.width-8,box.y+5)
    // Chrome 135 cannot hide native number buttons through external part rules.
    // Accept that decoration difference without adding a shadow stylesheet.
    const chrome135=engine===chromium&&Number(browsers.get(engine).version().split('.')[0])===135
    // Firefox also retains its spinner in the original shadow stylesheet.
    const pointerValue=await field(page).evaluate(host=>host.value)
    assert.equal(pointerValue,engine===firefox||chrome135?'4':'3')
    if(assets.has('/original.js')) {
      const original=await browsers.get(engine).newPage({viewport:{width:900,height:500}})
      try {
        await original.goto(`${origin}/?mode=original`);await register(original,'original')
        await mount(original,'<a-input type="number" value="3"></a-input>')
        const nativeBox=await control(original).boundingBox()
        await original.mouse.click(nativeBox.x+nativeBox.width-8,nativeBox.y+5)
        assert.equal(await field(original).evaluate(host=>host.value),chrome135?'3':pointerValue)
      } finally {await original.close()}
    }
    await field(page).evaluate(host=>host.value='3')
    await control(page).press('ArrowUp')
    assert.equal(await field(page).evaluate(host=>host.value),'4')
    await field(page).evaluate(host=>{host.setAttribute('type','search');host.value='Query'})
    box=await control(page).boundingBox()
    await page.mouse.click(box.x+box.width-8,box.y+box.height/2)
    assert.equal(await field(page).evaluate(host=>host.value),'Query')
    await field(page).evaluate(host=>{host.setAttribute('type','text');host.setAttribute('readonly','');host.value='Long '.repeat(30);host.className='narrow override'})
    assert.equal(await control(page).evaluate(node=>getComputedStyle(node).textOverflow),'ellipsis')
    assert.equal(await control(page).evaluate(node=>getComputedStyle(node).fontSize),'18px')
    assert.equal(await field(page).evaluate(host=>getComputedStyle(host.shadowRoot.querySelector('[part="field"]')).borderRadius),'11px')
    await field(page).evaluate(host=>{host.value='';host.setAttribute('placeholder','Hint')})
    assert.equal(await control(page).evaluate(node=>getComputedStyle(node,'::placeholder').color),'rgb(200, 210, 220)')
    assert.equal(await field(page).evaluate(host=>getComputedStyle(host).transitionDuration),'0s')
    await page.locator('#mount').evaluate(node=>node.insertAdjacentHTML('beforeend','<dialog><a-input autofocus placeholder="Focused"></a-input></dialog>'))
    await page.locator('dialog').evaluate(dialog=>dialog.showModal())
    assert.equal(await page.locator('dialog a-input').evaluate(host=>host.shadowRoot.activeElement===host.shadowRoot.querySelector('input')),true)

  })
  test(`${name}: reconnection, adoption, rebuilds, and document listener cleanup`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    await mount(page,'<a-input button value="Chosen"><span slot="label">Label</span></a-input><iframe src="/?mode=anchor"></iframe>')
    const result=await field(page).evaluate(async host=>{
      const key=Symbol.for('anta.input-focus-modality'),doc=host.ownerDocument,control=host.shadowRoot.querySelector('button')
      host.remove();const released=doc[key]===undefined
      doc.querySelector('#mount').prepend(host);const retained=host.shadowRoot.querySelector('button')===control&&host.value==='Chosen'
      const frame=doc.querySelector('iframe');if(!frame.contentDocument?.querySelector('#mount'))await new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}))
      const target=frame.contentDocument;target.body.append(target.adoptNode(host))
      host.setAttribute('multiline','');host.value='One\nTwo';host.shadowRoot.querySelector('textarea').focus()
      const adopted=host.ownerDocument===target&&host.shadowRoot.querySelector('textarea').ownerDocument===target&&host.value==='One\nTwo'
      const newRegistry=target[key]?.readers.size===1,oldReleased=doc[key]===undefined
      host.remove();return {released,retained,adopted,newRegistry,oldReleased,cleaned:target[key]===undefined}
    })
    assert.deepEqual(result,{released:true,retained:true,adopted:true,newRegistry:true,oldReleased:true,cleaned:true})
  })
  test(`${name}: nested clear requests stay with their owning Input`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    await mount(page,'<a-input value="Outer"><a-input value="Inner"><span slot="clear"><a-button data-custom-event="clearrequest">Clear inner</a-button></span></a-input></a-input>')
    await page.locator('a-button').click()
    assert.deepEqual(await page.locator('a-input').evaluateAll(hosts=>hosts.map(host=>host.value)),['Outer',''])
  })
  for(const composition of ['tooltip','date','autocomplete','select','faceted']) test(`${name}: ${composition} composition and field anchoring`,async t=>{
    const knownShadowStyles=composition!=='tooltip'
    const page=await pageFor(t,engine,mode,'',{knownShadowStyles});await register(page,mode)
    await page.addScriptTag({url:'/Preact.js',type:'module'});await page.evaluate(name=>renderComposition(name),composition);await frames(page)
    assert.equal(await field(page).evaluate(host=>host.shadowRoot.querySelectorAll('style').length),0)
    await control(page).click()
    if(composition==='tooltip') {await field(page).hover();await page.waitForFunction(()=>document.querySelector('a-tooltip').shadowRoot.querySelector('[popover]').matches(':popover-open'))}
    else {
      await page.waitForFunction(()=>[...document.querySelectorAll('a-menu')].some(menu=>menu.isOpen))
      assert.equal(await field(page).evaluate(host=>host.getAnchorRect().height<host.getBoundingClientRect().height),true)
      const violations=await page.evaluate(()=>window.violations)
      assert.ok(violations.every(v=>v.directive==='style-src-elem' || v.directive==='style-src-attr'))
      assert.equal(await control(page).evaluate(node=>node.ariaControlsElements?.length>0),true)
    }
  })
}
for(const engine of engines) for(const order of [['anchor','bundle'],['bundle','anchor']]) test(`${engine.name()}: independent ${order.join(' then ')} builds share Input coordination and popup ARIA`,async t=>{
  const page=await pageFor(t,engine,order[0],'',{knownShadowStyles:true})
  await register(page,order[0]);await page.addStyleTag({url:`/${order[1]}.css`});await register(page,order[1])
  await mount(page,'<a-input button aria-label="Choices" value="Open"></a-input><a-menu><a-menu-item value="a">Alpha</a-menu-item></a-menu>')
  await control(page).click();await page.waitForFunction(()=>document.querySelector('a-menu').isOpen)
  assert.equal(await control(page).getAttribute('aria-label'),'Choices')
  assert.equal(await control(page).evaluate(node=>node.ariaControlsElements[0]===document.querySelector('a-menu')),true)
  assert.equal(await page.evaluate(()=>document[Symbol.for('anta.input-focus-modality')].readers.size),1)
})
for(const engine of engines) for(const mode of ['granular','bundle']) {
  const name=`${engine.name()} ${mode}`
  test(`${name}: native sizing, length constraints, search shorthand, and trusted touch`,async t=>{
    const page=await pageFor(t,engine,mode,'',{hasTouch:true});await register(page,mode)
    await mount(page,'<a-input multiline maxrows="3"></a-input>')
    await field(page).evaluate(host=>host.value='One\nTwo\nThree\nFour\nFive')
    assert.equal((await snapshot(page)).height,68)
    await field(page).evaluate(host=>host.value='Short')
    assert.equal((await snapshot(page)).height,28)
    await page.addScriptTag({url:'/Preact.js',type:'module'})
    await page.evaluate(()=>renderInput({type:'search',name:'query',minLength:3,maxLength:6,defaultValue:'',value:''}));await frames(page)
    assert.equal(await control(page).evaluate(node=>node.type),'text')
    assert.equal(await control(page).getAttribute('inputmode'),'search')
    assert.equal(await field(page).getAttribute('role'),null)
    assert.equal(await control(page).getAttribute('role'),'searchbox')
    await control(page).tap();await control(page).pressSequentially('ab')
    assert.equal(await field(page).evaluate(host=>host.validity.tooShort),true)
    await control(page).pressSequentially('cdefghi')
    assert.equal(await field(page).evaluate(host=>host.value.length),6)
    await page.locator('[slot="clear"] a-button').tap()
    assert.equal(await field(page).evaluate(host=>host.value),'')
    if(engine===chromium) {
      const client=await page.context().newCDPSession(page)
      const tree=await client.send('Accessibility.getFullAXTree')
      const names=tree.nodes.filter(node=>!node.ignored&&node.role?.value==='searchbox'&&node.name?.value==='Message')
      assert.equal(names.length,1)
      assert.equal(names[0].description?.value,'Helpful hint')
    }
  })
  test(`${name}: rich button labels and hints remain live through empty and changing content`,async t=>{
    const page=await pageFor(t,engine,mode);await register(page,mode)
    await mount(page,'<a-input button value="Selected"><span slot="label"><strong>Name</strong></span><span slot="hint"><em>Hint</em></span></a-input>')
    const described=()=>control(page).evaluate(node=>node.ariaDescribedByElements.map(n=>n.textContent).join('|'))
    assert.equal(await described(),'Selected|Hint')
    await page.locator('[slot="label"] strong').evaluate(node=>node.textContent='');await frames(page)
    assert.equal(await described(),'Hint')
    await page.locator('[slot="label"] strong').evaluate(node=>node.textContent='Changed');await frames(page)
    assert.equal(await described(),'Selected|Hint')
    await page.locator('[slot="hint"] em').evaluate(node=>node.textContent='Updated hint')
    assert.equal(await described(),'Selected|Updated hint')
    await field(page).evaluate(host=>{host.ariaLabel='Explicit';host.ariaDescription='Explicit hint'})
    assert.equal(await control(page).getAttribute('aria-description'),'Explicit hint')
    await field(page).evaluate(host=>{host.ariaLabel=null;host.ariaDescription=null})
    assert.equal(await described(),'Selected|Updated hint')
  })
  test(`${name}: visual variants retain field metrics and typography`,async t=>{
    const variants=[['plain','value="Text"'],['small','size="small" value="Small"'],['large','size="large" value="Large"'],['secondary','priority="secondary"'],['tertiary','priority="tertiary"'],['critical','status="critical" value="Error"'],['round','round value="Rounded"'],['disabled','disabled value="Disabled"'],['readonly','readonly value="Long value"'],['button','button value="Chosen"'],['placeholder','button placeholder="Choose"'],['multiline','multiline value="One&#10;Two&#10;Three"'],['fixed','rows="3" value="Notes"'],['dark','value="Dark"'],['rtl','value="RTL"'],['override','class="override" value="Custom"']]
    const out=resolve('tests/.test-output/input');await mkdir(out,{recursive:true})
    const results=[]
    for(const [variant,attrs] of variants) {
      const current=await pageFor(t,engine,mode)
      await mount(current,`<a-input ${attrs}><span slot="label"><strong>Message</strong></span><a-icon slot="leading" shape="search"></a-icon><span slot="hint"><em>Helpful hint</em></span></a-input>`)
      await current.locator('body').evaluate((body,name)=>body.className=name,variant)
      await register(current,mode);await frames(current)
      current.setDefaultTimeout(8000)
      const metrics=page=>field(page).evaluate(host=>{
        const regions=[host,...host.shadowRoot.querySelectorAll('[part]')]
        return regions.map(node=>{const b=node.getBoundingClientRect(),s=getComputedStyle(node);return {part:node.getAttribute('part')??'host',box:[b.x,b.y,b.width,b.height],font:[s.fontFamily,s.fontSize,s.lineHeight,s.fontWeight,s.fontStretch,s.fontStyle],appearance:[s.backgroundColor,s.color,s.borderRadius,s.boxShadow,s.padding,s.textOverflow]}})
      })
      const actual=await metrics(current)
      assert.equal(actual.find(region=>region.part==='field').box[3],variant==='small'?24:variant==='large'?32:variant==='multiline'||variant==='fixed'?68:28)
      assert.equal(actual.find(region=>region.part==='label').box[3],variant==='small'?16:variant==='large'?22:20)
      if(assets.has('/original.js')) {
        const original=await browsers.get(engine).newPage({viewport:{width:900,height:500},reducedMotion:'reduce'})
        original.setDefaultTimeout(8000)
        try {
          await original.goto(`${origin}/?mode=original`)
          await mount(original,await current.locator('#mount').innerHTML())
          await original.locator('body').evaluate((body,name)=>body.className=name,variant)
          await register(original,'original');await frames(original)
          assert.deepEqual(actual,await metrics(original),`${name} ${variant}`)
        } finally {await original.close()}
      }
      // WebKit's screenshot synchronization injects a style element. Capture in
      // a separate context; behavior and computed-style checks above retain CSP.
      const capture=engine===webkit?await browsers.get(engine).newPage({viewport:{width:900,height:500},reducedMotion:'reduce',bypassCSP:true}):current
      try {
        if(capture!==current) {await capture.goto(`${origin}/?mode=${mode}`);await mount(capture,await current.locator('#mount').innerHTML());await capture.locator('body').evaluate((body,name)=>body.className=name,variant);await register(capture,mode);await frames(capture)}
        await capture.screenshot({timeout:8000,path:resolve(out,`${engine.name()}-${mode}-${variant}.png`)})
      } finally {if(capture!==current)await capture.close()}
      results.push({variant,metrics:actual})
      assert.deepEqual(pageErrors.get(current),[])
      assert.deepEqual(await current.evaluate(()=>window.violations),[])
      await current.close()
    }
    await import('node:fs/promises').then(fs=>fs.writeFile(resolve(out,`${engine.name()}-${mode}.json`),JSON.stringify(results,null,2)))
  })
}
