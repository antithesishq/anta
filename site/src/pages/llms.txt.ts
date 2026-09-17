import type { APIRoute } from 'astro'
import { getAstroPageCatalog } from '../../lib/content/astro-catalog.mjs'
import { createLlmsIndex } from '../../lib/llms/index-content.mjs'

export const GET: APIRoute = async () =>
  new Response(createLlmsIndex(await getAstroPageCatalog()), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
