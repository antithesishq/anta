import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import siteBuild from '../site/integrations/site-build.mjs'

const preparation = `
import { appendFile, writeFile } from 'node:fs/promises'
await new Promise(resolve => setTimeout(resolve, 25))
await appendFile('preparation.jsonl', JSON.stringify({
  cwd: process.cwd(),
  args: process.argv.slice(2),
  nodeEnv: process.env.NODE_ENV ?? null,
  cache: process.env.ANTA_BUILD_CACHE ?? null,
}) + '\\n')
await writeFile('generated.json', '{"ready":true}')
`

async function fixture(t, script = preparation) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'anta integration ')))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'scripts'))
  await writeFile(join(root, 'scripts/prepare.mjs'), script)
  return {
    root,
    config: { root: pathToFileURL(`${root}/`) },
    async runs() {
      return (await readFile(join(root, 'preparation.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    },
  }
}

for (const command of ['build', 'dev', 'sync']) {
  test(`${command} prepares once after config resolution and awaits generated files`, async (t) => {
    const f = await fixture(t)
    const { hooks } = siteBuild()
    await hooks['astro:config:setup']({ command, config: f.config })
    await assert.rejects(readFile(join(f.root, 'generated.json')), { code: 'ENOENT' })

    await hooks['astro:config:done']({ config: f.config })
    assert.deepEqual(JSON.parse(await readFile(join(f.root, 'generated.json'), 'utf8')), { ready: true })
    const runs = await f.runs()
    assert.equal(runs.length, 1)
    assert.deepEqual(runs[0].args, ['docs'])
    assert.equal(runs[0].cwd, f.root)
  })
}

test('preview skips preparation and only needs its built output', async (t) => {
  const f = await fixture(t, 'throw new Error("Preview must not prepare")')
  const { hooks } = siteBuild()
  await hooks['astro:config:setup']({ command: 'preview', config: f.config })
  await hooks['astro:config:done']({ config: f.config })
  await assert.rejects(readFile(join(f.root, 'generated.json')), { code: 'ENOENT' })
})

test('preparation uses the resolved root and child environment without changing the parent', async (t) => {
  const f = await fixture(t)
  const previous = { NODE_ENV: process.env.NODE_ENV, ANTA_BUILD_CACHE: process.env.ANTA_BUILD_CACHE }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  process.env.NODE_ENV = 'production'
  process.env.ANTA_BUILD_CACHE = '0'
  const { hooks } = siteBuild()
  await hooks['astro:config:setup']({
    command: 'build',
    config: { root: new URL('unresolved/', f.config.root) },
  })
  await hooks['astro:config:done']({ config: f.config })

  const [run] = await f.runs()
  assert.equal(run.cwd, f.root)
  assert.equal(run.nodeEnv, null)
  assert.equal(run.cache, '0')
  assert.equal(process.env.NODE_ENV, 'production')
  assert.equal(process.env.ANTA_BUILD_CACHE, '0')
})

test('a failed preparation rejects the Astro lifecycle hook', async (t) => {
  const f = await fixture(t, 'process.exit(17)')
  const { hooks } = siteBuild()
  await hooks['astro:config:setup']({ command: 'build', config: f.config })
  await assert.rejects(hooks['astro:config:done']({ config: f.config }), /Site preparation failed \(17\)/)
  await assert.rejects(readFile(join(f.root, 'generated.json')), { code: 'ENOENT' })
})

test('a dev config restart prepares again on the same integration instance', async (t) => {
  const f = await fixture(t)
  const { hooks } = siteBuild()
  await hooks['astro:config:setup']({ command: 'dev', config: f.config })
  await hooks['astro:config:done']({ config: f.config })
  await rm(join(f.root, 'generated.json'))

  await hooks['astro:config:setup']({ command: 'dev', config: f.config })
  await hooks['astro:config:done']({ config: f.config })
  assert.equal((await f.runs()).length, 2)
  assert.deepEqual(JSON.parse(await readFile(join(f.root, 'generated.json'), 'utf8')), { ready: true })
})
