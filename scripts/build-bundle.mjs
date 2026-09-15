import { build } from 'esbuild'

await build({
  entryPoints: ['src/bundle.ts'],
  outfile: 'dist/bundle.js',
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  jsx: 'automatic',
  jsxImportSource: '@antadesign/anta',
  external: ['react'],
})
