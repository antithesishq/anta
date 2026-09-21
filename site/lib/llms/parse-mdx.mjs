function replaceStringExpressions(source, replace) {
  let output = ''
  let offset = 0
  for (let start = source.indexOf('{'); start !== -1; start = source.indexOf('{', offset)) {
    let depth = 1
    let quote = ''
    let end = start + 1
    for (; end < source.length && depth; end++) {
      const char = source[end]
      if (quote) {
        if (char === '\\') end++
        else if (char === quote) quote = ''
      } else if (char === '"' || char === "'" || char === '`') {
        quote = char
      } else if (char === '/') {
        // Regex literals and comments need a JavaScript parser. Keep the
        // remaining source untouched rather than guessing their boundaries.
        return output + source.slice(offset)
      } else if (char === '{') depth++
      else if (char === '}') depth--
    }
    if (depth) break
    const expression = source.slice(start + 1, end - 1).trim()
    const literal = expression.match(/^(?:"([^"\\\r\n]*)"|'([^'\\\r\n]*)')$/)
    output += source.slice(offset, start)
    output += literal ? replace(literal[1] ?? literal[2]) : source.slice(start, end)
    offset = end
  }
  return output + source.slice(offset)
}

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
  // Preserve plain JSX text literals without evaluating expressions or escapes.
  source = replaceStringExpressions(source, (value) => {
    tables.push(value)
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
