import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { buildSearchIndex } from '../site/scripts/build-search-index.mjs'
import { buildSearchWorker } from '../site/scripts/build-search-worker.mjs'
import { copySitemapIndex } from '../site/scripts/copy-sitemap-index.mjs'

const run = promisify(execFile)

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'anta site output '))
  t.after(() => rm(root, { recursive: true, force: true }))
  const outDir = join(root, 'custom output')
  const publicDir = join(root, 'custom public')
  await Promise.all([mkdir(outDir), mkdir(publicDir)])
  return { root, outDir, publicDir }
}

test('postprocessor imports do not require or write build outputs', async (t) => {
  const { root } = await fixture(t)
  const scripts = ['build-search-index', 'build-search-worker', 'copy-sitemap-index']
  const imports = scripts.map(name => `await import(${JSON.stringify(new URL(`../site/scripts/${name}.mjs`, import.meta.url).href)});`).join('\n')
  const { stdout, stderr } = await run(process.execPath, ['--input-type=module', '-e', imports], { cwd: root })
  assert.equal(stdout, '')
  assert.equal(stderr, '')
  assert.deepEqual((await readdir(root)).sort(), ['custom output', 'custom public'])
})

test('search indexing honors configured URL directories and keeps repeat output stable', async (t) => {
  const { root, outDir, publicDir } = await fixture(t)
  const page = '<!doctype html><html><body><main class="content"><h1>Fixture</h1><p>Searchable prose.</p></main></body></html>'
  await mkdir(join(outDir, 'nested'))
  await writeFile(join(outDir, 'index.html'), page)
  await writeFile(join(outDir, 'nested/index.html'), page)
  await writeFile(join(outDir, '404.html'), page)
  await mkdir(join(root, 'dist'))
  await writeFile(join(root, 'dist/index.html'), 'Unrelated output')

  const options = { outDir: pathToFileURL(outDir), publicDir: pathToFileURL(publicDir) }
  const result = await buildSearchIndex(options)
  assert.equal(result.documents, 4)
  assert.equal(result.pages, 3)
  const index = await readFile(join(outDir, 'search-index.json'), 'utf8')
  const rendered = await readFile(join(outDir, 'nested/index.html'), 'utf8')
  assert.equal(await readFile(join(publicDir, 'search-index.json'), 'utf8'), index)
  assert.equal(await readFile(join(root, 'dist/index.html'), 'utf8'), 'Unrelated output')
  assert.equal(await readFile(join(outDir, '404.html'), 'utf8'), page)
  assert.match(rendered, /data-search-id=/)
  assert.match(index, /\/nested\//)

  await buildSearchIndex(options)
  assert.equal(await readFile(join(outDir, 'search-index.json'), 'utf8'), index)
  assert.equal(await readFile(join(outDir, 'nested/index.html'), 'utf8'), rendered)
})

test('search CLI retains cwd-relative dist and public defaults', async (t) => {
  const { root } = await fixture(t)
  await Promise.all([mkdir(join(root, 'dist')), mkdir(join(root, 'public'))])
  await writeFile(join(root, 'dist/index.html'), '<main class="content"><h1>CLI</h1></main>')
  await run(process.execPath, [fileURLToPath(new URL('../site/scripts/build-search-index.mjs', import.meta.url))], { cwd: root })
  const index = await readFile(join(root, 'dist/search-index.json'), 'utf8')
  assert.equal(JSON.parse(index).documents, 1)
  assert.equal(await readFile(join(root, 'public/search-index.json'), 'utf8'), index)
})

test('worker build resolves its source from the configured root and writes the configured directory', async (t) => {
  const { root, outDir } = await fixture(t)
  await mkdir(join(root, 'lib/search'), { recursive: true })
  await writeFile(join(root, 'lib/search/worker.ts'), 'export default { fetch() { return new Response("fixture") } }')
  await buildSearchWorker({ root: pathToFileURL(root), outDir: pathToFileURL(outDir) })
  assert.match(await readFile(join(outDir, '_worker.js'), 'utf8'), /new Response\("fixture"\)/)
  await assert.rejects(readFile(join(root, 'dist/_worker.js')), { code: 'ENOENT' })
})

test('a single sitemap chunk replaces the index at the configured output path', async (t) => {
  const { outDir } = await fixture(t)
  await writeFile(join(outDir, 'sitemap-0.xml'), '<urlset>single</urlset>')
  await writeFile(join(outDir, 'sitemap-index.xml'), '<sitemapindex/>')
  await writeFile(join(outDir, 'sitemap.xml'), 'stale')
  await copySitemapIndex({ outDir: pathToFileURL(outDir) })
  assert.equal(await readFile(join(outDir, 'sitemap.xml'), 'utf8'), '<urlset>single</urlset>')
  assert.deepEqual(await readdir(outDir), ['sitemap.xml'])
})

test('multiple sitemap chunks retain the sitemap index and all chunks', async (t) => {
  const { outDir } = await fixture(t)
  await writeFile(join(outDir, 'sitemap-0.xml'), '<urlset>first</urlset>')
  await writeFile(join(outDir, 'sitemap-1.xml'), '<urlset>second</urlset>')
  await writeFile(join(outDir, 'sitemap-index.xml'), '<sitemapindex>both</sitemapindex>')
  await copySitemapIndex({ outDir })
  assert.equal(await readFile(join(outDir, 'sitemap.xml'), 'utf8'), '<sitemapindex>both</sitemapindex>')
  assert.deepEqual((await readdir(outDir)).sort(), ['sitemap-0.xml', 'sitemap-1.xml', 'sitemap-index.xml', 'sitemap.xml'])
})

test('missing search input and sitemap outputs reject instead of hiding build failures', async (t) => {
  const { outDir, publicDir } = await fixture(t)
  await assert.rejects(buildSearchIndex({ outDir: join(outDir, 'missing'), publicDir }), { code: 'ENOENT' })
  await assert.rejects(copySitemapIndex({ outDir }), { code: 'ENOENT' })
})
