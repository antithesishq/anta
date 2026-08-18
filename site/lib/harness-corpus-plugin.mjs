import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const outputRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../tests/.test-output')
const corpusPathPattern = /^\/test-output\/([A-Za-z0-9_.-]+)\/apps\.json$/

export default function harnessCorpusPlugin() {
  return {
    name: 'anta-harness-corpus',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split('?', 1)[0] ?? ''
        const match = pathname.match(corpusPathPattern)
        if (!match) return next()

        let runId = match[1]
        if (runId === 'latest') {
          runId = fs.existsSync(outputRoot)
            ? fs.readdirSync(outputRoot, { withFileTypes: true })
              .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name) && fs.existsSync(path.join(outputRoot, entry.name, 'apps.json')))
              .map((entry) => entry.name)
              .sort()
              .at(-1) ?? ''
            : ''
        }
        const corpusPath = path.join(outputRoot, runId, 'apps.json')
        if (!runId || !fs.existsSync(corpusPath)) {
          response.statusCode = 404
          response.end('Generated corpus not found')
          return
        }

        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(corpusPath).pipe(response)
      })
    },
  }
}
