import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const requireSite = createRequire(join(root, 'site/package.json'))
const requireRenderer = createRequire(requireSite.resolve('@astrojs/preact'))
const site = JSON.parse(await readFile(join(root, 'site/package.json'), 'utf8'))
const next = JSON.parse(await readFile(join(root, 'tests/consumers/templates/nextjs/package.json'), 'utf8'))
const workspace = await realpath(await mkdtemp(join(tmpdir(), 'anta-plot-consumer-')))

function run(command, args, cwd, env = process.env, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd, env, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit'})
    let output = ''
    child.stdout?.on('data', chunk => { output += chunk })
    child.once('error', reject)
    child.once('close', code => code === 0 ? resolve(output) : reject(new Error(`${command} exited ${code}`)))
  })
}

try {
  // Workspace installation/dev already builds the package; packing must not run
  // its documentation lifecycle again or replace unrelated generated docs.
  const packed = JSON.parse(await run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', workspace], root, process.env, true))
  assert.equal(packed.length, 1)
  const plotPacked = JSON.parse(await run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', workspace], join(root, 'plot'), process.env, true))
  const dependencies = {
    '@antadesign/plot': `file:./${plotPacked[0].filename}`,
    '@antadesign/anta': `file:./${packed[0].filename}`,
    react: next.dependencies.react,
    'react-dom': next.dependencies['react-dom'],
    preact: site.dependencies.preact,
    'preact-render-to-string': requireRenderer('preact-render-to-string/package.json').version,
  }
  await writeFile(join(workspace, 'package.json'), JSON.stringify({name: 'anta-plot-consumer', private: true, type: 'module', dependencies}, null, 2))
  await run('npm', ['install', '--no-audit', '--no-fund'], workspace)
  await writeFile(join(workspace, 'resolve.mjs'), `
    import assert from 'node:assert/strict'
    for (const specifier of ['@antadesign/plot', '@antadesign/plot/browser', '@antadesign/plot/auto', '@antadesign/plot/elements', '@antadesign/plot/elements/a-plot', '@antadesign/plot/elements/a-plot-surface', '@antadesign/plot/plot.css']) {
      assert.ok(import.meta.resolve(specifier).startsWith(new URL('./node_modules/@antadesign/plot/', import.meta.url).href), specifier)
    }
  `)
  await run(process.execPath, ['resolve.mjs'], workspace)
  assert.match(await readFile(join(workspace, 'node_modules/@antadesign/plot/CSP.md'), 'utf8'), /style-src-attr/)
  assert.match(await readFile(join(workspace, 'node_modules/@antadesign/plot/CHANGELOG.md'), 'utf8'), /plot.css/)
  console.log('Checking Plot through installed package exports with React and Preact SSR…')
  await run(process.execPath, ['--test', 'plot/tests/csp.test.mjs'], root, {
    ...process.env, PLOT_CONSUMER_ROOT: workspace,
  })
} finally {
  await rm(workspace, {recursive: true})
}
