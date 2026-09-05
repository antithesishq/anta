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
  assert.equal(parseMdx(source), '### Props\n\nMain props.\n\n### BoxMeasurement\n\nMeasurement fields.\n\n### BoxContext\n\nContext fields.')
})

test('explicit heading levels tolerate IDs and leave code examples untouched', () => {
  const source = '<Disclosure title="Canvas-related styles" id="canvas" level={3}>\nExample.\n</Disclosure>\n\n```tsx\n<Disclosure title="Example" level={4} />\n```'
  assert.equal(parseMdx(source), '### Canvas-related styles\n\nExample.\n\n```tsx\n<Disclosure title="Example" level={4} />\n```')
})
