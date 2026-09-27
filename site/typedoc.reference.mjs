import { fileURLToPath } from 'node:url'
import { OptionDefaults } from 'typedoc'

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url))

export default {
  entryPoints: [
    path('../src/index.ts'),
    path('../src/elements/index.ts'),
    path('../src/jsx-runtime.ts'),
    path('../src/general_types.ts'),
    path('../src/anta_helpers.ts'),
  ],
  tsconfig: path('../src/tsconfig.json'),
  out: path('public/reference/'),
  sort: ['source-order'],
  plugin: [path('lib/union-source-order.mjs'), path('lib/doc-review-status.mjs')],
  modifierTags: [...OptionDefaults.modifierTags, '@unreviewed'],
  validation: { notExported: false },
  customCss: path('src/styles/typedoc-reference.css'),
  customJs: path('src/scripts/typedoc-reference.js'),
}
