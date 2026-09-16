import { readdir, readFile } from 'node:fs/promises'

const src = new URL('../src/', import.meta.url)
const publicLayerOrder = '@layer base, anta, components, utilities;'
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
  const isTheme = /\/theme-[^/]+\.css$/.test(path)
  const firstLayerBlock = css.search(/@layer\s+[^;{]+\s*\{/)
  for (const order of [publicLayerOrder, antaChildLayerOrder]) {
    const declaration = css.indexOf(order)
    if (declaration === -1) {
      failures.push(`${path}: must reserve ${order}`)
    } else if (firstLayerBlock !== -1 && declaration > firstLayerBlock) {
      failures.push(`${path}: ${order} must precede the first layer block`)
    }
  }
  if (/^@layer anta \{/m.test(css)) {
    failures.push(`${path}: shipped rules must not use the direct anta layer`)
  }

  if (path.endsWith('/reset.css') && !css.includes('@layer anta.reset {')) {
    failures.push(`${path}: reset rules must use anta.reset`)
  }
  if (isTheme) {
    if (!css.includes('@layer anta.theme {')) {
      failures.push(`${path}: component palette rules must use anta.theme`)
    }
  }
  if (!path.endsWith('/reset.css') && !isTheme && !path.endsWith('/tokens.css') && !css.includes('@layer anta.components {')) {
    failures.push(`${path}: component styles must use anta.components`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`✓ Cascade layers: ${files.length} stylesheets use the declared Anta layer architecture.`)
