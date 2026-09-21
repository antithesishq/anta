// Standalone pages retain their own layouts. MDX titles come from frontmatter.
export const STANDALONE_PAGES = [
  { id: 'overview', path: '/', source: 'src/pages/index.astro', title: 'Overview', nav: { group: 'overview', order: 10, icon: 'info' }, exportOrder: 10, exportPath: 'overview.md', exportContent: 'overview' },
  { id: 'comparison', path: '/comparison/', source: 'src/pages/comparison.mdx', nav: { group: 'overview', order: 20, icon: 'table-2' }, exportOrder: 20 },
  { id: 'install', path: '/install/', source: 'src/pages/install.mdx', nav: { group: 'setup', order: 10, icon: 'download' }, exportOrder: 30, exportPath: 'install-config.md' },
  { id: 'normalization', path: '/normalization/', source: 'src/pages/normalization.mdx', nav: { group: 'setup', order: 20, icon: 'book-a' }, exportOrder: 40 },
  { id: 'colors', path: '/colors/', source: 'src/pages/colors.mdx', nav: { group: 'design', order: 20, icon: 'swatch-book' }, exportOrder: 50 },
  { id: 'theming', path: '/theming/', source: 'src/pages/theming.mdx', nav: { group: 'design', order: 10, icon: 'theme' }, exportOrder: 60 },
  { id: 'accessibility', path: '/accessibility/', source: 'src/pages/accessibility/index.mdx', nav: { group: 'design', order: 30, icon: 'hat-glasses' }, exportOrder: 70 },
  { id: 'credits', path: '/credits/', source: 'src/pages/credits.mdx', nav: { group: 'design', order: 40, icon: 'heart-handshake' }, exportOrder: 80 },
  { id: 'changelog', path: '/changelog/', source: 'src/pages/changelog.astro', title: 'Changelog', nav: { group: 'setup', order: 30, icon: 'scroll-text' }, exportOrder: 90, exportContent: 'changelog' },
  { id: 'changelog/dev', path: '/changelog/dev/', source: 'src/pages/changelog/dev.astro', title: 'Changelog — dev releases', breadcrumbLabel: 'Changelog', nav: false, export: false },
]
