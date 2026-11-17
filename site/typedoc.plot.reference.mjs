import { fileURLToPath } from 'node:url'
import reference from './typedoc.reference.mjs'

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url))

export default {
  ...reference,
  name: '@antadesign/plot',
  entryPoints: [
    path('../plot/src/entries/index.ts'),
    path('../plot/src/entries/browser.ts'),
    path('../plot/src/entries/auto.ts'),
    path('../plot/src/entries/elements/a-plot-surface.ts'),
  ],
  tsconfig: path('../plot/tsconfig.json'),
  out: path('public/plot/reference/'),
}
