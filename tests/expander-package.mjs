import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const requireSite = createRequire(join(root, 'site/package.json'))
const requireRenderer = createRequire(requireSite.resolve('@astrojs/preact'))
const site = JSON.parse(await readFile(join(root, 'site/package.json'), 'utf8'))
const next = JSON.parse(await readFile(join(root, 'tests/consumers/templates/nextjs/package.json'), 'utf8'))
const workspace = await realpath(await mkdtemp(join(tmpdir(), 'anta-expander-consumer-')))

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
  const dependencies = {
    '@antadesign/anta': `file:./${packed[0].filename}`,
    react: next.dependencies.react,
    'react-dom': next.dependencies['react-dom'],
    preact: site.dependencies.preact,
    'preact-render-to-string': requireRenderer('preact-render-to-string/package.json').version,
  }
  await writeFile(join(workspace, 'package.json'), JSON.stringify({name: 'anta-expander-consumer', private: true, type: 'module', dependencies}, null, 2))
  await run('npm', ['install', '--no-audit', '--no-fund'], workspace)
  const requireConsumer = createRequire(join(workspace, 'package.json'))
  for (const specifier of ['@antadesign/anta', '@antadesign/anta/jsx-runtime', '@antadesign/anta/bundle', '@antadesign/anta/bundle.css',
    '@antadesign/anta/elements', '@antadesign/anta/elements/a-expander', '@antadesign/anta/elements/a-expander.css',
    '@antadesign/anta/elements/a-button', '@antadesign/anta/elements/a-icon']) {
    assert.ok(requireConsumer.resolve(specifier).startsWith(join(workspace, 'node_modules/@antadesign/anta/')), specifier)
  }
  console.log('Checking Expander through installed package exports with React and Preact SSR…')
  await run(process.execPath, ['--test', 'tests/expander-csp.mjs'], root, {
    ...process.env, ANTA_EXPANDER_CONSUMER_ROOT: workspace, ANTA_EXPANDER_PACKAGE_ROOT: '',
  })
} finally {
  await rm(workspace, {recursive: true})
}
