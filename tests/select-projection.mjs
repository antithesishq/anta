import assert from 'node:assert/strict'
import { before } from 'node:test'
import { Module } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { componentTest as test } from './component-tier.mjs'

let runtime
before(async () => {
  const result = await build({
    stdin: { contents: `export {Select, optionsWithSelection} from './src/components/Select'; export {SelectFaceted} from './src/components/SelectFaceted'; export {configure} from './src/jsx-runtime'`, resolveDir: process.cwd() },
    bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    alias: { '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts') },
  })
  const compiled = new Module(resolve('tests/select-projection.fixture.cjs'))
  compiled._compile(result.outputFiles[0].text, compiled.id)
  runtime = compiled.exports
})

const h = (type, props, ...children) => {
  const attrs = { ...props, ...(children.length ? { children } : {}) }
  return typeof type === 'function' ? type(attrs) : { type, props: attrs }
}
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []
const rows = tree => nodes(tree).filter(n => n.type === 'a-menu-item')
const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : typeof node === 'boolean' ? '' : node ?? ''
const row = (tree, label) => rows(tree).find(n => text(n).includes(label))
function renderer(component, initialProps, deferred = false) {
  let cursor, props = initialProps
  const state = [], pending = []
  runtime.configure(h, Symbol.for('fragment'), {
    useState: initial => {
      const slot = cursor++
      if (!(slot in state)) state[slot] = initial
      return [state[slot], next => {
        const apply = () => { state[slot] = typeof next === 'function' ? next(state[slot]) : next }
        if (deferred) pending.push(apply)
        else apply()
      }]
    },
    useMemo: factory => factory(),
  })
  const render = (updates = {}) => { cursor = 0; props = { ...props, ...updates }; return component(props) }
  render.flush = () => { while (pending.length) pending.shift()() }
  return render
}

for (const browserShim of [false, true]) test.fast(`Select prepares each option once in a worker renderer (window shim: ${browserShim})`, () => {
  if (browserShim) globalThis.window = {}
  try {
    const alpha = { value: 1, label: 'Alpha', metadata: { team: 'Design' } }
    const beta = { value: false, label: 'Beta' }
    const seen = []
    const render = renderer(runtime.Select, {
      label: 'Assignee', selection: 'multiple',
      options: [{ label: 'People', options: [alpha, { label: 'Archived', submenu: [beta], disabled: true }] }, 'Hidden'],
      filter: (option, query) => { seen.push([option, query]); return option.value !== 'Hidden' },
      renderOption: (option, state) => h('span', { 'data-disabled': state.disabled }, option.label),
    })
    let tree = render()
    assert.deepEqual(seen.map(([o, q]) => [o.value, q]), [[1, ''], [false, ''], ['Hidden', '']])
    assert.equal(seen[0][0], alpha)
    assert.equal(row(tree, 'Archived').props.disabled, '')
    assert.equal(row(tree, 'Beta').props.disabled, '')
    assert.equal(row(tree, 'Hidden'), undefined)
    const search = nodes(tree).find(n => n.type === 'a-input' && n.props['data-menu-search'] === '')
    search.props.oninput({ currentTarget: { value: '  Al  ' } })
    seen.length = 0
    tree = render()
    assert.deepEqual(seen.map(([o, q]) => [o.value, q]), [[1, 'Al'], [false, 'Al'], ['Hidden', 'Al']])
    assert.equal(rows(tree).some(n => n.props.submenu !== undefined), false)
    assert.equal(row(tree, 'Beta').props.disabled, '')
  } finally { if (browserShim) delete globalThis.window }
})

test.fast('Select filtered bulk changes preserve hidden, disabled, and unknown selections and option identity', () => {
  const alpha = { value: 1, label: 'Alpha' }, beta = { value: false, label: 'Beta' }
  const reports = []
  const render = renderer(runtime.Select, {
    label: 'Team', selection: 'multiple', clearable: true, defaultValue: ['hidden', 'locked', 'unknown'],
    options: [alpha, beta, { value: 'hidden', label: 'Hidden' }, { label: 'Locked', disabled: true, submenu: [{ value: 'locked', label: 'Locked option' }] }],
    filter: o => o.value === 1 || o.value === false,
    onValueChange: (value, attrs) => reports.push({ value, attrs }),
  })
  let tree = render()
  row(tree, 'Select all').props.onmenuselect({})
  assert.deepEqual(reports.at(-1), { value: ['hidden', 'locked', 'unknown', 1, false], attrs: { all: true, selected: true } })
  tree = render()
  assert.equal(nodes(tree).find(n => n.type === 'a-input').props.value, 'All')
  row(tree, 'Select all').props.onmenuselect({})
  assert.deepEqual(reports.at(-1).value, ['hidden', 'locked', 'unknown'])
  tree = render()
  row(tree, 'Alpha').props.onmenuselect({ altKey: true })
  assert.deepEqual(reports.at(-1), { value: [1], attrs: { value: 1, option: alpha, selected: true } })
  assert.equal(reports.at(-1).attrs.option, alpha)
  tree = render()
  row(tree, 'Clear').props.onmenuselect({})
  assert.deepEqual(reports.at(-1), { value: [], attrs: { all: true, selected: false } })
  assert.equal(row(render(), 'Clear'), undefined)
})

test.fast('Select keeps controlled typed values, summary hooks, and empty custom predicates', () => {
  const reports = [], seen = []
  const render = renderer(runtime.Select, {
    label: 'State', options: [{ value: false, label: 'Off' }, { value: 0, label: 'Zero' }], value: false,
    filter: () => false, renderEmpty: state => { seen.push(state); return 'No choices' },
    onValueChange: (...args) => reports.push(args),
  })
  let tree = render()
  assert.deepEqual(seen, [{ query: '' }])
  assert.equal(nodes(tree).find(n => n.type === 'a-input').props.value, 'Off')
  tree = render({ filter: false })
  row(tree, 'Zero').props.onmenuselect({})
  assert.equal(reports.at(-1)[0], 0)
  assert.equal(nodes(render()).find(n => n.type === 'a-input').props.value, 'Off')
  assert.equal(nodes(render({ value: 0 })).find(n => n.type === 'a-input').props.value, 'Zero')
  tree = render({ selection: 'multiple', value: [false], renderSummary: selected => selected.map(o => o.label).join(' / ') })
  assert.equal(nodes(tree).find(n => n.type === 'a-input').props.value, 'Off')
})

test.fast('public option selection and SelectFaceted retain independent facet values and shared option data', () => {
  const option = { value: false, label: 'Off', extra: { source: 'app' } }
  const options = [{ label: 'Group', options: [option, { label: 'More', submenu: ['Other'] }] }]
  const selected = runtime.optionsWithSelection(options, false)
  assert.equal(selected[0].selectionState, 'some')
  assert.equal(selected[0].options[0].selected, true)
  assert.equal(selected[0].options[0].extra, option.extra)
  const reports = []
  const render = renderer(runtime.SelectFaceted, {
    facets: ['owner', 'assignee'].map(key => ({ key, label: key, kind: 'multiple', selectAll: false, options, filter: o => o.value === false })),
    defaultValue: { owner: [false] }, onValueChange: value => reports.push(value),
  })
  const tree = render()
  const off = rows(tree).filter(n => text(n) === 'Off')
  assert.equal(off.length, 2)
  off[1].props.onmenuselect({})
  assert.deepEqual(reports.at(-1), { owner: [false], assignee: [false] })
  assert.equal(option.disabled, undefined)
  assert.equal('selected' in option, false)
})

test.fast('SelectFaceted retains a filter query after native event dispatch completes', () => {
  const render = renderer(runtime.SelectFaceted, {
    facets: [{key:'owner',label:'Owner',kind:'multiple',selectAll:false,filter:true,options:['Alpha','Beta']}],
  }, true)
  const field = nodes(render()).find(n => n.type === 'a-input' && n.props['aria-label'] === 'Filter Owner')
  const event = {currentTarget:{value:'Beta'}}
  field.props.oninput(event)
  event.currentTarget = null
  render.flush()
  const choices = rows(render()).filter(n => n.props.role === 'menuitemcheckbox')
  assert.deepEqual(choices.map(text), ['Beta'])
})

for (const commit of ['Enter','blur']) test.fast(`SelectFaceted retains deferred text drafts and commits on ${commit}`, () => {
  const reports = []
  const render = renderer(runtime.SelectFaceted, {
    facets:[{key:'title',label:'Title',kind:'text'}],
    onValueChange:(value,attrs) => reports.push({value,attrs}),
  }, true)
  const field = tree => nodes(tree).find(n => n.type === 'a-input' && n.props['aria-label'] === 'Title')
  const event = {currentTarget:{value:'Draft title '}}
  field(render()).props.oninput(event)
  event.currentTarget = null
  render.flush()
  const draft = field(render())
  assert.equal(draft.props.value,'Draft title ')
  assert.deepEqual(reports,[])
  if (commit === 'Enter') draft.props.onKeyDown({key:'Enter',preventDefault(){}})
  else draft.props.onBlur({})
  render.flush()
  assert.deepEqual(reports,[{value:{title:'Draft title '},attrs:{facet:'title',kind:'text',value:'Draft title '}}])
})

for (const browserShim of [false, true]) test.fast(`SelectFaceted keeps search semantics and facet queries independent in a worker renderer (window shim: ${browserShim})`, () => {
  if (browserShim) globalThis.window = {}
  try {
    const option = { value: false, label: 'Off [test]', hint: 'Design\tteam', tooltip: '' }
    const seen = []
    const render = renderer(runtime.SelectFaceted, {
      searchable: true,
      facets: [
        { key: 'owner', label: 'Owner', kind: 'multiple', selectAll: false, filter: true, options: [option, { value: 0, label: 'Zero', tooltip: '' }] },
        { key: 'assignee', label: 'Assignee', kind: 'single', filter: true, options: [option, 'Other'] },
        { key: 'status', label: 'Status', kind: 'single', filter: false, options: [option, 'Other'] },
        { key: 'custom', label: 'Custom', kind: 'single', filter: (o, q) => { seen.push([o, q]); return q === '  Design team  ' }, options: [option] },
      ],
    })
    const field = (tree, name) => nodes(tree).find(n => n.type === 'a-input' && n.props['aria-label'] === name)
    let tree = render()
    field(tree, 'Filter Owner').props.oninput({ currentTarget: { value: '0' } })
    field(tree, 'Filter Assignee').props.oninput({ currentTarget: { value: '[test]' } })
    tree = render()
    assert.equal(field(tree, 'Filter Owner').props.value, '0')
    assert.equal(field(tree, 'Filter Assignee').props.value, '[test]')
    assert.equal(field(tree, 'Filter Status'), undefined)
    assert.deepEqual(rows(tree).filter(n => n.props.role === 'menuitemcheckbox').map(text), ['Zero'])
    field(tree, 'Filter all facets').props.oninput({ currentTarget: { value: '  Design team  ' } })
    seen.length = 0
    tree = render()
    assert.equal(nodes(tree).filter(n => n.type === 'a-menu-group').length, 4)
    assert.deepEqual(seen, [[option, '  Design team  ']])
    field(tree, 'Filter all facets').props.oninput({ currentTarget: { value: 'false' } })
    assert.equal(nodes(render()).filter(n => n.type === 'a-menu-group').length, 3)
    field(render(), 'Filter all facets').props.oninput({ currentTarget: { value: '' } })
    tree = render()
    assert.equal(field(tree, 'Filter Owner').props.value, '0')
    assert.equal(field(tree, 'Filter Assignee').props.value, '[test]')
  } finally { if (browserShim) delete globalThis.window }
})

test.fast('SelectFaceted filtered bulk changes retain hidden, disabled, and independent typed values', () => {
  const reports = []
  const render = renderer(runtime.SelectFaceted, {
    defaultValue: { owner: ['hidden'], assignee: [false] },
    onValueChange: (value, attrs) => reports.push({ value, attrs }),
    facets: [{ key: 'owner', label: 'Owner', kind: 'multiple', filter: true, options: [
      { label: 'Group', options: [{ value: false, label: 'Match false', tooltip: '' }, { label: 'Submenu', submenu: [{ value: 0, label: 'Match zero', tooltip: '' }] }] },
      { value: 'locked', label: 'Match locked', disabled: true }, 'hidden',
    ] }],
  })
  const filter = nodes(render()).find(n => n.type === 'a-input')
  const bulk = tree => rows(tree).find(n => text(n) === 'Select all')
  filter.props.oninput({ currentTarget: { value: 'Match' } })
  let tree = render()
  assert.equal(rows(tree).find(n => text(n) === 'Match locked').props.disabled, '')
  bulk(tree).props.onmenuselect({})
  assert.deepEqual(reports.at(-1), { value: { owner: ['hidden', false, 0], assignee: [false] }, attrs: { facet: 'owner', kind: 'multiple', value: ['hidden', false, 0] } })
  tree = render()
  assert.equal(bulk(tree).props['aria-checked'], 'true')
  bulk(tree).props.onmenuselect({})
  assert.deepEqual(reports.at(-1).value, { owner: ['hidden'], assignee: [false] })
})

test.fast('SelectFaceted controlled text updates preserve active typing and synchronize external replacements and clearing', () => {
  const reports = []
  const render = renderer(runtime.SelectFaceted, {
    value: { title: 'Applied', owner: false },
    facets: [{ key: 'title', label: 'Title', kind: 'text' }],
    onValueChange: (value, attrs) => reports.push({ value, attrs }),
  })
  const field = () => nodes(render()).find(n => n.type === 'a-input')
  render()
  field().props.oninput({ currentTarget: { value: 'Typing ' } })
  render({ value: { title: 'Applied', owner: 0 } })
  assert.equal(field().props.value, 'Typing ')
  field().props.onKeyDown({ key: 'Enter', preventDefault() {} })
  assert.deepEqual(reports.at(-1).value, { title: 'Typing ', owner: 0 })
  assert.equal(field().props.value, 'Typing ')
  render({ value: { title: 'External', owner: 0 } })
  assert.equal(field().props.value, 'External')
  render({ value: {} })
  assert.equal(field().props.value, '')
  const count = reports.length
  field().props.onBlur({})
  assert.equal(reports.length, count)
})

for (const value of ['alpha', '', 0, false]) test.fast(`Select single Clear reports null for ${JSON.stringify(value)} (${typeof value})`, () => {
  const reports = []
  const render = renderer(runtime.Select, {
    options: [{value, label:'Chosen'}], defaultValue:value, clearable:true,
    onValueChange:(value,attrs) => reports.push({value,attrs}),
  })
  row(render(), 'Clear').props.onmenuselect({})
  assert.deepEqual(reports, [{value:null,attrs:{all:true,selected:false}}])
  assert.equal(nodes(render()).find(n => n.type==='a-input').props.value, '')
})

test.fast('SelectFaceted empty built-in queries retain every option and custom filters receive raw whitespace', () => {
  const seen = []
  const options = [{value:0,label:'Zero'}, {value:false,label:'Off'}, {value:'disabled',label:'Unavailable',disabled:true}]
  const render = renderer(runtime.SelectFaceted, {
    searchable:true,
    facets:[
      {key:'built-in',label:'Built in',kind:'single',filter:true,options},
      {key:'custom',label:'Custom',kind:'single',filter:(option,query)=>{seen.push(query);return query==='  Al'},options:[{value:'alpha',label:'Alpha'}]},
    ],
  })
  const field = (tree,name) => nodes(tree).find(n=>n.type==='a-input' && n.props['aria-label']===name)
  let tree = render()
  assert.deepEqual(seen,[''])
  field(tree,'Filter Built in').props.oninput({currentTarget:{value:'   '}})
  field(tree,'Filter Custom').props.oninput({currentTarget:{value:'  Al'}})
  seen.length=0
  tree=render()
  assert.deepEqual(seen,['  Al'])
  assert.ok(row(tree,'Zero'));assert.ok(row(tree,'Off'));assert.ok(row(tree,'Unavailable'));assert.ok(row(tree,'Alpha'))
  assert.equal(rows(tree).find(n=>text(n)==='Unavailable').props.disabled,'')
  field(tree,'Filter Custom').props.oninput({currentTarget:{value:' '}})
  seen.length=0
  tree=render()
  assert.deepEqual(seen,[' '])
  assert.equal(rows(tree).some(n=>text(n)==='Alpha'),false)
  field(tree,'Filter Custom').props.oninput({currentTarget:{value:'  Al'}})
  field(tree,'Filter all facets').props.oninput({currentTarget:{value:'  Al'}})
  seen.length=0
  tree=render()
  assert.deepEqual(seen,['  Al'])
  assert.equal(nodes(tree).filter(n=>n.type==='a-menu-group').length,2)
  field(tree,'Filter all facets').props.oninput({currentTarget:{value:' '}})
  tree=render()
  assert.ok(field(tree,'Filter Custom'))
  assert.equal(nodes(tree).filter(n=>n.type==='a-menu-group').length,0)
})


test.fast('Select null resets remain controlled and preserve subsequent typed updates', () => {
  const reports = [], triggerValues = []
  const options = [
    {value:'alpha',label:'Alpha'}, {value:'beta',label:'Beta'},
    {value:'',label:'Empty string'}, {value:0,label:'Zero'}, {value:false,label:'Off'},
  ]
  const render = renderer(runtime.Select, {
    options, value:null, defaultValue:'alpha', clearable:true,
    onValueChange:(value,attrs)=>reports.push({value,attrs}),
    renderTrigger:state=>{triggerValues.push(state.value);return h('button',{},'Choose')},
  })
  let tree=render()
  assert.equal(triggerValues.at(-1),null)
  assert.deepEqual(reports,[])
  row(tree,'Beta').props.onmenuselect({})
  assert.equal(reports.at(-1).value,'beta')
  tree=render()
  assert.equal(triggerValues.at(-1),null)
  assert.equal(row(tree,'Clear'),undefined)
  tree=render({value:'beta'})
  assert.equal(triggerValues.at(-1),'beta')
  const count=reports.length
  tree=render({value:null})
  assert.equal(reports.length,count)
  assert.equal(triggerValues.at(-1),null)
  row(tree,'Alpha').props.onmenuselect({})
  tree=render()
  assert.equal(triggerValues.at(-1),null)
  for (const value of ['',0,false]) {
    tree=render({value})
    assert.equal(triggerValues.at(-1),value)
    assert.ok(row(tree,'Clear'))
    row(tree,'Clear').props.onmenuselect({})
    assert.equal(reports.at(-1).value,null)
    tree=render()
    assert.equal(triggerValues.at(-1),value)
    const count=reports.length
    tree=render({value:null})
    assert.equal(reports.length,count)
    assert.equal(triggerValues.at(-1),null)
  }
  assert.ok(runtime.optionsWithSelection(options,null).every(option=>option.selected===false))
})

test.fast('Select undefined stays uncontrolled and defaults initialize only once', () => {
  const values=[]
  const render=renderer(runtime.Select,{
    options:['alpha','beta'], value:undefined, defaultValue:'alpha',
    renderTrigger:state=>{values.push(state.value);return h('button',{},'Choose')},
  })
  row(render(),'beta').props.onmenuselect({})
  render({defaultValue:'alpha'})
  assert.equal(values.at(-1),'beta')
  const empty=renderer(runtime.Select,{options:[],renderTrigger:state=>{values.push(state.value);return h('button',{},'Choose')}})
  empty();assert.equal(values.at(-1),null)
  empty({selection:'multiple',value:[]});assert.deepEqual(values.at(-1),[])
})
