import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { caseCount, decode } from './axes.ts'
import button from './components/button.ts'

const requireSite = createRequire(new URL('../../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
const origin = process.env.ANTA_HARNESS_ORIGIN ?? 'http://localhost:4321'
const theme = process.env.ANTA_HARNESS_THEME ?? 'antune'
if (!['antune', 'antithesis', 'default'].includes(theme)) throw new Error(`Unknown theme: ${theme}`)
const caseLimit = Number(process.env.ANTA_HARNESS_CASES ?? Infinity)
const shards = Number(process.env.ANTA_HARNESS_SHARDS) || 1
const shard = Number(process.env.ANTA_HARNESS_SHARD) || 0
const runDirectory = process.env.ANTA_HARNESS_RUN_DIRECTORY
  ?? resolve('tests/pbt/.runs', `run-${Date.now()}-${process.pid}`)

if (shards > 1 && process.env.ANTA_HARNESS_SHARD == null) {
  await mkdir(runDirectory, { recursive: true })
  const codes = await Promise.all(Array.from({ length: shards }, (_, index) => new Promise<number>(resolve => {
    const child = spawn(process.execPath, [process.argv[1]], {
      cwd: process.cwd(),
      env: { ...process.env, ANTA_HARNESS_SHARD: String(index), ANTA_HARNESS_RUN_DIRECTORY: runDirectory },
      stdio: 'inherit',
    })
    child.on('exit', code => resolve(code ?? 1))
  })))
  process.exitCode = codes.some(code => code) ? 1 : 0
} else {
  const browser = await chromium.launch({ headless: process.env.HARNESS_HEADED !== 'true' })
  try {
    const page = await browser.newPage()
    const shardDirectory = join(runDirectory, `shard-${shard}`)
    await mkdir(shardDirectory, { recursive: true })
    const reportPath = join(shardDirectory, 'report.json')
    const reports: { caseId: number; action: string; violations: { property: string; message: string }[]; screenshot: string; dom: string }[] = []
    const report = { origin, theme, model: 'Button', shard, shards, cases: 0, actions: 0, reports }
    const saveReport = () => writeFile(reportPath, JSON.stringify(report, null, 2))
    await saveReport()

    const totalCases = caseCount(button)
    const cases = Math.max(0, Math.min(Math.ceil((totalCases - shard) / shards), caseLimit))
    if (cases) {
      const url = new URL('/test/', origin)
      url.searchParams.set('model', 'Button')
      url.searchParams.set('case', String(shard))
      url.searchParams.set('navigation', 'true')
      url.searchParams.set('navigationStep', String(shards))
      await page.goto(url.href)
      if (theme !== 'antune') {
        await page.evaluate(async (theme: string) => {
          const link = document.querySelector<HTMLLinkElement>('link[href*="/themes/"]')
          if (!link) throw new Error('Harness theme stylesheet is missing')
          await new Promise<void>((resolve, reject) => {
            link.addEventListener('load', () => resolve(), { once: true })
            link.addEventListener('error', () => reject(new Error(`Cannot load ${theme} theme`)), { once: true })
            link.href = `/themes/${theme}.css`
          })
        }, theme)
      }
    }

    for (let completed = 0; completed < cases; completed++) {
      const caseId = shard + completed * shards
      const stage = page.locator(`[data-compile-status="ready"][data-model="Button"][data-case="${caseId}"]`)
      await stage.waitFor()
      const root = stage.locator('#harness-target')
      await root.waitFor()
      const props = decode(button, caseId)
      const check = async (action: string) => {
        const violations: { property: string; message: string }[] = []
        for (const property of button.properties) {
          try {
            const message = await property.run({ control: root, props, action })
            if (message) violations.push({ property: property.name, message })
          } catch (error) {
            violations.push({ property: property.name, message: String(error) })
          }
        }
        if (!violations.length) return
        const screenshot = `Button-${caseId}-${action}.png`
        await page.screenshot({ path: join(shardDirectory, screenshot), fullPage: true })
        reports.push({ caseId, action, violations, screenshot, dom: await root.evaluate(element => element.outerHTML) })
        await saveReport()
      }

      await check('render')
      for (const action of button.actions) {
        await action.run(page, root)
        await check(action.name)
        report.actions++
      }
      report.cases++
      if (completed + 1 < cases)
        await page.getByRole('navigation', { name: 'Case navigation' }).getByRole('button', { name: 'Next' }).click()
    }

    await saveReport()
    console.log(`Button shard ${shard}/${shards}: ${report.cases} cases, ${report.actions} actions`)
    if (reports.length) console.error(`${reports.length} failing cases; see ${reportPath}`)
    console.log(shardDirectory)
    if (reports.length) process.exitCode = 1
  } finally {
    await browser.close()
  }
}
