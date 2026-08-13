import { defineConfig } from 'vite'
import { resolve } from 'node:path'

const dist = resolve(import.meta.dirname, '../../dist')

export default defineConfig({
  root: resolve(import.meta.dirname, 'app'),
  server: { strictPort: true },
  esbuild: { jsxImportSource: 'react' },
  resolve: {
    alias: [
      { find: '@antadesign/anta/jsx-runtime', replacement: `${dist}/jsx-runtime.js` },
      { find: '@antadesign/anta/elements/a-button', replacement: `${dist}/elements/a-button.js` },
      { find: '@antadesign/anta/elements/a-icon.shapes', replacement: `${dist}/elements/a-icon.shapes.js` },
      { find: '@antadesign/anta/tokens.css', replacement: `${dist}/tokens.css` },
      { find: '@antadesign/anta/theme-anta.css', replacement: `${dist}/theme-anta.css` },
      { find: '@antadesign/anta', replacement: `${dist}/index.js` },
    ],
  },
})
