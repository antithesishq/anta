import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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
    await check({copy: 'false'}, '')
    await check({}, '')
  } finally { await rm(directory, {recursive: true}) }
})

test('PR component checks select fast; only manual CI selects slow', () => {
  assert.equal(workflow.jobs.build.env.ANTA_COMPONENT_TEST_TIER, "${{ github.event_name == 'workflow_dispatch' && 'slow' || 'fast' }}")
  assert.equal(runner.env.COMPONENT_TEST_SELECTION, '${{ toJSON(steps.component-tests.outputs) }}')
})

test('manual Menu coverage retains baseline history and captures the visual matrix', async () => {
  const manual = parse(await readFile(new URL('../.github/workflows/component-tests.yml', import.meta.url), 'utf8'))
  const steps = manual.jobs.components.steps
  assert.equal(steps.find(step => step.uses?.startsWith('actions/checkout@')).with['fetch-depth'], 0)
  assert.equal(steps.find(step => step.name === 'Run full component coverage').env.ANTA_MENU_COMPARE_ORIGINAL, '1')
  assert.ok(manual.on.workflow_dispatch.inputs.component.options.includes('menu'))
  assert.ok(manual.on.workflow_dispatch.inputs.component.options.includes('select'))
  assert.equal(steps.find(step => step.name === 'Run full component coverage').env.ANTA_SELECT_COMPARE_ORIGINAL, '1')
})
