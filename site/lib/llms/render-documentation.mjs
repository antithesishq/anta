import { parseMdx } from './parse-mdx.mjs'
import { renderPropsTable } from './props-from-api.mjs'
import { renderReference, referenceExpressions } from './reference-content.mjs'

/** Both npm docs and llms-full.txt use the same reference expansion. */
export function renderDocumentation(raw, sources) {
  return parseMdx(raw, {
    renderPropsTable,
    renderComponent: (name) => renderReference(name, sources),
    expressions: referenceExpressions,
  })
}
