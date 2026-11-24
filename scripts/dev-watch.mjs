/**
 * Rebuild the packages whose source changed, then the docs, while `pnpm run dev`
 * is running. This intentionally does not run on startup: the root dev command
 * completes package builds before starting Astro, whose site integration
 * finishes docs preparation before Vite reads generated imports.
 */
import { spawn } from 'node:child_process'
import { statSync, watch } from 'node:fs'

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
// Each package is rebuilt only when its own source changes. None bundles another: they import Anta as an external.
const packageTasks = {
  'src': ['run', 'build:dev'],
  'stickers/src': ['--filter', '@antadesign/stickers', 'run', 'build:dev'],
  'plot/src': ['--filter', '@antadesign/plot', 'run', 'build:dev'],
  'virtual-scroll/src': ['--filter', '@antadesign/virtual-scroll', 'run', 'build:dev'],
  'table/src': ['--filter', '@antadesign/table', 'run', 'build:dev'],
  'typedoc-theme/src': ['--filter', '@antadesign/typedoc-theme', 'run', 'build:dev'],
}
const docsTask = ['--filter', 'anta-site', 'run', 'docs']
const playgroundRuntimeTask = ['--filter', 'anta-site', 'run', 'docs:playground-runtime']

let timer
let running = false
// Changed package source dirs, plus 'docs' or 'playground'.
let pending = new Set()
let scheduled = new Set()

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(pnpm, args, { stdio: 'inherit' })
    child.once('exit', (code) => resolve(code === 0))
    child.once('error', () => resolve(false))
  })
}

async function rebuild(changes) {
  if (running) {
    for (const change of changes) pending.add(change)
    return
  }

  running = true
  const packages = Object.keys(packageTasks).filter((src) => changes.has(src))
  const tasks = packages.map((src) => packageTasks[src])
  // The docs read every package's build, and also rebuild the Playground runtime.
  if (tasks.length > 0 || changes.has('docs')) tasks.push(docsTask)
  else tasks.push(playgroundRuntimeTask)
  console.log(
    packages.length > 0
      ? `[dev-watch] ${packages.join(', ')} changed: rebuilding those packages and docs`
      : changes.has('docs')
        ? '[dev-watch] CHANGELOG.md changed: rebuilding docs'
        : '[dev-watch] Playground source changed: rebuilding Playground runtime',
  )
  for (const task of tasks) {
    if (!await run(task)) {
      console.error('[dev-watch] rebuild failed; waiting for the next change')
      break
    }
  }
  running = false

  if (pending.size > 0) {
    const next = pending
    pending = new Set()
    rebuild(next)
  }
}

function schedule(change) {
  clearTimeout(timer)
  scheduled.add(change)
  timer = setTimeout(() => {
    const next = scheduled
    scheduled = new Set()
    rebuild(next)
  }, 150)
}

for (const path of Object.keys(packageTasks)) {
  watch(path, { recursive: true }, () => schedule(path))
}

let changelogSignature = changelogFileSignature()

function changelogFileSignature() {
  const { mtimeMs, size } = statSync('CHANGELOG.md')
  return `${mtimeMs}:${size}`
}

watch('CHANGELOG.md', () => {
  const nextSignature = changelogFileSignature()
  if (nextSignature === changelogSignature) return

  changelogSignature = nextSignature
  schedule('docs')
})

const playgroundRuntimeFiles = new Set([
  'Playground.tsx',
  'Playground.module.css',
  'playground-runtime.tsx',
  'playground-monaco.ts',
  'playground-shiki.ts',
  'playground-esbuild.ts',
])

watch('site/src/components', { recursive: true }, (_event, filename) => {
  if (playgroundRuntimeFiles.has(String(filename))) schedule('playground')
})
watch('site/lib/sandbox', { recursive: true }, () => schedule('playground'))

console.log('[dev-watch] watching package sources, Playground sources, and CHANGELOG.md')
