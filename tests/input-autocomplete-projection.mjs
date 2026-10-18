import assert from 'node:assert/strict'
import { before } from 'node:test'
import { Module } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { componentTest as test } from './component-tier.mjs'

let runtime
before(async () => {
  const result = await build({
    stdin: {contents: `export {InputAutocomplete} from './src/components/InputAutocomplete';export {configure} from './src/jsx-runtime'`, resolveDir: process.cwd()},
    bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    alias: {'@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts')},
  })
  const compiled = new Module(resolve('tests/input-autocomplete.fixture.cjs'))
  compiled._compile(result.outputFiles[0].text, compiled.id)
  runtime = compiled.exports
})
const h = (type, props, ...children) => {
  const attrs = {...props, ...(children.length ? {children} : {})}
  return typeof type === 'function' ? type(attrs) : {type, props: attrs}
}
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []
const field = tree => nodes(tree).find(n => n.type === 'a-input').props
const menu = tree => nodes(tree).find(n => n.type === 'a-menu').props
const rows = tree => nodes(tree).filter(n => n.type === 'a-menu-item')
const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : typeof node === 'boolean' ? '' : node ?? ''
function renderer(props, deferred = false) {
  let cursor
  const state = [], pending = []
  runtime.configure(h, Symbol.for('fragment'), {
    useState: initial => {
      const slot = cursor++
      if (!(slot in state)) state[slot] = initial
      return [state[slot], next => {
        const update = () => {state[slot] = typeof next === 'function' ? next(state[slot]) : next}
        if (deferred) pending.push(update)
        else update()
      }]
    },
    useMemo: factory => factory(),
  })
  const render = (updates = {}) => {props = {...props, ...updates};cursor = 0;return runtime.InputAutocomplete(props)}
  render.flush = () => {while (pending.length) pending.shift()()}
  return render
}

for (const browserShim of [false, true]) test.fast(`Autocomplete forwards worker callbacks and snapshots edits (window shim: ${browserShim})`, () => {
  if (browserShim) globalThis.window = {}
  try {
    const reports = [], render = renderer({
      suggestions: ['Alpha'],
      onFocus: () => reports.push('focus'), onBlur: () => reports.push('blur'),
      onInput: e => {reports.push('input');e.currentTarget.value = 'consumer edit'},
      onValueChange: value => reports.push(value),
      onKeyDown: e => {reports.push(e.key);if (e.cancel) e.preventDefault()},
    }, true)
    let tree = render()
    field(tree).onFocus({})
    render.flush();tree = render()
    assert.equal(menu(tree).state, 'open')
    const event = {currentTarget: {value: 'Al'}}
    field(tree).oninput(event)
    event.currentTarget = null
    render.flush();tree = render()
    assert.equal(field(tree).value, 'Al')
    assert.deepEqual(reports, ['focus', 'input', 'Al'])
    for (const extra of [{cancel:true}, {isComposing:true}, {nativeEvent:{isComposing:true}}, {keyCode:229}, {defaultPrevented:true}]) {
      field(tree).onKeyDown({key:'Enter', ...extra, preventDefault() {this.defaultPrevented = true}})
      render.flush();tree = render()
      assert.equal(menu(tree).state, 'open')
    }
    field(tree).onKeyDown({key:'Enter'})
    render.flush();tree = render()
    assert.equal(menu(tree).state, 'closed')
    field(tree).onFocus({});render.flush();tree = render()
    field(tree).onBlur({});render.flush();tree = render({suggestions:['New result'],filter:false})
    assert.equal(menu(tree).state, 'closed')
    assert.equal(field(tree).value, 'Al')
    assert.equal(reports.at(-1), 'blur')
  } finally {if (browserShim) delete globalThis.window}
})

test.fast('Autocomplete preserves raw custom queries, option identity, and presentation without leaking application data', () => {
  const alpha = {value:'a',label:'Alpha',hint:'Design',icon:'check',className:'person',style:{fontWeight:600},'data-person':'a','data-menu-open':'',onMouseDown:()=>assert.fail('option data is not an event handler'),metadata:{team:'Studio'}}
  const seen = [], picked = [], render = renderer({suggestions:[alpha,'Beta'],defaultValue:'  Al  ',filter:(o,q)=>{seen.push([o,q]);return o === alpha},onSelect:o=>picked.push(o)})
  let tree = render()
  assert.equal(seen.length, 2)
  assert.equal(seen[0][0], alpha)
  assert.deepEqual(seen.map(([,q])=>q), ['  Al  ','  Al  '])
  const row = rows(tree)[0]
  assert.equal(row.props.tabIndex, -1)
  assert.equal(row.props.class, 'person')
  assert.equal(row.props.style.fontWeight, 600)
  assert.equal(row.props['data-person'], 'a')
  for (const key of ['metadata','data-menu-open']) assert.equal(row.props[key], undefined)
  assert.notEqual(row.props.onMouseDown, alpha.onMouseDown)
  assert.equal(text(row), 'AlphaDesign')
  row.props.onMouseDown({preventDefault(){}})
  row.props.onmenuselect({})
  tree = render()
  assert.equal(field(tree).value, 'a')
  assert.equal(picked[0], alpha)
  seen.length = 0
  render({value:''})
  assert.deepEqual(seen.map(([,q])=>q), ['',''])
})

test.fast('Autocomplete keeps reset notifications separate from focus through deferred worker updates', () => {
  const reports = [], render = renderer({suggestions:['Alpha'],filter:false,onValueChange:v=>reports.push(v)},true)
  let tree = render()
  field(tree).oninput({currentTarget:{value:''}})
  render.flush();tree = render()
  assert.equal(menu(tree).state, 'closed')
  field(tree).onFocus({})
  field(tree).oninput({currentTarget:{value:'Al'}})
  render.flush();tree = render()
  assert.equal(menu(tree).state, 'open')
  assert.equal(field(tree).value, 'Al')
  field(tree).onBlur({})
  const reset = {currentTarget:{value:''}}
  field(tree).oninput(reset)
  reset.currentTarget = null
  render.flush();tree = render()
  assert.equal(menu(tree).state, 'closed')
  assert.equal(field(tree).value, '')
  assert.deepEqual(reports, ['', 'Al', ''])
})

test.fast('Autocomplete retains text ownership through external clearing, rejected picks, and accepted updates', () => {
  const reports = [], render = renderer({suggestions:['Alpha',''],value:'',defaultValue:'Seed',onValueChange:v=>reports.push(v)})
  let tree = render()
  assert.equal(field(tree).value, '')
  assert.equal(field(tree).defaultvalue, 'Seed')
  rows(tree)[0].props.onmenuselect({})
  assert.deepEqual(reports, ['Alpha'])
  assert.equal(field(render()).value, '')
  tree = render({value:'Alpha'})
  assert.equal(field(tree).value, 'Alpha')
  tree = render({value:''})
  assert.equal(field(tree).value, '')
  assert.deepEqual(reports, ['Alpha'])
  tree = render({value:undefined,defaultValue:'Changed'})
  assert.equal(field(tree).value, 'Seed')
  field(tree).oninput({currentTarget:{value:'Arbitrary text'}})
  assert.equal(field(render()).value, 'Arbitrary text')
})

test.fast('Autocomplete built-in matching escapes queries, highlights labels and hints, and keeps remote results unfiltered', () => {
  const render = renderer({suggestions:[{value:'machine',label:'C++ guide',hint:'Two  words'},'Other'],defaultValue:'C++'})
  let tree = render()
  assert.equal(rows(tree).length, 1)
  assert.equal(text(nodes(tree).find(n=>n.type==='b')), 'C++')
  tree = render({value:'two words'})
  assert.equal(rows(tree).length, 1)
  assert.equal(text(nodes(tree).find(n=>n.type==='b')), 'Two  words')
  tree = render({filter:false})
  assert.equal(rows(tree).length, 2)
  assert.equal(nodes(tree).some(n=>n.type==='b'), false)
})
