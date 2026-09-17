import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, relative } from 'node:path'
import { getExportGroups, readPageCatalog } from '../site/lib/content/catalog.mjs'
import { llmsGuidance } from '../site/lib/llms/index-content.mjs'
import { renderCatalogPage } from '../site/lib/llms/render-page.mjs'

const docs = new URL('../docs/', import.meta.url)
const onlyIndex = process.argv.indexOf('--only')
const requestedPaths = onlyIndex === -1 ? null : process.argv.slice(onlyIndex + 1)

if (requestedPaths?.length === 0) {
  throw new Error('Pass one or more generated paths after --only')
}

const catalog = await readPageCatalog()
const groups = getExportGroups(catalog)
const exportedPages = [...groups.documentation, ...groups.components.flat(), ...groups.packages]
const changelog = (await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8')).trim()
const sources = Object.fromEntries(await Promise.all(Object.entries({
  tokens: '../src/tokens.css',
  theme: '../src/theme-antune.css',
  stickers: '../stickers/src/generated/index.ts',
  specimen: '../site/src/components/HtmlSpecimen.astro',
}).map(async ([key, path]) => [key, await readFile(new URL(path, import.meta.url), 'utf8')])))

function normalizeRoute(path) {
  if (path === '/') return path
  return `${path.replace(/\/$/, '')}/`
}

const localPaths = new Map(exportedPages.map(page => [page.path, page.exportPath]))

function rewriteSiteLinks(content, currentPath) {
  return content.replace(/\]\((\/[^)\s]*)(\))/g, (match, href, closing) => {
    const [path, hash = ''] = href.split(/(?=#)/)
    const targetPath = localPaths.get(normalizeRoute(path))
    if (!targetPath) return match

    const target = relative(dirname(currentPath), targetPath)
    const localTarget = target.startsWith('.') ? target : `./${target}`
    return `](${localTarget}${hash}${closing}`
  })
}

function renderLinks(pages) {
  return pages.map(page => `- [${page.label}](./${page.exportPath})`).join('\n')
}

const index = `# Anta documentation

${llmsGuidance}

## Documentation

${renderLinks(groups.documentation)}

## Components

${groups.components.map(renderLinks).join('\n\n')}

## Packages

${renderLinks(groups.packages)}
`

const files = [
  { path: 'index.md', content: index },
  ...(await Promise.all(exportedPages.map(async page => ({
    path: page.exportPath,
    content: await renderCatalogPage(page, {
      sources, changelog, format: 'package',
      rewriteLinks: content => rewriteSiteLinks(content, page.exportPath),
    }),
  })))),
]

const filesByPath = new Map(files.map(file => [file.path, file]))
const selectedFiles = requestedPaths
  ? requestedPaths.map((path) => {
      const file = filesByPath.get(path)
      if (!file) throw new Error(`Unknown generated documentation path: ${path}`)
      return file
    })
  : files

if (!requestedPaths) await rm(docs, { recursive: true, force: true })
await mkdir(docs, { recursive: true })
await Promise.all(selectedFiles.map(async ({ path, content }) => {
  const target = new URL(path, docs)
  await mkdir(new URL('.', target), { recursive: true })
  await writeFile(target, `${content.trim().replace(/[ \t]+$/gm, '')}\n`)
}))

console.log(`generated ${selectedFiles.length} Markdown documentation files`)
