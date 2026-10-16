import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { componentSuites } from './component-suites.mjs'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { parse } = requireSite('yaml')
const workflow = parse(await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'))
const runner = workflow.jobs.build.steps.find(step => step.name === 'Test selected components')

for (const tier of ['fast', 'slow']) test(`CI batches selected ${tier} component suites once`, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anta-component-ci-'))
  try {
    const commandLog = join(directory, 'commands')
    await writeFile(commandLog, '')
    await writeFile(join(directory, 'pnpm'), '#!/bin/sh\nprintf "%s|%s\\n" "$*" "$ANTA_COMPONENT_TEST_TIER" >> "$COMMAND_LOG"\n', {mode: 0o755})
    const env = {...process.env, PATH: `${directory}:${process.env.PATH}`, COMMAND_LOG: commandLog, ANTA_COMPONENT_TEST_TIER: tier}
    const check = async (selection, expected) => {
      await writeFile(commandLog, '')
      execFileSync('bash', ['-e', '-c', runner.run], {cwd: new URL('..', import.meta.url), env: {...env, COMPONENT_TEST_SELECTION: JSON.stringify(selection)}})
      assert.equal(await readFile(commandLog, 'utf8'), expected)
    }
    await check({copy: 'true', input: 'true', banner: 'false', unknown: 'true'}, `test:components --component copy,input|${tier}\n`)
    await check(Object.fromEntries(Object.keys(componentSuites).map(name => [name, 'true'])), `test:components --component ${Object.keys(componentSuites).join(',')}|${tier}\n`)
    await check({dialog: 'true', copy: 'true'}, `test:components --component dialog,copy|${tier}\n`)
    await check({copy: 'false'}, '')
    await check({}, '')
  } finally { await rm(directory, {recursive: true}) }
})

test('PR component checks select fast; only manual CI selects slow', () => {
  assert.equal(workflow.jobs.build.env.ANTA_COMPONENT_TEST_TIER, "${{ github.event_name == 'workflow_dispatch' && 'slow' || 'fast' }}")
  assert.equal(runner.env.COMPONENT_TEST_SELECTION, '${{ toJSON(steps.component-tests.outputs) }}')
})

test('Dialog CI gate includes its dependencies and skips unrelated documentation and Menu', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anta-dialog-gate-'))
  const git = args => execFileSync('git', args, {cwd:directory, encoding:'utf8'})
  try {
    git(['init','-b','fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.test'])
    git(['commit','--allow-empty','-m','Baseline'])
    const selection = workflow.jobs.build.steps.find(step=>step.id==='component-tests').run
    for (const [path,wanted] of [
      ['src/elements/a-dialog.ts',true],['src/components/Dialog.tsx',true],
      ['src/native-event-props.ts',true],['tests/dialog-csp.mjs',true],
      ['.github/workflows/ci.yml',true],['src/elements/a-menu.ts',false],['docs/components/dialog.md',false],
    ]) {
      const base = git(['rev-parse','HEAD']).trim()
      await mkdir(join(directory,path,'..'),{recursive:true})
      await writeFile(join(directory,path),'fixture')
      git(['add',path]);git(['commit','-m',path])
      const output=join(directory,'outputs');await writeFile(output,'')
      execFileSync('bash',['-e','-c',selection],{cwd:directory,env:{...process.env,TEST_BASE_SHA:base,GITHUB_OUTPUT:output}})
      assert.match(await readFile(output,'utf8'),new RegExp(`^dialog=${wanted}$`,'m'),path)
    }
  } finally {await rm(directory,{recursive:true})}
})
