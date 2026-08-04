import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const parallel = args.length === 1 && (args[0] === '-new' || args[0] === '--parallel')

if (args.length && !parallel) {
  console.error('Usage: pnpm run dev [-new]')
  process.exit(1)
}

const pidfile = parallel ? '.dev.parallel.pid' : '.dev.pid'
const port = parallel ? '4322' : '4321'

function running(pidfile) {
  if (!existsSync(pidfile)) return false
  const pid = Number.parseInt(readFileSync(pidfile, 'utf8').trim(), 10)
  try {
    process.kill(pid, 0)
    return true
  } catch {
    unlinkSync(pidfile)
    return false
  }
}

if (parallel && running(pidfile)) {
  console.error('A parallel Anta dev server is already running. Run `pnpm run stop` before starting another one.')
  process.exit(1)
}

if (!parallel) {
  const result = spawnSync(process.execPath, ['scripts/dev-stop.mjs'], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const child = spawn('pnpm', ['run', 'dev:run'], {
  env: { ...process.env, ANTA_DEV_PID_FILE: pidfile, ANTA_DEV_PORT: port },
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
