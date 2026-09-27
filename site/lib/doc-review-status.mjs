import { Comment, Converter, ReflectionKind } from 'typedoc'

const hasAuthor = (reflection) => reflection?.comment?.blockTags.some((tag) => tag.tag === '@author') ?? false

function isReviewed(reflection) {
  if (hasAuthor(reflection)) return true
  // TypeDoc attaches a function's TSDoc to its signature, while the page title
  // belongs to the enclosing declaration reflection.
  if (reflection.signatures?.length) return reflection.signatures.every(hasAuthor)
  // @param text comes from the signature's TSDoc, not a separate comment.
  if (reflection.kindOf(ReflectionKind.Parameter | ReflectionKind.TypeParameter)) {
    return hasAuthor(reflection.parent)
  }
  return false
}

// The HTML reference has a visible state even when a declaration has no TSDoc.
// This plugin is used only for the reference site; api.json stays source-faithful.
export function load(app) {
  app.converter.on(Converter.EVENT_RESOLVE_END, ({ project }) => {
    for (const reflection of Object.values(project.reflections)) {
      const comment = reflection.comment ??= new Comment()
      if (!isReviewed(reflection)) {
        comment.modifierTags.add('@unreviewed')
      }
    }
  })
}
