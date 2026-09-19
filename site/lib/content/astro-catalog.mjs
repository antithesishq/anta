import { getCollection } from 'astro:content'
import { join, resolve } from 'node:path'
import {
  COLLECTIONS,
  STANDALONE_PAGES,
  defaultSiteRoot,
  findDemoSource,
  normalizeCollectionEntry,
  normalizeStandalonePage,
  parseFrontmatter,
  validatePageCatalog,
} from './catalog.mjs'

const standaloneSources = import.meta.glob('/src/pages/**/*.{md,mdx}', { eager: true, query: '?raw', import: 'default' })
const demos = import.meta.glob('/src/content/**/*.demo.ts', { eager: true, import: 'default' })

export async function getAstroPageCatalog() {
  const root = defaultSiteRoot()
  const standalone = STANDALONE_PAGES.map(page => {
    const body = standaloneSources[`/${page.source}`]
    const data = body === undefined ? page : parseFrontmatter(body, page.source)
    return { ...normalizeStandalonePage(page, data, { source: join(root, page.source) }), ...(body !== undefined && { body }) }
  })
  const content = await Promise.all(COLLECTIONS.map(async collection => {
    const entries = await getCollection(collection.name)
    const files = [...entries.map(entry => `/${entry.filePath.replaceAll('\\', '/')}`), ...Object.keys(demos)]
    return entries.map(entry => {
      const source = resolve(root, entry.filePath)
      const relativeSource = `/${entry.filePath.replaceAll('\\', '/')}`
      const demoKey = findDemoSource(relativeSource, files)
      return {
        ...normalizeCollectionEntry(collection, entry.id, entry.data, {
          source,
          demoSource: demoKey && join(root, demoKey.slice(1)),
        }),
        body: entry.body,
        ...(demoKey && { demoCode: demos[demoKey] }),
      }
    })
  }))
  return validatePageCatalog([...standalone, ...content.flat()])
}
