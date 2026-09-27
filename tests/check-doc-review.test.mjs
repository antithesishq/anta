import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const checker = fileURLToPath(new URL('../scripts/check-doc-review.mjs', import.meta.url))

test('CI requires review-docs for new or changed authored documentation and reports each section', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'anta-doc-review-check-'))
  const source = join(repo, 'src/example.ts')
  const page = join(repo, 'site/src/content/components/example/index.mdx')
  const summary = join(repo, 'summary.md')
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
  const check = (base, ...args) => execFileSync(process.execPath,
    [checker, '--repo', repo, '--base', base, ...args],
    { cwd: repo, encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: summary } })

  try {
    await mkdir(join(repo, 'src'), { recursive: true })
    await mkdir(join(repo, 'site/src/content/components/example'), { recursive: true })
    git('init', '-q')
    git('config', 'user.name', 'Fixture')
    git('config', 'user.email', 'fixture@example.test')
    await writeFile(source, '/** Original explanation. */\nexport function example() {}\n')
    await writeFile(page, '---\ntitle: Example\n---\n# Example\nOriginal page.\n')
    git('add', '.')
    git('commit', '-qm', 'Unreviewed baseline')
    const unreviewed = git('rev-parse', 'HEAD')

    await writeFile(source, '/**\n * Reviewed explanation.\n * @author Alice\n */\nexport function example() {}\n')
    await writeFile(page, '---\nauthor: "Alice"\ntitle: Example\n---\n# Example\nOriginal page.\n')
    git('add', '.')
    git('commit', '-qm', 'Review documentation')
    const authored = git('rev-parse', 'HEAD')

    assert.throws(() => check(unreviewed), (error) => {
      assert.equal(error.status, 1)
      assert.match(error.stdout, /New TSDoc author \(Alice\)/)
      assert.match(error.stdout, /New page author \(Alice\)/)
      return true
    })
    assert.match(check(unreviewed, '--review-docs'), /2 new or changed authored documentation section/)
    assert.match(await readFile(summary, 'utf8'), /Current TSDoc:[\s\S]*Reviewed explanation/)

    await writeFile(source, '/**\n * Edited after review.\n * @author Alice\n */\nexport function example() {}\n')
    git('add', '.')
    git('commit', '-qm', 'Edit reviewed documentation')
    assert.throws(() => check(authored), (error) => {
      assert.equal(error.status, 1)
      assert.match(error.stdout, /Authored TSDoc changed \(Alice\)/)
      assert.doesNotMatch(error.stdout, /Authored page changed/)
      return true
    })

    await writeFile(source, '/**\n * Edited after review.\n */\nexport function example() {}\n')
    git('add', '.')
    git('commit', '-qm', 'Remove stale author')
    assert.match(check(authored), /No new or changed authored documentation found/)
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})
