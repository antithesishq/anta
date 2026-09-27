#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))

function usage() {
  console.log(`Usage:
  pnpm docs-review src/avatar-core.ts getInitials
  pnpm docs-review site/src/content/components/button/index.mdx

Options:
  --author <name>  Use this name instead of git config user.name
  --dry-run        Show the proposed marker without changing a file
  --repo <path>    Use another checkout (for isolated testing)`)
}

function declarationName(node, source) {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.map((declaration) => declaration.name.getText(source)).join(',')
  }
  return node.name?.getText?.(source)
}

function findComment(content, path, name) {
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, kind)
  const matches = []
  function visit(node) {
    if (declarationName(node, source) === name) {
      for (const doc of node.jsDoc ?? []) matches.push({ start: doc.getStart(source), end: doc.end })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (matches.length !== 1) {
    throw new Error(`Expected one TSDoc comment for ${name} in ${path}; found ${matches.length}.`)
  }
  return matches[0]
}

function validateAuthor(author) {
  if (!author || /[\r\n]|\*\//.test(author)) throw new Error('Author must be a single nonempty name.')
}

export function addTsDocAuthor(content, comment, author) {
  validateAuthor(author)
  const original = content.slice(comment.start, comment.end)
  if (/@author\b/.test(original)) throw new Error('This TSDoc already has an @author tag.')
  const newline = original.includes('\r\n') ? '\r\n' : '\n'
  let replacement
  if (original.includes('\n')) {
    const closing = /(?:\r?\n)([ \t]*)\*\/$/.exec(original)
    if (!closing) throw new Error('Expected a standard multiline TSDoc comment.')
    const beforeClosing = original.slice(0, closing.index + newline.length)
    const indent = closing[1]
    replacement = `${beforeClosing}${indent}*${newline}${indent}* @author ${author}${newline}${indent}*/`
  } else {
    const inline = /^\/\*\*\s*(.*?)\s*\*\/$/.exec(original)
    if (!inline?.[1]) throw new Error('This TSDoc has no text to review.')
    const lineStart = content.lastIndexOf('\n', comment.start - 1) + 1
    const indent = /^[ \t]*/.exec(content.slice(lineStart, comment.start))?.[0] ?? ''
    replacement = `/**${newline}${indent} * ${inline[1]}${newline}${indent} *${newline}${indent} * @author ${author}${newline}${indent} */`
  }
  return content.slice(0, comment.start) + replacement + content.slice(comment.end)
}

export function addMdxAuthor(content, author) {
  validateAuthor(author)
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)
  if (!frontmatter) throw new Error('Expected YAML frontmatter at the start of this MDX page.')
  if (/^author\s*:/m.test(frontmatter[1])) throw new Error('This page already has an author field.')
  const newline = frontmatter[0].includes('\r\n') ? '\r\n' : '\n'
  const marker = `author: ${JSON.stringify(author)}${newline}`
  const openingLength = content.startsWith('---\r\n') ? 5 : 4
  return content.slice(0, openingLength) + marker + content.slice(openingLength)
}

function pageUrl(path) {
  const component = /^site\/src\/content\/components\/([^/]+)\/index\.mdx$/.exec(path)
  const packagePage = /^site\/src\/content\/packages\/([^/]+)\/index\.mdx$/.exec(path)
  const standalone = /^site\/src\/pages\/(.+?)(?:\/index)?\.mdx$/.exec(path)
  const slug = component?.[1] ?? packagePage?.[1] ?? standalone?.[1]
  return slug ? `http://localhost:4323/${slug}/` : undefined
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) { usage(); return }
  const positional = []
  let author
  let dryRun = false
  let repo = root
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--author') {
      author = args[++index]
      if (!author || author.startsWith('--')) throw new Error('--author requires a name.')
    } else if (args[index] === '--dry-run') dryRun = true
    else if (args[index] === '--repo') {
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error('--repo requires a path.')
      repo = resolve(value)
    }
    else if (args[index].startsWith('--')) throw new Error(`Unknown option: ${args[index]}`)
    else positional.push(args[index])
  }
  if (positional.length < 1 || positional.length > 2) { usage(); process.exitCode = 1; return }
  const [target, symbol] = positional
  const path = resolve(repo, target)
  const displayPath = relative(repo, path).replaceAll('\\', '/')
  if (displayPath.startsWith('..') || displayPath === '') throw new Error('Choose a file inside this repository.')
  const content = await readFile(path, 'utf8')
  author ??= execFileSync('git', ['config', 'user.name'], { cwd: repo, encoding: 'utf8' }).trim()
  validateAuthor(author)

  let updated
  let scope
  if (displayPath.endsWith('.mdx')) {
    if (symbol) throw new Error('MDX review is page-level; omit the symbol argument.')
    updated = addMdxAuthor(content, author)
    scope = 'entire page'
    console.log(`Review the complete page at ${displayPath} before confirming.`)
    const url = pageUrl(displayPath)
    if (url) console.log(`Preview: ${url}`)
  } else if (/^src\/.*\.tsx?$/.test(displayPath)) {
    if (!symbol) throw new Error('Give the TSDoc declaration name, such as getInitials.')
    const comment = findComment(content, displayPath, symbol)
    console.log(`TSDoc for ${symbol} in ${displayPath}:\n`)
    console.log(content.slice(comment.start, comment.end))
    updated = addTsDocAuthor(content, comment, author)
    scope = 'entire TSDoc comment'
  } else throw new Error('Choose a source .ts/.tsx file or a docs .mdx page.')

  console.log(`\nProposed marker: ${displayPath.endsWith('.mdx') ? `author: ${JSON.stringify(author)}` : `@author ${author}`}`)
  if (dryRun) return
  if (!process.stdin.isTTY) throw new Error('Confirmation requires a terminal. Use --dry-run to inspect without editing.')
  const input = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await input.question(`Type REVIEWED after you have reviewed the ${scope}: `)
  input.close()
  if (answer.trim() !== 'REVIEWED') { console.log('No files changed.'); return }
  await writeFile(path, updated)
  console.log(`Added ${displayPath.endsWith('.mdx') ? 'author' : '@author'} to ${displayPath}. Review the git diff before committing.`)
}

if (import.meta.main) await main()
