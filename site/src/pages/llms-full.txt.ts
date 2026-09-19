import changelog from '../../../CHANGELOG.md?raw'
import type { APIRoute } from 'astro'
import { getAstroPageCatalog } from '../../lib/content/astro-catalog.mjs'
import { getExportGroups } from '../../lib/content/catalog.mjs'
import { createLlmsIndex } from '../../lib/llms/index-content.mjs'
import { renderCatalogPage } from '../../lib/llms/render-page.mjs'
import tokens from '../../../src/tokens.css?raw'
import theme from '../../../src/theme-antune.css?raw'
import stickers from '../../../stickers/src/generated/index.ts?raw'
import specimen from '../components/HtmlSpecimen.astro?raw'

export const GET: APIRoute = async () => {
  const catalog = await getAstroPageCatalog()
  const groups = getExportGroups(catalog)
  const renderPages = (pages: typeof catalog) => Promise.all(pages.map(page => renderCatalogPage(page, {
    sources: { tokens, theme, stickers, specimen }, changelog,
  })))
  const [documentation, components, packages] = await Promise.all([
    renderPages(groups.documentation),
    renderPages(groups.components.flat()),
    renderPages(groups.packages),
  ])
  const body = [
    createLlmsIndex(catalog).trim(),
    '---\n\n## Documentation details',
    documentation.join('\n\n---\n\n'),
    '---\n\n## Component details',
    components.join('\n\n---\n\n'),
    '---\n\n## Package details',
    packages.join('\n\n---\n\n'),
  ].join('\n\n') + '\n'

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
