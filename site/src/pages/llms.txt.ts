import type { APIRoute } from 'astro'
import { COMPONENT_SLUGS } from '../../lib/component-slugs'

const SITE = 'https://anta.design'

// Component pages now live at the site root alongside Colors/Changelog/etc.,
// so glob every root `.mdx` and keep only the component slugs.
const componentModules = import.meta.glob('./*.mdx', { eager: true }) as Record<
  string,
  { frontmatter: { title?: string } }
>

const componentLinks = Object.entries(componentModules)
  .map(([path, mod]) => [path.replace('./', '').replace('.mdx', ''), mod] as const)
  .filter(([slug]) => COMPONENT_SLUGS.includes(slug))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([slug, mod]) => {
    const title = mod.frontmatter?.title ?? slug.charAt(0).toUpperCase() + slug.slice(1)
    return `- [${title}](${SITE}/${slug}/)`
  })

const otherLinks = [
  `- [Install & Config](${SITE}/install/)`,
  `- [Colors](${SITE}/colors/)`,
  `- [Normalization](${SITE}/normalization/)`,
  `- [Changelog](${SITE}/changelog/)`,
]

const body = `# Anta

> Portable React/Preact UI component library. Works out of the box in React,
> in Preact via compat aliasing, and in custom runtimes via \`configure()\`.
> Published as \`@antadesign/anta\` on npm.

Every component forwards \`className\` and \`style\` to its rendered root element. Put layout and positioning — grid/flex placement, margins, width, alignment — directly on the component (\`<Button className="toolbar-end" />\`). Prefer not to wrap it in a \`<div>\`/\`<span>\`. Extra wrappers fight the clean DOM Anta is designed for. Refer to each component's documentation page to learn about configuration, customization, and styling.

## Components

${componentLinks.join('\n')}

## Other pages

${otherLinks.join('\n')}
`

export const GET: APIRoute = () =>
  new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
