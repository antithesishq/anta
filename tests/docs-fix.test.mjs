import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const fixer = fileURLToPath(new URL('../scripts/docs-fix.mjs', import.meta.url))

test('docs-fix removes only stale author markers', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'anta-docs-fix-test-'))
  const source = join(repo, 'src/example.ts')
  const page = join(repo, 'site/src/pages/example.mdx')
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
  const fix = (...args) => execFileSync(process.execPath, [fixer, '--repo', repo, '--base', 'HEAD', ...args], { encoding: 'utf8' })

  try {
    await mkdir(join(repo, 'src'), { recursive: true })
    await mkdir(join(repo, 'site/src/pages'), { recursive: true })
    git('init', '-q')
    await writeFile(source, [
      '/** Reviewed function.',
      ' * @author Alice',
      ' */',
      'export function changed() { return 1 }',
      '',
      '/** Unchanged documentation.',
      ' * @author Bob',
      ' */',
      'export function codeOnly() { return 1 }',
      '',
    ].join('\n'))
    await writeFile(page, '---\ntitle: Example\nauthor: Alice\n---\n# Example\nOriginal documentation.\n')
    git('add', '.')
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'Reviewed baseline')

    await writeFile(source, (await readFile(source, 'utf8'))
      .replace('Reviewed function.', 'Updated function documentation.')
      .replace('codeOnly() { return 1 }', 'codeOnly() { return 2 }'))
    await writeFile(page, (await readFile(page, 'utf8')).replace('Original documentation.', 'Updated documentation.'))

    assert.throws(() => fix('--check'), (error) => {
      assert.match(error.stdout.toString(), /Stale author markers \(2\)/)
      return error.status === 1
    })
    assert.match(await readFile(source, 'utf8'), /@author Alice/)
    assert.match(await readFile(page, 'utf8'), /author: Alice/)

    fix('--yes')
    const finalSource = await readFile(source, 'utf8')
    const finalPage = await readFile(page, 'utf8')
    assert.doesNotMatch(finalSource, /@author Alice/)
    assert.doesNotMatch(finalPage, /author: Alice/)
    assert.match(finalSource, /@author Bob/)
    assert.match(finalSource, /Updated function documentation/)
    assert.match(finalSource, /codeOnly\(\) \{ return 2 \}/)
    assert.match(finalPage, /Updated documentation/)
    assert.match(fix('--check'), /No stale documentation author markers found/)
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})
