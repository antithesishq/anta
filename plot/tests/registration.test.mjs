import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Stub element implementations, not registration: these tests need no browser DOM.
async function registrationBundle(contents, options = {}) {
  return build({
    absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
    stdin: {
      contents,
      resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    plugins: [{
      name: 'element-stubs',
      setup(b) {
        b.onResolve({ filter: /\/plot_(element|surface)$/ }, args => ({
          path: args.path,
          namespace: 'element-stub',
        }))

        b.onLoad({ filter: /.*/, namespace: 'element-stub' }, args => ({
          contents: `export function create_${
            args.path.endsWith('surface') ? 'plot_surface' : 'plot'
          }_element() { return class {}; }`,
        }))

        b.onResolve({ filter: /^@antadesign\/anta\/elements\// }, args => ({
          path: args.path,
          namespace: 'anta-stub',
        }))

        b.onLoad({ filter: /.*/, namespace: 'anta-stub' }, args => ({
          contents: `export function register_${args.path.split('/').pop().replaceAll('-', '_')}() {}`,
        }))
      },
    }],
    ...options,
  })
}

const bundle = await registrationBundle(`
  export * from './src/entries/elements';
  export { plotElementReady as legacyReady } from './src/browser/auto';
  export { definePlotElement, definePlotSurfaceElement } from './src/browser/index';
`)
const surfaceBundle = await registrationBundle("import './src/entries/elements/a-plot-surface'")
const plotBundle = await registrationBundle("import './src/entries/elements/a-plot'")

function load(registry, source = bundle) {
  const module = { exports: {} }
  vm.runInNewContext(source.outputFiles[0].text, {
    module,
    exports: module.exports,
    console,
    ...(registry ? { customElements: registry } : {}),
  })

  return module.exports
}

function registry(entries = []) {
  const definitions = new Map(entries)

  return {
    definitions,
    get: name => definitions.get(name),
    define(name, element) {
      assert.equal(definitions.has(name), false, `Duplicate registration: ${name}`)
      definitions.set(name, element)
    },
  }
}

test('imports without a browser registry are safe and auto shares readiness', async () => {
  const api = load()

  assert.equal(api.legacyReady, api.plotElementReady)
  await api.plotElementReady
  await api.definePlotElement()
  await api.definePlotSurfaceElement()
})

test('bulk import registers both, including concurrent callers and duplicate module copies', async () => {
  const r = registry()
  const a = load(r)
  assert.deepEqual([...r.definitions.keys()].sort(), ['a-plot', 'a-plot-surface'])
  const b = load(r)

  await Promise.all([
    a.plotElementReady,
    b.plotElementReady,
    a.definePlotElement(),
    b.definePlotSurfaceElement(),
  ])

  assert.deepEqual([...r.definitions.keys()].sort(), ['a-plot', 'a-plot-surface'])
})

test('existing definitions are preserved independently', async () => {
  for (const tag of ['a-plot', 'a-plot-surface']) {
    const existing = class {}
    const r = registry([[tag, existing]])

    const api = load(r)
    assert.equal(r.definitions.size, 2)
    await api.plotElementReady

    assert.equal(r.get(tag), existing)
    assert.equal(r.definitions.size, 2)
  }
})

test('individual entries register synchronously and compose without replacing definitions', () => {
  load(undefined, surfaceBundle)
  load(undefined, plotBundle)

  const r = registry()
  load(r, surfaceBundle)
  assert.deepEqual([...r.definitions.keys()], ['a-plot-surface'])
  const surface = r.get('a-plot-surface')

  load(r, plotBundle)
  assert.equal(r.definitions.size, 2)
  assert.equal(r.get('a-plot-surface'), surface)
  const plot = r.get('a-plot')

  load(r, surfaceBundle)
  load(r, plotBundle)
  load(r)
  assert.equal(r.get('a-plot-surface'), surface)
  assert.equal(r.get('a-plot'), plot)

  const standalone = registry()
  load(standalone, plotBundle)
  assert.deepEqual([...standalone.definitions.keys()].sort(), ['a-plot', 'a-plot-surface'])
})

test('split entry output registers the surface before upgrading existing plots', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'plot-registration-'))
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'customElements')
  const r = registry()
  const define = r.define
  r.define = (name, element) => {
    if (name === 'a-plot') assert.ok(r.get('a-plot-surface'), 'Existing plots need their surface during upgrade')
    define(name, element)
  }

  try {
    await registrationBundle(undefined, {
      stdin: undefined,
      entryPoints: {
        elements: 'src/entries/elements.ts',
        plot: 'src/entries/elements/a-plot.ts',
        surface: 'src/entries/elements/a-plot-surface.ts',
        browser: 'src/browser/index.ts',
      },
      format: 'esm',
      splitting: true,
      write: true,
      outdir: directory,
      outExtension: { '.js': '.mjs' },
    })
    Object.defineProperty(globalThis, 'customElements', { value: r, configurable: true })
    await import(pathToFileURL(join(directory, 'plot.mjs')).href)
    assert.deepEqual([...r.definitions.keys()], ['a-plot-surface', 'a-plot'])
  } finally {
    if (previous) Object.defineProperty(globalThis, 'customElements', previous)
    else delete globalThis.customElements
    await rm(directory, { recursive: true, force: true })
  }
})
