export type ServerEvent = { event: string; data: string }

const MAX_EVENT_LENGTH = 512_000

/** Read SSE frames across arbitrary network and UTF-8 boundaries. */
export async function* readServerEvents(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<ServerEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let event = 'message'
  let data: string[] = []
  let size = 0
  const cancel = () => { void reader.cancel(signal?.reason).catch(() => {}) }
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    while (true) {
      signal?.throwIfAborted()
      const next = await reader.read()
      signal?.throwIfAborted()
      if (next.done) return
      buffer += decoder.decode(next.value, { stream: true })
      let end: number
      while ((end = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, end).replace(/\r$/, '')
        buffer = buffer.slice(end + 1)
        size += line.length
        if (size > MAX_EVENT_LENGTH) throw new Error('Event too large')
        if (!line) {
          if (data.length) yield { event, data: data.join('\n') }
          event = 'message'
          data = []
          size = 0
        } else if (line.startsWith('event:')) {
          event = line.slice(6).replace(/^ /, '')
        } else if (line.startsWith('data:')) {
          data.push(line.slice(5).replace(/^ /, ''))
        }
      }
      if (size + buffer.length > MAX_EVENT_LENGTH) throw new Error('Event too large')
    }
  } finally {
    signal?.removeEventListener('abort', cancel)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export function encodeServerEvent(event: string, data: object): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}
