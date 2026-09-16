import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { extname, join, resolve, sep } from 'node:path'
import axe from 'axe-core'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
const siteRoot = resolve('site/dist')
const reportPages = [
  'button',
  'progress',
  'checkbox',
  'slider',
  'tabs',
  'input',
  'input-autocomplete',
  'input-date',
  'select',
  'text',
]
const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
}

function parseArguments() {
  const themeArgument = process.argv.find(argument => argument.startsWith('--theme='))
  const theme = themeArgument?.slice('--theme='.length) ?? 'light'
  const details = process.argv.includes('--details')
  if (!['light', 'dark', 'both'].includes(theme)) {
    throw new Error('Use --theme=light, --theme=dark, or --theme=both.')
  }
  const requestedPages = process.argv.filter(argument => !argument.startsWith('--')).slice(2)
  return {
    modes: theme === 'both' ? ['light', 'dark'] : [theme],
    pages: requestedPages.length ? requestedPages : reportPages,
    details,
  }
}

async function serveFile(request, response) {
  const pathname = decodeURIComponent(new URL(request.url, 'http://audit.test').pathname)
  let file = resolve(siteRoot, `.${pathname}`)
  if (file !== siteRoot && !file.startsWith(`${siteRoot}${sep}`)) {
    response.writeHead(403).end()
    return
  }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
    const body = await readFile(file)
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream' }).end(body)
  } catch {
    response.writeHead(404).end('Not found')
  }
}

function increment(record, key) {
  record[key] = (record[key] ?? 0) + 1
}

function collect(result, pageName, frameUrl, findings) {
  for (const group of result.violations) {
    for (const node of group.nodes) {
      const data = node.any[0]?.data ?? node.none[0]?.data ?? {}
      const pair = `${data.fgColor ?? '?'} on ${data.bgColor ?? '?'} = ${data.contrastRatio ?? '?'}`
      increment(findings.pairs, pair)
      findings.violations.push({
        page: pageName,
        frame: frameUrl,
        target: node.target.join(' >>> '),
        pair,
      })
    }
  }
  for (const group of result.incomplete) {
    for (const node of group.nodes) {
      const data = node.any[0]?.data ?? node.none[0]?.data ?? {}
      increment(findings.incomplete, data.messageKey ?? 'unknown')
    }
  }
}

async function scanPage(browser, origin, pageName, mode) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(mode => {
    localStorage.setItem('anta-palette', 'antune')
    localStorage.setItem('anta-theme', mode)
  }, mode)
  const page = await context.newPage()
  try {
    await page.goto(`${origin}/${pageName}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(700)
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 800) {
        scrollTo(0, y)
        await new Promise(resolve => setTimeout(resolve, 30))
      }
      scrollTo(0, 0)
    })
    await page.waitForTimeout(700)
    const findings = { violations: [], incomplete: {}, pairs: {} }
    for (const frame of page.frames()) {
      await frame.addScriptTag({ content: axe.source })
      const result = await frame.evaluate(() => axe.run(document, {
        runOnly: { type: 'rule', values: ['color-contrast'] },
        resultTypes: ['violations', 'incomplete'],
      }))
      collect(result, pageName, frame.url(), findings)
    }
    return findings
  } finally {
    await context.close()
  }
}

const { details, modes, pages } = parseArguments()
await stat(join(siteRoot, 'index.html')).catch(() => {
  throw new Error('Build the documentation site first with `pnpm --filter anta-site run build`.')
})

const server = createServer(serveFile)
await new Promise((resolveListen, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolveListen)
})
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({
  headless: true,
  channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined,
})

try {
  console.log(`axe-core ${axe.version}; Antune; ${pages.length} report pages`)
  for (const mode of modes) {
    const totals = { violations: [], incomplete: {}, pairs: {} }
    for (const page of pages) {
      const findings = await scanPage(browser, origin, page, mode)
      totals.violations.push(...findings.violations)
      for (const [key, count] of Object.entries(findings.incomplete)) {
        totals.incomplete[key] = (totals.incomplete[key] ?? 0) + count
      }
      for (const [key, count] of Object.entries(findings.pairs)) {
        totals.pairs[key] = (totals.pairs[key] ?? 0) + count
      }
      console.log(`${mode}\t${page}\tviolations=${findings.violations.length}\tincomplete=${JSON.stringify(findings.incomplete)}`)
    }
    console.log(`${mode}\ttotal\tviolations=${totals.violations.length}\tincomplete=${JSON.stringify(totals.incomplete)}`)
    for (const [pair, count] of Object.entries(totals.pairs)) console.log(`${mode}\t${count}\t${pair}`)
    if (details) {
      for (const finding of totals.violations) {
        console.log(`${mode}\t${finding.page}\t${finding.pair}\t${finding.target}`)
      }
    }
  }
} finally {
  await browser.close()
  await new Promise(resolveClose => server.close(resolveClose))
}
