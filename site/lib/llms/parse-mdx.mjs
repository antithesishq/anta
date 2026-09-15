/** Transforms raw MDX documentation into regular Markdown. */
export function parseMdx(raw, { renderPropsTable, renderComponent, expressions = {} } = {}) {
  let source = raw

  const codeBlocks = []
  source = source.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match)
    return `\x00CODE${codeBlocks.length - 1}\x00`
  })

  const inlineCode = []
  source = source.replace(/`[^`\n]+`/g, (match) => {
    inlineCode.push(match)
    return `\x00INLINE${inlineCode.length - 1}\x00`
  })

  source = source.replace(/^---\n[\s\S]*?\n---\n/, '')
  source = source.replace(/^import .+\n/gm, '')
  source = source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  source = source.replace(/<Disclosure\s+title="Playground"[^>]*>[\s\S]*?<\/Disclosure>/g, '')
  source = source.replace(/<Playground[\s\S]*?(?:\/>|<\/Playground>)/g, '')
  // Keep section headings and explicit anchors when unfolding disclosures.
  const anchors = []
  source = source.replace(/<Disclosure\s+title="([^"]+)"([^>]*)>/g, (_, title, attributes) => {
    if (/\sanchor=\{false\}/.test(attributes)) return ''
    const level = attributes.match(/\slevel=\{([2-6])\}/)?.[1] ?? '2'
    const id = attributes.match(/\sid="([^"]*)"/)?.[1]
    let anchor = ''
    if (id !== undefined) {
      const slug = id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      anchors.push(`<a id="${slug}"></a>`)
      anchor = `\x00ANCHOR${anchors.length - 1}\x00\n\n`
    }
    return `\n${anchor}${'#'.repeat(Number(level))} ${title}\n`
  })
  source = source.replace(/<Preview[^>]*>[\s\S]*?<\/Preview>/g, '')
  source = source.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  // Render every reference table and protect its Markdown from JSX stripping.
  const tables = []
  if (renderPropsTable) {
    source = source.replace(/<PropsTable\b([^>]*?)\/>/g, (_, attributes) => {
      const component = attributes.match(/\scomponent=(["'])(.*?)\1/)?.[2]
      const label = attributes.match(/\slabel=(["'])(.*?)\1/)?.[2]
      tables.push(component ? renderPropsTable(component, label) : '')
      return `\n\x00TABLE${tables.length - 1}\x00\n`
    })
  }
  // Reference components contribute Markdown; previews and code stay untouched.
  if (renderComponent) {
    source = source.replace(/<([A-Z][A-Za-z0-9]*)\b([^>]*?)\/>/g, (match, name, attributes) => {
      const markdown = renderComponent(name, attributes)
      if (markdown === undefined) return match
      tables.push(markdown)
      return `\n\x00TABLE${tables.length - 1}\x00\n`
    })
  }
  source = source.replace(/\{([A-Za-z_$][A-Za-z0-9_$.]*)\}/g, (match, name) => {
    if (!Object.hasOwn(expressions, name)) return match
    tables.push(String(expressions[name]))
    return `\x00TABLE${tables.length - 1}\x00`
  })
  source = source.replace(/^<\/?(?:Columns|Col)(?:\s[^>]*)?>[ \t]*\n?/gm, '')
  source = source.replace(/^<[A-Z][A-Za-z]*(?:\s[^>]*)?\/>[ \t]*\n?/gm, '')
  source = source.replace(/<\/?[A-Za-z][A-Za-z0-9.-]*(?:\s[^>]*)?>/g, '')
  source = source.replace(/\{[A-Za-z_$][A-Za-z0-9_$.]*\}/g, '')

  source = source.replace(/\x00ANCHOR(\d+)\x00/g, (_, index) => anchors[Number(index)])
  source = source.replace(/\x00TABLE(\d+)\x00/g, (_, index) => tables[Number(index)])
  source = source.replace(/\x00INLINE(\d+)\x00/g, (_, index) => inlineCode[Number(index)])

  source = source.replace(/\x00CODE(\d+)\x00/g, (_, index) => {
    let block = codeBlocks[Number(index)]
    block = block.replace(/^(```\w+)\s+folded\b/m, '$1')
    return block
  })

  return source.replace(/\n{3,}/g, '\n\n').trim()
}
