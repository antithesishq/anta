import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

// ─── /install.mdx ←  README.md ────────────────────────────────────────────
// README.md stays the complete document for npm readers; the site renders its
// reference half ("## Installation" down) at /install/. The pitch paragraphs
// above it stay npm-only — the hand-authored index.mdx owns the site's intro.
const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8')
const installStart = readme.search(/^## Installation$/m)
if (installStart === -1) throw new Error('README.md: "## Installation" heading not found')
writeFileSync(
  new URL('../src/pages/install.mdx', import.meta.url),
  `---
layout: ../layouts/DocsLayout.astro
title: Install & Config
---
# Install & Config

${readme.slice(installStart)}`
)
console.log('Generated src/pages/install.mdx from README.md')

// ─── /changelog/dev/  ←  CHANGELOG.md ─────────────────────────────────────
// The single repo-root CHANGELOG.md is the source of truth (it ships to npm)
// and carries the full per-version detail. The /changelog/dev/ page ("Dev
// releases — all the details") renders it verbatim; the /changelog/ page
// ("Main releases") instead renders a hand-authored, summarised view
// (src/changelog-summary.md) — summaries are editorial and don't map 1:1 to
// the detailed entries, so they're authored, not generated.
//
// We split the file into a shared head (the "# Changelog" h1 + preamble) and
// the version body so both pages can render head → <ChangelogNav> → content,
// putting the release tabs under the intro, above the versions.
const changelog = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8')
const firstH2 = changelog.search(/^## /m)
const clHead = changelog.slice(0, firstH2).trimEnd()
const clBody = changelog.slice(firstH2).trimEnd()

const genDir = new URL('../src/generated/', import.meta.url)
mkdirSync(genDir, { recursive: true })
const writeGen = (file, md) => writeFileSync(new URL(file, genDir), md)

writeGen('changelog-head.md', `${clHead}\n`)
writeGen('changelog-dev.md', `${clBody}\n`)
console.log('Generated src/generated/changelog-{head,dev}.md from CHANGELOG.md')
