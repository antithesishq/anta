import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

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
