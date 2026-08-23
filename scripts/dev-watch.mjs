/**
 * Rebuild the workspace after package-source changes while `pnpm run dev` is
 * running. This intentionally does not run on startup: the root dev command
 * completes its first build and docs generation before starting Astro, so
 * Vite never reads a partially-written generated docs file.
 */
import { spawn } from 'node:child_process'
import { statSync, watch } from 'node:fs'

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const workspaceTasks = [
  ['run', 'build:dev'],
  ['--filter', '@antadesign/stickers', 'run', 'build:dev'],
  ['--filter', 'anta-site', 'run', 'docs'],
]

const playgroundRuntimeTasks = [
  ['--filter', 'anta-site', 'run', 'docs:playground-runtime'],
]

let timer
let running = false
let pendingKind
let scheduledKind

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(pnpm, args, { stdio: 'inherit' })
    child.once('exit', (code) => resolve(code === 0))
    child.once('error', () => resolve(false))
  })
}

async function rebuild(kind) {
  if (running) {
    // A full workspace rebuild also rebuilds the Playground runtime, so it
    // supersedes a pending runtime-only pass.
    pendingKind = pendingKind === 'workspace' || kind === 'workspace' ? 'workspace' : 'playground'
    return
  }

  running = true
  const tasks = kind === 'workspace' ? workspaceTasks : playgroundRuntimeTasks
  console.log(
    kind === 'workspace'
      ? '[dev-watch] package source changed — rebuilding workspace and docs'
      : '[dev-watch] Playground source changed — rebuilding Playground runtime',
  )
  for (const task of tasks) {
    if (!await run(task)) {
      console.error('[dev-watch] rebuild failed; waiting for the next change')
      break
    }
  }
  running = false

  if (pendingKind) {
    const nextKind = pendingKind
    pendingKind = undefined
    rebuild(nextKind)
  }
}

function schedule(kind) {
  clearTimeout(timer)
  scheduledKind = scheduledKind === 'workspace' || kind === 'workspace' ? 'workspace' : kind
  timer = setTimeout(() => {
    const nextKind = scheduledKind
    scheduledKind = undefined
    rebuild(nextKind)
  }, 150)
}

for (const path of ['src', 'stickers/src']) {
  watch(path, { recursive: true }, () => schedule('workspace'))
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
  schedule('workspace')
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
