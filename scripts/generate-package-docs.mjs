import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, relative } from 'node:path'
import {
  componentGroups,
  documentationLinks,
  llmsGuidance,
  overview,
  packageLinks,
} from '../site/lib/llms/index-content.mjs'
import { parseMdx } from '../site/lib/llms/parse-mdx.mjs'
import { renderPropsTable } from '../site/lib/llms/props-from-api.mjs'

const pages = new URL('../site/src/pages/', import.meta.url)
const docs = new URL('../docs/', import.meta.url)
const changelog = (await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8')).trim()

function sourcePath(path) {
  return path === '/accessibility/'
    ? './accessibility/index.mdx'
    : `.${path.slice(0, -1)}.mdx`
}

function slug(path) {
  return path.slice(1, -1)
}

function docsPath(path) {
  if (path === '/') return 'overview.md'
  if (path === '/install/') return 'install-config.md'
  return `${slug(path)}.md`
}

function componentDocsPath(path) {
  return `components/${slug(path)}.md`
}

function packageDocsPath(path) {
  return `packages/${slug(path)}.md`
}

function normalizeRoute(path) {
  if (path === '/') return path
  return `${path.replace(/\/$/, '')}/`
}

const localPaths = new Map([
  ...documentationLinks.map(([, path]) => [normalizeRoute(path), docsPath(path)]),
  ...componentGroups.flat().map(([, path]) => [normalizeRoute(path), componentDocsPath(path)]),
  ...packageLinks.map(([, path]) => [normalizeRoute(path), packageDocsPath(path)]),
])

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

function renderLinks(links, pathFor) {
  return links.map(([title, path]) => `- [${title}](./${pathFor(path)})`).join('\n')
}

function extractComponentName(raw) {
  return raw.match(/<PropsTable\s+component="([^"]+)"/)?.[1] ?? null
}

function extractDemoCode(raw) {
  return raw.match(/^\s*export\s+default\s+`([\s\S]*)`\s*$/)?.[1].trim() ?? null
}

async function readPage(path) {
  return readFile(new URL(sourcePath(path), pages), 'utf8')
}

async function readDemo(path) {
  try {
    return extractDemoCode(await readFile(new URL(`./${slug(path)}.demo.ts`, pages), 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function renderPage(title, path, outputPath, includeDemo = false) {
  let raw = await readPage(path)
  const componentName = extractComponentName(raw)
  if (componentName) {
    raw = raw.replace(
      /<PropsTable\s+component="[^"]+"\s*\/>/,
      () => renderPropsTable(componentName),
    )
  }

  let body = rewriteSiteLinks(
    parseMdx(raw).replace(/^# .+$/m, `# ${title}`),
    outputPath,
  )
  if (includeDemo) {
    const demo = await readDemo(path)
    if (demo) body += `\n\n## Example\n\n\`\`\`tsx\n${demo}\n\`\`\``
  }
  return body
}

async function documentationFiles() {
  const files = [{ path: 'overview.md', content: overview }]

  for (const [title, path] of documentationLinks.slice(1)) {
    const content = path === '/changelog/'
      ? changelog
      : await renderPage(title, path, docsPath(path))
    files.push({ path: docsPath(path), content })
  }
  return files
}

async function componentFiles(groups, pathFor) {
  const files = []
  for (const [title, path] of groups.flat()) {
    files.push({
      path: pathFor(path),
      content: await renderPage(title, path, pathFor(path), true),
    })
  }
  return files
}

const index = `# Anta documentation

${llmsGuidance}

## Documentation

${renderLinks(documentationLinks, docsPath)}

## Components

${componentGroups.map((group) => renderLinks(group, componentDocsPath)).join('\n\n')}

## Packages

${renderLinks(packageLinks, packageDocsPath)}
`

const files = [
  { path: 'index.md', content: index },
  ...(await documentationFiles()),
  ...(await componentFiles(componentGroups, componentDocsPath)),
  ...(await componentFiles([packageLinks], packageDocsPath)),
]

await rm(docs, { recursive: true, force: true })
await mkdir(docs, { recursive: true })
await Promise.all(files.map(async ({ path, content }) => {
  const target = new URL(path, docs)
  await mkdir(new URL('.', target), { recursive: true })
  await writeFile(target, `${content.trim().replace(/[ \t]+$/gm, '')}\n`)
}))

console.log(`generated ${files.length} Markdown documentation files`)
