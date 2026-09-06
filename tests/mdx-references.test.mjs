import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { test } from 'node:test'
import { parseMdx } from '../site/lib/llms/parse-mdx.mjs'
import { renderDocumentation } from '../site/lib/llms/render-documentation.mjs'
import { documentationLinks, componentGroups, packageLinks } from '../site/lib/llms/index-content.mjs'
import { AS_OF, SYSTEMS, CATEGORIES } from '../site/src/components/comparison-data.ts'
import { TEXT_LINES } from '../site/src/components/color-reference.ts'
import { SYSTEM_COLORS } from '../site/src/components/system-colors.ts'
import { SPECS } from '../site/src/components/theming-lab-formulas.ts'
import { ICON_SHAPES } from '../src/elements/a-icon.shapes.ts'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')
const sources = Object.fromEntries(await Promise.all(Object.entries({
  tokens: '../src/tokens.css',
  theme: '../src/theme-anta.css',
  stickers: '../stickers/src/generated/index.ts',
  specimen: '../site/src/components/HtmlSpecimen.astro',
}).map(async ([key, path]) => [key, await read(path)])))
const renderPage = async (page) => renderDocumentation(await read(`../site/src/pages/${page}.mdx`), sources)

test('reference expansion preserves code and skips previews', () => {
  const calls = []
  const result = parseMdx(`<Reference />
{DATE}
<Preview><Reference /></Preview>
<Playground><Reference /></Playground>
\`<Reference /> {DATE}\`
\`\`\`astro
<Reference /> {DATE}
\`\`\``, {
    renderComponent(name) {
      calls.push(name)
      return '| Value |\n| --- |\n| `<a-icon>` |\n\n```css\n.example { color: red; }\n```'
    },
    expressions: { DATE: 'September 2026' },
  })
  assert.deepEqual(calls, ['Reference'])
  assert.match(result, /\| `<a-icon>` \|/)
  assert.match(result, /\.example \{ color: red; \}/)
  assert.match(result, /September 2026/)
  assert.match(result, /`<Reference \/> \{DATE\}`/)
  assert.match(result, /```astro\n<Reference \/> \{DATE\}\n```/)
})

test('comparison includes every system, coverage category, example, and snapshot date', async () => {
  const markdown = await renderPage('comparison')
  assert.ok(markdown.includes(AS_OF))
  for (const system of SYSTEMS) {
    for (const value of [system.name, system.version, system.license, system.bundleSize, system.bundleIncludes, system.browsers, ...system.pros, ...system.cons]) {
      assert.ok(markdown.includes(value), `${system.name}: ${value}`)
    }
    if (system.bundleVersion) assert.ok(markdown.includes(system.bundleVersion))
    if (system.browserSupport) assert.ok(markdown.includes(system.browserSupport))
    for (const source of system.sources ?? []) assert.ok(markdown.includes(`[${source.label}](${source.href})`))
  }
  for (const category of CATEGORIES) {
    assert.ok(markdown.includes(`${category.label}: ${category.members}`))
    for (const example of Object.values(category.examples ?? {})) assert.ok(markdown.includes(example))
  }
  assert.match(markdown, /https:\/\/webawesome.com\/docs\/components\/resize-observer\//)
  assert.match(markdown, /\[Included \(Box, Capture\)\]\(\/box\/\)/)
  assert.doesNotMatch(markdown, /\{AS_OF\}|<ComparisonMatrix|<CoverageMatrix|<SystemCards/)
})

test('colors retain guidance and every role declaration from both palettes', async () => {
  const markdown = await renderPage('colors')
  for (const line of TEXT_LINES) assert.ok(markdown.includes(line.copy))
  for (const css of [sources.tokens, sources.theme]) {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
    for (const [, name, value] of clean.matchAll(/(--(?:bg|text|border)-[1-5](?:-[a-z]+)?|--link-color(?:-hover)?|--focus-ring)\s*:\s*([^;]+);/g)) {
      assert.ok(markdown.includes(`\`${name}\``), name)
      assert.ok(markdown.includes(`\`${value.trim()}\``), `${name}: ${value}`)
    }
  }
  assert.match(markdown, /### Link color/)
  assert.match(markdown, /### Focus ring/)
  assert.match(markdown, /Default light \| Default dark \| Reference light \| Reference dark/)
})

test('accessibility retains system colors and explains browser-dependent contrast', async () => {
  const markdown = await renderPage('accessibility/index')
  for (const row of SYSTEM_COLORS) {
    for (const color of row.colors) assert.ok(markdown.includes(`\`${color}\``))
    assert.ok(markdown.includes(row.use.replaceAll('<', '&lt;').replaceAll('>', '&gt;')))
  }
  assert.match(markdown, /composites transparent text over its background/)
  assert.match(markdown, /Computed contrast cells depend on the selected palette and settings/)
})

test('catalogs include every icon and generated sticker export', async () => {
  const icons = await renderPage('icon')
  for (const shape of ICON_SHAPES) assert.ok(icons.includes(`| \`${shape}\` |`), shape)
  const stickers = await renderPage('stickers')
  for (const [, name, path] of sources.stickers.matchAll(/^export \{ (Sticker\w+) \} from '\.\/([^']+)'/gm)) {
    assert.ok(stickers.includes(`\`${name}\``), name)
    assert.ok(stickers.includes(`\`@antadesign/stickers/${path}\``), path)
  }
})

test('theming inputs and normalization specimen have static references', async () => {
  const theme = await renderPage('theming')
  for (const spec of SPECS) {
    assert.ok(theme.includes(`### ${spec.title.replaceAll(' & ', ' and ')}`))
    for (const variable of spec.vars) assert.ok(theme.includes(`| ${variable.label} |`), `${spec.id}.${variable.key}`)
  }
  const normalization = await renderPage('normalization')
  assert.match(normalization, /```html\n<div class="specimen">/)
  assert.match(normalization, /<h2>Heading two<\/h2>/)
  assert.match(normalization, /<abbr title="Cascading Style Sheets">abbr<\/abbr>/)
  assert.doesNotMatch(normalization, /<style>/)
})

test('every MDX page is indexed and has a packaged Markdown file', async () => {
  const routes = [...documentationLinks, ...componentGroups.flat(), ...packageLinks]
  const indexed = new Set(routes.map(([, path]) => path === '/accessibility/' ? 'accessibility/index.mdx' : `${path.slice(1, -1)}.mdx`))
  const pages = await readdir(new URL('../site/src/pages/', import.meta.url), { recursive: true })
  assert.deepEqual(pages.filter(path => path.endsWith('.mdx') && !indexed.has(path)), [])
  for (const [, path] of routes) {
    const prefix = componentGroups.flat().some(([, route]) => route === path) ? 'components/'
      : packageLinks.some(([, route]) => route === path) ? 'packages/' : ''
    const slug = path === '/' ? 'overview' : path === '/install/' ? 'install-config' : path.slice(1, -1)
    assert.match(await read(`../docs/${prefix}${slug}.md`), /^# /m, path)
  }
})

test('packaged references contain the expanded content', async () => {
  for (const [page, marker] of [
    ['comparison', AS_OF],
    ['colors', '| Default light | Default dark |'],
    ['accessibility', '| `Canvas`, `CanvasText` |'],
    ['components/icon', '| `chevron-down` |'],
    ['packages/stickers', '| `StickerVacation` |'],
    ['theming', '## Theming lab reference'],
    ['normalization', '<h2>Heading two</h2>'],
  ]) assert.ok((await read(`../docs/${page}.md`)).includes(marker), page)
})
