import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cachedBuild } from '../lib/build-cache.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const site = join(root, 'site')
const require = createRequire(import.meta.url)
const mode = process.argv[2] ?? 'docs'
const force = process.env.ANTA_BUILD_CACHE === '0'

function run(file, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], { cwd: site, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${file} failed (${signal ?? code})`))
    })
  })
}

function cli(packageName, args) {
  const manifest = require.resolve(`${packageName}/package.json`)
  const { bin } = JSON.parse(readFileSync(manifest, 'utf8'))
  return run(join(dirname(manifest), typeof bin === 'string' ? bin : bin[packageName]), args)
}

const script = (name) => run(join(site, 'scripts', name))

async function together(tasks) {
  // Let sibling processes finish before reporting failure, so an abandoned
  // build cannot keep writing outputs underneath the next invocation.
  const results = await Promise.allSettled(tasks)
  const failed = results.find(result => result.status === 'rejected')
  if (failed) throw failed.reason
}

const commonInputs = [
  'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', 'package.json', 'site/package.json',
  'site/scripts/prepare.mjs', 'site/lib/build-cache.mjs',
]

function cached(name, inputs, outputs, build) {
  return cachedBuild({
    root, cacheDir: join(site, '.cache/build'), name,
    inputs: [...commonInputs, ...inputs], outputs, build, force,
  })
}

const api = () => cached('api', [
  'src', 'site/lib/union-source-order.mjs',
], ['site/src/api.json'], () => cli('typedoc', [
  '--json', 'src/api.json', '--entryPoints', '../src/index.ts',
  '--tsconfig', '../src/tsconfig.json', '--sort', 'source-order',
  '--plugin', './lib/union-source-order.mjs',
]))

const iframe = () => cached('iframe', [
  'dist', 'site/scripts/build-iframe-runtime.mjs',
], ['site/src/generated/iframe-assets.ts', 'site/public/iframe'],
() => script('build-iframe-runtime.mjs'))

const playground = () => cached('playground', [
  'dist', 'site/src/components', 'site/lib', 'site/tsconfig.json',
  'site/src/api.json', 'site/src/generated/iframe-assets.ts',
  'site/scripts/build-playground-runtime.mjs',
], ['site/src/generated/playground-assets.ts', 'site/public/playground'],
() => script('build-playground-runtime.mjs'))

async function docs() {
  // The app embeds both API data and the iframe manifest. Finish those first.
  await together([
    api(), iframe(), script('gen-pages.mjs'), script('check-llms-index.mjs'),
    script('copy-esbuild-wasm.mjs'), script('copy-themes.mjs'),
  ])
  await playground()
}

await mkdir(join(site, 'src/generated'), { recursive: true })

switch (mode) {
  case 'api': await api(); break
  case 'iframe': await iframe(); break
  case 'playground': await playground(); break
  case 'docs': await docs(); break
  case 'build':
    await docs()
    await cli('astro', ['build'])
    await together([
      script('build-search-index.mjs'), script('build-search-worker.mjs'),
      script('copy-sitemap-index.mjs'),
    ])
    break
  default: throw new Error(`Unknown preparation task: ${mode}`)
}
