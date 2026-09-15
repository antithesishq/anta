import { spawn } from 'node:child_process'
import process from 'node:process'

const origin = process.env.ANTA_HARNESS_ORIGIN ?? 'http://localhost:4321'
const headless = process.env.BOMBADIL_HEADLESS === 'true' || process.env.CI === 'true'
const timeLimit = process.env.BOMBADIL_TIME_LIMIT ?? '1m'
const outputPath = process.env.BOMBADIL_OUTPUT_PATH ?? 'tests/.test-output/harness'
const testURL = new URL('/test/', origin)

const args = [
  'browser', 'test', ...(headless ? ['--headless'] : []), `--time-limit=${timeLimit}`,
  `--output-path=${outputPath}`, '--output-path-overwrite',
  testURL.href, 'tests/harness.bombadil.spec.ts',
]
const bombadil = spawn('bombadil', args, { cwd: process.cwd(), env: process.env, stdio: 'inherit' })
const code = await new Promise((resolve, reject) => { bombadil.on('error', reject); bombadil.on('exit', (status, signal) => resolve(signal ? 1 : status ?? 1)) })
process.exit(code)
