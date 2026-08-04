/**
 * Rebuild the workspace after package-source changes while `pnpm run dev` is
 * running. This intentionally does not run on startup: the root dev command
 * completes its first build and docs generation before starting Astro, so
 * Vite never reads a partially-written generated docs file.
 */
import { spawn } from 'node:child_process'
import { watch } from 'node:fs'

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const tasks = [
  ['run', 'build:dev'],
  ['--filter', '@antadesign/stickers', 'run', 'build:dev'],
  ['--filter', 'anta-site', 'run', 'docs'],
]

let timer
let running = false
let pending = false

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(pnpm, args, { stdio: 'inherit' })
    child.once('exit', (code) => resolve(code === 0))
    child.once('error', () => resolve(false))
  })
}

async function rebuild() {
  if (running) {
    pending = true
    return
  }

  running = true
  console.log('[dev-watch] source changed — rebuilding workspace and docs')
  for (const task of tasks) {
    if (!await run(task)) {
      console.error('[dev-watch] rebuild failed; waiting for the next change')
      break
    }
  }
  running = false

  if (pending) {
    pending = false
    rebuild()
  }
}

function schedule() {
  clearTimeout(timer)
  timer = setTimeout(rebuild, 150)
}

for (const path of ['src', 'stickers/src']) {
  watch(path, { recursive: true }, schedule)
}
watch('CHANGELOG.md', schedule)

console.log('[dev-watch] watching src, stickers/src, and CHANGELOG.md')
