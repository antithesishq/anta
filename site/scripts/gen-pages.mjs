import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

// ─── /index.mdx ←  README.md ──────────────────────────────────────────────
const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8')
const indexBody = readme.replace(/^# .+\n\n/, '') // strip first H1 (package name)
writeFileSync(
  new URL('../src/pages/index.mdx', import.meta.url),
  `---
layout: ../layouts/DocsLayout.astro
title: Overview
---
# Overview

${indexBody}`
)
console.log('Generated src/pages/index.mdx from README.md')

// ─── /changelog/{index,dev,main}.mdx  ←  CHANGELOG.md ─────────────────────
//
// Three filtered views of the same source — All / Dev / Main releases.
// Each gets its own URL (so the tab strip can use real links and browser
// history works), and they all include the same `<ChangelogTabs>`
// component at the top to let the user switch.

const changelog = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8')

// Find the first version heading (`## …`); everything before it is the
// preamble (intro paragraph). We keep the preamble on the All page only.
const versionHeadingRe = /^## /m
const firstHeadingIdx = changelog.search(versionHeadingRe)
const preamble = firstHeadingIdx > -1
  ? changelog.slice(0, firstHeadingIdx).replace(/^# .+\n\n/, '').trim()
  : ''
const versionsBlock = firstHeadingIdx > -1 ? changelog.slice(firstHeadingIdx) : ''

// Split into version chunks. Each chunk starts with `## <version>` and
// runs until the next `## ` or end of file.
const sections = []
const chunkRe = /^## (.+?)(?:\n|\r\n)([\s\S]*?)(?=^## |\Z)/gm
let m
while ((m = chunkRe.exec(versionsBlock + '\n## __end__\n')) !== null) {
  if (m[1] === '__end__') break
  const heading = m[1].trim()
  const body = m[2].trimEnd()
  // Treat a heading containing "-dev." as a dev pre-release.
  const isDev = /-dev\.|^0\.0\./i.test(heading)
  sections.push({ heading, body, isDev })
}

const intro = preamble
  ? preamble + '\n\n'
  : ''

function renderFilteredChangelog(filter) {
  const filtered = sections.filter((s) => {
    if (filter === 'dev')  return s.isDev
    if (filter === 'main') return !s.isDev
    return true
  })
  if (filtered.length === 0) {
    return '_No releases in this stream yet._\n'
  }
  return filtered.map((s) => `## ${s.heading}\n\n${s.body}\n`).join('\n')
}

function pageOf(filter, label) {
  const tabs = `import ChangelogTabs from '../../components/ChangelogTabs.astro'\n\n# Changelog\n\n<ChangelogTabs current="${filter}" />\n\n`
  const introMd = filter === 'all' ? intro : ''
  return `---
layout: ../../layouts/DocsLayout.astro
title: Changelog — ${label}
---
${tabs}${introMd}${renderFilteredChangelog(filter)}`
}

mkdirSync(new URL('../src/pages/changelog/', import.meta.url), { recursive: true })
writeFileSync(
  new URL('../src/pages/changelog/index.mdx', import.meta.url),
  pageOf('all', 'All releases')
)
writeFileSync(
  new URL('../src/pages/changelog/dev.mdx', import.meta.url),
  pageOf('dev', 'Dev releases')
)
writeFileSync(
  new URL('../src/pages/changelog/main.mdx', import.meta.url),
  pageOf('main', 'Main releases')
)
console.log('Generated /changelog/{index,dev,main}.mdx from CHANGELOG.md')
