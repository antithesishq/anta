import { readdir, readFile } from 'node:fs/promises'

const src = new URL('../src/', import.meta.url)
const antaChildLayerOrder = '@layer anta.reset, anta.components, anta.theme;'

async function cssFiles(dir = src) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = new URL(entry.name, `${dir}/`)
    if (entry.isDirectory()) return cssFiles(path)
    return entry.name.endsWith('.css') ? [path] : []
  }))
  return nested.flat()
}

const files = await cssFiles()
const failures = []

for (const file of files) {
  const path = file.pathname
  const css = await readFile(file, 'utf8')
  if (/^@layer anta \{/m.test(css)) {
    failures.push(`${path}: shipped rules must not use the direct anta layer`)
  }

  if (path.endsWith('/reset.css') && !css.includes('@layer anta.reset {')) {
    failures.push(`${path}: reset rules must use anta.reset`)
  }
  if (path.endsWith('/theme-anta.css')) {
    if (!css.includes('@layer anta.theme {')) {
      failures.push(`${path}: component palette rules must use anta.theme`)
    }
    if (!css.includes(antaChildLayerOrder)) {
      failures.push(`${path}: must reserve the internal Anta layer order`)
    }
  }
  if (!path.endsWith('/reset.css') && !path.endsWith('/theme-anta.css') && !path.endsWith('/tokens.css') && !css.includes('@layer anta.components {')) {
    failures.push(`${path}: component styles must use anta.components`)
  }
}

const tokens = await readFile(new URL('tokens.css', src), 'utf8')
if (!tokens.includes(antaChildLayerOrder)) {
  failures.push('src/tokens.css: must declare the internal Anta layer order')
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`✓ Cascade layers: ${files.length} stylesheets use the declared Anta layer architecture.`)
