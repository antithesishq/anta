import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(root, 'tests', '.test-output')
const requested = process.argv[2]
let output

if (requested) {
  output = path.isAbsolute(requested) ? requested : path.join(outputRoot, requested)
} else {
  const latest = fs.existsSync(outputRoot)
    ? fs.readdirSync(outputRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .at(-1)
    : undefined
  if (!latest) {
    console.error('No Bombadil harness runs found.')
    process.exit(1)
  }
  output = path.join(outputRoot, latest)
}

if (!fs.existsSync(output)) {
  console.error(`Bombadil output does not exist: ${path.relative(root, output)}`)
  process.exit(1)
}

const result = spawnSync('bombadil', ['browser', 'inspect', output], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
