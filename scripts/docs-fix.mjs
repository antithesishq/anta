#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const args = process.argv.slice(2)
const root = fileURLToPath(new URL('../', import.meta.url))
let repo = root
let baseRef
let mode = 'prompt'
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--yes') mode = 'apply'
  else if (args[i] === '--check') mode = 'check'
  else if (args[i] === '--base') baseRef = args[++i]
  else if (args[i] === '--repo') repo = resolve(args[++i])
  else if (args[i] === '--help') {
    console.log('Usage: pnpm docs-fix [--check | --yes] [--base <ref>] [--repo <path>]')
    process.exit(0)
  } else throw new Error(`Unknown argument: ${args[i]}`)
}

function git(...command) {
  return execFileSync('git', command, { cwd: repo, encoding: 'utf8' }).trimEnd()
}

if (!baseRef) {
  let main
  for (const candidate of ['origin/main', 'main']) {
    try { git('rev-parse', '--verify', candidate); main = candidate; break } catch {}
  }
  if (!main) throw new Error('Cannot find main. Pass --base <ref>.')
  baseRef = git('merge-base', 'HEAD', main)
}

function baseFile(path) {
  try { return execFileSync('git', ['show', `${baseRef}:${path}`], { cwd: repo, encoding: 'utf8' }) } catch { return undefined }
}

function mdxParts(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw)
  if (!match) return undefined
  const author = /^author:[ \t]*(.+?)[ \t]*$/m.exec(match[1])
  if (!author) return { author: undefined, text: raw }
  const start = match[1].indexOf(author[0]) + match[0].indexOf(match[1])
  const end = start + author[0].length
  const cleaned = raw.slice(0, start) + raw.slice(end).replace(/^\r?\n/, '')
  return { author: author[1], text: cleaned, start, end: end + (raw[end] === '\r' ? 2 : 1) }
}

const authorLine = /^[ \t]*\*[ \t]*@author[ \t]+([^\r\n*]+)[ \t]*(?:\r?\n|$)/m

function tsDocs(raw, path) {
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(path, raw, ts.ScriptTarget.Latest, true, kind)
  const docs = new Map()
  const duplicates = new Set()

  function visit(node, ancestors) {
    const name = ts.isVariableStatement(node)
      ? node.declarationList.declarations.map((declaration) => declaration.name.getText(source)).join(',')
      : node.name?.getText?.(source)
    const segment = name ? `${ts.SyntaxKind[node.kind]}:${name}` : undefined
    const next = segment ? [...ancestors, segment] : ancestors
    for (const [index, doc] of (node.jsDoc ?? []).entries()) {
      const key = `${next.join('/')}:doc${index}`
      if (docs.has(key)) duplicates.add(key)
      const content = raw.slice(doc.getStart(source), doc.end)
      const match = authorLine.exec(content)
      const author = match?.[1].trim()
      const cleaned = match ? content.slice(0, match.index) + content.slice(match.index + match[0].length) : content
      const containingType = ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
      const onlyAuthor = match && /^\/\*\*\s*\*\/$/.test(cleaned)
      const trailingNewline = raw.slice(doc.end).match(/^\r?\n/)?.[0].length ?? 0
      docs.set(key, {
        author, text: cleaned, scopeText: containingType ? node.getText(source) : undefined,
        start: match ? (onlyAuthor ? doc.getStart(source) : doc.getStart(source) + match.index) : undefined,
        end: match ? (onlyAuthor ? doc.end + trailingNewline : doc.getStart(source) + match.index + match[0].length) : undefined,
      })
    }
    ts.forEachChild(node, (child) => visit(child, next))
  }
  visit(source, [])
  for (const key of duplicates) docs.delete(key)
  return docs
}

const statusEntries = execFileSync('git', [
  'diff', '--name-status', '-z', '--find-renames', '--diff-filter=ACMRT',
  baseRef, '--', 'src', 'site/src/content', 'site/src/pages',
], { cwd: repo, encoding: 'utf8' }).split('\0')
const changed = []
for (let index = 0; index < statusEntries.length && statusEntries[index];) {
  const status = statusEntries[index++]
  const previousPath = status[0] === 'R' || status[0] === 'C'
    ? statusEntries[index++] : statusEntries[index]
  const path = statusEntries[index++]
  changed.push({ path, previousPath })
}
const fixes = []
const lineAt = (content, offset) => content.slice(0, offset).split('\n').length

for (const { path, previousPath } of changed) {
  const previous = baseFile(previousPath)
  if (previous === undefined) continue
  const current = await readFile(resolve(repo, path), 'utf8')

  if (path.endsWith('.mdx')) {
    const before = mdxParts(previous)
    const after = mdxParts(current)
    if (before?.author && before.author === after?.author && before.text !== after.text) {
      fixes.push({ path, label: 'page', start: after.start, end: after.end, line: current.slice(after.start, after.end).trim(), lineNumber: lineAt(current, after.start) })
    }
  } else if (/^src\/.*\.tsx?$/.test(path)) {
    const before = tsDocs(previous, path)
    const after = tsDocs(current, path)
    for (const [key, oldDoc] of before) {
      const newDoc = after.get(key)
      if (oldDoc.author && newDoc?.author === oldDoc.author &&
        (oldDoc.text !== newDoc.text || oldDoc.scopeText !== newDoc.scopeText)) {
        fixes.push({ path, label: key, start: newDoc.start, end: newDoc.end, line: current.slice(newDoc.start, newDoc.end).trim(), lineNumber: lineAt(current, newDoc.start) })
      }
    }
  }
}

if (fixes.length === 0) {
  console.log('No stale documentation author markers found.')
  process.exit(0)
}

console.log(`Stale author markers (${fixes.length}):`)
for (const fix of fixes) {
  console.log(`--- a/${fix.path}\n+++ b/${fix.path}\n@@ ${fix.label}, line ${fix.lineNumber} @@\n-${fix.line}`)
}
if (mode === 'check') process.exitCode = 1
else {
  let proceed = mode === 'apply'
  if (mode === 'prompt') {
    if (!process.stdin.isTTY) throw new Error('Interactive confirmation requires a terminal. Use --check to inspect or --yes to apply.')
    const input = createInterface({ input: process.stdin, output: process.stdout })
    proceed = /^y(?:es)?$/i.test((await input.question('Remove these author markers? [y/N] ')).trim())
    input.close()
  }
  if (proceed) {
    for (const path of new Set(fixes.map((fix) => fix.path))) {
      let content = await readFile(resolve(repo, path), 'utf8')
      const edits = fixes.filter((fix) => fix.path === path).sort((a, b) => b.start - a.start)
      for (const edit of edits) content = content.slice(0, edit.start) + content.slice(edit.end)
      await writeFile(resolve(repo, path), content)
    }
    console.log('Author markers removed. Review the git diff before committing.')
  } else console.log('No files changed.')
}
