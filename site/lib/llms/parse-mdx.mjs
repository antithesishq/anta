/** Transforms raw MDX documentation into regular Markdown. */
export function parseMdx(raw) {
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
  source = source.replace(
    /<Disclosure\s+title="Component tokens"[^>]*>([\s\S]*?)<\/Disclosure>/g,
    (_, inner) => `### Component tokens\n\n${inner.trim()}`,
  )
  source = source.replace(
    /<Disclosure\s+title="Component props"[^>]*>([\s\S]*?)<\/Disclosure>/g,
    (_, inner) => `### Props\n\n${inner.trim()}`,
  )
  source = source.replace(/<Disclosure[^>]*>([\s\S]*?)<\/Disclosure>/g, (_, inner) => inner.trim())
  source = source.replace(/<Preview[^>]*>[\s\S]*?<\/Preview>/g, '')
  source = source.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  source = source.replace(/^<\/?(?:Columns|Col)(?:\s[^>]*)?>[ \t]*\n?/gm, '')
  source = source.replace(/^<[A-Z][A-Za-z]*(?:\s[^>]*)?\/>[ \t]*\n?/gm, '')
  source = source.replace(/<\/?[A-Za-z][A-Za-z0-9.-]*(?:\s[^>]*)?>/g, '')
  source = source.replace(/\{[A-Za-z_$][A-Za-z0-9_$.]*\}/g, '')

  source = source.replace(/\x00INLINE(\d+)\x00/g, (_, index) => inlineCode[Number(index)])

  source = source.replace(/\x00CODE(\d+)\x00/g, (_, index) => {
    let block = codeBlocks[Number(index)]
    block = block.replace(/^(```\w+)\s+folded\b/m, '$1')
    return block
  })

  return source.replace(/\n{3,}/g, '\n\n').trim()
}
