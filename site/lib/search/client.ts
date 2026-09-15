import searchConfig from './config.json'

export type SearchResult = {
  id: string
  route: string
  anchor: string
  title: string
  heading: string
  text: string
  kind: string
  level: number
}

type SearchHit = {
  id: string
  doc: Omit<SearchResult, 'id'>
}

type SearchIndexPayload = {
  version: number
  chunks: Record<string, string>
}

let indexPromise: Promise<any> | undefined

export function loadSearchIndex() {
  if (indexPromise) return indexPromise

  const load = Promise.all([
    import('flexsearch'),
    fetch('/search-index.json', { cache: 'no-cache' }),
  ]).then(async ([flexsearch, response]) => {
    if (!response.ok) throw new Error(`Search index request failed: ${response.status}`)
    const payload = await response.json() as SearchIndexPayload
    if (payload.version !== searchConfig.version) throw new Error('Search index version mismatch')

    const index = new flexsearch.Document(searchConfig as any)
    for (const [key, chunk] of Object.entries(payload.chunks)) index.import(key, chunk)
    return { index }
  })

  indexPromise = load.catch((error) => {
    indexPromise = undefined
    throw error
  })
  return indexPromise
}

export async function searchDocumentation(query: string, currentPath?: string) {
  const { index } = await loadSearchIndex()
  const route = currentPath == null ? undefined : `${currentPath.split(/[?#]/)[0].replace(/\/+$/, '')}/`

  const searchMatches = async (route?: string): Promise<SearchResult[]> => {
    const matches: SearchResult[] = []
    // Keep heading levels ahead of body copy, and FlexSearch's relevance order
    // within each level. Apply route tags before each result limit.
    for (const searchRank of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'block']) {
      const hits = await index.search({
        query, pluck: 'text', enrich: true, limit: 16 - matches.length,
        tag: route ? { routeRank: `${route}:${searchRank}` } : { searchRank },
      }) as SearchHit[]
      matches.push(...hits.map((hit) => ({ id: hit.id, ...hit.doc })))
      if (matches.length >= 16) break
    }
    return matches
  }

  // Search the current route before limiting results so global matches cannot
  // crowd its matching blocks out of the candidate set.
  const [local, global] = await Promise.all([
    route ? searchMatches(route) : Promise.resolve([]),
    searchMatches(),
  ])
  const seen = new Set<string>()
  return [...local, ...global].filter((result) => {
    if (seen.has(result.id)) return false
    seen.add(result.id)
    return true
  }).slice(0, 16)
}

export async function getSearchResult(id: string) {
  const { index } = await loadSearchIndex()
  const document = index.store?.get(id) as Omit<SearchResult, 'id'> | undefined
  return document ? { id, ...document } : undefined
}
