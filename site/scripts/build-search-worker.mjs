import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

export async function buildSearchWorker({ root = process.cwd(), outDir } = {}) {
  root = root instanceof URL ? fileURLToPath(root) : resolve(root)
  outDir ??= resolve(root, 'dist')
  outDir = outDir instanceof URL ? fileURLToPath(outDir) : resolve(outDir)

  await build({
    absWorkingDir: root,
    entryPoints: ['lib/search/worker.ts'],
    outfile: resolve(outDir, '_worker.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
  })
}

if (import.meta.main) await buildSearchWorker()
