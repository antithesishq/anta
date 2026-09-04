/**
 * Fails the build when a documentation page is missing from the /llms.txt and
 * /llms-full.txt index.
 *
 * `componentGroups` in lib/llms/index-content.mjs is the only thing those two
 * files read. A page absent from it still ships and still appears in the
 * sidebar, so nothing looks broken — it is just invisible to every model that
 * fetches the index. Box and Avatar both drifted that way before this check
 * existed.
 */
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { componentGroups, documentationLinks, packageLinks } from '../lib/llms/index-content.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const pagesDir = resolve(here, '../src/pages')

const indexed = new Set(
  [...componentGroups.flat(), ...documentationLinks, ...packageLinks].map(([, path]) => path),
)

// Recursive: a page can be `foo.mdx` or `foo/index.mdx`, and the nested form is
// exactly the one a flat scan misses — `accessibility/index.mdx` is one today.
const pages = readdirSync(pagesDir, { recursive: true })
  .map((name) => String(name).replaceAll('\\', '/'))
  .filter((name) => name.endsWith('.mdx') && name !== 'index.mdx')
  .map((name) => `/${name.replace(/(\/)?index\.mdx$/, '').replace(/\.mdx$/, '')}/`)

const missing = pages.filter((path) => !indexed.has(path))
const stale = [...indexed].filter((path) => path !== '/' && !pages.includes(path))

if (missing.length) {
  console.error(
    `✗ Missing from site/lib/llms/index-content.mjs: ${missing.join(', ')}\n` +
      '  Add each page to componentGroups (or packageLinks), matching the DocsLayout sidebar order.',
  )
  process.exit(1)
}

// A stale entry is only a warning: documentationLinks legitimately points at
// .astro pages and directory routes, which never appear in the .mdx scan.
if (stale.length) console.warn(`  note: llms entries with no .mdx page: ${stale.join(', ')}`)

console.log(`✓ llms index covers all ${pages.length} documentation pages.`)
