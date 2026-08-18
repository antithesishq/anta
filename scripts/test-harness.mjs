import { spawn, spawnSync } from 'node:child_process'
import { randomInt } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const origin = process.env.ANTA_HARNESS_ORIGIN ?? 'http://localhost:4321'
const timeLimit = process.env.BOMBADIL_TIME_LIMIT ?? '5m'
const headless = process.env.BOMBADIL_HEADLESS === 'true' || process.env.CI === 'true'
const exitOnViolation = process.env.BOMBADIL_EXIT_ON_VIOLATION === 'true'
const seed = process.env.HEGEL_SEED ?? String(randomInt(0, 0x80000000))
const createdAt = new Date().toISOString()
const runId = process.env.HARNESS_RUN_ID ?? String(Date.now())

if (!/^[A-Za-z0-9_.-]+$/.test(runId)) {
  throw new Error(`HARNESS_RUN_ID contains unsupported characters: ${JSON.stringify(runId)}`)
}

const runDirectory = path.join(root, 'tests', '.test-output', runId)
const corpusPath = path.join(runDirectory, 'apps.json')

if (fs.existsSync(runDirectory)) {
  throw new Error(`Harness run ${runId} already exists. Choose a different HARNESS_RUN_ID.`)
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

async function serverIsReady() {
  try {
    const response = await fetch(new URL('/test/', origin))
    return response.ok
  } catch {
    return false
  }
}

if (!await serverIsReady()) {
  console.error(`The harness server is not available at ${origin}/test/.`)
  console.error('Start it separately with: pnpm run dev')
  process.exit(1)
}

console.log(`Harness run: ${runId}`)
console.log(`Hegel seed: ${seed}`)
run(process.execPath, ['tests/generate-corpus.mjs'], {
  ...process.env,
  HEGEL_SEED: seed,
  HEGEL_RUN_ID: runId,
  HEGEL_OUTPUT_PATH: corpusPath,
})

const relativeRunDirectory = path.relative(root, runDirectory)
const relativeCorpusPath = path.relative(root, corpusPath)
const testURL = new URL('/test/', origin)
testURL.searchParams.set('bombadil-testing', 'true')
testURL.searchParams.set('run-id', runId)

const runMetadata = {
  runId,
  createdAt,
  seed: Number(seed),
  url: testURL.href,
  output: relativeRunDirectory,
  corpus: relativeCorpusPath,
}
fs.writeFileSync(path.join(runDirectory, 'run.json'), `${JSON.stringify(runMetadata, null, 2)}\n`)

const args = [
  'browser',
  'test',
  ...(headless ? ['--headless'] : []),
  `--time-limit=${timeLimit}`,
  ...(exitOnViolation ? ['--exit-on-violation'] : []),
  `--output-path=${runDirectory}`,
  '--chrome-grant-permissions=local-network-access,local-network,loopback-network,clipboard-read,clipboard-write',
  testURL.href,
  'tests/bombadil.spec.ts',
]

const bombadil = spawn('bombadil', args, { cwd: root, env: process.env, stdio: 'inherit' })
const exitCode = await new Promise((resolve, reject) => {
  bombadil.once('error', reject)
  bombadil.once('exit', (code, signal) => resolve(signal ? 1 : code ?? 1))
})

console.log(`Test output: ${relativeRunDirectory}`)
process.exit(exitCode)
