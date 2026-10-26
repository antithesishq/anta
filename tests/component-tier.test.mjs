import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

for (const tier of ['fast', 'slow']) {
  test(`Component ${tier} tier registers the intended cases and browser engines`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'anta-component-tier-'))
    try {
      const fixture = join(directory, 'fixture.mjs')
      await writeFile(fixture, `
        import assert from 'node:assert/strict'
        import {componentTest as test, componentEngines} from ${JSON.stringify(new URL('./component-tier.mjs', import.meta.url).href)}
        const names = componentEngines(['chromium', 'firefox', 'webkit'].map(name => ({name: () => name}))).map(engine => engine.name())
        test.fast('core regression', () => assert.deepEqual(names, ${JSON.stringify(tier === 'fast' ? ['chromium'] : ['chromium', 'firefox', 'webkit'])}))
        test('extended matrix', () => assert.equal(${JSON.stringify(tier)}, 'slow'))
      `)
      const env = {...process.env, ANTA_COMPONENT_TEST_TIER: tier, ANTA_TEST_WEBKIT: ''}
      delete env.NODE_TEST_CONTEXT
      const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', fixture], {encoding: 'utf8', env})
      assert.equal(result.status, 0, result.stdout + result.stderr)
      assert.match(result.stdout, /^ok \d+ - core regression$/m)
      assert.match(result.stdout, new RegExp(`^# tests ${tier === 'fast' ? 1 : 2}$`, 'm'))
      if (tier === 'fast') assert.doesNotMatch(result.stdout, /extended matrix/)
      else assert.match(result.stdout, /^ok \d+ - extended matrix$/m)
    } finally { await rm(directory, {recursive: true}) }
  })
}

for (const component of ['panel', 'banner', 'toaster', 'dialog', 'menu', 'select', 'input-autocomplete', 'slider']) test(`Component runner keeps ${component} installation in the slow tier`, () => {
  const run = tier => spawnSync(process.execPath, ['tests/components.mjs', '--tier', tier, '--component', component, '--list'], {encoding: 'utf8'})
  const fast = run('fast'), slow = run('slow')
  assert.equal(fast.status, 0, fast.stderr)
  assert.equal(slow.status, 0, slow.stderr)
  assert.match(fast.stdout, new RegExp(`tests/${component}-csp\\.mjs`))
  assert.doesNotMatch(fast.stdout, new RegExp(`${component}-package`))
  assert.match(slow.stdout, new RegExp(`tests/${component}-package\\.mjs`))
})

test('Component runner rejects invalid selectors instead of passing with no tests', () => {
  for (const args of [['--tier', 'typo'], ['--component', 'missing'], ['--component']]) {
    const result = spawnSync(process.execPath, ['tests/components.mjs', ...args, '--list'], {encoding: 'utf8'})
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Use --(tier|component)/)
  }
})

test('Selection runner keeps installed-package coverage in the slow tier',()=>{
  const run=tier=>spawnSync(process.execPath,['tests/components.mjs','--tier',tier,'--component','selection','--list'],{encoding:'utf8'})
  const fast=run('fast'),slow=run('slow')
  assert.equal(fast.status,0,fast.stderr);assert.equal(slow.status,0,slow.stderr)
  assert.match(fast.stdout,/selection-value\.mjs/);assert.match(fast.stdout,/selection-projection\.mjs/)
  assert.doesNotMatch(fast.stdout,/selection-package/);assert.match(slow.stdout,/selection-package\.mjs/)
})
