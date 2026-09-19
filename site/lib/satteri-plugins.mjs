/** Keep standalone images outside paragraph layout. */
export const unwrapImages = {
  name: 'anta-unwrap-images',
  paragraph(node) {
    const children = node.children.filter((child) => child.type !== 'text' || /\S/.test(child.value))
    if (children.length === 1 && children[0].type === 'image') return children[0]
  },
}

function unwrapJsxParagraph(node, ctx) {
  // Multiline JSX children are parsed as Markdown. A single added paragraph
  // changes component layout and is invalid inside headings and table rows.
  if (node.children.length === 1 && node.children[0].type === 'paragraph') {
    ctx.setProperty(node, 'children', node.children[0].children)
  }
}

export const unwrapJsxParagraphs = {
  name: 'anta-unwrap-jsx-paragraphs',
  mdxJsxFlowElement: unwrapJsxParagraph,
  mdxJsxTextElement: unwrapJsxParagraph,
}

export const headingLinks = {
  name: 'anta-heading-links',
  element: {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    visit(node, ctx) {
      if (!node.properties.id) return
      ctx.setProperty(node, 'children', [{
        type: 'element',
        tagName: 'a',
        properties: {
          className: ['header-anchor', 'muted'],
          href: `#${node.properties.id}`,
        },
        children: node.children,
      }])
    },
  },
}

export const wrapTables = {
  name: 'anta-wrap-tables',
  element: {
    filter: ['table'],
    visit(node, ctx) {
      const parent = ctx.parent(node)
      if (parent?.type === 'element' && parent.tagName === 'div' &&
        parent.properties.className?.includes('table-wrap')) return
      ctx.wrapNode(node, {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-wrap'] },
        children: [],
      })
    },
  },
}
