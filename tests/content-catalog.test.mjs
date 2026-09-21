import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import {
  COLLECTIONS,
  getExportGroups,
  getNavigationGroups,
  readPageCatalog,
  validatePageCatalog,
} from '../site/lib/content/catalog.mjs'

const component = (title, overrides = {}) => ({
  title,
  nav: { group: 'controls', icon: 'pointer', order: 10 },
  ...overrides,
})
const packagePage = (title, overrides = {}) => ({
  title,
  nav: { icon: 'chart-spline', order: 10 },
  ...overrides,
})

async function fixture(t, entries) {
  const siteRoot = await mkdtemp(join(tmpdir(), 'anta-content-catalog-'))
  t.after(() => rm(siteRoot, { recursive: true, force: true }))
  await Promise.all(COLLECTIONS.map(collection => mkdir(join(siteRoot, collection.directory), { recursive: true })))
  const write = async (path, metadata) => {
    const source = join(siteRoot, 'src/content', path)
    await mkdir(dirname(source), { recursive: true })
    await writeFile(source, `---\n${JSON.stringify(metadata)}\n---\n\nExample content.\n`)
    return source
  }
  for (const [path, metadata] of Object.entries(entries)) await write(path, metadata)
  return { siteRoot, write, read: () => readPageCatalog({ siteRoot, standalonePages: [] }) }
}

// Preserve the navigation users already see while moving its source into collections.
const existingSidebar = [
  ["/", "info", "Overview"],
  ["/comparison/", "table-2", "Comparison"],
  ["/install/", "download", "Install and configure"],
  ["/normalization/", "book-a", "Normalization"],
  ["/changelog/", "scroll-text", "Changelog"],
  ["/theming/", "theme", "Theming"],
  ["/colors/", "swatch-book", "Colors"],
  ["/accessibility/", "hat-glasses", "Accessibility"],
  ["/credits/", "heart-handshake", "Credits"],
  ["/title/", "case-sensitive", "Title"],
  ["/text/", "text-initial", "Text"],
  ["/tag/", "tag", "Tag"],
  ["/tooltip/", "chat", "Tooltip"],
  ["/icon/", "bug", "Icon"],
  ["/avatar/", "circle-user", "Avatar"],
  ["/loader/", "loader-docs", "Loader"],
  ["/progress/", "hourglass", "Progress"],
  ["/button/", "pointer", "Button"],
  ["/breadcrumbs/", "chevrons-right", "Breadcrumbs"],
  ["/checkbox/", "square-check-big", "Checkbox"],
  ["/radio/", "circle-dot", "Radio"],
  ["/switch/", "toggle-right", "Switch"],
  ["/slider/", "settings-2", "Slider"],
  ["/tabs/", "tabs", "Tabs"],
  ["/steps/", "footprints", "Steps"],
  ["/input/", "text-cursor-input", "Input"],
  ["/input-autocomplete/", "search-slash", "InputAutocomplete"],
  ["/input-date/", "calendar-days", "InputDate"],
  ["/input-time/", "clock", "InputTime"],
  ["/select/", "square-chevron-down", "Select"],
  ["/select-faceted/", "filter", "SelectFaceted"],
  ["/banner/", "banner", "Banner"],
  ["/card/", "card", "Card"],
  ["/dialog/", "dialog", "Dialog"],
  ["/toaster/", "toaster", "Toaster"],
  ["/expander/", "square-chevron-right", "Expander"],
  ["/menu/", "square-menu", "Menu"],
  ["/box/", "square-dashed", "Box"],
  ["/capture/", "vector-square", "Capture"],
  ["/panel/", "inspection-panel", "Panel"],
  ["/plot/", "chart-spline", "Plot"],
  ["/table/", "table-2", "Table"],
  ["/stickers/", "sticker", "Stickers"],
]

test('the content catalog preserves existing sidebar groups, links, icons, and labels', async () => {
  const catalog = await readPageCatalog()
  const groups = getNavigationGroups(catalog)
  assert.deepEqual(groups.flatMap(group => group.pages.map(page => [page.path, page.nav.icon, page.label])), existingSidebar)
  assert.deepEqual(groups.filter(group => group.title).map(group => group.title), ['Components', 'Packages'])
  assert.deepEqual(groups.map(group => group.pages.length), [2, 3, 4, 8, 8, 6, 6, 3, 3])
  assert.equal(catalog.find(page => page.path === '/input-date/').breadcrumbLabel, 'InputDate')
  assert.equal(catalog.find(page => page.path === '/changelog/dev/').breadcrumbLabel, 'Changelog')
  assert.equal(catalog.find(page => page.path === '/table/').kind, 'package')
})

test('nested package pages derive public routes, export paths, and parent-first navigation', async t => {
  const site = await fixture(t, {
    'components/button/index.mdx': component('Button'),
    'packages/plot/index.mdx': packagePage('Plot', { nav: { icon: 'chart-spline', order: 50 } }),
    'packages/plot/interactions.mdx': packagePage('Interactions', { nav: { icon: 'pointer', order: 0 } }),
    'packages/plot/interactions/drag/index.mdx': packagePage('Dragging', { parent: 'interactions' }),
    'packages/plot/old-name.mdx': packagePage('Compatibility', { path: '/plot/legacy/' }),
  })
  const catalog = await site.read()
  const byKey = new Map(catalog.map(page => [page.key, page]))
  assert.equal(byKey.get('components:button').path, '/button/')
  assert.equal(byKey.get('components:button').exportPath, 'components/button.md')
  assert.equal(byKey.get('plotDocs:index').path, '/plot/')
  assert.equal(byKey.get('plotDocs:index').exportPath, 'packages/plot.md')
  assert.equal(byKey.get('plotDocs:interactions').parentKey, 'plotDocs:index')
  assert.equal(byKey.get('plotDocs:interactions/drag').parentKey, 'plotDocs:interactions')
  assert.equal(byKey.get('plotDocs:interactions/drag').path, '/plot/interactions/drag/')
  assert.equal(byKey.get('plotDocs:interactions/drag').exportPath, 'packages/plot/interactions/drag.md')
  assert.equal(byKey.get('plotDocs:old-name').path, '/plot/legacy/')
  assert.equal(byKey.get('plotDocs:old-name').exportPath, 'packages/plot/legacy.md')
  assert.deepEqual(getNavigationGroups(catalog).find(group => group.id === 'packages').pages.map(page => page.title), [
    'Plot', 'Interactions', 'Dragging', 'Compatibility',
  ])
})

test('invalid parent chains fail before routes and navigation can be generated', async t => {
  for (const [name, entries, expected] of [
    ['missing root', { 'packages/plot/usage.mdx': packagePage('Usage') }, /Missing parent plotDocs:index/],
    ['missing explicit parent', {
      'packages/plot/index.mdx': packagePage('Plot'),
      'packages/plot/usage.mdx': packagePage('Usage', { parent: 'unknown' }),
    }, /Missing parent plotDocs:unknown/],
    ['cycle', {
      'packages/plot/index.mdx': packagePage('Plot', { parent: 'usage' }),
      'packages/plot/usage.mdx': packagePage('Usage'),
    }, /Parent cycle/],
  ]) {
    await t.test(name, async t => {
      const site = await fixture(t, entries)
      await assert.rejects(site.read, expected)
    })
  }
})

test('different collections cannot claim the same public URL', async t => {
  const site = await fixture(t, {
    'components/button/index.mdx': component('Button'),
    'packages/plot/index.mdx': packagePage('Plot', { path: '/button/' }),
  })
  await assert.rejects(site.read, /Duplicate page route: \/button\//)
})

test('one source document cannot appear twice in the combined page catalog', async t => {
  const site = await fixture(t, {
    'components/button/index.mdx': component('Button'),
    'components/checkbox/index.mdx': component('Checkbox'),
  })
  const catalog = await site.read()
  catalog[1].source = catalog[0].source
  assert.throws(() => validatePageCatalog(catalog), /Duplicate.*source/i)
})

test('flat pages and directory indexes cannot claim the same collection identity', async t => {
  const site = await fixture(t, {
    'components/button.mdx': component('Button'),
    'components/button/index.mdx': component('Another button'),
  })
  await assert.rejects(site.read, /Duplicate catalog entry: components:button/)
})

test('schemas reject incomplete navigation and metadata that cannot produce valid routes', async t => {
  for (const [name, path, metadata] of [
    ['component without group', 'components/button/index.mdx', component('Button', { nav: { icon: 'pointer', order: 0 } })],
    ['package with component group', 'packages/plot/index.mdx', component('Plot')],
    ['unknown group', 'components/button/index.mdx', component('Button', { nav: { group: 'unknown', icon: 'pointer', order: 0 } })],
    ['missing icon', 'components/button/index.mdx', component('Button', { nav: { group: 'controls', order: 0 } })],
    ['negative order', 'components/button/index.mdx', component('Button', { nav: { group: 'controls', icon: 'pointer', order: -1 } })],
    ['invalid route', 'components/button/index.mdx', component('Button', { path: '/missing-trailing-slash' })],
    ['unknown field', 'components/button/index.mdx', component('Button', { navigation: false })],
  ]) {
    await t.test(name, async t => {
      const site = await fixture(t, { [path]: metadata })
      await assert.rejects(site.read, /Invalid metadata/)
    })
  }
})

test('navigation and documentation exports can exclude pages independently', async t => {
  const site = await fixture(t, {
    'components/hidden/index.mdx': component('Hidden from navigation', { nav: false }),
    'components/browser-only/index.mdx': component('Browser only', { export: false }),
    'packages/plot/index.mdx': packagePage('Plot'),
    'packages/plot/advanced.mdx': packagePage('Advanced', { nav: false }),
    'packages/plot/internal.mdx': packagePage('Internal', { nav: false, export: false }),
  })
  const catalog = await site.read()
  assert.deepEqual(getNavigationGroups(catalog).flatMap(group => group.pages.map(page => page.path)), ['/browser-only/', '/plot/'])
  const exports = getExportGroups(catalog)
  assert.deepEqual(exports.components.flat().map(page => page.path), ['/hidden/'])
  assert.deepEqual(exports.packages.map(page => page.path), ['/plot/', '/plot/advanced/'])
  assert.equal(catalog.length, 5)
})

test('reading again reflects edited metadata without restarting the process', async t => {
  const site = await fixture(t, { 'components/button/index.mdx': component('Before') })
  const before = await site.read()
  await site.write('components/button/index.mdx', component('After', {
    path: '/renamed-button/', nav: { group: 'inputs', icon: 'search', order: 0, label: 'Updated navigation' },
  }))
  const after = await site.read()
  assert.equal(before[0].title, 'Before')
  assert.equal(after[0].title, 'After')
  assert.equal(after[0].path, '/renamed-button/')
  assert.equal(after[0].exportPath, 'components/renamed-button.md')
  assert.equal(after[0].breadcrumbLabel, 'Updated navigation')
  assert.equal(getNavigationGroups(after)[0].id, 'inputs')
})


test('index and flat subpages export only their own co-located demo source', async t => {
  const site = await fixture(t, {
    'packages/plot/index.mdx': packagePage('Plot'),
    'packages/plot/usage.mdx': packagePage('Usage'),
    'packages/plot/interactions/index.mdx': packagePage('Interactions'),
    'packages/plot/interactions/selection.mdx': packagePage('Selection', { parent: 'interactions' }),
  })
  const directory = join(site.siteRoot, 'src/content/packages/plot')
  for (const demo of ['plot.demo.ts', 'usage.demo.ts', 'interactions/drag.demo.ts', 'interactions/selection.demo.ts']) {
    await writeFile(join(directory, demo), 'export default `const example = true`\n')
  }
  const byId = new Map((await site.read()).map(page => [page.id, page]))
  assert.equal(byId.get('index').demoSource, join(directory, 'plot.demo.ts'))
  assert.equal(byId.get('usage').demoSource, join(directory, 'usage.demo.ts'))
  assert.equal(byId.get('interactions').demoSource, join(directory, 'interactions/drag.demo.ts'))
  assert.equal(byId.get('interactions/selection').demoSource, join(directory, 'interactions/selection.demo.ts'))

  await rm(join(directory, 'plot.demo.ts'))
  const withoutIndexDemo = new Map((await site.read()).map(page => [page.id, page]))
  assert.equal(withoutIndexDemo.get('index').demoSource, undefined)
  assert.equal(withoutIndexDemo.get('usage').demoSource, join(directory, 'usage.demo.ts'))
})

test('multiple unclaimed demos fail instead of choosing a filesystem-dependent example', async t => {
  const site = await fixture(t, { 'packages/plot/index.mdx': packagePage('Plot') })
  const directory = join(site.siteRoot, 'src/content/packages/plot')
  await writeFile(join(directory, 'first.demo.ts'), 'export default `first`\n')
  await writeFile(join(directory, 'second.demo.ts'), 'export default `second`\n')
  await assert.rejects(site.read, /Multiple demo sources/)
})

test('standalone Markdown titles come from content while navigation stays in its manifest', async t => {
  const site = await fixture(t, {})
  await writeFile(join(site.siteRoot, 'guide.mdx'), '---\ntitle: Authored guide title\n---\n# Guide\n')
  await writeFile(join(site.siteRoot, 'overview.astro'), '<main>Overview</main>\n')
  const standalonePages = [
    { id: 'overview', source: 'overview.astro', path: '/', title: 'Overview', nav: false, export: false },
    {
      id: 'guide', source: 'guide.mdx', path: '/guide/',
      nav: { group: 'setup', order: 10, icon: 'book-a', label: 'Guide' },
      breadcrumbLabel: 'Start here', exportPath: 'getting-started.md',
    },
  ]
  const catalog = await readPageCatalog({ siteRoot: site.siteRoot, standalonePages })
  const guide = catalog.find(page => page.id === 'guide')
  assert.equal(guide.title, 'Authored guide title')
  assert.equal(guide.label, 'Guide')
  assert.equal(guide.breadcrumbLabel, 'Start here')
  assert.equal(guide.exportPath, 'getting-started.md')
  assert.deepEqual(getExportGroups(catalog).documentation.map(page => page.id), ['guide'])
  assert.deepEqual(getNavigationGroups(catalog).flatMap(group => group.pages.map(page => page.id)), ['guide'])
})

test('standalone metadata rejects invalid routes, navigation, and export destinations', async t => {
  for (const [name, invalid] of [
    ['invalid route', { path: '/no-trailing-slash' }],
    ['invalid group', { nav: { group: 'unknown', order: 0, icon: 'book-a' } }],
    ['missing icon', { nav: { group: 'setup', order: 0 } }],
    ['escaping export path', { exportPath: '../outside.md' }],
    ['invalid export renderer', { exportContent: 'unknown' }],
    ['unknown metadata field', { navigation: false }],
  ]) {
    await t.test(name, async t => {
      const site = await fixture(t, {})
      await writeFile(join(site.siteRoot, 'guide.astro'), '<main>Guide</main>\n')
      await assert.rejects(() => readPageCatalog({
        siteRoot: site.siteRoot,
        standalonePages: [{ id: 'guide', source: 'guide.astro', path: '/guide/', title: 'Guide', nav: false, ...invalid }],
      }), /Invalid|Unrecognized/)
    })
  }
})
