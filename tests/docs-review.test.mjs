import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { addMdxAuthor, addTsDocAuthor, addTypeAuthor } from '../scripts/docs-review.mjs'

const reviewer = fileURLToPath(new URL('../scripts/docs-review.mjs', import.meta.url))

test('docs-review inserts source markers while preserving documentation text', () => {
  const source = '/** Summary. */\nexport function example() {}\n'
  const updated = addTsDocAuthor(source, { start: 0, end: source.indexOf('*/') + 2 }, 'Vlad Korobov')
  assert.match(updated, /\* Summary\.\n \*\n \* @author Vlad Korobov/)
  assert.match(updated, /export function example/)
  assert.throws(() => addTsDocAuthor(updated, { start: 0, end: updated.indexOf('*/') + 2 }, 'Other'), /already has an @author/)

  const multiline = '/**\n * Summary.\n *\n * @param max - Maximum words.\n */\nexport function example(max = 3) {}\n'
  const marked = addTsDocAuthor(multiline, { start: 0, end: multiline.indexOf('*/') + 2 }, 'Vlad Korobov')
  assert.match(marked, / \* @param max - Maximum words\.\n \*\n \* @author Vlad Korobov\n \*\//)

  const page = '---\ntitle: Example\n---\n# Example\nBody.\n'
  assert.equal(addMdxAuthor(page, 'Vlad Korobov'), '---\nauthor: "Vlad Korobov"\ntitle: Example\n---\n# Example\nBody.\n')
  assert.throws(() => addMdxAuthor(addMdxAuthor(page, 'Vlad Korobov'), 'Other'), /already has an author/)

  const props = 'export interface TitleProps {\n  /** Heading level. */ level?: number\n}\n'
  assert.equal(addTypeAuthor(props, 0, 'Vlad Korobov'), '/**\n * @author Vlad Korobov\n */\n' + props)
})

test('docs-review suggests git user.name and refuses noninteractive confirmation', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'anta-docs-review-test-'))
  const path = join(repo, 'src/example.ts')
  try {
    await mkdir(join(repo, 'src'))
    execFileSync('git', ['init', '-q'], { cwd: repo })
    execFileSync('git', ['config', 'user.name', 'Fixture Reviewer'], { cwd: repo })
    const source = '/** Example documentation. */\nexport function example() {}\n'
    await writeFile(path, source)
    const preview = execFileSync(process.execPath, [reviewer, '--repo', repo, 'src/example.ts', 'example', '--dry-run'], { encoding: 'utf8' })
    assert.match(preview, /Proposed marker: @author Fixture Reviewer/)
    await writeFile(path, '/** Title summary. */\nexport const Title = () => null\n')
    const functionPreview = execFileSync(process.execPath, [reviewer, '--repo', repo, 'src/example.ts', 'Title', '--dry-run'], { encoding: 'utf8' })
    assert.match(functionPreview, /Title summary/)
    await writeFile(path, 'export interface TitleProps {\n  /** Heading level. */ level?: number\n}\n')
    const typePreview = execFileSync(process.execPath, [reviewer, '--repo', repo, 'src/example.ts', 'TitleProps', '--dry-run'], { encoding: 'utf8' })
    assert.match(typePreview, /Review the entire TitleProps declaration, including every field comment/)
    assert.match(typePreview, /Heading level/)
    assert.throws(() => execFileSync(process.execPath, [reviewer, '--repo', repo, 'src/example.ts', 'TitleProps'], { stdio: 'pipe' }), /Confirmation requires a terminal/)
    assert.match(await readFile(path, 'utf8'), /^export interface TitleProps/)
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})
