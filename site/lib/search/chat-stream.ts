import { AI_ANSWER_MAX_LENGTH, AI_ANSWER_TIMEOUT_MS, documentationSources } from './answer'
import { encodeServerEvent, readServerEvents } from './event-stream'

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

async function* answerEvents(upstream: ReadableStream<Uint8Array>, signal: AbortSignal) {
  let hasSources = false
  let length = 0
  let hasText = false
  for await (const frame of readServerEvents(upstream, signal)) {
    if (frame.data === '[DONE]') {
      if (!hasSources || !hasText) throw new Error('Empty AI answer')
      yield encodeServerEvent('done', {})
      return
    }
    const payload: unknown = JSON.parse(frame.data)
    if (frame.event === 'chunks') {
      if (!Array.isArray(payload)) throw new Error('Invalid source chunks')
      const sources = documentationSources(payload.map((chunk) => (
        record(chunk) && record(chunk.item) ? chunk.item.key : undefined
      )))
      if (!sources.length) {
        yield encodeServerEvent('delta', { text: 'I couldn’t find relevant Anta documentation for this question.' })
        yield encodeServerEvent('done', {})
        return
      }
      hasSources = true
      yield encodeServerEvent('sources', { sources })
      continue
    }
    if (!record(payload) || payload.error || frame.event === 'error') throw new Error('Provider stream error')
    const choice = Array.isArray(payload.choices) ? payload.choices[0] : undefined
    if (!record(choice)) continue
    if (choice.finish_reason && choice.finish_reason !== 'stop') throw new Error('Incomplete AI answer')
    const text = record(choice.delta) ? choice.delta.content : undefined
    if (text == null || text === '') continue
    if (typeof text !== 'string' || !hasSources) throw new Error('Answer without documentation sources')
    length += text.length
    if (length > AI_ANSWER_MAX_LENGTH) throw new Error('AI answer too long')
    hasText ||= Boolean(text.trim())
    yield encodeServerEvent('delta', { text })
  }
  throw new Error('Provider stream ended early')
}

/** Cancel a late binding response as well as an already-open stream. */
async function openStream(start: () => Promise<ReadableStream<Uint8Array>>, signal: AbortSignal) {
  signal.throwIfAborted()
  let abort: () => void = () => {}
  try {
    return await Promise.race([
      start().then(async (stream) => {
        if (signal.aborted) {
          await stream.cancel().catch(() => {})
          signal.throwIfAborted()
        }
        return stream
      }),
      new Promise<never>((_, reject) => {
        abort = () => reject(signal.reason)
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
      }),
    ])
  } finally {
    signal.removeEventListener('abort', abort)
  }
}

export function streamSearchAnswer(start: () => Promise<ReadableStream<Uint8Array>>, requestSignal: AbortSignal): Response {
  const controller = new AbortController()
  const abort = () => controller.abort(requestSignal.reason)
  requestSignal.addEventListener('abort', abort, { once: true })
  if (requestSignal.aborted) abort()
  const timeout = setTimeout(() => controller.abort(new Error('AI answer timeout')), AI_ANSWER_TIMEOUT_MS)
  const cleanup = () => {
    clearTimeout(timeout)
    requestSignal.removeEventListener('abort', abort)
  }
  async function* generate() {
    try {
      const upstream = await openStream(start, controller.signal)
      yield* answerEvents(upstream, controller.signal)
    } catch (error) {
      if (!requestSignal.aborted && !cancelled) {
        console.error(JSON.stringify({
          event: 'search_chat_failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        }))
        yield encodeServerEvent('error', { error: 'AI answer unavailable' })
      }
    } finally {
      cleanup()
    }
  }
  const events = generate()
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({
    async pull(output) {
      const next = await events.next()
      if (cancelled) return
      if (next.done) output.close()
      else output.enqueue(next.value)
    },
    async cancel(reason) {
      cancelled = true
      controller.abort(reason)
      cleanup()
      await events.return(undefined)
    },
  })
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
