import { readFileSync, writeFileSync } from 'node:fs'

// Generate index.mdx from README.md
const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8')

// Strip the first H1 line (package name) — the site has its own title
const body = readme.replace(/^# .+\n\n/, '')

const frontmatter = `---
layout: ../layouts/DocsLayout.astro
title: Overview
---
`

writeFileSync(
  new URL('../src/pages/index.mdx', import.meta.url),
  frontmatter + body
)

console.log('Generated src/pages/index.mdx from README.md')
