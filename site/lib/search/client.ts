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

function resultPriority(result: SearchResult) {
  return /^h[1-6]$/.test(result.kind) ? result.level : 7
}

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
    return { index, Resolver: flexsearch.Resolver }
  })

  indexPromise = load.catch((error) => {
    indexPromise = undefined
    throw error
  })
  return indexPromise
}

export async function searchDocumentation(query: string) {
  const { index, Resolver } = await loadSearchIndex()
  const search = { index, field: 'text', query }

  // FlexSearch ranks matches by relevance inside each tag. Combine those
  // result sets with descending boosts, matching the old documentation
  // search: page titles first, then progressively deeper headings, then copy.
  const results = new Resolver(search)
    .and({ tag: { searchRank: 'h1' } }).limit(16).boost(8)
    .or({ ...search, tag: { searchRank: 'h2' } }).limit(16).boost(6)
    .or({ ...search, tag: { searchRank: 'h3' } }).limit(16).boost(5)
    .or({ ...search, tag: { searchRank: 'h4' } }).limit(16).boost(4)
    .or({ ...search, tag: { searchRank: 'h5' } }).limit(16).boost(3)
    .or({ ...search, tag: { searchRank: 'h6' } }).limit(16).boost(2)
    .or({ ...search, tag: { searchRank: 'block' } }).limit(16).boost(1)

  const hits = await results.resolve({ enrich: true, limit: 16 }) as SearchHit[]
  return hits
    .map((hit) => ({ id: hit.id, ...hit.doc }))
    // Resolver boosts retain relevance inside each heading level. Keep that
    // ordering stable, while ensuring incidental table cells and paragraphs
    // cannot displace a matching section heading.
    .sort((first, second) => resultPriority(first) - resultPriority(second))
}

export async function getSearchResult(id: string) {
  const { index } = await loadSearchIndex()
  const document = index.store?.get(id) as Omit<SearchResult, 'id'> | undefined
  return document ? { id, ...document } : undefined
}
