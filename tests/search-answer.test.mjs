import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { build } from 'esbuild'

let answerSearch, readServerEvents, requestSearchAnswer
before(async () => {
  const result = await build({
    stdin: { contents: `
      export { answerSearch } from './site/lib/search/chat-worker'
      export { readServerEvents } from './site/lib/search/event-stream'
      export { requestSearchAnswer } from './site/lib/search/answer'
    `, resolveDir: process.cwd() }, bundle: true, write: false,
    platform: 'node', format: 'esm', target: 'es2022',
  })
  ;({ answerSearch, readServerEvents, requestSearchAnswer } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`))
})

function request(body = { query: 'How can I customize the palette?' }, options = {}) {
  return new Request('https://anta.design/api/search-answer', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://anta.design' },
    body: JSON.stringify(body), ...options,
  })
}

const encode = text => new TextEncoder().encode(text)
const frame = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
const delta = text => frame('message', { choices: [{ delta: { content: text } }] })
const sources = [{ item: { key: 'https://anta.design/theming/' } }]
function providerStream(content, chunks = sources, done = true) {
  return new ReadableStream({ start(controller) {
    controller.enqueue(encode(frame('chunks', chunks) + delta(content) + (done ? 'data: [DONE]\n\n' : '')))
    controller.close()
  } })
}
async function frames(response) {
  const events = []
  for await (const event of readServerEvents(response.body)) events.push({ event: event.event, data: JSON.parse(event.data) })
  return events
}

test('streams grounded text before generation completes and omits raw chunk metadata', { timeout: 5_000 }, async () => {
  const calls = []
  let upstream
  const env = {
    AI_SEARCH: { chatCompletions: async options => {
      calls.push(options)
      return new ReadableStream({ start(controller) {
        upstream = controller
        controller.enqueue(encode(frame('chunks', [
          { item: { key: 'https://anta.design/theming/#tokens', metadata: { private: 'omit' } } },
          ...sources,
          { item: { key: 'private-metadata' } },
          { item: { key: 'javascript:alert(1)' } },
          { item: { key: 'https://example.com/' } },
          { item: { key: 'https://user:password@anta.design/' } },
        ]) + delta('Use the theme')))
      } })
    } },
  }
  const response = await answerSearch(request({ query: '  How can I customize the palette?  ', messages: ['ignored'] }), env)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store, no-transform')
  const events = readServerEvents(response.body)
  assert.deepEqual(JSON.parse((await events.next()).value.data), { sources: ['https://anta.design/theming/'] })
  assert.deepEqual(JSON.parse((await events.next()).value.data), { text: 'Use the theme' })
  upstream.enqueue(encode(delta(' tokens.') + 'data: [DONE]\n\n'))
  upstream.close()
  assert.deepEqual(JSON.parse((await events.next()).value.data), { text: ' tokens.' })
  assert.equal((await events.next()).value.event, 'done')
  assert.equal((await events.next()).done, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].messages[1].content, 'How can I customize the palette?')
  assert.equal(calls[0].stream, true)
  assert.match(calls[0].messages[0].content, /only the supplied documentation/)
  assert.deepEqual(calls[0].messages.map(message => message.role), ['system', 'user'])
  assert.equal(calls[0].query, undefined)
})

test('rejects invalid or cross-origin requests before calling AI', async () => {
  let calls = 0
  const env = { AI_SEARCH: { chatCompletions: () => { calls++; throw new Error('must not call') } } }
  for (const [input, expected] of [
    [new Request('https://anta.design/api/search-answer'), 405],
    [request({}, { headers: { 'Content-Type': 'text/plain' } }), 415],
    [request({}, { headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' } }), 403],
    [request({}, { headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' } }), 403],
    [request({ query: '' }), 400],
    [request({ query: ' ' }), 400],
    [request({ query: 123 }), 400],
    [request({ query: 'x'.repeat(501) }), 400],
    [request(null), 400],
    [request({}, { body: '{' }), 400],
    [request({ query: 'valid', extra: 'x'.repeat(5_000) }), 400],
  ]) {
    assert.equal((await answerSearch(input, env)).status, expected)
  }
  assert.equal(calls, 0)
})

test('does not return invented examples when Cloudflare provides no documentation sources', async () => {
  const response = await answerSearch(request(), {
    AI_SEARCH: { chatCompletions: async () => providerStream('An ungrounded example from another library.', []) },
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await frames(response), [
    { event: 'delta', data: { text: 'I couldn’t find relevant Anta documentation for this question.' } },
    { event: 'done', data: {} },
  ])
})

test('handles missing configuration, empty answers, and upstream errors without leaking details', async () => {
  assert.equal((await answerSearch(request(), {})).status, 503)
  for (const content of ['', ' ', 'x'.repeat(12_001)]) {
    const response = await answerSearch(request(), {
      AI_SEARCH: { chatCompletions: async () => providerStream(content) },
    })
    assert.equal((await frames(response)).at(-1).event, 'error')
  }
  const response = await answerSearch(request(), {
    AI_SEARCH: { chatCompletions: async () => { throw new Error('sensitive provider detail') } },
  })
  assert.deepEqual(await frames(response), [{ event: 'error', data: { error: 'AI answer unavailable' } }])
})

test('marks a truncated provider response as interrupted', async () => {
  const response = await answerSearch(request(), {
    AI_SEARCH: { chatCompletions: async () => providerStream('Partial answer', sources, false) },
  })
  const events = await frames(response)
  assert.equal(events.at(-2).data.text, 'Partial answer')
  assert.equal(events.at(-1).event, 'error')
  assert.equal(events.some(event => event.event === 'done'), false)
})

test('cancels the provider reader when the browser disconnects', { timeout: 5_000 }, async () => {
  let cancelled = false
  const response = await answerSearch(request(), {
    AI_SEARCH: { chatCompletions: async () => new ReadableStream({
      start(controller) { controller.enqueue(encode(frame('chunks', sources))) },
      cancel() { cancelled = true },
    }) },
  })
  const reader = response.body.getReader()
  await reader.read()
  await reader.cancel()
  assert.equal(cancelled, true)
})

test('the client decodes split UTF-8 and CRLF frames and requires a completion event', async t => {
  const body = frame('sources', { sources: ['https://anta.design/tag/'] })
    + frame('delta', { text: 'Use café ' }) + frame('delta', { text: '🏷️ tags.' }) + frame('done', {})
  const bytes = encode(body.replaceAll('\n', '\r\n'))
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
    controller.close()
  } }), { headers: { 'Content-Type': 'text/event-stream' } }))
  const updates = []
  assert.deepEqual(await requestSearchAnswer('tagging', new AbortController().signal, answer => updates.push(answer)), {
    answer: 'Use café 🏷️ tags.', sources: ['https://anta.design/tag/'],
  })
  assert.deepEqual(updates.map(update => update.answer), ['Use café ', 'Use café 🏷️ tags.'])
  globalThis.fetch.mock.mockImplementation(async () => new Response(frame('delta', { text: 'Incomplete' }), {
    headers: { 'Content-Type': 'text/event-stream' },
  }))
  await assert.rejects(requestSearchAnswer('tagging', new AbortController().signal, () => {}), /interrupted/)
})
