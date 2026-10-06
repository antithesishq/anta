import { access } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import process from 'node:process'

const fixture = process.argv[2]
if (!fixture || !/^[a-z][a-z0-9-]*$/.test(fixture)) {
  console.error('Usage: pnpm test:fixture <fixture-name>')
  process.exit(1)
}

const specification = `fixtures/${fixture}/bombadil.spec.ts`
try {
  await access(specification)
} catch {
  console.error(`Unknown fixture ${JSON.stringify(fixture)}. Expected ${specification}.`)
  process.exit(1)
}

const origin = process.env.ANTA_FIXTURE_ORIGIN ?? 'http://localhost:4321'
const headless = process.env.BOMBADIL_HEADLESS === 'true' || process.env.CI === 'true'
const timeLimit = process.env.BOMBADIL_TIME_LIMIT ?? '5m'
const outputPath = process.env.BOMBADIL_OUTPUT_PATH ?? `fixtures/${fixture}/.test-output`
const fixtureURL = new URL(`/fixtures/${fixture}/`, origin)

const args = [
  'browser',
  'test',
  ...(headless ? ['--headless'] : []),
  `--time-limit=${timeLimit}`,
  `--output-path=${outputPath}`,
  '--output-path-overwrite',
  fixtureURL.href,
  specification,
]

const bombadil = spawn('bombadil', args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
})

const code = await new Promise((resolve, reject) => {
  bombadil.on('error', reject)
  bombadil.on('exit', (status, signal) => resolve(signal ? 1 : status ?? 1))
})

process.exit(code)

