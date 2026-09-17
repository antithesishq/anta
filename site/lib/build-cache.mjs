import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'

// Hash contents and filenames so additions, deletions, and restored timestamps
// invalidate the cache. Keep input trees narrow and exclude generated outputs.
export async function fingerprint(root, paths) {
  const hash = createHash('sha256')
  async function visit(path) {
    const info = await stat(path)
    hash.update(JSON.stringify([relative(root, path), info.isDirectory() ? 'dir' : 'file']))
    if (info.isDirectory()) {
      for (const name of (await readdir(path)).sort()) await visit(join(path, name))
    } else {
      const contents = await readFile(path)
      hash.update(String(contents.length)).update(':').update(contents)
    }
  }
  for (const path of [...paths].sort()) await visit(join(root, path))
  return hash.digest('hex')
}

async function readRecord(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return null
    throw error
  }
}

async function outputFingerprint(root, outputs) {
  try {
    return await fingerprint(root, outputs)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

export async function cachedBuild({ root, cacheDir, name, inputs, outputs, build, force = false }) {
  const file = join(cacheDir, `${name}.json`)
  const inputHash = await fingerprint(root, inputs)
  const runtime = `${process.version}:${process.platform}:${process.arch}:${process.env.NODE_ENV ?? ''}`
  const previous = await readRecord(file)
  if (!force && previous?.runtime === runtime && previous.inputs === inputHash &&
      typeof previous.outputs === 'string' &&
      previous.outputs === await outputFingerprint(root, outputs)) {
    console.log(`[build-cache] ${name}: reused`)
    return false
  }

  // A failed rebuild must not leave a reusable stamp for partial outputs.
  await rm(file, { force: true })
  console.log(`[build-cache] ${name}: building`)
  await build()
  const outputHash = await fingerprint(root, outputs)
  if (await fingerprint(root, inputs) !== inputHash) return true
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  await writeFile(temporary, JSON.stringify({ runtime, inputs: inputHash, outputs: outputHash }))
  await rename(temporary, file)
  return true
}
