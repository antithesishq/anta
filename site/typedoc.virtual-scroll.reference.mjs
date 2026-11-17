import { fileURLToPath } from 'node:url'
import reference from './typedoc.reference.mjs'

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url))

export default {
  ...reference,
  name: '@antadesign/virtual-scroll',
  entryPoints: [
    path('../virtual-scroll/src/entries/index.ts'),
    path('../virtual-scroll/src/entries/source.ts'),
    path('../virtual-scroll/src/entries/bundle.ts'),
    path('../virtual-scroll/src/entries/elements/a-virtual-scroll.ts'),
  ],
  tsconfig: path('../virtual-scroll/tsconfig.build.json'),
  out: path('public/virtual-scroll/reference/'),
}
