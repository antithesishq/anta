import { copyFile, readdir, rename, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function copySitemapIndex({ outDir = new URL('../dist/', import.meta.url) } = {}) {
  outDir = outDir instanceof URL ? fileURLToPath(outDir) : resolve(outDir)
  const sitemapFiles = (await readdir(outDir))
    .filter((file) => /^sitemap-\d+\.xml$/.test(file))
    .sort()

  await rm(resolve(outDir, 'sitemap.xml'), { force: true })

  // The sitemap integration always writes chunks plus an index. Keep the small
  // site as one direct URL set, and retain an index only if it outgrows one chunk.
  if (sitemapFiles.length === 1) {
    await rename(resolve(outDir, sitemapFiles[0]), resolve(outDir, 'sitemap.xml'))
    await rm(resolve(outDir, 'sitemap-index.xml'))
    console.log(`renamed ${sitemapFiles[0]} → sitemap.xml`)
  } else {
    await copyFile(
      resolve(outDir, 'sitemap-index.xml'),
      resolve(outDir, 'sitemap.xml'),
    )
    console.log('copied sitemap-index.xml → sitemap.xml')
  }
}

if (import.meta.main) await copySitemapIndex()
