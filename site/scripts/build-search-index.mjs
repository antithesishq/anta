import { createHash } from 'node:crypto'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'
import { parse, serialize } from 'parse5'
import { Document } from 'flexsearch'
import searchConfig from '../lib/search/config.json' with { type: 'json' }

const outDir = resolve(process.cwd(), 'dist')
const inlineNames = new Set([
  'a', 'a-tag', 'abbr', 'acronym', 'b', 'bdi', 'bdo', 'big', 'br', 'cite', 'code',
  'data', 'del', 'dfn', 'em', 'i', 'ins', 'kbd', 'label', 'mark', 'q', 'ruby',
  's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'tt', 'u',
  'var', 'wbr',
])
const ignoredNames = new Set([
  'audio', 'button', 'canvas', 'dialog', 'footer', 'form', 'head', 'hr',
  'iframe', 'img', 'input', 'map', 'menu', 'nav', 'noscript', 'object', 'picture',
  'script', 'select', 'style', 'svg', 'template', 'textarea', 'video',
])
const ignoredAntaNames = new Set([
  'a-avatar', 'a-breadcrumbs', 'a-button', 'a-calendar', 'a-checkbox', 'a-copy',
  'a-icon', 'a-input', 'a-input-time', 'a-loader', 'a-menu', 'a-menu-group',
  'a-menu-item', 'a-menu-separator', 'a-progress', 'a-radio', 'a-radio-group',
  'a-select', 'a-slider', 'a-steps', 'a-sticker', 'a-sticker-animated', 'a-switch',
  'a-tab', 'a-toc',
])

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 10)
}

function classNames(node) {
  return attr(node, 'class')?.split(/\s+/) ?? []
}

function attr(node, name) {
  return node.attrs?.find((item) => item.name === name)?.value
}

function isIgnored(node) {
  return ignoredNames.has(node.nodeName)
    || ignoredAntaNames.has(node.nodeName)
    || (node.nodeName === 'a' && attr(node, 'role') === 'button')
    || attr(node, 'data-no-search') !== undefined
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
  if (isIgnored(node)) return ''
  if (node.nodeName === 'br') return ' '
  return (node.childNodes ?? []).map(textContent).join('')
}

function normalizedText(nodes) {
  return nodes.map(textContent).join('').replace(/\s+/g, ' ').trim()
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
  // `data-no-search` excludes the element and its complete subtree.
  if (isIgnored(node)) return blocks

  const inline = []
  const containers = []
  for (const child of node.childNodes ?? []) {
    if (isIgnored(child)) continue
    // Space-only text nodes stay in the inline run: between two adjacent
    // inline elements they are the only word boundary. `normalizedText`
    // collapses them, so a run of them still indexes as nothing.
    if (child.nodeName === '#text' || inlineNames.has(child.nodeName)) {
      inline.push(child)
    } else if (child.childNodes?.length) {
      // Every non-inline element is a container boundary. Its direct inline
      // content becomes a separate result when the traversal reaches it.
      containers.push(child)
    }
  }

  const text = normalizedText(inline)
  if (text) blocks.push({ node, text })
  for (const child of containers) collectBlocks(child, blocks)
  return blocks
}

function nearestHeading(block, headings) {
  const blockIndex = block.__searchOrder
  for (let i = headings.length - 1; i >= 0; i--) {
    const heading = headings[i]
    if (heading.__searchOrder < blockIndex) return heading
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
  const headings = blocks.filter((block) => /^h[1-6]$/.test(block.node.nodeName))
  const title = headings.find((heading) => heading.node.nodeName === 'h1')?.text
    ?? blocks[0]?.text
    ?? ''
  const pageKey = hash(route)

  blocks.forEach((block, index) => {
    block.__searchOrder = index
  })

  for (const [index, block] of blocks.entries()) {
    const { node, text } = block
    const id = `${pageKey}-${index + 1}`
    const anchor = attr(node, 'id') || `search-${id}`
    const heading = /^h[1-6]$/.test(node.nodeName) ? block : nearestHeading(block, headings)

    setAttr(node, 'data-search-id', id)
    setAttr(node, 'id', anchor)
    documents.push({
      id,
      route,
      anchor,
      title,
      heading: (heading ?? block).text,
      text,
      kind: node.nodeName,
      level: /^h[1-6]$/.test(node.nodeName) ? Number(node.nodeName[1]) : 0,
      // Query each heading level globally or within one route. A combined tag
      // keeps both constraints together before FlexSearch limits the matches.
      searchRank: /^h[1-6]$/.test(node.nodeName) ? node.nodeName : 'block',
      routeRank: `${route}:${/^h[1-6]$/.test(node.nodeName) ? node.nodeName : 'block'}`,
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
