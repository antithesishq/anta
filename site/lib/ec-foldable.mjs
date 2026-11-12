// Expressive-Code plugin: make framed code blocks foldable.
//
// A block is foldable when it has a header bar — i.e. it's a titled
// (`.frame.has-title`) or terminal (`.frame.is-terminal`) frame. The
// `folded` meta flag (```ts title="x" folded```) additionally (a) renders
// the block initially collapsed and (b) forces a header onto an otherwise
// plain block so it becomes foldable too (its label resolves to the passed
// title, else "Terminal" for a terminal frame, else "Code" — handled in
// base.css).
//
// This hook only bakes attributes into the SSR HTML; the fold animation and
// chevron live in base.css, and the click/keyboard toggle lives in the
// docs layout's delegated script. Plain, non-folded blocks are left
// untouched.

/** Depth-first search for the first matching hast element. */
function findElement(node, pred) {
  if (!node || !node.children) return null
  for (const child of node.children) {
    if (child.type === 'element') {
      if (pred(child)) return child
      const found = findElement(child, pred)
      if (found) return found
    }
  }
  return null
}

const classesOf = (el) => [].concat(el?.properties?.className ?? [])

export default function ecFoldable() {
  return {
    name: 'anta-foldable',
    hooks: {
      postprocessRenderedBlock(context) {
        const folded = context.codeBlock.metaOptions.getBoolean('folded') === true
        const root = context.renderData.blockAst

        const frame = classesOf(root).includes('frame')
          ? root
          : findElement(root, (el) => classesOf(el).includes('frame'))
        if (!frame) return

        const frameClasses = classesOf(frame)
        const hasHeaderBar =
          frameClasses.includes('has-title') || frameClasses.includes('is-terminal')

        // Plain block with no `folded` flag → not foldable, leave it alone.
        if (!folded && !hasHeaderBar) return

        if (folded) {
          frame.properties = frame.properties ?? {}
          frame.properties.dataFolded = ''
          // Permanent marker so a folded-authored plain block keeps its
          // header (and stays re-foldable) after the user expands it.
          frame.properties.dataFoldable = ''
        }

        const header = findElement(
          frame,
          (el) => el.tagName === 'figcaption' && classesOf(el).includes('header'),
        )
        if (header) {
          header.properties = header.properties ?? {}
          header.properties.tabIndex = 0
          header.properties.role = 'button'
          header.properties.ariaExpanded = folded ? 'false' : 'true'
          header.properties.ariaLabel = 'Toggle code'
        }
      },
    },
  }
}
