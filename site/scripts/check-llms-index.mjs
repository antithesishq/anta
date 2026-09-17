import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readPageCatalog } from '../lib/content/catalog.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const pagesDir = resolve(here, '../src/pages')
const catalog = await readPageCatalog()
const sources = new Set(catalog.map(page => page.source))
const missing = readdirSync(pagesDir, { recursive: true })
  .filter(name => name.endsWith('.mdx'))
  .filter(name => !sources.has(resolve(pagesDir, name)))

if (missing.length) {
  throw new Error(
    `Standalone MDX pages missing from site/lib/content/standalone.mjs: ${missing.join(', ')}`,
  )
}

console.log(`✓ page catalog validates all ${catalog.length} documentation pages.`)
