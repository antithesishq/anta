import { Comment, Converter, ReflectionKind } from 'typedoc'

const hasAuthor = (reflection) => reflection?.comment?.blockTags.some((tag) => tag.tag === '@author') ?? false

function reviewedByContainingType(reflection) {
  if (!reflection.kindOf(ReflectionKind.Property) || reflection.inheritedFrom || reflection.flags.isInherited) return false
  const parent = reflection.parent
  return parent?.kindOf(ReflectionKind.Interface | ReflectionKind.TypeAlias) && hasAuthor(parent)
}

function hasText(comment) {
  if (!comment) return false
  const text = (parts) => parts?.some((part) => part.text?.trim()) ?? false
  return text(comment.summary) || comment.blockTags.some((tag) =>
    tag.tag !== '@author' && tag.tag !== '@privateRemarks' && text(tag.content))
}

// TypeDoc puts function comments on signatures and @param text on parameters.
// Their enclosing declaration gets one marker for that whole TSDoc comment.
// Bare declarations and generated parameter reflections get no marker.
// This plugin is used only for the reference site; api.json stays source-faithful.
export function load(app) {
  app.converter.on(Converter.EVENT_RESOLVE_END, ({ project }) => {
    for (const reflection of Object.values(project.reflections)) {
      if (reflection.kindOf(ReflectionKind.SomeSignature | ReflectionKind.Parameter | ReflectionKind.TypeParameter)) continue
      const documentedSignatures = reflection.signatures?.filter((signature) =>
        hasText(signature.comment) || signature.parameters?.some((parameter) => hasText(parameter.comment))) ?? []
      const hasDocumentation = hasText(reflection.comment) || documentedSignatures.length > 0
      if (!hasDocumentation) continue
      const reviewed = hasAuthor(reflection) || reviewedByContainingType(reflection) ||
        (documentedSignatures.length > 0 && documentedSignatures.every(hasAuthor))
      if (!reviewed) (reflection.comment ??= new Comment()).modifierTags.add('@unreviewed')
    }
  })
}
