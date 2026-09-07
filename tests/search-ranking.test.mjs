import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { Document } = requireSite('flexsearch')
const config = requireSite('./lib/search/config.json')
let searchDocumentation, directory
after(async () => { if (directory) await rm(directory, { recursive: true, force: true }) })

before(async () => {
  const index = new Document(config)
  const add = (id, route, kind, text = 'Shared typography') => index.add({
    id, route, kind, text, level: /^h/.test(kind) ? Number(kind[1]) : 0,
    searchRank: /^h/.test(kind) ? kind : 'block',
    routeRank: `${route}:${/^h/.test(kind) ? kind : 'block'}`,
    title: route, heading: text, anchor: id,
  })
  // Enough remote headings to exclude the local paragraph from a global top 16.
  for (let i = 0; i < 24; i++) add(`remote-${i}`, '/other/', 'h1')
  add('local-body', '/theming/', 'p')
  add('local-heading', '/theming/', 'h2')
  add('unrelated', '/theming/', 'h1', 'Something unrelated')
  add('home', '/', 'p')
  const chunks = {}
  await index.export((key, value) => { chunks[key] = value })
  const result = await build({
    entryPoints: ['site/lib/search/client.ts'], bundle: true, write: false,
    format: 'esm', platform: 'node', target: 'es2022',
  })
  // A module-local fetch keeps this fixture separate from other test suites.
  const source = `const fetch = async () => ({ok:true,json:async()=>(${JSON.stringify({ version: config.version, chunks })})});\n${result.outputFiles[0].text}`
  directory = await mkdtemp(join(tmpdir(), 'anta-search-ranking-'))
  const modulePath = join(directory, 'client.mjs')
  await writeFile(modulePath, source)
  ;({ searchDocumentation } = await import(pathToFileURL(modulePath).href))
})

test('current-page matches precede global headings and survive the result limit', async () => {
  const results = await searchDocumentation('typography', '/theming')
  assert.deepEqual(results.slice(0, 2).map(result => result.id), ['local-heading', 'local-body'])
  assert.equal(results.length, 16)
  assert.equal(new Set(results.map(result => result.id)).size, results.length)
  assert.ok(results.slice(2).every(result => result.route === '/other/'))
  assert.ok(results.every(result => result.id !== 'unrelated'))
})

test('the same query re-ranks when the current route changes', async () => {
  const results = await searchDocumentation('typography', '/')
  assert.equal(results[0].id, 'home')
  const next = await searchDocumentation('typography', '/other/')
  assert.ok(next.every(result => result.route === '/other/'))
})

test('absent local matches preserve global heading priority', async () => {
  for (const route of [undefined, '/missing/']) {
    const results = await searchDocumentation('typography', route)
    assert.equal(results.length, 16)
    assert.ok(results.every(result => result.kind === 'h1'))
  }
  assert.deepEqual(await searchDocumentation('nonexistent', '/theming/'), [])
})
