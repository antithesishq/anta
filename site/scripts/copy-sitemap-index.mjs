import { copyFile, readdir, rename, rm } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
const sitemapFiles = (await readdir(dist))
  .filter((file) => /^sitemap-\d+\.xml$/.test(file))
  .sort()

await rm(new URL('sitemap.xml', dist), { force: true })

// The sitemap integration always writes chunks plus an index. Keep the small
// site as one direct URL set, and retain an index only if it outgrows one chunk.
if (sitemapFiles.length === 1) {
  await rename(new URL(sitemapFiles[0], dist), new URL('sitemap.xml', dist))
  await rm(new URL('sitemap-index.xml', dist))
  console.log(`renamed ${sitemapFiles[0]} → sitemap.xml`)
} else {
  await copyFile(
    new URL('sitemap-index.xml', dist),
    new URL('sitemap.xml', dist),
  )
  console.log('copied sitemap-index.xml → sitemap.xml')
}
