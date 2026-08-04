import { readFileSync } from 'node:fs'
import type { APIRoute } from 'astro'
import { renderPropsTable } from '../../lib/llms/props-from-api.ts'
import { parseMdx } from '../../lib/llms/parse-mdx.ts'
import {
  componentGroups,
  documentationLinks,
  llmsIndex,
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

const overview = `# Overview

Anta is Antithesis's design system. It combines global CSS tokens,
framework-agnostic declarative web components, and JSX wrappers for dynamic
state and conditional composition.

Components use an attribute-driven DOM instead of utility-class stacks and
wrapper elements. Web components never mutate their own attributes, so they
work with Worker-driven UIs and other reactive renderers. JSX wrappers provide
the React and Preact integration layer.`

function modulePath(path: string) {
  return path === '/accessibility/'
    ? './accessibility/index.mdx'
    : `.${path.slice(0, -1)}.mdx`
}

function extractComponentName(raw: string): string | null {
  const m = raw.match(/<PropsTable\s+component="([^"]+)"/)
  return m ? m[1] : null
}

function extractDemoCode(slug: string): string | null {
  const mod = demoModules[`./${slug}.demo.ts`]
  if (!mod?.default) return null
  return mod.default.replace(/^\s*export\s+default\s+`/, '').replace(/`\s*$/, '').trim()
}

function renderMdx(raw: string, title: string, slug?: string) {
  const componentName = extractComponentName(raw)
  if (componentName) {
    raw = raw.replace(
      /<PropsTable\s+component="[^"]+"\s*\/>/,
      () => renderPropsTable(componentName),
    )
  }

  let body = parseMdx(raw)
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
