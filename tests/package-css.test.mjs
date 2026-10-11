import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))

function bundleImports(paths) {
  return bundleSource(paths.map(path => `import '${path}'`).join('\n'))
}

function bundleSource(contents) {
  return build({
    stdin: {
      contents,
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

test('the complete JSX API can be bundled for a worker without CSS or browser elements', async () => {
  const result = await bundleSource("export * from '@antadesign/anta'")
  const inputs = Object.keys(result.metafile.inputs)
  assert.deepEqual(inputs.filter(path => path.endsWith('.css')), [])
  assert.deepEqual(inputs.filter(path => /dist\/elements\/a-[^.]+\.js$/.test(path)), [])
  assert.ok(!result.outputFiles.some(file => file.path.endsWith('.css')))
})

const composedStyles = {
  'a-breadcrumbs': ['Breadcrumbs.css', /a-breadcrumbs/],
  'a-steps': ['Steps.css', /a-steps/],
  'a-input-date': ['InputDate.css', /a-input-date-time-container/],
  'a-select': ['select-parts.css', /a-select-chevron/],
  'a-select-faceted': ['select-parts.css', /a-select-faceted-summary/],
}

for (const [entry, [stylesheet, selector]] of Object.entries(composedStyles)) {
  test(`${entry} loads its layout CSS without registering or importing browser elements`, async () => {
    const result = await bundleImports([`@antadesign/anta/elements/${entry}`])
    const inputs = Object.keys(result.metafile.inputs)
    assert.deepEqual(inputs.filter(path => path.endsWith('.css')), [`dist/components/${stylesheet}`])
    assert.equal(result.outputFiles.find(file => file.path.endsWith('.js')).text.trim(), '')
    assert.match(result.outputFiles.find(file => file.path.endsWith('.css')).text, selector)
  })
}

test('Select and SelectFaceted share one layout stylesheet', async () => {
  const result = await bundleImports([
    '@antadesign/anta/elements/a-select',
    '@antadesign/anta/elements/a-select-faceted',
  ])
  const cssInputs = Object.keys(result.metafile.inputs).filter(path => path.endsWith('.css'))
  assert.deepEqual(cssInputs, ['dist/components/select-parts.css'])
})

test('the elements barrel retains every composed layout stylesheet', async () => {
  const result = await bundleImports(['@antadesign/anta/elements'])
  const layouts = Object.keys(result.metafile.inputs).filter(path => path.startsWith('dist/components/') && path.endsWith('.css'))
  assert.deepEqual(layouts.sort(), [
    'dist/components/Breadcrumbs.css',
    'dist/components/InputDate.css',
    'dist/components/Steps.css',
    'dist/components/select-parts.css',
  ])
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
