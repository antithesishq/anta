import changelog from '../../../CHANGELOG.md?raw'
import rss from '@astrojs/rss'
import type { APIRoute } from 'astro'
import { marked } from 'marked'

type Release = {
  version: string
  date: Date
  body: string
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

const releases = releasesFrom(changelog)
const latestRelease = releases[0]

export const GET: APIRoute = async ({ site }) => {
  const response = await rss({
    title: 'Anta changelog',
    description: 'Release notes for @antadesign/anta.',
    site: new URL('/changelog/', site),
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: `
      <language>en</language>
      <lastBuildDate>${latestRelease?.date.toUTCString() ?? ''}</lastBuildDate>
      <atom:link href="${new URL('/changelog.rss', site)}" rel="self" type="application/rss+xml" />
    `,
    items: releases.map(({ version, date, body }) => {
      const dateLabel = date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
      return {
        title: `Anta ${version}`,
        link: new URL(`/changelog/dev/#${headingId(version, dateLabel)}`, site).href,
        pubDate: date,
        description: marked.parse(body, { async: false }),
      }
    }),
  })
  response.headers.set('Content-Type', 'application/rss+xml; charset=utf-8')
  return response
}
