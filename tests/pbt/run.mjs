import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
const origin = process.env.ANTA_HARNESS_ORIGIN ?? 'http://localhost:4321'
const caseLimit = Number(process.env.ANTA_HARNESS_CASES ?? Infinity)
const headed = process.env.HARNESS_HEADED === 'true'
const runnerPath = join(tmpdir(), `anta-harness-runner-${process.pid}.mjs`)
const reportDirectory = resolve('tests/pbt/.runs')
const shards = Number(process.env.ANTA_HARNESS_SHARDS) || 1
const shard = Number(process.env.ANTA_HARNESS_SHARD) || 0
const runDirectory = process.env.ANTA_HARNESS_RUN_DIRECTORY ?? join(reportDirectory, `run-${Date.now()}`)

if (shards > 1 && process.env.ANTA_HARNESS_SHARD == null) {
  await mkdir(runDirectory, { recursive: true })
  const codes = await Promise.all(Array.from({ length: shards }, (_, index) => new Promise(resolve => {
    const child = spawn(process.execPath, [process.argv[1]], {
      cwd: process.cwd(),
      env: { ...process.env, ANTA_HARNESS_SHARD: String(index), ANTA_HARNESS_RUN_DIRECTORY: runDirectory },
      stdio: 'inherit',
    })
    child.on('exit', code => resolve(code ?? 1))
  })))
  process.exitCode = codes.some(code => code) ? 1 : 0
} else {
  let browser
  try {
    await build({
      entryPoints: [resolve('tests/pbt/runner.ts')],
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile: runnerPath,
    })
    const { run } = await import(pathToFileURL(runnerPath).href)
    browser = await chromium.launch({ headless: !headed })
    const page = await browser.newPage()
    const shardDirectory = join(runDirectory, `shard-${shard}`)
    await mkdir(shardDirectory, { recursive: true })
    const reportPath = join(shardDirectory, 'report.json')
    const report = { origin, model: 'Button', shard, shards, cases: 0, actions: 0, reports: [] }
    const saveReport = () => writeFile(reportPath, JSON.stringify(report, null, 2))
    await saveReport()
    const result = await run(page, origin, async ({ caseId, action, dom, violations }) => {
      const screenshot = `Button-${caseId}-${action}.png`
      await page.screenshot({ path: join(shardDirectory, screenshot), fullPage: true })
      report.reports.push({ caseId, action, violations, screenshot, dom })
      await saveReport()
    }, caseLimit, shard, shards)
    report.cases = result.cases
    report.actions = result.actions
    await saveReport()
    console.log(`Button shard ${shard}/${shards}: ${result.cases} cases, ${result.actions} actions`)
    console.log(shardDirectory)
  } finally {
    await browser?.close()
    await rm(runnerPath, { force: true })
  }
}
