import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { cachedBuild } from '../site/lib/build-cache.mjs'

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'anta-build-cache-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'src'))
  await writeFile(join(root, 'src/input'), 'first')
  await writeFile(join(root, 'lockfile'), 'dependencies-v1')
  let builds = 0
  const options = {
    root, cacheDir: join(root, 'cache'), name: 'fixture',
    inputs: ['src', 'lockfile'], outputs: ['out/manifest', 'out/assets'],
    build: async () => {
      builds++
      await mkdir(join(root, 'out/assets'), { recursive: true })
      await writeFile(join(root, 'out/manifest'), 'asset.js')
      await writeFile(join(root, 'out/assets/asset.js'), await readFile(join(root, 'src/input')))
    },
  }
  return { root, options, run: (overrides = {}) => cachedBuild({ ...options, ...overrides }), builds: () => builds }
}

test('reuses verified outputs and rebuilds after source or dependency changes', async (t) => {
  const f = await fixture(t)
  assert.equal(await f.run(), true)
  assert.equal(await f.run(), false)
  await writeFile(join(f.root, 'src/input'), 'other')
  await utimes(join(f.root, 'src/input'), 0, 0)
  assert.equal(await f.run(), true)
  assert.equal(await readFile(join(f.root, 'out/assets/asset.js'), 'utf8'), 'other')
  await writeFile(join(f.root, 'lockfile'), 'dependencies-v2')
  assert.equal(await f.run(), true)
  assert.equal(f.builds(), 3)
})

test('adding and removing source files invalidates a cached directory', async (t) => {
  const f = await fixture(t)
  await f.run()
  await writeFile(join(f.root, 'src/extra'), 'new import')
  assert.equal(await f.run(), true)
  await rm(join(f.root, 'src/extra'))
  assert.equal(await f.run(), true)
})

test('missing manifests and missing or modified assets force rebuilding', async (t) => {
  const f = await fixture(t)
  await f.run()
  for (const path of ['out/manifest', 'out/assets/asset.js']) {
    await rm(join(f.root, path))
    assert.equal(await f.run(), true)
  }
  await writeFile(join(f.root, 'out/assets/asset.js'), 'partial output')
  assert.equal(await f.run(), true)
})

test('a failed rebuild invalidates its previous stamp even when inputs revert', async (t) => {
  const f = await fixture(t)
  await f.run()
  await writeFile(join(f.root, 'src/input'), 'changed')
  await assert.rejects(f.run({ build: async () => { throw new Error('build failed') } }), /build failed/)
  await writeFile(join(f.root, 'src/input'), 'first')
  assert.equal(await f.run(), true)
})

test('force bypasses valid cache entries and malformed metadata rebuilds', async (t) => {
  const f = await fixture(t)
  await f.run()
  assert.equal(await f.run({ force: true }), true)
  await writeFile(join(f.root, 'cache/fixture.json'), '{')
  assert.equal(await f.run(), true)
})

test('a build does not cache outputs if its inputs changed while running', async (t) => {
  const f = await fixture(t)
  await f.run({ build: async () => {
    await f.options.build()
    await writeFile(join(f.root, 'src/input'), 'edited during build')
  } })
  assert.equal(await f.run(), true)
  assert.equal(await readFile(join(f.root, 'out/assets/asset.js'), 'utf8'), 'edited during build')
})

test('missing required inputs fail rather than reusing stale outputs', async (t) => {
  const f = await fixture(t)
  await f.run()
  await rm(join(f.root, 'lockfile'))
  await assert.rejects(f.run(), { code: 'ENOENT' })
})
