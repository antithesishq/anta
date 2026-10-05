import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))

function bundleImports(paths) {
  return build({
    stdin: {
      contents: paths.map(path => `import '${path}'`).join('\n'),
      resolveDir: root,
    },
    bundle: true,
    write: false,
    outfile: 'consumer.js',
    format: 'esm',
    minify: true,
    metafile: true,
  })
}

test('consumers can import every shipped element stylesheet through package exports', async () => {
  const files = (await readdir(new URL('../dist/elements/', import.meta.url)))
    .filter(file => file.endsWith('.css'))
  assert.ok(files.length > 0)

  const result = await bundleImports(files.map(file => `@antadesign/anta/elements/${file}`))
  const stylesheets = Object.keys(result.metafile.inputs).filter(path => path.endsWith('.css'))
  assert.equal(stylesheets.length, files.length)
  assert.ok(result.outputFiles.find(file => file.path.endsWith('.css')))
})

test('Title and Tag element entries include only their CSS and no registration code', async () => {
  const result = await bundleImports([
    '@antadesign/anta/elements/a-title',
    '@antadesign/anta/elements/a-tag',
  ])
  const stylesheets = Object.keys(result.metafile.inputs).filter(path => path.endsWith('.css'))
  assert.deepEqual(stylesheets.sort(), ['dist/elements/a-tag.css', 'dist/elements/a-title.css'])
  assert.equal(result.outputFiles.find(file => file.path.endsWith('.js')).text.trim(), '')

  const css = result.outputFiles.find(file => file.path.endsWith('.css')).text
  assert.match(css, /a-title/)
  assert.match(css, /a-tag/)
})
