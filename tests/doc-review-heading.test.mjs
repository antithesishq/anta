import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addDocReviewMarker, docReviewDescription } from '../site/lib/doc-review-heading.mjs'

test('review markers render inside the first title and attach the tooltip to the heading', () => {
  const source = '<h1 id="title"><a href="#title">Plot <code>Rect</code></a></h1><h1>Another title</h1>'
  const result = addDocReviewMarker(source)
  assert.ok(result.startsWith(`<h1 id="title" data-doc-review-heading tabindex="0" aria-description="${docReviewDescription}">`))
  assert.ok(result.includes('<a href="#title">Plot <code>Rect</code></a> <span class="doc-review-marker" aria-hidden="true" data-no-search>✦</span><a-tooltip'))
  assert.ok(result.endsWith(`${docReviewDescription}</a-tooltip></h1><h1>Another title</h1>`))
  assert.equal(addDocReviewMarker(result), result)
})

test('title decoration preserves islands, scripts, and authored attributes', () => {
  const before = '<script>const sample = "<h1>Example</h1>"</script><astro-island props="&quot;x&quot;"><template><h1>Template</h1></template></astro-island>'
  const heading = '<h1 tabindex="-1" aria-description="Existing description">Actual title</h1>'
  const after = '<pre>&lt;h1&gt;Example&lt;/h1&gt;</pre>'
  const result = addDocReviewMarker(before + heading + after)
  assert.ok(result.startsWith(before + '<h1 tabindex="-1" aria-description="Existing description" data-doc-review-heading>Actual title'))
  assert.ok(result.endsWith(after))
  assert.equal(result.match(/tabindex=/g).length, 1)
})

test('pages without a complete title are unchanged', () => {
  for (const source of ['', '<p>No heading</p>', '<h1>Unclosed title']) {
    assert.equal(addDocReviewMarker(source), source)
  }
})
