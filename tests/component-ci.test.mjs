import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { componentSuites } from './component-suites.mjs'
import { componentShards } from './component-shards.mjs'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { parse } = requireSite('yaml')
const workflow = parse(await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'))
const runner = workflow.jobs.components.steps.find(step => step.name === 'Test selected components')

for (const tier of ['fast', 'slow']) test(`CI batches selected ${tier} component suites once per shard`, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anta-component-ci-'))
  try {
    const commandLog = join(directory, 'commands')
    await writeFile(commandLog, '')
    await writeFile(join(directory, 'pnpm'), '#!/bin/sh\nprintf "%s|%s\\n" "$*" "$ANTA_COMPONENT_TEST_TIER" >> "$COMMAND_LOG"\n', {mode: 0o755})
    const env = {...process.env, PATH: `${directory}:${process.env.PATH}`, COMMAND_LOG: commandLog, ANTA_COMPONENT_TEST_TIER: tier}
    for (const selection of [{copy: 'true', input: 'true', banner: 'false', unknown: 'true'},
      Object.fromEntries(Object.keys(componentSuites).map(name => [name, 'true'])), {copy: 'false'}, {}]) {
      await writeFile(commandLog, '')
      const {include} = componentShards(selection)
      for (const shard of include) execFileSync('bash', ['-e', '-c', runner.run], {
        cwd: new URL('..', import.meta.url), env: {...env, COMPONENTS: shard.components},
      })
      assert.equal(await readFile(commandLog, 'utf8'), include.map(shard => `test:components --component ${shard.components}|${tier}\n`).join(''))
    }
  } finally { await rm(directory, {recursive: true}) }
})

test('PR component checks select fast; only manual CI selects slow', () => {
  assert.equal(workflow.jobs.components.env.ANTA_COMPONENT_TEST_TIER, "${{ github.event_name == 'workflow_dispatch' && 'slow' || 'fast' }}")
  assert.equal(runner.env.COMPONENTS, '${{ matrix.components }}')
  assert.equal(workflow.jobs.components.name, 'Component tests: ${{ matrix.name }}')
})

test('component shards cover each selected suite once without empty jobs', async () => {
  const names = Object.keys(componentSuites)
  const {include} = componentShards(Object.fromEntries(names.map(name => [name, 'true'])))
  assert.equal(include.length, 4)
  const groups = include.map(shard => shard.components.split(','))
  assert.deepEqual(groups.flat().sort(), [...names].sort())
  assert.ok(Math.max(...groups.map(group => group.length)) - Math.min(...groups.map(group => group.length)) <= 1)
  assert.deepEqual(componentShards({unknown: 'true', input: 'false'}), {include: []})
  assert.deepEqual(componentShards({input: 'true'}), {include: [{name: 'Input', components: 'input'}]})

  const directory = await mkdtemp(join(tmpdir(), 'anta-component-matrix-'))
  try {
    for (const selection of [{input: 'true', text: 'true'}, {}]) {
      const output = join(directory, 'outputs')
      await writeFile(output, '')
      execFileSync(process.execPath, ['tests/component-shards.mjs'], {
        env: {...process.env, COMPONENT_TEST_SELECTION: JSON.stringify(selection), GITHUB_OUTPUT: output},
      })
      const values = Object.fromEntries((await readFile(output, 'utf8')).trim().split('\n').map(line => {
        const index = line.indexOf('=')
        return [line.slice(0, index), line.slice(index + 1)]
      }))
      assert.deepEqual(JSON.parse(values.matrix), componentShards(selection))
      assert.equal(values['has-components'], String(Object.keys(selection).length > 0))
    }
  } finally { await rm(directory, {recursive: true}) }
})

test('CI runs independent workloads in parallel and aggregates every required result', () => {
  for (const name of ['root-tests', 'packages', 'site']) assert.equal(workflow.jobs[name].needs, undefined)
  assert.equal(workflow.jobs.components.needs, 'select-components')
  assert.equal(workflow.jobs.components.if, "needs.select-components.outputs.has-components == 'true'")
  assert.equal(workflow.jobs.components.strategy['fail-fast'], false)
  assert.equal(workflow.jobs.components.strategy.matrix, '${{ fromJSON(needs.select-components.outputs.matrix) }}')
  assert.equal(workflow.jobs.build.if, '${{ always() }}')
  const required = ['select-components', 'root-tests', 'components', 'packages', 'site']
  assert.deepEqual(workflow.jobs.build.needs, required)
  const gate = workflow.jobs.build.steps.find(step => step.name === 'Check required jobs').run
  const check = results => {
    try {
      execFileSync('bash', ['-e', '-c', gate], {env: {...process.env, JOB_RESULTS: JSON.stringify(results)}, stdio: 'pipe'})
      return true
    } catch { return false }
  }
  const results = Object.fromEntries(required.map(name => [name, {result: 'success'}]))
  results['select-components'].outputs = {'has-components': 'true'}
  assert.equal(check(results), true)
  for (const name of required) for (const result of ['failure', 'cancelled', 'skipped']) {
    assert.equal(check({...results, [name]: {...results[name], result}}), false, `${name}: ${result}`)
  }
  const none = {...results, 'select-components': {result: 'success', outputs: {'has-components': 'false'}}, components: {result: 'skipped'}}
  assert.equal(check(none), true)
  assert.equal(check({...none, 'select-components': {...none['select-components'], result: 'failure'}}), false)
})

test('a Select stylesheet-only change selects Select and Tooltip checks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anta-select-css-ci-'))
  const env = {...process.env, GIT_AUTHOR_NAME:'Test', GIT_AUTHOR_EMAIL:'test@example.com', GIT_COMMITTER_NAME:'Test', GIT_COMMITTER_EMAIL:'test@example.com'}
  const git = (...args) => execFileSync('git', ['-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null',...args], {cwd:directory,env,encoding:'utf8'})
  try {
    git('init','--quiet')
    git('commit','--quiet','--allow-empty','-m','Baseline')
    const base = git('rev-parse','HEAD').trim()
    await mkdir(join(directory,'src/components'), {recursive:true})
    await writeFile(join(directory,'src/components/Select.css'),'a-select-chevron { color: red; }')
    git('add','src/components/Select.css')
    git('commit','--quiet','-m','Change only Select CSS')
    const output = join(directory,'selection')
    const selector = workflow.jobs['select-components'].steps.find(step => step.name === 'Select component tests')
    execFileSync('bash',['-e','-c',selector.run],{cwd:directory,env:{...env,TEST_BASE_SHA:base,GITHUB_OUTPUT:output}})
    const selected = Object.fromEntries((await readFile(output,'utf8')).trim().split('\n').map(line => line.split('=')))
    assert.equal(selected.select,'true')
    assert.equal(selected.tooltip,'true')
    assert.equal(selected.copy,'false')
  } finally {await rm(directory,{recursive:true})}
})

test('Tag CI gate selects its component and tests while skipping page-only edits', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anta-tag-ci-'))
  const git = (...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], {cwd: directory, encoding: 'utf8', env: {...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.test', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.test'}})
  try {
    git('init', '--quiet')
    git('commit', '--quiet', '--allow-empty', '-m', 'Baseline')
    const selector = workflow.jobs['select-components'].steps.find(step => step.id === 'component-tests')
    for (const [path, selected] of [['src/elements/a-tag.css', true], ['src/components/Tag.tsx', true], ['tests/tag-csp.mjs', true], ['site/src/content/components/tag/index.mdx', false]]) {
      const base = git('rev-parse', 'HEAD').trim(), output = join(directory, 'outputs')
      await mkdir(join(directory, path, '..'), {recursive: true})
      await writeFile(join(directory, path), 'Fixture')
      git('add', path)
      git('commit', '--quiet', '-m', path)
      await writeFile(output, '')
      execFileSync('bash', ['-e', '-c', selector.run], {cwd: directory, env: {...process.env, TEST_BASE_SHA: base, GITHUB_OUTPUT: output}})
      assert.match(await readFile(output, 'utf8'), new RegExp(`^tag=${selected}$`, 'm'), path)
    }
    const manual = parse(await readFile(new URL('../.github/workflows/component-tests.yml', import.meta.url), 'utf8'))
    assert.ok(manual.on.workflow_dispatch.inputs.component.options.includes('tag'))
  } finally {await rm(directory, {recursive: true})}
})

test('manual Menu coverage retains baseline history and captures the visual matrix', async () => {
  const manual = parse(await readFile(new URL('../.github/workflows/component-tests.yml', import.meta.url), 'utf8'))
  const steps = manual.jobs.components.steps
  assert.equal(steps.find(step => step.uses?.startsWith('actions/checkout@')).with['fetch-depth'], 0)
  assert.equal(steps.find(step => step.name === 'Run full component coverage').env.ANTA_MENU_COMPARE_ORIGINAL, '1')
  assert.ok(manual.on.workflow_dispatch.inputs.component.options.includes('menu'))
  assert.ok(manual.on.workflow_dispatch.inputs.component.options.includes('select'))
  assert.equal(steps.find(step => step.name === 'Run full component coverage').env.ANTA_SELECT_COMPARE_ORIGINAL, undefined)
  assert.equal(manual.on.workflow_dispatch.inputs.select_compare_ref.default,'')
  assert.equal(steps.find(step => step.name === 'Run full component coverage').env.ANTA_SELECT_COMPARE_REF, '${{ inputs.select_compare_ref }}')
})

test('Dialog CI gate includes its dependencies and skips unrelated documentation and Menu', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anta-dialog-gate-'))
  const git = args => execFileSync('git', args, {cwd:directory, encoding:'utf8'})
  try {
    git(['init','-b','fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.test'])
    git(['commit','--allow-empty','-m','Baseline'])
    const selection = workflow.jobs['select-components'].steps.find(step=>step.id==='component-tests').run
    for (const [path,wanted] of [
      ['src/elements/a-dialog.ts',true],['src/components/Dialog.tsx',true],
      ['src/native-event-props.ts',true],['tests/dialog-csp.mjs',true],
      ['src/input-events.ts',true],['src/elements/input-trailing-actions.ts',true],['src/elements/a-loader.css',true],
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

test('Autocomplete CI gate selects its source and test dependencies without unrelated component edits', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anta-autocomplete-gate-'))
  const git = args => execFileSync('git',args,{cwd:directory,encoding:'utf8'})
  try {
    git(['init','-b','fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.test'])
    git(['commit','--allow-empty','-m','Baseline'])
    const selection = workflow.jobs['select-components'].steps.find(step=>step.id==='component-tests').run
    for (const [path,wanted] of [
      ['src/components/InputAutocomplete.tsx',true],['src/components/select-options.tsx',true],
      ['src/components/Input.tsx',true],['src/elements/a-menu.ts',true],
      ['src/anta_helpers.ts',true],['src/button-content.ts',true],['src/elements/input-trailing-actions.ts',true],
      ['tests/input-autocomplete-csp.mjs',true],['tests/input-autocomplete-types.fixture.tsx',true],
      ['src/components/Calendar.tsx',false],['docs/components/input-autocomplete.md',false],
    ]) {
      const base = git(['rev-parse','HEAD']).trim()
      await mkdir(join(directory,path,'..'),{recursive:true})
      await writeFile(join(directory,path),'fixture')
      git(['add',path]);git(['commit','-m',path])
      const output = join(directory,'outputs');await writeFile(output,'')
      execFileSync('bash',['-e','-c',selection],{cwd:directory,env:{...process.env,TEST_BASE_SHA:base,GITHUB_OUTPUT:output}})
      assert.match(await readFile(output,'utf8'),new RegExp(`^input-autocomplete=${wanted}$`,'m'),path)
    }
    const manual = parse(await readFile(new URL('../.github/workflows/component-tests.yml', import.meta.url),'utf8'))
    assert.ok(manual.on.workflow_dispatch.inputs.component.options.includes('input-autocomplete'))
  } finally {await rm(directory,{recursive:true})}
})

test('Panel CI gate selects its source and test dependencies without unrelated component edits', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anta-panel-gate-'))
  const git = args => execFileSync('git',args,{cwd:directory,encoding:'utf8'})
  try {
    git(['init','-b','fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.test'])
    git(['commit','--allow-empty','-m','Baseline'])
    const selection = workflow.jobs['select-components'].steps.find(step=>step.id==='component-tests').run
    for (const [path,wanted] of [
      ['src/components/Panel.tsx',true],['src/elements/a-panel.css',true],
      ['src/elements/a-panel.ts',true],['src/elements/panel-focus.ts',true],
      ['src/anta_helpers.ts',true],['src/button-content.ts',true],['src/native-event-props.ts',true],
      ['tests/panel-csp.mjs',true],['tests/panel-package.mjs',true],
      ['src/elements/a-button.ts',true],['src/elements/a-icon.css',true],
      ['src/elements/a-icon.shapes.css',true],['src/elements/a-input.ts',true],
      ['src/elements/a-menu.css',true],['src/elements/a-menu-item.ts',true],
      ['src/elements/a-dialog.ts',true],['src/elements/a-box.ts',true],
      ['src/elements/a-capture.ts',true],['src/elements/capture-input.ts',true],
      ['src/elements/shadow-aria.ts',true],['src/elements/input-focus-modality.ts',true],
      ['src/elements/input-trailing-actions.ts',true],['src/elements/copy-behavior.ts',true],
      ['src/input-events.ts',true],['tests/panel.fixture.tsx',true],
      ['src/components/Calendar.tsx',false],['docs/components/panel.md',false],
    ]) {
      const base = git(['rev-parse','HEAD']).trim()
      await mkdir(join(directory,path,'..'),{recursive:true})
      await writeFile(join(directory,path),'fixture')
      git(['add',path]);git(['commit','-m',path])
      const output = join(directory,'outputs');await writeFile(output,'')
      execFileSync('bash',['-e','-c',selection],{cwd:directory,env:{...process.env,TEST_BASE_SHA:base,GITHUB_OUTPUT:output}})
      assert.match(await readFile(output,'utf8'),new RegExp(`^panel=${wanted}$`,'m'),path)
    }
    const manual = parse(await readFile(new URL('../.github/workflows/component-tests.yml', import.meta.url),'utf8'))
    assert.ok(manual.on.workflow_dispatch.inputs.component.options.includes('panel'))
  } finally {await rm(directory,{recursive:true})}
})

test('Slider CI gate selects its source and test dependencies without unrelated component edits', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anta-slider-gate-'))
  const git = args => execFileSync('git',args,{cwd:directory,encoding:'utf8'})
  try {
    git(['init','-b','fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.test'])
    git(['commit','--allow-empty','-m','Baseline'])
    const selection = workflow.jobs['select-components'].steps.find(step=>step.id==='component-tests').run
    for (const [path,wanted] of [
      ['src/components/Slider.tsx',true],['src/elements/a-slider.css',true],
      ['src/elements/a-slider.ts',true],['src/elements/shadow-aria.ts',true],
      ['src/anta_helpers.ts',true],['src/button-content.ts',true],['src/native-event-props.ts',true],
      ['tests/slider-csp.mjs',true],['tests/slider-projection.mjs',true],
      ['src/components/Calendar.tsx',false],['docs/components/slider.md',false],
    ]) {
      const base = git(['rev-parse','HEAD']).trim()
      await mkdir(join(directory,path,'..'),{recursive:true})
      await writeFile(join(directory,path),'fixture')
      git(['add',path]);git(['commit','-m',path])
      const output = join(directory,'outputs');await writeFile(output,'')
      execFileSync('bash',['-e','-c',selection],{cwd:directory,env:{...process.env,TEST_BASE_SHA:base,GITHUB_OUTPUT:output}})
      assert.match(await readFile(output,'utf8'),new RegExp(`^slider=${wanted}$`,'m'),path)
    }
    const manual = parse(await readFile(new URL('../.github/workflows/component-tests.yml', import.meta.url),'utf8'))
    assert.ok(manual.on.workflow_dispatch.inputs.component.options.includes('slider'))
    assert.equal(manual.on.workflow_dispatch.inputs.slider_compare_ref.default,'')
    assert.equal(manual.jobs.components.steps.find(step=>step.name==='Run full component coverage').env.ANTA_SLIDER_COMPARE_REF,'${{ inputs.slider_compare_ref }}')
  } finally {await rm(directory,{recursive:true})}
})

test('Selection CI gate covers Calendar, InputDate, RadioGroup, Tabs, and shared value inputs', async () => {
  const directory=await mkdtemp(join(tmpdir(),'anta-selection-gate-'))
  const git=args=>execFileSync('git',args,{cwd:directory,encoding:'utf8'})
  try {
    git(['init','-b','fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.test'])
    git(['commit','--allow-empty','-m','Baseline'])
    const selection=workflow.jobs['select-components'].steps.find(step=>step.id==='component-tests').run
    for(const [path,wanted] of [
      ['src/components/Calendar.tsx',true],['src/components/InputDate.tsx',true],
      ['src/components/RadioGroup.tsx',true],['src/components/Tabs.tsx',true],
      ['src/components/Steps.tsx',true],['src/elements/a-tabpanel.ts',true],
      ['src/elements/value-input.ts',true],
      ['tests/selection-value.mjs',true],['tests/selection-projection.mjs',true],
      ['src/components/Slider.tsx',false],['docs/components/tabs.md',false],
    ]) {
      const base=git(['rev-parse','HEAD']).trim()
      await mkdir(join(directory,path,'..'),{recursive:true});await writeFile(join(directory,path),'fixture')
      git(['add',path]);git(['commit','-m',path])
      const output=join(directory,'outputs');await writeFile(output,'')
      execFileSync('bash',['-e','-c',selection],{cwd:directory,env:{...process.env,TEST_BASE_SHA:base,GITHUB_OUTPUT:output}})
      assert.match(await readFile(output,'utf8'),new RegExp(`^selection=${wanted}$`,'m'),path)
    }
    const manual=parse(await readFile(new URL('../.github/workflows/component-tests.yml',import.meta.url),'utf8'))
    assert.ok(manual.on.workflow_dispatch.inputs.component.options.includes('selection'))
  } finally {await rm(directory,{recursive:true})}
})

test('Plot CI gate includes input, measurement, focus, and copy dependencies', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anta-plot-gate-'))
  const git = args => execFileSync('git', args, {cwd:directory, encoding:'utf8'})
  try {
    git(['init','-b','fixture']); git(['config','user.name','Fixture']); git(['config','user.email','fixture@example.test'])
    git(['commit','--allow-empty','-m','Baseline'])
    const selection = workflow.jobs['select-components'].steps.find(step => step.id === 'component-tests').run
    for (const [path, selected] of [
      ['src/elements/capture-input.ts',true], ['src/box-observation.ts',true],
      ['src/elements/focus.ts',true], ['src/elements/copy-behavior.ts',true],
      ['src/elements/key-activation.ts',true], ['src/components/Calendar.tsx',false],
    ]) {
      const base = git(['rev-parse','HEAD']).trim()
      await mkdir(join(directory,path,'..'),{recursive:true})
      await writeFile(join(directory,path),'fixture')
      git(['add',path]); git(['commit','-m',path])
      const output = join(directory,'outputs'); await writeFile(output,'')
      execFileSync('bash',['-e','-c',selection],{cwd:directory,env:{...process.env,TEST_BASE_SHA:base,GITHUB_OUTPUT:output}})
      assert.match(await readFile(output,'utf8'), new RegExp(`^plot=${selected}$`,'m'), path)
    }
  } finally { await rm(directory,{recursive:true}) }
})

test('Stickers CI gate includes shipped tokens and component workflow dependencies', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anta-stickers-gate-'))
  const git = args => execFileSync('git', args, {cwd:directory, encoding:'utf8', stdio:['ignore','pipe','pipe']})
  try {
    git(['init','-b','fixture']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.test'])
    git(['commit','--allow-empty','-m','Baseline'])
    const selection = workflow.jobs['select-components'].steps.find(step=>step.id==='component-tests').run
    for (const [path,wanted] of [
      ['src/tokens.css',true],['src/reset.css',true],['src/theme-antune.css',true],['src/theme-antithesis.css',true],
      ['.github/workflows/component-tests.yml',true],['stickers/src/elements/a-sticker-animated.ts',true],
      ['site/src/content/packages/plot/index.mdx',false],
    ]) {
      const base = git(['rev-parse','HEAD']).trim()
      await mkdir(join(directory,path,'..'),{recursive:true})
      await writeFile(join(directory,path),'fixture')
      git(['add',path]);git(['commit','-m',path])
      const output=join(directory,'outputs');await writeFile(output,'')
      execFileSync('bash',['-e','-c',selection],{cwd:directory,env:{...process.env,TEST_BASE_SHA:base,GITHUB_OUTPUT:output}})
      assert.match(await readFile(output,'utf8'),new RegExp(`^stickers=${wanted}$`,'m'),path)
    }
  } finally {await rm(directory,{recursive:true})}
})
