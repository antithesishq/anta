// Serves the virtual scroll fixture with controls for manual testing:
//   pnpm --filter @antadesign/virtual-scroll run demo [port]
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

export const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>a-virtual-scroll</title>
<link rel="stylesheet" href="/fixture.css">
<style>
  body { margin: 20px; font: 14px/1.4 system-ui, sans-serif; color: var(--text-1); background: var(--bg-1); }
  .controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
  #mount { max-width: 900px; }
  .demo-row { padding: 2px 6px; white-space: pre-wrap; overflow-wrap: break-word; min-height: 22px; box-sizing: border-box; border-bottom: 1px solid color-mix(in oklch, currentColor 6%, transparent); }
  .demo-row:nth-child(odd) { background: color-mix(in oklch, currentColor 2%, transparent); }
  .demo-row.fixed { height: 22px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .demo-row.wide { display: flex; width: ${120 + 8 * 260}px; padding: 0; white-space: nowrap; }
  .demo-row .pinned { position: sticky; left: 0; translate: var(--virtual-scroll-x, 0px) 0; z-index: 1; flex: none; width: 120px; background: var(--bg-2); padding: 2px 6px; box-sizing: border-box; }
  .demo-row .cell { flex: none; width: 260px; padding: 2px 6px; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box; }
  mark.match { background: hsl(55deg 100% 80%); }
  mark.match.active { background: hsl(25deg 100% 60%); }
  a-virtual-scroll:not(:state(scrolling)) .demo-row:hover { background: hsla(252, 82%, 71%, 0.05); }
</style>
<div class="controls">
  <label>rows <input id="count" type="number" value="100000" style="width:7em"></label>
  <label>worker delay ms <input id="delay" type="number" value="16" style="width:4em"></label>
  <label><input id="follow" type="checkbox"> follow</label>
  <label><input id="wide" type="checkbox"> wide table</label>
  <button id="mountBtn">mount</button>
  <button id="streamBtn">stream</button>
  <button id="prev">prev match</button>
  <button id="next">next match</button>
  <label><input id="dark" type="checkbox"> dark</label>
</div>
<div id="mount"></div>
<script type="module" src="/fixture.js"></script>
<script type="module">
  const $ = id => document.getElementById(id)
  let streaming = false
  const mount = () => window.mountList({
    count: Number($('count').value), delay: Number($('delay').value),
    follow: $('follow').checked, wide: $('wide').checked,
  })
  addEventListener('load', () => {
    const wait = setInterval(() => {
      if (!window.mountList) return
      clearInterval(wait)
      if (!new URLSearchParams(location.search).has('blank')) mount()
    }, 10)
  })
  $('mountBtn').onclick = mount
  $('delay').onchange = () => window.setDelay(Number($('delay').value))
  $('streamBtn').onclick = () => { streaming = !streaming; window.stream(streaming); $('streamBtn').textContent = streaming ? 'stop' : 'stream' }
  $('prev').onclick = () => window.revealMatch(-1)
  $('next').onclick = () => window.revealMatch(1)
  $('dark').onchange = () => document.documentElement.classList.toggle('dark', $('dark').checked)
</script>`

export async function buildFixture() {
  // ESBUILD_PATH and FIXTURE_NODE_PATH let the fixture build outside a pnpm install.
  const { build } = await import(process.env.ESBUILD_PATH ?? 'esbuild')
  const nodePaths = process.env.FIXTURE_NODE_PATH ? [process.env.FIXTURE_NODE_PATH] : []
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./element.fixture.ts', import.meta.url))], bundle: true, write: false,
    outfile: 'fixture.js', format: 'esm', target: 'es2022', nodePaths,
    // Elements import the JSX runtime through shared helpers; nothing here renders JSX.
    alias: { react: fileURLToPath(new URL('./react-stub.mjs', import.meta.url)) },
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
  const server = await serve(Number(process.argv[2] ?? 4321))
  console.log(`a-virtual-scroll demo: http://127.0.0.1:${server.address().port}/`)
}
