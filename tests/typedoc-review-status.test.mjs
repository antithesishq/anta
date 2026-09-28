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
  const json = join(dir, 'api.json')

  try {
    await writeFile(fixture, [
      '/** Reviewed copy.\n * @author Vlad\n */',
      'export function reviewed(value: string) { return value }',
      '/** Draft copy. */',
      'export function draft(value: string) { return value }',
      'export function bare(value: string) { return value }',
      '/** @param value Documented input. */',
      'export function paramOnly(value: string) { return value }',
      '/** Shared props. */',
      'export interface BaseProps {',
      '  /** Defined on the base type. */ inherited?: string',
      '}',
      '/** Reviewed with its own fields.\n * @author Vlad\n */',
      'export interface ReviewedProps extends BaseProps {',
      '  /** Covered by the type review. */ local?: string',
      '}',
      '/** Draft type. */',
      'export interface DraftProps {',
      '  /** Still unreviewed. */ local?: string',
      '}',
      '/** Reviewed alias with its fields.\n * @author Vlad\n */',
      'export type AliasProps = {',
      '  /** Covered by the alias review. */ local?: string',
      '}',
      '/**\n * @author Vlad\n */',
      'export interface MarkerOnlyProps {',
      '  /** Covered without a parent summary. */ local?: string',
      '}',
      '',
    ].join('\n'))
    await writeFile(tsconfig, JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'ESNext' }, files: [fixture],
    }))
    await writeFile(options, [
      "import { OptionDefaults } from 'typedoc'",
      `export default { entryPoints: [${JSON.stringify(fixture)}], tsconfig: ${JSON.stringify(tsconfig)}, out: ${JSON.stringify(out)}, json: ${JSON.stringify(json)}, plugin: [${JSON.stringify(plugin)}], modifierTags: [...OptionDefaults.modifierTags, '@unreviewed'], readme: 'none' }`,
    ].join('\n'))

    execFileSync(join(site, 'node_modules/.bin/typedoc'), ['--options', options], { cwd: site, stdio: 'pipe' })
    for (const [name, expected] of [['reviewed', 0], ['draft', 1], ['bare', 0], ['paramOnly', 1]]) {
      const html = await readFile(join(out, 'functions', `${name}.html`), 'utf8')
      assert.equal((html.match(/>Unreviewed</g) ?? []).length, expected, name)
    }
    const api = JSON.parse(await readFile(json, 'utf8'))
    const declaration = (name) => api.children.find((child) => child.name === name)
    const property = (type, name) => declaration(type).children.find((child) => child.name === name)
    const unreviewed = (node) => node.comment?.modifierTags?.includes('@unreviewed') ?? false
    assert.equal(unreviewed(property('ReviewedProps', 'local')), false)
    assert.equal(unreviewed(property('ReviewedProps', 'inherited')), true)
    assert.equal(unreviewed(property('DraftProps', 'local')), true)
    assert.equal(unreviewed(property('AliasProps', 'local')), false)
    assert.equal(unreviewed(property('MarkerOnlyProps', 'local')), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
