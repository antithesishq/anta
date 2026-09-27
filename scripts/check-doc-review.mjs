#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { appendFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const args = process.argv.slice(2)
const root = fileURLToPath(new URL('../', import.meta.url))
let repo = root
let base
let reviewed = false

for (let index = 0; index < args.length; index++) {
  if (args[index] === '--base') base = args[++index]
  else if (args[index] === '--repo') repo = resolve(args[++index])
  else if (args[index] === '--review-docs') reviewed = true
  else throw new Error(`Unknown argument: ${args[index]}`)
}
if (!base) throw new Error('Usage: node scripts/check-doc-review.mjs --base <git-ref> [--review-docs] [--repo <path>]')

function git(...command) {
  return execFileSync('git', command, { cwd: repo, encoding: 'utf8' })
}

function beforeFile(path) {
  try { return git('show', `${base}:${path}`) } catch { return undefined }
}

const lineAt = (content, offset) => content.slice(0, offset).split('\n').length
const authorLine = /^[ \t]*\*[ \t]*@author[ \t]+([^\r\n*]+)[ \t]*(?:\r?\n|$)/m

function tsDocs(content, path) {
  if (!content) return new Map()
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, kind)
  const docs = new Map()

  function visit(node, ancestors) {
    const name = ts.isVariableStatement(node)
      ? node.declarationList.declarations.map((declaration) => declaration.name.getText(source)).join(',')
      : node.name?.getText?.(source)
    const segment = name ? `${ts.SyntaxKind[node.kind]}:${name}` : undefined
    const next = segment ? [...ancestors, segment] : ancestors
    for (const [index, doc] of (node.jsDoc ?? []).entries()) {
      const key = `${next.join('/')}:doc${index}`
      const original = content.slice(doc.getStart(source), doc.end)
      const match = authorLine.exec(original)
      const author = match?.[1].trim()
      const text = match ? original.slice(0, match.index) + original.slice(match.index + match[0].length) : original
      const entries = docs.get(key) ?? []
      entries.push({ author, text, original, line: lineAt(content, doc.getStart(source)), name: name ?? key })
      docs.set(key, entries)
    }
    ts.forEachChild(node, (child) => visit(child, next))
  }
  visit(source, [])
  return docs
}

function mdxPage(content) {
  if (!content) return undefined
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)
  if (!frontmatter) return undefined
  const marker = /^author:[ \t]*(.+?)[ \t]*$/m.exec(frontmatter[1])
  if (!marker) return { text: content }
  const start = frontmatter[0].indexOf(marker[0])
  const author = marker[1].replace(/^['"]|['"]$/g, '')
  return {
    author,
    text: content.slice(0, start) + content.slice(start + marker[0].length).replace(/^\r?\n/, ''),
    line: lineAt(content, start),
  }
}

const entries = git('diff', '--name-status', '-z', '--find-renames', '--diff-filter=ACMRT', base, 'HEAD', '--', 'src', 'site/src/content', 'site/src/pages').split('\0')
const findings = []
for (let index = 0; index < entries.length && entries[index];) {
  const status = entries[index++]
  const previousPath = status[0] === 'R' || status[0] === 'C' ? entries[index++] : entries[index]
  const path = entries[index++]
  const current = await readFile(resolve(repo, path), 'utf8')
  const previous = beforeFile(previousPath)

  if (path.endsWith('.mdx')) {
    const oldPage = mdxPage(previous)
    const newPage = mdxPage(current)
    if (newPage?.author && (newPage.author !== oldPage?.author || newPage.text !== oldPage.text)) {
      const kind = !oldPage?.author ? 'new' : newPage.author !== oldPage.author ? 'changed-author' : 'stale'
      findings.push({ path, line: newPage.line, name: 'Entire page', author: newPage.author,
        kind, reason: kind === 'new' ? 'New page author' : kind === 'changed-author' ? 'Page author changed' : 'Authored page changed' })
    }
  } else if (/^src\/.*\.tsx?$/.test(path)) {
    const oldDocs = tsDocs(previous, previousPath)
    const newDocs = tsDocs(current, path)
    for (const [key, docs] of newDocs) {
      const old = oldDocs.get(key) ?? []
      for (const [position, doc] of docs.entries()) {
        if (!doc.author) continue
        const earlier = old[position]
        if (doc.author === earlier?.author && doc.text === earlier.text) continue
        const kind = !earlier?.author ? 'new' : doc.author !== earlier.author ? 'changed-author' : 'stale'
        findings.push({ path, line: doc.line, name: doc.name, author: doc.author,
          kind, reason: kind === 'new' ? 'New TSDoc author' : kind === 'changed-author' ? 'TSDoc author changed' : 'Authored TSDoc changed',
          previous: earlier?.original, current: doc.original })
      }
    }
  }
}

const escapeCommand = (value) => String(value).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
const escapeMarkdown = (value) => String(value).replaceAll('|', '\\|').replaceAll('`', '\\`')
function resolution(finding) {
  if (finding.kind === 'stale') {
    return 'Run pnpm docs-fix --check, then pnpm docs-fix locally or comment /docs-fix on the PR to remove this stale author. A human can instead review the final text and apply review-docs.'
  }
  const marker = finding.path.endsWith('.mdx') ? 'author field' : '@author tag'
  return `Remove this ${finding.kind === 'new' ? 'new' : 'changed'} ${marker} manually if the final text was not human-reviewed; docs-fix does not remove it. Otherwise ask a human to review the final text and apply review-docs.`
}
const summary = ['## Documentation author review', '']
if (findings.length === 0) {
  console.log('No new or changed authored documentation found.')
  summary.push('No new or changed authored documentation found.', '')
} else {
  console.log(`${findings.length} new or changed authored documentation section(s):`)
  summary.push('| Location | Section | Author | Change |', '| --- | --- | --- | --- |')
  for (const finding of findings) {
    console.log(`${finding.path}:${finding.line} ${finding.name}: ${finding.reason} (${finding.author})`)
    if (!reviewed) console.log(`  ${resolution(finding)}`)
    const title = reviewed ? 'Review authored documentation' : 'review-docs label required'
    const command = reviewed ? 'notice' : 'error'
    const message = `${finding.name}: ${finding.reason} (${finding.author}).${reviewed ? '' : ` ${resolution(finding)}`}`
    console.log(`::${command} file=${escapeCommand(finding.path)},line=${finding.line},title=${title}::${escapeCommand(message)}`)
    summary.push(`| ${escapeMarkdown(`${finding.path}:${finding.line}`)} | ${escapeMarkdown(finding.name)} | ${escapeMarkdown(finding.author)} | ${finding.reason} |`)
  }
  summary.push('')
  for (const finding of findings) {
    if (!finding.current) continue
    summary.push(`<details><summary>${escapeMarkdown(`${finding.path}:${finding.line} ${finding.name}`)}</summary>`, '')
    if (finding.previous) summary.push('Previous TSDoc:', '', '```ts', finding.previous, '```', '')
    summary.push('Current TSDoc:', '', '```ts', finding.current, '```', '', '</details>', '')
  }
  if (reviewed) {
    summary.push('The `review-docs` label is present. Review every section above before approving the PR.', '')
  } else {
    summary.push('### How to resolve', '')
    summary.push('- If a human reviewed the final text, ask them to apply the `review-docs` label and inspect these sections in the PR diff.')
    if (findings.some((finding) => finding.kind === 'stale')) {
      summary.push('- For an existing author kept after documentation changed, run `pnpm docs-fix --check`, then `pnpm docs-fix` locally or comment `/docs-fix` on the PR to remove it.')
    }
    if (findings.some((finding) => finding.kind !== 'stale')) {
      summary.push('- Remove newly added or changed author markers manually if they were not human-reviewed. `docs-fix` does not remove these markers.')
    }
    summary.push('')
  }
}
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`)
if (findings.length > 0 && !reviewed) process.exitCode = 1
