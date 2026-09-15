import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseMdx } from '../site/lib/llms/parse-mdx.mjs'

test('folded secondary references keep headings and content in package Markdown', () => {
  const source = `<Disclosure title="Component props" open>
Main props.
<Disclosure title="BoxMeasurement" level={3}>
Measurement fields.
</Disclosure>
<Disclosure title="BoxContext" level={3}>
Context fields.
</Disclosure>
</Disclosure>`
  assert.equal(parseMdx(source), '## Component props\n\nMain props.\n\n### BoxMeasurement\n\nMeasurement fields.\n\n### BoxContext\n\nContext fields.')
})

test('explicit heading IDs survive conversion and leave code examples untouched', () => {
  const source = '<Disclosure title="Canvas-related styles" id="canvas" level={3}>\nExample.\n</Disclosure>\n\n```tsx\n<Disclosure title="Example" level={4} />\n```'
  assert.equal(parseMdx(source), '<a id="canvas"></a>\n\n### Canvas-related styles\n\nExample.\n\n```tsx\n<Disclosure title="Example" level={4} />\n```')
})

test('explicit IDs use the site slug rules and do not match data attributes', () => {
  assert.equal(parseMdx('<Disclosure title="Styles" level={2} id=" Custom Styles! ">\nText.\n</Disclosure>'), '<a id="custom-styles"></a>\n\n## Styles\n\nText.')
  assert.equal(parseMdx('<Disclosure title="Styles" level={2} data-id="canvas">\nText.\n</Disclosure>'), '## Styles\n\nText.')
})

test('anchored disclosures default to level two and keep explicit levels and IDs', () => {
  for (const title of ['Styling', 'Web Component', 'Component props', 'Component tokens']) {
    assert.equal(parseMdx(`<Disclosure title="${title}">\nText.\n</Disclosure>`), `## ${title}\n\nText.`)
  }
  for (const level of [2, 3, 4, 5, 6]) {
    assert.equal(parseMdx(`<Disclosure title="Styles" level={${level}}>\nText.\n</Disclosure>`), `${'#'.repeat(level)} Styles\n\nText.`)
  }
  assert.equal(parseMdx('<Disclosure title="Styles" id="canvas">\nText.\n</Disclosure>'), '<a id="canvas"></a>\n\n## Styles\n\nText.')
})

test('unanchored wrappers keep content and nested headings without adding a heading', () => {
  const source = '<Disclosure title="Plain label" id="hidden" level={3} anchor={false}>\nText.\n<Disclosure title="Nested">\nContent.\n</Disclosure>\n</Disclosure>'
  assert.equal(parseMdx(source), 'Text.\n\n## Nested\n\nContent.')
  assert.equal(parseMdx('<Disclosure title="Playground" anchor={false}><Playground /></Disclosure>\nText.'), 'Text.')
})
