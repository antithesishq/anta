// Serves the table fixture for manual checks: pnpm --filter @antadesign/table run demo [port]
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

export const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>a-table</title>
<link rel="stylesheet" href="/fixture.css">
<style>
  body { margin: 20px; font: 14px/1.4 system-ui, sans-serif; color: var(--text-1); background: var(--bg-1); }
  #mount { max-width: 1000px; }
</style>
<div id="mount"></div>
<script type="module" src="/fixture.js"></script>
<script type="module">
  addEventListener('load', () => {
    const wait = setInterval(() => {
      if (!window.mountTable) return
      clearInterval(wait)
      const params = new URLSearchParams(location.search)
      if (!params.has('blank')) window.mountTable({ mode: params.get('mode') ?? 'virtual', count: Number(params.get('count') ?? 10000), pins: true })
    }, 10)
  })
</script>`

export async function buildFixture() {
  // ESBUILD_PATH and FIXTURE_NODE_PATH let the fixture build outside a pnpm install.
  const { build } = await import(process.env.ESBUILD_PATH ?? 'esbuild')
  const nodePaths = process.env.FIXTURE_NODE_PATH ? process.env.FIXTURE_NODE_PATH.split(':') : []
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./table.fixture.tsx', import.meta.url))], bundle: true, write: false,
    outdir: 'out', format: 'esm', target: 'es2022', nodePaths, jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    logLevel: 'warning',
  })
  return new Map(result.outputFiles.map(file => [file.path.endsWith('.css') ? '/fixture.css' : '/fixture.js', file.text]))
}

export async function serve(port = 0) {
  const assets = await buildFixture()
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname
    res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(assets.get(path) ?? PAGE)
  })
  await new Promise(done => server.listen(port, '127.0.0.1', done))
  return server
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = await serve(Number(process.argv[2] ?? 4322))
  console.log(`a-table demo: http://127.0.0.1:${server.address().port}/`)
}
