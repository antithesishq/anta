import { existsSync, readFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { COLLECTIONS, COMPONENT_GROUPS, NAV_GROUPS, collectionEntryId, schemaForCollection, standaloneSchema } from './schema.mjs'
import { STANDALONE_PAGES } from './standalone.mjs'

export { COLLECTIONS, COMPONENT_GROUPS, collectionEntryId, STANDALONE_PAGES }

export function defaultSiteRoot() {
  // Astro bundles this module into dist/. Node generators import its source.
  const candidates = [fileURLToPath(new URL('../../', import.meta.url)), resolve('site'), resolve('.')]
  for (const directory of candidates) {
    const manifest = join(directory, 'package.json')
    if (existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).name === 'anta-site') return directory
  }
  throw new Error('Cannot locate anta-site; pass siteRoot to readPageCatalog()')
}

export function parseFrontmatter(raw, source = 'Markdown') {
  const match = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) throw new Error(`Missing frontmatter in ${source}`)
  const data = parse(match[1])
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`Invalid frontmatter in ${source}`)
  return data
}

export function normalizeCollectionEntry(collection, id, input, { source, demoSource } = {}) {
  const definition = typeof collection === 'string' ? COLLECTIONS.find(item => item.name === collection) : collection
  if (!definition) throw new Error(`Unknown collection: ${collection}`)
  const result = schemaForCollection(definition).safeParse(input)
  if (!result.success) throw new Error(`Invalid metadata in ${source ?? `${definition.name}:${id}`}: ${result.error.message}`)
  const data = result.data
  const slug = definition.kind === 'package' ? [definition.package, id === 'index' ? '' : id].filter(Boolean).join('/') : id
  const path = data.path ?? `/${slug}/`
  const label = data.nav === false ? data.title : data.nav.label ?? data.title
  const parent = data.parent ?? (definition.kind === 'package' && id !== 'index' ? 'index' : undefined)
  return {
    key: `${definition.name}:${id}`,
    collection: definition.name,
    id,
    kind: definition.kind,
    ...(definition.package && { package: definition.package }),
    path,
    title: data.title,
    label,
    breadcrumbLabel: label,
    nav: data.nav === false ? false : { ...data.nav, group: definition.kind === 'package' ? 'packages' : data.nav.group },
    source,
    ...(demoSource && { demoSource }),
    exportPath: `${definition.kind === 'component' ? 'components' : 'packages'}/${path.slice(1, -1)}.md`,
    exportContent: 'mdx',
    includeInExports: data.export,
    ...(parent && { parent, parentKey: `${definition.name}:${parent}` }),
  }
}

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return markdownFiles(path)
    return /\.(?:md|mdx)$/.test(entry.name) ? [path] : []
  }))
  return paths.flat().sort()
}

export function findDemoSource(source, files) {
  const isIndex = /[/\\]index\.(?:md|mdx)$/.test(source)
  const demos = files.filter(path => dirname(path) === dirname(source) && path.endsWith('.demo.ts'))
  const ownDemos = demos.filter(path => {
    if (!isIndex) return path === source.replace(/\.(?:md|mdx)$/, '.demo.ts')
    const stem = path.slice(0, -'.demo.ts'.length)
    // A flat subpage owns its matching demo even when it shares an index directory.
    return !files.some(file => file !== source && (file === `${stem}.md` || file === `${stem}.mdx`))
  })
  if (ownDemos.length > 1) throw new Error(`Multiple demo sources for ${source}`)
  return ownDemos[0]
}

async function readCollection(collection, siteRoot) {
  const directory = join(siteRoot, collection.directory)
  const files = await markdownFiles(directory)
  return Promise.all(files.map(async source => {
    const data = parseFrontmatter(await readFile(source, 'utf8'), source)
    const id = collectionEntryId(relative(directory, source))
    const siblings = (await readdir(dirname(source))).map(name => join(dirname(source), name))
    return normalizeCollectionEntry(collection, id, data, {
      source,
      demoSource: findDemoSource(source, siblings),
    })
  }))
}

async function readStandalone(page, siteRoot) {
  const source = join(siteRoot, page.source)
  const raw = await readFile(source, 'utf8')
  const data = /\.(?:md|mdx)$/.test(source) ? parseFrontmatter(raw, source) : page
  return normalizeStandalonePage(page, data, { source })
}

export function normalizeStandalonePage(page, data, { source } = {}) {
  page = standaloneSchema.parse({ ...page, title: data.title })
  const title = data.title
  if (typeof title !== 'string' || !title.trim()) throw new Error(`Missing title in ${source}`)
  const label = page.nav === false ? title : page.nav.label ?? title
  return {
    key: `pages:${page.id}`,
    collection: 'pages',
    id: page.id,
    kind: 'page',
    path: page.path,
    title,
    label,
    breadcrumbLabel: page.breadcrumbLabel ?? label,
    nav: page.nav,
    source,
    exportPath: page.exportPath ?? `${page.id}.md`,
    exportContent: page.exportContent ?? 'mdx',
    includeInExports: page.export !== false,
    exportOrder: page.exportOrder ?? 0,
  }
}

export async function readPageCatalog({ siteRoot = defaultSiteRoot(), standalonePages = STANDALONE_PAGES, collections = COLLECTIONS } = {}) {
  const root = siteRoot instanceof URL ? fileURLToPath(siteRoot) : resolve(siteRoot)
  const [standalone, content] = await Promise.all([
    Promise.all(standalonePages.map(page => readStandalone(page, root))),
    Promise.all(collections.map(collection => readCollection(collection, root))),
  ])
  return validatePageCatalog([...standalone, ...content.flat()])
}

export function validatePageCatalog(pages) {
  const byKey = new Map()
  const routes = new Set()
  const exports = new Set()
  const sources = new Set()
  for (const page of pages) {
    if (byKey.has(page.key)) throw new Error(`Duplicate catalog entry: ${page.key}`)
    if (!/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/.test(page.path)) throw new Error(`Invalid page route: ${page.path}`)
    if (routes.has(page.path)) throw new Error(`Duplicate page route: ${page.path}`)
    if (page.source && sources.has(resolve(page.source))) throw new Error(`Duplicate page source: ${page.source}`)
    if (page.includeInExports && exports.has(page.exportPath)) throw new Error(`Duplicate documentation export: ${page.exportPath}`)
    if (page.nav !== false && !NAV_GROUPS.includes(page.nav.group)) throw new Error(`Unknown navigation group for ${page.key}`)
    byKey.set(page.key, page)
    routes.add(page.path)
    if (page.source) sources.add(resolve(page.source))
    if (page.includeInExports) exports.add(page.exportPath)
  }
  for (const page of pages) {
    const seen = new Set([page.key])
    let current = page
    while (current.parentKey) {
      if (seen.has(current.parentKey)) throw new Error(`Parent cycle for ${page.key}`)
      seen.add(current.parentKey)
      const parent = byKey.get(current.parentKey)
      if (!parent) throw new Error(`Missing parent ${current.parentKey} for ${current.key}`)
      current = parent
    }
  }
  return pages
}

function ordered(pages) {
  const keys = new Set(pages.map(page => page.key))
  const siblings = parentKey => pages.filter(page => (keys.has(page.parentKey) ? page.parentKey : undefined) === parentKey)
    .sort((a, b) => (a.nav?.order ?? 0) - (b.nav?.order ?? 0) || a.key.localeCompare(b.key))
  const visit = parentKey => siblings(parentKey).flatMap(page => [page, ...visit(page.key)])
  return visit(undefined)
}

export function getNavigationGroups(catalog) {
  return NAV_GROUPS.map(id => ({
    id,
    ...(id === 'content' ? { title: 'Components' } : id === 'packages' ? { title: 'Packages' } : {}),
    pages: ordered(catalog.filter(page => page.nav !== false && page.nav.group === id)),
  })).filter(group => group.pages.length)
}

export function getExportGroups(catalog) {
  const pages = catalog.filter(page => page.includeInExports)
  return {
    documentation: pages.filter(page => page.kind === 'page').sort((a, b) => a.exportOrder - b.exportOrder),
    components: COMPONENT_GROUPS.map(group => ordered(pages.filter(page => page.kind === 'component' && (page.nav?.group ?? COMPONENT_GROUPS[0]) === group))),
    packages: ordered(pages.filter(page => page.kind === 'package')),
  }
}
