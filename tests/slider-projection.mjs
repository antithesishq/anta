import assert from 'node:assert/strict'
import { before } from 'node:test'
import { Module } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { componentTest as test } from './component-tier.mjs'
let runtime
before(async () => {
  const result = await build({stdin:{contents:"export {Slider} from './src/components/Slider';export {configure} from './src/jsx-runtime'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',alias:{'@antadesign/anta/jsx-runtime':resolve('src/jsx-runtime.ts')}})
  const compiled = new Module(resolve('tests/slider.fixture.cjs'))
  compiled._compile(result.outputFiles[0].text, compiled.id)
  runtime = compiled.exports
})
for (const shim of [false,true]) test.fast(`Slider projects ownership and serializable callbacks without a DOM (window: ${shim})`, () => {
  if (shim) globalThis.window = {}
  try {
    runtime.configure((type,props,...children)=>({type,props,children}))
    const log = [], value = [25,75]
    const tree = runtime.Slider({value,defaultValue:[0,100],min:20,max:80,step:5,name:'price',onInput:e=>{log.push('input');e.nativeEvent.detail.value[0]=999},onValueChange:(e,attrs)=>log.push(attrs),onChange:()=>log.push('change'),onValueCommit:(e,attrs)=>log.push(attrs)})
    assert.equal(tree.props.VALUE,'25 75')
    assert.equal(tree.props.defaultvalue,undefined)
    assert.equal('state' in tree.props,false)
    assert.equal('default-state' in tree.props,false)
    const detail={value:[30,75],min:20,max:80,step:5,name:'price'}
    tree.props.oninput({nativeEvent:{detail:structuredClone(detail)}})
    tree.props.onchange({nativeEvent:{detail:structuredClone(detail)}})
    assert.deepEqual(log,['input',detail,'change',detail])
    const scalar=runtime.Slider({value:0,defaultValue:[20,70]})
    assert.equal(scalar.props.VALUE,'0')
    assert.equal(scalar.props.role,'slider')
    assert.equal(scalar.props.tabIndex,0)
    assert.equal(runtime.Slider({defaultValue:25}).props.defaultvalue,'25')
    const nullish=runtime.Slider({value:null,defaultValue:[20,70]})
    assert.equal(nullish.props.VALUE,undefined)
    assert.equal(nullish.props.defaultvalue,'20 70')
    assert.equal(nullish.props.role,'group')
    assert.equal(nullish.props.tabIndex,-1)
    assert.equal(runtime.Slider({}).props.VALUE,undefined)
  } finally {if(shim) delete globalThis.window}
})
test.fast('Nested input events do not become Slider value requests',()=>{
  const log=[]
  runtime.configure((type,props)=>({type,props}))
  const props=runtime.Slider({onInput:()=>log.push('input'),onValueChange:()=>log.push('value')}).props
  props.oninput({target:{},currentTarget:{},detail:{value:12,min:0,max:100,step:1}})
  props.oninput({detail:undefined})
  assert.deepEqual(log,['input','input'])
})
