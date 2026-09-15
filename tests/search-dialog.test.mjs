import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const requireSite = createRequire(new URL('../site/package.json', import.meta.url))
const { chromium } = requireSite('playwright')
let browser, script, css

before(async () => {
  const result = await build({
    stdin: {
      contents: `
        import { h, render } from 'preact'
        import { configure } from './src/jsx-runtime'
        import SearchDialog from './site/src/components/SearchDialog'
        import './src/elements/index'
        import './site/lib/code-copy'
        configure(h)
        render(h(SearchDialog), document.body)
      `,
      resolveDir: process.cwd(),
    },
    bundle: true, write: false, outfile: 'search.js', format: 'iife', target: 'es2022',
    jsx: 'automatic', jsxImportSource: '@antadesign/anta',
    nodePaths: [resolve('site/node_modules')],
    alias: {
      '@antadesign/anta': resolve('src/index.ts'),
      '@antadesign/anta/jsx-runtime': resolve('src/jsx-runtime.ts'),
      react: requireSite.resolve('preact/compat'),
    },
    plugins: [{
      name: 'controlled-full-text-search',
      setup(build) {
        build.onLoad({ filter: /lib\/search\/client\.ts$/ }, () => ({
          contents: `
            export const loadSearchIndex = async () => { if (window.indexFails) throw Error('index unavailable') }
            export const searchDocumentation = query => window.runFullText(query)
          `,
          loader: 'js',
        }))
      },
    }],
  })
  script = result.outputFiles.find(file => file.path.endsWith('.js')).text
  css = result.outputFiles.find(file => file.path.endsWith('.css')).text
  browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || undefined })
})

after(async () => browser?.close())

function reply(route, { answer, sources = [] }) {
  return route.fulfill({ contentType: 'text/event-stream', body:
    `event: sources\ndata: ${JSON.stringify({ sources })}\n\n`
    + `event: delta\ndata: ${JSON.stringify({ text: answer })}\n\n`
    + 'event: done\ndata: {}\n\n',
  })
}

async function setup(t, respond = async route => reply(route, { answer: 'Use the documented theme tokens.' })) {
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  page.setDefaultTimeout(5_000)
  const requests = []
  await page.route('https://anta.test/', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }))
  await page.route('**/api/search-answer/', async route => {
    requests.push(route.request().postDataJSON())
    await respond(route)
  })
  await page.goto('https://anta.test/')
  await page.addStyleTag({ content: css })
  await page.evaluate(() => {
    window.runFullText = async query => {
      if (query === 'broken') throw Error('search failed')
      if (query !== 'button') return []
      return [{ id: 'button', route: '/button/', anchor: 'button', title: 'Button', heading: 'Button', text: 'Button', kind: 'h1', level: 1 }]
    }
  })
  await page.addScriptTag({ content: script })
  await page.waitForTimeout(100)
  await page.evaluate(() => document.dispatchEvent(new Event('anta-search-open')))
  await page.locator('a-dialog[state="open"]').waitFor()
  const input = page.locator('#docs-search-input').locator('input')
  return { page, input, requests }
}

test('full-text matches and failures never trigger AI', async t => {
  const { page, input, requests } = await setup(t)
  await input.fill('button')
  await page.locator('#docs-search-results a').waitFor()
  await page.waitForTimeout(750)
  assert.equal(requests.length, 0)
  await input.fill('broken')
  await page.getByText('Search is unavailable. Try another query or reload the page.').waitFor()
  await page.waitForTimeout(750)
  assert.equal(requests.length, 0)
})

test('debounces typing, keeps previous matches, and shows activity only in the input', async t => {
  const { page, input, requests } = await setup(t)
  await page.evaluate(() => {
    window.searchCalls = []
    const search = window.runFullText
    window.runFullText = query => { window.searchCalls.push(query); return search(query) }
  })
  await input.fill('bu')
  await page.waitForTimeout(80)
  await input.fill('butt')
  await page.waitForTimeout(80)
  await input.fill('button')
  assert.deepEqual(await page.evaluate(() => window.searchCalls), [])
  await page.locator('#docs-search-input [slot="leading"] a-loader').waitFor()
  assert.equal(await page.locator('#docs-search-results a-loader').count(), 0)
  await page.locator('#docs-search-results a').waitFor()
  assert.deepEqual(await page.evaluate(() => window.searchCalls), ['button'])
  await page.locator('#docs-search-input [slot="leading"] a-icon').waitFor()
  await page.evaluate(() => { window.runFullText = query => {
    window.searchCalls.push(query)
    return new Promise(resolve => { window.finishSearch = resolve })
  } })
  await input.fill('new question')
  await page.locator('#docs-search-input [slot="leading"] a-loader').waitFor()
  assert.equal(await page.locator('#docs-search-results a').count(), 1)
  assert.match(await page.locator('#docs-search-results a').getAttribute('href'), /q=button/)
  await page.waitForFunction(() => Boolean(window.finishSearch))
  await page.evaluate(() => window.finishSearch([]))
  await page.getByRole('button', { name: 'Get answer from AI' }).waitFor()
  await page.locator('#docs-search-input [slot="leading"] a-icon').waitFor()
  assert.equal(requests.length, 0)
  await input.fill('cancel this search')
  await input.fill('')
  await page.waitForTimeout(350)
  assert.deepEqual(await page.evaluate(() => window.searchCalls), ['button', 'new question'])
})

test('renders partial Markdown before completion, retains interrupted text, and cancels on edits', async t => {
  const { page, input } = await setup(t)
  await page.evaluate(() => {
    const fetchOriginal = window.fetch.bind(window)
    window.chatSignals = []
    window.fetch = (url, options) => {
      if (url !== '/api/search-answer/') return fetchOriginal(url, options)
      window.chatSignals.push(options.signal)
      return Promise.resolve(new Response(new ReadableStream({ start(controller) {
        window.chatEvent = (event, data) => controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        options.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')))
      } }), { headers: { 'Content-Type': 'text/event-stream' } }))
    }
  })
  await input.fill('unknown question')
  await page.getByRole('button', { name: 'Get answer from AI' }).click()
  await page.getByText('Preparing an AI answer…').waitFor()
  await page.evaluate(() => {
    window.chatEvent('sources', { sources: ['https://anta.design/tag/'] })
    window.chatEvent('delta', { text: 'Use **Tag**.\n\n```tsx\n<Tag label="Design" />' })
  })
  const answer = page.getByRole('region', { name: 'AI answer' })
  await answer.locator('pre code span[style]').first().waitFor()
  assert.equal(await answer.getAttribute('aria-busy'), 'true')
  assert.equal(await answer.locator('strong').textContent(), 'Tag')
  assert.equal(await page.getByText('Preparing an AI answer…').count(), 0)
  await page.evaluate(() => window.chatEvent('error', { error: 'unavailable' }))
  await page.getByText('The answer was interrupted. Try again.').waitFor()
  assert.match(await answer.textContent(), /Design/)
  await page.getByRole('button', { name: 'Get answer from AI' }).click()
  await page.getByText('Preparing an AI answer…').waitFor()
  await page.evaluate(() => window.chatEvent('delta', { text: 'Second attempt' }))
  await answer.getByText('Second attempt', { exact: true }).waitFor()
  await input.fill('button')
  await page.locator('#docs-search-results a').waitFor()
  assert.equal(await page.evaluate(() => window.chatSignals[1].aborted), true)
  assert.equal(await answer.count(), 0)
})

test('reopening a cancelled answer offers a retry instead of leaving a loader', async t => {
  for (const partial of [false, true]) await t.test(partial ? 'after first text' : 'before first text', async t => {
    const { page, input, requests } = await setup(t)
    await page.evaluate(partial => {
      const originalFetch = window.fetch.bind(window)
      window.fetch = (url, options) => {
        if (url !== '/api/search-answer/') return originalFetch(url, options)
        window.fetch = originalFetch
        window.chatSignal = options.signal
        return Promise.resolve(new Response(new ReadableStream({ start(controller) {
          if (partial) controller.enqueue(new TextEncoder().encode('event: delta\ndata: {"text":"Partial answer"}\n\n'))
          options.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')))
        } }), { headers: { 'Content-Type': 'text/event-stream' } }))
      }
    }, partial)
    await input.fill('a question without full-text matches')
    await page.getByRole('button', { name: 'Get answer from AI' }).click()
    await page.getByText(partial ? 'Partial answer' : 'Preparing an AI answer…', { exact: true }).waitFor()
    await input.press('Escape')
    await page.locator('a-dialog[state="closed"]').waitFor({ state: 'attached' })
    await page.waitForFunction(() => window.chatSignal.aborted)
    await page.evaluate(() => document.dispatchEvent(new Event('anta-search-open')))
    await page.getByRole('button', { name: 'Get answer from AI' }).waitFor()
    assert.equal(await page.getByText('Preparing an AI answer…').count(), 0)
    if (partial) await page.getByText('The answer was interrupted. Try again.').waitFor()
    await page.getByRole('button', { name: 'Get answer from AI' }).click()
    await page.getByText('Use the documented theme tokens.').waitFor()
    assert.equal(requests.length, 1)
  })
})

test('waits for an explicit click after zero matches, returns one safe answer, and reuses it on reopen', async t => {
  const { page, input, requests } = await setup(t, route => reply(route, {
    answer: 'Use **Tag** to label items. See [Tag documentation](https://anta.design/tag/).\n\n'
      + '```tsx\n<Tag label="Design" />\n```\n\n'
      + '| Prop | Value |\n| --- | --- |\n| `label` | Design |\n\n'
      + '- First item\n- Second item\n\n'
      + '<img src=x onerror="alert(1)"><script>alert(1)</script>\n\n'
      + '[Unsafe](javascript:alert%281%29) ![Image](https://example.com/image.png)',
    sources: ['https://anta.design/tag/', 'https://example.com/', 'javascript:alert(1)'],
  }))
  await page.evaluate(() => { window.runFullText = () => new Promise(resolve => { window.finishSearch = resolve }) })
  await input.fill('unknown question')
  await page.waitForTimeout(750)
  assert.equal(requests.length, 0)
  await page.evaluate(() => window.finishSearch([]))
  const tryAI = page.getByRole('button', { name: 'Get answer from AI' })
  await tryAI.waitFor()
  assert.equal(await tryAI.getAttribute('data-selected'), 'true')
  assert.equal(await tryAI.locator('strong').textContent(), 'Get answer from AI')
  assert.equal(await tryAI.getByText('No results for “unknown question”.').count(), 1)
  await page.waitForTimeout(750)
  assert.equal(requests.length, 0, 'Empty results alone must not call Cloudflare')
  // The far edge of the selected row is an action target too.
  const row = await tryAI.boundingBox()
  await tryAI.click({ position: { x: row.width - 4, y: row.height / 2 } })
  const answer = page.getByRole('region', { name: 'AI answer' })
  await answer.waitFor()
  assert.deepEqual(requests, [{ query: 'unknown question' }])
  assert.equal(await answer.locator('img').count(), 0)
  assert.equal(await answer.locator('script').count(), 0)
  assert.equal(await answer.locator('strong').textContent(), 'Tag')
  assert.equal(await answer.locator('pre code').textContent(), '<Tag label="Design" />')
  assert.ok(await answer.locator('pre code span[style]').count(), 'Code uses the site syntax highlighter')
  const token = answer.locator('pre code span[style]').first()
  const lightColor = await token.evaluate(element => getComputedStyle(element).color)
  assert.notEqual(await token.evaluate(element => element.style.getPropertyValue('--0')), '', 'Light mode must receive syntax colors too')
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  assert.notEqual(await token.evaluate(element => getComputedStyle(element).color), lightColor)
  assert.equal(await answer.locator('table').count(), 1)
  assert.equal(await answer.locator('li').count(), 2)
  assert.equal(await answer.getByText('Unsafe', { exact: true }).getAttribute('href'), null)
  assert.equal(await answer.getByRole('link', { name: 'Tag documentation' }).getAttribute('href'), '/tag/')
  assert.equal(await answer.locator('[aria-label="Sources"] a').count(), 1)
  assert.equal(await page.getByText('No results for “unknown question”.').count(), 0)
  assert.equal(await tryAI.count(), 0)
  await input.press('Escape')
  await page.locator('a-dialog[state="closed"]').waitFor({ state: 'attached' })
  await page.evaluate(() => { window.runFullText = async () => []; document.dispatchEvent(new Event('anta-search-open')) })
  await page.locator('a-dialog[state="open"]').waitFor()
  await answer.waitFor()
  await page.waitForTimeout(750)
  assert.equal(requests.length, 1)
  await page.evaluate(() => document.addEventListener('click', event => {
    if (event.target.closest('a[href="/tag/"]')) event.preventDefault()
  }, true))
  await answer.getByRole('link', { name: 'Tag documentation' }).click()
  await page.locator('a-dialog[state="closed"]').waitFor({ state: 'attached' })
})

test('typing cancels an explicitly requested answer and stale responses cannot replace matches', async t => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  const { page, input, requests } = await setup(t, async route => {
    await pending
    await reply(route, { answer: 'Obsolete answer' }).catch(() => {})
  })
  await input.fill('first question')
  await page.getByRole('button', { name: 'Get answer from AI' }).waitFor()
  await input.fill('button')
  await page.locator('#docs-search-results a').waitFor()
  await page.waitForTimeout(750)
  assert.equal(requests.length, 0)
  await input.fill('second question')
  await Promise.all([
    page.waitForRequest('**/api/search-answer/'),
    page.getByRole('button', { name: 'Get answer from AI' }).click(),
  ])
  await page.getByText('Preparing an AI answer…').waitFor()
  assert.equal(await page.getByText('No results for “second question”.').count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Get answer from AI' }).count(), 0)
  await input.fill('button')
  await page.locator('#docs-search-results a').waitFor()
  release()
  await page.waitForTimeout(100)
  assert.equal(await page.getByRole('region', { name: 'AI answer' }).count(), 0)
  await input.fill('third question')
  await page.getByRole('button', { name: 'Get answer from AI' }).waitFor()
  await input.press('Escape')
  await page.waitForTimeout(750)
  assert.equal(requests.length, 1)
})

test('every code example has an Expressive Code frame and copies its exact text', async t => {
  const examples = [
    ['tsx', '<Tag label="Design" />\n<Tag label="Code" />'],
    ['bash', 'pnpm add @antadesign/anta'],
    ['unknown-language', '</style><img src=x onerror="alert(1)">'],
    ['', 'Plain code'],
  ]
  const { page, input } = await setup(t, route => reply(route, {
    answer: examples.map(([lang, code]) => `\`\`\`${lang}\n${code}\n\`\`\``).join('\n\n'),
  }))
  await page.evaluate(() => {
    window.copiedCode = []
    Object.defineProperty(navigator.clipboard, 'writeText', { value: async text => { window.copiedCode.push(text) } })
  })
  await input.fill('code examples')
  await page.getByRole('button', { name: 'Get answer from AI' }).click()
  const answer = page.getByRole('region', { name: 'AI answer' })
  const frames = answer.locator('.expressive-code .frame')
  await frames.nth(3).waitFor()
  assert.equal(await answer.locator('pre').count(), examples.length)
  assert.equal(await answer.locator('img, script').count(), 0)
  for (let index = 0; index < examples.length; index++) {
    const copy = frames.nth(index).getByRole('button', { name: 'Copy to clipboard' })
    await copy.click()
    await page.waitForFunction(count => window.copiedCode.length === count, index + 1)
    assert.equal(await copy.getAttribute('data-anta-copied'), 'true')
  }
  assert.deepEqual(await page.evaluate(() => window.copiedCode), examples.map(([, code]) => code))
  assert.equal(await page.locator('a-dialog[state="open"]').count(), 1)
})

test('Enter requests AI after zero matches and keeps the dialog open without duplicate requests', async t => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  const { page, input, requests } = await setup(t, async route => {
    await pending
    await reply(route, { answer: 'Use the documented testing setup.' })
  })
  await input.fill('testing with bombadil')
  await page.getByText('No results for “testing with bombadil”.').waitFor()
  await input.press('Enter')
  await page.getByText('Preparing an AI answer…').waitFor()
  assert.equal(await page.locator('a-dialog[state="open"]').count(), 1)
  await input.press('Enter')
  assert.deepEqual(requests, [{ query: 'testing with bombadil' }])
  release()
  await page.getByRole('region', { name: 'AI answer' }).getByText('Use the documented testing setup.').waitFor()
  await input.press('Enter')
  await page.waitForTimeout(100)
  assert.equal(requests.length, 1)
  assert.equal(await page.locator('a-dialog[state="open"]').count(), 1)
})

test('Enter during a pending full-text query cannot open a stale result or request AI', async t => {
  const { page, input, requests } = await setup(t)
  await input.fill('button')
  await page.locator('#docs-search-results a').waitFor()
  await page.evaluate(() => { window.runFullText = () => new Promise(() => {}) })
  await input.fill('testing with bombadil')
  await input.press('Enter')
  await page.waitForTimeout(350)
  assert.equal(page.url(), 'https://anta.test/')
  assert.equal(requests.length, 0)
  assert.equal(await page.locator('a-dialog[state="open"]').count(), 1)
  await input.press('Escape')
})

test('keeps the input in the header, scrolls only the dialog body, and caps content at 960px', async t => {
  const { page, input } = await setup(t)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await input.fill('button')
  await page.locator('#docs-search-results a').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Close', exact: true }).count(), 0)
  assert.equal(await page.locator('[slot="header"] #docs-search-input').isVisible(), true)
  await page.getByRole('dialog', { name: 'Search documentation' }).waitFor()
  const dimensions = await page.evaluate(() => {
    const width = selector => document.querySelector(selector).getBoundingClientRect().width
    return {
      input: width('#docs-search-input'),
      body: document.querySelector('#docs-search-results').parentElement.getBoundingClientRect().width,
      scroller: document.querySelector('a-dialog').shadowRoot.querySelector('[part="body"]').getBoundingClientRect().width,
      result: width('#docs-search-results > a'),
    }
  })
  assert.equal(dimensions.input, 960)
  assert.equal(dimensions.body, 960)
  assert.equal(dimensions.result, 920)
  assert.ok(dimensions.scroller > 960)
  await page.evaluate(() => {
    window.runFullText = async () => Array.from({ length: 40 }, (_, i) => ({
      id: String(i), route: '/button/', anchor: 'button', title: `Result ${i}`, heading: `Result ${i}`,
      text: 'Example documentation result', kind: 'h1', level: 1,
    }))
  })
  await input.fill('many results')
  await page.waitForFunction(() => document.querySelectorAll('#docs-search-results > a').length === 40)
  const before = await input.boundingBox()
  const scroll = await page.evaluate(() => {
    const body = document.querySelector('a-dialog').shadowRoot.querySelector('[part="body"]')
    body.scrollTop = 300
    return { top: body.scrollTop, overflow: getComputedStyle(document.querySelector('#docs-search-results')).overflowY }
  })
  assert.equal(scroll.top, 300)
  assert.equal(scroll.overflow, 'visible')
  assert.equal((await input.boundingBox()).y, before.y)
  await page.evaluate(() => { window.runFullText = async () => [] })
  await input.fill('unknown question')
  await page.getByRole('button', { name: 'Get answer from AI' }).click()
  const answer = page.getByRole('region', { name: 'AI answer' })
  await answer.waitFor()
  assert.ok((await answer.boundingBox()).width <= 960)
  assert.deepEqual(await answer.evaluate(element => {
    const style = getComputedStyle(element)
    return [style.padding, style.backgroundColor]
  }), ['0px', 'rgba(0, 0, 0, 0)'])
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok((await page.locator('#docs-search-input').boundingBox()).width <= 390)
  assert.ok((await answer.boundingBox()).width <= 390)
  await page.mouse.click(195, 820)
  await page.locator('a-dialog[state="closed"]').waitFor({ state: 'attached' })
})

test('a failed chat can be retried with the button', async t => {
  let attempt = 0
  const { page, input, requests } = await setup(t, route => {
    attempt++
    return attempt === 1
      ? route.fulfill({ status: 503, json: { error: 'unavailable' } })
      : reply(route, { answer: 'Use a Tag component.' })
  })
  await input.fill('unknown question')
  await page.getByRole('button', { name: 'Get answer from AI' }).click()
  await page.getByText('Couldn’t load an AI answer. Try again.').waitFor()
  assert.equal(await page.getByText('No results for “unknown question”.').count(), 1)
  await page.getByRole('button', { name: 'Get answer from AI' }).click()
  await page.getByRole('region', { name: 'AI answer' }).waitFor()
  assert.equal(requests.length, 2)
})
