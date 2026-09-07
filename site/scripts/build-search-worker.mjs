import { build } from 'esbuild'

await build({
  entryPoints: ['lib/search/worker.ts'],
  outfile: 'dist/_worker.js',
  bundle: true,
  format: 'esm',
  target: 'es2022',
})
