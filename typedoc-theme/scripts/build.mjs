import { copyFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url))

await mkdir(path('../dist/'), { recursive: true })
await build({
  entryPoints: [path('../src/theme.css')],
  outfile: path('../dist/theme.css'),
  bundle: true,
  minify: true,
  logLevel: 'info',
})
await Promise.all([
  copyFile(path('../src/index.mjs'), path('../dist/index.mjs')),
  copyFile(path('../src/client.js'), path('../dist/client.js')),
  copyFile(path('../../LICENSE.md'), path('../LICENSE.md')),
])
