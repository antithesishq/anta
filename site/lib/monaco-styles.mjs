import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)

// Monaco's export map exposes JavaScript entries but omits its CSS asset.
export const monacoStyleAliases = {
  'monaco-editor/min/vs/editor/editor.main.css': fileURLToPath(
    new URL('editor/editor.main.css', pathToFileURL(require.resolve('monaco-editor'))),
  ),
}
