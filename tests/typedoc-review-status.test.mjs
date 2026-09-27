import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const site = fileURLToPath(new URL('../site/', import.meta.url))
const plugin = fileURLToPath(new URL('../site/lib/doc-review-status.mjs', import.meta.url))

test('TypeDoc marks documented declarations once and leaves bare declarations alone', async () => {
  await mkdir(join(site, '.cache'), { recursive: true })
  const dir = await mkdtemp(join(site, '.cache/typedoc-status-test-'))
  const fixture = join(dir, 'fixture.ts')
  const tsconfig = join(dir, 'tsconfig.json')
  const options = join(dir, 'typedoc.config.mjs')
  const out = join(dir, 'html')

  try {
    await writeFile(fixture, [
      '/** Reviewed copy.\n * @author Vlad\n */',
      'export function reviewed(value: string) { return value }',
      '/** Draft copy. */',
      'export function draft(value: string) { return value }',
      'export function bare(value: string) { return value }',
      '/** @param value Documented input. */',
      'export function paramOnly(value: string) { return value }',
      '',
    ].join('\n'))
    await writeFile(tsconfig, JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'ESNext' }, files: [fixture],
    }))
    await writeFile(options, [
      "import { OptionDefaults } from 'typedoc'",
      `export default { entryPoints: [${JSON.stringify(fixture)}], tsconfig: ${JSON.stringify(tsconfig)}, out: ${JSON.stringify(out)}, plugin: [${JSON.stringify(plugin)}], modifierTags: [...OptionDefaults.modifierTags, '@unreviewed'], readme: 'none' }`,
    ].join('\n'))

    execFileSync('pnpm', ['exec', 'typedoc', '--options', options], { cwd: site, stdio: 'pipe' })
    for (const [name, expected] of [['reviewed', 0], ['draft', 1], ['bare', 0], ['paramOnly', 1]]) {
      const html = await readFile(join(out, 'functions', `${name}.html`), 'utf8')
      assert.equal((html.match(/>Unreviewed</g) ?? []).length, expected, name)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
