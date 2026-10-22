import assert from 'node:assert/strict'
import { before } from 'node:test'
import { Module } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { componentTest as test } from './component-tier.mjs'
let runtime
before(async()=>{
  const result=await build({stdin:{contents:"export {Calendar,RadioGroup,Tabs,configure} from './src/index'",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',alias:{'@antadesign/anta/jsx-runtime':resolve('src/jsx-runtime')}})
  const compiled=new Module(resolve('tests/selection-projection.cjs'));compiled._compile(result.outputFiles[0].text,compiled.id);runtime=compiled.exports
})
const find=(node,type)=>node?.type===type?node:(node?.children??[]).flat(Infinity).map(child=>find(child,type)).find(Boolean)
for(const shim of [false,true])test.fast(`Selection value projection works without DOM access (window: ${shim})`,()=>{
  if(shim)globalThis.window={}
  try {
    runtime.configure((type,props,...children)=>({type,props,children}),'fragment',{useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useMemo:fn=>fn(),useId:()=>':selection:'})
    for(const [name,tag] of [['Calendar','a-calendar'],['RadioGroup','a-radio-group'],['Tabs','a-tabs']]) {
      const requests=[]
      const controlled=find(runtime[name]({value:'',options:[],locale:'en-US',onStateChange:(e,d)=>requests.push(d)}),tag)
      const input='state',initial='default-state'
      assert.equal(controlled.props[input],'')
      assert.equal(controlled.props[initial],undefined)
      assert.equal('VALUE' in controlled.props,false)
      assert.equal('defaultvalue' in controlled.props,false)
      assert.equal('value' in controlled.props,false)
      const detail={next:'b',prev:'',reason:'user'}
      controlled.props.onstatechange({nativeEvent:{detail}})
      assert.deepEqual(requests,[detail])
      const uncontrolled=find(runtime[name]({defaultValue:'2026-10-08',options:[],locale:'en-US'}),tag)
      assert.equal(uncontrolled.props[input],undefined)
      assert.equal(uncontrolled.props[initial],'2026-10-08')
    }
  } finally {if(shim)delete globalThis.window}
})
