export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.replace(/\/$/, '') !== '/api/search-answer') {
      return new Response('Not found', { status: 404 })
    }
    if (!env.SEARCH_CHAT) {
      return Response.json({ error: 'AI answer unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
    return env.SEARCH_CHAT.fetch(request)
  },
} satisfies ExportedHandler<Env>
