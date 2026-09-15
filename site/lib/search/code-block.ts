import { ExpressiveCode, loadShikiTheme, type BundledShikiTheme } from 'expressive-code'
import { h, toHtml } from '@expressive-code/core/hast'
import config from '../expressive-code-config.mjs'

// Load the same renderer as authored docs only when an answer contains code.
const engine = Promise.all(config.themes.map((name) => loadShikiTheme(name as BundledShikiTheme)))
  .then((themes) => new ExpressiveCode({ ...config, themes }))
const baseStyles = engine.then(async (ec) => (
  (await Promise.all([ec.getBaseStyles(), ec.getThemeStyles()])).join('\n')
))
const blocks = new Map<string, Promise<string>>()

export function renderAnswerCode(code: string, language: string): Promise<string> {
  const key = JSON.stringify([code, language])
  let block = blocks.get(key)
  if (!block) {
    block = engine.then((ec) => ec.render({ code, language })).then(async ({ renderedGroupAst, styles }) => {
      // Styles come from the trusted renderer. Keep them with the block so
      // ClientRouter swaps cannot remove the answer's stylesheet from <head>.
      const css = [await baseStyles, ...styles].join('\n')
      renderedGroupAst.children.unshift(h('style', css))
      return toHtml(renderedGroupAst)
    })
    blocks.set(key, block)
    block.catch(() => blocks.delete(key))
    // Reuse completed blocks during streaming without retaining every revision.
    if (blocks.size > 32) blocks.delete(blocks.keys().next().value!)
  }
  return block
}
