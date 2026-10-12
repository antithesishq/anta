import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { checkBrowser } from './browser.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const { values: options } = parseArgs({ options: {
  framework: { type: 'string', default: 'all' }, mode: { type: 'string', default: 'all' },
  'skip-build': { type: 'boolean', default: false }, 'keep-apps': { type: 'boolean', default: false }, help: { type: 'boolean', default: false },
} });
if (options.help) {
  console.log('Usage: pnpm test:consumers [--framework all|nextjs|preact] [--mode all|full|granular]\n       [--skip-build] [--keep-apps]\n\nManual production consumer checks. Next.js uses Turbopack. Reports: tests/consumers/.runs/');
  process.exit(0);
}
for (const [key, allowed] of Object.entries({ framework: ['all', 'nextjs', 'preact'], mode: ['all', 'full', 'granular'] })) {
  assert.ok(allowed.includes(options[key]), `${key} must be ${allowed.join(', ')}`);
}
const cases = [
  { name: 'nextjs-full', framework: 'nextjs', mode: 'full' },
  { name: 'preact-full', framework: 'preact', mode: 'full' },
  { name: 'preact-granular-basic', framework: 'preact', mode: 'granular' },
  { name: 'nextjs-granular', framework: 'nextjs', mode: 'granular' },
  { name: 'preact-granular-composed', framework: 'preact', mode: 'granular', composed: true },
].filter(item => (options.framework === 'all' || options.framework === item.framework) && (options.mode === 'all' || options.mode === item.mode));
const artifacts = join(here, '.runs', new Date().toISOString().replaceAll(':', '-'));
const workspace = await mkdtemp(join(tmpdir(), 'anta-consumers-'));
await mkdir(artifacts, { recursive: true });
const active = new Set();
const summary = { started: new Date().toISOString(), node: process.version, options, workspace, results: [] };

function start(command, args, cwd, log, extraEnv = {}) {
  const stream = createWriteStream(log);
  const child = spawn(command, args, { cwd, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', ...extraEnv }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  active.add(child);
  let output = '';
  for (const pipe of [child.stdout, child.stderr]) pipe.on('data', data => { stream.write(data); output = (output + data).slice(-5000); });
  const completed = new Promise((resolve, reject) => {
    child.on('error', error => { active.delete(child); stream.end(); reject(error); });
    child.on('close', (code, signal) => { active.delete(child); stream.end(); code === 0 ? resolve(output) : reject(new Error(`${command} ${args.join(' ')} exited ${code ?? signal}. Log: ${log}\n${output}`)); });
  });
  // Servers can exit while browser checks run. Keep their rejection handled until cleanup.
  completed.catch(() => {});
  return { child, completed };
}
async function run(command, args, cwd, log, env) { return start(command, args, cwd, log, env).completed; }
async function stop(child) {
  if (!active.has(child)) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already exited. */ }
  await new Promise(resolve => {
    const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} resolve(); }, 3000);
    child.once('close', () => { clearTimeout(timer); resolve(); });
  });
}
async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function waitForServer(origin, child) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (!active.has(child)) throw new Error(`Server exited before ${origin} was ready`);
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1500) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Server not ready: ${origin}`);
}
async function filesIn(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    result.push(...(entry.isDirectory() ? await filesIn(path) : [path]));
  }
  return result;
}
async function checkCss(app, item, reports) {
  const directory = join(app, item.framework === 'nextjs' ? '.next/static' : 'dist');
  const files = (await filesIn(directory)).filter(path => path.endsWith('.css'));
  assert.ok(files.length, 'Production build emits CSS');
  const css = (await Promise.all(files.map(path => readFile(path, 'utf8')))).join('\n');
  const layouts = Object.fromEntries(['a-breadcrumbs', 'a-input-date-time-container', 'a-select-field', 'a-steps'].map(selector => [selector, css.includes(selector)]));
  for (const [selector, present] of Object.entries(layouts)) {
    const expected = item.mode === 'full' || item.composed || (item.framework === 'nextjs' && selector === 'a-steps');
    assert.equal(present, !!expected, `${selector} CSS in ${item.name}`);
  }
  if (layouts['a-select-field']) assert.equal([...css.matchAll(/a-select-field\s*\{/g)].length, 1, 'Shared Select styles are emitted once');
  await writeFile(join(reports, 'css.json'), JSON.stringify({ files: files.map(path => path.slice(app.length + 1)), layouts, bytes: Buffer.byteLength(css) }, null, 2));
  await writeFile(join(reports, 'emitted.css'), css);
  if (item.framework === 'preact') {
    const graph = JSON.parse(await readFile(join(app, 'dist/dependency-graph.json'), 'utf8'));
    await writeFile(join(reports, 'dependency-graph.json'), JSON.stringify(graph, null, 2));
    if (item.mode === 'granular') {
      for (const forbidden of ['/dist/bundle.js', '/dist/bundle.css', '/dist/elements/index.js', '/dist/elements/a-slider.js', '/dist/elements/a-slider.css']) assert.ok(!graph.some(id => id.includes(forbidden)), `No ${forbidden}`);
      const componentCss = graph.filter(id => /\/dist\/components\/.*\.css(?:\?|$)/.test(id));
      assert.equal(componentCss.length, item.composed ? 4 : 0, 'Only explicitly requested composed styles');
    }
  }
}
async function cleanup() {
  await Promise.all([...active].map(stop));
  if (!options['keep-apps']) await rm(workspace, { recursive: true, force: true });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  cleanup().finally(() => process.exit(130));
});

try {
  summary.commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  summary.packageVersion = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
  if (!options['skip-build']) {
    console.log('Building Anta…');
    await run('pnpm', ['run', 'build'], root, join(artifacts, 'package-build.log'));
  }
  await run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', workspace], root, join(artifacts, 'pack.log'));
  const tarballName = (await readdir(workspace)).find(name => name.endsWith('.tgz'));
  assert.ok(tarballName, 'npm pack produced a tarball');
  const tarball = join(workspace, tarballName);
  summary.tarballSha256 = createHash('sha256').update(await readFile(tarball)).digest('hex');
  for (const item of cases) {
    const app = join(workspace, item.name), reports = join(artifacts, item.name);
    await mkdir(reports, { recursive: true });
    const result = { ...item, status: 'running' };
    summary.results.push(result);
    let server;
    console.log(`Checking ${item.name}…`);
    try {
      await cp(join(here, 'templates', item.framework), app, { recursive: true });
      if (item.mode === 'granular') await cp(join(here, 'variants', item.name), app, { recursive: true });
      await cp(tarball, join(app, tarballName));
      await run('npm', ['ci', '--no-audit', '--no-fund'], app, join(reports, 'install-framework.log'));
      await run('npm', ['install', '--no-save', '--package-lock=false', '--no-audit', '--no-fund', `./${tarballName}`], app, join(reports, 'install-anta.log'));
      const installed = JSON.parse(await readFile(join(app, 'node_modules/@antadesign/anta/package.json'), 'utf8'));
      assert.equal(installed.version, summary.packageVersion);
      result.dependencies = JSON.parse(await readFile(join(app, 'package.json'), 'utf8')).dependencies;
      await run('npm', ['ls', '@antadesign/anta', '--json'], app, join(reports, 'dependency-provenance.json'));
      await run('npm', ['run', 'build'], app, join(reports, 'build.log'));
      await checkCss(app, item, reports);
      const port = await freePort(), origin = `http://127.0.0.1:${port}`;
      const args = item.framework === 'nextjs'
        ? ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)]
        : ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'];
      server = start(process.execPath, args, app, join(reports, 'server.log')).child;
      await waitForServer(origin, server);
      await checkBrowser({ ...item, origin, artifacts: reports });
      result.status = 'passed';
      console.log(`PASS ${item.name}`);
    } catch (error) {
      result.status = 'failed'; result.error = error.stack;
      process.exitCode = 1;
      console.error(`FAIL ${item.name}: ${error.message}`);
    } finally { if (server) await stop(server); }
  }
} catch (error) {
  summary.error = error.stack;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  summary.finished = new Date().toISOString();
  await writeFile(join(artifacts, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  await cleanup();
  console.log(`Reports: ${artifacts}`);
  if (options['keep-apps']) console.log(`Apps: ${workspace}`);
}
