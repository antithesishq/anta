import { readFileSync } from 'node:fs'
import type { APIRoute } from 'astro'
import { renderDocumentation } from '../../lib/llms/render-documentation.mjs'
import tokens from '../../../src/tokens.css?raw'
import theme from '../../../src/theme-anta.css?raw'
import stickers from '../../../stickers/src/generated/index.ts?raw'
import specimen from '../components/HtmlSpecimen.astro?raw'
import {
  componentGroups,
  documentationLinks,
  llmsIndex,
  overview,
  packageLinks,
} from '../../lib/llms/index-content.mjs'

type NavigationLink = readonly [title: string, path: string]

const CHANGELOG = readFileSync(new URL('../../../CHANGELOG.md', import.meta.url), 'utf8').trim()

const rawMdx = {
  ...(import.meta.glob('./*.mdx', { eager: true, as: 'raw' }) as Record<string, string>),
  ...(import.meta.glob('./accessibility/*.mdx', { eager: true, as: 'raw' }) as Record<string, string>),
}

const demoModules = import.meta.glob('./*.demo.ts', {
  eager: true,
}) as Record<string, { default: string }>

function modulePath(path: string) {
  return path === '/accessibility/'
    ? './accessibility/index.mdx'
    : `.${path.slice(0, -1)}.mdx`
}

function extractDemoCode(slug: string): string | null {
  const mod = demoModules[`./${slug}.demo.ts`]
  if (!mod?.default) return null
  return mod.default.replace(/^\s*export\s+default\s+`/, '').replace(/`\s*$/, '').trim()
}

function renderMdx(raw: string, title: string, slug?: string) {
  let body = renderDocumentation(raw, { tokens, theme, stickers, specimen })
  body = body.replace(/^# .+$/m, `# ${title}`)
  const demo = slug ? extractDemoCode(slug) : null
  if (demo) body += `\n\n### Example\n\n\`\`\`tsx\n${demo}\n\`\`\``
  return body
}

function documentationBody([title, path]: NavigationLink) {
  if (path === '/') return overview
  if (path === '/changelog/') return CHANGELOG

  const raw = rawMdx[modulePath(path)]
  return raw ? renderMdx(raw, title) : `# ${title}\n\nRead the documentation at https://anta.design${path}`
}

function componentBody([title, path]: NavigationLink) {
  const raw = rawMdx[modulePath(path)]
  if (!raw) return `# ${title}\n\nRead the documentation at https://anta.design${path}`

  const slug = path.slice(1, -1)
  return renderMdx(raw, title, slug)
}

const documentationSections = documentationLinks.map(documentationBody)
const componentSections = componentGroups.flat().map(componentBody)
const packageSections = packageLinks.map(componentBody)

const fullBody = [
  llmsIndex.trim(),
  '---\n\n## Documentation details',
  documentationSections.join('\n\n---\n\n'),
  '---\n\n## Component details',
  componentSections.join('\n\n---\n\n'),
  '---\n\n## Package details',
  packageSections.join('\n\n---\n\n'),
].join('\n\n') + '\n'

export const GET: APIRoute = () =>
  new Response(fullBody, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
