export const AI_QUERY_MAX_LENGTH = 500
export const AI_ANSWER_MAX_LENGTH = 12_000
export const AI_ANSWER_TIMEOUT_MS = 60_000

export type SearchAnswer = { answer: string; sources: string[] }

/** Return only public documentation URLs, without internal chunk metadata. */
export function documentationSources(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const sources = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string' || item.length > 2_048) continue
    try {
      const url = new URL(item)
      if (url.origin !== 'https://anta.design' || url.username || url.password) continue
      sources.add(`${url.origin}${url.pathname}`)
      if (sources.size === 10) break
    } catch { /* Non-URL source keys are not public links. */ }
  }
  return [...sources]
}

export async function requestSearchAnswer(
  query: string,
  signal: AbortSignal,
  onProgress: (answer: SearchAnswer) => void,
): Promise<SearchAnswer> {
  const response = await fetch('/api/search-answer/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  })
  if (!response.ok || !response.body
    || !response.headers.get('Content-Type')?.startsWith('text/event-stream')) {
    throw new Error('AI answer unavailable')
  }
  let answer = ''
  let sources: string[] = []
  for await (const frame of readServerEvents(response.body, signal)) {
    const payload: unknown = JSON.parse(frame.data)
    if (!payload || typeof payload !== 'object') throw new Error('Invalid AI answer')
    if (frame.event === 'error') throw new Error('AI answer interrupted')
    if (frame.event === 'sources') {
      sources = documentationSources('sources' in payload ? payload.sources : undefined)
    } else if (frame.event === 'delta') {
      if (!('text' in payload) || typeof payload.text !== 'string') throw new Error('Invalid AI answer')
      answer += payload.text
      if (answer.length > AI_ANSWER_MAX_LENGTH) throw new Error('AI answer too long')
    } else if (frame.event === 'done') {
      if (!answer.trim()) throw new Error('Empty AI answer')
      return { answer: answer.trim(), sources }
    }
    if (answer.trim()) onProgress({ answer, sources })
  }
  throw new Error('AI answer interrupted')
}
import { readServerEvents } from './event-stream'
