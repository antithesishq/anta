import { parseFragment } from 'parse5'

export const docReviewDescription = 'Documentation has not yet been reviewed by a human.'

function findHeading(node) {
  if (node.tagName === 'h1') return node
  for (const child of node.childNodes ?? []) {
    const heading = findHeading(child)
    if (heading) return heading
  }
}

export function addDocReviewMarker(html) {
  const heading = findHeading(parseFragment(html, { sourceCodeLocationInfo: true }))
  const location = heading?.sourceCodeLocation
  if (!location?.endTag || heading.attrs.some(attr => attr.name === 'data-doc-review-heading')) return html

  let attributes = ' data-doc-review-heading'
  if (!heading.attrs.some(attr => attr.name === 'tabindex')) attributes += ' tabindex="0"'
  if (!heading.attrs.some(attr => attr.name === 'aria-description')) {
    attributes += ` aria-description="${docReviewDescription}"`
  }
  const marker = ' <span class="doc-review-marker" aria-hidden="true" data-no-search>✦</span>'
  const tooltip = `<a-tooltip follow placement="top" data-no-search>${docReviewDescription}</a-tooltip>`

  // Source offsets keep authored markup, islands, and scripts byte-for-byte intact.
  return html.slice(0, location.startTag.endOffset - 1) + attributes + '>'
    + html.slice(location.startTag.endOffset, location.endTag.startOffset)
    + marker + tooltip + html.slice(location.endTag.startOffset)
}
