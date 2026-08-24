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

type SearchGroup = { result?: SearchHit[] }
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
  ]).then(async ([{ Document }, response]) => {
    if (!response.ok) throw new Error(`Search index request failed: ${response.status}`)
    const payload = await response.json() as SearchIndexPayload
    if (payload.version !== searchConfig.version) throw new Error('Search index version mismatch')

    const index = new Document(searchConfig as any)
    for (const [key, chunk] of Object.entries(payload.chunks)) index.import(key, chunk)
    return index
  })

  indexPromise = load.catch((error) => {
    indexPromise = undefined
    throw error
  })
  return indexPromise
}

export async function searchDocumentation(query: string) {
  const index = await loadSearchIndex()
  const groups = await index.search(query, { enrich: true, limit: 16 }) as SearchGroup[]
  const found = new Map<string, SearchResult>()

  for (const group of groups) {
    for (const hit of group.result ?? []) {
      found.set(hit.id, { id: hit.id, ...hit.doc })
    }
  }

  return [...found.values()].slice(0, 16)
}

export async function getSearchResult(id: string) {
  const index = await loadSearchIndex()
  const document = index.store?.get(id) as Omit<SearchResult, 'id'> | undefined
  return document ? { id, ...document } : undefined
}
