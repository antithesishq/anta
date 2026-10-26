import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { componentSuites } from './component-suites.mjs'

let tier = process.env.ANTA_COMPONENT_TEST_TIER ?? 'fast'
let component = 'all'
let list = false
const args = process.argv.slice(2)
while (args.length) {
  const flag = args.shift()
  if (flag === '--tier') tier = args.shift()
  else if (flag === '--component') component = args.shift()
  else if (flag === '--list') list = true
  else throw new Error(`Unknown option: ${flag}`)
}
if (!['fast', 'slow'].includes(tier)) throw new Error('Use --tier fast or --tier slow')
const names = component === 'all' ? Object.keys(componentSuites) : component?.split(',')
if (!names?.length || names.some(name => !Object.hasOwn(componentSuites, name))) {
  throw new Error(`Use --component all or one of: ${Object.keys(componentSuites).join(', ')}`)
}
const suites = [...new Set(names)].map(name => componentSuites[name])
const files = suites.flatMap(suite => suite.tests)
const extra = tier === 'slow' ? suites.flatMap(suite => suite.slow ?? []) : []
console.log(`Component tests (${tier}): ${[...new Set(names)].join(', ')}`)
if (list) {
  console.log([...files, ...extra].join('\n'))
} else {
  const cwd = fileURLToPath(new URL('..', import.meta.url))
  const env = {...process.env, ANTA_COMPONENT_TEST_TIER: tier}
  async function run(args) {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, {cwd, env, stdio: 'inherit'})
      child.once('error', reject)
      child.once('close', code => code === 0 ? resolve() : reject(new Error(`Component tests exited ${code}`)))
    })
  }
  await run(['--test', '--test-concurrency=2', ...files])
  for (const file of extra) await run([file])
}
