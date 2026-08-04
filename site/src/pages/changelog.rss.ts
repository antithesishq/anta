import { readFileSync } from 'node:fs'
import type { APIRoute } from 'astro'
import { marked } from 'marked'

const SITE = 'https://anta.design'
const CHANGELOG = readFileSync(new URL('../../../CHANGELOG.md', import.meta.url), 'utf8')

type Release = {
  version: string
  date: Date
  body: string
}

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[char]!)
}

function cdata(value: string) {
  return `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`
}

function headingId(version: string, date: string) {
  return `${version.replaceAll('.', '')}--${date.toLowerCase().replace(',', '').replaceAll(' ', '-')}`
}

function releasesFrom(changelog: string): Release[] {
  return changelog
    .split(/^## /m)
    .slice(1)
    .map((section) => {
      const [heading, ...body] = section.split('\n')
      const match = heading.match(/^(\S+) — ([A-Z][a-z]+ \d{1,2}, \d{4})$/)
      if (!match) return null

      const [, version, date] = match
      return {
        version,
        date: new Date(`${date} UTC`),
        body: body.join('\n').trim(),
      }
    })
    .filter((release): release is Release => release !== null)
}

const releases = releasesFrom(CHANGELOG)
const latestRelease = releases[0]

const items = releases.map(({ version, date, body }) => {
  const dateLabel = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const link = `${SITE}/changelog/dev/#${headingId(version, dateLabel)}`

  return `
    <item>
      <title>${escapeXml(`Anta ${version}`)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${date.toUTCString()}</pubDate>
      <description>${cdata(marked.parse(body))}</description>
    </item>`
})

const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Anta changelog</title>
    <link>${SITE}/changelog/</link>
    <description>Release notes for @antadesign/anta.</description>
    <language>en</language>
    <lastBuildDate>${latestRelease?.date.toUTCString() ?? ''}</lastBuildDate>
    <atom:link href="${SITE}/changelog.rss" rel="self" type="application/rss+xml" />${items.join('')}
  </channel>
</rss>
`

export const GET: APIRoute = () =>
  new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
