/**
 * build-iframe-runtime.mjs — produce `site/public/iframe-anta-runtime.js`,
 * a self-contained browser ESM bundle that, when imported into any
 * window, registers Anta's custom elements on that window's
 * `customElements` registry and injects the per-element CSS into the
 * document head.
 *
 * The Playground's preview iframe (lives at `about:srcdoc`,
 * has its own customElements registry, can't share the parent's)
 * dynamic-imports this URL on first load.
 *
 * We use Node esbuild (available transitively via Astro/Vite) rather
 * than esbuild-wasm so the build step runs at native speed alongside
 * the rest of `docs:`.
 */
import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'

const root = new URL('../..', import.meta.url)
const tokensCss = fileURLToPath(new URL('src/tokens.css', root))
const resetCss = fileURLToPath(new URL('src/reset.css', root))
const elementsEntry = fileURLToPath(new URL('src/elements/index.ts', root))
const outFile = fileURLToPath(new URL('site/public/iframe-anta-runtime.js', root))

await mkdir(dirname(outFile), { recursive: true })

await build({
  // Virtual entry: pull in the design tokens (so component CSS that
  // references `--bg-*` / `--text-*` / `--border-*` resolves the same way
  // it does on the docs site — e.g. the tooltip's frosted background) plus
  // reset.css's `@layer anta` rules (base link styling, list resets, etc.)
  // alongside the element registrations, so the iframe matches the real
  // site's appearance.
  stdin: {
    contents: `import ${JSON.stringify(tokensCss)}; import ${JSON.stringify(resetCss)}; import ${JSON.stringify(elementsEntry)};`,
    resolveDir: fileURLToPath(root),
    loader: 'ts',
  },
  outfile: outFile,
  bundle: true,
  format: 'esm',
  target: 'es2020',
  logLevel: 'silent',
  loader: { '.svg': 'text' },
  // Anta's element CSS files use `@import` syntax in some cases and
  // import-from-JS in others. We inline every imported .css as a
  // `<style>` element appended to document.head at module-init time,
  // so the iframe's document picks the CSS up wherever this bundle
  // is dynamic-imported.
  plugins: [
    {
      name: 'css-as-style-tag',
      setup(b) {
        b.onLoad({ filter: /\.css$/ }, async (args) => {
          const css = await readFile(args.path, 'utf8')
          return {
            contents: `
              if (typeof document !== 'undefined') {
                const __s = document.createElement('style');
                __s.textContent = ${JSON.stringify(css)};
                document.head.appendChild(__s);
              }
            `,
            loader: 'js',
          }
        })
      },
    },
  ],
})

console.log(`built ${outFile}`)

/* ------------------------------------------------------------------ *
 * Self-contained preview app (the "playground iframe as a real Anta
 * app" model): ship Preact and the whole Anta library as separate,
 * content-hash-cache-busted ESM assets that the iframe wires together
 * with an import map. Because ES modules are singletons per URL, the
 * demo code and Anta's wrappers both `import 'preact'` → the SAME
 * vendor module → one Preact instance (no configure() gymnastics).
 * Anta's CSS ships as a real stylesheet whose class names match the
 * bundle's JS, so wrapper CSS modules (e.g. the Select chevron) work
 * in the iframe with no parent-style cloning.
 * ------------------------------------------------------------------ */
const iframeDir = fileURLToPath(new URL('site/public/iframe', root))
await mkdir(iframeDir, { recursive: true })
// Bare specifiers (`preact`, `@antadesign/anta/*`) resolve from the site's
// node_modules, so bundle from the site dir, not the repo root.
const siteDir = fileURLToPath(new URL('..', import.meta.url))
const distElements = fileURLToPath(new URL('dist/elements/index.js', root))
const distIndex = fileURLToPath(new URL('dist/index.js', root))

const shared = { bundle: true, format: 'esm', target: 'es2020', logLevel: 'silent', write: false }

// Vendor: one file per bare specifier, cross-externalized so they all resolve
// back to a single `preact` core module through the import map.
const vendorEntries = {
  'preact': { contents: `export * from 'preact';`, external: [] },
  'preact-hooks': { contents: `export * from 'preact/hooks';`, external: ['preact'] },
  'preact-compat': { contents: `export * from 'preact/compat'; export { default } from 'preact/compat';`, external: ['preact', 'preact/hooks'] },
  'preact-jsx-runtime': { contents: `export * from 'preact/jsx-runtime';`, external: ['preact'] },
}

/** Write a build's output files (hashing the JS/CSS by content) and return the
 *  emitted { js, css? } basenames keyed for the manifest. */
async function emit(name, outputFiles) {
  const written = {}
  for (const f of outputFiles) {
    const ext = f.path.endsWith('.css') ? 'css' : 'js'
    const hash = createHash('sha256').update(f.contents).digest('hex').slice(0, 8)
    const file = `${name}.${hash}.${ext}`
    await writeFile(`${iframeDir}/${file}`, f.contents)
    written[ext] = file
  }
  return written
}

const manifest = {}

for (const [name, { contents, external }] of Object.entries(vendorEntries)) {
  const out = await build({
    ...shared,
    stdin: { contents, resolveDir: siteDir, loader: "js" },
    outfile: `${iframeDir}/${name}.js`,
    external,
  })
  manifest[name] = await emit(name, out.outputFiles)
}

// Anta app: register the elements + re-export the wrapper barrel. React resolves
// to Preact's compat (external → import map), and every preact* specifier is
// external so it shares the vendor core. CSS (tokens + reset + element +
// wrapper-module CSS) is bundled to a sibling stylesheet with matching hashes.
const antaOut = await build({
  ...shared,
  stdin: {
    contents: `import ${JSON.stringify(tokensCss)}; import ${JSON.stringify(resetCss)}; import ${JSON.stringify(distElements)}; export * from ${JSON.stringify(distIndex)};`,
    resolveDir: fileURLToPath(root),
    loader: 'js',
  },
  outfile: `${iframeDir}/anta.js`,
  alias: { react: 'preact/compat', 'react-dom': 'preact/compat', 'react/jsx-runtime': 'preact/jsx-runtime' },
  external: ['preact', 'preact/hooks', 'preact/compat', 'preact/jsx-runtime'],
  loader: { '.svg': 'text' },
})
manifest.anta = await emit('anta', antaOut.outputFiles)

// Manifest the Playground imports to build the iframe's import map + <link>.
const manifestModule =
  `// Auto-generated by build-iframe-runtime.mjs. Do not edit.\n` +
  `export const IFRAME_ASSETS = ${JSON.stringify(manifest, null, 2)} as const\n`
await writeFile(fileURLToPath(new URL('site/src/generated/iframe-assets.ts', root)), manifestModule)

console.log('built self-contained preview assets:', Object.keys(manifest).join(', '))