import { createHash } from 'node:crypto'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'
import { parse, serialize } from 'parse5'
import { Document } from 'flexsearch'
import searchConfig from '../lib/search/config.json' with { type: 'json' }

const outDir = resolve(process.cwd(), 'dist')
const blockNames = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'dt', 'dd', 'blockquote', 'pre', 'td', 'th', 'figcaption'])
const ignoredNames = new Set(['button', 'canvas', 'form', 'nav', 'script', 'style', 'svg', 'template', 'textarea'])

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 10)
}

function classNames(node) {
  return attr(node, 'class')?.split(/\s+/) ?? []
}

function attr(node, name) {
  return node.attrs?.find((item) => item.name === name)?.value
}

function setAttr(node, name, value) {
  const existing = node.attrs?.find((item) => item.name === name)
  if (existing) existing.value = value
  else (node.attrs ??= []).push({ name, value })
}

function isElement(node, name) {
  return node.nodeName === name
}

function findMain(node) {
  if (isElement(node, 'main') && classNames(node).includes('content')) return node
  for (const child of node.childNodes ?? []) {
    const match = findMain(child)
    if (match) return match
  }
}

function textContent(node) {
  if (node.nodeName === '#text') return node.value
  if (ignoredNames.has(node.nodeName)) return ''
  return (node.childNodes ?? []).map(textContent).join('')
}

function routeFor(file) {
  const relativeFile = relative(outDir, file)
  if (relativeFile === 'index.html') return '/'
  if (relativeFile.endsWith(`${sep}index.html`)) {
    return `/${relativeFile.slice(0, -'index.html'.length).split(sep).join('/')}`
  }
  return `/${relativeFile.replace(/\\/g, '/').replace(/\.html$/, '/')}`
}

function compareRoutes(first, second) {
  if (first === second) return 0
  if (first === '/') return -1
  if (second === '/') return 1
  // Do not use the host locale here: the index and its generated search ids
  // need identical ordering on every machine and CI runner.
  return first < second ? -1 : 1
}

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const file = resolve(dir, entry.name)
    if (entry.isDirectory()) files.push(...await htmlFiles(file))
    if (entry.isFile() && entry.name.endsWith('.html')) files.push(file)
  }
  return files
}

function collectBlocks(node, blocks = []) {
  if (ignoredNames.has(node.nodeName)) return blocks
  if (blockNames.has(node.nodeName)) blocks.push(node)
  for (const child of node.childNodes ?? []) collectBlocks(child, blocks)
  return blocks
}

function nearestHeading(block, headings) {
  const blockIndex = block.__searchOrder
  for (let i = headings.length - 1; i >= 0; i--) {
    const heading = headings[i]
    if (heading.__searchOrder < blockIndex && Number(heading.nodeName[1]) <= 6) return heading
  }
}

// Read the rendered routes in one explicit order, then retain their document
// order below. This makes FlexSearch's serialized postings deterministic too.
const files = await htmlFiles(outDir)
files.sort((first, second) => compareRoutes(routeFor(first), routeFor(second)))
const documents = []

for (const file of files) {
  const route = routeFor(file)
  if (route === '/404/' || route === '/500/') continue

  const source = await readFile(file, 'utf8')
  const document = parse(source)
  const main = findMain(document)
  if (!main) continue

  const blocks = collectBlocks(main)
  const headings = blocks.filter((block) => /^h[1-6]$/.test(block.nodeName))
  const title = textContent(headings.find((heading) => heading.nodeName === 'h1') ?? main).replace(/\s+/g, ' ').trim()
  const pageKey = hash(route)

  blocks.forEach((block, index) => {
    block.__searchOrder = index
  })

  for (const [index, block] of blocks.entries()) {
    const text = textContent(block).replace(/\s+/g, ' ').trim()
    if (!text) continue

    const id = `${pageKey}-${index + 1}`
    const anchor = attr(block, 'id') || `search-${id}`
    const heading = /^h[1-6]$/.test(block.nodeName) ? block : nearestHeading(block, headings)

    setAttr(block, 'data-search-id', id)
    setAttr(block, 'id', anchor)
    documents.push({
      id,
      route,
      anchor,
      title,
      heading: textContent(heading ?? block).replace(/\s+/g, ' ').trim(),
      text,
      kind: block.nodeName,
      level: /^h[1-6]$/.test(block.nodeName) ? Number(block.nodeName[1]) : 0,
      // Keep headings in separately queryable tags. The client combines these
      // tag-filtered searches with descending boosts, so a component page
      // title wins over an incidental body-text match on another page.
      searchRank: /^h[1-6]$/.test(block.nodeName) ? block.nodeName : 'block',
    })
  }

  await writeFile(file, serialize(document))
}

const index = new Document(searchConfig)
for (const document of documents) index.add(document)

const chunks = {}
await index.export((key, data) => {
  chunks[key] = data
})

const payload = {
  version: searchConfig.version,
  checksum: hash(JSON.stringify({ documents: documents.length, chunks })),
  documents: documents.length,
  chunks,
}

const serialized = `${JSON.stringify(payload)}\n`
await Promise.all([
  writeFile(resolve(outDir, 'search-index.json'), serialized),
  writeFile(resolve(process.cwd(), 'public/search-index.json'), serialized),
])
const indexStat = await stat(resolve(outDir, 'search-index.json'))
console.log(`Indexed ${documents.length} blocks from ${files.length} pages (${Math.ceil(indexStat.size / 1024)} kB)`)
