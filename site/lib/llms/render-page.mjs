import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { overview } from './index-content.mjs'
import { renderDocumentation } from './render-documentation.mjs'

async function readDemo(page, format) {
  if (!page.demoSource) return null
  if (format === 'package') {
    const raw = await readFile(page.demoSource, 'utf8')
    return raw.match(/^\s*export\s+default\s+`([\s\S]*)`\s*$/)?.[1].trim() ?? null
  }
  const code = page.demoCode ?? (await import(/* @vite-ignore */ pathToFileURL(page.demoSource).href)).default
  return code?.trim() || null
}

/** Render the same catalog entry for the site endpoint and packaged Markdown. */
export async function renderCatalogPage(page, { sources, changelog, format = 'llms', rewriteLinks = value => value }) {
  if (page.exportContent === 'overview') return overview
  if (page.exportContent === 'changelog') return changelog.trim()

  const raw = page.body ?? await readFile(page.source, 'utf8')
  let body = rewriteLinks(renderDocumentation(raw, sources).replace(/^# .+$/m, `# ${page.label}`))
  if (page.kind !== 'page') {
    const demo = await readDemo(page, format)
    if (demo) body += `\n\n${format === 'package' ? '##' : '###'} Example\n\n\`\`\`tsx\n${demo}\n\`\`\``
  }
  return body
}
